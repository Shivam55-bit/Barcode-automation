import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  LabelTemplate,
  LabelElement,
  ViewportState,
  PrinterDefinition,
  PrintJob,
  AuditLogEntry,
  UserProfile,
  BarcodeSymbology,
  TextObjectType,
  TemplateStatus,
  VariableDefinition,
  DpiOption,
  UnitType,
  DatabaseConnectionConfig,
  DataSourceItem,
  OpenDocument,
} from './types';
import { INITIAL_TEMPLATES, getUserPersonalizedTemplates } from './services/initialTemplates';
import { INITIAL_PRINT_JOBS, INITIAL_AUDIT_LOGS, INITIAL_USERS, INITIAL_BATCH_JOBS } from './services/mockDataService';
import { useCentralPrinterState } from './printer/printerService';
import { PrinterModel } from './printer/types';
import { MenuBar } from './components/menu/MenuBar';
import { ObjectToolbar } from './components/toolbar/ObjectToolbar';
import { LeftDockPanel } from './components/sidebar/LeftDockPanel';
import { RightDockPanel } from './components/sidebar/RightDockPanel';
import { DesignerCanvas } from './components/canvas/DesignerCanvas';
import { DashboardView } from './components/views/DashboardView';
import { PrintQueueView } from './components/views/PrintQueueView';
import { WorkflowView } from './components/views/WorkflowView';
import { ViewerPrintStationView } from './components/views/ViewerPrintStationView';
import { DatasetManagerView } from './components/views/DatasetManagerView';
import { LicenseManagerView } from './components/views/LicenseManagerView';
import { SoftwareDownloadView } from './components/views/SoftwareDownloadView';
import { SuperAdminConsoleView } from './components/views/SuperAdminConsoleView';
import { hasFeaturePermission } from './utils/permissionUtils';
import { PrinterCalibrationModal } from './components/dialogs/PrinterCalibrationModal';
import { LoginView } from './components/views/LoginView';
import { ErrorBoundary } from './components/common/ErrorBoundary';

import { BarcodePickerModal } from './components/dialogs/BarcodePickerModal';
import { BarcodePropertiesModal } from './components/dialogs/BarcodePropertiesModal';
import { GS1ApplicationIdentifierWizardModal } from './components/dialogs/GS1ApplicationIdentifierWizardModal';
import { PrintCenterDialog } from './components/dialogs/PrintCenterDialog';
import { ZplExportDialog } from './components/dialogs/ZplExportDialog';
import { CsvImportModal } from './components/dialogs/CsvImportModal';
import { AiAssistantModal } from './components/dialogs/AiAssistantModal';
import { ApprovalWorkflowModal } from './components/dialogs/ApprovalWorkflowModal';
import { AuditLogModal } from './components/dialogs/AuditLogModal';
import { SettingsModal } from './components/dialogs/SettingsModal';
import { ShortcutsModal } from './components/dialogs/ShortcutsModal';
import { SerialNumberWizardModal } from './components/dialogs/SerialNumberWizardModal';
import { DateTimeWizardModal } from './components/dialogs/DateTimeWizardModal';
import { DatabaseConnectionModal } from './components/dialogs/DatabaseConnectionModal';
import { TemplateVersionHistoryModal } from './components/dialogs/TemplateVersionHistoryModal';
import { PageSetupModal } from './components/dialogs/PageSetupModal';
import { TextPropertiesModal } from './components/dialogs/TextPropertiesModal';
import { ShapePropertiesModal } from './components/dialogs/ShapePropertiesModal';
import { NamedDataSourcesModal } from './components/dialogs/NamedDataSourcesModal';
import { DocumentEventScriptsModal } from './components/dialogs/DocumentEventScriptsModal';
import { FormulaBuilderModal } from './components/dialogs/FormulaBuilderModal';
import { DataEntryFormDesignerModal } from './components/forms/DataEntryFormDesignerModal';
import { DataEntryFormRuntime } from './components/forms/DataEntryFormRuntime';
import { FormWorkspaceView } from './components/forms/FormWorkspaceView';
import { UnsavedChangesModal } from './components/dialogs/UnsavedChangesModal';
import { SaveAsModal } from './components/dialogs/SaveAsModal';
import { ValidationInspectorPanel } from './components/canvas/ValidationInspectorPanel';
import { RecordNavigationBar } from './components/canvas/RecordNavigationBar';
import { ExcelConnectWizardModal } from './components/dialogs/ExcelConnectWizardModal';
import { RecordBrowserModal } from './components/dialogs/RecordBrowserModal';
import { NewDocumentWizardModal } from './components/wizard/NewDocumentWizardModal';
import { PrinterManagerModal } from './components/dialogs/PrinterManagerModal';
import { WelcomeModal } from './components/dialogs/WelcomeModal';

