import { TransformRule, TransformConfig, DataTypeFormatConfig } from '../types';
import { evaluateSerializedValue } from './serializationEngine';
import { executeVBScript, isVBScriptCode, createRecordProxy, parseVBDate } from './vbscriptEngine';

/**
 * Formats a value according to DataType configuration (Number, Date, Currency, etc.)
 */
export function applyDataTypeFormatting(input: any, config?: DataTypeFormatConfig): string {
  if (input === null || input === undefined) return '';
  if (!config) return String(input);

  // If data type is 'text' or not specified, preserve raw string verbatim without trimming!
  // Trimming destroys meaningful control characters such as \r, \n, \t.
  if (!config.dataType || config.dataType === 'text') {
    return String(input);
  }

  const rawStr = String(input).trim();

  switch (config.dataType) {
    case 'number':
    case 'integer':
    case 'decimal':
    case 'currency': {
      const cleanNum = parseFloat(rawStr.replace(/[^0-9.-]+/g, ''));
      if (isNaN(cleanNum)) return rawStr;

      let decimals = config.decimalPlaces ?? (config.dataType === 'integer' ? 0 : 2);
      let formattedNumber = cleanNum.toFixed(decimals);

      if (config.thousandSeparator) {
        const parts = formattedNumber.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        if (config.decimalSeparator && config.decimalSeparator !== '.') {
          formattedNumber = parts.join(config.decimalSeparator);
        } else {
          formattedNumber = parts.join('.');
        }
      }

      if (config.leadingZeros && config.leadingZeros > 0) {
        const parts = formattedNumber.split(config.decimalSeparator || '.');
        const intPart = parts[0].replace(/,/g, '');
        if (intPart.length < config.leadingZeros) {
          parts[0] = intPart.padStart(config.leadingZeros, '0');
          formattedNumber = parts.join(config.decimalSeparator || '.');
        }
      }

      if (config.dataType === 'currency') {
        const sym = config.currencySymbol || '$';
        return config.currencySymbolPosition === 'suffix' ? `${formattedNumber} ${sym}` : `${sym}${formattedNumber}`;
      }

      return formattedNumber;
    }

    case 'date':
    case 'time':
    case 'datetime': {
      const d = parseVBDate(rawStr);
      if (!d || isNaN(d.getTime())) return rawStr;
      const mask = config.dateFormat || (config.dataType === 'time' ? 'HH:mm:ss' : 'YYYY-MM-DD');
      
      const yyyy = d.getFullYear().toString();
      const yy = yyyy.slice(-2);
      const mm = (d.getMonth() + 1).toString().padStart(2, '0');
      const dd = d.getDate().toString().padStart(2, '0');
      const hh = d.getHours().toString().padStart(2, '0');
      const min = d.getMinutes().toString().padStart(2, '0');
      const ss = d.getSeconds().toString().padStart(2, '0');
      const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const mmm = monthsShort[d.getMonth()];

      let out = mask;
      out = out.replace(/YYYY/g, yyyy);
      out = out.replace(/YY/g, yy);
      out = out.replace(/MMM/g, mmm);
      out = out.replace(/MM/g, mm);
      out = out.replace(/DD/g, dd);
      out = out.replace(/dd/g, dd);
      out = out.replace(/HH/g, hh);
      out = out.replace(/mm/g, min);
      out = out.replace(/ss/g, ss);
      return out;
    }

    case 'boolean': {
      const lower = rawStr.toLowerCase();
      return lower === 'true' || lower === '1' || lower === 'yes' ? 'True' : 'False';
    }

    default:
      return rawStr;
  }
}

/**
 * Character Template Masking: e.g. template "AAA-9999", input "ABC1234" -> "ABC-1234"
 * A = letter, 9/# = digit, * = any character
 */
export function applyCharacterTemplate(input: string, template?: string): string {
  if (!template || !template.trim() || !input) return input;
  
  let inputIdx = 0;
  let result = '';

  for (let i = 0; i < template.length && inputIdx < input.length; i++) {
    const maskChar = template[i];
    const inChar = input[inputIdx];

    if (maskChar === '9' || maskChar === '#') {
      if (/\d/.test(inChar)) {
        result += inChar;
        inputIdx++;
      } else {
        // Skip non-matching input character or keep trying
        inputIdx++;
        i--;
      }
    } else if (maskChar === 'A' || maskChar === 'a') {
      if (/[a-zA-Z]/.test(inChar)) {
        result += maskChar === 'A' ? inChar.toUpperCase() : inChar.toLowerCase();
        inputIdx++;
      } else {
        inputIdx++;
        i--;
      }
    } else if (maskChar === '*' || maskChar === '?') {
      result += inChar;
      inputIdx++;
    } else {
      // Literal template delimiter (e.g. '-', '/', ':', ' ')
      result += maskChar;
      if (inChar === maskChar) {
        inputIdx++;
      }
    }
  }

  return result;
}

/**
 * Applies the deterministic Enterprise Transform Pipeline to an input value:
 * 1. raw
 * 2. dataType
 * 3. suppression
 * 4. characterFilter
 * 5. truncation
 * 6. characterLength
 * 7. template
 * 8. searchReplace
 * 9. script
 * 10. serialization
 * 11. prefixSuffix
 */
