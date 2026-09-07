import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { StorageService } from '../services/storageService';
import { AuditService } from '../services/auditService';
import { excelWatcherService } from '../services/excelWatcherService';

export const datasetsRouter = Router();
const storage = StorageService.getInstance();
const audit = AuditService.getInstance();

export interface DatasetItem {
  id: string;
  name: string;
  description?: string;
  sourceType: 'manual' | 'excel' | 'csv' | 'json' | 'api';
  mode?: 'import' | 'link' | 'imported' | 'linked';
  filePath?: string;
  fileName?: string;
  sheetName?: string;
  availableSheets?: string[];
  headerRow?: number;
  status?: string;
  statusMessage?: string;
  columns: string[];
  records: Record<string, any>[];
  recordCount: number;
  createdAt: string;
  updatedAt: string;
  lastModified?: string;
  lastRefreshed?: string;
  createdBy: string;
  autoRefresh?: boolean;
  mapping?: Record<string, string>;
}

export function readExcelFromFile(
  filePath: string,
  preferredSheet?: string,
  headerRow: number = 1
): {
  sheetNames: string[];
  selectedSheet: string;
  columns: string[];
  records: Record<string, any>[];
  previewRows: Record<string, any>[];
  totalRecords: number;
  lastModified: string;
  sizeBytes: number;
} {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Excel file not found at path: "${filePath}"`);
  }

  const stat = fs.statSync(filePath);
  const buffer = fs.readFileSync(filePath);
  const wb = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
    cellNF: true,
    cellText: true,
  });

  const sheetNames = wb.SheetNames || [];
  if (sheetNames.length === 0) {
    throw new Error('Excel file contains no readable sheets.');
  }

  const selectedSheet = (preferredSheet && sheetNames.includes(preferredSheet)) ? preferredSheet : sheetNames[0];
  const sheet = wb.Sheets[selectedSheet];
  if (!sheet) {
    throw new Error(`Sheet "${selectedSheet}" not found in workbook.`);
  }

  const rawMatrix: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false, // Preserves leading zeros for barcodes/SKUs e.g. "00123456"
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

  const records: Record<string, any>[] = dataLines.map((row) => {
    const item: Record<string, any> = {};
    headerLine.forEach((colName, colIdx) => {
      const cellVal = row[colIdx];
      item[colName] = cellVal !== undefined && cellVal !== null ? String(cellVal).trim() : '';
    });
    return item;
  });

  return {
    sheetNames,
    selectedSheet,
    columns: headerLine,
    records,
    previewRows: records.slice(0, 20),
    totalRecords: records.length,
    lastModified: stat.mtime.toISOString(),
    sizeBytes: stat.size,
  };
}

const DEFAULT_DATASETS: DatasetItem[] = [
  {
    id: 'ds-pharma-01',
    name: 'Pharmaceutical Master Packaging Lots',
    description: 'Sterile Injectable Vials Serialization Master Dataset',
    sourceType: 'excel',
    fileName: 'Pharma_Master_Lots_2026.xlsx',
    columns: ['ITEM_CODE', 'PRODUCT_NAME', 'BATCH_NO', 'LOT_NO', 'MFG_DATE', 'EXP_DATE', 'MRP', 'GTIN', 'SERIAL_PREFIX'],
    records: [
      {
        ITEM_CODE: 'INJ-500MG-01',
        PRODUCT_NAME: 'Ceftriaxone Sodium 1g Vial',
        BATCH_NO: 'BATCH-2026-X8',
        LOT_NO: 'LOT-9921',
        MFG_DATE: '2026-08-01',
        EXP_DATE: '2028-07-31',
        MRP: '$149.00',
        GTIN: '00850006539987',
        SERIAL_PREFIX: 'SN-BATCH2026X8',
      },
      {
        ITEM_CODE: 'INJ-500MG-02',
        PRODUCT_NAME: 'Amoxicillin & Clavulanate Injection',
        BATCH_NO: 'BATCH-2026-Y9',
        LOT_NO: 'LOT-9922',
        MFG_DATE: '2026-08-05',
        EXP_DATE: '2028-08-04',
        MRP: '$189.50',
        GTIN: '00850006540013',
        SERIAL_PREFIX: 'SN-BATCH2026Y9',
      },
      {
        ITEM_CODE: 'INJ-1000MG-03',
        PRODUCT_NAME: 'Paracetamol IV Infusion 100ml',
        BATCH_NO: 'BATCH-2026-Z1',
        LOT_NO: 'LOT-9923',
        MFG_DATE: '2026-08-10',
        EXP_DATE: '2028-08-09',
        MRP: '$99.00',
        GTIN: '00850006540051',
        SERIAL_PREFIX: 'SN-BATCH2026Z1',
      },
    ],
    recordCount: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'System Administrator',
  },
  {
    id: 'ds-logistics-02',
    name: 'Global Logistics Pallet Shipping Index',
    description: 'Master SSCC-18 Shipping Container Manifest Dataset',
    sourceType: 'csv',
    fileName: 'Logistics_Pallet_Manifest.csv',
    columns: ['PALLET_ID', 'SHIP_TO', 'DESTINATION_ZONE', 'CARRIER', 'TOTAL_CASES', 'NET_WEIGHT_KG', 'SSCC_18'],
    records: [
      {
        PALLET_ID: 'PLT-88102',
        SHIP_TO: 'Distribution Center Frankfurt',
        DESTINATION_ZONE: 'EU-CENTRAL-01',
        CARRIER: 'DHL Supply Chain Express',
        TOTAL_CASES: '120',
        NET_WEIGHT_KG: '485.50',
        SSCC_18: '(00)108500065399870014',
      },
      {
        PALLET_ID: 'PLT-88103',
        SHIP_TO: 'Regional Hub Chicago',
        DESTINATION_ZONE: 'US-MIDWEST-04',
        CARRIER: 'FedEx Freight Priority',
        TOTAL_CASES: '95',
        NET_WEIGHT_KG: '390.20',
        SSCC_18: '(00)108500065399870021',
      },
    ],
    recordCount: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'Logistics Lead',
  },
];

// GET /api/datasets
datasetsRouter.get('/', (req: Request, res: Response) => {
  try {
    const datasets = storage.read<DatasetItem>('datasets', DEFAULT_DATASETS);
    res.json(datasets);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch datasets' });
  }
});

// GET /api/datasets/:id
datasetsRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const datasets = storage.read<DatasetItem>('datasets', DEFAULT_DATASETS);
    const ds = datasets.find((d) => d.id === req.params.id);
    if (!ds) {
      return res.status(404).json({ error: 'Dataset not found' });
    }
    res.json(ds);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/datasets
datasetsRouter.post('/', (req: Request, res: Response) => {
  try {
    const datasets = storage.read<DatasetItem>('datasets', DEFAULT_DATASETS);
    const body = req.body;

    const newDataset: DatasetItem = {
      id: body.id || `ds-${Date.now()}`,
      name: body.name || 'Untitled Dataset',
      description: body.description || '',
      sourceType: body.sourceType || 'manual',
      fileName: body.fileName,
      columns: Array.isArray(body.columns) ? body.columns : [],
      records: Array.isArray(body.records) ? body.records : [],
      recordCount: Array.isArray(body.records) ? body.records.length : 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: body.createdBy || 'User',
    };

    const updated = [newDataset, ...datasets];
    storage.write('datasets', updated);

    audit.log('DATASET_CREATE', `Created dataset "${newDataset.name}" with ${newDataset.recordCount} records.`);

    res.status(201).json(newDataset);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/datasets/:id
datasetsRouter.put('/:id', (req: Request, res: Response) => {
  try {
    const datasets = storage.read<DatasetItem>('datasets', DEFAULT_DATASETS);
    const idx = datasets.findIndex((d) => d.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    const updatedDs: DatasetItem = {
      ...datasets[idx],
      ...req.body,
      updatedAt: new Date().toISOString(),
      recordCount: Array.isArray(req.body.records) ? req.body.records.length : datasets[idx].recordCount,
    };

    datasets[idx] = updatedDs;
    storage.write('datasets', datasets);

    audit.log('DATASET_UPDATE', `Updated dataset "${updatedDs.name}".`);

    res.json(updatedDs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/datasets/:id
datasetsRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    const datasets = storage.read<DatasetItem>('datasets', DEFAULT_DATASETS);
    const filtered = datasets.filter((d) => d.id !== req.params.id);
    storage.write('datasets', filtered);

    audit.log('DATASET_DELETE', `Deleted dataset ID: ${req.params.id}`);

    res.json({ success: true, message: 'Dataset deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/datasets/upload-excel
datasetsRouter.post('/upload-excel', (req: Request, res: Response) => {
  try {
    const { name, fileName, records, columns, createdBy } = req.body;
    const datasets = storage.read<DatasetItem>('datasets', DEFAULT_DATASETS);

    const parsedRecords = Array.isArray(records) ? records : [];
    const parsedCols = Array.isArray(columns) && columns.length > 0
      ? columns
      : parsedRecords.length > 0 ? Object.keys(parsedRecords[0]) : [];

    const newDataset: DatasetItem = {
      id: `ds-excel-${Date.now()}`,
      name: name || fileName || 'Imported Excel Dataset',
      description: `Imported from Excel file "${fileName || 'spreadsheet.xlsx'}"`,
      sourceType: 'excel',
      fileName: fileName || 'spreadsheet.xlsx',
      columns: parsedCols,
      records: parsedRecords,
      recordCount: parsedRecords.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: createdBy || 'User',
    };

    storage.write('datasets', [newDataset, ...datasets]);
    audit.log('DATASET_IMPORT_EXCEL', `Imported ${parsedRecords.length} records from Excel: ${newDataset.name}`);

    res.status(201).json(newDataset);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/datasets/upload-csv
datasetsRouter.post('/upload-csv', (req: Request, res: Response) => {
  try {
    const { name, fileName, csvText, records, columns, createdBy } = req.body;
    const datasets = storage.read<DatasetItem>('datasets', DEFAULT_DATASETS);

    let parsedRecords: Record<string, any>[] = Array.isArray(records) ? records : [];
    let parsedCols: string[] = Array.isArray(columns) ? columns : [];

    if (!parsedRecords.length && typeof csvText === 'string') {
      const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length > 0) {
        parsedCols = lines[0].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
        parsedRecords = lines.slice(1).map((line) => {
          const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
          const row: Record<string, any> = {};
          parsedCols.forEach((col, i) => {
            row[col] = vals[i] ?? '';
          });
          return row;
        });
      }
    }

    const newDataset: DatasetItem = {
      id: `ds-csv-${Date.now()}`,
      name: name || fileName || 'Imported CSV Dataset',
      description: `Imported from CSV file "${fileName || 'data.csv'}"`,
      sourceType: 'csv',
      fileName: fileName || 'data.csv',
      columns: parsedCols,
      records: parsedRecords,
      recordCount: parsedRecords.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: createdBy || 'User',
    };

    storage.write('datasets', [newDataset, ...datasets]);
    audit.log('DATASET_IMPORT_CSV', `Imported ${parsedRecords.length} records from CSV: ${newDataset.name}`);

    res.status(201).json(newDataset);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/datasets/preview
datasetsRouter.post('/preview', (req: Request, res: Response) => {
  try {
    const { datasetId, limit = 10, offset = 0 } = req.body;
    const datasets = storage.read<DatasetItem>('datasets', DEFAULT_DATASETS);
    const ds = datasets.find((d) => d.id === datasetId);
    if (!ds) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    const sliced = ds.records.slice(offset, offset + limit);
    res.json({
      datasetId: ds.id,
      name: ds.name,
      totalRecords: ds.recordCount,
      columns: ds.columns,
      preview: sliced,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/datasets/test-connection
 * Validates file exists, permissions, valid workbook, and returns sheet metadata
 */
datasetsRouter.post('/test-connection', (req: Request, res: Response) => {
  try {
    const { filePath, sheetName, base64Content, fileName } = req.body;

    let targetPath = filePath;

    // If uploaded as base64 in web browser mode, persist into data/linked_uploads/
    if (base64Content) {
      const uploadDir = path.resolve(process.cwd(), 'barcode-automation-backend/data/linked_uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const safeName = (fileName || path.basename(filePath || `excel_${Date.now()}.xlsx`)).replace(/[^a-zA-Z0-9._-]/g, '_');
      targetPath = path.join(uploadDir, safeName);
      const buffer = Buffer.from(base64Content.replace(/^data:.*,/, ''), 'base64');
      fs.writeFileSync(targetPath, buffer);
    }

    if (!targetPath || !String(targetPath).trim()) {
      return res.json({ success: false, errorCode: 'INVALID_PATH', error: 'No file path specified.' });
    }

    const normalizedPath = path.normalize(path.resolve(String(targetPath).trim()));

    if (!fs.existsSync(normalizedPath)) {
      return res.json({
        success: false,
        errorCode: 'FILE_NOT_FOUND',
        error: `File not found on disk: "${normalizedPath}".`,
        pathChecked: normalizedPath
      });
    }

    const ext = path.extname(normalizedPath).toLowerCase();
    if (!['.xlsx', '.xls', '.xlsm', '.csv'].includes(ext)) {
      return res.json({
        success: false,
        errorCode: 'UNSUPPORTED_FORMAT',
        error: `Unsupported file extension "${ext}". BarcodeFlow supports .xlsx, .xls, .xlsm, and .csv.`,
        pathChecked: normalizedPath
      });
    }

    // Check file lock / accessibility
    try {
      const fd = fs.openSync(normalizedPath, 'r');
      fs.closeSync(fd);
    } catch (err: any) {
      if (err.code === 'EBUSY' || err.code === 'EACCES') {
        return res.json({
          success: false,
          errorCode: 'FILE_LOCKED',
          error: 'File is currently locked or in use by Microsoft Excel. Please save and close Excel or allow shared reading.',
          pathChecked: normalizedPath
        });
      }
      return res.json({
        success: false,
        errorCode: 'PERMISSION_DENIED',
        error: `File access error: ${err.message}`,
        pathChecked: normalizedPath
      });
    }

    const stat = fs.statSync(normalizedPath);
    const buffer = fs.readFileSync(normalizedPath);
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true, cellNF: true, cellText: true });

    const sheetNames = wb.SheetNames || [];
    if (sheetNames.length === 0) {
      return res.json({
        success: false,
        errorCode: 'INVALID_WORKBOOK',
        error: 'Excel workbook contains no readable sheets.',
        pathChecked: normalizedPath
      });
    }

    const activeSheetName = (sheetName && sheetNames.includes(sheetName)) ? sheetName : sheetNames[0];
    const sheet = wb.Sheets[activeSheetName];
    if (!sheet) {
      return res.json({
        success: false,
        errorCode: 'SHEET_MISSING',
        error: `Selected sheet "${sheetName}" not found in workbook.`,
        pathChecked: normalizedPath,
        sheets: sheetNames
      });
    }

    const rawMatrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
    const recordCount = Math.max(0, rawMatrix.length - 1);

    res.json({
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
    });
  } catch (err: any) {
    res.json({
      success: false,
      errorCode: 'PARSE_ERROR',
      error: err.message || 'Failed to parse Excel workbook.',
      pathChecked: req.body?.filePath
    });
  }
});

/**
 * POST /api/datasets/inspect-excel
 * Inspects an Excel workbook on disk or uploaded payload without saving full dataset
 */
datasetsRouter.post('/inspect-excel', (req: Request, res: Response) => {
  try {
    const { filePath, sheetName, headerRow = 1, base64Content, fileName } = req.body;

    let targetPath = filePath;

    // If uploaded as base64 in web browser mode, persist into data/linked_uploads/
    if (!targetPath && base64Content) {
      const uploadDir = path.resolve(process.cwd(), 'barcode-automation-backend/data/linked_uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const safeName = (fileName || `excel_${Date.now()}.xlsx`).replace(/[^a-zA-Z0-9._-]/g, '_');
      targetPath = path.join(uploadDir, safeName);
      const buffer = Buffer.from(base64Content.replace(/^data:.*,/, ''), 'base64');
      fs.writeFileSync(targetPath, buffer);
    }

    if (!targetPath) {
      return res.status(400).json({ error: 'Either filePath or base64Content must be provided.' });
    }

    const inspection = readExcelFromFile(targetPath, sheetName, headerRow);

    res.json({
      success: true,
      filePath: targetPath,
      fileName: path.basename(targetPath),
      sheetNames: inspection.sheetNames,
      selectedSheet: inspection.selectedSheet,
      headerRow,
      columns: inspection.columns,
      previewRows: inspection.previewRows,
      totalRecords: inspection.totalRecords,
      lastModified: inspection.lastModified,
      sizeBytes: inspection.sizeBytes,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/datasets/link-excel
 * Permanently connects an Excel file to the system with file path, sheet, and header configuration
 */
datasetsRouter.post('/link-excel', (req: Request, res: Response) => {
  try {
    const {
      name,
      filePath,
      fileName,
      sheetName,
      headerRow = 1,
      columns,
      mapping,
      autoRefresh = true,
      createdBy = 'Admin User',
      base64Content,
    } = req.body;

    let targetPath = filePath;
    if ((!targetPath || !fs.existsSync(targetPath)) && base64Content) {
      const uploadDir = path.resolve(process.cwd(), 'barcode-automation-backend/data/linked_uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const safeName = (fileName || path.basename(filePath || `excel_${Date.now()}.xlsx`)).replace(/[^a-zA-Z0-9._-]/g, '_');
      targetPath = path.join(uploadDir, safeName);
      const buffer = Buffer.from(base64Content.replace(/^data:.*,/, ''), 'base64');
      fs.writeFileSync(targetPath, buffer);
    }

    if (!targetPath || !fs.existsSync(targetPath)) {
      return res.status(400).json({ error: `Excel file does not exist at "${targetPath || filePath}".` });
    }

    const inspection = readExcelFromFile(targetPath, sheetName, headerRow);
    const datasets = storage.read<DatasetItem>('datasets', DEFAULT_DATASETS);

    const dsId = `ds-link-${Date.now()}`;
    const newDataset: DatasetItem = {
      id: dsId,
      name: name || inspection.selectedSheet || path.basename(targetPath, path.extname(targetPath)),
      description: `Permanently linked Excel workbook: ${path.basename(targetPath)} [${inspection.selectedSheet}]`,
      sourceType: 'excel',
      mode: (req.body.mode === 'imported' ? 'import' : 'link'),
      filePath: targetPath,
      fileName: fileName || path.basename(targetPath),
      sheetName: inspection.selectedSheet,
      availableSheets: inspection.sheetNames,
      headerRow,
      status: 'CONNECTED',
      statusMessage: 'Connected and synchronized with disk file.',
      columns: inspection.columns,
      records: inspection.records,
      recordCount: inspection.totalRecords,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastModified: inspection.lastModified,
      lastRefreshed: new Date().toISOString(),
      createdBy,
      autoRefresh,
      mapping: mapping || {},
    };

    // Register with backend watcher
    excelWatcherService.registerWatch(dsId, newDataset.name, filePath);

    storage.write('datasets', [newDataset, ...datasets]);
    audit.log('DATASET_LINK_EXCEL', `Permanently linked Excel workbook "${newDataset.name}" (${inspection.totalRecords} records).`, createdBy);

    res.status(201).json({
      success: true,
      dataset: newDataset,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/datasets/:id/refresh
 * Re-reads the linked Excel file from disk, detects schema drift, and updates records
 */
datasetsRouter.post('/:id/refresh', (req: Request, res: Response) => {
  try {
    const datasets = storage.read<DatasetItem>('datasets', DEFAULT_DATASETS);
    const idx = datasets.findIndex((d) => d.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    const ds = datasets[idx];
    if (ds.mode !== 'link' && ds.mode !== 'linked' && !ds.filePath) {
      return res.status(400).json({ error: 'Dataset is not in linked file mode.' });
    }

    const filePath = ds.filePath!;
    if (!fs.existsSync(filePath)) {
      ds.status = 'FILE_MISSING';
      ds.statusMessage = `File "${filePath}" is missing or moved.`;
      storage.write('datasets', datasets);
      audit.log('DATASET_FILE_MISSING', `Linked file missing on refresh: ${filePath}`);
      return res.status(404).json({ success: false, status: 'FILE_MISSING', error: ds.statusMessage });
    }

    const inspection = readExcelFromFile(filePath, ds.sheetName, ds.headerRow || 1);

    // Check for column drift (columns missing or added)
    const oldCols = new Set(ds.columns || []);
    const newCols = new Set(inspection.columns);
    const missingCols = Array.from(oldCols).filter((c) => !newCols.has(c));
    const addedCols = Array.from(newCols).filter((c) => !oldCols.has(c));

    ds.records = inspection.records;
    ds.recordCount = inspection.totalRecords;
    ds.columns = inspection.columns;
    ds.availableSheets = inspection.sheetNames;
    ds.lastModified = inspection.lastModified;
    ds.lastRefreshed = new Date().toISOString();
    ds.updatedAt = new Date().toISOString();
    ds.status = 'CONNECTED';
    ds.statusMessage = missingCols.length > 0
      ? `Warning: Mapped column(s) [${missingCols.join(', ')}] missing from updated sheet.`
      : 'Synchronized with disk file.';

    datasets[idx] = ds;
    storage.write('datasets', datasets);

    audit.log(
      'DATASET_REFRESH',
      `Refreshed linked Excel "${ds.name}". Records: ${ds.recordCount}. Missing fields: ${missingCols.length}, New fields: ${addedCols.length}`
    );

    res.json({
      success: true,
      dataset: ds,
      missingColumns: missingCols,
      addedColumns: addedCols,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/datasets/:id/relink
 * Relinks a moved or renamed file while preserving existing variable mappings
 */
datasetsRouter.post('/:id/relink', (req: Request, res: Response) => {
  try {
    const { newFilePath, newSheetName } = req.body;
    if (!newFilePath || !fs.existsSync(newFilePath)) {
      return res.status(400).json({ error: `File "${newFilePath}" does not exist.` });
    }

    const datasets = storage.read<DatasetItem>('datasets', DEFAULT_DATASETS);
    const idx = datasets.findIndex((d) => d.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    const ds = datasets[idx];
    const inspection = readExcelFromFile(newFilePath, newSheetName || ds.sheetName, ds.headerRow || 1);

    ds.filePath = newFilePath;
    ds.fileName = path.basename(newFilePath);
    ds.sheetName = inspection.selectedSheet;
    ds.availableSheets = inspection.sheetNames;
    ds.columns = inspection.columns;
    ds.records = inspection.records;
    ds.recordCount = inspection.totalRecords;
    ds.lastModified = inspection.lastModified;
    ds.lastRefreshed = new Date().toISOString();
    ds.updatedAt = new Date().toISOString();
    ds.status = 'CONNECTED';
    ds.statusMessage = 'Relinked successfully to new file location.';

    datasets[idx] = ds;
    storage.write('datasets', datasets);

    // Re-register watch
    excelWatcherService.registerWatch(ds.id, ds.name, newFilePath);
    audit.log('DATASET_RELINK', `Relinked dataset "${ds.name}" to "${newFilePath}".`);

    res.json({ success: true, dataset: ds });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/datasets/:id/status
 * Real-time connection and file health check
 */
datasetsRouter.get('/:id/status', (req: Request, res: Response) => {
  try {
    const datasets = storage.read<DatasetItem>('datasets', DEFAULT_DATASETS);
    const ds = datasets.find((d) => d.id === req.params.id);
    if (!ds) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    if (ds.mode !== 'link' || !ds.filePath) {
      return res.json({
        id: ds.id,
        mode: 'import',
        status: 'CONNECTED',
        recordCount: ds.recordCount,
      });
    }

    const fileCheck = excelWatcherService.checkFileStatus(ds.filePath);
    res.json({
      id: ds.id,
      mode: 'link',
      status: fileCheck.status,
      error: fileCheck.error,
      filePath: ds.filePath,
      fileName: ds.fileName,
      sheetName: ds.sheetName,
      recordCount: ds.recordCount,
      lastModified: fileCheck.mtimeMs ? new Date(fileCheck.mtimeMs).toISOString() : ds.lastModified,
      lastRefreshed: ds.lastRefreshed,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

