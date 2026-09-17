const { app } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');

let db;
let currentSessionId = null;

function init() {
  const dbPath = path.join(app.getPath('userData'), 'codedrill.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  // Flush the WAL into the main db often so attempts reach durable storage
  // quickly, even if the app is force-killed before a clean close.
  db.pragma('wal_autocheckpoint = 32');
  db.pragma('synchronous = NORMAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      problems_attempted INTEGER NOT NULL DEFAULT 0,
      problems_correct INTEGER NOT NULL DEFAULT 0,
      total_time_ms INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER,
      title TEXT,
      type TEXT,
      topic TEXT,
      difficulty TEXT,
      user_code TEXT,
      was_correct INTEGER NOT NULL DEFAULT 0,
      time_spent_ms INTEGER NOT NULL DEFAULT 0,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );
  `);

  // Migrate older databases that predate newer columns.
  const cols = db.prepare('PRAGMA table_info(results)').all().map((c) => c.name);
  if (!cols.includes('topic')) db.exec('ALTER TABLE results ADD COLUMN topic TEXT');
  if (!cols.includes('problem_json')) db.exec('ALTER TABLE results ADD COLUMN problem_json TEXT');
  if (!cols.includes('feedback')) db.exec('ALTER TABLE results ADD COLUMN feedback TEXT');

  startSession();
  return db;
}

function startSession() {
  const date = new Date().toISOString();
  const stmt = db.prepare('INSERT INTO sessions (date) VALUES (?)');
  const info = stmt.run(date);
  currentSessionId = info.lastInsertRowid;
  return currentSessionId;
}

function recordResult({ title, type, topic, difficulty, userCode, wasCorrect, timeSpentMs, problem, feedback }) {
  if (currentSessionId == null) startSession();
  const timestamp = new Date().toISOString();
  const correct = wasCorrect ? 1 : 0;
  const time = Math.max(0, Math.round(timeSpentMs || 0));

  const insert = db.prepare(`
    INSERT INTO results (session_id, title, type, topic, difficulty, user_code, was_correct, time_spent_ms, timestamp, problem_json, feedback)
    VALUES (@session_id, @title, @type, @topic, @difficulty, @user_code, @was_correct, @time_spent_ms, @timestamp, @problem_json, @feedback)
  `);
  insert.run({
    session_id: currentSessionId,
    title: title || 'Untitled',
    type: type || 'unknown',
    topic: (topic || '').trim().toLowerCase() || null,
    difficulty: difficulty || 'unknown',
    user_code: userCode || '',
    was_correct: correct,
    time_spent_ms: time,
    timestamp,
    problem_json: problem ? JSON.stringify(problem) : null,
    feedback: feedback || null,
  });

  db.prepare(`
    UPDATE sessions
    SET problems_attempted = problems_attempted + 1,
        problems_correct = problems_correct + ?,
        total_time_ms = total_time_ms + ?
    WHERE id = ?
  `).run(correct, time, currentSessionId);

  // Immediately flush this attempt to the durable main db file.
  try {
    db.pragma('wal_checkpoint(PASSIVE)');
  } catch {
    /* non-fatal */
  }

  return { ok: true };
}

function computeStreak() {
  // Distinct local days that have at least one recorded result, most recent first.
  const rows = db.prepare('SELECT timestamp FROM results ORDER BY timestamp DESC').all();
  if (rows.length === 0) return 0;

  const dayKey = (iso) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  };
  const days = new Set(rows.map((r) => dayKey(r.timestamp)));

  let streak = 0;
  const cursor = new Date();
  // Allow the streak to count from today or yesterday (in case today has no activity yet).
  if (!days.has(dayKey(cursor.toISOString()))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(dayKey(cursor.toISOString()))) return 0;
  }
  while (days.has(dayKey(cursor.toISOString()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function getStats() {
  const totals = db.prepare(`
    SELECT
      COUNT(*) AS attempted,
      COALESCE(SUM(was_correct), 0) AS correct,
      COALESCE(SUM(time_spent_ms), 0) AS total_time,
      COALESCE(AVG(time_spent_ms), 0) AS avg_time
    FROM results
  `).get();

  const byType = db.prepare(`
    SELECT type,
           COUNT(*) AS attempted,
           COALESCE(SUM(was_correct), 0) AS correct
    FROM results
    GROUP BY type
  `).all();

  const byDifficulty = db.prepare(`
    SELECT difficulty,
           COUNT(*) AS attempted,
           COALESCE(SUM(was_correct), 0) AS correct
    FROM results
    GROUP BY difficulty
  `).all();

  const recent = db.prepare(`
    SELECT title, type, topic, difficulty, was_correct, time_spent_ms, timestamp
    FROM results
    ORDER BY timestamp DESC
    LIMIT 20
  `).all();

  // Per-concept accuracy, weakest first. Used for the "Weak spots" review list.
  const topicRows = db.prepare(`
    SELECT topic,
           MAX(type) AS type,
           COUNT(*) AS attempted,
           COALESCE(SUM(was_correct), 0) AS correct
    FROM results
    WHERE topic IS NOT NULL AND topic != ''
    GROUP BY topic
  `).all();

  const weakTopics = topicRows
    .map((r) => ({
      topic: r.topic,
      type: r.type,
      attempted: r.attempted,
      correct: r.correct,
      wrong: r.attempted - r.correct,
      accuracy: r.attempted > 0 ? r.correct / r.attempted : 0,
    }))
    // A concept is a "weak spot" if you've missed it at least once.
    .filter((r) => r.wrong > 0)
    .sort((a, b) => a.accuracy - b.accuracy || b.wrong - a.wrong);

  const attempted = totals.attempted || 0;
  const correct = totals.correct || 0;

  return {
    totalSolved: correct,
    totalAttempted: attempted,
    accuracy: attempted > 0 ? correct / attempted : 0,
    avgTimeMs: Math.round(totals.avg_time || 0),
    totalTimeMs: totals.total_time || 0,
    streak: computeStreak(),
    byType,
    byDifficulty,
    weakTopics,
    recent,
  };
}

// Performance summary for one language, used to drive adaptive problem picking.
function getAdaptiveSummary(typeLabel) {
  const withAcc = (r) => ({
    ...r,
    accuracy: r.attempted > 0 ? r.correct / r.attempted : 0,
  });
  const where = 'WHERE LOWER(type) = LOWER(@t)';
  const args = { t: typeLabel };

  const totals = db
    .prepare(`SELECT COUNT(*) attempted, COALESCE(SUM(was_correct),0) correct FROM results ${where}`)
    .get(args);
  const byTopic = db
    .prepare(
      `SELECT topic, COUNT(*) attempted, COALESCE(SUM(was_correct),0) correct
       FROM results ${where} AND topic IS NOT NULL AND topic != '' GROUP BY topic`
    )
    .all(args)
    .map(withAcc);
  const byDifficulty = db
    .prepare(
      `SELECT difficulty, COUNT(*) attempted, COALESCE(SUM(was_correct),0) correct
       FROM results ${where} GROUP BY difficulty`
    )
    .all(args)
    .map(withAcc);
  const recent = db
    .prepare(
      `SELECT topic, difficulty, was_correct FROM results ${where}
       ORDER BY timestamp DESC LIMIT 8`
    )
    .all(args);

  return {
    type: typeLabel,
    attempted: totals.attempted || 0,
    correct: totals.correct || 0,
    byTopic,
    byDifficulty,
    recent,
  };
}

function getHistory(limit = 300) {
  const rows = db.prepare(`
    SELECT id, title, type, topic, difficulty, was_correct, time_spent_ms, timestamp, user_code, problem_json, feedback
    FROM results
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(Math.max(1, Math.min(1000, limit)));

  return rows.map((r) => {
    let problem = null;
    try {
      problem = r.problem_json ? JSON.parse(r.problem_json) : null;
    } catch {
      problem = null;
    }
    return {
      id: r.id,
      title: r.title,
      type: r.type,
      topic: r.topic,
      difficulty: r.difficulty,
      wasCorrect: !!r.was_correct,
      timeSpentMs: r.time_spent_ms,
      timestamp: r.timestamp,
      userCode: r.user_code,
      feedback: r.feedback,
      problem,
    };
  });
}

// Flush the WAL into the main db file and close cleanly. Called on app quit so
// recent attempts are always durably persisted (never stranded in the WAL).
function close() {
  if (!db) return;
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
    db.close();
  } catch {
    /* best effort */
  }
  db = null;
}

// Manually correct a mis-graded attempt.
function setResultCorrectness(id, wasCorrect) {
  const info = db
    .prepare('UPDATE results SET was_correct = ? WHERE id = ?')
    .run(wasCorrect ? 1 : 0, id);
  return { ok: info.changes > 0 };
}

module.exports = { init, startSession, recordResult, getStats, getHistory, getAdaptiveSummary, setResultCorrectness, close };
