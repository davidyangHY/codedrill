const path = require('path');
// Load .env from the project root (works in dev; harmless if absent).
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const config = require('./config');
const ai = require('./ai');

let db = null; // lazily required so a native-module failure doesn't block the whole app
let mainWindow = null;
const isDev = process.env.NODE_ENV === 'development';

function loadDb() {
  if (db) return db;
  try {
    db = require('./db');
    db.init();
  } catch (err) {
    console.error('Failed to initialize database:', err);
    db = null;
  }
  return db;
}

function createWindow() {
  const saved = config.getWindowState();
  const bounds = saved && saved.bounds ? saved.bounds : { width: 1440, height: 900 };

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0d1117',
    show: false,
    title: 'CodeDrill',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (saved && saved.isMaximized) mainWindow.maximize();

  if (isDev) {
    mainWindow.loadURL('http://localhost:5273');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());

  const persist = debounce(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const isMaximized = mainWindow.isMaximized();
    config.saveWindowState({
      bounds: isMaximized ? bounds : mainWindow.getBounds(),
      isMaximized,
    });
  }, 400);

  mainWindow.on('resize', persist);
  mainWindow.on('move', persist);
  mainWindow.on('close', persist);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Session',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            const database = loadDb();
            if (database) database.startSession();
            ai.resetSession();
            send('menu:new-session');
          },
        },
        {
          label: 'Stats',
          accelerator: 'CmdOrCtrl+S',
          click: () => send('menu:stats'),
        },
        {
          label: 'History',
          accelerator: 'CmdOrCtrl+H',
          click: () => send('menu:history'),
        },
        {
          label: 'Usage',
          accelerator: 'CmdOrCtrl+U',
          click: () => send('menu:usage'),
        },
        { type: 'separator' },
        { role: 'quit', label: 'Quit' },
      ],
    },
    {
      label: 'Mode',
      submenu: [
        { label: 'SQL', accelerator: 'CmdOrCtrl+1', click: () => send('menu:mode', 'sql') },
        { label: 'Python', accelerator: 'CmdOrCtrl+2', click: () => send('menu:mode', 'python') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }],
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---- IPC ----
function registerIpc() {
  // No API key required — the app runs on the user's Claude Code subscription.
  ipcMain.handle('config:status', () => ({
    ready: true,
    authMode: 'subscription',
    welcomeSeen: config.getWelcomeSeen(),
    model: config.getModel(),
  }));

  ipcMain.handle('config:markWelcomeSeen', () => {
    config.setWelcomeSeen(true);
    return { ok: true };
  });

  ipcMain.handle('config:setModel', (_e, m) => {
    config.setModel(m);
    ai.resetSession(); // start a fresh session so the new model applies right away
    return { model: config.getModel() };
  });

  ipcMain.handle('ai:check', () => ai.checkAuth());

  ipcMain.handle('ai:getUsage', () => ai.getUsage());

  ipcMain.handle('ai:refreshUsage', () => ai.refreshUsage());

  ipcMain.handle('ai:reset', () => {
    ai.resetSession();
    return { ok: true };
  });

  ipcMain.handle('db:recordResult', (_e, payload) => {
    const database = loadDb();
    if (!database) return { ok: false, error: 'Database unavailable.' };
    try {
      return database.recordResult(payload);
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:getStats', () => {
    const database = loadDb();
    if (!database) return { error: 'Database unavailable.', totalSolved: 0, totalAttempted: 0, accuracy: 0, avgTimeMs: 0, streak: 0, byType: [], byDifficulty: [], weakTopics: [], recent: [] };
    try {
      return database.getStats();
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('db:getAdaptiveSummary', (_e, typeLabel) => {
    const database = loadDb();
    if (!database) return null;
    try {
      return database.getAdaptiveSummary(typeLabel);
    } catch (err) {
      return null;
    }
  });

  ipcMain.handle('db:getHistory', (_e, limit) => {
    const database = loadDb();
    if (!database) return [];
    try {
      return database.getHistory(limit);
    } catch (err) {
      return [];
    }
  });

  ipcMain.handle('db:setResultCorrectness', (_e, { id, wasCorrect }) => {
    const database = loadDb();
    if (!database) return { ok: false };
    try {
      return database.setResultCorrectness(id, wasCorrect);
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:newSession', () => {
    const database = loadDb();
    if (database) database.startSession();
    return { ok: true };
  });

  ipcMain.on('ai:chat', (_e, { requestId, text, reset, ephemeral }) => {
    ai.streamChat(requestId, text, { reset, ephemeral }, {
      onChunk: (id, delta) => send('ai:chunk', { requestId: id, delta }),
      onDone: (id, full) => send('ai:done', { requestId: id, full }),
      onError: (id, message, code) => send('ai:error', { requestId: id, message, code }),
    });
  });

  ipcMain.on('ai:cancel', (_e, { requestId }) => ai.cancel(requestId));
}

app.whenReady().then(() => {
  registerIpc();
  buildMenu();
  loadDb();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Flush and close the database cleanly so recent attempts are never lost.
app.on('will-quit', () => {
  if (db && db.close) db.close();
});