export function executeEnterpriseTransformPipeline(
  rawValue: any,
  config?: TransformConfig,
  context?: {
    record?: Record<string, any>;
    printIndex?: number;
    recordIndex?: number;
    copyIndex?: number;
  }
): string {
  if (rawValue === null || rawValue === undefined) return '';
  let str = String(rawValue);

  if (!config) return str;

  // 1. Data Type & Formatting (skip if text type to avoid destroying control characters)
  if (config.dataTypeFormat && config.dataTypeFormat.dataType !== 'text') {
    str = applyDataTypeFormatting(str, config.dataTypeFormat);
  }

  // 2. Suppression (do NOT use str.trim() which destroys control characters like \r)
  if (config.suppression && config.suppression.type !== 'never') {
    const sType = config.suppression.type;
    if (sType === 'always') return '';
    if (sType === 'empty' && str === '') return '';
    if (sType === 'equals' && str === (config.suppression.value ?? '')) return '';
    if (sType === 'not_equals' && str !== (config.suppression.value ?? '')) return '';
  }

  // 3. Character Filter
  if (config.characterFilter && config.characterFilter.type !== 'none') {
    const cf = config.characterFilter;
    if (cf.type === 'digits') {
      str = str.replace(/\D/g, '');
    } else if (cf.type === 'letters') {
      str = str.replace(/[^a-zA-Z]/g, '');
    } else if (cf.type === 'alphanumeric') {
      str = str.replace(/[^a-zA-Z0-9]/g, '');
    } else if (cf.type === 'uppercase') {
      str = str.toUpperCase();
    } else if (cf.type === 'lowercase') {
      str = str.toLowerCase();
    } else if (cf.type === 'custom_allowed' && cf.customChars) {
      const allowedSet = new Set(cf.customChars.split(''));
      str = str.split('').filter((c) => allowedSet.has(c)).join('');
    } else if (cf.type === 'custom_blocked' && cf.customChars) {
      const blockedSet = new Set(cf.customChars.split(''));
      str = str.split('').filter((c) => !blockedSet.has(c)).join('');
    }
  }

  // 4. Truncation
  if (config.truncation && config.truncation.type !== 'none') {
    const count = Math.max(0, config.truncation.count || 0);
    if (config.truncation.type === 'keep_first') {
      str = str.substring(0, count);
    } else if (config.truncation.type === 'keep_last') {
      str = str.substring(Math.max(0, str.length - count));
    } else if (config.truncation.type === 'delete_first') {
      str = str.substring(count);
    } else if (config.truncation.type === 'delete_last') {
      str = str.substring(0, Math.max(0, str.length - count));
    }
  }

  // 5. Character Length & Padding
  if (config.characterLength) {
    const cl = config.characterLength;
    if (cl.min && str.length < cl.min) {
      const padChar = cl.padChar || '0';
      if (cl.padSide === 'right') {
        str = str.padEnd(cl.min, padChar);
      } else {
        str = str.padStart(cl.min, padChar);
      }
    }
    if (cl.max && str.length > cl.max && cl.overflowAction !== 'none') {
      str = str.substring(0, cl.max);
    }
  }

  // 6. Character Template
  if (config.characterTemplate?.template) {
    str = applyCharacterTemplate(str, config.characterTemplate.template);
  }

  // 7. Search & Replace Rules
  if (config.searchReplace && Array.isArray(config.searchReplace)) {
    for (const rule of config.searchReplace) {
      if (!rule.find) continue;
      const rep = rule.replace ?? '';
      if (rule.isRegex) {
        try {
          const flags = rule.caseSensitive ? 'g' : 'gi';
          const reg = new RegExp(rule.find, flags);
          str = str.replace(reg, rep);
        } catch {
          str = str.split(rule.find).join(rep);
        }
      } else if (rule.wholeWord) {
        const flags = rule.caseSensitive ? 'g' : 'gi';
        const reg = new RegExp(`\\b${rule.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, flags);
        str = str.replace(reg, rep);
      } else if (rule.caseSensitive) {
        str = str.split(rule.find).join(rep);
      } else {
        const reg = new RegExp(rule.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        str = str.replace(reg, rep);
      }
    }
  }

  // 8. Script Execution
  if (config.script?.code) {
    try {
      const code = config.script.code;
      const isVB = config.script.language === 'vbscript' || (!config.script.language && isVBScriptCode(code));
      if (isVB) {
        const vbRes = executeVBScript(code, {
          value: str,
          input: str,
          record: context?.record || {},
        });
        if (vbRes.success) {
          str = vbRes.value;
        } else if (vbRes.error) {
          str = `[Script Error: ${vbRes.error}]`;
        }
      } else {
        const recordProxy = createRecordProxy(context?.record || {});
        const scope = {
          value: str,
          input: str,
          Value: str,
          Input: str,
          record: recordProxy,
          Record: recordProxy,
          field: recordProxy,
          Field: recordProxy,
          Date,
          Math,
          String,
          Number,
        };
        const fn = new Function(...Object.keys(scope), `return (function() { ${code.includes('return') ? code : 'return ' + code} })()`);
        const scriptRes = fn(...Object.values(scope));
        if (scriptRes !== undefined && scriptRes !== null) {
          str = String(scriptRes);
        }
      }
    } catch (err: any) {
      console.warn('Transform Script evaluation warning:', err);
      str = `[Script Error: ${err.message}]`;
    }
  }

  // 9. Serialization
  if (config.serialization && config.serialization.action !== 'none') {
    str = evaluateSerializedValue(str, config.serialization, context);
  }

  // 10. Prefix & Suffix
  if (config.prefixSuffix) {
    const p = config.prefixSuffix.prefix ?? '';
    const s = config.prefixSuffix.suffix ?? '';
    str = `${p}${str}${s}`;
  }

  return str;
}

/**
 * Backward compatible single rule executor
 */
export function applyTransformRule(input: string, rule: TransformRule, context?: any): string {
  if (input === undefined || input === null) return '';
  let str = String(input);
  const params = rule.params || (rule as any);

  switch (rule.type) {
    case 'truncate':
    case 'substring': {
      const start = Math.max(0, params.startIndex ?? 0);
      const len = params.length !== undefined && params.length > 0 ? params.length : str.length;
      return str.substring(start, start + len);
    }

    case 'search_replace': {
      const search = params.search ?? '';
      const replace = params.replace ?? '';
      if (!search) return str;
      if (params.isRegex) {
        try {
          const reg = new RegExp(search, params.regexFlags || 'g');
          return str.replace(reg, replace);
        } catch {
          return str.split(search).join(replace);
        }
      }
      return str.split(search).join(replace);
    }

    case 'regex': {
      if (!params.regexPattern) return str;
      try {
        const reg = new RegExp(params.regexPattern, params.regexFlags || '');
        const match = str.match(reg);
        if (match) {
          return match[1] !== undefined ? match[1] : match[0];
        }
        return '';
      } catch {
        return str;
      }
    }

    case 'trim': {
      if (params.trimType === 'start') return str.trimStart();
      if (params.trimType === 'end') return str.trimEnd();
      return str.trim();
    }

    case 'case': {
      if (params.caseType === 'uppercase') return str.toUpperCase();
      if (params.caseType === 'lowercase') return str.toLowerCase();
      if (params.caseType === 'titlecase') {
        return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
      }
      if (params.caseType === 'sentencecase') {
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
      }
      return str;
    }

    case 'pad': {
      const len = Math.max(0, params.padLength ?? 0);
      const char = (params.padChar && params.padChar.length > 0) ? params.padChar[0] : '0';
      if (params.padSide === 'right') {
        return str.padEnd(len, char);
      }
      return str.padStart(len, char);
    }

    case 'prefix_suffix': {
      const p = params.prefix ?? '';
      const s = params.suffix ?? '';
      return `${p}${str}${s}`;
    }

    case 'math': {
      const num = parseFloat(str);
      if (isNaN(num)) return str;
      const opVal = params.mathValue ?? 0;
      let res = num;
      if (params.mathOperation === 'add') res = num + opVal;
      else if (params.mathOperation === 'subtract') res = num - opVal;
      else if (params.mathOperation === 'multiply') res = num * opVal;
      else if (params.mathOperation === 'divide' && opVal !== 0) res = num / opVal;
      else if (params.mathOperation === 'round') res = Math.round(num);
      return String(res);
    }

    case 'script': {
      const code = (params as any).scriptCode || (params as any).code || (rule as any).scriptCode || '';
      if (!code) return str;
      const lang = (params as any).scriptLanguage || (params as any).language || (rule as any).scriptLanguage;
      const isVB = lang === 'vbscript' || (!lang && isVBScriptCode(code));
      if (isVB) {
        const res = executeVBScript(code, {
          value: str,
          input: str,
          record: context?.record || {},
        });
        return res.success ? res.value : `[Script Error: ${res.error || 'Execution failed'}]`;
      }
      try {
        const recordProxy = createRecordProxy(context?.record || {});
        const scope = {
          value: str,
          input: str,
          Value: str,
          Input: str,
          record: recordProxy,
          Record: recordProxy,
          field: recordProxy,
          Field: recordProxy,
          Date,
          Math,
          String,
          Number,
        };
        const fn = new Function(...Object.keys(scope), `
          ${code.includes('return ') ? code : (code.trim().startsWith('Value =') || code.trim().startsWith('value =')) ? code + '; return Value;' : 'return ' + code}
        `);
        const out = fn(...Object.values(scope));
        return out !== undefined && out !== null ? String(out) : str;
      } catch (err: any) {
        return `[Script Error: ${err.message}]`;
      }
    }

    default:
      return str;
  }
}

/**
 * Runs a pipeline of multiple transform rules sequentially
 */
export function applyTransformPipeline(input: string, rules?: TransformRule[], context?: any): string {
  if (!rules || !rules.length) return input;
  return rules.reduce((acc, rule) => applyTransformRule(acc, rule, context), input);
}
