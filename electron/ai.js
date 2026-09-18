const { app } = require('electron');
const config = require('./config');

const SYSTEM_PROMPT = `You are CodeDrill, an adaptive coding-interview tutor. You train alongside the learner: you track what they get wrong and deliberately choose problems that target their weaknesses, progressively adjusting difficulty and variety as they improve — like a real tutor. You have two jobs:

1. GENERATE PROBLEMS: When asked for a new problem, respond in this exact JSON format and nothing else:
{"title": "...", "difficulty": "...", "type": "...", "topic": "...", "description": "...", "tables": "...", "examples": "...", "hint": "...", "coach": "..."}
"type" is the language: "SQL" or "Python". "topic" is the single specific concept being tested, in lowercase, chosen from: window functions, CTEs, self-joins, subqueries, joins, aggregation, group by (for SQL); arrays, strings, hashmaps, stacks, sliding window, binary search, two pointers, recursion, linked lists, sorting (for Python). "difficulty" is "Easy", "Medium", or "Hard". "coach" is a short one-sentence rationale addressed to the learner explaining why you picked this problem now (leave "" when the request specifies an exact difficulty and no history is given). When the request includes the learner's performance history, act as their tutor: prioritize concepts they get wrong or rarely practice, avoid repeating their last couple of concepts, and set the difficulty adaptively — step up a level when they succeed, ease down after failures, and start new learners on Easy. For Python problems, leave tables empty. Make problems realistic interview-style questions similar to LeetCode, DataLemur, and StrataScratch.
2. GRADE SOLUTIONS: When the user submits code, evaluate it. Say if correct or not, explain bugs specifically, suggest improvements, show the clean version. Be direct and concise. If correct, acknowledge briefly and suggest what to practice next.`;

// Built-in Claude Code tools we never want this tutor to touch. Removing them
// from the model's context keeps every turn a pure text/JSON completion.
const DISALLOWED_TOOLS = [
  'Bash', 'BashOutput', 'KillShell', 'KillBash', 'Read', 'Write', 'Edit',
  'MultiEdit', 'NotebookEdit', 'Glob', 'Grep', 'WebFetch', 'WebSearch',
  'Task', 'TodoWrite', 'ExitPlanMode', 'Skill',
];

let queryFn = null;
let sessionId = null; // resumed across turns for multi-turn memory
let sessionLoaded = false; // whether we've hydrated sessionId from disk yet
const activeStreams = new Map();

// The tutor session id is persisted so the conversation (the tutor's own memory)
// survives an app restart. Hydrate lazily — the config path needs app userData.
function loadPersistedSession() {
  if (sessionLoaded) return;
  sessionLoaded = true;
  try {
    sessionId = config.getTutorSessionId();
  } catch {
    sessionId = null;
  }
}

function setSessionId(id) {
  sessionId = id || null;
  try {
    config.setTutorSessionId(sessionId);
  } catch {
    /* non-fatal */
  }
}

// Latest Claude plan usage, captured passively from rate_limit_event messages
// that the SDK emits on every turn. Persisted so we can show last-known on start.
let usageInfo = null;
let lastSessionCostUsd = null;

function captureRateLimit(info) {
  if (!info || typeof info !== 'object') return;
  const windows = {};
  const uw = info.unifiedWindows;
  if (uw && typeof uw === 'object') {
    for (const [k, v] of Object.entries(uw)) {
      if (v && typeof v.utilization === 'number') {
        windows[k] = { utilization: v.utilization, resetsAt: v.resetsAt ?? null };
      }
    }
  } else if (info.rateLimitType && typeof info.utilization === 'number') {
    windows[info.rateLimitType] = { utilization: info.utilization, resetsAt: info.resetsAt ?? null };
  }
  if (Object.keys(windows).length === 0) return;

  const prev = usageInfo && usageInfo.windows ? usageInfo.windows : {};
  usageInfo = {
    updatedAt: Date.now(),
    status: info.status || (usageInfo && usageInfo.status) || 'allowed',
    isUsingOverage: !!info.isUsingOverage,
    windows: { ...prev, ...windows },
  };
  try {
    config.writeConfig({ lastUsage: usageInfo });
  } catch {
    /* non-fatal */
  }
}

