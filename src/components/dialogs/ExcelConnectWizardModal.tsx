import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { ExcelDataSourceMode, ExcelColumnDefinition, DatabaseConnectionConfig } from '../../types';
import { excelService } from '../../services/excelService';
import { apiService } from '../../services/apiService';
import {
  FileSpreadsheet,
  Link2,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Eye,
  FileCheck,
  Hash,
  Type,
  Calendar,
  Barcode,
  Layers,
  Sparkles,
  Database,
  Server,
  FileText,
  Globe,
  Sliders,
  Check,
  FolderOpen,
  Info,
  XCircle,
} from 'lucide-react';

interface ExcelConnectWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (config: {
    mode: ExcelDataSourceMode;
    datasetName: string;
    filePath?: string;
    sheetName: string;
    headerRow: number;
    columns: ExcelColumnDefinition[];
    records: Record<string, any>[];
    autoRefresh: boolean;
    quantityColumn?: string;
    base64Content?: string;
  }) => Promise<void> | void;
  initialMode?: ExcelDataSourceMode;
  editConfig?: DatabaseConnectionConfig | null;
}

export type DataSourceTypeOption =
  | 'excel'
  | 'csv'
  | 'sqlite'
  | 'sql_server'
  | 'mysql'
  | 'postgres'
  | 'odbc'
  | 'rest_api';

