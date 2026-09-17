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

module.exports = {
  getApiKey,
  hasApiKey,
  setApiKey,
  getModel,
  setModel,
  getWelcomeSeen,
  setWelcomeSeen,
  getWindowState,
  saveWindowState,
  readConfig,
  writeConfig,
};
