import React, { useState, useMemo, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { LabelTemplate, PrinterDefinition, PrintJob, DpiOption } from '../../types';
import {
  Printer as PrinterIcon,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Play,
  FileText,
  Cpu,
  Layers,
  ChevronLeft,
  ChevronRight,
  Eye,
  Database,
  Sliders,
  FileCode,
  HardDrive,
  Check,
  XCircle,
  ExternalLink,
  Download,
  Info,
} from 'lucide-react';
import { generateZPL, generateTSPL, generateEPL } from '../../services/zplEngine';
import { renderTSPL, renderZPL, renderCPCL, renderSBPL } from '../../printing/renderers';
import { exportLabelsToPDF } from '../../services/pdfExportService';
import { EnterprisePrintSpooler } from '../../services/printSpoolerService';
import { apiService } from '../../services/apiService';
import {
  RecordSelectionModal,
  formatIndicesToRangeString,
  parseRangeStringToIndices,
} from './RecordSelectionModal';
import { PrinterPropertiesModal } from './PrinterPropertiesModal';
import { PrinterManagerModal } from './PrinterManagerModal';
import { PageSetupModal } from './PageSetupModal';
import { PrinterService, useCentralPrinterState } from '../../printer/printerService';
import { PrinterModel } from '../../printer/types';
import { validatePrintJob } from '../../printer/printValidation';

interface PrintCenterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  template: LabelTemplate;
  printers?: PrinterDefinition[];
  recordData: Record<string, string>;
  onJobSubmitted: (job: PrintJob) => void;
  activeRecordIndex?: number;
  selectedRecordIndices?: number[];
  onOpenDatabaseSetup?: () => void;
  onUpdateTemplate?: (template: LabelTemplate) => void;
}

