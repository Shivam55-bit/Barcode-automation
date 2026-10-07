import { app, BrowserWindow, ipcMain, shell, dialog, screen } from 'electron';
import path from 'path';
import fs from 'fs';
import type { Server } from 'http';
import { registerPrinterIpc } from './printer/printerIPC';
import { registerDatabaseIpc } from './database/databaseIPC';
import { parseBarTenderDocument } from '../src/services/barTenderParser';
import { openBarTenderWithConsent } from './bartenderImport';
import { getDesktopDataDirectory } from '../barcode-automation-backend/src/runtimePaths';

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let backendServer: Server | null = null;
let backendUrl = '';
let accountSetupBackend: Pick<typeof import('../server'), 'getLegacyPasswordAccounts' | 'initializeLegacyPassword'> | null = null;
let rendererReady = false;
let resolveRendererReady: (() => void) | null = null;
let rejectRendererReady: ((error: Error) => void) | null = null;
let rendererReadyTimeout: NodeJS.Timeout | null = null;
let isQuitting = false;
let hasDirtyDocuments = false;
let closeRequestPending = false;
let recoverySnapshotPath = '';
let shutdownMarkerPath = '';
let allowRecoveryPrompt = false;
const pendingDocumentPaths: string[] = [];
const startupStartedAt = Date.now();
let windowSettingsTimer: NodeJS.Timeout | null = null;

const isDev = process.env.NODE_ENV === 'development';

if (process.env.BARCODEFLOW_USER_DATA_DIR) {
  fs.mkdirSync(process.env.BARCODEFLOW_USER_DATA_DIR, { recursive: true });
  app.setPath('userData', path.resolve(process.env.BARCODEFLOW_USER_DATA_DIR));
}

app.setAppUserModelId('com.barcodeflow.enterprise');

function writeStartupLog(message: string, error?: unknown): void {
  const detail = error instanceof Error ? error.stack || error.message : error ? String(error) : '';
  const line = `[${new Date().toISOString()}] ${message}${detail ? `\n${detail}` : ''}\n`;
  try {
    const logPath = path.join(app.getPath('logs'), 'barcodeflow-startup.log');
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, line, 'utf8');
  } catch (logError) {
    console.error('[Desktop] Could not write startup log:', logError);
  }
  console.log(line.trimEnd());
}

function queueDocumentPath(candidate: string, cwd = process.cwd()): void {
  if (!candidate || candidate.startsWith('-')) return;
  const ext = path.extname(candidate).toLowerCase();
  if (!['.bfl', '.json', '.btw'].includes(ext)) return;
  const documentPath = path.resolve(cwd, candidate);
  if (rendererReady && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('document:open-request', documentPath);
    return;
  }
  if (!pendingDocumentPaths.includes(documentPath)) pendingDocumentPaths.push(documentPath);
}

function focusMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createSplashWindow(): Promise<void> {
  const version = app.getVersion();
  const markup = `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;width:100vw;height:100vh;display:grid;place-items:center;background:#f2f6f8;color:#19333a;font-family:Segoe UI,Arial,sans-serif}
    main{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(135deg,#f8fbfc,#e2eef0);border:1px solid #b4c9cb}
    .mark{height:46px;display:flex;align-items:stretch;gap:4px;margin-bottom:18px}.mark i{display:block;width:5px;background:#087e83}.mark i:nth-child(2n){width:3px}.mark i:nth-child(3n){background:#d18b2c}
    h1{font-size:23px;line-height:1.2;margin:0;font-weight:650}.version{font-size:11px;color:#526c70;margin-top:5px}.status{font-size:12px;color:#365a5d;margin-top:23px}
    .spinner{width:16px;height:16px;border:2px solid #c8dadd;border-top-color:#087e83;border-radius:50%;animation:spin .8s linear infinite;margin-top:11px}@keyframes spin{to{transform:rotate(360deg)}}
  </style></head><body><main><div class="mark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><h1>BarcodeFlow</h1><div class="version">Enterprise Suite ${version}</div><div id="status" class="status">Starting desktop services...</div><div class="spinner" aria-label="Loading"></div></main></body></html>`;
  splashWindow = new BrowserWindow({
    width: 460,
    height: 280,
    frame: false,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    center: true,
    show: false,
    backgroundColor: '#f2f6f8',
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  splashWindow.once('ready-to-show', () => splashWindow?.show());
  return splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(markup)}`).then(() => undefined);
}

function setSplashStatus(status: string): void {
  if (!splashWindow || splashWindow.isDestroyed()) return;
  const safeStatus = JSON.stringify(status);
  void splashWindow.webContents.executeJavaScript(`document.getElementById('status').textContent=${safeStatus}`).catch(() => undefined);
}

function closeSplashWindow(): void {
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
  splashWindow = null;
}

function writeJsonAtomically(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    try { fs.rmSync(tempPath, { force: true }); } catch { }
    throw error;
  }
}

function readPersistedSettings(): Record<string, any> {
  try {
    return JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'app-settings.json'), 'utf8'));
  } catch {
    return {};
  }
}

function persistWindowState(immediate = false): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (windowSettingsTimer) clearTimeout(windowSettingsTimer);
  const persist = () => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMinimized()) return;
    const settings = readPersistedSettings();
    try {
      writeJsonAtomically(path.join(app.getPath('userData'), 'app-settings.json'), {
        ...settings,
        windowBounds: mainWindow.isMaximized() ? settings.windowBounds || mainWindow.getBounds() : mainWindow.getBounds(),
        windowMaximized: mainWindow.isMaximized(),
      });
    } catch (error) {
      writeStartupLog('Could not persist window bounds.', error);
    }
  };
  if (immediate) persist();
  else windowSettingsTimer = setTimeout(persist, 250);
}

async function startBackendServer() {
  if (!backendServer?.listening || !backendUrl) {
    const serverCjs = path.join(__dirname, '../dist/server.cjs');
    if (!fs.existsSync(serverCjs)) throw new Error('Bundled backend is missing. Rebuild or reinstall the application.');
    process.env.PORT = '0';
    process.env.NODE_ENV = 'production';
    process.env.BARCODEFLOW_DESKTOP = '1';
    process.env.BARCODEFLOW_DATA_DIR = getDesktopDataDirectory(app.getPath('userData'), path.join(__dirname, '..'), app.isPackaged);
    process.env.BARCODEFLOW_DIST_DIR = path.join(__dirname, '../dist');
    const resolvedBackend = require.resolve(serverCjs);
    delete require.cache[resolvedBackend];
    const backend = require(resolvedBackend);
    backendServer = await backend.serverReady;
    accountSetupBackend = backend;
    const address = backendServer?.address();
    if (!address || typeof address === 'string') throw new Error('Private backend did not become ready.');
    backendUrl = `http://127.0.0.1:${address.port}`;
  }
  const response = await fetch(`${backendUrl}/api/health`, { signal: AbortSignal.timeout(5000) });
  const health = await response.json() as { status?: string };
  if (!response.ok || health.status !== 'online') throw new Error('The embedded BarcodeFlow service failed its health check.');
}

import * as XLSX from 'xlsx';

const activeFileWatchers = new Map<string, fs.FSWatcher>();
let fileChangeDebounceTimer: NodeJS.Timeout | null = null;

// --- Production-Grade Excel & Spreadsheet Provider Core ---

interface CellExtractionResult {
  rawValue: any;
  displayValue: string;
  formula?: string;
  dataType: 'text' | 'number' | 'date' | 'boolean' | 'formula' | 'empty' | 'error';
  numberFormat?: string;
  dateValue?: string;
}

function resolveFilePath(targetPath: string, projectDir?: string): { resolvedPath: string; exists: boolean } {
  if (!targetPath || !targetPath.trim()) return { resolvedPath: '', exists: false };
  const trimmed = targetPath.trim();
  const directPath = path.normalize(path.resolve(trimmed));
  if (fs.existsSync(directPath)) {
    return { resolvedPath: directPath, exists: true };
  }
  if (projectDir && fs.existsSync(projectDir)) {
    const relPath = path.normalize(path.resolve(projectDir, trimmed));
    if (fs.existsSync(relPath)) {
      return { resolvedPath: relPath, exists: true };
    }
  }
  return { resolvedPath: directPath, exists: false };
}

