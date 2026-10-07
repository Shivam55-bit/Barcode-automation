/**
 * BarcodeFlow Enterprise VBScript & Event Scripting Engine
 * Full BarTender-compatible VBScript emulation, parsing, and execution.
 */

import { EvaluationContext } from '../types';

export interface VBScriptScope {
  value?: any;
  input?: any;
  record?: Record<string, any>;
  field?: Record<string, any>;
  namedSubStrings?: Record<string, any>;
  system?: Record<string, any>;
  libraries?: Array<{ name: string; code: string; language?: string }>;
  printJob?: Record<string, any>;
  format?: Record<string, any>;
  logs?: string[];
  [key: string]: any;
}

export interface ScriptExecutionResult {
  success: boolean;
  value: string;
  result?: string;
  record?: Record<string, any>;
  logs: string[];
  error?: string;
  errorLocation?: { line?: number; column?: number };
  executionTimeMs: number;
}


/**
 * Creates a case-insensitive, callable proxy for record columns.
 * Supports:
 * - Record("ProductID") (function call)
 * - Record.ProductID or Record.productid (property getter)
 * - Record("ProductID") = 123 or Record.ProductID = 123 (property setter)
 */
export function createRecordProxy(recordData: Record<string, any> = {}): any {
  const targetObj = { ...recordData };
  const keys = Object.keys(targetObj);

  const accessor = function (key: string | number) {
    if (key === undefined || key === null || key === '') {
      throw new Error("Field name cannot be empty in Record()");
    }
    if (typeof key === 'number') {
      if (key < 0 || key >= keys.length) {
        throw new Error(`Column index ${key} out of range in Record() (total fields: ${keys.length})`);
      }
      const actualKey = keys[key];
      const val = targetObj[actualKey];
      return val !== undefined && val !== null ? val : '';
    }

    const keyStr = String(key);
    const searchKey = keyStr.toLowerCase();
    const foundKey = keys.find((k) => k.toLowerCase() === searchKey);

    if (foundKey === undefined && !(keyStr in targetObj)) {
      throw new Error(`Field '${keyStr}' not found. Unknown database field "${keyStr}". Available fields: [${keys.join(', ')}]`);
    }

    const val = foundKey !== undefined ? targetObj[foundKey] : targetObj[keyStr];
    return val !== undefined && val !== null ? val : '';
  };

  (accessor as any).Field = accessor;
  (accessor as any).field = accessor;
  (accessor as any).Record = accessor;
  (accessor as any).record = accessor;

  return new Proxy(accessor, {
    get(target, prop: string | symbol) {
      if (typeof prop === 'symbol') return (target as any)[prop];
      if (prop === 'raw' || prop === '__target') return targetObj;
      if (prop === 'toJSON') return () => targetObj;
      if (prop === 'Field' || prop === 'field' || prop === 'Record' || prop === 'record') return target;
      if (prop in target) return (target as any)[prop];

      const propStr = String(prop);
      const searchKey = propStr.toLowerCase();
      const foundKey = keys.find((k) => k.toLowerCase() === searchKey);

      if (foundKey === undefined && !(propStr in targetObj)) {
        throw new Error(`Field '${propStr}' not found. Unknown database field "${propStr}". Available fields: [${keys.join(', ')}]`);
      }

      const val = foundKey !== undefined ? targetObj[foundKey] : targetObj[propStr];
      return val !== undefined && val !== null ? val : '';
    },
    set(target, prop: string | symbol, val) {
      if (typeof prop === 'symbol') {
        (target as any)[prop] = val;
        return true;
      }
      const propStr = String(prop);
      const searchKey = propStr.toLowerCase();
      const foundKey = keys.find((k) => k.toLowerCase() === searchKey);
      targetObj[foundKey || propStr] = val;
      return true;
    },
    apply(target, _thisArg, argArray) {
      return target(argArray[0]);
    },
  });
}

/**
 * Creates a case-insensitive accessor for Named SubStrings / Global Variables.
 */
export function createNamedSubStringsProxy(namedData: Record<string, any> = {}): any {
  const targetObj = { ...namedData };

  const accessor = function (key: string) {
    if (!key) return { Value: '' };
    const searchKey = String(key).toLowerCase();
    const foundKey = Object.keys(targetObj).find((k) => k.toLowerCase() === searchKey);
    const val = (foundKey !== undefined ? targetObj[foundKey] : targetObj[key]) ?? '';
    return {
      Value: val,
      toString: () => String(val),
      valueOf: () => val,
    };
  };

  return new Proxy(accessor, {
    get(target, prop: string | symbol) {
      if (typeof prop === 'symbol') return (target as any)[prop];
      if (prop === 'raw' || prop === '__target') return targetObj;
      if (prop in target) return (target as any)[prop];

      const searchKey = String(prop).toLowerCase();
      const foundKey = Object.keys(targetObj).find((k) => k.toLowerCase() === searchKey);
      const val = (foundKey !== undefined ? targetObj[foundKey] : targetObj[prop]) ?? '';
      return {
        Value: val,
        toString: () => String(val),
        valueOf: () => val,
      };
    },
    apply(target, thisArg, argArray) {
      return target(argArray[0]);
    },
  });
}

/**
 * Implements VBScript / VBA Format(expression, [format]) function.
 * Supports date masks (YYYYMMDD, YYYY-MM-DD, DD/MM/YYYY, etc.) and number formatting (00000, 0.00, #,##0.00, Currency, Percent).
 */
