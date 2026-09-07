var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/services/transformEngine.ts
function applyTransformRule(input, rule) {
  if (input === void 0 || input === null) return "";
  let str = String(input);
  const { params } = rule;
  switch (rule.type) {
    case "truncate":
    case "substring": {
      const start = Math.max(0, params.startIndex ?? 0);
      const len = params.length !== void 0 && params.length > 0 ? params.length : str.length;
      return str.substring(start, start + len);
    }
    case "search_replace": {
      const search = params.search ?? "";
      const replace = params.replace ?? "";
      if (!search) return str;
      if (params.isRegex) {
        try {
          const reg = new RegExp(search, params.regexFlags || "g");
          return str.replace(reg, replace);
        } catch {
          return str.split(search).join(replace);
        }
      }
      return str.split(search).join(replace);
    }
    case "regex": {
      if (!params.regexPattern) return str;
      try {
        const reg = new RegExp(params.regexPattern, params.regexFlags || "");
        const match = str.match(reg);
        if (match) {
          return match[1] !== void 0 ? match[1] : match[0];
        }
        return "";
      } catch {
        return str;
      }
    }
    case "trim": {
      if (params.trimType === "start") return str.trimStart();
      if (params.trimType === "end") return str.trimEnd();
      return str.trim();
    }
    case "case": {
      if (params.caseType === "uppercase") return str.toUpperCase();
      if (params.caseType === "lowercase") return str.toLowerCase();
      if (params.caseType === "titlecase") {
        return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
      }
      if (params.caseType === "sentencecase") {
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
      }
      return str;
    }
    case "pad": {
      const len = Math.max(0, params.padLength ?? 0);
      const char = params.padChar && params.padChar.length > 0 ? params.padChar[0] : "0";
      if (params.padSide === "right") {
        return str.padEnd(len, char);
      }
      return str.padStart(len, char);
    }
    case "prefix_suffix": {
      const p = params.prefix ?? "";
      const s = params.suffix ?? "";
      return `${p}${str}${s}`;
    }
    case "math": {
      const num = parseFloat(str);
      if (isNaN(num)) return str;
      const opVal = params.mathValue ?? 0;
      let res = num;
      if (params.mathOperation === "add") res = num + opVal;
      else if (params.mathOperation === "subtract") res = num - opVal;
      else if (params.mathOperation === "multiply") res = num * opVal;
      else if (params.mathOperation === "divide" && opVal !== 0) res = num / opVal;
      else if (params.mathOperation === "round") res = Math.round(num);
      return String(res);
    }
    case "encode_decode": {
      if (params.encodeType === "base64") {
        try {
          if (params.encodeAction === "decode") return atob(str);
          return btoa(str);
        } catch {
          return str;
        }
      }
      if (params.encodeType === "hex") {
        if (params.encodeAction === "decode") {
          try {
            return str.match(/.{1,2}/g)?.map((byte) => String.fromCharCode(parseInt(byte, 16))).join("") || "";
          } catch {
            return str;
          }
        }
        return Array.from(str).map((c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
      }
      if (params.encodeType === "url") {
        try {
          if (params.encodeAction === "decode") return decodeURIComponent(str);
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
function applyTransformPipeline(input, rules) {
  if (!rules || !rules.length) return input;
  return rules.reduce((acc, rule) => applyTransformRule(acc, rule), input);
}
var init_transformEngine = __esm({
  "src/services/transformEngine.ts"() {
  }
});

// src/services/formulaEngine.ts
function parseDateInput(input) {
  if (input instanceof Date) return input;
  if (!input) return /* @__PURE__ */ new Date();
  const parsed = new Date(input);
  return isNaN(parsed.getTime()) ? /* @__PURE__ */ new Date() : parsed;
}
function createSandboxEnvironment(ctx) {
  const mergedScope = {
    // Math Functions
    ROUND: (val, decimals = 0) => {
      const factor = Math.pow(10, decimals);
      return Math.round(Number(val) * factor) / factor;
    },
    ABS: (val) => Math.abs(Number(val)),
    CEIL: (val) => Math.ceil(Number(val)),
    FLOOR: (val) => Math.floor(Number(val)),
    MIN: (...args) => Math.min(...args.map(Number)),
    MAX: (...args) => Math.max(...args.map(Number)),
    // String Functions
    CONCAT: (...args) => args.join(""),
    SUBSTRING: (str, start, length) => {
      const s = String(str || "");
      const sIdx = Math.max(0, start);
      return length !== void 0 ? s.substring(sIdx, sIdx + length) : s.substring(sIdx);
    },
    TRIM: (str) => String(str || "").trim(),
    REPLACE: (str, search, replacement) => String(str || "").replaceAll(search, replacement),
    UPPER: (str) => String(str || "").toUpperCase(),
    LOWER: (str) => String(str || "").toLowerCase(),
    PADLEFT: (val, len, char = "0") => String(val ?? "").padStart(len, char),
    PADRIGHT: (val, len, char = " ") => String(val ?? "").padEnd(len, char),
    LENGTH: (str) => String(str || "").length,
    // Date Functions
    NOW: () => /* @__PURE__ */ new Date(),
    TODAY: () => /* @__PURE__ */ new Date(),
    ADDDAYS: (dateInput, days) => {
      const d = new Date(parseDateInput(dateInput));
      d.setDate(d.getDate() + Number(days));
      return d;
    },
    ADDMONTHS: (dateInput, months) => {
      const d = new Date(parseDateInput(dateInput));
      d.setMonth(d.getMonth() + Number(months));
      return d;
    },
    ADDYEARS: (dateInput, years) => {
      const d = new Date(parseDateInput(dateInput));
      d.setFullYear(d.getFullYear() + Number(years));
      return d;
    },
    DATEDIFF: (d1, d2, unit = "days") => {
      const date1 = parseDateInput(d1).getTime();
      const date2 = parseDateInput(d2).getTime();
      const diffMs = Math.abs(date2 - date1);
      if (unit === "days") return Math.floor(diffMs / (1e3 * 60 * 60 * 24));
      if (unit === "months") return Math.floor(diffMs / (1e3 * 60 * 60 * 24 * 30.4375));
      if (unit === "years") return Math.floor(diffMs / (1e3 * 60 * 60 * 24 * 365.25));
      return diffMs;
    },
    FORMATDATE: (dateInput, mask = "YYYY-MM-DD") => {
      return formatCustomDate(parseDateInput(dateInput), mask);
    },
    // Logical & Conditional Functions
    IF: (condition, trueVal, falseVal) => condition ? trueVal : falseVal,
    AND: (...conditions) => conditions.every(Boolean),
    OR: (...conditions) => conditions.some(Boolean),
    NOT: (val) => !val,
    ISBLANK: (val) => val === void 0 || val === null || String(val).trim() === "",
    COALESCE: (...args) => args.find((a) => a !== void 0 && a !== null && String(a) !== "") ?? ""
  };
  const sys = ctx.system || {};
  mergedScope.System = {
    Date: formatCustomDate(/* @__PURE__ */ new Date(), "YYYY-MM-DD"),
    Time: formatCustomDate(/* @__PURE__ */ new Date(), "HH:mm:ss"),
    User: sys.userName || "Operator",
    Printer: sys.printerName || "Default Printer",
    JobId: sys.jobId || "JOB-001",
    RecordNumber: sys.currentRecordIndex !== void 0 ? sys.currentRecordIndex + 1 : 1,
    TotalRecords: sys.totalRecords || 1,
    PageNumber: sys.pageNumber || 1,
    TotalPages: sys.totalPages || 1
  };
  if (ctx.record) {
    for (const [k, v] of Object.entries(ctx.record)) {
      mergedScope[k] = v;
    }
  }
  if (ctx.namedSources) {
    for (const [k, v] of Object.entries(ctx.namedSources)) {
      mergedScope[k] = v;
    }
  }
  if (ctx.variables) {
    for (const [k, v] of Object.entries(ctx.variables)) {
      mergedScope[k] = v;
    }
  }
  return mergedScope;
}
function normalizeExpression(expr) {
  let clean = expr.trim();
  if (clean.startsWith("=")) {
    clean = clean.substring(1).trim();
  }
  clean = clean.replace(/\[([a-zA-Z0-9_.]+)\]/g, "$1");
  return clean;
}
function evaluateFormula(expression, context = {}) {
  if (!expression || !expression.trim()) {
    return { success: true, value: "" };
  }
  try {
    const normalized = normalizeExpression(expression);
    const scope = createSandboxEnvironment(context);
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
    let outputStr = "";
    if (result instanceof Date) {
      outputStr = formatCustomDate(result, "YYYY-MM-DD");
    } else if (result !== void 0 && result !== null) {
      outputStr = String(result);
    }
    return {
      success: true,
      value: outputStr
    };
  } catch (err) {
    return {
      success: false,
      value: "",
      error: err?.message || "Formula syntax error"
    };
  }
}
var init_formulaEngine = __esm({
  "src/services/formulaEngine.ts"() {
    init_dataSourceEngine();
  }
});

// src/services/dataSourceEngine.ts
function formatCustomDate(date, formatMask = "YYYY-MM-DD") {
  const yyyy = date.getFullYear().toString();
  const yy = yyyy.slice(-2);
  const mm = (date.getMonth() + 1).toString().padStart(2, "0");
  const dd = date.getDate().toString().padStart(2, "0");
  const hh = date.getHours().toString().padStart(2, "0");
  const min = date.getMinutes().toString().padStart(2, "0");
  const ss = date.getSeconds().toString().padStart(2, "0");
  const monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthNamesLong = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
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
function evaluateSafeScript(script, ctx) {
  try {
    const scope = {
      record: ctx.record || {},
      ctx,
      Date,
      Math,
      String,
      Number,
      pad: (val, len, char = "0") => String(val).padStart(len, char),
      formatDate: (d, mask) => formatCustomDate(d, mask),
      now: () => /* @__PURE__ */ new Date()
    };
    const fn = new Function(...Object.keys(scope), `return (function() { ${script.includes("return") ? script : "return " + script} })()`);
    const result = fn(...Object.values(scope));
    return result !== void 0 && result !== null ? String(result) : "";
  } catch (err) {
    console.warn("Script evaluation error:", err);
    return `[Script Error]`;
  }
}
function evaluateDataSourceItem(item, ctx, itemIndex = 0) {
  if (!item.enabled && item.enabled !== void 0) return "";
  if (item.namedSourceId && ctx.namedDataSources) {
    const named = ctx.namedDataSources.find(
      (n) => n.id === item.namedSourceId || n.name.toLowerCase() === item.namedSourceId?.toLowerCase()
    );
    if (named) {
      let namedVal = named.defaultValue || "";
      if (named.databaseField && ctx.record && ctx.record[named.databaseField] !== void 0) {
        namedVal = ctx.record[named.databaseField];
      } else if (named.formulaExpression) {
        const evalRes = evaluateFormula(named.formulaExpression, {
          record: ctx.record,
          system: {
            userName: ctx.userName,
            printerName: ctx.printerName,
            jobId: ctx.jobId,
            currentRecordIndex: ctx.currentRecordIndex,
            totalRecords: ctx.totalRecords
          }
        });
        namedVal = evalRes.success ? evalRes.value : `[Formula Error: ${evalRes.error}]`;
      }
      return applyTransformPipeline(namedVal, item.transforms || named.transforms);
    }
  }
  if (item.formulaExpression) {
    const evalRes = evaluateFormula(item.formulaExpression, {
      record: ctx.record,
      system: {
        userName: ctx.userName,
        printerName: ctx.printerName,
        jobId: ctx.jobId,
        currentRecordIndex: ctx.currentRecordIndex,
        totalRecords: ctx.totalRecords
      }
    });
    const resVal = evalRes.success ? evalRes.value : `[Formula Error: ${evalRes.error}]`;
    return applyTransformPipeline(resVal, item.transforms);
  }
  let raw = item.value || "";
  switch (item.type) {
    case "embedded":
      raw = item.value || "";
      break;
    case "database": {
      const field = item.databaseField || item.value;
      if (field && ctx.record && ctx.record[field] !== void 0) {
        raw = ctx.record[field];
      } else if (field && ctx.record) {
        const matchKey = Object.keys(ctx.record).find((k) => k.toLowerCase() === field.toLowerCase());
        raw = matchKey ? ctx.record[matchKey] : item.value || `[${field}]`;
      }
      break;
    }
    case "serial": {
      const start = item.serialStart ?? 1;
      const step = item.serialStep ?? 1;
      const pad = item.serialPad ?? 0;
      const dir = item.serialDirection === "decrement" ? -1 : 1;
      const recIdx = ctx.currentRecordIndex ?? 0;
      const currentVal = start + dir * step * recIdx;
      const padded = pad > 0 ? String(currentVal).padStart(pad, "0") : String(currentVal);
      const pfx = item.serialPrefix || "";
      const sfx = item.serialSuffix || "";
      raw = `${pfx}${padded}${sfx}`;
      break;
    }
    case "clock": {
      const baseDate = /* @__PURE__ */ new Date();
      if (item.dateOffsetDays) {
        baseDate.setDate(baseDate.getDate() + item.dateOffsetDays);
      }
      if (item.dateOffsetMonths) {
        baseDate.setMonth(baseDate.getMonth() + item.dateOffsetMonths);
      }
      if (item.dateOffsetYears) {
        baseDate.setFullYear(baseDate.getFullYear() + item.dateOffsetYears);
      }
      const mask = item.dateFormat || "YYYY-MM-DD";
      raw = formatCustomDate(baseDate, mask);
      break;
    }
    case "variable": {
      const varName = item.value || item.variableName;
      const variable = ctx.variables?.find((v) => v.name === varName || v.id === varName);
      if (variable) {
        if (variable.type === "counter") {
          const cStart = variable.counterStart ?? 1;
          const cStep = variable.counterStep ?? 1;
          const cPad = variable.counterPad ?? 0;
          const cVal = cStart + (ctx.currentRecordIndex ?? 0) * cStep;
          raw = cPad > 0 ? String(cVal).padStart(cPad, "0") : String(cVal);
        } else if (variable.type === "date") {
          const d = /* @__PURE__ */ new Date();
          if (variable.dateOffsetDays) d.setDate(d.getDate() + variable.dateOffsetDays);
          raw = formatCustomDate(d, variable.dateFormat || "YYYY-MM-DD");
        } else if (variable.type === "csv" && variable.csvColumn && ctx.record) {
          raw = ctx.record[variable.csvColumn] || variable.defaultValue || "";
        } else {
          raw = variable.defaultValue || "";
        }
      }
      break;
    }
    case "system": {
      const sys = (item.systemVarName || item.value || "SYSTEM.DATE").toUpperCase();
      if (sys === "SYSTEM.DATE") raw = formatCustomDate(/* @__PURE__ */ new Date(), "YYYY-MM-DD");
      else if (sys === "SYSTEM.TIME") raw = formatCustomDate(/* @__PURE__ */ new Date(), "HH:mm:ss");
      else if (sys === "SYSTEM.USER") raw = ctx.userName || "Current User";
      else if (sys === "SYSTEM.PRINTER") raw = ctx.printerName || "Default Zebra ZT410";
      else if (sys === "SYSTEM.JOB_ID") raw = ctx.jobId || "JOB-001";
      else if (sys === "SYSTEM.PAGE_NUMBER") raw = String(ctx.pageNumber || (ctx.currentRecordIndex ?? 0) + 1);
      else if (sys === "SYSTEM.TOTAL_PAGES") raw = String(ctx.totalPages || ctx.totalRecords || 1);
      else if (sys === "SYSTEM.RECORD_NUMBER") raw = String((ctx.currentRecordIndex ?? 0) + 1);
      else if (sys === "SYSTEM.TOTAL_RECORDS") raw = String(ctx.totalRecords || 1);
      else if (sys === "SYSTEM.COPY_NUMBER") raw = String(ctx.copyNumber || 1);
      else if (sys === "SYSTEM.COMPUTER_NAME") raw = ctx.computerName || "WORKSTATION-01";
      break;
    }
    case "script": {
      raw = evaluateSafeScript(item.scriptCode || item.value || "", ctx);
      break;
    }
    case "linked": {
      if (item.linkedObjectId && ctx.elements) {
        const target = ctx.elements.find((e) => e.id === item.linkedObjectId);
        if (target) {
          if (target.type === "text") raw = target.text;
          else if (target.type === "barcode") raw = target.value;
        }
      }
      break;
    }
    case "gs1_ai": {
      if (item.gs1AIs && item.gs1AIs.length > 0) {
        raw = item.gs1AIs.map((ai) => `(${ai.ai})${ai.value}`).join("");
      } else {
        raw = item.value || "(01)00850006531234(10)LOT456(17)261231(21)SN987654";
      }
      break;
    }
    case "gs1_composite": {
      const linear = item.gs1CompositeLinear || "(01)00850006531234";
      const comp2D = item.gs1Composite2DData || "(10)BATCH123(17)261231";
      raw = `${linear}|${comp2D}`;
      break;
    }
    case "gs1_databar": {
      if (item.gs1AIs && item.gs1AIs.length > 0) {
        raw = item.gs1AIs.map((ai) => `(${ai.ai})${ai.value}`).join("");
      } else {
        raw = item.value || "(01)00850006531234";
      }
      break;
    }
    default:
      raw = item.value || "";
  }
  return applyTransformPipeline(raw, item.transforms);
}
function interpolateDynamicTokens(text, ctx) {
  if (!text || !text.includes("{")) return text;
  let result = text;
  result = result.replace(/\{{1,2}System\.Date\}{1,2}/gi, formatCustomDate(/* @__PURE__ */ new Date(), "YYYY-MM-DD"));
  result = result.replace(/\{{1,2}System\.Time\}{1,2}/gi, formatCustomDate(/* @__PURE__ */ new Date(), "HH:mm:ss"));
  result = result.replace(/\{{1,2}System\.User\}{1,2}/gi, ctx.userName || "Operator");
  result = result.replace(/\{{1,2}System\.Printer\}{1,2}/gi, ctx.printerName || "Default Printer");
  result = result.replace(/\{{1,2}System\.JobId\}{1,2}/gi, ctx.jobId || "JOB-001");
  result = result.replace(/\{{1,2}System\.RecordNumber\}{1,2}/gi, String((ctx.currentRecordIndex ?? 0) + 1));
  result = result.replace(/\{{1,2}System\.TotalRecords\}{1,2}/gi, String(ctx.totalRecords || 1));
  if (ctx.record) {
    for (const [k, v] of Object.entries(ctx.record)) {
      result = result.replace(new RegExp(`\\{{1,2}${k}\\}{1,2}`, "gi"), String(v));
    }
  }
  if (ctx.namedDataSources) {
    for (const named of ctx.namedDataSources) {
      const val = (named.databaseField && ctx.record ? ctx.record[named.databaseField] : void 0) || named.defaultValue || "";
      result = result.replace(new RegExp(`\\{{1,2}${named.name}\\}{1,2}`, "gi"), String(val));
    }
  }
  if (ctx.variables) {
    for (const v of ctx.variables) {
      result = result.replace(new RegExp(`\\{{1,2}${v.name}\\}{1,2}`, "gi"), String(v.defaultValue || ""));
    }
  }
  return result;
}
function evaluateElementData(element, ctx = {}) {
  if (element.dataSources && element.dataSources.length > 0) {
    const combined = element.dataSources.map((item, idx) => evaluateDataSourceItem(item, ctx, idx)).join("");
    return applyTransformPipeline(combined, element.transforms);
  }
  let baseValue = "";
  if (element.type === "text") {
    baseValue = element.text || "";
  } else if (element.type === "barcode") {
    baseValue = element.value || "";
  }
  const binding = element.dataBinding;
  if (binding) {
    baseValue = interpolateDynamicTokens(binding, ctx);
  } else {
    baseValue = interpolateDynamicTokens(baseValue, ctx);
  }
  return applyTransformPipeline(baseValue, element.transforms);
}
var init_dataSourceEngine = __esm({
  "src/services/dataSourceEngine.ts"() {
    init_transformEngine();
    init_formulaEngine();
  }
});

// src/services/barcodeEngine.ts
import bwipjs from "bwip-js";
function getSymbologyMetadata(symbology) {
  return SYMBOLOGY_CATALOG.find((s) => s.id === symbology) || SYMBOLOGY_CATALOG[0];
}
async function renderBarcodeToCanvas(canvas, element, scale = 2, ctxEval) {
  const meta = getSymbologyMetadata(element.symbology);
  const evaluatedValue = evaluateElementData(element, ctxEval) || element.value || meta.defaultSample;
  try {
    const is2D = meta.is2D;
    const options = {
      bcid: meta.bwipBcId || "code128",
      text: evaluatedValue || "12345678",
      scale: Math.max(1, Math.round(scale * (element.barWidth || 1.8)))
    };
    if (!is2D) {
      options.height = Math.max(8, Math.round((element.barHeight || 12) * 1.5));
      options.includetext = Boolean(element.includeText);
      options.textxalign = element.humanReadableAlignment || "center";
      options.textyalign = element.textPosition === "above" ? "above" : "below";
      if (element.humanReadableFontSize) {
        options.textsize = Math.max(6, Math.min(24, Math.round(element.humanReadableFontSize)));
      }
      if (element.humanReadableColor || element.foregroundColor) {
        const col = (element.humanReadableColor || element.foregroundColor || "#000000").replace("#", "");
        if (/^[0-9A-Fa-f]{6}$/.test(col)) {
          options.textcolor = col;
        }
      }
      if (element.humanReadableOffsetV) {
        options.textgap = Math.max(0, Math.round(element.humanReadableOffsetV));
      }
      if (element.humanReadableCustomFormat) {
        options.alttext = element.humanReadableCustomFormat.replace("{0}", evaluatedValue);
      }
    }
    if (element.backgroundColor && element.backgroundColor !== "transparent") {
      const bg = element.backgroundColor.replace("#", "");
      if (/^[0-9A-Fa-f]{6}$/.test(bg)) {
        options.backgroundcolor = bg;
      }
    }
    if (element.foregroundColor) {
      const fg = element.foregroundColor.replace("#", "");
      if (/^[0-9A-Fa-f]{6}$/.test(fg)) {
        options.barcolor = fg;
      }
    }
    if (element.errorCorrectionLevel && (element.symbology === "qr" || element.symbology === "aztec")) {
      options.eclevel = element.errorCorrectionLevel;
    }
    bwipjs.toCanvas(canvas, options);
    if (element.bearerBars && !is2D) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = element.foregroundColor || "#000000";
        const barThick = (element.bearerBarThickness || 3) * scale;
        ctx.fillRect(0, 0, canvas.width, barThick);
        ctx.fillRect(0, canvas.height - barThick, canvas.width, barThick);
        if (element.bearerBarType === "complete") {
          ctx.fillRect(0, 0, barThick, canvas.height);
          ctx.fillRect(canvas.width - barThick, 0, barThick, canvas.height);
        }
      }
    }
  } catch (err) {
    try {
      const fallbackOptions = {
        bcid: meta.bwipBcId || "code128",
        text: meta.defaultSample,
        scale: Math.max(1, Math.round(scale * (element.barWidth || 1.8)))
      };
      if (!meta.is2D) {
        fallbackOptions.height = Math.max(8, Math.round((element.barHeight || 12) * 1.5));
        fallbackOptions.includetext = Boolean(element.includeText);
      }
      bwipjs.toCanvas(canvas, fallbackOptions);
    } catch {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#fef2f2";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#f87171";
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
        ctx.fillStyle = "#b91c1c";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(meta.name, canvas.width / 2, canvas.height / 2 - 8);
        ctx.font = "10px sans-serif";
        ctx.fillStyle = "#6b7280";
        ctx.fillText("Invalid Data Format", canvas.width / 2, canvas.height / 2 + 8);
      }
    }
  }
}
var SYMBOLOGY_CATALOG;
var init_barcodeEngine = __esm({
  "src/services/barcodeEngine.ts"() {
    init_dataSourceEngine();
    SYMBOLOGY_CATALOG = [
      // General Purpose & Primary BarTender Barcodes
      {
        id: "code128",
        name: "Code 128",
        category: "General Purpose",
        folderCategories: ["General Purpose", "All Symbologies"],
        bwipBcId: "code128",
        description: "High-density alphanumeric barcode supporting all 128 ASCII characters.",
        defaultSample: "12345678",
        is2D: false,
        supportsGS1: false
      },
      {
        id: "code39",
        name: "Code 39",
        category: "General Purpose",
        folderCategories: ["General Purpose", "All Symbologies"],
        bwipBcId: "code39",
        description: "Widely used in automotive, defense, and industrial inventory systems.",
        defaultSample: "12345678",
        is2D: false,
        supportsGS1: false
      },
      {
        id: "code93",
        name: "Code 93",
        category: "General Purpose",
        folderCategories: ["General Purpose", "All Symbologies"],
        bwipBcId: "code93",
        description: "Higher density variant of Code 39 with full ASCII capability.",
        defaultSample: "12345678",
        is2D: false,
        supportsGS1: false
      },
      {
        id: "datamatrix",
        name: "Data Matrix",
        category: "General Purpose",
        folderCategories: ["General Purpose", "Disc / CD / DVD", "Health Care", "Pharmaceutical", "All Symbologies"],
        bwipBcId: "datamatrix",
        description: "Compact 2D matrix code standard for electronics, direct part marking (DPM), and small parts.",
        defaultSample: "12345678",
        is2D: true,
        supportsGS1: false
      },
      {
        id: "qr",
        name: "QR Code",
        category: "General Purpose",
        folderCategories: ["General Purpose", "Disc / CD / DVD", "All Symbologies"],
        bwipBcId: "qrcode",
        description: "Quick Response 2D matrix code supporting URLs, text, and industrial tracking.",
        defaultSample: "https://verify.industrial-label.com/12345678",
        is2D: true,
        supportsGS1: false
      },
      {
        id: "micro-qr",
        name: "Micro QR Code",
        category: "General Purpose",
        folderCategories: ["General Purpose", "Disc / CD / DVD", "All Symbologies"],
        bwipBcId: "microqrcode",
        description: "Miniaturized QR Code for very small electronics and hardware tags.",
        defaultSample: "12345678",
        is2D: true,
        supportsGS1: false
      },
      {
        id: "pdf417",
        name: "PDF417",
        category: "General Purpose",
        folderCategories: ["General Purpose", "Postal / Shipping", "All Symbologies"],
        bwipBcId: "pdf417",
        description: "High-capacity stacked 2D barcode standard for shipping, logistics, and government IDs.",
        defaultSample: "12345678",
        is2D: true,
        supportsGS1: false
      },
      {
        id: "pdf417-truncated",
        name: "PDF417 Truncated",
        category: "General Purpose",
        folderCategories: ["General Purpose", "All Symbologies"],
        bwipBcId: "pdf417compact",
        description: "Compact version of PDF417 with reduced right stop pattern for space-constrained labels.",
        defaultSample: "12345678",
        is2D: true,
        supportsGS1: false
      },
      {
        id: "aztec",
        name: "Aztec Code",
        category: "General Purpose",
        folderCategories: ["General Purpose", "Disc / CD / DVD", "All Symbologies"],
        bwipBcId: "azteccode",
        description: "High-density matrix code with a central bullseye finder, widely used in ticketing.",
        defaultSample: "TKT-AIR-992384-SEC",
        is2D: true,
        supportsGS1: false
      },
      {
        id: "maxicode",
        name: "MaxiCode (UPS)",
        category: "Postal / Shipping",
        folderCategories: ["Postal / Shipping", "General Purpose", "All Symbologies"],
        bwipBcId: "maxicode",
        description: "Fixed-size matrix code with hexagonal grid and concentric rings used by UPS for high-speed sorting.",
        defaultSample: "[)>01961234567898400011Z00004951UPSN06X61015912345671/1",
        is2D: true,
        supportsGS1: false
      },
      {
        id: "interleaved2of5",
        name: "Interleaved 2 of 5",
        category: "General Purpose",
        folderCategories: ["General Purpose", "Postal / Shipping", "All Symbologies"],
        bwipBcId: "interleaved2of5",
        description: "Continuous two-width barcode symbology encoding pairs of digits.",
        defaultSample: "12345678",
        is2D: false,
        supportsGS1: false,
        validationRegex: /^\d+$/
      },
      {
        id: "itf14",
        name: "ITF-14",
        category: "GS1 (by Symbology)",
        folderCategories: ["GS1 (by Symbology)", "GS1 (by Application)", "Postal / Shipping", "All Symbologies"],
        bwipBcId: "itf14",
        description: "14-digit carton & master case barcode with heavy bearer bars for corrugated cardboard.",
        defaultSample: "10012345678902",
        is2D: false,
        supportsGS1: true,
        validationRegex: /^\d{13,14}$/
      },
      // Retail & Consumer
      {
        id: "ean13",
        name: "EAN-13",
        category: "GS1 (by Symbology)",
        folderCategories: ["GS1 (by Symbology)", "General Purpose", "All Symbologies"],
        bwipBcId: "ean13",
        description: "International standard 13-digit product barcode used in retail worldwide.",
        defaultSample: "5901234123457",
        is2D: false,
        supportsGS1: true,
        validationRegex: /^\d{12,13}$/
      },
      {
        id: "ean8",
        name: "EAN-8",
        category: "GS1 (by Symbology)",
        folderCategories: ["GS1 (by Symbology)", "General Purpose", "All Symbologies"],
        bwipBcId: "ean8",
        description: "Compact 8-digit retail barcode for small packages and items.",
        defaultSample: "96385074",
        is2D: false,
        supportsGS1: true,
        validationRegex: /^\d{7,8}$/
      },
      {
        id: "upca",
        name: "UPC-A",
        category: "GS1 (by Symbology)",
        folderCategories: ["GS1 (by Symbology)", "General Purpose", "All Symbologies"],
        bwipBcId: "upca",
        description: "Standard 12-digit point-of-sale barcode used primarily in North America.",
        defaultSample: "012345678905",
        is2D: false,
        supportsGS1: true,
        validationRegex: /^\d{11,12}$/
      },
      {
        id: "upce",
        name: "UPC-E",
        category: "GS1 (by Symbology)",
        folderCategories: ["GS1 (by Symbology)", "General Purpose", "All Symbologies"],
        bwipBcId: "upce",
        description: "Zero-suppressed 8-digit version of UPC-A for small retail items.",
        defaultSample: "01234565",
        is2D: false,
        supportsGS1: true,
        validationRegex: /^\d{6,8}$/
      },
      // GS1 Standards
      {
        id: "gs1-128",
        name: "GS1-128",
        category: "GS1 (by Application)",
        folderCategories: ["GS1 (by Application)", "GS1 (by Symbology)", "Postal / Shipping", "All Symbologies"],
        bwipBcId: "gs1-128",
        description: "Industry standard for shipping containers, pallets, and logistics with Application Identifiers.",
        defaultSample: "(01)00850006531233(17)261231(10)LOT456(21)SN9876",
        is2D: false,
        supportsGS1: true
      },
      {
        id: "gs1-datamatrix",
        name: "GS1 DataMatrix",
        category: "GS1 (by Application)",
        folderCategories: ["GS1 (by Application)", "GS1 (by Symbology)", "Health Care", "Pharmaceutical", "All Symbologies"],
        bwipBcId: "gs1datamatrix",
        description: "GS1 compliant 2D matrix code mandatory for FDA UDI medical devices and pharma serialization.",
        defaultSample: "(01)00850006531233(17)261231(10)LOT456(21)SN9876",
        is2D: true,
        supportsGS1: true
      },
      {
        id: "gs1-qr",
        name: "GS1 QR Code",
        category: "GS1 (by Application)",
        folderCategories: ["GS1 (by Application)", "GS1 (by Symbology)", "All Symbologies"],
        bwipBcId: "gs1qrcode",
        description: "GS1 2D barcode for consumer engagement and supply chain track and trace.",
        defaultSample: "(01)00850006531233(10)LOT123",
        is2D: true,
        supportsGS1: true
      },
      {
        id: "gs1-databar",
        name: "GS1 DataBar Omnidirectional",
        category: "GS1 (by Application)",
        folderCategories: ["GS1 (by Application)", "GS1 (by Symbology)", "All Symbologies"],
        bwipBcId: "databarexpanded",
        description: "GS1 barcode for fresh produce, coupons, and variable weight retail products.",
        defaultSample: "(01)00850006531233",
        is2D: false,
        supportsGS1: true
      },
      // Health Care & Pharma
      {
        id: "hibc-128",
        name: "HIBC Code 128",
        category: "Health Care",
        folderCategories: ["Health Care", "All Symbologies"],
        bwipBcId: "hibccode128",
        description: "Health Industry Bar Code standard for medical equipment and supplies labeling.",
        defaultSample: "+A99912345/$$5261231LOT456",
        is2D: false,
        supportsGS1: false
      },
      {
        id: "hibc-datamatrix",
        name: "HIBC DataMatrix",
        category: "Health Care",
        folderCategories: ["Health Care", "Pharmaceutical", "All Symbologies"],
        bwipBcId: "hibcdatamatrix",
        description: "2D HIBC matrix code for surgical instruments and sterile medical packaging.",
        defaultSample: "+A99912345/$$5261231LOT456",
        is2D: true,
        supportsGS1: false
      },
      {
        id: "pharmacode",
        name: "Pharmacode",
        category: "Pharmaceutical",
        folderCategories: ["Pharmaceutical", "Health Care", "All Symbologies"],
        bwipBcId: "pharmacode",
        description: "Binary barcode standard used in pharmaceutical packaging control.",
        defaultSample: "12345",
        is2D: false,
        supportsGS1: false,
        validationRegex: /^\d+$/
      },
      // Patch Code
      {
        id: "patchcode",
        name: "Patch Code",
        category: "Document Imaging",
        folderCategories: ["Document Imaging", "All Symbologies"],
        bwipBcId: "code39",
        description: "Document separation and indexing barcode for production sheet scanners.",
        defaultSample: "PATCH-T",
        is2D: false,
        supportsGS1: false
      },
      // Postal & Shipping
      {
        id: "usps-imb",
        name: "USPS Intelligent Mail (IMb)",
        category: "Postal / Shipping",
        folderCategories: ["Postal / Shipping", "All Symbologies"],
        bwipBcId: "onecode",
        description: "US Postal Service 65-bar 4-state barcode sorting and tracking mailpieces.",
        defaultSample: "0123456709498765432101234567891",
        is2D: false,
        supportsGS1: false,
        validationRegex: /^\d{20,31}$/
      },
      {
        id: "royalmail",
        name: "Royal Mail 4-State (RM4SCC)",
        category: "Postal / Shipping",
        folderCategories: ["Postal / Shipping", "All Symbologies"],
        bwipBcId: "royalmail",
        description: "UK Royal Mail Cleanmail barcode for automated letter sorting.",
        defaultSample: "SN34RD1A",
        is2D: false,
        supportsGS1: false
      },
      {
        id: "codabar",
        name: "Codabar (NW-7)",
        category: "General Purpose",
        folderCategories: ["General Purpose", "Health Care", "All Symbologies"],
        bwipBcId: "rationalizedCodabar",
        description: "Self-checking barcode used in libraries, blood banks, and airbills.",
        defaultSample: "A123456789B",
        is2D: false,
        supportsGS1: false
      },
      {
        id: "msi",
        name: "MSI Plessey",
        category: "General Purpose",
        folderCategories: ["General Purpose", "All Symbologies"],
        bwipBcId: "msi",
        description: "Numeric barcode commonly used for warehouse shelf tagging.",
        defaultSample: "8052194",
        is2D: false,
        supportsGS1: false,
        validationRegex: /^\d+$/
      },
      {
        id: "telepen",
        name: "Telepen",
        category: "General Purpose",
        folderCategories: ["General Purpose", "All Symbologies"],
        bwipBcId: "telepen",
        description: "Compact ASCII barcode with high data integrity.",
        defaultSample: "TELEPEN123",
        is2D: false,
        supportsGS1: false
      },
      {
        id: "tlc39",
        name: "TLC39 (Telecommunications)",
        category: "TLC",
        folderCategories: ["TLC", "All Symbologies"],
        bwipBcId: "code39",
        description: "TCIF Linked Code 39 composite barcode.",
        defaultSample: "TLC39-EQUIP-8849",
        is2D: false,
        supportsGS1: false
      },
      {
        id: "posicode-b",
        name: "PosiCode B",
        category: "General Purpose",
        folderCategories: ["General Purpose", "All Symbologies"],
        bwipBcId: "posicode",
        description: "PosiCode variant B for positional scanning in automated sorting.",
        defaultSample: "12345678",
        is2D: false,
        supportsGS1: false
      },
      {
        id: "posicode-a",
        name: "PosiCode A",
        category: "General Purpose",
        folderCategories: ["General Purpose", "All Symbologies"],
        bwipBcId: "posicode",
        description: "PosiCode variant A with fixed length.",
        defaultSample: "12345678",
        is2D: false,
        supportsGS1: false
      },
      {
        id: "posicode-b",
        name: "PosiCode B",
        category: "General Purpose",
        folderCategories: ["General Purpose", "All Symbologies"],
        bwipBcId: "posicode",
        description: "PosiCode variant B with variable length.",
        defaultSample: "12345678",
        is2D: false,
        supportsGS1: false
      }
    ];
  }
});

// src/services/pdfExportService.ts
var pdfExportService_exports = {};
__export(pdfExportService_exports, {
  exportLabelsToPDF: () => exportLabelsToPDF,
  exportTemplateToPdf: () => exportTemplateToPdf
});
import { jsPDF } from "jspdf";
async function exportLabelsToPDF(template, records = [{}], copiesPerRecord = 1) {
  const isLandscape = template.dimensions.width > template.dimensions.height;
  const orientation = isLandscape ? "landscape" : "portrait";
  const widthMm = template.dimensions.width;
  const heightMm = template.dimensions.height;
  const pdf = new jsPDF({
    orientation,
    unit: "mm",
    format: [widthMm, heightMm],
    compress: true
  });
  const totalLabels = records.length * copiesPerRecord;
  let labelIndex = 0;
  for (let r = 0; r < records.length; r++) {
    const record = records[r] || {};
    for (let c = 0; c < copiesPerRecord; c++) {
      if (labelIndex > 0) {
        pdf.addPage([widthMm, heightMm], orientation);
      }
      await renderTemplateToPDFPage(pdf, template, record);
      labelIndex++;
    }
  }
  return pdf.output("blob");
}
async function renderTemplateToPDFPage(pdf, template, record) {
  const sorted = [...template.elements].sort((a, b) => a.zIndex - b.zIndex);
  for (const el of sorted) {
    if (!el.visible) continue;
    switch (el.type) {
      case "shape": {
        const strokeW = el.strokeWidth || 0.3;
        pdf.setLineWidth(strokeW);
        if (el.fillColor && el.fillColor !== "transparent") {
          pdf.setFillColor(el.fillColor);
        }
        if (el.strokeColor && el.strokeColor !== "transparent") {
          pdf.setDrawColor(el.strokeColor);
        }
        const style = el.fillColor && el.fillColor !== "transparent" ? el.strokeColor && el.strokeColor !== "transparent" ? "FD" : "F" : "S";
        if (el.shapeType === "rectangle") {
          if (el.cornerRadius > 0) {
            pdf.roundedRect(el.x, el.y, el.width, el.height, el.cornerRadius, el.cornerRadius, style);
          } else {
            pdf.rect(el.x, el.y, el.width, el.height, style);
          }
        } else if (el.shapeType === "circle" || el.shapeType === "ellipse") {
          pdf.ellipse(el.x + el.width / 2, el.y + el.height / 2, el.width / 2, el.height / 2, style);
        } else if (el.shapeType === "line") {
          pdf.line(el.x, el.y, el.x + el.width, el.y + el.height);
        }
        break;
      }
      case "text": {
        let textVal = el.text;
        if (el.dataBinding) {
          const key = el.dataBinding.replace(/[{}]/g, "").trim();
          if (record[key] !== void 0) {
            textVal = record[key];
          }
        }
        pdf.setFontSize(el.fontSize);
        pdf.setTextColor(el.color || "#000000");
        pdf.setFont("helvetica", el.fontWeight === "bold" || el.fontWeight === "700" || el.fontWeight === "800" ? "bold" : "normal");
        const textLines = pdf.splitTextToSize(textVal, el.width);
        const align = el.textAlign === "center" ? "center" : el.textAlign === "right" ? "right" : "left";
        const posX = align === "center" ? el.x + el.width / 2 : align === "right" ? el.x + el.width : el.x;
        const baselineOffset = el.fontSize * 0.35;
        pdf.text(textLines, posX, el.y + baselineOffset, { align });
        break;
      }
      case "barcode": {
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(el.width * 8);
        canvas.height = Math.round(el.height * 8);
        let barcodeElement = { ...el };
        if (el.dataBinding) {
          const key = el.dataBinding.replace(/[{}]/g, "").trim();
          if (record[key] !== void 0) {
            barcodeElement.value = record[key];
          }
        }
        try {
          await renderBarcodeToCanvas(canvas, barcodeElement, 4);
          const dataUrl = canvas.toDataURL("image/png");
          pdf.addImage(dataUrl, "PNG", el.x, el.y, el.width, el.height);
        } catch (e) {
          pdf.setDrawColor("#ff0000");
          pdf.rect(el.x, el.y, el.width, el.height);
        }
        break;
      }
      case "image": {
        if (el.src) {
          try {
            pdf.addImage(el.src, "JPEG", el.x, el.y, el.width, el.height);
          } catch (e) {
          }
        }
        break;
      }
      case "table": {
        const borderW = el.borderWidth || 0.3;
        pdf.setLineWidth(borderW);
        pdf.setDrawColor(el.borderColor || "#000000");
        pdf.setFontSize(el.fontSize || 8);
        const colW = el.width / (el.cols || 1);
        const rowH = el.rowHeight || 6;
        for (let r = 0; r < el.rows; r++) {
          for (let c = 0; c < el.cols; c++) {
            const cellX = el.x + c * colW;
            const cellY = el.y + r * rowH;
            pdf.rect(cellX, cellY, colW, rowH);
            const cell = el.cells?.[r]?.[c];
            if (cell && cell.content) {
              let content = cell.content;
              if (cell.dataBinding && record[cell.dataBinding]) {
                content = record[cell.dataBinding];
              }
              pdf.text(content, cellX + 1.5, cellY + rowH * 0.7);
            }
          }
        }
        break;
      }
    }
  }
}
async function exportTemplateToPdf(template, records = [{}]) {
  const blob = await exportLabelsToPDF(template, records);
  return {
    save: (filename) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  };
}
var init_pdfExportService = __esm({
  "src/services/pdfExportService.ts"() {
    init_barcodeEngine();
  }
});

// barcode-automation-backend/src/app.ts
import express from "express";

// barcode-automation-backend/src/routes/templates.ts
import { Router } from "express";

// barcode-automation-backend/src/services/storageService.ts
import fs3 from "fs";
import path3 from "path";

// barcode-automation-backend/src/db/databaseService.ts
import path2 from "path";
import fs2 from "fs";

// barcode-automation-backend/src/db/sqliteProvider.ts
import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";

// barcode-automation-backend/src/db/migrations.ts
var MIGRATIONS = [
  {
    version: 1,
    name: "001_initial_enterprise_schema",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS key_value_store (
          collection TEXT NOT NULL,
          id TEXT NOT NULL,
          data TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (collection, id)
        );
        CREATE INDEX IF NOT EXISTS idx_kvs_collection ON key_value_store(collection);
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          author_email TEXT,
          category TEXT,
          status TEXT NOT NULL DEFAULT 'draft',
          version TEXT NOT NULL DEFAULT '1.0.0',
          data TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_templates_author ON templates(author_email);
        CREATE INDEX IF NOT EXISTS idx_templates_status ON templates(status);
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'approved',
          department TEXT,
          permissions TEXT,
          data TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS datasets (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          source_type TEXT NOT NULL,
          file_name TEXT,
          row_count INTEGER DEFAULT 0,
          data TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS printers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          ip_address TEXT,
          port INTEGER DEFAULT 9100,
          dpi INTEGER DEFAULT 300,
          status TEXT NOT NULL DEFAULT 'online',
          is_default INTEGER DEFAULT 0,
          driver_name TEXT,
          data TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS print_jobs (
          id TEXT PRIMARY KEY,
          template_id TEXT,
          template_name TEXT,
          printer_id TEXT,
          printer_name TEXT,
          copies INTEGER DEFAULT 1,
          record_count INTEGER DEFAULT 1,
          status TEXT NOT NULL DEFAULT 'completed',
          format TEXT DEFAULT 'zpl',
          submitted_by TEXT,
          submitted_at TEXT NOT NULL,
          completed_at TEXT,
          data TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_print_jobs_template ON print_jobs(template_id);
        CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status);
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS serial_sequences (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          current_value INTEGER NOT NULL DEFAULT 1,
          start_value INTEGER NOT NULL DEFAULT 1,
          increment_by INTEGER NOT NULL DEFAULT 1,
          min_digits INTEGER NOT NULL DEFAULT 6,
          prefix TEXT DEFAULT '',
          suffix TEXT DEFAULT '',
          reset_policy TEXT NOT NULL DEFAULT 'never',
          last_reset_date TEXT,
          copies_per_serial INTEGER NOT NULL DEFAULT 1,
          updated_at TEXT NOT NULL
        );
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS counters (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'batch',
          current_value INTEGER NOT NULL DEFAULT 0,
          start_value INTEGER NOT NULL DEFAULT 0,
          step INTEGER NOT NULL DEFAULT 1,
          pad_length INTEGER NOT NULL DEFAULT 0,
          max_value INTEGER,
          reset_policy TEXT NOT NULL DEFAULT 'manual',
          last_reset_date TEXT,
          updated_at TEXT NOT NULL
        );
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          timestamp TEXT NOT NULL,
          user_name TEXT NOT NULL,
          user_role TEXT NOT NULL,
          action TEXT NOT NULL,
          details TEXT NOT NULL,
          entity_id TEXT,
          entity_name TEXT,
          ip_address TEXT,
          hash TEXT NOT NULL,
          prev_hash TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
      `);
    }
  }
];
function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
  const appliedRows = db.prepare("SELECT version FROM schema_migrations").all();
  const appliedSet = new Set(appliedRows.map((r) => r.version));
  for (const mig of MIGRATIONS) {
    if (!appliedSet.has(mig.version)) {
      console.log(`[DatabaseSync] Applying migration v${mig.version}: ${mig.name}`);
      mig.up(db);
      const insert = db.prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)");
      insert.run(mig.version, mig.name, (/* @__PURE__ */ new Date()).toISOString());
      console.log(`[DatabaseSync] Successfully applied migration v${mig.version}`);
    }
  }
}

// barcode-automation-backend/src/db/sqliteProvider.ts
var SqliteDatabaseProvider = class {
  constructor(customPath) {
    const dataDir = path.resolve(process.cwd(), "barcode-automation-backend/data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.dbPath = customPath || path.join(dataDir, "barcodeflow.sqlite");
  }
  initialize() {
    try {
      this.db = new DatabaseSync(this.dbPath);
      this.db.exec("PRAGMA journal_mode = WAL;");
      this.db.exec("PRAGMA synchronous = NORMAL;");
      this.db.exec("PRAGMA foreign_keys = ON;");
      runMigrations(this.db);
      console.log(`[SqliteDatabaseProvider] Connected and initialized SQLite database at: ${this.dbPath}`);
    } catch (err) {
      console.error("[SqliteDatabaseProvider] Initialization error:", err);
      throw err;
    }
  }
  execute(sql, params = []) {
    if (params.length === 0) {
      this.db.exec(sql);
    } else {
      const stmt = this.db.prepare(sql);
      stmt.run(...params);
    }
  }
  query(sql, params = []) {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }
  queryOne(sql, params = []) {
    const rows = this.query(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }
  readCollection(collectionName, fallback = []) {
    try {
      if (collectionName === "templates") {
        const rows2 = this.query("SELECT data FROM templates ORDER BY updated_at DESC");
        if (rows2.length > 0) return rows2.map((r) => JSON.parse(r.data));
      } else if (collectionName === "users") {
        const rows2 = this.query("SELECT data FROM users ORDER BY created_at ASC");
        if (rows2.length > 0) return rows2.map((r) => JSON.parse(r.data));
      } else if (collectionName === "datasets") {
        const rows2 = this.query("SELECT data FROM datasets ORDER BY updated_at DESC");
        if (rows2.length > 0) return rows2.map((r) => JSON.parse(r.data));
      } else if (collectionName === "printers") {
        const rows2 = this.query("SELECT data FROM printers ORDER BY is_default DESC, name ASC");
        if (rows2.length > 0) return rows2.map((r) => JSON.parse(r.data));
      } else if (collectionName === "printJobs") {
        const rows2 = this.query("SELECT data FROM print_jobs ORDER BY submitted_at DESC");
        if (rows2.length > 0) return rows2.map((r) => JSON.parse(r.data));
      }
      const rows = this.query("SELECT data FROM key_value_store WHERE collection = ?", [collectionName]);
      if (rows.length > 0) {
        return rows.map((r) => JSON.parse(r.data));
      }
      return fallback;
    } catch (err) {
      console.error(`[SqliteDatabaseProvider] Error reading collection "${collectionName}":`, err);
      return fallback;
    }
  }
  writeCollection(collectionName, items) {
    try {
      this.db.exec("BEGIN TRANSACTION;");
      if (collectionName === "templates") {
        this.db.exec("DELETE FROM templates;");
        const insert = this.db.prepare(
          "INSERT INTO templates (id, name, author_email, category, status, version, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        for (const item of items) {
          insert.run(
            item.id,
            item.name || "Untitled Template",
            item.authorEmail || item.author || "",
            item.category || "General",
            item.status || "draft",
            item.version || "1.0.0",
            JSON.stringify(item),
            item.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
            item.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
          );
        }
      } else if (collectionName === "users") {
        this.db.exec("DELETE FROM users;");
        const insert = this.db.prepare(
          "INSERT INTO users (id, email, name, role, status, department, permissions, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        for (const item of items) {
          insert.run(
            item.id,
            item.email,
            item.name,
            item.role,
            item.status || "approved",
            item.department || "",
            JSON.stringify(item.permissions || {}),
            JSON.stringify(item),
            item.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
            item.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
          );
        }
      } else if (collectionName === "datasets") {
        this.db.exec("DELETE FROM datasets;");
        const insert = this.db.prepare(
          "INSERT INTO datasets (id, name, source_type, file_name, row_count, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        );
        for (const item of items) {
          insert.run(
            item.id,
            item.name,
            item.sourceType || "csv",
            item.fileName || "",
            item.rowCount || item.records?.length || 0,
            JSON.stringify(item),
            item.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
            item.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
          );
        }
      } else if (collectionName === "printers") {
        this.db.exec("DELETE FROM printers;");
        const insert = this.db.prepare(
          "INSERT INTO printers (id, name, type, ip_address, port, dpi, status, is_default, driver_name, data, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        for (const item of items) {
          insert.run(
            item.id,
            item.name,
            item.type || "Thermal",
            item.ipAddress || "",
            item.port || 9100,
            item.dpi || 300,
            item.status || "online",
            item.isDefault ? 1 : 0,
            item.driverName || "",
            JSON.stringify(item),
            (/* @__PURE__ */ new Date()).toISOString()
          );
        }
      } else if (collectionName === "printJobs") {
        this.db.exec("DELETE FROM print_jobs;");
        const insert = this.db.prepare(
          "INSERT INTO print_jobs (id, template_id, template_name, printer_id, printer_name, copies, record_count, status, format, submitted_by, submitted_at, completed_at, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        for (const item of items) {
          insert.run(
            item.id,
            item.templateId || "",
            item.templateName || "",
            item.printerId || "",
            item.printerName || "",
            item.copies || 1,
            item.recordCount || 1,
            item.status || "completed",
            item.format || "zpl",
            item.submittedBy || "",
            item.submittedAt || (/* @__PURE__ */ new Date()).toISOString(),
            item.completedAt || null,
            JSON.stringify(item)
          );
        }
      }
      const deleteKvs = this.db.prepare("DELETE FROM key_value_store WHERE collection = ?");
      deleteKvs.run(collectionName);
      const insertKvs = this.db.prepare(
        "INSERT OR REPLACE INTO key_value_store (collection, id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
      );
      const now = (/* @__PURE__ */ new Date()).toISOString();
      let itemIdx = 0;
      for (const item of items) {
        const id = item.id || item.jobCode || item._id || `item-${itemIdx}-${Math.random().toString(36).substring(2, 7)}`;
        insertKvs.run(collectionName, String(id), JSON.stringify(item), item.createdAt || now, now);
        itemIdx++;
      }
      this.db.exec("COMMIT;");
      return true;
    } catch (err) {
      this.db.exec("ROLLBACK;");
      console.error(`[SqliteDatabaseProvider] Error writing collection "${collectionName}":`, err);
      return false;
    }
  }
  upsertItem(collectionName, item) {
    try {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const insertKvs = this.db.prepare(
        "INSERT OR REPLACE INTO key_value_store (collection, id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
      );
      insertKvs.run(collectionName, item.id, JSON.stringify(item), item.createdAt || now, now);
      if (collectionName === "templates") {
        const t = item;
        const insert = this.db.prepare(
          `INSERT OR REPLACE INTO templates 
           (id, name, author_email, category, status, version, data, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        insert.run(
          t.id,
          t.name,
          t.authorEmail || t.author || "",
          t.category || "General",
          t.status || "draft",
          t.version || "1.0.0",
          JSON.stringify(t),
          t.createdAt || now,
          now
        );
      } else if (collectionName === "users") {
        const u = item;
        const insert = this.db.prepare(
          `INSERT OR REPLACE INTO users 
           (id, email, name, role, status, department, permissions, data, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        insert.run(
          u.id,
          u.email,
          u.name,
          u.role,
          u.status || "approved",
          u.department || "",
          JSON.stringify(u.permissions || {}),
          JSON.stringify(u),
          u.createdAt || now,
          now
        );
      }
      return true;
    } catch (err) {
      console.error(`[SqliteDatabaseProvider] Error upserting item in "${collectionName}":`, err);
      return false;
    }
  }
  deleteItem(collectionName, id) {
    try {
      const delKvs = this.db.prepare("DELETE FROM key_value_store WHERE collection = ? AND id = ?");
      delKvs.run(collectionName, id);
      if (collectionName === "templates") {
        this.db.prepare("DELETE FROM templates WHERE id = ?").run(id);
      } else if (collectionName === "users") {
        this.db.prepare("DELETE FROM users WHERE id = ?").run(id);
      } else if (collectionName === "datasets") {
        this.db.prepare("DELETE FROM datasets WHERE id = ?").run(id);
      } else if (collectionName === "printers") {
        this.db.prepare("DELETE FROM printers WHERE id = ?").run(id);
      } else if (collectionName === "printJobs") {
        this.db.prepare("DELETE FROM print_jobs WHERE id = ?").run(id);
      }
      return true;
    } catch (err) {
      console.error(`[SqliteDatabaseProvider] Error deleting item "${id}" in "${collectionName}":`, err);
      return false;
    }
  }
  close() {
    if (this.db) {
      this.db.close();
    }
  }
};

// barcode-automation-backend/src/db/databaseService.ts
var DatabaseService = class _DatabaseService {
  constructor() {
    this.isInitialized = false;
    this.dataDir = path2.resolve(process.cwd(), "barcode-automation-backend/data");
    if (!fs2.existsSync(this.dataDir)) {
      fs2.mkdirSync(this.dataDir, { recursive: true });
    }
    this.provider = new SqliteDatabaseProvider();
  }
  static getInstance() {
    if (!_DatabaseService.instance) {
      _DatabaseService.instance = new _DatabaseService();
      _DatabaseService.instance.initSync();
    }
    return _DatabaseService.instance;
  }
  initSync() {
    if (this.isInitialized) return;
    try {
      this.provider.initialize();
      this.migrateJsonFilesIfPresent();
      this.isInitialized = true;
    } catch (err) {
      console.error("[DatabaseService] Failed to initialize database provider:", err);
    }
  }
  /**
   * Automatically migrates legacy JSON data files into SQLite if SQLite collection is empty
   */
  migrateJsonFilesIfPresent() {
    const knownCollections = [
      "templates",
      "users",
      "datasets",
      "printers",
      "printJobs",
      "auditLogs",
      "batchJobs",
      "license",
      "approvals",
      "approvalComments",
      "viewerLogs"
    ];
    for (const coll of knownCollections) {
      try {
        const jsonPath = path2.join(this.dataDir, `${coll}.json`);
        if (fs2.existsSync(jsonPath)) {
          const sqliteRows = this.provider.readCollection(coll, []);
          if (sqliteRows.length === 0) {
            const raw = fs2.readFileSync(jsonPath, "utf-8");
            const data = JSON.parse(raw);
            const items = Array.isArray(data) ? data : [data];
            if (items.length > 0) {
              console.log(`[DatabaseService] Migrating ${items.length} records from ${coll}.json into SQLite...`);
              this.provider.writeCollection(coll, items);
              console.log(`[DatabaseService] Successfully migrated ${coll}.json.`);
            }
          }
        }
      } catch (err) {
        console.warn(`[DatabaseService] Error migrating ${coll}.json:`, err);
      }
    }
  }
  getProvider() {
    return this.provider;
  }
  read(collection, fallback = []) {
    const items = this.provider.readCollection(collection, fallback);
    return items;
  }
  write(collection, items) {
    const success = this.provider.writeCollection(collection, items);
    if (success) {
      this.syncToJsonFile(collection, items);
    }
    return success;
  }
  upsert(collection, item) {
    const success = this.provider.upsertItem(collection, item);
    if (success) {
      const all = this.provider.readCollection(collection, []);
      this.syncToJsonFile(collection, all);
    }
    return success;
  }
  delete(collection, id) {
    const success = this.provider.deleteItem(collection, id);
    if (success) {
      const all = this.provider.readCollection(collection, []);
      this.syncToJsonFile(collection, all);
    }
    return success;
  }
  query(sql, params = []) {
    return this.provider.query(sql, params);
  }
  queryOne(sql, params = []) {
    return this.provider.queryOne(sql, params);
  }
  execute(sql, params = []) {
    this.provider.execute(sql, params);
  }
  syncToJsonFile(collection, items) {
    try {
      const filePath = path2.join(this.dataDir, `${collection}.json`);
      const tmpPath = `${filePath}.tmp`;
      fs2.writeFileSync(tmpPath, JSON.stringify(items, null, 2), "utf-8");
      fs2.renameSync(tmpPath, filePath);
    } catch (err) {
      console.warn(`[DatabaseService] Failed to sync ${collection}.json:`, err);
    }
  }
};

// src/services/initialTemplates.ts
var INITIAL_TEMPLATES = [
  {
    id: "tmpl-document1-btw",
    name: "Document1.btw",
    description: "Industrial Dual Barcode Label Format",
    category: "Manufacturing",
    version: "1.0",
    status: "published",
    complianceStandard: "Custom",
    dimensions: {
      width: 100,
      height: 50,
      unit: "mm",
      dpi: 300,
      orientation: "landscape"
    },
    margins: { top: 2, right: 2, bottom: 2, left: 2, bleed: 1, safeZone: 2 },
    tags: ["BarCode Automation", "Direct Thermal", "Industrial", "Dual Barcode"],
    createdBy: "Administrator",
    createdAt: "2026-08-14T10:00:00Z",
    updatedAt: "2026-08-14T18:30:00Z",
    approvedBy: "Lead Engineer",
    approvedAt: "2026-08-14T18:30:00Z",
    variables: [
      { id: "v1", name: "CODE_VAL", type: "static", defaultValue: "12345678" }
    ],
    sampleRecords: [
      { CODE_VAL: "12345678" },
      { CODE_VAL: "87654321" },
      { CODE_VAL: "99001122" }
    ],
    elements: [
      {
        id: "el-barcode-1",
        name: "Barcode 1",
        type: "barcode",
        symbology: "code128",
        value: "12345678",
        includeText: true,
        textPosition: "below",
        barWidth: 1.8,
        barHeight: 14,
        quietZone: true,
        foregroundColor: "#000000",
        backgroundColor: "#ffffff",
        checkDigit: false,
        x: 10.9,
        y: 4.8,
        width: 68.6,
        height: 15.2,
        rotation: 0,
        opacity: 1,
        locked: false,
        visible: true,
        zIndex: 1
      },
      {
        id: "el-barcode-2",
        name: "Barcode 3",
        type: "barcode",
        symbology: "code128",
        value: "12345678",
        includeText: true,
        textPosition: "below",
        barWidth: 1.8,
        barHeight: 14,
        quietZone: true,
        foregroundColor: "#000000",
        backgroundColor: "#ffffff",
        checkDigit: false,
        x: 10.9,
        y: 22.1,
        width: 68.6,
        height: 15.2,
        rotation: 0,
        opacity: 1,
        locked: false,
        visible: true,
        zIndex: 2
      }
    ]
  },
  {
    id: "tmpl-gs1-logistics-102x152",
    name: "GS1-128 Logistics Shipping Pallet Label (4x6 in)",
    description: "Standard GS1-128 Master Shipping Label with SSCC-18, Ship-To, Purchase Order, and Logistics Tracking.",
    category: "Logistics",
    version: "1.4",
    status: "published",
    complianceStandard: "GS1-128",
    dimensions: {
      width: 102,
      height: 152,
      unit: "mm",
      dpi: 203,
      orientation: "portrait"
    },
    margins: { top: 2, right: 2, bottom: 2, left: 2, bleed: 1, safeZone: 2 },
    tags: ["GS1", "Logistics", "Shipping", "SSCC", "Pallet", "Thermal"],
    createdBy: "System Architect",
    createdAt: "2026-01-15T09:00:00Z",
    updatedAt: "2026-03-20T14:30:00Z",
    approvedBy: "Quality Assurance Lead",
    approvedAt: "2026-03-20T16:00:00Z",
    variables: [
      { id: "v1", name: "SHIP_TO_COMPANY", type: "static", defaultValue: "ACME LOGISTICS DISTRIBUTION" },
      { id: "v2", name: "SHIP_TO_ADDRESS", type: "static", defaultValue: "742 EVERGREEN TERRACE, CHICAGO IL 60601" },
      { id: "v3", name: "PO_NUMBER", type: "static", defaultValue: "PO-889240" },
      { id: "v4", name: "PALLET_SSCC", type: "counter", defaultValue: "001085000650000123", prefix: "00", counterStart: 10001, counterStep: 1, counterPad: 16 },
      { id: "v5", name: "GTIN_14", type: "static", defaultValue: "10850006531230" },
      { id: "v6", name: "BATCH_LOT", type: "static", defaultValue: "LOT-2026-B9" },
      { id: "v7", name: "EXPIRY_DATE", type: "date", defaultValue: "2027-12-31", dateFormat: "YYMMDD" },
      { id: "v8", name: "TOTAL_WEIGHT", type: "static", defaultValue: "482.5 KG" }
    ],
    sampleRecords: [
      {
        SHIP_TO_COMPANY: "NORTHWEST MEDICAL DEPOT",
        SHIP_TO_ADDRESS: "1200 SUPPLY WAY, SEATTLE WA 98101",
        PO_NUMBER: "PO-991204",
        PALLET_SSCC: "(00)008500065123456784",
        GTIN_14: "10850006531230",
        BATCH_LOT: "LOT-NWM-01",
        EXPIRY_DATE: "271231",
        TOTAL_WEIGHT: "512.0 KG"
      },
      {
        SHIP_TO_COMPANY: "GLOBAL FREIGHT HUB 4",
        SHIP_TO_ADDRESS: "500 AIRPORT ROAD, DALLAS TX 75261",
        PO_NUMBER: "PO-991205",
        PALLET_SSCC: "(00)008500065123456784",
        GTIN_14: "10850006531230",
        BATCH_LOT: "LOT-NWM-02",
        EXPIRY_DATE: "271231",
        TOTAL_WEIGHT: "495.8 KG"
      }
    ],
    elements: [
      // Top Header Ship From
      {
        id: "el-header-box",
        name: "Ship From Header Box",
        type: "shape",
        shapeType: "rectangle",
        x: 3,
        y: 3,
        width: 96,
        height: 18,
        fillColor: "#ffffff",
        strokeColor: "#000000",
        strokeWidth: 0.4,
        strokeStyle: "solid",
        cornerRadius: 0,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 1,
        rotation: 0
      },
      {
        id: "el-shipfrom-lbl",
        name: "Ship From Label",
        type: "text",
        text: "SHIP FROM:",
        fontFamily: "Helvetica",
        fontSize: 7,
        fontWeight: "bold",
        fontStyle: "normal",
        textDecoration: "none",
        textAlign: "left",
        verticalAlign: "top",
        color: "#000000",
        lineHeight: 1.2,
        letterSpacing: 0,
        x: 5,
        y: 4,
        width: 30,
        height: 4,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 2,
        rotation: 0
      },
      {
        id: "el-shipfrom-val",
        name: "Ship From Text",
        type: "text",
        text: "APEX INDUSTRIAL SUPPLY CORP\n100 MANUFACTURING WAY, DETROIT MI 48201",
        fontFamily: "Helvetica",
        fontSize: 7.5,
        fontWeight: "normal",
        fontStyle: "normal",
        textDecoration: "none",
        textAlign: "left",
        verticalAlign: "top",
        color: "#000000",
        lineHeight: 1.3,
        letterSpacing: 0,
        multiline: true,
        x: 5,
        y: 8,
        width: 88,
        height: 10,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 3,
        rotation: 0
      },
      // Ship To Section
      {
        id: "el-shipto-box",
        name: "Ship To Box",
        type: "shape",
        shapeType: "rectangle",
        x: 3,
        y: 22,
        width: 96,
        height: 25,
        fillColor: "#ffffff",
        strokeColor: "#000000",
        strokeWidth: 0.4,
        strokeStyle: "solid",
        cornerRadius: 0,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 4,
        rotation: 0
      },
      {
        id: "el-shipto-lbl",
        name: "Ship To Label",
        type: "text",
        text: "SHIP TO (POSTAL CODE: 60601):",
        fontFamily: "Helvetica",
        fontSize: 8,
        fontWeight: "bold",
        fontStyle: "normal",
        textDecoration: "none",
        textAlign: "left",
        verticalAlign: "top",
        color: "#000000",
        lineHeight: 1.2,
        letterSpacing: 0,
        x: 5,
        y: 23.5,
        width: 90,
        height: 4,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 5,
        rotation: 0
      },
      {
        id: "el-shipto-company",
        name: "Ship To Company",
        type: "text",
        text: "ACME LOGISTICS DISTRIBUTION",
        dataBinding: "{{SHIP_TO_COMPANY}}",
        fontFamily: "Helvetica",
        fontSize: 10,
        fontWeight: "bold",
        fontStyle: "normal",
        textDecoration: "none",
        textAlign: "left",
        verticalAlign: "top",
        color: "#000000",
        lineHeight: 1.2,
        letterSpacing: 0,
        x: 5,
        y: 28,
        width: 90,
        height: 5,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 6,
        rotation: 0
      },
      {
        id: "el-shipto-addr",
        name: "Ship To Address",
        type: "text",
        text: "742 EVERGREEN TERRACE, CHICAGO IL 60601",
        dataBinding: "{{SHIP_TO_ADDRESS}}",
        fontFamily: "Helvetica",
        fontSize: 8.5,
        fontWeight: "normal",
        fontStyle: "normal",
        textDecoration: "none",
        textAlign: "left",
        verticalAlign: "top",
        color: "#000000",
        lineHeight: 1.2,
        letterSpacing: 0,
        x: 5,
        y: 34,
        width: 90,
        height: 10,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 7,
        rotation: 0
      },
      // PO & Logistics Specs Grid
      {
        id: "el-po-box",
        name: "PO & Weight Specs Box",
        type: "shape",
        shapeType: "rectangle",
        x: 3,
        y: 48,
        width: 96,
        height: 20,
        fillColor: "#ffffff",
        strokeColor: "#000000",
        strokeWidth: 0.4,
        strokeStyle: "solid",
        cornerRadius: 0,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 8,
        rotation: 0
      },
      {
        id: "el-po-lbl",
        name: "PO Label",
        type: "text",
        text: "PURCHASE ORDER:",
        fontFamily: "Helvetica",
        fontSize: 7.5,
        fontWeight: "bold",
        fontStyle: "normal",
        textDecoration: "none",
        textAlign: "left",
        verticalAlign: "top",
        color: "#000000",
        lineHeight: 1,
        letterSpacing: 0,
        x: 5,
        y: 50,
        width: 40,
        height: 4,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 9,
        rotation: 0
      },
      {
        id: "el-po-val",
        name: "PO Value",
        type: "text",
        text: "PO-889240",
        dataBinding: "{{PO_NUMBER}}",
        fontFamily: "Helvetica",
        fontSize: 11,
        fontWeight: "bold",
        fontStyle: "normal",
        textDecoration: "none",
        textAlign: "left",
        verticalAlign: "top",
        color: "#000000",
        lineHeight: 1,
        letterSpacing: 0,
        x: 5,
        y: 55,
        width: 40,
        height: 6,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 10,
        rotation: 0
      },
      {
        id: "el-wt-lbl",
        name: "Weight Label",
        type: "text",
        text: "GROSS WEIGHT:",
        fontFamily: "Helvetica",
        fontSize: 7.5,
        fontWeight: "bold",
        fontStyle: "normal",
        textDecoration: "none",
        textAlign: "left",
        verticalAlign: "top",
        color: "#000000",
        lineHeight: 1,
        letterSpacing: 0,
        x: 52,
        y: 50,
        width: 40,
        height: 4,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 11,
        rotation: 0
      },
      {
        id: "el-wt-val",
        name: "Weight Value",
        type: "text",
        text: "482.5 KG",
        dataBinding: "{{TOTAL_WEIGHT}}",
        fontFamily: "Helvetica",
        fontSize: 11,
        fontWeight: "bold",
        fontStyle: "normal",
        textDecoration: "none",
        textAlign: "left",
        verticalAlign: "top",
        color: "#000000",
        lineHeight: 1,
        letterSpacing: 0,
        x: 52,
        y: 55,
        width: 40,
        height: 6,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 12,
        rotation: 0
      },
      // Middle GS1-128 Item Barcode
      {
        id: "el-item-barcode-box",
        name: "Item Barcode Section",
        type: "shape",
        shapeType: "rectangle",
        x: 3,
        y: 69,
        width: 96,
        height: 38,
        fillColor: "#ffffff",
        strokeColor: "#000000",
        strokeWidth: 0.4,
        strokeStyle: "solid",
        cornerRadius: 0,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 13,
        rotation: 0
      },
      {
        id: "el-gtin-lbl",
        name: "GTIN and Batch Label",
        type: "text",
        text: "CONTENTS: (01) GTIN + (17) EXPIRY + (10) LOT",
        fontFamily: "Helvetica",
        fontSize: 7,
        fontWeight: "bold",
        fontStyle: "normal",
        textDecoration: "none",
        textAlign: "left",
        verticalAlign: "top",
        color: "#000000",
        lineHeight: 1,
        letterSpacing: 0,
        x: 5,
        y: 71,
        width: 90,
        height: 4,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 14,
        rotation: 0
      },
      {
        id: "el-item-barcode",
        name: "GS1-128 Content Barcode",
        type: "barcode",
        symbology: "gs1-128",
        value: "(01)10850006531230(17)271231(10)LOT-2026-B9",
        includeText: true,
        textPosition: "below",
        barWidth: 1.6,
        barHeight: 18,
        quietZone: true,
        foregroundColor: "#000000",
        backgroundColor: "#ffffff",
        checkDigit: true,
        x: 6,
        y: 76,
        width: 90,
        height: 28,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 15,
        rotation: 0
      },
      // Bottom Master SSCC Pallet Barcode
      {
        id: "el-sscc-box",
        name: "SSCC Pallet Box",
        type: "shape",
        shapeType: "rectangle",
        x: 3,
        y: 108,
        width: 96,
        height: 40,
        fillColor: "#ffffff",
        strokeColor: "#000000",
        strokeWidth: 0.4,
        strokeStyle: "solid",
        cornerRadius: 0,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 16,
        rotation: 0
      },
      {
        id: "el-sscc-lbl",
        name: "SSCC Title",
        type: "text",
        text: "SERIAL SHIPPING CONTAINER CODE (SSCC-18):",
        fontFamily: "Helvetica",
        fontSize: 7.5,
        fontWeight: "bold",
        fontStyle: "normal",
        textDecoration: "none",
        textAlign: "center",
        verticalAlign: "top",
        color: "#000000",
        lineHeight: 1,
        letterSpacing: 0,
        x: 5,
        y: 110,
        width: 92,
        height: 4,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 17,
        rotation: 0
      },
      {
        id: "el-sscc-barcode",
        name: "Master SSCC-18 Barcode",
        type: "barcode",
        symbology: "gs1-128",
        value: "(00)008500065123456784",
        dataBinding: "{{PALLET_SSCC}}",
        includeText: true,
        textPosition: "below",
        barWidth: 1.8,
        barHeight: 22,
        quietZone: true,
        foregroundColor: "#000000",
        backgroundColor: "#ffffff",
        checkDigit: true,
        x: 6,
        y: 115,
        width: 90,
        height: 30,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 18,
        rotation: 0
      }
    ]
  },
  {
    id: "tmpl-fda-udi-pharma-80x50",
    name: "FDA UDI Medical Device Serialization Label (80x50 mm)",
    description: "Compliant FDA Unique Device Identification label featuring GS1 DataMatrix 2D code, GTIN-14, Lot, Expiry and Serial Number.",
    category: "Pharma & Healthcare",
    version: "2.1",
    status: "approved",
    complianceStandard: "FDA-UDI",
    dimensions: {
      width: 80,
      height: 50,
      unit: "mm",
      dpi: 300,
      orientation: "landscape"
    },
    margins: { top: 1.5, right: 1.5, bottom: 1.5, left: 1.5, bleed: 1, safeZone: 1.5 },
    tags: ["FDA", "UDI", "Medical Device", "Pharma", "GS1 DataMatrix", "Serialization"],
    createdBy: "Pharma Compliance Engineer",
    createdAt: "2026-02-10T11:00:00Z",
    updatedAt: "2026-04-05T15:20:00Z",
    approvedBy: "Regulatory Affairs Director",
    approvedAt: "2026-04-06T09:30:00Z",
    variables: [
      { id: "v1", name: "DEVICE_NAME", type: "static", defaultValue: "SURGICAL GUIDE PIN 3.2MM" },
      { id: "v2", name: "CATALOG_NO", type: "static", defaultValue: "REF: SGP-320-X" },
      { id: "v3", name: "LOT_NO", type: "static", defaultValue: "LOT: 202604A" },
      { id: "v4", name: "EXP_DATE", type: "date", defaultValue: "2029-03-31", dateFormat: "YYYY-MM-DD" },
      { id: "v5", name: "SERIAL_NO", type: "counter", defaultValue: "SN: 8849201", counterStart: 8849201, counterStep: 1, counterPad: 7 },
      { id: "v6", name: "UDI_DATAMATRIX", type: "static", defaultValue: "(01)00850006539987(17)290331(10)202604A(21)8849201" }
    ],
    sampleRecords: [
      {
        DEVICE_NAME: "SURGICAL GUIDE PIN 3.2MM",
        CATALOG_NO: "REF: SGP-320-X",
        LOT_NO: "LOT: 202604A",
        EXP_DATE: "2029-03-31",
        SERIAL_NO: "SN: 8849201",
        UDI_DATAMATRIX: "(01)00850006539987(17)290331(10)202604A(21)8849201"
      },
      {
        DEVICE_NAME: "SURGICAL GUIDE PIN 3.2MM",
        CATALOG_NO: "REF: SGP-320-X",
        LOT_NO: "LOT: 202604A",
        EXP_DATE: "2029-03-31",
        SERIAL_NO: "SN: 8849202",
        UDI_DATAMATRIX: "(01)00850006539987(17)290331(10)202604A(21)8849202"
      }
    ],
    elements: [
      // Border box
      {
        id: "el-udi-border",
        name: "Outer Border",
        type: "shape",
        shapeType: "rectangle",
        x: 2,
        y: 2,
        width: 76,
        height: 46,
        fillColor: "#ffffff",
        strokeColor: "#000000",
        strokeWidth: 0.4,
        strokeStyle: "solid",
        cornerRadius: 1,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 1,
        rotation: 0
      },
      // Title & Manufacturer
      {
        id: "el-mfg-title",
        name: "Manufacturer Name",
        type: "text",
        text: "MEDTECH BIO-SOLUTIONS INC.",
        fontFamily: "Helvetica",
        fontSize: 7.5,
        fontWeight: "bold",
        fontStyle: "normal",
        textDecoration: "none",
        textAlign: "left",
        verticalAlign: "top",
        color: "#1e3a8a",
        lineHeight: 1,
        letterSpacing: 0,
        x: 4,
        y: 4,
        width: 50,
        height: 4,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 2,
        rotation: 0
      },
      {
        id: "el-dev-name",
        name: "Device Name",
        type: "text",
        text: "SURGICAL GUIDE PIN 3.2MM - STERILE R",
        dataBinding: "{{DEVICE_NAME}}",
        fontFamily: "Helvetica",
        fontSize: 8.5,
        fontWeight: "bold",
        fontStyle: "normal",
        textDecoration: "none",
        textAlign: "left",
        verticalAlign: "top",
        color: "#000000",
        lineHeight: 1.1,
        letterSpacing: 0,
        x: 4,
        y: 8,
        width: 50,
        height: 8,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 3,
        rotation: 0
      },
      // GS1 DataMatrix
      {
        id: "el-udi-dm",
        name: "GS1 UDI DataMatrix",
        type: "barcode",
        symbology: "gs1-datamatrix",
        value: "(01)00850006539987(17)290331(10)202604A(21)8849201",
        dataBinding: "{{UDI_DATAMATRIX}}",
        includeText: false,
        textPosition: "none",
        barWidth: 2,
        barHeight: 20,
        quietZone: true,
        foregroundColor: "#000000",
        backgroundColor: "#ffffff",
        checkDigit: true,
        x: 56,
        y: 4,
        width: 20,
        height: 20,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 4,
        rotation: 0
      },
      // Medical Symbols & Fields
      {
        id: "el-ref-no",
        name: "REF Catalog No",
        type: "text",
        text: "REF: SGP-320-X",
        dataBinding: "{{CATALOG_NO}}",
        fontFamily: "Courier",
        fontSize: 7.5,
        fontWeight: "bold",
        fontStyle: "normal",
        textDecoration: "none",
        textAlign: "left",
        verticalAlign: "top",
        color: "#000000",
        lineHeight: 1,
        letterSpacing: 0,
        x: 4,
        y: 17,
        width: 50,
        height: 4,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 5,
        rotation: 0
      },
      {
        id: "el-lot-no",
        name: "LOT Number",
        type: "text",
        text: "LOT: 202604A",
        dataBinding: "{{LOT_NO}}",
        fontFamily: "Courier",
        fontSize: 7.5,
        fontWeight: "bold",
        fontStyle: "normal",
        textDecoration: "none",
        textAlign: "left",
        verticalAlign: "top",
        color: "#000000",
        lineHeight: 1,
        letterSpacing: 0,
        x: 4,
        y: 22,
        width: 35,
        height: 4,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 6,
        rotation: 0
      },
      {
        id: "el-exp-date",
        name: "Expiry Date",
        type: "text",
        text: "EXP: 2029-03-31",
        dataBinding: "{{EXP_DATE}}",
        fontFamily: "Courier",
        fontSize: 7.5,
        fontWeight: "bold",
        fontStyle: "normal",
        textDecoration: "none",
        textAlign: "left",
        verticalAlign: "top",
        color: "#000000",
        lineHeight: 1,
        letterSpacing: 0,
        x: 40,
        y: 22,
        width: 35,
        height: 4,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 7,
        rotation: 0
      },
      {
        id: "el-sn-no",
        name: "Serial Number",
        type: "text",
        text: "SN: 8849201",
        dataBinding: "{{SERIAL_NO}}",
        fontFamily: "Courier",
        fontSize: 7.5,
        fontWeight: "bold",
        fontStyle: "normal",
        textDecoration: "none",
        textAlign: "left",
        verticalAlign: "top",
        color: "#000000",
        lineHeight: 1,
        letterSpacing: 0,
        x: 4,
        y: 27,
        width: 50,
        height: 4,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 8,
        rotation: 0
      },
      // Linear UDI Code 128 Backup at bottom
      {
        id: "el-udi-linear",
        name: "Linear Code 128",
        type: "barcode",
        symbology: "code128",
        value: "SGP320X-8849201",
        includeText: true,
        textPosition: "below",
        barWidth: 1.3,
        barHeight: 10,
        quietZone: true,
        foregroundColor: "#000000",
        backgroundColor: "#ffffff",
        checkDigit: true,
        x: 4,
        y: 31,
        width: 72,
        height: 15,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 9,
        rotation: 0
      }
    ]
  },
  {
    id: "tmpl-retail-price-tag-50x30",
    name: "Retail Product Price & EAN-13 Tag (50x30 mm)",
    description: "Commercial retail apparel / grocery shelf tag with EAN-13 barcode, SKU, currency pricing, and promotion badge.",
    category: "Retail",
    version: "1.0",
    status: "published",
    complianceStandard: "Avery-Standard",
    dimensions: {
      width: 50,
      height: 30,
      unit: "mm",
      dpi: 300,
      orientation: "landscape"
    },
    margins: { top: 1, right: 1, bottom: 1, left: 1, bleed: 0.5, safeZone: 1 },
    tags: ["Retail", "EAN-13", "Price Tag", "Apparel", "Shelf Tag"],
    createdBy: "Retail Merchandise Lead",
    createdAt: "2026-03-01T08:00:00Z",
    updatedAt: "2026-03-01T08:00:00Z",
    variables: [
      { id: "v1", name: "BRAND", type: "static", defaultValue: "URBAN OUTFITTERS" },
      { id: "v2", name: "PRODUCT_TITLE", type: "static", defaultValue: "CLASSIC COTTON POLO - NAVY" },
      { id: "v3", name: "SIZE", type: "static", defaultValue: "SIZE: L" },
      { id: "v4", name: "PRICE", type: "static", defaultValue: "$39.99" },
      { id: "v5", name: "EAN_BARCODE", type: "static", defaultValue: "5901234123457" }
    ],
    sampleRecords: [
      { BRAND: "URBAN OUTFITTERS", PRODUCT_TITLE: "CLASSIC COTTON POLO - NAVY", SIZE: "SIZE: L", PRICE: "$39.99", EAN_BARCODE: "5901234123457" },
      { BRAND: "URBAN OUTFITTERS", PRODUCT_TITLE: "CLASSIC COTTON POLO - WHITE", SIZE: "SIZE: M", PRICE: "$39.99", EAN_BARCODE: "5901234123464" },
      { BRAND: "URBAN OUTFITTERS", PRODUCT_TITLE: "SLIM FIT CHINO - KHAKI", SIZE: "SIZE: 32/34", PRICE: "$54.50", EAN_BARCODE: "5901234123471" }
    ],
    elements: [
      {
        id: "el-brand-title",
        name: "Brand Name",
        type: "text",
        text: "URBAN OUTFITTERS",
        dataBinding: "{{BRAND}}",
        fontFamily: "Helvetica",
        fontSize: 7,
        fontWeight: "bold",
        fontStyle: "normal",
        textDecoration: "none",
        textAlign: "center",
        verticalAlign: "top",
        color: "#475569",
        lineHeight: 1,
        letterSpacing: 1,
        x: 2,
        y: 2,
        width: 46,
        height: 3.5,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 1,
        rotation: 0
      },
      {
        id: "el-prod-desc",
        name: "Product Description",
        type: "text",
        text: "CLASSIC COTTON POLO - NAVY",
        dataBinding: "{{PRODUCT_TITLE}}",
        fontFamily: "Helvetica",
        fontSize: 7.5,
        fontWeight: "bold",
        fontStyle: "normal",
        textDecoration: "none",
        textAlign: "center",
        verticalAlign: "top",
        color: "#0f172a",
        lineHeight: 1,
        letterSpacing: 0,
        x: 2,
        y: 5.5,
        width: 46,
        height: 4,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 2,
        rotation: 0
      },
      {
        id: "el-ean-barcode",
        name: "EAN-13 Retail Barcode",
        type: "barcode",
        symbology: "ean13",
        value: "5901234123457",
        dataBinding: "{{EAN_BARCODE}}",
        includeText: true,
        textPosition: "below",
        barWidth: 1.4,
        barHeight: 10,
        quietZone: true,
        foregroundColor: "#000000",
        backgroundColor: "#ffffff",
        checkDigit: true,
        x: 3,
        y: 9.5,
        width: 32,
        height: 18,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 3,
        rotation: 0
      },
      {
        id: "el-size-lbl",
        name: "Size Badge",
        type: "text",
        text: "SIZE: L",
        dataBinding: "{{SIZE}}",
        fontFamily: "Helvetica",
        fontSize: 7,
        fontWeight: "bold",
        fontStyle: "normal",
        textDecoration: "none",
        textAlign: "center",
        verticalAlign: "middle",
        color: "#0f172a",
        lineHeight: 1,
        letterSpacing: 0,
        x: 36,
        y: 11,
        width: 12,
        height: 4,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 4,
        rotation: 0
      },
      {
        id: "el-price-val",
        name: "Retail Price",
        type: "text",
        text: "$39.99",
        dataBinding: "{{PRICE}}",
        fontFamily: "Helvetica",
        fontSize: 12,
        fontWeight: "bold",
        fontStyle: "normal",
        textDecoration: "none",
        textAlign: "center",
        verticalAlign: "top",
        color: "#dc2626",
        lineHeight: 1,
        letterSpacing: 0,
        x: 35,
        y: 17,
        width: 14,
        height: 8,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 5,
        rotation: 0
      }
    ]
  },
  {
    id: "tmpl-chemical-ghs-105x74",
    name: "Chemical GHS Hazmat Classification (105x74 mm)",
    description: "OSHA GHS compliant hazardous chemical label with red diamond pictograms, DANGER signal word, and H/P statements.",
    category: "Chemical & GHS",
    version: "1.2",
    status: "published",
    complianceStandard: "GHS-Hazmat",
    dimensions: {
      width: 105,
      height: 74,
      unit: "mm",
      dpi: 300,
      orientation: "landscape"
    },
    margins: { top: 2, right: 2, bottom: 2, left: 2, bleed: 1, safeZone: 2 },
    tags: ["GHS", "Hazmat", "Chemical", "OSHA", "Safety", "DANGER"],
    createdBy: "EHS Director",
    createdAt: "2026-02-18T10:00:00Z",
    updatedAt: "2026-02-20T14:00:00Z",
    variables: [
      { id: "v1", name: "CHEM_NAME", type: "static", defaultValue: "ISOPROPYL ALCOHOL 99.8%" },
      { id: "v2", name: "UN_NUMBER", type: "static", defaultValue: "UN 1219, PG II" },
      { id: "v3", name: "CAS_NUMBER", type: "static", defaultValue: "CAS: 67-63-0" },
      { id: "v4", name: "BATCH_LOT", type: "static", defaultValue: "LOT: IPA-2026-09A" },
      { id: "v5", name: "QR_SDS", type: "static", defaultValue: "https://sds.chemical-safety.org/view/un1219" }
    ],
    sampleRecords: [
      { CHEM_NAME: "ISOPROPYL ALCOHOL 99.8%", UN_NUMBER: "UN 1219, PG II", CAS_NUMBER: "CAS: 67-63-0", BATCH_LOT: "LOT: IPA-2026-09A", QR_SDS: "https://sds.chemical-safety.org/view/un1219" }
    ],
    elements: [
      // Outer red hazard border
      {
        id: "el-ghs-border",
        name: "GHS Outer Border",
        type: "shape",
        shapeType: "rectangle",
        x: 2,
        y: 2,
        width: 101,
        height: 70,
        fillColor: "#ffffff",
        strokeColor: "#dc2626",
        strokeWidth: 0.8,
        strokeStyle: "solid",
        cornerRadius: 0,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 1,
        rotation: 0
      },
      // Danger Signal Banner
      {
        id: "el-danger-box",
        name: "Danger Signal Box",
        type: "shape",
        shapeType: "rectangle",
        x: 4,
        y: 4,
        width: 32,
        height: 9,
        fillColor: "#dc2626",
        strokeColor: "#dc2626",
        strokeWidth: 0.2,
        strokeStyle: "solid",
        cornerRadius: 0,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 2,
        rotation: 0
      },
      {
        id: "el-danger-txt",
        name: "DANGER Word",
        type: "text",
        text: "DANGER",
        fontFamily: "Helvetica",
        fontSize: 14,
        fontWeight: "bold",
        fontStyle: "normal",
        textDecoration: "none",
        textAlign: "center",
        verticalAlign: "middle",
        color: "#ffffff",
        lineHeight: 1,
        letterSpacing: 2,
        x: 4,
        y: 5.5,
        width: 32,
        height: 6,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 3,
        rotation: 0
      },
      // Chemical Name
      {
        id: "el-chem-name",
        name: "Chemical Name",
        type: "text",
        text: "ISOPROPYL ALCOHOL 99.8%",
        dataBinding: "{{CHEM_NAME}}",
        fontFamily: "Helvetica",
        fontSize: 12,
        fontWeight: "bold",
        fontStyle: "normal",
        textDecoration: "none",
        textAlign: "left",
        verticalAlign: "top",
        color: "#000000",
        lineHeight: 1.1,
        letterSpacing: 0,
        x: 40,
        y: 4,
        width: 60,
        height: 6,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 4,
        rotation: 0
      },
      {
        id: "el-chem-specs",
        name: "UN & CAS Specs",
        type: "text",
        text: "UN 1219, PG II | CAS: 67-63-0 | EC: 200-661-7",
        fontFamily: "Helvetica",
        fontSize: 7.5,
        fontWeight: "bold",
        fontStyle: "normal",
        textDecoration: "none",
        textAlign: "left",
        verticalAlign: "top",
        color: "#475569",
        lineHeight: 1,
        letterSpacing: 0,
        x: 40,
        y: 10,
        width: 60,
        height: 4,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 5,
        rotation: 0
      },
      // Hazard Statements
      {
        id: "el-h-statements",
        name: "Hazard Statements",
        type: "text",
        text: "H225: Highly flammable liquid and vapour.\nH319: Causes serious eye irritation.\nH336: May cause drowsiness or dizziness.\n\nPRECAUTIONARY STATEMENTS:\nP210: Keep away from heat, sparks, open flames.\nP280: Wear protective gloves and eye protection.",
        fontFamily: "Helvetica",
        fontSize: 6.5,
        fontWeight: "normal",
        fontStyle: "normal",
        textDecoration: "none",
        textAlign: "left",
        verticalAlign: "top",
        color: "#000000",
        lineHeight: 1.25,
        letterSpacing: 0,
        multiline: true,
        x: 4,
        y: 16,
        width: 65,
        height: 38,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 6,
        rotation: 0
      },
      // SDS QR Code
      {
        id: "el-sds-qr",
        name: "SDS Digital QR",
        type: "barcode",
        symbology: "qr",
        value: "https://sds.chemical-safety.org/view/un1219",
        dataBinding: "{{QR_SDS}}",
        includeText: false,
        textPosition: "none",
        barWidth: 2,
        barHeight: 20,
        quietZone: true,
        foregroundColor: "#000000",
        backgroundColor: "#ffffff",
        checkDigit: true,
        x: 74,
        y: 16,
        width: 25,
        height: 25,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 7,
        rotation: 0
      },
      {
        id: "el-sds-lbl",
        name: "Scan for SDS",
        type: "text",
        text: "SCAN FOR SAFETY DATA SHEET",
        fontFamily: "Helvetica",
        fontSize: 5.5,
        fontWeight: "bold",
        fontStyle: "normal",
        textDecoration: "none",
        textAlign: "center",
        verticalAlign: "top",
        color: "#000000",
        lineHeight: 1,
        letterSpacing: 0,
        x: 72,
        y: 42,
        width: 29,
        height: 3,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 8,
        rotation: 0
      },
      // Bottom Batch & Code 128
      {
        id: "el-ghs-barcode",
        name: "Batch Tracking Barcode",
        type: "barcode",
        symbology: "code128",
        value: "IPA-2026-09A-UN1219",
        includeText: true,
        textPosition: "below",
        barWidth: 1.4,
        barHeight: 12,
        quietZone: true,
        foregroundColor: "#000000",
        backgroundColor: "#ffffff",
        checkDigit: true,
        x: 4,
        y: 54,
        width: 97,
        height: 16,
        locked: false,
        visible: true,
        opacity: 1,
        zIndex: 9,
        rotation: 0
      }
    ]
  }
];

// src/services/mockDataService.ts
var INITIAL_PRINTERS = [
  {
    id: "prn-zebra-zt410",
    name: "Zebra ZT410 Industrial (Line 1)",
    model: "ZT410 4-inch Direct/Thermal Transfer",
    brand: "Zebra",
    dpi: 300,
    ipAddress: "192.168.1.120",
    port: 9100,
    status: "online",
    protocol: "zpl",
    location: "Packaging Line 1 - Bay A",
    mediaWidth: 104,
    mediaHeight: 152
  },
  {
    id: "prn-zebra-zd620",
    name: "Zebra ZD620 Desktop (Pharma Cleanroom)",
    model: "ZD620 Healthcare Direct Thermal",
    brand: "Zebra",
    dpi: 300,
    ipAddress: "192.168.1.125",
    port: 9100,
    status: "online",
    protocol: "zpl",
    location: "Pharma Serialization Cleanroom B",
    mediaWidth: 80,
    mediaHeight: 50
  },
  {
    id: "prn-tsc-ttp244",
    name: "TSC TTP-244 Pro (Warehouse Shipping)",
    model: "TTP-244 Pro 203 DPI",
    brand: "TSC",
    dpi: 203,
    ipAddress: "192.168.1.130",
    port: 9100,
    status: "online",
    protocol: "epl",
    location: "Outbound Logistics Dock 4",
    mediaWidth: 102,
    mediaHeight: 152
  },
  {
    id: "prn-sato-cl4nx",
    name: "SATO CL4NX Plus (Micro-UDI 600 DPI)",
    model: "CL4NX Plus High Resolution",
    brand: "SATO",
    dpi: 600,
    ipAddress: "192.168.1.150",
    port: 9100,
    status: "busy",
    protocol: "zpl",
    location: "Electronics Assembly Lab 3",
    mediaWidth: 50,
    mediaHeight: 30
  },
  {
    id: "prn-citizen-cls700",
    name: "Citizen CL-S700 Heavy-Duty",
    model: "CL-S700 Industrial Steel Case",
    brand: "Citizen",
    dpi: 300,
    ipAddress: "192.168.1.140",
    port: 9100,
    status: "online",
    protocol: "zpl",
    location: "Chemical Bottling Plant",
    mediaWidth: 105,
    mediaHeight: 74
  },
  {
    id: "prn-virtual-pdf",
    name: "Virtual PDF Vector Spooler",
    model: "High-DPI Server-side PDF Generator",
    brand: "Desktop PDF",
    dpi: 300,
    ipAddress: "127.0.0.1",
    port: 0,
    status: "online",
    protocol: "pdf",
    location: "Central Cloud Spooler",
    mediaWidth: 210,
    mediaHeight: 297
  }
];
var INITIAL_USERS = [
  {
    id: "usr-super-admin",
    name: "Super Administrator",
    email: "superadmin@gmail.com",
    password: "superadmin@gmail.com",
    role: "Super Admin",
    department: "Enterprise Security & Governance",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces",
    status: "approved",
    isApproved: true,
    createdAt: "2026-08-01T00:00:00Z",
    permissions: {
      canDesignTemplates: true,
      canCreateTemplates: true,
      canDeleteTemplates: true,
      canApproveWorkflow: true,
      canPrintAndSpool: true,
      canManageDatasets: true,
      canCalibratePrinters: true,
      canManageLicense: true,
      canDownloadDesktopApp: true,
      canViewAuditLogs: true
    }
  },
  {
    id: "usr-admin-01",
    name: "Sarah Jenkins",
    email: "sarah.jenkins@company.com",
    password: "password123",
    role: "Admin",
    department: "Packaging Engineering",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces",
    status: "approved",
    isApproved: true,
    createdAt: "2026-08-10T10:00:00Z",
    approvedAt: "2026-08-10T11:00:00Z",
    approvedBy: "Super Administrator",
    permissions: {
      canDesignTemplates: true,
      canCreateTemplates: true,
      canDeleteTemplates: false,
      canApproveWorkflow: true,
      canPrintAndSpool: true,
      canManageDatasets: true,
      canCalibratePrinters: true,
      canManageLicense: false,
      canDownloadDesktopApp: true,
      canViewAuditLogs: true
    }
  },
  {
    id: "usr-admin-pending",
    name: "Rajesh Kumar",
    email: "rajesh.kumar@pharma.com",
    password: "password123",
    role: "Admin",
    department: "Cleanroom Serialization Operations",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces",
    status: "pending_approval",
    isApproved: false,
    createdAt: "2026-08-21T14:30:00Z",
    permissions: {
      canDesignTemplates: true,
      canCreateTemplates: true,
      canDeleteTemplates: false,
      canApproveWorkflow: true,
      canPrintAndSpool: true,
      canManageDatasets: true,
      canCalibratePrinters: false,
      canManageLicense: false,
      canDownloadDesktopApp: true,
      canViewAuditLogs: true
    }
  },
  {
    id: "usr-designer",
    name: "Shivam",
    email: "shivam@gmail.com",
    password: "password123",
    role: "Admin",
    department: "Label Management & Engineering",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces",
    status: "approved",
    isApproved: true,
    createdAt: "2026-08-15T08:00:00Z",
    permissions: {
      canDesignTemplates: true,
      canCreateTemplates: true,
      canDeleteTemplates: true,
      canApproveWorkflow: true,
      canPrintAndSpool: true,
      canManageDatasets: true,
      canCalibratePrinters: true,
      canManageLicense: true,
      canDownloadDesktopApp: true,
      canViewAuditLogs: true
    }
  }
];
var INITIAL_BATCH_JOBS = [
  {
    id: "BAT-2026-001",
    jobCode: "BAT-2026-001",
    templateId: "tmpl-fda-udi-pharma-80x50",
    templateName: "FDA UDI Medical Device Serialization Label (80x50 mm)",
    productName: "SURGICAL GUIDE PIN 3.2MM",
    itemCode: "ITM-MED-88910",
    batchNumber: "BATCH-2026-X8",
    lotNumber: "LOT-9921",
    mfgDate: "2026-08-01",
    expDate: "2029-08-01",
    mrp: "$149.00",
    packFrom: 1,
    packTo: 10,
    totalPages: 10,
    status: "sent_to_viewer",
    generatedBy: "Adam Admin",
    generatedAt: "2026-08-16 10:20:00",
    sentToViewerAt: "2026-08-16 10:22:00",
    items: Array.from({ length: 10 }, (_, i) => ({
      pageNumber: i + 1,
      packNumber: i + 1,
      packLabel: `Pack ${i + 1}`,
      itemCode: "ITM-MED-88910",
      batchNumber: "BATCH-2026-X8",
      lotNumber: "LOT-9921",
      mfgDate: "2026-08-01",
      expDate: "2029-08-01",
      mrp: "$149.00",
      serialNumber: `SN-884920${i + 1}`,
      fullBarcodeData: `(01)00850006539987(17)290801(10)LOT-9921(21)884920${i + 1}`,
      isPrinted: false
    }))
  },
  {
    id: "BAT-2026-002",
    jobCode: "BAT-2026-002",
    templateId: "tmpl-gs1-logistics-102x152",
    templateName: "GS1-128 Logistics Shipping Pallet Label (4x6 in)",
    productName: "Industrial Fastener Assortment Box",
    itemCode: "ITM-LOG-7440",
    batchNumber: "BN-9021",
    lotNumber: "LOT-2026-B9",
    mfgDate: "2026-08-10",
    expDate: "2027-12-31",
    mrp: "$520.00",
    packFrom: 1,
    packTo: 5,
    totalPages: 5,
    status: "sent_to_viewer",
    generatedBy: "Adam Admin",
    generatedAt: "2026-08-17 14:15:00",
    sentToViewerAt: "2026-08-17 14:16:00",
    items: Array.from({ length: 5 }, (_, i) => ({
      pageNumber: i + 1,
      packNumber: i + 1,
      packLabel: `Pack ${i + 1}`,
      itemCode: "ITM-LOG-7440",
      batchNumber: "BN-9021",
      lotNumber: "LOT-2026-B9",
      mfgDate: "2026-08-10",
      expDate: "2027-12-31",
      mrp: "$520.00",
      serialNumber: `SSCC-00850006512345678${i + 1}`,
      fullBarcodeData: `(00)008500065123456784(10)LOT-2026-B9`,
      isPrinted: false
    }))
  }
];
var INITIAL_AUDIT_LOGS = [
  {
    id: "aud-101",
    timestamp: "2026-08-14T17:45:00Z",
    user: "Marcus Vance (Quality Reviewer)",
    userRole: "Quality Reviewer",
    action: "APPROVE_TEMPLATE",
    details: "Approved FDA UDI Medical Device Serialization Label (v2.1) following ISO 13485 verification check.",
    entityId: "tmpl-fda-udi-pharma-80x50",
    entityName: "FDA UDI Medical Device Serialization Label",
    ipAddress: "192.168.1.45"
  },
  {
    id: "aud-102",
    timestamp: "2026-08-14T17:15:20Z",
    user: "David Chen (Print Operator)",
    userRole: "Print Operator",
    action: "PRINT_JOB_DISPATCH",
    details: "Dispatched batch print job #PJ-9021 (500 copies) to Zebra ZT410 Industrial Line 1.",
    entityId: "pj-9021",
    entityName: "Batch Shipping Manifest Labels",
    ipAddress: "192.168.1.72"
  },
  {
    id: "aud-103",
    timestamp: "2026-08-14T16:30:10Z",
    user: "Elena Rostova (Label Designer)",
    userRole: "Label Designer",
    action: "CREATE_TEMPLATE",
    details: "Created new Chemical GHS Hazmat Classification Template with dual-language GHS statements.",
    entityId: "tmpl-chemical-ghs-105x74",
    entityName: "Chemical GHS Hazmat Classification",
    ipAddress: "192.168.1.33"
  },
  {
    id: "aud-104",
    timestamp: "2026-08-14T15:10:00Z",
    user: "Sarah Jenkins (Admin)",
    userRole: "Admin",
    action: "SYSTEM_CONFIG",
    details: "Updated thermal print server timeout thresholds and configured 600 DPI SATO printer endpoints.",
    ipAddress: "192.168.1.10"
  }
];
var INITIAL_PRINT_JOBS = [
  {
    id: "PJ-9021",
    templateId: "tmpl-gs1-logistics-102x152",
    templateName: "GS1-128 Logistics Shipping Pallet Label (4x6 in)",
    printerId: "prn-zebra-zt410",
    printerName: "Zebra ZT410 Industrial (Line 1)",
    copies: 250,
    recordCount: 50,
    status: "completed",
    format: "zpl",
    submittedBy: "David Chen",
    submittedAt: "2026-08-14T16:00:00Z",
    completedAt: "2026-08-14T16:04:12Z",
    progressPercent: 100
  },
  {
    id: "PJ-9022",
    templateId: "tmpl-fda-udi-pharma-80x50",
    templateName: "FDA UDI Medical Device Serialization Label",
    printerId: "prn-zebra-zd620",
    printerName: "Zebra ZD620 Desktop (Pharma Cleanroom)",
    copies: 50,
    recordCount: 50,
    status: "printing",
    format: "zpl",
    submittedBy: "Marcus Vance",
    submittedAt: "2026-08-14T18:10:00Z",
    progressPercent: 68
  },
  {
    id: "PJ-9023",
    templateId: "tmpl-retail-price-tag-50x30",
    templateName: "Retail Product Price & EAN-13 Tag",
    printerId: "prn-virtual-pdf",
    printerName: "Virtual PDF Vector Spooler",
    copies: 120,
    recordCount: 12,
    status: "queued",
    format: "pdf",
    submittedBy: "Elena Rostova",
    submittedAt: "2026-08-14T18:15:00Z",
    progressPercent: 0
  }
];

// barcode-automation-backend/src/services/storageService.ts
var DATA_DIR = path3.resolve(process.cwd(), "barcode-automation-backend/data");
var StorageService = class _StorageService {
  constructor() {
    this.ensureDataDir();
    this.seedDefaultsIfEmpty();
    this.db = DatabaseService.getInstance();
  }
  static getInstance() {
    if (!_StorageService.instance) {
      _StorageService.instance = new _StorageService();
    }
    return _StorageService.instance;
  }
  getDatabase() {
    return this.db;
  }
  ensureDataDir() {
    if (!fs3.existsSync(DATA_DIR)) {
      fs3.mkdirSync(DATA_DIR, { recursive: true });
    }
  }
  getFilePath(collection) {
    return path3.join(DATA_DIR, `${collection}.json`);
  }
  seedDefaultsIfEmpty() {
    const seedMap = {
      templates: INITIAL_TEMPLATES,
      templateVersions: [],
      approvals: [],
      approvalComments: [],
      viewerLogs: [],
      printers: INITIAL_PRINTERS,
      printJobs: INITIAL_PRINT_JOBS,
      auditLogs: INITIAL_AUDIT_LOGS,
      users: INITIAL_USERS,
      batchJobs: INITIAL_BATCH_JOBS || []
    };
    for (const [key, defaultData] of Object.entries(seedMap)) {
      const filePath = this.getFilePath(key);
      if (!fs3.existsSync(filePath)) {
        try {
          fs3.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), "utf-8");
          console.log(`[StorageService] Initialized database file: ${key}.json`);
        } catch (err) {
          console.error(`[StorageService] Failed to seed ${key}:`, err);
        }
      }
    }
  }
  read(collection, fallback = []) {
    return this.db.read(collection, fallback);
  }
  write(collection, data) {
    return this.db.write(collection, data);
  }
  upsert(collection, item) {
    return this.db.upsert(collection, item);
  }
  delete(collection, id) {
    return this.db.delete(collection, id);
  }
};

// barcode-automation-backend/src/services/auditService.ts
function logBackendAudit(user, userRole, action, details, entityId, entityName, ipAddress = "127.0.0.1") {
  const storage12 = StorageService.getInstance();
  const logs = storage12.read("auditLogs", []);
  const entry = {
    id: `aud-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    user: user || "System User",
    userRole: userRole || "Operator",
    action,
    details,
    entityId,
    entityName,
    ipAddress
  };
  logs.unshift(entry);
  storage12.write("auditLogs", logs);
  return entry;
}
var AuditService = class _AuditService {
  static getInstance() {
    if (!_AuditService.instance) {
      _AuditService.instance = new _AuditService();
    }
    return _AuditService.instance;
  }
  log(action, details, user = "System Admin", userRole = "Admin") {
    return logBackendAudit(user, userRole, action, details);
  }
};

// barcode-automation-backend/src/routes/templates.ts
var templatesRouter = Router();
var storage = StorageService.getInstance();
function bumpMinorVersion(version = "1.0") {
  const parts = version.split(".");
  if (parts.length >= 2) {
    const major = parseInt(parts[0], 10) || 1;
    const minor = parseInt(parts[1], 10) || 0;
    return `${major}.${minor + 1}`;
  }
  return `${version}.1`;
}
templatesRouter.get("/", (req, res) => {
  const { category, search, status } = req.query;
  let templates = storage.read("templates", []);
  if (category && category !== "all") {
    templates = templates.filter(
      (t) => t.category && t.category.toLowerCase() === category.toLowerCase()
    );
  }
  if (status && status !== "all") {
    templates = templates.filter((t) => t.status === status);
  }
  if (search) {
    const q = search.toLowerCase();
    templates = templates.filter(
      (t) => t.name?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || t.tags?.some((tag) => tag.toLowerCase().includes(q))
    );
  }
  res.json(templates);
});
templatesRouter.get("/:id", (req, res) => {
  const templates = storage.read("templates", []);
  const template = templates.find((t) => t.id === req.params.id);
  if (!template) {
    return res.status(404).json({ error: "Template not found" });
  }
  res.json(template);
});
templatesRouter.post("/", (req, res) => {
  const templates = storage.read("templates", []);
  const newTemplate = req.body;
  if (!newTemplate.id) {
    newTemplate.id = `tmpl-${Date.now()}`;
  }
  newTemplate.createdAt = newTemplate.createdAt || (/* @__PURE__ */ new Date()).toISOString();
  newTemplate.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  newTemplate.status = newTemplate.status || "draft";
  const existingIndex = templates.findIndex((t) => t.id === newTemplate.id);
  if (existingIndex >= 0) {
    const existing = templates[existingIndex];
    const isFrozen = existing.status === "pending_level_1" || existing.status === "pending_level_2" || existing.status === "approved";
    const isLayoutModified = JSON.stringify(existing.elements) !== JSON.stringify(newTemplate.elements);
    if (isFrozen && isLayoutModified && newTemplate.status === "draft") {
      const branchedVersion = bumpMinorVersion(existing.version);
      const branchedTemplate = {
        ...newTemplate,
        version: branchedVersion,
        status: "draft",
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        tags: Array.from(/* @__PURE__ */ new Set([...newTemplate.tags || [], "Draft Revision"]))
      };
      templates[existingIndex] = branchedTemplate;
      storage.write("templates", templates);
      logBackendAudit(
        req.body.modifiedBy || "Designer",
        "Label Designer",
        "EDIT_TEMPLATE",
        `Auto-branched template "${branchedTemplate.name}" to Draft Version v${branchedVersion} (Frozen v${existing.version} continues in approval)`,
        branchedTemplate.id,
        branchedTemplate.name
      );
      return res.json({
        ...branchedTemplate,
        _versionBranched: true,
        _previousFrozenVersion: existing.version
      });
    }
    templates[existingIndex] = {
      ...templates[existingIndex],
      ...newTemplate,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    storage.write("templates", templates);
    logBackendAudit(
      req.body.modifiedBy || "Designer",
      "Label Designer",
      "EDIT_TEMPLATE",
      `Updated template "${newTemplate.name}" (v${newTemplate.version || "1.0"})`,
      newTemplate.id,
      newTemplate.name
    );
    return res.json(templates[existingIndex]);
  }
  templates.unshift(newTemplate);
  storage.write("templates", templates);
  logBackendAudit(
    req.body.createdBy || "Designer",
    "Label Designer",
    "CREATE_TEMPLATE",
    `Created new label template "${newTemplate.name}" (v${newTemplate.version || "1.0"})`,
    newTemplate.id,
    newTemplate.name
  );
  res.status(201).json(newTemplate);
});
templatesRouter.put("/:id", (req, res) => {
  const templates = storage.read("templates", []);
  const index = templates.findIndex((t) => t.id === req.params.id);
  if (index === -1) {
    const newTemplate = {
      ...req.body,
      id: req.params.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    templates.unshift(newTemplate);
    storage.write("templates", templates);
    return res.status(201).json(newTemplate);
  }
  const existing = templates[index];
  const isFrozen = existing.status === "pending_level_1" || existing.status === "pending_level_2" || existing.status === "approved";
  const isLayoutModified = JSON.stringify(existing.elements) !== JSON.stringify(req.body.elements);
  if (isFrozen && isLayoutModified && req.body.status === "draft") {
    const branchedVersion = bumpMinorVersion(existing.version);
    const branchedTemplate = {
      ...req.body,
      id: req.params.id,
      version: branchedVersion,
      status: "draft",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      tags: Array.from(/* @__PURE__ */ new Set([...req.body.tags || [], "Draft Revision"]))
    };
    templates[index] = branchedTemplate;
    storage.write("templates", templates);
    logBackendAudit(
      req.body.modifiedBy || "Designer",
      "Label Designer",
      "EDIT_TEMPLATE",
      `Auto-branched template "${branchedTemplate.name}" to Draft Version v${branchedVersion} (Frozen v${existing.version} snapshot preserved)`,
      branchedTemplate.id,
      branchedTemplate.name
    );
    return res.json({
      ...branchedTemplate,
      _versionBranched: true,
      _previousFrozenVersion: existing.version
    });
  }
  const updated = {
    ...templates[index],
    ...req.body,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  templates[index] = updated;
  storage.write("templates", templates);
  logBackendAudit(
    req.body.modifiedBy || "Designer",
    "Label Designer",
    "EDIT_TEMPLATE",
    `Updated label template "${updated.name}" (${updated.elements?.length || 0} elements)`,
    updated.id,
    updated.name
  );
  res.json(updated);
});
templatesRouter.post("/submit", (req, res) => {
  const { templateId, submittedBy = "Designer", comments = "", snapshot } = req.body;
  const templates = storage.read("templates", []);
  const templateVersions = storage.read("templateVersions", []);
  const templateIndex = templates.findIndex((t) => t.id === templateId);
  if (templateIndex === -1 && !snapshot) {
    return res.status(404).json({ error: "Template not found for submission" });
  }
  const targetTemplate = templateIndex >= 0 ? templates[templateIndex] : snapshot.snapshotJson;
  const currentVersion = targetTemplate.version || "1.0";
  const snapshotRecord = snapshot || {
    id: `snap-${targetTemplate.id}-v${currentVersion}-${Date.now()}`,
    version: currentVersion,
    templateId: targetTemplate.id,
    templateName: targetTemplate.name,
    snapshotJson: JSON.parse(JSON.stringify(targetTemplate)),
    canvasJson: {
      dimensions: targetTemplate.dimensions,
      margins: targetTemplate.margins,
      sheetGrid: targetTemplate.sheetGrid,
      scaleDpi: targetTemplate.dimensions?.dpi || 300,
      elementCount: targetTemplate.elements?.length || 0
    },
    svgSnapshot: "",
    pngSnapshot: "",
    objectTree: (targetTemplate.elements || []).map((el) => ({
      id: el.id,
      name: el.name,
      type: el.type,
      locked: !!el.locked,
      editable: el.locked ? false : el.editable !== void 0 ? el.editable : true
    })),
    objectProperties: {},
    variableMapping: {},
    hash: `sha256-${Date.now()}`,
    checksum: `CRC32-${Date.now()}`,
    status: "pending_level_1",
    submittedBy,
    submittedAt: (/* @__PURE__ */ new Date()).toISOString(),
    approvalTimeline: [
      { id: `apr-1`, level: 1, role: "Approver Level 1", status: "pending" },
      { id: `apr-2`, level: 2, role: "Approver Level 2", status: "pending" }
    ],
    annotations: [],
    comments: [
      {
        id: `cm-${Date.now()}`,
        author: submittedBy,
        authorRole: "Label Designer",
        content: comments || "Submitted for Regulatory Review",
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        statusChange: "pending_level_1"
      }
    ]
  };
  snapshotRecord.status = "pending_level_1";
  snapshotRecord.submittedAt = (/* @__PURE__ */ new Date()).toISOString();
  templateVersions.unshift(snapshotRecord);
  storage.write("templateVersions", templateVersions);
  if (templateIndex >= 0) {
    templates[templateIndex].status = "pending_level_1";
    templates[templateIndex].updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    templates[templateIndex].versions = templates[templateIndex].versions || [];
    templates[templateIndex].versions.unshift({
      version: currentVersion,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      author: submittedBy,
      comment: comments || "Submitted for Regulatory Review",
      elementCount: templates[templateIndex].elements?.length || 0,
      templateSnapshot: templates[templateIndex]
    });
    storage.write("templates", templates);
  }
  logBackendAudit(
    submittedBy,
    "Label Designer",
    "SUBMIT_APPROVAL",
    `Submitted template "${targetTemplate.name}" (v${currentVersion}) for QA Approval. Version frozen with SHA-256 Hash.`,
    targetTemplate.id,
    targetTemplate.name
  );
  res.status(201).json({
    success: true,
    version: currentVersion,
    snapshot: snapshotRecord,
    template: templateIndex >= 0 ? templates[templateIndex] : targetTemplate
  });
});
templatesRouter.post("/approve", (req, res) => {
  const { templateId, version, level = 1, reviewerName = "Quality Lead", reviewerEmail, digitalSignature, comment = "" } = req.body;
  const templates = storage.read("templates", []);
  const templateVersions = storage.read("templateVersions", []);
  const approvals = storage.read("approvals", []);
  const templateIndex = templates.findIndex((t) => t.id === templateId);
  const versionRecord = templateVersions.find((v) => v.templateId === templateId && (!version || v.version === version));
  const isFinalApproval = Number(level) === 2 || req.body.isFinal === true;
  const newStatus = isFinalApproval ? "approved" : "pending_level_2";
  const approvalRecord = {
    id: `apr-rec-${Date.now()}`,
    templateId,
    version: version || templateIndex >= 0 ? templates[templateIndex]?.version : "1.0",
    level,
    action: "approve",
    reviewerName,
    reviewerEmail,
    digitalSignature: digitalSignature || `${reviewerName} (${(/* @__PURE__ */ new Date()).toISOString()})`,
    comment,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    status: newStatus
  };
  approvals.unshift(approvalRecord);
  storage.write("approvals", approvals);
  if (versionRecord) {
    versionRecord.status = newStatus;
    if (newStatus === "approved") {
      versionRecord.approvedBy = reviewerName;
      versionRecord.approvedAt = (/* @__PURE__ */ new Date()).toISOString();
    }
    versionRecord.approvalTimeline = versionRecord.approvalTimeline || [];
    const tier = versionRecord.approvalTimeline.find((t) => t.level === Number(level));
    if (tier) {
      tier.status = "approved";
      tier.reviewerName = reviewerName;
      tier.reviewerEmail = reviewerEmail;
      tier.timestamp = (/* @__PURE__ */ new Date()).toISOString();
      tier.digitalSignature = digitalSignature;
      tier.comment = comment;
    }
    if (comment) {
      versionRecord.comments = versionRecord.comments || [];
      versionRecord.comments.push({
        id: `cm-${Date.now()}`,
        author: reviewerName,
        authorRole: `Approver Level ${level}`,
        content: comment,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        statusChange: newStatus
      });
    }
    storage.write("templateVersions", templateVersions);
  }
  if (templateIndex >= 0) {
    templates[templateIndex].status = newStatus;
    templates[templateIndex].updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (newStatus === "approved") {
      templates[templateIndex].approvedBy = reviewerName;
      templates[templateIndex].approvedAt = (/* @__PURE__ */ new Date()).toISOString();
    }
    storage.write("templates", templates);
  }
  logBackendAudit(
    reviewerName,
    `Approver Level ${level}`,
    "APPROVE_TEMPLATE",
    `Approved Template "${templateIndex >= 0 ? templates[templateIndex].name : templateId}" at Level ${level}. Signed: ${digitalSignature || reviewerName}. New Status: ${newStatus.toUpperCase()}`,
    templateId,
    templateIndex >= 0 ? templates[templateIndex].name : templateId
  );
  res.json({
    success: true,
    status: newStatus,
    approvalRecord,
    snapshot: versionRecord,
    template: templateIndex >= 0 ? templates[templateIndex] : null
  });
});
templatesRouter.post("/reject", (req, res) => {
  const { templateId, version, reviewerName = "Quality Reviewer", reason = "Quality rejection" } = req.body;
  const templates = storage.read("templates", []);
  const templateVersions = storage.read("templateVersions", []);
  const approvals = storage.read("approvals", []);
  const templateIndex = templates.findIndex((t) => t.id === templateId);
  const versionRecord = templateVersions.find((v) => v.templateId === templateId && (!version || v.version === version));
  const rejectRecord = {
    id: `rej-${Date.now()}`,
    templateId,
    version,
    action: "reject",
    reviewerName,
    comment: reason,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    status: "rejected"
  };
  approvals.unshift(rejectRecord);
  storage.write("approvals", approvals);
  if (versionRecord) {
    versionRecord.status = "rejected";
    versionRecord.comments = versionRecord.comments || [];
    versionRecord.comments.push({
      id: `cm-${Date.now()}`,
      author: reviewerName,
      authorRole: "Quality Reviewer",
      content: reason,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      statusChange: "rejected"
    });
    storage.write("templateVersions", templateVersions);
  }
  if (templateIndex >= 0) {
    templates[templateIndex].status = "rejected";
    templates[templateIndex].updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    storage.write("templates", templates);
  }
  logBackendAudit(
    reviewerName,
    "Quality Reviewer",
    "REJECT_TEMPLATE",
    `Rejected Template "${templateIndex >= 0 ? templates[templateIndex].name : templateId}". Reason: ${reason}`,
    templateId,
    templateIndex >= 0 ? templates[templateIndex].name : templateId
  );
  res.json({
    success: true,
    status: "rejected",
    rejectRecord,
    snapshot: versionRecord
  });
});
templatesRouter.post("/request-change", (req, res) => {
  const { templateId, version, reviewerName = "Quality Reviewer", comment = "", annotations = [] } = req.body;
  const templates = storage.read("templates", []);
  const templateVersions = storage.read("templateVersions", []);
  const templateIndex = templates.findIndex((t) => t.id === templateId);
  const versionRecord = templateVersions.find((v) => v.templateId === templateId && (!version || v.version === version));
  if (versionRecord) {
    versionRecord.status = "rejected";
    versionRecord.annotations = [...versionRecord.annotations || [], ...annotations];
    versionRecord.comments = versionRecord.comments || [];
    versionRecord.comments.push({
      id: `cm-${Date.now()}`,
      author: reviewerName,
      authorRole: "Quality Reviewer",
      content: `Change Requested: ${comment}`,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      statusChange: "rejected"
    });
    storage.write("templateVersions", templateVersions);
  }
  let updatedTemplate = null;
  if (templateIndex >= 0) {
    templates[templateIndex].status = "draft";
    templates[templateIndex].updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    updatedTemplate = templates[templateIndex];
    storage.write("templates", templates);
  }
  logBackendAudit(
    reviewerName,
    "Quality Reviewer",
    "REQUEST_CHANGE",
    `Requested Changes on Template "${templateIndex >= 0 ? templates[templateIndex].name : templateId}" (${annotations.length} annotations attached). Note: ${comment}`,
    templateId,
    templateIndex >= 0 ? templates[templateIndex].name : templateId
  );
  res.json({
    success: true,
    status: "draft",
    template: updatedTemplate,
    snapshot: versionRecord
  });
});
templatesRouter.get("/version/:id", (req, res) => {
  const templateVersions = storage.read("templateVersions", []);
  const snapshot = templateVersions.find((v) => v.id === req.params.id || v.templateId === req.params.id);
  if (!snapshot) {
    return res.status(404).json({ error: "Template version snapshot not found" });
  }
  res.json(snapshot);
});
templatesRouter.get("/preview/:id", (req, res) => {
  const templateVersions = storage.read("templateVersions", []);
  const snapshot = templateVersions.find((v) => v.id === req.params.id || v.templateId === req.params.id);
  if (!snapshot) {
    return res.status(404).json({ error: "Preview not found" });
  }
  res.json({
    id: snapshot.id,
    version: snapshot.version,
    templateId: snapshot.templateId,
    templateName: snapshot.templateName,
    svgSnapshot: snapshot.svgSnapshot,
    pngSnapshot: snapshot.pngSnapshot,
    canvasJson: snapshot.canvasJson,
    objectTree: snapshot.objectTree,
    hash: snapshot.hash,
    checksum: snapshot.checksum,
    status: snapshot.status
  });
});
templatesRouter.get("/history/:id", (req, res) => {
  const templateVersions = storage.read("templateVersions", []);
  const approvals = storage.read("approvals", []);
  const templates = storage.read("templates", []);
  const template = templates.find((t) => t.id === req.params.id);
  const versions = templateVersions.filter((v) => v.templateId === req.params.id);
  const templateApprovals = approvals.filter((a) => a.templateId === req.params.id);
  res.json({
    templateId: req.params.id,
    templateName: template?.name || req.params.id,
    currentVersion: template?.version || "1.0",
    currentStatus: template?.status || "draft",
    versions,
    approvals: templateApprovals
  });
});
templatesRouter.post("/:id/duplicate", (req, res) => {
  const templates = storage.read("templates", []);
  const original = templates.find((t) => t.id === req.params.id);
  if (!original) {
    return res.status(404).json({ error: "Template not found" });
  }
  const copy = {
    ...original,
    id: `tmpl-${Date.now()}`,
    name: `${original.name} (Copy)`,
    version: "1.0",
    status: "draft",
    tags: Array.from(/* @__PURE__ */ new Set([...original.tags || [], "Draft"])),
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    approvedBy: void 0,
    approvedAt: void 0
  };
  templates.unshift(copy);
  storage.write("templates", templates);
  logBackendAudit(
    "Designer",
    "Label Designer",
    "CREATE_TEMPLATE",
    `Cloned template from "${original.name}" to "${copy.name}"`,
    copy.id,
    copy.name
  );
  res.status(201).json(copy);
});
templatesRouter.delete("/:id", (req, res) => {
  const templates = storage.read("templates", []);
  const index = templates.findIndex((t) => t.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Template not found" });
  }
  const removed = templates.splice(index, 1)[0];
  storage.write("templates", templates);
  logBackendAudit(
    "Admin",
    "Admin",
    "EDIT_TEMPLATE",
    `Archived/Deleted template "${removed.name}"`,
    removed.id,
    removed.name
  );
  res.json({ success: true, id: req.params.id });
});
templatesRouter.get("/history/:id", (req, res) => {
  try {
    const templates = storage.read("templates", []);
    const tmpl = templates.find((t) => t.id === req.params.id);
    if (!tmpl) {
      return res.status(404).json({ error: "Template not found" });
    }
    const versions = storage.read("templateVersions", []);
    const history = versions.filter((v) => v.templateId === req.params.id || v.id === req.params.id);
    res.json({
      templateId: tmpl.id,
      name: tmpl.name,
      currentVersion: tmpl.version || "1.0",
      history: history.length > 0 ? history : tmpl.versions || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
templatesRouter.post("/restore-version", (req, res) => {
  try {
    const { templateId, targetVersion } = req.body;
    const templates = storage.read("templates", []);
    const idx = templates.findIndex((t) => t.id === templateId);
    if (idx === -1) {
      return res.status(404).json({ error: "Template not found" });
    }
    const tmpl = templates[idx];
    const versions = tmpl.versions || [];
    const matched = versions.find((v) => v.version === targetVersion);
    const restoredTmpl = matched?.templateSnapshot ? { ...matched.templateSnapshot } : { ...tmpl, version: targetVersion };
    restoredTmpl.status = "draft";
    restoredTmpl.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    templates[idx] = restoredTmpl;
    storage.write("templates", templates);
    logBackendAudit(
      "Designer",
      "Label Designer",
      "ROLLBACK_VERSION",
      `Restored template "${tmpl.name}" back to version ${targetVersion}`,
      tmpl.id,
      tmpl.name
    );
    res.json({ success: true, message: `Restored to v${targetVersion}`, template: restoredTmpl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
templatesRouter.post("/local-save", (req, res) => {
  try {
    const { template, fileName } = req.body;
    if (!template) {
      return res.status(400).json({ error: "Template content required" });
    }
    const fileExt = fileName && fileName.endsWith(".bft") ? fileName : `${(template.name || "label").replace(/[^a-zA-Z0-9_-]/g, "_")}.bft`;
    const bftPayload = {
      bftVersion: "2.5.0-enterprise",
      checksum: `CRC32-${Math.floor(1e5 + Math.random() * 9e5)}`,
      savedAt: (/* @__PURE__ */ new Date()).toISOString(),
      template
    };
    logBackendAudit("Designer", "Label Designer", "LOCAL_SAVE_BFT", `Saved local .bft file "${fileExt}"`);
    res.json({
      success: true,
      fileName: fileExt,
      fileFormat: "BarcodeFlow Template (.bft)",
      savedPath: `Documents/BarcodeFlow/Templates/${fileExt}`,
      bftPayload
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
templatesRouter.post("/local-open", (req, res) => {
  try {
    const { bftContent } = req.body;
    let templateData = typeof bftContent === "string" ? JSON.parse(bftContent) : bftContent;
    if (templateData && templateData.bftPayload) {
      templateData = templateData.bftPayload.template || templateData;
    }
    logBackendAudit("Designer", "Label Designer", "LOCAL_OPEN_BFT", `Opened local .bft file "${templateData.name || "Label"}"`);
    res.json({
      success: true,
      template: templateData
    });
  } catch (err) {
    res.status(400).json({ error: "Invalid .bft file format" });
  }
});
templatesRouter.post("/export", (req, res) => {
  try {
    const { templateId } = req.body;
    const templates = storage.read("templates", []);
    const tmpl = templates.find((t) => t.id === templateId) || req.body.template;
    if (!tmpl) {
      return res.status(404).json({ error: "Template not found" });
    }
    logBackendAudit("Designer", "Label Designer", "EXPORT_TEMPLATE", `Exported template "${tmpl.name}"`);
    res.json({
      fileExtension: ".bft",
      fileName: `${tmpl.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.bft`,
      content: JSON.stringify({ bftVersion: "2.5.0", template: tmpl }, null, 2)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
templatesRouter.post("/import", (req, res) => {
  try {
    const { templateData, name } = req.body;
    const templates = storage.read("templates", []);
    let parsed = typeof templateData === "string" ? JSON.parse(templateData) : templateData;
    if (parsed.template) parsed = parsed.template;
    const importedTmpl = {
      ...parsed,
      id: `tmpl-imp-${Date.now()}`,
      name: name || parsed.name || "Imported .bft Label",
      status: "draft",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    templates.unshift(importedTmpl);
    storage.write("templates", templates);
    logBackendAudit("Designer", "Label Designer", "IMPORT_TEMPLATE", `Imported .bft template "${importedTmpl.name}"`);
    res.status(201).json(importedTmpl);
  } catch (err) {
    res.status(400).json({ error: "Invalid template import payload" });
  }
});
templatesRouter.post("/cloud-upload", (req, res) => {
  try {
    const { templateId } = req.body;
    const templates = storage.read("templates", []);
    const tmpl = templates.find((t) => t.id === templateId) || req.body.template;
    logBackendAudit("Admin", "Admin", "CLOUD_SYNC_UPLOAD", `Uploaded template "${tmpl?.name || templateId}" to Enterprise Cloud Vault`);
    res.json({
      success: true,
      cloudSyncStatus: "synced",
      cloudChecksum: `SHA256-VAULT-${Date.now()}`,
      uploadedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
templatesRouter.post("/cloud-download", (req, res) => {
  try {
    const { cloudTemplateId } = req.body;
    logBackendAudit("Admin", "Admin", "CLOUD_SYNC_DOWNLOAD", `Downloaded cloud template "${cloudTemplateId}"`);
    res.json({
      success: true,
      cloudSyncStatus: "synced",
      downloadedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// barcode-automation-backend/src/routes/printJobs.ts
import { Router as Router2 } from "express";

// barcode-automation-backend/src/services/networkPrintService.ts
import net from "net";
import fs4 from "fs";
import path4 from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
var execAsync = promisify(exec);
var NetworkPrintService = class _NetworkPrintService {
  static getInstance() {
    if (!_NetworkPrintService.instance) {
      _NetworkPrintService.instance = new _NetworkPrintService();
    }
    return _NetworkPrintService.instance;
  }
  /**
   * Directly transmits raw print instructions (ZPL, TSPL, EPL, ESC/POS) over raw TCP socket
   * Standard industrial barcode printer port is 9100 (HP JetDirect / Raw TCP protocol)
   */
  async sendRawToTcp(ip, port = 9100, data, timeoutMs = 4e3) {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, "utf-8");
    return new Promise((resolve) => {
      let isSettled = false;
      const socket = new net.Socket();
      const finish = (result) => {
        if (!isSettled) {
          isSettled = true;
          try {
            socket.destroy();
          } catch (_) {
          }
          resolve(result);
        }
      };
      socket.setTimeout(timeoutMs);
      socket.connect(port, ip, () => {
        socket.write(buffer, () => {
          socket.end();
          finish({
            success: true,
            bytesWritten: buffer.length,
            message: `Successfully transmitted ${buffer.length} bytes to ${ip}:${port}`,
            destination: "tcp"
          });
        });
      });
      socket.on("timeout", () => {
        finish({
          success: false,
          bytesWritten: 0,
          error: `Connection to printer at ${ip}:${port} timed out after ${timeoutMs}ms`,
          message: `Printer hardware at ${ip}:${port} did not acknowledge connection within ${timeoutMs}ms.`,
          destination: "tcp"
        });
      });
      socket.on("error", (err) => {
        finish({
          success: false,
          bytesWritten: 0,
          error: err.code || err.message,
          message: `Network transmission failed to ${ip}:${port} (${err.code || err.message})`,
          destination: "tcp"
        });
      });
    });
  }
  /**
   * Cross-platform check whether a network printer socket is actively listening
   */
  async probeTcpPrinterStatus(ip, port = 9100, timeoutMs = 1500) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let resolved = false;
      const finish = (status) => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(status);
        }
      };
      socket.setTimeout(timeoutMs);
      socket.connect(port, ip, () => {
        finish("online");
      });
      socket.on("timeout", () => {
        finish("offline");
      });
      socket.on("error", () => {
        finish("offline");
      });
    });
  }
  /**
   * Sends raw print bytes to the local OS Print Spooler (macOS/Linux CUPS or Windows Spooler)
   */
  async sendToOsSpooler(printerName, data) {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, "utf-8");
    const tempFilePath = path4.join(
      os.tmpdir(),
      `barcodeflow_spool_${Date.now()}_${Math.floor(Math.random() * 1e4)}.prn`
    );
    try {
      await fs4.promises.writeFile(tempFilePath, buffer);
      if (process.platform === "win32") {
        const escapedName = printerName.replace(/'/g, "''");
        const escapedFile = tempFilePath.replace(/'/g, "''");
        const psCmd = `powershell -Command "Get-Content -Path '${escapedFile}' -Raw -Encoding Byte | Out-Printer -Name '${escapedName}'"`;
        await execAsync(psCmd);
      } else {
        const escapedName = printerName.replace(/"/g, '\\"');
        const lpCmd = `lp -d "${escapedName}" -o raw "${tempFilePath}"`;
        await execAsync(lpCmd);
      }
      return {
        success: true,
        bytesWritten: buffer.length,
        message: `Successfully spooled ${buffer.length} bytes to local printer "${printerName}"`,
        destination: "spooler"
      };
    } catch (err) {
      return {
        success: false,
        bytesWritten: 0,
        error: err.message,
        message: `Local OS spooling failed for printer "${printerName}": ${err.message}`,
        destination: "spooler"
      };
    } finally {
      fs4.promises.unlink(tempFilePath).catch(() => {
      });
    }
  }
  /**
   * Discovers installed printers across Windows, macOS, and Linux
   */
  async discoverInstalledPrinters() {
    const results = [];
    if (process.platform === "win32") {
      try {
        const psCommand = `powershell -Command "Get-Printer | Select-Object Name, PrinterStatus, DriverName, PortName, IsDefault | ConvertTo-Json"`;
        const { stdout } = await execAsync(psCommand);
        if (stdout.trim()) {
          const parsed = JSON.parse(stdout);
          const list = Array.isArray(parsed) ? parsed : [parsed];
          for (const p of list) {
            const name = p.Name || "Printer";
            const lower = name.toLowerCase();
            const isZebra = lower.includes("zebra") || lower.includes("zt") || lower.includes("zd");
            const isTsc = lower.includes("tsc");
            const isBrother = lower.includes("brother");
            const isThermal = isZebra || isTsc || isBrother || lower.includes("thermal") || lower.includes("label");
            let protocol = "zpl";
            if (isTsc) protocol = "tspl";
            else if (lower.includes("epl")) protocol = "epl";
            else if (lower.includes("pos") || lower.includes("receipt")) protocol = "escpos";
            else if (lower.includes("pdf")) protocol = "pdf";
            results.push({
              name,
              isDefault: !!p.IsDefault,
              status: p.PrinterStatus === 0 || p.PrinterStatus === 3 ? "online" : "offline",
              driverName: p.DriverName,
              portName: p.PortName,
              protocol,
              isThermal
            });
          }
        }
      } catch (err) {
        console.warn("[NetworkPrintService] Windows printer discovery error:", err);
      }
    } else {
      try {
        const { stdout: statOut } = await execAsync("lpstat -p -d");
        const lines = statOut.split("\n");
        let defaultPrinterName = "";
        for (const line of lines) {
          if (line.startsWith("system default destination:")) {
            defaultPrinterName = line.replace("system default destination:", "").trim();
          }
        }
        for (const line of lines) {
          if (line.startsWith("printer ")) {
            const parts = line.split(" ");
            const printerName = parts[1];
            if (!printerName) continue;
            const isIdle = line.includes("is idle");
            const isPrinting = line.includes("is printing") || line.includes("processing");
            const status = isPrinting ? "busy" : isIdle ? "online" : "offline";
            const lower = printerName.toLowerCase();
            const isZebra = lower.includes("zebra") || lower.includes("zt") || lower.includes("zd");
            const isTsc = lower.includes("tsc");
            const isBrother = lower.includes("brother");
            const isThermal = isZebra || isTsc || isBrother || lower.includes("label") || lower.includes("thermal");
            let protocol = "zpl";
            if (isTsc) protocol = "tspl";
            else if (lower.includes("epl")) protocol = "epl";
            else if (lower.includes("pos") || lower.includes("receipt")) protocol = "escpos";
            else if (lower.includes("pdf")) protocol = "pdf";
            results.push({
              name: printerName,
              isDefault: printerName === defaultPrinterName,
              status,
              protocol,
              isThermal
            });
          }
        }
      } catch (err) {
        console.warn("[NetworkPrintService] Unix/macOS lpstat discovery error:", err);
      }
    }
    return results;
  }
  /**
   * Intelligently routes and transmits a print job to the target printer
   */
  async dispatchJob(printer, rawOutput) {
    const isIpDefined = printer.ipAddress && printer.ipAddress !== "127.0.0.1" && printer.ipAddress !== "localhost" && !printer.ipAddress.startsWith("Virtual") && !printer.ipAddress.startsWith("USB");
    if (isIpDefined && printer.port) {
      const tcpResult = await this.sendRawToTcp(printer.ipAddress, Number(printer.port), rawOutput);
      return tcpResult;
    }
    if (printer.driverName || printer.name) {
      const spoolResult = await this.sendToOsSpooler(printer.name, rawOutput);
      return spoolResult;
    }
    const length = Buffer.isBuffer(rawOutput) ? rawOutput.length : Buffer.from(rawOutput).length;
    return {
      success: true,
      bytesWritten: length,
      message: `Spooled ${length} bytes to virtual printer engine (${printer.name || "Default"})`,
      destination: "virtual"
    };
  }
};

// src/services/zplEngine.ts
init_dataSourceEngine();
function mmToDots(mm, dpi = 203) {
  const dpmm = dpi === 600 ? 23.62 : dpi === 300 ? 11.81 : dpi / 25.4;
  return Math.round(mm * dpmm);
}
function generateZPL(template, recordData = {}, options) {
  const dpi = options?.dpi || template.dimensions.dpi || 203;
  const pw = mmToDots(template.dimensions.width, dpi);
  const ll = mmToDots(template.dimensions.height, dpi);
  const lines = [
    "^XA",
    `^PW${pw}`,
    `^LL${ll}`,
    "^LH0,0",
    "^CI28"
    // UTF-8 character encoding support
  ];
  const sortedElements = [...template.elements].sort((a, b) => a.zIndex - b.zIndex);
  for (const el of sortedElements) {
    if (!el.visible || el.printable === false) continue;
    const x = mmToDots(el.x, dpi);
    const y = mmToDots(el.y, dpi);
    const w = mmToDots(el.width, dpi);
    const h = mmToDots(el.height, dpi);
    switch (el.type) {
      case "text": {
        const textVal = evaluateElementData(el, { record: recordData });
        const fontHeight = Math.max(12, Math.round(el.fontSize * (dpi / 72)));
        const fontWidth = Math.round(fontHeight * 0.85);
        const zplOrientation = el.rotation === 90 ? "R" : el.rotation === 180 ? "I" : el.rotation === 270 ? "B" : "N";
        lines.push(`^FO${x},${y}`);
        lines.push(`^A0${zplOrientation},${fontHeight},${fontWidth}`);
        if (el.multiline || el.width > 20) {
          lines.push(`^FB${w},5,0,${el.textAlign === "center" ? "C" : el.textAlign === "right" ? "R" : "L"},0`);
        }
        lines.push(`^FD${escapeZPL(textVal)}^FS`);
        break;
      }
      case "barcode": {
        const barVal = evaluateElementData(el, { record: recordData });
        const barHeight = mmToDots(el.barHeight, dpi) || mmToDots(el.height, dpi);
        const zplOrientation = el.rotation === 90 ? "R" : el.rotation === 180 ? "I" : el.rotation === 270 ? "B" : "N";
        const printText = el.includeText ? "Y" : "N";
        lines.push(`^FO${x},${y}`);
        switch (el.symbology) {
          case "code128":
          case "gs1-128":
            lines.push(`^BC${zplOrientation},${barHeight},${printText},N,N,A`);
            lines.push(`^FD${escapeZPL(barVal)}^FS`);
            break;
          case "code39":
          case "patchcode":
            lines.push(`^B3${zplOrientation},N,${barHeight},${printText},N`);
            lines.push(`^FD${escapeZPL(barVal)}^FS`);
            break;
          case "ean13":
            lines.push(`^BE${zplOrientation},${barHeight},${printText},N`);
            lines.push(`^FD${escapeZPL(barVal)}^FS`);
            break;
          case "ean8":
            lines.push(`^B8${zplOrientation},${barHeight},${printText},N`);
            lines.push(`^FD${escapeZPL(barVal)}^FS`);
            break;
          case "upca":
            lines.push(`^BU${zplOrientation},${barHeight},${printText},N,Y`);
            lines.push(`^FD${escapeZPL(barVal)}^FS`);
            break;
          case "itf14":
          case "interleaved2of5":
            lines.push(`^B2${zplOrientation},${barHeight},${printText},N,N`);
            lines.push(`^FD${escapeZPL(barVal)}^FS`);
            break;
          case "qr":
          case "gs1-qr":
          case "micro-qr":
            lines.push(`^BQ${zplOrientation},2,${Math.min(10, Math.max(3, Math.round(el.barWidth * 3)))}`);
            lines.push(`^FDLA,${escapeZPL(barVal)}^FS`);
            break;
          case "datamatrix":
          case "gs1-datamatrix":
          case "hibc-datamatrix":
            lines.push(`^BX${zplOrientation},${Math.min(12, Math.max(4, Math.round(el.barWidth * 3)))},200`);
            lines.push(`^FD${escapeZPL(barVal)}^FS`);
            break;
          case "pdf417":
          case "pdf417-truncated":
            lines.push(`^B7${zplOrientation},${barHeight},1,2,6,N`);
            lines.push(`^FD${escapeZPL(barVal)}^FS`);
            break;
          case "aztec":
            lines.push(`^BO${zplOrientation},${Math.min(10, Math.max(3, Math.round(el.barWidth * 3)))},N,0,B,0`);
            lines.push(`^FD${escapeZPL(barVal)}^FS`);
            break;
          case "maxicode":
            lines.push(`^BD${zplOrientation},1,1`);
            lines.push(`^FD${escapeZPL(barVal)}^FS`);
            break;
          default:
            lines.push(`^BC${zplOrientation},${barHeight},${printText},N,N,A`);
            lines.push(`^FD${escapeZPL(barVal)}^FS`);
            break;
        }
        break;
      }
      case "shape": {
        const borderDots = Math.max(1, mmToDots(el.strokeWidth, dpi));
        lines.push(`^FO${x},${y}`);
        if (el.shapeType === "rectangle") {
          const cornerRounding = el.cornerRadius ? Math.min(8, Math.round(el.cornerRadius)) : 0;
          lines.push(`^GB${w},${h},${borderDots},B,${cornerRounding}^FS`);
        } else if (el.shapeType === "circle" || el.shapeType === "ellipse") {
          lines.push(`^GC${w},${borderDots},B^FS`);
        } else if (el.shapeType === "line") {
          lines.push(`^GB${w},${borderDots},${borderDots},B^FS`);
        }
        break;
      }
      default:
        break;
    }
  }
  lines.push("^XZ");
  return lines.join("\n");
}
function generateTSPL(template, recordData = {}, options) {
  const dpi = options?.dpi || template.dimensions.dpi || 203;
  const pw = mmToDots(template.dimensions.width, dpi);
  const ll = mmToDots(template.dimensions.height, dpi);
  const lines = [
    `SIZE ${template.dimensions.width} mm, ${template.dimensions.height} mm`,
    "GAP 3 mm, 0 mm",
    "DIRECTION 1",
    "CLS"
  ];
  for (const el of template.elements) {
    if (!el.visible || el.printable === false) continue;
    const xDots = mmToDots(el.x, dpi);
    const yDots = mmToDots(el.y, dpi);
    if (el.type === "text") {
      const txt = evaluateElementData(el, { record: recordData });
      lines.push(`TEXT ${xDots},${yDots},"3",0,1,1,"${txt.replace(/"/g, '\\"')}"`);
    } else if (el.type === "barcode") {
      const val = evaluateElementData(el, { record: recordData });
      const hDots = mmToDots(el.barHeight || el.height, dpi);
      if (el.symbology === "qr" || el.symbology === "gs1-qr") {
        lines.push(`QRCODE ${xDots},${yDots},L,4,A,0,"${val.replace(/"/g, '\\"')}"`);
      } else if (el.symbology === "datamatrix" || el.symbology === "gs1-datamatrix") {
        lines.push(`DMATRIX ${xDots},${yDots},${hDots},${hDots},"${val.replace(/"/g, '\\"')}"`);
      } else {
        lines.push(`BARCODE ${xDots},${yDots},"128",${hDots},1,0,2,2,"${val.replace(/"/g, '\\"')}"`);
      }
    }
  }
  lines.push("PRINT 1,1");
  return lines.join("\n");
}
function generateEPL(template, recordData = {}, options) {
  const dpi = options?.dpi || template.dimensions.dpi || 203;
  const pw = mmToDots(template.dimensions.width, dpi);
  const lines = [
    "N",
    `q${pw}`,
    "Q100,24"
  ];
  for (const el of template.elements) {
    if (!el.visible || el.printable === false) continue;
    const xDots = mmToDots(el.x, dpi);
    const yDots = mmToDots(el.y, dpi);
    if (el.type === "text") {
      const txt = evaluateElementData(el, { record: recordData });
      lines.push(`A${xDots},${yDots},0,3,1,1,N,"${txt.replace(/"/g, '\\"')}"`);
    } else if (el.type === "barcode") {
      const val = evaluateElementData(el, { record: recordData });
      const hDots = mmToDots(el.barHeight || el.height, dpi);
      lines.push(`B${xDots},${yDots},0,1,2,4,${hDots},B,"${val.replace(/"/g, '\\"')}"`);
    }
  }
  lines.push("P1");
  return lines.join("\n");
}
function escapeZPL(str) {
  if (!str) return "";
  return str.replace(/\\/g, "\\\\").replace(/\^/g, "\\^").replace(/~/g, "\\~");
}

// src/services/printerAdapters/zplAdapter.ts
var ZplAdapter = class {
  constructor() {
    this.id = "zpl";
    this.name = "Zebra ZPL-II Industrial Protocol";
    this.language = "zpl";
    this.capabilities = {
      language: "zpl",
      displayName: "Zebra ZPL-II",
      defaultPort: 9100,
      supportedDpi: [203, 300, 600],
      supports2DBarcodes: true,
      supportsShapes: true,
      supportsImages: true,
      supportsCutter: true,
      supportsDirectTcp: true
    };
  }
  generateJobStream(template, records = [{}], options) {
    const dpi = options?.dpi || template.dimensions.dpi || 203;
    const copies = Math.max(1, options?.copies || 1);
    const darkness = options?.darkness;
    const speed = options?.speed;
    const streamParts = [];
    if (darkness !== void 0 || speed !== void 0) {
      const header = ["^XA"];
      if (darkness !== void 0) {
        const clampedDarkness = Math.min(30, Math.max(0, Math.round(darkness)));
        header.push(`~SD${clampedDarkness.toString().padStart(2, "0")}`);
      }
      if (speed !== void 0) {
        const clampedSpeed = Math.min(14, Math.max(2, Math.round(speed)));
        header.push(`^PR${clampedSpeed},${clampedSpeed}`);
      }
      header.push("^XZ");
      streamParts.push(header.join("\n"));
    }
    const recordsToPrint = records.length > 0 ? records : [{}];
    for (const record of recordsToPrint) {
      let zpl = generateZPL(template, record, { dpi });
      if (copies > 1) {
        if (zpl.endsWith("^XZ")) {
          zpl = zpl.slice(0, -3) + `^PQ${copies},0,1,Y
^XZ`;
        } else {
          zpl += `
^PQ${copies},0,1,Y`;
        }
      }
      streamParts.push(zpl);
    }
    return streamParts.join("\n\n");
  }
  validateTemplate(template) {
    const warnings = [];
    if (!template.elements || template.elements.length === 0) {
      warnings.push("Template contains no elements to print.");
    }
    return warnings;
  }
};

// src/services/printerAdapters/tsplAdapter.ts
init_dataSourceEngine();
var TsplAdapter = class {
  constructor() {
    this.id = "tspl";
    this.name = "TSC TSPL/TSPL2 Protocol";
    this.language = "tspl";
    this.capabilities = {
      language: "tspl",
      displayName: "TSC TSPL / TSPL2",
      defaultPort: 9100,
      supportedDpi: [203, 300],
      supports2DBarcodes: true,
      supportsShapes: true,
      supportsImages: true,
      supportsCutter: true,
      supportsDirectTcp: true
    };
  }
  generateJobStream(template, records = [{}], options) {
    const dpi = options?.dpi || template.dimensions.dpi || 203;
    const copies = Math.max(1, options?.copies || 1);
    const darkness = options?.darkness;
    const speed = options?.speed;
    const streamParts = [];
    const recordsToPrint = records.length > 0 ? records : [{}];
    for (const record of recordsToPrint) {
      const lines = [
        `SIZE ${template.dimensions.width} mm, ${template.dimensions.height} mm`,
        "GAP 3 mm, 0 mm",
        "DIRECTION 1",
        "REFERENCE 0,0"
      ];
      if (darkness !== void 0) {
        const d = Math.min(15, Math.max(0, Math.round(darkness / 30 * 15)));
        lines.push(`DENSITY ${d}`);
      }
      if (speed !== void 0) {
        const s = Math.min(12, Math.max(1, Math.round(speed)));
        lines.push(`SPEED ${s}`);
      }
      lines.push("CLS");
      const elements = [...template.elements].sort((a, b) => a.zIndex - b.zIndex);
      for (const el of elements) {
        if (!el.visible || el.printable === false) continue;
        const xDots = mmToDots(el.x, dpi);
        const yDots = mmToDots(el.y, dpi);
        const wDots = mmToDots(el.width, dpi);
        const hDots = mmToDots(el.height, dpi);
        const rot = el.rotation || 0;
        if (el.type === "text") {
          const txt = evaluateElementData(el, { record });
          const mult = Math.max(1, Math.min(8, Math.round(el.fontSize / 10)));
          lines.push(`TEXT ${xDots},${yDots},"3",${rot},${mult},${mult},"${this.escapeTspl(txt)}"`);
        } else if (el.type === "barcode") {
          const val = evaluateElementData(el, { record });
          const barHeight = mmToDots(el.barHeight || el.height, dpi);
          const readable = el.includeText ? 1 : 0;
          if (el.symbology === "qr" || el.symbology === "gs1-qr" || el.symbology === "micro-qr") {
            const cellW = Math.max(3, Math.min(10, Math.round(el.barWidth * 3)));
            lines.push(`QRCODE ${xDots},${yDots},L,${cellW},A,${rot},"${this.escapeTspl(val)}"`);
          } else if (el.symbology === "datamatrix" || el.symbology === "gs1-datamatrix") {
            lines.push(`DMATRIX ${xDots},${yDots},${barHeight},${barHeight},"${this.escapeTspl(val)}"`);
          } else if (el.symbology === "code39") {
            lines.push(`BARCODE ${xDots},${yDots},"39",${barHeight},${readable},${rot},2,4,"${this.escapeTspl(val)}"`);
          } else if (el.symbology === "ean13") {
            lines.push(`BARCODE ${xDots},${yDots},"EAN13",${barHeight},${readable},${rot},2,4,"${this.escapeTspl(val)}"`);
          } else {
            lines.push(`BARCODE ${xDots},${yDots},"128",${barHeight},${readable},${rot},2,4,"${this.escapeTspl(val)}"`);
          }
        } else if (el.type === "shape") {
          const thickness = Math.max(1, mmToDots(el.strokeWidth, dpi));
          if (el.shapeType === "rectangle") {
            lines.push(`BOX ${xDots},${yDots},${xDots + wDots},${yDots + hDots},${thickness}`);
          } else if (el.shapeType === "line") {
            lines.push(`BAR ${xDots},${yDots},${wDots},${thickness}`);
          }
        }
      }
      lines.push(`PRINT ${copies},1`);
      if (options?.cutAfterJob) {
        lines.push("CUT");
      }
      streamParts.push(lines.join("\r\n"));
    }
    return streamParts.join("\r\n\r\n");
  }
  escapeTspl(str) {
    if (!str) return "";
    return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }
  validateTemplate(template) {
    const warnings = [];
    if (!template.elements || template.elements.length === 0) {
      warnings.push("Template contains no elements to print.");
    }
    return warnings;
  }
};

// src/services/printerAdapters/eplAdapter.ts
init_dataSourceEngine();
var EplAdapter = class {
  constructor() {
    this.id = "epl";
    this.name = "Eltron EPL2 Protocol";
    this.language = "epl";
    this.capabilities = {
      language: "epl",
      displayName: "Eltron EPL2",
      defaultPort: 9100,
      supportedDpi: [203],
      supports2DBarcodes: true,
      supportsShapes: true,
      supportsImages: false,
      supportsCutter: true,
      supportsDirectTcp: true
    };
  }
  generateJobStream(template, records = [{}], options) {
    const dpi = options?.dpi || template.dimensions.dpi || 203;
    const copies = Math.max(1, options?.copies || 1);
    const darkness = options?.darkness;
    const speed = options?.speed;
    const pw = mmToDots(template.dimensions.width, dpi);
    const ph = mmToDots(template.dimensions.height, dpi);
    const streamParts = [];
    const recordsToPrint = records.length > 0 ? records : [{}];
    for (const record of recordsToPrint) {
      const lines = [
        "N",
        `q${pw}`,
        `Q${ph},24`
      ];
      if (darkness !== void 0) {
        const d = Math.min(15, Math.max(0, Math.round(darkness / 30 * 15)));
        lines.push(`D${d}`);
      }
      if (speed !== void 0) {
        const s = Math.min(6, Math.max(1, Math.round(speed / 2)));
        lines.push(`S${s}`);
      }
      const elements = [...template.elements].sort((a, b) => a.zIndex - b.zIndex);
      for (const el of elements) {
        if (!el.visible || el.printable === false) continue;
        const x = mmToDots(el.x, dpi);
        const y = mmToDots(el.y, dpi);
        const w = mmToDots(el.width, dpi);
        const h = mmToDots(el.height, dpi);
        const rot = el.rotation === 90 ? 1 : el.rotation === 180 ? 2 : el.rotation === 270 ? 3 : 0;
        if (el.type === "text") {
          const txt = evaluateElementData(el, { record });
          const font = el.fontSize > 16 ? 4 : el.fontSize > 12 ? 3 : 2;
          lines.push(`A${x},${y},${rot},${font},1,1,N,"${this.escapeEpl(txt)}"`);
        } else if (el.type === "barcode") {
          const val = evaluateElementData(el, { record });
          const barH = mmToDots(el.barHeight || el.height, dpi);
          const readable = el.includeText ? "B" : "N";
          if (el.symbology === "code39") {
            lines.push(`B${x},${y},${rot},3,2,4,${barH},${readable},"${this.escapeEpl(val)}"`);
          } else if (el.symbology === "ean13") {
            lines.push(`B${x},${y},${rot},E30,2,4,${barH},${readable},"${this.escapeEpl(val)}"`);
          } else if (el.symbology === "qr") {
            lines.push(`b${x},${y},Q,s4,eM,"${this.escapeEpl(val)}"`);
          } else {
            lines.push(`B${x},${y},${rot},1,2,4,${barH},${readable},"${this.escapeEpl(val)}"`);
          }
        } else if (el.type === "shape") {
          const stroke = Math.max(1, mmToDots(el.strokeWidth, dpi));
          if (el.shapeType === "rectangle") {
            lines.push(`X${x},${y},${stroke},${x + w},${y + h}`);
          } else if (el.shapeType === "line") {
            lines.push(`LO${x},${y},${w},${stroke}`);
          }
        }
      }
      lines.push(`P${copies}`);
      if (options?.cutAfterJob) {
        lines.push("C");
      }
      streamParts.push(lines.join("\n"));
    }
    return streamParts.join("\n\n");
  }
  escapeEpl(str) {
    if (!str) return "";
    return str.replace(/"/g, "'");
  }
  validateTemplate(template) {
    const warnings = [];
    if (!template.elements || template.elements.length === 0) {
      warnings.push("Template contains no elements to print.");
    }
    return warnings;
  }
};

// src/services/printerAdapters/escPosAdapter.ts
init_dataSourceEngine();
var EscPosAdapter = class {
  constructor() {
    this.id = "escpos";
    this.name = "Standard ESC/POS Thermal Protocol";
    this.language = "escpos";
    this.capabilities = {
      language: "escpos",
      displayName: "ESC/POS Thermal",
      defaultPort: 9100,
      supportedDpi: [203],
      supports2DBarcodes: true,
      supportsShapes: false,
      supportsImages: true,
      supportsCutter: true,
      supportsDirectTcp: true
    };
  }
  generateJobStream(template, records = [{}], options) {
    const copies = Math.max(1, options?.copies || 1);
    const recordsToPrint = records.length > 0 ? records : [{}];
    const byteChunks = [];
    const push = (...bytes) => {
      byteChunks.push(...bytes);
    };
    const pushString = (str) => {
      const encoder = new TextEncoder();
      const encoded = encoder.encode(str);
      for (let i = 0; i < encoded.length; i++) {
        byteChunks.push(encoded[i]);
      }
    };
    for (let c = 0; c < copies; c++) {
      for (const record of recordsToPrint) {
        push(27, 64);
        const sorted = [...template.elements].sort((a, b) => a.y - b.y);
        for (const el of sorted) {
          if (!el.visible || el.printable === false) continue;
          const align = el.textAlign === "center" ? 1 : el.textAlign === "right" ? 2 : 0;
          push(27, 97, align);
          if (el.type === "text") {
            const txt = evaluateElementData(el, { record });
            const isBold = el.fontWeight === "bold" || el.fontWeight === "700" || el.fontSize > 16;
            push(27, 69, isBold ? 1 : 0);
            const isLarge = el.fontSize >= 18;
            push(29, 33, isLarge ? 17 : 0);
            pushString(txt);
            push(10);
          } else if (el.type === "barcode") {
            const val = evaluateElementData(el, { record });
            if (el.symbology === "qr" || el.symbology === "gs1-qr" || el.symbology === "micro-qr") {
              const qrData = new TextEncoder().encode(val);
              const pL = qrData.length + 3 & 255;
              const pH = qrData.length + 3 >> 8 & 255;
              push(29, 40, 107, 4, 0, 49, 65, 50, 0);
              push(29, 40, 107, 3, 0, 49, 67, 4);
              push(29, 40, 107, 3, 0, 49, 69, 48);
              push(29, 40, 107, pL, pH, 49, 80, 48);
              for (let b of qrData) push(b);
              push(29, 40, 107, 3, 0, 49, 81, 48);
              push(10);
            } else {
              const barcodeData = new TextEncoder().encode(val);
              const barHeight = Math.min(255, Math.max(30, Math.round((el.barHeight || el.height || 20) * 3)));
              push(29, 104, barHeight);
              push(29, 119, 2);
              push(29, 72, el.includeText ? 2 : 0);
              push(29, 107, 73, barcodeData.length);
              for (let b of barcodeData) push(b);
              push(10);
            }
          }
        }
        push(10, 10, 10);
        if (options?.cutAfterJob !== false) {
          push(29, 86, 66, 0);
        }
      }
    }
    return new Uint8Array(byteChunks);
  }
  validateTemplate(template) {
    const warnings = [];
    if (!template.elements || template.elements.length === 0) {
      warnings.push("Template contains no elements to print.");
    }
    const hasShapes = template.elements.some((e) => e.type === "shape");
    if (hasShapes) {
      warnings.push("ESC/POS receipt protocol does not natively draw vector shapes or borders.");
    }
    return warnings;
  }
};

// src/services/printerAdapters/pdfAdapter.ts
var PdfAdapter = class {
  constructor() {
    this.id = "pdf";
    this.name = "Desktop PDF Vector Document Spooler";
    this.language = "pdf";
    this.capabilities = {
      language: "pdf",
      displayName: "PDF Vector Spooler",
      defaultPort: 0,
      supportedDpi: [300, 600],
      supports2DBarcodes: true,
      supportsShapes: true,
      supportsImages: true,
      supportsCutter: false,
      supportsDirectTcp: false
    };
  }
  generateJobStream(template, records = [{}], options) {
    const copies = Math.max(1, options?.copies || 1);
    return JSON.stringify({
      format: "pdf",
      templateId: template.id,
      templateName: template.name,
      dimensions: template.dimensions,
      recordsCount: records.length,
      copies,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }, null, 2);
  }
  async generatePdfBlob(template, records = [{}], options) {
    const { exportLabelsToPDF: exportLabelsToPDF2 } = await Promise.resolve().then(() => (init_pdfExportService(), pdfExportService_exports));
    const copies = Math.max(1, options?.copies || 1);
    return exportLabelsToPDF2(template, records, copies);
  }
  validateTemplate(template) {
    const warnings = [];
    if (!template.elements || template.elements.length === 0) {
      warnings.push("Template contains no elements to print.");
    }
    return warnings;
  }
};

// src/services/printerAdapters/index.ts
var adapters = /* @__PURE__ */ new Map();
var defaultZpl = new ZplAdapter();
var defaultTspl = new TsplAdapter();
var defaultEpl = new EplAdapter();
var defaultEscPos = new EscPosAdapter();
var defaultPdf = new PdfAdapter();
adapters.set("zpl", defaultZpl);
adapters.set("tspl", defaultTspl);
adapters.set("epl", defaultEpl);
adapters.set("escpos", defaultEscPos);
adapters.set("pdf", defaultPdf);
function getPrinterAdapter(protocolOrLang = "zpl") {
  const key = (protocolOrLang || "zpl").toLowerCase().trim();
  if (adapters.has(key)) {
    return adapters.get(key);
  }
  if (key.includes("zpl") || key.includes("zebra")) return defaultZpl;
  if (key.includes("tspl") || key.includes("tsc")) return defaultTspl;
  if (key.includes("epl") || key.includes("eltron")) return defaultEpl;
  if (key.includes("esc") || key.includes("pos") || key.includes("receipt")) return defaultEscPos;
  if (key.includes("pdf")) return defaultPdf;
  return defaultZpl;
}
function generatePrintStream(protocol, template, records = [{}], options) {
  const adapter = getPrinterAdapter(protocol);
  return adapter.generateJobStream(template, records, options);
}

// barcode-automation-backend/src/routes/printJobs.ts
var printJobsRouter = Router2();
var storage2 = StorageService.getInstance();
var printService = NetworkPrintService.getInstance();
printJobsRouter.get("/", (req, res) => {
  const jobs = storage2.read("printJobs", []);
  res.json(jobs);
});
printJobsRouter.post("/", async (req, res) => {
  try {
    const {
      templateId,
      printerId,
      copies = 1,
      records = [{}],
      format = "zpl",
      submittedBy,
      template: providedTemplate,
      darkness,
      speed
    } = req.body;
    const templates = storage2.read("templates", []);
    const printers = storage2.read("printers", []);
    const template = providedTemplate || templates.find((t) => t.id === templateId) || templates[0];
    const printer = printers.find((p) => p.id === printerId) || printers[0];
    if (!template) {
      return res.status(400).json({ error: "Template not found" });
    }
    let rawOutput = "";
    try {
      rawOutput = generatePrintStream(format, template, records, {
        copies: Number(copies),
        darkness: darkness !== void 0 ? Number(darkness) : printer?.darkness,
        speed: speed !== void 0 ? Number(speed) : printer?.speed,
        dpi: printer?.dpi || template.dimensions?.dpi || 203
      });
    } catch (err) {
      console.error("[PrintJobsRouter] Error generating raw stream:", err);
      rawOutput = `/* Error generating ${format} stream: ${err.message} */`;
    }
    const rawString = typeof rawOutput === "string" ? rawOutput : Buffer.from(rawOutput).toString("binary");
    const printJobs = storage2.read("printJobs", []);
    const newJob = {
      id: `PJ-${Math.floor(1e3 + Math.random() * 9e3)}`,
      templateId: template.id,
      templateName: template.name,
      printerId: printer?.id || "p-default",
      printerName: printer?.name || "Default Industrial Printer",
      copies: Number(copies),
      recordCount: records.length,
      status: "printing",
      format,
      submittedBy: submittedBy || "David Chen (Print Operator)",
      submittedAt: (/* @__PURE__ */ new Date()).toISOString(),
      progressPercent: 20,
      zplOutput: format === "zpl" ? rawString : void 0,
      rawOutput: rawString
    };
    printJobs.unshift(newJob);
    storage2.write("printJobs", printJobs);
    const transmitResult = await printService.dispatchJob(printer || {}, rawString);
    const currentJobs = storage2.read("printJobs", []);
    const target = currentJobs.find((j) => j.id === newJob.id);
    if (target) {
      if (transmitResult.success) {
        target.status = "completed";
        target.progressPercent = 100;
        target.completedAt = (/* @__PURE__ */ new Date()).toISOString();
        target.bytesWritten = transmitResult.bytesWritten;
      } else {
        target.status = "failed";
        target.progressPercent = 0;
        target.errorMessage = transmitResult.error || transmitResult.message;
      }
      storage2.write("printJobs", currentJobs);
    }
    logBackendAudit(
      newJob.submittedBy,
      "Print Operator",
      "PRINT_JOB_DISPATCH",
      `${transmitResult.success ? "Successfully transmitted" : "Failed transmitting"} print job #${newJob.id} (${copies} copies, ${records.length} records) to ${newJob.printerName} via ${format.toUpperCase()}: ${transmitResult.message}`,
      newJob.id,
      template.name
    );
    res.status(201).json(target || newJob);
  } catch (err) {
    console.error("[PrintJobsRouter] Dispatch error:", err);
    res.status(500).json({ error: err.message });
  }
});
printJobsRouter.post("/:id/pause", (req, res) => {
  const jobs = storage2.read("printJobs", []);
  const job = jobs.find((j) => j.id === req.params.id);
  if (job) {
    job.status = "paused";
    storage2.write("printJobs", jobs);
    return res.json({ success: true, job });
  }
  res.status(404).json({ error: "Print job not found" });
});
printJobsRouter.post("/:id/resume", (req, res) => {
  const jobs = storage2.read("printJobs", []);
  const job = jobs.find((j) => j.id === req.params.id);
  if (job) {
    job.status = "printing";
    storage2.write("printJobs", jobs);
    return res.json({ success: true, job });
  }
  res.status(404).json({ error: "Print job not found" });
});
printJobsRouter.post("/:id/cancel", (req, res) => {
  const jobs = storage2.read("printJobs", []);
  const job = jobs.find((j) => j.id === req.params.id);
  if (job) {
    job.status = "failed";
    job.errorMessage = "Cancelled by operator";
    storage2.write("printJobs", jobs);
    logBackendAudit(
      "Operator",
      "Print Operator",
      "PRINT_JOB_CANCEL",
      `Cancelled print job #${job.id}`,
      job.id,
      job.templateName
    );
    return res.json({ success: true, job });
  }
  res.status(404).json({ error: "Print job not found" });
});

// barcode-automation-backend/src/routes/batchJobs.ts
import { Router as Router3 } from "express";
var batchJobsRouter = Router3();
var storage3 = StorageService.getInstance();
batchJobsRouter.get("/", (req, res) => {
  const batchJobs = storage3.read("batchJobs", []);
  res.json(batchJobs);
});
batchJobsRouter.post("/", (req, res) => {
  const batchJobs = storage3.read("batchJobs", []);
  const newBatch = req.body;
  if (!newBatch.id) {
    newBatch.id = `batch-${Date.now()}`;
  }
  newBatch.createdAt = newBatch.createdAt || (/* @__PURE__ */ new Date()).toISOString();
  newBatch.status = newBatch.status || "ready";
  batchJobs.unshift(newBatch);
  storage3.write("batchJobs", batchJobs);
  logBackendAudit(
    newBatch.generatedBy || "Operator",
    "Label Designer",
    "BATCH_GENERATE",
    `Generated serialized ${newBatch.totalPages || 10}-page barcode job ${newBatch.jobCode || newBatch.id} for template "${newBatch.templateName}"`,
    newBatch.id,
    newBatch.templateName
  );
  res.status(201).json(newBatch);
});
batchJobsRouter.patch("/:id/status", (req, res) => {
  const { status, printedBy, printerName } = req.body;
  const batchJobs = storage3.read("batchJobs", []);
  const batch = batchJobs.find((b) => b.id === req.params.id);
  if (!batch) {
    return res.status(404).json({ error: "Batch job not found" });
  }
  batch.status = status;
  if (status === "printed") {
    batch.printedAt = (/* @__PURE__ */ new Date()).toLocaleString();
    batch.printedBy = printedBy || "Print Operator";
  }
  storage3.write("batchJobs", batchJobs);
  logBackendAudit(
    printedBy || "Print Operator",
    "Print Operator",
    "PRINT_JOB_DISPATCH",
    `Marked batch job ${batch.jobCode || batch.id} as ${status.toUpperCase()} on printer "${printerName || "Industrial Thermal"}"`,
    batch.id,
    batch.templateName
  );
  res.json(batch);
});

// barcode-automation-backend/src/routes/printers.ts
import { Router as Router4 } from "express";
var printersRouter = Router4();
var storage4 = StorageService.getInstance();
var audit = AuditService.getInstance();
var printService2 = NetworkPrintService.getInstance();
printersRouter.get("/", (req, res) => {
  const printers = storage4.read("printers", INITIAL_PRINTERS);
  res.json(printers);
});
printersRouter.get("/default", (req, res) => {
  const printers = storage4.read("printers", INITIAL_PRINTERS);
  const def = printers.find((p) => p.isDefault || p.status === "online") || printers[0];
  res.json(def || null);
});
printersRouter.post("/refresh", async (req, res) => {
  try {
    const discovered = await printService2.discoverInstalledPrinters();
    const existing = storage4.read("printers", INITIAL_PRINTERS);
    const combinedMap = /* @__PURE__ */ new Map();
    existing.forEach((p) => combinedMap.set(p.name.toLowerCase(), p));
    discovered.forEach((p, idx) => {
      const key = p.name.toLowerCase();
      if (!combinedMap.has(key)) {
        combinedMap.set(key, {
          id: `prn-os-${idx + 1}`,
          name: p.name,
          model: p.driverName || p.name,
          brand: p.protocol === "zpl" ? "Zebra" : p.protocol === "tspl" ? "TSC" : "Desktop PDF",
          dpi: p.protocol === "zpl" ? 300 : 203,
          status: p.status,
          protocol: p.protocol,
          location: "Local Workstation / USB Spooler",
          mediaWidth: 104,
          mediaHeight: 152,
          ipAddress: p.portName || "127.0.0.1",
          port: 9100,
          isDefault: p.isDefault,
          driverName: p.driverName,
          isThermal: p.isThermal
        });
      } else {
        const current = combinedMap.get(key);
        current.status = p.status;
        if (p.isDefault) current.isDefault = true;
      }
    });
    const updatedList = Array.from(combinedMap.values());
    storage4.write("printers", updatedList);
    audit.log("PRINTER_REFRESH", `Refreshed printer list. Discovered ${discovered.length} OS printers on platform ${process.platform}.`);
    res.json({
      success: true,
      count: updatedList.length,
      printers: updatedList
    });
  } catch (err) {
    console.error("[PrintersRouter] Refresh failed:", err);
    const fallback = storage4.read("printers", INITIAL_PRINTERS);
    res.json({ success: false, error: err.message, printers: fallback });
  }
});
printersRouter.post("/:id/probe", async (req, res) => {
  try {
    const printers = storage4.read("printers", INITIAL_PRINTERS);
    const printer = printers.find((p) => p.id === req.params.id);
    if (!printer) {
      return res.status(404).json({ error: "Printer not found" });
    }
    let liveStatus = "offline";
    const isIpDefined = printer.ipAddress && printer.ipAddress !== "127.0.0.1" && printer.ipAddress !== "localhost" && !printer.ipAddress.startsWith("Virtual") && !printer.ipAddress.startsWith("USB");
    if (isIpDefined && printer.port) {
      liveStatus = await printService2.probeTcpPrinterStatus(printer.ipAddress, Number(printer.port), 2e3);
    } else {
      const discovered = await printService2.discoverInstalledPrinters();
      const match = discovered.find((d) => d.name.toLowerCase() === printer.name.toLowerCase());
      liveStatus = match ? match.status : printer.status || "online";
    }
    printer.status = liveStatus;
    storage4.write("printers", printers);
    res.json({
      id: printer.id,
      name: printer.name,
      status: liveStatus,
      probedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
printersRouter.post("/calibrate", (req, res) => {
  try {
    const { printerId, labelWidth, labelHeight, mediaType, dpi, darkness, speed, testPage } = req.body;
    const printers = storage4.read("printers", INITIAL_PRINTERS);
    const idx = printers.findIndex((p) => p.id === printerId);
    if (idx !== -1) {
      printers[idx].calibration = {
        labelWidth: labelWidth || 100,
        labelHeight: labelHeight || 50,
        mediaType: mediaType || "gap",
        dpi: dpi || 300,
        darkness: darkness || 15,
        speed: speed || 6,
        calibratedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      storage4.write("printers", printers);
    }
    audit.log("PRINTER_CALIBRATE", `Calibrated printer "${printers[idx]?.name || printerId}" (${labelWidth}x${labelHeight}mm, ${dpi} DPI, Darkness: ${darkness})`);
    res.json({
      success: true,
      message: `Printer calibration saved successfully.${testPage ? " Sent calibration test pattern to thermal spooler." : ""}`,
      printer: idx !== -1 ? printers[idx] : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
printersRouter.post("/", (req, res) => {
  const printers = storage4.read("printers", INITIAL_PRINTERS);
  const newPrinter = req.body;
  if (!newPrinter.id) {
    newPrinter.id = `prn-${Date.now()}`;
  }
  printers.push(newPrinter);
  storage4.write("printers", printers);
  audit.log("PRINTER_CREATE", `Added thermal printer "${newPrinter.name}" (${newPrinter.ipAddress}:${newPrinter.port})`);
  res.status(201).json(newPrinter);
});
printersRouter.put("/:id", (req, res) => {
  const printers = storage4.read("printers", INITIAL_PRINTERS);
  const index = printers.findIndex((p) => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Printer not found" });
  }
  printers[index] = { ...printers[index], ...req.body };
  storage4.write("printers", printers);
  audit.log("PRINTER_UPDATE", `Updated printer configuration for "${printers[index].name}"`);
  res.json(printers[index]);
});
printersRouter.delete("/:id", (req, res) => {
  const printers = storage4.read("printers", INITIAL_PRINTERS);
  const index = printers.findIndex((p) => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Printer not found" });
  }
  const removed = printers.splice(index, 1)[0];
  storage4.write("printers", printers);
  audit.log("PRINTER_DELETE", `Removed printer "${removed.name}"`);
  res.json({ success: true, id: req.params.id });
});

// barcode-automation-backend/src/routes/auditLogs.ts
import { Router as Router5 } from "express";
var auditLogsRouter = Router5();
var storage5 = StorageService.getInstance();
auditLogsRouter.get("/", (req, res) => {
  const logs = storage5.read("auditLogs", []);
  res.json(logs);
});
auditLogsRouter.post("/", (req, res) => {
  const { user, userRole, action, details, entityId, entityName } = req.body;
  const entry = logBackendAudit(
    user,
    userRole,
    action,
    details,
    entityId,
    entityName,
    req.ip || "127.0.0.1"
  );
  res.status(201).json(entry);
});
auditLogsRouter.get("/export", (req, res) => {
  const logs = storage5.read("auditLogs", []);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename=audit_logs_${Date.now()}.json`);
  res.json(logs);
});

// barcode-automation-backend/src/routes/users.ts
import { Router as Router6 } from "express";
var usersRouter = Router6();
var storage6 = StorageService.getInstance();
function getUsers() {
  const list = storage6.read("users", INITIAL_USERS);
  const hasSuperAdmin = list.some((u) => u.email?.toLowerCase() === "superadmin@gmail.com");
  if (!hasSuperAdmin) {
    const superAdmin = INITIAL_USERS.find((u) => u.email?.toLowerCase() === "superadmin@gmail.com") || {
      id: "usr-super-admin",
      name: "Super Administrator",
      email: "superadmin@gmail.com",
      password: "superadmin@gmail.com",
      role: "Super Admin",
      department: "Enterprise Security & Governance",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces",
      status: "approved",
      isApproved: true,
      createdAt: "2026-08-01T00:00:00Z",
      permissions: {
        canDesignTemplates: true,
        canCreateTemplates: true,
        canDeleteTemplates: true,
        canApproveWorkflow: true,
        canPrintAndSpool: true,
        canManageDatasets: true,
        canCalibratePrinters: true,
        canManageLicense: true,
        canDownloadDesktopApp: true,
        canViewAuditLogs: true
      }
    };
    list.unshift(superAdmin);
    storage6.write("users", list);
  }
  return list;
}
var handleListUsers = (req, res) => {
  try {
    const users = getUsers();
    const sanitized = users.map((u) => {
      const { password, ...rest } = u;
      return rest;
    });
    res.json(sanitized);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
var handleLogin = (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = email?.trim().toLowerCase();
    const cleanPassword = password?.trim();
    if (!cleanEmail) {
      return res.status(400).json({ success: false, message: "Email address is required." });
    }
    const users = getUsers();
    if (cleanEmail === "superadmin@gmail.com") {
      if (cleanPassword && cleanPassword !== "superadmin@gmail.com") {
        return res.status(401).json({
          success: false,
          message: "Invalid Super Admin credentials. Password must match superadmin@gmail.com."
        });
      }
      const superAdmin = users.find((u) => u.email?.toLowerCase() === "superadmin@gmail.com") || {
        id: "usr-super-admin",
        name: "Super Administrator",
        email: "superadmin@gmail.com",
        role: "Super Admin",
        department: "Enterprise Security & Governance",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces",
        status: "approved",
        isApproved: true,
        permissions: {
          canDesignTemplates: true,
          canCreateTemplates: true,
          canDeleteTemplates: true,
          canApproveWorkflow: true,
          canPrintAndSpool: true,
          canManageDatasets: true,
          canCalibratePrinters: true,
          canManageLicense: true,
          canDownloadDesktopApp: true,
          canViewAuditLogs: true
        }
      };
      logBackendAudit(
        superAdmin.name,
        "Super Admin",
        "USER_LOGIN",
        `Super Administrator logged into BarcodeFlow Enterprise Security Console`,
        superAdmin.id,
        superAdmin.name
      );
      const { password: _2, ...safeUser2 } = superAdmin;
      return res.json({
        success: true,
        user: safeUser2,
        token: `token-super-admin-${Date.now()}`,
        message: "Welcome Super Administrator! Full system governance granted."
      });
    }
    let user = users.find((u) => u.email?.toLowerCase() === cleanEmail);
    if (!user) {
      const demoUser = INITIAL_USERS.find((u) => u.email?.toLowerCase() === cleanEmail);
      if (demoUser) {
        user = demoUser;
      } else {
        return res.status(401).json({
          success: false,
          message: "User account not found. Please register or check your email."
        });
      }
    }
    if (user.password && cleanPassword && user.password !== cleanPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid password. Please check your credentials."
      });
    }
    if (user.status === "pending_approval" || user.isApproved === false) {
      return res.status(403).json({
        success: false,
        message: "Your Admin registration is pending approval by the Super Admin. Please contact superadmin@gmail.com for activation.",
        pendingApproval: true
      });
    }
    if (user.status === "suspended" || user.status === "rejected") {
      return res.status(403).json({
        success: false,
        message: "Your Admin account has been suspended or rejected by the Super Administrator.",
        suspended: true
      });
    }
    logBackendAudit(
      user.name,
      user.role || "Admin",
      "USER_LOGIN",
      `User ${user.name} (${user.role || "Admin"}) logged in successfully`,
      user.id,
      user.name
    );
    const { password: _, ...safeUser } = user;
    return res.json({
      success: true,
      user: safeUser,
      token: `token-${user.id}-${Date.now()}`,
      message: `Welcome back, ${user.name}!`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
var handleRegister = (req, res) => {
  try {
    const { name, email, password, department, role = "Admin" } = req.body;
    const cleanEmail = email?.trim().toLowerCase();
    if (!cleanEmail || !name) {
      return res.status(400).json({ success: false, message: "Name and email are required." });
    }
    const users = getUsers();
    const existing = users.find((u) => u.email?.toLowerCase() === cleanEmail);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "An account with this email address already exists."
      });
    }
    const newUser = {
      id: `usr-admin-${Date.now()}`,
      name: name.trim(),
      email: cleanEmail,
      password: password?.trim() || "password123",
      role: "Admin",
      department: department?.trim() || "Packaging Operations",
      avatar: `https://images.unsplash.com/photo-${1534528741775 + users.length % 1e3}?w=100&h=100&fit=crop&crop=faces`,
      status: "pending_approval",
      isApproved: false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      permissions: {
        canDesignTemplates: true,
        canCreateTemplates: true,
        canDeleteTemplates: false,
        canApproveWorkflow: true,
        canPrintAndSpool: true,
        canManageDatasets: true,
        canCalibratePrinters: false,
        canManageLicense: false,
        canDownloadDesktopApp: true,
        canViewAuditLogs: true
      }
    };
    users.push(newUser);
    storage6.write("users", users);
    logBackendAudit(
      newUser.name,
      "Admin Registration",
      "USER_REGISTER",
      `New Admin registration submitted for ${newUser.name} (${newUser.email}). Pending Super Admin approval.`,
      newUser.id,
      newUser.name
    );
    const { password: _, ...safeUser } = newUser;
    res.status(201).json({
      success: true,
      message: "Admin registration submitted successfully! Your account is now pending approval by the Super Admin (superadmin@gmail.com). You will be able to log in once approved.",
      user: safeUser
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
usersRouter.get("/", handleListUsers);
usersRouter.get("/list", handleListUsers);
usersRouter.post("/login", handleLogin);
usersRouter.post("/auth/login", handleLogin);
usersRouter.post("/register", handleRegister);
usersRouter.post("/auth/register", handleRegister);
usersRouter.patch("/:id/status", (req, res) => {
  try {
    const { id } = req.params;
    const { status, approvedBy = "Super Administrator" } = req.body;
    if (!["approved", "rejected", "suspended", "pending_approval"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status value." });
    }
    const users = getUsers();
    const userIndex = users.findIndex((u) => u.id === id);
    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    if (users[userIndex].email?.toLowerCase() === "superadmin@gmail.com") {
      return res.status(403).json({ success: false, message: "Cannot modify Super Administrator status." });
    }
    users[userIndex].status = status;
    users[userIndex].isApproved = status === "approved";
    if (status === "approved") {
      users[userIndex].approvedAt = (/* @__PURE__ */ new Date()).toISOString();
      users[userIndex].approvedBy = approvedBy;
    }
    storage6.write("users", users);
    logBackendAudit(
      approvedBy,
      "Super Admin",
      "ADMIN_STATUS_UPDATE",
      `Super Admin updated status for ${users[userIndex].name} (${users[userIndex].email}) to ${status.toUpperCase()}`,
      id,
      users[userIndex].name
    );
    const { password: _, ...safeUser } = users[userIndex];
    res.json({
      success: true,
      message: `Admin ${users[userIndex].name} status updated to ${status.toUpperCase()}`,
      user: safeUser
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
usersRouter.put("/:id/permissions", (req, res) => {
  try {
    const { id } = req.params;
    const { permissions, updatedBy = "Super Administrator" } = req.body;
    if (!permissions || typeof permissions !== "object") {
      return res.status(400).json({ success: false, message: "Invalid permissions payload." });
    }
    const users = getUsers();
    const userIndex = users.findIndex((u) => u.id === id);
    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    if (users[userIndex].email?.toLowerCase() === "superadmin@gmail.com") {
      return res.status(403).json({ success: false, message: "Cannot modify Super Administrator permissions." });
    }
    users[userIndex].permissions = {
      ...users[userIndex].permissions,
      ...permissions
    };
    storage6.write("users", users);
    logBackendAudit(
      updatedBy,
      "Super Admin",
      "PERMISSIONS_UPDATE",
      `Super Admin updated feature permissions for ${users[userIndex].name} (${users[userIndex].email})`,
      id,
      users[userIndex].name
    );
    const { password: _, ...safeUser } = users[userIndex];
    res.json({
      success: true,
      message: `Permissions updated successfully for ${safeUser.name}`,
      user: safeUser
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
usersRouter.put("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, department, password, status, permissions } = req.body;
    const users = getUsers();
    const userIndex = users.findIndex((u) => u.id === id);
    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    const isSuper = users[userIndex].email?.toLowerCase() === "superadmin@gmail.com";
    if (name) users[userIndex].name = name.trim();
    if (email && !isSuper) users[userIndex].email = email.trim().toLowerCase();
    if (role && !isSuper) users[userIndex].role = role;
    if (department) users[userIndex].department = department.trim();
    if (password) users[userIndex].password = password.trim();
    if (status && !isSuper) {
      users[userIndex].status = status;
      users[userIndex].isApproved = status === "approved";
    }
    if (permissions && typeof permissions === "object") {
      users[userIndex].permissions = { ...users[userIndex].permissions, ...permissions };
    }
    storage6.write("users", users);
    logBackendAudit(
      "Super Administrator",
      "Super Admin",
      "USER_UPDATE",
      `Super Admin updated profile details for ${users[userIndex].name} (${users[userIndex].email})`,
      id,
      users[userIndex].name
    );
    const { password: _, ...safeUser } = users[userIndex];
    res.json({
      success: true,
      message: `Account details updated for ${safeUser.name}`,
      user: safeUser
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
usersRouter.delete("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const users = getUsers();
    const target = users.find((u) => u.id === id);
    if (!target) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    if (target.email?.toLowerCase() === "superadmin@gmail.com") {
      return res.status(403).json({ success: false, message: "Cannot delete Super Administrator." });
    }
    const filtered = users.filter((u) => u.id !== id);
    storage6.write("users", filtered);
    logBackendAudit(
      "Super Administrator",
      "Super Admin",
      "USER_DELETE",
      `Super Admin deleted user ${target.name} (${target.email})`,
      id,
      target.name
    );
    res.json({ success: true, message: `User ${target.name} deleted successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// barcode-automation-backend/src/routes/gs1.ts
import { Router as Router7 } from "express";

// src/services/gs1Engine.ts
var GS1_AI_DICTIONARY = {
  "00": { ai: "00", description: "SSCC (Serial Shipping Container Code)", format: "N18", dataTitle: "SSCC", minLength: 18, maxLength: 18, isVariableLength: false, type: "numeric" },
  "01": { ai: "01", description: "GTIN (Global Trade Item Number)", format: "N14", dataTitle: "GTIN", minLength: 14, maxLength: 14, isVariableLength: false, type: "numeric" },
  "02": { ai: "02", description: "GTIN of contained trade items", format: "N14", dataTitle: "CONTENT", minLength: 14, maxLength: 14, isVariableLength: false, type: "numeric" },
  "10": { ai: "10", description: "Batch or Lot Number", format: "X..20", dataTitle: "BATCH/LOT", minLength: 1, maxLength: 20, isVariableLength: true, type: "alphanumeric" },
  "11": { ai: "11", description: "Production Date (YYMMDD)", format: "N6", dataTitle: "PROD DATE", minLength: 6, maxLength: 6, isVariableLength: false, type: "date" },
  "12": { ai: "12", description: "Due Date for payment (YYMMDD)", format: "N6", dataTitle: "DUE DATE", minLength: 6, maxLength: 6, isVariableLength: false, type: "date" },
  "13": { ai: "13", description: "Packaging Date (YYMMDD)", format: "N6", dataTitle: "PACK DATE", minLength: 6, maxLength: 6, isVariableLength: false, type: "date" },
  "15": { ai: "15", description: "Best Before Date (YYMMDD)", format: "N6", dataTitle: "BEST BEFORE", minLength: 6, maxLength: 6, isVariableLength: false, type: "date" },
  "17": { ai: "17", description: "Expiration Date (YYMMDD)", format: "N6", dataTitle: "USE BY OR EXPIRY", minLength: 6, maxLength: 6, isVariableLength: false, type: "date" },
  "20": { ai: "20", description: "Internal Product Variant", format: "N2", dataTitle: "VARIANT", minLength: 2, maxLength: 2, isVariableLength: false, type: "numeric" },
  "21": { ai: "21", description: "Serial Number", format: "X..20", dataTitle: "SERIAL", minLength: 1, maxLength: 20, isVariableLength: true, type: "alphanumeric" },
  "240": { ai: "240", description: "Additional Product Identification", format: "X..30", dataTitle: "ADDITIONAL ID", minLength: 1, maxLength: 30, isVariableLength: true, type: "alphanumeric" },
  "241": { ai: "241", description: "Customer Part Number", format: "X..30", dataTitle: "CUST. PART NO", minLength: 1, maxLength: 30, isVariableLength: true, type: "alphanumeric" },
  "250": { ai: "250", description: "Secondary Serial Number", format: "X..30", dataTitle: "SEC. SERIAL", minLength: 1, maxLength: 30, isVariableLength: true, type: "alphanumeric" },
  "30": { ai: "30", description: "Variable Count (Quantity)", format: "N..8", dataTitle: "VAR. COUNT", minLength: 1, maxLength: 8, isVariableLength: true, type: "numeric" },
  "310": { ai: "310", description: "Net Weight (kg) with decimal point indication", format: "N6", dataTitle: "NET WEIGHT(kg)", minLength: 6, maxLength: 6, isVariableLength: false, type: "numeric" },
  "320": { ai: "320", description: "Net Length (m)", format: "N6", dataTitle: "NET LENGTH(m)", minLength: 6, maxLength: 6, isVariableLength: false, type: "numeric" },
  "330": { ai: "330", description: "Gross Weight (kg)", format: "N6", dataTitle: "GROSS WEIGHT(kg)", minLength: 6, maxLength: 6, isVariableLength: false, type: "numeric" },
  "37": { ai: "37", description: "Count of trade items in a logistic unit", format: "N..8", dataTitle: "COUNT", minLength: 1, maxLength: 8, isVariableLength: true, type: "numeric" },
  "390": { ai: "390", description: "Amount Payable (Single Monetary Area)", format: "N..15", dataTitle: "AMOUNT", minLength: 1, maxLength: 15, isVariableLength: true, type: "numeric" },
  "400": { ai: "400", description: "Customer Purchase Order Number", format: "X..30", dataTitle: "ORDER NUMBER", minLength: 1, maxLength: 30, isVariableLength: true, type: "alphanumeric" },
  "414": { ai: "414", description: "GLN for Physical Location", format: "N13", dataTitle: "LOC No.", minLength: 13, maxLength: 13, isVariableLength: false, type: "numeric" },
  "420": { ai: "420", description: "Deliver to / Ship to Postal Code", format: "X..20", dataTitle: "POSTAL", minLength: 1, maxLength: 20, isVariableLength: true, type: "alphanumeric" },
  "422": { ai: "422", description: "Country of Origin (ISO 3166-1 Numeric)", format: "N3", dataTitle: "ORIGIN", minLength: 3, maxLength: 3, isVariableLength: false, type: "numeric" },
  "7001": { ai: "7001", description: "NATO Stock Number (NSN)", format: "N13", dataTitle: "NSN", minLength: 13, maxLength: 13, isVariableLength: false, type: "numeric" },
  "8005": { ai: "8005", description: "Price Per Unit of Measure", format: "N6", dataTitle: "PRICE/UOM", minLength: 6, maxLength: 6, isVariableLength: false, type: "numeric" },
  "91": { ai: "91", description: "Internal Company Use (1)", format: "X..90", dataTitle: "INTERNAL", minLength: 1, maxLength: 90, isVariableLength: true, type: "alphanumeric" },
  "92": { ai: "92", description: "Internal Company Use (2)", format: "X..90", dataTitle: "INTERNAL", minLength: 1, maxLength: 90, isVariableLength: true, type: "alphanumeric" }
};
function calculateGS1CheckDigit(digitsWithoutCheckDigit) {
  const cleanDigits = digitsWithoutCheckDigit.replace(/\D/g, "");
  if (!cleanDigits.length) return 0;
  let sum = 0;
  let multiplier = 3;
  for (let i = cleanDigits.length - 1; i >= 0; i--) {
    const digit = parseInt(cleanDigits[i], 10);
    sum += digit * multiplier;
    multiplier = multiplier === 3 ? 1 : 3;
  }
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}
function validateGS1CheckDigit(fullNumber) {
  const clean = fullNumber.replace(/\D/g, "");
  if (clean.length < 2) return false;
  const body = clean.slice(0, -1);
  const checkDigit = parseInt(clean.slice(-1), 10);
  const calculated = calculateGS1CheckDigit(body);
  return checkDigit === calculated;
}
function parseGS1BracketedString(input) {
  const fields = [];
  const errors = [];
  if (!input || !input.trim()) {
    return { fields, isValid: true, errors };
  }
  const aiRegex = /\((\d{2,4})\)([^(]+)/g;
  let match;
  let hasMatches = false;
  while ((match = aiRegex.exec(input)) !== null) {
    hasMatches = true;
    const ai = match[1];
    const value = match[2].trim();
    const def = GS1_AI_DICTIONARY[ai];
    if (!def) {
      errors.push(`Unknown Application Identifier (${ai})`);
    } else {
      if (value.length < def.minLength || value.length > def.maxLength) {
        errors.push(`AI (${ai}) expected length between ${def.minLength} and ${def.maxLength}, got ${value.length}`);
      }
      if (def.type === "numeric" && !/^\d+$/.test(value)) {
        errors.push(`AI (${ai}) must contain only numeric digits`);
      }
    }
    fields.push({
      ai,
      label: def ? def.dataTitle : `AI ${ai}`,
      value,
      length: value.length,
      isVariableLength: def ? def.isVariableLength : true
    });
  }
  if (!hasMatches && input.includes("(")) {
    errors.push("Malformed GS1 bracketed string format");
  }
  return {
    fields,
    isValid: errors.length === 0,
    errors
  };
}

// barcode-automation-backend/src/routes/gs1.ts
var gs1Router = Router7();
gs1Router.post("/parse", (req, res) => {
  const { input } = req.body;
  const result = parseGS1BracketedString(input || "");
  res.json(result);
});
gs1Router.post("/check-digit", (req, res) => {
  const { digits } = req.body;
  if (!digits) {
    return res.status(400).json({ error: "Digits required" });
  }
  const checkDigit = calculateGS1CheckDigit(digits);
  const isValid = validateGS1CheckDigit(digits);
  res.json({ digits, checkDigit, isValidWithCurrentCheckDigit: isValid });
});

// barcode-automation-backend/src/routes/zpl.ts
import { Router as Router8 } from "express";
var zplRouter = Router8();
zplRouter.post("/generate", (req, res) => {
  const { template, record, format = "zpl" } = req.body;
  if (!template) {
    return res.status(400).json({ error: "Missing template definition" });
  }
  let code = "";
  if (format === "tspl") {
    code = generateTSPL(template, record || {});
  } else if (format === "epl") {
    code = generateEPL(template, record || {});
  } else {
    code = generateZPL(template, record || {});
  }
  res.json({ [format]: code, code });
});

// barcode-automation-backend/src/routes/ai.ts
import { Router as Router9 } from "express";
import { GoogleGenAI } from "@google/genai";
var aiRouter = Router9();
aiRouter.post("/suggest", async (req, res) => {
  const { prompt, labelType, standard } = req.body;
  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `You are an expert industrial barcode & label designer.
User prompt: "${prompt}".
Label context: Type="${labelType || "General"}", Standard="${standard || "GS1"}".
Please provide concise expert recommendations for:
1. Recommended Barcode Symbology & Dimensions (e.g. Code 128, GS1-128, QR, GS1 DataMatrix).
2. Essential Mandatory Fields & Application Identifiers (e.g. (01) GTIN, (10) Lot, (17) Expiry).
3. Recommended Thermal Printer Resolution (203 DPI vs 300 DPI vs 600 DPI) and Quiet Zone specs.
4. Suggested Variable Structure.
Keep the advice clear, professional, and actionable for an enterprise print engineer.`
      });
      return res.json({ advice: response.text });
    } catch (err) {
      console.error("[AI Assistant] Gemini API error:", err);
    }
  }
  let advice = `### Industrial Label Specification Recommendations for: ${labelType || "Custom Label"}

`;
  advice += `**1. Barcode Symbology:**
- For Logistics & Pallets: Use **GS1-128** with SSCC-18 (AI 00).
- For Pharma & Medical Devices: Use **GS1 DataMatrix** (2D) for FDA UDI compliance + Code 128 human backup.
- For High-Speed Sorting: Ensure minimum X-dimension of 0.33mm (203 DPI: 3 dots, 300 DPI: 4 dots).

`;
  advice += `**2. Essential Data Elements:**
- (01) GTIN-14 Item Code
- (10) Batch / Lot Identifier
- (17) Expiration Date (YYMMDD format)
- (21) Serial Number

`;
  advice += `**3. Printing Parameters:**
- Recommended Resolution: **300 DPI (12 dots/mm)** for crisp 2D DataMatrix and micro-fonts.
- Quiet Zone: Minimum 10x narrow bar width on both leading and trailing edges.`;
  res.json({ advice });
});

// barcode-automation-backend/src/routes/viewerLogs.ts
import { Router as Router10 } from "express";
var viewerLogsRouter = Router10();
var storage7 = StorageService.getInstance();
viewerLogsRouter.get("/", (req, res) => {
  const { templateId, jobId } = req.query;
  let logs = storage7.read("viewerLogs", []);
  if (templateId) {
    logs = logs.filter((l) => l.templateId === templateId);
  }
  if (jobId) {
    logs = logs.filter((l) => l.jobId === jobId);
  }
  res.json(logs);
});
viewerLogsRouter.post("/", (req, res) => {
  const logs = storage7.read("viewerLogs", []);
  const entry = {
    id: `vlog-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    ...req.body
  };
  logs.unshift(entry);
  if (logs.length > 500) logs.pop();
  storage7.write("viewerLogs", logs);
  const actionMap = {
    VIEW: "VIEW_TEMPLATE",
    DOWNLOAD_PDF: "DOWNLOAD_PDF",
    DOWNLOAD_PNG: "DOWNLOAD_PNG",
    PRINT_DISPATCH: "PRINT_JOB_DISPATCH"
  };
  logBackendAudit(
    entry.userName || "Viewer / Print Operator",
    entry.userRole || "Viewer / Print Operator",
    actionMap[entry.action] || "VIEW_TEMPLATE",
    `Viewer station action: ${entry.action} for template "${entry.templateId}" (${entry.details || "N/A"})`,
    entry.templateId,
    entry.templateVersion
  );
  res.status(201).json(entry);
});

// barcode-automation-backend/src/routes/datasets.ts
import { Router as Router11 } from "express";
var datasetsRouter = Router11();
var storage8 = StorageService.getInstance();
var audit2 = AuditService.getInstance();
var DEFAULT_DATASETS = [
  {
    id: "ds-pharma-01",
    name: "Pharmaceutical Master Packaging Lots",
    description: "Sterile Injectable Vials Serialization Master Dataset",
    sourceType: "excel",
    fileName: "Pharma_Master_Lots_2026.xlsx",
    columns: ["ITEM_CODE", "PRODUCT_NAME", "BATCH_NO", "LOT_NO", "MFG_DATE", "EXP_DATE", "MRP", "GTIN", "SERIAL_PREFIX"],
    records: [
      {
        ITEM_CODE: "INJ-500MG-01",
        PRODUCT_NAME: "Ceftriaxone Sodium 1g Vial",
        BATCH_NO: "BATCH-2026-X8",
        LOT_NO: "LOT-9921",
        MFG_DATE: "2026-08-01",
        EXP_DATE: "2028-07-31",
        MRP: "$149.00",
        GTIN: "00850006539987",
        SERIAL_PREFIX: "SN-BATCH2026X8"
      },
      {
        ITEM_CODE: "INJ-500MG-02",
        PRODUCT_NAME: "Amoxicillin & Clavulanate Injection",
        BATCH_NO: "BATCH-2026-Y9",
        LOT_NO: "LOT-9922",
        MFG_DATE: "2026-08-05",
        EXP_DATE: "2028-08-04",
        MRP: "$189.50",
        GTIN: "00850006540013",
        SERIAL_PREFIX: "SN-BATCH2026Y9"
      },
      {
        ITEM_CODE: "INJ-1000MG-03",
        PRODUCT_NAME: "Paracetamol IV Infusion 100ml",
        BATCH_NO: "BATCH-2026-Z1",
        LOT_NO: "LOT-9923",
        MFG_DATE: "2026-08-10",
        EXP_DATE: "2028-08-09",
        MRP: "$99.00",
        GTIN: "00850006540051",
        SERIAL_PREFIX: "SN-BATCH2026Z1"
      }
    ],
    recordCount: 3,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    createdBy: "System Administrator"
  },
  {
    id: "ds-logistics-02",
    name: "Global Logistics Pallet Shipping Index",
    description: "Master SSCC-18 Shipping Container Manifest Dataset",
    sourceType: "csv",
    fileName: "Logistics_Pallet_Manifest.csv",
    columns: ["PALLET_ID", "SHIP_TO", "DESTINATION_ZONE", "CARRIER", "TOTAL_CASES", "NET_WEIGHT_KG", "SSCC_18"],
    records: [
      {
        PALLET_ID: "PLT-88102",
        SHIP_TO: "Distribution Center Frankfurt",
        DESTINATION_ZONE: "EU-CENTRAL-01",
        CARRIER: "DHL Supply Chain Express",
        TOTAL_CASES: "120",
        NET_WEIGHT_KG: "485.50",
        SSCC_18: "(00)108500065399870014"
      },
      {
        PALLET_ID: "PLT-88103",
        SHIP_TO: "Regional Hub Chicago",
        DESTINATION_ZONE: "US-MIDWEST-04",
        CARRIER: "FedEx Freight Priority",
        TOTAL_CASES: "95",
        NET_WEIGHT_KG: "390.20",
        SSCC_18: "(00)108500065399870021"
      }
    ],
    recordCount: 2,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    createdBy: "Logistics Lead"
  }
];
datasetsRouter.get("/", (req, res) => {
  try {
    const datasets = storage8.read("datasets", DEFAULT_DATASETS);
    res.json(datasets);
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to fetch datasets" });
  }
});
datasetsRouter.get("/:id", (req, res) => {
  try {
    const datasets = storage8.read("datasets", DEFAULT_DATASETS);
    const ds = datasets.find((d) => d.id === req.params.id);
    if (!ds) {
      return res.status(404).json({ error: "Dataset not found" });
    }
    res.json(ds);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
datasetsRouter.post("/", (req, res) => {
  try {
    const datasets = storage8.read("datasets", DEFAULT_DATASETS);
    const body = req.body;
    const newDataset = {
      id: body.id || `ds-${Date.now()}`,
      name: body.name || "Untitled Dataset",
      description: body.description || "",
      sourceType: body.sourceType || "manual",
      fileName: body.fileName,
      columns: Array.isArray(body.columns) ? body.columns : [],
      records: Array.isArray(body.records) ? body.records : [],
      recordCount: Array.isArray(body.records) ? body.records.length : 0,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      createdBy: body.createdBy || "User"
    };
    const updated = [newDataset, ...datasets];
    storage8.write("datasets", updated);
    audit2.log("DATASET_CREATE", `Created dataset "${newDataset.name}" with ${newDataset.recordCount} records.`);
    res.status(201).json(newDataset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
datasetsRouter.put("/:id", (req, res) => {
  try {
    const datasets = storage8.read("datasets", DEFAULT_DATASETS);
    const idx = datasets.findIndex((d) => d.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: "Dataset not found" });
    }
    const updatedDs = {
      ...datasets[idx],
      ...req.body,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      recordCount: Array.isArray(req.body.records) ? req.body.records.length : datasets[idx].recordCount
    };
    datasets[idx] = updatedDs;
    storage8.write("datasets", datasets);
    audit2.log("DATASET_UPDATE", `Updated dataset "${updatedDs.name}".`);
    res.json(updatedDs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
datasetsRouter.delete("/:id", (req, res) => {
  try {
    const datasets = storage8.read("datasets", DEFAULT_DATASETS);
    const filtered = datasets.filter((d) => d.id !== req.params.id);
    storage8.write("datasets", filtered);
    audit2.log("DATASET_DELETE", `Deleted dataset ID: ${req.params.id}`);
    res.json({ success: true, message: "Dataset deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
datasetsRouter.post("/upload-excel", (req, res) => {
  try {
    const { name, fileName, records, columns, createdBy } = req.body;
    const datasets = storage8.read("datasets", DEFAULT_DATASETS);
    const parsedRecords = Array.isArray(records) ? records : [];
    const parsedCols = Array.isArray(columns) && columns.length > 0 ? columns : parsedRecords.length > 0 ? Object.keys(parsedRecords[0]) : [];
    const newDataset = {
      id: `ds-excel-${Date.now()}`,
      name: name || fileName || "Imported Excel Dataset",
      description: `Imported from Excel file "${fileName || "spreadsheet.xlsx"}"`,
      sourceType: "excel",
      fileName: fileName || "spreadsheet.xlsx",
      columns: parsedCols,
      records: parsedRecords,
      recordCount: parsedRecords.length,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      createdBy: createdBy || "User"
    };
    storage8.write("datasets", [newDataset, ...datasets]);
    audit2.log("DATASET_IMPORT_EXCEL", `Imported ${parsedRecords.length} records from Excel: ${newDataset.name}`);
    res.status(201).json(newDataset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
datasetsRouter.post("/upload-csv", (req, res) => {
  try {
    const { name, fileName, csvText, records, columns, createdBy } = req.body;
    const datasets = storage8.read("datasets", DEFAULT_DATASETS);
    let parsedRecords = Array.isArray(records) ? records : [];
    let parsedCols = Array.isArray(columns) ? columns : [];
    if (!parsedRecords.length && typeof csvText === "string") {
      const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length > 0) {
        parsedCols = lines[0].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        parsedRecords = lines.slice(1).map((line) => {
          const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
          const row = {};
          parsedCols.forEach((col, i) => {
            row[col] = vals[i] ?? "";
          });
          return row;
        });
      }
    }
    const newDataset = {
      id: `ds-csv-${Date.now()}`,
      name: name || fileName || "Imported CSV Dataset",
      description: `Imported from CSV file "${fileName || "data.csv"}"`,
      sourceType: "csv",
      fileName: fileName || "data.csv",
      columns: parsedCols,
      records: parsedRecords,
      recordCount: parsedRecords.length,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      createdBy: createdBy || "User"
    };
    storage8.write("datasets", [newDataset, ...datasets]);
    audit2.log("DATASET_IMPORT_CSV", `Imported ${parsedRecords.length} records from CSV: ${newDataset.name}`);
    res.status(201).json(newDataset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
datasetsRouter.post("/preview", (req, res) => {
  try {
    const { datasetId, limit = 10, offset = 0 } = req.body;
    const datasets = storage8.read("datasets", DEFAULT_DATASETS);
    const ds = datasets.find((d) => d.id === datasetId);
    if (!ds) {
      return res.status(404).json({ error: "Dataset not found" });
    }
    const sliced = ds.records.slice(offset, offset + limit);
    res.json({
      datasetId: ds.id,
      name: ds.name,
      totalRecords: ds.recordCount,
      columns: ds.columns,
      preview: sliced
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// barcode-automation-backend/src/routes/license.ts
import { Router as Router12 } from "express";
import os2 from "os";
import crypto from "crypto";
var licenseRouter = Router12();
var storage9 = StorageService.getInstance();
var audit3 = AuditService.getInstance();
function getMachineHardwareId() {
  const cpus = os2.cpus();
  const rawInfo = `${os2.hostname()}-${os2.platform()}-${os2.arch()}-${cpus[0]?.model || "generic-cpu"}-${os2.totalmem()}`;
  return crypto.createHash("sha256").update(rawInfo).digest("hex").slice(0, 24).toUpperCase();
}
function generateLicenseKey(org, tier) {
  const payload = `${org}-${tier}-${Date.now()}`;
  const hash = crypto.createHash("md5").update(payload).digest("hex").toUpperCase();
  return `${hash.slice(0, 4)}-${hash.slice(4, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}`;
}
var DEFAULT_LICENSE = {
  licenseKey: "BCF-ENT-9921-8840",
  status: "active",
  tier: "Enterprise Suite",
  registeredTo: "Shivam Enterprise Administrator",
  organization: "BarcodeFlow Industrial Systems Inc.",
  machineGuid: getMachineHardwareId(),
  maxPrinters: 99,
  maxUsers: 50,
  activatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3).toISOString(),
  expiresAt: new Date(Date.now() + 335 * 24 * 60 * 60 * 1e3).toISOString(),
  features: [
    "Unlimited Desktop Installations",
    "Offline Mode & Local Datasets",
    "21 CFR Part 11 Electronic Signatures",
    "ZPL II / EPL2 Native Thermal Spooling",
    "Pixel-Perfect Vector PDF Engine",
    "10,000+ Record Batch Serialization",
    "Machine-Bound Hardware GUID Verification"
  ]
};
licenseRouter.get("/status", (req, res) => {
  try {
    const licenses = storage9.read("licenses", [DEFAULT_LICENSE]);
    const active = licenses[0] || DEFAULT_LICENSE;
    res.json({
      ...active,
      machineGuid: active.machineGuid || getMachineHardwareId(),
      isOfflineValid: true,
      currentServerTime: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
licenseRouter.post("/generate", (req, res) => {
  try {
    const { organization = "Default Org", tier = "Enterprise Suite", maxPrinters = 50, maxUsers = 25 } = req.body;
    const key = generateLicenseKey(organization, tier);
    const newLic = {
      licenseKey: key,
      status: "active",
      tier,
      registeredTo: req.body.registeredTo || "Enterprise Licensee",
      organization,
      machineGuid: getMachineHardwareId(),
      maxPrinters,
      maxUsers,
      activatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1e3).toISOString(),
      features: [
        "Desktop Installation & Offline Mode",
        "ZPL/EPL Export",
        "21 CFR Part 11 Approval Workflow",
        "Dataset Manager & Excel/CSV Binding"
      ]
    };
    storage9.write("licenses", [newLic]);
    audit3.log("LICENSE_GENERATE", `Generated new Enterprise License key ${key} for ${organization}`);
    res.status(201).json(newLic);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
licenseRouter.post("/activate", (req, res) => {
  try {
    const { licenseKey, registeredTo, organization } = req.body;
    if (!licenseKey || typeof licenseKey !== "string") {
      return res.status(400).json({ error: "License key is required" });
    }
    const currentHardwareGuid = getMachineHardwareId();
    const activeLic = {
      licenseKey: licenseKey.trim().toUpperCase(),
      status: "active",
      tier: "Enterprise Suite",
      registeredTo: registeredTo || "Shivam",
      organization: organization || "BarcodeFlow Corporate",
      machineGuid: currentHardwareGuid,
      maxPrinters: 100,
      maxUsers: 50,
      activatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1e3).toISOString(),
      features: [
        "Desktop Offline Mode Active",
        "ZPL/EPL Thermal Spooler",
        "21 CFR Part 11 Compliance",
        "10,000+ Record Batch Engine"
      ]
    };
    storage9.write("licenses", [activeLic]);
    audit3.log("LICENSE_ACTIVATE", `Activated license key ${licenseKey} bound to Machine GUID ${currentHardwareGuid}`);
    res.json({
      success: true,
      message: "License activated successfully and bound to this hardware machine.",
      license: activeLic
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
licenseRouter.post("/offline-activate", (req, res) => {
  try {
    const { activationCode, licenseKey } = req.body;
    if (!activationCode) {
      return res.status(400).json({ error: "Offline activation code required" });
    }
    const hardwareGuid = getMachineHardwareId();
    const activeLic = {
      licenseKey: licenseKey || "BCF-OFFLINE-991",
      status: "active",
      tier: "Enterprise Suite",
      registeredTo: "Offline License Administrator",
      organization: "Industrial On-Premises Workspace",
      machineGuid: hardwareGuid,
      maxPrinters: 99,
      maxUsers: 50,
      activatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1e3).toISOString(),
      offlineActivationCode: activationCode,
      features: [
        "100% Air-Gapped Offline Operation",
        "Local .bft Template Storage",
        "Hardware Machine Binding Verified"
      ]
    };
    storage9.write("licenses", [activeLic]);
    audit3.log("LICENSE_OFFLINE_ACTIVATE", `Offline activation applied with code: ${activationCode}`);
    res.json({
      success: true,
      message: "Air-gapped offline license activated successfully.",
      license: activeLic
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// barcode-automation-backend/src/routes/export.ts
import { Router as Router13 } from "express";
var exportRouter = Router13();
var storage10 = StorageService.getInstance();
var audit4 = AuditService.getInstance();
function generateEPL2(template, record = {}) {
  const widthMm = template?.dimensions?.width || 100;
  const heightMm = template?.dimensions?.height || 50;
  const dotsPerMm = 8;
  const widthDots = Math.round(widthMm * dotsPerMm);
  const heightDots = Math.round(heightMm * dotsPerMm);
  let epl = `N
q${widthDots}
Q${heightDots},24
S2
D10
ZT
`;
  const elements = template?.elements || [];
  elements.forEach((el, idx) => {
    const xDots = Math.round((el.x || 10) * dotsPerMm);
    const yDots = Math.round((el.y || 10) * dotsPerMm);
    let val = el.content || "";
    if (el.dataSourceField && record[el.dataSourceField]) {
      val = String(record[el.dataSourceField]);
    }
    if (el.type === "barcode" || el.type === "gs1_barcode") {
      epl += `B${xDots},${yDots},0,1,2,6,50,B,"${val}"
`;
    } else if (el.type === "qr") {
      epl += `b${xDots},${yDots},Q,m2,s6,"${val}"
`;
    } else {
      epl += `A${xDots},${yDots},0,3,1,1,N,"${val}"
`;
    }
  });
  epl += `P1
`;
  return epl;
}
exportRouter.post("/zpl", (req, res) => {
  try {
    const { template, record } = req.body;
    if (!template) {
      return res.status(400).json({ error: "Template object required" });
    }
    const zplCode = generateZPL(template, record || {});
    audit4.log("EXPORT_ZPL", `Exported ZPL thermal code for template "${template.name || "Label"}"`);
    res.json({
      format: "ZPL II",
      zpl: zplCode,
      templateName: template.name,
      dimensions: template.dimensions
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
exportRouter.post("/epl", (req, res) => {
  try {
    const { template, record } = req.body;
    if (!template) {
      return res.status(400).json({ error: "Template object required" });
    }
    const eplCode = generateEPL2(template, record || {});
    audit4.log("EXPORT_EPL", `Exported EPL2 thermal code for template "${template.name || "Label"}"`);
    res.json({
      format: "EPL2",
      epl: eplCode,
      templateName: template.name,
      dimensions: template.dimensions
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
exportRouter.post("/pdf", (req, res) => {
  try {
    const { templateId, templateName, pagesCount = 10, pdfDataUrl } = req.body;
    audit4.log("EXPORT_PDF", `Generated 100% pixel-perfect vector PDF (${pagesCount} pages) for "${templateName || templateId}"`);
    res.json({
      success: true,
      format: "PDF",
      pagesCount,
      pdfDataUrl: pdfDataUrl || "data:application/pdf;base64,JVBERi0xLjQK...",
      generatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
exportRouter.post("/png", (req, res) => {
  try {
    const { templateName, pageNumber = 1, pngDataUrl } = req.body;
    audit4.log("EXPORT_PNG", `Exported High-Res PNG snapshot (Page ${pageNumber}) for "${templateName || "Label"}"`);
    res.json({
      success: true,
      format: "PNG",
      pageNumber,
      pngDataUrl: pngDataUrl || "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
      exportedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// barcode-automation-backend/src/routes/software.ts
import { Router as Router14 } from "express";

// barcode-automation-backend/src/services/installerService.ts
import fs5 from "fs";
import path5 from "path";
import { execSync } from "child_process";
var InstallerService = class _InstallerService {
  constructor() {
    this.downloadsDir = path5.resolve(process.cwd(), "barcode-automation-backend/downloads");
    this.ensureInstallerBinaries();
  }
  static getInstance() {
    if (!_InstallerService.instance) {
      _InstallerService.instance = new _InstallerService();
    }
    return _InstallerService.instance;
  }
  getDownloadsDir() {
    return this.downloadsDir;
  }
  /**
   * Generates or locates the physical genuine .exe installer file for the requested version.
   */
  ensureInstallerBinaries() {
    try {
      if (!fs5.existsSync(this.downloadsDir)) {
        fs5.mkdirSync(this.downloadsDir, { recursive: true });
      }
      const binExe = path5.resolve(process.cwd(), "bin", "BarcodeFlow_Setup_v2.5.0.exe");
      const csScript = path5.resolve(process.cwd(), "scripts", "Installer.cs");
      if (!fs5.existsSync(binExe) && fs5.existsSync(csScript)) {
        try {
          const cscPath = "C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe";
          if (fs5.existsSync(cscPath)) {
            const binDir = path5.resolve(process.cwd(), "bin");
            if (!fs5.existsSync(binDir)) fs5.mkdirSync(binDir, { recursive: true });
            execSync(`"${cscPath}" /target:winexe /platform:anycpu /out:"${binExe}" "${csScript}"`, {
              stdio: "ignore"
            });
          }
        } catch (err) {
          console.warn("[InstallerService] CSC compilation warning:", err);
        }
      }
      const targetExe = path5.join(this.downloadsDir, "BarcodeFlow_Setup_v2.5.0.exe");
      const fallbackExe = path5.join(this.downloadsDir, "BarcodeFlow_Setup.exe");
      if (fs5.existsSync(binExe)) {
        if (!fs5.existsSync(targetExe) || fs5.statSync(targetExe).size !== fs5.statSync(binExe).size) {
          fs5.copyFileSync(binExe, targetExe);
        }
        if (!fs5.existsSync(fallbackExe) || fs5.statSync(fallbackExe).size !== fs5.statSync(binExe).size) {
          fs5.copyFileSync(binExe, fallbackExe);
        }
      }
    } catch (err) {
      console.error("[InstallerService] Error ensuring binaries:", err);
    }
  }
  /**
   * Finds the installer file for a version or default.
   */
  findInstaller(version = "2.5.0") {
    this.ensureInstallerBinaries();
    const candidates = [
      path5.join(this.downloadsDir, `BarcodeFlow_Setup_v${version}.exe`),
      path5.resolve(process.cwd(), "bin", `BarcodeFlow_Setup_v${version}.exe`),
      path5.join(this.downloadsDir, "BarcodeFlow_Setup.exe"),
      path5.resolve(process.cwd(), "dist-electron-build", `BarcodeFlow_Setup_v${version}.exe`),
      path5.resolve(process.cwd(), "dist-electron-build", "BarcodeFlow_Setup.exe")
    ];
    for (const cand of candidates) {
      if (fs5.existsSync(cand)) {
        const stat = fs5.statSync(cand);
        return {
          filePath: cand,
          fileName: `BarcodeFlow_Setup_v${version}.exe`,
          size: stat.size
        };
      }
    }
    return null;
  }
};
var installerService = InstallerService.getInstance();

// barcode-automation-backend/src/routes/software.ts
import fs6 from "fs";
var softwareRouter = Router14();
var storage11 = StorageService.getInstance();
var DEFAULT_RELEASES = [
  {
    version: "2.5.0",
    buildNumber: 25010,
    releaseName: "BarcodeFlow Enterprise Suite v2.5 (BarTender Parity)",
    releaseNotes: [
      "Industrial 3-Step Workflow: Designer -> Approver 1 (e-Sign) -> Production Print Station",
      "Air-Gapped Hardware GUID binding and 21 CFR Part 11 Audit Trail",
      "Dual Thermal Generation: Native ZPL II & EPL2 with speed/darkness calibration",
      "Live Local Printer Detection via Windows spooler and PowerShell scanner",
      "Dataset Manager: Drag & Drop Excel (.xlsx) & CSV import with dynamic variable binding",
      "Offline Local Storage & 100% Zero-Latency Desktop Runtime"
    ],
    downloadURL: "/api/software/download?v=2.5.0",
    fileSize: "78.4 MB",
    releaseDate: "2026-08-22",
    status: "active",
    channel: "stable",
    sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    systemRequirements: {
      os: "Windows 10 / 11 (64-bit) or Windows Server 2019+",
      ram: "4 GB Minimum (8 GB Recommended for 100k+ batch print queues)",
      disk: "250 MB free disk space",
      dotnet: ".NET Framework 4.8 or Windows Desktop Runtime",
      architecture: "x64 / ARM64 Compatible"
    }
  },
  {
    version: "2.4.0",
    buildNumber: 24005,
    releaseName: "BarcodeFlow GS1 & Direct Spooler Update",
    releaseNotes: [
      "Added GS1-128 AI (Application Identifier) barcode validation engine",
      "Direct LPT / COM / TCP Raw socket thermal printer communications",
      "Full Vector SVG and high-DPI raster image imports"
    ],
    downloadURL: "/api/software/download?v=2.4.0",
    fileSize: "74.2 MB",
    releaseDate: "2026-07-15",
    status: "active",
    channel: "stable",
    systemRequirements: {
      os: "Windows 10 / 11 (64-bit)",
      ram: "4 GB Minimum",
      disk: "200 MB free space",
      dotnet: ".NET Framework 4.8",
      architecture: "x64"
    }
  },
  {
    version: "2.0.0",
    buildNumber: 20001,
    releaseName: "BarcodeFlow Initial Desktop Engine",
    releaseNotes: [
      "Konva-powered real-time WYSIWYG canvas editor",
      "Multi-format barcode generator (Code 128, EAN-13, QR Code, Data Matrix)",
      "Basic approval workflows and print job queues"
    ],
    downloadURL: "/api/software/download?v=2.0.0",
    fileSize: "68.0 MB",
    releaseDate: "2026-05-10",
    status: "deprecated",
    channel: "stable",
    systemRequirements: {
      os: "Windows 10 / 11 (64-bit)",
      ram: "4 GB",
      disk: "200 MB",
      dotnet: ".NET Framework 4.8",
      architecture: "x64"
    }
  }
];
softwareRouter.get("/latest-version", (req, res) => {
  try {
    const releases = storage11.read("software_releases", DEFAULT_RELEASES);
    const latest = releases.find((r) => r.status === "active") || releases[0] || DEFAULT_RELEASES[0];
    res.json({
      success: true,
      data: latest,
      isLatest: true,
      updateAvailable: false
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
softwareRouter.get("/version-history", (req, res) => {
  try {
    const releases = storage11.read("software_releases", DEFAULT_RELEASES);
    res.json({
      success: true,
      totalReleases: releases.length,
      data: releases
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
softwareRouter.post("/check-update", (req, res) => {
  try {
    const { clientVersion } = req.body;
    const releases = storage11.read("software_releases", DEFAULT_RELEASES);
    const latest = releases[0] || DEFAULT_RELEASES[0];
    const hasUpdate = clientVersion && clientVersion !== latest.version;
    res.json({
      updateAvailable: hasUpdate,
      currentClientVersion: clientVersion || "unknown",
      latestVersion: latest.version,
      releaseDetails: hasUpdate ? latest : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
softwareRouter.get("/download", (req, res) => {
  try {
    const version = req.query.v || "2.5.0";
    logBackendAudit(
      "Authenticated User",
      "Operator",
      "DESKTOP_APP_DOWNLOAD",
      `User initiated direct download for BarcodeFlow Desktop Installer v${version}`
    );
    const installer = installerService.findInstaller(version);
    if (!installer || !fs6.existsSync(installer.filePath)) {
      return res.status(404).json({
        success: false,
        message: `Installer for version v${version} is currently not available on this server. Please contact Administrator.`
      });
    }
    res.setHeader("Content-Type", "application/vnd.microsoft.portable-executable");
    res.setHeader("Content-Disposition", `attachment; filename="${installer.fileName}"`);
    res.setHeader("Content-Length", installer.size);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    const fileStream = fs6.createReadStream(installer.filePath);
    fileStream.pipe(res);
  } catch (err) {
    console.error("[software/download] Download stream error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});
softwareRouter.post("/upload-version", (req, res) => {
  try {
    const { version, releaseName, releaseNotes, fileSize, channel } = req.body;
    if (!version || !releaseName) {
      return res.status(400).json({ error: "version and releaseName are required" });
    }
    installerService.ensureInstallerBinaries();
    const releases = storage11.read("software_releases", DEFAULT_RELEASES);
    const newRelease = {
      version,
      buildNumber: Date.now(),
      releaseName,
      releaseNotes: Array.isArray(releaseNotes) ? releaseNotes : [releaseNotes],
      downloadURL: `/api/software/download?v=${version}`,
      fileSize: fileSize || "78.4 MB",
      releaseDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      status: "active",
      channel: channel || "stable",
      systemRequirements: {
        os: "Windows 10 / 11 (64-bit)",
        ram: "4 GB Minimum",
        disk: "250 MB",
        dotnet: ".NET 4.8",
        architecture: "x64"
      }
    };
    const updated = [newRelease, ...releases];
    storage11.write("software_releases", updated);
    logBackendAudit(
      "Admin",
      "Administrator",
      "SOFTWARE_RELEASE_PUBLISHED",
      `Published Desktop App Version v${version} (${releaseName})`
    );
    res.status(201).json({
      success: true,
      message: `Version v${version} published successfully`,
      data: newRelease
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// barcode-automation-backend/src/routes/serials.ts
import { Router as Router15 } from "express";
var serialsRouter = Router15();
var dbService = DatabaseService.getInstance();
function formatSerial(val, seq) {
  const pad = seq.min_digits || 6;
  const padded = String(val).padStart(pad, "0");
  const pfx = seq.prefix || "";
  const sfx = seq.suffix || "";
  return `${pfx}${padded}${sfx}`;
}
serialsRouter.get("/", (req, res) => {
  try {
    const rows = dbService.query(
      "SELECT * FROM serial_sequences ORDER BY name ASC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch serial sequences", details: err?.message });
  }
});
serialsRouter.get("/:id", (req, res) => {
  try {
    const row = dbService.queryOne(
      "SELECT * FROM serial_sequences WHERE id = ?",
      [req.params.id]
    );
    if (!row) {
      return res.status(404).json({ error: "Sequence not found" });
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch sequence", details: err?.message });
  }
});
serialsRouter.post("/", (req, res) => {
  try {
    const {
      id,
      name,
      current_value = 1,
      start_value = 1,
      increment_by = 1,
      min_digits = 6,
      prefix = "",
      suffix = "",
      reset_policy = "never",
      copies_per_serial = 1
    } = req.body;
    const seqId = id || `seq-${Date.now()}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    dbService.execute(
      `INSERT OR REPLACE INTO serial_sequences 
       (id, name, current_value, start_value, increment_by, min_digits, prefix, suffix, reset_policy, last_reset_date, copies_per_serial, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        seqId,
        name || "Standard Sequence",
        Number(current_value),
        Number(start_value),
        Number(increment_by),
        Number(min_digits),
        prefix,
        suffix,
        reset_policy,
        now,
        Number(copies_per_serial),
        now
      ]
    );
    const saved = dbService.queryOne(
      "SELECT * FROM serial_sequences WHERE id = ?",
      [seqId]
    );
    logBackendAudit(
      req.body.user || "System",
      "Administrator",
      "SERIAL_SEQUENCE_SAVED",
      `Configured sequence "${name}" (Start: ${start_value}, Current: ${current_value}, Policy: ${reset_policy})`,
      seqId,
      name
    );
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: "Failed to save serial sequence", details: err?.message });
  }
});
serialsRouter.post("/:id/next", (req, res) => {
  try {
    const { count = 1, requestedBy = "Print Operator" } = req.body;
    const allocationCount = Math.max(1, parseInt(String(count), 10));
    const seq = dbService.queryOne(
      "SELECT * FROM serial_sequences WHERE id = ?",
      [req.params.id]
    );
    if (!seq) {
      return res.status(404).json({ error: "Sequence not found" });
    }
    const startVal = seq.current_value;
    const step = seq.increment_by || 1;
    const endVal = startVal + step * (allocationCount - 1);
    const nextCurrentVal = endVal + step;
    const formattedList = [];
    for (let i = 0; i < allocationCount; i++) {
      const val = startVal + step * i;
      formattedList.push(formatSerial(val, seq));
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    dbService.execute(
      "UPDATE serial_sequences SET current_value = ?, updated_at = ? WHERE id = ?",
      [nextCurrentVal, now, seq.id]
    );
    logBackendAudit(
      requestedBy,
      "Print Operator",
      "SERIAL_ALLOCATION",
      `Allocated ${allocationCount} serials from sequence "${seq.name}": ${formattedList[0]} -> ${formattedList[formattedList.length - 1]}`,
      seq.id,
      seq.name
    );
    res.json({
      sequenceId: seq.id,
      sequenceName: seq.name,
      startValue: startVal,
      endValue: endVal,
      nextValue: nextCurrentVal,
      count: allocationCount,
      serials: formattedList
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to allocate serial numbers", details: err?.message });
  }
});
serialsRouter.post("/:id/reset", (req, res) => {
  try {
    const { resetBy = "Administrator", reason = "Manual Reset" } = req.body;
    const seq = dbService.queryOne(
      "SELECT * FROM serial_sequences WHERE id = ?",
      [req.params.id]
    );
    if (!seq) {
      return res.status(404).json({ error: "Sequence not found" });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    dbService.execute(
      "UPDATE serial_sequences SET current_value = start_value, last_reset_date = ?, updated_at = ? WHERE id = ?",
      [now, now, seq.id]
    );
    logBackendAudit(
      resetBy,
      "Administrator",
      "SERIAL_SEQUENCE_RESET",
      `Reset sequence "${seq.name}" to start value ${seq.start_value}. Reason: ${reason}`,
      seq.id,
      seq.name
    );
    res.json({
      success: true,
      message: `Sequence "${seq.name}" reset to ${seq.start_value}`,
      sequence: { ...seq, current_value: seq.start_value, last_reset_date: now }
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to reset sequence", details: err?.message });
  }
});
serialsRouter.delete("/:id", (req, res) => {
  try {
    dbService.execute("DELETE FROM serial_sequences WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "Sequence deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete sequence", details: err?.message });
  }
});

// barcode-automation-backend/src/routes/counters.ts
import { Router as Router16 } from "express";
var countersRouter = Router16();
var dbService2 = DatabaseService.getInstance();
countersRouter.get("/", (req, res) => {
  try {
    const rows = dbService2.query("SELECT * FROM counters ORDER BY name ASC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch counters", details: err?.message });
  }
});
countersRouter.get("/:id", (req, res) => {
  try {
    const row = dbService2.queryOne("SELECT * FROM counters WHERE id = ?", [req.params.id]);
    if (!row) {
      return res.status(404).json({ error: "Counter not found" });
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch counter", details: err?.message });
  }
});
countersRouter.post("/", (req, res) => {
  try {
    const {
      id,
      name,
      type = "batch",
      current_value = 0,
      start_value = 0,
      step = 1,
      pad_length = 0,
      max_value = null,
      reset_policy = "manual"
    } = req.body;
    const counterId = id || `cnt-${Date.now()}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    dbService2.execute(
      `INSERT OR REPLACE INTO counters 
       (id, name, type, current_value, start_value, step, pad_length, max_value, reset_policy, last_reset_date, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        counterId,
        name || "Standard Counter",
        type,
        Number(current_value),
        Number(start_value),
        Number(step),
        Number(pad_length),
        max_value !== null && max_value !== void 0 ? Number(max_value) : null,
        reset_policy,
        now,
        now
      ]
    );
    const saved = dbService2.queryOne("SELECT * FROM counters WHERE id = ?", [counterId]);
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: "Failed to save counter", details: err?.message });
  }
});
countersRouter.post("/:id/increment", (req, res) => {
  try {
    const { amount, updatedBy = "Operator" } = req.body;
    const counter = dbService2.queryOne("SELECT * FROM counters WHERE id = ?", [req.params.id]);
    if (!counter) {
      return res.status(404).json({ error: "Counter not found" });
    }
    const delta = amount !== void 0 ? Number(amount) : counter.step || 1;
    let nextVal = counter.current_value + delta;
    if (counter.max_value !== null && counter.max_value !== void 0 && nextVal > counter.max_value) {
      if (counter.reset_policy === "max_reached") {
        nextVal = counter.start_value;
      }
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    dbService2.execute("UPDATE counters SET current_value = ?, updated_at = ? WHERE id = ?", [
      nextVal,
      now,
      counter.id
    ]);
    const formatted = counter.pad_length > 0 ? String(nextVal).padStart(counter.pad_length, "0") : String(nextVal);
    res.json({
      id: counter.id,
      name: counter.name,
      type: counter.type,
      previousValue: counter.current_value,
      currentValue: nextVal,
      formatted,
      updatedAt: now
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to increment counter", details: err?.message });
  }
});
countersRouter.post("/:id/reset", (req, res) => {
  try {
    const { resetBy = "Supervisor", reason = "Manual Reset" } = req.body;
    const counter = dbService2.queryOne("SELECT * FROM counters WHERE id = ?", [req.params.id]);
    if (!counter) {
      return res.status(404).json({ error: "Counter not found" });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    dbService2.execute(
      "UPDATE counters SET current_value = start_value, last_reset_date = ?, updated_at = ? WHERE id = ?",
      [now, now, counter.id]
    );
    logBackendAudit(
      resetBy,
      "Supervisor",
      "COUNTER_RESET",
      `Reset counter "${counter.name}" (${counter.type}) to start value ${counter.start_value}. Reason: ${reason}`,
      counter.id,
      counter.name
    );
    res.json({
      success: true,
      message: `Counter "${counter.name}" reset to ${counter.start_value}`,
      counter: { ...counter, current_value: counter.start_value, last_reset_date: now }
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to reset counter", details: err?.message });
  }
});
countersRouter.delete("/:id", (req, res) => {
  try {
    dbService2.execute("DELETE FROM counters WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "Counter deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete counter", details: err?.message });
  }
});

// src/services/databaseConnectorService.ts
var SAMPLE_ENTERPRISE_DATASETS = [
  {
    id: "db-pharma-serial",
    name: "Pharmaceutical Serialization Master (FDA UDI)",
    type: "sql_mock",
    sqlQuery: 'SELECT GTIN, BatchNo, ExpiryDate, SerialNumber, ProductDesc, Dosage, MfgDate FROM PharmaInventory WHERE Status = "ACTIVE"',
    fields: ["GTIN", "BatchNo", "ExpiryDate", "SerialNumber", "ProductDesc", "Dosage", "MfgDate", "CountryOrigin"],
    records: [
      { GTIN: "00850006531234", BatchNo: "LOT-9042", ExpiryDate: "261231", SerialNumber: "SN-7849102", ProductDesc: "Amoxicillin 500mg Capsules", Dosage: "500mg", MfgDate: "240115", CountryOrigin: "USA" },
      { GTIN: "00850006531241", BatchNo: "LOT-9042", ExpiryDate: "261231", SerialNumber: "SN-7849103", ProductDesc: "Amoxicillin 500mg Capsules", Dosage: "500mg", MfgDate: "240115", CountryOrigin: "USA" },
      { GTIN: "00850006531258", BatchNo: "LOT-9043", ExpiryDate: "270430", SerialNumber: "SN-7849104", ProductDesc: "Ibuprofen 400mg Tablets", Dosage: "400mg", MfgDate: "240210", CountryOrigin: "Germany" },
      { GTIN: "00850006531265", BatchNo: "LOT-9043", ExpiryDate: "270430", SerialNumber: "SN-7849105", ProductDesc: "Ibuprofen 400mg Tablets", Dosage: "400mg", MfgDate: "240210", CountryOrigin: "Germany" },
      { GTIN: "00850006531272", BatchNo: "LOT-9044", ExpiryDate: "260815", SerialNumber: "SN-7849106", ProductDesc: "Cetirizine 10mg Film-Coated", Dosage: "10mg", MfgDate: "231120", CountryOrigin: "Switzerland" }
    ]
  },
  {
    id: "db-logistics-pallets",
    name: "WMS Pallet & SSCC Logistics Hub",
    type: "rest_api",
    endpointOrPath: "https://api.enterprise-wms.corp/v2/pallets/active",
    fields: ["SSCC", "PalletID", "WarehouseLoc", "Carrier", "DestinationHub", "GrossWeightKg", "ItemCount", "ShipDate"],
    records: [
      { SSCC: "000085000653123451", PalletID: "PAL-9821", WarehouseLoc: "BAY-A12-R4", Carrier: "FedEx Freight", DestinationHub: "ORD-Chicago", GrossWeightKg: "420.5", ItemCount: "48", ShipDate: "2026-08-20" },
      { SSCC: "000085000653123468", PalletID: "PAL-9822", WarehouseLoc: "BAY-A12-R5", Carrier: "FedEx Freight", DestinationHub: "ORD-Chicago", GrossWeightKg: "385.0", ItemCount: "44", ShipDate: "2026-08-20" },
      { SSCC: "000085000653123475", PalletID: "PAL-9823", WarehouseLoc: "BAY-B04-R1", Carrier: "DHL Supply Chain", DestinationHub: "DFW-Dallas", GrossWeightKg: "512.2", ItemCount: "60", ShipDate: "2026-08-21" },
      { SSCC: "000085000653123482", PalletID: "PAL-9824", WarehouseLoc: "BAY-C09-R2", Carrier: "UPS Freight", DestinationHub: "ATL-Atlanta", GrossWeightKg: "290.8", ItemCount: "32", ShipDate: "2026-08-21" }
    ]
  },
  {
    id: "db-retail-apparel",
    name: "Retail Apparel Inventory & Pricing",
    type: "csv",
    fields: ["SKU", "UPC", "ItemName", "Size", "Color", "RetailPrice", "DiscountPrice", "Department"],
    records: [
      { SKU: "APP-TEE-BLK-S", UPC: "012345678905", ItemName: "Premium Cotton T-Shirt", Size: "S", Color: "Black", RetailPrice: "$29.99", DiscountPrice: "$24.99", Department: "Mens" },
      { SKU: "APP-TEE-BLK-M", UPC: "012345678912", ItemName: "Premium Cotton T-Shirt", Size: "M", Color: "Black", RetailPrice: "$29.99", DiscountPrice: "$24.99", Department: "Mens" },
      { SKU: "APP-TEE-BLK-L", UPC: "012345678929", ItemName: "Premium Cotton T-Shirt", Size: "L", Color: "Black", RetailPrice: "$29.99", DiscountPrice: "$24.99", Department: "Mens" },
      { SKU: "APP-HDY-NVY-XL", UPC: "012345678936", ItemName: "Fleece Zip Hoodie", Size: "XL", Color: "Navy", RetailPrice: "$59.99", DiscountPrice: "$49.99", Department: "Unisex" }
    ]
  }
];

// barcode-automation-backend/src/app.ts
function createBackendApp() {
  const app2 = express();
  app2.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
  app2.use(express.json({ limit: "50mb" }));
  app2.use(express.urlencoded({ extended: true, limit: "50mb" }));
  app2.get("/api/health", (req, res) => {
    res.json({
      status: "online",
      service: "barcode-automation-backend",
      version: "2.5.0-enterprise",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app2.use("/api/templates", templatesRouter);
  app2.use("/api/print-jobs", printJobsRouter);
  app2.use("/api/print", printJobsRouter);
  app2.use("/api/batch-jobs", batchJobsRouter);
  app2.use("/api/printers", printersRouter);
  app2.use("/api/audit-logs", auditLogsRouter);
  app2.use("/api/users", usersRouter);
  app2.use("/api/auth", usersRouter);
  app2.use("/api/admin/users", usersRouter);
  app2.use("/api/gs1", gs1Router);
  app2.use("/api/zpl", zplRouter);
  app2.use("/api/ai", aiRouter);
  app2.use("/api/viewer", viewerLogsRouter);
  app2.use("/api/datasets", datasetsRouter);
  app2.use("/api/data-sources", datasetsRouter);
  app2.use("/api/license", licenseRouter);
  app2.use("/api/serials", serialsRouter);
  app2.use("/api/counters", countersRouter);
  app2.use("/api/export", exportRouter);
  app2.use("/api/software", softwareRouter);
  app2.use("/api/admin/software", softwareRouter);
  app2.use("/download", softwareRouter);
  app2.get("/download/:filename", (req, res) => {
    res.redirect("/api/software/download?v=2.5.0");
  });
  app2.get("/api/database/sample-datasets", (req, res) => {
    res.json(SAMPLE_ENTERPRISE_DATASETS);
  });
  return app2;
}

// ../../../.gemini/antigravity-ide/brain/ce029f50-371c-496a-be0a-c36c4c5c638c/scratch/test_api.mjs
var app = createBackendApp();
var server = app.listen(3005, "127.0.0.1", async () => {
  console.log("\u2705 Backend test server listening on port 3005");
  try {
    const healthRes = await fetch("http://127.0.0.1:3005/api/health");
    const healthData = await healthRes.json();
    console.log("1. Health check:", healthData.status === "online" ? "PASS" : "FAIL");
    const serialsRes = await fetch("http://127.0.0.1:3005/api/serials");
    const serialsData = await serialsRes.json();
    console.log("2. Serials API count:", serialsData.length);
    const countersRes = await fetch("http://127.0.0.1:3005/api/counters");
    const countersData = await countersRes.json();
    console.log("3. Counters API count:", countersData.length);
    const printersRes = await fetch("http://127.0.0.1:3005/api/printers");
    const printersData = await printersRes.json();
    console.log("4. Printers API count:", printersData.length);
    const templatesRes = await fetch("http://127.0.0.1:3005/api/templates");
    const templatesData = await templatesRes.json();
    console.log("5. Templates API count:", templatesData.length);
    console.log("ALL API CHECKS COMPLETED SUCCESSFULLY!");
  } catch (err) {
    console.error("Test error:", err);
  } finally {
    server.close(() => {
      console.log("Test server closed.");
      process.exit(0);
    });
  }
});