import { exportLabelsToPDF } from './services/pdfExportService';
import { generateZPL } from './services/zplEngine';
import { EnterprisePrintSpooler } from './services/printSpoolerService';
import { calculateGS1CheckDigit } from './services/gs1Engine';
import { createTemplateSnapshot, calculateShortChecksum } from './services/snapshotService';
import { apiService } from './services/apiService';
import { setGlobalDatasets } from './services/dataSourceEngine';
import {
  serializeBarcodeFlowDocument,
  deserializeBarcodeFlowDocument,
  promptNativeSaveAsDialog,
  saveDocumentToDisk,
  promptNativeOpenDialog,
  readDocumentFromDisk,
  checkFileExistsOnDisk,
  exitDesktopApplication,
  getRecentDocuments,
  addRecentDocument,
  removeRecentDocument,
  clearRecentDocuments,
} from './services/documentFileService';
import { RecentDocumentEntry } from './types';
import { ZoomIn, ZoomOut, Maximize2, ShieldCheck, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function App() {
  // --- STATE ---
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('barcodeflow_auth_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.user) return parsed.user;
      }
    } catch { }
    // Default to standard Designer / Admin
    return (
      INITIAL_USERS.find((u) => u.email === 'shivam@gmail.com') ||
      INITIAL_USERS[1] ||
      INITIAL_USERS[0]
    );
  });

  const [templates, setTemplates] = useState<LabelTemplate[]>(() => {
    try {
      const saved = localStorage.getItem('barcodeflow_auth_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.user && parsed.user.email?.toLowerCase() !== 'shivam@gmail.com' && parsed.user.role !== 'Super Admin') {
          const personal = getUserPersonalizedTemplates(parsed.user);
          return [...personal, ...INITIAL_TEMPLATES];
        }
      }
    } catch { }
    return INITIAL_TEMPLATES;
  });

  const [currentTemplateId, setCurrentTemplateId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('barcodeflow_auth_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.user && parsed.user.email?.toLowerCase() !== 'shivam@gmail.com' && parsed.user.role !== 'Super Admin') {
          const personal = getUserPersonalizedTemplates(parsed.user);
          return personal[0].id;
        }
      }
    } catch { }
    return INITIAL_TEMPLATES[0].id;
  });

  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<
    'select' | 'text' | 'barcode' | 'qr' | 'datamatrix' | 'rect' | 'circle' | 'line' | 'table' | 'image'
  >('select');

  const [activeView, setActiveView] = useState<
    'designer' | 'dashboard' | 'queue' | 'workflow' | 'viewer' | 'datasets' | 'license' | 'software-download' | 'super-admin'
  >(() => {
    try {
      const saved = localStorage.getItem('barcodeflow_auth_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.user?.role === 'Super Admin' || parsed.user?.email?.toLowerCase() === 'superadmin@gmail.com') {
          return 'super-admin';
        }
      }
    } catch { }
    return 'dashboard';
  });
  const [isCalibrationModalOpen, setIsCalibrationModalOpen] = useState<boolean>(false);

  // Central Printer State (Live Windows Discovery + Universal State)
  const {
    availablePrinters,
    defaultPrinter,
    activePrinter,
    printersLoading,
    printerDiscoveryError,
    setActivePrinter,
    refreshPrinters,
  } = useCentralPrinterState();

  const [printerOverrides, setPrinterOverrides] = useState<PrinterDefinition[]>([]);
  const [missingPrinterModal, setMissingPrinterModal] = useState<{
    isOpen: boolean;
    templatePrinterName: string;
  } | null>(null);

  // Derive PrinterDefinition list from live Windows printers (no mock printers)
  const printers: PrinterDefinition[] = useMemo(() => {
    const livePrinters: PrinterDefinition[] = availablePrinters.map((p) => ({
      id: p.id,
      name: p.name,
      model: p.model || p.name,
      brand: (p.manufacturer?.includes('Zebra') ? 'Zebra' : p.manufacturer?.includes('TSC') ? 'TSC' : 'Desktop PDF') as any,
      dpi: ((p.dpi === 203 || p.dpi === 300 || p.dpi === 600 ? p.dpi : 300) || 300) as DpiOption,
      ipAddress: p.portName || p.port || 'LOCAL',
      port: 9100,
      status: (p.status === 'READY' ? 'online' : p.status === 'OFFLINE' ? 'offline' : 'online') as any,
      protocol: (p.preferredRenderer === 'ZPL' ? 'zpl' : p.preferredRenderer === 'TSPL' ? 'tspl' : 'pdf') as any,
      location: p.driverName ? `Windows Driver: ${p.driverName}` : 'Local System',
      mediaWidth: 104,
      mediaHeight: 150,
      isDefault: !!p.isDefault,
      driverName: p.driverName,
      capabilities: Object.keys(p.capabilities || {}).filter((k) => (p.capabilities as any)[k]),
    }));

    return livePrinters.map((lp) => {
      const override = printerOverrides.find((o) => o.id === lp.id);
      const merged = override ? { ...lp, ...override } : lp;
      return {
        ...merged,
        protocol: (merged.protocol || 'pdf') as any,
        brand: (merged.brand || 'Desktop PDF') as any,
        status: (merged.status || 'online') as any,
        ipAddress: merged.ipAddress || 'LOCAL',
        dpi: (merged.dpi || 300) as any,
      };
    });
  }, [availablePrinters, printerOverrides]);

  const setPrinters = useCallback((updater: React.SetStateAction<PrinterDefinition[]>) => {
    if (typeof updater === 'function') {
      setPrinterOverrides((prev) => updater(prev));
    } else {
      setPrinterOverrides(updater);
    }
  }, []);
  const [printJobs, setPrintJobs] = useState<PrintJob[]>(INITIAL_PRINT_JOBS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [batchJobs, setBatchJobs] = useState<any[]>(INITIAL_BATCH_JOBS);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('barcodeflow_auth_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.authenticated === true && !!parsed.user;
      }
    } catch { }
    return false; // Show login screen on fresh session
  });

  // Viewport & Canvas Settings
  const [viewport, setViewport] = useState<ViewportState>({
    zoom: 1.25,
    panX: 40,
    panY: 40,
    showGrid: true,
    showRulers: true,
    showGuides: true,
    showMargins: true,
    snapToGrid: true,
    snapToElements: true,
    gridSize: 5,
    unit: 'mm',
    previewRecordIndex: 0,
  });

  const [showLeftDock, setShowLeftDock] = useState(false);
  const [showRightDock, setShowRightDock] = useState(false);
  const [defaultDpi, setDefaultDpi] = useState<DpiOption>(300);
  const [clipboard, setClipboard] = useState<LabelElement[]>([]);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Undo / Redo History
  const [history, setHistory] = useState<LabelElement[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const isUndoRedoAction = useRef(false);

  // Modals state
  const [isBarcodePickerOpen, setIsBarcodePickerOpen] = useState(false);
  const [isBarcodePropertiesOpen, setIsBarcodePropertiesOpen] = useState(false);
  const [isGs1WizardOpen, setIsGs1WizardOpen] = useState(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [isZplExportOpen, setIsZplExportOpen] = useState(false);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isAuditLogsOpen, setIsAuditLogsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'general' | 'datasets' | 'calibration' | 'license' | 'desktop'>('datasets');
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isSerialNumberWizardOpen, setIsSerialNumberWizardOpen] = useState(false);
  const [isDateTimeWizardOpen, setIsDateTimeWizardOpen] = useState(false);
  const [isDatabaseConnectionModalOpen, setIsDatabaseConnectionModalOpen] = useState(false);
  const [isVersionHistoryModalOpen, setIsVersionHistoryModalOpen] = useState(false);
  const [isValidationInspectorOpen, setIsValidationInspectorOpen] = useState(false);
  const [isPageSetupOpen, setIsPageSetupOpen] = useState(false);
  const [isNewDocWizardOpen, setIsNewDocWizardOpen] = useState(false);
  const [isPrinterManagerOpen, setIsPrinterManagerOpen] = useState(false);
  const [isTextPropertiesOpen, setIsTextPropertiesOpen] = useState(false);
  const [isShapePropertiesOpen, setIsShapePropertiesOpen] = useState(false);
  const [isNamedDataSourcesOpen, setIsNamedDataSourcesOpen] = useState(false);
  const [isDocumentScriptsOpen, setIsDocumentScriptsOpen] = useState(false);
  const [isFormulaBuilderOpen, setIsFormulaBuilderOpen] = useState(false);
  const [isDataEntryDesignerOpen, setIsDataEntryDesignerOpen] = useState(false);
  const [isDataEntryRuntimeOpen, setIsDataEntryRuntimeOpen] = useState(false);
  const [isExcelWizardOpen, setIsExcelWizardOpen] = useState(false);
  const [isRecordBrowserOpen, setIsRecordBrowserOpen] = useState(false);
  const [selectedRecordIndices, setSelectedRecordIndices] = useState<number[]>([]);
  // Section 10: Record Navigator filter & refresh state
  const [recordSearchFilter, setRecordSearchFilter] = useState<string>('');
  const [isRefreshingRecords, setIsRefreshingRecords] = useState<boolean>(false);

  // --- MULTI-DOCUMENT WORKSPACE STATE ---
  const [showWelcomeOnStartup, setShowWelcomeOnStartup] = useState<boolean>(() => {
    try {
      const val = localStorage.getItem('barcodeflow.showWelcomeOnStartup');
      return val === null ? true : val === 'true';
    } catch {
      return true;
    }
  });

  const [isWelcomeOpen, setIsWelcomeOpen] = useState<boolean>(() => {
    try {
      const val = localStorage.getItem('barcodeflow.showWelcomeOnStartup');
      return val === null ? true : val === 'true';
    } catch {
      return true;
    }
  });

  const handleToggleShowWelcomeOnStartup = useCallback((enabled: boolean) => {
    setShowWelcomeOnStartup(enabled);
    try {
      localStorage.setItem('barcodeflow.showWelcomeOnStartup', String(enabled));
    } catch { }
  }, []);

  const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>(() => {
    try {
      const welcomeVal = localStorage.getItem('barcodeflow.showWelcomeOnStartup');
      const showWelcome = welcomeVal === null ? true : welcomeVal === 'true';
      if (showWelcome) {
        return []; // Clean workspace when welcome dialog is active on startup
      }
    } catch { }
    const initTpl = INITIAL_TEMPLATES[0];
    return [
      {
        instanceId: `doc-${Date.now()}-1`,
        documentId: initTpl.id,
        type: 'template',
        name: initTpl.name || 'Template 1',
        isDirty: false,
        isNew: false,
        template: initTpl,
        selectedElementIds: [],
        history: { entries: [initTpl.elements || []], index: 0 },
        viewState: { zoom: 1.25, panX: 40, panY: 40 },
        dataState: { currentRecordIndex: 0, selectedRecordIndices: [] },
      },
    ];
  });

  const [activeDocumentInstanceId, setActiveDocumentInstanceId] = useState<string>(() => {
    return openDocuments[0]?.instanceId || '';
  });

  const [unsavedDocModal, setUnsavedDocModal] = useState<{
    isOpen: boolean;
    instanceId: string;
    documentName: string;
    action: 'close' | 'closeAll' | 'closeOthers';
  } | null>(null);
  const [isSaveAsModalOpen, setIsSaveAsModalOpen] = useState(false);
  const [recentDocuments, setRecentDocuments] = useState<RecentDocumentEntry[]>(() => getRecentDocuments());

  // Application exit warning for dirty documents
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasDirty = openDocuments.some((d) => d.isDirty);
      if (hasDirty) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes in open documents. Are you sure you want to exit?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [openDocuments]);

  // Derived Active Document
  const activeDocument = useMemo(() => {
    return openDocuments.find((d) => d.instanceId === activeDocumentInstanceId) || openDocuments[0] || null;
  }, [openDocuments, activeDocumentInstanceId]);

  // Current Template Reference (strictly derived from active document if template, or fallback)
  const rawTemplate = (activeDocument?.type === 'template' ? activeDocument.template : null) || templates.find((t) => t.id === currentTemplateId) || templates[0] || INITIAL_TEMPLATES[0];
  const currentTemplate: LabelTemplate = {
    ...rawTemplate,
    elements: rawTemplate?.elements || [],
    variables: rawTemplate?.variables || [],
    sampleRecords: rawTemplate?.sampleRecords && rawTemplate.sampleRecords.length > 0 ? rawTemplate.sampleRecords : [{}],
    tags: rawTemplate?.tags || ['Draft'],
    dimensions: rawTemplate?.dimensions || { width: 100, height: 75, unit: 'mm', dpi: 300, orientation: 'landscape' },
    margins: rawTemplate?.margins || { top: 2, right: 2, bottom: 2, left: 2, bleed: 1, safeZone: 2 },
  };

  const refreshDatasets = useCallback(async () => {
    try {
      const data = await apiService.datasets.list();
      if (Array.isArray(data)) {
        setDatasets(data);
        setGlobalDatasets(data);
      }
    } catch (err) {
      console.warn('[BarcodeFlow] Dataset refresh warning:', err);
    }
  }, []);

  // Helper for flash toast notifications
  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Push state to history for undo/redo
  const pushHistory = useCallback(
    (elements: LabelElement[]) => {
      if (isUndoRedoAction.current) {
        isUndoRedoAction.current = false;
        return;
      }
      setHistory((prev) => {
        const next = prev.slice(0, historyIndex + 1);
        next.push(JSON.parse(JSON.stringify(elements)));
        if (next.length > 40) next.shift();
        return next;
      });
      setHistoryIndex((prev) => Math.min(prev + 1, 39));
    },
    [historyIndex]
  );

  // Load persistent data from Backend API on mount
  useEffect(() => {
    async function fetchBackendData() {
      try {
        const [apiTemplates, apiPrinters, apiPrintJobs, apiBatchJobs, apiAuditLogs, apiDatasets] = await Promise.allSettled([
          apiService.templates.list(),
          apiService.printers.list(),
          apiService.printJobs.list(),
          apiService.batchJobs.list(),
          apiService.auditLogs.list(),
          apiService.datasets.list(),
        ]);

        if (apiTemplates.status === 'fulfilled' && apiTemplates.value?.length > 0) {
          setTemplates((prev) => {
            const merged = [...prev];
            for (const at of apiTemplates.value) {
              const idx = merged.findIndex((m) => m.id === at.id);
              if (idx >= 0) {
                merged[idx] = at;
              } else {
                merged.push(at);
              }
            }
            return merged;
          });
        }
        if (apiPrinters.status === 'fulfilled' && apiPrinters.value?.length > 0) {
          setPrinters(apiPrinters.value);
        }
        if (apiPrintJobs.status === 'fulfilled') {
          setPrintJobs(apiPrintJobs.value);
        }
        if (apiBatchJobs.status === 'fulfilled') {
          setBatchJobs(apiBatchJobs.value);
        }
        if (apiAuditLogs.status === 'fulfilled') {
          setAuditLogs(apiAuditLogs.value);
        }
        if (apiDatasets.status === 'fulfilled' && Array.isArray(apiDatasets.value)) {
          setDatasets(apiDatasets.value);
          setGlobalDatasets(apiDatasets.value);
        }
      } catch (err) {
        console.warn('[BarcodeFlow] Backend API connect warning:', err);
      }
    }
    fetchBackendData();
  }, []);

  // Initialize history when switching templates
  useEffect(() => {
    if (currentTemplate) {
      setHistory([JSON.parse(JSON.stringify(currentTemplate.elements))]);
      setHistoryIndex(0);
      setSelectedElementIds([]);
    }
  }, [currentTemplateId]);

  // P0-8: Restore active printer when template opens; warn if preferred printer is missing
  const lastCheckedTemplateRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentTemplate || printersLoading) return;
    if (lastCheckedTemplateRef.current === currentTemplate.id) return;
    lastCheckedTemplateRef.current = currentTemplate.id;

    const preferred = currentTemplate.printer;
    if (!preferred || !preferred.name) return;

    // Search exact matching printer in availablePrinters
    const exactMatch = availablePrinters.find(
      (p) =>
        p.name.toLowerCase() === preferred.name?.toLowerCase() ||
        (p.systemName && preferred.systemName && p.systemName.toLowerCase() === preferred.systemName.toLowerCase()) ||
        p.id === preferred.id
    );

    if (exactMatch) {
      setActivePrinter(exactMatch);
    } else if (availablePrinters.length > 0) {
      // Do NOT silently switch to first printer
      setMissingPrinterModal({
        isOpen: true,
        templatePrinterName: preferred.name || preferred.systemName || 'Unknown Printer',
      });
    }
  }, [currentTemplate?.id, currentTemplate?.printer, availablePrinters, printersLoading, setActivePrinter]);

  // Append audit trail log (synced with Backend API)
  const logAction = (action: AuditLogEntry['action'], details: string) => {
    const newEntry: AuditLogEntry = {
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      user: currentUser.name,
      userRole: currentUser.role,
      action,
      details,
      entityId: currentTemplate.id,
      entityName: currentTemplate.name,
      ipAddress: '127.0.0.1',
    };
    setAuditLogs((prev) => [newEntry, ...prev]);
    apiService.auditLogs.log(newEntry).catch((err) => console.warn('Audit log backend sync error:', err));
  };

  // Helper to bump minor version (e.g., 1.0 -> 1.1)
  const getNextDraftVersion = (ver: string = '1.0'): string => {
    const parts = ver.split('.');
    if (parts.length >= 2) {
      const major = parseInt(parts[0], 10) || 1;
      const minor = parseInt(parts[1], 10) || 0;
      return `${major}.${minor + 1}`;
    }
    return `${ver}.1`;
  };

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update Template Properties with Version Freeze Auto-Branching & Debounced Backend Disk Sync
  const updateTemplate = useCallback(
    (updates: Partial<LabelTemplate>) => {
      let templateToSync: LabelTemplate | null = null;

      setOpenDocuments((prev) =>
        prev.map((doc) => {
          if (doc.instanceId !== activeDocumentInstanceId) return doc;
          const baseT = doc.template || currentTemplate;
          const updated = { ...baseT, ...updates, updatedAt: new Date().toISOString() };
          templateToSync = updated;
          return {
            ...doc,
            isDirty: true,
            template: updated,
            name: updates.name || doc.name,
          };
        })
      );

      setTemplates((prev) =>
        prev.map((t) => {
          if (t.id !== currentTemplate.id && t.id !== currentTemplateId) return t;

          // If template is frozen in approval or approved and layout/elements are modified:
          const isFrozen = t.status === 'pending_level_1' || t.status === 'pending_level_2' || t.status === 'approved' || t.status === 'submitted';
          const isModifyingContent = updates.elements !== undefined || updates.dimensions !== undefined;

          if (isFrozen && isModifyingContent && updates.status === undefined) {
            const nextVer = getNextDraftVersion(t.version);
            const branched: LabelTemplate = {
              ...t,
              ...updates,
              version: nextVer,
              status: 'draft',
              updatedAt: new Date().toISOString(),
              tags: Array.from(new Set([...(t.tags || []), 'Draft Revision'])),
            };
            showToast(`Auto-created editable Draft v${nextVer} (Frozen v${t.version} remains in approval pipeline)`, 'info');
            logAction('EDIT_TEMPLATE', `Auto-branched template "${t.name}" to Draft v${nextVer} due to designer modification during active approval.`);
            templateToSync = branched;
            return branched;
          }

          const updated = { ...t, ...updates, updatedAt: new Date().toISOString() };
          templateToSync = updated;
          return updated;
        })
      );

      // Debounce disk API sync so 60fps drag/move events update UI instantly without triggering disk file reload
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        if (templateToSync) {
          apiService.templates.save(templateToSync).catch((err) => console.warn('API sync save warning:', err));
        }
      }, 2000);
    },
    [activeDocumentInstanceId, currentTemplate, currentTemplateId]
  );

  // Update Elements in Active Template
  const updateElements = useCallback(
    (newElements: LabelElement[]) => {
      updateTemplate({ elements: newElements });
      pushHistory(newElements);
    },
    [updateTemplate, pushHistory]
  );

  const updateSingleElement = useCallback(
    (id: string, updates: Partial<LabelElement>) => {
      const nextElements = currentTemplate.elements.map((el) => (el.id === id ? ({ ...el, ...updates } as LabelElement) : el));
      updateElements(nextElements);
    },
    [currentTemplate.elements, updateElements]
  );

  const updateMultipleElements = useCallback(
    (updatesList: { id: string; updates: Partial<LabelElement> }[]) => {
      const updateMap = new Map(updatesList.map((u) => [u.id, u.updates]));
      const nextElements = currentTemplate.elements.map((el) => {
        if (updateMap.has(el.id)) {
          return { ...el, ...updateMap.get(el.id) } as LabelElement;
        }
        return el;
      });
      updateElements(nextElements);
    },
    [currentTemplate.elements, updateElements]
  );

  // Reorder Elements (Z-Index)
  const handleReorderElements = (fromIndex: number, toIndex: number) => {
    const list = [...currentTemplate.elements];
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    const reIndexed = list.map((el, idx) => ({ ...el, zIndex: idx + 1 }));
    updateElements(reIndexed);
  };

  // Undo / Redo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoRedoAction.current = true;
      const targetIndex = historyIndex - 1;
      const targetState = history[targetIndex];
      setHistoryIndex(targetIndex);
      updateTemplate({ elements: JSON.parse(JSON.stringify(targetState)) });
    }
  }, [historyIndex, history, updateTemplate]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoRedoAction.current = true;
      const targetIndex = historyIndex + 1;
      const targetState = history[targetIndex];
      setHistoryIndex(targetIndex);
      updateTemplate({ elements: JSON.parse(JSON.stringify(targetState)) });
    }
  }, [historyIndex, history, updateTemplate]);

  // Insertion Utilities
  const handleInsertText = () => {
    handleInsertTextType('single-line');
  };

  const handleInsertTextType = (textType: TextObjectType = 'single-line') => {
    let name = 'Single Line Text';
    let text = 'SAMPLE TEXT';
    let width = 40;
    let height = 8;
    let fontSize = 10;
    let fontWeight: 'normal' | 'bold' | '600' | '700' | '800' = 'bold';
    let multiline = false;

    if (textType === 'multi-line') {
      name = 'Multi-line Text';
      text = 'Enterprise Logistics Label\nDirect Thermal Stock\nHandling: DRY & COOL';
      width = 50;
      height = 16;
      fontSize = 9;
      fontWeight = 'normal';
      multiline = true;
    } else if (textType === 'word-processor') {
      name = 'Word Processor Document';
      text = '<b>Product:</b> High Grade Polymer<br/><i>Rating:</i> Heat Resistant Class 2<br/><u>Standard:</u> ISO 9001:2015 Compliant';
      width = 60;
      height = 18;
      fontSize = 9;
      multiline = true;
    } else if (textType === 'arc') {
      name = 'Arc Text Box';
      text = '• CAUTION • HIGH VOLTAGE • DANGER •';
      width = 50;
      height = 25;
      fontSize = 9;
    } else if (textType === 'symbol-font') {
      name = 'Symbol Font Characters';
      text = '⚠ ⚡ ♻ ♺ 📦 ☂ ❄ ✂ ✈ ⛟ ☢ ☣ ⏻ ⚙ ✦ ★ ✔ ✖';
      width = 65;
      height = 12;
      fontSize = 13;
      fontWeight = 'normal';
    } else if (textType === 'rtf') {
      name = 'RTF Markup Container';
      text = '{\\rtf1\\ansi\\b LOT-BATCH:\\b0 99402-A\\par\\i INSPECTED & CERTIFIED\\i0}';
      width = 55;
      height = 16;
      fontSize = 9;
      multiline = true;
    } else if (textType === 'html') {
      name = 'HTML Markup Container';
      text = '<div style="background:#fef2f2;border:1px solid #dc2626;padding:3px"><b style="color:#b91c1c">DANGER:</b> Flammable Liquid<br/><span style="color:#475569;font-size:9px">UN 1993 Class 3 Packaging</span></div>';
      width = 58;
      height = 20;
      fontSize = 8.5;
      multiline = true;
    } else if (textType === 'xaml') {
      name = 'XAML Markup Container';
      text = '<TextBlock FontSize="12" FontFamily="Segoe UI"><Run Text="LOT: "/><Run Text="98402-A" Foreground="#dc2626" FontWeight="Bold"/><Run Text=" (PASS)" Foreground="#16a34a"/></TextBlock>';
      width = 55;
      height = 14;
      fontSize = 9;
      multiline = true;
    }

    const labelW = currentTemplate.dimensions?.width || 100;
    const labelH = currentTemplate.dimensions?.height || 60;
    const elW = Math.min(width, Math.max(10, labelW - 10));
    const elH = Math.min(height, Math.max(5, labelH - 8));
    const stagger = (currentTemplate.elements.length % 6) * 4;
    const spawnX = Math.min(Math.max(4, 10 + stagger), Math.max(4, labelW - elW - 4));
    const spawnY = Math.min(Math.max(4, 8 + stagger), Math.max(4, labelH - elH - 4));

    const newEl: LabelElement = {
      id: `el-text-${Date.now()}`,
      name: `${name} ${currentTemplate.elements.length + 1}`,
      type: 'text',
      textType,
      text,
      fontFamily: textType === 'symbol-font' ? 'Arial, sans-serif' : 'Arial',
      fontSize,
      fontWeight,
      fontStyle: 'normal',
      textDecoration: 'none',
      textAlign: 'left',
      verticalAlign: 'top',
      color: '#000000',
      lineHeight: 1.2,
      letterSpacing: 0,
      multiline,
      x: spawnX,
      y: spawnY,
      width: elW,
      height: elH,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: currentTemplate.elements.length + 1,
    };
    updateElements([...currentTemplate.elements, newEl]);
    setSelectedElementIds([newEl.id]);
    setActiveTool('select');
    showToast(`Added ${newEl.name}`, 'success');
  };

  const handleInsertBarcode = (symbology: BarcodeSymbology = 'code128') => {
    const labelW = currentTemplate.dimensions?.width || 100;
    const labelH = currentTemplate.dimensions?.height || 60;
    const elW = Math.min(55, Math.max(25, labelW - 10));
    const elH = Math.min(22, Math.max(12, labelH - 10));
    const stagger = (currentTemplate.elements.length % 6) * 4;
    const spawnX = Math.min(Math.max(4, 8 + stagger), Math.max(4, labelW - elW - 4));
    const spawnY = Math.min(Math.max(4, 12 + stagger), Math.max(4, labelH - elH - 4));

    const newEl: LabelElement = {
      id: `el-bar-${Date.now()}`,
      name: `1D Barcode (${symbology.toUpperCase()})`,
      type: 'barcode',
      symbology,
      value: symbology === 'ean13' ? '4006381333931' : '10850006531238',
      includeText: true,
      textPosition: 'below',
      barWidth: 1.5,
      barHeight: 16,
      quietZone: true,
      foregroundColor: '#000000',
      backgroundColor: '#ffffff',
      checkDigit: true,
      x: spawnX,
      y: spawnY,
      width: elW,
      height: elH,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: currentTemplate.elements.length + 1,
    };
    updateElements([...currentTemplate.elements, newEl]);
    setSelectedElementIds([newEl.id]);
    setActiveTool('select');
    showToast(`Added Barcode (${symbology.toUpperCase()})`, 'success');
  };

  const handleInsertQR = () => {
    const labelW = currentTemplate.dimensions?.width || 100;
    const labelH = currentTemplate.dimensions?.height || 60;
    const maxSide = Math.min(labelW, labelH);
    const side = Math.min(25, Math.max(12, maxSide - 10));
    const stagger = (currentTemplate.elements.length % 6) * 4;
    const spawnX = Math.min(Math.max(4, 8 + stagger), Math.max(4, labelW - side - 4));
    const spawnY = Math.min(Math.max(4, 8 + stagger), Math.max(4, labelH - side - 4));

    const newEl: LabelElement = {
      id: `el-qr-${Date.now()}`,
      name: 'QR Code 2D',
      type: 'barcode',
      symbology: 'qr',
      value: 'https://enterprise-label.internal/track/008500065123456789',
      includeText: false,
      textPosition: 'none',
      barWidth: 2,
      barHeight: 25,
      quietZone: true,
      foregroundColor: '#000000',
      backgroundColor: '#ffffff',
      checkDigit: false,
      errorCorrectionLevel: 'M',
      x: spawnX,
      y: spawnY,
      width: side,
      height: side,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: currentTemplate.elements.length + 1,
    };
    updateElements([...currentTemplate.elements, newEl]);
    setSelectedElementIds([newEl.id]);
    setActiveTool('select');
    showToast('Added QR Code', 'success');
  };

  const handleInsertDataMatrix = () => {
    const labelW = currentTemplate.dimensions?.width || 100;
    const labelH = currentTemplate.dimensions?.height || 60;
    const maxSide = Math.min(labelW, labelH);
    const side = Math.min(20, Math.max(10, maxSide - 10));
    const stagger = (currentTemplate.elements.length % 6) * 4;
    const spawnX = Math.min(Math.max(4, 8 + stagger), Math.max(4, labelW - side - 4));
    const spawnY = Math.min(Math.max(4, 8 + stagger), Math.max(4, labelH - side - 4));

    const newEl: LabelElement = {
      id: `el-dm-${Date.now()}`,
      name: 'DataMatrix 2D (GS1 / UDI)',
      type: 'barcode',
      symbology: 'gs1-datamatrix',
      value: '(01)00850006531238(17)280630(10)LOT-9921(21)SN-00192',
      includeText: false,
      textPosition: 'none',
      barWidth: 2,
      barHeight: 20,
      quietZone: true,
      foregroundColor: '#000000',
      backgroundColor: '#ffffff',
      checkDigit: true,
      x: spawnX,
      y: spawnY,
      width: side,
      height: side,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: currentTemplate.elements.length + 1,
    };
    updateElements([...currentTemplate.elements, newEl]);
    setSelectedElementIds([newEl.id]);
    setActiveTool('select');
    showToast('Added DataMatrix Code', 'success');
  };

  const handleInsertShape = (shapeType: 'rectangle' | 'circle' | 'line') => {
    const isLine = shapeType === 'line';
    const labelW = currentTemplate.dimensions?.width || 100;
    const labelH = currentTemplate.dimensions?.height || 60;
    const elW = isLine ? Math.min(50, Math.max(15, labelW - 10)) : Math.min(35, Math.max(12, labelW - 10));
    const elH = isLine ? 1 : Math.min(25, Math.max(12, labelH - 10));
    const stagger = (currentTemplate.elements.length % 6) * 4;
    const spawnX = Math.min(Math.max(4, 8 + stagger), Math.max(4, labelW - elW - 4));
    const spawnY = Math.min(Math.max(4, 8 + stagger), Math.max(4, labelH - elH - 4));

    const newEl: LabelElement = {
      id: `el-shape-${Date.now()}`,
      name: `${shapeType.charAt(0).toUpperCase() + shapeType.slice(1)} ${currentTemplate.elements.length + 1}`,
      type: 'shape',
      shapeType,
      fillColor: isLine ? '#000000' : 'transparent',
      strokeColor: '#000000',
      strokeWidth: 0.5,
      strokeStyle: 'solid',
      cornerRadius: 0,
      x: spawnX,
      y: spawnY,
      width: elW,
      height: elH,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: currentTemplate.elements.length + 1,
    };
    updateElements([...currentTemplate.elements, newEl]);
    setSelectedElementIds([newEl.id]);
    setActiveTool('select');
    showToast(`Added Shape (${shapeType})`, 'success');
  };

  const handleInsertTable = () => {
    const labelW = currentTemplate.dimensions?.width || 100;
    const labelH = currentTemplate.dimensions?.height || 60;
    const elW = Math.min(70, Math.max(25, labelW - 10));
    const elH = Math.min(18, Math.max(10, labelH - 10));
    const stagger = (currentTemplate.elements.length % 6) * 4;
    const spawnX = Math.min(Math.max(4, 6 + stagger), Math.max(4, labelW - elW - 4));
    const spawnY = Math.min(Math.max(4, 6 + stagger), Math.max(4, labelH - elH - 4));

    const newEl: LabelElement = {
      id: `el-tbl-${Date.now()}`,
      name: 'Specification Table',
      type: 'table',
      rows: 3,
      cols: 3,
      rowHeight: 6,
      borderColor: '#000000',
      borderWidth: 0.4,
      headerBackground: '#f1f5f9',
      fontSize: 8,
      cells: [
        [
          { id: 'c1', content: 'PARAM', isHeader: true, align: 'left' },
          { id: 'c2', content: 'SPEC', isHeader: true, align: 'center' },
          { id: 'c3', content: 'VALUE', isHeader: true, align: 'right' },
        ],
        [
          { id: 'c4', content: 'Net Weight', align: 'left' },
          { id: 'c5', content: 'KG', align: 'center' },
          { id: 'c6', content: '{{TOTAL_WEIGHT}}', align: 'right' },
        ],
        [
          { id: 'c7', content: 'Lot Batch', align: 'left' },
          { id: 'c8', content: 'ALPHA', align: 'center' },
          { id: 'c9', content: '{{BATCH_LOT}}', align: 'right' },
        ],
      ],
      x: spawnX,
      y: spawnY,
      width: elW,
      height: elH,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: currentTemplate.elements.length + 1,
    };
    updateElements([...currentTemplate.elements, newEl]);
    setSelectedElementIds([newEl.id]);
    setActiveTool('select');
    showToast('Added Specification Table', 'success');
  };

  const handleInsertImage = () => {
    const labelW = currentTemplate.dimensions?.width || 100;
    const labelH = currentTemplate.dimensions?.height || 60;
    const elW = Math.min(22, Math.max(10, Math.min(labelW, labelH) - 8));
    const elH = elW;
    const stagger = (currentTemplate.elements.length % 6) * 4;
    const spawnX = Math.min(Math.max(4, 8 + stagger), Math.max(4, labelW - elW - 4));
    const spawnY = Math.min(Math.max(4, 8 + stagger), Math.max(4, labelH - elH - 4));

    // Reliable vector caution icon that works 100% offline without external network dependency
    const cautionSvgData = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23f59e0b" stroke="%23000000" stroke-width="1.5"><polygon points="12 2 1 21 23 21 12 2"/><line x1="12" y1="9" x2="12" y2="13" stroke="%23000" stroke-width="2"/><circle cx="12" cy="17" r="1" fill="%23000"/></svg>`;

    const addImageEl = (src: string, name: string) => {
      const newEl: LabelElement = {
        id: `el-img-${Date.now()}`,
        name,
        type: 'image',
        src,
        objectFit: 'contain',
        grayscale: false,
        invert: false,
        aspectRatioLocked: true,
        x: spawnX,
        y: spawnY,
        width: elW,
        height: elH,
        rotation: 0,
        opacity: 1,
        locked: false,
        visible: true,
        zIndex: currentTemplate.elements.length + 1,
      };
      updateElements([...currentTemplate.elements, newEl]);
      setSelectedElementIds([newEl.id]);
      setActiveTool('select');
      showToast(`Added Image "${name}"`, 'success');
    };

    // Prompt user to pick local image file, with automatic fallback to standard symbol
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    let fileSelected = false;
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        fileSelected = true;
        const reader = new FileReader();
        reader.onload = (evt) => {
          const result = evt.target?.result as string;
          addImageEl(result, file.name.replace(/\.[^/.]+$/, ''));
        };
        reader.readAsDataURL(file);
      }
    };

    // Listen for window focus to detect file picker dismissal without file selection
    const onWindowFocus = () => {
      window.removeEventListener('focus', onWindowFocus);
      setTimeout(() => {
        if (!fileSelected) {
          // If no file was chosen, insert default symbol
          addImageEl(cautionSvgData, 'Caution Symbol');
        }
      }, 500);
    };
    window.addEventListener('focus', onWindowFocus);
    input.click();
  };

  const handleInsertPreset = (presetType: string) => {
    if (presetType === 'header-box') {
      handleInsertShape('rectangle');
    } else if (presetType === 'barcode-128') {
      handleInsertBarcode('code128');
    } else if (presetType === 'qr-block') {
      handleInsertQR();
    } else if (presetType === 'datamatrix-udi') {
      handleInsertDataMatrix();
    } else if (presetType === 'gs1-sscc') {
      setIsGs1WizardOpen(true);
    } else if (presetType === 'spec-table') {
      handleInsertTable();
    }
  };

  // Section 10-16: Drag & Drop database field binding handlers
  const handleBindElementToField = useCallback(
    (elementId: string, payload: any) => {
      const el = currentTemplate.elements.find((e) => e.id === elementId);
      if (!el) return;

      const fieldName = payload.fieldName || payload.field;
      const connectionId = payload.connectionId || currentTemplate.databaseConnection?.id || 'excel-primary';
      const connectionName = payload.connectionName || currentTemplate.databaseConnection?.name || 'Product Master';
      const sheetName = payload.sheetName || currentTemplate.databaseConnection?.sheetName || 'Sheet1$';

      const bindingSource: DataSourceItem = {
        id: `ds-${Date.now()}`,
        name: `Primary ${el.type === 'barcode' ? 'Barcode' : 'Text'} Source`,
        type: 'database-field',
        datasetId: connectionId,
        datasetName: connectionName,
        sheetName,
        field: fieldName,
        databaseField: fieldName,
        value: `{{${fieldName}}}`,
        enabled: true,
      };

      const updates: Partial<LabelElement> = {
        dataSources: [bindingSource],
        dataBinding: `{{${fieldName}}}`,
      };

      if (el.type === 'text') {
        (updates as any).text = `{{${fieldName}}}`;
      } else if (el.type === 'barcode') {
        (updates as any).value = `{{${fieldName}}}`;
      }

      updateSingleElement(elementId, updates);
      showToast(`Bound ${el.name} to Database Field "${fieldName}"`, 'success');
    },
    [currentTemplate.elements, currentTemplate.databaseConnection, updateSingleElement]
  );

  const handleInsertBoundElementAt = useCallback(
    (payload: any, xMm: number = 15, yMm: number = 15, asType?: 'text' | 'barcode' | 'qr') => {
      const fieldName = payload.fieldName || payload.field;
      const connectionId = payload.connectionId || currentTemplate.databaseConnection?.id || 'excel-primary';
      const connectionName = payload.connectionName || currentTemplate.databaseConnection?.name || 'Product Master';
      const sheetName = payload.sheetName || currentTemplate.databaseConnection?.sheetName || 'Sheet1$';
      const targetType = asType || payload.suggestedType || 'text';

      const bindingSource: DataSourceItem = {
        id: `ds-${Date.now()}`,
        name: `Primary ${targetType === 'barcode' || targetType === 'qr' ? 'Barcode' : 'Text'} Source`,
        type: 'database-field',
        datasetId: connectionId,
        datasetName: connectionName,
        sheetName,
        field: fieldName,
        databaseField: fieldName,
        value: `{{${fieldName}}}`,
        enabled: true,
      };

      let newEl: LabelElement;

      if (targetType === 'barcode') {
        newEl = {
          id: `el-bar-${Date.now()}`,
          name: `Barcode (${fieldName})`,
          type: 'barcode',
          symbology: 'code128',
          value: `{{${fieldName}}}`,
          dataBinding: `{{${fieldName}}}`,
          dataSources: [bindingSource],
          includeText: true,
          textPosition: 'below',
          barWidth: 1.5,
          barHeight: 16,
          quietZone: true,
          foregroundColor: '#000000',
          backgroundColor: '#ffffff',
          checkDigit: true,
          x: xMm,
          y: yMm,
          width: 55,
          height: 22,
          rotation: 0,
          opacity: 1,
          locked: false,
          visible: true,
          zIndex: currentTemplate.elements.length + 1,
        };
      } else if (targetType === 'qr') {
        newEl = {
          id: `el-qr-${Date.now()}`,
          name: `QR (${fieldName})`,
          type: 'barcode',
          symbology: 'qr',
          value: `{{${fieldName}}}`,
          dataBinding: `{{${fieldName}}}`,
          dataSources: [bindingSource],
          includeText: false,
          textPosition: 'none',
          barWidth: 2,
          barHeight: 20,
          quietZone: true,
          foregroundColor: '#000000',
          backgroundColor: '#ffffff',
          checkDigit: true,
          x: xMm,
          y: yMm,
          width: 25,
          height: 25,
          rotation: 0,
          opacity: 1,
          locked: false,
          visible: true,
          zIndex: currentTemplate.elements.length + 1,
        };
      } else {
        newEl = {
          id: `el-text-${Date.now()}`,
          name: `Text (${fieldName})`,
          type: 'text',
          textType: 'single-line',
          text: `{{${fieldName}}}`,
          dataBinding: `{{${fieldName}}}`,
          dataSources: [bindingSource],
          fontFamily: 'Arial',
          fontSize: 10,
          fontWeight: 'normal',
          fontStyle: 'normal',
          textDecoration: 'none',
          textAlign: 'left',
          verticalAlign: 'top',
          color: '#000000',
          lineHeight: 1.2,
          letterSpacing: 0,
          x: xMm,
          y: yMm,
          width: 40,
          height: 10,
          rotation: 0,
          opacity: 1,
          locked: false,
          visible: true,
          zIndex: currentTemplate.elements.length + 1,
        };
      }

      updateElements([...currentTemplate.elements, newEl]);
      setSelectedElementIds([newEl.id]);
      showToast(`Added ${newEl.name} bound to "${fieldName}"`, 'success');
    },
    [currentTemplate.elements, currentTemplate.databaseConnection, updateElements]
  );

  // Clipboard & Manipulation Handlers
  const handleCopy = () => {
    const selected = currentTemplate.elements.filter((el) => selectedElementIds.includes(el.id));
    if (selected.length > 0) {
      setClipboard(JSON.parse(JSON.stringify(selected)));
      showToast(`Copied ${selected.length} element(s) to clipboard`, 'info');
    } else {
      showToast('Click an element on the canvas to select it first', 'info');
    }
  };

  const handleCut = () => {
    if (selectedElementIds.length === 0) {
      showToast('Click an element on the canvas to select it first', 'info');
      return;
    }
    handleCopy();
    handleDeleteSelected();
  };

  const handlePaste = () => {
    if (clipboard.length === 0) {
      showToast('Clipboard is empty. Copy an element first (Ctrl+C).', 'info');
      return;
    }
    const labelW = currentTemplate.dimensions?.width || 100;
    const labelH = currentTemplate.dimensions?.height || 60;
    const pasted = clipboard.map((el, idx) => {
      const nextX = Math.min(Math.max(2, el.x + 4), Math.max(2, labelW - el.width - 2));
      const nextY = Math.min(Math.max(2, el.y + 4), Math.max(2, labelH - el.height - 2));
      return {
        ...el,
        id: `el-pasted-${Date.now()}-${idx}`,
        name: `${el.name} (Copy)`,
        x: nextX,
        y: nextY,
        zIndex: currentTemplate.elements.length + idx + 1,
      };
    });
    updateElements([...currentTemplate.elements, ...pasted]);
    setSelectedElementIds(pasted.map((p) => p.id));
    showToast(`Pasted ${pasted.length} element(s)`, 'success');
  };

  const handleDuplicateSelected = () => {
    const selected = currentTemplate.elements.filter((el) => selectedElementIds.includes(el.id));
    if (selected.length === 0) {
      showToast('Click an element on the canvas to select it first', 'info');
      return;
    }
    const labelW = currentTemplate.dimensions?.width || 100;
    const labelH = currentTemplate.dimensions?.height || 60;
    const duplicates = selected.map((el, idx) => {
      const nextX = Math.min(Math.max(2, el.x + 3), Math.max(2, labelW - el.width - 2));
      const nextY = Math.min(Math.max(2, el.y + 3), Math.max(2, labelH - el.height - 2));
      return {
        ...el,
        id: `el-dup-${Date.now()}-${idx}`,
        name: `${el.name} (Copy)`,
        x: nextX,
        y: nextY,
        zIndex: currentTemplate.elements.length + idx + 1,
      };
    });
    updateElements([...currentTemplate.elements, ...duplicates]);
    setSelectedElementIds(duplicates.map((d) => d.id));
    showToast(`Duplicated ${duplicates.length} element(s)`, 'success');
  };

  const handleDeleteSelected = () => {
    if (selectedElementIds.length === 0) {
      showToast('Click an element on the canvas to select it first', 'info');
      return;
    }
    const hasNonEditable = currentTemplate.elements.some(
      (el) => selectedElementIds.includes(el.id) && (el.isEditable === false || el.locked)
    );
    if (hasNonEditable) {
      showToast('Cannot delete non-editable / locked element(s). Set Editable: Yes first.', 'error');
      return;
    }
    const nextElements = currentTemplate.elements.filter((el) => !selectedElementIds.includes(el.id));
    updateElements(nextElements);
    setSelectedElementIds([]);
    showToast('Deleted selected element(s)', 'info');
  };

  const handleSelectAll = () => {
    setSelectedElementIds(currentTemplate.elements.map((el) => el.id));
  };

  const handleLockToggle = () => {
    if (selectedElementIds.length === 0) return;
    const nextElements = currentTemplate.elements.map((el) =>
      selectedElementIds.includes(el.id) ? { ...el, locked: !el.locked } : el
    );
    updateElements(nextElements);
  };

  const handleBringToFront = () => {
    if (selectedElementIds.length === 0) return;
    const maxZ = Math.max(...currentTemplate.elements.map((e) => e.zIndex), 0);
    const nextElements = currentTemplate.elements.map((el) =>
      selectedElementIds.includes(el.id) ? { ...el, zIndex: maxZ + 1 } : el
    );
    updateElements(nextElements);
  };

  const handleSendToBack = () => {
    if (selectedElementIds.length === 0) return;
    const nextElements = currentTemplate.elements.map((el) =>
      selectedElementIds.includes(el.id) ? { ...el, zIndex: 0 } : { ...el, zIndex: el.zIndex + 1 }
    );
    updateElements(nextElements);
  };

  // Alignments
  const handleAlign = (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    const selected = currentTemplate.elements.filter((el) => selectedElementIds.includes(el.id));
    if (selected.length <= 1) return;

    let updates: { id: string; updates: Partial<LabelElement> }[] = [];

    if (alignment === 'left') {
      const minX = Math.min(...selected.map((e) => e.x));
      updates = selected.map((e) => ({ id: e.id, updates: { x: minX } }));
    } else if (alignment === 'right') {
      const maxRight = Math.max(...selected.map((e) => e.x + e.width));
      updates = selected.map((e) => ({ id: e.id, updates: { x: maxRight - e.width } }));
    } else if (alignment === 'center') {
      const minX = Math.min(...selected.map((e) => e.x));
      const maxRight = Math.max(...selected.map((e) => e.x + e.width));
      const midX = (minX + maxRight) / 2;
      updates = selected.map((e) => ({ id: e.id, updates: { x: midX - e.width / 2 } }));
    } else if (alignment === 'top') {
      const minY = Math.min(...selected.map((e) => e.y));
      updates = selected.map((e) => ({ id: e.id, updates: { y: minY } }));
    } else if (alignment === 'bottom') {
      const maxBottom = Math.max(...selected.map((e) => e.y + e.height));
      updates = selected.map((e) => ({ id: e.id, updates: { y: maxBottom - e.height } }));
    } else if (alignment === 'middle') {
      const minY = Math.min(...selected.map((e) => e.y));
      const maxBottom = Math.max(...selected.map((e) => e.y + e.height));
      const midY = (minY + maxBottom) / 2;
      updates = selected.map((e) => ({ id: e.id, updates: { y: midY - e.height / 2 } }));
    }

    updateMultipleElements(updates);
  };

  const handleDistribute = (axis: 'horizontal' | 'vertical') => {
    const selected = currentTemplate.elements.filter((el) => selectedElementIds.includes(el.id));
    if (selected.length < 3) return;

    if (axis === 'horizontal') {
      const sorted = [...selected].sort((a, b) => a.x - b.x);
      const minX = sorted[0].x;
      const maxX = sorted[sorted.length - 1].x;
      const step = (maxX - minX) / (sorted.length - 1);
      const updates = sorted.map((el, i) => ({ id: el.id, updates: { x: minX + i * step } }));
      updateMultipleElements(updates);
    } else {
      const sorted = [...selected].sort((a, b) => a.y - b.y);
      const minY = sorted[0].y;
      const maxY = sorted[sorted.length - 1].y;
      const step = (maxY - minY) / (sorted.length - 1);
      const updates = sorted.map((el, i) => ({ id: el.id, updates: { y: minY + i * step } }));
      updateMultipleElements(updates);
    }
  };

  const handleRotate = (deltaDeg: number) => {
    const selected = currentTemplate.elements.filter((el) => selectedElementIds.includes(el.id));
    if (selected.length === 0) return;
    const updates = selected.map((el) => ({
      id: el.id,
      updates: { rotation: (el.rotation + deltaDeg + 360) % 360 },
    }));
    updateMultipleElements(updates);
  };

  const handleBringForward = () => {
    if (selectedElementIds.length === 0) return;
    const nextElements = currentTemplate.elements.map((el) =>
      selectedElementIds.includes(el.id) ? { ...el, zIndex: (el.zIndex || 0) + 1 } : el
    );
    updateElements(nextElements);
    showToast('Brought element(s) forward', 'info');
  };

  const handleSendBackward = () => {
    if (selectedElementIds.length === 0) return;
    const nextElements = currentTemplate.elements.map((el) =>
      selectedElementIds.includes(el.id) ? { ...el, zIndex: Math.max(0, (el.zIndex || 0) - 1) } : el
    );
    updateElements(nextElements);
    showToast('Sent element(s) backward', 'info');
  };

  const handleMakeSameWidth = () => {
    const selected = currentTemplate.elements.filter((el) => selectedElementIds.includes(el.id));
    if (selected.length <= 1) return;
    const targetWidth = selected[0].width;
    const updates = selected.slice(1).map((el) => ({ id: el.id, updates: { width: targetWidth } }));
    updateMultipleElements(updates);
    showToast(`Standardized width to ${targetWidth}mm`, 'info');
  };

  const handleMakeSameHeight = () => {
    const selected = currentTemplate.elements.filter((el) => selectedElementIds.includes(el.id));
    if (selected.length <= 1) return;
    const targetHeight = selected[0].height;
    const updates = selected.slice(1).map((el) => ({ id: el.id, updates: { height: targetHeight } }));
    updateMultipleElements(updates);
    showToast(`Standardized height to ${targetHeight}mm`, 'info');
  };

  const handleGroup = () => {
    if (selectedElementIds.length <= 1) {
      showToast('Select 2 or more elements to group', 'info');
      return;
    }
    const newGroupId = `grp-${Date.now()}`;
    const nextElements = currentTemplate.elements.map((el) =>
      selectedElementIds.includes(el.id) ? { ...el, groupId: newGroupId } : el
    );
    updateElements(nextElements);
    showToast(`Grouped ${selectedElementIds.length} elements (Group: ${newGroupId.slice(-6)})`, 'success');
  };

  const handleUngroup = () => {
    const selected = currentTemplate.elements.filter((el) => selectedElementIds.includes(el.id));
    const groupIdsToDissolve = new Set(selected.map((el) => el.groupId).filter(Boolean));
    if (groupIdsToDissolve.size === 0) {
      showToast('No grouped elements in selection', 'info');
      return;
    }
    const nextElements = currentTemplate.elements.map((el) =>
      el.groupId && groupIdsToDissolve.has(el.groupId) ? { ...el, groupId: undefined } : el
    );
    updateElements(nextElements);
    showToast(`Ungrouped ${groupIdsToDissolve.size} group(s)`, 'success');
  };

  // Export / Import Handlers
  const handleExportPDF = async () => {
    try {
      const record = currentTemplate.sampleRecords[viewport.previewRecordIndex] || {};
      const blob = await exportLabelsToPDF(currentTemplate, [record], 1);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentTemplate.name.replace(/\s+/g, '_')}_label.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Exported Vector PDF successfully', 'success');
      logAction('PRINT_JOB_DISPATCH', `Exported PDF for "${currentTemplate.name}"`);
    } catch (err: any) {
      showToast(`PDF Export failed: ${err.message}`, 'error');
    }
  };

  const handleExportJSON = () => {
    const jsonStr = JSON.stringify(currentTemplate, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentTemplate.name.replace(/\s+/g, '_')}.template.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Template JSON exported', 'success');
  };

  const handleZoomFit = useCallback(() => {
    const baseScale = 3.7795;
    const availW = Math.max(200, window.innerWidth - (showLeftDock ? 280 : 0) - (showRightDock ? 300 : 0) - 100);
    const availH = Math.max(200, window.innerHeight - 200);
    const baseW = currentTemplate.dimensions.width * baseScale;
    const baseH = currentTemplate.dimensions.height * baseScale;
    const zoomW = availW / baseW;
    const zoomH = availH / baseH;
    const targetZoom = Math.max(0.3, Math.min(2.5, Number(Math.min(zoomW, zoomH).toFixed(2))));
    const targetPanX = Math.max(20, Math.round((availW - baseW * targetZoom) / 2));
    const targetPanY = Math.max(20, Math.round((availH - baseH * targetZoom) / 2));

    setViewport((prev) => ({
      ...prev,
      zoom: targetZoom,
      panX: targetPanX,
      panY: targetPanY,
    }));
  }, [currentTemplate.dimensions.width, currentTemplate.dimensions.height, showLeftDock, showRightDock]);

  const handleImportJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const imported = JSON.parse(evt.target?.result as string) as LabelTemplate;
          if (imported.name && imported.dimensions && Array.isArray(imported.elements)) {
            imported.id = `tmpl-imported-${Date.now()}`;
            setTemplates((prev) => [imported, ...prev]);
            setCurrentTemplateId(imported.id);
            showToast(`Imported "${imported.name}" successfully`, 'success');
            logAction('CREATE_TEMPLATE', `Imported template JSON "${imported.name}"`);
          } else {
            showToast('Invalid template JSON format', 'error');
          }
        } catch {
          showToast('Failed to parse JSON file', 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleNewTemplate = () => {
    setIsNewDocWizardOpen(true);
  };

  // --- MULTI-DOCUMENT TAB HANDLERS ---
  const handleSelectTab = useCallback(
    (targetInstanceId: string) => {
      if (targetInstanceId === activeDocumentInstanceId) return;

      // 1. Save state of current active document
      setOpenDocuments((prev) =>
        prev.map((doc) => {
          if (doc.instanceId === activeDocumentInstanceId) {
            return {
              ...doc,
              selectedElementIds,
              history: { entries: history, index: historyIndex },
              viewState: { zoom: viewport.zoom, panX: viewport.panX, panY: viewport.panY },
              dataState: {
                currentRecordIndex: viewport.previewRecordIndex,
                selectedRecordIndices,
              },
            };
          }
          return doc;
        })
      );

      // 2. Find target doc and restore its isolated state
      const targetDoc = openDocuments.find((d) => d.instanceId === targetInstanceId);
      if (targetDoc) {
        setActiveDocumentInstanceId(targetInstanceId);
        if (targetDoc.documentId) {
          setCurrentTemplateId(targetDoc.documentId);
        }
        setSelectedElementIds(targetDoc.selectedElementIds || []);
        if (targetDoc.history && targetDoc.history.entries && targetDoc.history.entries.length > 0) {
          setHistory(targetDoc.history.entries);
          setHistoryIndex(targetDoc.history.index);
        } else if (targetDoc.template) {
          setHistory([targetDoc.template.elements || []]);
          setHistoryIndex(0);
        }
        if (targetDoc.viewState) {
          setViewport((prev) => ({
            ...prev,
            zoom: targetDoc.viewState.zoom,
            panX: targetDoc.viewState.panX,
            panY: targetDoc.viewState.panY,
            previewRecordIndex: targetDoc.dataState?.currentRecordIndex || 0,
          }));
        }
        if (targetDoc.dataState?.selectedRecordIndices) {
          setSelectedRecordIndices(targetDoc.dataState.selectedRecordIndices);
        }
      }
    },
    [activeDocumentInstanceId, openDocuments, selectedElementIds, history, historyIndex, viewport, selectedRecordIndices]
  );

  const handleNewTemplateTab = useCallback(() => {
    const templateDocs = openDocuments.filter((d) => d.type === 'template');
    const docNumber = templateDocs.length + 1;
    const name = `Template ${docNumber}`;
    const newTpl: LabelTemplate = {
      id: `tmpl-${Date.now()}`,
      name,
      description: 'Standard Label Template',
      category: 'Logistics',
      version: '1.0',
      status: 'draft',
      tags: ['Draft'],
      dimensions: { width: 100, height: 75, unit: 'mm', dpi: 300, orientation: 'landscape' },
      margins: { top: 2, right: 2, bottom: 2, left: 2, bleed: 1, safeZone: 2 },
      elements: [],
      variables: [],
      sampleRecords: [{}],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: currentUser.name,
    };

    const newDoc: OpenDocument = {
      instanceId: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      documentId: newTpl.id,
      type: 'template',
      name,
      isDirty: false,
      isNew: true,
      template: newTpl,
      selectedElementIds: [],
      history: { entries: [[]], index: 0 },
      viewState: { zoom: 1.25, panX: 40, panY: 40 },
      dataState: { currentRecordIndex: 0, selectedRecordIndices: [] },
    };

    setOpenDocuments((prev) => [...prev, newDoc]);
    setActiveDocumentInstanceId(newDoc.instanceId);
    setCurrentTemplateId(newTpl.id);
    setSelectedElementIds([]);
    setHistory([[]]);
    setHistoryIndex(0);
    setViewport((prev) => ({ ...prev, previewRecordIndex: 0 }));
    showToast(`Created new tab "${name}"`, 'success');
  }, [openDocuments, currentUser.name]);

  const handleNewFormTab = useCallback(() => {
    const formDocs = openDocuments.filter((d) => d.type === 'form');
    const docNumber = formDocs.length + 1;
    const name = `Form ${docNumber}`;

    const newDoc: OpenDocument = {
      instanceId: `doc-form-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      documentId: null,
      type: 'form',
      name,
      isDirty: false,
      isNew: true,
      form: {
        id: `form-${Date.now()}`,
        title: `${name} - Production Data Entry`,
        description: 'Operator data entry form for manual variables before label print.',
        controls: [
          {
            id: 'ctrl-1',
            type: 'text',
            label: 'Batch / Lot Number',
            boundField: 'BATCH_NO',
            placeholder: 'e.g. LOT-2026-X8',
            defaultValue: 'LOT-2026-X8',
            order: 0,
            colSpan: 1,
            validation: { required: true },
          },
          {
            id: 'ctrl-2',
            type: 'date',
            label: 'Manufacturing Date',
            boundField: 'MFG_DATE',
            defaultValue: new Date().toISOString().split('T')[0],
            order: 1,
            colSpan: 1,
          },
          {
            id: 'ctrl-3',
            type: 'number',
            label: 'Print Quantity (Copies)',
            boundField: 'COPIES',
            defaultValue: 1,
            order: 2,
            colSpan: 1,
            validation: { min: 1, max: 9999 },
          },
        ],
        showPreview: true,
        promptBeforePrint: true,
        autoSubmitOnScan: false,
        defaultCopies: 1,
      },
      selectedElementIds: [],
      history: { entries: [[]], index: 0 },
      viewState: { zoom: 1.0, panX: 0, panY: 0 },
    };

    setOpenDocuments((prev) => [...prev, newDoc]);
    setActiveDocumentInstanceId(newDoc.instanceId);
    showToast(`Created new form tab "${name}"`, 'success');
  }, [openDocuments]);

  const handlePerformCloseTab = useCallback(
    (instanceId: string) => {
      const idx = openDocuments.findIndex((d) => d.instanceId === instanceId);
      if (idx === -1) return;

      const remaining = openDocuments.filter((d) => d.instanceId !== instanceId);

      if (remaining.length === 0) {
        const freshTpl = INITIAL_TEMPLATES[0];
        const freshDoc: OpenDocument = {
          instanceId: `doc-${Date.now()}`,
          documentId: freshTpl.id,
          type: 'template',
          name: 'Template 1',
          isDirty: false,
          isNew: false,
          template: freshTpl,
          selectedElementIds: [],
          history: { entries: [freshTpl.elements || []], index: 0 },
          viewState: { zoom: 1.25, panX: 40, panY: 40 },
          dataState: { currentRecordIndex: 0, selectedRecordIndices: [] },
        };
        setOpenDocuments([freshDoc]);
        setActiveDocumentInstanceId(freshDoc.instanceId);
        setCurrentTemplateId(freshTpl.id);
        setSelectedElementIds([]);
        setHistory([freshTpl.elements || []]);
        setHistoryIndex(0);
        return;
      }

      setOpenDocuments(remaining);

      if (activeDocumentInstanceId === instanceId) {
        const nextActive = remaining[idx] || remaining[idx - 1] || remaining[0];
        if (nextActive) {
          setActiveDocumentInstanceId(nextActive.instanceId);
          if (nextActive.documentId) setCurrentTemplateId(nextActive.documentId);
          setSelectedElementIds(nextActive.selectedElementIds || []);
          if (nextActive.history?.entries?.length) {
            setHistory(nextActive.history.entries);
            setHistoryIndex(nextActive.history.index);
          } else if (nextActive.template) {
            setHistory([nextActive.template.elements || []]);
            setHistoryIndex(0);
          }
          if (nextActive.viewState) {
            setViewport((prev) => ({
              ...prev,
              zoom: nextActive.viewState.zoom,
              panX: nextActive.viewState.panX,
              panY: nextActive.viewState.panY,
              previewRecordIndex: nextActive.dataState?.currentRecordIndex || 0,
            }));
          }
        }
      }
    },
    [openDocuments, activeDocumentInstanceId]
  );

  const handleCloseTab = useCallback(
    (instanceId: string) => {
      const doc = openDocuments.find((d) => d.instanceId === instanceId);
      if (!doc) return;

      if (doc.isDirty) {
        setUnsavedDocModal({
          isOpen: true,
          instanceId,
          documentName: doc.name,
          action: 'close',
        });
      } else {
        handlePerformCloseTab(instanceId);
      }
    },
    [openDocuments, handlePerformCloseTab]
  );

  const handleSaveDocumentAs = useCallback(
    async (instanceId: string, customName?: string, description?: string) => {
      const orig = openDocuments.find((d) => d.instanceId === instanceId) || activeDocument;
      if (!orig) return;

      const origTpl = orig.template || currentTemplate;
      const defaultFileName = customName || orig.name || origTpl.name || 'ProductLabel';

      try {
        const dialogRes = await promptNativeSaveAsDialog(defaultFileName);
        if (!dialogRes || dialogRes.canceled || !dialogRes.filePath) {
          return; // User cancelled dialog
        }

        const targetFilePath = dialogRes.filePath;
        const targetFileName = dialogRes.fileName || targetFilePath.split(/[\\/]/).pop() || 'ProductLabel.bfl';
        const cleanName = targetFileName.replace(/\.[^.]+$/, '');

        const newId = orig.documentId || `tmpl-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        const updatedTemplate: LabelTemplate = {
          ...origTpl,
          id: newId,
          name: cleanName,
          description: description || origTpl.description || 'Standard Label Template',
          status: 'draft',
          tags: Array.from(new Set([...(origTpl.tags || []), 'Draft'])),
          updatedAt: new Date().toISOString(),
          createdBy: currentUser.name,
        };

        const targetDoc: OpenDocument = {
          ...orig,
          name: cleanName,
          filePath: targetFilePath,
          documentId: newId,
          template: updatedTemplate,
          isDirty: false,
          isNew: false,
        };

        // Perform atomic disk write
        const saveRes = await saveDocumentToDisk(targetFilePath, targetDoc);
        if (!saveRes.success) {
          showToast(`Save As failed: ${saveRes.error}`, 'error');
          return;
        }

        // Local cache & API backup
        try {
          await apiService.templates.save(updatedTemplate);
          const cached = JSON.parse(localStorage.getItem('barcodeflow_templates_cache') || '[]');
          const updatedCache = [updatedTemplate, ...cached.filter((c: any) => c.id !== updatedTemplate.id)];
          localStorage.setItem('barcodeflow_templates_cache', JSON.stringify(updatedCache.slice(0, 50)));
        } catch { }

        setTemplates((prev) => {
          const exists = prev.some((t) => t.id === updatedTemplate.id);
          return exists ? prev.map((t) => (t.id === updatedTemplate.id ? updatedTemplate : t)) : [updatedTemplate, ...prev];
        });
        setCurrentTemplateId(updatedTemplate.id);

        // Update active tab to point to the saved file
        setOpenDocuments((prev) =>
          prev.map((d) =>
            d.instanceId === orig.instanceId
              ? {
                  ...d,
                  name: cleanName,
                  filePath: targetFilePath,
                  documentId: updatedTemplate.id,
                  template: updatedTemplate,
                  isDirty: false,
                  isNew: false,
                }
              : d
          )
        );

        // Update Recent Documents list
        const updatedRecent = addRecentDocument(targetFilePath, targetFileName);
        setRecentDocuments(updatedRecent);

        setIsSaveAsModalOpen(false);
        showToast(`Saved: ${targetFileName}`, 'success');
        logAction('CREATE_TEMPLATE', `Saved document as "${targetFileName}" to ${targetFilePath}`);
      } catch (err: any) {
        console.error('Save As error:', err);
        showToast(`Save As failed: ${err?.message || 'File system error'}`, 'error');
      }
    },
    [openDocuments, activeDocument, currentTemplate, currentUser.name]
  );

  const handleSaveDocument = useCallback(
    async (instanceId: string) => {
      const doc = openDocuments.find((d) => d.instanceId === instanceId);
      if (!doc) return;

      if (doc.type === 'form') {
        setOpenDocuments((prev) =>
          prev.map((d) => (d.instanceId === instanceId ? { ...d, isDirty: false } : d))
        );
        showToast(`Form "${doc.name}" saved!`, 'success');
        return;
      }

      // If document has no file path, first-time save MUST open native Save As dialog
      if (!doc.filePath) {
        await handleSaveDocumentAs(instanceId);
        return;
      }

      const tpl = doc.template || currentTemplate;
      const savedTemplate: LabelTemplate = {
        ...tpl,
        id: doc.documentId || tpl.id || `tmpl-${Date.now()}`,
        name: doc.name || tpl.name || 'Untitled Label',
        status: tpl.status === 'published' || tpl.status === 'approved' ? tpl.status : 'draft',
        updatedAt: new Date().toISOString(),
        createdBy: tpl.createdBy || currentUser.name,
      };

      const targetDoc: OpenDocument = {
        ...doc,
        template: savedTemplate,
      };

      try {
        // Disk write to existing filePath directly
        const saveRes = await saveDocumentToDisk(doc.filePath, targetDoc);
        if (!saveRes.success) {
          showToast(`Save failed: ${saveRes.error}. Changes retained in memory.`, 'error');
          return;
        }

        try {
          await apiService.templates.save(savedTemplate);
          const cached = JSON.parse(localStorage.getItem('barcodeflow_templates_cache') || '[]');
          const updatedCache = [savedTemplate, ...cached.filter((c: any) => c.id !== savedTemplate.id)];
          localStorage.setItem('barcodeflow_templates_cache', JSON.stringify(updatedCache.slice(0, 50)));
        } catch { }

        // Reset dirty state ONLY after successful disk write
        setOpenDocuments((prev) =>
          prev.map((d) =>
            d.instanceId === instanceId
              ? { ...d, isDirty: false, isNew: false, template: savedTemplate, documentId: savedTemplate.id, name: savedTemplate.name }
              : d
          )
        );

        setTemplates((prev) => {
          const exists = prev.some((t) => t.id === savedTemplate.id);
          if (exists) {
            return prev.map((t) => (t.id === savedTemplate.id ? savedTemplate : t));
          }
          return [savedTemplate, ...prev];
        });

        const updatedRecent = addRecentDocument(doc.filePath, saveRes.fileName || doc.name);
        setRecentDocuments(updatedRecent);

        showToast(`Saved: ${saveRes.fileName || doc.name}`, 'success');
        logAction('EDIT_TEMPLATE', `Saved document "${doc.name}" to ${doc.filePath}`);
      } catch (err: any) {
        console.error('Failed to save document:', err);
        showToast(`Save failed: ${err?.message || 'File system error'}. Changes retained in memory.`, 'error');
      }
    },
    [openDocuments, currentTemplate, currentUser.name, handleSaveDocumentAs]
  );

  const handleSaveTemplate = async () => {
    if (activeDocumentInstanceId) {
      await handleSaveDocument(activeDocumentInstanceId);
    }
  };

  const handleSaveAllDocuments = useCallback(async () => {
    const dirtyDocs = openDocuments.filter((d) => d.isDirty);
    if (dirtyDocs.length === 0) {
      showToast('All open documents are already saved.', 'info');
      return;
    }

    const successfulInstanceIds: string[] = [];
    const failedNames: string[] = [];

    for (const doc of dirtyDocs) {
      if (doc.type === 'template') {
        if (!doc.filePath) {
          // Unsaved new document -> prompt Save As dialog
          try {
            await handleSaveDocumentAs(doc.instanceId);
            successfulInstanceIds.push(doc.instanceId);
          } catch {
            failedNames.push(doc.name);
          }
        } else {
          // Direct disk save to existing file path
          const tpl = doc.template || currentTemplate;
          const savedTemplate: LabelTemplate = {
            ...tpl,
            id: doc.documentId || tpl.id || `tmpl-${Date.now()}`,
            name: doc.name || tpl.name || 'Untitled Label',
            updatedAt: new Date().toISOString(),
            createdBy: tpl.createdBy || currentUser.name,
          };
          const saveRes = await saveDocumentToDisk(doc.filePath, { ...doc, template: savedTemplate });
          if (saveRes.success) {
            successfulInstanceIds.push(doc.instanceId);
            try {
              await apiService.templates.save(savedTemplate);
            } catch { }
            addRecentDocument(doc.filePath, saveRes.fileName || doc.name);
          } else {
            failedNames.push(doc.name);
          }
        }
      } else {
        successfulInstanceIds.push(doc.instanceId);
      }
    }

    // Only clear dirty state for documents that succeeded
    setOpenDocuments((prev) =>
      prev.map((d) => (successfulInstanceIds.includes(d.instanceId) ? { ...d, isDirty: false, isNew: false } : d))
    );
    setRecentDocuments(getRecentDocuments());

    if (failedNames.length === 0) {
      showToast(`Successfully saved all ${successfulInstanceIds.length} modified document(s)!`, 'success');
      logAction('SYSTEM_CONFIG', `Saved all ${successfulInstanceIds.length} dirty open documents`);
    } else {
      showToast(`Saved ${successfulInstanceIds.length} document(s). Failed: ${failedNames.join(', ')}`, 'error');
    }
  }, [openDocuments, currentTemplate, currentUser.name, handleSaveDocumentAs]);

  const handleOpenDocumentFile = useCallback(async () => {
    try {
      const openRes = await promptNativeOpenDialog();
      if (!openRes || openRes.canceled || !openRes.filePath) {
        return; // User cancelled
      }

      const filePath = openRes.filePath;
      const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');

      // Check if file is already open in one of the active tabs
      const existingDoc = openDocuments.find(
        (d) => d.filePath && d.filePath.toLowerCase().replace(/\\/g, '/') === normalizedPath
      );

      if (existingDoc) {
        setActiveDocumentInstanceId(existingDoc.instanceId);
        if (existingDoc.documentId) setCurrentTemplateId(existingDoc.documentId);
        showToast(`Activated already open document: ${existingDoc.name}`, 'info');
        return;
      }

      // Read file from disk
      const readRes = await readDocumentFromDisk(filePath);
      if (!readRes.success || !readRes.content) {
        showToast(`Failed to open document: ${readRes.error}`, 'error');
        return;
      }

      // Deserialize .bfl or JSON into BarcodeFlow document
      const docFile = deserializeBarcodeFlowDocument(readRes.content, filePath);
      const loadedTemplate = docFile.template || INITIAL_TEMPLATES[0];

      const newDoc: OpenDocument = {
        instanceId: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        documentId: loadedTemplate.id,
        type: 'template',
        filePath: filePath,
        name: docFile.name || loadedTemplate.name || 'ProductLabel',
        isDirty: false,
        isNew: false,
        template: loadedTemplate,
        selectedElementIds: [],
        history: { entries: [loadedTemplate.elements || []], index: 0 },
        viewState: { zoom: 1.25, panX: 40, panY: 40 },
        dataState: {
          currentRecordIndex: 0,
          selectedRecordIndices: [],
        },
      };

      setTemplates((prev) => {
        const exists = prev.some((t) => t.id === loadedTemplate.id);
        return exists ? prev.map((t) => (t.id === loadedTemplate.id ? loadedTemplate : t)) : [loadedTemplate, ...prev];
      });

      setOpenDocuments((prev) => [...prev, newDoc]);
      setActiveDocumentInstanceId(newDoc.instanceId);
      setCurrentTemplateId(loadedTemplate.id);
      setSelectedElementIds([]);
      setHistory([loadedTemplate.elements || []]);
      setHistoryIndex(0);
      setViewport((prev) => ({ ...prev, previewRecordIndex: 0 }));

      // Add to Recent Documents list
      const updatedRecent = addRecentDocument(filePath, docFile.name || loadedTemplate.name);
      setRecentDocuments(updatedRecent);

      showToast(`Opened: ${docFile.name || loadedTemplate.name}`, 'success');
      logAction('CREATE_TEMPLATE', `Opened document from disk: ${filePath}`);
    } catch (err: any) {
      console.error('Open document error:', err);
      showToast(`Failed to open document: ${err?.message || 'File read error'}`, 'error');
    }
  }, [openDocuments]);

  const handleOpenRecentDocument = useCallback(
    async (filePath: string) => {
      try {
        const fileCheck = await checkFileExistsOnDisk(filePath);
        if (!fileCheck) {
          showToast(`File not found: ${filePath}. Removed from Recent list.`, 'error');
          const updated = removeRecentDocument(filePath);
          setRecentDocuments(updated);
          return;
        }

        const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');
        const existingDoc = openDocuments.find(
          (d) => d.filePath && d.filePath.toLowerCase().replace(/\\/g, '/') === normalizedPath
        );

        if (existingDoc) {
          setActiveDocumentInstanceId(existingDoc.instanceId);
          if (existingDoc.documentId) setCurrentTemplateId(existingDoc.documentId);
          showToast(`Activated open document: ${existingDoc.name}`, 'info');
          return;
        }

        const readRes = await readDocumentFromDisk(filePath);
        if (!readRes.success || !readRes.content) {
          showToast(`Failed to open recent document: ${readRes.error}`, 'error');
          return;
        }

        const docFile = deserializeBarcodeFlowDocument(readRes.content, filePath);
        const loadedTemplate = docFile.template || INITIAL_TEMPLATES[0];

        const newDoc: OpenDocument = {
          instanceId: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          documentId: loadedTemplate.id,
          type: 'template',
          filePath: filePath,
          name: docFile.name || loadedTemplate.name || 'ProductLabel',
          isDirty: false,
          isNew: false,
          template: loadedTemplate,
          selectedElementIds: [],
          history: { entries: [loadedTemplate.elements || []], index: 0 },
          viewState: { zoom: 1.25, panX: 40, panY: 40 },
          dataState: {
            currentRecordIndex: 0,
            selectedRecordIndices: [],
          },
        };

        setTemplates((prev) => {
          const exists = prev.some((t) => t.id === loadedTemplate.id);
          return exists ? prev.map((t) => (t.id === loadedTemplate.id ? loadedTemplate : t)) : [loadedTemplate, ...prev];
        });

        setOpenDocuments((prev) => [...prev, newDoc]);
        setActiveDocumentInstanceId(newDoc.instanceId);
        setCurrentTemplateId(loadedTemplate.id);
        setSelectedElementIds([]);
        setHistory([loadedTemplate.elements || []]);
        setHistoryIndex(0);
        setViewport((prev) => ({ ...prev, previewRecordIndex: 0 }));

        const updatedRecent = addRecentDocument(filePath, docFile.name || loadedTemplate.name);
        setRecentDocuments(updatedRecent);

        showToast(`Opened: ${docFile.name || loadedTemplate.name}`, 'success');
        logAction('CREATE_TEMPLATE', `Opened recent document: ${filePath}`);
      } catch (err: any) {
        console.error('Open recent document error:', err);
        showToast(`Failed to open recent file: ${err?.message || 'Read error'}`, 'error');
      }
    },
    [openDocuments]
  );

  const handleClearRecentDocuments = useCallback(() => {
    clearRecentDocuments();
    setRecentDocuments([]);
    showToast('Recent documents list cleared', 'info');
  }, []);

  const handleCloseAllDocuments = useCallback(() => {
    const dirtyDocs = openDocuments.filter((d) => d.isDirty);
    if (dirtyDocs.length > 0) {
      setUnsavedDocModal({
        isOpen: true,
        instanceId: dirtyDocs[0].instanceId,
        documentName: dirtyDocs[0].name,
        action: 'closeAll',
      });
      return;
    }

    // All clean -> create fresh clean document
    const freshTpl: LabelTemplate = {
      id: `tmpl-${Date.now()}`,
      name: 'Template 1',
      description: 'Standard Label Template',
      category: 'Logistics',
      version: '1.0',
      status: 'draft',
      tags: ['Draft'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: currentUser.name,
      dimensions: { width: 100, height: 75, unit: 'mm', dpi: 300, orientation: 'landscape' },
      margins: { top: 2, right: 2, bottom: 2, left: 2, bleed: 1, safeZone: 2 },
      elements: [],
      variables: [],
      sampleRecords: [{}],
    };

    const freshDoc: OpenDocument = {
      instanceId: `doc-${Date.now()}`,
      documentId: freshTpl.id,
      type: 'template',
      name: 'Template 1',
      isDirty: false,
      isNew: false,
      template: freshTpl,
      selectedElementIds: [],
      history: { entries: [[]], index: 0 },
      viewState: { zoom: 1.25, panX: 40, panY: 40 },
      dataState: { currentRecordIndex: 0, selectedRecordIndices: [] },
    };

    setOpenDocuments([freshDoc]);
    setActiveDocumentInstanceId(freshDoc.instanceId);
    setCurrentTemplateId(freshTpl.id);
    setSelectedElementIds([]);
    setHistory([[]]);
    setHistoryIndex(0);
    showToast('Closed all documents', 'info');
  }, [openDocuments, currentUser.name]);

  const handleDuplicateDocument = useCallback(
    (instanceId: string) => {
      const orig = openDocuments.find((d) => d.instanceId === instanceId);
      if (!orig) return;

      if (orig.type === 'template' && orig.template) {
        const copyTpl: LabelTemplate = {
          ...orig.template,
          id: `tmpl-${Date.now()}`,
          name: `${orig.name} (Copy)`,
          status: 'draft',
          tags: Array.from(new Set([...(orig.template.tags || []), 'Draft'])),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const copyDoc: OpenDocument = {
          instanceId: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          documentId: copyTpl.id,
          type: 'template',
          name: `${orig.name} (Copy)`,
          isDirty: true,
          isNew: true,
          template: copyTpl,
          selectedElementIds: [],
          history: { entries: [copyTpl.elements || []], index: 0 },
          viewState: { ...orig.viewState },
          dataState: { ...orig.dataState, currentRecordIndex: 0, selectedRecordIndices: [] },
        };
        setOpenDocuments((prev) => [...prev, copyDoc]);
        setActiveDocumentInstanceId(copyDoc.instanceId);
        showToast(`Duplicated tab "${copyDoc.name}"`, 'success');
      }
    },
    [openDocuments]
  );

  const handleCloseOthers = useCallback(
    (instanceId: string) => {
      const target = openDocuments.find((d) => d.instanceId === instanceId);
      if (!target) return;
      setOpenDocuments([target]);
      setActiveDocumentInstanceId(target.instanceId);
      showToast(`Closed all other tabs except "${target.name}"`, 'info');
    },
    [openDocuments]
  );

  const handleCloseAll = useCallback(() => {
    handleCloseAllDocuments();
  }, [handleCloseAllDocuments]);

  const handleDuplicateTemplate = async (id: string) => {
    try {
      const cloned = await apiService.templates.duplicate(id);
      setTemplates((prev) => [cloned, ...prev]);
      showToast(`Cloned template "${cloned.name}" via API`, 'success');
      logAction('CREATE_TEMPLATE', `Cloned template "${cloned.name}"`);
    } catch {
      const original = templates.find((t) => t.id === id);
      if (original) {
        const copy: LabelTemplate = {
          ...original,
          id: `tmpl-${Date.now()}`,
          name: `${original.name} (Copy)`,
          status: 'draft',
          tags: Array.from(new Set([...(original.tags || []), 'Draft'])),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setTemplates((prev) => [copy, ...prev]);
        showToast(`Cloned template "${copy.name}"`, 'success');
      }
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    const target = templates.find((t) => t.id === id);
    if (!target) return;
    if (!confirm(`Are you sure you want to delete template "${target.name}"?`)) return;

    setTemplates((prev) => prev.filter((t) => t.id !== id));
    if (currentTemplateId === id) {
      const remaining = templates.filter((t) => t.id !== id);
      if (remaining.length > 0) setCurrentTemplateId(remaining[0].id);
    }
    showToast(`Deleted template "${target.name}"`, 'info');
    logAction('EDIT_TEMPLATE', `Deleted template "${target.name}"`);

    try {
      await apiService.templates.delete(id);
    } catch (err) {
      console.warn('API error deleting template:', err);
    }
  };

  const handleExitApp = useCallback(() => {
    const dirtyDocs = openDocuments.filter((d) => d.isDirty);
    if (dirtyDocs.length > 0) {
      setUnsavedDocModal({
        isOpen: true,
        instanceId: dirtyDocs[0].instanceId,
        documentName: dirtyDocs[0].name,
        action: 'closeAll',
      });
      return;
    }
    exitDesktopApplication();
  }, [openDocuments]);

  // Keyboard Shortcuts Listener (Strictly for Designer View)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when user is actively inside the Template Designer Studio
      if (activeView !== 'designer') {
        return;
      }

      const target = e.target as HTMLElement | null;
      const isInputFocused =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          target.getAttribute('contenteditable') === 'true');

      // 1. GLOBAL SHORTCUTS (Active even when input/form has focus)
      if (e.ctrlKey || e.metaKey) {
        // Ctrl + S -> Save Active Document
        if (!e.shiftKey && (e.key === 's' || e.key === 'S')) {
          e.preventDefault();
          if (activeDocumentInstanceId) {
            handleSaveDocument(activeDocumentInstanceId);
          }
          return;
        }

        // Ctrl + Shift + S -> Native Save As
        if (e.shiftKey && (e.key === 's' || e.key === 'S')) {
          e.preventDefault();
          if (activeDocumentInstanceId) {
            handleSaveDocumentAs(activeDocumentInstanceId);
          }
          return;
        }

        // Ctrl + P -> Open Print Center
        if (e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          setIsPrintDialogOpen(true);
          return;
        }

        // Ctrl + N -> New Document Wizard
        if (!isInputFocused && (e.key === 'n' || e.key === 'N')) {
          e.preventDefault();
          setIsNewDocWizardOpen(true);
          return;
        }

        // Ctrl + O -> Open Native BarcodeFlow Document
        if (!isInputFocused && (e.key === 'o' || e.key === 'O')) {
          e.preventDefault();
          handleOpenDocumentFile();
          return;
        }

        // Ctrl + W / Ctrl + F4 -> Close Active Tab
        if (e.key === 'w' || e.key === 'W' || e.key === 'F4') {
          e.preventDefault();
          if (activeDocumentInstanceId) {
            handleCloseTab(activeDocumentInstanceId);
          }
          return;
        }

        // Ctrl + Tab / Ctrl + Shift + Tab -> Tab Navigation
        if (e.key === 'Tab') {
          e.preventDefault();
          if (openDocuments.length > 1) {
            const curIdx = openDocuments.findIndex((d) => d.instanceId === activeDocumentInstanceId);
            if (e.shiftKey) {
              const prevIdx = curIdx > 0 ? curIdx - 1 : openDocuments.length - 1;
              handleSelectTab(openDocuments[prevIdx].instanceId);
            } else {
              const nextIdx = (curIdx + 1) % openDocuments.length;
              handleSelectTab(openDocuments[nextIdx].instanceId);
            }
          }
          return;
        }

        // If inside text input, allow native text clipboard / undo / selection
        if (isInputFocused) {
          return;
        }

        // Ctrl + Z / Ctrl + Shift + Z / Ctrl + Y -> Undo / Redo
        if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault();
          if (e.shiftKey) handleRedo();
          else handleUndo();
          return;
        } else if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          handleRedo();
          return;
        } else if (e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          handleCopy();
          return;
        } else if (e.key === 'x' || e.key === 'X') {
          e.preventDefault();
          handleCut();
          return;
        } else if (e.key === 'v' || e.key === 'V') {
          e.preventDefault();
          handlePaste();
          return;
        } else if (e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          handleDuplicateSelected();
          return;
        } else if (e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          handleSelectAll();
          return;
        } else if (e.key === 'e' || e.key === 'E') {
          e.preventDefault();
          setIsZplExportOpen(true);
          return;
        } else if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          setViewport((prev) => ({ ...prev, zoom: Math.min(prev.zoom + 0.25, 4.0) }));
          return;
        } else if (e.key === '-') {
          e.preventDefault();
          setViewport((prev) => ({ ...prev, zoom: Math.max(prev.zoom - 0.25, 0.25) }));
          return;
        } else if (e.key === '0') {
          e.preventDefault();
          handleZoomFit();
          return;
        } else if (e.key === 'Home') {
          e.preventDefault();
          setViewport((prev) => ({ ...prev, previewRecordIndex: 0 }));
          return;
        } else if (e.key === 'End') {
          e.preventDefault();
          setViewport((prev) => ({ ...prev, previewRecordIndex: 99999999 }));
          return;
        } else if (e.key === 'PageUp') {
          e.preventDefault();
          setViewport((prev) => ({ ...prev, previewRecordIndex: Math.max(0, prev.previewRecordIndex - 1) }));
          return;
        } else if (e.key === 'PageDown') {
          e.preventDefault();
          setViewport((prev) => ({ ...prev, previewRecordIndex: prev.previewRecordIndex + 1 }));
          return;
        }
      } else {
        // Non-Ctrl shortcuts

        // Escape key: if modal open, do not interfere; if on canvas, clear selection & reset tool
        if (e.key === 'Escape') {
          if (!isInputFocused) {
            setSelectedElementIds([]);
            setActiveTool('select');
          }
          return;
        }

        // If typing in input, ignore all canvas hotkeys
        if (isInputFocused) {
          return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault(); // Crucial: Prevent browser history back navigation
          handleDeleteSelected();
        } else if (e.key === 'v' || e.key === 'V') {
          setActiveTool('select');
        } else if (e.key === 't' || e.key === 'T') {
          handleInsertText();
        } else if (e.key === 'b' || e.key === 'B') {
          handleInsertBarcode('code128');
        } else if (e.key === 'q' || e.key === 'Q') {
          handleInsertQR();
        } else if (e.key === 'm' || e.key === 'M') {
          handleInsertDataMatrix();
        } else if (e.key === 'r' || e.key === 'R') {
          handleInsertShape('rectangle');
        } else if (e.key === 'c' || e.key === 'C') {
          handleInsertShape('circle');
        } else if (e.key === 'l' || e.key === 'L') {
          handleInsertShape('line');
        } else if (e.key === 'g' || e.key === 'G') {
          setIsGs1WizardOpen(true);
        } else if (e.key === 'F12') {
          e.preventDefault();
          setIsBarcodePropertiesOpen(true);
        } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          if (selectedElementIds.length > 0) {
            e.preventDefault();
            // Controlled, fine movement (0.2mm default, 1mm with Shift, 0.05mm with Alt)
            const step = e.shiftKey ? 1.0 : e.altKey ? 0.05 : 0.2;
            const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
            const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
            const updates = selectedElementIds
              .filter((id) => {
                const el = currentTemplate.elements.find((item) => item.id === id);
                return el && el.isEditable !== false && !el.locked;
              })
              .map((id) => {
                const el = currentTemplate.elements.find((item) => item.id === id)!;
                const maxX = Math.max(0, currentTemplate.dimensions.width - el.width);
                const maxY = Math.max(0, currentTemplate.dimensions.height - el.height);
                const nextX = Math.min(maxX, Math.max(0, Number(((el.x || 0) + dx).toFixed(2))));
                const nextY = Math.min(maxY, Math.max(0, Number(((el.y || 0) + dy).toFixed(2))));
                return { id, updates: { x: nextX, y: nextY } };
              });
            if (updates.length > 0) {
              updateMultipleElements(updates);
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeView,
    activeDocumentInstanceId,
    openDocuments,
    selectedElementIds,
    currentTemplate,
    handleSaveDocument,
    handleSaveAllDocuments,
    handleSelectTab,
    handleCloseTab,
    handleUndo,
    handleRedo,
    handleCopy,
    handleCut,
    handlePaste,
    handleDuplicateSelected,
    handleDeleteSelected,
    handleSelectAll,
    handleZoomFit,
    handleOpenDocumentFile,
    handleSaveDocumentAs,
    updateMultipleElements,
  ]);

  // Active dataset records (prioritize linked Excel database records over static samples)
  const boundDatasetId = currentTemplate?.elements
    ?.flatMap((e) => e.dataSources || [])
    ?.find((ds) => (ds.type === 'database' || (ds as any).type === 'database-field') && ds.datasetId)?.datasetId;
  const boundDataset = boundDatasetId ? datasets.find((d) => d.id === boundDatasetId) : null;

  const rawActiveRecords: Record<string, any>[] = useMemo(() => {
    if (currentTemplate?.databaseConnection?.records && currentTemplate.databaseConnection.records.length > 0) {
      return currentTemplate.databaseConnection.records;
    }
    if (boundDataset?.records && boundDataset.records.length > 0) {
      return boundDataset.records;
    }
    if (currentTemplate?.sampleRecords && currentTemplate.sampleRecords.length > 0) {
      return currentTemplate.sampleRecords;
    }
    return [];
  }, [currentTemplate?.databaseConnection?.records, boundDataset?.records, currentTemplate?.sampleRecords]);

  // Section 10.15, 10.16, 10.23: Visible record set with preserved source identity
  const visibleRecordSet = useMemo(() => {
    const headerRow = currentTemplate?.databaseConnection?.headerRow || 1;
    const indexed = rawActiveRecords.map((rec, i) => ({
      data: rec,
      sourceRecordIndex: i,
      sourceRowNumber: i + headerRow + 1,
      displayedRecordNumber: i + 1,
    }));

    if (!recordSearchFilter.trim()) {
      return indexed;
    }

    const q = recordSearchFilter.trim().toLowerCase();
    const filtered = indexed.filter((item) =>
      Object.values(item.data).some((val) => String(val ?? '').toLowerCase().includes(q))
    );

    return filtered.map((item, idx) => ({
      ...item,
      displayedRecordNumber: idx + 1,
    }));
  }, [rawActiveRecords, recordSearchFilter, currentTemplate?.databaseConnection?.headerRow]);

  const totalVisibleRecords = visibleRecordSet.length;

  // Clamped safe preview index
  const safePreviewIndex = totalVisibleRecords === 0
    ? 0
    : Math.min(Math.max(0, viewport.previewRecordIndex), totalVisibleRecords - 1);

  // Sync back if preview index exceeds total
  useEffect(() => {
    if (totalVisibleRecords > 0 && viewport.previewRecordIndex >= totalVisibleRecords) {
      setViewport((v) => ({ ...v, previewRecordIndex: totalVisibleRecords - 1 }));
    }
  }, [totalVisibleRecords, viewport.previewRecordIndex]);

  const activeRecordMeta = visibleRecordSet[safePreviewIndex] || null;
  const currentRecordData = activeRecordMeta ? activeRecordMeta.data : (rawActiveRecords[0] || {});
  const activeDatasetRecords = visibleRecordSet.length > 0 ? visibleRecordSet.map((r) => r.data) : [{}];

  // Section 10.20, 10.21, 10.22: Refresh Data Source Records
  const handleRefreshActiveDataset = useCallback(async () => {
    const conn = currentTemplate.databaseConnection;
    if (!conn) {
      showToast('No active database connection to refresh.', 'info');
      return;
    }

    setIsRefreshingRecords(true);
    try {
      let refreshedRecords: any[] = [];
      const electronAPI = (window as any).electronAPI;

      if (electronAPI?.readExcelWorkbook && conn.filePath) {
        const wb = await electronAPI.readExcelWorkbook(conn.filePath, conn.headerRow || 1);
        const targetSheet = conn.sheetName || wb.sheets?.[0]?.name || Object.keys(wb.sheets || {})[0];
        if (targetSheet) {
          const sheetInfo = wb.sheets.find((s: any) => s.name === targetSheet);
          refreshedRecords = sheetInfo?.previewRows || [];
        }
      } else if (conn.id) {
        const res = await apiService.datasets.refresh(conn.id);
        if (res?.dataset?.records) {
          refreshedRecords = res.dataset.records;
        }
      }

      if (refreshedRecords.length > 0) {
        const newTotal = refreshedRecords.length;
        // Section 10.21: If record still exists, remain on it; if new total is smaller, safely clamp
        const nextIndex = Math.min(viewport.previewRecordIndex, newTotal - 1);
        updateTemplate({
          databaseConnection: {
            ...conn,
            records: refreshedRecords,
          },
          sampleRecords: refreshedRecords,
        });
        setViewport((v) => ({ ...v, previewRecordIndex: Math.max(0, nextIndex) }));
        await refreshDatasets();
        showToast(`Refreshed ${newTotal} records from data source!`, 'success');
        logAction('IMPORT_DATA', `Refreshed ${newTotal} records from ${conn.name}`);
      } else {
        showToast('Dataset refreshed (0 records found).', 'info');
      }
    } catch (err: any) {
      console.warn('Refresh error:', err);
      showToast(`Refresh failed: ${err.message || err}`, 'error');
    } finally {
      setIsRefreshingRecords(false);
    }
  }, [currentTemplate.databaseConnection, viewport.previewRecordIndex, updateTemplate, refreshDatasets]);

  const handleConnectDatasetToTemplate = useCallback(
    (dataset: any) => {
      if (!dataset) return;
      const cols: string[] =
        dataset.columns ||
        (dataset.fields ? dataset.fields.map((f: any) => (typeof f === 'string' ? f : f.name)) : []);
      const conn: DatabaseConnectionConfig = {
        id: dataset.id,
        name: dataset.name,
        type: dataset.sourceType === 'excel' ? 'excel' : dataset.sourceType === 'csv' ? 'csv' : 'sample',
        filePath: dataset.filePath,
        sheetName: dataset.sheetName,
        availableSheets: dataset.availableSheets,
        headerRow: dataset.headerRow || 1,
        fields: cols,
        records: dataset.records || [],
        status: (dataset.status as any) || 'READY',
        mode: dataset.mode === 'link' ? 'linked' : 'imported',
      };
      updateTemplate({
        databaseConnection: conn,
        sampleRecords: dataset.records || [],
      });
      setViewport((p) => ({ ...p, previewRecordIndex: 0 }));
      showToast(`Connected dataset "${dataset.name}" (${(dataset.records || []).length} records) to template!`, 'success');
    },
    [updateTemplate]
  );

  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    try {
      localStorage.setItem('barcodeflow_auth_session', JSON.stringify({ authenticated: true, user }));
    } catch { }

    const isSuper = user.role === 'Super Admin' || user.email?.toLowerCase() === 'superadmin@gmail.com';
    if (isSuper) {
      setActiveView('super-admin');
      showToast(`Welcome Super Administrator! Governance & Security Control Center loaded.`, 'success');
    } else {
      // Seed fresh personalized starter templates for newly registered/logged-in admin
      if (user.email?.toLowerCase() !== 'shivam@gmail.com') {
        const personalTemplates = getUserPersonalizedTemplates(user);
        setTemplates((prev) => {
          const userAlreadyHas = prev.some(
            (t) =>
              t.authorEmail?.toLowerCase() === user.email?.toLowerCase() ||
              (t.createdBy === user.name && !t.createdBy.includes('System'))
          );
          if (userAlreadyHas) return prev;
          return [...personalTemplates, ...prev];
        });
        if (personalTemplates.length > 0) {
          setCurrentTemplateId(personalTemplates[0].id);
        }
      }
      setActiveView('dashboard');
      showToast(`Welcome ${user.name}! BarcodeFlow Label Management portal loaded with your personalized workspace.`, 'success');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setActiveView('dashboard');
    try {
      localStorage.removeItem('barcodeflow_auth_session');
    } catch { }
    showToast('Signed out successfully. Please log in to continue.', 'info');
  };

  // If not authenticated, render the dedicated LoginView
  if (!isAuthenticated) {
    return (
      <ErrorBoundary fallbackTitle="Authentication Screen Error">
        {notification && (
          <div
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-xl text-xs font-semibold flex items-center gap-2 transition-all animate-in fade-in slide-in-from-top-2 ${notification.type === 'error'
                ? 'bg-red-600 text-white'
                : notification.type === 'info'
                  ? 'bg-blue-600 text-white'
                  : 'bg-emerald-600 text-white'
              }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{notification.message}</span>
          </div>
        )}
        <LoginView onLoginSuccess={handleLoginSuccess} initialUsers={INITIAL_USERS} />
      </ErrorBoundary>
    );
  }

  // If activeView is 'dashboard', render the dedicated BarcodeFlow Portal layout
  if (activeView === 'dashboard') {
    return (
      <ErrorBoundary fallbackTitle="Dashboard Workspace Error">
        {notification && (
          <div
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-xl text-xs font-semibold flex items-center gap-2 transition-all animate-in fade-in slide-in-from-top-2 ${notification.type === 'error'
                ? 'bg-red-600 text-white'
                : notification.type === 'info'
                  ? 'bg-blue-600 text-white'
                  : 'bg-emerald-600 text-white'
              }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{notification.message}</span>
          </div>
        )}
        <DashboardView
          templates={templates}
          printers={printers}
          printJobs={printJobs}
          auditLogs={auditLogs}
          currentUser={currentUser}
          allUsers={INITIAL_USERS}
          onOpenTemplate={(id) => {
            if (!hasFeaturePermission(currentUser, 'canDesignTemplates')) {
              showToast('Permission Denied: Super Admin has restricted your access to Template Studio.', 'error');
              return;
            }
            setCurrentTemplateId(id);
            setActiveView('designer');
            showToast('Template loaded in Barcode Automation Studio', 'success');
          }}
          onOpenDesigner={() => {
            if (!hasFeaturePermission(currentUser, 'canDesignTemplates')) {
              showToast('Permission Denied: Super Admin has restricted your access to Template Studio.', 'error');
              return;
            }
            setActiveView('designer');
            showToast('Barcode Automation Studio (Template Builder) loaded', 'success');
          }}
          onOpenPrintCenter={() => {
            if (!hasFeaturePermission(currentUser, 'canPrintAndSpool')) {
              showToast('Permission Denied: Super Admin has restricted your access to Print Center.', 'error');
              return;
            }
            setIsPrintDialogOpen(true);
          }}
          onOpenAuditLogs={() => {
            if (!hasFeaturePermission(currentUser, 'canViewAuditLogs')) {
              showToast('Permission Denied: Super Admin has restricted your access to Audit Logs.', 'error');
              return;
            }
            setIsAuditLogsOpen(true);
          }}
          onNavigateToWorkflow={() => {
            if (!hasFeaturePermission(currentUser, 'canApproveWorkflow')) {
              showToast('Permission Denied: Super Admin has restricted your access to Approval Workflow.', 'error');
              return;
            }
            setActiveView('workflow');
          }}
          onNavigateToViewer={() => {
            if (!hasFeaturePermission(currentUser, 'canPrintAndSpool')) {
              showToast('Permission Denied: Super Admin has restricted your access to Viewer Station.', 'error');
              return;
            }
            setActiveView('viewer');
          }}
          onNavigateToSuperAdmin={() => setActiveView('super-admin')}
          onNavigateToDatasets={() => {
            if (!hasFeaturePermission(currentUser, 'canManageDatasets')) {
              showToast('Permission Denied: Super Admin has restricted your access to Dataset Manager.', 'error');
              return;
            }
            setSettingsInitialTab('datasets');
            setIsSettingsOpen(true);
          }}
          onNavigateToLicense={() => {
            if (!hasFeaturePermission(currentUser, 'canManageLicense')) {
              showToast('Permission Denied: Super Admin has restricted your access to Licensing.', 'error');
              return;
            }
            setSettingsInitialTab('license');
            setIsSettingsOpen(true);
          }}
          onNavigateToSoftwareDownload={() => {
            if (!hasFeaturePermission(currentUser, 'canDownloadDesktopApp')) {
              showToast('Permission Denied: Super Admin has restricted your access to Desktop Software.', 'error');
              return;
            }
            setSettingsInitialTab('desktop');
            setIsSettingsOpen(true);
          }}
          onOpenCalibrationModal={() => {
            if (!hasFeaturePermission(currentUser, 'canCalibratePrinters')) {
              showToast('Permission Denied: Super Admin has restricted your access to Printer Calibration.', 'error');
              return;
            }
            setSettingsInitialTab('calibration');
            setIsSettingsOpen(true);
          }}
          onOpenSettings={(tab) => {
            setSettingsInitialTab((tab as any) || 'datasets');
            setIsSettingsOpen(true);
          }}
          onSwitchUser={(user) => {
            setCurrentUser(user);
            showToast(`Switched active role to ${user.role} (${user.name})`, 'info');
          }}
          onLogout={handleLogout}
          onCreateNewTemplate={() => {
            if (!hasFeaturePermission(currentUser, 'canCreateTemplates')) {
              showToast('Permission Denied: Super Admin has restricted your access to create new templates.', 'error');
              return;
            }
            handleNewTemplate();
            setActiveView('designer');
          }}
          onDuplicateTemplate={(id) => {
            if (!hasFeaturePermission(currentUser, 'canCreateTemplates')) {
              showToast('Permission Denied: Super Admin has restricted your access to duplicate templates.', 'error');
              return;
            }
            handleDuplicateTemplate(id);
          }}
          onDeleteTemplate={(id) => {
            if (!hasFeaturePermission(currentUser, 'canDeleteTemplates')) {
              showToast('Permission Denied: Super Admin has restricted your access to delete templates.', 'error');
              return;
            }
            handleDeleteTemplate(id);
          }}
        />

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          viewport={viewport}
          setViewport={setViewport}
          defaultDpi={defaultDpi}
          setDefaultDpi={setDefaultDpi}
          printers={printers}
          currentUser={currentUser}
          initialTab={settingsInitialTab}
          showWelcomeOnStartup={showWelcomeOnStartup}
          onToggleShowWelcomeOnStartup={handleToggleShowWelcomeOnStartup}
          onSavePrinterCalibration={(updatedPrinter) => {
            setPrinters((prev) => prev.map((p) => (p.id === updatedPrinter.id ? updatedPrinter : p)));
            showToast(`Saved calibration for printer "${updatedPrinter.name}"!`, 'success');
          }}
        />

        <AuditLogModal isOpen={isAuditLogsOpen} onClose={() => setIsAuditLogsOpen(false)} logs={auditLogs} />
      </ErrorBoundary>
    );
  }

  // Dedicated Super Admin Governance Screen - ONLY accessible by Super Admin
  const isSuperAdminUser =
    currentUser.role === 'Super Admin' ||
    currentUser.email?.toLowerCase() === 'superadmin@gmail.com';

  if (activeView === 'super-admin' && isSuperAdminUser) {
    return (
      <ErrorBoundary fallbackTitle="Super Admin Security Console Error">
        {notification && (
          <div
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-xl text-xs font-semibold flex items-center gap-2 transition-all animate-in fade-in slide-in-from-top-2 ${
              notification.type === 'error'
                ? 'bg-red-600 text-white'
                : notification.type === 'info'
                ? 'bg-blue-600 text-white'
                : 'bg-emerald-600 text-white'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{notification.message}</span>
          </div>
        )}
        <SuperAdminConsoleView
          currentUser={currentUser}
          onBackToDashboard={() => setActiveView('dashboard')}
          onOpenDesigner={() => {
            setActiveView('designer');
            showToast('Loaded Template Studio Designer', 'success');
          }}
          onOpenTemplates={() => {
            setActiveView('dashboard');
          }}
          onOpenSettings={(tab) => {
            setSettingsInitialTab((tab as any) || 'datasets');
            setIsSettingsOpen(true);
          }}
          onOpenAuditLogs={() => setIsAuditLogsOpen(true)}
          onLogout={handleLogout}
          onRefreshSession={async () => {
            try {
              const freshUsers = await apiService.users.list();
              const me = freshUsers.find((u) => u.id === currentUser.id);
              if (me) setCurrentUser(me);
            } catch {}
          }}
        />

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          viewport={viewport}
          setViewport={setViewport}
          defaultDpi={defaultDpi}
          setDefaultDpi={setDefaultDpi}
          printers={printers}
          currentUser={currentUser}
          initialTab={settingsInitialTab}
          onSavePrinterCalibration={(updatedPrinter) => {
            setPrinters((prev) => prev.map((p) => (p.id === updatedPrinter.id ? updatedPrinter : p)));
            showToast(`Saved calibration for printer "${updatedPrinter.name}"!`, 'success');
          }}
        />

        <AuditLogModal isOpen={isAuditLogsOpen} onClose={() => setIsAuditLogsOpen(false)} logs={auditLogs} />
      </ErrorBoundary>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 select-none font-sans">
      {/* Toast Notification Alert */}
      {notification && (
        <div
          className={`fixed top-12 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-xl text-xs font-semibold flex items-center gap-2 transition-all animate-in fade-in slide-in-from-top-2 ${notification.type === 'error'
              ? 'bg-red-600 text-white'
              : notification.type === 'info'
                ? 'bg-blue-600 text-white'
                : 'bg-emerald-600 text-white'
            }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{notification.message}</span>
        </div>
      )}

      {/* Designer Studio View (MenuBar + Toolbars + Canvas) */}
      {activeView === 'designer' && (
        <ErrorBoundary fallbackTitle="BarcodeFlow Designer Studio Recovery">
          <MenuBar
            onNew={() => setIsNewDocWizardOpen(true)}
            onOpenPrinterManager={() => setIsPrinterManagerOpen(true)}
            onOpen={handleOpenDocumentFile}
            onCloseDocument={() => handleCloseTab(activeDocumentInstanceId)}
            onCloseAllDocuments={handleCloseAllDocuments}
            onSave={handleSaveTemplate}
            onSaveAll={handleSaveAllDocuments}
            onSaveAs={() => handleSaveDocumentAs(activeDocumentInstanceId)}
            onPrintPreview={() => setIsPrintDialogOpen(true)}
            onOpenDatabaseConnection={() => setIsExcelWizardOpen(true)}
            onOpenWelcome={() => setIsWelcomeOpen(true)}
            onOpenPreferences={() => {
              setSettingsInitialTab('general');
              setIsSettingsOpen(true);
            }}
            recentDocuments={recentDocuments}
            onOpenRecentDocument={handleOpenRecentDocument}
            onClearRecentDocuments={handleClearRecentDocuments}
            onExitApp={handleExitApp}
            onExportPDF={handleExportPDF}
            onExportZPL={() => setIsZplExportOpen(true)}
            onExportJSON={handleExportJSON}
            onImportJSON={handleImportJSON}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={historyIndex > 0}
            canRedo={historyIndex < history.length - 1}
            onCut={handleCut}
            onCopy={handleCopy}
            onPaste={handlePaste}
            onDelete={handleDeleteSelected}
            onSelectAll={handleSelectAll}
            onDuplicate={handleDuplicateSelected}
            onZoomIn={() => setViewport((prev) => ({ ...prev, zoom: Math.min(prev.zoom + 0.25, 4.0) }))}
            onZoomOut={() => setViewport((prev) => ({ ...prev, zoom: Math.max(prev.zoom - 0.25, 0.25) }))}
            onZoomFit={handleZoomFit}
            onZoom100={() => setViewport((prev) => ({ ...prev, zoom: 1.0 }))}
            onToggleGrid={() => setViewport((prev) => ({ ...prev, showGrid: !prev.showGrid }))}
            onToggleRulers={() => setViewport((prev) => ({ ...prev, showRulers: !prev.showRulers }))}
            onToggleGuides={() => setViewport((prev) => ({ ...prev, showGuides: !prev.showGuides }))}
            onToggleSnap={() => setViewport((prev) => ({ ...prev, snapToGrid: !prev.snapToGrid }))}
            showGrid={viewport.showGrid}
            showRulers={viewport.showRulers}
            showGuides={viewport.showGuides}
            snapToGrid={viewport.snapToGrid}
            onInsertText={handleInsertText}
            onInsertBarcode={handleInsertBarcode}
            onInsertQR={handleInsertQR}
            onInsertDataMatrix={handleInsertDataMatrix}
            onInsertShape={handleInsertShape}
            onInsertImage={handleInsertImage}
            onInsertTable={handleInsertTable}
            onInsertGS1Block={() => setIsGs1WizardOpen(true)}
            onBringToFront={handleBringToFront}
            onSendToBack={handleSendToBack}
            onBringForward={handleBringForward}
            onSendBackward={handleSendBackward}
            onAlign={handleAlign}
            onDistribute={handleDistribute}
            onMakeSameWidth={handleMakeSameWidth}
            onMakeSameHeight={handleMakeSameHeight}
            onGroup={handleGroup}
            onUngroup={handleUngroup}
            onLockToggle={handleLockToggle}
            onOpenBarcodePicker={() => setIsBarcodePickerOpen(true)}
            onOpenBarcodeProperties={() => setIsBarcodePropertiesOpen(true)}
            onOpenPrintDialog={() => setIsPrintDialogOpen(true)}
            onOpenBatchPrint={() => setIsPrintDialogOpen(true)}
            onOpenApproval={() => setIsApprovalModalOpen(true)}
            onOpenAuditLogs={() => setIsAuditLogsOpen(true)}
            onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
            onOpenSettings={() => {
              setSettingsInitialTab('general');
              setIsSettingsOpen(true);
            }}
            onOpenShortcuts={() => setIsShortcutsOpen(true)}
            onOpenDataImport={() => setIsCsvImportOpen(true)}
            onOpenSerialNumberWizard={() => setIsSerialNumberWizardOpen(true)}
            onOpenDateTimeWizard={() => setIsDateTimeWizardOpen(true)}
            onOpenVersionHistory={() => setIsVersionHistoryModalOpen(true)}
            onToggleValidationInspector={() => setIsValidationInspectorOpen(!isValidationInspectorOpen)}
            onOpenGs1Wizard={() => setIsGs1WizardOpen(true)}
            onPageSetup={() => setIsPageSetupOpen(true)}
            onOpenNamedDataSources={() => setIsNamedDataSourcesOpen(true)}
            onOpenDocumentScripts={() => setIsDocumentScriptsOpen(true)}
            onOpenFormulaBuilder={() => setIsFormulaBuilderOpen(true)}
            onOpenDataEntryFormDesigner={() => setIsDataEntryDesignerOpen(true)}
            onOpenDataEntryRuntime={() => setIsDataEntryRuntimeOpen(true)}
            onOpenExcelWizard={() => setIsExcelWizardOpen(true)}
            onOpenRecordBrowser={() => setIsRecordBrowserOpen(true)}
            activeView={activeView}
            setActiveView={setActiveView}
            templateName={currentTemplate.name}
            currentUser={currentUser}
            allUsers={INITIAL_USERS}
            onSwitchUser={(user) => {
              setCurrentUser(user);
              showToast(`Switched active role to ${user.role} (${user.name})`, 'info');
            }}
            onLogout={handleLogout}
            onSubmitForApproval={async () => {
              if (currentTemplate.status !== 'draft') {
                showToast(`Template is already "${currentTemplate.status}" — only drafts can be submitted.`, 'info');
                return;
              }
              try {
                const snapshot = await createTemplateSnapshot(currentTemplate, currentUser.name, 'Submitted from Designer Studio');
                await apiService.templates.submit({
                  templateId: currentTemplate.id,
                  submittedBy: currentUser.name,
                  comments: 'Submitted from Designer Studio toolbar.',
                  snapshot,
                });
                setTemplates((prev) =>
                  prev.map((t) =>
                    t.id === currentTemplate.id
                      ? { ...t, status: 'pending_level_1', updatedAt: new Date().toISOString() }
                      : t
                  )
                );
                logAction('SUBMIT_APPROVAL', `Submitted template "${currentTemplate.name}" (v${currentTemplate.version}) for QA Review from Designer.`);
                showToast(`Version ${currentTemplate.version} frozen & submitted for QA Approval! Checksum: ${snapshot.checksum}`, 'success');
                setActiveView('workflow');
              } catch (err) {
                console.warn('Submit approval error:', err);
                setTemplates((prev) =>
                  prev.map((t) =>
                    t.id === currentTemplate.id
                      ? { ...t, status: 'pending_level_1', updatedAt: new Date().toISOString() }
                      : t
                  )
                );
                logAction('SUBMIT_APPROVAL', `Submitted template "${currentTemplate.name}" for QA Review (offline mode).`);
                showToast(`Template submitted for approval (offline mode).`, 'success');
                setActiveView('workflow');
              }
            }}
          />

          <div className="flex-1 flex flex-col overflow-hidden bg-[#9fbddb]">
            {/* BarTender Dual-Row Standard & Formatting Toolbar */}
            <ObjectToolbar
              activeTool={activeTool}
              setActiveTool={setActiveTool}
              onNew={() => setIsNewDocWizardOpen(true)}
              onOpen={handleOpenDocumentFile}
              onSave={handleSaveTemplate}
              onSaveAs={() => handleSaveDocumentAs(activeDocumentInstanceId)}
              onPrint={() => setIsPrintDialogOpen(true)}
              onCut={handleCut}
              onCopy={handleCopy}
              onPaste={handlePaste}
              onDelete={handleDeleteSelected}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={historyIndex > 0}
              canRedo={historyIndex < history.length - 1}
              onInsertText={handleInsertText}
              onInsertTextType={handleInsertTextType}
              onInsertBarcode={handleInsertBarcode}
              onInsertQR={handleInsertQR}
              onInsertDataMatrix={handleInsertDataMatrix}
              onInsertShape={handleInsertShape}
              onInsertTable={handleInsertTable}
              onInsertImage={handleInsertImage}
              onInsertGS1Block={() => setIsGs1WizardOpen(true)}
              onOpenBarcodePicker={() => setIsBarcodePickerOpen(true)}
              onZoomIn={() => setViewport((prev) => ({ ...prev, zoom: Math.min(prev.zoom + 0.25, 4.0) }))}
              onZoomOut={() => setViewport((prev) => ({ ...prev, zoom: Math.max(prev.zoom - 0.25, 0.25) }))}
              onZoom100={() => setViewport((prev) => ({ ...prev, zoom: 1.0 }))}
              onZoomFit={handleZoomFit}
              showGrid={viewport.showGrid}
              onToggleGrid={() => setViewport((prev) => ({ ...prev, showGrid: !prev.showGrid }))}
              showRulers={viewport.showRulers}
              onToggleRulers={() => setViewport((prev) => ({ ...prev, showRulers: !prev.showRulers }))}
              showGuides={viewport.showGuides}
              onToggleGuides={() => setViewport((prev) => ({ ...prev, showGuides: !prev.showGuides }))}
              snapToGrid={viewport.snapToGrid}
              onToggleSnap={() => setViewport((prev) => ({ ...prev, snapToGrid: !prev.snapToGrid }))}
              onOpenBarcodeProperties={() => setIsBarcodePropertiesOpen(true)}
              selectedElement={currentTemplate.elements.find((e) => selectedElementIds.includes(e.id))}
              onUpdateSelectedElement={(updates) => {
                if (selectedElementIds.length > 0) {
                  updateSingleElement(selectedElementIds[0], updates);
                }
              }}
              templateDimensions={currentTemplate.dimensions}
              onUpdateTemplateDimensions={(dims) => {
                updateTemplate({
                  dimensions: {
                    ...currentTemplate.dimensions,
                    ...dims,
                  },
                });
              }}
              documentName={currentTemplate.name}
            />

            {/* Designer Main Workspace Area */}
            <div className="flex-1 flex overflow-hidden relative">
              {/* Left Dock Toggle Button */}
              <button
                title="Toggle Toolbox, Layers & Template Catalog"
                onClick={() => setShowLeftDock(!showLeftDock)}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-30 bg-[#e4ebf5] hover:bg-white text-slate-700 border border-slate-400 p-0.5 rounded-r shadow-xs text-[10px]"
              >
                {showLeftDock ? '◀' : '▶'}
              </button>

              {/* Left Dock Panel: Elements Library, Layers, Variables, Data Records, Template Catalog */}
              {showLeftDock && (
                <LeftDockPanel
                  template={currentTemplate}
                  selectedElementIds={selectedElementIds}
                  onSelectElement={(id, multi) => {
                    if (multi) {
                      setSelectedElementIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
                    } else {
                      setSelectedElementIds([id]);
                    }
                  }}
                  onUpdateElement={updateSingleElement}
                  onReorderElements={handleReorderElements}
                  onDeleteElement={(id) => {
                    updateElements(currentTemplate.elements.filter((el) => el.id !== id));
                    setSelectedElementIds((prev) => prev.filter((x) => x !== id));
                  }}
                  onDuplicateElement={(id) => {
                    const el = currentTemplate.elements.find((e) => e.id === id);
                    if (el) {
                      const copy = { ...el, id: `el-dup-${Date.now()}`, x: el.x + 3, y: el.y + 3 };
                      updateElements([...currentTemplate.elements, copy]);
                      setSelectedElementIds([copy.id]);
                    }
                  }}
                  onInsertElement={(elPartial) => {
                    const newEl: LabelElement = {
                      id: `el-${Date.now()}`,
                      name: `Element ${currentTemplate.elements.length + 1}`,
                      type: 'text',
                      x: 10,
                      y: 10,
                      width: 30,
                      height: 10,
                      rotation: 0,
                      opacity: 1,
                      locked: false,
                      visible: true,
                      zIndex: currentTemplate.elements.length + 1,
                      ...elPartial,
                    } as LabelElement;
                    updateElements([...currentTemplate.elements, newEl]);
                    setSelectedElementIds([newEl.id]);
                  }}
                  onInsertPreset={handleInsertPreset}
                  onSelectTemplate={(id) => setCurrentTemplateId(id)}
                  templatesList={templates}
                  onAddVariable={(v) => updateTemplate({ variables: [...currentTemplate.variables, v] })}
                  onUpdateVariable={(id, upd) =>
                    updateTemplate({
                      variables: currentTemplate.variables.map((v) => (v.id === id ? { ...v, ...upd } : v)),
                    })
                  }
                  onDeleteVariable={(id) =>
                    updateTemplate({ variables: currentTemplate.variables.filter((v) => v.id !== id) })
                  }
                  onImportCSV={() => setIsCsvImportOpen(true)}
                  currentRecordIndex={safePreviewIndex}
                  onSelectRecordIndex={(idx) => setViewport((p) => ({ ...p, previewRecordIndex: idx }))}
                  currentRecordData={currentRecordData}
                  onClose={() => setShowLeftDock(false)}
                  datasets={datasets}
                  onBindElementToField={handleBindElementToField}
                  onInsertBoundElement={handleInsertBoundElementAt}
                  onOpenConnectWizard={() => setIsExcelWizardOpen(true)}
                  onRefreshConnection={handleRefreshActiveDataset}
                />
              )}

              {/* Central Precision Interactive Canvas & Bottom Database Stepper */}
              <div className="flex-1 flex flex-col overflow-hidden relative">
                <div className="flex-1 overflow-hidden relative">
                  {activeDocument?.type === 'form' ? (
                    <FormWorkspaceView
                      document={activeDocument}
                      onUpdateForm={(updatedForm) => {
                        setOpenDocuments((prev) =>
                          prev.map((d) =>
                            d.instanceId === activeDocument.instanceId ? { ...d, isDirty: true, form: updatedForm } : d
                          )
                        );
                      }}
                      onSaveForm={(instId) => handleSaveDocument(instId)}
                      documents={openDocuments}
                      activeInstanceId={activeDocumentInstanceId}
                      onSelectTab={handleSelectTab}
                      onCloseTab={handleCloseTab}
                      onNewTemplate={handleNewTemplateTab}
                      onNewForm={handleNewFormTab}
                      onSaveDoc={handleSaveDocument}
                      onSaveAll={handleSaveAllDocuments}
                      onDuplicateDoc={handleDuplicateDocument}
                      onCloseOthers={handleCloseOthers}
                      onCloseAll={handleCloseAll}
                      activePrinterName={activePrinter?.name || defaultPrinter?.name || 'Microsoft Print to PDF'}
                      onPrintPreview={(formData) => {
                        setIsPrintDialogOpen(true);
                      }}
                    />
                  ) : (
                    <DesignerCanvas
                      template={currentTemplate}
                      selectedElementIds={selectedElementIds}
                      onSelectElements={setSelectedElementIds}
                      onUpdateElement={updateSingleElement}
                      onUpdateMultipleElements={updateMultipleElements}
                      onDeleteSelected={handleDeleteSelected}
                      onDuplicateSelected={handleDuplicateSelected}
                      onCut={handleCut}
                      onCopy={handleCopy}
                      onPaste={handlePaste}
                      onUndo={handleUndo}
                      onRedo={handleRedo}
                      onBringToFront={handleBringToFront}
                      onSendToBack={handleSendToBack}
                      onBringForward={handleBringForward}
                      onSendBackward={handleSendBackward}
                      onGroup={handleGroup}
                      onUngroup={handleUngroup}
                      onLockToggle={handleLockToggle}
                      onOpenProperties={() => {
                        const selEl = currentTemplate.elements.find((e) => selectedElementIds.includes(e.id));
                        if (selEl) {
                          if (selEl.type === 'barcode') setIsBarcodePropertiesOpen(true);
                          else if (selEl.type === 'text') setIsTextPropertiesOpen(true);
                          else if (selEl.type === 'shape') setIsShapePropertiesOpen(true);
                          else setShowRightDock(true);
                        } else {
                          setIsPageSetupOpen(true);
                        }
                      }}
                      onOpenBarcodePicker={() => setIsBarcodePickerOpen(true)}
                      onOpenBarcodeProperties={() => setIsBarcodePropertiesOpen(true)}
                      onOpenPageSetup={() => setIsPageSetupOpen(true)}
                      onInsertElementAt={(elPartial, xMm, yMm) => {
                        const newEl: LabelElement = {
                          id: `el-${Date.now()}`,
                          name: `Element ${currentTemplate.elements.length + 1}`,
                          type: 'text',
                          x: xMm,
                          y: yMm,
                          width: 30,
                          height: 10,
                          rotation: 0,
                          opacity: 1,
                          locked: false,
                          visible: true,
                          zIndex: currentTemplate.elements.length + 1,
                          ...elPartial,
                        } as LabelElement;
                        updateElements([...currentTemplate.elements, newEl]);
                        setSelectedElementIds([newEl.id]);
                        showToast(`Added ${newEl.name} at (${xMm.toFixed(1)}, ${yMm.toFixed(1)}) mm`, 'success');
                      }}
                      onInsertPresetAt={(presetKey, xMm, yMm) => {
                        handleInsertPreset(presetKey);
                      }}
                      onBindElementToField={handleBindElementToField}
                      onInsertBoundElementAt={handleInsertBoundElementAt}
                      viewport={viewport}
                      setViewport={setViewport}
                      recordData={currentRecordData}
                      onCursorMove={(xMm, yMm) => setCursorPos({ x: xMm, y: yMm })}
                      documents={openDocuments}
                      activeInstanceId={activeDocumentInstanceId}
                      onSelectTab={handleSelectTab}
                      onCloseTab={handleCloseTab}
                      onNewTemplate={handleNewTemplateTab}
                      onNewForm={handleNewFormTab}
                      onSaveDoc={handleSaveDocument}
                      onSaveAll={handleSaveAllDocuments}
                      onDuplicateDoc={handleDuplicateDocument}
                      onCloseOthers={handleCloseOthers}
                      onCloseAll={handleCloseAll}
                      activePrinterName={activePrinter?.name || defaultPrinter?.name || 'Microsoft Print to PDF'}
                      onOpenDocument={handleOpenDocumentFile}
                    />
                  )}

                  {/* Validation & Compliance Problem Inspector */}
                  <ValidationInspectorPanel
                    template={currentTemplate}
                    isOpen={isValidationInspectorOpen}
                    onClose={() => setIsValidationInspectorOpen(false)}
                    onSelectElement={(id) => {
                      setSelectedElementIds([id]);
                      setShowRightDock(true);
                    }}
                    onAutoFix={(issue) => {
                      if (issue.category === 'Print Boundary' && issue.elementId) {
                        const el = currentTemplate.elements.find(e => e.id === issue.elementId);
                        if (el) {
                          const safe = currentTemplate.margins.safeZone || 1;
                          const newX = Math.max(safe, Math.min(currentTemplate.dimensions.width - el.width - safe, el.x));
                          const newY = Math.max(safe, Math.min(currentTemplate.dimensions.height - el.height - safe, el.y));
                          updateSingleElement(el.id, { x: newX, y: newY });
                          showToast(`Fitted "${el.name}" inside printable safe margins`, 'success');
                        }
                      } else if (issue.category === 'GS1 Compliance' && issue.elementId) {
                        const el = currentTemplate.elements.find(e => e.id === issue.elementId) as any;
                        if (el && el.value) {
                          const clean = el.value.replace(/\D/g, '');
                          if (clean.length >= 8) {
                            const body = clean.slice(0, -1);
                            const cd = calculateGS1CheckDigit(body);
                            updateSingleElement(el.id, { value: `${body}${cd}` });
                            showToast(`Calculated & corrected GS1 Modulo-10 Check Digit (${cd})`, 'success');
                          }
                        }
                      }
                    }}
                    activeRecord={currentRecordData}
                  />
                </div>

                {/* Bottom Database Record Navigator */}
                <RecordNavigationBar
                  template={currentTemplate}
                  connection={currentTemplate.databaseConnection}
                  currentRecordIndex={safePreviewIndex}
                  totalRecords={totalVisibleRecords}
                  filteredCount={recordSearchFilter.trim() ? totalVisibleRecords : undefined}
                  unfilteredTotal={rawActiveRecords.length}
                  isLoading={isRefreshingRecords}
                  selectedCount={selectedRecordIndices.length}
                  currentRecordData={currentRecordData}
                  onSelectRecordIndex={(idx) => setViewport((v) => ({ ...v, previewRecordIndex: idx }))}
                  onImportCSV={() => setIsCsvImportOpen(true)}
                  onOpenDataConnector={() => setIsDatabaseConnectionModalOpen(true)}
                  onOpenRecordBrowser={() => setIsRecordBrowserOpen(true)}
                  onRefresh={handleRefreshActiveDataset}
                  onSearchFilterChange={setRecordSearchFilter}
                  searchFilter={recordSearchFilter}
                />
              </div>

              {/* Right Dock Toggle Button */}
              <button
                title="Toggle Element Properties & Page Setup"
                onClick={() => setShowRightDock(!showRightDock)}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-30 bg-[#e4ebf5] hover:bg-white text-slate-700 border border-slate-400 p-0.5 rounded-l shadow-xs text-[10px]"
              >
                {showRightDock ? '▶' : '◀'}
              </button>

              {/* Right Dock Panel: Selected Element & Template Properties */}
              {showRightDock && (
                <RightDockPanel
                  template={currentTemplate}
                  selectedElementIds={selectedElementIds}
                  onUpdateTemplate={updateTemplate}
                  onUpdateElement={updateSingleElement}
                  onOpenBarcodePicker={() => setIsBarcodePickerOpen(true)}
                  onOpenBarcodeProperties={() => setIsBarcodePropertiesOpen(true)}
                  onClose={() => setShowRightDock(false)}
                  currentRecordData={currentRecordData}
                  currentRecordIndex={safePreviewIndex}
                  totalRecords={totalVisibleRecords}
                />
              )}
            </div>
          </div>
        </ErrorBoundary>
      )}

      {/* Alternative Enterprise Views */}

      {activeView === 'queue' && (
        <PrintQueueView
          printJobs={printJobs}
          printers={printers}
          onCancelJob={async (jobId) => {
            setPrintJobs((prev) => prev.filter((j) => j.id !== jobId));
            showToast('Cancelled print job', 'info');
            try {
              await apiService.printJobs.cancel(jobId);
            } catch (err) {
              console.warn('API error cancelling job:', err);
            }
          }}
          onRetryJob={async (jobId) => {
            setPrintJobs((prev) =>
              prev.map((j) => (j.id === jobId ? { ...j, status: 'printing', progressPercent: 10 } : j))
            );
            showToast('Retrying print job dispatch', 'info');
            try {
              await apiService.printJobs.resume(jobId);
            } catch (err) {
              console.warn('API error retrying job:', err);
            }
          }}
          onClearCompleted={() => {
            setPrintJobs((prev) => prev.filter((j) => j.status !== 'completed'));
            showToast('Cleared completed jobs', 'info');
          }}
          onReprintWithSnapshot={async (job) => {
            const reprintedRecords = job.dataSnapshot || [{}];
            const targetPrinter = printers.find((p) => p.id === job.printerId) || printers[0];
            const newJob: PrintJob = {
              ...job,
              id: `PJ-${Math.floor(1000 + Math.random() * 9000)}`,
              submittedAt: new Date().toISOString(),
              status: 'completed',
              progressPercent: 100,
            };
            setPrintJobs((prev) => [newJob, ...prev]);
            showToast(`Reprinted ${reprintedRecords.length} labels from original snapshot!`, 'success');
          }}
          onReprintWithCurrentData={async (job) => {
            let freshRecords = job.dataSnapshot || [{}];
            if (job.excelFilePath) {
              try {
                const res = await apiService.datasets.inspectExcel({ filePath: job.excelFilePath, sheetName: job.excelSheetName });
                if (res.success && res.data?.previewRows?.length) {
                  freshRecords = res.data.previewRows;
                }
              } catch (e) {
                console.warn('Live Excel re-read fallback to snapshot:', e);
              }
            }
            const newJob: PrintJob = {
              ...job,
              id: `PJ-${Math.floor(1000 + Math.random() * 9000)}`,
              submittedAt: new Date().toISOString(),
              status: 'completed',
              progressPercent: 100,
              dataSnapshot: freshRecords,
            };
            setPrintJobs((prev) => [newJob, ...prev]);
            showToast(`Reprinted ${freshRecords.length} labels from live Excel file!`, 'success');
          }}
        />
      )}

      {activeView === 'workflow' && (
        <WorkflowView
          templates={templates}
          currentUser={currentUser}
          allUsers={INITIAL_USERS}
          onNavigateToDashboard={() => setActiveView('dashboard')}
          onSwitchUser={(user) => {
            setCurrentUser(user);
            showToast(`Switched active role to ${user.role} (${user.name})`, 'info');
          }}
          onLogout={handleLogout}
          onOpenTemplateInDesigner={(id) => {
            setCurrentTemplateId(id);
            setActiveView('designer');
          }}
          onUpdateTemplateStatus={async (templateId, status, comment, eSignature, annotations) => {
            const targetTmpl = templates.find((t) => t.id === templateId) || currentTemplate;

            // 1. SUBMIT FOR APPROVAL -> FREEZE VERSION & GENERATE SNAPSHOT
            if (status === 'pending_level_1' || status === 'submitted') {
              try {
                const snapshot = await createTemplateSnapshot(targetTmpl, currentUser.name, comment);
                const submitRes = await apiService.templates.submit({
                  templateId,
                  submittedBy: currentUser.name,
                  comments: comment,
                  snapshot,
                });

                setTemplates((prev) =>
                  prev.map((t) =>
                    t.id === templateId
                      ? {
                        ...t,
                        status: 'pending_level_1',
                        updatedAt: new Date().toISOString(),
                      }
                      : t
                  )
                );
                logAction('SUBMIT_APPROVAL', `Submitted template "${targetTmpl.name}" (v${targetTmpl.version}) for QA Review. Version frozen.`);
                showToast(`Version ${targetTmpl.version} frozen & submitted for QA Approval! Checksum: ${snapshot.checksum}`, 'success');
                return;
              } catch (err) {
                console.warn('API error submitting for approval:', err);
              }
            }

            // 2. APPROVE LEVEL 1 OR LEVEL 2
            if (status === 'pending_level_2' || status === 'approved' || status === 'published') {
              const level = status === 'pending_level_2' ? 1 : 2;
              try {
                await apiService.templates.approve({
                  templateId,
                  version: targetTmpl.version,
                  level,
                  reviewerName: currentUser.name,
                  reviewerEmail: currentUser.email,
                  digitalSignature: eSignature || `${currentUser.name} (${currentUser.role})`,
                  comment,
                  isFinal: status === 'approved' || status === 'published',
                });

                setTemplates((prev) =>
                  prev.map((t) =>
                    t.id === templateId
                      ? {
                        ...t,
                        status,
                        approvedBy: eSignature || currentUser.name,
                        approvedAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                      }
                      : t
                  )
                );
                logAction('APPROVE_TEMPLATE', `Approved template "${targetTmpl.name}" at Level ${level}. Signed by ${currentUser.name}.`);
                showToast(`Successfully e-Signed and approved template at Level ${level}!`, 'success');
                return;
              } catch (err) {
                console.warn('API error approving template:', err);
              }
            }

            // 3. REJECT OR REQUEST CHANGES
            if (status === 'rejected') {
              try {
                if (annotations && annotations.length > 0) {
                  await apiService.templates.requestChange({
                    templateId,
                    version: targetTmpl.version,
                    reviewerName: currentUser.name,
                    comment,
                    annotations,
                  });
                  logAction('REQUEST_CHANGE', `Requested changes for "${targetTmpl.name}" with ${annotations.length} visual annotations.`);
                  showToast(`Changes requested with ${annotations.length} visual annotations attached. Returned to Draft.`, 'info');
                } else {
                  await apiService.templates.reject({
                    templateId,
                    version: targetTmpl.version,
                    reviewerName: currentUser.name,
                    reason: comment,
                  });
                  logAction('REJECT_TEMPLATE', `Rejected template "${targetTmpl.name}". Reason: ${comment}`);
                  showToast(`Template submission rejected and returned to draft for revision.`, 'info');
                }

                setTemplates((prev) =>
                  prev.map((t) =>
                    t.id === templateId
                      ? {
                        ...t,
                        status: 'draft',
                        updatedAt: new Date().toISOString(),
                      }
                      : t
                  )
                );
                return;
              } catch (err) {
                console.warn('API error rejecting template:', err);
              }
            }

            // Fallback status update
            setTemplates((prev) =>
              prev.map((t) => (t.id === templateId ? { ...t, status, updatedAt: new Date().toISOString() } : t))
            );
          }}
          onRollbackTemplate={(rolledBackTmpl) => {
            updateTemplate(rolledBackTmpl);
            showToast(`Rolled back active template to v${rolledBackTmpl.version}`, 'success');
            logAction('ROLLBACK_VERSION', `Rolled back template "${rolledBackTmpl.name}" to version ${rolledBackTmpl.version}`);
          }}
          onGenerateBatchJob={async (job) => {
            setBatchJobs((prev) => [job, ...prev]);
            logAction('PRINT_JOB_DISPATCH', `Generated serialized 10-page barcode job ${job.jobCode} for template "${job.templateName}"`);
            showToast(`Generated 10-Page Barcode batch (${job.jobCode}) and sent to Viewer station!`, 'success');
            setActiveView('viewer');

            try {
              await apiService.batchJobs.create(job);
            } catch (err) {
              console.warn('API error creating batch job:', err);
            }
          }}
          onNavigateToViewer={() => setActiveView('viewer')}
        />
      )}

      {activeView === 'viewer' && (
        <ViewerPrintStationView
          batchJobs={batchJobs}
          templates={templates}
          printers={printers}
          currentUserName={currentUser.name}
          currentUser={currentUser}
          allUsers={INITIAL_USERS}
          onNavigateToDashboard={() => setActiveView('dashboard')}
          onNavigateToWorkflow={() => setActiveView('workflow')}
          onSwitchUser={(user) => {
            setCurrentUser(user);
            showToast(`Switched active role to ${user.role} (${user.name})`, 'info');
          }}
          onLogout={handleLogout}
          onOpenDesigner={(tmplId) => {
            setCurrentTemplateId(tmplId);
            setActiveView('designer');
          }}
          onPrintBatch={async (jobId, pageSelection, printerId) => {
            const targetJob = batchJobs.find((j) => j.id === jobId);
            const targetPrinter = printers.find((p) => p.id === printerId);

            // Mark job as printed
            setBatchJobs((prev) =>
              prev.map((j) => (j.id === jobId ? { ...j, status: 'printed', printedAt: new Date().toLocaleString(), printedBy: currentUser.name } : j))
            );

            // Add a print job to print queue
            const count = pageSelection === 'all' ? (targetJob?.totalPages || 10) : pageSelection.length;
            const newPrintJob: PrintJob = {
              id: `PJ-${Math.floor(1000 + Math.random() * 9000)}`,
              templateId: targetJob?.templateId || currentTemplate.id,
              templateName: targetJob?.templateName || currentTemplate.name,
              printerId: targetPrinter?.id || printers[0].id,
              printerName: targetPrinter?.name || printers[0].name,
              copies: count,
              recordCount: count,
              status: 'completed',
              format: 'zpl',
              submittedBy: currentUser.name,
              submittedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              progressPercent: 100,
            };

            setPrintJobs((prev) => [newPrintJob, ...prev]);
            logAction('PRINT_JOB_DISPATCH', `Printed 10-Page serialized document ${targetJob?.jobCode} to ${targetPrinter?.name}`);
            showToast(`10-Page Document successfully sent to ${targetPrinter?.name}!`, 'success');

            try {
              await Promise.allSettled([
                apiService.batchJobs.updateStatus(jobId, 'printed', currentUser.name, targetPrinter?.name),
                apiService.printJobs.dispatch({
                  templateId: targetJob?.templateId || currentTemplate.id,
                  printerId: targetPrinter?.id || printers[0].id,
                  copies: count,
                  records: targetJob?.pages?.map((p) => ({ SERIAL_NO: p.serialNumber, PRODUCT_NAME: p.productName })) || [{}],
                  format: 'zpl',
                  submittedBy: currentUser.name,
                }),
              ]);
            } catch (err) {
              console.warn('API error in onPrintBatch:', err);
            }
          }}
        />
      )}

      {activeView === 'datasets' && (
        <DatasetManagerView
          currentUser={currentUser}
          onNavigateToDashboard={() => setActiveView('dashboard')}
          onNavigateToDesigner={() => {
            refreshDatasets();
            setActiveView('designer');
          }}
          onSelectDatasetForDesigner={(dataset) => {
            handleConnectDatasetToTemplate(dataset);
            setActiveView('designer');
          }}
        />
      )}

      {activeView === 'license' && (
        <LicenseManagerView
          currentUser={currentUser}
          onNavigateToDashboard={() => setActiveView('dashboard')}
        />
      )}

      {activeView === 'software-download' && (
        <SoftwareDownloadView
          currentUser={currentUser}
          onBackToDashboard={() => setActiveView('dashboard')}
          onNavigateToLicense={() => setActiveView('license')}
        />
      )}

      {activeView === 'super-admin' && (
        <SuperAdminConsoleView
          currentUser={currentUser}
          onBackToDashboard={() => setActiveView('dashboard')}
          onRefreshSession={async () => {
            try {
              const freshUsers = await apiService.users.list();
              const me = freshUsers.find((u) => u.id === currentUser.id);
              if (me) setCurrentUser(me);
            } catch {}
          }}
        />
      )}

      {isCalibrationModalOpen && (
        <PrinterCalibrationModal
          printers={printers}
          onClose={() => setIsCalibrationModalOpen(false)}
          onCalibrationSaved={(updatedPrinter) => {
            setPrinters((prev) => prev.map((p) => (p.id === updatedPrinter.id ? updatedPrinter : p)));
            showToast(`Saved calibration for printer "${updatedPrinter.name}"!`, 'success');
            setIsCalibrationModalOpen(false);
          }}
        />
      )}

      {/* All Dialogs & Modals */}

      <BarcodePickerModal
        isOpen={isBarcodePickerOpen}
        onClose={() => setIsBarcodePickerOpen(false)}
        onSelectSymbology={(sym) => {
          if (selectedElementIds.length > 0) {
            const selEl = currentTemplate.elements.find((e) => e.id === selectedElementIds[0]);
            if (selEl && selEl.type === 'barcode') {
              updateSingleElement(selEl.id, { symbology: sym });
            } else {
              handleInsertBarcode(sym);
            }
          } else {
            handleInsertBarcode(sym);
          }
          setIsBarcodePickerOpen(false);
        }}
      />

      <PrintCenterDialog
        isOpen={isPrintDialogOpen}
        onClose={() => setIsPrintDialogOpen(false)}
        template={currentTemplate}
        printers={printers as any}
        recordData={currentRecordData}
        activeRecordIndex={viewport.previewRecordIndex}
        selectedRecordIndices={selectedRecordIndices}
        onOpenDatabaseSetup={() => setIsExcelWizardOpen(true)}
        onUpdateTemplate={(updatedTmpl) => updateTemplate(updatedTmpl)}
        onJobSubmitted={async (job) => {
          setPrintJobs((prev) => [job, ...prev]);

          // Automatically save current template to My Drafts with 'Printed' tag so it remains easily editable
          const updatedTags = Array.from(new Set([...(currentTemplate.tags || []), 'Printed', 'Draft']));
          const printedTemplate: LabelTemplate = {
            ...currentTemplate,
            tags: updatedTags,
            updatedAt: new Date().toISOString(),
          };

          setTemplates((prev) => {
            const exists = prev.some((t) => t.id === printedTemplate.id);
            if (exists) {
              return prev.map((t) => (t.id === printedTemplate.id ? printedTemplate : t));
            }
            return [printedTemplate, ...prev];
          });

          logAction(
            'PRINT_JOB_DISPATCH',
            `Dispatched job #${job.id} (${job.copies} copies) to ${job.printerName} & saved to My Drafts with [Printed] tag`
          );
          showToast(`Dispatched to ${job.printerName} & saved to My Drafts with [Printed] tag via API!`, 'success');

          try {
            await apiService.templates.save(printedTemplate);
          } catch (err) {
            console.warn('API error saving printed template tag:', err);
          }
        }}
      />

      <NewDocumentWizardModal
        isOpen={isNewDocWizardOpen}
        onClose={() => setIsNewDocWizardOpen(false)}
        currentUser={currentUser.name}
        onFinish={async (newTmpl) => {
          setTemplates((prev) => [newTmpl, ...prev]);
          setCurrentTemplateId(newTmpl.id);
          const newDoc: OpenDocument = {
            instanceId: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            documentId: newTmpl.id,
            type: 'template',
            name: newTmpl.name,
            isDirty: false,
            isNew: true,
            template: newTmpl,
            selectedElementIds: [],
            history: { entries: [newTmpl.elements || []], index: 0 },
            viewState: { zoom: 1.25, panX: 40, panY: 40 },
            dataState: { currentRecordIndex: 0, selectedRecordIndices: [] },
          };
          setOpenDocuments((prev) => [...prev, newDoc]);
          setActiveDocumentInstanceId(newDoc.instanceId);
          if (newTmpl.printer) {
            const matched = availablePrinters.find(
              (p) =>
                p.name.toLowerCase() === newTmpl.printer!.name?.toLowerCase() ||
                (p.systemName && newTmpl.printer!.systemName && p.systemName.toLowerCase() === newTmpl.printer!.systemName.toLowerCase()) ||
                p.id === newTmpl.printer!.id
            );
            if (matched) {
              setActivePrinter(matched);
            }
          }
          setSelectedElementIds([]);
          setHistory([newTmpl.elements || []]);
          setHistoryIndex(0);
          setViewport((prev) => ({ ...prev, previewRecordIndex: 0 }));
          showToast(`Created new ${newTmpl.name} (${newTmpl.dimensions.width}×${newTmpl.dimensions.height} mm)`, 'success');
          logAction('CREATE_TEMPLATE', `Created "${newTmpl.name}" via New Document Wizard`);
          try {
            await apiService.templates.create(newTmpl);
          } catch (err) {
            console.warn('API sync warning:', err);
          }
        }}
      />

      {/* Multi-Document Unsaved Changes Confirmation Modal */}
      {unsavedDocModal && (
        <UnsavedChangesModal
          isOpen={unsavedDocModal.isOpen}
          documentName={unsavedDocModal.documentName}
          onSave={async () => {
            const instId = unsavedDocModal.instanceId;
            await handleSaveDocument(instId);
            setUnsavedDocModal(null);
            handlePerformCloseTab(instId);
          }}
          onDontSave={() => {
            const instId = unsavedDocModal.instanceId;
            setUnsavedDocModal(null);
            handlePerformCloseTab(instId);
          }}
          onCancel={() => setUnsavedDocModal(null)}
        />
      )}

      {/* P0-8: Missing / Preferred Printer Unavailable Alert Modal */}
      {missingPrinterModal?.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/50 rounded-xl shadow-2xl max-w-md w-full p-6 text-white space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-bold">Preferred Printer Unavailable</h3>
            </div>
            <p className="text-sm text-slate-300">
              This document was configured for <span className="font-semibold text-white">"{missingPrinterModal.templatePrinterName}"</span>, which is not currently detected or offline in Windows.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => {
                  setMissingPrinterModal(null);
                  setIsPrintDialogOpen(true);
                }}
                className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium text-sm transition-colors text-center"
              >
                Select Another Printer
              </button>
              {defaultPrinter && (
                <button
                  onClick={() => {
                    setActivePrinter(defaultPrinter);
                    setTemplates((prev) =>
                      prev.map((t) =>
                        t.id === currentTemplateId
                          ? {
                              ...t,
                              printer: {
                                id: defaultPrinter.id,
                                name: defaultPrinter.name,
                                systemName: defaultPrinter.systemName || defaultPrinter.name,
                                driverName: defaultPrinter.driverName,
                                portName: defaultPrinter.portName || defaultPrinter.port,
                                dpi: defaultPrinter.dpi,
                                renderer: defaultPrinter.preferredRenderer || 'WINDOWS_DRIVER',
                              },
                            }
                          : t
                      )
                    );
                    setMissingPrinterModal(null);
                    showToast(`Switched to Windows default: ${defaultPrinter.name}`, 'info');
                  }}
                  className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg font-medium text-sm transition-colors text-center"
                >
                  Use Windows Default ({defaultPrinter.name})
                </button>
              )}
              <button
                onClick={() => setMissingPrinterModal(null)}
                className="w-full px-4 py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors text-center"
              >
                Continue Designing
              </button>
            </div>
          </div>
        </div>
      )}

      <PrinterManagerModal
        isOpen={isPrinterManagerOpen}
        onClose={() => setIsPrinterManagerOpen(false)}
        onPrinterSelected={(p) => {
          showToast(`Selected "${p.name}" as active printer`, 'info');
        }}
      />

      <ZplExportDialog
        isOpen={isZplExportOpen}
        onClose={() => setIsZplExportOpen(false)}
        template={currentTemplate}
        recordData={currentRecordData}
      />

      <CsvImportModal
        isOpen={isCsvImportOpen}
        onClose={() => setIsCsvImportOpen(false)}
        template={currentTemplate}
        onImportData={(records) => {
          updateTemplate({ sampleRecords: records });
          setViewport((p) => ({ ...p, previewRecordIndex: 0 }));
          logAction('IMPORT_DATA', `Imported ${records.length} CSV records into template "${currentTemplate.name}"`);
          showToast(`Imported ${records.length} records into template`, 'success');
        }}
        onAutoCreateVariables={(newVars) => {
          updateTemplate({ variables: [...currentTemplate.variables, ...newVars] });
        }}
      />

      <AiAssistantModal
        isOpen={isAiAssistantOpen}
        onClose={() => setIsAiAssistantOpen(false)}
        template={currentTemplate}
        onApplyTemplateUpdates={(upd) => {
          updateTemplate(upd);
          showToast('Applied AI label optimizations', 'success');
        }}
      />

      <ApprovalWorkflowModal
        isOpen={isApprovalModalOpen}
        onClose={() => setIsApprovalModalOpen(false)}
        template={currentTemplate}
        currentUser={currentUser}
        onUpdateStatus={(newStatus, comment, eSignature) => {
          updateTemplate({
            status: newStatus,
            approvedBy: newStatus === 'approved' ? eSignature || currentUser.name : currentTemplate.approvedBy,
            approvedAt: newStatus === 'approved' ? new Date().toISOString() : currentTemplate.approvedAt,
          });
          logAction('APPROVE_TEMPLATE', `Changed status to ${newStatus.toUpperCase()} (${comment})`);
          showToast(`Updated lifecycle status to ${newStatus.toUpperCase()}`, 'success');
        }}
      />

      <AuditLogModal isOpen={isAuditLogsOpen} onClose={() => setIsAuditLogsOpen(false)} logs={auditLogs} />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        viewport={viewport}
        setViewport={setViewport}
        defaultDpi={defaultDpi}
        setDefaultDpi={setDefaultDpi}
        printers={printers}
        currentUser={currentUser}
        initialTab={settingsInitialTab}
        onSavePrinterCalibration={(updatedPrinter) => {
          setPrinters((prev) => prev.map((p) => (p.id === updatedPrinter.id ? updatedPrinter : p)));
          showToast(`Saved calibration for printer "${updatedPrinter.name}"!`, 'success');
        }}
      />

      <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />

      {/* BarTender Barcode Properties Modal (Data Sources, Transforms, Symbology & Size) */}
      <BarcodePropertiesModal
        isOpen={isBarcodePropertiesOpen}
        onClose={() => setIsBarcodePropertiesOpen(false)}
        element={
          (currentTemplate.elements.find((e) => selectedElementIds.includes(e.id) && e.type === 'barcode') ||
            currentTemplate.elements.find((e) => e.type === 'barcode') ||
            currentTemplate.elements.find((e) => selectedElementIds.includes(e.id)) || {
            id: 'el-default-bc',
            name: 'Barcode 3',
            type: 'barcode',
            symbology: 'code128',
            value: '12345678',
            includeText: true,
            textPosition: 'below',
            barWidth: 1.5,
            barHeight: 16,
            quietZone: true,
            foregroundColor: '#000000',
            backgroundColor: '#ffffff',
            checkDigit: true,
            x: 10,
            y: 20,
            width: 55,
            height: 22,
            rotation: 0,
            opacity: 1,
            locked: false,
            visible: true,
            zIndex: 1,
          }) as any
        }
        onUpdateElement={(id, updates) => {
          updateSingleElement(id, updates);
        }}
        availableVariables={currentTemplate.variables}
        onOpenGs1Wizard={() => setIsGs1WizardOpen(true)}
        datasets={datasets}
        currentRecord={currentRecordData}
        onConnectDataset={handleConnectDatasetToTemplate}
      />

      {/* GS1 Application Identifier Wizard Modal */}
      <GS1ApplicationIdentifierWizardModal
        isOpen={isGs1WizardOpen}
        onClose={() => setIsGs1WizardOpen(false)}
        availableVariables={currentTemplate.variables}
        onApply={(fields, replaceMode) => {
          const compiled = fields.map((f) => `(${f.ai})${f.value}`).join('');
          const selectedEl = currentTemplate.elements.find((e) => selectedElementIds.includes(e.id));
          if (selectedEl) {
            const newDs: any = {
              id: `ds-${Date.now()}`,
              name: `GS1 AI (${fields.length} Fields)`,
              type: 'gs1_ai',
              value: compiled,
              gs1AIs: fields,
              enabled: true,
            };
            const currentSources = selectedEl.dataSources || [];
            let nextList: any[];
            if (replaceMode === 'replace') {
              nextList = [newDs];
            } else if (replaceMode === 'insert') {
              nextList = [newDs, ...currentSources];
            } else {
              nextList = [...currentSources, newDs];
            }
            updateSingleElement(selectedEl.id, {
              symbology: selectedEl.type === 'barcode' ? 'gs1-128' : undefined,
              dataSources: nextList,
              value: compiled,
            });
            showToast(`Applied GS1 AI Data Source to "${selectedEl.name}"`, 'success');
          } else {
            // Create new GS1 DataMatrix / GS1-128 barcode
            const newBarcode: LabelElement = {
              id: `el-gs1-${Date.now()}`,
              name: 'GS1-128 Barcode',
              type: 'barcode',
              symbology: 'gs1-128',
              value: compiled,
              dataSources: [
                {
                  id: `ds-${Date.now()}`,
                  name: `GS1 AI (${fields.length} Fields)`,
                  type: 'gs1_ai',
                  value: compiled,
                  gs1AIs: fields,
                  enabled: true,
                },
              ],
              includeText: true,
              textPosition: 'below',
              barWidth: 1.5,
              barHeight: 16,
              quietZone: true,
              foregroundColor: '#000000',
              backgroundColor: '#ffffff',
              checkDigit: true,
              x: 15,
              y: 15,
              width: 65,
              height: 24,
              rotation: 0,
              opacity: 1,
              locked: false,
              visible: true,
              zIndex: currentTemplate.elements.length + 1,
            };
            updateElements([...currentTemplate.elements, newBarcode]);
            setSelectedElementIds([newBarcode.id]);
            showToast('Created new GS1-128 Barcode on canvas', 'success');
          }
        }}
      />

      {/* Serial Number & Counter Wizard Modal */}
      <SerialNumberWizardModal
        isOpen={isSerialNumberWizardOpen}
        onClose={() => setIsSerialNumberWizardOpen(false)}
        onApply={(serialItem) => {
          const selectedEl = currentTemplate.elements.find((e) => selectedElementIds.includes(e.id));
          if (selectedEl) {
            const currentSources = selectedEl.dataSources || [];
            const newItem: any = {
              id: `ds-${Date.now()}`,
              name: serialItem.name || 'Serial Counter',
              type: 'serial',
              value: '1',
              enabled: true,
              ...serialItem,
            };
            updateSingleElement(selectedEl.id, {
              dataSources: [...currentSources, newItem],
            });
            showToast(`Added Serial Counter to "${selectedEl.name}"`, 'success');
          } else {
            // Insert a new barcode or text element with serial counter
            const newBarcode: LabelElement = {
              id: `el-serial-${Date.now()}`,
              name: 'Serialized Barcode',
              type: 'barcode',
              symbology: 'code128',
              value: 'SN-000001',
              dataSources: [
                {
                  id: `ds-${Date.now()}`,
                  name: serialItem.name || 'Serial Counter',
                  type: 'serial',
                  value: '1',
                  enabled: true,
                  ...serialItem,
                } as any,
              ],
              includeText: true,
              textPosition: 'below',
              barWidth: 1.5,
              barHeight: 16,
              quietZone: true,
              foregroundColor: '#000000',
              backgroundColor: '#ffffff',
              checkDigit: true,
              x: 15,
              y: 15,
              width: 55,
              height: 22,
              rotation: 0,
              opacity: 1,
              locked: false,
              visible: true,
              zIndex: currentTemplate.elements.length + 1,
            };
            updateElements([...currentTemplate.elements, newBarcode]);
            setSelectedElementIds([newBarcode.id]);
            showToast('Created new Serialized Barcode on canvas', 'success');
          }
        }}
      />

      {/* Date & Time Offset Engine Wizard Modal */}
      <DateTimeWizardModal
        isOpen={isDateTimeWizardOpen}
        onClose={() => setIsDateTimeWizardOpen(false)}
        onApply={(dateItem) => {
          const selectedEl = currentTemplate.elements.find((e) => selectedElementIds.includes(e.id));
          if (selectedEl) {
            const currentSources = selectedEl.dataSources || [];
            const newItem: any = {
              id: `ds-${Date.now()}`,
              name: dateItem.name || 'Date Source',
              type: 'clock',
              value: '',
              enabled: true,
              ...dateItem,
            };
            updateSingleElement(selectedEl.id, {
              dataSources: [...currentSources, newItem],
            });
            showToast(`Added Date Source to "${selectedEl.name}"`, 'success');
          } else {
            const newText: LabelElement = {
              id: `el-date-${Date.now()}`,
              name: 'Date Label',
              type: 'text',
              text: 'Date Field',
              dataSources: [
                {
                  id: `ds-${Date.now()}`,
                  name: dateItem.name || 'Date Source',
                  type: 'clock',
                  value: '',
                  enabled: true,
                  ...dateItem,
                } as any,
              ],
              fontFamily: 'Helvetica',
              fontSize: 12,
              fontWeight: 'bold',
              fontStyle: 'normal',
              textDecoration: 'none',
              textAlign: 'left',
              verticalAlign: 'top',
              color: '#000000',
              lineHeight: 1.2,
              letterSpacing: 0,
              x: 15,
              y: 15,
              width: 45,
              height: 10,
              rotation: 0,
              opacity: 1,
              locked: false,
              visible: true,
              zIndex: currentTemplate.elements.length + 1,
            };
            updateElements([...currentTemplate.elements, newText]);
            setSelectedElementIds([newText.id]);
            showToast('Created new Dynamic Date element on canvas', 'success');
          }
        }}
      />

      {/* Database Connection Manager Modal */}
      <DatabaseConnectionModal
        isOpen={isDatabaseConnectionModalOpen}
        onClose={() => setIsDatabaseConnectionModalOpen(false)}
        currentConnection={currentTemplate.databaseConnection}
        onApplyConnection={(conn) => {
          updateTemplate({
            databaseConnection: conn,
            sampleRecords: conn.records,
          });
          setViewport((p) => ({ ...p, previewRecordIndex: 0 }));
          logAction('IMPORT_DATA', `Connected database "${conn.name}" with ${conn.records.length} records`);
          showToast(`Connected database "${conn.name}" (${conn.records.length} records)`, 'success');
        }}
      />

      {/* Revision Timeline & Version Control Modal */}
      <TemplateVersionHistoryModal
        isOpen={isVersionHistoryModalOpen}
        onClose={() => setIsVersionHistoryModalOpen(false)}
        template={currentTemplate}
        onRollback={(rev) => {
          if (rev.templateSnapshot) {
            updateTemplate(rev.templateSnapshot);
            showToast(`Rolled back to revision v${rev.version}`, 'success');
            logAction('ROLLBACK_VERSION', `Rolled back template "${currentTemplate.name}" to version ${rev.version}`);
          }
        }}
      />

      {/* Page Setup Dialog (Dimensions, Margins, Shape, Stocks) */}
      <PageSetupModal
        isOpen={isPageSetupOpen}
        onClose={() => setIsPageSetupOpen(false)}
        template={currentTemplate}
        onApplyPageSetup={(updates) => {
          updateTemplate(updates);
          showToast('Updated Label Page Setup & Dimensions', 'success');
        }}
      />

      {/* Text Object Properties Modal */}
      <TextPropertiesModal
        isOpen={isTextPropertiesOpen}
        onClose={() => setIsTextPropertiesOpen(false)}
        element={
          (currentTemplate.elements.find((e) => selectedElementIds.includes(e.id) && e.type === 'text') ||
            currentTemplate.elements.find((e) => e.type === 'text') ||
            null) as any
        }
        onUpdateElement={updateSingleElement}
        availableVariables={currentTemplate.variables}
        datasets={datasets}
        currentRecord={currentRecordData}
        onConnectDataset={handleConnectDatasetToTemplate}
      />

      {/* Shape Properties Modal */}
      <ShapePropertiesModal
        isOpen={isShapePropertiesOpen}
        onClose={() => setIsShapePropertiesOpen(false)}
        element={
          (currentTemplate.elements.find((e) => selectedElementIds.includes(e.id) && e.type === 'shape') ||
            currentTemplate.elements.find((e) => e.type === 'shape') ||
            null) as any
        }
        onUpdateElement={updateSingleElement}
      />

      {/* Named Data Sources (Global Variables) Modal */}
      <NamedDataSourcesModal
        isOpen={isNamedDataSourcesOpen}
        onClose={() => setIsNamedDataSourcesOpen(false)}
        variables={currentTemplate.variables}
        onUpdateVariables={(vars) => {
          updateTemplate({ variables: vars });
          showToast('Updated Named Data Sources', 'success');
        }}
      />

      {/* Document Event Scripts (VBScript / JS) Modal */}
      <DocumentEventScriptsModal
        isOpen={isDocumentScriptsOpen}
        onClose={() => setIsDocumentScriptsOpen(false)}
        onSaveScripts={(scripts) => {
          showToast('Saved Document Event Scripts', 'success');
        }}
      />

      {/* Formula & Expression Builder Modal */}
      <FormulaBuilderModal
        isOpen={isFormulaBuilderOpen}
        onClose={() => setIsFormulaBuilderOpen(false)}
        initialExpression=""
        onApplyFormula={(formula) => {
          showToast(`Formula applied: ${formula}`, 'success');
        }}
        sampleRecord={currentTemplate.sampleRecords[viewport.previewRecordIndex] || {}}
        variables={currentTemplate.variables}
        namedDataSources={currentTemplate.namedDataSources}
      />

      {/* Print-Time Data Entry Form Designer Modal */}
      <DataEntryFormDesignerModal
        isOpen={isDataEntryDesignerOpen}
        template={currentTemplate}
        onClose={() => setIsDataEntryDesignerOpen(false)}
        onSave={(formDef) => {
          updateTemplate({ dataEntryForm: formDef });
          showToast('Saved Data Entry Form configuration to template', 'success');
        }}
      />

      {/* Operator Touch Print Station Runtime Modal */}
      <DataEntryFormRuntime
        isOpen={isDataEntryRuntimeOpen}
        template={currentTemplate}
        printers={printers}
        onClose={() => setIsDataEntryRuntimeOpen(false)}
        onPrint={async (enteredData, printerId, copies) => {
          const targetPrinter = printers.find((p) => p.id === printerId) || printers[0];
          EnterprisePrintSpooler.getInstance().dispatchJob({
            template: currentTemplate,
            printer: targetPrinter,
            copies,
            records: [enteredData],
          });
          showToast(`Dispatched ${copies} label(s) to ${targetPrinter.name}`, 'success');
        }}
      />

      {/* BarTender Excel Connect Wizard Modal */}
      <ExcelConnectWizardModal
        isOpen={isExcelWizardOpen}
        onClose={() => setIsExcelWizardOpen(false)}
        onComplete={async (cfg) => {
          let savedDatasetId = `excel-${Date.now()}`;
          let savedFilePath = cfg.filePath;
          try {
            const res = await apiService.datasets.linkExcel({
              name: cfg.datasetName,
              mode: cfg.mode,
              filePath: cfg.filePath,
              sheetName: cfg.sheetName,
              headerRow: cfg.headerRow,
              columns: cfg.columns.map((c) => c.name),
              records: cfg.records,
              autoRefresh: cfg.autoRefresh,
              quantityColumn: cfg.quantityColumn,
              createdBy: currentUser.name,
              base64Content: (cfg as any).base64Content,
            });
            if (res?.dataset?.id) {
              savedDatasetId = res.dataset.id;
            }
            if (res?.dataset?.filePath) {
              savedFilePath = res.dataset.filePath;
            }
          } catch (e) {
            console.warn('[BarcodeFlow] Backend linkExcel warning:', e);
          }

          const conn: DatabaseConnectionConfig = {
            id: savedDatasetId,
            name: cfg.datasetName,
            type: 'excel',
            mode: cfg.mode,
            filePath: savedFilePath,
            sheetName: cfg.sheetName,
            headerRow: cfg.headerRow,
            status: 'CONNECTED',
            fields: cfg.columns.map((c) => c.name),
            records: cfg.records,
            autoRefresh: cfg.autoRefresh,
            quantityColumn: cfg.quantityColumn,
            columns: cfg.columns,
          };
          updateTemplate({
            databaseConnection: conn,
            sampleRecords: cfg.records,
          });
          await refreshDatasets();
          setViewport((p) => ({ ...p, previewRecordIndex: 0 }));

          const electronAPI = (window as any).electronAPI;
          if (electronAPI?.watchExcelFile && cfg.filePath) {
            await electronAPI.watchExcelFile(cfg.filePath, savedDatasetId);
          }

          logAction('IMPORT_DATA', `Connected ${cfg.mode} Excel dataset "${cfg.datasetName}" with ${cfg.records.length} records`);
          showToast(
            cfg.mode === 'linked'
              ? `Linked template to ${cfg.sheetName}$ in Excel file!`
              : `Imported ${cfg.records.length} records from Excel snapshot!`,
            'success'
          );
        }}
      />

      {/* BarTender Record Browser & Filter Modal */}
      <RecordBrowserModal
        isOpen={isRecordBrowserOpen}
        onClose={() => setIsRecordBrowserOpen(false)}
        dataset={
          currentTemplate.databaseConnection || {
            id: 'sample-ds',
            name: currentTemplate.name,
            type: 'sample',
            fields: Object.keys(activeDatasetRecords[0] || {}),
            records: activeDatasetRecords,
          }
        }
        activeRecordIndex={viewport.previewRecordIndex}
        onSelectActiveRecord={(idx) => {
          setViewport((v) => ({ ...v, previewRecordIndex: idx }));
          showToast(`Active Designer preview set to Record #${idx + 1}`, 'info');
        }}
        selectedIndices={selectedRecordIndices}
        onToggleRecordSelection={(idx) => {
          setSelectedRecordIndices((prev) =>
            prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
          );
        }}
        onSelectAll={(indices) => setSelectedRecordIndices(indices)}
        onClearSelection={() => setSelectedRecordIndices([])}
        onOpenPrintDialog={() => setIsPrintDialogOpen(true)}
      />

      {/* Save As BarTender Modal */}
      <SaveAsModal
        isOpen={isSaveAsModalOpen}
        initialName={currentTemplate.name}
        onSave={(newName, desc) => handleSaveDocumentAs(activeDocumentInstanceId, newName, desc)}
        onClose={() => setIsSaveAsModalOpen(false)}
      />

      {/* Unsaved Changes Confirmation Modal */}
      <UnsavedChangesModal
        isOpen={!!unsavedDocModal?.isOpen}
        documentName={unsavedDocModal?.documentName || 'Document'}
        onSave={async () => {
          if (unsavedDocModal?.instanceId) {
            await handleSaveDocument(unsavedDocModal.instanceId);
            handlePerformCloseTab(unsavedDocModal.instanceId);
          }
          setUnsavedDocModal(null);
        }}
        onDontSave={() => {
          if (unsavedDocModal?.instanceId) {
            handlePerformCloseTab(unsavedDocModal.instanceId);
          }
          setUnsavedDocModal(null);
        }}
        onCancel={() => setUnsavedDocModal(null)}
      />

      {/* New Document Wizard Modal */}
      <NewDocumentWizardModal
        isOpen={isNewDocWizardOpen}
        onClose={() => setIsNewDocWizardOpen(false)}
        currentUser={currentUser.name}
        onFinish={(newTpl) => {
          const newDoc: OpenDocument = {
            instanceId: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            documentId: newTpl.id,
            type: 'template',
            name: newTpl.name || 'Untitled Document',
            isDirty: false,
            isNew: false,
            template: newTpl,
            selectedElementIds: [],
            history: { entries: [newTpl.elements || []], index: 0 },
            viewState: { zoom: 1.25, panX: 40, panY: 40 },
            dataState: { currentRecordIndex: 0, selectedRecordIndices: [] },
          };
          setTemplates((prev) => [newTpl, ...prev]);
          setOpenDocuments((prev) => [...prev, newDoc]);
          setActiveDocumentInstanceId(newDoc.instanceId);
          setCurrentTemplateId(newTpl.id);
          setSelectedElementIds([]);
          setHistory([newTpl.elements || []]);
          setHistoryIndex(0);
          setViewport((prev) => ({ ...prev, previewRecordIndex: 0 }));
          setIsNewDocWizardOpen(false);
          showToast(`Created document "${newTpl.name}"`, 'success');
        }}
      />

      {/* Printer & Hardware Setup Manager Modal */}
      <PrinterManagerModal
        isOpen={isPrinterManagerOpen}
        onClose={() => setIsPrinterManagerOpen(false)}
        onPrinterSelected={(p) => {
          showToast(`Selected printer: ${p.name}`, 'info');
        }}
      />

      {/* BarcodeFlow Desktop Startup & Welcome Dialog */}
      <WelcomeModal
        isOpen={isWelcomeOpen}
        onClose={() => setIsWelcomeOpen(false)}
        onNewDocument={() => setIsNewDocWizardOpen(true)}
        onOpenExisting={handleOpenDocumentFile}
        onOpenRecentDocument={handleOpenRecentDocument}
        recentDocuments={recentDocuments}
        onRefreshRecent={() => setRecentDocuments(getRecentDocuments())}
        showWelcomeOnStartup={showWelcomeOnStartup}
        onToggleShowWelcomeOnStartup={handleToggleShowWelcomeOnStartup}
      />
    </div>
  );
}
