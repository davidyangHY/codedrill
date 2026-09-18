const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const CONFIG_PATH = () => path.join(app.getPath('userData'), 'codedrill-config.json');

function readConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeConfig(patch) {
  const current = readConfig();
  const next = { ...current, ...patch };
  fs.writeFileSync(CONFIG_PATH(), JSON.stringify(next, null, 2), 'utf8');
  return next;
}

// The env var always wins over the stored key.
function getApiKey() {
  if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim()) {
    return process.env.ANTHROPIC_API_KEY.trim();
  }
  const cfg = readConfig();
  return cfg.apiKey && cfg.apiKey.trim() ? cfg.apiKey.trim() : null;
}

function hasApiKey() {
  return !!getApiKey();
}

function setApiKey(key) {
  writeConfig({ apiKey: (key || '').trim() });
}

function getModel() {
  // Claude Agent SDK model alias (resolved by the subscription) or a full id.
  // Default to Haiku — lightest on the plan's limits, plenty for these problems.
  return process.env.ANTHROPIC_MODEL || readConfig().model || 'haiku';
}

function setModel(m) {
  writeConfig({ model: m });
}

function getGoal() {
  const cfg = readConfig();
  return {
    minutes: Number.isFinite(cfg.goalMinutes) ? cfg.goalMinutes : 20,
    problems: Number.isFinite(cfg.goalProblems) ? cfg.goalProblems : 3,
  };
}

function setGoal(patch) {
  const cur = getGoal();
  const next = {
    goalMinutes: Math.max(0, Math.round(patch.minutes != null ? patch.minutes : cur.minutes)),
    goalProblems: Math.max(0, Math.round(patch.problems != null ? patch.problems : cur.problems)),
  };
  writeConfig(next);
  return getGoal();
}

function getWelcomeSeen() {
  return !!readConfig().welcomeSeen;
}

function setWelcomeSeen(v) {
  writeConfig({ welcomeSeen: !!v });
}

// ---- Window state persistence ----
function getWindowState() {
  const cfg = readConfig();
  return cfg.windowState || null;
}

function saveWindowState(state) {
  writeConfig({ windowState: state });
}

// ---- Workspace persistence (restore where you left off) ----
// Holds the last problem, editor code, chat transcript, and mode/difficulty so
// the app can reload your session on the next launch.
function getWorkspace() {
  return readConfig().workspace || null;
}

function setWorkspace(ws) {
  writeConfig({ workspace: ws && typeof ws === 'object' ? ws : null });
  return { ok: true };
}

// The Agent SDK session id for the tutor conversation. Persisting it lets the
// tutor resume the same conversation (its own memory) after a restart.
function getTutorSessionId() {
  const id = readConfig().tutorSessionId;
  return id && typeof id === 'string' ? id : null;
}

function setTutorSessionId(id) {
  writeConfig({ tutorSessionId: id && typeof id === 'string' ? id : null });
}

module.exports = {
  getApiKey,
  hasApiKey,
  setApiKey,
  getModel,
  setModel,
  getGoal,
  setGoal,
  getWelcomeSeen,
  setWelcomeSeen,
  getWindowState,
  saveWindowState,
  getWorkspace,
  setWorkspace,
  getTutorSessionId,
  setTutorSessionId,
  readConfig,
  writeConfig,
};