function getUsage() {
  const data = usageInfo || (config.readConfig().lastUsage || null);
  return { usage: data, sessionCostUsd: lastSessionCostUsd };
}

async function getQuery() {
  if (!queryFn) {
    // ESM-only package; load it from CommonJS via dynamic import.
    const mod = await import('@anthropic-ai/claude-agent-sdk');
    queryFn = mod.query;
  }
  return queryFn;
}

function model() {
  // Alias ('haiku'/'sonnet'/'opus') or a full id, resolved by the subscription.
  return config.getModel();
}

// Auth resolution is left to the Agent SDK's own precedence: if ANTHROPIC_API_KEY
// is set it uses that (pay-as-you-go); otherwise it falls back to the Claude Code
// CLI login on this machine, which draws on the user's subscription.
function baseOptions(controller, stderrRef) {
  return {
    abortController: controller,
    systemPrompt: SYSTEM_PROMPT,
    model: model(),
    includePartialMessages: true,
    permissionMode: 'bypassPermissions',
    settingSources: [], // ignore ~/.claude and any project CLAUDE.md/settings
    allowedTools: [],
    disallowedTools: DISALLOWED_TOOLS,
    maxTurns: 6,
    cwd: app.getPath('userData'),
    stderr: (d) => {
      if (stderrRef) stderrRef.text = (stderrRef.text + d).slice(-2000);
    },
  };
}

const LOGIN_HELP =
  "Your Claude subscription isn't available to CodeDrill yet.\n\n" +
  'CodeDrill needs its own Claude Code login on this machine (the desktop app keeps its login private to itself). ' +
  'In a terminal, run:\n\n' +
  '    npm install -g @anthropic-ai/claude-code\n' +
  '    claude\n\n' +
  'then use /login to sign in with your Anthropic account. Come back and try again.\n\n' +
  '(Alternatively, set ANTHROPIC_API_KEY to use pay-as-you-go API billing instead.)';

function isLoginError(text) {
  return /not logged in|please run\s*\/login|\/login\b|unauthorized|authentication/i.test(text || '');
}

function describeResult(message, stderrRef) {
  const raw = (message.result || '').trim();
  if (isLoginError(raw)) return LOGIN_HELP;

  const tail = stderrRef && stderrRef.text ? `\n\nDetails: ${stderrRef.text.trim().slice(-400)}` : '';
  const status = message.api_error_status ? ` (status ${message.api_error_status})` : '';
  const body = raw || `The tutor ended without a usable answer (${message.subtype})${status}.`;
  return body + tail;
}

function friendlyError(err, stderrRef) {
  const msg = (err && err.message) || String(err);
  const tail = stderrRef && stderrRef.text ? stderrRef.text.trim() : '';
  const blob = `${msg}\n${tail}`.toLowerCase();

  if (blob.includes('enoent') && blob.includes('node')) {
    return 'Node.js was not found on your PATH. The Claude Agent SDK needs Node to run — install Node.js and restart CodeDrill.';
  }
  if (
    blob.includes('unauthorized') ||
    blob.includes('authentication') ||
    blob.includes('not logged in') ||
    blob.includes('login') ||
    blob.includes('401') ||
    blob.includes('credential')
  ) {
    return "Couldn't authenticate with your Claude subscription. Open a terminal and run `claude` to log in with your Anthropic account, then try again. (Alternatively, set ANTHROPIC_API_KEY to use API billing instead.)";
  }
  return `Couldn't reach Claude via the Agent SDK: ${msg}${tail ? `\n\nDetails: ${tail.slice(-400)}` : ''}`;
}

/**
 * Stream one tutor turn.
 * @param {string} requestId
 * @param {string} text - the user's message for this turn
 * @param {{reset?: boolean}} opts - reset drops the resumed session (fresh context)
 * @param {{onChunk, onDone, onError}} handlers
 */
