import { DataSourceItem, LabelElement, VariableDefinition, NamedDataSource } from '../types';
import { applyTransformPipeline } from './transformEngine';
import { evaluateFormula } from './formulaEngine';

export interface EvaluationContext {
  record?: Record<string, any>;
  datasets?: any[];
  connectedDataset?: any;
  variables?: VariableDefinition[];
  namedDataSources?: NamedDataSource[];
  elements?: LabelElement[];
  currentRecordIndex?: number;
  totalRecords?: number;
  printerName?: string;
  jobId?: string;
  userName?: string;
  computerName?: string;
  pageNumber?: number;
  totalPages?: number;
  copyNumber?: number;
}

let globalDatasetsRegistry: any[] = [];

export function setGlobalDatasets(datasets: any[]): void {
  globalDatasetsRegistry = Array.isArray(datasets) ? datasets : [];
}

export function getGlobalDatasets(): any[] {
  return globalDatasetsRegistry;
}

/**
 * Format date string with custom mask e.g. YYYY-MM-DD, YYMMDD, DD/MM/YYYY, HH:mm:ss
 */
export function formatCustomDate(date: Date, formatMask: string = 'YYYY-MM-DD'): string {
  const yyyy = date.getFullYear().toString();
  const yy = yyyy.slice(-2);
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const dd = date.getDate().toString().padStart(2, '0');
  const hh = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');
  const ss = date.getSeconds().toString().padStart(2, '0');
  const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthNamesLong = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const mmm = monthNamesShort[date.getMonth()];
  const mmmm = monthNamesLong[date.getMonth()];

  let out = formatMask;
  out = out.replace(/YYYY/g, yyyy);
  out = out.replace(/YY/g, yy);
  out = out.replace(/MMMM/g, mmmm);
  out = out.replace(/MMM/g, mmm);
  out = out.replace(/MM/g, mm);
  out = out.replace(/DD/g, dd);
  out = out.replace(/HH/g, hh);
  out = out.replace(/mm/g, min);
  out = out.replace(/ss/g, ss);
  return out;
}

/**
 * Safely evaluates a JavaScript expression for scripting data sources
 */
export function evaluateSafeScript(script: string, ctx: EvaluationContext): string {
  try {
    const scope = {
      record: ctx.record || {},
      ctx,
      Date,
      Math,
      String,
      Number,
      pad: (val: any, len: number, char: string = '0') => String(val).padStart(len, char),
      formatDate: (d: Date, mask: string) => formatCustomDate(d, mask),
      now: () => new Date(),
    };
    const fn = new Function(...Object.keys(scope), `return (function() { ${script.includes('return') ? script : 'return ' + script} })()`);
    const result = fn(...Object.values(scope));
    return result !== undefined && result !== null ? String(result) : '';
  } catch (err: any) {
    console.warn('Script evaluation error:', err);
    return `[Script Error]`;
  }
}

/**
 * Evaluates an individual DataSourceItem
 */
