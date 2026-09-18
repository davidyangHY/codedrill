const { contextBridge, ipcRenderer } = require('electron');

let reqCounter = 0;
const nextRequestId = () => `req_${Date.now()}_${++reqCounter}`;

contextBridge.exposeInMainWorld('api', {
  config: {
    status: () => ipcRenderer.invoke('config:status'),
    markWelcomeSeen: () => ipcRenderer.invoke('config:markWelcomeSeen'),
    setModel: (m) => ipcRenderer.invoke('config:setModel', m),
  },
  db: {
    recordResult: (payload) => ipcRenderer.invoke('db:recordResult', payload),
    getStats: () => ipcRenderer.invoke('db:getStats'),
    getHistory: (limit) => ipcRenderer.invoke('db:getHistory', limit),
    getAdaptiveSummary: (typeLabel) => ipcRenderer.invoke('db:getAdaptiveSummary', typeLabel),
    recordSeenProblem: (payload) => ipcRenderer.invoke('db:recordSeenProblem', payload),
    getRecentTitles: (typeLabel, limit) => ipcRenderer.invoke('db:getRecentTitles', typeLabel, limit),
    setResultCorrectness: (id, wasCorrect) =>
      ipcRenderer.invoke('db:setResultCorrectness', { id, wasCorrect }),
    newSession: () => ipcRenderer.invoke('db:newSession'),
  },
  daily: {
    setToday: (ms) => ipcRenderer.invoke('daily:setToday', ms),
    getProgress: () => ipcRenderer.invoke('daily:getProgress'),
    getGoal: () => ipcRenderer.invoke('daily:getGoal'),
    setGoal: (patch) => ipcRenderer.invoke('daily:setGoal', patch),
  },
  workspace: {
    load: () => ipcRenderer.invoke('workspace:load'),
    save: (ws) => ipcRenderer.invoke('workspace:save', ws),
    clear: () => ipcRenderer.invoke('workspace:clear'),
  },
  ai: {
    // Streams one tutor turn. Returns the requestId; caller subscribes with onChunk/onDone/onError.
    chat: (text, reset, ephemeral) => {
      const requestId = nextRequestId();
      ipcRenderer.send('ai:chat', { requestId, text, reset: !!reset, ephemeral: !!ephemeral });
      return requestId;
    },
    reset: () => ipcRenderer.invoke('ai:reset'),
    check: () => ipcRenderer.invoke('ai:check'),
    getUsage: () => ipcRenderer.invoke('ai:getUsage'),
    refreshUsage: () => ipcRenderer.invoke('ai:refreshUsage'),
    cancel: (requestId) => ipcRenderer.send('ai:cancel', { requestId }),
    onChunk: (cb) => subscribe('ai:chunk', cb),
    onDone: (cb) => subscribe('ai:done', cb),
    onError: (cb) => subscribe('ai:error', cb),
  },
  menu: {
    onNewSession: (cb) => subscribe('menu:new-session', cb),
    onStats: (cb) => subscribe('menu:stats', cb),
    onHistory: (cb) => subscribe('menu:history', cb),
    onUsage: (cb) => subscribe('menu:usage', cb),
    onMode: (cb) => subscribe('menu:mode', cb),
  },
});

// Returns an unsubscribe function.
function subscribe(channel, cb) {
  const listener = (_e, payload) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}
