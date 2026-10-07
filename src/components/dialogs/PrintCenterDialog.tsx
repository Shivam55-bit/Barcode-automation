import React, { useState, useMemo, useEffect, useRef } from 'react';
import { LabelTemplate, PrinterDefinition, PrintJob, ObjectPrintMethodSettings } from '../../types';
import {
  Printer as PrinterIcon,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Play,
  FileText,
  Layers,
  ChevronLeft,
  ChevronRight,
  Eye,
  Database,
  Sliders,
  FileCode,
  Check,
  X,
  SlidersHorizontal,
  HelpCircle,
  Settings,
  Trash2,
  RefreshCw,
  Folder,
} from 'lucide-react';
import { promptSelectFolder } from '../../services/fileSavePromptService';
import { generateZPL, generateTSPL, generateEPL } from '../../services/zplEngine';
import { renderTSPL, renderZPL, renderCPCL, renderSBPL } from '../../printing/renderers';
import { exportLabelsToPDF } from '../../services/pdfExportService';
import { EnterprisePrintSpooler } from '../../services/printSpoolerService';
import { advanceTemplateSerialState, AtomicSerialReservationService, computeNextSerialValue } from '../../services/serializationEngine';
import { evaluateElementData } from '../../services/dataSourceEngine';
import { validatePrintDataBarcodes, PrintValidationResult } from '../../services/printValidationService';
import {
  RecordSelectionModal,
  formatIndicesToRangeString,
  parseRangeStringToIndices,
} from './RecordSelectionModal';
import { PrinterPropertiesModal } from './PrinterPropertiesModal';
import { PrinterManagerModal } from './PrinterManagerModal';
import { PageSetupModal } from './PageSetupModal';
import { ShowPrinterCodeModal } from './ShowPrinterCodeModal';
import { PrinterCodeModifierModal, PrinterCodeModifierConfig } from './PrinterCodeModifierModal';
import { PrinterService, useCentralPrinterState } from '../../printer/printerService';
import { PrinterModel } from '../../printer/types';
import { createPrintPlan, PrintPlan } from '../../services/printPlanService';
import { PrintExecutionService, resolveExactDeviceName } from '../../services/printExecutionService';
import {
  getGlobalObjectPrintMethodSettings,
  saveGlobalObjectPrintMethodSettings,
  getEffectiveObjectPrintMethodSettings,
  DEFAULT_OBJECT_PRINT_METHOD_SETTINGS,
} from '../../services/objectPrintMethodService';

