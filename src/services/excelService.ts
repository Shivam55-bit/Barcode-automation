import * as XLSX from 'xlsx';
import { ExcelColumnDefinition } from '../types';

export interface ParsedWorkbookMetadata {
  fileName: string;
  sheetNames: string[];
  totalSheets: number;
}

export interface SheetParseResult {
  sheetName: string;
  headerRow: number;
  columns: ExcelColumnDefinition[];
  records: Record<string, any>[];
  totalRecords: number;
  previewRows: Record<string, any>[];
}

/**
 * Parses raw ArrayBuffer or Uint8Array of Excel workbook into workbook object and sheet list
 */
export function readWorkbook(data: ArrayBuffer | Uint8Array): XLSX.WorkBook {
  return XLSX.read(new Uint8Array(data), {
    type: 'array',
    cellDates: true,
    cellNF: true,
    cellText: true,
  });
}

/**
 * Gets sheet names from an ArrayBuffer
 */
export function getWorkbookSheetNames(data: ArrayBuffer | Uint8Array): string[] {
  const wb = readWorkbook(data);
  return wb.SheetNames || [];
}

/**
 * Infers data type from array of sample string or primitive values
 */
export function inferColumnType(values: any[]): 'text' | 'number' | 'date' | 'boolean' {
  const nonEmpties = values.filter((v) => v !== undefined && v !== null && String(v).trim() !== '');
  if (nonEmpties.length === 0) return 'text';

  let dateCount = 0;
  let numCount = 0;
  let boolCount = 0;

  for (const v of nonEmpties) {
    if (typeof v === 'boolean' || ['true', 'false', 'yes', 'no'].includes(String(v).toLowerCase())) {
      boolCount++;
      continue;
    }
    if (v instanceof Date && !isNaN(v.getTime())) {
      dateCount++;
      continue;
    }
    const str = String(v).trim();
    // Check if looks like a date: e.g. YYYY-MM-DD, DD/MM/YYYY, etc.
    if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(str) || /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(str)) {
      const parsed = Date.parse(str);
      if (!isNaN(parsed)) {
        dateCount++;
        continue;
      }
    }
    // Check if numeric (BUT preserve leading zeros as text! E.g. "00123" is text!)
    if (str.length > 1 && str.startsWith('0') && !str.startsWith('0.')) {
      // Must be text to preserve leading zero SKU/Barcode!
      return 'text';
    }
    if (!isNaN(Number(str)) && !isNaN(parseFloat(str))) {
      numCount++;
    }
  }

  const threshold = nonEmpties.length * 0.7;
  if (dateCount >= threshold) return 'date';
  if (numCount >= threshold) return 'number';
  if (boolCount >= threshold) return 'boolean';
  return 'text';
}

/**
 * Formats a Date object or date-like string into custom format mask
 */
export function formatExcelDate(value: any, format: string = 'YYYY-MM-DD'): string {
  if (!value) return '';
  let date: Date | null = null;

  if (value instanceof Date && !isNaN(value.getTime())) {
    date = value;
  } else if (typeof value === 'number') {
    // Excel serial date to JS Date
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    date = new Date(excelEpoch.getTime() + value * 86400000);
  } else if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!isNaN(parsed)) {
      date = new Date(parsed);
    }
  }

  if (!date || isNaN(date.getTime())) {
    return String(value);
  }

  const yyyy = date.getFullYear().toString();
  const yy = yyyy.slice(-2);
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const dd = date.getDate().toString().padStart(2, '0');
  const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mmm = monthNamesShort[date.getMonth()];

  let out = format;
  out = out.replace(/YYYY/g, yyyy);
  out = out.replace(/YY/g, yy);
  out = out.replace(/MMM/g, mmm);
  out = out.replace(/MM/g, mm);
  out = out.replace(/DD/g, dd);
  return out;
}

/**
 * Reads and parses an Excel sheet with leading-zero preservation and header offset
 */