export const PrintCenterDialog: React.FC<PrintCenterDialogProps> = ({
  isOpen,
  onClose,
  template,
  printers: propPrinters = [],
  recordData,
  onJobSubmitted,
  activeRecordIndex = 0,
  selectedRecordIndices: propSelectedRecordIndices = [],
  onOpenDatabaseSetup,
  onUpdateTemplate,
}) => {
  const {
    availablePrinters,
    defaultPrinter,
    activePrinter,
    printersLoading,
    setActivePrinter,
  } = useCentralPrinterState();

  // Printer state
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>('');
  const [copies, setCopies] = useState<number>(1);
  const [serializedLabels, setSerializedLabels] = useState<number>(1);
  const [printToFile, setPrintToFile] = useState<boolean>(false);
  const [darkness, setDarkness] = useState<number>(18);
  const [printSpeed, setPrintSpeed] = useState<number>(4); // ips
  const [mediaType, setMediaType] = useState<'continuous' | 'gap' | 'black_mark' | 'die_cut'>('gap');
  const [outputFormat, setOutputFormat] = useState<'zpl' | 'tspl' | 'epl' | 'cpcl' | 'sbpl' | 'pdf'>('zpl');

  // Unknown DPI Handling and user override state
  const [userDpiOverride, setUserDpiOverride] = useState<number | null>(null);
  const [customDpiInput, setCustomDpiInput] = useState<string>('');
  const [rememberDpiForPrinter, setRememberDpiForPrinter] = useState<boolean>(true);

  // Execution states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobSuccess, setJobSuccess] = useState<string | null>(null);
  const [testPrintSuccess, setTestPrintSuccess] = useState<string | null>(null);
  const [isTestingPrint, setIsTestingPrint] = useState(false);

  // Sub-modals
  const [isRecordSelectionModalOpen, setIsRecordSelectionModalOpen] = useState(false);
  const [isPrinterPropertiesModalOpen, setIsPrinterPropertiesModalOpen] = useState(false);
  const [isPrinterManagerModalOpen, setIsPrinterManagerModalOpen] = useState(false);
  const [isPageSetupModalOpen, setIsPageSetupModalOpen] = useState(false);
  const [isDocPropertiesOpen, setIsDocPropertiesOpen] = useState(false);

  // Database Connection Toggle
  const hasDatabaseConnection = Boolean(
    template.databaseConnection?.records && template.databaseConnection.records.length > 0
  );
  const [useDatabaseConnection, setUseDatabaseConnection] = useState<boolean>(hasDatabaseConnection);

  // BarTender Record Selection Mode
  const [recordSelectionMode, setRecordSelectionMode] = useState<'all' | 'current' | 'selected' | 'range'>('all');
  const [selectedIndices, setSelectedIndices] = useState<number[]>(
    propSelectedRecordIndices.length > 0
      ? propSelectedRecordIndices
      : template.databaseConnection?.records
      ? template.databaseConnection.records.map((_, i) => i)
      : [0]
  );
  const [rangeString, setRangeString] = useState<string>(() =>
    formatIndicesToRangeString(
      propSelectedRecordIndices.length > 0
        ? propSelectedRecordIndices
        : template.databaseConnection?.records
        ? template.databaseConnection.records.map((_, i) => i)
        : [0]
    )
  );

  // Quantity Source
  const [quantitySource, setQuantitySource] = useState<'manual' | 'database_field'>(
    template.databaseConnection?.quantityColumn ? 'database_field' : 'manual'
  );
  const [selectedQtyColumn, setSelectedQtyColumn] = useState<string>(
    template.databaseConnection?.quantityColumn || ''
  );

  // Stepper preview index
  const [previewStepperIndex, setPreviewStepperIndex] = useState<number>(0);

  const displayPrinters: PrinterModel[] = useMemo(() => {
    if (availablePrinters && availablePrinters.length > 0) {
      return availablePrinters;
    }
    return [];
  }, [availablePrinters]);

  // Sync initial selection when opened or when template changes
  useEffect(() => {
    if (!isOpen || displayPrinters.length === 0) return;

    // 1. Check template preferred printer
    if (template.printer?.name) {
      const match = displayPrinters.find(
        (p) =>
          p.name.toLowerCase() === template.printer!.name.toLowerCase() ||
          p.systemName.toLowerCase() === (template.printer!.systemName || '').toLowerCase()
      );
      if (match) {
        setSelectedPrinterId(match.id);
        setActivePrinter(match);
        return;
      }
    }

    // 2. Central active printer
    if (activePrinter) {
      const match = displayPrinters.find((p) => p.id === activePrinter.id);
      if (match) {
        setSelectedPrinterId(match.id);
        return;
      }
    }

    // 3. Central default printer
    if (defaultPrinter) {
      const match = displayPrinters.find((p) => p.id === defaultPrinter.id);
      if (match) {
        setSelectedPrinterId(match.id);
        setActivePrinter(match);
        return;
      }
    }

    // 4. First non-virtual printer or first printer
    const firstChoice = displayPrinters.find((p) => !p.isVirtual) || displayPrinters[0];
    if (firstChoice) {
      setSelectedPrinterId(firstChoice.id);
      setActivePrinter(firstChoice);
    }
  }, [isOpen, displayPrinters, template.printer]);

  const selectedPrinter = useMemo(() => {
    return (
      displayPrinters.find((p) => p.id === selectedPrinterId) ||
      displayPrinters[0] ||
      ({
        id: 'fallback-pdf',
        name: 'Microsoft Print to PDF',
        systemName: 'Microsoft Print to PDF',
        isDefault: true,
        status: 'READY' as const,
        dpi: 300,
        connectionType: 'windows-driver' as const,
        preferredRenderer: 'WINDOWS_DRIVER' as const,
        renderer: 'WINDOWS_DRIVER' as const,
      } as PrinterModel)
    );
  }, [displayPrinters, selectedPrinterId]);

  const isPreferredPrinterMissing = useMemo(() => {
    if (!template.printer?.name) return false;
    return !displayPrinters.some(
      (p) =>
        p.name.toLowerCase() === template.printer!.name.toLowerCase() ||
        p.systemName.toLowerCase() === (template.printer!.systemName || '').toLowerCase()
    );
  }, [template.printer, displayPrinters]);

  // Sync DPI override from printer profile or saved user override
  useEffect(() => {
    if (!selectedPrinter) return;
    if (selectedPrinter.dpi) {
      setUserDpiOverride(selectedPrinter.dpi);
      return;
    }
    const storageKey = `barcodeflow_printer_dpi_${(selectedPrinter.systemName || selectedPrinter.name).trim().toLowerCase()}`;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed > 0) {
          setUserDpiOverride(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }
    setUserDpiOverride(null);
  }, [selectedPrinterId, selectedPrinter]);

  const effectiveDpi = selectedPrinter?.dpi ?? userDpiOverride ?? null;

  const handleSelectDpi = (dpiVal: number | null) => {
    setUserDpiOverride(dpiVal);
    if (selectedPrinter && dpiVal && rememberDpiForPrinter) {
      const storageKey = `barcodeflow_printer_dpi_${(selectedPrinter.systemName || selectedPrinter.name).trim().toLowerCase()}`;
      try {
        localStorage.setItem(storageKey, String(dpiVal));
      } catch {
        // ignore
      }
    }
  };

  // Raw dataset records
  const allRecords = useMemo(() => {
    if (useDatabaseConnection && template.databaseConnection?.records && template.databaseConnection.records.length > 0) {
      return template.databaseConnection.records;
    }
    return [recordData];
  }, [useDatabaseConnection, template.databaseConnection, recordData]);

  // Detected fields
  const availableColumns = useMemo(() => {
    if (template.databaseConnection?.fields && template.databaseConnection.fields.length > 0) {
      return template.databaseConnection.fields;
    }
    if (allRecords.length > 0) {
      return Object.keys(allRecords[0]);
    }
    return [];
  }, [template.databaseConnection, allRecords]);

  // Determine subset of records to print
  const recordsToPrint = useMemo(() => {
    if (!useDatabaseConnection || (allRecords.length === 1 && !template.databaseConnection?.records?.length)) {
      return [recordData];
    }

    switch (recordSelectionMode) {
      case 'current':
        return [allRecords[activeRecordIndex] || allRecords[0]];
      case 'selected':
        if (selectedIndices.length > 0) {
          return selectedIndices.map((idx) => allRecords[idx]).filter(Boolean);
        }
        return [allRecords[activeRecordIndex] || allRecords[0]];
      case 'range': {
        const parsed = parseRangeStringToIndices(rangeString, allRecords.length);
        if (parsed.length > 0) {
          return parsed.map((idx) => allRecords[idx]).filter(Boolean);
        }
        return allRecords;
      }
      case 'all':
      default:
        return allRecords;
    }
  }, [
    useDatabaseConnection,
    allRecords,
    recordSelectionMode,
    activeRecordIndex,
    selectedIndices,
    rangeString,
    recordData,
    template.databaseConnection,
  ]);

  // Calculate total labels to print considering Excel Quantity Column and Identical Copies
  const totalLabelsCount = useMemo(() => {
    if (quantitySource === 'database_field' && selectedQtyColumn) {
      return recordsToPrint.reduce((acc, row) => {
        const val = parseInt(String(row[selectedQtyColumn] ?? '1'), 10);
        const rowQty = isNaN(val) || val <= 0 ? 1 : val;
        return acc + rowQty * copies;
      }, 0);
    }
    return recordsToPrint.length * copies * Math.max(1, serializedLabels);
  }, [recordsToPrint, quantitySource, selectedQtyColumn, copies, serializedLabels]);

  // Pre-Print Validation Engine (BarTender Rule Checks)
  const validationResult = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!selectedPrinter) {
      errors.push('No printer selected.');
    }

    const isNativeFormat = ['zpl', 'tspl', 'epl', 'cpcl', 'sbpl'].includes(outputFormat);
    if (isNativeFormat && !effectiveDpi) {
      errors.push('Printer DPI could not be detected. Please select a printer resolution for native rendering.');
    }

    if (recordsToPrint.length === 0) {
      errors.push('No records selected to print.');
    }

    // Check barcode elements
    const barcodeElements = template.elements.filter((el) =>
      ['barcode', 'datamatrix', 'qrcode', 'gs1-128'].includes(el.type)
    );

    if (barcodeElements.length > 0) {
      recordsToPrint.forEach((rec, idx) => {
        barcodeElements.forEach((bEl) => {
          let value = '';
          const anyEl = bEl as any;
          if (anyEl.dataSources?.primary?.type === 'database' && anyEl.dataSources?.primary?.databaseField) {
            value = String(rec[anyEl.dataSources.primary.databaseField] ?? '');
          } else if (anyEl.databaseField) {
            value = String(rec[anyEl.databaseField] ?? '');
          } else if (anyEl.dataBinding) {
            const fieldKey = anyEl.dataBinding.replace(/[{}]/g, '').trim();
            value = String(rec[fieldKey] ?? rec[anyEl.dataBinding] ?? '');
          } else {
            value = anyEl.value || anyEl.content || '';
          }

          if (!value.trim()) {
            errors.push(
              `Record #${idx + 1}: Barcode element "${bEl.name || bEl.id}" has empty value.`
            );
          }
        });
      });
    }

    // Check quantity column values
    if (quantitySource === 'database_field' && selectedQtyColumn) {
      recordsToPrint.forEach((rec, idx) => {
        const val = rec[selectedQtyColumn];
        if (val === undefined || val === null || String(val).trim() === '') {
          warnings.push(`Record #${idx + 1}: Missing quantity in "${selectedQtyColumn}", defaulting to 1.`);
        } else {
          const num = Number(val);
          if (isNaN(num) || num <= 0) {
            errors.push(
              `Record #${idx + 1}: Invalid quantity "${val}" in column "${selectedQtyColumn}". Must be >= 1.`
            );
          }
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors: errors.slice(0, 5), // Cap displayed errors for clean UI
      totalErrors: errors.length,
      warnings: warnings.slice(0, 3),
      totalWarnings: warnings.length,
    };
  }, [template, recordsToPrint, selectedPrinter, quantitySource, selectedQtyColumn]);

  // Expanded label items for multi-label preview
  const expandedPreviewItems = useMemo(() => {
    const items: {
      recordIndex: number;
      copyIndex: number;
      totalCopiesForRecord: number;
      record: Record<string, any>;
    }[] = [];

    recordsToPrint.forEach((rec, rIdx) => {
      let copiesForThisRow = copies;
      if (quantitySource === 'database_field' && selectedQtyColumn) {
        const parsed = parseInt(String(rec[selectedQtyColumn] ?? '1'), 10);
        copiesForThisRow = (isNaN(parsed) || parsed <= 0 ? 1 : parsed) * copies;
      }
      for (let c = 1; c <= copiesForThisRow; c++) {
        items.push({
          recordIndex: rIdx,
          copyIndex: c,
          totalCopiesForRecord: copiesForThisRow,
          record: rec,
        });
      }
    });
    return items;
  }, [recordsToPrint, copies, quantitySource, selectedQtyColumn]);

  const currentPreviewItem = expandedPreviewItems[previewStepperIndex] || expandedPreviewItems[0];

  // Test Print: Exactly 1 Safe Label
  const handleTestPrint = async () => {
    setIsTestingPrint(true);
    setTestPrintSuccess(null);
    try {
      const sampleRecord = recordsToPrint[0] || recordData;

      console.log(`[PRINT] Requested printer: ${selectedPrinter.name}`);
      console.log(`[PRINT] Windows system printer: ${selectedPrinter.systemName || selectedPrinter.name}`);
      console.log(`[PRINT] Renderer: ${outputFormat === 'tspl' ? 'TSPL' : outputFormat === 'zpl' ? 'ZPL' : outputFormat === 'cpcl' ? 'CPCL' : outputFormat === 'sbpl' ? 'SBPL' : 'WINDOWS_DRIVER'}`);
      console.log(`[PRINT] Job submitted: [Test Print] 1 label (${template.dimensions.width}×${template.dimensions.height} mm)`);

      const testRes = await PrinterService.getInstance().executeTestPrint(
        template,
        selectedPrinter,
        sampleRecord,
        {
          dpi: effectiveDpi || undefined,
          rendererOverride: outputFormat === 'tspl' ? 'TSPL' : outputFormat === 'zpl' ? 'ZPL' : outputFormat === 'epl' ? 'EPL' : outputFormat === 'cpcl' ? 'CPCL' : outputFormat === 'sbpl' ? 'SBPL' : outputFormat === 'pdf' ? 'PDF' : 'WINDOWS_DRIVER',
        }
      );

      if (!testRes.success) {
        alert(`Test print failed: ${testRes.error || testRes.message || 'Printer not found in Windows spooler.'}`);
        return;
      }

      setTestPrintSuccess(`Test print dispatched: 1 label sent to "${selectedPrinter.name}"`);
      setTimeout(() => setTestPrintSuccess(null), 3500);
    } catch (err: any) {
      alert(`Test print failed: ${err.message}`);
    } finally {
      setIsTestingPrint(false);
    }
  };

  // Main Print Execution
  const handleExecutePrint = async () => {
    if (!validationResult.isValid) return;

    setIsSubmitting(true);
    try {
      const dispatchedRecords: Record<string, any>[] = [];
      recordsToPrint.forEach((rec) => {
        let copiesForThisRow = copies;
        if (quantitySource === 'database_field' && selectedQtyColumn) {
          const parsed = parseInt(String(rec[selectedQtyColumn] ?? '1'), 10);
          copiesForThisRow = (isNaN(parsed) || parsed <= 0 ? 1 : parsed) * copies;
        }
        for (let c = 0; c < copiesForThisRow; c++) {
          dispatchedRecords.push({ ...rec });
        }
      });

      // Handle Serialization (increment serial numbers if serializedLabels > 1)
      if (serializedLabels > 1) {
        const serializedExpanded: Record<string, any>[] = [];
        let counterSeq = 1;
        dispatchedRecords.forEach((baseRec) => {
          for (let s = 0; s < serializedLabels; s++) {
            const paddedSerial = String(counterSeq).padStart(6, '0');
            serializedExpanded.push({
              ...baseRec,
              SERIAL_NO: paddedSerial,
              SERIAL: paddedSerial,
              COUNTER: paddedSerial,
              SN: paddedSerial,
            });
            counterSeq++;
          }
        });
        dispatchedRecords.length = 0;
        dispatchedRecords.push(...serializedExpanded);
      }

      // Handle "Print to file" (PRN / ZPL file download)
      if (printToFile) {
        let fileContent = '';
        if (outputFormat === 'tspl') {
          fileContent = renderTSPL(template, dispatchedRecords as any, { copies: 1, dpi: effectiveDpi || undefined });
        } else if (outputFormat === 'epl') {
          fileContent = dispatchedRecords.map((r) => generateEPL(template, r as any)).join('\n');
        } else if (outputFormat === 'cpcl') {
          fileContent = renderCPCL(template, dispatchedRecords as any, { copies: 1, dpi: effectiveDpi || undefined });
        } else if (outputFormat === 'sbpl') {
          fileContent = renderSBPL(template, dispatchedRecords as any, { copies: 1, dpi: effectiveDpi || undefined });
        } else {
          fileContent = renderZPL(template, dispatchedRecords as any, { copies: 1, dpi: effectiveDpi || undefined });
        }

        const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${template.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.prn`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      if (outputFormat === 'pdf') {
        await exportLabelsToPDF(template, dispatchedRecords);
      }

      console.log(`[PRINT] Requested printer: ${selectedPrinter.name}`);
      console.log(`[PRINT] Windows system printer: ${selectedPrinter.systemName || selectedPrinter.name}`);
      console.log(`[PRINT] Renderer: ${outputFormat.toUpperCase()}`);
      console.log(`[PRINT] Job submitted: ${dispatchedRecords.length} label(s) (${template.dimensions.width}×${template.dimensions.height} mm)`);

      const hardwareDispatchResult = await PrinterService.getInstance().dispatchPrintJob({
        template,
        printer: selectedPrinter,
        records: dispatchedRecords,
        copies: 1,
        darkness,
        speed: printSpeed,
        dpi: effectiveDpi || undefined,
        rendererOverride: outputFormat === 'tspl' ? 'TSPL' : outputFormat === 'zpl' ? 'ZPL' : outputFormat === 'epl' ? 'EPL' : outputFormat === 'cpcl' ? 'CPCL' : outputFormat === 'sbpl' ? 'SBPL' : outputFormat === 'pdf' ? 'PDF' : 'WINDOWS_DRIVER',
      });

      if (!hardwareDispatchResult.success) {
        setIsSubmitting(false);
        alert(`Print execution error: ${hardwareDispatchResult.error || hardwareDispatchResult.message || 'Spooler failed.'}`);
        return;
      }

      const spooler = EnterprisePrintSpooler.getInstance();
      const dispatchedJob = spooler.dispatchJob({
        template,
        printer: {
          id: selectedPrinter.id,
          name: selectedPrinter.name,
          model: selectedPrinter.model || selectedPrinter.name,
          brand: (selectedPrinter.manufacturer?.includes('Zebra') ? 'Zebra' : selectedPrinter.manufacturer?.includes('TSC') ? 'TSC' : 'Desktop PDF') as any,
          dpi: (selectedPrinter.dpi || 300) as any,
          ipAddress: selectedPrinter.portName || selectedPrinter.port || '127.0.0.1',
          port: 9100,
          status: 'online',
          protocol: outputFormat as any,
          location: 'Local Windows Spooler',
          mediaWidth: template.dimensions.width,
          mediaHeight: template.dimensions.height,
        },
        copies: 1,
        records: dispatchedRecords as any,
        format: outputFormat,
        submittedBy: 'Operator (BarcodeFlow Suite)',
        darkness,
        speed: printSpeed,
      });

      // Attach immutable BarcodeFlow print snapshot & metadata
      dispatchedJob.dataSnapshot = recordsToPrint.map((r) => ({ ...r }));
      dispatchedJob.printMode = recordSelectionMode;
      dispatchedJob.quantityColumn = quantitySource === 'database_field' ? selectedQtyColumn : undefined;
      dispatchedJob.totalLabelsPrinted = dispatchedRecords.length;
      dispatchedJob.datasetName = template.databaseConnection?.name;
      dispatchedJob.excelFilePath = template.databaseConnection?.filePath;
      dispatchedJob.excelSheetName = template.databaseConnection?.sheetName;
      dispatchedJob.status = 'completed';

      onJobSubmitted(dispatchedJob);
      setJobSuccess(
        `Dispatched ${dispatchedRecords.length} label(s) to "${selectedPrinter.name}" successfully.`
      );
      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
        setJobSuccess(null);
      }, 1400);
    } catch (err: any) {
      setIsSubmitting(false);
      alert(`Print execution error: ${err.message}`);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Industrial Print Center & Spooler"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4 text-xs text-slate-700">
          {jobSuccess ? (
            <div className="p-8 text-center space-y-3">
              <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
              <h3 className="text-base font-bold text-slate-900">Job Sent to Enterprise Spooler</h3>
              <p className="text-slate-600">{jobSuccess}</p>
            </div>
          ) : (
            <>
              {/* SECTION 1: PRINTER SELECTION & HARDWARE DETAILS (B1) */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                {isPreferredPrinterMissing && (
                  <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Preferred printer unavailable: <strong>{template.printer?.name}</strong></span>
                    </div>
                    {defaultPrinter && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPrinterId(defaultPrinter.id);
                          setActivePrinter(defaultPrinter);
                        }}
                        className="px-2 py-0.5 bg-white border border-amber-300 rounded text-[10px] font-semibold hover:bg-amber-100 text-amber-800"
                      >
                        Use Windows Default ({defaultPrinter.name})
                      </button>
                    )}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <PrinterIcon className="w-4 h-4 text-indigo-600" />
                    <span className="font-bold text-xs text-slate-900">Printer:</span>
                    <select
                      value={selectedPrinterId}
                      onChange={(e) => {
                        setSelectedPrinterId(e.target.value);
                        const p = displayPrinters.find((x) => x.id === e.target.value);
                        if (p) {
                          setActivePrinter(p);
                          if (p.nativeLanguages?.includes('TSPL')) setOutputFormat('tspl');
                          else if (p.nativeLanguages?.includes('ZPL')) setOutputFormat('zpl');
                          else if (p.nativeLanguages?.includes('EPL')) setOutputFormat('epl');
                          else if (p.nativeLanguages?.includes('CPCL')) setOutputFormat('cpcl');
                          else if (p.nativeLanguages?.includes('SBPL')) setOutputFormat('sbpl');
                          else setOutputFormat('pdf');
                        }
                      }}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-1 focus:ring-indigo-500 min-w-[200px]"
                    >
                      {displayPrinters.some((p) => !p.isVirtual) && (
                        <optgroup label="Installed Windows Printers">
                          {displayPrinters
                            .filter((p) => !p.isVirtual)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} {p.isDefault ? '(Default)' : ''}
                              </option>
                            ))}
                        </optgroup>
                      )}
                      {displayPrinters.some((p) => p.isVirtual) && (
                        <optgroup label="Virtual BarcodeFlow Printers">
                          {displayPrinters
                            .filter((p) => p.isVirtual)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                        </optgroup>
                      )}
                    </select>

                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                        selectedPrinter?.status?.toLowerCase() === 'ready' || selectedPrinter?.status?.toLowerCase() === 'online'
                          ? 'bg-emerald-100 text-emerald-800'
                          : selectedPrinter?.status?.toLowerCase() === 'busy'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {selectedPrinter?.status?.toLowerCase() === 'ready' || selectedPrinter?.status?.toLowerCase() === 'online'
                        ? 'Ready'
                        : selectedPrinter?.status || 'Offline'}
                    </span>
                  </div>

                  {/* Printer action buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={async () => {
                        if (selectedPrinter && window.barcodeFlow?.printers?.openProperties) {
                          const res = await window.barcodeFlow.printers.openProperties(
                            selectedPrinter.systemName || selectedPrinter.name
                          );
                          if (!res?.success) {
                            setIsPrinterPropertiesModalOpen(true);
                          }
                        } else {
                          setIsPrinterPropertiesModalOpen(true);
                        }
                      }}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 transition-colors flex items-center gap-1 shadow-2xs"
                      title="Open Windows Native Printing Preferences"
                    >
                      <Sliders className="w-3.5 h-3.5 text-slate-500" />
                      Preferences...
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPageSetupModalOpen(true)}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 transition-colors flex items-center gap-1 shadow-2xs"
                      title="Edit page dimensions, margins, and multi-up grid layout"
                    >
                      <Info className="w-3.5 h-3.5 text-indigo-600" />
                      Document Properties...
                    </button>
                    <button
                      type="button"
                      onClick={handleTestPrint}
                      disabled={isTestingPrint}
                      className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                      title="Prints 1 test label only using sample data"
                    >
                      <FileCode className="w-3.5 h-3.5 text-indigo-600" />
                      {isTestingPrint ? 'Testing...' : 'Test Print (1 Label)'}
                    </button>
                  </div>
                </div>

                {/* Printer hardware info line */}
                <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-3 font-mono bg-white p-2 rounded-lg border border-slate-200">
                  <span><strong>Device:</strong> {selectedPrinter?.name}</span>
                  <span>•</span>
                  <span><strong>Driver:</strong> {selectedPrinter?.driverName || 'Windows Driver'}</span>
                  <span>•</span>
                  <span><strong>Port:</strong> {selectedPrinter?.portName || selectedPrinter?.port || 'Spooler'}</span>
                  <span>•</span>
                  <span><strong>DPI:</strong> {effectiveDpi ? `${effectiveDpi} DPI` : 'Unknown'}</span>
                </div>

                {/* Resolution selector when hardware DPI is unknown */}
                {!selectedPrinter?.dpi && (
                  <div className={`p-3 rounded-lg border text-xs space-y-2 ${
                    !effectiveDpi ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold">
                        {!effectiveDpi ? (
                          <>
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Printer DPI could not be detected.</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Resolution Override: {effectiveDpi} DPI</span>
                          </>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {outputFormat === 'pdf' ? 'Optional for Windows Driver' : 'Required for Native Output'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <span className="font-semibold text-slate-700">Printer Resolution:</span>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="printerDpiRadio"
                          checked={effectiveDpi === 203}
                          onChange={() => handleSelectDpi(203)}
                          className="text-indigo-600"
                        />
                        <span>203 DPI</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="printerDpiRadio"
                          checked={effectiveDpi === 300}
                          onChange={() => handleSelectDpi(300)}
                          className="text-indigo-600"
                        />
                        <span>300 DPI</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="printerDpiRadio"
                          checked={effectiveDpi === 600}
                          onChange={() => handleSelectDpi(600)}
                          className="text-indigo-600"
                        />
                        <span>600 DPI</span>
                      </label>
                      <div className="flex items-center gap-1">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="printerDpiRadio"
                            checked={effectiveDpi !== null && ![203, 300, 600].includes(effectiveDpi)}
                            onChange={() => {
                              const customVal = parseInt(customDpiInput, 10);
                              if (!isNaN(customVal) && customVal > 0) {
                                handleSelectDpi(customVal);
                              }
                            }}
                            className="text-indigo-600"
                          />
                          <span>Custom:</span>
                        </label>
                        <input
                          type="number"
                          min={100}
                          max={1200}
                          placeholder="DPI"
                          value={customDpiInput}
                          onChange={(e) => {
                            setCustomDpiInput(e.target.value);
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val) && val >= 50 && val <= 2400) {
                              handleSelectDpi(val);
                            }
                          }}
                          className="w-16 px-2 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-0.5">
                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-600">
                        <input
                          type="checkbox"
                          checked={rememberDpiForPrinter}
                          onChange={(e) => {
                            setRememberDpiForPrinter(e.target.checked);
                            if (e.target.checked && effectiveDpi && selectedPrinter) {
                              const storageKey = `barcodeflow_printer_dpi_${(selectedPrinter.systemName || selectedPrinter.name).trim().toLowerCase()}`;
                              localStorage.setItem(storageKey, String(effectiveDpi));
                            }
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Remember for this printer</span>
                      </label>
                    </div>
                  </div>
                )}

                {testPrintSuccess && (
                  <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{testPrintSuccess}</span>
                  </div>
                )}

                {/* Document Properties Collapsible Card */}
                {isDocPropertiesOpen && (
                  <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-200 text-xs space-y-1.5 animate-in fade-in">
                    <div className="font-bold text-indigo-950 flex items-center justify-between">
                      <span>Label Document Specification: {template.name}</span>
                      <span className="text-[10px] text-indigo-600">BarcodeFlow Document Engine</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px] pt-1">
                      <div>Width: <strong>{template.dimensions.width} mm</strong></div>
                      <div>Height: <strong>{template.dimensions.height} mm</strong></div>
                      <div>DPI: <strong>{template.dimensions.dpi || 203}</strong></div>
                      <div>Elements: <strong>{template.elements.length} Objects</strong></div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 2: COPIES & SERIALIZATION (B2) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-white border border-slate-200 rounded-xl">
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    Identical Copies of Each Label:
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={copies}
                    onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Duplicate prints per database row
                  </span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    Serialized Labels Count:
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={serializedLabels}
                    onChange={(e) => setSerializedLabels(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Sequential numbering multiplier
                  </span>
                </div>

                <div className="flex flex-col justify-between">
                  <span className="text-xs font-bold text-slate-800 block mb-1">Output Handling:</span>
                  <label className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={printToFile}
                      onChange={(e) => setPrintToFile(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="text-[11px] font-medium text-slate-700 flex items-center gap-1.5">
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                      <span>Print to File (.prn / .zpl)</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* SECTION 3: DATABASE CONNECTION CARD (B3) */}
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-900">
                    <input
                      type="checkbox"
                      checked={useDatabaseConnection}
                      onChange={(e) => setUseDatabaseConnection(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <Database className="w-4 h-4 text-indigo-600" />
                    <span>Use Database / Data Source Connection</span>
                  </label>

                  {onOpenDatabaseSetup && (
                    <button
                      type="button"
                      onClick={onOpenDatabaseSetup}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Database Connection Setup...
                    </button>
                  )}
                </div>

                {useDatabaseConnection ? (
                  <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-emerald-950">
                          {template.databaseConnection?.name || 'Linked Excel Spreadsheet'}
                        </span>
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded">
                          {template.databaseConnection?.mode === 'linked' ? 'Excel Linked' : 'Connected'}
                        </span>
                        {template.databaseConnection?.sheetName && (
                          <span className="text-[11px] font-mono text-emerald-800">
                            [{template.databaseConnection.sheetName}]
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 truncate max-w-md font-mono">
                        {template.databaseConnection?.filePath || 'Active database dataset'}
                      </p>
                    </div>

                    <div className="text-right text-xs">
                      <span className="font-bold text-emerald-800">
                        {allRecords.length} records available
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-500 text-[11px]">
                    Database connection disabled. Printing single standalone label using current designer record.
                  </div>
                )}
              </div>

              {/* SECTION 4: QUERIED RECORDS / RECORD SELECTION (B4) */}
              {useDatabaseConnection && (
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      <span>Queried Records:</span>
                    </label>

                    <div className="flex items-center gap-2">
                      <select
                        value={recordSelectionMode}
                        onChange={(e) => setRecordSelectionMode(e.target.value as any)}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                      >
                        <option value="all">All Records ({allRecords.length})</option>
                        <option value="current">Current Record (Row #{activeRecordIndex + 1})</option>
                        <option value="selected">Selected Records ({selectedIndices.length})</option>
                        <option value="range">Record Range (e.g. 1-10)</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => setIsRecordSelectionModalOpen(true)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1"
                      >
                        Select Records...
                      </button>
                    </div>
                  </div>

                  {/* Range Text Input Bar */}
                  {recordSelectionMode === 'range' && (
                    <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-xs font-semibold text-slate-700">Record Range:</span>
                      <input
                        type="text"
                        value={rangeString}
                        onChange={(e) => setRangeString(e.target.value)}
                        placeholder="e.g. 1, 3, 7-10"
                        className="flex-1 px-2.5 py-1 bg-white border border-slate-300 rounded text-xs font-mono text-slate-800 font-bold"
                      />
                      <span className="text-[11px] text-indigo-600 font-bold">
                        {recordsToPrint.length} records in range
                      </span>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-500 flex items-center justify-between">
                    <span>
                      Active Scope: <strong>{recordsToPrint.length}</strong> of {allRecords.length} records chosen
                    </span>
                    <span className="font-mono text-indigo-600 font-bold">
                      Range: {rangeString || 'All'}
                    </span>
                  </div>
                </div>
              )}

              {/* SECTION 5: COPIES PER RECORD / QUANTITY FIELD (B5) */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    Quantity Source (Copies per Record):
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700">
                      <input
                        type="radio"
                        name="qtySource"
                        value="manual"
                        checked={quantitySource === 'manual'}
                        onChange={() => setQuantitySource('manual')}
                        className="text-indigo-600"
                      />
                      <span>Manual Quantity ({copies})</span>
                    </label>

                    {availableColumns.length > 0 && (
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700">
                        <input
                          type="radio"
                          name="qtySource"
                          value="database_field"
                          checked={quantitySource === 'database_field'}
                          onChange={() => setQuantitySource('database_field')}
                          className="text-indigo-600"
                        />
                        <span>Database Field</span>
                      </label>
                    )}
                  </div>
                </div>

                {quantitySource === 'database_field' && availableColumns.length > 0 && (
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700 shrink-0">
                      Excel Quantity Column:
                    </span>
                    <select
                      value={selectedQtyColumn}
                      onChange={(e) => setSelectedQtyColumn(e.target.value)}
                      className="flex-1 px-2.5 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-bold text-indigo-900"
                    >
                      <option value="">-- Choose Column (e.g. Quantity / Copies) --</option>
                      {availableColumns.map((col) => (
                        <option key={col} value={col}>
                          {col} (Sample value: {String(allRecords[0]?.[col] ?? '1')})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* SECTION 6: PRE-PRINT VALIDATION BANNER (B6) */}
              <div
                className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                  validationResult.isValid
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                    : 'bg-red-50 border-red-300 text-red-900'
                }`}
              >
                {validationResult.isValid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">
                      {validationResult.isValid
                        ? `✓ Pre-Print Validation Passed — ${recordsToPrint.length} records ready to print`
                        : `Pre-Print Validation Failed (${validationResult.totalErrors} issue${
                            validationResult.totalErrors > 1 ? 's' : ''
                          })`}
                    </span>
                    <span className="font-bold font-mono">
                      Total Output: {totalLabelsCount} Labels
                    </span>
                  </div>

                  {!validationResult.isValid && (
                    <ul className="list-disc list-inside text-red-700 space-y-0.5 font-mono text-[11px] pt-1">
                      {validationResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}

                  {validationResult.warnings.length > 0 && (
                    <div className="text-amber-700 text-[11px] pt-0.5">
                      {validationResult.warnings.join(' • ')}
                    </div>
                  )}
                </div>
              </div>

              {/* Multi-label Stepper Preview */}
              {expandedPreviewItems.length > 0 && (
                <div className="p-3 bg-indigo-50/40 border border-indigo-100 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
                      <Eye className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Multi-Label Sequence Preview</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-indigo-900 font-mono">
                      <button
                        type="button"
                        disabled={previewStepperIndex <= 0}
                        onClick={() => setPreviewStepperIndex((p) => Math.max(0, p - 1))}
                        className="p-1 rounded bg-white hover:bg-indigo-100 disabled:opacity-30 border border-indigo-200"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-bold px-1.5">
                        Label {previewStepperIndex + 1} of {expandedPreviewItems.length}
                      </span>
                      <button
                        type="button"
                        disabled={previewStepperIndex >= expandedPreviewItems.length - 1}
                        onClick={() => setPreviewStepperIndex((p) => Math.min(expandedPreviewItems.length - 1, p + 1))}
                        className="p-1 rounded bg-white hover:bg-indigo-100 disabled:opacity-30 border border-indigo-200"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {currentPreviewItem && (
                    <div className="bg-white p-2.5 rounded-lg border border-indigo-100 text-[11px] flex items-center justify-between gap-2">
                      <span className="font-bold text-indigo-700 font-mono shrink-0">
                        Record #{currentPreviewItem.recordIndex + 1} (Label Copy {currentPreviewItem.copyIndex}/{currentPreviewItem.totalCopiesForRecord}):
                      </span>
                      <span className="text-slate-600 truncate font-mono">
                        {Object.entries(currentPreviewItem.record).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* FOOTER ACTIONS */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <div className="text-xs text-slate-500 font-mono">
                  Format: <strong>{outputFormat.toUpperCase()}</strong> • Darkness: <strong>{darkness}</strong> • Speed: <strong>{printSpeed} ips</strong>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-1.5 border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-700 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecutePrint}
                    disabled={isSubmitting || !validationResult.isValid || totalLabelsCount === 0}
                    className="flex items-center gap-1.5 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg font-bold shadow-xs transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>{isSubmitting ? 'Spooling...' : `Print ${totalLabelsCount} Labels`}</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Record Selection Modal (B4) */}
      <RecordSelectionModal
        isOpen={isRecordSelectionModalOpen}
        onClose={() => setIsRecordSelectionModalOpen(false)}
        allRecords={allRecords}
        columns={availableColumns}
        initialSelectedIndices={selectedIndices}
        datasetName={template.databaseConnection?.name}
        quantityColumn={quantitySource === 'database_field' ? selectedQtyColumn : undefined}
        onApplySelection={(newIndices, newRangeStr) => {
          setSelectedIndices(newIndices);
          setRangeString(newRangeStr);
          setRecordSelectionMode(newIndices.length === allRecords.length ? 'all' : 'selected');
        }}
      />

      {/* Printer Hardware Properties Modal (B1) */}
      {selectedPrinter && (
        <PrinterPropertiesModal
          isOpen={isPrinterPropertiesModalOpen}
          onClose={() => setIsPrinterPropertiesModalOpen(false)}
          printer={selectedPrinter as any}
          darkness={darkness}
          printSpeed={printSpeed}
          mediaType={mediaType}
          onSaveProperties={(props) => {
            setDarkness(props.darkness);
            setPrintSpeed(props.speed);
            setMediaType(props.mediaType);
          }}
        />
      )}

      {/* Enterprise Printers & Media Manager (Phase 95) */}
      <PrinterManagerModal
        isOpen={isPrinterManagerModalOpen}
        onClose={() => setIsPrinterManagerModalOpen(false)}
        onPrinterSelected={(p) => {
          setSelectedPrinterId(p.id);
        }}
      />

      {/* Editable Document Properties / Page Setup Modal */}
      {isPageSetupModalOpen && (
        <PageSetupModal
          isOpen={isPageSetupModalOpen}
          onClose={() => setIsPageSetupModalOpen(false)}
          template={template}
          onApplyPageSetup={(updates) => {
            const updatedTmpl: LabelTemplate = {
              ...template,
              dimensions: {
                ...template.dimensions,
                ...updates.dimensions,
              },
              margins: {
                ...template.margins,
                ...updates.margins,
              },
              sheetGrid: updates.sheetGrid
                ? {
                    ...template.sheetGrid,
                    ...updates.sheetGrid,
                  }
                : template.sheetGrid,
              shape: updates.shape || template.shape,
              cornerRadius:
                updates.cornerRadius !== undefined
                  ? updates.cornerRadius
                  : template.cornerRadius,
              mediaType: updates.mediaType || template.mediaType,
              updatedAt: new Date().toISOString(),
            };
            onUpdateTemplate?.(updatedTmpl);
            setIsPageSetupModalOpen(false);
          }}
        />
      )}
    </>
  );
};
