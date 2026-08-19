import React, { useState, useEffect, useCallback, useRef } from 'react';
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
} from './types';
import { INITIAL_TEMPLATES } from './services/initialTemplates';
import { INITIAL_PRINTERS, INITIAL_PRINT_JOBS, INITIAL_AUDIT_LOGS, INITIAL_USERS, INITIAL_BATCH_JOBS } from './services/mockDataService';
import { MenuBar } from './components/menu/MenuBar';
import { ObjectToolbar } from './components/toolbar/ObjectToolbar';
import { LeftDockPanel } from './components/sidebar/LeftDockPanel';
import { RightDockPanel } from './components/sidebar/RightDockPanel';
import { DesignerCanvas } from './components/canvas/DesignerCanvas';
import { DashboardView } from './components/views/DashboardView';
import { PrintQueueView } from './components/views/PrintQueueView';
import { WorkflowView } from './components/views/WorkflowView';
import { ViewerPrintStationView } from './components/views/ViewerPrintStationView';
import { LoginView } from './components/views/LoginView';

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
import { ValidationInspectorPanel } from './components/canvas/ValidationInspectorPanel';
import { RecordNavigationBar } from './components/canvas/RecordNavigationBar';

import { exportLabelsToPDF } from './services/pdfExportService';
import { generateZPL } from './services/zplEngine';
import { calculateGS1CheckDigit } from './services/gs1Engine';
import { apiService } from './services/apiService';
import { ZoomIn, ZoomOut, Maximize2, ShieldCheck, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';

export default function App() {
  // --- STATE ---
  const [templates, setTemplates] = useState<LabelTemplate[]>(INITIAL_TEMPLATES);
  const [currentTemplateId, setCurrentTemplateId] = useState<string>(INITIAL_TEMPLATES[0].id);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<
    'select' | 'text' | 'barcode' | 'qr' | 'datamatrix' | 'rect' | 'circle' | 'line' | 'table' | 'image'
  >('select');
  const [activeView, setActiveView] = useState<'designer' | 'dashboard' | 'queue' | 'workflow' | 'viewer'>('designer');

  // Enterprise Systems State
  const [printers, setPrinters] = useState<PrinterDefinition[]>(INITIAL_PRINTERS);
  const [printJobs, setPrintJobs] = useState<PrintJob[]>(INITIAL_PRINT_JOBS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [currentUser, setCurrentUser] = useState<UserProfile>(INITIAL_USERS[0]);
  const [batchJobs, setBatchJobs] = useState<any[]>(INITIAL_BATCH_JOBS);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

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
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isSerialNumberWizardOpen, setIsSerialNumberWizardOpen] = useState(false);
  const [isDateTimeWizardOpen, setIsDateTimeWizardOpen] = useState(false);
  const [isDatabaseConnectionModalOpen, setIsDatabaseConnectionModalOpen] = useState(false);
  const [isVersionHistoryModalOpen, setIsVersionHistoryModalOpen] = useState(false);
  const [isValidationInspectorOpen, setIsValidationInspectorOpen] = useState(false);
  const [isPageSetupOpen, setIsPageSetupOpen] = useState(false);
  const [isTextPropertiesOpen, setIsTextPropertiesOpen] = useState(false);
  const [isShapePropertiesOpen, setIsShapePropertiesOpen] = useState(false);
  const [isNamedDataSourcesOpen, setIsNamedDataSourcesOpen] = useState(false);
  const [isDocumentScriptsOpen, setIsDocumentScriptsOpen] = useState(false);

  // Current Template Reference
  const rawTemplate = templates.find((t) => t.id === currentTemplateId) || templates[0] || INITIAL_TEMPLATES[0];
  const currentTemplate: LabelTemplate = {
    ...rawTemplate,
    elements: rawTemplate?.elements || [],
    variables: rawTemplate?.variables || [],
    sampleRecords: rawTemplate?.sampleRecords && rawTemplate.sampleRecords.length > 0 ? rawTemplate.sampleRecords : [{}],
    tags: rawTemplate?.tags || ['Draft'],
    dimensions: rawTemplate?.dimensions || { width: 100, height: 75, unit: 'mm', dpi: 300, orientation: 'landscape' },
    margins: rawTemplate?.margins || { top: 2, right: 2, bottom: 2, left: 2, bleed: 1, safeZone: 2 },
  };

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
        const [apiTemplates, apiPrinters, apiPrintJobs, apiBatchJobs, apiAuditLogs] = await Promise.allSettled([
          apiService.templates.list(),
          apiService.printers.list(),
          apiService.printJobs.list(),
          apiService.batchJobs.list(),
          apiService.auditLogs.list(),
        ]);

        if (apiTemplates.status === 'fulfilled' && apiTemplates.value?.length > 0) {
          setTemplates(apiTemplates.value);
          setCurrentTemplateId(apiTemplates.value[0].id);
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

  // Update Template Properties
  const updateTemplate = useCallback(
    (updates: Partial<LabelTemplate>) => {
      setTemplates((prev) =>
        prev.map((t) => (t.id === currentTemplateId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t))
      );
    },
    [currentTemplateId]
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
      x: 10,
      y: 10,
      width,
      height,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: currentTemplate.elements.length + 1,
    };
    updateElements([...currentTemplate.elements, newEl]);
    setSelectedElementIds([newEl.id]);
    setActiveTool('select');
  };

  const handleInsertBarcode = (symbology: BarcodeSymbology = 'code128') => {
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
      x: 10,
      y: 20,
      width: 55,
      height: 22,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: currentTemplate.elements.length + 1,
    };
    updateElements([...currentTemplate.elements, newEl]);
    setSelectedElementIds([newEl.id]);
    setActiveTool('select');
  };

  const handleInsertQR = () => {
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
      x: 10,
      y: 20,
      width: 25,
      height: 25,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: currentTemplate.elements.length + 1,
    };
    updateElements([...currentTemplate.elements, newEl]);
    setSelectedElementIds([newEl.id]);
    setActiveTool('select');
  };

  const handleInsertDataMatrix = () => {
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
      x: 10,
      y: 20,
      width: 20,
      height: 20,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: currentTemplate.elements.length + 1,
    };
    updateElements([...currentTemplate.elements, newEl]);
    setSelectedElementIds([newEl.id]);
    setActiveTool('select');
  };

  const handleInsertShape = (shapeType: 'rectangle' | 'circle' | 'line') => {
    const isLine = shapeType === 'line';
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
      x: 10,
      y: 10,
      width: isLine ? 50 : 35,
      height: isLine ? 1 : 25,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: currentTemplate.elements.length + 1,
    };
    updateElements([...currentTemplate.elements, newEl]);
    setSelectedElementIds([newEl.id]);
    setActiveTool('select');
  };

  const handleInsertTable = () => {
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
      x: 10,
      y: 10,
      width: 70,
      height: 18,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: currentTemplate.elements.length + 1,
    };
    updateElements([...currentTemplate.elements, newEl]);
    setSelectedElementIds([newEl.id]);
    setActiveTool('select');
  };

  const handleInsertImage = () => {
    const newEl: LabelElement = {
      id: `el-img-${Date.now()}`,
      name: 'Industrial Caution Symbol',
      type: 'image',
      src: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=120&h=120&fit=crop',
      objectFit: 'contain',
      grayscale: true,
      invert: false,
      aspectRatioLocked: true,
      x: 10,
      y: 10,
      width: 18,
      height: 18,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: currentTemplate.elements.length + 1,
    };
    updateElements([...currentTemplate.elements, newEl]);
    setSelectedElementIds([newEl.id]);
    setActiveTool('select');
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

  // Clipboard & Manipulation Handlers
  const handleCopy = () => {
    const selected = currentTemplate.elements.filter((el) => selectedElementIds.includes(el.id));
    if (selected.length > 0) {
      setClipboard(JSON.parse(JSON.stringify(selected)));
      showToast(`Copied ${selected.length} element(s) to clipboard`, 'info');
    }
  };

  const handleCut = () => {
    handleCopy();
    handleDeleteSelected();
  };

  const handlePaste = () => {
    if (clipboard.length === 0) return;
    const pasted = clipboard.map((el, idx) => ({
      ...el,
      id: `el-pasted-${Date.now()}-${idx}`,
      name: `${el.name} (Copy)`,
      x: el.x + 4,
      y: el.y + 4,
      zIndex: currentTemplate.elements.length + idx + 1,
    }));
    updateElements([...currentTemplate.elements, ...pasted]);
    setSelectedElementIds(pasted.map((p) => p.id));
    showToast(`Pasted ${pasted.length} element(s)`, 'success');
  };

  const handleDuplicateSelected = () => {
    const selected = currentTemplate.elements.filter((el) => selectedElementIds.includes(el.id));
    if (selected.length === 0) return;
    const duplicates = selected.map((el, idx) => ({
      ...el,
      id: `el-dup-${Date.now()}-${idx}`,
      name: `${el.name} (Copy)`,
      x: el.x + 3,
      y: el.y + 3,
      zIndex: currentTemplate.elements.length + idx + 1,
    }));
    updateElements([...currentTemplate.elements, ...duplicates]);
    setSelectedElementIds(duplicates.map((d) => d.id));
    showToast(`Duplicated ${duplicates.length} element(s)`, 'success');
  };

  const handleDeleteSelected = () => {
    if (selectedElementIds.length === 0) return;
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

  const handleNewTemplate = async () => {
    const newTmpl: LabelTemplate = {
      id: `tmpl-${Date.now()}`,
      name: 'Untitled Industrial Label',
      description: 'Custom industrial barcode label',
      category: 'Manufacturing',
      version: '1.0',
      status: 'draft',
      dimensions: {
        width: 100,
        height: 75,
        unit: 'mm',
        dpi: 300,
        orientation: 'landscape',
      },
      margins: { top: 2, right: 2, bottom: 2, left: 2, bleed: 1, safeZone: 2 },
      tags: ['Custom', 'Direct Thermal'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: currentUser.name,
      variables: [
        { id: 'v1', name: 'PRODUCT_NAME', type: 'static', defaultValue: 'INDUSTRIAL ASSEMBLY' },
        { id: 'v2', name: 'SERIAL_NO', type: 'counter', defaultValue: 'SN-001001', counterStart: 1001 },
      ],
      sampleRecords: [{ PRODUCT_NAME: 'INDUSTRIAL ASSEMBLY', SERIAL_NO: 'SN-001001' }],
      elements: [],
    };
    setTemplates((prev) => [newTmpl, ...prev]);
    setCurrentTemplateId(newTmpl.id);
    showToast('Created new blank label template (synced to API)', 'success');
    logAction('CREATE_TEMPLATE', `Created blank template "${newTmpl.name}"`);

    try {
      await apiService.templates.create(newTmpl);
    } catch (err) {
      console.warn('API error creating template:', err);
    }
  };

  const handleSaveTemplate = async () => {
    const updatedTags = Array.from(new Set([...(currentTemplate.tags || []), 'Draft']));
    const savedTemplate: LabelTemplate = {
      ...currentTemplate,
      status: currentTemplate.status === 'published' || currentTemplate.status === 'approved' ? currentTemplate.status : 'draft',
      tags: updatedTags,
      updatedAt: new Date().toISOString(),
      createdBy: currentTemplate.createdBy || currentUser.name,
    };

    setTemplates((prev) => {
      const exists = prev.some((t) => t.id === savedTemplate.id);
      if (exists) {
        return prev.map((t) => (t.id === savedTemplate.id ? savedTemplate : t));
      }
      return [savedTemplate, ...prev];
    });

    logAction('EDIT_TEMPLATE', `Saved template "${savedTemplate.name}" to My Drafts`);
    showToast(`Template "${savedTemplate.name}" saved to database via API!`, 'success');

    try {
      await apiService.templates.save(savedTemplate);
    } catch (err) {
      console.warn('API error saving template:', err);
    }
  };

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

  const handleOpenTemplateFile = () => {
    handleImportJSON();
  };

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid capturing keystrokes when editing inputs
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault();
          if (e.shiftKey) handleRedo();
          else handleUndo();
        } else if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          handleRedo();
        } else if (e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          handleCopy();
        } else if (e.key === 'x' || e.key === 'X') {
          e.preventDefault();
          handleCut();
        } else if (e.key === 'v' || e.key === 'V') {
          e.preventDefault();
          handlePaste();
        } else if (e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          handleDuplicateSelected();
        } else if (e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          handleSelectAll();
        } else if (e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          setIsPrintDialogOpen(true);
        } else if (e.key === 'e' || e.key === 'E') {
          e.preventDefault();
          setIsZplExportOpen(true);
        } else if (e.key === 's' || e.key === 'S') {
          e.preventDefault();
          handleSaveTemplate();
        } else if (e.key === 'q' || e.key === 'Q') {
          e.preventDefault();
          handleLogout();
        } else if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          setViewport((prev) => ({ ...prev, zoom: Math.min(prev.zoom + 0.25, 4.0) }));
        } else if (e.key === '-') {
          e.preventDefault();
          setViewport((prev) => ({ ...prev, zoom: Math.max(prev.zoom - 0.25, 0.25) }));
        } else if (e.key === '0') {
          e.preventDefault();
          handleZoomFit();
        }
      } else {
        if (e.key === 'Delete' || e.key === 'Backspace') {
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
    selectedElementIds,
    currentTemplate.elements,
    handleUndo,
    handleRedo,
    handleCopy,
    handleCut,
    handlePaste,
    handleDuplicateSelected,
    handleDeleteSelected,
    updateMultipleElements,
  ]);

  // Current record bound data for preview
  const currentRecordData = currentTemplate?.sampleRecords?.[viewport.previewRecordIndex] || currentTemplate?.sampleRecords?.[0] || {};

  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    // After login, direct to BarcodeFlow Dashboard Portal (as requested)
    setActiveView('dashboard');
    showToast(`Welcome ${user.name}! BarcodeFlow Label Management portal loaded.`, 'success');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    showToast('Signed out successfully. Please log in to continue.', 'info');
  };

  // If not authenticated, render the dedicated LoginView
  if (!isAuthenticated) {
    return (
      <>
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
        <LoginView onLoginSuccess={handleLoginSuccess} initialUsers={INITIAL_USERS} />
      </>
    );
  }

  // If activeView is 'dashboard', render the dedicated BarcodeFlow Portal layout
  if (activeView === 'dashboard') {
    return (
      <>
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
        <DashboardView
          templates={templates}
          printers={printers}
          printJobs={printJobs}
          auditLogs={auditLogs}
          currentUser={currentUser}
          onOpenTemplate={(id) => {
            setCurrentTemplateId(id);
            setActiveView('designer');
            showToast('Template loaded in Barcode Automation Studio', 'success');
          }}
          onOpenDesigner={() => {
            setActiveView('designer');
            showToast('Barcode Automation Studio (Template Builder) loaded', 'success');
          }}
          onOpenPrintCenter={() => setIsPrintDialogOpen(true)}
          onOpenAuditLogs={() => setIsAuditLogsOpen(true)}
          onLogout={handleLogout}
          onCreateNewTemplate={() => {
            handleNewTemplate();
            setActiveView('designer');
          }}
          onDuplicateTemplate={handleDuplicateTemplate}
          onDeleteTemplate={handleDeleteTemplate}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 select-none font-sans">
      {/* Toast Notification Alert */}
      {notification && (
        <div
          className={`fixed top-12 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-xl text-xs font-semibold flex items-center gap-2 transition-all animate-in fade-in slide-in-from-top-2 ${
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

      {/* Global Top Menu Bar */}
      <MenuBar
        onNew={handleNewTemplate}
        onOpen={() => setActiveView('dashboard')}
        onSave={handleSaveTemplate}
        onSaveAs={async () => {
          const name = prompt('Enter new template name:', `${currentTemplate.name} (Copy)`);
          if (name) {
            const copy: LabelTemplate = {
              ...currentTemplate,
              id: `tmpl-${Date.now()}`,
              name,
              status: 'draft',
              tags: Array.from(new Set([...(currentTemplate.tags || []), 'Draft'])),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              createdBy: currentUser.name,
            };
            setTemplates((prev) => [copy, ...prev]);
            setCurrentTemplateId(copy.id);
            showToast(`Saved as "${name}" in My Drafts via API!`, 'success');
            logAction('CREATE_TEMPLATE', `Saved template as "${name}" in My Drafts`);
            try {
              await apiService.templates.create(copy);
            } catch (err) {
              console.warn('API save error in onSaveAs:', err);
            }
          }
        }}
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
        onZoomIn={() => setViewport((p) => ({ ...p, zoom: Math.min(p.zoom + 0.25, 4.0) }))}
        onZoomOut={() => setViewport((p) => ({ ...p, zoom: Math.max(p.zoom - 0.25, 0.25) }))}
        onZoomFit={() => setViewport((p) => ({ ...p, zoom: 1.0, panX: 40, panY: 40 }))}
        onZoom100={() => setViewport((p) => ({ ...p, zoom: 1.0 }))}
        onToggleGrid={() => setViewport((p) => ({ ...p, showGrid: !p.showGrid }))}
        onToggleRulers={() => setViewport((p) => ({ ...p, showRulers: !p.showRulers }))}
        onToggleGuides={() => setViewport((p) => ({ ...p, showGuides: !p.showGuides }))}
        onToggleSnap={() => setViewport((p) => ({ ...p, snapToGrid: !p.snapToGrid }))}
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
        onGroup={() => showToast('Elements grouped', 'info')}
        onUngroup={() => showToast('Elements ungrouped', 'info')}
        onLockToggle={handleLockToggle}
        onOpenBarcodePicker={() => setIsBarcodePickerOpen(true)}
        onOpenBarcodeProperties={() => setIsBarcodePropertiesOpen(true)}
        onOpenPrintDialog={() => setIsPrintDialogOpen(true)}
        onOpenBatchPrint={() => setIsPrintDialogOpen(true)}
        onOpenApproval={() => setIsApprovalModalOpen(true)}
        onOpenAuditLogs={() => setIsAuditLogsOpen(true)}
        onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onOpenDataImport={() => setIsDatabaseConnectionModalOpen(true)}
        onOpenSerialNumberWizard={() => setIsSerialNumberWizardOpen(true)}
        onOpenDateTimeWizard={() => setIsDateTimeWizardOpen(true)}
        onOpenVersionHistory={() => setIsVersionHistoryModalOpen(true)}
        onToggleValidationInspector={() => setIsValidationInspectorOpen((p) => !p)}
        onOpenGs1Wizard={() => setIsGs1WizardOpen(true)}
        onPageSetup={() => setIsPageSetupOpen(true)}
        onOpenNamedDataSources={() => setIsNamedDataSourcesOpen(true)}
        onOpenDocumentScripts={() => setIsDocumentScriptsOpen(true)}
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
      />

      {/* Main Content Area */}
      {activeView === 'designer' && (
        <div className="flex-1 flex flex-col overflow-hidden bg-[#9fbddb]">
          {/* BarTender Dual-Row Standard & Formatting Toolbar */}
          <ObjectToolbar
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            onNew={handleNewTemplate}
            onOpen={handleOpenTemplateFile}
            onSave={handleSaveTemplate}
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
            onZoomIn={() => setViewport((p) => ({ ...p, zoom: Math.min(p.zoom + 0.25, 8.0) }))}
            onZoomOut={() => setViewport((p) => ({ ...p, zoom: Math.max(p.zoom - 0.25, 0.2) }))}
            onZoom100={() => setViewport((p) => ({ ...p, zoom: 1.0 }))}
            onZoomFit={handleZoomFit}
            showGrid={viewport.showGrid}
            onToggleGrid={() => setViewport((p) => ({ ...p, showGrid: !p.showGrid }))}
            showRulers={viewport.showRulers}
            onToggleRulers={() => setViewport((p) => ({ ...p, showRulers: !p.showRulers }))}
            showGuides={viewport.showGuides}
            onToggleGuides={() => setViewport((p) => ({ ...p, showGuides: !p.showGuides }))}
            snapToGrid={viewport.snapToGrid}
            onToggleSnap={() => setViewport((p) => ({ ...p, snapToGrid: !p.snapToGrid }))}
            onOpenBarcodeProperties={() => setIsBarcodePropertiesOpen(true)}
            selectedElement={currentTemplate.elements.find((e) => selectedElementIds.includes(e.id)) || null}
            onUpdateSelectedElement={(updates) => {
              const el = currentTemplate.elements.find((e) => selectedElementIds.includes(e.id));
              if (el) updateSingleElement(el.id, updates);
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
                currentRecordIndex={viewport.previewRecordIndex}
                onSelectRecordIndex={(idx) => setViewport((p) => ({ ...p, previewRecordIndex: idx }))}
                onClose={() => setShowLeftDock(false)}
              />
            )}

            {/* Central Precision Interactive Canvas & Bottom Database Stepper */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
              <div className="flex-1 overflow-hidden relative">
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
                  viewport={viewport}
                  setViewport={setViewport}
                  recordData={currentRecordData}
                  onCursorMove={(xMm, yMm) => setCursorPos({ x: xMm, y: yMm })}
                />

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
                          showToast(`Recalculated Modulo 10 check digit for "${el.name}"`, 'success');
                        }
                      }
                    }
                  }}
                  activeRecord={currentRecordData}
                />
              </div>

              {/* Bottom Database Record Navigator Bar */}
              <RecordNavigationBar
                connection={currentTemplate.databaseConnection}
                currentIndex={viewport.previewRecordIndex}
                onSelectIndex={(idx) => setViewport((p) => ({ ...p, previewRecordIndex: idx }))}
                onOpenDatabaseModal={() => setIsDatabaseConnectionModalOpen(true)}
              />
            </div>

            {/* Right Dock Toggle Button */}
            <button
              title="Toggle Object & Template Properties Panel"
              onClick={() => setShowRightDock(!showRightDock)}
              className="absolute right-8 top-1/2 -translate-y-1/2 z-30 bg-[#e4ebf5] hover:bg-white text-slate-700 border border-slate-400 p-0.5 rounded-l shadow-xs text-[10px]"
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
              />
            )}
          </div>
        </div>
      )}

      {/* Alternative Enterprise Views */}
      {activeView === 'dashboard' && (
        <DashboardView
          templates={templates}
          printers={printers}
          printJobs={printJobs}
          auditLogs={auditLogs}
          currentUser={currentUser}
          onOpenTemplate={(id) => {
            setCurrentTemplateId(id);
            setActiveView('designer');
          }}
          onOpenDesigner={() => setActiveView('designer')}
          onOpenPrintCenter={() => setIsPrintDialogOpen(true)}
          onOpenAuditLogs={() => setIsAuditLogsOpen(true)}
          onDuplicateTemplate={handleDuplicateTemplate}
          onDeleteTemplate={handleDeleteTemplate}
        />
      )}

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
        />
      )}

      {activeView === 'workflow' && (
        <WorkflowView
          templates={templates}
          currentUser={currentUser}
          onOpenTemplateInDesigner={(id) => {
            setCurrentTemplateId(id);
            setActiveView('designer');
          }}
          onUpdateTemplateStatus={async (templateId, status, comment, eSignature) => {
            setTemplates((prev) =>
              prev.map((t) =>
                t.id === templateId
                  ? {
                      ...t,
                      status,
                      approvedBy: (status === 'approved' || status === 'published') ? eSignature || currentUser.name : t.approvedBy,
                      approvedAt: (status === 'approved' || status === 'published') ? new Date().toISOString() : t.approvedAt,
                      updatedAt: new Date().toISOString(),
                    }
                  : t
              )
            );
            logAction('APPROVE_TEMPLATE', `Status of template updated to ${status.toUpperCase()} (${comment})`);
            showToast(`Template marked as ${status.toUpperCase()} (synced with API)`, 'success');

            try {
              await apiService.templates.updateStatus(templateId, status, comment, currentUser.name, eSignature);
            } catch (err) {
              console.warn('API error updating status:', err);
            }
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

      {/* All Dialogs & Modals */}
      <BarcodePropertiesModal
        isOpen={isBarcodePropertiesOpen}
        onClose={() => setIsBarcodePropertiesOpen(false)}
        element={
          (currentTemplate.elements.find(
            (e) => selectedElementIds.includes(e.id) && e.type === 'barcode'
          ) as any) ||
          (currentTemplate.elements.find((e) => e.type === 'barcode') as any) ||
          null
        }
        onUpdateElement={updateSingleElement}
        availableVariables={currentTemplate.variables}
      />

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
    </div>
  );
}
