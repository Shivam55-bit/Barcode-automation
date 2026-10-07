import React, { useState, useMemo } from 'react';
import {
  DataSourceItem,
  NamedDataSource,
  CalculatedFieldDefinition,
  VariableDefinition,
  LabelElement,
  EvaluationContext,
} from '../../types';
import { DatabaseFieldSourceConfig } from './DatabaseFieldSourceConfig';
import { FieldPickerModal } from './FieldPickerModal';
import { FormulaBuilderModal } from './FormulaBuilderModal';
import { evaluateDataSourceItem } from '../../services/dataSourceEngine';
import { CONTROL_CHARACTERS } from '../../services/symbolService';
import { getControlByToken, getControlByCode } from '../../services/controlCharacterService';
import {
  Clock,
  Calculator,
  Code,
  Box,
  Globe,
  FileText,
  Printer,
  Sparkles,
  Database,
  CheckCircle2,
  AlertCircle,
  Hash,
  Sliders,
} from 'lucide-react';

export interface ProfessionalDataSourceConfigProps {
  dataSource: DataSourceItem;
  onUpdate: (updates: Partial<DataSourceItem>) => void;
  datasets?: any[];
  currentRecord?: Record<string, any>;
  currentConnection?: any;
  onConnectDataset?: (dataset: any) => void;
  namedDataSources?: NamedDataSource[];
  calculatedFields?: CalculatedFieldDefinition[];
  availableVariables?: VariableDefinition[];
  elements?: LabelElement[];
  globalData?: Record<string, any>;
  currentRecordIndex?: number;
  totalRecords?: number;
  printerName?: string;
  jobId?: string;
  jobName?: string;
  onOpenSpecialCharacters?: () => void;
  onOpenScriptEditor?: () => void;
  isBarcodeContext?: boolean;
  embeddedValueRef?: React.RefObject<HTMLTextAreaElement | null>;
  onSelectionChange?: (start: number, end: number) => void;
}

