/**
 * 360Barcode Script Assistant Structured Registry
 * Comprehensive dictionary of BarTender-style scripting functions, control flows,
 * operators, constants, database fields, and template object bindings.
 */

export interface ScriptAssistantItem {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  description: string;
  syntax: string;
  parameters?: string;
  example: string;
  dbExample?: string;
  resultExample?: string;
  snippetVb: string;
  snippetJs: string;
  compatibility: 'both' | 'vbscript' | 'javascript';
}

export interface ScriptAssistantCategory {
  id: string;
  name: string;
  icon?: string;
  items: ScriptAssistantItem[];
  subcategories?: { name: string; items: ScriptAssistantItem[] }[];
}

export const BUILTIN_ASSISTANT_ITEMS: ScriptAssistantItem[] = [
  // -------------------------------------------------------------
  // 1. DATE & TIME FUNCTIONS
  // -------------------------------------------------------------
  {
    id: 'fn-dateadd',
    name: 'DateAdd',
    category: 'Functions',
    subcategory: 'Date & Time',
    description: 'Adds or subtracts a specified time interval (days, months, years) to/from a date.',
    syntax: 'DateAdd(interval, number, date)',
    parameters: 'interval: "d" (days), "m" (months), "yyyy" (years), "h" (hours), "n" (minutes), "s" (seconds)\nnumber: numeric offset to add (or negative to subtract)\ndate: base date expression or date string',
    example: 'DateAdd("d", 90, Date)',
    dbExample: 'DateAdd("d", Record("ExpiryDays"), Date)',
    resultExample: '18/12/2026 (when Date is 19/09/2026 and ExpiryDays=90)',
    snippetVb: 'DateAdd("d", 90, Date)',
    snippetJs: 'new Date(Date.now() + 90 * 86400000)',
    compatibility: 'both',
  },
  {
    id: 'fn-date',
    name: 'Date',
    category: 'Functions',
    subcategory: 'Date & Time',
    description: 'Returns the current system date as a formatted date string.',
    syntax: 'Date',
    parameters: 'None',
    example: 'Value = Date',
    dbExample: 'DateAdd("d", Record("ExpiryDays"), Date)',
    resultExample: '19/09/2026',
    snippetVb: 'Date',
    snippetJs: 'formatDate(new Date(), "DD/MM/YYYY")',
    compatibility: 'both',
  },
  {
    id: 'fn-now',
    name: 'Now',
    category: 'Functions',
    subcategory: 'Date & Time',
    description: 'Returns the current system date and time.',
    syntax: 'Now',
    parameters: 'None',
    example: 'Value = Now',
    dbExample: 'Value = "Printed: " & Now',
    resultExample: '19/09/2026 14:30:00',
    snippetVb: 'Now',
    snippetJs: 'new Date()',
    compatibility: 'both',
  },
  {
    id: 'fn-time',
    name: 'Time',
    category: 'Functions',
    subcategory: 'Date & Time',
    description: 'Returns the current system time.',
    syntax: 'Time',
    parameters: 'None',
    example: 'Value = Time',
    dbExample: 'Value = "Batch Time: " & Time',
    resultExample: '14:30:00',
    snippetVb: 'Time',
    snippetJs: 'formatDate(new Date(), "HH:mm:ss")',
    compatibility: 'both',
  },
  {
    id: 'fn-datediff',
    name: 'DateDiff',
    category: 'Functions',
    subcategory: 'Date & Time',
    description: 'Returns the number of time intervals between two specified dates.',
    syntax: 'DateDiff(interval, date1, date2)',
    parameters: 'interval: "d", "m", "yyyy", "h", "n", "s"\ndate1, date2: date expressions to compare',
    example: 'DateDiff("d", Date, Record("ExpiryDate"))',
    dbExample: 'If DateDiff("d", Date, Record("ExpiryDate")) < 0 Then Value = "EXPIRED"',
    resultExample: '45 (days remaining)',
    snippetVb: 'DateDiff("d", Date, Record("ExpiryDate"))',
    snippetJs: 'Math.floor((new Date(record.ExpiryDate) - new Date()) / 86400000)',
    compatibility: 'both',
  },
  {
    id: 'fn-datepart',
    name: 'DatePart',
    category: 'Functions',
    subcategory: 'Date & Time',
    description: 'Returns the specified part of a given date.',
    syntax: 'DatePart(interval, date)',
    parameters: 'interval: "yyyy", "m", "d", "ww" (week of year), "h", "n", "s"',
    example: 'DatePart("ww", Date)',
    dbExample: 'Value = "WK-" & DatePart("ww", Date)',
    resultExample: 'WK-38',
    snippetVb: 'DatePart("ww", Date)',
    snippetJs: 'formatDate(new Date(), "WW")',
    compatibility: 'both',
  },
  {
    id: 'fn-formatdatetime',
    name: 'FormatDateTime',
    category: 'Functions',
    subcategory: 'Date & Time',
    description: 'Formats a date or time expression according to standard named format codes.',
    syntax: 'FormatDateTime(date, [namedFormat])',
    parameters: 'namedFormat: 0=vbGeneralDate, 1=vbLongDate, 2=vbShortDate, 3=vbLongTime, 4=vbShortTime',
    example: 'FormatDateTime(Date, 2)',
    dbExample: 'FormatDateTime(DateAdd("d", Record("ExpiryDays"), Date), 2)',
    resultExample: '18/12/2026',
    snippetVb: 'FormatDateTime(Date, 2)',
    snippetJs: 'formatDate(new Date(), "DD/MM/YYYY")',
    compatibility: 'both',
  },
  {
    id: 'fn-year',
    name: 'Year',
    category: 'Functions',
    subcategory: 'Date & Time',
    description: 'Returns the four-digit year from a date.',
    syntax: 'Year(date)',
    parameters: 'date: date value or expression',
    example: 'Year(Date)',
    dbExample: 'Value = "LOT-" & Year(Date) & "-" & Record("BatchNo")',
    resultExample: 'LOT-2026-B101',
    snippetVb: 'Year(Date)',
    snippetJs: 'new Date().getFullYear()',
    compatibility: 'both',
  },
  {
    id: 'fn-month',
    name: 'Month',
    category: 'Functions',
    subcategory: 'Date & Time',
    description: 'Returns the month number (1-12) from a date.',
    syntax: 'Month(date)',
    parameters: 'date: date value or expression',
    example: 'Month(Date)',
    dbExample: 'Value = Month(Record("MFGDate"))',
    resultExample: '9',
    snippetVb: 'Month(Date)',
    snippetJs: 'new Date().getMonth() + 1',
    compatibility: 'both',
  },
  {
    id: 'fn-day',
    name: 'Day',
    category: 'Functions',
    subcategory: 'Date & Time',
    description: 'Returns the day of the month (1-31) from a date.',
    syntax: 'Day(date)',
    parameters: 'date: date value or expression',
    example: 'Day(Date)',
    dbExample: 'Value = Day(Record("MFGDate"))',
    resultExample: '19',
    snippetVb: 'Day(Date)',
    snippetJs: 'new Date().getDate()',
    compatibility: 'both',
  },

  // -------------------------------------------------------------
  // 2. TEXT FUNCTIONS
  // -------------------------------------------------------------
  {
    id: 'fn-ucase',
    name: 'UCase',
    category: 'Functions',
    subcategory: 'Text Functions',
    description: 'Converts a string to all uppercase characters.',
    syntax: 'UCase(string)',
    parameters: 'string: text expression',
    example: 'UCase("shampoo")',
    dbExample: 'UCase(Record("ProductName"))',
    resultExample: 'SHAMPOO 500ML',
    snippetVb: 'UCase(Value)',
    snippetJs: 'String(value).toUpperCase()',
    compatibility: 'both',
  },
  {
    id: 'fn-lcase',
    name: 'LCase',
    category: 'Functions',
    subcategory: 'Text Functions',
    description: 'Converts a string to all lowercase characters.',
    syntax: 'LCase(string)',
    parameters: 'string: text expression',
    example: 'LCase("SHAMPOO")',
    dbExample: 'LCase(Record("Category"))',
    resultExample: 'personal care',
    snippetVb: 'LCase(Value)',
    snippetJs: 'String(value).toLowerCase()',
    compatibility: 'both',
  },
  {
    id: 'fn-left',
    name: 'Left',
    category: 'Functions',
    subcategory: 'Text Functions',
    description: 'Returns a specified number of characters from the left side of a string.',
    syntax: 'Left(string, length)',
    parameters: 'string: text expression\nlength: number of characters to return',
    example: 'Left("8901234567890", 3)',
    dbExample: 'Left(Record("Barcode"), 3)',
    resultExample: '890 (Country Prefix)',
    snippetVb: 'Left(Value, 3)',
    snippetJs: 'String(value).substring(0, 3)',
    compatibility: 'both',
  },
  {
    id: 'fn-right',
    name: 'Right',
    category: 'Functions',
    subcategory: 'Text Functions',
    description: 'Returns a specified number of characters from the right side of a string.',
    syntax: 'Right(string, length)',
    parameters: 'string: text expression\nlength: number of characters to return',
    example: 'Right("000101", 3)',
    dbExample: 'Right(Record("SKU"), 3)',
    resultExample: '101',
    snippetVb: 'Right(Value, 3)',
    snippetJs: 'String(value).slice(-3)',
    compatibility: 'both',
  },
  {
    id: 'fn-mid',
    name: 'Mid',
    category: 'Functions',
    subcategory: 'Text Functions',
    description: 'Returns a specified number of characters from a string starting at a 1-based index.',
    syntax: 'Mid(string, start, [length])',
    parameters: 'string: text expression\nstart: 1-based character position\nlength: number of characters',
    example: 'Mid("8901234567890", 4, 4)',
    dbExample: 'Mid(Record("Barcode"), 4, 4)',
    resultExample: '1234',
    snippetVb: 'Mid(Value, 1, 5)',
    snippetJs: 'String(value).substr(0, 5)',
    compatibility: 'both',
  },
  {
    id: 'fn-instr',
    name: 'InStr',
    category: 'Functions',
    subcategory: 'Text Functions',
    description: 'Returns the 1-based position of the first occurrence of one string within another.',
    syntax: 'InStr([start], string1, string2)',
    parameters: 'start: optional 1-based start index\nstring1: string being searched\nstring2: string to find',
    example: 'InStr(Record("ProductName"), "500ml")',
    dbExample: 'If InStr(Record("ProductName"), "500ml") > 0 Then Value = "LARGE"',
    resultExample: '9',
    snippetVb: 'InStr(Record("ProductName"), "500ml")',
    snippetJs: 'record.ProductName.indexOf("500ml") + 1',
    compatibility: 'both',
  },
  {
    id: 'fn-replace',
    name: 'Replace',
    category: 'Functions',
    subcategory: 'Text Functions',
    description: 'Replaces occurrences of a specified substring with another substring.',
    syntax: 'Replace(expression, find, replace)',
    parameters: 'expression: string to modify\nfind: substring to find\nreplace: replacement string',
    example: 'Replace("A-B-C", "-", "")',
    dbExample: 'Replace(Record("SKU"), "-", "")',
    resultExample: 'ABC',
    snippetVb: 'Replace(Value, " ", "_")',
    snippetJs: 'String(value).split(" ").join("_")',
    compatibility: 'both',
  },
  {
    id: 'fn-trim',
    name: 'Trim',
    category: 'Functions',
    subcategory: 'Text Functions',
    description: 'Removes leading and trailing spaces from a string.',
    syntax: 'Trim(string)',
    parameters: 'string: text expression',
    example: 'Trim("  Sample  ")',
    dbExample: 'Trim(Record("BatchNo"))',
    resultExample: 'Sample',
    snippetVb: 'Trim(Value)',
    snippetJs: 'String(value).trim()',
    compatibility: 'both',
  },
  {
    id: 'fn-len',
    name: 'Len',
    category: 'Functions',
    subcategory: 'Text Functions',
    description: 'Returns the character length of a string.',
    syntax: 'Len(string)',
    parameters: 'string: text expression',
    example: 'Len(Record("Barcode"))',
    dbExample: 'If Len(Record("Barcode")) <> 13 Then Value = "INVALID LENGTH"',
    resultExample: '13',
    snippetVb: 'Len(Value)',
    snippetJs: 'String(value).length',
    compatibility: 'both',
  },

  // -------------------------------------------------------------
  // 3. MATH & CONVERSION FUNCTIONS
  // -------------------------------------------------------------
  {
    id: 'fn-round',
    name: 'Round',
    category: 'Functions',
    subcategory: 'Math & Conversion',
    description: 'Rounds a number to a specified number of decimal places.',
    syntax: 'Round(number, [decimals])',
    parameters: 'number: numeric expression\ndecimals: number of decimal digits (default 0)',
    example: 'Round(Record("Price") * 1.18, 2)',
    dbExample: 'Value = Round(Record("Price") * (1 + Record("GST") / 100), 2)',
    resultExample: '590.00',
    snippetVb: 'Round(Value, 2)',
    snippetJs: 'Math.round(value * 100) / 100',
    compatibility: 'both',
  },
  {
    id: 'fn-cstr',
    name: 'CStr',
    category: 'Functions',
    subcategory: 'Math & Conversion',
    description: 'Converts an expression to a String data type.',
    syntax: 'CStr(expression)',
    parameters: 'expression: value to convert',
    example: 'CStr(12345)',
    dbExample: 'Value = "SKU-" & CStr(Record("SKU"))',
    resultExample: '"000101"',
    snippetVb: 'CStr(Value)',
    snippetJs: 'String(value)',
    compatibility: 'both',
  },
  {
    id: 'fn-cint',
    name: 'CInt',
    category: 'Functions',
    subcategory: 'Math & Conversion',
    description: 'Converts an expression to an Integer (whole number).',
    syntax: 'CInt(expression)',
    parameters: 'expression: value to convert',
    example: 'CInt("90")',
    dbExample: 'If CInt(Record("Stock")) <= 0 Then Value = "OUT OF STOCK"',
    resultExample: '90',
    snippetVb: 'CInt(Value)',
    snippetJs: 'parseInt(value, 10)',
    compatibility: 'both',
  },
  {
    id: 'fn-cdbl',
    name: 'CDbl',
    category: 'Functions',
    subcategory: 'Math & Conversion',
    description: 'Converts an expression to a Double-precision floating-point number.',
    syntax: 'CDbl(expression)',
    parameters: 'expression: numeric string or value',
    example: 'CDbl(Record("Price")) * 1.18',
    dbExample: 'Value = FormatCurrency(CDbl(Record("Price")) * 1.18)',
    resultExample: '$590.00',
    snippetVb: 'CDbl(Value)',
    snippetJs: 'parseFloat(value)',
    compatibility: 'both',
  },

  // -------------------------------------------------------------
  // 4. BARCODE & CHECKSUM FUNCTIONS (Sections 32 & 33)
  // -------------------------------------------------------------
  {
    id: 'fn-mod10',
    name: 'Mod10CheckDigit',
    category: 'Functions',
    subcategory: 'Barcode & Checksum',
    description: 'Calculates the standard Modulo 10 check digit (used in EAN-13, UPC-A, GS1-128, SSCC).',
    syntax: 'Mod10CheckDigit(data)',
    parameters: 'data: numeric string without check digit',
    example: 'Mod10CheckDigit("890123456789")',
    dbExample: 'Value = Record("Barcode") & Mod10CheckDigit(Record("Barcode"))',
    resultExample: '0 (for "890123456789" -> "8901234567890")',
    snippetVb: 'Mod10CheckDigit("890123456789")',
    snippetJs: 'Mod10CheckDigit("890123456789")',
    compatibility: 'both',
  },
  {
    id: 'fn-gs1check',
    name: 'GS1CheckDigit',
    category: 'Functions',
    subcategory: 'Barcode & Checksum',
    description: 'Calculates the GS1 official alternating 3x/1x modulo 10 check digit.',
    syntax: 'GS1CheckDigit(data)',
    parameters: 'data: numeric barcode data string',
    example: 'GS1CheckDigit("0085000653123")',
    dbExample: 'Value = "00" & Record("SSCC") & GS1CheckDigit("00" & Record("SSCC"))',
    resultExample: '4',
    snippetVb: 'GS1CheckDigit("0085000653123")',
    snippetJs: 'GS1CheckDigit("0085000653123")',
    compatibility: 'both',
  },
  {
    id: 'fn-mod43',
    name: 'Mod43CheckDigit',
    category: 'Functions',
    subcategory: 'Barcode & Checksum',
    description: 'Calculates the Code 39 Modulo 43 check character.',
    syntax: 'Mod43CheckDigit(data)',
    parameters: 'data: alphanumeric Code 39 string',
    example: 'Mod43CheckDigit("CODE39")',
    dbExample: 'Value = Record("SKU") & Mod43CheckDigit(Record("SKU"))',
    resultExample: 'R',
    snippetVb: 'Mod43CheckDigit(Record("SKU"))',
    snippetJs: 'Mod43CheckDigit(record.SKU)',
    compatibility: 'both',
  },

  // -------------------------------------------------------------
  // 5. CONTROL FLOW (VBScript & JavaScript)
  // -------------------------------------------------------------
  {
    id: 'ctrl-if-else',
    name: 'If...Then...Else',
    category: 'Control Flow',
    description: 'Executes a block of code conditionally based on evaluation of an expression.',
    syntax: 'If condition Then\n    statements\nElse\n    statements\nEnd If',
    parameters: 'condition: boolean expression\nstatements: code to execute',
    example: 'If Record("Stock") <= 0 Then\n    Value = "OUT OF STOCK"\nElse\n    Value = "IN STOCK"\nEnd If',
    dbExample: 'If Record("Stock") <= 0 Then\n    Value = "OUT OF STOCK"\nElseIf Record("Stock") < 10 Then\n    Value = "LOW STOCK"\nElse\n    Value = "IN STOCK"\nEnd If',
    resultExample: 'IN STOCK (when Stock=20)',
    snippetVb: 'If Record("Stock") <= 0 Then\n    Value = "OUT OF STOCK"\nElse\n    Value = "IN STOCK"\nEnd If',
    snippetJs: 'if (Number(record.Stock) <= 0) {\n    Value = "OUT OF STOCK";\n} else {\n    Value = "IN STOCK";\n}',
    compatibility: 'both',
  },
  {
    id: 'ctrl-select-case',
    name: 'Select Case',
    category: 'Control Flow',
    description: 'Executes one of several groups of statements, depending on the value of an expression.',
    syntax: 'Select Case expression\n    Case value1\n        statements\n    Case value2\n        statements\n    Case Else\n        statements\nEnd Select',
    parameters: 'expression: test expression\nvalue1, value2: match values',
    example: 'Select Case Record("Category")\n    Case "Personal Care"\n        Value = "PC-DEPT"\n    Case "Pharmacy"\n        Value = "RX-DEPT"\n    Case Else\n        Value = "GEN-DEPT"\nEnd Select',
    resultExample: 'PC-DEPT',
    snippetVb: 'Select Case Record("Category")\n    Case "Personal Care"\n        Value = "PC-DEPT"\n    Case Else\n        Value = "GEN-DEPT"\nEnd Select',
    snippetJs: 'switch (record.Category) {\n    case "Personal Care":\n        Value = "PC-DEPT";\n        break;\n    default:\n        Value = "GEN-DEPT";\n}',
    compatibility: 'both',
  },
  {
    id: 'ctrl-for-next',
    name: 'For...Next',
    category: 'Control Flow',
    description: 'Repeats a group of statements a specified number of times.',
    syntax: 'For counter = start To end [Step step]\n    statements\nNext',
    parameters: 'counter: loop variable\nstart, end: loop boundaries\nstep: increment value (default 1)',
    example: 'For i = 1 To 5\n    Value = Value & "*"\nNext',
    resultExample: '*****',
    snippetVb: 'For i = 1 To 5\n    Value = Value & "*"\nNext',
    snippetJs: 'for (let i = 1; i <= 5; i++) {\n    Value += "*";\n}',
    compatibility: 'both',
  },

  // -------------------------------------------------------------
  // 6. OPERATORS
  // -------------------------------------------------------------
  {
    id: 'op-equal',
    name: '= (Equality)',
    category: 'Operators',
    description: 'Tests equality between two values.',
    syntax: 'expr1 = expr2',
    example: 'If Record("Stock") = 0 Then Value = "EMPTY"',
    snippetVb: '=',
    snippetJs: '===',
    compatibility: 'both',
  },
  {
    id: 'op-notequal',
    name: '<> (Inequality)',
    category: 'Operators',
    description: 'Tests inequality between two values.',
    syntax: 'expr1 <> expr2',
    example: 'If Record("Qty") <> 0 Then Value = "HAS STOCK"',
    snippetVb: '<>',
    snippetJs: '!==',
    compatibility: 'both',
  },
  {
    id: 'op-concat',
    name: '& (String Concatenation)',
    category: 'Operators',
    description: 'Concatenates two expressions into a single string.',
    syntax: 'expr1 & expr2',
    example: 'Value = Record("ProductName") & " (" & Record("SKU") & ")"',
    snippetVb: '&',
    snippetJs: '+',
    compatibility: 'both',
  },
  {
    id: 'op-and',
    name: 'And (Logical Conjunction)',
    category: 'Operators',
    description: 'Performs logical conjunction on two expressions.',
    syntax: 'cond1 And cond2',
    example: 'If Record("Stock") > 0 And Record("Price") < 1000 Then Value = "SPECIAL"',
    snippetVb: 'And',
    snippetJs: '&&',
    compatibility: 'both',
  },
  {
    id: 'op-or',
    name: 'Or (Logical Disjunction)',
    category: 'Operators',
    description: 'Performs logical disjunction on two expressions.',
    syntax: 'cond1 Or cond2',
    example: 'If Record("Stock") = 0 Or Record("Qty") = 0 Then Value = "UNAVAILABLE"',
    snippetVb: 'Or',
    snippetJs: '||',
    compatibility: 'both',
  },

  // -------------------------------------------------------------
  // 7. CONSTANTS
  // -------------------------------------------------------------
  {
    id: 'const-vbcrlf',
    name: 'vbCrLf',
    category: 'Constants',
    description: 'Carriage return and line feed combination (starts a new line).',
    syntax: 'vbCrLf',
    example: 'Value = "Line 1" & vbCrLf & "Line 2"',
    snippetVb: 'vbCrLf',
    snippetJs: '"\\n"',
    compatibility: 'both',
  },
  {
    id: 'const-vbtab',
    name: 'vbTab',
    category: 'Constants',
    description: 'Horizontal tab character.',
    syntax: 'vbTab',
    example: 'Value = "Col1" & vbTab & "Col2"',
    snippetVb: 'vbTab',
    snippetJs: '"\\t"',
    compatibility: 'both',
  },
  {
    id: 'const-true',
    name: 'True / False',
    category: 'Constants',
    description: 'Boolean literal values.',
    syntax: 'True | False',
    example: 'Value = True',
    snippetVb: 'True',
    snippetJs: 'true',
    compatibility: 'both',
  },
];

