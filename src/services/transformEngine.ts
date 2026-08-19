import { TransformRule } from '../types';

/**
 * Applies a single transformation rule to an input string
 */
export function applyTransformRule(input: string, rule: TransformRule): string {
  if (input === undefined || input === null) return '';
  let str = String(input);
  const { params } = rule;

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

    case 'encode_decode': {
      if (params.encodeType === 'base64') {
        try {
          if (params.encodeAction === 'decode') return atob(str);
          return btoa(str);
        } catch {
          return str;
        }
      }
      if (params.encodeType === 'hex') {
        if (params.encodeAction === 'decode') {
          try {
            return str.match(/.{1,2}/g)?.map(byte => String.fromCharCode(parseInt(byte, 16))).join('') || '';
          } catch {
            return str;
          }
        }
        return Array.from(str).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
      }
      if (params.encodeType === 'url') {
        try {
          if (params.encodeAction === 'decode') return decodeURIComponent(str);
          return encodeURIComponent(str);
        } catch {
          return str;
        }
      }
      return str;
    }

    default:
      return str;
  }
}

/**
 * Runs a pipeline of multiple transform rules sequentially
 */
export function applyTransformPipeline(input: string, rules?: TransformRule[]): string {
  if (!rules || !rules.length) return input;
  return rules.reduce((acc, rule) => applyTransformRule(acc, rule), input);
}
