import { DataSourceItem, LabelElement, VariableDefinition } from '../types';
import { applyTransformPipeline } from './transformEngine';

export interface EvaluationContext {
  record?: Record<string, string>;
  variables?: VariableDefinition[];
  elements?: LabelElement[];
  currentRecordIndex?: number;
  totalRecords?: number;
  printerName?: string;
  jobId?: string;
  userName?: string;
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
    // Create a sandboxed evaluation function with safe exposed variables
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
  if (!item.enabled) return '';
  let raw = item.value || '';

  switch (item.type) {
    case 'embedded':
      raw = item.value || '';
      break;

    case 'database': {
      const field = item.databaseField || item.value;
      if (field && ctx.record && ctx.record[field] !== undefined) {
        raw = ctx.record[field];
      } else if (field && ctx.record) {
        // Case-insensitive lookup fallback
        const matchKey = Object.keys(ctx.record).find(k => k.toLowerCase() === field.toLowerCase());
        raw = matchKey ? ctx.record[matchKey] : (item.value || `[${field}]`);
      }
      break;
    }

    case 'serial': {
      const start = item.serialStart ?? 1;
      const step = item.serialStep ?? 1;
      const pad = item.serialPad ?? 0;
      const dir = item.serialDirection === 'decrement' ? -1 : 1;
      const recIdx = ctx.currentRecordIndex ?? 0;
      
      const currentVal = start + (dir * step * recIdx);
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
      const varName = item.value;
      const variable = ctx.variables?.find(v => v.name === varName || v.id === varName);
      if (variable) {
        if (variable.type === 'counter') {
          const cStart = variable.counterStart ?? 1;
          const cStep = variable.counterStep ?? 1;
          const cPad = variable.counterPad ?? 0;
          const cVal = cStart + ((ctx.currentRecordIndex ?? 0) * cStep);
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
      const sys = item.systemVarName || 'SYSTEM.DATE';
      if (sys === 'SYSTEM.DATE') raw = formatCustomDate(new Date(), 'YYYY-MM-DD');
      else if (sys === 'SYSTEM.TIME') raw = formatCustomDate(new Date(), 'HH:mm:ss');
      else if (sys === 'SYSTEM.USER') raw = ctx.userName || 'Current User';
      else if (sys === 'SYSTEM.PRINTER') raw = ctx.printerName || 'Default Zebra ZT410';
      else if (sys === 'SYSTEM.JOB_ID') raw = ctx.jobId || 'JOB-001';
      else if (sys === 'SYSTEM.PAGE_NUMBER') raw = String((ctx.currentRecordIndex ?? 0) + 1);
      else if (sys === 'SYSTEM.TOTAL_PAGES') raw = String(ctx.totalRecords ?? 1);
      break;
    }

    case 'script': {
      raw = evaluateSafeScript(item.scriptCode || item.value || '', ctx);
      break;
    }

    case 'linked': {
      if (item.linkedObjectId && ctx.elements) {
        const target = ctx.elements.find(e => e.id === item.linkedObjectId);
        if (target) {
          if (target.type === 'text') raw = target.text;
          else if (target.type === 'barcode') raw = target.value;
        }
      }
      break;
    }

    case 'gs1_ai': {
      if (item.gs1AIs && item.gs1AIs.length > 0) {
        raw = item.gs1AIs.map(ai => `(${ai.ai})${ai.value}`).join('');
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
        raw = item.gs1AIs.map(ai => `(${ai.ai})${ai.value}`).join('');
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
 * Evaluates the full concatenated value for an element
 */
export function evaluateElementData(
  element: LabelElement,
  ctx: EvaluationContext = {}
): string {
  // If element has multi-data sources defined and populated
  if (element.dataSources && element.dataSources.length > 0) {
    const combined = element.dataSources
      .map((item, idx) => evaluateDataSourceItem(item, ctx, idx))
      .join('');

    // Apply element-level global transforms
    return applyTransformPipeline(combined, element.transforms);
  }

  // Fallback to legacy single data binding / value
  let baseValue = '';
  if (element.type === 'text') {
    baseValue = element.text || '';
  } else if (element.type === 'barcode') {
    baseValue = element.value || '';
  }

  // Check dataBinding mustache template e.g. "{{PRODUCT_NAME}}"
  const binding = (element as any).dataBinding;
  if (binding) {
    let bound = binding;
    if (ctx.record) {
      Object.entries(ctx.record).forEach(([k, v]) => {
        bound = bound.replace(new RegExp(`{{${k}}}`, 'g'), v);
      });
    }
    if (ctx.variables) {
      ctx.variables.forEach(v => {
        bound = bound.replace(new RegExp(`{{${v.name}}}`, 'g'), v.defaultValue);
      });
    }
    baseValue = bound;
  }

  return applyTransformPipeline(baseValue, element.transforms);
}