export function evaluateDataSourceItem(
  item: DataSourceItem,
  ctx: EvaluationContext,
  itemIndex: number = 0
): string {
  if (!item.enabled && item.enabled !== undefined) return '';

  // 1. Check if bound to a centralized Named Data Source
  if (item.namedSourceId && ctx.namedDataSources) {
    const named = ctx.namedDataSources.find(
      (n) => n.id === item.namedSourceId || n.name.toLowerCase() === item.namedSourceId?.toLowerCase()
    );
    if (named) {
      let namedVal = named.defaultValue || '';
      if (named.databaseField && ctx.record && ctx.record[named.databaseField] !== undefined) {
        namedVal = ctx.record[named.databaseField];
      } else if (named.formulaExpression) {
        const evalRes = evaluateFormula(named.formulaExpression, {
          record: ctx.record,
          system: {
            userName: ctx.userName,
            printerName: ctx.printerName,
            jobId: ctx.jobId,
            currentRecordIndex: ctx.currentRecordIndex,
            totalRecords: ctx.totalRecords,
          },
        });
        namedVal = evalRes.success ? evalRes.value : `[Formula Error: ${evalRes.error}]`;
      }
      return applyTransformPipeline(namedVal, item.transforms || named.transforms);
    }
  }

  // 2. Check if bound to a standalone formula expression
  if (item.formulaExpression) {
    const evalRes = evaluateFormula(item.formulaExpression, {
      record: ctx.record,
      system: {
        userName: ctx.userName,
        printerName: ctx.printerName,
        jobId: ctx.jobId,
        currentRecordIndex: ctx.currentRecordIndex,
        totalRecords: ctx.totalRecords,
      },
    });
    const resVal = evalRes.success ? evalRes.value : `[Formula Error: ${evalRes.error}]`;
    return applyTransformPipeline(resVal, item.transforms);
  }

  let raw = item.value || '';

  switch (item.type) {
    case 'embedded':
      raw = item.value || '';
      break;

    case 'database':
    case 'database-field': {
      const field = item.field || item.databaseField;
      const datasetId = item.datasetId || (item as any).connectionId;
      const datasets = ctx.datasets || globalDatasetsRegistry;

      // 1. Verify dataset existence if datasetId is bound
      if (datasetId && datasets && datasets.length > 0) {
        const matchedDataset = datasets.find((d: any) => d.id === datasetId || d.name?.toLowerCase() === datasetId.toLowerCase());
        if (!matchedDataset) {
          return `⚠ Dataset unavailable`;
        }

        // 2. Verify column existence in detected schema
        if (field) {
          const rawCols = matchedDataset.columns || matchedDataset.fields || [];
          const colNames: string[] = rawCols.map((c: any) => (typeof c === 'string' ? c : c.name || ''));
          const hasCol = colNames.some((c) => c.toLowerCase() === field.toLowerCase());
          if (colNames.length > 0 && !hasCol) {
            return `⚠ Missing Field: ${field}`;
          }
        }
      } else if (ctx.connectedDataset && field) {
        const rawCols = ctx.connectedDataset.fields || ctx.connectedDataset.columns || [];
        const colNames: string[] = rawCols.map((c: any) => (typeof c === 'string' ? c : c.name || ''));
        if (colNames.length > 0 && !colNames.some((c) => c.toLowerCase() === field.toLowerCase())) {
          return `⚠ Missing Field: ${field}`;
        }
      }

      if (!field) {
        raw = item.value || '';
        break;
      }

      // 3. Resolve value from current active record
      if (ctx.record) {
        if (ctx.record[field] !== undefined && ctx.record[field] !== null) {
          raw = String(ctx.record[field]);
        } else {
          // Case-insensitive lookup fallback
          const matchKey = Object.keys(ctx.record).find((k) => k.toLowerCase() === field.toLowerCase());
          if (matchKey !== undefined && ctx.record[matchKey] !== undefined && ctx.record[matchKey] !== null) {
            raw = String(ctx.record[matchKey]);
          } else if (datasetId) {
            return `⚠ Missing Field: ${field}`;
          } else {
            raw = item.value || `[${field}]`;
          }
        }
      } else {
        raw = item.value || `[${field}]`;
      }
      break;
    }

    case 'serial': {
      const start = item.serialStart ?? 1;
      const step = item.serialStep ?? 1;
      const pad = item.serialPad ?? 0;
      const dir = item.serialDirection === 'decrement' ? -1 : 1;
      const recIdx = ctx.currentRecordIndex ?? 0;

      const currentVal = start + dir * step * recIdx;
      const padded = pad > 0 ? String(currentVal).padStart(pad, '0') : String(currentVal);
      const pfx = item.serialPrefix || '';
      const sfx = item.serialSuffix || '';
      raw = `${pfx}${padded}${sfx}`;
      break;
    }

    case 'clock': {
      const baseDate = new Date();
      if (item.dateOffsetDays) {
        baseDate.setDate(baseDate.getDate() + item.dateOffsetDays);
      }
      if (item.dateOffsetMonths) {
        baseDate.setMonth(baseDate.getMonth() + item.dateOffsetMonths);
      }
      if (item.dateOffsetYears) {
        baseDate.setFullYear(baseDate.getFullYear() + item.dateOffsetYears);
      }
      const mask = item.dateFormat || 'YYYY-MM-DD';
      raw = formatCustomDate(baseDate, mask);
      break;
    }

    case 'variable': {
      const varName = item.value || item.variableName;
      const variable = ctx.variables?.find((v) => v.name === varName || v.id === varName);
      if (variable) {
        if (variable.type === 'counter') {
          const cStart = variable.counterStart ?? 1;
          const cStep = variable.counterStep ?? 1;
          const cPad = variable.counterPad ?? 0;
          const cVal = cStart + (ctx.currentRecordIndex ?? 0) * cStep;
          raw = cPad > 0 ? String(cVal).padStart(cPad, '0') : String(cVal);
        } else if (variable.type === 'date') {
          const d = new Date();
          if (variable.dateOffsetDays) d.setDate(d.getDate() + variable.dateOffsetDays);
          raw = formatCustomDate(d, variable.dateFormat || 'YYYY-MM-DD');
        } else if (variable.type === 'csv' && variable.csvColumn && ctx.record) {
          raw = ctx.record[variable.csvColumn] || variable.defaultValue || '';
        } else {
          raw = variable.defaultValue || '';
        }
      }
      break;
    }

    case 'system': {
      const sys = (item.systemVarName || item.value || 'SYSTEM.DATE').toUpperCase();
      if (sys === 'SYSTEM.DATE') raw = formatCustomDate(new Date(), 'YYYY-MM-DD');
      else if (sys === 'SYSTEM.TIME') raw = formatCustomDate(new Date(), 'HH:mm:ss');
      else if (sys === 'SYSTEM.USER') raw = ctx.userName || 'Current User';
      else if (sys === 'SYSTEM.PRINTER') raw = ctx.printerName || 'Default Zebra ZT410';
      else if (sys === 'SYSTEM.JOB_ID') raw = ctx.jobId || 'JOB-001';
      else if (sys === 'SYSTEM.PAGE_NUMBER') raw = String(ctx.pageNumber || (ctx.currentRecordIndex ?? 0) + 1);
      else if (sys === 'SYSTEM.TOTAL_PAGES') raw = String(ctx.totalPages || ctx.totalRecords || 1);
      else if (sys === 'SYSTEM.RECORD_NUMBER') raw = String((ctx.currentRecordIndex ?? 0) + 1);
      else if (sys === 'SYSTEM.TOTAL_RECORDS') raw = String(ctx.totalRecords || 1);
      else if (sys === 'SYSTEM.COPY_NUMBER') raw = String(ctx.copyNumber || 1);
      else if (sys === 'SYSTEM.COMPUTER_NAME') raw = ctx.computerName || 'WORKSTATION-01';
      break;
    }

    case 'script': {
      raw = evaluateSafeScript(item.scriptCode || item.value || '', ctx);
      break;
    }

    case 'linked': {
      if (item.linkedObjectId && ctx.elements) {
        const target = ctx.elements.find((e) => e.id === item.linkedObjectId);
        if (target) {
          if (target.type === 'text') raw = target.text;
          else if (target.type === 'barcode') raw = target.value;
        }
      }
      break;
    }

    case 'gs1_ai': {
      if (item.gs1AIs && item.gs1AIs.length > 0) {
        raw = item.gs1AIs.map((ai) => `(${ai.ai})${ai.value}`).join('');
      } else {
        raw = item.value || '(01)00850006531234(10)LOT456(17)261231(21)SN987654';
      }
      break;
    }

    case 'gs1_composite': {
      const linear = item.gs1CompositeLinear || '(01)00850006531234';
      const comp2D = item.gs1Composite2DData || '(10)BATCH123(17)261231';
      raw = `${linear}|${comp2D}`;
      break;
    }

    case 'gs1_databar': {
      if (item.gs1AIs && item.gs1AIs.length > 0) {
        raw = item.gs1AIs.map((ai) => `(${ai.ai})${ai.value}`).join('');
      } else {
        raw = item.value || '(01)00850006531234';
      }
      break;
    }

    default:
      raw = item.value || '';
  }

  // Apply per-data-source transform rules pipeline
  return applyTransformPipeline(raw, item.transforms);
}