export function parseSheet(
  workbook: XLSX.WorkBook,
  sheetName: string,
  headerRow: number = 1,
  columnOverrides?: Record<string, Partial<ExcelColumnDefinition>>
): SheetParseResult {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" was not found in workbook.`);
  }

  // Convert to 2D array of raw values to accurately pinpoint header row
  const rawMatrix: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false, // Ensures string formatted representation is captured (preserves leading zeros!)
  });

  if (!rawMatrix || rawMatrix.length === 0) {
    return {
      sheetName,
      headerRow,
      columns: [],
      records: [],
      totalRecords: 0,
      previewRows: [],
    };
  }

  const headerIdx = Math.max(0, headerRow - 1);
  const headerLine = (rawMatrix[headerIdx] || []).map((h, i) => (h !== undefined && h !== null && String(h).trim() !== '' ? String(h).trim() : `Column_${i + 1}`));
  const dataLines = rawMatrix.slice(headerIdx + 1);

  // Filter out completely empty trailing rows
  const activeDataLines = dataLines.filter((row) => row.some((cell) => cell !== undefined && cell !== null && String(cell).trim() !== ''));

  // Build records
  const records: Record<string, any>[] = activeDataLines.map((row) => {
    const item: Record<string, any> = {};
    headerLine.forEach((colName, colIdx) => {
      let cellVal = row[colIdx];
      if (cellVal === undefined || cellVal === null) cellVal = '';

      // Format date if detected or specified
      if (columnOverrides?.[colName]?.dataType === 'date' || cellVal instanceof Date) {
        item[colName] = formatExcelDate(cellVal, columnOverrides?.[colName]?.format || 'YYYY-MM-DD');
      } else {
        // String conversion preserving exact characters (including leading zeroes)
        item[colName] = String(cellVal).trim();
      }
    });
    return item;
  });

  // Infer or construct column definitions
  const columns: ExcelColumnDefinition[] = headerLine.map((colName) => {
    const sampleValues = records.slice(0, 50).map((r) => r[colName]);
    const inferredType = inferColumnType(sampleValues);
    const override = columnOverrides?.[colName];

    return {
      name: colName,
      originalName: colName,
      dataType: override?.dataType || inferredType,
      format: override?.format || (inferredType === 'date' ? 'YYYY-MM-DD' : undefined),
      allowEmpty: override?.allowEmpty !== undefined ? override.allowEmpty : true,
      defaultValue: override?.defaultValue || '',
    };
  });

  return {
    sheetName,
    headerRow,
    columns,
    records,
    totalRecords: records.length,
    previewRows: records.slice(0, 20),
  };
}

/**
 * Creates a sample workbook buffer for test verification
 */
export function createSampleProductsWorkbook(): Uint8Array {
  const wb = XLSX.utils.book_new();

  const productsData = [
    ['ProductName', 'Barcode', 'Batch', 'MRP', 'Qty', 'MFGDate', 'EXPDate'],
    ['Soap A', '890000000001', 'B001', '50', '2', '2026-01-15', '2028-01-14'],
    ['Soap B', '890000000002', 'B002', '60', '3', '2026-02-10', '2028-02-09'],
    ['Soap C', '890000000003', 'B003', '70', '1', '2026-03-01', '2028-02-28'],
    ['Shampoo X', '008500065312', 'B004', '140', '4', '2026-04-12', '2028-04-11'],
  ];

  const stockData = [
    ['Warehouse', 'SKU', 'AvailablePallets', 'Location'],
    ['Main Distribution', '890000000001', '45', 'Aisle-4-B1'],
    ['Central Hub', '890000000002', '12', 'Aisle-2-C3'],
  ];

  const wsProducts = XLSX.utils.aoa_to_sheet(productsData);
  const wsStock = XLSX.utils.aoa_to_sheet(stockData);

  XLSX.utils.book_append_sheet(wb, wsProducts, 'Products');
  XLSX.utils.book_append_sheet(wb, wsStock, 'Stock');

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(buf);
}

/**
 * High-level Excel Service Engine exported object
 */
export const excelService = {
  readWorkbook,
  getWorkbookSheetNames,
  parseSheet,
  createSampleProductsWorkbookRaw: createSampleProductsWorkbook,

  async inspectExcelFile(file: File, selectedSheet?: string, headerRow: number = 1) {
    const buffer = await file.arrayBuffer();
    const wb = readWorkbook(buffer);
    const sheets = wb.SheetNames || [];
    const activeSheet = selectedSheet && sheets.includes(selectedSheet) ? selectedSheet : sheets[0];
    return {
      sheets,
      defaultSheet: activeSheet,
    };
  },

  async parseSheetData(file: File, sheetName: string, headerRow: number = 1) {
    const buffer = await file.arrayBuffer();
    const wb = readWorkbook(buffer);
    const parsed = parseSheet(wb, sheetName, headerRow);
    return {
      columns: parsed.columns.map((c) => ({
        ...c,
        type: (c.dataType === 'text' ? 'string' : c.dataType) as any,
      })),
      previewRows: parsed.previewRows,
      allRows: parsed.records,
    };
  },

  createSampleProductsWorkbook() {
    const sampleBytes = createSampleProductsWorkbook();
    const wb = readWorkbook(sampleBytes);
    const parsed = parseSheet(wb, 'Products', 1);
    return {
      sheets: wb.SheetNames,
      defaultSheet: 'Products',
      columns: parsed.columns.map((c) => ({
        ...c,
        type: (c.dataType === 'text' ? 'string' : c.dataType) as any,
      })),
      previewRows: parsed.previewRows,
      records: parsed.records,
    };
  },
};

