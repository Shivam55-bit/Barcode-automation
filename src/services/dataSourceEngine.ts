import { DataSourceItem, LabelElement, TextElement, VariableDefinition, NamedDataSource, EvaluationContext, DataSourceFontOverride, ResolvedTextRun } from '../types';
import { applyTransformPipeline, executeEnterpriseTransformPipeline } from './transformEngine';
import { evaluateFormula } from './formulaEngine';
import { evaluateSerializedValue } from './serializationEngine';
import { resolveDataSourceValue, resolveStoredControlValue, getControlByToken, getControlByCode } from './controlCharacterService';

export type { EvaluationContext };

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

import { executeVBScript, isVBScriptCode, createRecordProxy, createNamedSubStringsProxy, vbDateAdd, vbDateAddObj, vbFormat, createFormatProxy } from './vbscriptEngine';
import { applyDataTypeFormatting } from './transformEngine';

function resolveDynamicOffset(
  sourceType: 'fixed' | 'database_field' | 'formula' | 'named_source' | undefined,
  fixedVal: number | string | undefined,
  field: string | undefined,
  ctx: EvaluationContext
): number {
  if (sourceType === 'database_field' && field && ctx.record) {
    let rawVal = ctx.record[field];
    if (rawVal === undefined) {
      const matchKey = Object.keys(ctx.record || {}).find((k) => k.toLowerCase() === field.toLowerCase());
      if (matchKey) rawVal = ctx.record[matchKey];
    }
    const parsed = Number(rawVal);
    return isNaN(parsed) ? 0 : parsed;
  }
  if (sourceType === 'formula' && field) {
    const evalRes = evaluateFormula(field, {
      record: ctx.record,
      namedSources: ctx.namedDataSources ? Object.fromEntries(ctx.namedDataSources.map(n => [n.name, n.defaultValue])) : undefined,
    });
    const parsed = Number(evalRes.value);
    return isNaN(parsed) ? 0 : parsed;
  }
  if (sourceType === 'named_source' && field && ctx.namedDataSources) {
    const named = ctx.namedDataSources.find(n => n.name.toLowerCase() === field.toLowerCase() || n.id === field);
    if (named) {
      const parsed = Number(named.defaultValue);
      return isNaN(parsed) ? 0 : parsed;
    }
  }
  const fallback = Number(fixedVal);
  return isNaN(fallback) ? 0 : fallback;
}

/**
 * Safely evaluates a VBScript or JavaScript expression for scripting data sources
 */
