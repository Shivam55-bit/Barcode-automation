import React, { useState, useEffect, useMemo } from 'react';
import { SerializationConfig, DynamicValueSource } from '../../types';
import { generatePreviewSequence, PreviewSequenceItem, AtomicSerialReservationService } from '../../services/serializationEngine';
import { apiService } from '../../services/apiService';
import { PrintQuantityOptionsModal } from './PrintQuantityOptionsModal';
import { X, Eye, HelpCircle } from 'lucide-react';

interface SerializationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (config: SerializationConfig) => void;
  initialConfig?: SerializationConfig;
  initialValue?: string;
  prefix?: string;
  suffix?: string;
  recordCount?: number;
  datasets?: any[];
  currentRecord?: Record<string, any>;
  availableVariables?: Array<{ name: string; label?: string; sampleValue?: string }>;
  namedDataSources?: Array<{ id: string; name: string; defaultValue?: string; value?: string }>;
}

interface ValueSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  currentSource?: DynamicValueSource;
  currentValue: number;
  availableDatabaseFields: string[];
  availableNamedSources: string[];
  onApply: (source: DynamicValueSource) => void;
}

// Sub-Modal: Value Source (Constant, Database Field, Named Data Source) - Exact BarTender Parity
const ValueSourceModal: React.FC<ValueSourceModalProps> = ({
  isOpen,
  onClose,
  title,
  currentSource,
  currentValue,
  availableDatabaseFields,
  availableNamedSources,
  onApply,
}) => {
  const [sourceType, setSourceType] = useState<'constant' | 'database' | 'named_source' | 'unlimited'>('constant');
  const [constantVal, setConstantVal] = useState<number>(currentValue || 1);
  const [dbField, setDbField] = useState<string>('');
  const [namedSource, setNamedSource] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      if (currentSource) {
        setSourceType(currentSource.sourceType || 'constant');
        setConstantVal(currentSource.value || currentValue || 1);
        setDbField(currentSource.databaseField || (availableDatabaseFields[0] || ''));
        setNamedSource(currentSource.namedSource || (availableNamedSources[0] || ''));
      } else {
        setSourceType('constant');
        setConstantVal(currentValue || 1);
        setDbField(availableDatabaseFields[0] || '');
        setNamedSource(availableNamedSources[0] || '');
      }
    }
  }, [isOpen, currentSource, currentValue, availableDatabaseFields, availableNamedSources]);

  if (!isOpen) return null;

  const handleOk = () => {
    onApply({
      sourceType,
      value: constantVal,
      databaseField: sourceType === 'database' ? dbField : undefined,
      namedSource: sourceType === 'named_source' ? namedSource : undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 font-sans select-none animate-in fade-in duration-100">
      <div
        className="w-[440px] max-w-full bg-[#f4f7fb] rounded-lg shadow-2xl border border-[#7d9ebc] flex flex-col overflow-hidden text-slate-800 text-[12px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title Bar */}
        <div className="bg-gradient-to-r from-[#e8edf5] to-[#d8e3f0] border-b border-[#b8c9db] px-3 py-1.5 flex items-center justify-between shrink-0">
          <span className="font-semibold text-slate-800 text-[12.5px]">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="w-5 h-5 flex items-center justify-center text-slate-500 hover:bg-red-600 hover:text-white rounded-xs transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 bg-white space-y-4">
          {/* Constant Option */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800 text-[12px]">
              <input
                type="radio"
                name="valueSourceType"
                checked={sourceType === 'constant'}
                onChange={() => setSourceType('constant')}
                className="accent-[#0078d7]"
              />
              <span>Constant</span>
            </label>
            <div className="pl-6 flex items-center justify-between gap-3">
              <label className={`w-28 text-[11.5px] ${sourceType === 'constant' ? 'text-slate-700' : 'text-slate-400'}`}>
                Value:
              </label>
              <div className="relative inline-flex items-center flex-1 max-w-[200px]">
                <input
                  type="number"
                  min={1}
                  max={100000}
                  value={constantVal}
                  disabled={sourceType !== 'constant'}
                  onChange={(e) => setConstantVal(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full border border-[#a4bed8] rounded px-2 py-0.8 text-[11.5px] text-slate-800 bg-white focus:outline-[#0078d7] disabled:bg-slate-100 disabled:text-slate-400 pr-5"
                />
                <div className="absolute right-1 top-0.5 bottom-0.5 flex flex-col justify-center border-l border-slate-200 pl-0.5 select-none">
                  <button
                    type="button"
                    tabIndex={-1}
                    disabled={sourceType !== 'constant'}
                    onClick={() => setConstantVal((prev) => prev + 1)}
                    className="text-slate-500 hover:text-blue-600 disabled:text-slate-300 px-0.5 text-[8px] leading-none cursor-pointer"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    disabled={sourceType !== 'constant'}
                    onClick={() => setConstantVal((prev) => Math.max(1, prev - 1))}
                    className="text-slate-500 hover:text-blue-600 disabled:text-slate-300 px-0.5 text-[8px] leading-none cursor-pointer"
                  >
                    ▼
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Database Field Option */}
          <div className="space-y-1.5 pt-1 border-t border-slate-100">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800 text-[12px]">
              <input
                type="radio"
                name="valueSourceType"
                checked={sourceType === 'database'}
                onChange={() => setSourceType('database')}
                className="accent-[#0078d7]"
              />
              <span>Get value from database field</span>
            </label>
            <div className="pl-6 flex items-center justify-between gap-3">
              <label className={`w-28 text-[11.5px] ${sourceType === 'database' ? 'text-slate-700' : 'text-slate-400'}`}>
                Database Field:
              </label>
              <select
                value={dbField}
                disabled={sourceType !== 'database'}
                onChange={(e) => setDbField(e.target.value)}
                className="flex-1 max-w-[200px] border border-[#a4bed8] rounded px-2 py-1 text-[11.5px] bg-white text-slate-800 focus:outline-[#0078d7] disabled:bg-slate-100 disabled:text-slate-400"
              >
                {availableDatabaseFields.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Named Data Source Option */}
          <div className="space-y-1.5 pt-1 border-t border-slate-100">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800 text-[12px]">
              <input
                type="radio"
                name="valueSourceType"
                checked={sourceType === 'named_source'}
                onChange={() => setSourceType('named_source')}
                className="accent-[#0078d7]"
              />
              <span>Get value from named data source</span>
            </label>
            <div className="pl-6 flex items-center justify-between gap-3">
              <label className={`w-28 text-[11.5px] ${sourceType === 'named_source' ? 'text-slate-700' : 'text-slate-400'}`}>
                Named Data Source:
              </label>
              <select
                value={namedSource}
                disabled={sourceType !== 'named_source'}
                onChange={(e) => setNamedSource(e.target.value)}
                className="flex-1 max-w-[200px] border border-[#a4bed8] rounded px-2 py-1 text-[11.5px] bg-white text-slate-800 focus:outline-[#0078d7] disabled:bg-slate-100 disabled:text-slate-400"
              >
                {availableNamedSources.map((ns) => (
                  <option key={ns} value={ns}>
                    {ns}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-[#cbdbe9] bg-[#edf3f9] px-3 py-2 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => alert('Select Constant, Database Field, or Named Data Source to dynamically set this property.')}
            className="px-3 py-1 border border-[#a4bed8] hover:bg-slate-200 rounded text-slate-700 text-[11.5px] flex items-center gap-1 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
            <span>Help</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOk}
              className="px-4 py-1 bg-[#0078d7] hover:bg-[#0063b1] text-white font-medium rounded text-[11.5px] shadow-2xs cursor-pointer"
            >
              OK
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1 border border-[#a4bed8] hover:bg-slate-200 text-slate-700 font-medium rounded text-[11.5px] cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Windows BarTender Number Stepper Input with Attached Data Source Link Button
const StepperInputWithDataSource: React.FC<{
  value: number;
  source?: DynamicValueSource;
  disabled?: boolean;
  min?: number;
  max?: number;
  inputWidth?: string;
  tooltipTitle?: string;
  onChangeValue: (val: number) => void;
  onOpenSourceModal: () => void;
}> = ({
  value,
  source,
  disabled = false,
  min = 1,
  max = 100000,
  inputWidth = 'w-32',
  tooltipTitle = 'Link to Data Source / Database',
  onChangeValue,
  onOpenSourceModal,
}) => {
  const isLinked = source && source.sourceType !== 'constant';
  const displayVal = isLinked
    ? source.sourceType === 'database'
      ? `[DB: ${source.databaseField || 'Field'}]`
      : source.sourceType === 'unlimited'
      ? 'Unlimited'
      : `[Named: ${source.namedSource || 'Source'}]`
    : value;

  return (
    <div className="flex items-center">
      <div className={`relative inline-flex items-center ${inputWidth}`}>
        <input
          type={isLinked ? 'text' : 'number'}
          min={min}
          max={max}
          value={displayVal}
          disabled={disabled || isLinked}
          onChange={(e) => {
            if (!isLinked) {
              onChangeValue(Math.max(min, parseInt(e.target.value, 10) || min));
            }
          }}
          className={`w-full border rounded px-2 py-0.8 text-[11.5px] focus:outline-[#0078d7] pr-5 ${
            isLinked
              ? 'bg-amber-50/80 border-amber-400 text-amber-900 font-mono text-[10.5px] font-medium'
              : 'border-[#a4bed8] text-slate-800 bg-white'
          } ${disabled ? 'bg-slate-100 text-slate-400' : ''}`}
        />
        {!isLinked && !disabled && (
          <div className="absolute right-1 top-0.5 bottom-0.5 flex flex-col justify-center border-l border-slate-200 pl-0.5 select-none">
            <button
              type="button"
              tabIndex={-1}
              onClick={() => onChangeValue(Math.min(max, value + 1))}
              className="text-slate-500 hover:text-blue-600 px-0.5 text-[8px] leading-none cursor-pointer"
            >
              ▲
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={() => onChangeValue(Math.max(min, value - 1))}
              className="text-slate-500 hover:text-blue-600 px-0.5 text-[8px] leading-none cursor-pointer"
            >
              ▼
            </button>
          </div>
        )}
      </div>

      {/* BarTender Data Source icon button */}
      <button
        type="button"
        disabled={disabled}
        onClick={onOpenSourceModal}
        title={tooltipTitle}
        className={`w-5 h-5 flex items-center justify-center border rounded-xs shadow-2xs cursor-pointer shrink-0 ml-1.5 transition-colors ${
          isLinked
            ? 'bg-amber-100 border-amber-500 ring-1 ring-amber-400'
            : 'bg-[#f7f9fc] hover:bg-[#ebf1f8] border-[#a4bed8]'
        } ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="1.5" width="10" height="13" rx="1" fill="#fff9db" stroke="#e67700" strokeWidth="1.2" />
          <rect x="5.5" y="5.5" width="8.5" height="8.5" rx="0.5" fill="#e7f5ff" stroke="#1c7ed6" strokeWidth="1.2" />
          <line x1="5.5" y1="8.5" x2="14" y2="8.5" stroke="#1c7ed6" strokeWidth="0.8" />
          <line x1="5.5" y1="11.5" x2="14" y2="11.5" stroke="#1c7ed6" strokeWidth="0.8" />
          <line x1="9.75" y1="5.5" x2="9.75" y2="14" stroke="#1c7ed6" strokeWidth="0.8" />
        </svg>
      </button>
    </div>
  );
};

export const SerializationModal: React.FC<SerializationModalProps> = ({
  isOpen,
  onClose,
  onApply,
  initialConfig,
  initialValue = '000001',
  prefix = '',
  suffix = '',
  recordCount = 1,
  datasets: propDatasets,
  currentRecord,
  availableVariables,
  namedDataSources,
}) => {
  const [activeTab, setActiveTab] = useState<'serialization' | 'reset'>('serialization');

  // Serialization tab state
  const [action, setAction] = useState<'none' | 'increment' | 'decrement'>('increment');
  const [method, setMethod] = useState<any>('alphabetic_and_numeric');
  const [letterCase, setLetterCase] = useState<any>('uppercase');
  const [customSequence, setCustomSequence] = useState<string>('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  const [preserveCharacters, setPreserveCharacters] = useState<boolean>(false);

  // 4 Stepper fields & their dynamic value sources
  const [incrementBy, setIncrementBy] = useState<number>(1);
  const [incrementBySource, setIncrementBySource] = useState<DynamicValueSource | undefined>(undefined);

  const [event, setEvent] = useState<any>('standard');
  const [eventInterval, setEventInterval] = useState<number>(1);
  const [eventIntervalSource, setEventIntervalSource] = useState<DynamicValueSource | undefined>(undefined);
  const [dataItem, setDataItem] = useState<string>('');
  const [dataItemSource, setDataItemSource] = useState<DynamicValueSource | undefined>(undefined);

  const [serialNumbers, setSerialNumbers] = useState<number>(1);
  const [serialNumbersSource, setSerialNumbersSource] = useState<DynamicValueSource | undefined>(undefined);

  const [copies, setCopies] = useState<number>(1);
  const [copiesSource, setCopiesSource] = useState<DynamicValueSource | undefined>(undefined);

  // Reset tab state
  const [resetRule, setResetRule] = useState<'never' | 'manual' | 'start' | 'daily' | 'weekly' | 'monthly' | 'record' | 'change'>('never');
  const [resetValue, setResetValue] = useState<string>('');

  // Active Value Source Modal state
  type ActiveSourceTarget = 'incrementBy' | 'eventInterval' | 'dataItem' | null;
  const [activeSourceTarget, setActiveSourceTarget] = useState<ActiveSourceTarget>(null);

  // Print Quantity Options Modal state (BarTender Parity)
  const [showPrintQuantityOptionsModal, setShowPrintQuantityOptionsModal] = useState(false);
  const [printQuantityInitialTab, setPrintQuantityInitialTab] = useState<'serialNumbers' | 'copies'>('serialNumbers');

  // Preview Sequence modal state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewItems, setPreviewItems] = useState<PreviewSequenceItem[]>([]);

  // Datasets loading
  const [loadedDatasets, setLoadedDatasets] = useState<any[]>(propDatasets || []);
  useEffect(() => {
    if (propDatasets && propDatasets.length > 0) {
      setLoadedDatasets(propDatasets);
    } else {
      apiService.datasets
        .list()
        .then((list) => {
          if (Array.isArray(list)) setLoadedDatasets(list);
        })
        .catch(() => {});
    }
  }, [propDatasets]);

  // Extract available database fields
  const availableDatabaseFields = useMemo(() => {
    const fields = new Set<string>();
    if (loadedDatasets && loadedDatasets.length > 0) {
      loadedDatasets.forEach((ds) => {
        if (ds.columns && Array.isArray(ds.columns)) {
          ds.columns.forEach((c: any) => fields.add(typeof c === 'string' ? c : c.name));
        }
        if (ds.fields && Array.isArray(ds.fields)) {
          ds.fields.forEach((f: any) => fields.add(typeof f === 'string' ? f : f.name));
        }
        if (ds.records && ds.records[0]) {
          Object.keys(ds.records[0] || {}).forEach((k) => fields.add(k));
        }
      });
    }
    if (currentRecord) {
      Object.keys(currentRecord || {}).forEach((k) => fields.add(k));
    }
    if (fields.size === 0) {
      return ['Quantity', 'SerialStep', 'BatchSize', 'CopiesCount', 'LotNumber', 'OrderQty'];
    }
    return Array.from(fields);
  }, [loadedDatasets, currentRecord]);

  // Extract available named data sources
  const availableNamedSourcesList = useMemo(() => {
    const list = new Set<string>();
    if (namedDataSources && namedDataSources.length > 0) {
      namedDataSources.forEach((ns) => list.add(ns.name));
    }
    if (availableVariables && availableVariables.length > 0) {
      availableVariables.forEach((v) => list.add(v.name));
    }
    try {
      const savedVars = localStorage.getItem('barcodeflow_variables');
      if (savedVars) {
        const parsed = JSON.parse(savedVars);
        if (Array.isArray(parsed)) parsed.forEach((v: any) => list.add(v.name));
      }
    } catch {}
    if (list.size === 0) {
      return ['Named_Source_1', 'LotNumber', 'SerialMultiplier', 'BoxCount'];
    }
    return Array.from(list);
  }, [namedDataSources, availableVariables]);

  useEffect(() => {
    if (isOpen) {
      if (initialConfig) {
        setAction(initialConfig.action || 'increment');
        setMethod(initialConfig.method || 'alphabetic_and_numeric');
        setLetterCase(initialConfig.letterCase || 'uppercase');
        setCustomSequence(initialConfig.customSequence || '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ');
        setPreserveCharacters(initialConfig.preserveCharacters === true);
        setIncrementBy(initialConfig.incrementBy || 1);
        setIncrementBySource(initialConfig.incrementBySource);
        setEvent(initialConfig.event || 'standard');
        setEventInterval(initialConfig.eventInterval || 1);
        setEventIntervalSource(initialConfig.eventIntervalSource);
        setDataItem(initialConfig.dataItem || '');
        setDataItemSource(initialConfig.dataItemSource);
        setSerialNumbers(initialConfig.serialNumbers || 1);
        setSerialNumbersSource(initialConfig.serialNumbersSource);
        setCopies(initialConfig.copies || 1);
        setCopiesSource(initialConfig.copiesSource);
        setResetRule(initialConfig.resetRule || 'never');
        setResetValue(initialConfig.resetValue || '');
      } else {
        setAction('increment');
        setMethod('alphabetic_and_numeric');
        setLetterCase('uppercase');
        setCustomSequence('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ');
        setPreserveCharacters(false);
        setIncrementBy(1);
        setIncrementBySource(undefined);
        setEvent('standard');
        setEventInterval(1);
        setEventIntervalSource(undefined);
        setDataItem('');
        setDataItemSource(undefined);
        setSerialNumbers(1);
        setSerialNumbersSource(undefined);
        setCopies(1);
        setCopiesSource(undefined);
        setResetRule('never');
        setResetValue('');
      }
    }
  }, [isOpen, initialConfig]);

  if (!isOpen) return null;

  const isEnabled = action !== 'none';
  const isDecrement = action === 'decrement';

  const handleOpenPreview = () => {
    const config: SerializationConfig = {
      action,
      method,
      letterCase,
      customSequence,
      preserveCharacters,
      incrementBy,
      incrementBySource,
      event,
      eventInterval,
      eventIntervalSource,
      dataItem,
      dataItemSource,
      serialNumbers,
      serialNumbersSource,
      copies,
      copiesSource,
      resetRule,
      resetValue,
    };
    const seq = generatePreviewSequence(initialValue, config, {
      recordCount: Math.max(1, recordCount),
      serialNumbers,
      copies,
      prefix,
      suffix,
      maxItems: 50,
      record: currentRecord,
    });
    setPreviewItems(seq);
    setShowPreviewModal(true);
  };

  const handleOk = () => {
    const config: SerializationConfig = {
      action,
      method,
      letterCase,
      customSequence,
      preserveCharacters,
      incrementBy,
      incrementBySource,
      event,
      eventInterval,
      eventIntervalSource,
      dataItem,
      dataItemSource,
      serialNumbers,
      serialNumbersSource,
      copies,
      copiesSource,
      resetRule,
      resetValue,
    };
    onApply(config);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 font-sans select-none animate-in fade-in duration-100">
        {/* Windows Native BarTender Dialog Box */}
        <div
          className="w-[520px] max-w-full bg-[#f4f7fb] rounded-lg shadow-2xl border border-[#7d9ebc] flex flex-col overflow-hidden text-slate-800 text-[12px]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Title Bar */}
          <div className="bg-gradient-to-r from-[#e8edf5] to-[#d8e3f0] border-b border-[#b8c9db] px-3 py-1.5 flex items-center justify-between shrink-0">
            <span className="font-semibold text-slate-800 text-[12.5px]">Serialization</span>
            <button
              type="button"
              onClick={onClose}
              className="w-5 h-5 flex items-center justify-center text-slate-500 hover:bg-red-600 hover:text-white rounded-xs transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Modal Header Tabs */}
          <div className="flex border-b border-[#cbdbe9] bg-[#f4f7fb] px-3 pt-1.5 gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('serialization')}
              className={`px-3 py-1 text-[11.5px] font-medium rounded-t border-t border-x cursor-pointer transition-colors -mb-px ${
                activeTab === 'serialization'
                  ? 'bg-white border-[#b8c9db] text-slate-900 shadow-2xs font-semibold'
                  : 'border-transparent text-slate-600 hover:bg-[#e4ebf5]'
              }`}
            >
              Serialization
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reset')}
              className={`px-3 py-1 text-[11.5px] font-medium rounded-t border-t border-x cursor-pointer transition-colors -mb-px ${
                activeTab === 'reset'
                  ? 'bg-white border-[#b8c9db] text-slate-900 shadow-2xs font-semibold'
                  : 'border-transparent text-slate-600 hover:bg-[#e4ebf5]'
              }`}
            >
              Reset
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-4 bg-white min-h-[380px] space-y-3.5 overflow-y-auto">
            {activeTab === 'serialization' && (
              <>
                {/* Action Radio Group (Don't Serialize / Increment / Decrement) */}
                <div className="flex items-center gap-6 pb-2 border-b border-slate-100">
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-800">
                    <input
                      type="radio"
                      name="serialAction"
                      checked={action === 'none'}
                      onChange={() => setAction('none')}
                      className="accent-[#0078d7]"
                    />
                    <span>Don't Serialize</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-800">
                    <input
                      type="radio"
                      name="serialAction"
                      checked={action === 'increment'}
                      onChange={() => setAction('increment')}
                      className="accent-[#0078d7]"
                    />
                    <span>Increment</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-800">
                    <input
                      type="radio"
                      name="serialAction"
                      checked={action === 'decrement'}
                      onChange={() => setAction('decrement')}
                      className="accent-[#0078d7]"
                    />
                    <span>Decrement</span>
                  </label>
                </div>

                {/* Method & Letters (Exact BarTender Options & Conditional Rows) */}
                <div className={`space-y-2.5 ${!isEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                  <div className="flex items-center justify-between gap-3">
                    <label className="w-24 text-slate-700 text-[11.5px]">Method:</label>
                    <select
                      value={method}
                      onChange={(e) => {
                        const nextMethod = e.target.value as any;
                        setMethod(nextMethod);
                        if (nextMethod === 'hexadecimal') {
                          if (letterCase !== 'lowercase_hex' && letterCase !== 'lowercase') {
                            setLetterCase('uppercase_hex' as any);
                          }
                        } else if (nextMethod === 'numeric') {
                          // No letters
                        } else if (letterCase === 'uppercase_hex' || letterCase === 'lowercase_hex') {
                          setLetterCase('uppercase' as any);
                        }
                      }}
                      className="flex-1 border border-[#a4bed8] rounded px-2 py-1 text-[11.5px] bg-white text-slate-800 focus:outline-[#0078d7]"
                    >
                      <option value="alphabetic_and_numeric">Alphabetic and/or Numeric</option>
                      <option value="numeric">Numeric</option>
                      <option value="alphabetic">Alphabetic</option>
                      <option value="alphanumeric">Alphanumeric</option>
                      <option value="hexadecimal">Hexadecimal</option>
                      <option value="custom">Custom Sequence</option>
                    </select>
                  </div>

                  {/* Letters row: shown only when Method is not Numeric */}
                  {method !== 'numeric' && method !== 'custom' && (
                    <div className="flex items-center justify-between gap-3 animate-in fade-in duration-100">
                      <label className="w-24 text-slate-700 text-[11.5px]">Letters:</label>
                      {method === 'hexadecimal' ? (
                        <select
                          value={letterCase === 'lowercase_hex' || letterCase === 'lowercase' ? 'lowercase_hex' : 'uppercase_hex'}
                          onChange={(e) => setLetterCase(e.target.value as any)}
                          className="flex-1 border border-[#a4bed8] rounded px-2 py-1 text-[11.5px] bg-white text-slate-800 focus:outline-[#0078d7]"
                        >
                          <option value="uppercase_hex">Uppercase A-F</option>
                          <option value="lowercase_hex">Lowercase a-f</option>
                        </select>
                      ) : (
                        <select
                          value={letterCase}
                          onChange={(e) => setLetterCase(e.target.value as any)}
                          className="flex-1 border border-[#a4bed8] rounded px-2 py-1 text-[11.5px] bg-white text-slate-800 focus:outline-[#0078d7]"
                        >
                          <option value="uppercase">Uppercase A-Z</option>
                          <option value="uppercase_no_io">Uppercase A-Z without I and O (avoids confusion with 0 and 1)</option>
                          <option value="lowercase">Lowercase a-z</option>
                          <option value="lowercase_no_l">Lowercase a-z without l (avoids confusion with 1)</option>
                        </select>
                      )}
                    </div>
                  )}

                  {/* Custom Sequence Characters input: shown when Method is Custom Sequence */}
                  {method === 'custom' && (
                    <div className="flex items-center justify-between gap-3 animate-in fade-in duration-100">
                      <label className="w-24 text-slate-700 text-[11.5px]">Sequence:</label>
                      <input
                        type="text"
                        value={customSequence}
                        onChange={(e) => setCustomSequence(e.target.value)}
                        placeholder="e.g. 0123456789ABCDEF"
                        className="flex-1 border border-[#a4bed8] rounded px-2 py-1 text-[11.5px] bg-white text-slate-800 font-mono focus:outline-[#0078d7]"
                      />
                    </div>
                  )}

                  <div className="pt-0.5">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-700 text-[11.5px]">
                      <input
                        type="checkbox"
                        checked={preserveCharacters}
                        onChange={(e) => setPreserveCharacters(e.target.checked)}
                        className="accent-[#0078d7]"
                      />
                      <span>Preserve the number of characters</span>
                    </label>
                  </div>

                  {/* Dynamic Step Field (Increment by / Decrement by) with Stepper & Data Source Sub-Dialog */}
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <label className="w-28 text-slate-700 text-[11.5px]">
                      {isDecrement ? 'Decrement by:' : 'Increment by:'}
                    </label>
                    <div className="flex-1 flex items-center">
                      <StepperInputWithDataSource
                        value={incrementBy}
                        source={incrementBySource}
                        onChangeValue={setIncrementBy}
                        onOpenSourceModal={() => setActiveSourceTarget('incrementBy')}
                        tooltipTitle={isDecrement ? 'Link Decrement by to Data Source' : 'Link Increment by to Data Source'}
                      />
                    </div>
                  </div>

                  {/* When to Increment / When to Decrement Fieldset */}
                  <fieldset className="border border-[#c5d4e4] rounded p-2.5 pt-1.5 space-y-2 mt-2 bg-[#fafcff]">
                    <legend className="text-[11px] font-semibold text-slate-700 px-1">
                      {isDecrement ? 'When to Decrement' : 'When to Increment'}
                    </legend>
                    <div className="flex items-center justify-between gap-3">
                      <label className="w-24 text-slate-700 text-[11px]">Event:</label>
                      <select
                        value={event}
                        onChange={(e) => setEvent(e.target.value as any)}
                        className="flex-1 border border-[#a4bed8] rounded px-2 py-0.8 text-[11px] bg-white text-slate-800 focus:outline-[#0078d7]"
                      >
                        <option value="standard">Standard (the "Serial Numbers" setting below sets event frequency)</option>
                        <option value="record">Every record</option>
                        <option value="page">Every page</option>
                        <option value="job">Every print job</option>
                        <option value="data_change">When data changes</option>
                        <option value="copy">Every copy</option>
                      </select>
                    </div>

                    {/* Dynamic Data Item row for 'When data changes' event (BarTender Parity) */}
                    {event === 'data_change' && (
                      <div className="flex items-center justify-between gap-3 animate-in fade-in duration-100">
                        <label className="w-24 text-slate-700 text-[11px]">Data Item:</label>
                        <div className="flex-1 flex items-center">
                          <input
                            type="text"
                            value={dataItem || (dataItemSource?.databaseField ? `[DB: ${dataItemSource.databaseField}]` : dataItemSource?.namedSource ? `[Named: ${dataItemSource.namedSource}]` : '')}
                            placeholder="Enter or select data field to monitor"
                            onChange={(e) => setDataItem(e.target.value)}
                            className={`flex-1 border rounded px-2 py-0.8 text-[11px] focus:outline-[#0078d7] ${
                              dataItemSource && dataItemSource.sourceType !== 'constant'
                                ? 'bg-amber-50/80 border-amber-400 text-amber-900 font-mono font-medium'
                                : 'border-[#a4bed8] text-slate-800 bg-white'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setActiveSourceTarget('dataItem')}
                            title="Link Data Item to Database Field or Named Data Source"
                            className={`w-5 h-5 flex items-center justify-center border rounded-xs shadow-2xs cursor-pointer shrink-0 ml-1.5 transition-colors ${
                              dataItemSource && dataItemSource.sourceType !== 'constant'
                                ? 'bg-amber-100 border-amber-500 ring-1 ring-amber-400'
                                : 'bg-[#f7f9fc] hover:bg-[#ebf1f8] border-[#a4bed8]'
                            }`}
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect x="2" y="1.5" width="10" height="13" rx="1" fill="#fff9db" stroke="#e67700" strokeWidth="1.2" />
                              <rect x="5.5" y="5.5" width="8.5" height="8.5" rx="0.5" fill="#e7f5ff" stroke="#1c7ed6" strokeWidth="1.2" />
                              <line x1="5.5" y1="8.5" x2="14" y2="8.5" stroke="#1c7ed6" strokeWidth="0.8" />
                              <line x1="5.5" y1="11.5" x2="14" y2="11.5" stroke="#1c7ed6" strokeWidth="0.8" />
                              <line x1="9.75" y1="5.5" x2="9.75" y2="14" stroke="#1c7ed6" strokeWidth="0.8" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-3">
                      <label className="w-24 text-slate-700 text-[11px]">Event interval:</label>
                      <div className="flex-1 flex items-center">
                        <StepperInputWithDataSource
                          value={eventInterval}
                          source={eventIntervalSource}
                          onChangeValue={setEventInterval}
                          onOpenSourceModal={() => setActiveSourceTarget('eventInterval')}
                          tooltipTitle="Link Event Interval to Data Source"
                        />
                      </div>
                    </div>
                  </fieldset>
                </div>

                {/* Print Quantity Fieldset (BarTender Parity: 'Copies' when Don't Serialize, or 'Serial Numbers' + 'Copies per Serial Number') */}
                <fieldset className="border border-[#c5d4e4] rounded p-2.5 pt-1.5 space-y-2 mt-2 bg-[#fafcff]">
                  <legend className="text-[11px] font-semibold text-slate-700 px-1">Print Quantity</legend>
                  <p className="text-[10.5px] text-slate-500">
                    These controls are global and can also be set from the Print Dialog.
                  </p>

                  <div className="space-y-2 pt-1">
                    {action === 'none' ? (
                      <div className="space-y-0.5">
                        <label className="text-slate-700 text-[11.5px] block font-normal">Copies:</label>
                        <StepperInputWithDataSource
                          value={copies}
                          source={copiesSource}
                          inputWidth="w-full"
                          onChangeValue={setCopies}
                          onOpenSourceModal={() => {
                            setPrintQuantityInitialTab('copies');
                            setShowPrintQuantityOptionsModal(true);
                          }}
                          tooltipTitle="Set Copies options (Print Quantity Options)"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="space-y-0.5">
                          <label className="text-slate-700 text-[11.5px] block font-normal">Serial Numbers:</label>
                          <StepperInputWithDataSource
                            value={serialNumbers}
                            source={serialNumbersSource}
                            inputWidth="w-full"
                            onChangeValue={setSerialNumbers}
                            onOpenSourceModal={() => {
                              setPrintQuantityInitialTab('serialNumbers');
                              setShowPrintQuantityOptionsModal(true);
                            }}
                            tooltipTitle="Set Serial Numbers options (Print Quantity Options)"
                          />
                        </div>

                        <div className="space-y-0.5">
                          <label className="text-slate-700 text-[11.5px] block font-normal">Copies per Serial Number:</label>
                          <StepperInputWithDataSource
                            value={copies}
                            source={copiesSource}
                            inputWidth="w-full"
                            onChangeValue={setCopies}
                            onOpenSourceModal={() => {
                              setPrintQuantityInitialTab('copies');
                              setShowPrintQuantityOptionsModal(true);
                            }}
                            tooltipTitle="Set Copies per Serial Number options (Print Quantity Options)"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </fieldset>

                {/* Preview Sequence Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleOpenPreview}
                    className="px-3 py-1.5 border border-[#a4bed8] hover:bg-[#eaf1f8] rounded text-slate-800 text-[11.5px] font-medium flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                    <span>Preview Sequence...</span>
                  </button>
                </div>
              </>
            )}

            {activeTab === 'reset' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="w-28 text-slate-700 text-[11.5px]">Reset Rule:</label>
                  <select
                    value={resetRule}
                    onChange={(e) => setResetRule(e.target.value as any)}
                    className="flex-1 border border-[#a4bed8] rounded px-2 py-1 text-[11.5px] bg-white text-slate-800 focus:outline-[#0078d7]"
                  >
                    <option value="never">Never</option>
                    <option value="manual">Manual</option>
                    <option value="start">At Print Start</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="record">Record Boundary</option>
                    <option value="change">Value Change</option>
                  </select>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <label className="w-28 text-slate-700 text-[11.5px]">Reset Value:</label>
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={resetValue}
                      onChange={(e) => setResetValue(e.target.value)}
                      placeholder="e.g. 000001 or A"
                      className="flex-1 border border-[#a4bed8] rounded px-2 py-1 text-[11.5px] text-slate-800 focus:outline-[#0078d7]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const targetVal = resetValue || initialValue;
                        if (AtomicSerialReservationService.hasActiveReservation(initialValue)) {
                          alert(
                            `BLOCKED: Cannot reset serial counter while an active print job or reservation is in progress for this sequence.\n\nPlease allow the active print job to complete or cancel it before resetting.`
                          );
                          return;
                        }
                        const confirmed = window.confirm(
                          `Manual Serial Reset Confirmation:\n\nCurrent starting sequence is "${initialValue}".\nResetting counter to "${targetVal}" may cause duplicate serial numbers to be generated.\n\nAre you sure you want to reset the counter now?`
                        );
                        if (confirmed) {
                          onApply({
                            action,
                            method,
                            letterCase,
                            preserveCharacters,
                            incrementBy,
                            incrementBySource,
                            event,
                            eventInterval,
                            eventIntervalSource,
                            serialNumbers,
                            serialNumbersSource,
                            copies,
                            copiesSource,
                            resetRule: 'manual',
                            resetValue: targetVal,
                            currentValue: targetVal,
                            lastResetAt: new Date().toISOString(),
                            lastResetReason: 'Manual user reset',
                          });
                          alert(`Serial counter has been successfully reset to "${targetVal}".`);
                        }
                      }}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded text-[11px] font-medium cursor-pointer shadow-2xs whitespace-nowrap"
                    >
                      Reset Now
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded text-[11px] text-blue-900 space-y-1">
                  <p className="font-semibold">Reset Behavior:</p>
                  <p>When the selected condition occurs, the serial counter resets to the specified Reset Value.</p>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="border-t border-[#cbdbe9] bg-[#edf3f9] px-3 py-2 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={() => alert('BarTender-compatible Serialization Engine documentation.')}
              className="px-3 py-1 border border-[#a4bed8] hover:bg-slate-200 rounded text-slate-700 text-[11.5px] flex items-center gap-1 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
              <span>Help</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOk}
                className="px-4 py-1 bg-[#0078d7] hover:bg-[#0063b1] text-white font-medium rounded text-[11.5px] shadow-2xs cursor-pointer"
              >
                OK
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1 border border-[#a4bed8] hover:bg-slate-200 text-slate-700 font-medium rounded text-[11.5px] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Dialog: Value Source Setup (Serialization Step Value, Event Interval Value, Serial Numbers Value, Copies per Serial Number Value) */}
      {activeSourceTarget === 'incrementBy' && (
        <ValueSourceModal
          isOpen={true}
          title={isDecrement ? 'Serialization Decrement Step Value' : 'Serialization Step Value'}
          currentSource={incrementBySource}
          currentValue={incrementBy}
          availableDatabaseFields={availableDatabaseFields}
          availableNamedSources={availableNamedSourcesList}
          onClose={() => setActiveSourceTarget(null)}
          onApply={(src) => {
            setIncrementBySource(src);
            if (src.sourceType === 'constant') {
              setIncrementBy(src.value);
            }
          }}
        />
      )}

      {activeSourceTarget === 'eventInterval' && (
        <ValueSourceModal
          isOpen={true}
          title="Event Interval Value"
          currentSource={eventIntervalSource}
          currentValue={eventInterval}
          availableDatabaseFields={availableDatabaseFields}
          availableNamedSources={availableNamedSourcesList}
          onClose={() => setActiveSourceTarget(null)}
          onApply={(src) => {
            setEventIntervalSource(src);
            if (src.sourceType === 'constant') {
              setEventInterval(src.value);
            }
          }}
        />
      )}

      {activeSourceTarget === 'dataItem' && (
        <ValueSourceModal
          isOpen={true}
          title="Data Item Source"
          currentSource={dataItemSource}
          currentValue={1}
          availableDatabaseFields={availableDatabaseFields}
          availableNamedSources={availableNamedSourcesList}
          onClose={() => setActiveSourceTarget(null)}
          onApply={(src) => {
            setDataItemSource(src);
            if (src.sourceType === 'database' && src.databaseField) {
              setDataItem(src.databaseField);
            } else if (src.sourceType === 'named_source' && src.namedSource) {
              setDataItem(src.namedSource);
            }
          }}
        />
      )}

      {/* Dedicated BarTender Print Quantity Options Dialog */}
      <PrintQuantityOptionsModal
        isOpen={showPrintQuantityOptionsModal}
        initialCategory={printQuantityInitialTab}
        showOnlyCopies={action === 'none'}
        serialNumbersSource={serialNumbersSource}
        serialNumbersValue={serialNumbers}
        copiesSource={copiesSource}
        copiesValue={copies}
        availableDatabaseFields={availableDatabaseFields}
        availableNamedSources={availableNamedSourcesList}
        onClose={() => setShowPrintQuantityOptionsModal(false)}
        onApply={({ serialNumbersSource: newSnSource, copiesSource: newCpSource }) => {
          setSerialNumbersSource(newSnSource);
          if (newSnSource.sourceType === 'constant' && newSnSource.value) {
            setSerialNumbers(newSnSource.value);
          }
          setCopiesSource(newCpSource);
          if (newCpSource.sourceType === 'constant' && newCpSource.value) {
            setCopies(newCpSource.value);
          }
        }}
      />

      {/* Non-destructive Preview Sequence Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 backdrop-blur-xs p-4 font-sans select-none animate-in fade-in duration-100">
          <div className="w-[620px] max-w-full bg-white rounded-lg shadow-2xl border border-slate-400 flex flex-col overflow-hidden text-slate-800 text-[12px]">
            <div className="bg-slate-800 text-white px-3 py-1.5 flex items-center justify-between">
              <span className="font-semibold text-[12.5px]">Preview of Serialized Sequence</span>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="w-6 h-5 flex items-center justify-center hover:bg-red-600 text-white rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-3 max-h-[380px] overflow-y-auto">
              <table className="w-full text-left text-[11.5px] border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-300">
                    <th className="p-1.5 border-r border-slate-300 w-16 text-center">Print #</th>
                    <th className="p-1.5 border-r border-slate-300 w-16 text-center">Record #</th>
                    <th className="p-1.5 border-r border-slate-300 w-16 text-center">Copy #</th>
                    <th className="p-1.5 border-r border-slate-300 font-mono">Serialized Value</th>
                    <th className="p-1.5 font-mono text-emerald-700 font-semibold">Final Value</th>
                  </tr>
                </thead>
                <tbody>
                  {previewItems.map((item) => (
                    <tr key={item.printIndex} className="border-b border-slate-200 hover:bg-blue-50">
                      <td className="p-1.5 border-r border-slate-200 text-center text-slate-600 font-mono">{item.printIndex}</td>
                      <td className="p-1.5 border-r border-slate-200 text-center text-slate-600 font-mono">{item.recordIndex}</td>
                      <td className="p-1.5 border-r border-slate-200 text-center text-slate-600 font-mono">{item.copyIndex}</td>
                      <td className="p-1.5 border-r border-slate-200 font-mono font-medium text-slate-900">{item.serializedValue}</td>
                      <td className="p-1.5 font-mono font-bold text-emerald-700">{item.finalValue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-3 py-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded text-[11.5px] font-medium cursor-pointer"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