export function vbFormat(expression: any, fmt?: string): string {
  if (expression === undefined || expression === null) return '';

  const d = parseVBDate(expression);
  if (d) {
    if (!fmt) return formatVBDate(d);
    const lowerFmt = fmt.toLowerCase().trim();
    if (lowerFmt === 'general date') return formatVBDateTime(d);
    if (lowerFmt === 'long date') {
      const monthNamesLong = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return `${monthNamesLong[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    }
    if (lowerFmt === 'short date') return formatVBDate(d);
    if (lowerFmt === 'long time') return formatVBTime(d);
    if (lowerFmt === 'short time') {
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    const yyyy = d.getFullYear().toString();
    const yy = yyyy.slice(-2);
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const dd = d.getDate().toString().padStart(2, '0');
    const hh = d.getHours().toString().padStart(2, '0');
    const min = d.getMinutes().toString().padStart(2, '0');
    const ss = d.getSeconds().toString().padStart(2, '0');
    const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthNamesLong = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const mmm = monthNamesShort[d.getMonth()];
    const mmmm = monthNamesLong[d.getMonth()];

    let out = fmt;
    out = out.replace(/yyyy/gi, yyyy);
    out = out.replace(/\byy\b/gi, yy);
    out = out.replace(/mmmm/gi, mmmm);
    out = out.replace(/mmm/gi, mmm);
    out = out.replace(/mm/gi, mm);
    out = out.replace(/dd/gi, dd);
    out = out.replace(/hh/gi, hh);
    out = out.replace(/nn/gi, min); // VBScript uses 'nn' for minutes
    out = out.replace(/ss/gi, ss);
    return out;
  }

  if (typeof expression === 'number' || (!isNaN(Number(expression)) && fmt)) {
    const num = Number(expression);
    if (fmt) {
      const lowerFmt = fmt.toLowerCase().trim();
      if (lowerFmt === 'currency') {
        return '$' + num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      if (lowerFmt === 'percent') {
        return (num * 100).toFixed(2) + '%';
      }
      if (lowerFmt === 'standard') {
        return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      if (/^0+$/.test(fmt)) {
        return String(Math.round(num)).padStart(fmt.length, '0');
      }
      if (fmt.includes('.')) {
        const decimals = fmt.split('.')[1]?.length || 2;
        return num.toFixed(decimals);
      }
    }
  }

  if (fmt === '>') return String(expression).toUpperCase();
  if (fmt === '<') return String(expression).toLowerCase();

  return String(expression);
}

/**
 * Creates a hybrid callable/object proxy for BarTender's Format symbol.
 * - Format(Now, "YYYYMMDD") -> formats expression as function
 * - Format.NamedSubStrings("Lot").Value -> accesses named substring
 * - Format.Objects("Barcode1").Value -> accesses template object
 * - Format.PrinterName, Format.RecordNumber, etc. -> accesses print context
 */
export function createFormatProxy(
  namedProxy: any,
  objectsProxy: any,
  formatProps: Record<string, any> = {}
): any {
  const formatFn = function (expression: any, fmt?: string): string {
    return vbFormat(expression, fmt);
  };

  const effectiveNamed = formatProps.NamedSubStrings || formatProps.namedSubStrings || namedProxy;
  const effectiveObjects = formatProps.Objects || formatProps.objects || objectsProxy;

  Object.assign(formatFn, formatProps);
  (formatFn as any).NamedSubStrings = effectiveNamed;
  (formatFn as any).namedSubStrings = effectiveNamed;
  (formatFn as any).Objects = effectiveObjects;
  (formatFn as any).objects = effectiveObjects;
  (formatFn as any).PrinterName = formatProps.PrinterName || formatProps.printerName || 'Default Printer';
  (formatFn as any).printerName = (formatFn as any).PrinterName;
  (formatFn as any).JobId = formatProps.JobId || formatProps.jobId || 'JOB-001';
  (formatFn as any).jobId = (formatFn as any).JobId;
  (formatFn as any).RecordNumber = formatProps.RecordNumber || formatProps.recordNumber || 1;
  (formatFn as any).recordNumber = (formatFn as any).RecordNumber;
  (formatFn as any).TotalRecords = formatProps.TotalRecords || formatProps.totalRecords || 1;
  (formatFn as any).totalRecords = (formatFn as any).TotalRecords;
  (formatFn as any).PageNumber = formatProps.PageNumber || formatProps.pageNumber || 1;
  (formatFn as any).pageNumber = (formatFn as any).PageNumber;
  (formatFn as any).CopyNumber = formatProps.CopyNumber || formatProps.copyNumber || 1;
  (formatFn as any).copyNumber = (formatFn as any).CopyNumber;

  return new Proxy(formatFn, {
    get(target: any, prop: string | symbol) {
      if (typeof prop === 'string') {
        const lower = prop.toLowerCase();
        for (const k of Object.keys(target)) {
          if (k.toLowerCase() === lower) {
            return target[k];
          }
        }
        if (formatProps && typeof formatProps === 'object') {
          for (const k of Object.keys(formatProps)) {
            if (k.toLowerCase() === lower) {
              return formatProps[k];
            }
          }
        }
      }
      return target[prop];
    },
    apply(target: any, _thisArg: any, argArray: any[]) {
      return target(...argArray);
    },
  });
}


/**
 * Formats a Date object as DD/MM/YYYY (standard localized date representation).
 */
export function formatVBDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Formats a Date object as DD/MM/YYYY HH:mm:ss.
 */
export function formatVBDateTime(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
}

/**
 * Formats a Date object as HH:mm:ss.
 */
export function formatVBTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${min}:${ss}`;
}

/**
 * Safely parses any date representation (DD/MM/YYYY, ISO, Excel serial number, timestamp, Date object)
 * into a valid JavaScript Date without misinterpreting DD/MM/YYYY as MM/DD/YYYY.
 */
export function parseVBDate(val: any): Date | null {
  if (val === undefined || val === null || val === '') return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : new Date(val.getTime());
  }

  if (typeof val === 'number') {
    if (isNaN(val)) return null;
    // Excel serial number range (e.g. 25569 = 1970-01-01, ~46000 = 2026)
    if (val >= 1 && val < 100000) {
      const ms = Math.round((val - 25569) * 86400 * 1000);
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }
    // Unix timestamp in ms
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  const str = String(val).trim();
  if (!str) return null;

  // 1. DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (with optional time HH:mm[:ss])
  const dmyMatch = str.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const min = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const sec = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(year, month - 1, day, hour, min, sec);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // 2. ISO: YYYY-MM-DD or YYYY/MM/DD (with optional time)
  const ymdMatch = str.match(/^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    const hour = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
    const min = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;
    const sec = ymdMatch[6] ? parseInt(ymdMatch[6], 10) : 0;

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(year, month - 1, day, hour, min, sec);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // 3. DD/MM/YY (2-digit year)
  const dmy2Match = str.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (dmy2Match) {
    const day = parseInt(dmy2Match[1], 10);
    const month = parseInt(dmy2Match[2], 10);
    const yy = parseInt(dmy2Match[3], 10);
    const year = yy >= 70 ? 1900 + yy : 2000 + yy;
    const hour = dmy2Match[4] ? parseInt(dmy2Match[4], 10) : 0;
    const min = dmy2Match[5] ? parseInt(dmy2Match[5], 10) : 0;
    const sec = dmy2Match[6] ? parseInt(dmy2Match[6], 10) : 0;

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(year, month - 1, day, hour, min, sec);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // 4. Fallback to JS standard Date parsing
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}

/**
 * Performs VBScript-compliant DateAdd arithmetic returning a Date object.
 */
export function vbDateAddObj(interval: string, number: any, dateVal: any): Date {
  if (number === undefined || number === null || String(number).trim() === '') {
    number = 0;
  }
  const n = Number(String(number).trim());
  if (isNaN(n)) {
    throw new Error(`Invalid numeric interval for DateAdd: '${number}'`);
  }

  if (dateVal === undefined || dateVal === null || (typeof dateVal === 'string' && !dateVal.trim())) {
    throw new Error(`Invalid date value for DateAdd: '${dateVal}'`);
  }

  const baseDate = parseVBDate(dateVal);
  if (!baseDate || isNaN(baseDate.getTime())) {
    throw new Error(`Invalid date value for DateAdd: '${dateVal}'`);
  }

  const result = new Date(baseDate.getTime());
  const inv = String(interval || 'd').trim().toLowerCase();

  switch (inv) {
    case 'yyyy': {
      const origDay = result.getDate();
      const targetYear = result.getFullYear() + n;
      const targetMonth = result.getMonth();
      result.setDate(1);
      result.setFullYear(targetYear);
      result.setMonth(targetMonth);
      const maxDays = new Date(targetYear, targetMonth + 1, 0).getDate();
      result.setDate(Math.min(origDay, maxDays));
      break;
    }
    case 'q': {
      const origDay = result.getDate();
      const targetMonth = result.getMonth() + n * 3;
      result.setDate(1);
      result.setMonth(targetMonth);
      const maxDays = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
      result.setDate(Math.min(origDay, maxDays));
      break;
    }
    case 'm': {
      const origDay = result.getDate();
      const targetMonth = result.getMonth() + n;
      result.setDate(1);
      result.setMonth(targetMonth);
      const maxDays = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
      result.setDate(Math.min(origDay, maxDays));
      break;
    }
    case 'd':
    case 'y':
    case 'w': {
      result.setDate(result.getDate() + n);
      break;
    }
    case 'ww': {
      result.setDate(result.getDate() + n * 7);
      break;
    }
    case 'h': {
      result.setHours(result.getHours() + n);
      break;
    }
    case 'n': {
      result.setMinutes(result.getMinutes() + n);
      break;
    }
    case 's': {
      result.setSeconds(result.getSeconds() + n);
      break;
    }
    default:
      throw new Error(`Unsupported interval for DateAdd: '${interval}'`);
  }

  return result;
}

/**
 * Performs VBScript-compliant DateAdd arithmetic with proper month and leap year boundaries.
 */
export function vbDateAdd(interval: string, number: any, dateVal: any): string {
  const result = vbDateAddObj(interval, number, dateVal);
  const inv = String(interval || 'd').trim().toLowerCase();
  const hasTime =
    result.getHours() !== 0 ||
    result.getMinutes() !== 0 ||
    result.getSeconds() !== 0 ||
    ['h', 'n', 's'].includes(inv);

  return hasTime ? formatVBDateTime(result) : formatVBDate(result);
}

/**
 * Calculates the difference between two dates according to interval.
 */
export function vbDateDiff(interval: string, date1: any, date2: any): number {
  const d1 = parseVBDate(date1);
  const d2 = parseVBDate(date2);
  if (!d1 || !d2) {
    throw new Error(`Invalid date in DateDiff: date1='${date1}', date2='${date2}'`);
  }
  const diffMs = d2.getTime() - d1.getTime();
  const inv = String(interval || 'd').trim().toLowerCase();

  switch (inv) {
    case 's':
      return Math.floor(diffMs / 1000);
    case 'n':
      return Math.floor(diffMs / 60000);
    case 'h':
      return Math.floor(diffMs / 3600000);
    case 'd':
    case 'y':
    case 'w':
      return Math.floor(diffMs / 86400000);
    case 'ww':
      return Math.floor(diffMs / (86400000 * 7));
    case 'm':
      return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
    case 'q':
      return Math.floor(((d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth())) / 3);
    case 'yyyy':
      return d2.getFullYear() - d1.getFullYear();
    default:
      return Math.floor(diffMs / 86400000);
  }
}

/**
 * Formats a date value according to VBScript FormatDateTime standard format codes.
 */
export function vbFormatDateTime(dateVal: any, namedFormat: number = 0): string {
  const d = parseVBDate(dateVal);
  if (!d || isNaN(d.getTime())) {
    throw new Error(`Invalid date value for FormatDateTime: '${dateVal}'`);
  }

  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');

  switch (namedFormat) {
    case 1: // vbLongDate
      return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    case 2: // vbShortDate
      return `${dd}/${mm}/${yyyy}`;
    case 3: // vbLongTime
      return `${hh}:${min}:${ss}`;
    case 4: // vbShortTime
      return `${hh}:${min}`;
    case 0: // vbGeneralDate
    default: {
      const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0;
      return hasTime ? `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}` : `${dd}/${mm}/${yyyy}`;
    }
  }
}

/**
 * Creates a callable/primitive date getter representing VBScript's Date property.
 */
function createDateGetter(now: Date) {
  const fn: any = function (...args: any[]) {
    if (args.length > 0) {
      const dt = parseVBDate(args[0]);
      return dt ? formatVBDate(dt) : formatVBDate(now);
    }
    return formatVBDate(now);
  };
  fn.toString = () => formatVBDate(now);
  fn.valueOf = () => formatVBDate(now);
  fn[Symbol.toPrimitive] = () => formatVBDate(now);
  return fn;
}

/**
 * Creates a callable/primitive now getter representing VBScript's Now property.
 */
function createNowGetter(now: Date) {
  const fn: any = function () {
    return formatVBDateTime(now);
  };
  fn.toString = () => formatVBDateTime(now);
  fn.valueOf = () => formatVBDateTime(now);
  fn[Symbol.toPrimitive] = () => formatVBDateTime(now);
  return fn;
}

/**
 * Creates a callable/primitive time getter representing VBScript's Time property.
 */
function createTimeGetter(now: Date) {
  const fn: any = function () {
    return formatVBTime(now);
  };
  fn.toString = () => formatVBTime(now);
  fn.valueOf = () => formatVBTime(now);
  fn[Symbol.toPrimitive] = () => formatVBTime(now);
  return fn;
}

/**
 * Standard VBScript built-in library available in execution scope.
 */
export function getVBScriptBuiltins(logs: string[], now: Date = new Date()) {
  return {
    // String functions
    UCase: (s: any) => String(s ?? '').toUpperCase(),
    LCase: (s: any) => String(s ?? '').toLowerCase(),
    Len: (s: any) => String(s ?? '').length,
    Trim: (s: any) => String(s ?? '').trim(),
    LTrim: (s: any) => String(s ?? '').trimStart(),
    RTrim: (s: any) => String(s ?? '').trimEnd(),
    Left: (s: any, n: number) => String(s ?? '').substring(0, Math.max(0, n || 0)),
    Right: (s: any, n: number) => {
      const str = String(s ?? '');
      const count = Math.max(0, n || 0);
      return str.substring(Math.max(0, str.length - count));
    },
    Mid: (s: any, start: number, length?: number) => {
      const str = String(s ?? '');
      // VBScript Mid is 1-indexed
      const zeroStart = Math.max(0, (start || 1) - 1);
      if (length === undefined || length === null) {
        return str.substring(zeroStart);
      }
      return str.substring(zeroStart, zeroStart + Math.max(0, length));
    },
    InStr: (...args: any[]) => {
      // InStr([start,] string1, string2)
      let start = 1;
      let s1 = '';
      let s2 = '';
      if (args.length >= 3) {
        start = Number(args[0]) || 1;
        s1 = String(args[1] ?? '');
        s2 = String(args[2] ?? '');
      } else if (args.length === 2) {
        s1 = String(args[0] ?? '');
        s2 = String(args[1] ?? '');
      } else {
        return 0;
      }
      const idx = s1.indexOf(s2, Math.max(0, start - 1));
      return idx >= 0 ? idx + 1 : 0;
    },
    InStrRev: (s1: any, s2: any, start?: number) => {
      const str1 = String(s1 ?? '');
      const str2 = String(s2 ?? '');
      const pos = start !== undefined ? Math.max(0, start - 1) : str1.length;
      const idx = str1.lastIndexOf(str2, pos);
      return idx >= 0 ? idx + 1 : 0;
    },
    Replace: (expr: any, find: any, repl: any) => {
      const eStr = String(expr ?? '');
      const fStr = String(find ?? '');
      const rStr = String(repl ?? '');
      if (!fStr) return eStr;
      return eStr.split(fStr).join(rStr);
    },
    Space: (n: number) => ' '.repeat(Math.max(0, n || 0)),
    String: (n: number, char: any) => {
      const c = String(char ?? ' ')[0] || ' ';
      return c.repeat(Math.max(0, n || 0));
    },
    StrReverse: (s: any) => String(s ?? '').split('').reverse().join(''),
    Asc: (c: any) => (String(c ?? '').charCodeAt(0) || 0),
    Chr: (code: number) => String.fromCharCode(code || 0),

    // Conversion & Math
    CStr: (v: any) => (v !== undefined && v !== null ? String(v) : ''),
    CInt: (v: any) => Math.round(Number(v) || 0),
    CLng: (v: any) => Math.round(Number(v) || 0),
    CDbl: (v: any) => (Number(v) || 0),
    CSng: (v: any) => (Number(v) || 0),
    CBool: (v: any) => Boolean(v === true || v === 1 || String(v).toLowerCase() === 'true'),
    Fix: (v: any) => Math.trunc(Number(v) || 0),
    Int: (v: any) => Math.floor(Number(v) || 0),
    Abs: (v: any) => Math.abs(Number(v) || 0),
    Sgn: (v: any) => Math.sign(Number(v) || 0),
    Sqr: (v: any) => Math.sqrt(Math.max(0, Number(v) || 0)),
    Round: (v: any, decimals: number = 0) => {
      const num = Number(v) || 0;
      const factor = Math.pow(10, decimals || 0);
      return Math.round(num * factor) / factor;
    },
    Rnd: () => Math.random(),

    // Logic & Type checking
    IIf: (condition: any, truePart: any, falsePart: any) => (condition ? truePart : falsePart),
    IsNumeric: (v: any) => v !== '' && v !== null && v !== undefined && !isNaN(Number(v)),
    IsNull: (v: any) => v === null,
    IsEmpty: (v: any) => v === undefined || v === '',
    IsDate: (v: any) => parseVBDate(v) !== null,
    CDate: (v: any) => {
      const dt = parseVBDate(v);
      if (!dt) throw new Error(`Type mismatch: cannot convert '${v}' to Date`);
      return formatVBDate(dt);
    },

    // Date & Time (VBScript native semantics)
    Date: createDateGetter(now),
    Now: createNowGetter(now),
    Time: createTimeGetter(now),
    Year: (d: any) => {
      const dt = parseVBDate(d ?? new Date());
      if (!dt) throw new Error(`Invalid date for Year(): '${d}'`);
      return dt.getFullYear();
    },
    Month: (d: any) => {
      const dt = parseVBDate(d ?? new Date());
      if (!dt) throw new Error(`Invalid date for Month(): '${d}'`);
      return dt.getMonth() + 1;
    },
    Day: (d: any) => {
      const dt = parseVBDate(d ?? new Date());
      if (!dt) throw new Error(`Invalid date for Day(): '${d}'`);
      return dt.getDate();
    },
    Hour: (d: any) => {
      const dt = parseVBDate(d ?? new Date());
      if (!dt) throw new Error(`Invalid date for Hour(): '${d}'`);
      return dt.getHours();
    },
    Minute: (d: any) => {
      const dt = parseVBDate(d ?? new Date());
      if (!dt) throw new Error(`Invalid date for Minute(): '${d}'`);
      return dt.getMinutes();
    },
    Second: (d: any) => {
      const dt = parseVBDate(d ?? new Date());
      if (!dt) throw new Error(`Invalid date for Second(): '${d}'`);
      return dt.getSeconds();
    },
    Weekday: (d: any) => {
      const dt = parseVBDate(d ?? new Date());
      if (!dt) throw new Error(`Invalid date for Weekday(): '${d}'`);
      return dt.getDay() + 1; // 1 = Sunday
    },
    MonthName: (m: number, abbreviate: boolean = false) => {
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const name = monthNames[Math.max(0, Math.min(11, (m || 1) - 1))];
      return abbreviate ? name.substring(0, 3) : name;
    },
    WeekdayName: (w: number, abbreviate: boolean = false) => {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const name = dayNames[Math.max(0, Math.min(6, (w || 1) - 1))];
      return abbreviate ? name.substring(0, 3) : name;
    },
    DateAdd: (interval: string, number: any, dateVal: any) => vbDateAdd(interval, number, dateVal),
    DateDiff: (interval: string, date1: any, date2: any) => vbDateDiff(interval, date1, date2),
    DatePart: (interval: string, dateVal: any) => {
      const d = parseVBDate(dateVal);
      if (!d) throw new Error(`Invalid date in DatePart(): '${dateVal}'`);
      const inv = String(interval || 'd').toLowerCase().trim();
      switch (inv) {
        case 'yyyy': return d.getFullYear();
        case 'q': return Math.floor(d.getMonth() / 3) + 1;
        case 'm': return d.getMonth() + 1;
        case 'y':
        case 'd': return d.getDate();
        case 'w': return d.getDay() + 1;
        case 'ww': {
          const firstDay = new Date(d.getFullYear(), 0, 1);
          return Math.ceil((((d.getTime() - firstDay.getTime()) / 86400000) + firstDay.getDay() + 1) / 7);
        }
        case 'h': return d.getHours();
        case 'n': return d.getMinutes();
        case 's': return d.getSeconds();
        default: return d.getDate();
      }
    },
    Format: (expr: any, fmt?: string) => vbFormat(expr, fmt),
    FormatDateTime: (dateVal: any, namedFormat: number = 0) => vbFormatDateTime(dateVal, namedFormat),
    FormatNumber: (numVal: any, decimals: number = 2) => {
      const n = Number(numVal) || 0;
      return n.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    },
    FormatCurrency: (numVal: any, decimals: number = 2) => {
      const n = Number(numVal) || 0;
      return '$' + n.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    },
    FormatPercent: (numVal: any, decimals: number = 2) => {
      const n = (Number(numVal) || 0) * 100;
      return n.toFixed(decimals) + '%';
    },

    // Barcode Check Digit calculation functions (Section 32 & 33)
    Mod10CheckDigit: (data: any): string => {
      const s = String(data ?? '').replace(/\D/g, '');
      if (!s) return '0';
      let sum = 0;
      let multiplier = 3;
      for (let i = s.length - 1; i >= 0; i--) {
        sum += parseInt(s[i], 10) * multiplier;
        multiplier = multiplier === 3 ? 1 : 3;
      }
      return String((10 - (sum % 10)) % 10);
    },
    GS1CheckDigit: (data: any): string => {
      const s = String(data ?? '').replace(/\D/g, '');
      if (!s) return '0';
      let sum = 0;
      let multiplier = 3;
      for (let i = s.length - 1; i >= 0; i--) {
        sum += parseInt(s[i], 10) * multiplier;
        multiplier = multiplier === 3 ? 1 : 3;
      }
      return String((10 - (sum % 10)) % 10);
    },
    Mod43CheckDigit: (data: any): string => {
      const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%';
      const s = String(data ?? '').toUpperCase();
      let sum = 0;
      for (let i = 0; i < s.length; i++) {
        const idx = chars.indexOf(s[i]);
        if (idx >= 0) sum += idx;
      }
      return chars[sum % 43];
    },

    // BarcodeFlow Logging & Debugging
    MsgBox: (msg: any) => {
      logs.push(`[MsgBox] ${String(msg)}`);
      return 1; // vbOK
    },
    DebugPrint: (...args: any[]) => {
      logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
    },
    // Safe string concatenation helper
    __concat: (a: any, b: any) => String(a ?? '') + String(b ?? ''),
  };
}

/**
 * Transpiles VBScript syntax into executable JavaScript code.
 */
export function transpileVBScriptToJS(vbCode: string): string {
  if (!vbCode || !vbCode.trim()) return 'return Value;';

  const rawLines = vbCode.split(/\r?\n/);
  const processedLines: string[] = [];

  // 1. Join line continuations (lines ending with ' _')
  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i];
    while (line.trimEnd().endsWith('_') && i + 1 < rawLines.length) {
      line = line.trimEnd().slice(0, -1) + ' ' + rawLines[++i].trimStart();
    }
    processedLines.push(line);
  }

  const jsLines: string[] = ['var __loopGuard = 0;'];
  let isInsideMultiLineSelect = false;
  let currentFunction: string | null = null;

  for (let rawLine of processedLines) {
    let line = rawLine.trim();

    if (!line) continue;

    // Handle comments
    // Convert ' comment or REM comment to // comment
    if (line.startsWith("'") || /^rem\b/i.test(line)) {
      jsLines.push('// ' + line.replace(/^('|rem\s*)/i, ''));
      continue;
    }

    // Protect string literals from token replacement
    const stringLiterals: string[] = [];
    let lineNoStrings = '';
    let inString = false;
    let currentStr = '';

    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"') {
        if (inString && line[c + 1] === '"') {
          // Escaped quote in VBScript: "" -> "
          currentStr += '\\"';
          c++;
        } else if (inString) {
          inString = false;
          stringLiterals.push(currentStr);
          lineNoStrings += `__STR_${stringLiterals.length - 1}__`;
          currentStr = '';
        } else {
          inString = true;
          currentStr = '';
        }
      } else if (inString) {
        if (ch === '\\') currentStr += '\\\\';
        else currentStr += ch;
      } else if (ch === "'" && !inString) {
        // Inline comment starting with single quote outside string
        break;
      } else {
        lineNoStrings += ch;
      }
    }

    if (inString) {
      stringLiterals.push(currentStr);
      lineNoStrings += `__STR_${stringLiterals.length - 1}__`;
    }

    let code = lineNoStrings.trim();

    // If single line If ends with End If, strip the redundant End If
    if (/^if\b/i.test(code) && /\s+(?:end\s*if|endif)$/i.test(code)) {
      code = code.replace(/\s+(?:end\s*if|endif)$/i, '').trim();
    }

    // 2. Control flow conversions
    // Single line: If condition Then statement [Else statement]
    const singleLineIfMatch = code.match(/^if\b\s+(.+?)\s+\bthen\b\s+(.+?)(?:\s+\belse\b\s+(.+))?$/i);
    if (singleLineIfMatch) {
      const cond = transformVBCondition(singleLineIfMatch[1]);
      const thenStmt = transformVBStatement(singleLineIfMatch[2]);
      const elseStmt = singleLineIfMatch[3] ? transformVBStatement(singleLineIfMatch[3]) : null;
      if (elseStmt) {
        code = `if (${cond}) { ${thenStmt}; } else { ${elseStmt}; }`;
      } else {
        code = `if (${cond}) { ${thenStmt}; }`;
      }
    }
    // Multi-line: If condition Then
    else if (/^if\b\s+(.+?)\s+\bthen$/i.test(code)) {
      const match = code.match(/^if\b\s+(.+?)\s+\bthen$/i);
      const cond = transformVBCondition(match![1]);
      code = `if (${cond}) {`;
    }
    // ElseIf condition Then
    else if (/^elseif\b\s+(.+?)\s+\bthen$/i.test(code)) {
      const match = code.match(/^elseif\b\s+(.+?)\s+\bthen$/i);
      const cond = transformVBCondition(match![1]);
      code = `} else if (${cond}) {`;
    }
    // Else
    else if (/^else$/i.test(code)) {
      code = `} else {`;
    }
    // End If / EndIf
    else if (/^(end\s*if|endif)$/i.test(code)) {
      code = `}`;
    }
    // Select Case expr
    else if (/^select\s+case\b\s+(.+)$/i.test(code)) {
      const match = code.match(/^select\s+case\b\s+(.+)$/i);
      const expr = transformVBExpression(match![1]);
      isInsideMultiLineSelect = true;
      code = `switch (${expr}) {`;
    }
    // Case Else
    else if (/^case\s+else$/i.test(code)) {
      code = `break;\ndefault:`;
    }
    // Case value1, value2
    else if (/^case\b\s+(.+)$/i.test(code)) {
      const match = code.match(/^case\b\s+(.+)$/i);
      const cases = match![1].split(',').map((c) => transformVBExpression(c.trim()));
      code = `break;\n` + cases.map((c) => `case ${c}:`).join('\n');
    }
    // End Select
    else if (/^end\s+select$/i.test(code)) {
      isInsideMultiLineSelect = false;
      code = `}`;
    }
    // Dim var1, var2
    else if (/^dim\b\s+(.+)$/i.test(code)) {
      const match = code.match(/^dim\b\s+(.+)$/i);
      const vars = match![1].split(',').map((v) => v.trim().split(/\s+/)[0]).filter(Boolean);
      code = `let ${vars.join(', ')};`;
    }
    // For i = start To end [Step step]
    else if (/^for\b\s+(\w+)\s*=\s*(.+?)\s+\bto\b\s+(.+?)(?:\s+\bstep\b\s+(.+))?$/i.test(code)) {
      const match = code.match(/^for\b\s+(\w+)\s*=\s*(.+?)\s+\bto\b\s+(.+?)(?:\s+\bstep\b\s+(.+))?$/i);
      const varName = match![1];
      const start = transformVBExpression(match![2]);
      const end = transformVBExpression(match![3]);
      const step = match![4] ? transformVBExpression(match![4]) : '1';
      code = `for (let ${varName} = ${start}; ${step} >= 0 ? ${varName} <= ${end} : ${varName} >= ${end}; ${varName} += ${step}) { if (++__loopGuard > 100000) throw new Error('Script execution terminated: loop limit exceeded (possible infinite loop)');`;
    }
    // Next
    else if (/^next(?:\s+\w+)?$/i.test(code)) {
      code = `}`;
    }
    // Do While / Do Until
    else if (/^do\s+while\b\s+(.+)$/i.test(code)) {
      const match = code.match(/^do\s+while\b\s+(.+)$/i);
      code = `while (${transformVBCondition(match![1])}) { if (++__loopGuard > 100000) throw new Error('Script execution terminated: loop limit exceeded (possible infinite loop)');`;
    }
    else if (/^do\s+until\b\s+(.+)$/i.test(code)) {
      const match = code.match(/^do\s+until\b\s+(.+)$/i);
      code = `while (!(${transformVBCondition(match![1])})) { if (++__loopGuard > 100000) throw new Error('Script execution terminated: loop limit exceeded (possible infinite loop)');`;
    }
    else if (/^loop$/i.test(code)) {
      code = `}`;
    }
    // Function Name(args)
    else if (/^(?:public\s+|private\s+)?function\b\s+(\w+)\s*\((.*?)\)$/i.test(code)) {
      const match = code.match(/^(?:public\s+|private\s+)?function\b\s+(\w+)\s*\((.*?)\)$/i);
      const fnName = match![1];
      const fnArgs = match![2];
      currentFunction = fnName;
      code = `function ${fnName}(${fnArgs}) { let __fnResult;`;
    }
    // End Function
    else if (/^end\s+function$/i.test(code)) {
      currentFunction = null;
      code = `return __fnResult; }`;
    }
    // Sub Name(args)
    else if (/^(?:public\s+|private\s+)?sub\b\s+(\w+)\s*\((.*?)\)$/i.test(code)) {
      const match = code.match(/^(?:public\s+|private\s+)?sub\b\s+(\w+)\s*\((.*?)\)$/i);
      const subName = match![1];
      const subArgs = match![2];
      code = `function ${subName}(${subArgs}) {`;
    }
    // End Sub
    else if (/^end\s+sub$/i.test(code)) {
      code = `}`;
    }
    // General assignment or expression
    else {
      code = transformVBStatement(code, currentFunction);
      if (!code.endsWith(';') && !code.endsWith('}')) {
        code += ';';
      }
    }

    // Restore string literals
    for (let s = 0; s < stringLiterals.length; s++) {
      code = code.split(`__STR_${s}__`).join(`"${stringLiterals[s]}"`);
    }

    jsLines.push(code);
  }

  // If script doesn't explicitly return, return Value
  const fullJs = jsLines.join('\n');
  if (!fullJs.includes('return ')) {
    return fullJs + '\nreturn Value;';
  }
  return fullJs;
}

/**
 * Transforms a statement: e.g. "Value = ..." or "Set x = ..."
 */
function transformVBStatement(stmt: string, currentFunction: string | null = null): string {
  let s = stmt.trim();

  // Strip leading "Set "
  if (/^set\b\s+/i.test(s)) {
    s = s.replace(/^set\b\s+/i, '');
  }

  // Assignment: LHS = RHS
  // LHS can be: Value, Record("foo"), Record('foo'), Record.foo, Field("foo"), etc.
  const assignMatch = s.match(/^([\w\.\(\)\"\'\,\[\]\s]+?)\s*=\s*(.+)$/);
  if (assignMatch) {
    let lhs = assignMatch[1].trim();
    const rhs = transformVBExpression(assignMatch[2].trim());
    if (currentFunction && lhs.toLowerCase() === currentFunction.toLowerCase()) {
      lhs = '__fnResult';
    } else {
      // Convert Record("col") or Field("col") to Record[$2]
      lhs = lhs.replace(/\b(Record|Field|record|field)\s*\(\s*(.+?)\s*\)/i, '$1[$2]');
      // Convert NamedSubStrings("var") to NamedSubStrings[$2]
      lhs = lhs.replace(/\b(NamedSubStrings)\s*\(\s*(.+?)\s*\)/i, '$1[$2]');
    }
    return `${lhs} = ${rhs}`;
  }

  // Standalone expression like: "BATCH-" & Record("ProductID")
  return `Value = ${transformVBExpression(s)}`;
}

/**
 * Transforms VBScript conditions (handles =, <>, And, Or, Not, True, False)
 */
function transformVBCondition(cond: string): string {
  let c = cond.trim();
  c = c.replace(/\bTrue\b/gi, 'true');
  c = c.replace(/\bFalse\b/gi, 'false');
  c = c.replace(/\bNothing\b/gi, 'null');
  c = c.replace(/\bNull\b/gi, 'null');
  // Transform operators
  c = c.replace(/<>/g, ' !== ');
  c = c.replace(/(?<=[^\<\>\!\=])=(?=[^\=])/g, ' === ');
  c = c.replace(/\band\b/gi, ' && ');
  c = c.replace(/\bor\b/gi, ' || ');
  c = c.replace(/\bnot\b/gi, ' ! ');
  c = c.replace(/\bmod\b/gi, ' % ');
  c = c.replace(/&/g, '+');
  return c;
}

/**
 * Transforms VBScript expressions into JavaScript expressions.
 */
function transformVBExpression(expr: string): string {
  let e = expr.trim();
  if (!e) return '""';

  // Replace string concatenation & with +
  e = e.replace(/&/g, '+');

  // Replace boolean literals
  e = e.replace(/\bTrue\b/gi, 'true');
  e = e.replace(/\bFalse\b/gi, 'false');
  e = e.replace(/\bNothing\b/gi, 'null');
  e = e.replace(/\bNull\b/gi, 'null');
  e = e.replace(/\bEmpty\b/gi, '""');

  // Replace VBScript operators in expressions
  e = e.replace(/\bmod\b/gi, ' % ');
  e = e.replace(/\band\b/gi, ' && ');
  e = e.replace(/\bor\b/gi, ' || ');
  e = e.replace(/\bnot\b/gi, ' ! ');
  e = e.replace(/<>/g, ' !== ');

  // Support Date, Now, Time without parentheses (e.g. Value = Date, Value = Now, DateAdd("d", 9, Date))
  e = e.replace(/\bDate\b(?!\s*[\(\.\[\w])/g, 'Date()');
  e = e.replace(/\bNow\b(?!\s*[\(\.\[\w])/g, 'Now()');
  e = e.replace(/\bTime\b(?!\s*[\(\.\[\w])/g, 'Time()');

  return e;
}

/**
 * Detects if a given script string is written in VBScript syntax vs JavaScript syntax.
 */
export function isVBScriptCode(code: string): boolean {
  if (!code) return false;
  const s = code.trim();

  // If code has JS-only keywords, it is definitely JavaScript
  if (/\b(return\b|const\b|let\b|var\b|function\b|=>|console\.)/m.test(s)) return false;

  // Distinct VBScript markers:
  if (/\b(UCase|LCase|Mid|Left|Right|Len|InStr|DateAdd|DateDiff|FormatDateTime|CDate|IsDate|MsgBox|DebugPrint)\b/i.test(s)) return true;
  if (/^if\b.+?\bthen\b/im.test(s)) return true;
  if (/\b(End\s*If|EndIf|Select\s+Case|End\s+Select|Next|Do\s+While|Do\s+Until)\b/i.test(s)) return true;
  if (/(?:^|\s)&\s*(?:"|Record|Field|Value|\w+)/m.test(s)) return true;
  if (/^dim\b/im.test(s)) return true;
  if (/^rem\b/im.test(s)) return true;
  if (/^\s*'/m.test(s)) return true;
  if (/\bValue\s*=/i.test(s)) return true;

  return false;
}

/**
 * Executes a VBScript code snippet or multi-line event script in a secure sandbox.
 */
export function executeVBScript(
  scriptCode: string,
  scopeCtx: VBScriptScope = {},
  libraries?: any[],
  mode: 'expression' | 'multiline' = 'multiline'
): ScriptExecutionResult {
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const logs: string[] = [];
  const builtins = getVBScriptBuiltins(logs, parseVBDate(scopeCtx.currentDateTime ?? scopeCtx.system?.Date) ?? new Date());

  const initialRecord = scopeCtx.record || {};
  const recordProxy = createRecordProxy(initialRecord);
  const namedProxy = createNamedSubStringsProxy(scopeCtx.namedSubStrings || {});

  let initialVal = scopeCtx.value !== undefined ? scopeCtx.value : scopeCtx.input !== undefined ? scopeCtx.input : '';

  // Inject Script Libraries if present
  const allLibraries = libraries || scopeCtx.libraries || [];
  let libraryCodeHeader = '';
  if (Array.isArray(allLibraries) && allLibraries.length > 0) {
    for (const lib of allLibraries) {
      if (lib.code && lib.code.trim()) {
        if (lib.language === 'javascript') {
          libraryCodeHeader += `\n${lib.code}\n`;
        } else {
          libraryCodeHeader += `\n${transpileVBScriptToJS(lib.code)}\n`;
        }
      }
    }
  }

  const executionScope: Record<string, any> = {
    ...builtins,
    Math,
    String,
    Number,
    True: true,
    False: false,
    Null: null,
    Nothing: null,
    // Variables
    Value: initialVal,
    value: initialVal,
    Input: initialVal,
    input: initialVal,
    Record: recordProxy,
    record: recordProxy,
    Field: recordProxy,
    field: recordProxy,
    NamedSubStrings: namedProxy,
    Objects: scopeCtx.Objects || scopeCtx.objects || ((name: string) => ({ Value: '' })),
    objects: scopeCtx.Objects || scopeCtx.objects || ((name: string) => ({ Value: '' })),
    Format: typeof scopeCtx.Format === 'function'
      ? scopeCtx.Format
      : createFormatProxy(
          namedProxy,
          scopeCtx.Objects || scopeCtx.objects || ((name: string) => ({ Value: '' })),
          scopeCtx.Format || (scopeCtx as any).format || {}
        ),
    format: typeof scopeCtx.Format === 'function'
      ? scopeCtx.Format
      : createFormatProxy(
          namedProxy,
          scopeCtx.Objects || scopeCtx.objects || ((name: string) => ({ Value: '' })),
          scopeCtx.Format || (scopeCtx as any).format || {}
        ),
    System: scopeCtx.system || {
      UserName: 'Administrator',
      PrinterName: 'Default Printer',
      JobId: 'JOB-001',
      RecordNumber: 1,
      TotalRecords: 1,
    },
    PrintJob: scopeCtx.printJob || {},
    window: undefined,
    globalThis: undefined,
    process: undefined,
    require: undefined,
    document: undefined,
    console: {
      log: (...args: any[]) => logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')),
      warn: (...args: any[]) => logs.push('[WARN] ' + args.join(' ')),
      error: (...args: any[]) => logs.push('[ERROR] ' + args.join(' ')),
    },
  };

  try {
    const trimmed = (scriptCode || '').trim();
    if (!trimmed) {
      const elapsed = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime);
      return {
        success: true,
        value: String(initialVal ?? ''),
        record: recordProxy.raw,
        logs,
        executionTimeMs: elapsed,
      };
    }

    // Expression sources always evaluate one VBScript expression and assign its
    // result to Value; multiline sources retain statement/output semantics.
    let jsExecutable: string;
    if (mode === 'expression') {
      const expressionCode = /^\s*Value\s*=/i.test(trimmed) ? trimmed : `Value = ${trimmed}`;
      jsExecutable = transpileVBScriptToJS(expressionCode);
    } else if (isVBScriptCode(trimmed)) {
      jsExecutable = transpileVBScriptToJS(trimmed);
    } else {
      // JavaScript execution compatibility
      if (trimmed.includes('return ') || trimmed.includes('{') || trimmed.includes('let ') || trimmed.includes('const ')) {
        jsExecutable = trimmed;
      } else {
        jsExecutable = `return (${trimmed});`;
      }
    }

    const scopeKeys = Object.keys(executionScope);
    const scopeValues = Object.values(executionScope);

    const fn = new Function(...scopeKeys, `
      try {
        ${libraryCodeHeader}
        ${jsExecutable}
      } catch (__err) {
        throw __err;
      }
      return Value;
    `);

    const result = fn(...scopeValues);
    const finalValue = result !== undefined && result !== null ? String(result) : String(executionScope.Value ?? '');
    const elapsed = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime);

    return {
      success: true,
      value: finalValue,
      result: finalValue,
      record: recordProxy.raw,
      logs,
      executionTimeMs: elapsed,
    };
  } catch (err: any) {
    const elapsed = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime);
    return {
      success: false,
      value: `[Script Error: ${err.message}]`,
      result: `[Script Error: ${err.message}]`,
      record: recordProxy.raw,
      logs,
      error: err.message,
      executionTimeMs: elapsed,
    };
  }
}

/**
 * Executes a BarTender document-level event script hook (e.g. OnNewRecord, OnStartJob, etc.)
 */
export function executeDocumentEventScript(
  eventName:
    | 'OnOpen'
    | 'OnSave'
    | 'OnClose'
    | 'OnPrintJobStart'
    | 'OnStartJob'
    | 'OnNewRecord'
    | 'OnSerialize'
    | 'OnIdenticalCopies'
    | 'OnPrePrint'
    | 'OnPostPrint'
    | 'OnPrintJobEnd'
    | 'OnEndJob'
    | 'OnPrintJobCancel'
    | string,
  eventScripts: Record<string, string> = {},
  ctx: EvaluationContext = {}
): ScriptExecutionResult {
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  // Check both canonical BarTender name and internal aliases
  let code = eventScripts[eventName];
  if (!code) {
    if (eventName === 'OnPrintJobStart') code = eventScripts['OnStartJob'];
    else if (eventName === 'OnStartJob') code = eventScripts['OnPrintJobStart'];
    else if (eventName === 'OnPrintJobEnd') code = eventScripts['OnEndJob'];
    else if (eventName === 'OnEndJob') code = eventScripts['OnPrintJobEnd'];
  }

  if (!code || !code.trim()) {
    return {
      success: true,
      value: '',
      record: ctx.record,
      logs: [],
      executionTimeMs: 0,
    };
  }

  const scope: VBScriptScope = {
    record: ctx.record || {},
    system: {
      UserName: ctx.userName || 'Administrator',
      PrinterName: ctx.printerName || 'Default Printer',
      JobId: ctx.jobId || 'JOB-001',
      RecordNumber: (ctx.currentRecordIndex ?? 0) + 1,
      TotalRecords: ctx.totalRecords || 1,
      PageNumber: ctx.pageNumber || 1,
      CopyNumber: ctx.copyNumber || 1,
    },
    namedSubStrings: ctx.namedDataSources ? Object.fromEntries(ctx.namedDataSources.map((n) => [n.name, n.defaultValue])) : {},
    libraries: (ctx as any).scriptLibraries,
  };

  return executeVBScript(code, scope);
}
