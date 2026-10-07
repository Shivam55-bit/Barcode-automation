import { formatCustomDate } from './dataSourceEngine';
import { parseVBDate, vbDateAdd } from './vbscriptEngine';

export interface FormulaContext {
  record?: Record<string, any>;
  variables?: Record<string, any>;
  namedSources?: Record<string, any>;
  globalData?: Record<string, any>;
  system?: Record<string, any>;
}

export interface FormulaEvaluationResult {
  success: boolean;
  value: string;
  error?: string;
}

/**
 * Standardizes dates from string, number, or Date object using strict VBScript date normalizer
 */
function parseDateInput(input: any): Date {
  if (input instanceof Date) return isNaN(input.getTime()) ? new Date() : input;
  if (input === undefined || input === null || input === '') return new Date();
  const parsed = parseVBDate(input);
  return parsed && !isNaN(parsed.getTime()) ? parsed : new Date();
}

/**
 * Expression sandbox environment exposing standard industrial formula functions
 */
function createSandboxEnvironment(ctx: FormulaContext): Record<string, any> {
  const mergedScope: Record<string, any> = {
    // Math Functions
    ROUND: (val: number, decimals: number = 0) => {
      const factor = Math.pow(10, decimals);
      return Math.round(Number(val) * factor) / factor;
    },
    ABS: (val: number) => Math.abs(Number(val)),
    CEIL: (val: number) => Math.ceil(Number(val)),
    FLOOR: (val: number) => Math.floor(Number(val)),
    MIN: (...args: number[]) => Math.min(...args.map(Number)),
    MAX: (...args: number[]) => Math.max(...args.map(Number)),

    // String Functions
    CONCAT: (...args: any[]) => args.join(''),
    SUBSTRING: (str: any, start: number, length?: number) => {
      const s = String(str || '');
      const sIdx = Math.max(0, start);
      return length !== undefined ? s.substring(sIdx, sIdx + length) : s.substring(sIdx);
    },
    TRIM: (str: any) => String(str || '').trim(),
    REPLACE: (str: any, search: string, replacement: string) =>
      String(str || '').replaceAll(search, replacement),
    UPPER: (str: any) => String(str || '').toUpperCase(),
    LOWER: (str: any) => String(str || '').toLowerCase(),
    PADLEFT: (val: any, len: number, char: string = '0') =>
      String(val ?? '').padStart(len, char),
    PADRIGHT: (val: any, len: number, char: string = ' ') =>
      String(val ?? '').padEnd(len, char),
    LENGTH: (str: any) => String(str || '').length,

    // Date Functions
    NOW: () => new Date(),
    TODAY: () => new Date(),
    ADDDAYS: (dateInput: any, days: number) => {
      return vbDateAdd('d', days, dateInput);
    },
    ADDMONTHS: (dateInput: any, months: number) => {
      return vbDateAdd('m', months, dateInput);
    },
    ADDYEARS: (dateInput: any, years: number) => {
      return vbDateAdd('yyyy', years, dateInput);
    },
    DATEDIFF: (d1: any, d2: any, unit: 'days' | 'months' | 'years' = 'days') => {
      const date1 = parseDateInput(d1).getTime();
      const date2 = parseDateInput(d2).getTime();
      const diffMs = Math.abs(date2 - date1);
      if (unit === 'days') return Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (unit === 'months') return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.4375));
      if (unit === 'years') return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));
      return diffMs;
    },
    FORMATDATE: (dateInput: any, mask: string = 'YYYY-MM-DD') => {
      return formatCustomDate(parseDateInput(dateInput), mask);
    },

    // Logical & Conditional Functions
    IF: (condition: any, trueVal: any, falseVal: any) => (condition ? trueVal : falseVal),
    AND: (...conditions: any[]) => conditions.every(Boolean),
    OR: (...conditions: any[]) => conditions.some(Boolean),
    NOT: (val: any) => !val,
    ISBLANK: (val: any) => val === undefined || val === null || String(val).trim() === '',
    COALESCE: (...args: any[]) => args.find((a) => a !== undefined && a !== null && String(a) !== '') ?? '',
  };

  // Populate System variables
  const sys = ctx.system || {};
  mergedScope.System = {
    Date: formatCustomDate(new Date(), 'YYYY-MM-DD'),
    Time: formatCustomDate(new Date(), 'HH:mm:ss'),
    User: sys.userName || 'Operator',
    Printer: sys.printerName || 'Default Printer',
    JobId: sys.jobId || 'JOB-001',
    RecordNumber: sys.currentRecordIndex !== undefined ? sys.currentRecordIndex + 1 : 1,
    TotalRecords: sys.totalRecords || 1,
    PageNumber: sys.pageNumber || 1,
    TotalPages: sys.totalPages || 1,
  };

  // Record accessor function: Record("Field")
  mergedScope.Record = (fn: string) => {
    if (!ctx.record || !fn) return '';
    if (ctx.record[fn] !== undefined) return ctx.record[fn];
    const match = Object.keys(ctx.record || {}).find((k) => k.toLowerCase() === fn.toLowerCase());
    return match !== undefined ? ctx.record[match] : '';
  };
  mergedScope.record = mergedScope.Record;

  // Populate Record columns
  if (ctx.record) {
    for (const [k, v] of Object.entries(ctx.record)) {
      mergedScope[k] = v;
      // Also normalize alphanumeric field keys
      const safeKey = k.replace(/[^a-zA-Z0-9_]/g, '_');
      if (safeKey !== k) {
        mergedScope[safeKey] = v;
      }
    }
  }

  // Populate Global Data
  if (ctx.globalData) {
    mergedScope.Global = { ...ctx.globalData };
    for (const [k, v] of Object.entries(ctx.globalData)) {
      if (!mergedScope[k]) mergedScope[k] = v;
    }
  }

  // Populate Named Data Sources
  if (ctx.namedSources) {
    for (const [k, v] of Object.entries(ctx.namedSources)) {
      mergedScope[k] = v;
    }
  }

  // Populate Variables
  if (ctx.variables) {
    for (const [k, v] of Object.entries(ctx.variables)) {
      mergedScope[k] = v;
    }
  }

  return mergedScope;
}

