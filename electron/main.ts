import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { fork, ChildProcess } from 'child_process';

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;

const PORT = process.env.PORT || 5050;
const isDev = process.env.NODE_ENV === 'development';

function startBackendServer() {
  const serverPath = isDev
    ? path.join(__dirname, '../server.ts')
    : path.join(__dirname, '../dist/server.js');

  try {
    serverProcess = fork(serverPath, [], {
      env: { ...process.env, PORT: String(PORT), NODE_ENV: isDev ? 'development' : 'production' },
    });

    console.log(`[Electron Main] Launched local Express backend process on port ${PORT}`);
  } catch (err) {
    console.error('[Electron Main] Failed to spawn backend server process:', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'BarcodeFlow Enterprise Suite',
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
    autoHideMenuBar: true,
    show: false,
  });

  const loadUrl = isDev ? `http://127.0.0.1:${PORT}` : `http://127.0.0.1:${PORT}`;

  // Wait briefly for local express server startup
  setTimeout(() => {
    mainWindow?.loadURL(loadUrl).catch(() => {
      mainWindow?.loadURL(`http://localhost:${PORT}`);
    });
  }, 1000);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.maximize();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  startBackendServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
