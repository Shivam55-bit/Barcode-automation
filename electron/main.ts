import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { fork, ChildProcess } from 'child_process';
import { registerPrinterIpc } from './printer/printerIPC';

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;

const PORT = process.env.PORT || 3001;
const isDev = process.env.NODE_ENV === 'development';

function startBackendServer() {
  const serverCjs = path.join(__dirname, '../dist/server.cjs');
  const serverJs = path.join(__dirname, '../dist/server.js');
  const serverPath = isDev
    ? path.join(__dirname, '../server.ts')
    : (fs.existsSync(serverCjs) ? serverCjs : serverJs);

  if (!fs.existsSync(serverPath)) {
    console.log(`[Electron Main] Server file not found at ${serverPath}, assuming external server is running.`);
    return;
  }

  try {
    serverProcess = fork(serverPath, [], {
      env: { ...process.env, PORT: String(PORT), NODE_ENV: isDev ? 'development' : 'production' },
      silent: true,
    });

    serverProcess.on('error', (err) => {
      console.log('[Electron Main] Backend process error (server may already be running):', err.message);
    });

    console.log(`[Electron Main] Backend process configured on port ${PORT}`);
  } catch (err) {
    console.error('[Electron Main] Failed to spawn backend server process:', err);
  }
}

import * as XLSX from 'xlsx';

const activeFileWatchers = new Map<string, fs.FSWatcher>();
let fileChangeDebounceTimer: NodeJS.Timeout | null = null;