async function safelyReadFileWithRetry(filePath: string, maxRetries = 3): Promise<Buffer> {
  const backoffs = [0, 300, 800];
  let lastErr: any = null;
  for (let i = 0; i < maxRetries; i++) {
    if (backoffs[i] > 0) {
      await new Promise((resolve) => setTimeout(resolve, backoffs[i]));
    }
    try {
      const fd = fs.openSync(filePath, 'r');
      fs.closeSync(fd);
      return await fs.promises.readFile(filePath);
    } catch (err: any) {
      lastErr = err;
      if (err.code === 'EBUSY' || err.code === 'EACCES' || err.code === 'EPERM') {
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

function formatExcelDateSerial(serial: number, formatMask: string = 'YYYY-MM-DD'): string {
  try {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + serial * 86400000);
    if (isNaN(date.getTime())) return String(serial);

    const yyyy = date.getUTCFullYear().toString();
    const yy = yyyy.slice(-2);
    const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const dd = date.getUTCDate().toString().padStart(2, '0');
    const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mmm = monthNamesShort[date.getUTCMonth()];

    return formatMask
      .replace(/YYYY/g, yyyy)
      .replace(/YY/g, yy)
      .replace(/MMM/g, mmm)
      .replace(/MM/g, mm)
      .replace(/DD/g, dd);
  } catch {
    return String(serial);
  }
}

function extractNormalizedCell(cell: XLSX.CellObject | undefined): CellExtractionResult {
  if (!cell || cell.v === undefined || cell.v === null) {
    if (cell && cell.f) {
      return {
        rawValue: null,
        displayValue: '#VALUE_NOT_CALCULATED#',
        formula: cell.f,
        dataType: 'formula',
      };
    }
    return {
      rawValue: null,
      displayValue: '',
      dataType: 'empty',
    };
  }

  const formula = cell.f ? String(cell.f) : undefined;
  const numFmt = cell.z ? String(cell.z) : undefined;

  // Formula cell with cached value
  if (formula) {
    const disp = cell.w !== undefined ? String(cell.w) : String(cell.v);
    return {
      rawValue: cell.v,
      displayValue: disp,
      formula,
      dataType: 'formula',
      numberFormat: numFmt,
    };
  }

  // Error cell
  if (cell.t === 'e') {
    return {
      rawValue: cell.v,
      displayValue: cell.w ? String(cell.w) : '#ERROR!',
      dataType: 'error',
    };
  }

  // Boolean cell
  if (cell.t === 'b' || typeof cell.v === 'boolean') {
    return {
      rawValue: cell.v,
      displayValue: cell.v ? 'TRUE' : 'FALSE',
      dataType: 'boolean',
    };
  }

  // Date cell
  if (cell.t === 'd' || cell.v instanceof Date) {
    const d = cell.v instanceof Date ? cell.v : new Date(cell.v);
    const iso = !isNaN(d.getTime()) ? d.toISOString() : undefined;
    const disp = cell.w ? String(cell.w) : iso ? iso.slice(0, 10) : String(cell.v);
    return {
      rawValue: cell.v,
      displayValue: disp,
      dateValue: iso,
      dataType: 'date',
      numberFormat: numFmt,
    };
  }

  // String cell (CRITICAL: Preserves leading zeros like '001234567890' exactly!)
  if (cell.t === 's' || typeof cell.v === 'string') {
    const str = String(cell.v);
    return {
      rawValue: str,
      displayValue: cell.w !== undefined ? String(cell.w) : str,
      dataType: 'text',
      numberFormat: numFmt,
    };
  }

  // Number cell
  if (cell.t === 'n' || typeof cell.v === 'number') {
    const num = Number(cell.v);
    // Check if number format indicates an Excel date serial
    const isDateFormat = numFmt && /([ymdhs]|AM\/PM)/i.test(numFmt) && !/[#0]/.test(numFmt);
    if (isDateFormat && num > 30000 && num < 70000) {
      const dateStr = formatExcelDateSerial(num);
      return {
        rawValue: num,
        displayValue: cell.w ? String(cell.w) : dateStr,
        dateValue: dateStr,
        dataType: 'date',
        numberFormat: numFmt,
      };
    }

    // Number with leading zeros format (e.g. 0000000000) -> cell.w has formatted string
    const disp = cell.w !== undefined ? String(cell.w) : String(num);
    return {
      rawValue: num,
      displayValue: disp,
      dataType: 'number',
      numberFormat: numFmt,
    };
  }

  return {
    rawValue: cell.v,
    displayValue: String(cell.w ?? cell.v ?? ''),
    dataType: 'text',
  };
}

interface ParsedWorkbookSheetData {
  columns: { name: string; originalName: string; index: number }[];
  fieldInfos: {
    name: string;
    displayName: string;
    dataType: 'text' | 'number' | 'date' | 'boolean' | 'formula' | 'barcode';
    originalName: string;
    sampleValue: string;
  }[];
  allRows: Record<string, string>[];
  normalizedCells: Record<string, CellExtractionResult>[];
}

function parseWorksheetData(
  sheet: XLSX.WorkSheet,
  headerRow: number = 1,
  hasHeaders: boolean = true
): ParsedWorkbookSheetData {
  if (!sheet || !sheet['!ref']) {
    return { columns: [], fieldInfos: [], allRows: [], normalizedCells: [] };
  }

  const range = XLSX.utils.decode_range(sheet['!ref']);
  const maxCol = range.e.c;
  const maxRow = range.e.r;

  const headerRowIdx = hasHeaders ? Math.max(0, headerRow - 1) : -1;
  const headerCounts: Record<string, number> = {};
  const columns: { name: string; originalName: string; index: number }[] = [];

  for (let c = range.s.c; c <= maxCol; c++) {
    let orig = `Column_${c + 1}`;
    if (hasHeaders && headerRowIdx >= 0) {
      const cell = sheet[XLSX.utils.encode_cell({ r: headerRowIdx, c })];
      if (cell && cell.v !== undefined && cell.v !== null && String(cell.v).trim() !== '') {
        orig = String(cell.w || cell.v).trim();
      }
    }
    headerCounts[orig] = (headerCounts[orig] || 0) + 1;
    const uniqueName = headerCounts[orig] === 1 ? orig : `${orig}_${headerCounts[orig]}`;
    columns.push({ name: uniqueName, originalName: orig, index: c });
  }

  const startDataRow = hasHeaders ? headerRowIdx + 1 : range.s.r;
  const allRows: Record<string, string>[] = [];
  const normalizedCells: Record<string, CellExtractionResult>[] = [];

  for (let r = startDataRow; r <= maxRow; r++) {
    let hasAnyData = false;
    const rowObj: Record<string, string> = {};
    const normObj: Record<string, CellExtractionResult> = {};

    for (const col of columns) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c: col.index })];
      const extracted = extractNormalizedCell(cell);
      rowObj[col.name] = extracted.displayValue;
      normObj[col.name] = extracted;
      if (extracted.dataType !== 'empty' && extracted.displayValue !== '') {
        hasAnyData = true;
      }
    }

    if (hasAnyData) {
      allRows.push(rowObj);
      normalizedCells.push(normObj);
    }
  }

  // Infer field types
  const fieldInfos = columns.map((col) => {
    let textCount = 0;
    let numCount = 0;
    let dateCount = 0;
    let boolCount = 0;
    let formulaCount = 0;
    let sampleVal = '';

    const sampleLimit = Math.min(normalizedCells.length, 50);
    for (let i = 0; i < sampleLimit; i++) {
      const cell = normalizedCells[i][col.name];
      if (!cell || cell.dataType === 'empty') continue;
      if (!sampleVal) sampleVal = cell.displayValue;

      if (cell.dataType === 'formula') formulaCount++;
      else if (cell.dataType === 'date') dateCount++;
      else if (cell.dataType === 'boolean') boolCount++;
      else if (cell.dataType === 'number') numCount++;
      else textCount++;
    }

    let detectedType: 'text' | 'number' | 'date' | 'boolean' | 'formula' | 'barcode' = 'text';
    if (formulaCount > dateCount && formulaCount > numCount) detectedType = 'formula';
    else if (dateCount > numCount && dateCount > textCount) detectedType = 'date';
    else if (numCount > textCount && numCount > dateCount) detectedType = 'number';
    else if (boolCount > textCount && boolCount > numCount) detectedType = 'boolean';

    // Barcode detection heuristic: all numeric text with 8, 12, 13, 14 digits or typical SKU
    if (detectedType === 'text' && sampleVal && /^\d{8,14}$/.test(sampleVal)) {
      detectedType = 'barcode';
    }

    return {
      name: col.name,
      displayName: col.originalName,
      dataType: detectedType,
      originalName: col.originalName,
      sampleValue: sampleVal,
    };
  });

  return { columns, fieldInfos, allRows, normalizedCells };
}