export const ExcelConnectWizardModal: React.FC<ExcelConnectWizardModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  initialMode = 'linked',
  editConfig = null,
}) => {
  // Wizard state: 6 Steps
  const [step, setStep] = useState<number>(1);
  const [selectedSourceType, setSelectedSourceType] = useState<DataSourceTypeOption>('excel');
  const [mode, setMode] = useState<ExcelDataSourceMode>(initialMode);
  const [datasetName, setDatasetName] = useState<string>('Product Master');

  // Step 2: File state & Advanced options
  const [filePath, setFilePath] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [lastModified, setLastModified] = useState<string>('');
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [headerRow, setHeaderRow] = useState<number>(1);
  const [quantityColumn, setQuantityColumn] = useState<string>('');

  // Step 3: Test Connection state
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    filePath?: string;
    fileName?: string;
    sheetCount?: number;
    sheets?: string[];
    selectedSheet?: string;
    totalRecords?: number;
    lastModified?: string;
    sizeBytes?: number;
    error?: string;
    errorCode?: string;
    pathChecked?: string;
  } | null>(null);

  // Step 4: Sheet Selection
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');

  // Step 5: Preview state
  const [isInspecting, setIsInspecting] = useState<boolean>(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<Record<string, any>[]>([]);
  const [allExtractedRows, setAllExtractedRows] = useState<Record<string, any>[]>([]);
  const [columns, setColumns] = useState<ExcelColumnDefinition[]>([]);
  const [totalRecordsCount, setTotalRecordsCount] = useState<number>(0);

  // Step 6: Saving
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Initialize or reset when modal opens
  useEffect(() => {
    if (isOpen) {
      if (editConfig) {
        setStep(2);
        setSelectedSourceType('excel');
        setMode(editConfig.mode || 'linked');
        setDatasetName(editConfig.name || 'Product Master');
        setFilePath(editConfig.filePath || editConfig.endpointOrPath || '');
        setFileName(editConfig.fileName || (editConfig.filePath ? editConfig.filePath.split(/[/\\]/).pop() || '' : ''));
        setSelectedSheet(editConfig.sheetName || '');
        setHeaderRow(editConfig.headerRow || 1);
        setAutoRefresh(editConfig.autoRefresh ?? true);
        setQuantityColumn(editConfig.quantityColumn || '');
        if (editConfig.columns) {
          setColumns(editConfig.columns);
        }
      } else {
        setStep(1);
        setSelectedSourceType('excel');
        setMode(initialMode);
        setDatasetName(`Product Master Data`);
        setFilePath('');
        setFileName('');
        setFileSize(0);
        setRawFile(null);
        setAvailableSheets([]);
        setSelectedSheet('');
        setHeaderRow(1);
        setTestResult(null);
        setPreviewRows([]);
        setAllExtractedRows([]);
        setColumns([]);
        setAutoRefresh(true);
        setQuantityColumn('');
        setInspectError(null);
        setShowAdvanced(false);
      }
    }
  }, [isOpen, editConfig, initialMode]);

  // Convert File to Base64 for web browser uploads
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Execute diagnostic connection test (Step 3 or Step 2 button)
  const runTestConnection = async (targetPath: string, targetSheet?: string): Promise<boolean> => {
    setIsTesting(true);
    setTestResult(null);
    setInspectError(null);

    const pathToCheck = targetPath.trim();
    if (!pathToCheck && !rawFile) {
      setTestResult({
        success: false,
        error: 'Please select or enter an Excel file path first.',
      });
      setIsTesting(false);
      return false;
    }

    try {
      const electronAPI = (window as any).electronAPI;
      let res: any = null;

      // 1. If running in Electron with absolute path, use native Electron IPC
      if (electronAPI?.testExcelConnection && (pathToCheck.includes(':') || pathToCheck.startsWith('/'))) {
        res = await electronAPI.testExcelConnection(pathToCheck, targetSheet);
      } else {
        // 2. Prepare payload for Express backend: include base64Content if in browser mode with rawFile
        let base64Content: string | undefined = undefined;
        if (rawFile) {
          try {
            base64Content = await fileToBase64(rawFile);
          } catch (e) {
            console.warn('Could not encode file as base64:', e);
          }
        }

        res = await apiService.datasets.testConnection({
          filePath: pathToCheck,
          sheetName: targetSheet,
          base64Content,
          fileName: rawFile?.name || fileName || pathToCheck.split(/[/\\]/).pop(),
        });
      }

      if (res && res.success) {
        const sheetsList = res.sheets || [];
        setAvailableSheets(sheetsList);
        const activeSheet = targetSheet && sheetsList.includes(targetSheet)
          ? targetSheet
          : sheetsList[0] || 'Sheet1';
        setSelectedSheet(activeSheet);
        setTotalRecordsCount(res.totalRecords || 0);
        if (res.lastModified) setLastModified(res.lastModified);
        if (res.sizeBytes) setFileSize(res.sizeBytes);
        if (res.filePath) setFilePath(res.filePath);

        setTestResult({
          success: true,
          filePath: res.filePath || pathToCheck,
          fileName: res.fileName || pathToCheck.split(/[/\\]/).pop(),
          sheetCount: sheetsList.length,
          sheets: sheetsList,
          selectedSheet: activeSheet,
          totalRecords: res.totalRecords,
          lastModified: res.lastModified,
          sizeBytes: res.sizeBytes,
          pathChecked: res.pathChecked || res.filePath || pathToCheck,
        });
        setIsTesting(false);
        return true;
      }

      // 3. Client-side fallback if rawFile is available
      if (rawFile) {
        try {
          const inspected = await excelService.inspectExcelFile(rawFile, targetSheet);
          const sheetsList = inspected.sheets || ['Sheet1'];
          setAvailableSheets(sheetsList);
          const activeSheet = targetSheet && sheetsList.includes(targetSheet)
            ? targetSheet
            : inspected.defaultSheet || sheetsList[0];
          setSelectedSheet(activeSheet);

          const sheetData = await excelService.parseSheetData(rawFile, activeSheet, headerRow);
          setColumns(sheetData.columns);
          setPreviewRows(sheetData.previewRows);
          setAllExtractedRows(sheetData.allRows);
          setTotalRecordsCount(sheetData.allRows.length);

          setTestResult({
            success: true,
            filePath: rawFile.name,
            fileName: rawFile.name,
            sheetCount: sheetsList.length,
            sheets: sheetsList,
            selectedSheet: activeSheet,
            totalRecords: sheetData.allRows.length,
            lastModified: new Date(rawFile.lastModified).toISOString(),
            sizeBytes: rawFile.size,
            pathChecked: rawFile.name,
          });
          setIsTesting(false);
          return true;
        } catch (parseErr: any) {
          console.warn('Client-side fallback parse failed:', parseErr);
        }
      }

      setTestResult({
        success: false,
        filePath: pathToCheck,
        errorCode: res?.errorCode || 'FILE_NOT_FOUND',
        error: res?.error || 'Connection failed: Unable to read workbook on disk.',
        pathChecked: res?.pathChecked || pathToCheck,
      });
      setIsTesting(false);
      return false;
    } catch (err: any) {
      // If error occurs but rawFile is in memory, attempt client-side parse
      if (rawFile) {
        try {
          const inspected = await excelService.inspectExcelFile(rawFile, targetSheet);
          const sheetsList = inspected.sheets || ['Sheet1'];
          setAvailableSheets(sheetsList);
          const activeSheet = targetSheet && sheetsList.includes(targetSheet)
            ? targetSheet
            : inspected.defaultSheet || sheetsList[0];
          setSelectedSheet(activeSheet);

          const sheetData = await excelService.parseSheetData(rawFile, activeSheet, headerRow);
          setColumns(sheetData.columns);
          setPreviewRows(sheetData.previewRows);
          setAllExtractedRows(sheetData.allRows);
          setTotalRecordsCount(sheetData.allRows.length);

          setTestResult({
            success: true,
            filePath: rawFile.name,
            fileName: rawFile.name,
            sheetCount: sheetsList.length,
            sheets: sheetsList,
            selectedSheet: activeSheet,
            totalRecords: sheetData.allRows.length,
            lastModified: new Date(rawFile.lastModified).toISOString(),
            sizeBytes: rawFile.size,
            pathChecked: rawFile.name,
          });
          setIsTesting(false);
          return true;
        } catch {}
      }

      setTestResult({
        success: false,
        filePath: pathToCheck,
        errorCode: 'UNEXPECTED_ERROR',
        error: err.message || 'Error occurred while testing Excel connection.',
        pathChecked: pathToCheck,
      });
      setIsTesting(false);
      return false;
    }
  };

  // Inspect & extract sheet contents for Step 5 preview
  const inspectAndLoadSheetData = async (targetSheetName: string, targetHeaderRow: number) => {
    setIsInspecting(true);
    setInspectError(null);

    try {
      // 1. If rawFile is present, parse directly in memory
      if (rawFile) {
        const sheetData = await excelService.parseSheetData(rawFile, targetSheetName, targetHeaderRow);
        setColumns(sheetData.columns);
        setPreviewRows(sheetData.previewRows);
        setAllExtractedRows(sheetData.allRows);
        setTotalRecordsCount(sheetData.allRows.length);
        setIsInspecting(false);
        return;
      }

      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.readExcelWorkbook && filePath) {
        const res = await electronAPI.readExcelWorkbook(filePath, targetSheetName, targetHeaderRow);
        if (res.success) {
          const detectedCols: ExcelColumnDefinition[] = (res.columns || []).map((colName: string) => ({
            name: colName,
            type: 'text',
          }));
          setColumns(detectedCols);
          setPreviewRows(res.previewRows || []);
          setAllExtractedRows(res.records || []);
          setTotalRecordsCount(res.totalRecords || 0);
          if (res.sheetNames) setAvailableSheets(res.sheetNames);
          setIsInspecting(false);
          return;
        }
      }

      // Backend API fallback
      if (filePath) {
        const res = await apiService.datasets.inspectExcel({
          filePath,
          sheetName: targetSheetName,
          headerRow: targetHeaderRow,
        });
        if (res.success) {
          const detectedCols: ExcelColumnDefinition[] = (res.columns || []).map((colName: string) => ({
            name: colName,
            type: 'text',
          }));
          setColumns(detectedCols);
          setPreviewRows(res.previewRows || []);
          setAllExtractedRows(res.previewRows || []);
          setTotalRecordsCount(res.totalRecords || 0);
          if (res.sheetNames) setAvailableSheets(res.sheetNames);
          setIsInspecting(false);
          return;
        }
      }

      if (rawFile) {
        const sheetData = await excelService.parseSheetData(rawFile, targetSheetName, targetHeaderRow);
        setColumns(sheetData.columns);
        setPreviewRows(sheetData.previewRows);
        setAllExtractedRows(sheetData.allRows);
        setTotalRecordsCount(sheetData.allRows.length);
      }
    } catch (err: any) {
      console.error('[ExcelWizard] Inspect sheet error:', err);
      setInspectError(err.message || 'Failed to parse sheet data.');
    } finally {
      setIsInspecting(false);
    }
  };

  // Electron native file browser
  const handleBrowseFile = async () => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.selectExcelFile) {
      try {
        const res = await electronAPI.selectExcelFile();
        if (!res.canceled && res.filePath) {
          setFilePath(res.filePath);
          setFileName(res.fileName || res.filePath.split(/[/\\]/).pop() || 'Workbook.xlsx');
          setFileSize(res.sizeBytes || 0);
          setLastModified(res.lastModified || new Date().toISOString());
          setRawFile(null);
          setTestResult(null);
          return;
        }
      } catch (err) {
        console.warn('Native selectExcelFile failed, falling back to input:', err);
      }
    }
    // Fallback: Trigger hidden input in browser mode
    const input = document.getElementById('excel-file-input') as HTMLInputElement;
    input?.click();
  };

  // Re-locate missing or moved Excel file
  const handleLocateFile = async () => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.locateExcelFile) {
      try {
        const res = await electronAPI.locateExcelFile(filePath);
        if (!res.canceled && res.filePath) {
          setFilePath(res.filePath);
          setFileName(res.fileName || res.filePath.split(/[/\\]/).pop() || 'Workbook.xlsx');
          setFileSize(res.sizeBytes || 0);
          setLastModified(res.lastModified || new Date().toISOString());
          setRawFile(null);
          setTestResult(null);
          await runTestConnection(res.filePath, selectedSheet);
          return;
        }
      } catch (err) {
        console.warn('Locate file failed:', err);
      }
    }
    handleBrowseFile();
  };

  // Web input file change fallback
  const handleWebFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setRawFile(file);
      setFileName(file.name);
      setFileSize(file.size);
      setLastModified(new Date(file.lastModified).toISOString());
      
      // In Electron environment, File object has full native OS path in file.path
      const nativePath = (file as any).path;
      if (nativePath && typeof nativePath === 'string' && nativePath.trim()) {
        setFilePath(nativePath);
      } else {
        // In sandboxed browser environment, preserve real file name without fake C:\Data path
        setFilePath(file.name);
      }
      setTestResult(null);
    }
  };

  // Clear or reset path
  const handleClearFile = () => {
    setFilePath('');
    setFileName('');
    setFileSize(0);
    setRawFile(null);
    setTestResult(null);
  };

  // Step advancement handler
  const handleNextStep = async () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      // Run test connection when moving to step 3
      setStep(3);
      await runTestConnection(filePath, selectedSheet);
    } else if (step === 3) {
      // Ensure test passed before proceeding to sheet selection
      if (!testResult?.success) {
        const ok = await runTestConnection(filePath, selectedSheet);
        if (!ok) return;
      }
      setStep(4);
    } else if (step === 4) {
      // Load sheet data before showing step 5 preview
      setStep(5);
      await inspectAndLoadSheetData(selectedSheet, headerRow);
    } else if (step === 5) {
      setStep(6);
    }
  };

  // Column data type modification
  const handleColumnTypeChange = (colName: string, newType: ExcelColumnDefinition['type']) => {
    setColumns((prev) =>
      prev.map((c) => (c.name === colName ? { ...c, type: newType } : c))
    );
  };

  // Save persistent connection
  const handleFinish = async () => {
    setIsSaving(true);
    try {
      const activeRows = allExtractedRows.length > 0 ? allExtractedRows : previewRows;
      let base64Content: string | undefined = undefined;
      if (rawFile) {
        try {
          base64Content = await fileToBase64(rawFile);
        } catch {}
      }

      await onComplete({
        mode,
        datasetName: datasetName.trim() || fileName || 'Product Master',
        filePath: filePath.trim(),
        sheetName: selectedSheet,
        headerRow,
        columns,
        records: activeRows,
        autoRefresh: mode === 'linked' ? autoRefresh : false,
        quantityColumn: quantityColumn || undefined,
        base64Content,
      });
      onClose();
    } catch (err: any) {
      setInspectError(err.message || 'Failed to save persistent connection.');
    } finally {
      setIsSaving(false);
    }
  };

  // Format file size
  const formatSize = (bytes: number) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const stepsList = [
    { num: 1, label: 'Source Type' },
    { num: 2, label: 'Select File' },
    { num: 3, label: 'Test Connection' },
    { num: 4, label: 'Select Sheet' },
    { num: 5, label: 'Preview' },
    { num: 6, label: 'Finish' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Data Source Connection"
      subtitle="BarTender-compatible live file data source wizard"
      maxWidth="4xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Step {step} of 6</span>
            <span>•</span>
            <span className="capitalize font-medium text-slate-700">
              {step === 1 && 'Data Source Type'}
              {step === 2 && 'Select Excel File'}
              {step === 3 && 'Test Connection'}
              {step === 4 && 'Select Sheet'}
              {step === 5 && 'Preview Data & Columns'}
              {step === 6 && 'Confirm & Save Connection'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
            )}

            {step < 6 ? (
              <button
                type="button"
                disabled={
                  (step === 2 && !filePath.trim()) ||
                  (step === 3 && (!testResult || !testResult.success || isTesting)) ||
                  (step === 4 && !selectedSheet) ||
                  isInspecting
                }
                onClick={handleNextStep}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs"
              >
                Next Step
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleFinish}
                className="flex items-center gap-1.5 px-5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Saving Connection...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Finish & Connect
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      }
    >
      {/* Hidden file input for web fallback */}
      <input
        type="file"
        id="excel-file-input"
        className="hidden"
        accept=".xlsx,.xls,.xlsm,.csv"
        onChange={handleWebFileChange}
      />

      <div className="py-2">
        {/* Step Indicator Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-5 px-1">
          {stepsList.map((s) => (
            <div
              key={s.num}
              onClick={() => {
                if (s.num < step || (s.num === 2 && filePath) || (s.num === 4 && testResult?.success)) {
                  setStep(s.num);
                }
              }}
              className={`flex items-center gap-1.5 cursor-pointer transition-colors ${
                step === s.num
                  ? 'text-indigo-600 font-semibold'
                  : step > s.num
                  ? 'text-emerald-600 font-medium'
                  : 'text-slate-400'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  step === s.num
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                    : step > s.num
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {step > s.num ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.num}
              </div>
              <span className="text-xs hidden md:inline">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Global Error Banner */}
        {inspectError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Connection Warning</p>
              <p className="text-red-600 mt-0.5">{inspectError}</p>
            </div>
          </div>
        )}

        {/* STEP 1: SELECT DATA SOURCE TYPE */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-800">Select Data Source Type</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Choose the external database or file system to connect with BarcodeFlow.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              {[
                { id: 'excel', name: 'Microsoft Excel', icon: FileSpreadsheet, desc: 'Direct workbook connection (.xlsx, .xls)', active: true },
                { id: 'csv', name: 'CSV / Text File', icon: FileText, desc: 'Delimited text files (.csv, .tsv)', active: false },
                { id: 'sqlite', name: 'SQLite', icon: Database, desc: 'Embedded local database file', active: false },
                { id: 'sql_server', name: 'SQL Server', icon: Server, desc: 'Microsoft SQL Server enterprise DB', active: false },
                { id: 'mysql', name: 'MySQL', icon: Server, desc: 'MySQL production database', active: false },
                { id: 'postgres', name: 'PostgreSQL', icon: Database, desc: 'Postgres transactional server', active: false },
                { id: 'odbc', name: 'ODBC Connection', icon: Sliders, desc: 'Windows system DSN data source', active: false },
                { id: 'rest_api', name: 'REST API', icon: Globe, desc: 'Live HTTP/JSON cloud endpoint', active: false },
              ].map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => {
                    if (opt.id === 'excel') setSelectedSourceType('excel');
                  }}
                  className={`p-3.5 rounded-xl border-2 transition-all flex flex-col justify-between cursor-pointer relative ${
                    selectedSourceType === opt.id
                      ? 'border-indigo-600 bg-indigo-50/40 shadow-xs ring-1 ring-indigo-500'
                      : opt.active
                      ? 'border-slate-200 hover:border-slate-300 bg-white'
                      : 'border-slate-100 bg-slate-50/60 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <opt.icon className={`w-5 h-5 ${selectedSourceType === opt.id ? 'text-indigo-600' : 'text-slate-500'}`} />
                      {opt.id === 'excel' && (
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                          Ready
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-slate-800">{opt.name}</p>
                    <p className="text-[10px] text-slate-500 mt-1 leading-tight">{opt.desc}</p>
                  </div>
                  {selectedSourceType === opt.id && (
                    <div className="mt-2 text-[10px] text-indigo-600 font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Selected
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Excel Mode Selection */}
            {selectedSourceType === 'excel' && (
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Excel Connection Mode
                  </span>
                  <span className="text-[11px] text-slate-500">
                    BarTender-compatible live file synchronization
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    onClick={() => setMode('linked')}
                    className={`p-3 rounded-lg border-2 flex items-start gap-3 cursor-pointer transition-all ${
                      mode === 'linked'
                        ? 'border-indigo-600 bg-white shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="excel-mode"
                      checked={mode === 'linked'}
                      onChange={() => setMode('linked')}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800">Link to Excel File</span>
                        <span className="text-[9px] px-1.5 py-0.2 bg-indigo-100 text-indigo-700 font-bold rounded">
                          RECOMMENDED
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Original Excel file on disk remains the authoritative source of truth. Refresh re-reads directly without re-uploading.
                      </p>
                    </div>
                  </label>

                  <label
                    onClick={() => setMode('imported')}
                    className={`p-3 rounded-lg border-2 flex items-start gap-3 cursor-pointer transition-all ${
                      mode === 'imported'
                        ? 'border-indigo-600 bg-white shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="excel-mode"
                      checked={mode === 'imported'}
                      onChange={() => setMode('imported')}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800">Import Excel Data</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Copies spreadsheet rows into BarcodeFlow database as an isolated snapshot unaffected by disk file changes.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: SELECT EXCEL FILE */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-800">Select Excel File</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Specify the file path to your Microsoft Excel workbook (e.g. <code>C:\Data\products.xlsx</code>).
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-4 shadow-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  File Name / Path:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={filePath}
                    onChange={(e) => {
                      setFilePath(e.target.value);
                      setFileName(e.target.value.split(/[/\\]/).pop() || '');
                      setTestResult(null);
                    }}
                    placeholder="C:\Data\products.xlsx"
                    className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleBrowseFile}
                    className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs shrink-0 flex items-center gap-1.5"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    Browse...
                  </button>
                </div>
              </div>

              {/* Action Buttons: Test Connection & Advanced */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!filePath.trim() || isTesting}
                    onClick={() => {
                      setStep(3);
                      runTestConnection(filePath, selectedSheet);
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-indigo-600' : 'text-slate-600'}`} />
                    Test Connection...
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Sliders className="w-3.5 h-3.5 text-slate-500" />
                    Advanced...
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {filePath && (
                    <button
                      type="button"
                      onClick={handleClearFile}
                      className="text-xs text-slate-500 hover:text-slate-700 font-medium"
                    >
                      Clear Path
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleBrowseFile}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                  >
                    <FolderOpen className="w-3 h-3" />
                    Select Different File
                  </button>
                </div>
              </div>

              {/* Advanced Options Drawer */}
              {showAdvanced && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3 text-xs animate-in fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Connection Name:
                      </label>
                      <input
                        type="text"
                        value={datasetName}
                        onChange={(e) => setDatasetName(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-800"
                        placeholder="Product Master"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Header Row Index:
                      </label>
                      <select
                        value={headerRow}
                        onChange={(e) => setHeaderRow(parseInt(e.target.value, 10))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-800"
                      >
                        {[1, 2, 3, 4, 5].map((r) => (
                          <option key={r} value={r}>
                            Row {r} (Column Headers)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="auto-refresh-toggle"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="auto-refresh-toggle" className="text-slate-700 font-medium">
                      Automatically detect file changes on disk and prompt for refresh
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Quick File Summary if available */}
            {fileName && (
              <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200 flex items-center justify-between text-xs text-emerald-800">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium">{fileName}</span>
                  <span className="text-slate-500 text-[11px] font-mono truncate max-w-md">({filePath})</span>
                </div>
                {fileSize > 0 && (
                  <span className="text-[11px] text-emerald-700 font-semibold">{formatSize(fileSize)}</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 3: TEST CONNECTION */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-800">Test Connection</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Validating file path existence, read permissions, workbook format, and schema parsing.
              </p>
            </div>

            {isTesting ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 flex flex-col items-center gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                <p className="text-xs font-semibold text-slate-700">Validating Excel connection...</p>
                <p className="text-[11px] text-slate-500 font-mono">{filePath}</p>
              </div>
            ) : testResult?.success ? (
              <div className="p-5 rounded-xl bg-emerald-50 border-2 border-emerald-500/50 space-y-4 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-emerald-900">Connection Successful</h5>
                    <p className="text-xs text-emerald-700">
                      The Excel workbook exists on disk, is readable, and can be synchronized.
                    </p>
                  </div>
                </div>

                <div className="bg-white/80 rounded-lg p-3 border border-emerald-200 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 text-[10.5px] block font-medium">File Path:</span>
                    <span className="font-bold text-slate-800 font-mono truncate block" title={testResult.filePath}>
                      {testResult.filePath}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[10.5px] block font-medium">Worksheets:</span>
                    <span className="font-bold text-slate-800">
                      {testResult.sheetCount} {testResult.sheetCount === 1 ? 'Sheet' : 'Sheets'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[10.5px] block font-medium">Records:</span>
                    <span className="font-bold text-slate-800">{testResult.totalRecords} Rows</span>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[10.5px] block font-medium">Selected Sheet:</span>
                    <span className="font-bold text-indigo-600 font-mono">{selectedSheet || testResult.selectedSheet}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[10.5px] block font-medium">File Size:</span>
                    <span className="font-bold text-slate-700">{formatSize(testResult.sizeBytes || fileSize)}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[10.5px] block font-medium">Connection Mode:</span>
                    <span className="font-bold text-emerald-700 uppercase">{mode}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => runTestConnection(filePath, selectedSheet)}
                    className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Re-Test Connection
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-5 rounded-xl bg-red-50 border-2 border-red-400 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                    <XCircle className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h5 className="text-sm font-bold text-red-900">Connection Failed</h5>
                      {testResult?.errorCode && (
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-red-200 text-red-800 font-bold">
                          {testResult.errorCode}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-red-700 mt-0.5">
                      {testResult?.error || 'Unable to open and read the selected Excel file.'}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-white/90 rounded-lg border border-red-200 text-xs space-y-1.5 font-mono text-slate-700">
                  <div className="flex items-start gap-1">
                    <strong className="shrink-0 text-slate-900 font-sans">Path Checked:</strong>
                    <span className="break-all text-red-950 font-bold">{testResult?.pathChecked || filePath || 'None'}</span>
                  </div>
                  <div className="flex items-start gap-1">
                    <strong className="shrink-0 text-slate-900 font-sans">Diagnosis:</strong>
                    <span className="text-slate-600 font-sans">
                      {testResult?.errorCode === 'FILE_NOT_FOUND' && 'File does not exist at this path. Please browse or locate the original workbook.'}
                      {testResult?.errorCode === 'FILE_LOCKED' && 'Workbook is currently held in exclusive lock by Excel or another process.'}
                      {testResult?.errorCode === 'PERMISSION_DENIED' && 'Operating system denied read permissions to the file.'}
                      {testResult?.errorCode === 'UNSUPPORTED_FORMAT' && 'File extension must be .xlsx, .xls, .xlsm, or .csv.'}
                      {testResult?.errorCode === 'SHEET_MISSING' && 'The specified sheet was not found in the workbook.'}
                      {testResult?.errorCode === 'INVALID_WORKBOOK' && 'Workbook contains no worksheets or corrupted table headers.'}
                      {(!testResult?.errorCode || testResult?.errorCode === 'UNEXPECTED_ERROR') && 'Check file path permissions and ensure file is valid.'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg"
                    >
                      ← Change File Path
                    </button>
                    <button
                      type="button"
                      onClick={handleLocateFile}
                      className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg flex items-center gap-1.5"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-indigo-600" />
                      Locate File...
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => runTestConnection(filePath, selectedSheet)}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry Test
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: SELECT SHEETS */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-800">Select Worksheet</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select the worksheet from the workbook to bind to this data source.
                </p>
              </div>

              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                {availableSheets.length} {availableSheets.length === 1 ? 'Sheet' : 'Sheets'} Available
              </span>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Available Sheets:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {availableSheets.map((sheetName) => {
                  const isSelected = selectedSheet === sheetName;
                  const displaySheetName = sheetName.endsWith('$') ? sheetName : `${sheetName}$`;

                  return (
                    <div
                      key={sheetName}
                      onClick={() => setSelectedSheet(sheetName)}
                      className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-500 text-indigo-900 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-slate-400 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                        <div>
                          <p className="font-bold text-xs font-mono">{displaySheetName}</p>
                          <p className="text-[11px] text-slate-500">Spreadsheet table</p>
                        </div>
                      </div>

                      {isSelected && (
                        <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Selected sheet: <strong className="font-mono text-slate-800">{selectedSheet}$</strong></span>
              </div>
              <span className="text-slate-500">Header Row: {headerRow}</span>
            </div>
          </div>
        )}

        {/* STEP 5: PREVIEW */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-800">Preview Data & Columns</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  First 20 records detected from <strong>{selectedSheet}$</strong> with raw string precision.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                  {totalRecordsCount} Total Rows Detected
                </span>
                <span className="text-xs bg-indigo-100 text-indigo-800 font-bold px-2.5 py-1 rounded-full border border-indigo-200">
                  {columns.length} Columns
                </span>
              </div>
            </div>

            {/* Leading zero token notice */}
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-800">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>BarTender Precision Active:</strong> Leading zeros (e.g. <code>00123456</code>) are strictly preserved as string tokens.
                </span>
              </div>
            </div>

            {/* Data Grid Preview */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs max-h-[250px] overflow-y-auto">
              {isInspecting ? (
                <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
                  Parsing worksheet rows and headers...
                </div>
              ) : previewRows.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No records found in this worksheet. Check header row selection in Advanced.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100/90 text-slate-700 font-semibold sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 w-10 text-center text-slate-400">#</th>
                      {columns.map((c) => (
                        <th key={c.name} className="py-2 px-3 whitespace-nowrap font-medium text-slate-700">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold">{c.name}</span>
                            <select
                              value={c.type || 'text'}
                              onChange={(e) => handleColumnTypeChange(c.name, e.target.value as any)}
                              className="text-[10px] font-normal bg-white border border-slate-300 rounded px-1 py-0.5 text-slate-600"
                            >
                              <option value="text">Text</option>
                              <option value="number">Number</option>
                              <option value="barcode">Barcode</option>
                              <option value="date">Date</option>
                            </select>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {previewRows.map((row, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="py-1.5 px-3 text-center text-slate-400 text-[10px] font-sans">
                          {idx + 1}
                        </td>
                        {columns.map((c) => (
                          <td key={c.name} className="py-1.5 px-3 whitespace-nowrap text-slate-700">
                            {row[c.name] !== undefined ? String(row[c.name]) : ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* STEP 6: FINISH & PERSISTENT CONNECTION SUMMARY */}
        {step === 6 && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-800">Connection Complete</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Review your persistent data connection details before finalizing.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">{datasetName}</h3>
                    <p className="text-xs text-slate-500">Microsoft Excel • {mode === 'linked' ? 'Linked File' : 'Imported Snapshot'}</p>
                  </div>
                </div>

                <span className="text-xs font-bold px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Connected
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Source File Path
                  </span>
                  <span className="font-mono text-slate-800 font-bold block truncate" title={filePath}>
                    {filePath}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Selected Worksheet
                  </span>
                  <span className="font-mono text-indigo-700 font-bold block">
                    {selectedSheet}$
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Schema Columns ({columns.length})
                  </span>
                  <span className="text-slate-700 font-medium block truncate">
                    {columns.map((c) => c.name).join(', ')}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Synchronized Records
                  </span>
                  <span className="text-slate-800 font-bold block">
                    {totalRecordsCount} Records Available
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-200 text-xs text-indigo-900 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Live Synchronization Enabled:</strong> Any changes saved to <code>{filePath}</code> in Microsoft Excel will be immediately available in BarcodeFlow via <strong>Refresh</strong> without re-uploading or re-mapping.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