/**
 * Builds the dynamic hierarchical assistant items from the active document:
 * Template Objects, Database Fields, Named Data Sources, Global Data, Script Libraries.
 */
export function buildDynamicAssistantCategories(
  paramsOrTemplate?: any,
  records?: Record<string, any>[],
  recordIndex: number = 0
): ScriptAssistantCategory[] {
  let elements: any[] = [];
  let databaseFields: string[] = [];
  let currentRecord: Record<string, any> = {};
  let namedSources: any[] = [];
  let globalData: Record<string, any> = {};
  let scriptLibraries: any[] = [];

  if (paramsOrTemplate) {
    if (paramsOrTemplate.elements !== undefined && (records !== undefined || paramsOrTemplate.id !== undefined)) {
      // Called as (template, records, recordIndex)
      const template = paramsOrTemplate;
      elements = template.elements || [];
      const recs = records || template.databaseConnection?.records || template.sampleRecords || [];
      currentRecord = recs[recordIndex] || recs[0] || {};
      databaseFields = template.databaseConnection?.fields || Object.keys(currentRecord || {}).filter((k: string) => !k.startsWith('__'));
      namedSources = template.namedDataSources || template.variables || [];
      globalData = template.globalData || {};
      scriptLibraries = template.scriptLibraries || [];
    } else {
      // Called as params object: { elements, databaseFields, currentRecord, ... }
      elements = paramsOrTemplate.elements || [];
      databaseFields = paramsOrTemplate.databaseFields || [];
      currentRecord = paramsOrTemplate.currentRecord || {};
      namedSources = paramsOrTemplate.namedSources || [];
      globalData = paramsOrTemplate.globalData || {};
      scriptLibraries = paramsOrTemplate.scriptLibraries || [];
    }
  }

  const categories: ScriptAssistantCategory[] = [];

  // 1. Template Objects
  if (elements.length > 0) {
    categories.push({
      id: 'cat-template-objects',
      name: 'Template Objects',
      items: elements.map((el) => ({
        id: `obj-${el.id}`,
        name: el.name || `${el.type}_${el.id.slice(0, 6)}`,
        category: 'Template Objects',
        description: `Reference value of canvas template object "${el.name || el.id}" (${el.type}).`,
        syntax: `Format.Objects("${el.name || el.id}").Value`,
        example: `Value = Format.Objects("${el.name || el.id}").Value`,
        snippetVb: `Format.Objects("${el.name || el.id}").Value`,
        snippetJs: `Format.Objects("${el.name || el.id}").Value`,
        compatibility: 'both',
      })),
    });
  }

  // 2. Database Fields
  const allFields = Array.from(
    new Set([
      ...(databaseFields || []),
      ...Object.keys(currentRecord || {}).filter((k) => !k.startsWith('__')),
    ])
  );

  if (allFields.length > 0) {
    categories.push({
      id: 'cat-database-fields',
      name: 'Database Fields',
      items: allFields.map((f) => {
        const val = currentRecord ? currentRecord[f] : undefined;
        const displayVal = val !== undefined ? String(val) : 'N/A';
        return {
          id: `db-${f}`,
          name: f,
          category: 'Database Fields',
          description: `Active record database field [${f}]. Current sample value: "${displayVal}".`,
          syntax: `Record("${f}")`,
          example: `Value = Record("${f}")`,
          dbExample: `Value = "SKU: " & Record("${f}")`,
          resultExample: displayVal,
          snippetVb: `Record("${f}")`,
          snippetJs: `record["${f}"]`,
          compatibility: 'both',
        };
      }),
    });
  }

  // 3. Global Objects / Data
  const globalKeys = Object.keys(globalData || {});
  if (globalKeys.length > 0) {
    categories.push({
      id: 'cat-global-objects',
      name: 'Global Objects',
      items: globalKeys.map((k) => ({
        id: `glob-${k}`,
        name: k,
        category: 'Global Objects',
        description: `Global document-wide shared variable "${k}".`,
        syntax: `Global("${k}")`,
        example: `Value = Global("${k}")`,
        resultExample: String(globalData[k] ?? ''),
        snippetVb: `Global("${k}")`,
        snippetJs: `ctx.globalData["${k}"]`,
        compatibility: 'both',
      })),
    });
  }

  // 4. Named Data Sources
  if (namedSources.length > 0) {
    categories.push({
      id: 'cat-named-sources',
      name: 'Named Data Sources',
      items: namedSources.map((n) => ({
        id: `named-${n.name}`,
        name: n.name,
        category: 'Named Data Sources',
        description: `Shared named data source "${n.name}". Default: "${n.defaultValue || ''}".`,
        syntax: `NamedSubStrings("${n.name}").Value`,
        example: `Value = NamedSubStrings("${n.name}").Value`,
        resultExample: String(n.defaultValue ?? ''),
        snippetVb: `NamedSubStrings("${n.name}").Value`,
        snippetJs: `namedSubStrings["${n.name}"].Value`,
        compatibility: 'both',
      })),
    });
  }

  // 5. Script Libraries
  if (scriptLibraries.length > 0) {
    categories.push({
      id: 'cat-script-libraries',
      name: 'Script Libraries',
      items: scriptLibraries.map((lib) => ({
        id: `lib-${lib.id}`,
        name: lib.name,
        category: 'Script Libraries',
        description: lib.description || `Reusable script library "${lib.name}" (${lib.language}).`,
        syntax: `${lib.name}()`,
        example: `' Calls functions defined in ${lib.name}\nValue = ${lib.name}()`,
        snippetVb: `${lib.name}()`,
        snippetJs: `${lib.name}()`,
        compatibility: lib.language as any,
      })),
    });
  }

  // 6. Built-in function categories (top-level BarTender categories)
  categories.push({
    id: 'cat-date-time',
    name: 'Date & Time Functions',
    items: BUILTIN_ASSISTANT_ITEMS.filter((i) => i.subcategory === 'Date & Time'),
  });

  categories.push({
    id: 'cat-text-functions',
    name: 'Text Functions',
    items: BUILTIN_ASSISTANT_ITEMS.filter((i) => i.subcategory === 'Text Functions'),
  });

  categories.push({
    id: 'cat-math-conversion',
    name: 'Math & Conversion',
    items: BUILTIN_ASSISTANT_ITEMS.filter((i) => i.subcategory === 'Math & Conversion'),
  });

  categories.push({
    id: 'cat-barcode-checksum',
    name: 'Barcode & Checksum',
    items: BUILTIN_ASSISTANT_ITEMS.filter((i) => i.subcategory === 'Barcode & Checksum'),
  });

  categories.push({
    id: 'cat-control-flow',
    name: 'Control Flow',
    items: BUILTIN_ASSISTANT_ITEMS.filter((i) => i.category === 'Control Flow'),
  });

  categories.push({
    id: 'cat-operators',
    name: 'Operators',
    items: BUILTIN_ASSISTANT_ITEMS.filter((i) => i.category === 'Operators'),
  });

  categories.push({
    id: 'cat-constants',
    name: 'Constants',
    items: BUILTIN_ASSISTANT_ITEMS.filter((i) => i.category === 'Constants'),
  });

  return categories;
}
