import React, { useState, useEffect } from 'react';
import { X, Check, Calculator, Sparkles, AlertCircle, CheckCircle2, FunctionSquare } from 'lucide-react';
import { evaluateFormula } from '../../services/formulaEngine';

interface FormulaBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialExpression?: string;
  onApplyFormula: (expression: string) => void;
  sampleRecord?: Record<string, string>;
  availableFields?: string[];
  variables?: { name: string; defaultValue?: string }[];
  namedDataSources?: { name: string; defaultValue?: string }[];
}

interface FunctionCategory {
  category: string;
  items: { name: string; syntax: string; description: string; example: string }[];
}

const FUNCTION_CATEGORIES: FunctionCategory[] = [
  {
    category: 'Mathematics',
    items: [
      { name: 'ROUND', syntax: 'ROUND(number, decimals)', description: 'Rounds number to given decimal places', example: 'ROUND(Price * 1.18, 2)' },
      { name: 'ABS', syntax: 'ABS(number)', description: 'Returns absolute value', example: 'ABS(-45.2)' },
      { name: 'CEIL', syntax: 'CEIL(number)', description: 'Rounds number upwards to nearest integer', example: 'CEIL(Quantity / 12)' },
      { name: 'FLOOR', syntax: 'FLOOR(number)', description: 'Rounds number downwards to nearest integer', example: 'FLOOR(CartonCount)' },
      { name: 'MAX', syntax: 'MAX(val1, val2, ...)', description: 'Returns highest value in list', example: 'MAX(StockA, StockB)' },
      { name: 'MIN', syntax: 'MIN(val1, val2, ...)', description: 'Returns lowest value in list', example: 'MIN(WeightLimit, GrossWeight)' },
    ],
  },
  {
    category: 'String / Text',
    items: [
      { name: 'CONCAT', syntax: 'CONCAT(str1, str2, ...)', description: 'Joins multiple text strings into one', example: 'CONCAT(SKU, "-", BATCH_NO)' },
      { name: 'SUBSTRING', syntax: 'SUBSTRING(str, start, [length])', description: 'Extracts characters from string', example: 'SUBSTRING(GTIN, 0, 8)' },
      { name: 'TRIM', syntax: 'TRIM(str)', description: 'Removes leading and trailing whitespace', example: 'TRIM(ItemDescription)' },
      { name: 'UPPER', syntax: 'UPPER(str)', description: 'Converts text to uppercase', example: 'UPPER(LocationCode)' },
      { name: 'LOWER', syntax: 'LOWER(str)', description: 'Converts text to lowercase', example: 'LOWER(UserEmail)' },
      { name: 'PADLEFT', syntax: 'PADLEFT(val, length, [char])', description: 'Pads string on the left with character', example: 'PADLEFT(SequenceNum, 6, "0")' },
      { name: 'PADRIGHT', syntax: 'PADRIGHT(val, length, [char])', description: 'Pads string on the right with character', example: 'PADRIGHT(Code, 10, " ")' },
      { name: 'REPLACE', syntax: 'REPLACE(str, search, replacement)', description: 'Replaces all occurrences of search string', example: 'REPLACE(LotNumber, "/", "-")' },
      { name: 'LENGTH', syntax: 'LENGTH(str)', description: 'Returns number of characters in string', example: 'LENGTH(BarcodeData)' },
    ],
  },
  {
    category: 'Date & Time',
    items: [
      { name: 'ADDDAYS', syntax: 'ADDDAYS(date, days)', description: 'Adds N days to date', example: 'ADDDAYS(MFG_DATE, 30)' },
      { name: 'ADDMONTHS', syntax: 'ADDMONTHS(date, months)', description: 'Adds N months to date (expiry calculation)', example: 'ADDMONTHS(MFG_DATE, 24)' },
      { name: 'ADDYEARS', syntax: 'ADDYEARS(date, years)', description: 'Adds N years to date', example: 'ADDYEARS(MFG_DATE, 3)' },
      { name: 'DATEDIFF', syntax: 'DATEDIFF(date1, date2, [unit])', description: 'Difference between dates in days/months/years', example: 'DATEDIFF(MFG_DATE, EXP_DATE, "days")' },
      { name: 'FORMATDATE', syntax: 'FORMATDATE(date, mask)', description: 'Formats date using format mask', example: 'FORMATDATE(NOW(), "YYMMDD")' },
      { name: 'NOW', syntax: 'NOW()', description: 'Returns current system date and time', example: 'FORMATDATE(NOW(), "YYYY-MM-DD HH:mm")' },
      { name: 'TODAY', syntax: 'TODAY()', description: 'Returns current system date', example: 'FORMATDATE(TODAY(), "DD/MM/YYYY")' },
    ],
  },
  {
    category: 'Conditionals & Logic',
    items: [
      { name: 'IF', syntax: 'IF(condition, trueValue, falseValue)', description: 'Returns trueValue if condition is true, otherwise falseValue', example: 'IF(Quantity > 100, "BULK", "RETAIL")' },
      { name: 'AND', syntax: 'AND(cond1, cond2, ...)', description: 'Returns true if all conditions are true', example: 'AND(Stock > 0, Active == true)' },
      { name: 'OR', syntax: 'OR(cond1, cond2, ...)', description: 'Returns true if any condition is true', example: 'OR(Country == "IN", Country == "US")' },
      { name: 'ISBLANK', syntax: 'ISBLANK(val)', description: 'Checks if value is null, undefined, or empty', example: 'IF(ISBLANK(Batch), "NO-BATCH", Batch)' },
      { name: 'COALESCE', syntax: 'COALESCE(val1, val2, ...)', description: 'Returns first non-empty value in list', example: 'COALESCE(CustomLabel, ItemName, "Untitled")' },
    ],
  },
];

