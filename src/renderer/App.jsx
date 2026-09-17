import React, { useCallback, useEffect, useRef, useState } from 'react';
import Welcome from './components/Welcome.jsx';
import TopBar from './components/TopBar.jsx';
import ProblemDisplay from './components/ProblemDisplay.jsx';
import CodeEditor from './components/CodeEditor.jsx';
import Chat from './components/Chat.jsx';
import StatsModal from './components/StatsModal.jsx';
import HistoryModal from './components/HistoryModal.jsx';
import UsageModal from './components/UsageModal.jsx';
import { streamChat } from './lib/aiClient.js';
import { extractProblem, extractVerdict, parseRunVerdict } from './lib/parse.js';

let idc = 0;
const uid = () => `m_${Date.now()}_${++idc}`;
const modeLabel = (m) => (m === 'sql' ? 'SQL' : 'Python');
const starter = (m) => (m === 'sql' ? '-- Write your SQL query here\n' : '# Write your solution here\n');

// Builds the adaptive "pick my next problem" prompt from the learner's history.
function buildAdaptivePrompt(summary, mode, focusTopic) {
  const label = modeLabel(mode);
  const lines = [];
  const attempted = summary && summary.attempted ? summary.attempted : 0;

  if (attempted === 0) {
    lines.push(`The learner is just starting ${label} practice and has no history yet.`);
    lines.push(`Pick a good first problem: an Easy, foundational ${label} concept.`);
  } else {
    lines.push(`The learner's ${label} history so far (${summary.correct}/${attempted} solved):`);
    const topics = (summary.byTopic || []).slice().sort((a, b) => a.accuracy - b.accuracy);
    if (topics.length) {
      lines.push('By concept (weakest first):');
      for (const t of topics) {
        lines.push(`- ${t.topic}: ${t.correct}/${t.attempted} solved (${Math.round(t.accuracy * 100)}%)`);
      }
    }
    if ((summary.byDifficulty || []).length) {
      lines.push(
        'By difficulty: ' +
          summary.byDifficulty.map((d) => `${d.difficulty} ${d.correct}/${d.attempted}`).join(', ')
      );
    }
    if ((summary.recent || []).length) {
      lines.push(
        'Recent attempts (newest first): ' +
          summary.recent
            .map((r) => `${r.topic || 'unknown'} [${r.difficulty || '?'}] ${r.was_correct ? 'solved' : 'missed'}`)
            .join(', ')
      );
    }
    lines.push(
      'As their tutor, choose the single best next problem to help them improve: target a weak or under-practiced concept, avoid repeating their last couple of concepts, and set the difficulty adaptively (step up when they are succeeding at a level, ease down after failures).'
    );
  }
  if (focusTopic) lines.push(`Constraint: the concept must be "${focusTopic}".`);
  lines.push(
    `It must be a ${label} problem. Respond with ONLY the JSON object (include a one-sentence "coach" rationale addressed to the learner) — no prose, no code fences.`
  );
  return lines.join('\n');
}