function registerExcelIpc() {
  // 1. Native File Dialog for Excel
  ipcMain.handle('excel:select-file', async () => {
    if (!mainWindow) return { canceled: true };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Excel / Spreadsheet Data Source',
      properties: ['openFile'],
      filters: [
        { name: 'Excel Spreadsheets (*.xlsx, *.xls, *.xlsm, *.csv)', extensions: ['xlsx', 'xls', 'xlsm', 'csv'] },
        { name: 'All Files (*.*)', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const resolvedPath = path.normalize(path.resolve(result.filePaths[0]));
    try {
      const stats = fs.statSync(resolvedPath);
      return {
        canceled: false,
        filePath: resolvedPath,
        fileName: path.basename(resolvedPath),
        sizeBytes: stats.size,
        lastModified: stats.mtime.toISOString()
      };
    } catch {
      return {
        canceled: false,
        filePath: resolvedPath,
        fileName: path.basename(resolvedPath),
        sizeBytes: 0,
        lastModified: new Date().toISOString()
      };
    }
  });

  // 2. Locate Missing Excel File
  ipcMain.handle('excel:locate-file', async (_event, oldPath?: string) => {
    if (!mainWindow) return { canceled: true };
    const defaultDir = oldPath ? path.dirname(oldPath) : undefined;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Locate Missing Excel File',
      defaultPath: defaultDir && fs.existsSync(defaultDir) ? defaultDir : undefined,
      properties: ['openFile'],
      filters: [
        { name: 'Excel Spreadsheets (*.xlsx, *.xls, *.xlsm, *.csv)', extensions: ['xlsx', 'xls', 'xlsm', 'csv'] },
        { name: 'All Files (*.*)', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const resolvedPath = path.normalize(path.resolve(result.filePaths[0]));
    const stats = fs.statSync(resolvedPath);
    return {
      canceled: false,
      filePath: resolvedPath,
      fileName: path.basename(resolvedPath),
      sizeBytes: stats.size,
      lastModified: stats.mtime.toISOString()
    };
  });

  // 3. Test Excel Connection
  ipcMain.handle('excel:test-connection', async (_event, { filePath, sheetName }: { filePath: string; sheetName?: string }) => {
    try {
      if (!filePath || !filePath.trim()) {
        return { success: false, errorCode: 'INVALID_PATH', error: 'No file path specified.' };
      }

      const normalizedPath = path.normalize(path.resolve(filePath.trim()));

      if (!fs.existsSync(normalizedPath)) {
        return {
          success: false,
          errorCode: 'FILE_NOT_FOUND',
          error: `File not found on disk: "${normalizedPath}".`,
          pathChecked: normalizedPath
        };
      }

      // Check valid file format extension
      const ext = path.extname(normalizedPath).toLowerCase();
      if (!['.xlsx', '.xls', '.xlsm', '.csv'].includes(ext)) {
        return {
          success: false,
          errorCode: 'UNSUPPORTED_FORMAT',
          error: `Unsupported file extension "${ext}". BarcodeFlow supports .xlsx, .xls, .xlsm, and .csv.`,
          pathChecked: normalizedPath
        };
      }

      // Check lock / accessibility
      try {
        const fd = fs.openSync(normalizedPath, 'r');
        fs.closeSync(fd);
      } catch (err: any) {
        if (err.code === 'EBUSY' || err.code === 'EACCES') {
          return {
            success: false,
            errorCode: 'FILE_LOCKED',
            error: 'File is currently locked or in use by Microsoft Excel. Please save and close Excel or allow shared reading.',
            pathChecked: normalizedPath
          };
        }
        return {
          success: false,
          errorCode: 'PERMISSION_DENIED',
          error: `File access error: ${err.message}`,
          pathChecked: normalizedPath
        };
      }

      const stat = await fs.promises.stat(normalizedPath);
      const buffer = await fs.promises.readFile(normalizedPath);
      const wb = await new Promise<XLSX.WorkBook>((resolve, reject) => {
        setImmediate(() => {
          try {
            resolve(XLSX.read(buffer, { type: 'buffer', cellDates: true, cellNF: true, cellText: true }));
          } catch (e) {
            reject(e);
          }
        });
      });

      const sheetNames = wb.SheetNames || [];
      if (sheetNames.length === 0) {
        return {
          success: false,
          errorCode: 'INVALID_WORKBOOK',
          error: 'Excel workbook contains no readable worksheets.',
          pathChecked: normalizedPath
        };
      }

      const activeSheetName = (sheetName && sheetNames.includes(sheetName)) ? sheetName : sheetNames[0];
      const sheet = wb.Sheets[activeSheetName];
      if (!sheet) {
        return {
          success: false,
          errorCode: 'SHEET_MISSING',
          error: `Selected sheet "${sheetName}" does not exist in workbook.`,
          pathChecked: normalizedPath,
          sheets: sheetNames
        };
      }

      const rawMatrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
      const recordCount = Math.max(0, rawMatrix.length - 1);

      return {
        success: true,
        filePath: normalizedPath,
        fileName: path.basename(normalizedPath),
        sheets: sheetNames,
        sheetCount: sheetNames.length,
        selectedSheet: activeSheetName,
        totalRecords: recordCount,
        lastModified: stat.mtime.toISOString(),
        sizeBytes: stat.size,
        pathChecked: normalizedPath
      };
    } catch (err: any) {
      return {
        success: false,
        errorCode: 'PARSE_ERROR',
        error: err.message || 'Failed to inspect workbook.',
        pathChecked: filePath
      };
    }
  });

  // 4. Read Excel Workbook
  ipcMain.handle('excel:read-workbook', async (_event, { filePath, sheetName, headerRow = 1 }: { filePath: string; sheetName?: string; headerRow?: number }) => {
    try {
      if (!filePath || !filePath.trim()) {
        throw new Error('No file path specified.');
      }
      const normalizedPath = path.normalize(path.resolve(filePath.trim()));

      if (!fs.existsSync(normalizedPath)) {
        throw new Error(`Excel file not found at: "${normalizedPath}"`);
      }

      const stat = await fs.promises.stat(normalizedPath);
      const buffer = await fs.promises.readFile(normalizedPath);
      const wb = await new Promise<XLSX.WorkBook>((resolve, reject) => {
        setImmediate(() => {
          try {
            resolve(XLSX.read(buffer, { type: 'buffer', cellDates: true, cellNF: true, cellText: true }));
          } catch (e) {
            reject(e);
          }
        });
      });

      const sheetNames = wb.SheetNames || [];
      if (sheetNames.length === 0) {
        throw new Error('Excel workbook contains no readable sheets.');
      }

      const selectedSheet = (sheetName && sheetNames.includes(sheetName)) ? sheetName : sheetNames[0];
      const sheet = wb.Sheets[selectedSheet];
      if (!sheet) {
        throw new Error(`Sheet "${selectedSheet}" not found.`);
      }

      const rawMatrix: any[][] = await new Promise<any[][]>((resolve, reject) => {
        setImmediate(() => {
          try {
            resolve(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }));
          } catch (e) {
            reject(e);
          }
        });
      });
      if (!rawMatrix || rawMatrix.length === 0) {
        return {
          sheetNames,
          selectedSheet,
          columns: [],
          records: [],
          previewRows: [],
          totalRecords: 0,
          lastModified: stat.mtime.toISOString(),
          sizeBytes: stat.size,
        };
      }

      const headerIdx = Math.max(0, headerRow - 1);
      const headerLine = (rawMatrix[headerIdx] || []).map((h, i) => {
        const str = String(h ?? '').trim();
        return str.length > 0 ? str : `Column_${i + 1}`;
      });

      const dataLines = rawMatrix.slice(headerIdx + 1).filter((row) =>
        row.some((cell) => cell !== undefined && cell !== null && String(cell).trim() !== '')
      );

      const records = dataLines.map((row) => {
        const item: Record<string, any> = {};
        headerLine.forEach((colName, colIdx) => {
          const cellVal = row[colIdx];
          item[colName] = cellVal !== undefined && cellVal !== null ? String(cellVal).trim() : '';
        });
        return item;
      });

      return {
        success: true,
        sheetNames,
        selectedSheet,
        columns: headerLine,
        records,
        previewRows: records.slice(0, 20),
        totalRecords: records.length,
        lastModified: stat.mtime.toISOString(),
        sizeBytes: stat.size,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 5. Open File In Folder
  ipcMain.handle('excel:open-location', async (_event, filePath: string) => {
    try {
      if (!filePath || !filePath.trim()) return false;
      const normalizedPath = path.normalize(path.resolve(filePath.trim()));
      if (fs.existsSync(normalizedPath)) {
        shell.showItemInFolder(normalizedPath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  });

  // 6. Open File In Default App (Excel)
  ipcMain.handle('excel:open-file', async (_event, filePath: string) => {
    try {
      if (!filePath || !filePath.trim()) return false;
      const normalizedPath = path.normalize(path.resolve(filePath.trim()));
      if (fs.existsSync(normalizedPath)) {
        await shell.openPath(normalizedPath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  });

  // 7. Watch / Unwatch helpers with real fs.watch / fs.watchFile
  ipcMain.handle('excel:watch-file', async (_event, { filePath, datasetId }: { filePath: string; datasetId: string }) => {
    try {
      if (activeFileWatchers.has(datasetId)) {
        activeFileWatchers.get(datasetId)?.close();
        activeFileWatchers.delete(datasetId);
      }

      if (!filePath || !filePath.trim()) {
        return false;
      }
      const normalizedPath = path.normalize(path.resolve(filePath.trim()));
      if (!fs.existsSync(normalizedPath)) {
        return false;
      }

      // Use fs.watch for native OS file change notifications
      const watcher = fs.watch(normalizedPath, (eventType) => {
        if (eventType === 'change' || eventType === 'rename') {
          if (fileChangeDebounceTimer) clearTimeout(fileChangeDebounceTimer);
          fileChangeDebounceTimer = setTimeout(() => {
            console.log(`[Electron Watcher] File change detected: ${normalizedPath} (${datasetId})`);
            mainWindow?.webContents.send('excel:file-changed', { filePath: normalizedPath, datasetId });
          }, 800);
        }
      });

      activeFileWatchers.set(datasetId, watcher);
      return true;
    } catch (err) {
      console.warn(`[Electron Watcher] Failed to watch ${filePath}:`, err);
      return false;
    }
  });

  ipcMain.handle('excel:unwatch-file', async (_event, datasetId: string) => {
    if (activeFileWatchers.has(datasetId)) {
      activeFileWatchers.get(datasetId)?.close();
      activeFileWatchers.delete(datasetId);
      console.log(`[Electron Watcher] Unwatched dataset ${datasetId}`);
      return true;
    }
    return false;
  });
}

function registerDocumentIpc() {
  // 1. Show Native Windows Save As Dialog
  ipcMain.handle('document:show-save-dialog', async (_event, defaultFileName?: string, defaultDir?: string) => {
    if (!mainWindow) return { canceled: true };
    const defaultName = (defaultFileName || 'Document1').replace(/[\/\\:*?"<>|]/g, '_');
    const safeName = defaultName.endsWith('.bfl') || defaultName.endsWith('.btw') ? defaultName : `${defaultName}.bfl`;
    const defaultPath = defaultDir && fs.existsSync(defaultDir)
      ? path.join(defaultDir, safeName)
      : path.join(app.getPath('documents'), safeName);

    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save As - BarcodeFlow Document',
      defaultPath,
      filters: [
        { name: 'BarcodeFlow Document (*.bfl)', extensions: ['bfl'] },
        { name: 'BarTender Document (*.btw)', extensions: ['btw'] },
        { name: 'JSON Document (*.json)', extensions: ['json'] },
        { name: 'All Files (*.*)', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    const resolvedPath = path.normalize(path.resolve(result.filePath));
    return {
      canceled: false,
      filePath: resolvedPath,
      fileName: path.basename(resolvedPath),
    };
  });

  // 2. Safe Atomic File Save
  ipcMain.handle('document:save-file', async (_event, { filePath, documentData }: { filePath: string; documentData: any }) => {
    if (!filePath) {
      return { success: false, error: 'File path cannot be empty' };
    }
    const resolvedPath = path.normalize(path.resolve(filePath));
    const targetDir = path.dirname(resolvedPath);
    if (!fs.existsSync(targetDir)) {
      try {
        fs.mkdirSync(targetDir, { recursive: true });
      } catch (err: any) {
        return { success: false, error: `Failed to create directory: ${err.message}` };
      }
    }

    const tempPath = `${resolvedPath}.tmp-${Date.now()}`;
    const payload = typeof documentData === 'string' ? documentData : JSON.stringify(documentData, null, 2);

    try {
      await fs.promises.writeFile(tempPath, payload, 'utf-8');
      await fs.promises.rename(tempPath, resolvedPath);
      const stats = await fs.promises.stat(resolvedPath);
      return {
        success: true,
        filePath: resolvedPath,
        fileName: path.basename(resolvedPath),
        sizeBytes: stats.size,
        lastModified: stats.mtime.toISOString(),
      };
    } catch (err: any) {
      try {
        if (fs.existsSync(tempPath)) await fs.promises.unlink(tempPath);
      } catch { }
      return { success: false, error: err.message || 'Disk write failed' };
    }
  });

  // 3. Show Native Windows Open Dialog
  ipcMain.handle('document:show-open-dialog', async (_event, defaultDir?: string) => {
    if (!mainWindow) return { canceled: true };
    const defaultPath = defaultDir && fs.existsSync(defaultDir) ? defaultDir : app.getPath('documents');
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Open Document - BarcodeFlow',
      defaultPath,
      properties: ['openFile'],
      filters: [
        { name: 'BarcodeFlow & BarTender Documents (*.bfl, *.btw, *.json)', extensions: ['bfl', 'btw', 'json'] },
        { name: 'BarcodeFlow Document (*.bfl)', extensions: ['bfl'] },
        { name: 'BarTender Document (*.btw)', extensions: ['btw'] },
        { name: 'JSON Document (*.json)', extensions: ['json'] },
        { name: 'All Files (*.*)', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const resolvedPath = path.normalize(path.resolve(result.filePaths[0]));
    return {
      canceled: false,
      filePath: resolvedPath,
      fileName: path.basename(resolvedPath),
    };
  });

  // 4. Read Document File
  ipcMain.handle('document:read-file', async (_event, filePath: string) => {
    if (!filePath) {
      return { success: false, error: 'File path cannot be empty' };
    }
    const resolvedPath = path.normalize(path.resolve(filePath));
    if (!fs.existsSync(resolvedPath)) {
      return { success: false, error: `File not found: ${resolvedPath}` };
    }

    try {
      const content = await fs.promises.readFile(resolvedPath, 'utf-8');
      const parsed = JSON.parse(content);
      const stats = await fs.promises.stat(resolvedPath);
      return {
        success: true,
        document: parsed,
        filePath: resolvedPath,
        fileName: path.basename(resolvedPath),
        sizeBytes: stats.size,
        lastModified: stats.mtime.toISOString(),
      };
    } catch (err: any) {
      return { success: false, error: `Failed to read document: ${err.message}` };
    }
  });

  // 5. Check if File Exists
  ipcMain.handle('document:check-file-exists', async (_event, filePath: string) => {
    if (!filePath) return false;
    try {
      return fs.existsSync(path.normalize(path.resolve(filePath)));
    } catch {
      return false;
    }
  });

  // 6. Open Document Folder in Windows Explorer
  ipcMain.handle('document:open-location', async (_event, filePath: string) => {
    if (!filePath) return false;
    try {
      const resolvedPath = path.normalize(path.resolve(filePath));
      if (fs.existsSync(resolvedPath)) {
        shell.showItemInFolder(resolvedPath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  });

  // 6. Native App Exit
  ipcMain.handle('app:exit', async () => {
    app.quit();
    return true;
  });
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
      webSecurity: true,
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
  registerDocumentIpc();
  registerExcelIpc();
  registerPrinterIpc(() => mainWindow);
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

