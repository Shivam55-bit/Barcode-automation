import React, { useState, useEffect } from 'react';
import { DataSourceItem, DataSourceType } from '../../types';
import { formatCustomDate, evaluateSafeScript } from '../../services/dataSourceEngine';
import { X, Calendar, Database, Globe, Hash, Save, Code, FileText, ChevronDown, Check, AlertCircle } from 'lucide-react';
import { SpecialCharacterModal } from './SpecialCharacterModal';
import { insertAtSelection } from '../../services/controlCharacterService';
import { CONTROL_CHARACTERS } from '../../services/symbolService';

export type WizardDataSourceType =
  | 'embedded'
  | 'control-character'
  | 'clock'
  | 'database'
  | 'global'
  | 'print-job'
  | 'external-file'
  | 'script'
  | 'printer-code';

interface NewDataSourceWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDataSource: (item: DataSourceItem) => void;
  datasets?: any[];
  currentRecord?: Record<string, any>;
  availableVariables?: Array<{ name: string; label?: string; sampleValue?: string }>;
  currentConnection?: any;
  existingCount?: number;
}

interface TypeOption {
  type: WizardDataSourceType;
  label: string;
  description: string;
  defaultName: string;
  icon: React.ReactNode;
}

export const NewDataSourceWizardModal: React.FC<NewDataSourceWizardModalProps> = ({
  isOpen,
  onClose,
  onAddDataSource,
  datasets = [],
  currentRecord = {},
  availableVariables = [],
  currentConnection,
  existingCount = 0,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<WizardDataSourceType>('embedded');
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [sourceName, setSourceName] = useState<string>('');
  const [isSpecialCharModalOpen, setIsSpecialCharModalOpen] = useState<boolean>(false);

  // Common configuration fields

  // 1. Embedded Data
  const [embeddedValue, setEmbeddedValue] = useState('Sample Text');
  const [embeddedDataType, setEmbeddedDataType] = useState<'text' | 'number' | 'date' | 'time' | 'currency'>('text');
  const [selectedControlCode, setSelectedControlCode] = useState<string>('CR');
  const embeddedTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const savedSelectionRef = React.useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  const handleOpenSpecialCharacters = () => {
    const textarea = embeddedTextareaRef.current;
    const start = textarea ? textarea.selectionStart : (savedSelectionRef.current.start ?? embeddedValue.length);
    const end = textarea ? textarea.selectionEnd : (savedSelectionRef.current.end ?? embeddedValue.length);
    savedSelectionRef.current = { start: start ?? embeddedValue.length, end: end ?? embeddedValue.length };
    setIsSpecialCharModalOpen(true);
  };

  const handleInsertSpecialChar = (char: string) => {
    const { value: nextVal, newCursor } = insertAtSelection(embeddedValue, char, savedSelectionRef.current.start, savedSelectionRef.current.end);
    savedSelectionRef.current = { start: newCursor, end: newCursor };
    setEmbeddedValue(nextVal);
    setTimeout(() => {
      if (embeddedTextareaRef.current) {
        try {
          embeddedTextareaRef.current.focus();
          embeddedTextareaRef.current.setSelectionRange(newCursor, newCursor);
        } catch {}
      }
    }, 0);
  };

  // 2. Clock
  const [clockFormat, setClockFormat] = useState('YYYY-MM-DD');
  const [clockOffsetDays, setClockOffsetDays] = useState(0);
  const [clockOffsetMonths, setClockOffsetMonths] = useState(0);
  const [clockOffsetYears, setClockOffsetYears] = useState(0);
  const [clockType, setClockType] = useState<'current' | 'expiry' | 'mfg'>('current');

  // 3. Database Field
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [selectedField, setSelectedField] = useState<string>('');

  // 4. Global Data Field
  const [globalVarName, setGlobalVarName] = useState('GLOBAL_VAR_1');
  const [globalDefaultValue, setGlobalDefaultValue] = useState('DefaultValue');

  // 5. Print Job Field
  const [printJobField, setPrintJobField] = useState<string>('SYSTEM.RECORD_NUMBER');

  // 6. External File
  const [filePath, setFilePath] = useState('C:\\BarcodeFlow\\data.txt');
  const [fileReadMode, setFileReadMode] = useState<'entire' | 'first_line' | 'by_index'>('first_line');
  const [fileFallbackValue, setFileFallbackValue] = useState('FILE_DATA_SAMPLE');

  // 7. Visual Basic Script
  const [scriptCode, setScriptCode] = useState('"Sample Text"');
  const [scriptLanguage, setScriptLanguage] = useState<'vbscript' | 'javascript'>('vbscript');
  const [scriptMode, setScriptMode] = useState<'expression' | 'multiline'>('expression');
  const [scriptTestResult, setScriptTestResult] = useState<string | null>(null);

  // 8. Printer Code Template Field
  const [printerFieldTag, setPrinterFieldTag] = useState('<PRINTER_FIELD_1>');
  const [printerDefaultValue, setPrinterDefaultValue] = useState('SAMPLE_PRN');
  const [printerLanguage, setPrinterLanguage] = useState('zpl');

  // Available database fields extraction
  const activeDataset = datasets.find((d) => d.id === selectedDatasetId) || datasets[0] || currentConnection;
  const availableFields: string[] = React.useMemo(() => {
    if (activeDataset?.fields && Array.isArray(activeDataset.fields)) {
      return activeDataset.fields.map((f: any) => (typeof f === 'string' ? f : f.name || f.fieldName));
    }
    if (activeDataset?.records && activeDataset.records.length > 0) {
      return Object.keys(activeDataset.records[0] || {});
    }
    if (currentRecord && Object.keys(currentRecord || {}).length > 0) {
      return Object.keys(currentRecord || {});
    }
    return ['ProductID', 'ProductName', 'Barcode', 'Price', 'Batch', 'ExpiryDate', 'Quantity'];
  }, [activeDataset, currentRecord]);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedType('embedded');
      setTypeDropdownOpen(false);
      setSourceName(`Source ${existingCount + 1}`);
      setEmbeddedValue('Sample Text');
      setSelectedDatasetId('');
      setSelectedField('');
      setScriptTestResult(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || datasets.length === 0) return;
    setSelectedDatasetId((current) =>
      datasets.some((dataset) => dataset.id === current)
        ? current
        : datasets[0].id || 'dataset-1'
    );
  }, [isOpen, datasets]);

  useEffect(() => {
    if (availableFields.length > 0 && !availableFields.includes(selectedField)) {
      setSelectedField(availableFields[0]);
    }
  }, [availableFields, selectedField]);

  if (!isOpen) return null;

  const typeOptions: TypeOption[] = [
    {
      type: 'embedded',
      label: 'Embedded Data',
      defaultName: `Embedded Data ${existingCount + 1}`,
      description:
        'The Embedded Data source is primarily intended for static data, but can also be modified using transforms, serialization, or user input.',
      icon: (
        <div className="flex items-center gap-0.5 px-0.5 bg-blue-50 border border-blue-300 rounded text-[9px] font-bold text-blue-900 leading-none">
          <span className="text-blue-600 font-serif">I</span>
          <span className="text-blue-900 text-[8.5px] font-extrabold">BT</span>
        </div>
      ),
    },
    {
      type: 'control-character',
      label: 'Control Character',
      defaultName: '<CR>',
      description:
        'A Control Character data source inserts a standard ASCII control code (such as Carriage Return, Line Feed, Tab, or Group Separator) directly into the stream.',
      icon: <span className="font-mono font-bold text-blue-600 text-xs px-0.5">«»</span>,
    },
    {
      type: 'clock',
      label: 'Clock',
      defaultName: `Clock ${existingCount + 1}`,
      description:
        "The Clock data source provides the current date or time from your computer's clock, with support for date/time formatting and time offsets.",
      icon: <Calendar className="w-3.5 h-3.5 text-blue-600" />,
    },
    {
      type: 'database',
      label: 'Database Field',
      defaultName: `Database Field ${existingCount + 1}`,
      description:
        'The Database Field data source obtains data from a field in a connected database, Excel workbook, CSV file, or OLE DB / ODBC source.',
      icon: <Database className="w-3.5 h-3.5 text-emerald-600" />,
    },
    {
      type: 'global',
      label: 'Global Data Field',
      defaultName: `Global Field ${existingCount + 1}`,
      description:
        'A Global Data Field shares data across multiple documents or applications on the local network.',
      icon: <Globe className="w-3.5 h-3.5 text-cyan-600" />,
    },
    {
      type: 'print-job',
      label: 'Print Job Field',
      defaultName: `Print Job Field ${existingCount + 1}`,
      description:
        'The Print Job Field data source provides information about the current print job, such as serial number, document name, printer name, or total pages.',
      icon: <Hash className="w-3.5 h-3.5 text-indigo-600" />,
    },
    {
      type: 'external-file',
      label: 'External File',
      defaultName: `External File ${existingCount + 1}`,
      description:
        'The External File data source reads data from an external text file, binary file, or script at print time.',
      icon: <Save className="w-3.5 h-3.5 text-amber-600" />,
    },
    {
      type: 'script',
      label: 'Visual Basic Script',
      defaultName: `VBScript ${existingCount + 1}`,
      description:
        'The Visual Basic Script data source generates or transforms data using a custom VBScript expression or multi-line event script.',
      icon: <Code className="w-3.5 h-3.5 text-green-700" />,
    },
    {
      type: 'printer-code',
      label: 'Printer Code Template Field',
      defaultName: `Printer Code Field ${existingCount + 1}`,
      description:
        'A Printer Code Template Field allows inserting printer-specific command sequences or template merge fields directly into the print output.',
      icon: <span className="font-serif italic font-bold text-slate-800 text-xs px-0.5">T</span>,
    },
  ];

  const currentTypeOption = typeOptions.find((t) => t.type === selectedType) || typeOptions[0];

  const handleSelectType = (t: WizardDataSourceType) => {
    setSelectedType(t);
    setTypeDropdownOpen(false);
    const opt = typeOptions.find((o) => o.type === t);
    if (opt) {
      setSourceName(opt.defaultName);
    }
  };

  // Evaluate Clock preview
  const getClockPreview = () => {
    const d = new Date();
    d.setDate(d.getDate() + Number(clockOffsetDays || 0));
    d.setMonth(d.getMonth() + Number(clockOffsetMonths || 0));
    d.setFullYear(d.getFullYear() + Number(clockOffsetYears || 0));
    return formatCustomDate(d, clockFormat || 'YYYY-MM-DD');
  };

  // Test script
  const handleTestScript = () => {
    try {
      const scopeCtx = {
        record: currentRecord || {},
        system: {
          userName: 'Administrator',
          printerName: 'Zebra ZT410 (300 dpi)',
          jobId: 'JOB-2026-001',
          currentRecordIndex: 0,
          totalRecords: 1,
        },
      };
      const result = evaluateSafeScript(scriptCode, scopeCtx, scriptLanguage, scriptMode);
      setScriptTestResult(result || '[Empty Result]');
    } catch (err: any) {
      setScriptTestResult(`[Error: ${err.message}]`);
    }
  };

  // Final Finish Handler
  const handleFinish = () => {
    const newId = `ds-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    let newDs: DataSourceItem;

    switch (selectedType) {
      case 'embedded':
        newDs = {
          id: newId,
          name: sourceName || currentTypeOption.defaultName,
          type: 'embedded',
          value: embeddedValue || 'Sample Text',
          dataType: embeddedDataType,
          enabled: true,
        };
        break;

      case 'control-character': {
        const cDef = CONTROL_CHARACTERS.find((c) => c.abbr === selectedControlCode) || CONTROL_CHARACTERS.find((c) => c.abbr === 'CR')!;
        newDs = {
          id: newId,
          name: sourceName || `<${cDef.abbr}>`,
          type: 'control-character',
          controlCode: cDef.abbr,
          code: cDef.abbr,
          decimal: cDef.code,
          hex: cDef.hex,
          value: cDef.char,
          valueEncoding: 'raw',
          enabled: true,
        };
        break;
      }

      case 'clock':
        newDs = {
          id: newId,
          name: sourceName || `Clock (${clockFormat})`,
          type: 'clock',
          value: getClockPreview(),
          dateFormat: clockFormat,
          dateOffsetDays: Number(clockOffsetDays || 0),
          dateOffsetMonths: Number(clockOffsetMonths || 0),
          dateOffsetYears: Number(clockOffsetYears || 0),
          dateType: clockType,
          enabled: true,
        };
        break;

      case 'database':
        const dbFieldVal =
          currentRecord && currentRecord[selectedField] !== undefined
            ? String(currentRecord[selectedField])
            : `{{${selectedField}}}`;
        newDs = {
          id: newId,
          name: sourceName || `Field: ${selectedField}`,
          type: 'database-field',
          databaseField: selectedField,
          field: selectedField,
          datasetId: selectedDatasetId,
          value: dbFieldVal,
          enabled: true,
        };
        break;

      case 'global':
        newDs = {
          id: newId,
          name: sourceName || `Global: ${globalVarName}`,
          type: 'variable',
          variableName: globalVarName,
          value: globalDefaultValue || 'GLOBAL_VAL',
          enabled: true,
        };
        break;

      case 'print-job':
        newDs = {
          id: newId,
          name: sourceName || `Print Job (${printJobField.replace('SYSTEM.', '')})`,
          type: 'system',
          systemVarName: printJobField as any,
          value:
            printJobField === 'SYSTEM.DATE'
              ? formatCustomDate(new Date(), 'YYYY-MM-DD')
              : printJobField === 'SYSTEM.TIME'
              ? formatCustomDate(new Date(), 'HH:mm:ss')
              : printJobField === 'SYSTEM.RECORD_NUMBER'
              ? '1'
              : printJobField === 'SYSTEM.USER'
              ? 'Current User'
              : printJobField === 'SYSTEM.PRINTER'
              ? 'Default Printer'
              : 'JOB-001',
          enabled: true,
        };
        break;

      case 'external-file':
        newDs = {
          id: newId,
          name: sourceName || `File: ${filePath.split(/[\\/]/).pop() || 'data.txt'}`,
          type: 'embedded',
          value: fileFallbackValue || `[Content of ${filePath}]`,
          enabled: true,
        };
        break;

      case 'script':
        let scriptOutput = '';
        try {
          scriptOutput = evaluateSafeScript(
            scriptCode,
            { record: currentRecord || {}, system: { userName: 'Administrator', currentRecordIndex: 0, totalRecords: 1 } },
            scriptLanguage,
            scriptMode
          );
        } catch (err) {
          console.error('Unable to evaluate the new script data source:', err);
        }
        newDs = {
          id: newId,
          name: sourceName || 'VB Script Source',
          type: 'script',
          scriptLanguage,
          scriptMode,
          scriptCode,
          value: scriptOutput,
          enabled: true,
        };
        break;

      case 'printer-code':
        newDs = {
          id: newId,
          name: sourceName || `Template: ${printerFieldTag}`,
          type: 'embedded',
          value: printerDefaultValue || printerFieldTag,
          enabled: true,
        };
        break;

      default:
        newDs = {
          id: newId,
          name: sourceName || 'New Data Source',
          type: 'embedded',
          value: 'Sample Text',
          enabled: true,
        };
        break;
    }

    onAddDataSource(newDs);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-2xs p-3 select-none">
      <div className="bg-[#f0f2f5] border border-[#7088a8] shadow-2xl rounded-sm w-[550px] max-w-[96vw] h-[490px] flex flex-col select-none text-[11.5px] text-slate-800 relative z-[1001]">
        
        {/* Title Bar matching Windows BarTender dialog */}
        <div className="h-7 bg-[#f0f2f5] border-b border-[#cbd5e1] px-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[12px]">
            {/* BarTender Wizard Icon */}
            <div className="w-4 h-4 bg-gradient-to-br from-cyan-500 to-blue-700 rounded-xs flex items-center justify-center text-[9px] font-black text-white shadow-2xs">
              ✦
            </div>
            <span>New Data Source Wizard</span>
          </div>
          <button
            onClick={onClose}
            className="w-5 h-5 flex items-center justify-center hover:bg-red-500 hover:text-white rounded-xs text-slate-600 transition-colors cursor-pointer"
            title="Close Wizard"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Wizard Header Banner with authentic BarTender graphic watermark */}
        <div className="relative h-[68px] bg-gradient-to-r from-white via-white to-sky-50/60 border-b border-[#b8c5d6] px-5 py-2.5 flex items-center justify-between overflow-hidden shrink-0">
          <div className="relative z-10">
            <h3 className="font-bold text-[13.5px] text-slate-900 leading-tight">
              {step === 1 ? 'Select Data Source Type' : `Configure ${currentTypeOption.label}`}
            </h3>
            <p className="text-[11.5px] text-slate-500 mt-1">
              {step === 1
                ? 'Choose the category of data that this source provides.'
                : 'Specify options and field bindings for this data source.'}
            </p>
          </div>

          {/* Clean BarTender Blueprint Graphic Watermark */}
          <div className="absolute right-0 top-0 bottom-0 w-48 pointer-events-none opacity-30 flex items-center justify-end overflow-hidden select-none pr-3">
            <svg viewBox="0 0 160 60" className="w-full h-full">
              <defs>
                <linearGradient id="wizardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0284c7" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#0369a1" stopOpacity="0.45" />
                </linearGradient>
              </defs>
              {/* Database Cylinder */}
              <ellipse cx="40" cy="18" rx="18" ry="6" fill="none" stroke="#0284c7" strokeWidth="1.5" />
              <path d="M 22,18 L 22,38 A 18,6 0 0,0 58,38 L 58,18" fill="none" stroke="#0284c7" strokeWidth="1.5" />
              <path d="M 22,28 A 18,6 0 0,0 58,28" fill="none" stroke="#0284c7" strokeWidth="1.5" />
              {/* Flow Arrow */}
              <path d="M 64,28 L 84,28 M 79,24 L 85,28 L 79,32" fill="none" stroke="#0369a1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              {/* Clock Outline */}
              <circle cx="112" cy="28" r="15" fill="none" stroke="#0284c7" strokeWidth="1.5" />
              <polyline points="112,18 112,28 120,28" fill="none" stroke="#0284c7" strokeWidth="1.5" strokeLinecap="round" />
              {/* Barcode lines accent */}
              <g fill="#0f172a" opacity="0.6">
                <rect x="135" y="14" width="1.5" height="28" />
                <rect x="138" y="14" width="3" height="28" />
                <rect x="143" y="14" width="1" height="28" />
                <rect x="146" y="14" width="2" height="28" />
                <rect x="150" y="14" width="1.5" height="28" />
              </g>
            </svg>
          </div>
        </div>

        {/* Wizard Form Content Area */}
        <div className="p-5 flex-1 bg-white flex flex-col justify-between overflow-y-auto">
          {step === 1 ? (
            /* STEP 1: SELECT DATA SOURCE TYPE */
            <div className="space-y-4">
              <p className="text-[11.5px] text-slate-800 font-medium">
                Select the type for the new data source:
              </p>

              {/* Type Dropdown Row matching BarTender Screenshot */}
              <div className="flex items-center gap-3">
                <label className="w-14 font-medium text-slate-700 shrink-0 text-right">Type:</label>
                <div className="relative flex-1">
                  <button
                    type="button"
                    onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
                    className="w-full h-7 px-2.5 bg-white border border-[#8fa3bc] rounded-xs flex items-center justify-between text-left hover:border-[#0078d7] focus:border-[#0078d7] outline-none shadow-2xs cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="shrink-0">{currentTypeOption.icon}</span>
                      <span className="font-semibold text-slate-900 truncate text-[12px]">{currentTypeOption.label}</span>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-500 shrink-0 ml-1 transition-transform ${typeDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu matching BarTender Options */}
                  {typeDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-[1040]"
                        onClick={() => setTypeDropdownOpen(false)}
                      />
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#0078d7] shadow-xl py-1 z-[1050] rounded-xs text-[11.5px] max-h-[210px] overflow-y-auto divide-y divide-slate-100">
                        {typeOptions.map((opt) => {
                          const isSelected = opt.type === selectedType;
                          return (
                            <button
                              key={opt.type}
                              type="button"
                              onClick={() => handleSelectType(opt.type)}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-[#0078d7] text-white font-medium'
                                  : 'text-slate-800 hover:bg-[#e5f1fb]'
                              }`}
                            >
                              <span className="w-5 h-5 flex items-center justify-center shrink-0">
                                {opt.icon}
                              </span>
                              <span className="truncate flex-1 font-medium">{opt.label}</span>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-white shrink-0 ml-1" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Data Source Name Input */}
              <div className="flex items-center gap-3">
                <label className="w-14 font-medium text-slate-700 shrink-0 text-right">Name:</label>
                <input
                  type="text"
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  className="flex-1 h-7 px-2.5 border border-[#8fa3bc] rounded-xs text-[12px] outline-none focus:border-[#0078d7] bg-white transition-colors"
                  placeholder="Data source name..."
                />
              </div>

              {/* Description Group Box matching BarTender UI */}
              <fieldset className="border border-[#cbd5e1] rounded-xs p-3.5 bg-[#f8fafc] mt-4">
                <legend className="px-1.5 text-[11px] font-semibold text-slate-700">
                  Description:
                </legend>
                <p className="text-[11.5px] text-slate-700 leading-relaxed min-h-[56px]">
                  {currentTypeOption.description}
                </p>
              </fieldset>
            </div>

          ) : (
            /* STEP 2: CONFIGURE SPECIFIC DATA SOURCE TYPE */
            <div className="space-y-3.5">
              {/* 1. EMBEDDED DATA CONFIGURATION */}
              {selectedType === 'embedded' && (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-800">
                        Embedded Value / Text:
                      </label>
                      <button
                        type="button"
                        title="Insert Symbols or Special Characters"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleOpenSpecialCharacters}
                        className="px-2 py-0.5 bg-[#f8fafc] hover:bg-[#e2e8f0] border border-[#94a3b8] rounded-xs text-[#003366] font-serif font-bold text-xs cursor-pointer shadow-2xs flex items-center gap-1"
                      >
                        <span>Ω</span>
                        <span className="text-[10.5px] font-sans font-normal text-slate-700">Symbols...</span>
                      </button>
                    </div>
                    <div className="flex items-start gap-2">
                      <textarea
                        ref={embeddedTextareaRef}
                        rows={3}
                        value={embeddedValue}
                        onChange={(e) => {
                          setEmbeddedValue(e.target.value);
                          savedSelectionRef.current = { start: e.target.selectionStart, end: e.target.selectionEnd };
                        }}
                        onSelect={(e) => {
                          savedSelectionRef.current = { start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd };
                        }}
                        onKeyUp={(e) => {
                          savedSelectionRef.current = { start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd };
                        }}
                        onMouseUp={(e) => {
                          savedSelectionRef.current = { start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd };
                        }}
                        className="flex-1 p-2 border border-[#94a3b8] rounded-xs text-[11.5px] font-mono outline-none focus:border-blue-600 bg-white"
                        placeholder="Enter embedded string data..."
                      />
                      <button
                        type="button"
                        title="Insert Symbols or Special Characters"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleOpenSpecialCharacters}
                        className="w-8 h-8 self-stretch bg-[#f8fafc] hover:bg-[#e2e8f0] border border-[#94a3b8] rounded-xs text-[#003366] font-serif font-bold text-base cursor-pointer shadow-2xs flex items-center justify-center shrink-0"
                      >
                        Ω
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="font-semibold text-slate-700 w-24">Data Type:</label>
                    <select
                      value={embeddedDataType}
                      onChange={(e) => setEmbeddedDataType(e.target.value as any)}
                      className="h-6 px-2 bg-white border border-[#94a3b8] rounded-xs text-[11.5px] outline-none flex-1"
                    >
                      <option value="text">Text / String</option>
                      <option value="number">Numeric</option>
                      <option value="date">Date</option>
                      <option value="time">Time</option>
                      <option value="currency">Currency</option>
                    </select>
                  </div>
                </div>
              )}

              {/* 1b. CONTROL CHARACTER CONFIGURATION */}
              {selectedType === 'control-character' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="font-semibold text-slate-700 w-28">Control Code:</label>
                    <select
                      value={selectedControlCode}
                      onChange={(e) => {
                        setSelectedControlCode(e.target.value);
                        setSourceName(`<${e.target.value}>`);
                      }}
                      className="h-7 px-2 bg-white border border-[#94a3b8] rounded-xs text-[11.5px] font-mono font-bold outline-none flex-1"
                    >
                      {CONTROL_CHARACTERS.map((c) => (
                        <option key={c.abbr} value={c.abbr}>
                          {c.abbr} — {c.name} (ASCII {c.code}, Hex 0x{c.hex})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded text-[11.5px] space-y-1">
                    <p className="text-slate-800">
                      Standard Representation: <strong className="font-mono text-blue-700">&lt;{selectedControlCode}&gt;</strong>
                    </p>
                    <p className="text-slate-600">
                      {selectedControlCode === 'CR'
                        ? 'Carriage Return (ASCII 13) causes a line break in Multi-line Text without printing visible text.'
                        : selectedControlCode === 'LF'
                        ? 'Line Feed (ASCII 10) causes a line break in Multi-line Text without printing visible text.'
                        : selectedControlCode === 'HT'
                        ? 'Horizontal Tab (ASCII 9) introduces tab spacing.'
                        : selectedControlCode === 'GS'
                        ? 'Group Separator (ASCII 29) for FNC1/GS1 barcodes.'
                        : 'ASCII Control Character.'}
                    </p>
                  </div>
                </div>
              )}

              {/* 2. CLOCK CONFIGURATION */}
              {selectedType === 'clock' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="font-semibold text-slate-700 w-24">Clock Type:</label>
                    <select
                      value={clockType}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setClockType(val);
                        if (val === 'expiry' && clockOffsetDays === 0) setClockOffsetDays(365);
                        if (val === 'current') {
                          setClockOffsetDays(0);
                          setClockOffsetMonths(0);
                          setClockOffsetYears(0);
                        }
                      }}
                      className="h-6 px-2 bg-white border border-[#94a3b8] rounded-xs text-[11.5px] outline-none flex-1"
                    >
                      <option value="current">Current Date / Time</option>
                      <option value="expiry">Offset Date (Expiry / Shelf Life)</option>
                      <option value="mfg">Manufacturing Date (MFG)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="font-semibold text-slate-700 w-24">Date Format:</label>
                    <select
                      value={clockFormat}
                      onChange={(e) => setClockFormat(e.target.value)}
                      className="h-6 px-2 bg-white border border-[#94a3b8] rounded-xs text-[11.5px] outline-none flex-1"
                    >
                      <option value="YYYY-MM-DD">YYYY-MM-DD (2026-09-08)</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY (08/09/2026)</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY (09/08/2026)</option>
                      <option value="DD-MMM-YYYY">DD-MMM-YYYY (08-Sep-2026)</option>
                      <option value="YYYYMMDD">YYYYMMDD (20260908)</option>
                      <option value="HH:mm:ss">HH:mm:ss (15:30:00)</option>
                      <option value="YYYY-MM-DD HH:mm:ss">YYYY-MM-DD HH:mm:ss</option>
                    </select>
                  </div>

                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xs space-y-2">
                    <span className="font-bold text-slate-700 text-[11px]">Time Offset (from current clock):</span>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10.5px] text-slate-600 block">Days:</label>
                        <input
                          type="number"
                          value={clockOffsetDays}
                          onChange={(e) => setClockOffsetDays(parseInt(e.target.value) || 0)}
                          className="w-full h-5.5 px-1.5 border border-slate-300 rounded text-center text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="text-[10.5px] text-slate-600 block">Months:</label>
                        <input
                          type="number"
                          value={clockOffsetMonths}
                          onChange={(e) => setClockOffsetMonths(parseInt(e.target.value) || 0)}
                          className="w-full h-5.5 px-1.5 border border-slate-300 rounded text-center text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="text-[10.5px] text-slate-600 block">Years:</label>
                        <input
                          type="number"
                          value={clockOffsetYears}
                          onChange={(e) => setClockOffsetYears(parseInt(e.target.value) || 0)}
                          className="w-full h-5.5 px-1.5 border border-slate-300 rounded text-center text-[11px]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-blue-50/70 border border-blue-200 rounded-xs text-[11px]">
                    <span className="font-semibold text-blue-900">Evaluated Output:</span>
                    <span className="font-mono font-bold text-blue-950">{getClockPreview()}</span>
                  </div>
                </div>
              )}

              {/* 3. DATABASE FIELD CONFIGURATION */}
              {selectedType === 'database' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="font-semibold text-slate-700 w-24">Database/Table:</label>
                    <select
                      value={selectedDatasetId}
                      onChange={(e) => setSelectedDatasetId(e.target.value)}
                      className="h-6 px-2 bg-white border border-[#94a3b8] rounded-xs text-[11.5px] outline-none flex-1"
                    >
                      {datasets.length > 0 ? (
                        datasets.map((d: any) => (
                          <option key={d.id} value={d.id}>
                            {d.name || d.sheetName || 'Database Table'}
                          </option>
                        ))
                      ) : (
                        <option value="active-excel">Excel / Active Workbook (Products$)</option>
                      )}
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="font-semibold text-slate-700 w-24">Field / Column:</label>
                    <select
                      value={selectedField}
                      onChange={(e) => setSelectedField(e.target.value)}
                      className="h-6 px-2 bg-white border border-[#94a3b8] rounded-xs text-[11.5px] font-bold text-slate-900 outline-none flex-1"
                    >
                      {availableFields.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xs flex items-center justify-between text-[11px]">
                    <div>
                      <span className="font-semibold text-emerald-900 block">Sample Record Value:</span>
                      <span className="text-[10px] text-emerald-700">From currently selected record</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-950 text-[12px]">
                      {currentRecord && currentRecord[selectedField] !== undefined
                        ? String(currentRecord[selectedField])
                        : `{{${selectedField}}}`}
                    </span>
                  </div>
                </div>
              )}

              {/* 4. GLOBAL DATA FIELD CONFIGURATION */}
              {selectedType === 'global' && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Global Field Key:</label>
                    <input
                      type="text"
                      value={globalVarName}
                      onChange={(e) => setGlobalVarName(e.target.value)}
                      className="w-full h-6 px-2 border border-[#94a3b8] rounded-xs font-mono text-[11.5px] outline-none"
                      placeholder="e.g. GLOBAL_STORE_ID"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Default Fallback Value:</label>
                    <input
                      type="text"
                      value={globalDefaultValue}
                      onChange={(e) => setGlobalDefaultValue(e.target.value)}
                      className="w-full h-6 px-2 border border-[#94a3b8] rounded-xs text-[11.5px] outline-none"
                    />
                  </div>
                </div>
              )}

              {/* 5. PRINT JOB FIELD CONFIGURATION */}
              {selectedType === 'print-job' && (
                <div className="space-y-3">
                  <label className="block font-semibold text-slate-700">Select Print Job Variable:</label>
                  <select
                    value={printJobField}
                    onChange={(e) => setPrintJobField(e.target.value)}
                    className="w-full h-6 px-2 bg-white border border-[#94a3b8] rounded-xs text-[11.5px] outline-none"
                  >
                    <option value="SYSTEM.RECORD_NUMBER">Serial Number / Record Index</option>
                    <option value="SYSTEM.DATE">Print Job Date (YYYY-MM-DD)</option>
                    <option value="SYSTEM.TIME">Print Job Time (HH:mm:ss)</option>
                    <option value="SYSTEM.USER">Logged-in Windows User Name</option>
                    <option value="SYSTEM.PRINTER">Target Printer Name</option>
                    <option value="SYSTEM.TOTAL_RECORDS">Total Labels in Print Batch</option>
                    <option value="SYSTEM.COPY_NUMBER">Current Copy Index</option>
                    <option value="SYSTEM.JOB_ID">Enterprise Print Job ID</option>
                  </select>
                </div>
              )}

              {/* 6. EXTERNAL FILE CONFIGURATION */}
              {selectedType === 'external-file' && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">File Path:</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={filePath}
                        onChange={(e) => setFilePath(e.target.value)}
                        className="flex-1 h-6 px-2 border border-[#94a3b8] rounded-xs font-mono text-[11px] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const mockPath = 'C:\\BarcodeFlow\\BatchData_2026.csv';
                          setFilePath(mockPath);
                        }}
                        className="h-6 px-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-[10.5px] font-semibold cursor-pointer"
                      >
                        Browse...
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="font-semibold text-slate-700 w-24">Reading Mode:</label>
                    <select
                      value={fileReadMode}
                      onChange={(e) => setFileReadMode(e.target.value as any)}
                      className="h-6 px-2 bg-white border border-[#94a3b8] rounded-xs text-[11.5px] outline-none flex-1"
                    >
                      <option value="first_line">First Line Only</option>
                      <option value="entire">Entire File Content</option>
                      <option value="by_index">Line Matching Record Number</option>
                    </select>
                  </div>
                </div>
              )}

              {/* 7. VISUAL BASIC SCRIPT CONFIGURATION */}
              {selectedType === 'script' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <label className="font-semibold text-slate-800 text-[12px]">Script Language:</label>
                      <select
                        value={scriptLanguage}
                        onChange={(e) => {
                          setScriptLanguage(e.target.value as any);
                          setScriptTestResult(null);
                        }}
                        className="h-6 px-2 bg-white border border-[#8fa3bc] rounded-xs text-[11px] font-semibold text-slate-800 outline-none"
                      >
                        <option value="vbscript">Visual Basic Script (VBScript)</option>
                        <option value="javascript">JavaScript (ECMAScript)</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                      Mode:
                      <select
                        aria-label="Script mode"
                        value={scriptMode}
                        onChange={(e) => {
                          setScriptMode(e.target.value as 'expression' | 'multiline');
                          setScriptTestResult(null);
                        }}
                        className="h-6 px-2 bg-white border border-[#8fa3bc] rounded-xs text-[11px] outline-none"
                      >
                        <option value="expression">Single-Line Expression</option>
                        <option value="multiline">Multi-Line Script</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={handleTestScript}
                      className="h-6 px-3 bg-[#0078d7] hover:bg-[#006cc1] text-white rounded-xs text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                    >
                      Test Expression
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    value={scriptCode}
                    onChange={(e) => {
                      setScriptCode(e.target.value);
                      setScriptTestResult(null);
                    }}
                    className="w-full p-2.5 border border-[#8fa3bc] rounded-xs font-mono text-[11.5px] outline-none focus:border-[#0078d7] bg-white transition-colors"
                    placeholder={
                      scriptMode === 'expression'
                        ? (scriptLanguage === 'vbscript' ? '"BATCH-" & Record("ProductID")' : '"BATCH-" + record.ProductID')
                        : (scriptLanguage === 'vbscript'
                          ? 'Value = "BATCH-" & Record("ProductID")'
                          : 'Value = "BATCH-" + (record.ProductID || "");')
                    }
                  />
                  {scriptTestResult && (
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xs text-[11px] flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Evaluated Output:</span>
                      <span className="font-mono font-bold text-slate-900">{scriptTestResult}</span>
                    </div>
                  )}
                </div>
              )}

              {/* 8. PRINTER CODE TEMPLATE FIELD CONFIGURATION */}
              {selectedType === 'printer-code' && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Printer Template Tag:</label>
                    <input
                      type="text"
                      value={printerFieldTag}
                      onChange={(e) => setPrinterFieldTag(e.target.value)}
                      className="w-full h-7 px-2.5 border border-[#8fa3bc] rounded-xs font-mono text-[11.5px] outline-none focus:border-[#0078d7]"
                      placeholder="<PRINTER_FIELD_1>"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Default / Preview Value:</label>
                    <input
                      type="text"
                      value={printerDefaultValue}
                      onChange={(e) => setPrinterDefaultValue(e.target.value)}
                      className="w-full h-7 px-2.5 border border-[#8fa3bc] rounded-xs text-[11.5px] outline-none focus:border-[#0078d7]"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Wizard Footer Navigation matching BarTender UI */}
        <div className="h-11 bg-[#f0f2f5] border-t border-[#cbd5e1] px-4 flex items-center justify-end gap-2 shrink-0">
          {/* < Back Button */}
          <button
            type="button"
            onClick={() => setStep(1)}
            disabled={step === 1}
            className="h-[24px] min-w-[75px] px-3 bg-white border border-[#94a3b8] hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white rounded-xs text-slate-800 font-medium text-[11.5px] cursor-pointer"
          >
            &lt; Back
          </button>

          {/* Next > Button */}
          <button
            type="button"
            onClick={() => {
              if (step === 1) {
                setStep(2);
              } else {
                handleFinish();
              }
            }}
            disabled={step === 2}
            className="h-[24px] min-w-[75px] px-3 bg-white border border-[#94a3b8] hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white rounded-xs text-slate-800 font-medium text-[11.5px] cursor-pointer"
          >
            Next &gt;
          </button>

          {/* Finish Button */}
          <button
            type="button"
            onClick={handleFinish}
            className="h-[24px] min-w-[75px] px-4 bg-[#0078d7] hover:bg-[#006cc1] border border-[#005a9e] text-white rounded-xs font-semibold text-[11.5px] shadow-xs cursor-pointer ml-1"
          >
            Finish
          </button>

          {/* Cancel Button */}
          <button
            type="button"
            onClick={onClose}
            className="h-[24px] min-w-[75px] px-3 bg-white border border-[#94a3b8] hover:bg-slate-50 rounded-xs text-slate-800 font-medium text-[11.5px] cursor-pointer ml-1"
          >
            Cancel
          </button>
        </div>


      </div>

      <SpecialCharacterModal
        isOpen={isSpecialCharModalOpen}
        onClose={() => setIsSpecialCharModalOpen(false)}
        onInsert={handleInsertSpecialChar}
      />
    </div>
  );
};