function applyFiltersAndSorts(
  rows: Record<string, string>[],
  normalized: Record<string, CellExtractionResult>[],
  sort?: { field: string; direction: 'asc' | 'desc' }[],
  filters?: { field: string; operator: string; value?: any; logic?: 'AND' | 'OR' }[],
  search?: { query: string; fields?: string[]; mode?: 'contains' | 'startsWith' | 'exact' }
): { rows: Record<string, string>[]; normalized: Record<string, CellExtractionResult>[] } {
  let paired = rows.map((r, i) => ({ row: r, norm: normalized[i] }));

  // 1. Search
  if (search && search.query && search.query.trim()) {
    const q = search.query.trim().toLowerCase();
    const mode = search.mode || 'contains';
    const fieldsToSearch = search.fields && search.fields.length > 0 ? search.fields : null;

    paired = paired.filter(({ row }) => {
      const targetFields = fieldsToSearch || Object.keys(row);
      return targetFields.some((f) => {
        const val = String(row[f] ?? '').toLowerCase();
        if (mode === 'exact') return val === q;
        if (mode === 'startsWith') return val.startsWith(q);
        return val.includes(q);
      });
    });
  }

  // 2. Filters
  if (filters && filters.length > 0) {
    paired = paired.filter(({ row }) => {
      let isMatch = true;
      for (let i = 0; i < filters.length; i++) {
        const cond = filters[i];
        const rawVal = String(row[cond.field] ?? '').toLowerCase();
        const targetVal = String(cond.value ?? '').toLowerCase();
        let pass = false;

        switch (cond.operator) {
          case 'equals':
            pass = rawVal === targetVal;
            break;
          case 'notEquals':
            pass = rawVal !== targetVal;
            break;
          case 'contains':
            pass = rawVal.includes(targetVal);
            break;
          case 'notContains':
            pass = !rawVal.includes(targetVal);
            break;
          case 'startsWith':
            pass = rawVal.startsWith(targetVal);
            break;
          case 'endsWith':
            pass = rawVal.endsWith(targetVal);
            break;
          case 'greaterThan':
            pass = parseFloat(rawVal) > parseFloat(targetVal);
            break;
          case 'greaterThanOrEqual':
            pass = parseFloat(rawVal) >= parseFloat(targetVal);
            break;
          case 'lessThan':
            pass = parseFloat(rawVal) < parseFloat(targetVal);
            break;
          case 'lessThanOrEqual':
            pass = parseFloat(rawVal) <= parseFloat(targetVal);
            break;
          case 'isEmpty':
            pass = rawVal.trim() === '';
            break;
          case 'isNotEmpty':
            pass = rawVal.trim() !== '';
            break;
          default:
            pass = rawVal.includes(targetVal);
        }

        if (i === 0) {
          isMatch = pass;
        } else {
          const logic = cond.logic || 'AND';
          isMatch = logic === 'AND' ? isMatch && pass : isMatch || pass;
        }
      }
      return isMatch;
    });
  }

  // 3. Multi-column Sort
  if (sort && sort.length > 0) {
    paired.sort((a, b) => {
      for (const s of sort) {
        const valA = String(a.row[s.field] ?? '');
        const valB = String(b.row[s.field] ?? '');
        const numA = parseFloat(valA);
        const numB = parseFloat(valB);

        let cmp = 0;
        if (!isNaN(numA) && !isNaN(numB)) {
          cmp = numA - numB;
        } else {
          cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
        }

        if (cmp !== 0) {
          return s.direction === 'desc' ? -cmp : cmp;
        }
      }
      return 0;
    });
  }

  return {
    rows: paired.map((p) => p.row),
    normalized: paired.map((p) => p.norm),
  };
}

async function selectExcelFileInternal() {
  if (!mainWindow) return { canceled: true };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Microsoft Excel Spreadsheet',
    properties: ['openFile'],
    filters: [
      { name: 'Excel Spreadsheets (*.xlsx, *.xls, *.xlsm)', extensions: ['xlsx', 'xls', 'xlsm'] },
      { name: 'All Files (*.*)', extensions: ['*'] },
    ],
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
      lastModified: stats.mtime.toISOString(),
    };
  } catch {
    return {
      canceled: false,
      filePath: resolvedPath,
      fileName: path.basename(resolvedPath),
      sizeBytes: 0,
      lastModified: new Date().toISOString(),
    };
  }
}

async function inspectWorkbookInternal(filePath: string, projectDir?: string) {
  try {
    const { resolvedPath, exists } = resolveFilePath(filePath, projectDir);
    if (!exists) {
      return {
        success: false,
        errorCode: 'EXCEL_FILE_NOT_FOUND',
        error: `File not found on disk: "${filePath}".`,
        pathChecked: resolvedPath,
      };
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    if (!['.xlsx', '.xls', '.xlsm'].includes(ext)) {
      return {
        success: false,
        errorCode: 'EXCEL_UNSUPPORTED_FORMAT',
        error: `Unsupported file extension "${ext}". BarcodeFlow supports .xlsx, .xls, and .xlsm workbooks.`,
        pathChecked: resolvedPath,
      };
    }

    const stat = await fs.promises.stat(resolvedPath);
    let buffer: Buffer;
    try {
      buffer = await safelyReadFileWithRetry(resolvedPath, 3);
    } catch (err: any) {
      if (err.code === 'EBUSY' || err.code === 'EACCES') {
        return {
          success: false,
          errorCode: 'EXCEL_FILE_BUSY',
          error: 'Excel file is currently locked by another application. Please save and close Excel or allow shared reading.',
          pathChecked: resolvedPath,
        };
      }
      return {
        success: false,
        errorCode: 'EXCEL_ACCESS_DENIED',
        error: `File access error: ${err.message}`,
        pathChecked: resolvedPath,
      };
    }

    const wb = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true,
      cellNF: true,
      cellText: true,
      cellFormula: true,
    });

    const sheetNames = wb.SheetNames || [];
    if (sheetNames.length === 0) {
      return {
        success: false,
        errorCode: 'EXCEL_INVALID_WORKBOOK',
        error: 'Workbook contains no readable sheets.',
        pathChecked: resolvedPath,
      };
    }

    const workbookSheetsMeta = (wb.Workbook && wb.Workbook.Sheets) || [];
    const sheets = sheetNames.map((name, idx) => {
      const meta = workbookSheetsMeta[idx] || {};
      const isHidden = meta.Hidden === 1;
      const isVeryHidden = meta.Hidden === 2;
      const ws = wb.Sheets[name];
      let rowCount = 0;
      let colCount = 0;
      if (ws && ws['!ref']) {
        const r = XLSX.utils.decode_range(ws['!ref']);
        rowCount = Math.max(0, r.e.r - r.s.r);
        colCount = Math.max(0, r.e.c - r.s.c + 1);
      }
      return {
        name,
        displayName: name,
        type: 'sheet' as const,
        rowCount,
        columnCount: colCount,
        isHidden,
        isVeryHidden,
      };
    });

    return {
      success: true,
      metadata: {
        fileName: path.basename(resolvedPath),
        fullPath: resolvedPath,
        fileSize: stat.size,
        lastModified: stat.mtime.toISOString(),
        sheetNames,
        sheets,
        selectedSheet: sheetNames[0],
        estimatedRowCount: sheets[0]?.rowCount || 0,
        columnCount: sheets[0]?.columnCount || 0,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      errorCode: 'EXCEL_PARSE_FAILED',
      error: err.message || 'Failed to inspect workbook.',
      pathChecked: filePath,
    };
  }
}