export const ProfessionalDataSourceConfig: React.FC<ProfessionalDataSourceConfigProps> = ({
  dataSource,
  onUpdate,
  datasets = [],
  currentRecord = {},
  currentConnection,
  onConnectDataset,
  namedDataSources = [],
  calculatedFields = [],
  availableVariables = [],
  elements = [],
  globalData = {},
  currentRecordIndex = 0,
  totalRecords = 1,
  printerName = 'Default Zebra ZT410',
  jobId = 'JOB-001',
  jobName = 'PrintJob_1',
  onOpenSpecialCharacters,
  onOpenScriptEditor,
  isBarcodeContext = false,
  embeddedValueRef,
  onSelectionChange,
}) => {
  const [isFieldPickerOpen, setIsFieldPickerOpen] = useState(false);
  const [fieldPickerTarget, setFieldPickerTarget] = useState<string>('formula');
  const [isFormulaModalOpen, setIsFormulaModalOpen] = useState(false);

  // Available database field columns
  const availableColumns = useMemo(() => {
    if (currentConnection?.fields && currentConnection.fields.length > 0) {
      return currentConnection.fields;
    }
    if (currentRecord && Object.keys(currentRecord || {}).length > 0) {
      return Object.keys(currentRecord || {});
    }
    if (datasets.length > 0 && datasets[0].columns) {
      return datasets[0].columns;
    }
    return [];
  }, [currentConnection, currentRecord, datasets]);

  // Central Evaluation Context for Live Preview
  const evalContext: EvaluationContext = useMemo(() => {
    return {
      record: currentRecord,
      datasets,
      variables: availableVariables,
      namedDataSources,
      calculatedFields,
      elements,
      currentRecordIndex,
      totalRecords,
      printerName,
      jobId,
      jobName,
      globalData,
      resolutionStack: new Set<string>(),
    };
  }, [
    currentRecord,
    datasets,
    availableVariables,
    namedDataSources,
    calculatedFields,
    elements,
    currentRecordIndex,
    totalRecords,
    printerName,
    jobId,
    jobName,
    globalData,
  ]);

  // Live evaluated preview value
  const livePreview = useMemo(() => {
    try {
      return evaluateDataSourceItem(dataSource, evalContext);
    } catch (err: any) {
      return `[Preview Error: ${err.message}]`;
    }
  }, [dataSource, evalContext]);

  const handleFieldSelected = (insertedText: string, metadata: { category: string; name: string }) => {
    if (fieldPickerTarget === 'formula') {
      const prev = dataSource.formulaExpression || dataSource.value || '';
      const updated = prev ? `${prev} + ${insertedText}` : insertedText;
      onUpdate({ formulaExpression: updated, value: updated });
    } else if (fieldPickerTarget === 'clock_days') {
      onUpdate({
        dateOffsetDaysSource: 'database_field',
        dateOffsetDaysField: metadata.name,
      });
    } else if (fieldPickerTarget === 'clock_months') {
      onUpdate({
        dateOffsetMonthsSource: 'database_field',
        dateOffsetMonthsField: metadata.name,
      });
    } else if (fieldPickerTarget === 'clock_years') {
      onUpdate({
        dateOffsetYearsSource: 'database_field',
        dateOffsetYearsField: metadata.name,
      });
    } else if (fieldPickerTarget === 'script') {
      const prev = dataSource.scriptCode || '';
      const updated = prev ? `${prev}\n${insertedText}` : insertedText;
      onUpdate({ scriptCode: updated });
    } else if (fieldPickerTarget === 'global') {
      onUpdate({ globalField: metadata.name });
    }
  };

  return (
    <div className="space-y-3.5 text-[12px]">
      {/* Source Type Selector */}
      <div className="flex items-center justify-between gap-3">
        <label className="w-28 text-slate-700 font-semibold flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-blue-600" />
          Source Type:
        </label>
        <select
          value={dataSource.type || 'embedded'}
          onChange={(e) => {
            const nextType = e.target.value as any;
            if (nextType === 'control-character') {
              onUpdate({
                type: 'control-character',
                name: '<CR>',
                controlCode: 'CR',
                code: 'CR',
                decimal: 13,
                hex: '0D',
                value: '<CR>',
              });
            } else {
              onUpdate({ type: nextType });
            }
          }}
          className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2.5 py-1 text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
        >
          <option value="embedded">💾 Embedded Data</option>
          <option value="control-character">🔣 Control Character</option>
          <option value="database-field">🗄️ Database Field</option>
          <option value="clock">🕒 Date / Time (Clock with Dynamic Offsets)</option>
          <option value="formula">📐 Formula Expression</option>
          <option value="variable">🔖 Named Data Source / Variable</option>
          <option value="global">🌐 Global Data Field</option>
          <option value="object">📦 Object Value (Reference Another Object)</option>
          <option value="external_file">📄 External File (Text / CSV)</option>
          <option value="print_job">🖨️ Print Job Data</option>
          <option value="script">⚡ Standalone Script (VBScript / JavaScript)</option>
          <option value="serial">🔢 Serialization / Counter</option>
          <option value="system">⚙️ System Variable</option>
          {isBarcodeContext && (
            <>
              <option value="gs1_ai">🌐 GS1 Application Identifier (AI)</option>
              <option value="gs1_composite">🧩 GS1 Composite Data Source</option>
              <option value="gs1_databar">📊 GS1 DataBar Data Source</option>
            </>
          )}
        </select>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. EMBEDDED DATA                                              */}
      {/* ------------------------------------------------------------- */}
      {dataSource.type === 'embedded' && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-slate-700 font-medium">Embedded Constant Value:</label>
            {onOpenSpecialCharacters && (
              <button
                type="button"
                onMouseDown={(e) => {
                  // Prevent textarea from blurring before we capture selection
                  e.preventDefault();
                }}
                onClick={() => onOpenSpecialCharacters()}
                className="px-2 py-0.5 bg-[#f8fafc] hover:bg-[#e2e8f0] border border-[#94a3b8] rounded-xs text-[#003366] font-serif font-bold text-xs cursor-pointer shadow-2xs flex items-center gap-1"
              >
                <span>Ω</span>
                <span className="font-sans font-normal text-[10.5px] text-slate-700">Special Characters...</span>
              </button>
            )}
          </div>
          <textarea
            ref={embeddedValueRef}
            rows={4}
            value={dataSource.value || ''}
            onChange={(e) => {
              onUpdate({ value: e.target.value });
              onSelectionChange?.(e.target.selectionStart, e.target.selectionEnd);
            }}
            onSelect={(e) => {
              onSelectionChange?.(e.currentTarget.selectionStart, e.currentTarget.selectionEnd);
            }}
            onKeyUp={(e) => {
              onSelectionChange?.(e.currentTarget.selectionStart, e.currentTarget.selectionEnd);
            }}
            onMouseUp={(e) => {
              onSelectionChange?.(e.currentTarget.selectionStart, e.currentTarget.selectionEnd);
            }}
            className="w-full bg-white border border-[#94a3b8] rounded-xs p-2.5 font-mono text-[12px] text-slate-900 outline-none focus:ring-1 focus:ring-blue-600 resize-none"
            placeholder="Enter static text, numbers, dates, or multiline value..."
          />
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 1b. CONTROL CHARACTER                                         */}
      {/* ------------------------------------------------------------- */}
      {dataSource.type === 'control-character' && (() => {
        const curCode = dataSource.controlCode || dataSource.code || (dataSource.value ? dataSource.value.replace(/[«»<>]/g, '') : 'CR');
        const activeDef = getControlByToken(curCode) || CONTROL_CHARACTERS.find((c) => c.abbr === curCode) || CONTROL_CHARACTERS.find((c) => c.abbr === 'CR')!;
        return (
          <div className="space-y-3 p-3 bg-slate-50 border border-slate-300 rounded-xs">
            <div className="flex items-center justify-between">
              <label className="text-slate-800 font-bold flex items-center gap-1.5">
                <span className="font-mono text-blue-600 font-extrabold text-sm">«»</span>
                Control Character:
              </label>
              {onOpenSpecialCharacters && (
                <button
                  type="button"
                  onClick={() => onOpenSpecialCharacters()}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-[#94a3b8] rounded-xs text-[#003366] font-semibold text-xs cursor-pointer shadow-2xs flex items-center gap-1"
                >
                  <span>Ω</span>
                  <span>Browse Characters...</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11.5px]">
              <div>
                <label className="text-slate-600 font-medium block mb-1">Standard Code:</label>
                <select
                  value={activeDef.abbr}
                  onChange={(e) => {
                    const sel = CONTROL_CHARACTERS.find((c) => c.abbr === e.target.value);
                    if (sel) {
                      onUpdate({
                        controlCode: sel.abbr,
                        code: sel.abbr,
                        decimal: sel.code,
                        hex: sel.hex,
                        value: `<${sel.abbr}>`,
                        name: `<${sel.abbr}>`,
                      });
                    }
                  }}
                  className="w-full bg-white border border-[#94a3b8] rounded-xs px-2 py-1 font-mono font-bold text-slate-900"
                >
                  {CONTROL_CHARACTERS.map((c) => (
                    <option key={c.abbr} value={c.abbr}>
                      {c.abbr} — {c.name} (ASCII {c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-600 font-medium block mb-1">Editor / Tree Label:</label>
                <input
                  type="text"
                  readOnly
                  value={`<${activeDef.abbr}>`}
                  className="w-full bg-slate-100 border border-slate-300 rounded-xs px-2 py-1 font-mono font-bold text-blue-700"
                />
              </div>
            </div>

            <div className="p-2.5 bg-white border border-slate-200 rounded text-[11.5px] space-y-1">
              <div className="flex items-center justify-between text-slate-700">
                <span>Character Name:</span>
                <strong className="text-slate-900">{activeDef.name}</strong>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span>ASCII Decimal / Hex:</span>
                <span className="font-mono font-semibold">{activeDef.code} / 0x{activeDef.hex}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span>Runtime Value:</span>
                <span className="font-mono text-emerald-700 font-bold">
                  {activeDef.abbr === 'CR' ? '\\r (Carriage Return)' : activeDef.abbr === 'LF' ? '\\n (Line Feed)' : activeDef.abbr === 'HT' ? '\\t (Tab)' : `ASCII ${activeDef.code}`}
                </span>
              </div>
              {activeDef.abbr === 'CR' || activeDef.abbr === 'LF' ? (
                <p className="text-[11px] text-blue-700 pt-1 font-medium">
                  ✓ Causes a line break in Multi-line Text without printing visible &lt;CR&gt; text on the canvas.
                </p>
              ) : null}
            </div>
          </div>
        );
      })()}

      {/* ------------------------------------------------------------- */}
      {/* 2. DATABASE FIELD                                             */}
      {/* ------------------------------------------------------------- */}
      {(dataSource.type === 'database-field' || dataSource.type === 'database') && (
        <DatabaseFieldSourceConfig
          dataSource={dataSource}
          onUpdate={onUpdate}
          datasets={datasets}
          currentRecord={currentRecord}
          currentConnection={currentConnection}
          onConnectDatasetToTemplate={onConnectDataset}
        />
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. CLOCK / DATE-TIME WITH DYNAMIC OFFSETS                     */}
      {/* ------------------------------------------------------------- */}
      {dataSource.type === 'clock' && (
        <div className="space-y-3 p-3 bg-blue-50/40 border border-blue-200 rounded-sm">
          <div className="flex items-center justify-between border-b border-blue-200 pb-2">
            <div className="flex items-center gap-1.5 font-bold text-blue-950 text-xs">
              <Clock className="w-4 h-4 text-blue-700" />
              <span>Professional Clock Data Source</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-semibold text-slate-600">Base:</label>
              <select
                value={dataSource.clockBase || 'date'}
                onChange={(e) => onUpdate({ clockBase: e.target.value as any })}
                className="bg-white border border-slate-300 rounded px-2 py-0.5 text-[11px]"
              >
                <option value="date">Current Date</option>
                <option value="time">Current Time</option>
                <option value="datetime">Current Date & Time</option>
                <option value="database_field">Database Field</option>
              </select>
              {dataSource.clockBase === 'database_field' && (
                <select
                  value={dataSource.clockBaseField || ''}
                  onChange={(e) => onUpdate({ clockBaseField: e.target.value })}
                  className="bg-white border border-slate-300 rounded px-2 py-0.5 text-[11px] font-semibold text-emerald-800"
                >
                  <option value="">-- Select Field --</option>
                  {availableColumns.map((col) => (
                    <option key={col} value={col}>
                      {col} {currentRecord[col] !== undefined ? `(${currentRecord[col]})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Format Mask */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-700">Date/Time Format Mask:</label>
              <div className="flex gap-1">
                {['DD-MM-YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'HH:mm:ss'].map((mask) => (
                  <button
                    key={mask}
                    type="button"
                    onClick={() => onUpdate({ dateFormat: mask })}
                    className="px-1.5 py-0.5 text-[10px] font-mono bg-white hover:bg-blue-100 border border-slate-300 rounded text-slate-700 cursor-pointer"
                  >
                    {mask}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              value={dataSource.dateFormat || 'YYYY-MM-DD'}
              onChange={(e) => onUpdate({ dateFormat: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 font-mono text-[11.5px]"
              placeholder="e.g. DD-MM-YYYY or YYYY-MM-DD HH:mm:ss"
            />
          </div>

          {/* Dynamic Offsets */}
          <div className="space-y-2 pt-1">
            <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
              Dynamic Offsets (Handled Without Scripting)
            </div>

            {/* Days Offset */}
            <div className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded border border-slate-200">
              <span className="col-span-3 font-medium text-slate-700 text-[11.5px]">Offset Days:</span>
              <select
                value={dataSource.dateOffsetDaysSource || 'fixed'}
                onChange={(e) => onUpdate({ dateOffsetDaysSource: e.target.value as any })}
                className="col-span-4 bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-[11px]"
              >
                <option value="fixed">Fixed Value</option>
                <option value="database_field">Database Field</option>
                <option value="formula">Formula</option>
                <option value="named_source">Named Source</option>
              </select>

              {dataSource.dateOffsetDaysSource === 'database_field' ? (
                <div className="col-span-5 flex gap-1">
                  <select
                    value={dataSource.dateOffsetDaysField || ''}
                    onChange={(e) => onUpdate({ dateOffsetDaysField: e.target.value })}
                    className="flex-1 bg-white border border-slate-300 rounded px-1.5 py-1 text-[11px] font-semibold text-emerald-800"
                  >
                    <option value="">-- Select Field --</option>
                    {availableColumns.map((col) => (
                      <option key={col} value={col}>
                        {col} {currentRecord[col] !== undefined ? `(${currentRecord[col]})` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    title="Pick Field"
                    onClick={() => {
                      setFieldPickerTarget('clock_days');
                      setIsFieldPickerOpen(true);
                    }}
                    className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-bold cursor-pointer"
                  >
                    Pick
                  </button>
                </div>
              ) : dataSource.dateOffsetDaysSource === 'formula' ? (
                <input
                  type="text"
                  placeholder="e.g. [ShelfLife] / 2"
                  value={dataSource.dateOffsetDaysField || ''}
                  onChange={(e) => onUpdate({ dateOffsetDaysField: e.target.value })}
                  className="col-span-5 bg-white border border-slate-300 rounded px-2 py-1 font-mono text-[11px]"
                />
              ) : dataSource.dateOffsetDaysSource === 'named_source' ? (
                <select
                  value={dataSource.dateOffsetDaysField || ''}
                  onChange={(e) => onUpdate({ dateOffsetDaysField: e.target.value })}
                  className="col-span-5 bg-white border border-slate-300 rounded px-1.5 py-1 text-[11px]"
                >
                  <option value="">-- Select Named Source --</option>
                  {namedDataSources.map((n) => (
                    <option key={n.name} value={n.name}>
                      {n.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  value={dataSource.dateOffsetDays ?? 0}
                  onChange={(e) => onUpdate({ dateOffsetDays: parseInt(e.target.value, 10) || 0 })}
                  className="col-span-5 bg-white border border-slate-300 rounded px-2 py-1 font-mono text-[11.5px]"
                />
              )}
            </div>

            {/* Months Offset */}
            <div className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded border border-slate-200">
              <span className="col-span-3 font-medium text-slate-700 text-[11.5px]">Offset Months:</span>
              <select
                value={dataSource.dateOffsetMonthsSource || 'fixed'}
                onChange={(e) => onUpdate({ dateOffsetMonthsSource: e.target.value as any })}
                className="col-span-4 bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-[11px]"
              >
                <option value="fixed">Fixed Value</option>
                <option value="database_field">Database Field</option>
                <option value="formula">Formula</option>
                <option value="named_source">Named Source</option>
              </select>

              {dataSource.dateOffsetMonthsSource === 'database_field' ? (
                <select
                  value={dataSource.dateOffsetMonthsField || ''}
                  onChange={(e) => onUpdate({ dateOffsetMonthsField: e.target.value })}
                  className="col-span-5 bg-white border border-slate-300 rounded px-1.5 py-1 text-[11px] font-semibold text-emerald-800"
                >
                  <option value="">-- Select Field --</option>
                  {availableColumns.map((col) => (
                    <option key={col} value={col}>
                      {col} {currentRecord[col] !== undefined ? `(${currentRecord[col]})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  value={dataSource.dateOffsetMonths ?? 0}
                  onChange={(e) => onUpdate({ dateOffsetMonths: parseInt(e.target.value, 10) || 0 })}
                  className="col-span-5 bg-white border border-slate-300 rounded px-2 py-1 font-mono text-[11.5px]"
                />
              )}
            </div>

            {/* Years Offset */}
            <div className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded border border-slate-200">
              <span className="col-span-3 font-medium text-slate-700 text-[11.5px]">Offset Years:</span>
              <select
                value={dataSource.dateOffsetYearsSource || 'fixed'}
                onChange={(e) => onUpdate({ dateOffsetYearsSource: e.target.value as any })}
                className="col-span-4 bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-[11px]"
              >
                <option value="fixed">Fixed Value</option>
                <option value="database_field">Database Field</option>
                <option value="formula">Formula</option>
                <option value="named_source">Named Source</option>
              </select>

              {dataSource.dateOffsetYearsSource === 'database_field' ? (
                <select
                  value={dataSource.dateOffsetYearsField || ''}
                  onChange={(e) => onUpdate({ dateOffsetYearsField: e.target.value })}
                  className="col-span-5 bg-white border border-slate-300 rounded px-1.5 py-1 text-[11px] font-semibold text-emerald-800"
                >
                  <option value="">-- Select Field --</option>
                  {availableColumns.map((col) => (
                    <option key={col} value={col}>
                      {col} {currentRecord[col] !== undefined ? `(${currentRecord[col]})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  value={dataSource.dateOffsetYears ?? 0}
                  onChange={(e) => onUpdate({ dateOffsetYears: parseInt(e.target.value, 10) || 0 })}
                  className="col-span-5 bg-white border border-slate-300 rounded px-2 py-1 font-mono text-[11.5px]"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. FORMULA EXPRESSION                                         */}
      {/* ------------------------------------------------------------- */}
      {dataSource.type === 'formula' && (
        <div className="space-y-2 p-3 bg-amber-50/40 border border-amber-200 rounded-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-amber-950 text-xs">
              <Calculator className="w-4 h-4 text-amber-700" />
              <span>Formula & Calculated Expression</span>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setFieldPickerTarget('formula');
                  setIsFieldPickerOpen(true);
                }}
                className="px-2 py-1 bg-white hover:bg-amber-100 border border-amber-300 rounded text-[11px] font-medium text-amber-900 cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <Sparkles className="w-3 h-3 text-amber-600" />
                Insert Field...
              </button>
              <button
                type="button"
                onClick={() => setIsFormulaModalOpen(true)}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-semibold cursor-pointer shadow-2xs"
              >
                Formula Assistant...
              </button>
            </div>
          </div>

          <textarea
            rows={3}
            value={dataSource.formulaExpression || dataSource.value || ''}
            onChange={(e) => onUpdate({ formulaExpression: e.target.value, value: e.target.value })}
            placeholder='e.g. {{Price}} * 1.18 or IF({{Stock}} <= 0, "OUT OF STOCK", "IN STOCK")'
            className="w-full bg-white border border-amber-300 rounded p-2.5 font-mono text-[12px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
          />

          <div className="text-[10.5px] text-slate-500">
            Supports arithmetic (<code className="font-mono text-slate-700">+ - * / %</code>), conditionals (
            <code className="font-mono text-slate-700">IF</code>), functions (<code className="font-mono text-slate-700">ROUND, ADDDAYS, CONCAT</code>).
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. NAMED DATA SOURCE                                          */}
      {/* ------------------------------------------------------------- */}
      {dataSource.type === 'variable' && (
        <div className="space-y-2 p-3 bg-purple-50/40 border border-purple-200 rounded-sm">
          <label className="text-slate-700 font-semibold flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-purple-600" />
            Named Data Source / Shared Variable:
          </label>
          <select
            value={dataSource.namedSourceId || dataSource.variableName || ''}
            onChange={(e) => onUpdate({ namedSourceId: e.target.value, variableName: e.target.value })}
            className="w-full bg-white border border-purple-300 rounded px-2.5 py-1.5 text-slate-900 font-semibold"
          >
            <option value="">-- Select Named Data Source --</option>
            {namedDataSources.map((n) => (
              <option key={n.id || n.name} value={n.id || n.name}>
                {n.name} {n.databaseField ? `(Bound to [${n.databaseField}])` : `("${n.defaultValue || ''}")`}
              </option>
            ))}
            {availableVariables.map((v) => (
              <option key={v.id || v.name} value={v.id || v.name}>
                {v.name} ({v.type}: {v.defaultValue || ''})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. GLOBAL DATA FIELD                                          */}
      {/* ------------------------------------------------------------- */}
      {dataSource.type === 'global' && (
        <div className="space-y-2 p-3 bg-indigo-50/40 border border-indigo-200 rounded-sm">
          <div className="flex items-center justify-between">
            <label className="text-slate-700 font-semibold flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-600" />
              Global Data Field (Document-wide):
            </label>
            <button
              type="button"
              onClick={() => {
                setFieldPickerTarget('global');
                setIsFieldPickerOpen(true);
              }}
              className="px-2 py-0.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-900 rounded text-[11px] font-medium cursor-pointer"
            >
              Browse Globals...
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10.5px] text-slate-500 font-medium">Field Identifier:</label>
              <input
                type="text"
                placeholder="e.g. CompanyName, FactoryCode"
                value={dataSource.globalField || dataSource.value || ''}
                onChange={(e) => onUpdate({ globalField: e.target.value, value: e.target.value })}
                className="w-full bg-white border border-indigo-300 rounded px-2 py-1 font-mono text-[11.5px]"
              />
            </div>
            <div>
              <label className="text-[10.5px] text-slate-500 font-medium">Default Fallback:</label>
              <input
                type="text"
                placeholder="e.g. Acme Corp"
                value={dataSource.value || ''}
                onChange={(e) => onUpdate({ value: e.target.value })}
                className="w-full bg-white border border-indigo-300 rounded px-2 py-1 text-[11.5px]"
              />
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 7. OBJECT VALUE (REFERENCE ANOTHER OBJECT)                    */}
      {/* ------------------------------------------------------------- */}
      {(dataSource.type === 'object' || dataSource.type === 'linked') && (
        <div className="space-y-2 p-3 bg-teal-50/40 border border-teal-200 rounded-sm">
          <div className="flex items-center gap-1.5 font-bold text-teal-950 text-xs">
            <Box className="w-4 h-4 text-teal-700" />
            <span>Object Value (Reference Another Template Object)</span>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-700">Target Object:</label>
            <select
              value={dataSource.linkedObjectId || ''}
              onChange={(e) => onUpdate({ linkedObjectId: e.target.value })}
              className="w-full bg-white border border-teal-300 rounded px-2 py-1.5 text-slate-900 font-medium"
            >
              <option value="">-- Select Template Object --</option>
              {elements.map((el) => (
                <option key={el.id} value={el.id}>
                  {el.name || `${el.type}_${el.id.slice(0, 6)}`} ({el.type})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 8. EXTERNAL FILE                                              */}
      {/* ------------------------------------------------------------- */}
      {dataSource.type === 'external_file' && (
        <div className="space-y-2 p-3 bg-slate-100 border border-slate-300 rounded-sm">
          <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
            <FileText className="w-4 h-4 text-slate-700" />
            <span>External File Data Source</span>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-700">File Path / Safe Relative Path:</label>
            <input
              type="text"
              placeholder="e.g. C:\Data\BatchNotes.txt or ./data/info.csv"
              value={dataSource.filePath || dataSource.value || ''}
              onChange={(e) => onUpdate({ filePath: e.target.value, value: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-mono text-[11.5px]"
            />
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 9. PRINT JOB DATA                                             */}
      {/* ------------------------------------------------------------- */}
      {dataSource.type === 'print_job' && (
        <div className="space-y-2 p-3 bg-sky-50/40 border border-sky-200 rounded-sm">
          <div className="flex items-center gap-1.5 font-bold text-sky-950 text-xs">
            <Printer className="w-4 h-4 text-sky-700" />
            <span>Print Job Runtime Information</span>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-700">Print Field:</label>
            <select
              value={dataSource.printJobField || 'job_name'}
              onChange={(e) => onUpdate({ printJobField: e.target.value as any })}
              className="w-full bg-white border border-sky-300 rounded px-2.5 py-1 text-slate-900 font-semibold"
            >
              <option value="job_name">PrintJobName (Active Job Identifier)</option>
              <option value="printer_name">PrinterName (Target Device)</option>
              <option value="copies">Copies (Requested Quantity)</option>
              <option value="record_number">RecordNumber (1-based Current Record)</option>
              <option value="total_records">TotalRecords (Batch Record Count)</option>
              <option value="timestamp">PrintTimestamp (Execution Date/Time)</option>
            </select>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 10. SCRIPT ENGINE (STANDALONE)                                */}
      {/* ------------------------------------------------------------- */}
      {dataSource.type === 'script' && (
        <div className="space-y-2.5 p-3 bg-slate-900 text-slate-100 rounded-sm border border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-emerald-400 text-xs">
              <Code className="w-4 h-4 text-emerald-400" />
              <span>Visual Basic Script Data Source</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={dataSource.scriptLanguage || 'javascript'}
                onChange={(e) => onUpdate({ scriptLanguage: e.target.value as any })}
                className="bg-slate-800 text-white border border-slate-600 rounded px-2 py-0.5 text-[11px] font-semibold"
              >
                <option value="javascript">JavaScript</option>
                <option value="vbscript">VBScript Emulator</option>
              </select>
              <select
                aria-label="Script mode"
                value={dataSource.scriptMode || 'multiline'}
                onChange={(e) => onUpdate({ scriptMode: e.target.value as 'expression' | 'multiline' })}
                className="bg-slate-800 text-white border border-slate-600 rounded px-2 py-0.5 text-[11px] font-semibold"
              >
                <option value="expression">Single-Line Expression</option>
                <option value="multiline">Multi-Line Script</option>
              </select>
              {onOpenScriptEditor && (
                <button
                  type="button"
                  onClick={onOpenScriptEditor}
                  className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-[10.5px] font-bold cursor-pointer whitespace-nowrap"
                >
                  Edit with Script Editor
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setFieldPickerTarget('script');
                  setIsFieldPickerOpen(true);
                }}
                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10.5px] font-bold cursor-pointer"
              >
                + Insert Field
              </button>
            </div>
          </div>

          <textarea
            rows={5}
            value={dataSource.scriptCode || dataSource.value || ''}
            onChange={(e) => onUpdate({ scriptCode: e.target.value, value: e.target.value })}
            placeholder={
              dataSource.scriptMode === 'expression'
                ? '"Sample Text"'
                : dataSource.scriptLanguage === 'vbscript'
                  ? 'Value = DateAdd("d", Record("ExpiryDays"), Date)'
                  : 'return "EXP: " + Record("ExpiryDays");'
            }
            className="w-full bg-slate-950 text-emerald-400 font-mono text-[11.5px] p-2.5 rounded border border-slate-700 outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
          />

          <div className="text-[10.5px] text-slate-400">
            {dataSource.scriptMode === 'expression'
              ? 'Single-Line Expression: evaluate one expression as this source output.'
              : dataSource.scriptLanguage === 'vbscript'
                ? 'VBScript: Value = DateAdd("d", Record("ExpiryDays"), Date) or Value = UCase(Record("ProductName"))'
                : 'JavaScript: return Record("ProductName") + " (" + Record("SKU") + ")";'}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 11. SERIAL NUMBER / COUNTER                                   */}
      {/* ------------------------------------------------------------- */}
      {dataSource.type === 'serial' && (
        <div className="space-y-3 p-3 bg-slate-50 border border-slate-200 rounded-sm">
          <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
            <Hash className="w-4 h-4 text-blue-600" />
            <span>Serialization Counter</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <label className="w-20 text-slate-700 font-medium">Start Value:</label>
              <input
                type="number"
                value={dataSource.serialStart ?? 1}
                onChange={(e) => onUpdate({ serialStart: parseInt(e.target.value, 10) || 1 })}
                className="flex-1 bg-white border border-[#94a3b8] rounded px-2 py-1 font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="w-16 text-slate-700 font-medium">Step:</label>
              <input
                type="number"
                value={dataSource.serialStep ?? 1}
                onChange={(e) => onUpdate({ serialStep: parseInt(e.target.value, 10) || 1 })}
                className="flex-1 bg-white border border-[#94a3b8] rounded px-2 py-1 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <label className="w-20 text-slate-700 font-medium">Zero Pad:</label>
              <input
                type="number"
                value={dataSource.serialPad ?? 0}
                onChange={(e) => onUpdate({ serialPad: parseInt(e.target.value, 10) || 0 })}
                className="flex-1 bg-white border border-[#94a3b8] rounded px-2 py-1 font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="w-16 text-slate-700 font-medium">Prefix:</label>
              <input
                type="text"
                placeholder="SN-"
                value={dataSource.serialPrefix || ''}
                onChange={(e) => onUpdate({ serialPrefix: e.target.value })}
                className="flex-1 bg-white border border-[#94a3b8] rounded px-2 py-1 font-mono"
              />
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 12. SYSTEM VARIABLE                                           */}
      {/* ------------------------------------------------------------- */}
      {dataSource.type === 'system' && (
        <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-sm">
          <label className="w-28 text-slate-700 font-medium">System Variable:</label>
          <select
            value={dataSource.systemVarName || 'SYSTEM.DATE'}
            onChange={(e) => onUpdate({ systemVarName: e.target.value as any })}
            className="flex-1 bg-white border border-[#94a3b8] rounded px-2.5 py-1 text-slate-900 font-mono font-semibold"
          >
            <option value="SYSTEM.DATE">SYSTEM.DATE (Current Date)</option>
            <option value="SYSTEM.TIME">SYSTEM.TIME (Current Time)</option>
            <option value="SYSTEM.USER">SYSTEM.USER (Operator / User)</option>
            <option value="SYSTEM.PRINTER">SYSTEM.PRINTER (Active Printer)</option>
            <option value="SYSTEM.JOB_ID">SYSTEM.JOB_ID (Print Job ID)</option>
            <option value="SYSTEM.RECORD_NUMBER">SYSTEM.RECORD_NUMBER (Active Record Index)</option>
            <option value="SYSTEM.TOTAL_RECORDS">SYSTEM.TOTAL_RECORDS (Total Records)</option>
          </select>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* UNIVERSAL LIVE PREVIEW CARD (PHASE 28)                        */}
      {/* ------------------------------------------------------------- */}
      <div className="mt-2 p-2.5 bg-slate-900 text-white rounded-md border border-slate-700 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {livePreview.startsWith('[') && livePreview.includes('Error') ? (
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <div className="space-y-0.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Selected Source Output (Active Record #{currentRecordIndex + 1})
            </div>
            <div className="font-mono text-sm font-bold text-emerald-300 truncate max-w-md">
              {dataSource.type === 'control-character' ? (
                <span className="text-emerald-400">
                  Non-printing control character &lt;{dataSource.controlCode || dataSource.code || (dataSource.value ? dataSource.value.replace(/[«»<>]/g, '') : 'CR')}&gt; (Runtime: \r, ASCII 13, Hex 0x0D)
                </span>
              ) : livePreview ? (
                livePreview
              ) : (
                <span className="text-slate-500 italic">&lt;empty&gt;</span>
              )}
            </div>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10.5px] px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300 font-mono">
            {dataSource.type}
          </span>
        </div>
      </div>

      {/* Modals: Field Picker & Formula Assistant */}
      <FieldPickerModal
        isOpen={isFieldPickerOpen}
        onClose={() => setIsFieldPickerOpen(false)}
        onSelectField={handleFieldSelected}
        formatMode={fieldPickerTarget === 'script' ? (dataSource.scriptLanguage === 'vbscript' ? 'vbscript' : 'javascript') : 'token'}
        availableFields={availableColumns}
        namedDataSources={namedDataSources}
        calculatedFields={calculatedFields}
        elements={elements}
        globalData={globalData}
        sampleRecord={currentRecord}
      />

      <FormulaBuilderModal
        isOpen={isFormulaModalOpen}
        onClose={() => setIsFormulaModalOpen(false)}
        initialExpression={dataSource.formulaExpression || dataSource.value || ''}
        onApplyFormula={(expr) => onUpdate({ formulaExpression: expr, value: expr })}
        sampleRecord={currentRecord}
        availableFields={availableColumns}
        namedDataSources={namedDataSources}
      />
    </div>
  );
};
export default ProfessionalDataSourceConfig;