async function streamChat(requestId, text, opts, handlers) {
  const { reset, ephemeral } = opts || {};
  loadPersistedSession();
  if (reset) setSessionId(null);

  let query;
  try {
    query = await getQuery();
  } catch (err) {
    handlers.onError(requestId, `Failed to load the Claude Agent SDK: ${err.message}`);
    return;
  }

  const controller = new AbortController();
  activeStreams.set(requestId, controller);
  const stderrRef = { text: '' };

  const options = { ...baseOptions(controller, stderrRef) };
  // Ephemeral turns (e.g. the quick Run check) don't resume the tutoring session
  // and don't extend it — the prompt is self-contained, so this is faster/cheaper.
  if (!ephemeral && sessionId) options.resume = sessionId;
  if (ephemeral) options.maxTurns = 1;
  const wasResume = !!options.resume;

  let full = '';
  try {
    const q = query({ prompt: text, options });
    for await (const message of q) {
      if (message.session_id && !ephemeral) setSessionId(message.session_id);
      if (message.type === 'rate_limit_event') captureRateLimit(message.rate_limit_info);

      if (message.type === 'stream_event') {
        const ev = message.event;
        if (ev && ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') {
          const chunk = ev.delta.text || '';
          if (chunk) {
            full += chunk;
            handlers.onChunk(requestId, chunk);
          }
        }
      } else if (message.type === 'result') {
        activeStreams.delete(requestId);
        if (typeof message.total_cost_usd === 'number') lastSessionCostUsd = message.total_cost_usd;
        // Note: the SDK can report subtype 'success' with is_error true
        // (e.g. the "Not logged in" message), so check is_error too.
        if (message.subtype === 'success' && !message.is_error) {
          const finalText = full || (message.result || '');
          handlers.onDone(requestId, finalText);
        } else {
          // A resumed session that the SDK can no longer find shouldn't wedge the
          // tutor forever — drop it so the next turn starts a fresh conversation.
          if (wasResume) setSessionId(null);
          handlers.onError(requestId, describeResult(message, stderrRef));
        }
        return;
      }
    }
    // Generator ended without an explicit result message.
    activeStreams.delete(requestId);
    handlers.onDone(requestId, full);
  } catch (err) {
    activeStreams.delete(requestId);
    if (controller.signal.aborted) {
      handlers.onDone(requestId, full);
      return;
    }
    if (wasResume) setSessionId(null);
    handlers.onError(requestId, friendlyError(err, stderrRef));
  }
}

// Lightweight connection test used by the welcome screen. Runs in its own
// session so it never pollutes the tutor conversation.
async function checkAuth() {
  let query;
  try {
    query = await getQuery();
  } catch (err) {
    return { ok: false, error: `Failed to load the Claude Agent SDK: ${err.message}` };
  }

  const controller = new AbortController();
  const stderrRef = { text: '' };
  const options = {
    ...baseOptions(controller, stderrRef),
    systemPrompt: 'You are a connection check. Reply with exactly the word: OK',
    maxTurns: 1,
  };

  let source = null;
  try {
    const q = query({ prompt: 'Reply with the single word: OK', options });
    for await (const message of q) {
      if (message.type === 'rate_limit_event') captureRateLimit(message.rate_limit_info);
      if (message.type === 'system' && message.subtype === 'init') {
        source = message.apiKeySource;
      } else if (message.type === 'result') {
        if (typeof message.total_cost_usd === 'number') lastSessionCostUsd = message.total_cost_usd;
        if (message.subtype === 'success' && !message.is_error) {
          return { ok: true, source, sample: (message.result || '').trim().slice(0, 40) };
        }
        return { ok: false, source, error: describeResult(message, stderrRef) };
      }
    }
    return { ok: false, source, error: 'No response received from Claude.' };
  } catch (err) {
    return { ok: false, source, error: friendlyError(err, stderrRef) };
  }
}

// Force-refresh usage by running the lightweight auth ping (which the server
// answers with a fresh rate_limit_event). Returns the latest usage snapshot.
async function refreshUsage() {
  const res = await checkAuth();
  return { ...getUsage(), ok: res.ok, error: res.error };
}

function resetSession() {
  sessionLoaded = true; // an explicit reset supersedes any persisted id
  setSessionId(null);
}

function cancel(requestId) {
  const controller = activeStreams.get(requestId);
  if (controller) {
    controller.abort();
    activeStreams.delete(requestId);
  }
}

module.exports = { streamChat, checkAuth, getUsage, refreshUsage, resetSession, cancel, SYSTEM_PROMPT };