// Loose detection of "give me another problem"-style chat requests.
function looksLikeProblemRequest(text) {
  const t = ' ' + (text || '').toLowerCase() + ' ';
  if (/\b(move on|next one|one more|another one|give me more|keep going|continue practicing|let'?s continue)\b/.test(t)) {
    return true;
  }
  const action = /\b(another|next|new|more|different|harder|tougher|easier|give me|gimme|generate|make me|practice|try)\b/.test(t);
  const noun = /\b(problem|problems|question|questions|exercise|challenge|version|drill)\b/.test(t);
  return action && noun;
}

// Compact one-block history summary appended to adaptive chat requests.
function adaptiveSummaryText(summary, label) {
  if (!summary || !summary.attempted) return `no ${label} history yet`;
  const parts = [`${summary.correct}/${summary.attempted} solved`];
  const topics = (summary.byTopic || []).slice().sort((a, b) => a.accuracy - b.accuracy);
  if (topics.length) {
    parts.push('by concept ' + topics.map((t) => `${t.topic} ${Math.round(t.accuracy * 100)}%`).join(', '));
  }
  if ((summary.recent || []).length) {
    parts.push(
      'recent ' +
        summary.recent.map((r) => `${r.topic || '?'}[${r.difficulty || '?'}]${r.was_correct ? 'ok' : 'miss'}`).join(', ')
    );
  }
  return parts.join('; ');
}

// Shared problem + code context sent to the tutor for Run and Submit.
function contextLines(problem, mode, code) {
  const lang = modeLabel(mode);
  return [
    'Here is the problem I am solving:',
    `Title: ${problem.title}`,
    `Difficulty: ${problem.difficulty}`,
    `Type: ${problem.type}`,
    problem.topic ? `Topic: ${problem.topic}` : '',
    `Description: ${problem.description}`,
    problem.tables ? `Tables: ${problem.tables}` : '',
    problem.examples ? `Examples: ${problem.examples}` : '',
    '',
    `Here is my ${lang} solution:`,
    '```' + (mode === 'sql' ? 'sql' : 'python'),
    code,
    '```',
  ].filter(Boolean);
}

export default function App() {
  const [checking, setChecking] = useState(true);
  const [welcomeSeen, setWelcomeSeen] = useState(true);
  const ready = true; // no API key needed — runs on the Claude Code subscription

  const [mode, setMode] = useState('sql');
  const [difficulty, setDifficulty] = useState('Auto');
  const [problem, setProblem] = useState(null);
  const [code, setCode] = useState(starter('sql'));
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genText, setGenText] = useState('');
  const [showStats, setShowStats] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const [usage, setUsage] = useState(null); // { usage, sessionCostUsd }
  const [attempted, setAttempted] = useState(false);
  const gradedRef = useRef(false); // records exactly one attempt per problem

  // Records the attempt for stats/weak-topics. Only the first grading action
  // (Run or Submit) on a given problem counts.
  const commitAttempt = useCallback(async (verdict, snapshot) => {
    if (gradedRef.current) return;
    gradedRef.current = true;
    setAttempted(true);
    if (!window.api || !window.api.db) return;
    try {
      const res = await window.api.db.recordResult({ ...snapshot, wasCorrect: verdict === true });
      if (res && res.ok === false) {
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: 'note', content: `Could not save this attempt to history: ${res.error || 'unknown error'}` },
        ]);
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: 'note', content: 'Could not save this attempt to history.' },
      ]);
    }
  }, []);

  // ---------- Timer ----------
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const startRef = useRef(null);
  const tickRef = useRef(null);

  useEffect(() => {
    if (running) {
      tickRef.current = setInterval(() => {
        setElapsed(Date.now() - startRef.current);
      }, 250);
    }
    return () => clearInterval(tickRef.current);
  }, [running]);

  const startTimer = useCallback(() => {
    if (running) return;
    startRef.current = Date.now();
    setElapsed(0);
    setRunning(true);
  }, [running]);

  const stopTimer = useCallback(() => {
    clearInterval(tickRef.current);
    setRunning(false);
    if (startRef.current) return Date.now() - startRef.current;
    return elapsed;
  }, [elapsed]);

  const resetTimer = useCallback(() => {
    clearInterval(tickRef.current);
    setRunning(false);
    setElapsed(0);
    startRef.current = null;
  }, []);

  const timerText = (() => {
    const s = Math.floor(elapsed / 1000);
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  })();

  // ---------- API key check ----------
  const refreshStatus = useCallback(async () => {
    try {
      if (!window.api || !window.api.config) throw new Error('bridge unavailable');
      const s = await window.api.config.status();
      setWelcomeSeen(!!s.welcomeSeen);
    } catch {
      setWelcomeSeen(true);
    } finally {
      setChecking(false);
    }
  }, []);

  const dismissWelcome = useCallback(() => {
    if (window.api && window.api.config) window.api.config.markWelcomeSeen();
    setWelcomeSeen(true);
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Plan usage is captured passively by the main process on every turn; pull the
  // latest snapshot on load and whenever a turn finishes (busy returns to false).
  const pullUsage = useCallback(() => {
    if (window.api && window.api.ai && window.api.ai.getUsage) {
      window.api.ai.getUsage().then(setUsage).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!busy) pullUsage();
  }, [busy, pullUsage]);

  // ---------- Menu wiring ----------
  useEffect(() => {
    if (!window.api || !window.api.menu) return undefined;
    const offMode = window.api.menu.onMode((m) => setMode(m));
    const offStats = window.api.menu.onStats(() => setShowStats(true));
    const offHistory = window.api.menu.onHistory(() => setShowHistory(true));
    const offUsage = window.api.menu.onUsage(() => setShowUsage(true));
    const offNew = window.api.menu.onNewSession(() => {
      // main already reset the tutor session; clear the UI to match.
      setMessages([]);
      setProblem(null);
      setCode(starter(mode));
      resetTimer();
      setAttempted(false);
      gradedRef.current = false;
    });
    return () => {
      offMode();
      offStats();
      offHistory();
      offUsage();
      offNew();
    };
  }, [mode, resetTimer]);

  // Keep editor starter text in sync when switching mode with no problem loaded.
  useEffect(() => {
    if (!problem && !attempted) setCode(starter(mode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ---------- Core streaming ----------
  // Conversation memory lives in the main process (the Agent SDK session is
  // resumed each turn), so we only send this turn's text upstream.
  const appendAndStream = useCallback(({ appendMsgs, upstreamUser, onComplete }) => {
    const assistantId = uid();
    setMessages((prev) => [
      ...prev,
      ...appendMsgs,
      { id: assistantId, role: 'assistant', kind: 'text', content: '', streaming: true },
    ]);
    setBusy(true);

    streamChat(upstreamUser, {
      onDelta: (d) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + d } : m))
        ),
      onDone: (full) => {
        setBusy(false);
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m))
        );
        if (onComplete) onComplete(full, assistantId);
      },
      onError: (msg) => {
        setBusy(false);
        setGenerating(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  streaming: false,
                  content: (m.content ? m.content + '\n\n' : '') + `${msg}`,
                }
              : m
          )
        );
      },
    });
  }, []);

  // ---------- New Problem ----------
  const generateProblem = useCallback(async (opts = {}) => {
    if (busy || generating) return;
    const useMode = opts.mode || mode;
    const focusTopic = typeof opts.topic === 'string' ? opts.topic : null;
    const adaptive = difficulty === 'Auto';

    setGenerating(true);
    setGenText('');
    setProblem(null);
    setAttempted(false);
    gradedRef.current = false;
    setCode(starter(useMode));
    resetTimer();

    let prompt;
    let noteContent;
    if (adaptive) {
      let summary = null;
      try {
        summary = await window.api.db.getAdaptiveSummary(modeLabel(useMode));
      } catch {
        summary = null;
      }
      prompt = buildAdaptivePrompt(summary, useMode, focusTopic);
      const solved = summary ? summary.attempted : 0;
      noteContent = focusTopic
        ? `Adapting a ${modeLabel(useMode)} problem on "${focusTopic}"…`
        : solved > 0
        ? `Picking your next ${modeLabel(useMode)} problem from your ${solved} past attempts…`
        : `Starting your ${modeLabel(useMode)} practice…`;
    } else {
      const focus = focusTopic ? ` Focus specifically on the concept "${focusTopic}".` : '';
      prompt = `Generate a new ${difficulty} ${modeLabel(
        useMode
      )} problem.${focus} Respond with ONLY the JSON object exactly as specified in your instructions — no prose, no code fences.`;
      noteContent = focusTopic
        ? `Practicing "${focusTopic}" — ${difficulty} ${modeLabel(useMode)}`
        : `New ${difficulty} ${modeLabel(useMode)} problem requested`;
    }

    const note = { id: uid(), role: 'note', content: noteContent };

    // Track streaming raw text for the "generating" preview in the problem pane.
    const assistantId = uid();
    setMessages((prev) => [
      ...prev,
      note,
      { id: assistantId, role: 'assistant', kind: 'text', content: '', streaming: true },
    ]);
    setBusy(true);

    let acc = '';
    streamChat(prompt, {
      onDelta: (d) => {
        acc += d;
        setGenText(acc);
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + d } : m))
        );
      },
      onDone: (full) => {
        setBusy(false);
        setGenerating(false);
        const parsed = extractProblem(full);
        if (parsed) {
          const enriched = {
            ...parsed,
            difficulty: parsed.difficulty || (adaptive ? 'Medium' : difficulty),
            type: parsed.type || modeLabel(useMode),
            topic: parsed.topic || focusTopic || '',
          };
          setProblem(enriched);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    id: m.id,
                    role: 'assistant',
                    kind: 'problem',
                    problem: enriched,
                    content: '',
                    streaming: false,
                  }
                : m
            )
          );
        } else {
          // Couldn't parse — leave the raw text visible and warn.
          setMessages((prev) => [
            ...prev.map((m) =>
              m.id === assistantId ? { ...m, streaming: false } : m
            ),
            {
              id: uid(),
              role: 'note',
              content: 'Could not read the generated problem. Try New Problem again.',
            },
          ]);
        }
      },
      onError: (msg) => {
        setBusy(false);
        setGenerating(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, streaming: false, content: `${msg}` }
              : m
          )
        );
      },
    });
  }, [busy, generating, difficulty, mode, resetTimer]);

  const noProblemNote = useCallback((verb) => {
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: 'note', content: `Generate a problem first, then ${verb} your solution.` },
    ]);
  }, []);

  const snapshotFor = useCallback(
    (timeSpent) => ({
      title: problem.title,
      type: problem.type || modeLabel(mode),
      topic: problem.topic || '',
      difficulty: problem.difficulty || difficulty,
      userCode: code,
      timeSpentMs: timeSpent,
      problem, // full problem snapshot, for the History view
    }),
    [problem, mode, difficulty, code]
  );

  // ---------- Run (quick verdict only) ----------
  const runCode = useCallback(() => {
    if (busy) return;
    if (!problem) return noProblemNote('run');
    const timeSpent = stopTimer();

    const prompt = [
      ...contextLines(problem, mode, code),
      '',
      'This is a quick check. Reply with EXACTLY one word and nothing else: CORRECT or INCORRECT. Do not explain.',
    ].join('\n');

    const assistantId = uid();
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: 'user', kind: 'runcheck' },
      // Stream as text (like Submit) for live feedback, then snap to a verdict.
      { id: assistantId, role: 'assistant', kind: 'run', content: '', streaming: true },
    ]);
    setBusy(true);

    const snap = snapshotFor(timeSpent);
    let acc = '';
    streamChat(prompt, {
      onDelta: (d) => {
        acc += d;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: (m.content || '') + d } : m))
        );
      },
      onDone: (full) => {
        setBusy(false);
        const verdict = parseRunVerdict(full || acc);
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, streaming: false, content: '', verdict } : m))
        );
        // Only record a clear verdict; unclear leaves it open for Submit.
        if (verdict !== null) commitAttempt(verdict, snap);
      },
      onError: (msg) => {
        setBusy(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { id: m.id, role: 'assistant', kind: 'text', streaming: false, content: `${msg}` }
              : m
          )
        );
      },
    }, { ephemeral: true });
  }, [busy, problem, code, mode, stopTimer, snapshotFor, commitAttempt, noProblemNote]);

  // ---------- Submit (full explanation) ----------
  const submitCode = useCallback(() => {
    if (busy) return;
    if (!problem) return noProblemNote('submit');
    const timeSpent = stopTimer();

    const upstreamUser = [
      ...contextLines(problem, mode, code),
      '',
      'Grade it. Say if it is correct, explain any bugs specifically, suggest improvements, and show a clean version if needed.',
      'End your response with the verdict on its own final line, plain text with no markdown or extra words — exactly one of:',
      'VERDICT: CORRECT',
      'VERDICT: INCORRECT',
    ].join('\n');

    const submissionMsg = { id: uid(), role: 'user', kind: 'submission', code };
    const snap = snapshotFor(timeSpent);

    appendAndStream({
      appendMsgs: [submissionMsg],
      upstreamUser,
      onComplete: (full, assistantId) => {
        const { verdict, clean } = extractVerdict(full);
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: clean, verdict } : m))
        );
        commitAttempt(verdict, { ...snap, feedback: clean });
      },
    });
  }, [busy, problem, code, mode, stopTimer, snapshotFor, commitAttempt, noProblemNote, appendAndStream]);

  // ---------- Free chat ----------
  // If a chat reply contains a problem JSON (e.g. the user asked "give me another
  // problem"), load it into the problem panel instead of dumping raw JSON.
  const applyProblemFromResponse = useCallback(
    (full, assistantId) => {
      const parsed = extractProblem(full);
      if (!parsed) return false;
      const t = (parsed.type || '').toLowerCase();
      const newMode = t === 'python' ? 'python' : t === 'sql' ? 'sql' : mode;
      const enriched = {
        ...parsed,
        difficulty: parsed.difficulty || (difficulty === 'Auto' ? 'Medium' : difficulty),
        type: parsed.type || modeLabel(newMode),
        topic: parsed.topic || '',
      };
      setMode(newMode);
      setProblem(enriched);
      setCode(starter(newMode));
      resetTimer();
      setAttempted(false);
      gradedRef.current = false;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { id: m.id, role: 'assistant', kind: 'problem', problem: enriched, content: '', streaming: false }
            : m
        )
      );
      return true;
    },
    [mode, difficulty, resetTimer]
  );

  const sendChat = useCallback(
    (text) => {
      const run = async () => {
        let upstream = text;
        // When it reads like a "next problem" request, attach the learner's
        // history so the tutor picks adaptively — same signal the New Problem
        // button uses. Framed softly so a false match still answers normally.
        if (looksLikeProblemRequest(text)) {
          let summary = null;
          try {
            summary = await window.api.db.getAdaptiveSummary(modeLabel(mode));
          } catch {
            summary = null;
          }
          const hist = adaptiveSummaryText(summary, modeLabel(mode));
          upstream =
            `${text}\n\n[If this is a request for a new/next problem, choose it adaptively: honor any specifics I gave; otherwise target a weak or under-practiced concept and set the difficulty to progress me. Then respond with ONLY the JSON problem object (with a one-sentence "coach" rationale). If it is NOT a request for a new problem, ignore this and answer normally. My ${modeLabel(mode)} history: ${hist}.]`;
        }
        appendAndStream({
          appendMsgs: [{ id: uid(), role: 'user', kind: 'text', content: text }],
          upstreamUser: upstream,
          onComplete: (full, assistantId) => {
            applyProblemFromResponse(full, assistantId);
          },
        });
      };
      run();
    },
    [appendAndStream, applyProblemFromResponse, mode]
  );

  const clearCode = useCallback(() => {
    setCode(starter(mode));
    resetTimer();
    setAttempted(false);
    gradedRef.current = false;
  }, [mode, resetTimer]);

  // Practice a specific weak concept from the Stats view.
  const practiceTopic = useCallback(
    (t) => {
      setShowStats(false);
      const tmode =
        (t.type || '').toLowerCase() === 'python'
          ? 'python'
          : (t.type || '').toLowerCase() === 'sql'
          ? 'sql'
          : mode;
      setMode(tmode);
      generateProblem({ topic: t.topic, mode: tmode });
    },
    [mode, generateProblem]
  );

  // Reopen a past attempt from History: restore its problem + your code to retry.
  const loadAttempt = useCallback(
    (item) => {
      if (!item || !item.problem) return;
      setShowHistory(false);
      const tmode = (item.type || '').toLowerCase() === 'python' ? 'python' : 'sql';
      setMode(tmode);
      setProblem(item.problem);
      setCode(item.userCode || starter(tmode));
      resetTimer();
      setAttempted(false);
      gradedRef.current = false;
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: 'note', content: `Reopened "${item.title}" from history` },
      ]);
    },
    [resetTimer]
  );

  const onCodeChange = useCallback(
    (val) => {
      setCode(val);
      if (problem && !running && !attempted) startTimer();
    },
    [problem, running, attempted, startTimer]
  );

  // ---------- Split panes ----------
  const [leftPct, setLeftPct] = useState(58);
  const [probPct, setProbPct] = useState(42);
  const dragH = useRef(false);
  const dragV = useRef(false);
  const leftRef = useRef(null);

  useEffect(() => {
    const move = (e) => {
      if (dragH.current) {
        const pct = (e.clientX / window.innerWidth) * 100;
        setLeftPct(Math.min(75, Math.max(35, pct)));
      }
      if (dragV.current && leftRef.current) {
        const rect = leftRef.current.getBoundingClientRect();
        const pct = ((e.clientY - rect.top) / rect.height) * 100;
        setProbPct(Math.min(75, Math.max(20, pct)));
      }
    };
    const up = () => {
      dragH.current = false;
      dragV.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, []);

  if (checking) {
    return (
      <div className="h-full flex items-center justify-center bg-base-900 text-base-500">
        <span className="w-5 h-5 border-2 border-base-500 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!welcomeSeen) {
    return <Welcome onDone={dismissWelcome} />;
  }

  return (
    <div className="h-full flex flex-col bg-base-900 overflow-hidden">
      <TopBar
        mode={mode}
        setMode={setMode}
        difficulty={difficulty}
        setDifficulty={setDifficulty}
        onNewProblem={() => generateProblem()}
        onShowStats={() => setShowStats(true)}
        onShowHistory={() => setShowHistory(true)}
        onShowUsage={() => setShowUsage(true)}
        usage={usage}
        loading={generating}
        timerText={timerText}
        timerRunning={running}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left pane */}
        <div ref={leftRef} className="flex flex-col overflow-hidden" style={{ width: `${leftPct}%` }}>
          {/* Problem display */}
          <div className="overflow-y-auto border-b border-base-600" style={{ height: `${probPct}%` }}>
            <ProblemDisplay problem={problem} generating={generating} streamingText={genText} />
          </div>

          {/* vertical resizer */}
          <div
            onMouseDown={() => {
              dragV.current = true;
              document.body.style.cursor = 'row-resize';
              document.body.style.userSelect = 'none';
            }}
            className="h-1.5 bg-base-850 hover:bg-accent/50 cursor-row-resize transition-colors shrink-0"
          />

          {/* Editor + actions */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="flex-1 min-h-0">
              <CodeEditor mode={mode} value={code} onChange={onCodeChange} />
            </div>
            <div className="flex items-center gap-2 px-3 py-2 border-t border-base-600 bg-base-850">
              <button
                onClick={runCode}
                disabled={busy || !problem}
                title="Quick check — just right or wrong"
                className="px-4 py-1.5 rounded-lg bg-accent/90 hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center gap-1.5"
              >
                Run
              </button>
              <button
                onClick={submitCode}
                disabled={busy || !problem}
                title="Submit for the full explanation"
                className="px-4 py-1.5 rounded-lg bg-good/90 hover:bg-good disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
              >
                Submit
              </button>
              <button
                onClick={clearCode}
                className="px-4 py-1.5 rounded-lg bg-base-700 hover:bg-base-600 text-sm font-medium transition-colors"
              >
                Clear
              </button>
              <div className="flex-1" />
              <span className="text-xs text-base-500 truncate max-w-[45%]">
                {mode === 'sql' ? 'SQL' : 'Python'} · {problem ? problem.title : 'no problem loaded'}
              </span>
            </div>
          </div>
        </div>

        {/* horizontal resizer */}
        <div
          onMouseDown={() => {
            dragH.current = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
          }}
          className="w-1.5 bg-base-850 hover:bg-accent/50 cursor-col-resize transition-colors shrink-0"
        />

        {/* Right pane */}
        <div className="flex-1 overflow-hidden">
          <Chat messages={messages} onSend={sendChat} busy={busy} ready={ready} />
        </div>
      </div>

      {showStats && <StatsModal onClose={() => setShowStats(false)} onPractice={practiceTopic} />}
      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} onReopen={loadAttempt} />}
      {showUsage && <UsageModal onClose={() => setShowUsage(false)} />}
    </div>
  );
}