export function evaluateSafeScript(
  script: string,
  ctx: EvaluationContext,
  language?: 'javascript' | 'vbscript',
  mode: 'expression' | 'multiline' = 'multiline'
): string {
  try {
    const isVB = language === 'vbscript' || (!language && isVBScriptCode(script));
    if (isVB) {
      const vbRes = executeVBScript(script, {
        value: (ctx as any).value,
        input: (ctx as any).input,
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
        namedSubStrings: ctx.namedDataSources
          ? Object.fromEntries(ctx.namedDataSources.map((n) => [n.name, n.defaultValue]))
          : {},
        libraries: (ctx as any).scriptLibraries,
        currentDateTime: (ctx as any).currentDateTime,
      }, undefined, mode);
      return vbRes.value;
    }

    // JavaScript evaluation
    const recordProxy = createRecordProxy(ctx.record || {});
    const namedProxy = createNamedSubStringsProxy(
      ctx.namedDataSources ? Object.fromEntries(ctx.namedDataSources.map((n) => [n.name, n.defaultValue])) : {}
    );
    let initialVal = (ctx as any).value !== undefined ? (ctx as any).value : (ctx as any).input !== undefined ? (ctx as any).input : '';

    // Checksum functions for JavaScript scope
    const Mod10CheckDigit = (data: any): string => {
      const s = String(data ?? '').replace(/\D/g, '');
      if (!s) return '0';
      let sum = 0;
      let multiplier = 3;
      for (let i = s.length - 1; i >= 0; i--) {
        sum += parseInt(s[i], 10) * multiplier;
        multiplier = multiplier === 3 ? 1 : 3;
      }
      return String((10 - (sum % 10)) % 10);
    };
    const GS1CheckDigit = Mod10CheckDigit;
    const Mod43CheckDigit = (data: any): string => {
      const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%';
      const s = String(data ?? '').toUpperCase();
      let sum = 0;
      for (let i = 0; i < s.length; i++) {
        const idx = chars.indexOf(s[i]);
        if (idx >= 0) sum += idx;
      }
      return chars[sum % 43];
    };

    let jsLibrariesHeader = '';
    if (Array.isArray((ctx as any).scriptLibraries)) {
      for (const lib of (ctx as any).scriptLibraries) {
        if (lib.code && lib.code.trim()) {
          jsLibrariesHeader += `\n${lib.code}\n`;
        }
      }
    }

    const scope = {
      value: initialVal,
      Value: initialVal,
      input: initialVal,
      Input: initialVal,
      record: recordProxy,
      Record: recordProxy,
      field: recordProxy,
      Field: recordProxy,
      namedSubStrings: namedProxy,
      NamedSubStrings: namedProxy,
      ctx,
      Date,
      Math,
      String,
      Number,
      Mod10CheckDigit,
      GS1CheckDigit,
      Format: createFormatProxy(namedProxy, (ctx as any).objects || (() => ({ Value: '' })), (ctx as any).format || {}),
      format: (expr: any, fmt?: string) => vbFormat(expr, fmt),
      pad: (val: any, len: number, char: string = '0') => String(val).padStart(len, char),
      formatDate: (d: Date, mask: string) => formatCustomDate(d, mask),
      now: () => new Date(),
    };

    const fnBody = `
      ${jsLibrariesHeader}
      ${script.includes('return ') ? script : (/^Value\\s*=/i.test(script.trim())) ? script + '; return Value;' : 'return ' + script}
    `;

    const fn = new Function(...Object.keys(scope), fnBody);
    const result = fn(...Object.values(scope));
    return result !== undefined && result !== null ? String(result) : '';
  } catch (err: any) {
    console.warn('Script evaluation error:', err);
    return `[Script Error: ${err.message}]`;
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

  if (item.type === 'control-character') {
    const rawValue = item.value || '';
    const code = item.controlCode || item.code || rawValue || 'CR';
    const cleanCode = String(code).replace(/[«»<>]/g, '').trim().toUpperCase();
    const definition = getControlByToken(cleanCode) || getControlByToken(String(code)) ||
      (rawValue.length === 1 ? getControlByCode(rawValue.charCodeAt(0)) : undefined) ||
      (item.decimal !== undefined ? getControlByCode(item.decimal) : undefined);
    return definition?.runtimeValue || resolveStoredControlValue(rawValue || '\r', item.valueEncoding);
  }

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
      raw = resolveStoredControlValue(item.value || '', item.valueEncoding);
      break;

    case 'database':
    case 'database-field': {
      const field = item.field || item.databaseField || (item.value ? item.value.replace(/[{}]/g, '') : '');
      const datasetId = item.datasetId || (item as any).connectionId;

      // 1. Direct record resolution if ctx.record is present
      if (ctx.record && field) {
        if (Object.prototype.hasOwnProperty.call(ctx.record, field)) {
          raw = ctx.record[field] == null ? '' : String(ctx.record[field]);
          break;
        }
        // Case-insensitive lookup fallback
        const matchKey = Object.keys(ctx.record || {}).find((k) => k.toLowerCase() === field.toLowerCase());
        if (matchKey !== undefined) {
          raw = ctx.record[matchKey] == null ? '' : String(ctx.record[matchKey]);
          break;
        }
      }

      // 2. Lookup in connected dataset or datasets registry
      const datasets = ctx.datasets || globalDatasetsRegistry;
      if (datasetId && datasets && datasets.length > 0) {
        const matchedDataset = datasets.find(
          (d: any) => d.id === datasetId || d.name?.toLowerCase() === datasetId.toLowerCase()
        );
        if (matchedDataset && matchedDataset.records && matchedDataset.records.length > 0) {
          const recIdx = ctx.currentRecordIndex ?? 0;
          const targetRec = matchedDataset.records[recIdx] || matchedDataset.records[0];
          if (targetRec && targetRec[field] !== undefined) {
            raw = String(targetRec[field]);
            break;
          }
        }
      }

      if (field) {
        raw = ctx.record || datasetId ? `[Missing field: ${field}]` : item.value || `[${field}]`;
      } else {
        raw = item.value || '';
      }
      break;
    }

    case 'serial': {
      if (item.serialization && item.serialization.enabled) {
        raw = item.serialization.currentValue || item.value || '1';
        break;
      }
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
      let baseDate = new Date();
      if ((ctx as any).currentDateTime) {
        const customDate = new Date((ctx as any).currentDateTime);
        if (!isNaN(customDate.getTime())) baseDate = customDate;
      }
      
      if (item.clockBase === 'database_field' && item.clockBaseField && ctx.record) {
        let rawDate = ctx.record[item.clockBaseField];
        if (rawDate === undefined) {
          const matchKey = Object.keys(ctx.record || {}).find((k) => k.toLowerCase() === item.clockBaseField!.toLowerCase());
          if (matchKey) rawDate = ctx.record[matchKey];
        }
        if (rawDate) {
          let parsedDate = new Date(rawDate);
          if (isNaN(parsedDate.getTime()) && typeof rawDate === 'string') {
             const parts = rawDate.split(/[-/]/);
             if (parts.length === 3 && parts[2].length === 4) {
               const y = parseInt(parts[2]);
               let m = parseInt(parts[1]) - 1;
               let d = parseInt(parts[0]);
               if (parseInt(parts[0]) <= 12 && parseInt(parts[1]) > 12) {
                 m = parseInt(parts[0]) - 1;
                 d = parseInt(parts[1]);
               }
               parsedDate = new Date(y, m, d);
             } else if (parts.length === 3 && parts[0].length === 4) {
               // YYYY-MM-DD
               parsedDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
             }
          }
          if (!isNaN(parsedDate.getTime())) {
             baseDate = parsedDate;
          }
        }
      }

      const offsetDays = resolveDynamicOffset(item.dateOffsetDaysSource, item.dateOffsetDays, item.dateOffsetDaysField, ctx);
      const offsetMonths = resolveDynamicOffset(item.dateOffsetMonthsSource, item.dateOffsetMonths, item.dateOffsetMonthsField, ctx);
      const offsetYears = resolveDynamicOffset(item.dateOffsetYearsSource, item.dateOffsetYears, item.dateOffsetYearsField, ctx);
      const offsetHours = resolveDynamicOffset(item.timeOffsetHoursSource, item.timeOffsetHours, item.timeOffsetHoursField, ctx);
      const offsetMinutes = resolveDynamicOffset(item.timeOffsetMinutesSource, item.timeOffsetMinutes, item.timeOffsetMinutesField, ctx);
      const offsetSeconds = resolveDynamicOffset(item.timeOffsetSecondsSource, item.timeOffsetSeconds, item.timeOffsetSecondsField, ctx);

      if (offsetYears !== 0) baseDate = vbDateAddObj('yyyy', offsetYears, baseDate);
      if (offsetMonths !== 0) baseDate = vbDateAddObj('m', offsetMonths, baseDate);
      if (offsetDays !== 0) baseDate = vbDateAddObj('d', offsetDays, baseDate);
      if (offsetHours !== 0) baseDate = vbDateAddObj('h', offsetHours, baseDate);
      if (offsetMinutes !== 0) baseDate = vbDateAddObj('n', offsetMinutes, baseDate);
      if (offsetSeconds !== 0) baseDate = vbDateAddObj('s', offsetSeconds, baseDate);

      let mask = item.dateFormat || item.clockDateFormat;
      if (!mask) {
        if (item.clockBase === 'time') {
          mask = item.clockTimeFormat || 'HH:mm:ss';
        } else if (item.clockBase === 'datetime') {
          mask = `${item.clockDateFormat || 'YYYY-MM-DD'} ${item.clockTimeFormat || 'HH:mm:ss'}`;
        } else {
          mask = 'YYYY-MM-DD';
        }
      }
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
      raw = evaluateSafeScript(item.scriptCode || item.value || '', ctx, item.scriptLanguage, item.scriptMode || 'multiline');
      break;
    }

    case 'linked':
    case 'object': {
      const targetId = item.linkedObjectId || (item as any).targetObjectId || (item as any).objectId;
      if (targetId && ctx.elements) {
        const stack = ctx.resolutionStack || new Set<string>();
        if (stack.has(targetId)) {
          raw = `[Circular Dependency: ${targetId}]`;
          break;
        }

        const target = ctx.elements.find((e) => e.id === targetId || (e as any).name?.toLowerCase() === targetId.toLowerCase());
        if (target) {
          const nextStack = new Set(stack);
          if ((item as any).elementId) nextStack.add((item as any).elementId);
          nextStack.add(target.id);

          raw = evaluateElementData(target, { ...ctx, resolutionStack: nextStack });
        } else {
          raw = `[Object Not Found: ${targetId}]`;
        }
      } else {
        raw = item.value || '';
      }
      break;
    }

    case 'global': {
      const gField = item.globalField || item.field || item.value;
      if (gField && ctx.globalData) {
        if (ctx.globalData[gField] !== undefined) {
          raw = String(ctx.globalData[gField]);
          break;
        }
        const match = Object.keys(ctx.globalData || {}).find((k) => k.toLowerCase() === gField.toLowerCase());
        if (match && ctx.globalData[match] !== undefined) {
          raw = String(ctx.globalData[match]);
          break;
        }
      }
      raw = item.value || '';
      break;
    }

    case 'external_file': {
      const filePath = item.filePath || item.value;
      if (!filePath) {
        raw = '';
        break;
      }
      if ((ctx as any).externalFiles && (ctx as any).externalFiles[filePath] !== undefined) {
        raw = String((ctx as any).externalFiles[filePath]);
        break;
      }
      raw = (item as any).fileContent || item.value || `[External File Missing: ${filePath}]`;
      break;
    }

    case 'print_job': {
      const pjField = item.printJobField || (item.value ? item.value.toLowerCase().replace(/[^a-z_]/g, '') : 'job_name');
      switch (pjField) {
        case 'job_name':
        case 'printjobname':
          raw = ctx.jobName || ctx.jobId || 'PrintJob_1';
          break;
        case 'printer_name':
        case 'printername':
          raw = ctx.printerName || 'Default Printer';
          break;
        case 'copies':
          raw = String(ctx.copyNumber || (ctx as any).copies || 1);
          break;
        case 'record_number':
        case 'recordnumber':
          raw = String((ctx.currentRecordIndex ?? 0) + 1);
          break;
        case 'total_records':
        case 'totalrecords':
          raw = String(ctx.totalRecords || 1);
          break;
        case 'timestamp':
        case 'printtimestamp':
          raw = formatCustomDate(new Date(), item.dateFormat || 'YYYY-MM-DD HH:mm:ss');
          break;
        default:
          raw = item.value || '';
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

    case 'formula': {
      const expr = item.formulaExpression || (item as any).formula || item.value || '';
      if (expr) {
        const cleanExpr = expr.startsWith('=') ? expr.slice(1) : expr;
        const evalRes = evaluateFormula(cleanExpr, {
          record: ctx.record || {},
          variables: ctx.variables ? Object.fromEntries(ctx.variables.map((v) => [v.name, v.defaultValue])) : {},
          namedSources: ctx.namedDataSources ? Object.fromEntries(ctx.namedDataSources.map((n) => [n.name, n.defaultValue])) : {},
          system: {
            DATE: formatCustomDate(new Date(), 'YYYY-MM-DD'),
            TIME: formatCustomDate(new Date(), 'HH:mm:ss'),
            USER: ctx.userName || 'Current User',
            PRINTER: ctx.printerName || 'Default Zebra ZT410',
            JOB_ID: ctx.jobId || 'JOB-001',
            RECORD_NUMBER: (ctx.currentRecordIndex ?? 0) + 1,
            TOTAL_RECORDS: ctx.totalRecords || 1,
          },
        });
        raw = evalRes.success ? String(evalRes.value) : `[Formula Error: ${evalRes.error}]`;
      }
      break;
    }

    default:
      raw = item.value || '';
  }

  // 0. Data Type Formatting (if configured on item directly and not already in transformConfig)
  // NEVER apply data type formatting to control characters!
  if (item.dataType && item.dataType !== 'text' && !item.transformConfig?.dataTypeFormat) {
    raw = applyDataTypeFormatting(raw, {
      dataType: item.dataType,
      decimalPlaces: item.numberFormat?.decimalPlaces,
      thousandSeparator: item.numberFormat?.thousandSeparator,
      decimalSeparator: item.numberFormat?.decimalSeparator,
      leadingZeros: item.numberFormat?.leadingZeros,
      dateFormat: item.dateFormat,
    });
  }

  // 1. If item has structured transformConfig, run complete enterprise pipeline
  if (item.transformConfig) {
    raw = executeEnterpriseTransformPipeline(raw, item.transformConfig, {
      record: ctx.record,
      printIndex: ctx.printIndex ?? ctx.currentRecordIndex ?? 0,
      recordIndex: ctx.currentRecordIndex ?? 0,
      copyIndex: ctx.copyNumber ?? 0,
    });
  }

  // 2. If item has serialization directly attached (and not already executed via transformConfig)
  if (item.serialization && item.serialization.action !== 'none' && !item.transformConfig?.serialization) {
    raw = evaluateSerializedValue(raw, item.serialization, {
      printIndex: ctx.printIndex ?? ctx.currentRecordIndex ?? 0,
      recordIndex: ctx.currentRecordIndex ?? 0,
      copyIndex: ctx.copyNumber ?? 0,
    });
  }

  // 3. If item has prefixSuffix directly attached (and not already executed via transformConfig)
  if (item.prefixSuffix && !item.transformConfig?.prefixSuffix) {
    const pfx = item.prefixSuffix.prefix ?? '';
    const sfx = item.prefixSuffix.suffix ?? '';
    raw = `${pfx}${raw}${sfx}`;
  }

  // 4. Apply legacy/rules-based transforms pipeline
  if (item.transforms && item.transforms.length > 0) {
    raw = applyTransformPipeline(raw, item.transforms, ctx);
  }

  // 5. OnProcessData Script Hook (BarTender Stage)
  if (item.onProcessDataEnabled && item.onProcessDataScript) {
    raw = evaluateSafeScript(item.onProcessDataScript, { ...ctx, value: raw, input: raw } as any, item.onProcessDataLanguage);
  }

  return resolveStoredControlValue(raw, item.valueEncoding);
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

  // 3b. Global Data
  if (ctx.globalData) {
    for (const [k, v] of Object.entries(ctx.globalData)) {
      result = result.replace(new RegExp(`\\{{1,2}Global\\.${escapeRx(k)}\\}{1,2}`, 'gi'), String(v ?? ''));
    }
  }

  // 3c. Print Job Fields
  result = result.replace(/\{{1,2}PrintJob\.JobName\}{1,2}/gi, ctx.jobName || ctx.jobId || 'PrintJob_1');
  result = result.replace(/\{{1,2}PrintJob\.PrinterName\}{1,2}/gi, ctx.printerName || 'Default Printer');
  result = result.replace(/\{{1,2}PrintJob\.Copies\}{1,2}/gi, String(ctx.copyNumber || 1));
  result = result.replace(/\{{1,2}PrintJob\.RecordNumber\}{1,2}/gi, String((ctx.currentRecordIndex ?? 0) + 1));
  result = result.replace(/\{{1,2}PrintJob\.TotalRecords\}{1,2}/gi, String(ctx.totalRecords || 1));
  result = result.replace(/\{{1,2}PrintJob\.Timestamp\}{1,2}/gi, formatCustomDate(new Date(), 'YYYY-MM-DD HH:mm:ss'));

  // 4. Variables
  if (ctx.variables) {
    for (const v of ctx.variables) {
      result = result.replace(new RegExp(`\\{{1,2}${escapeRx(v.name)}\\}{1,2}`, 'gi'), String(v.defaultValue || ''));
    }
  }

  return result;
}

/**
 * Computes the effective font for an individual Data Source following the BarTender inheritance model:
 * - If fontOverrideEnabled is false or not set, inherits all typography properties from the Text Object default font.
 * - If fontOverrideEnabled is true, merges the source-specific fontStyleOverride on top of the Text Object default font.
 */
export function getEffectiveSourceFont(
  source: Partial<DataSourceItem> | undefined,
  element: Partial<TextElement>
): DataSourceFontOverride {
  const isUnderline = element.underline || element.textDecoration === 'underline';
  const isStrikeout = element.strikeout || element.textDecoration === 'line-through';

  const defaultStyle: DataSourceFontOverride = {
    fontFamily: element.fontFamily || 'Arial',
    fontSize: element.fontSize !== undefined ? element.fontSize : 12,
    fontWeight: element.fontWeight || 'normal',
    fontStyle: element.fontStyle || 'normal',
    underline: !!isUnderline,
    strikeout: !!isStrikeout,
    whiteOnBlack: !!element.whiteOnBlack,
    color: element.whiteOnBlack ? '#ffffff' : (element.foregroundColor || element.color || '#000000'),
    backgroundColor: element.backgroundColor && element.backgroundColor !== 'transparent' ? element.backgroundColor : 'transparent',
    fontWidthScale: element.fontWidthScale !== undefined ? element.fontWidthScale : 100,
    textOutline: element.textOutline ? { ...element.textOutline } : undefined,
    letterSpacing: element.letterSpacing || 0,
  };

  if (!source) return defaultStyle;

  const isOverrideActive = !!(source.fontOverrideEnabled || (source.fontStyleOverride && Object.keys(source.fontStyleOverride).length > 0) || (source.fontOverride && Object.keys(source.fontOverride).length > 0));
  if (!isOverrideActive) {
    return defaultStyle;
  }

  const override = source.fontStyleOverride || source.fontOverride || {};

  return {
    fontFamily: override.fontFamily || defaultStyle.fontFamily,
    fontSize: override.fontSize !== undefined ? override.fontSize : defaultStyle.fontSize,
    fontWeight: override.fontWeight || defaultStyle.fontWeight,
    fontStyle: override.fontStyle || defaultStyle.fontStyle,
    underline: override.underline !== undefined ? override.underline : defaultStyle.underline,
    strikeout: override.strikeout !== undefined ? override.strikeout : defaultStyle.strikeout,
    whiteOnBlack: override.whiteOnBlack !== undefined ? override.whiteOnBlack : defaultStyle.whiteOnBlack,
    color: override.whiteOnBlack
      ? '#ffffff'
      : (override.color || (override.whiteOnBlack === false && defaultStyle.whiteOnBlack ? '#000000' : defaultStyle.color)),
    backgroundColor: override.backgroundColor !== undefined ? override.backgroundColor : defaultStyle.backgroundColor,
    fontWidthScale: override.fontWidthScale !== undefined ? override.fontWidthScale : defaultStyle.fontWidthScale,
    textOutline: override.textOutline !== undefined ? override.textOutline : defaultStyle.textOutline,
    letterSpacing: override.letterSpacing !== undefined ? override.letterSpacing : defaultStyle.letterSpacing,
  };
}

/**
 * Returns true if the Text Object has 2+ data sources and at least one has an active font override.
 */
export function hasDataSourceFontOverrides(element: Partial<TextElement>): boolean {
  if (!element.dataSources || element.dataSources.length <= 1) return false;
  return element.dataSources.some((ds) => !!(ds.fontOverrideEnabled && (ds.fontStyleOverride || ds.fontOverride)));
}

/**
 * Rich Text Run Resolver (Spec 5):
 * Resolves an ordered list of runs for a Text Object preserving individual source boundaries and formatting.
 * Control characters (<CR>, <LF>) are preserved as structured runs.
 */
export function evaluateTextElementRuns(
  element: TextElement,
  ctx: EvaluationContext = {}
): ResolvedTextRun[] {
  if (element.dataSources && element.dataSources.length > 0) {
    return element.dataSources.filter(item => item.enabled !== false).map((item, idx) => {
      const sourceId = item.id || `ds-${idx}`;
      const style = getEffectiveSourceFont(item, element);

      // Handle control character data source
      if (item.type === 'control-character') {
        const cCode = item.controlCode || item.code || (item.value ? item.value.replace(/[«»<>]/g, '') : 'CR');
        const cDef = getControlByToken(cCode) || (item.decimal !== undefined ? getControlByCode(item.decimal) : undefined);
        const runtimeVal = cDef ? cDef.runtimeValue : (cCode === 'CR' ? '\r' : cCode === 'LF' ? '\n' : item.value || '\r');
        return {
          sourceId,
          type: 'control',
          value: runtimeVal,
          controlCode: cCode,
          style,
        };
      }

      // Standard / data-driven data source
      const rawResolved = evaluateDataSourceItem(item, ctx, idx);
      const isControlToken = rawResolved === '\r';
      const isLfToken = rawResolved === '\n';
      const isCrlfToken = rawResolved === '\r\n';

      if (isControlToken || isLfToken || isCrlfToken) {
        return {
          sourceId,
          type: 'control',
          value: isControlToken ? '\r' : isLfToken ? '\n' : '\r\n',
          controlCode: isControlToken ? 'CR' : isLfToken ? 'LF' : 'CRLF',
          style,
        };
      }

      return {
        sourceId,
        type: 'text',
        value: rawResolved,
        style,
      };
    });
  }

  // Single default run if no dataSources array
  const fullText = evaluateTextElement(element, ctx);
  return [
    {
      sourceId: element.id || 'default-run',
      type: 'text',
      value: fullText,
      style: getEffectiveSourceFont(undefined, element),
    },
  ];
}

/**
 * Central text evaluator conforming to Phase 16 & 17
 */
export function evaluateTextElement(element: TextElement, ctx: EvaluationContext = {}): string {
  // If element has multi-data sources defined and populated
  if (element.dataSources && element.dataSources.length > 0) {
    const combined = element.dataSources.map((item, idx) => evaluateDataSourceItem(item, ctx, idx)).join('');
    return applyTextTransformsPreservingLineBreaks(combined, element.transforms, ctx);
  }

  let baseValue = element.text || '';
  const binding = element.dataBinding;
  if (binding) {
    if (typeof binding === 'string' && binding.startsWith('=')) {
      const cleanExpr = binding.slice(1);
      const evalRes = evaluateFormula(cleanExpr, {
        record: ctx.record || {},
        variables: ctx.variables ? Object.fromEntries(ctx.variables.map((v) => [v.name, v.defaultValue])) : {},
        namedSources: ctx.namedDataSources ? Object.fromEntries(ctx.namedDataSources.map((n) => [n.name, n.defaultValue])) : {},
        system: {
          DATE: formatCustomDate(new Date(), 'YYYY-MM-DD'),
          TIME: formatCustomDate(new Date(), 'HH:mm:ss'),
          USER: ctx.userName || 'Current User',
          PRINTER: ctx.printerName || 'Default Zebra ZT410',
          JOB_ID: ctx.jobId || 'JOB-001',
          RECORD_NUMBER: (ctx.currentRecordIndex ?? 0) + 1,
          TOTAL_RECORDS: ctx.totalRecords || 1,
        },
      });
      baseValue = evalRes.success ? String(evalRes.value) : `[Formula Error: ${evalRes.error}]`;
    } else {
      baseValue = interpolateDynamicTokens(binding, ctx);
    }
  } else {
    baseValue = interpolateDynamicTokens(baseValue, ctx);
  }

  return resolveDataSourceValue(applyTextTransformsPreservingLineBreaks(baseValue, element.transforms, ctx));
}

function applyTextTransformsPreservingLineBreaks(input: string, rules: TextElement['transforms'], context: EvaluationContext): string {
  if (!rules?.length) return input;
  let output = input;
  for (const rule of rules) {
    if (rule.type === 'prefix_suffix') {
      output = applyTransformPipeline(output, [rule], context);
      continue;
    }
    output = output.split(/(\r\n|\r|\n)/g).map((part) =>
      part === '\r' || part === '\n' || part === '\r\n'
        ? part
        : applyTransformPipeline(part, [rule], context)
    ).join('');
  }
  return output;
}

/**
 * Normalizes a resolved image reference into a browser/Electron-loadable src.
 * - data:, http(s):, file:, blob: and app-relative paths are returned as-is
 * - bare OS paths (C:\..., /home/...) are converted to file:// URLs
 */
export function normalizeImageSource(ref: string, baseFolder?: string): string {
  if (!ref) return '';
  const trimmed = ref.trim();
  if (/^(data:|https?:|file:|blob:|app:)/i.test(trimmed)) return trimmed;

  let full = trimmed;
  // Resolve relative names against a configured base folder
  const isAbsolute = /^([a-zA-Z]:[\\/]|[\\/])/.test(trimmed);
  if (!isAbsolute && baseFolder) {
    const sep = baseFolder.includes('\\') ? '\\' : '/';
    full = baseFolder.replace(/[\\/]+$/, '') + sep + trimmed;
  }

  // Convert Windows/Unix path to a file:// URL
  const forwardSlashes = full.replace(/\\/g, '/');
  if (/^[a-zA-Z]:\//.test(forwardSlashes)) {
    return 'file:///' + encodeURI(forwardSlashes);
  }
  if (forwardSlashes.startsWith('/')) {
    return 'file://' + encodeURI(forwardSlashes);
  }
  return trimmed;
}

/**
 * Resolves the effective image src for an image element, honoring data binding
 * (spec 27). Falls back to fallbackSrc / static src when the bound value is
 * empty or unresolvable so record navigation never shows a broken image.
 */
export function resolveImageElementSrc(element: LabelElement, ctx: EvaluationContext = {}): string {
  const img = element as any;
  const fallback = img.fallbackSrc || img.src || '';

  const isBound =
    img.imageSourceType === 'database' ||
    !!img.imageField ||
    !!img.dataBinding ||
    (Array.isArray(img.dataSources) && img.dataSources.length > 0);

  if (!isBound) return img.src || fallback;

  let resolved = '';
  if (img.imageField && ctx.record) {
    const key = Object.keys(ctx.record || {}).find((k) => k.toLowerCase() === String(img.imageField).toLowerCase());
    resolved = key !== undefined ? String(ctx.record[key] ?? '') : '';
  } else {
    // Reuse the central resolver for dataSources / dataBinding tokens
    resolved = evaluateElementData(element, ctx);
  }

  if (!resolved || !resolved.trim()) return fallback;
  return normalizeImageSource(resolved, img.imageBaseFolder);
}

/**
 * Evaluates the full concatenated value for any element
 */
export function evaluateElementData(element: LabelElement, ctx: EvaluationContext = {}): string {
  if (element.type === 'text') {
    return evaluateTextElement(element as TextElement, ctx);
  }

  // Barcodes and other elements
  if (element.dataSources && element.dataSources.length > 0) {
    const combined = element.dataSources.map((item, idx) => evaluateDataSourceItem(item, ctx, idx)).join('');
    return resolveDataSourceValue(applyTransformPipeline(combined, element.transforms, ctx));
  }

  let baseValue = '';
  if (element.type === 'barcode') {
    baseValue = element.value || (element as any).barcodeValue || (element as any).content || '';
  }

  const binding = (element as any).dataBinding;
  if (binding) {
    if (typeof binding === 'string' && binding.startsWith('=')) {
      const cleanExpr = binding.slice(1);
      const evalRes = evaluateFormula(cleanExpr, {
        record: ctx.record || {},
        variables: ctx.variables ? Object.fromEntries(ctx.variables.map((v) => [v.name, v.defaultValue])) : {},
        namedSources: ctx.namedDataSources ? Object.fromEntries(ctx.namedDataSources.map((n) => [n.name, n.defaultValue])) : {},
        system: {
          DATE: formatCustomDate(new Date(), 'YYYY-MM-DD'),
          TIME: formatCustomDate(new Date(), 'HH:mm:ss'),
          USER: ctx.userName || 'Current User',
          PRINTER: ctx.printerName || 'Default Zebra ZT410',
          JOB_ID: ctx.jobId || 'JOB-001',
          RECORD_NUMBER: (ctx.currentRecordIndex ?? 0) + 1,
          TOTAL_RECORDS: ctx.totalRecords || 1,
        },
      });
      baseValue = evalRes.success ? String(evalRes.value) : `[Formula Error: ${evalRes.error}]`;
    } else {
      baseValue = interpolateDynamicTokens(binding, ctx);
    }
  } else {
    baseValue = interpolateDynamicTokens(baseValue, ctx);
  }

  return resolveDataSourceValue(applyTransformPipeline(baseValue, element.transforms, ctx));
}