/**
 * Replaces dynamic token strings in text e.g. "{{SKU}}", "{BATCH}", "{System.Date}"
 */
export function interpolateDynamicTokens(text: string, ctx: EvaluationContext): string {
  if (!text || !text.includes('{')) return text;

  let result = text;

  // 1. System Variables
  result = result.replace(/\{{1,2}System\.Date\}{1,2}/gi, formatCustomDate(new Date(), 'YYYY-MM-DD'));
  result = result.replace(/\{{1,2}System\.Time\}{1,2}/gi, formatCustomDate(new Date(), 'HH:mm:ss'));
  result = result.replace(/\{{1,2}System\.User\}{1,2}/gi, ctx.userName || 'Operator');
  result = result.replace(/\{{1,2}System\.Printer\}{1,2}/gi, ctx.printerName || 'Default Printer');
  result = result.replace(/\{{1,2}System\.JobId\}{1,2}/gi, ctx.jobId || 'JOB-001');
  result = result.replace(/\{{1,2}System\.RecordNumber\}{1,2}/gi, String((ctx.currentRecordIndex ?? 0) + 1));
  result = result.replace(/\{{1,2}System\.TotalRecords\}{1,2}/gi, String(ctx.totalRecords || 1));

  const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // 2. Record Fields
  if (ctx.record) {
    for (const [k, v] of Object.entries(ctx.record)) {
      result = result.replace(new RegExp(`\\{{1,2}${escapeRx(k)}\\}{1,2}`, 'gi'), String(v ?? ''));
    }
  }

  // 3. Named Data Sources
  if (ctx.namedDataSources) {
    for (const named of ctx.namedDataSources) {
      const val =
        (named.databaseField && ctx.record ? ctx.record[named.databaseField] : undefined) ||
        named.defaultValue ||
        '';
      result = result.replace(new RegExp(`\\{{1,2}${escapeRx(named.name)}\\}{1,2}`, 'gi'), String(val));
    }
  }

  // 4. Variables
  if (ctx.variables) {
    for (const v of ctx.variables) {
      result = result.replace(new RegExp(`\\{{1,2}${escapeRx(v.name)}\\}{1,2}`, 'gi'), String(v.defaultValue || ''));
    }
  }

  return result;
}

/**
 * Evaluates the full concatenated value for an element
 */
export function evaluateElementData(element: LabelElement, ctx: EvaluationContext = {}): string {
  // If element has multi-data sources defined and populated
  if (element.dataSources && element.dataSources.length > 0) {
    const combined = element.dataSources.map((item, idx) => evaluateDataSourceItem(item, ctx, idx)).join('');
    return applyTransformPipeline(combined, element.transforms);
  }

  // Fallback to single value / text with dynamic token interpolation
  let baseValue = '';
  if (element.type === 'text') {
    baseValue = element.text || (element as any).content || '';
  } else if (element.type === 'barcode') {
    baseValue = element.value || (element as any).barcodeValue || (element as any).content || '';
  }

  // Check dataBinding or interpolate tokens
  const binding = (element as any).dataBinding;
  if (binding) {
    baseValue = interpolateDynamicTokens(binding, ctx);
  } else {
    baseValue = interpolateDynamicTokens(baseValue, ctx);
  }

  return applyTransformPipeline(baseValue, element.transforms);
}