/**
 * Pre-processes user expression: replaces {{FieldName}}, {FieldName}, and [FieldName] with identifier
 */
function normalizeExpression(expr: string): string {
  let clean = expr.trim();
  if (clean.startsWith('=')) {
    clean = clean.substring(1).trim();
  }
  // Replace {{Field Name}} or {Field Name}
  clean = clean.replace(/\{{1,2}([a-zA-Z0-9_.\s]+)\}{1,2}/g, (_, fieldName) => {
    const trimmed = fieldName.trim();
    // If it contains spaces or dots, access via Record("...")
    if (trimmed.includes(' ')) {
      return `Record("${trimmed}")`;
    }
    return trimmed;
  });
  // Replace [Field Name] with FieldName if enclosed in brackets
  clean = clean.replace(/\[([a-zA-Z0-9_.\s]+)\]/g, (_, fieldName) => {
    const trimmed = fieldName.trim();
    if (trimmed.includes(' ')) {
      return `Record("${trimmed}")`;
    }
    return trimmed;
  });
  return clean;
}

/**
 * Evaluates an expression string within the sandboxed FormulaContext
 */
export function evaluateFormula(expression: string, context: FormulaContext = {}): FormulaEvaluationResult {
  if (!expression || !expression.trim()) {
    return { success: true, value: '' };
  }

  try {
    const normalized = normalizeExpression(expression);
    const scope = createSandboxEnvironment(context);

    // Build scoped evaluation function
    const paramNames = Object.keys(scope);
    const paramValues = Object.values(scope);

    const fn = new Function(
      ...paramNames,
      `"use strict";
       try {
         return (${normalized});
       } catch (err) {
         throw err;
       }`
    );

    const result = fn(...paramValues);

    let outputStr = '';
    if (result instanceof Date) {
      outputStr = formatCustomDate(result, 'YYYY-MM-DD');
    } else if (result !== undefined && result !== null) {
      outputStr = String(result);
    }

    return {
      success: true,
      value: outputStr,
    };
  } catch (err: any) {
    return {
      success: false,
      value: '',
      error: err?.message || 'Formula syntax error',
    };
  }
}

/**
 * Validates a formula expression without executing full business logic
 */
export function validateFormula(expression: string, sampleContext: FormulaContext = {}): { valid: boolean; error?: string } {
  if (!expression || !expression.trim()) {
    return { valid: true };
  }
  const evalRes = evaluateFormula(expression, sampleContext);
  return {
    valid: evalRes.success,
    error: evalRes.error,
  };
}