export interface PrintCenterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  template: LabelTemplate;
  printers?: PrinterDefinition[];
  recordData: Record<string, string>;
  onJobSubmitted: (job: PrintJob) => void;
  activeRecordIndex?: number;
  selectedRecordIndices?: number[];
  /** Authoritative filtered + sorted visible record set (spec 40: print == canvas) */
  visibleRecords?: Record<string, any>[];
  onOpenDatabaseSetup?: () => void;
  onUpdateTemplate?: (template: LabelTemplate) => void;
  onOpenPrintPreview?: (planOptions: {
    printer: PrinterModel;
    effectiveDpi: number | null;
    recordsToPrint: Record<string, any>[];
    copies: number;
    quantitySource: 'manual' | 'database_field';
    selectedQtyColumn?: string;
    serializedLabels: number;
    startingSlot: number;
  }) => void;
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
  visibleRecords,
  onOpenDatabaseSetup,
  onUpdateTemplate,
  onOpenPrintPreview,
}) => {
  const {
    availablePrinters,
    defaultPrinter,
    activePrinter,
    printersLoading,
    setActivePrinter,
    refreshPrinters,
  } = useCentralPrinterState();

  // Dialog top tabs: 'print' | 'objectPrintMethod'
  const [activeTopTab, setActiveTopTab] = useState<'print' | 'objectPrintMethod'>('print');
  // Sub-tabs inside Print tab: 'quantity' | 'options'
  const [activeSubTab, setActiveSubTab] = useState<'quantity' | 'options'>('quantity');

  // Printer selection & parameters
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>('');
  const [copies, setCopies] = useState<number>(1);
  const [serializedLabels, setSerializedLabels] = useState<number>(1);
  const [printOnBothSides, setPrintOnBothSides] = useState<boolean>(false);
  const [printToFile, setPrintToFile] = useState<boolean>(false);
  const [startingSlot, setStartingSlot] = useState<number>(
    (template.sheetGrid as any)?.startingSlot || 1
  );

  // Print properties
  const [darkness, setDarkness] = useState<number>(18);
  const [printSpeed, setPrintSpeed] = useState<number>(4); // ips
  const [mediaType, setMediaType] = useState<'continuous' | 'gap' | 'black_mark' | 'die_cut'>('gap');
  const [outputFormat, setOutputFormat] = useState<'zpl' | 'tspl' | 'epl' | 'cpcl' | 'sbpl' | 'pdf'>('pdf');

  // Options Tab Controls
  const [repeatDataEntry, setRepeatDataEntry] = useState<boolean>(false);
  const [cancelQueuedJobsBeforePrint, setCancelQueuedJobsBeforePrint] = useState<boolean>(false);
  const [enableDataEntry, setEnableDataEntry] = useState<boolean>(
    Boolean(template.dataEntryForm || (template.variables && template.variables.some((v: any) => v.promptAtPrint)))
  );
  const [enableCodeModifier, setEnableCodeModifier] = useState<boolean>(false);
  const [showPrinterCodeAtEnd, setShowPrinterCodeAtEnd] = useState<boolean>(false);

  // Printer Code Modifier Config
  const [codeModifierConfig, setCodeModifierConfig] = useState<PrinterCodeModifierConfig>({
    enabled: false,
    prefix: '',
    suffix: '',
    rules: [],
  });

  // Object Print Method Settings (Draft State)
  const [printMethodSettings, setPrintMethodSettings] = useState<ObjectPrintMethodSettings>(() =>
    getEffectiveObjectPrintMethodSettings(template)
  );

  // DPI override
  const [userDpiOverride, setUserDpiOverride] = useState<number | null>(null);

  // Execution states
  type PrintProgressState = 'IDLE' | 'PREPARING' | 'RENDERING' | 'DISPATCHING' | 'SUBMITTED' | 'CANCELLED' | 'FAILED';
  const [printProgressState, setPrintProgressState] = useState<PrintProgressState>('IDLE');
  const [printErrorMessage, setPrintErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobSuccess, setJobSuccess] = useState<string | null>(null);
  const [testPrintSuccess, setTestPrintSuccess] = useState<string | null>(null);
  const [isTestingPrint, setIsTestingPrint] = useState(false);
  const [isCancellingJobs, setIsCancellingJobs] = useState(false);

  // Pre-print barcode data validation (spec 28)
  const [barcodePreflight, setBarcodePreflight] = useState<PrintValidationResult | null>(null);
  const barcodeOverrideRef = useRef<boolean>(false);

  // Generated code modal state
  const [generatedCodePayload, setGeneratedCodePayload] = useState<{
    isOpen: boolean;
    code: string;
    format: string;
  }>({
    isOpen: false,
    code: '',
    format: 'ZPL',
  });

  // Sub-modals
  const [isRecordSelectionModalOpen, setIsRecordSelectionModalOpen] = useState(false);
  const [isPrinterPropertiesModalOpen, setIsPrinterPropertiesModalOpen] = useState(false);
  const [isPageSetupModalOpen, setIsPageSetupModalOpen] = useState(false);
  const [isCodeModifierModalOpen, setIsCodeModifierModalOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isOfflinePrinterModalOpen, setIsOfflinePrinterModalOpen] = useState(false);

  // Authoritative dataset = filtered + sorted visible records when supplied,
  // otherwise fall back to the raw connection records (spec 40 consistency).
  const datasetRecords = useMemo(
    () =>
      visibleRecords && visibleRecords.length > 0
        ? visibleRecords
        : template.databaseConnection?.records,
    [visibleRecords, template.databaseConnection?.records]
  );

  // Database Connection Toggle
  const hasDatabaseConnection = Boolean(datasetRecords && datasetRecords.length > 0);
  const [useDatabaseConnection, setUseDatabaseConnection] = useState<boolean>(hasDatabaseConnection);

  // Record Selection Mode
  const [recordSelectionMode, setRecordSelectionMode] = useState<'all' | 'current' | 'selected' | 'range'>('all');
  const [selectedIndices, setSelectedIndices] = useState<number[]>(
    propSelectedRecordIndices.length > 0
      ? propSelectedRecordIndices
      : datasetRecords
      ? datasetRecords.map((_, i) => i)
      : [0]
  );
  const [rangeString, setRangeString] = useState<string>(() =>
    formatIndicesToRangeString(
      propSelectedRecordIndices.length > 0
        ? propSelectedRecordIndices
        : datasetRecords
        ? datasetRecords.map((_, i) => i)
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

  // Output Save Destination (Prompt every time vs Dedicated Folder)
  const [saveMode, setSaveMode] = useState<'prompt' | 'custom_folder'>('prompt');
  const [targetFolderHandle, setTargetFolderHandle] = useState<any>(null);
  const [targetFolderName, setTargetFolderName] = useState<string>('');
  const [targetFolderPath, setTargetFolderPath] = useState<string>('');

  const handleSelectOutputFolder = async () => {
    try {
      const res = await promptSelectFolder();
      if (!res.canceled) {
        if (res.folderHandle) setTargetFolderHandle(res.folderHandle);
        if (res.folderName) setTargetFolderName(res.folderName);
        if (res.folderPath) setTargetFolderPath(res.folderPath);
        setSaveMode('custom_folder');
      }
    } catch (err: any) {
      console.warn('Folder selection error:', err);
    }
  };

  const displayPrinters: PrinterModel[] = useMemo(() => {
    let list: PrinterModel[] = [];

    // 1. From central state (live Windows discovery)
    if (availablePrinters && availablePrinters.length > 0) {
      list = availablePrinters.filter(
        (p) => !p.isVirtual && !p.id?.startsWith('virtual-generic')
      );
    }

    // 2. From prop printers (if available)
    if (list.length === 0 && propPrinters && propPrinters.length > 0) {
      list = (propPrinters as any[]).map((p) => ({
        id: p.id || `prn-${p.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        name: p.name,
        systemName: p.systemName || p.name,
        deviceName: p.deviceName || p.name,
        displayName: p.displayName || p.name,
        isDefault: Boolean(p.isDefault),
        isInteractive: Boolean(p.isInteractive),
        status: p.status || 'READY',
        dpi: p.dpi || 300,
        driverName: p.driverName || p.model,
        port: p.portName || p.port || 'PORTPROMPT:',
        portName: p.portName || p.port || 'PORTPROMPT:',
        connectionType: 'windows-driver',
        preferredRenderer: 'WINDOWS_DRIVER',
        renderer: 'WINDOWS_DRIVER',
        capabilities: p.capabilities || {},
      }));
    }

    // 3. Fallback to LocalStorage cache
    if (list.length === 0 && typeof window !== 'undefined' && window.localStorage) {
      try {
        const cached = localStorage.getItem('barcodeflow_discovered_printers');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            list = parsed.filter((p: any) => !p.isVirtual && !p.id?.startsWith('virtual-generic'));
          }
        }
      } catch {}
    }

    // 4. Guaranteed standard Windows PDF & Virtual driver suite fallback (Cloud/Web Parity)
    if (list.length === 0) {
      list = [
        {
          id: 'prn-os-4',
          name: 'Export to WPS PDF',
          systemName: 'Export to WPS PDF',
          deviceName: 'Export to WPS PDF',
          displayName: 'Default (currently Export to WPS PDF)',
          isDefault: true,
          isInteractive: true,
          status: 'READY',
          dpi: 300,
          driverName: 'Kingsoft Virtual Printer Driver',
          port: 'Kingsoft Virtual Printer Port',
          portName: 'Kingsoft Virtual Printer Port',
          connectionType: 'windows-driver',
          preferredRenderer: 'WINDOWS_DRIVER',
          renderer: 'WINDOWS_DRIVER',
          location: 'Local',
          comment: 'None',
          capabilities: {
            color: true,
            duplex: false,
            speedControl: false,
            darknessControl: false,
            gapMedia: false,
            blackMarkMedia: false,
            continuousMedia: true,
            cutter: false,
            peeler: false,
            rfid: false,
            minDpi: 300,
            maxDpi: 600,
          },
        },
        {
          id: 'prn-os-2',
          name: 'Microsoft Print to PDF',
          systemName: 'Microsoft Print to PDF',
          deviceName: 'Microsoft Print to PDF',
          displayName: 'Microsoft Print to PDF',
          isDefault: false,
          isInteractive: true,
          status: 'READY',
          dpi: 300,
          driverName: 'Microsoft Print To PDF',
          port: 'PORTPROMPT:',
          portName: 'PORTPROMPT:',
          connectionType: 'windows-driver',
          preferredRenderer: 'WINDOWS_DRIVER',
          renderer: 'WINDOWS_DRIVER',
          location: 'Local',
          comment: 'None',
          capabilities: {
            color: true,
            duplex: false,
            speedControl: false,
            darknessControl: false,
            gapMedia: false,
            blackMarkMedia: false,
            continuousMedia: true,
            cutter: false,
            peeler: false,
            rfid: false,
            minDpi: 300,
            maxDpi: 600,
          },
        },
        {
          id: 'prn-os-3',
          name: 'Nitro PDF Creator',
          systemName: 'Nitro PDF Creator',
          deviceName: 'Nitro PDF Creator',
          displayName: 'Nitro PDF Creator',
          isDefault: false,
          isInteractive: true,
          status: 'READY',
          dpi: 300,
          driverName: 'Nitro PDF Driver',
          port: 'Nitro PDF Port:',
          portName: 'Nitro PDF Port:',
          connectionType: 'windows-driver',
          preferredRenderer: 'WINDOWS_DRIVER',
          renderer: 'WINDOWS_DRIVER',
          location: 'Local',
          comment: 'None',
          capabilities: {
            color: true,
            duplex: false,
            speedControl: false,
            darknessControl: false,
            gapMedia: false,
            blackMarkMedia: false,
            continuousMedia: true,
            cutter: false,
            peeler: false,
            rfid: false,
            minDpi: 300,
            maxDpi: 600,
          },
        },
        {
          id: 'prn-os-1',
          name: 'OneNote (Desktop)',
          systemName: 'OneNote (Desktop)',
          deviceName: 'OneNote (Desktop)',
          displayName: 'OneNote (Desktop)',
          isDefault: false,
          isInteractive: true,
          status: 'READY',
          dpi: 300,
          driverName: 'Send to Microsoft OneNote 16 Driver',
          port: 'nul:',
          portName: 'nul:',
          connectionType: 'windows-driver',
          preferredRenderer: 'WINDOWS_DRIVER',
          renderer: 'WINDOWS_DRIVER',
          location: 'Local',
          comment: 'None',
          capabilities: {
            color: true,
            duplex: false,
            speedControl: false,
            darknessControl: false,
            gapMedia: false,
            blackMarkMedia: false,
            continuousMedia: true,
            cutter: false,
            peeler: false,
            rfid: false,
            minDpi: 300,
            maxDpi: 600,
          },
        },
      ];
    }

    return list;
  }, [availablePrinters, propPrinters]);

  // Robust selectedPrinterId resolution: guarantees matching a valid option in displayPrinters
  const effectiveSelectedId = useMemo(() => {
    if (selectedPrinterId && displayPrinters.some((p) => p.id === selectedPrinterId)) {
      return selectedPrinterId;
    }
    if (template.printer?.name) {
      const match = displayPrinters.find(
        (p) =>
          p.name.toLowerCase() === template.printer!.name.toLowerCase() ||
          p.systemName.toLowerCase() === (template.printer!.systemName || '').toLowerCase()
      );
      if (match) return match.id;
    }
    if (activePrinter && displayPrinters.some((p) => p.id === activePrinter.id)) {
      return activePrinter.id;
    }
    if (defaultPrinter && displayPrinters.some((p) => p.id === defaultPrinter.id)) {
      return defaultPrinter.id;
    }
    const def = displayPrinters.find((p) => p.isDefault);
    if (def) return def.id;
    return displayPrinters[0]?.id || '';
  }, [selectedPrinterId, displayPrinters, defaultPrinter, activePrinter, template.printer]);

  // Sync state if effectiveSelectedId changes
  useEffect(() => {
    if (effectiveSelectedId && effectiveSelectedId !== selectedPrinterId) {
      setSelectedPrinterId(effectiveSelectedId);
      const matched = displayPrinters.find((p) => p.id === effectiveSelectedId);
      if (matched) {
        setActivePrinter(matched);
      }
    }
  }, [effectiveSelectedId]);

  // Sync initial selection when opened or when template changes
  useEffect(() => {
    if (!isOpen) return;

    // Load effective object print method settings
    setPrintMethodSettings(getEffectiveObjectPrintMethodSettings(template));

    if (displayPrinters.length === 0) return;

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

    if (activePrinter) {
      const match = displayPrinters.find((p) => p.id === activePrinter.id);
      if (match) {
        setSelectedPrinterId(match.id);
        return;
      }
    }

    if (defaultPrinter) {
      const match = displayPrinters.find((p) => p.id === defaultPrinter.id);
      if (match) {
        setSelectedPrinterId(match.id);
        setActivePrinter(match);
        return;
      }
    }

    const firstChoice = displayPrinters.find((p) => !p.isVirtual) || displayPrinters[0];
    if (firstChoice) {
      setSelectedPrinterId(firstChoice.id);
      setActivePrinter(firstChoice);
    }
  }, [isOpen, displayPrinters, template.printer]);

  const selectedPrinter = useMemo(() => {
    return (
      displayPrinters.find((p) => p.id === effectiveSelectedId) ||
      displayPrinters[0]
    );
  }, [displayPrinters, effectiveSelectedId]);

  // Section 12 & 14 Physical printer availability and offline state
  const hasUsablePhysicalPrinter = useMemo(() => {
    return displayPrinters.some((p) => p.status === 'READY' || (p.status as any) === 'ready' || (p.status as any) === 'online');
  }, [displayPrinters]);

  const isVirtualOrInteractivePrinter = useMemo(() => {
    if (!selectedPrinter) return true;
    const name = (selectedPrinter.name || '').toLowerCase();
    const sysName = (selectedPrinter.systemName || '').toLowerCase();
    const devName = (selectedPrinter.deviceName || '').toLowerCase();
    return (
      Boolean(selectedPrinter.isInteractive) ||
      name.includes('pdf') ||
      name.includes('wps') ||
      name.includes('onenote') ||
      sysName.includes('pdf') ||
      sysName.includes('wps') ||
      sysName.includes('onenote') ||
      devName.includes('pdf') ||
      devName.includes('wps') ||
      devName.includes('onenote')
    );
  }, [selectedPrinter]);

  const isSelectedPhysicalOffline = useMemo(() => {
    if (!selectedPrinter) return false;
    return !selectedPrinter.isInteractive && (selectedPrinter.status === 'OFFLINE' || selectedPrinter.status === 'ERROR');
  }, [selectedPrinter]);

  // Sync DPI
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
    } catch {}
    setUserDpiOverride(null);
  }, [selectedPrinterId, selectedPrinter]);

  const effectiveDpi = selectedPrinter?.dpi ?? userDpiOverride ?? null;

  // Determine if printer supports thermal speed / darkness
  const isThermalProtocol = outputFormat === 'zpl' || outputFormat === 'tspl' || outputFormat === 'epl' || outputFormat === 'cpcl' || outputFormat === 'sbpl';
  const isSpeedSupported = isThermalProtocol || Boolean(selectedPrinter?.capabilities?.speedControl);
  const isDarknessSupported = isThermalProtocol || Boolean(selectedPrinter?.capabilities?.darknessControl);

  // Authoritative dataset records (filtered + sorted when available)
  const allRecords = useMemo(() => {
    if (useDatabaseConnection && datasetRecords && datasetRecords.length > 0) {
      return datasetRecords;
    }
    return [recordData];
  }, [useDatabaseConnection, datasetRecords, recordData]);

  // Detected fields
  const availableColumns = useMemo(() => {
    if (template.databaseConnection?.fields && template.databaseConnection.fields.length > 0) {
      return template.databaseConnection.fields;
    }
    if (allRecords.length > 0 && allRecords[0]) {
      return Object.keys(allRecords[0] || {});
    }
    return [];
  }, [template.databaseConnection, allRecords]);

  // Determine subset of records to print
  const recordsToPrint = useMemo(() => {
    if (!useDatabaseConnection || (allRecords.length === 1 && !(datasetRecords && datasetRecords.length))) {
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

  // Total labels count
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

  // Validation
  const validationResult = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!selectedPrinter) {
      errors.push('No printer selected.');
    }

    if (recordsToPrint.length === 0) {
      errors.push('No records selected to print.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }, [selectedPrinter, recordsToPrint]);

  // Cancel Queued Jobs Handler
  const handlePurgePrinterQueue = async () => {
    if (!selectedPrinter) return;
    const confirmPurge = window.confirm(
      `Are you sure you want to cancel all queued print jobs for "${selectedPrinter.name}"?`
    );
    if (!confirmPurge) return;

    setIsCancellingJobs(true);
    try {
      if (window.barcodeFlow?.printers?.cancelQueuedJobs) {
        const res = await window.barcodeFlow.printers.cancelQueuedJobs(
          selectedPrinter.systemName || selectedPrinter.name
        );
        alert(res.message || (res.success ? 'Queued jobs cancelled successfully.' : 'No queued jobs found.'));
      } else {
        const res = await fetch(`http://localhost:3001/api/printers/${selectedPrinter.id}/cancel-jobs`, {
          method: 'POST',
        });
        const json = await res.json();
        alert(json.message || 'Queued print jobs cancelled.');
      }
    } catch (err: any) {
      alert(`Error cancelling queued jobs: ${err.message}`);
    } finally {
      setIsCancellingJobs(false);
    }
  };

  // Commit Object Print Method settings
  const commitPrintMethodSettings = (newSettings: ObjectPrintMethodSettings) => {
    setPrintMethodSettings(newSettings);
    if (newSettings.scope === 'global') {
      saveGlobalObjectPrintMethodSettings(newSettings);
      if (onUpdateTemplate && template.objectPrintMethodSettings) {
        const updated = { ...template };
        delete updated.objectPrintMethodSettings;
        onUpdateTemplate(updated);
      }
    } else {
      if (onUpdateTemplate) {
        onUpdateTemplate({
          ...template,
          objectPrintMethodSettings: newSettings,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  };

  // Test Print (Section 28)
  const handleTestPrint = async () => {
    setIsTestingPrint(true);
    setTestPrintSuccess(null);
    try {
      const sampleRecord = recordsToPrint[0] || recordData;
      const testRes = await PrintExecutionService.getInstance().executeTestPrint(
        template,
        selectedPrinter,
        sampleRecord
      );

      if (testRes.status === 'cancelled') {
        alert('Test print canceled by user.');
        return;
      }

      if (testRes.status === 'failed') {
        alert(`Test print failed: ${testRes.error || 'Spooler rejected test label.'}`);
        return;
      }

      setTestPrintSuccess(`Test print sent to "${testRes.deviceName}"`);
      setTimeout(() => setTestPrintSuccess(null), 3500);
    } catch (err: any) {
      alert(`Test print failed: ${err.message}`);
    } finally {
      setIsTestingPrint(false);
    }
  };

  // Section 12: BarcodeFlow Internal "Save as PDF" Fallback
  const handleSaveAsPdfFallback = async () => {
    setPrintProgressState('PREPARING');
    setIsSubmitting(true);
    setPrintErrorMessage(null);
    setJobSuccess(null);

    const calculatedTotalCount = totalLabelsCount;
    const serialSourcesToReserve: Array<{
      sourceId: string;
      startValue: string;
      config: any;
    }> = [];

    template.elements?.forEach((el: any) => {
      (el.dataSources || []).forEach((ds: any) => {
        const s = ds.serialization || ds.transformConfig?.serialization;
        if (s && s.action && s.action !== 'none') {
          const sourceId = ds.id || `${template.id}_${el.id}_${ds.name || 'serial'}`;
          const startVal = s.currentValue || ds.value || '000001';
          serialSourcesToReserve.push({
            sourceId,
            startValue: startVal,
            config: s,
          });
        }
      });
    });

    const reservations: any[] = [];
    const jobId = `PJ-${Date.now()}`;

    for (const src of serialSourcesToReserve) {
      try {
        const resv = await AtomicSerialReservationService.reserve(
          template.id,
          src.sourceId,
          src.startValue,
          src.config,
          calculatedTotalCount,
          { jobId }
        );
        reservations.push(resv);
      } catch (err) {
        console.warn('Reservation error:', err);
      }
    }

    try {
      const result = await PrintExecutionService.getInstance().saveAsPdfFallback(
        template,
        recordsToPrint,
        copies,
        saveMode === 'custom_folder' ? { targetFolderHandle, targetFolderPath } : undefined
      );

      if (result.status === 'cancelled') {
        for (const resv of reservations) {
          await AtomicSerialReservationService.rollback(resv.id, 'PDF save canceled by user', resv.sourceId);
        }
        setPrintProgressState('CANCELLED');
        setPrintErrorMessage('PDF save canceled by user.');
        setIsSubmitting(false);
        return;
      }

      if (result.status === 'failed') {
        for (const resv of reservations) {
          await AtomicSerialReservationService.rollback(resv.id, result.error || 'Failed to save PDF', resv.sourceId);
        }
        setPrintProgressState('FAILED');
        setPrintErrorMessage(result.error || 'Failed to generate and save PDF fallback.');
        setIsSubmitting(false);
        return;
      }

      // Confirmed PDF output: commit serial reservation
      for (const resv of reservations) {
        const nextVal = computeNextSerialValue(resv.startValue, resv.definition || resv.config, calculatedTotalCount);
        await AtomicSerialReservationService.commit(
          resv.id,
          resv.sourceId,
          nextVal,
          calculatedTotalCount,
          jobId,
          'PDF Document Export Confirmed'
        );
      }

      if (onUpdateTemplate) {
        const advancedTemplate = advanceTemplateSerialState(template, calculatedTotalCount);
        onUpdateTemplate(advancedTemplate);
      }

      // Spooler entry for PDF export
      const primaryResv = reservations[0];
      const spooler = EnterprisePrintSpooler.getInstance();
      const dispatchedJob = spooler.dispatchJob({
        template,
        printer: {
          id: selectedPrinter.id,
          name: result.deviceName || selectedPrinter.name,
          model: selectedPrinter.driverName || selectedPrinter.model || selectedPrinter.name,
          brand: 'Desktop PDF' as any,
          dpi: (selectedPrinter.dpi || 300) as any,
          ipAddress: 'LOCAL',
          port: 0,
          status: 'online',
          protocol: 'pdf' as any,
          location: 'PDF Export',
          mediaWidth: template.dimensions.width,
          mediaHeight: template.dimensions.height,
        },
        copies,
        records: recordsToPrint as any,
        format: 'pdf',
        submittedBy: 'Operator (BarcodeFlow Suite)',
        reservationId: primaryResv?.id,
        serialStart: primaryResv?.startValue,
        serialEnd: primaryResv?.endValue,
        confirmedCount: calculatedTotalCount,
        unknownCount: 0,
        failedCount: 0,
      });

      dispatchedJob.totalLabelsPrinted = calculatedTotalCount;
      dispatchedJob.status = 'completed';
      onJobSubmitted(dispatchedJob);

      setPrintProgressState('SUBMITTED');
      const fileName = result.filePath ? result.filePath.split(/[\\/]/).pop() : 'Document1.pdf';
      setJobSuccess(`PDF saved successfully: ${fileName}`);
      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
        setJobSuccess(null);
        setPrintProgressState('IDLE');
      }, 1500);
    } catch (err: any) {
      for (const resv of reservations) {
        await AtomicSerialReservationService.rollback(resv.id, err.message || 'PDF fallback error', resv.sourceId);
      }
      setPrintProgressState('FAILED');
      setPrintErrorMessage(err.message || 'PDF fallback error');
      setIsSubmitting(false);
    }
  };

  // Preview Button Handler
  const handleOpenPreview = () => {
    // Commit print method settings before preview
    commitPrintMethodSettings(printMethodSettings);

    if (onOpenPrintPreview) {
      onOpenPrintPreview({
        printer: selectedPrinter,
        effectiveDpi,
        recordsToPrint,
        copies,
        quantitySource,
        selectedQtyColumn: quantitySource === 'database_field' ? selectedQtyColumn : undefined,
        serializedLabels,
        startingSlot,
      });
      onClose();
    }
  };

  // Main Print Execution (Sections 1, 2, 3, 5, 14, 18, 19, 23)
  const handleExecutePrint = async () => {
    if (!validationResult.isValid || isSubmitting) return;

    // Pre-print barcode data validation (spec 28): never silently print invalid data.
    if (!barcodeOverrideRef.current) {
      const preflight = validatePrintDataBarcodes(template, recordsToPrint);
      if (!preflight.valid) {
        setBarcodePreflight(preflight);
        return;
      }
    }
    barcodeOverrideRef.current = false;

    // Check offline physical printer (Section 14)
    if (isSelectedPhysicalOffline) {
      setIsOfflinePrinterModalOpen(true);
      return;
    }

    // When no physical printer is connected OR virtual driver is targeted,
    // seamlessly execute Save As PDF + Auto-Open (Exact BarTender behavior)
    if (!hasUsablePhysicalPrinter || isVirtualOrInteractivePrinter) {
      await handleSaveAsPdfFallback();
      return;
    }

    setPrintProgressState('PREPARING');
    setPrintErrorMessage(null);
    setJobSuccess(null);
    setIsSubmitting(true);

    const calculatedTotalCount = totalLabelsCount;
    const serialSourcesToReserve: Array<{
      sourceId: string;
      startValue: string;
      config: any;
    }> = [];

    template.elements?.forEach((el: any) => {
      (el.dataSources || []).forEach((ds: any) => {
        const s = ds.serialization || ds.transformConfig?.serialization;
        if (s && s.action && s.action !== 'none') {
          const sourceId = ds.id || `${template.id}_${el.id}_${ds.name || 'serial'}`;
          const startVal = s.currentValue || ds.value || '000001';
          serialSourcesToReserve.push({
            sourceId,
            startValue: startVal,
            config: s,
          });
        }
      });
    });

    const reservations: any[] = [];
    const jobId = `PJ-${Date.now()}`;

    for (const src of serialSourcesToReserve) {
      try {
        const resv = await AtomicSerialReservationService.reserve(
          template.id,
          src.sourceId,
          src.startValue,
          src.config,
          calculatedTotalCount,
          { jobId }
        );
        reservations.push(resv);
      } catch (err) {
        console.warn('Reservation error:', err);
      }
    }

    try {
      commitPrintMethodSettings(printMethodSettings);
      setPrintProgressState('RENDERING');

      const primaryResv = reservations[0];

      const executionResult = await PrintExecutionService.getInstance().print({
        document: template,
        printer: selectedPrinter,
        copies,
        records: recordsToPrint,
        quantitySource,
        selectedQtyColumn: quantitySource === 'database_field' ? selectedQtyColumn : undefined,
        serialization: {
          enabled: serializedLabels > 1,
          labelsCount: serializedLabels,
        },
        darkness,
        speed: printSpeed,
        dpi: effectiveDpi || undefined,
        rendererOverride:
          outputFormat === 'tspl'
            ? 'TSPL'
            : outputFormat === 'zpl'
            ? 'ZPL'
            : outputFormat === 'epl'
            ? 'EPL'
            : outputFormat === 'cpcl'
            ? 'CPCL'
            : outputFormat === 'sbpl'
            ? 'SBPL'
            : 'WINDOWS_DRIVER',
        cancelQueuedJobsBeforePrint,
        startingSlot,
        printToFile,
        jobId,
        reservationId: primaryResv?.id,
      });

      if (executionResult.status === 'cancelled') {
        for (const resv of reservations) {
          await AtomicSerialReservationService.rollback(resv.id, 'Print job canceled by user', resv.sourceId);
        }
        setIsSubmitting(false);
        setPrintProgressState('CANCELLED');
        setPrintErrorMessage('Print job canceled by user.');
        return;
      }

      if (executionResult.status === 'failed') {
        for (const resv of reservations) {
          await AtomicSerialReservationService.rollback(
            resv.id,
            executionResult.error || 'Print spooler rejected the job',
            resv.sourceId
          );
        }
        setIsSubmitting(false);
        if (executionResult.error === 'PRINTER_UNAVAILABLE') {
          setIsOfflinePrinterModalOpen(true);
          return;
        }
        setPrintProgressState('FAILED');
        setPrintErrorMessage(executionResult.error || 'Windows print spooler rejected the job.');
        return;
      }

      if (executionResult.status === 'PARTIAL') {
        const confirmed = executionResult.confirmedCount || 0;
        const remaining = executionResult.remainingCount || (calculatedTotalCount - confirmed);

        for (const resv of reservations) {
          const confirmedVal = computeNextSerialValue(resv.startValue, resv.definition || resv.config, confirmed);
          await AtomicSerialReservationService.markPartial(
            resv.id,
            resv.sourceId,
            confirmedVal,
            confirmed,
            remaining,
            executionResult.batches?.length || 0,
            executionResult.error || 'Partial print job interrupted'
          );
        }

        if (onUpdateTemplate && confirmed > 0) {
          const advancedTemplate = advanceTemplateSerialState(template, confirmed);
          onUpdateTemplate(advancedTemplate);
        }

        // Spooler entry for partial print
        const spooler = EnterprisePrintSpooler.getInstance();
        const dispatchedJob = spooler.dispatchJob({
          template,
          printer: {
            id: selectedPrinter.id,
            name: executionResult.deviceName,
            model: selectedPrinter.model || selectedPrinter.driverName || selectedPrinter.name,
            brand: (selectedPrinter.manufacturer?.includes('Zebra') ? 'Zebra' : selectedPrinter.manufacturer?.includes('TSC') ? 'TSC' : 'Desktop Driver') as any,
            dpi: (selectedPrinter.dpi || 300) as any,
            ipAddress: selectedPrinter.portName || (typeof selectedPrinter.port === 'string' ? selectedPrinter.port : 'LOCAL'),
            port: typeof selectedPrinter.port === 'number' ? selectedPrinter.port : 0,
            status: 'online',
            protocol: outputFormat as any,
            location: selectedPrinter.location || 'Local Windows Spooler',
            mediaWidth: template.dimensions.width,
            mediaHeight: template.dimensions.height,
          },
          copies: 1,
          records: recordsToPrint as any,
          format: outputFormat,
          submittedBy: 'Operator (BarcodeFlow Suite)',
          darkness,
          speed: printSpeed,
          reservationId: primaryResv?.id,
          serialStart: primaryResv?.startValue,
          serialEnd: primaryResv?.endValue,
          batches: executionResult.batches,
          items: executionResult.items,
          confirmedCount: confirmed,
          remainingCount: remaining,
          failedCount: remaining,
        });

        dispatchedJob.status = 'PARTIAL';
        dispatchedJob.totalLabelsPrinted = confirmed;
        onJobSubmitted(dispatchedJob);

        setIsSubmitting(false);
        setPrintProgressState('FAILED');
        setPrintErrorMessage(`Partial Print: ${confirmed} printed, ${remaining} failed. (${executionResult.error})`);
        return;
      }

      // 4. Confirmed Success: Commit serial reservations & Advance serial sequence counters
      const printedCount = executionResult.pagesPrinted || calculatedTotalCount;
      for (const resv of reservations) {
        const finalVal = computeNextSerialValue(resv.startValue, resv.definition || resv.config, printedCount);
        await AtomicSerialReservationService.commit(
          resv.id,
          resv.sourceId,
          finalVal,
          printedCount,
          jobId,
          `Confirmed print dispatch to ${executionResult.deviceName}`
        );
      }

      if (onUpdateTemplate) {
        const advancedTemplate = advanceTemplateSerialState(template, printedCount);
        onUpdateTemplate(advancedTemplate);
      }

      // 5. Spooler record entry
      const spooler = EnterprisePrintSpooler.getInstance();
      const dispatchedJob = spooler.dispatchJob({
        template,
        printer: {
          id: selectedPrinter.id,
          name: executionResult.deviceName,
          model: selectedPrinter.model || selectedPrinter.driverName || selectedPrinter.name,
          brand: (selectedPrinter.manufacturer?.includes('Zebra') ? 'Zebra' : selectedPrinter.manufacturer?.includes('TSC') ? 'TSC' : 'Desktop Driver') as any,
          dpi: (selectedPrinter.dpi || 300) as any,
          ipAddress: selectedPrinter.portName || (typeof selectedPrinter.port === 'string' ? selectedPrinter.port : 'LOCAL'),
          port: typeof selectedPrinter.port === 'number' ? selectedPrinter.port : 0,
          status: 'online',
          protocol: outputFormat as any,
          location: selectedPrinter.location || 'Local Windows Spooler',
          mediaWidth: template.dimensions.width,
          mediaHeight: template.dimensions.height,
        },
        copies: 1,
        records: recordsToPrint as any,
        format: outputFormat,
        submittedBy: 'Operator (BarcodeFlow Suite)',
        darkness,
        speed: printSpeed,
        reservationId: primaryResv?.id,
        serialStart: primaryResv?.startValue,
        serialEnd: primaryResv?.endValue,
        batches: executionResult.batches,
        items: executionResult.items,
        confirmedCount: printedCount,
        unknownCount: 0,
        failedCount: 0,
      });

      dispatchedJob.totalLabelsPrinted = printedCount;
      dispatchedJob.status = 'completed';
      onJobSubmitted(dispatchedJob);

      setPrintProgressState('SUBMITTED');
      setJobSuccess(
        executionResult.outputType === 'file-download' || executionResult.outputType === 'pdf-fallback'
          ? `File saved successfully to ${executionResult.filePath || 'disk'}`
          : `Print job submitted to ${executionResult.deviceName}`
      );

      if (!showPrinterCodeAtEnd && !repeatDataEntry) {
        setTimeout(() => {
          setIsSubmitting(false);
          onClose();
          setJobSuccess(null);
          setPrintProgressState('IDLE');
        }, 1500);
      } else {
        setIsSubmitting(false);
      }
    } catch (err: any) {
      for (const resv of reservations) {
        await AtomicSerialReservationService.rollback(resv.id, err.message || 'Print dispatch failed', resv.sourceId);
      }
      setIsSubmitting(false);
      setPrintProgressState('FAILED');
      setPrintErrorMessage(err.message || 'Print dispatch failed.');
    }
  };

  if (!isOpen) return null;

  const docTitleName = template.name ? (template.name.endsWith('.btw') || template.name.endsWith('.bfl') ? template.name : `${template.name}.btw`) : 'Document1.btw';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 select-none font-sans text-xs">
      {/* CLASSIC WINDOWS DESKTOP PRINT DIALOG (Matching Reference Layout) */}
      <div className="w-[600px] max-w-[95vw] bg-[#f4f7fb] border border-[#7d9ebc] rounded-md shadow-2xl overflow-hidden flex flex-col text-slate-800">
        {/* Title Bar */}
        <div className="h-7 bg-gradient-to-r from-[#e8edf5] to-[#d8e3f0] border-b border-[#b8c9db] flex items-center justify-between px-3 shrink-0">
          <span className="font-semibold text-slate-800 text-[12px] truncate">
            Print [{docTitleName}]
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-5 h-5 flex items-center justify-center text-slate-500 hover:bg-red-600 hover:text-white rounded-xs transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Top Tabs */}
        <div className="flex items-center px-3 pt-2 bg-[#f4f7fb] border-b border-[#cbdbe9] gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTopTab('print')}
            className={`px-4 py-1 rounded-t border-t border-l border-r font-medium text-[11.5px] cursor-pointer transition-colors -mb-px ${
              activeTopTab === 'print'
                ? 'bg-white border-[#b8c9db] text-slate-900 font-semibold shadow-2xs'
                : 'bg-[#e4ebf5] border-transparent text-slate-600 hover:bg-[#ebf1f8]'
            }`}
          >
            Print
          </button>
          <button
            type="button"
            onClick={() => setActiveTopTab('objectPrintMethod')}
            className={`px-3 py-1 rounded-t border-t border-l border-r font-medium text-[11.5px] cursor-pointer transition-colors -mb-px ${
              activeTopTab === 'objectPrintMethod'
                ? 'bg-white border-[#b8c9db] text-slate-900 font-semibold shadow-2xs'
                : 'bg-[#e4ebf5] border-transparent text-slate-600 hover:bg-[#ebf1f8]'
            }`}
          >
            Object Print Method
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-3 bg-white space-y-3 flex-1 overflow-y-auto overflow-x-hidden min-h-[380px]">
          {/* Print Progress / Notification Banner */}
          {printProgressState === 'PREPARING' && (
            <div className="p-2 bg-blue-50 border border-blue-200 rounded flex items-center gap-2 text-[11px] text-blue-800">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
              <span>Preparing print plan...</span>
            </div>
          )}
          {printProgressState === 'RENDERING' && (
            <div className="p-2 bg-blue-50 border border-blue-200 rounded flex items-center gap-2 text-[11px] text-blue-800">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
              <span>Rendering label document & vector elements...</span>
            </div>
          )}
          {printProgressState === 'DISPATCHING' && (
            <div className="p-2 bg-blue-50 border border-blue-200 rounded flex items-center gap-2 text-[11px] text-blue-800">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
              <span>
                Submitting to <strong>{selectedPrinter.deviceName || selectedPrinter.name}</strong>...
                {selectedPrinter.isInteractive ? ' (Waiting for Windows printer destination dialog...)' : ''}
              </span>
            </div>
          )}
          {printProgressState === 'CANCELLED' && (
            <div className="p-2 bg-amber-50 border border-amber-200 rounded flex items-center justify-between gap-2 text-[11px] text-amber-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Print job canceled by user. Serialization sequence was not consumed.</span>
              </div>
              <button
                type="button"
                onClick={() => setPrintProgressState('IDLE')}
                className="text-amber-700 hover:text-amber-900 font-bold text-[11px] cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}
          {printProgressState === 'FAILED' && (
            <div className="p-2.5 bg-red-50 border border-red-300 rounded text-[11px] text-red-900 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold">Print Spooler Error</p>
                  <p className="text-slate-700">Printer: <span className="font-medium text-slate-900">{selectedPrinter.deviceName || selectedPrinter.name}</span></p>
                  <p className="text-red-700 font-mono text-[10.5px] mt-0.5">{printErrorMessage}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-red-200">
                <button
                  type="button"
                  onClick={handleExecutePrint}
                  className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded font-semibold text-[11px] cursor-pointer"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => {
                    refreshPrinters && refreshPrinters();
                    setPrintProgressState('IDLE');
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded font-medium text-[11px] cursor-pointer"
                >
                  Refresh Printers
                </button>
                <button
                  type="button"
                  onClick={() => setPrintProgressState('IDLE')}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded font-medium text-[11px] cursor-pointer"
                >
                  Choose Another Printer
                </button>
              </div>
            </div>
          )}
          {printProgressState === 'SUBMITTED' && (
            <div className="p-2 bg-emerald-50 border border-emerald-300 rounded flex items-center gap-2 text-[11px] text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{jobSuccess || `Print job submitted to ${selectedPrinter.deviceName || selectedPrinter.name}`}</span>
            </div>
          )}

          {activeTopTab === 'print' ? (
            <>
              {/* 1. PRINTER FIELDSET GROUP */}
              <fieldset className="border border-[#c5d4e4] rounded p-3 pt-1.5 bg-[#fafcff]">
                <legend className="px-1 text-[11px] font-semibold text-slate-700">
                  Printer
                </legend>

                <div className="flex items-start justify-between gap-3">
                  {/* Left: Printer details */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* Name Dropdown */}
                    <div className="flex items-center gap-2">
                      <label className="w-16 text-right text-slate-700 font-medium shrink-0">
                        Name:
                      </label>
                      <select
                        value={effectiveSelectedId}
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
                        className="flex-1 min-w-0 px-2 py-1 bg-white border border-[#a4bed8] rounded text-[11.5px] text-slate-900 focus:outline-blue-500 font-medium truncate"
                      >
                        {displayPrinters.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.isDefault ? `Default (currently ${p.name})` : p.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => refreshPrinters && refreshPrinters()}
                        title="Refresh installed Windows printers"
                        className="p-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded border border-[#a4bed8] transition-colors cursor-pointer shrink-0"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${printersLoading ? 'animate-spin' : ''}`} />
                      </button>
                    </div>

                    {/* Status (Section 15 Normalized Status) */}
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-right text-slate-500 font-medium shrink-0">
                        Status:
                      </span>
                      <span className="text-slate-800 font-medium">
                        {(() => {
                          const s = String(selectedPrinter.status || '').toUpperCase();
                          if (s === 'READY' || s === 'ONLINE') return <span className="text-emerald-700 font-semibold">Ready</span>;
                          if (s === 'OFFLINE') return <span className="text-rose-600 font-semibold">Offline</span>;
                          if (s === 'PAUSED') return <span className="text-amber-600 font-semibold">Paused</span>;
                          if (s === 'ERROR') return <span className="text-red-700 font-semibold">Error</span>;
                          if (s === 'BUSY') return <span className="text-orange-600 font-semibold">Busy</span>;
                          return <span className="text-slate-600 font-medium">Unknown</span>;
                        })()}
                      </span>
                    </div>

                    {/* Model */}
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-right text-slate-500 font-medium shrink-0">
                        Model:
                      </span>
                      <span className="text-slate-800 font-medium truncate">
                        {selectedPrinter.driverName || selectedPrinter.model || selectedPrinter.name}
                      </span>
                    </div>

                    {/* Port */}
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-right text-slate-500 font-medium shrink-0">
                        Port:
                      </span>
                      <span className="text-slate-800 font-mono text-[11px] truncate">
                        {selectedPrinter.portName || selectedPrinter.port || 'Unknown'}
                      </span>
                    </div>

                    {/* Location */}
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-right text-slate-500 font-medium shrink-0">
                        Location:
                      </span>
                      <span className="text-slate-800 truncate">
                        {selectedPrinter.location || 'Local'}
                      </span>
                    </div>

                    {/* Comment */}
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-right text-slate-500 font-medium shrink-0">
                        Comment:
                      </span>
                      <span className="text-slate-800 truncate">
                        {selectedPrinter.comment || 'None'}
                      </span>
                    </div>
                  </div>

                  {/* Right: Buttons and Checkboxes */}
                  <div className="w-[170px] flex flex-col gap-1.5 shrink-0 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setIsPageSetupModalOpen(true)}
                      className="w-full px-2.5 py-1 bg-gradient-to-b from-[#f8faff] to-[#e4edf7] hover:from-white hover:to-[#ebf3fc] border border-[#a4bed8] rounded text-slate-800 text-[11.5px] font-medium shadow-2xs transition-colors cursor-pointer text-center"
                    >
                      Document Properties...
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (selectedPrinter && window.barcodeFlow?.printers?.openProperties) {
                          const res = await window.barcodeFlow.printers.openProperties(
                            selectedPrinter.deviceName || selectedPrinter.systemName || selectedPrinter.name
                          );
                          if (!res?.success) {
                            setIsPrinterPropertiesModalOpen(true);
                          }
                        } else {
                          setIsPrinterPropertiesModalOpen(true);
                        }
                      }}
                      className="w-full px-2.5 py-1 bg-gradient-to-b from-[#f8faff] to-[#e4edf7] hover:from-white hover:to-[#ebf3fc] border border-[#a4bed8] rounded text-slate-800 text-[11.5px] font-medium shadow-2xs transition-colors cursor-pointer text-center"
                    >
                      Printer Properties...
                    </button>

                    <div className="pt-1.5 space-y-1 text-[11px] text-slate-700">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={printOnBothSides}
                          onChange={(e) => setPrintOnBothSides(e.target.checked)}
                          disabled={!selectedPrinter.capabilities?.duplex}
                          className="rounded border-[#a4bed8] text-blue-600 disabled:opacity-40"
                        />
                        <span className={!selectedPrinter.capabilities?.duplex ? 'text-slate-400' : ''}>
                          Print on Both Sides
                        </span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={printToFile}
                          onChange={(e) => setPrintToFile(e.target.checked)}
                          className="rounded border-[#a4bed8] text-blue-600"
                        />
                        <span>Print to File</span>
                      </label>
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* Section 12 Fallback Banner: When no physical printer exists */}
              {!hasUsablePhysicalPrinter && (
                <div className="p-2 bg-blue-50/90 border border-blue-200 rounded flex items-center justify-between text-[11px] text-blue-900 shadow-2xs">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>No physical printer is currently available.</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleSaveAsPdfFallback}
                      className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded text-[10.5px] cursor-pointer shadow-2xs"
                    >
                      Save as PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => refreshPrinters && refreshPrinters()}
                      className="px-2 py-0.5 bg-white hover:bg-slate-50 border border-blue-300 text-slate-700 font-medium rounded text-[10.5px] cursor-pointer"
                    >
                      Refresh Printers
                    </button>
                  </div>
                </div>
              )}

              {/* Output Save Destination (Windows Save As / Folder Selection) */}
              <fieldset className="border border-[#c5d4e4] rounded p-2.5 bg-[#f5f9fd] shadow-2xs">
                <legend className="px-1 text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                  <Folder className="w-3.5 h-3.5 text-amber-500" />
                  Save / Output Destination
                </legend>
                <div className="space-y-2 text-[11.5px]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-800">
                      <input
                        type="radio"
                        name="outputSaveMode"
                        checked={saveMode === 'prompt'}
                        onChange={() => setSaveMode('prompt')}
                        className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span>
                        <strong>Prompt Every Time:</strong> Open Windows "Save As" dialog to select folder & file name
                      </span>
                    </label>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1 border-t border-slate-200/70">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-800 shrink-0">
                      <input
                        type="radio"
                        name="outputSaveMode"
                        checked={saveMode === 'custom_folder'}
                        onChange={() => {
                          if (!targetFolderName && !targetFolderPath) {
                            handleSelectOutputFolder();
                          } else {
                            setSaveMode('custom_folder');
                          }
                        }}
                        className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span>Save directly to folder:</span>
                    </label>

                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {targetFolderName || targetFolderPath ? (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 border border-amber-300 rounded text-amber-900 font-medium text-[11px] truncate flex-1 min-w-0" title={targetFolderPath || targetFolderName}>
                          <Folder className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="truncate">{targetFolderPath || targetFolderName}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px] flex-1">
                          No folder selected (Click Choose Folder to select destination)
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={handleSelectOutputFolder}
                        className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-[#a4bed8] text-slate-800 rounded text-[11px] font-medium shadow-2xs transition-colors cursor-pointer shrink-0"
                      >
                        Choose Folder...
                      </button>
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* 2. SUB-TABS: QUANTITY & OPTIONS */}
              <div className="border border-[#c5d4e4] rounded bg-[#fafcff] overflow-hidden">
                {/* Sub Tab Headers */}
                <div className="flex items-center px-2 pt-1 bg-[#edf3f9] border-b border-[#cbdbe9] gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('quantity')}
                    className={`px-3 py-0.5 rounded-t border-t border-l border-r text-[11px] cursor-pointer transition-colors -mb-px ${
                      activeSubTab === 'quantity'
                        ? 'bg-white border-[#c5d4e4] text-slate-900 font-bold shadow-2xs'
                        : 'bg-[#e0eaf5] border-transparent text-slate-600 hover:bg-[#eaf0f8]'
                    }`}
                  >
                    Quantity
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('options')}
                    className={`px-3 py-0.5 rounded-t border-t border-l border-r text-[11px] cursor-pointer transition-colors -mb-px ${
                      activeSubTab === 'options'
                        ? 'bg-white border-[#c5d4e4] text-slate-900 font-bold shadow-2xs'
                        : 'bg-[#e0eaf5] border-transparent text-slate-600 hover:bg-[#eaf0f8]'
                    }`}
                  >
                    Options
                  </button>
                </div>

                {/* Sub Tab Content */}
                <div className="p-3 bg-white space-y-3">
                  {activeSubTab === 'quantity' ? (
                    <>
                      {/* Copies Stepper */}
                      <div className="flex items-center gap-3">
                        <label className="text-slate-700 font-medium">
                          Copies:
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={1}
                            max={9999}
                            value={copies}
                            onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-20 px-2 py-0.5 bg-white border border-[#a4bed8] rounded text-slate-900 font-bold text-center focus:outline-blue-500"
                          />
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              onClick={() => setCopies((c) => c + 1)}
                              className="px-1 py-0.2 bg-[#e8edf5] hover:bg-[#d8e3f0] border border-[#a4bed8] rounded text-[8px] font-bold"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={() => setCopies((c) => Math.max(1, c - 1))}
                              className="px-1 py-0.2 bg-[#e8edf5] hover:bg-[#d8e3f0] border border-[#a4bed8] rounded text-[8px] font-bold"
                            >
                              ▼
                            </button>
                          </div>
                        </div>

                        {/* Quantity Source Toggle */}
                        {template.databaseConnection?.quantityColumn && (
                          <div className="flex items-center gap-1.5 ml-4">
                            <input
                              type="checkbox"
                              id="useQtyCol"
                              checked={quantitySource === 'database_field'}
                              onChange={(e) => setQuantitySource(e.target.checked ? 'database_field' : 'manual')}
                              className="rounded border-[#a4bed8] text-blue-600"
                            />
                            <label htmlFor="useQtyCol" className="text-[11px] text-slate-700 cursor-pointer">
                              From Column ({selectedQtyColumn})
                            </label>
                          </div>
                        )}
                      </div>

                      {/* Record Selection Group */}
                      <div className="pt-1">
                        <div className="relative flex py-1.5 items-center">
                          <div className="flex-grow border-t border-[#cbdbe9]"></div>
                          <span className="flex-shrink mx-2 text-[11px] font-semibold text-slate-600">
                            Record Selection
                          </span>
                          <div className="flex-grow border-t border-[#cbdbe9]"></div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={useDatabaseConnection}
                              onChange={(e) => setUseDatabaseConnection(e.target.checked)}
                              disabled={!hasDatabaseConnection}
                              className="rounded border-[#a4bed8] text-blue-600 disabled:opacity-40"
                            />
                            <span className={!hasDatabaseConnection ? 'text-slate-400 font-medium' : 'font-medium text-slate-800'}>
                              Use Database
                            </span>
                          </label>

                          <button
                            type="button"
                            onClick={() => {
                              if (onOpenDatabaseSetup) {
                                onOpenDatabaseSetup();
                              }
                            }}
                            className="px-3 py-1 bg-gradient-to-b from-[#f8faff] to-[#e4edf7] hover:from-white hover:to-[#ebf3fc] border border-[#a4bed8] rounded text-slate-800 text-[11px] font-medium shadow-2xs transition-colors cursor-pointer"
                          >
                            Database Connection Setup...
                          </button>
                        </div>

                        {/* Database records summary and filtering */}
                        {useDatabaseConnection && hasDatabaseConnection && (
                          <div className="mt-2.5 p-2 bg-[#f4f8fc] border border-[#d2e0ee] rounded flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-700">Records:</span>
                              <select
                                value={recordSelectionMode}
                                onChange={(e) => setRecordSelectionMode(e.target.value as any)}
                                className="px-2 py-0.5 bg-white border border-[#a4bed8] rounded text-[11px] font-medium"
                              >
                                <option value="all">All Records ({allRecords.length})</option>
                                <option value="current">Current Record (#{activeRecordIndex + 1})</option>
                                <option value="selected">Selected Records ({selectedIndices.length})</option>
                                <option value="range">Range: {rangeString || 'All'}</option>
                              </select>
                            </div>

                            <button
                              type="button"
                              onClick={() => setIsRecordSelectionModalOpen(true)}
                              className="px-2.5 py-0.5 bg-white hover:bg-slate-50 border border-[#a4bed8] rounded text-blue-700 font-semibold"
                            >
                              Select Records...
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    /* Options Tab (Rebuilt with Reference Workflow) */
                    <div className="space-y-3 text-[11.5px] text-slate-800">
                      {/* Job & Data Entry Checkboxes */}
                      <div className="space-y-1.5 pb-2 border-b border-[#e2edf8]">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={repeatDataEntry}
                            onChange={(e) => setRepeatDataEntry(e.target.checked)}
                            className="rounded border-[#a4bed8] text-blue-600"
                          />
                          <span>Repeat data entry until cancelled</span>
                        </label>

                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={cancelQueuedJobsBeforePrint}
                              onChange={(e) => setCancelQueuedJobsBeforePrint(e.target.checked)}
                              className="rounded border-[#a4bed8] text-blue-600"
                            />
                            <span>Cancel any jobs previously queued to this printer</span>
                          </label>
                          <button
                            type="button"
                            onClick={handlePurgePrinterQueue}
                            disabled={isCancellingJobs}
                            className="px-2 py-0.5 bg-[#fef2f2] hover:bg-[#fee2e2] text-red-700 border border-red-200 rounded text-[10.5px] font-medium cursor-pointer"
                          >
                            {isCancellingJobs ? 'Purging...' : 'Purge Queue Now'}
                          </button>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={enableDataEntry}
                            onChange={(e) => setEnableDataEntry(e.target.checked)}
                            className="rounded border-[#a4bed8] text-blue-600"
                          />
                          <span>Enable data entry</span>
                        </label>

                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={enableCodeModifier}
                              onChange={(e) => {
                                setEnableCodeModifier(e.target.checked);
                                setCodeModifierConfig((prev) => ({ ...prev, enabled: e.target.checked }));
                              }}
                              className="rounded border-[#a4bed8] text-blue-600"
                            />
                            <span>Enable Printer Code Modifier</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setIsCodeModifierModalOpen(true)}
                            className="px-2 py-0.5 bg-[#f0f5fc] hover:bg-[#e2eefb] text-blue-700 border border-[#a4bed8] rounded text-[10.5px] font-medium cursor-pointer"
                          >
                            Configure Modifier...
                          </button>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showPrinterCodeAtEnd}
                            onChange={(e) => setShowPrinterCodeAtEnd(e.target.checked)}
                            disabled={outputFormat === 'pdf'}
                            className="rounded border-[#a4bed8] text-blue-600 disabled:opacity-40"
                          />
                          <span className={outputFormat === 'pdf' ? 'text-slate-400' : ''}>
                            Show printer code at end of print job {outputFormat === 'pdf' ? '(ZPL/TSPL Only)' : ''}
                          </span>
                        </label>
                      </div>

                      {/* Advanced Printer Settings Section */}
                      <fieldset className="border border-[#d2e0ee] rounded p-2.5 pt-1 bg-[#f9fbfe] space-y-2">
                        <legend className="px-1 text-[11px] font-semibold text-slate-700">
                          Advanced Printer Settings
                        </legend>

                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-medium text-slate-600">Starting Slot:</span>
                            <input
                              type="number"
                              min={1}
                              max={template.sheetGrid ? (template.sheetGrid.rows || 1) * (template.sheetGrid.columns || 1) : 1}
                              value={startingSlot}
                              onChange={(e) => setStartingSlot(Math.max(1, parseInt(e.target.value, 10) || 1))}
                              className="w-16 px-1.5 py-0.5 bg-white border border-[#a4bed8] rounded text-center text-slate-900 font-bold"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <span className="font-medium text-slate-600">Output Protocol:</span>
                            <select
                              value={outputFormat}
                              onChange={(e) => setOutputFormat(e.target.value as any)}
                              className="px-1.5 py-0.5 bg-white border border-[#a4bed8] rounded font-medium text-[10.5px]"
                            >
                              <option value="pdf">Windows Driver / High-Res PDF</option>
                              <option value="zpl">Zebra ZPL (Direct Thermal/TT)</option>
                              <option value="tspl">TSC TSPL (Direct Thermal/TT)</option>
                              <option value="epl">Eltron EPL</option>
                              <option value="cpcl">CPCL Mobile</option>
                              <option value="sbpl">SATO SBPL</option>
                            </select>
                          </div>

                          {/* Thermal Speed & Darkness (Hidden for virtual/PDF/desktop drivers per Section 36) */}
                          {isSpeedSupported || isDarknessSupported ? (
                            <>
                              {isSpeedSupported && (
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-medium text-slate-600">Print Speed:</span>
                                  <select
                                    value={printSpeed}
                                    onChange={(e) => setPrintSpeed(parseInt(e.target.value, 10))}
                                    className="px-1.5 py-0.5 bg-white border border-[#a4bed8] rounded text-[10.5px]"
                                  >
                                    <option value={2}>2 ips (High Quality)</option>
                                    <option value={4}>4 ips (Standard)</option>
                                    <option value={6}>6 ips (High Speed)</option>
                                    <option value={8}>8 ips (Draft)</option>
                                  </select>
                                </div>
                              )}
                              {isDarknessSupported && (
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-medium text-slate-600">Darkness (Heat):</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={30}
                                    value={darkness}
                                    onChange={(e) => setDarkness(parseInt(e.target.value, 10) || 18)}
                                    className="w-16 px-1.5 py-0.5 bg-white border border-[#a4bed8] rounded text-center"
                                  />
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-[10.5px] text-slate-500 italic py-1 text-center bg-slate-50 border border-dashed border-slate-200 rounded">
                              Standard Windows Driver printing (speed & darkness controlled by Windows driver).
                            </div>
                          )}
                        </div>
                      </fieldset>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* TAB 2: OBJECT PRINT METHOD (Fully functional desktop configuration layout) */
            <div className="space-y-3.5">
              {/* Settings Scope Radio Group */}
              <fieldset className="border border-[#c5d4e4] rounded p-3 pt-1.5 bg-[#fafcff]">
                <legend className="px-1 text-[11px] font-semibold text-slate-700">
                  Settings
                </legend>
                <div className="flex items-center gap-6 text-[11.5px]">
                  <label className="flex items-center gap-2 cursor-pointer font-medium">
                    <input
                      type="radio"
                      name="settingsScope"
                      value="global"
                      checked={printMethodSettings.scope === 'global'}
                      onChange={() =>
                        setPrintMethodSettings((prev) => ({ ...prev, scope: 'global' }))
                      }
                      className="text-blue-600"
                    />
                    <span>Use Settings For All Documents</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium">
                    <input
                      type="radio"
                      name="settingsScope"
                      value="document"
                      checked={printMethodSettings.scope === 'document'}
                      onChange={() =>
                        setPrintMethodSettings((prev) => ({ ...prev, scope: 'document' }))
                      }
                      className="text-blue-600"
                    />
                    <span>Use Settings For This Document Only</span>
                  </label>
                </div>
              </fieldset>

              {/* Objects Configuration Group */}
              <fieldset className="border border-[#c5d4e4] rounded p-3 pt-2 bg-white">
                <legend className="px-1 text-[11px] font-semibold text-slate-700">
                  Objects
                </legend>

                <div className="space-y-2.5 text-[11.5px]">
                  {/* TrueType Text */}
                  <div className="flex items-center justify-between">
                    <label className="w-52 text-slate-700 font-medium">
                      TrueType Text:
                    </label>
                    <select
                      value={printMethodSettings.trueTypeText}
                      onChange={(e) =>
                        setPrintMethodSettings((prev) => ({
                          ...prev,
                          trueTypeText: e.target.value as any,
                        }))
                      }
                      className="flex-1 max-w-[260px] px-2 py-1 bg-white border border-[#a4bed8] rounded text-[11px] font-medium"
                    >
                      <option value="auto">Auto</option>
                      <option value="text-output">Text Output</option>
                      <option value="vector">Vector</option>
                      <option value="raster">Raster</option>
                    </select>
                  </div>

                  {/* Unsupported 1D Barcodes */}
                  <div className="flex items-center justify-between">
                    <label className="w-52 text-slate-700 font-medium">
                      Unsupported 1D Barcodes:
                    </label>
                    <select
                      value={printMethodSettings.unsupported1D}
                      onChange={(e) =>
                        setPrintMethodSettings((prev) => ({
                          ...prev,
                          unsupported1D: e.target.value as any,
                        }))
                      }
                      className="flex-1 max-w-[260px] px-2 py-1 bg-white border border-[#a4bed8] rounded text-[11px] font-medium"
                    >
                      <option value="auto">Auto</option>
                      <option value="native">Printer Native</option>
                      <option value="vector">Vector</option>
                      <option value="raster">Raster</option>
                    </select>
                  </div>

                  {/* Unsupported 2D Barcodes */}
                  <div className="flex items-center justify-between">
                    <label className="w-52 text-slate-700 font-medium">
                      Unsupported 2D Barcodes:
                    </label>
                    <select
                      value={printMethodSettings.unsupported2D}
                      onChange={(e) =>
                        setPrintMethodSettings((prev) => ({
                          ...prev,
                          unsupported2D: e.target.value as any,
                        }))
                      }
                      className="flex-1 max-w-[260px] px-2 py-1 bg-white border border-[#a4bed8] rounded text-[11px] font-medium"
                    >
                      <option value="auto">Auto</option>
                      <option value="native">Printer Native</option>
                      <option value="vector">Vector</option>
                      <option value="raster">Raster</option>
                    </select>
                  </div>

                  {/* Lines */}
                  <div className="flex items-center justify-between">
                    <label className="w-52 text-slate-700 font-medium">
                      Lines:
                    </label>
                    <select
                      value={printMethodSettings.lines}
                      onChange={(e) =>
                        setPrintMethodSettings((prev) => ({
                          ...prev,
                          lines: e.target.value as any,
                        }))
                      }
                      className="flex-1 max-w-[260px] px-2 py-1 bg-white border border-[#a4bed8] rounded text-[11px] font-medium"
                    >
                      <option value="auto">Auto</option>
                      <option value="native">Printer Native</option>
                      <option value="vector">Vector</option>
                      <option value="raster">Raster</option>
                    </select>
                  </div>

                  {/* Boxes */}
                  <div className="flex items-center justify-between">
                    <label className="w-52 text-slate-700 font-medium">
                      Boxes:
                    </label>
                    <select
                      value={printMethodSettings.boxes}
                      onChange={(e) =>
                        setPrintMethodSettings((prev) => ({
                          ...prev,
                          boxes: e.target.value as any,
                        }))
                      }
                      className="flex-1 max-w-[260px] px-2 py-1 bg-white border border-[#a4bed8] rounded text-[11px] font-medium"
                    >
                      <option value="auto">Auto</option>
                      <option value="native">Printer Native</option>
                      <option value="vector">Vector</option>
                      <option value="raster">Raster</option>
                    </select>
                  </div>

                  {/* Ellipses */}
                  <div className="flex items-center justify-between">
                    <label className="w-52 text-slate-700 font-medium">
                      Ellipses:
                    </label>
                    <select
                      value={printMethodSettings.ellipses}
                      onChange={(e) =>
                        setPrintMethodSettings((prev) => ({
                          ...prev,
                          ellipses: e.target.value as any,
                        }))
                      }
                      className="flex-1 max-w-[260px] px-2 py-1 bg-white border border-[#a4bed8] rounded text-[11px] font-medium"
                    >
                      <option value="auto">Auto</option>
                      <option value="native">Printer Native</option>
                      <option value="vector">Vector</option>
                      <option value="raster">Raster</option>
                    </select>
                  </div>
                </div>
              </fieldset>

              {/* Capability status footer */}
              <div className="p-2 bg-[#f4f8fc] border border-[#d2e0ee] rounded flex items-center justify-between text-[11px] text-slate-600">
                <span>
                  Active Printer: <strong className="text-slate-800">{selectedPrinter.name}</strong> ({selectedPrinter.dpi || 300} DPI)
                </span>
                <span className="text-blue-700 font-medium">
                  Pipeline: {outputFormat.toUpperCase()} / {selectedPrinter.connectionType || 'Windows Driver'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 3. BOTTOM BUTTONS BAR ([Test Print] [Print] [Preview] [Close] [Cancel] [Help]) */}
        <div className="h-11 bg-[#f4f7fb] border-t border-[#cbdbe9] px-3 flex items-center justify-between shrink-0">
          {/* Left button: Test Print */}
          <div>
            <button
              type="button"
              onClick={handleTestPrint}
              disabled={isTestingPrint}
              className="min-w-[75px] px-3 py-1 bg-gradient-to-b from-[#f8faff] to-[#e4edf7] hover:from-white hover:to-[#ebf3fc] border border-[#a4bed8] rounded text-slate-800 text-[11.5px] font-medium shadow-2xs transition-colors cursor-pointer text-center"
            >
              {isTestingPrint ? 'Testing...' : 'Test Print'}
            </button>
          </div>

          {/* Right buttons: [Print] [Preview] [Close] [Cancel] [Help] */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleExecutePrint}
              disabled={
                isSubmitting ||
                printProgressState === 'PREPARING' ||
                printProgressState === 'RENDERING' ||
                printProgressState === 'DISPATCHING' ||
                !validationResult.isValid
              }
              className="min-w-[70px] px-4 py-1 bg-[#1973e8] hover:bg-[#1557b0] text-white border border-[#1350a2] rounded text-[11.5px] font-bold shadow-2xs transition-colors cursor-pointer disabled:opacity-40 text-center"
            >
              {printProgressState === 'PREPARING'
                ? 'Preparing document...'
                : printProgressState === 'RENDERING'
                ? 'Rendering...'
                : printProgressState === 'DISPATCHING'
                ? `Dispatching to ${selectedPrinter?.deviceName || selectedPrinter?.name || 'printer'}...`
                : 'Print'}
            </button>

            <button
              type="button"
              onClick={handleOpenPreview}
              className="min-w-[65px] px-3 py-1 bg-gradient-to-b from-[#f8faff] to-[#e4edf7] hover:from-white hover:to-[#ebf3fc] border border-[#a4bed8] rounded text-slate-800 text-[11.5px] font-medium shadow-2xs transition-colors cursor-pointer text-center"
            >
              Preview
            </button>

            <button
              type="button"
              onClick={() => {
                commitPrintMethodSettings(printMethodSettings);
                onClose();
              }}
              className="min-w-[60px] px-3 py-1 bg-gradient-to-b from-[#f8faff] to-[#e4edf7] hover:from-white hover:to-[#ebf3fc] border border-[#a4bed8] rounded text-slate-800 text-[11.5px] font-medium shadow-2xs transition-colors cursor-pointer text-center"
            >
              Close
            </button>

            <button
              type="button"
              onClick={onClose}
              className="min-w-[60px] px-3 py-1 bg-gradient-to-b from-[#f8faff] to-[#e4edf7] hover:from-white hover:to-[#ebf3fc] border border-[#a4bed8] rounded text-slate-800 text-[11.5px] font-medium shadow-2xs transition-colors cursor-pointer text-center"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => setIsHelpOpen(true)}
              className="min-w-[50px] px-2.5 py-1 bg-gradient-to-b from-[#f8faff] to-[#e4edf7] hover:from-white hover:to-[#ebf3fc] border border-[#a4bed8] rounded text-slate-800 text-[11.5px] font-medium shadow-2xs transition-colors cursor-pointer text-center"
            >
              Help
            </button>
          </div>
        </div>
      </div>

      {/* Sub Modals */}
      {barcodePreflight && !barcodePreflight.valid && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 font-sans">
          <div className="w-[560px] max-w-full bg-white rounded-lg shadow-2xl border border-red-300 flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-red-600 to-red-500 px-4 py-2.5 flex items-center gap-2 text-white">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-semibold text-sm">Invalid Barcode Data Detected</span>
            </div>
            <div className="p-4 space-y-3 text-slate-800 text-xs max-h-[50vh] overflow-y-auto">
              <p className="text-slate-600">
                {barcodePreflight.issues.length} record(s) contain barcode values that are invalid for
                their symbology. Printing these will produce unscannable labels.
              </p>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="py-1.5 px-2 font-semibold">Record</th>
                      <th className="py-1.5 px-2 font-semibold">Object</th>
                      <th className="py-1.5 px-2 font-semibold">Value</th>
                      <th className="py-1.5 px-2 font-semibold">Problem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {barcodePreflight.issues.slice(0, 12).map((iss, i) => (
                      <tr key={i}>
                        <td className="py-1.5 px-2 font-mono">#{iss.recordNumber}</td>
                        <td className="py-1.5 px-2">{iss.elementName}<span className="text-slate-400"> ({iss.symbology})</span></td>
                        <td className="py-1.5 px-2 font-mono text-red-700 max-w-[140px] truncate" title={iss.value}>{iss.value || '(empty)'}</td>
                        <td className="py-1.5 px-2 text-slate-600">{iss.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {barcodePreflight.issues.length > 12 && (
                <p className="text-slate-500 italic">…and {barcodePreflight.issues.length - 12} more.</p>
              )}
              {barcodePreflight.truncated && (
                <p className="text-amber-600">Note: scan limited to the first records for performance.</p>
              )}
            </div>
            <div className="border-t border-slate-200 bg-slate-50 px-4 py-2.5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setBarcodePreflight(null)}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
              >
                Fix Data
              </button>
              <button
                type="button"
                onClick={() => {
                  barcodeOverrideRef.current = true;
                  setBarcodePreflight(null);
                  handleExecutePrint();
                }}
                className="px-4 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-300 hover:bg-red-50 rounded-lg"
              >
                Print Anyway
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Printer Code Modifier Configuration Modal */}
      <PrinterCodeModifierModal
        isOpen={isCodeModifierModalOpen}
        onClose={() => setIsCodeModifierModalOpen(false)}
        config={codeModifierConfig}
        onSaveConfig={(newConfig) => {
          setCodeModifierConfig(newConfig);
          setEnableCodeModifier(newConfig.enabled);
        }}
      />

      {/* Show Printer Code Modal */}
      <ShowPrinterCodeModal
        isOpen={generatedCodePayload.isOpen}
        onClose={() => setGeneratedCodePayload((prev) => ({ ...prev, isOpen: false }))}
        rawCode={generatedCodePayload.code}
        format={generatedCodePayload.format}
        printerName={selectedPrinter.name}
      />

      {/* Help Modal */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-4">
          <div className="w-[440px] bg-white border border-[#7d9ebc] rounded shadow-2xl p-4 space-y-3 text-slate-800">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-slate-800 text-sm">Printing Help & Instructions</h3>
              <button onClick={() => setIsHelpOpen(false)} className="text-slate-500 hover:text-black">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p><strong>Printer:</strong> Select installed Windows printers or direct thermal network endpoints.</p>
              <p><strong>Object Print Method:</strong> Configure vector, raster, or native thermal output streams for text, barcodes, and shapes.</p>
              <p><strong>Job Options:</strong> Enable automatic data entry repetition, queue purge, and native code viewer.</p>
              <p><strong>Preview:</strong> Preview output before spooling. Content outside label boundaries is strictly clipped.</p>
            </div>
            <div className="text-right pt-2 border-t">
              <button
                type="button"
                onClick={() => setIsHelpOpen(false)}
                className="px-4 py-1 bg-blue-600 text-white rounded font-medium text-xs hover:bg-blue-700"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section 14: Offline Physical Printer Warning Modal */}
      {isOfflinePrinterModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl border border-amber-300 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-800">
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900">Selected printer is unavailable.</h3>
            </div>
            <div className="p-4 space-y-3 text-xs text-slate-700">
              <p>
                The printer <strong className="text-slate-900 font-semibold">{selectedPrinter ? (selectedPrinter.displayName || selectedPrinter.name) : 'Selected device'}</strong> is currently unreachable, offline, or experiencing an error in the Windows print spooler.
              </p>
              <p className="text-slate-500">
                To prevent lost print jobs, BarcodeFlow will not silently route hardware jobs without your confirmation.
              </p>
            </div>
            <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={async () => {
                  setIsOfflinePrinterModalOpen(false);
                  await handleExecutePrint();
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-xs shadow-xs cursor-pointer"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (refreshPrinters) await refreshPrinters();
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded font-medium text-xs cursor-pointer"
              >
                Refresh Printers
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsOfflinePrinterModalOpen(false);
                  await handleSaveAsPdfFallback();
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium text-xs shadow-xs cursor-pointer"
              >
                Save as PDF
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOfflinePrinterModalOpen(false);
                  const printerSelectEl = document.getElementById('printer-selection-dropdown');
                  if (printerSelectEl) printerSelectEl.focus();
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded font-medium text-xs cursor-pointer"
              >
                Choose Another Printer
              </button>
              <button
                type="button"
                onClick={() => setIsOfflinePrinterModalOpen(false)}
                className="px-3 py-1.5 text-slate-600 hover:text-slate-900 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