export const FormulaBuilderModal: React.FC<FormulaBuilderModalProps> = ({
  isOpen,
  onClose,
  initialExpression = '',
  onApplyFormula,
  sampleRecord = {},
  availableFields = [],
  variables = [],
  namedDataSources = [],
}) => {
  const [expression, setExpression] = useState(initialExpression);
  const [testResult, setTestResult] = useState<{ success: boolean; value: string; error?: string }>({
    success: true,
    value: '',
  });

  useEffect(() => {
    setExpression(initialExpression);
  }, [initialExpression, isOpen]);

  // Live evaluation whenever expression changes
  useEffect(() => {
    if (!expression.trim()) {
      setTestResult({ success: true, value: '' });
      return;
    }

    const namedMap: Record<string, any> = {};
    namedDataSources.forEach((n) => {
      namedMap[n.name] = n.defaultValue || sampleRecord[n.name] || 'Sample';
    });

    const varMap: Record<string, any> = {};
    variables.forEach((v) => {
      varMap[v.name] = v.defaultValue || 'DefaultVar';
    });

    const res = evaluateFormula(expression, {
      record: sampleRecord,
      namedSources: namedMap,
      variables: varMap,
      system: {
        userName: 'Admin',
        printerName: 'Zebra ZT410',
        jobId: 'JOB-2026-001',
        currentRecordIndex: 0,
        totalRecords: 10,
      },
    });

    setTestResult(res);
  }, [expression, sampleRecord, namedDataSources, variables]);

  if (!isOpen) return null;

  const insertText = (text: string) => {
    setExpression((prev) => (prev ? `${prev} + ${text}` : text));
  };

  const insertFunction = (syntax: string) => {
    setExpression((prev) => (prev ? `${prev} ${syntax}` : syntax));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none">
      <div className="w-[840px] max-w-full bg-[#f8fafc] rounded-xl shadow-2xl border border-slate-300 flex flex-col overflow-hidden text-slate-800 text-[12px]">
        {/* Title Bar */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-4 py-2.5 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center shadow-xs">
              <Calculator className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm tracking-tight">Industrial Formula & Expression Builder</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 grid grid-cols-12 gap-4 max-h-[75vh] overflow-y-auto">
          {/* Left Column: Functions & Fields Browser */}
          <div className="col-span-5 space-y-3">
            {/* Database & Named Fields */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Available Fields & Variables
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
                {availableFields.map((f) => (
                  <button
                    key={f}
                    onClick={() => insertText(f)}
                    className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded text-[11px] cursor-pointer"
                  >
                    {f}
                  </button>
                ))}
                {namedDataSources.map((n) => (
                  <button
                    key={n.name}
                    onClick={() => insertText(n.name)}
                    className="px-2 py-0.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded text-[11px] cursor-pointer"
                  >
                    {n.name}
                  </button>
                ))}
                {variables.map((v) => (
                  <button
                    key={v.name}
                    onClick={() => insertText(v.name)}
                    className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-[11px] cursor-pointer"
                  >
                    {v.name}
                  </button>
                ))}
                <button
                  onClick={() => insertText('System.Date')}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded text-[11px] cursor-pointer"
                >
                  System.Date
                </button>
                <button
                  onClick={() => insertText('System.Time')}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded text-[11px] cursor-pointer"
                >
                  System.Time
                </button>
              </div>
            </div>

            {/* Function Categories */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs space-y-2">
              <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <FunctionSquare className="w-3.5 h-3.5 text-blue-600" />
                Functions Library
              </div>
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {FUNCTION_CATEGORIES.map((cat) => (
                  <div key={cat.category} className="space-y-1">
                    <div className="text-[10.5px] font-semibold text-slate-400">{cat.category}</div>
                    <div className="grid grid-cols-2 gap-1">
                      {cat.items.map((fn) => (
                        <button
                          key={fn.name}
                          onClick={() => insertFunction(fn.syntax)}
                          title={`${fn.description}\nExample: ${fn.example}`}
                          className="px-2 py-1 text-left bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-900 border border-slate-200 rounded text-[11px] truncate cursor-pointer"
                        >
                          <span className="font-mono font-bold text-blue-700">{fn.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Expression Editor & Live Test */}
          <div className="col-span-7 flex flex-col justify-between space-y-3">
            <div className="space-y-1.5">
              <label className="text-[11.5px] font-bold text-slate-700">Formula Expression</label>
              <textarea
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                placeholder='e.g. CONCAT(SKU, "-", BATCH_NO) or ROUND(Price * 1.18, 2) or ADDMONTHS(MFG_DATE, 24)'
                className="w-full h-44 p-3 font-mono text-[12px] bg-white border border-slate-300 rounded-lg shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-slate-900"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Standard JavaScript math & functions supported</span>
                <button
                  onClick={() => setExpression('')}
                  className="text-slate-400 hover:text-red-600 cursor-pointer"
                >
                  Clear Expression
                </button>
              </div>
            </div>

            {/* Live Evaluation Box */}
            <div
              className={`p-3 rounded-lg border transition-all ${
                testResult.success
                  ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900'
                  : 'bg-red-50/70 border-red-300 text-red-900'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-[11.5px] mb-1">
                {testResult.success ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Real-Time Output Preview:</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span>Evaluation Error:</span>
                  </>
                )}
              </div>
              <div className="font-mono text-sm break-all font-semibold pl-5">
                {testResult.success ? (
                  testResult.value !== '' ? (
                    testResult.value
                  ) : (
                    <span className="text-slate-400 font-normal italic">Enter an expression above to evaluate</span>
                  )
                ) : (
                  <span className="text-red-700">{testResult.error}</span>
                )}
              </div>
            </div>

            {/* Quick Helper Presets */}
            <div className="bg-slate-100 p-2.5 rounded-lg border border-slate-200">
              <span className="text-[10.5px] font-bold text-slate-500 block mb-1">Common Industry Presets:</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setExpression('CONCAT(SKU, "-", BATCH_NO)')}
                  className="px-2 py-0.5 bg-white border border-slate-300 rounded text-[10.5px] text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  SKU + Batch
                </button>
                <button
                  onClick={() => setExpression('ADDMONTHS(MFG_DATE, 24)')}
                  className="px-2 py-0.5 bg-white border border-slate-300 rounded text-[10.5px] text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  2-Year Expiry
                </button>
                <button
                  onClick={() => setExpression('ROUND(Price * 1.18, 2)')}
                  className="px-2 py-0.5 bg-white border border-slate-300 rounded text-[10.5px] text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Price + 18% GST
                </button>
                <button
                  onClick={() => setExpression('FORMATDATE(NOW(), "YYMMDD")')}
                  className="px-2 py-0.5 bg-white border border-slate-300 rounded text-[10.5px] text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  GS1 Date (YYMMDD)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-100 border-t border-slate-200 px-4 py-2.5 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">Changes apply to selected data source or element</div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              disabled={!testResult.success}
              onClick={() => {
                onApplyFormula(expression);
                onClose();
              }}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-md font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              Apply Formula
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
