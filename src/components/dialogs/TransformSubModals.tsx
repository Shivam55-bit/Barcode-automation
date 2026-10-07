import React, { useState, useEffect } from 'react';
import { TransformConfig } from '../../types';
import { X, Plus, Trash2, Code, ShieldCheck, Play } from 'lucide-react';
import { SpecialCharacterModal } from './SpecialCharacterModal';
import { executeVBScript, createRecordProxy } from '../../services/vbscriptEngine';
import { insertAtSelection } from '../../services/controlCharacterService';

interface SubModalBaseProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  onApply: (transformUpdates: Partial<TransformConfig>) => void;
}

// 1. SUPPRESSION MODAL
export const SuppressionModal: React.FC<SubModalBaseProps & { initial?: TransformConfig['suppression'] }> = ({
  isOpen,
  onClose,
  title,
  onApply,
  initial,
}) => {
  const [type, setType] = useState<any>('never');
  const [value, setValue] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setType(initial?.type || 'never');
      setValue(initial?.value || '');
    }
  }, [isOpen, initial]);

  if (!isOpen) return null;

  const handleOk = () => {
    onApply({ suppression: { type, value } });
    onClose();
  };

  return (
    <ModalWrapper title={title} onClose={onClose} onOk={handleOk}>
      <div className="space-y-3">
        <p className="text-[11.5px] text-slate-600 font-medium">When should this data source be suppressed?</p>
        <div className="space-y-2">
          {[
            { id: 'never', label: 'Never' },
            { id: 'always', label: 'Always' },
            { id: 'empty', label: 'When Data Source is Empty' },
            { id: 'equals', label: 'When Data Source Equals:' },
            { id: 'not_equals', label: 'When Data Source Does Not Equal:' },
          ].map((opt) => (
            <label key={opt.id} className="flex items-center gap-2 cursor-pointer text-[12px] text-slate-800">
              <input
                type="radio"
                name="suppressionType"
                checked={type === opt.id}
                onChange={() => setType(opt.id)}
                className="accent-[#0078d7]"
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
        {(type === 'equals' || type === 'not_equals') && (
          <div className="pt-2">
            <label className="text-[11px] text-slate-600 font-medium">Target Value:</label>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter comparison string"
              className="w-full mt-1 border border-[#cbd5e1] rounded px-2 py-1 text-[11.5px] text-slate-800 focus:outline-[#0078d7]"
            />
          </div>
        )}
      </div>
    </ModalWrapper>
  );
};

// 2. CHARACTER FILTER MODAL
export const CharacterFilterModal: React.FC<SubModalBaseProps & { initial?: TransformConfig['characterFilter'] }> = ({
  isOpen,
  onClose,
  title,
  onApply,
  initial,
}) => {
  const [type, setType] = useState<any>('none');
  const [customChars, setCustomChars] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setType(initial?.type || 'none');
      setCustomChars(initial?.customChars || '');
    }
  }, [isOpen, initial]);

  if (!isOpen) return null;

  const handleOk = () => {
    onApply({ characterFilter: { type, customChars } });
    onClose();
  };

  return (
    <ModalWrapper title={title} onClose={onClose} onOk={handleOk}>
      <div className="space-y-3">
        <p className="text-[11.5px] text-slate-600 font-medium">Filter input characters:</p>
        <div className="space-y-2">
          {[
            { id: 'none', label: '<None>' },
            { id: 'digits', label: 'Digits Only (0-9)' },
            { id: 'letters', label: 'Letters Only (A-Z, a-z)' },
            { id: 'alphanumeric', label: 'Alphanumeric Only (0-9, A-Z, a-z)' },
            { id: 'uppercase', label: 'Force Uppercase' },
            { id: 'lowercase', label: 'Force Lowercase' },
            { id: 'custom_allowed', label: 'Custom Allowed Characters Only' },
            { id: 'custom_blocked', label: 'Custom Blocked Characters' },
          ].map((opt) => (
            <label key={opt.id} className="flex items-center gap-2 cursor-pointer text-[12px] text-slate-800">
              <input
                type="radio"
                name="filterType"
                checked={type === opt.id}
                onChange={() => setType(opt.id)}
                className="accent-[#0078d7]"
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
        {(type === 'custom_allowed' || type === 'custom_blocked') && (
          <div className="pt-2">
            <label className="text-[11px] text-slate-600 font-medium">Characters List:</label>
            <input
              type="text"
              value={customChars}
              onChange={(e) => setCustomChars(e.target.value)}
              placeholder="e.g. 0123456789-/"
              className="w-full mt-1 border border-[#cbd5e1] rounded px-2 py-1 text-[11.5px] text-slate-800 focus:outline-[#0078d7]"
            />
          </div>
        )}
      </div>
    </ModalWrapper>
  );
};

// 3. TRUNCATION MODAL
export const TruncationModal: React.FC<SubModalBaseProps & { initial?: TransformConfig['truncation'] }> = ({
  isOpen,
  onClose,
  title,
  onApply,
  initial,
}) => {
  const [type, setType] = useState<any>('none');
  const [count, setCount] = useState<number>(5);

  useEffect(() => {
    if (isOpen) {
      setType(initial?.type || 'none');
      setCount(initial?.count ?? 5);
    }
  }, [isOpen, initial]);

  if (!isOpen) return null;

  const handleOk = () => {
    onApply({ truncation: { type, count } });
    onClose();
  };

  return (
    <ModalWrapper title={title} onClose={onClose} onOk={handleOk}>
      <div className="space-y-3">
        <div className="space-y-2">
          {[
            { id: 'none', label: '<None>' },
            { id: 'keep_first', label: 'Keep First N Characters' },
            { id: 'keep_last', label: 'Keep Last N Characters' },
            { id: 'delete_first', label: 'Delete First N Characters' },
            { id: 'delete_last', label: 'Delete Last N Characters' },
          ].map((opt) => (
            <label key={opt.id} className="flex items-center gap-2 cursor-pointer text-[12px] text-slate-800">
              <input
                type="radio"
                name="truncType"
                checked={type === opt.id}
                onChange={() => setType(opt.id)}
                className="accent-[#0078d7]"
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
        {type !== 'none' && (
          <div className="flex items-center gap-3 pt-2">
            <label className="text-[11.5px] text-slate-600 font-medium">Number of Characters (N):</label>
            <input
              type="number"
              min={1}
              max={500}
              value={count}
              onChange={(e) => setCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-24 border border-[#cbd5e1] rounded px-2 py-0.8 text-[11.5px] text-slate-800"
            />
          </div>
        )}
      </div>
    </ModalWrapper>
  );
};

// 4. NUMBER OF CHARACTERS MODAL (LENGTH & PADDING)
export const CharacterLengthModal: React.FC<SubModalBaseProps & { initial?: TransformConfig['characterLength'] }> = ({
  isOpen,
  onClose,
  title,
  onApply,
  initial,
}) => {
  const [min, setMin] = useState<number>(0);
  const [max, setMax] = useState<number>(0);
  const [padChar, setPadChar] = useState<string>('0');
  const [padSide, setPadSide] = useState<'left' | 'right'>('left');
  const [overflowAction, setOverflowAction] = useState<'truncate' | 'error' | 'none'>('truncate');

  useEffect(() => {
    if (isOpen) {
      setMin(initial?.min || 0);
      setMax(initial?.max || 0);
      setPadChar(initial?.padChar || '0');
      setPadSide(initial?.padSide || 'left');
      setOverflowAction(initial?.overflowAction || 'truncate');
    }
  }, [isOpen, initial]);

  if (!isOpen) return null;

  const handleOk = () => {
    onApply({ characterLength: { min: min > 0 ? min : undefined, max: max > 0 ? max : undefined, padChar, padSide, overflowAction } });
    onClose();
  };

  return (
    <ModalWrapper title={title} onClose={onClose} onOk={handleOk}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-slate-600 font-medium">Minimum Characters:</label>
            <input
              type="number"
              min={0}
              max={500}
              value={min}
              onChange={(e) => setMin(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="w-full mt-1 border border-[#cbd5e1] rounded px-2 py-1 text-[11.5px]"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-600 font-medium">Maximum Characters:</label>
            <input
              type="number"
              min={0}
              max={500}
              value={max}
              onChange={(e) => setMax(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="w-full mt-1 border border-[#cbd5e1] rounded px-2 py-1 text-[11.5px]"
            />
          </div>
        </div>

        {min > 0 && (
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded space-y-2">
            <p className="font-semibold text-[11px] text-slate-700">Padding Options (When shorter than min):</p>
            <div className="flex items-center gap-3">
              <label className="text-[11px] text-slate-600">Pad Character:</label>
              <input
                type="text"
                maxLength={1}
                value={padChar}
                onChange={(e) => setPadChar(e.target.value || '0')}
                className="w-12 border border-[#cbd5e1] rounded px-2 py-0.5 text-[11.5px] text-center"
              />
              <label className="text-[11px] text-slate-600 ml-2">Side:</label>
              <select
                value={padSide}
                onChange={(e) => setPadSide(e.target.value as any)}
                className="border border-[#cbd5e1] rounded px-2 py-0.5 text-[11px] bg-white"
              >
                <option value="left">Left (Leading)</option>
                <option value="right">Right (Trailing)</option>
              </select>
            </div>
          </div>
        )}

        {max > 0 && (
          <div className="flex items-center justify-between gap-3">
            <label className="text-[11.5px] text-slate-600 font-medium">Overflow Handling:</label>
            <select
              value={overflowAction}
              onChange={(e) => setOverflowAction(e.target.value as any)}
              className="border border-[#cbd5e1] rounded px-2 py-1 text-[11.5px] bg-white"
            >
              <option value="truncate">Truncate (Clip to Max)</option>
              <option value="none">Allow Overflow</option>
            </select>
          </div>
        )}
      </div>
    </ModalWrapper>
  );
};

// 5. CHARACTER TEMPLATE MODAL
export const CharacterTemplateModal: React.FC<SubModalBaseProps & { initial?: TransformConfig['characterTemplate'] }> = ({
  isOpen,
  onClose,
  title,
  onApply,
  initial,
}) => {
  const [template, setTemplate] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setTemplate(initial?.template || '');
    }
  }, [isOpen, initial]);

  if (!isOpen) return null;

  const handleOk = () => {
    onApply({ characterTemplate: { template } });
    onClose();
  };

  return (
    <ModalWrapper title={title} onClose={onClose} onOk={handleOk}>
      <div className="space-y-3">
        <div>
          <label className="text-[11.5px] text-slate-600 font-medium">Character Template / Mask:</label>
          <input
            type="text"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder="e.g. AAA-9999 or (999) 999-9999"
            className="w-full mt-1 border border-[#cbd5e1] rounded px-2 py-1.5 text-[12px] font-mono text-slate-900 focus:outline-[#0078d7]"
          />
        </div>

        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-[11px] space-y-1 text-slate-600">
          <p className="font-semibold text-slate-800">Template Mask Legend:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><code className="font-bold text-blue-600">A</code> : Uppercase Alphabetic character</li>
            <li><code className="font-bold text-blue-600">9</code> or <code className="font-bold text-blue-600">#</code> : Numeric digit</li>
            <li><code className="font-bold text-blue-600">*</code> : Any character</li>
            <li>Other characters (e.g. <code className="font-bold">-</code>, <code className="font-bold">/</code>, <code className="font-bold">( )</code>) are inserted literally.</li>
          </ul>
          <p className="pt-1 text-slate-500 italic">Example: Input "ABC1234" with template "AAA-9999" results in "ABC-1234".</p>
        </div>
      </div>
    </ModalWrapper>
  );
};

// 6. SEARCH AND REPLACE MODAL
export const SearchReplaceModal: React.FC<SubModalBaseProps & { initial?: TransformConfig['searchReplace'] }> = ({
  isOpen,
  onClose,
  title,
  onApply,
  initial,
}) => {
  const [rules, setRules] = useState<Array<{ find: string; replace: string; caseSensitive?: boolean; wholeWord?: boolean; isRegex?: boolean }>>([]);

  useEffect(() => {
    if (isOpen) {
      setRules(initial && initial.length > 0 ? JSON.parse(JSON.stringify(initial)) : [{ find: '', replace: '', caseSensitive: false, wholeWord: false, isRegex: false }]);
    }
  }, [isOpen, initial]);

  if (!isOpen) return null;

  const handleAddRule = () => {
    setRules([...rules, { find: '', replace: '', caseSensitive: false, wholeWord: false, isRegex: false }]);
  };

  const handleRemoveRule = (idx: number) => {
    setRules(rules.filter((_, i) => i !== idx));
  };

  const handleUpdateRule = (idx: number, updates: any) => {
    setRules(rules.map((r, i) => (i === idx ? { ...r, ...updates } : r)));
  };

  const handleOk = () => {
    const valid = rules.filter((r) => r.find.trim().length > 0);
    onApply({ searchReplace: valid });
    onClose();
  };

  return (
    <ModalWrapper title={title} onClose={onClose} onOk={handleOk} width="w-[560px]">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11.5px] text-slate-600 font-medium">Search and Replace Rules:</p>
          <button
            type="button"
            onClick={handleAddRule}
            className="px-2 py-0.8 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded text-blue-700 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Add Rule</span>
          </button>
        </div>

        <div className="max-h-[220px] overflow-y-auto space-y-2 border border-slate-200 rounded p-2 bg-slate-50">
          {rules.map((rule, idx) => (
            <div key={idx} className="p-2 bg-white border border-slate-300 rounded space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="Find text..."
                    value={rule.find}
                    onChange={(e) => handleUpdateRule(idx, { find: e.target.value })}
                    className="flex-1 border border-slate-300 rounded px-2 py-0.8 text-[11.5px]"
                  />
                </div>
                <span className="text-slate-400">→</span>
                <div className="flex-1 flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="Replace with..."
                    value={rule.replace}
                    onChange={(e) => handleUpdateRule(idx, { replace: e.target.value })}
                    className="flex-1 border border-slate-300 rounded px-2 py-0.8 text-[11.5px]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveRule(idx)}
                  className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-4 text-slate-600">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!rule.caseSensitive}
                    onChange={(e) => handleUpdateRule(idx, { caseSensitive: e.target.checked })}
                    className="accent-[#0078d7]"
                  />
                  <span>Match Case</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!rule.wholeWord}
                    onChange={(e) => handleUpdateRule(idx, { wholeWord: e.target.checked })}
                    className="accent-[#0078d7]"
                  />
                  <span>Whole Word</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!rule.isRegex}
                    onChange={(e) => handleUpdateRule(idx, { isRegex: e.target.checked })}
                    className="accent-[#0078d7]"
                  />
                  <span>Regex Pattern</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ModalWrapper>
  );
};

// 7. SCRIPT MODAL
export const ScriptTransformModal: React.FC<SubModalBaseProps & { initial?: TransformConfig['script']; sampleRecord?: Record<string, any> }> = ({
  isOpen,
  onClose,
  title,
  onApply,
  initial,
  sampleRecord,
}) => {
  const [code, setCode] = useState<string>('');
  const [language, setLanguage] = useState<'javascript' | 'vbscript'>('javascript');
  const [sampleInput, setSampleInput] = useState<string>('SampleValue123');
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCode(initial?.code || (initial?.language === 'vbscript' ? 'Value = UCase(Value)' : 'return value;'));
      setLanguage(initial?.language || 'javascript');
      setTestResult(null);
    }
  }, [isOpen, initial]);

  if (!isOpen) return null;

  const activeRec = sampleRecord && Object.keys(sampleRecord).length > 0
    ? sampleRecord
    : { SKU: '000101', ProductName: 'Sample Product', Price: 500, BatchNo: 'B101', Stock: 20 };

  const handleTest = () => {
    try {
      if (language === 'vbscript') {
        const res = executeVBScript(code, {
          value: sampleInput,
          input: sampleInput,
          record: activeRec,
        });
        setTestResult(res.value);
      } else {
        const recordProxy = createRecordProxy(activeRec);
        const scope = {
          value: sampleInput,
          input: sampleInput,
          Value: sampleInput,
          Input: sampleInput,
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
        const out = fn(...Object.values(scope));
        setTestResult(String(out ?? ''));
      }
    } catch (err: any) {
      setTestResult(`[Error: ${err.message}]`);
    }
  };

  const handleOk = () => {
    onApply({ script: { language, code } });
    onClose();
  };

  return (
    <ModalWrapper title={title} onClose={onClose} onOk={handleOk} width="w-[580px]">
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-[11.5px] text-slate-700 font-medium flex items-center gap-1">
            <Code className="w-3.5 h-3.5 text-blue-600" />
            <span>Transform Script (Safe Sandboxed Execution):</span>
          </label>
          <select
            value={language}
            onChange={(e) => {
              const newLang = e.target.value as 'javascript' | 'vbscript';
              setLanguage(newLang);
              if (newLang === 'vbscript' && code === 'return value;') {
                setCode('Value = UCase(Value)');
              } else if (newLang === 'javascript' && code === 'Value = UCase(Value)') {
                setCode('return value.toUpperCase();');
              }
            }}
            className="border border-[#cbd5e1] rounded px-2 py-0.5 text-[11px] bg-white text-slate-800"
          >
            <option value="javascript">JavaScript Engine</option>
            <option value="vbscript">VBScript Emulator</option>
          </select>
        </div>

        <textarea
          rows={6}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={
            language === 'vbscript'
              ? 'Value = "LOT-" & UCase(Value)'
              : '// Return modified string e.g. return "LOT-" + value.toUpperCase();'
          }
          className="w-full border border-[#cbd5e1] rounded p-2 text-[11.5px] font-mono text-slate-900 bg-slate-50 focus:outline-[#0078d7]"
        />

        {/* Live Test Strip */}
        <div className="p-2 bg-slate-100 border border-slate-200 rounded text-[11px] space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-semibold">Test Input:</span>
            <input
              type="text"
              value={sampleInput}
              onChange={(e) => setSampleInput(e.target.value)}
              className="px-2 py-0.5 border border-slate-300 rounded bg-white text-slate-800 text-[11px] flex-1"
            />
            <button
              type="button"
              onClick={handleTest}
              className="px-2.5 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer"
            >
              <Play className="w-3 h-3" />
              <span>Test</span>
            </button>
          </div>
          {testResult !== null && (
            <div className="text-[11px] flex items-center gap-1.5">
              <span className="text-slate-600 font-semibold">Result:</span>
              <span className="font-mono font-bold text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                {testResult}
              </span>
            </div>
          )}
        </div>

        <div className="p-2 bg-slate-50 border border-slate-200 rounded text-[10.5px] text-slate-600">
          <span className="font-semibold">Available Scope:</span>{' '}
          <code>Value</code>, <code>Record("Field")</code>, <code>Date</code>, <code>Now</code>, <code>Time</code>, <code>DateAdd</code>, <code>FormatDateTime</code>, <code>UCase</code>, <code>Mid</code>, <code>InStr</code>.
        </div>
      </div>
    </ModalWrapper>
  );
};

// 8. PREFIX AND SUFFIX MODAL
export const PrefixSuffixModal: React.FC<SubModalBaseProps & { initial?: TransformConfig['prefixSuffix'] }> = ({
  isOpen,
  onClose,
  title,
  onApply,
  initial,
}) => {
  const [prefix, setPrefix] = useState<string>('');
  const [suffix, setSuffix] = useState<string>('');
  const [specialCharTarget, setSpecialCharTarget] = useState<'prefix' | 'suffix' | null>(null);
  const prefixInputRef = React.useRef<HTMLInputElement>(null);
  const suffixInputRef = React.useRef<HTMLInputElement>(null);
  const savedSelectionRef = React.useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  useEffect(() => {
    if (isOpen) {
      setPrefix(initial?.prefix || '');
      setSuffix(initial?.suffix || '');
    }
  }, [isOpen, initial]);

  if (!isOpen) return null;

  const handleOk = () => {
    onApply({ prefixSuffix: { prefix, suffix } });
    onClose();
  };

  const handleOpenSpecialCharacters = (target: 'prefix' | 'suffix') => {
    const input = target === 'prefix' ? prefixInputRef.current : suffixInputRef.current;
    const currentVal = target === 'prefix' ? prefix : suffix;
    const start = input ? input.selectionStart : (savedSelectionRef.current.start ?? currentVal.length);
    const end = input ? input.selectionEnd : (savedSelectionRef.current.end ?? currentVal.length);
    savedSelectionRef.current = { start: start ?? currentVal.length, end: end ?? currentVal.length };
    setSpecialCharTarget(target);
  };

  const handleInsertChar = (char: string) => {
    if (specialCharTarget === 'prefix') {
      const { value: nextVal, newCursor } = insertAtSelection(prefix, char, savedSelectionRef.current.start, savedSelectionRef.current.end);
      savedSelectionRef.current = { start: newCursor, end: newCursor };
      setPrefix(nextVal);
      setTimeout(() => {
        if (prefixInputRef.current) {
          try {
            prefixInputRef.current.focus();
            prefixInputRef.current.setSelectionRange(newCursor, newCursor);
          } catch {}
        }
      }, 0);
    } else if (specialCharTarget === 'suffix') {
      const { value: nextVal, newCursor } = insertAtSelection(suffix, char, savedSelectionRef.current.start, savedSelectionRef.current.end);
      savedSelectionRef.current = { start: newCursor, end: newCursor };
      setSuffix(nextVal);
      setTimeout(() => {
        if (suffixInputRef.current) {
          try {
            suffixInputRef.current.focus();
            suffixInputRef.current.setSelectionRange(newCursor, newCursor);
          } catch {}
        }
      }, 0);
    }
  };

  return (
    <ModalWrapper title={title} onClose={onClose} onOk={handleOk}>
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between">
            <label className="text-[11.5px] text-slate-600 font-medium">Prefix (Prepended before data):</label>
            <button
              type="button"
              title="Insert Symbols or Special Characters"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleOpenSpecialCharacters('prefix')}
              className="px-2 py-0.5 bg-[#f8fafc] hover:bg-[#e2e8f0] border border-[#94a3b8] rounded-xs text-[#003366] font-serif font-bold text-xs cursor-pointer shadow-2xs"
            >
              Ω
            </button>
          </div>
          <input
            ref={prefixInputRef}
            type="text"
            value={prefix}
            onChange={(e) => {
              setPrefix(e.target.value);
              savedSelectionRef.current = { start: e.target.selectionStart ?? e.target.value.length, end: e.target.selectionEnd ?? e.target.value.length };
            }}
            onSelect={(e) => {
              savedSelectionRef.current = { start: e.currentTarget.selectionStart ?? 0, end: e.currentTarget.selectionEnd ?? 0 };
            }}
            placeholder="e.g. SN- or LOT:"
            className="w-full mt-1 border border-[#cbd5e1] rounded px-2 py-1 text-[11.5px] text-slate-800 focus:outline-[#0078d7]"
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="text-[11.5px] text-slate-600 font-medium">Suffix (Appended after data):</label>
            <button
              type="button"
              title="Insert Symbols or Special Characters"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleOpenSpecialCharacters('suffix')}
              className="px-2 py-0.5 bg-[#f8fafc] hover:bg-[#e2e8f0] border border-[#94a3b8] rounded-xs text-[#003366] font-serif font-bold text-xs cursor-pointer shadow-2xs"
            >
              Ω
            </button>
          </div>
          <input
            ref={suffixInputRef}
            type="text"
            value={suffix}
            onChange={(e) => {
              setSuffix(e.target.value);
              savedSelectionRef.current = { start: e.target.selectionStart ?? e.target.value.length, end: e.target.selectionEnd ?? e.target.value.length };
            }}
            onSelect={(e) => {
              savedSelectionRef.current = { start: e.currentTarget.selectionStart ?? 0, end: e.currentTarget.selectionEnd ?? 0 };
            }}
            placeholder="e.g. /2026 or -A"
            className="w-full mt-1 border border-[#cbd5e1] rounded px-2 py-1 text-[11.5px] text-slate-800 focus:outline-[#0078d7]"
          />
        </div>
      </div>

      <SpecialCharacterModal
        isOpen={specialCharTarget !== null}
        onClose={() => setSpecialCharTarget(null)}
        onInsert={handleInsertChar}
      />
    </ModalWrapper>
  );
};

// Generic Windows Modal Wrapper Component
const ModalWrapper: React.FC<{
  title: string;
  onClose: () => void;
  onOk: () => void;
  width?: string;
  children: React.ReactNode;
}> = ({ title, onClose, onOk, width = 'w-[440px]', children }) => {
  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 font-sans select-none animate-in fade-in duration-100">
      <div
        className={`${width} max-w-full bg-[#f0f4f9] rounded-lg shadow-2xl border border-[#718096] flex flex-col overflow-hidden text-slate-800 text-[12px]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-[#d9e2ec] via-[#bcccdc] to-[#9fb3c8] border-b border-[#829ab1] px-3 py-1.5 flex items-center justify-between">
          <span className="font-semibold text-slate-900 text-[12.5px]">{title}</span>
          <button
            onClick={onClose}
            className="w-7 h-5 flex items-center justify-center bg-[#e03131] hover:bg-[#c92a2a] text-white rounded-xs shadow-xs cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-4 bg-white min-h-[160px]">{children}</div>

        <div className="border-t border-[#cbd5e1] bg-[#f1f5f9] px-3 py-2 flex items-center justify-end gap-2">
          <button
            onClick={onOk}
            className="px-4 py-1 bg-[#0078d7] hover:bg-[#0063b1] text-white font-medium rounded text-[11.5px] shadow-2xs cursor-pointer"
          >
            OK
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1 border border-[#94a3b8] hover:bg-slate-200 text-slate-700 font-medium rounded text-[11.5px] cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