function findWorksheet(wb: XLSX.WorkBook, requestedName?: string): { name: string; sheet: XLSX.WorkSheet } | null {
  if (!wb.SheetNames || wb.SheetNames.length === 0) return null;
  if (!requestedName || !requestedName.trim()) {
    const first = wb.SheetNames[0];
    return { name: first, sheet: wb.Sheets[first] };
  }

  // 1. Exact match
  if (wb.Sheets[requestedName]) {
    return { name: requestedName, sheet: wb.Sheets[requestedName] };
  }

  // 2. Normalized match (strip surrounding quotes and trailing $)
  const clean = requestedName.replace(/^['"]|['"]$/g, '').replace(/\$$/, '').trim().toLowerCase();
  for (const name of wb.SheetNames) {
    const candidateClean = name.replace(/^['"]|['"]$/g, '').replace(/\$$/, '').trim().toLowerCase();
    if (candidateClean === clean) {
      return { name, sheet: wb.Sheets[name] };
    }
  }

  // 3. Fallback to first sheet
  const first = wb.SheetNames[0];
  return { name: first, sheet: wb.Sheets[first] };
}

async function getPreviewInternal(params: {
  filePath: string;
  sheetName: string;
  headerRow?: number;
  hasHeaders?: boolean;
  page?: number;
  pageSize?: number;
  projectDir?: string;
  sort?: any[];
  filters?: any[];
  search?: any;
}) {
  try {
    const { filePath, sheetName, headerRow = 1, hasHeaders = true, page = 1, pageSize = 200, projectDir, sort, filters, search } = params;
    const { resolvedPath, exists } = resolveFilePath(filePath, projectDir);
    if (!exists) {
      return { success: false, errorCode: 'EXCEL_FILE_NOT_FOUND', error: `File not found: ${filePath}` };
    }

    const buffer = await safelyReadFileWithRetry(resolvedPath, 3);
    const wb = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true,
      cellNF: true,
      cellText: true,
      cellFormula: true,
    });

    const found = findWorksheet(wb, sheetName);
    if (!found || !found.sheet) {
      return { success: false, errorCode: 'EXCEL_SHEET_NOT_FOUND', error: `Sheet "${sheetName}" not found in workbook.` };
    }

    const sheet = found.sheet;
    const parsed = parseWorksheetData(sheet, headerRow, hasHeaders);
    const filtered = applyFiltersAndSorts(parsed.allRows, parsed.normalizedCells, sort, filters, search);

    const totalRows = filtered.rows.length;
    const totalPages = Math.ceil(totalRows / pageSize) || 1;
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const offset = (currentPage - 1) * pageSize;

    const pagedRows = filtered.rows.slice(offset, offset + pageSize);
    const pagedNormalized = filtered.normalized.slice(offset, offset + pageSize);

    return {
      success: true,
      page: currentPage,
      pageSize,
      totalRows,
      totalPages,
      columns: parsed.columns.map((c) => c.name),
      fields: parsed.fieldInfos,
      rows: pagedRows,
      normalizedCells: pagedNormalized,
    };
  } catch (err: any) {
    return { success: false, errorCode: 'EXCEL_PARSE_FAILED', error: err.message };
  }
}

async function watchExcelInternal(filePath: string, connectionId: string, projectDir?: string) {
  try {
    if (activeFileWatchers.has(connectionId)) {
      activeFileWatchers.get(connectionId)?.close();
      activeFileWatchers.delete(connectionId);
    }

    const { resolvedPath, exists } = resolveFilePath(filePath, projectDir);
    if (!exists) return false;

    const watcher = fs.watch(resolvedPath, (eventType) => {
      if (eventType === 'change' || eventType === 'rename') {
        if (fileChangeDebounceTimer) clearTimeout(fileChangeDebounceTimer);
        fileChangeDebounceTimer = setTimeout(async () => {
          let ready = false;
          for (let attempt = 0; attempt < 5; attempt++) {
            try {
              const fd = fs.openSync(resolvedPath, 'r');
              fs.closeSync(fd);
              ready = true;
              break;
            } catch {
              await new Promise((r) => setTimeout(r, 250));
            }
          }

          if (ready) {
            console.log(`[Electron Watcher] Stabilized file change: ${resolvedPath} (${connectionId})`);
            mainWindow?.webContents.send('barcodeFlow:excel:file-changed', {
              filePath: resolvedPath,
              connectionId,
            });
            mainWindow?.webContents.send('excel:file-changed', {
              filePath: resolvedPath,
              datasetId: connectionId,
            });
          }
        }, 1000);
      }
    });

    activeFileWatchers.set(connectionId, watcher);
    return true;
  } catch (err) {
    console.warn(`[Electron Watcher] Failed to watch ${filePath}:`, err);
    return false;
  }
}

async function unwatchExcelInternal(connectionId: string) {
  if (activeFileWatchers.has(connectionId)) {
    activeFileWatchers.get(connectionId)?.close();
    activeFileWatchers.delete(connectionId);
    return true;
  }
  return false;
}

function registerExcelIpc() {
  // 1. Native File Dialog for Excel
  ipcMain.handle('barcodeFlow:excel:select-file', async () => {
    return selectExcelFileInternal();
  });

  ipcMain.handle('excel:select-file', async () => {
    return selectExcelFileInternal();
  });

  // 2. Locate Missing File
  ipcMain.handle('barcodeFlow:excel:locate-file', async (_event, oldPath?: string) => {
    if (!mainWindow) return { canceled: true };
    const defaultDir = oldPath ? path.dirname(oldPath) : undefined;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Locate Missing Excel File',
      defaultPath: defaultDir && fs.existsSync(defaultDir) ? defaultDir : undefined,
      properties: ['openFile'],
      filters: [
        { name: 'Excel Spreadsheets (*.xlsx, *.xls, *.xlsm)', extensions: ['xlsx', 'xls', 'xlsm'] },
        { name: 'All Files (*.*)', extensions: ['*'] },
      ],
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
      lastModified: stats.mtime.toISOString(),
    };
  });

  ipcMain.handle('excel:locate-file', async (_event, oldPath?: string) => {
    return (await dialog.showOpenDialog(mainWindow!, {
      title: 'Locate Missing Excel File',
      defaultPath: oldPath && fs.existsSync(path.dirname(oldPath)) ? path.dirname(oldPath) : undefined,
      properties: ['openFile'],
      filters: [
        { name: 'Excel Spreadsheets (*.xlsx, *.xls, *.xlsm)', extensions: ['xlsx', 'xls', 'xlsm'] },
        { name: 'All Files (*.*)', extensions: ['*'] },
      ],
    })).canceled ? { canceled: true } : { canceled: false };
  });

  // 3. Inspect Workbook Metadata
  ipcMain.handle('barcodeFlow:excel:inspect-workbook', async (_event, { filePath, projectDir }: { filePath: string; projectDir?: string }) => {
    return inspectWorkbookInternal(filePath, projectDir);
  });

  // 4. Get Sheets
  ipcMain.handle('barcodeFlow:excel:get-sheets', async (_event, payload: { filePath: string; projectDir?: string }) => {
    const res = await inspectWorkbookInternal(payload.filePath, payload.projectDir);
    if (!res.success) return res;
    const metadata = res.metadata;
    if (!metadata) {
      return { success: false, errorCode: 'EXCEL_INVALID_WORKBOOK', error: 'Workbook metadata is unavailable.' };
    }
    return { success: true, sheets: metadata.sheets, sheetNames: metadata.sheetNames };
  });

  // 5. Get Fields
  ipcMain.handle(
    'barcodeFlow:excel:get-fields',
    async (
      _event,
      {
        filePath,
        sheetName,
        headerRow = 1,
        hasHeaders = true,
        projectDir,
      }: {
        filePath: string;
        sheetName: string;
        headerRow?: number;
        hasHeaders?: boolean;
        projectDir?: string;
      }
    ) => {
      try {
        const { resolvedPath, exists } = resolveFilePath(filePath, projectDir);
        if (!exists) {
          return { success: false, errorCode: 'EXCEL_FILE_NOT_FOUND', error: `File not found: ${filePath}` };
        }

        const buffer = await safelyReadFileWithRetry(resolvedPath, 3);
        const wb = XLSX.read(buffer, {
          type: 'buffer',
          cellDates: true,
          cellNF: true,
          cellText: true,
          cellFormula: true,
        });

        const found = findWorksheet(wb, sheetName);
        if (!found || !found.sheet) {
          return { success: false, errorCode: 'EXCEL_SHEET_NOT_FOUND', error: `Sheet "${sheetName}" not found in workbook.` };
        }

        const sheet = found.sheet;

        const parsed = parseWorksheetData(sheet, headerRow, hasHeaders);
        return {
          success: true,
          fields: parsed.fieldInfos,
          columns: parsed.columns.map((c) => c.name),
        };
      } catch (err: any) {
        return { success: false, errorCode: 'EXCEL_PARSE_FAILED', error: err.message };
      }
    }
  );

  // 6. Get Preview / Records (Paginated)
  ipcMain.handle(
    'barcodeFlow:excel:get-preview',
    async (
      _event,
      payload: {
        filePath: string;
        sheetName: string;
        headerRow?: number;
        hasHeaders?: boolean;
        page?: number;
        pageSize?: number;
        projectDir?: string;
        sort?: any[];
        filters?: any[];
        search?: any;
      }
    ) => {
      return getPreviewInternal(payload);
    }
  );

  ipcMain.handle('barcodeFlow:excel:get-records', async (_event, payload) => {
    return getPreviewInternal({
      filePath: payload.filePath,
      sheetName: payload.sheetName,
      headerRow: payload.headerRow,
      hasHeaders: payload.hasHeaders,
      page: payload.query?.page || 1,
      pageSize: payload.query?.pageSize || 200,
      projectDir: payload.projectDir,
      sort: payload.query?.sort,
      filters: payload.query?.filters,
      search: payload.query?.search,
    });
  });

  // 7. Stabilized Debounced File Watcher
  ipcMain.handle(
    'barcodeFlow:excel:watch',
    async (_event, { filePath, connectionId, projectDir }: { filePath: string; connectionId: string; projectDir?: string }) => {
      return watchExcelInternal(filePath, connectionId, projectDir);
    }
  );

  ipcMain.handle('barcodeFlow:excel:unwatch', async (_event, connectionId: string) => {
    return unwatchExcelInternal(connectionId);
  });

  // Backward compatibility handlers for existing frontend calls
  ipcMain.handle('excel:test-connection', async (_event, { filePath, sheetName }: { filePath: string; sheetName?: string }) => {
    const res = await inspectWorkbookInternal(filePath);
    if (!res.success) return res;
    const meta = res.metadata;
    if (!meta) {
      return { success: false, errorCode: 'EXCEL_INVALID_WORKBOOK', error: 'Workbook metadata is unavailable.' };
    }
    return {
      success: true,
      filePath: meta.fullPath,
      fileName: meta.fileName,
      sheets: meta.sheetNames,
      sheetCount: meta.sheetNames.length,
      selectedSheet: sheetName || meta.selectedSheet,
      totalRecords: meta.estimatedRowCount,
      lastModified: meta.lastModified,
      sizeBytes: meta.fileSize,
      pathChecked: meta.fullPath,
    };
  });

  ipcMain.handle(
    'excel:read-workbook',
    async (_event, { filePath, sheetName, headerRow = 1 }: { filePath: string; sheetName?: string; headerRow?: number }) => {
      const res = await getPreviewInternal({
        filePath,
        sheetName: sheetName || '',
        headerRow,
        page: 1,
        pageSize: 100000,
      });
      if (!res.success) return res;
      const rows = res.rows || [];
      return {
        success: true,
        sheetNames: [sheetName || 'Sheet1'],
        selectedSheet: sheetName,
        columns: res.columns,
        records: rows,
        previewRows: rows.slice(0, 20),
        totalRecords: res.totalRows,
      };
    }
  );

  ipcMain.handle('excel:open-location', async (_event, filePath: string) => {
    try {
      if (!filePath) return false;
      const resolved = path.normalize(path.resolve(filePath));
      if (fs.existsSync(resolved)) {
        shell.showItemInFolder(resolved);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  });

  ipcMain.handle('excel:open-file', async (_event, filePath: string) => {
    try {
      if (!filePath) return false;
      const resolved = path.normalize(path.resolve(filePath));
      if (fs.existsSync(resolved)) {
        await shell.openPath(resolved);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  });

  ipcMain.handle('excel:watch-file', async (_event, { filePath, datasetId }: { filePath: string; datasetId: string }) => {
    return watchExcelInternal(filePath, datasetId);
  });

  ipcMain.handle('excel:unwatch-file', async (_event, datasetId: string) => {
    return unwatchExcelInternal(datasetId);
  });
}


function registerDocumentIpc() {
  ipcMain.handle('app:renderer-ready', event => {
    if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) return [];
    rendererReady = true;
    if (rendererReadyTimeout) clearTimeout(rendererReadyTimeout);
    rendererReadyTimeout = null;
    resolveRendererReady?.();
    resolveRendererReady = null;
    rejectRendererReady = null;
    const queued = pendingDocumentPaths.splice(0, pendingDocumentPaths.length);
    return queued;
  });

  const isMainRenderer = (event: Electron.IpcMainInvokeEvent) =>
    !!mainWindow && event.sender === mainWindow.webContents && event.senderFrame === mainWindow.webContents.mainFrame;

  ipcMain.handle('document:recovery-read', event => {
    if (!isMainRenderer(event) || !allowRecoveryPrompt) return null;
    try {
      const snapshot = JSON.parse(fs.readFileSync(recoverySnapshotPath, 'utf8'));
      if (snapshot?.version !== 1 || !Array.isArray(snapshot.documents) || snapshot.documents.length === 0) return null;
      return snapshot;
    } catch {
      return null;
    }
  });

  ipcMain.handle('document:recovery-write', (event, snapshot: any) => {
    if (!isMainRenderer(event) || isQuitting || snapshot?.version !== 1 || !Array.isArray(snapshot.documents)) return false;
    if (snapshot.documents.length === 0 || snapshot.documents.length > 20) return false;
    try {
      const serialized = JSON.stringify(snapshot);
      if (Buffer.byteLength(serialized, 'utf8') > 100 * 1024 * 1024) {
        throw new Error('Recovery snapshot exceeds the 100 MiB safety limit.');
      }
      writeJsonAtomically(recoverySnapshotPath, snapshot);
      return true;
    } catch (error) {
      writeStartupLog('Could not save the latest recovery snapshot.', error);
      return false;
    }
  });

  ipcMain.handle('document:recovery-clear', event => {
    if (!isMainRenderer(event)) return false;
    try {
      fs.rmSync(recoverySnapshotPath, { force: true });
      return true;
    } catch (error) {
      writeStartupLog('Could not clear the resolved recovery snapshot.', error);
      return false;
    }
  });

  // 1. Show Native Windows Save As Dialog
  ipcMain.handle('document:show-save-dialog', async (_event, defaultFileName?: string, defaultDir?: string) => {
    if (!mainWindow) return { canceled: true };
    const defaultName = (defaultFileName || 'Document1').replace(/[\/\\:*?"<>|]/g, '_');
    const safeName = /\.(bfl|json)$/i.test(defaultName) ? defaultName : `${defaultName.replace(/\.btw$/i, '')}.bfl`;
    const defaultPath = defaultDir && fs.existsSync(defaultDir)
      ? path.join(defaultDir, safeName)
      : path.join(app.getPath('documents'), safeName);

    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save As - BarcodeFlow Document',
      defaultPath,
      filters: [
        { name: 'BarcodeFlow Document (*.bfl)', extensions: ['bfl'] },
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
    if (/\.btw[. ]*$/i.test(filePath)) {
      return { success: false, error: 'Native BarcodeFlow JSON cannot overwrite a BarTender .btw file. Save as .bfl instead.' };
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

  // 2b. Show Native Windows Save As PDF Dialog
  ipcMain.handle('document:show-save-pdf-dialog', async (_event, defaultFileName?: string, defaultDir?: string) => {
    if (!mainWindow) return { canceled: true };
    const defaultName = (defaultFileName || 'Document1').replace(/[\/\\:*?"<>|]/g, '_');
    const safeName = defaultName.endsWith('.pdf') ? defaultName : `${defaultName}.pdf`;
    let baseDir = app.getPath('desktop');
    if (!fs.existsSync(baseDir)) {
      baseDir = app.getPath('documents');
    }
    const defaultPath = defaultDir && fs.existsSync(defaultDir)
      ? path.join(defaultDir, safeName)
      : path.join(baseDir, safeName);

    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save As PDF - BarcodeFlow Enterprise',
      defaultPath,
      filters: [
        { name: 'PDF Document (*.pdf)', extensions: ['pdf'] },
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

  // 2c. Save Binary File (for PDF, PRN, etc.)
  ipcMain.handle('document:save-binary-file', async (_event, { filePath, base64Data }: { filePath: string; base64Data: string }) => {
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
    const buffer = Buffer.from(base64Data, 'base64');

    try {
      await fs.promises.writeFile(tempPath, buffer);
      await fs.promises.rename(tempPath, resolvedPath);
      const stat = await fs.promises.stat(resolvedPath);
      return {
        success: true,
        filePath: resolvedPath,
        fileName: path.basename(resolvedPath),
        sizeBytes: stat.size,
        lastModified: stat.mtime.toISOString(),
      };
    } catch (err: any) {
      try {
        if (fs.existsSync(tempPath)) await fs.promises.unlink(tempPath);
      } catch { }
      return { success: false, error: err.message || 'Binary write failed' };
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
        { name: 'All Supported Documents (*.bfl, *.btw, *.json)', extensions: ['bfl', 'btw', 'json'] },
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

  // 3b. Show Native Windows Folder Dialog (Select Directory)
  ipcMain.handle('document:show-directory-dialog', async (_event, defaultDir?: string) => {
    if (!mainWindow) return { canceled: true };
    const defaultPath = defaultDir && fs.existsSync(defaultDir) ? defaultDir : app.getPath('documents');
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Destination Folder - BarcodeFlow',
      defaultPath,
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const resolvedPath = path.normalize(path.resolve(result.filePaths[0]));
    return {
      canceled: false,
      folderPath: resolvedPath,
    };
  });

  // 4. Read Document File (Format-Aware & Safe)
  ipcMain.handle('document:read-file', async (_event, filePath: string) => {
    if (!filePath) {
      return { success: false, error: 'File path cannot be empty' };
    }
    const resolvedPath = path.normalize(path.resolve(filePath));
    if (!fs.existsSync(resolvedPath)) {
      return { success: false, error: `File not found: ${resolvedPath}` };
    }

    try {
      const stats = await fs.promises.stat(resolvedPath);
      const ext = path.extname(resolvedPath).toLowerCase();

      // Case 1: BarTender .btw file (Binary / Compound OLE)
      if (ext === '.btw') {
        const result = await openBarTenderWithConsent({
          sourcePath: resolvedPath,
          workingRoot: path.join(app.getPath('temp'), 'BarcodeFlow', 'bartender-import'),
          scriptPath: app.isPackaged
            ? path.join(process.resourcesPath, 'interop', 'bartender_snapshot.ps1')
            : path.join(__dirname, '../scripts/bartender_snapshot.ps1'),
          onProgress: phase => {
            if (!_event.sender.isDestroyed()) _event.sender.send('document:bartender-progress', { filePath: resolvedPath, phase });
          },
          confirm: async () => {
            const owner = BrowserWindow.fromWebContents(_event.sender);
            if (!owner) return false;
            const consent = await dialog.showMessageBox(owner, {
              type: 'warning', title: 'BarTender-assisted Partial Import',
              message: `Extract verified objects from ${path.basename(resolvedPath)}?`,
              detail: 'Requires installed, licensed BarTender Automation/Enterprise Automation with ActiveX support on Windows.\n\nOnly verified properties will become an unsaved native draft; unresolved text, barcodes and behaviors remain listed in a partial report. This is not a complete or production-ready label.\n\nA private temporary copy is opened in a separate automation instance. No print, source-save or evaluated Value calls are issued. BarTender may execute document-open scripts or access external dependencies: use only a trusted working copy safe for non-production inspection.',
              buttons: ['Extract Partial Draft', 'Cancel'], defaultId: 1, cancelId: 1,
              checkboxLabel: 'This is a trusted working copy safe for non-production inspection.', checkboxChecked: false,
              noLink: true,
            });
            return consent.response === 0 && consent.checkboxChecked;
          },
        });
        if (!result.success) return result;
        return {
          success: true,
          format: 'JSON',
          document: result.document,
          filePath: resolvedPath,
          fileName: path.basename(resolvedPath),
          sizeBytes: stats.size,
          lastModified: stats.mtime.toISOString(),
          isBinary: false,
        };
      }

      // Read buffer header to detect magic signatures
      const fd = await fs.promises.open(resolvedPath, 'r');
      const headerBuf = Buffer.alloc(128);
      await fd.read(headerBuf, 0, 128, 0);
      await fd.close();

      // Check OLE compound document signature (BarTender binary header: D0 CF 11 E0)
      if (
        headerBuf[0] === 0xd0 &&
        headerBuf[1] === 0xcf &&
        headerBuf[2] === 0x11 &&
        headerBuf[3] === 0xe0
      ) {
        console.log(`[DocumentService] Detected OLE Compound / BarTender binary header in: ${resolvedPath}. Parsing template layout.`);
        const buf = await fs.promises.readFile(resolvedPath);
        const parsedDoc = parseBarTenderDocument(buf, path.basename(resolvedPath));
        return {
          success: true,
          format: 'BARTENDER_BTW',
          document: parsedDoc,
          filePath: resolvedPath,
          fileName: path.basename(resolvedPath),
          sizeBytes: stats.size,
          lastModified: stats.mtime.toISOString(),
          isBinary: true,
        };
      }

      // Read buffer header to detect BarTender text signature
      const headerStr = headerBuf.toString('latin1');
      if (/^\s*Bar Tender Format File(?:\s|$)/.test(headerStr)) {
        console.log(`[DocumentService] Detected BarTender signature in: ${resolvedPath}. Parsing template layout.`);
        const buf = await fs.promises.readFile(resolvedPath);
        const parsedDoc = parseBarTenderDocument(buf, path.basename(resolvedPath));
        return {
          success: true,
          format: 'BARTENDER_BTW',
          document: parsedDoc,
          filePath: resolvedPath,
          fileName: path.basename(resolvedPath),
          sizeBytes: stats.size,
          lastModified: stats.mtime.toISOString(),
          isBinary: true,
        };
      }

      // Case 2: BarcodeFlow Native (.bfl) or JSON
      const content = await fs.promises.readFile(resolvedPath, 'utf-8');
      try {
        const parsed = JSON.parse(content.replace(/^\uFEFF/, ''));
        return {
          success: true,
          format: ext === '.bfl' || parsed.format === 'BarcodeFlowDocument' ? 'BARCODEFLOW_NATIVE' : 'JSON',
          document: parsed,
          filePath: resolvedPath,
          fileName: path.basename(resolvedPath),
          sizeBytes: stats.size,
          lastModified: stats.mtime.toISOString(),
          isBinary: false,
        };
      } catch {
        // If JSON.parse fails, verify if content is a BarTender file before failing
        if (content.includes('Bar Tender') || content.includes('BarTender') || content.includes('Seagull')) {
          console.log(`[DocumentService] Recovered BarTender document from non-JSON file: ${resolvedPath}`);
          const parsedDoc = parseBarTenderDocument(content, path.basename(resolvedPath));
          return {
            success: true,
            format: 'BARTENDER_BTW',
            document: parsedDoc,
            filePath: resolvedPath,
            fileName: path.basename(resolvedPath),
            sizeBytes: stats.size,
            lastModified: stats.mtime.toISOString(),
            isBinary: true,
          };
        }
        return {
          success: false,
          error: 'BarcodeFlow document is invalid or corrupted.',
        };
      }
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

  // 6b. Open Document / PDF File in Windows Default Application (e.g. WPS Office / Adobe / Edge)
  ipcMain.handle('document:open-file', async (_event, filePath: string) => {
    if (!filePath) return false;
    try {
      const resolvedPath = path.normalize(path.resolve(filePath));
      if (fs.existsSync(resolvedPath)) {
        console.log(`[DocumentService] Auto-opening file in system default viewer: "${resolvedPath}"`);
        const errorMsg = await shell.openPath(resolvedPath);
        if (errorMsg) {
          console.warn(`[DocumentService] shell.openPath warning: ${errorMsg}`);
          return false;
        }
        return true;
      }
      return false;
    } catch (err: any) {
      console.error(`[DocumentService] Failed to open file: ${err?.message}`);
      return false;
    }
  });

  // 6c. Recent Documents MRU Persistence & App Settings in Electron UserData
  function getRecentDocumentsPath(): string {
    const userData = app.getPath('userData');
    if (!fs.existsSync(userData)) {
      fs.mkdirSync(userData, { recursive: true });
    }
    return path.join(userData, 'recent-documents.json');
  }

  function getAppSettingsPath(): string {
    const userData = app.getPath('userData');
    if (!fs.existsSync(userData)) {
      fs.mkdirSync(userData, { recursive: true });
    }
    return path.join(userData, 'app-settings.json');
  }

  function readRecentDocumentsFromDisk(): any[] {
    try {
      const p = getRecentDocumentsPath();
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.warn('[RecentDocuments] Failed to read recent documents from disk:', err);
    }
    return [];
  }

  function writeRecentDocumentsToDisk(items: any[]): void {
    try {
      const p = getRecentDocumentsPath();
      writeJsonAtomically(p, items);
    } catch (err) {
      console.warn('[RecentDocuments] Failed to write recent documents to disk:', err);
    }
  }

  function readAppSettingsFromDisk(): Record<string, any> {
    try {
      const p = getAppSettingsPath();
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn('[AppSettings] Failed to read settings from disk:', err);
    }
    return { showWelcomeOnStartup: true };
  }

  function writeAppSettingsToDisk(settings: Record<string, any>): void {
    try {
      const p = getAppSettingsPath();
      writeJsonAtomically(p, settings);
    } catch (err) {
      console.warn('[AppSettings] Failed to write settings to disk:', err);
    }
  }

  ipcMain.handle('document:get-recent', async () => {
    return readRecentDocumentsFromDisk();
  });

  ipcMain.handle('document:add-recent', async (_event, filePathOrEntry: any, maybeName?: string) => {
    if (!filePathOrEntry) return readRecentDocumentsFromDisk();

    const rawPath = typeof filePathOrEntry === 'string' ? filePathOrEntry : filePathOrEntry.filePath || filePathOrEntry.absolutePath;
    if (!rawPath || typeof rawPath !== 'string') return readRecentDocumentsFromDisk();

    const resolvedPath = path.normalize(path.resolve(rawPath.trim()));
    const ext = path.extname(resolvedPath).toLowerCase();
    const ALLOWED_EXTS = ['.bfl', '.btw', '.json'];
    if (!ALLOWED_EXTS.includes(ext)) {
      console.warn(`[RecentDocuments] Ignored unsupported file format: ${ext}`);
      return readRecentDocumentsFromDisk();
    }

    let stats: fs.Stats | null = null;
    try {
      if (fs.existsSync(resolvedPath)) {
        stats = fs.statSync(resolvedPath);
      }
    } catch { }

    const displayName = maybeName || (typeof filePathOrEntry === 'object' && filePathOrEntry.displayName) || (typeof filePathOrEntry === 'object' && filePathOrEntry.fileName) || path.basename(resolvedPath);
    const templateName = (typeof filePathOrEntry === 'object' && filePathOrEntry.templateName) || displayName;

    const entry = {
      id: (typeof filePathOrEntry === 'object' && filePathOrEntry.id) || `mru-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      absolutePath: resolvedPath,
      displayName,
      filePath: resolvedPath,
      fileName: displayName,
      lastOpenedAt: new Date().toISOString(),
      lastModified: stats ? stats.mtime.toISOString() : undefined,
      fileType: ext.replace('.', '') || 'bfl',
      fileSize: stats ? stats.size : undefined,
      templateName,
    };

    const current = readRecentDocumentsFromDisk();
    const filtered = current.filter((item) => {
      const itemPath = (item.absolutePath || item.filePath || '').toLowerCase();
      return itemPath !== resolvedPath.toLowerCase();
    });

    const updated = [entry, ...filtered].slice(0, 10);
    writeRecentDocumentsToDisk(updated);
    return updated;
  });

  ipcMain.handle('document:remove-recent', async (_event, filePath: string) => {
    if (!filePath || typeof filePath !== 'string') return readRecentDocumentsFromDisk();
    const resolvedPath = path.normalize(path.resolve(filePath.trim()));
    const current = readRecentDocumentsFromDisk();
    const updated = current.filter((item) => {
      const itemPath = (item.absolutePath || item.filePath || '').toLowerCase();
      return itemPath !== resolvedPath.toLowerCase();
    });
    writeRecentDocumentsToDisk(updated);
    return updated;
  });

  ipcMain.handle('document:clear-recent', async () => {
    writeRecentDocumentsToDisk([]);
    return [];
  });

  ipcMain.handle('app:get-settings', async () => {
    return readAppSettingsFromDisk();
  });

  ipcMain.handle('app:save-settings', async (_event, newSettings: Record<string, any>) => {
    const existing = readAppSettingsFromDisk();
    const updated = { ...existing, ...newSettings };
    writeAppSettingsToDisk(updated);
    return updated;
  });

  // 7. Native App Exit & Window Controls
  ipcMain.handle('app:exit', async () => {
    app.quit();
    return true;
  });

  ipcMain.on('app:set-document-dirty', (event, dirty: boolean) => {
    if (event.sender === mainWindow?.webContents) hasDirtyDocuments = dirty === true;
  });

  ipcMain.handle('window:confirm-close', event => {
    if (event.sender !== mainWindow?.webContents || !closeRequestPending) return false;
    closeRequestPending = false;
    app.quit();
    return true;
  });

  ipcMain.handle('window:cancel-close', event => {
    if (event.sender !== mainWindow?.webContents) return false;
    closeRequestPending = false;
    return true;
  });

  ipcMain.handle('window:minimize', async () => {
    if (mainWindow) {
      mainWindow.minimize();
      return true;
    }
    return false;
  });

  ipcMain.handle('window:maximize', async () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
      return mainWindow.isMaximized();
    }
    return false;
  });

  ipcMain.handle('window:is-maximized', async () => {
    return mainWindow ? mainWindow.isMaximized() : false;
  });

  ipcMain.handle('window:close', async () => {
    if (mainWindow) {
      mainWindow.close();
      return true;
    }
    return false;
  });
}

function registerAccountSetupIpc() {
  let pending = false;
  const isTrusted = (event: Electron.IpcMainInvokeEvent) => !!mainWindow &&
    event.sender === mainWindow.webContents && event.senderFrame === mainWindow.webContents.mainFrame &&
    !!event.senderFrame?.url.startsWith(`${backendUrl}/`);

  ipcMain.handle('auth:list-initial-password-accounts', event => {
    if (!isTrusted(event)) return [];
    return accountSetupBackend?.getLegacyPasswordAccounts() || [];
  });
  ipcMain.handle('auth:initialize-legacy-password', async (event, payload: { email: string; password: string }) => {
    if (!isTrusted(event) || !accountSetupBackend || pending) return { success: false, error: 'Password setup requires the local desktop window.' };
    if (typeof payload?.email !== 'string' || typeof payload.password !== 'string' || payload.password.length < 12 || payload.password.length > 1024) {
      return { success: false, error: 'Password must contain between 12 and 1024 characters.' };
    }
    const email = payload.email.trim().toLowerCase();
    if (!accountSetupBackend.getLegacyPasswordAccounts().some(account => account.email.toLowerCase() === email)) {
      return { success: false, error: 'This account is not eligible for initial password setup.' };
    }
    pending = true;
    try {
      const consent = await dialog.showMessageBox(mainWindow!, {
        type: 'warning', buttons: ['Cancel', 'Set Password'], defaultId: 0, cancelId: 0,
        title: 'Initial Account Password', message: `Set the initial password for ${email}?`,
        detail: 'Approve only if you own this local account. This account has no saved password. Existing passwords, roles, approvals and permissions will not be changed.',
        noLink: true,
      });
      if (consent.response !== 1) return { success: false, canceled: true };
      if (!isTrusted(event)) return { success: false, error: 'Desktop window changed. Password was not saved.' };
      accountSetupBackend.initializeLegacyPassword(email, payload.password);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Password could not be saved.' };
    } finally {
      pending = false;
    }
  });
}

async function createWindow(): Promise<void> {
  rendererReady = false;
  const settings = readPersistedSettings();
  const saved = settings.windowBounds;
  let windowBounds = { width: 1440, height: 900, x: undefined as number | undefined, y: undefined as number | undefined };
  if (saved && [saved.x, saved.y, saved.width, saved.height].every(Number.isFinite)) {
    const display = screen.getDisplayMatching(saved);
    const area = display.workArea;
    const width = Math.min(area.width, Math.max(1024, saved.width));
    const height = Math.min(area.height, Math.max(700, saved.height));
    const intersects = saved.x + saved.width > area.x && saved.x < area.x + area.width &&
      saved.y + saved.height > area.y && saved.y < area.y + area.height;
    windowBounds = {
      width,
      height,
      x: intersects ? Math.max(area.x, Math.min(saved.x, area.x + area.width - width)) : undefined,
      y: intersects ? Math.max(area.y, Math.min(saved.y, area.y + area.height - height)) : undefined,
    };
  }

  const window = new BrowserWindow({
    ...windowBounds,
    minWidth: 1024,
    minHeight: 700,
    title: 'BarcodeFlow Enterprise Suite',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#0f172a',
  });
  mainWindow = window;

  const localServerUrl = backendUrl;
  const distIndex = path.join(__dirname, '../dist/index.html');
  if (!fs.existsSync(distIndex)) throw new Error('The packaged BarcodeFlow designer bundle is missing.');
  writeStartupLog(`Loading designer from ${localServerUrl}; startup elapsed ${Date.now() - startupStartedAt}ms.`);

  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    writeStartupLog(`Failed to load ${validatedURL}: ${errorCode} - ${errorDescription}`);
  });

  window.on('resize', () => persistWindowState());
  window.on('move', () => persistWindowState());
  window.on('maximize', () => persistWindowState());
  window.on('unmaximize', () => persistWindowState());
  window.on('close', () => persistWindowState(true));
  window.on('close', event => {
    if (isQuitting || !hasDirtyDocuments) return;
    event.preventDefault();
    if (closeRequestPending) return;
    closeRequestPending = true;
    window.webContents.send('app:request-close');
  });
  window.on('closed', () => {
    mainWindow = null;
    if (!rendererReady && rejectRendererReady) {
      if (rendererReadyTimeout) clearTimeout(rendererReadyTimeout);
      rendererReadyTimeout = null;
      const reject = rejectRendererReady;
      resolveRendererReady = null;
      rejectRendererReady = null;
      reject(new Error('The designer window closed before the renderer became ready.'));
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  await window.loadURL(localServerUrl);
  if (window.isDestroyed()) throw new Error('The designer window closed before startup completed.');
  if (!rendererReady) {
    await new Promise<void>((resolve, reject) => {
      resolveRendererReady = resolve;
      rejectRendererReady = reject;
      rendererReadyTimeout = setTimeout(() => {
        rendererReadyTimeout = null;
        resolveRendererReady = null;
        rejectRendererReady = null;
        reject(new Error('The BarcodeFlow designer did not become ready within 30 seconds.'));
      }, 30000);
    });
  }
  if (window.isDestroyed()) throw new Error('The designer window closed during startup.');
  window.show();
  if (settings.windowMaximized !== false) window.maximize();
}

async function runDesktopStartup(): Promise<void> {
  let attempt = 0;
  try {
    await createSplashWindow();
  } catch (error) {
    writeStartupLog('Could not display the startup splash.', error);
  }

  while (!isQuitting) {
    attempt += 1;
    try {
      setSplashStatus('Starting local services...');
      await startBackendServer();
      setSplashStatus('Loading the designer...');
      await createWindow();
      writeStartupLog(`Startup completed in ${Date.now() - startupStartedAt}ms after ${attempt} attempt(s).`);
      closeSplashWindow();
      return;
    } catch (error: any) {
      writeStartupLog(`Startup attempt ${attempt} failed.`, error);
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
      mainWindow = null;

      const options = {
        type: 'error' as const,
        title: 'BarcodeFlow could not start',
        message: 'BarcodeFlow could not finish initializing.',
        detail: `${error?.message || String(error)}\n\nStartup log: ${path.join(app.getPath('logs'), 'barcodeflow-startup.log')}`,
        buttons: ['Retry', 'Open Logs', 'Exit'],
        defaultId: 0,
        cancelId: 2,
        noLink: true,
      };
      const result = splashWindow && !splashWindow.isDestroyed()
        ? await dialog.showMessageBox(splashWindow, options)
        : await dialog.showMessageBox(options);
      if (result.response === 0) continue;
      if (result.response === 1) {
        await shell.openPath(path.join(app.getPath('logs'), 'barcodeflow-startup.log'));
        continue;
      }
      app.quit();
      return;
    }
  }
}

let cachedSystemFonts: string[] | null = null;

function registerFontIpc() {
  ipcMain.handle('fonts:list', async () => {
    if (cachedSystemFonts && cachedSystemFonts.length > 0) {
      return cachedSystemFonts;
    }

    const standardFallbackFonts = [
      'Arial',
      'Arial Black',
      'Arial Narrow',
      'Arial Rounded MT Bold',
      'Bahnschrift',
      'Bahnschrift Condensed',
      'Calibri',
      'Calibri Light',
      'Cambria',
      'Candara',
      'Century Gothic',
      'Comic Sans MS',
      'Consolas',
      'Constantia',
      'Corbel',
      'Courier New',
      'Ebrima',
      'Franklin Gothic Medium',
      'Gabriola',
      'Gadugi',
      'Georgia',
      'Impact',
      'Ink Free',
      'Javanese Text',
      'Leelawadee UI',
      'Lucida Console',
      'Lucida Sans Unicode',
      'Malgun Gothic',
      'Marlett',
      'Microsoft Himalaya',
      'Microsoft JhengHei',
      'Microsoft New Tai Lue',
      'Microsoft PhagsPa',
      'Microsoft Sans Serif',
      'Microsoft Tai Le',
      'Microsoft YaHei',
      'Microsoft Yi Baiti',
      'MingLiU-ExtB',
      'Mongolian Baiti',
      'MS Gothic',
      'MS PGothic',
      'MS UI Gothic',
      'MV Boli',
      'Myanmar Text',
      'Nirmala UI',
      'OCR A Extended',
      'OCR-B 10 BT',
      'Palatino Linotype',
      'Segoe Print',
      'Segoe Script',
      'Segoe UI',
      'Segoe UI Historic',
      'Segoe UI Symbol',
      'SimSun',
      'Sitka Small',
      'Sitka Text',
      'Sitka Heading',
      'Sitka Display',
      'Sylfaen',
      'Symbol',
      'Tahoma',
      'Times New Roman',
      'Trebuchet MS',
      'Verdana',
      'Webdings',
      'Wingdings',
      'Yu Gothic'
    ];

    if (process.platform === 'win32') {
      try {
        const { exec } = await import('child_process');
        const fontList: string[] = await new Promise((resolve) => {
          const cmd = `powershell -NoProfile -NonInteractive -Command "[System.Reflection.Assembly]::LoadWithPartialName('System.Drawing') | Out-Null; [System.Drawing.FontFamily]::Families | Select-Object -ExpandProperty Name"`;
          exec(cmd, { timeout: 3500 }, (error, stdout) => {
            if (error || !stdout) {
              resolve(standardFallbackFonts);
              return;
            }
            const lines = stdout
              .split(/\r?\n/)
              .map((l) => l.trim())
              .filter((l) => l.length > 0 && !l.startsWith('Exception'));
            if (lines.length > 5) {
              const unique = Array.from(new Set([...lines, ...standardFallbackFonts])).sort((a, b) =>
                a.localeCompare(b)
              );
              resolve(unique);
            } else {
              resolve(standardFallbackFonts);
            }
          });
        });

        cachedSystemFonts = fontList;
        return fontList;
      } catch {
        cachedSystemFonts = standardFallbackFonts;
        return standardFallbackFonts;
      }
    }

    cachedSystemFonts = standardFallbackFonts;
    return standardFallbackFonts;
  });
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  process.argv.forEach(argument => queueDocumentPath(argument));

  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    queueDocumentPath(filePath);
    focusMainWindow();
  });

  app.on('second-instance', (_event, commandLine, cwd) => {
    commandLine.forEach(argument => queueDocumentPath(argument, cwd));
    if (mainWindow) focusMainWindow();
    else if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.show();
      splashWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    const userDataDirectory = app.getPath('userData');
    fs.mkdirSync(userDataDirectory, { recursive: true });
    recoverySnapshotPath = path.join(userDataDirectory, 'recovery-snapshot.json');
    shutdownMarkerPath = path.join(userDataDirectory, 'session-in-progress');
    allowRecoveryPrompt = fs.existsSync(shutdownMarkerPath);
    if (!allowRecoveryPrompt) {
      try {
        fs.rmSync(recoverySnapshotPath, { force: true });
      } catch (error) {
        writeStartupLog('Could not clear a recovery snapshot left by a normal shutdown.', error);
      }
    }
    fs.writeFileSync(shutdownMarkerPath, new Date().toISOString(), 'utf8');
    registerAccountSetupIpc();
    registerDocumentIpc();
    registerExcelIpc();
    registerFontIpc();
    registerPrinterIpc(() => mainWindow);
    registerDatabaseIpc(() => mainWindow);
    writeStartupLog('Electron is ready; initializing local services.');
    await runDesktopStartup();

    app.on('activate', () => {
      if (mainWindow && !mainWindow.isDestroyed()) focusMainWindow();
      else void runDesktopStartup();
    });
  }).catch(error => {
    writeStartupLog('Desktop initialization failed before the retry flow became available.', error);
    dialog.showErrorBox('BarcodeFlow startup failed', error.message || String(error));
    app.quit();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', event => {
    if (isQuitting) return;
    isQuitting = true;
    for (const statePath of [recoverySnapshotPath, shutdownMarkerPath]) {
      if (!statePath) continue;
      try {
        fs.rmSync(statePath, { force: true });
      } catch (error) {
        writeStartupLog(`Could not clear clean-shutdown recovery state at ${statePath}.`, error);
      }
    }
    if (!backendServer?.listening) return;

    event.preventDefault();
    const server = backendServer;
    const closeTimeout = setTimeout(() => {
      server.closeAllConnections?.();
      backendServer = null;
      backendUrl = '';
      app.quit();
    }, 5000);
    closeTimeout.unref();
    server.close(() => {
      clearTimeout(closeTimeout);
      backendServer = null;
      backendUrl = '';
      app.quit();
    });
  });
}
