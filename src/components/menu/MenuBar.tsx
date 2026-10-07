import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Save,
  Printer,
  Undo2,
  Redo2,
  Copy,
  Scissors,
  Clipboard,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
  QrCode,
  Barcode,
  Image as ImageIcon,
  Square,
  Circle,
  Table as TableIcon,
  Layers,
  Sparkles,
  ShieldCheck,
  History,
  Settings,
  HelpCircle,
  ChevronRight,
  Database,
  CheckCircle2,
  Share2,
  FileSpreadsheet,
  Download,
  Upload,
  Minus,
  X,
  Square as WindowSquare,
  RotateCcw,
  RotateCw,
  Sliders,
  LogOut,
  LayoutDashboard,
  Code2,
  Send,
  Eye,
  Clock,
  User,
  ChevronDown,
} from 'lucide-react';

interface MenuBarProps {
  onSubmitForApproval?: () => void;
  onNew: () => void;
  onOpenPrinterManager?: () => void;
  onOpen: () => void;
  onImportBarTender?: () => void;
  onCloseDocument?: () => void;
  onCloseAllDocuments?: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onSaveAll?: () => void;
  onPrintPreview?: () => void;
  onOpenDatabaseConnection?: () => void;
  onOpenWelcome?: () => void;
  onOpenPreferences?: () => void;
  onOpenSerializationRecovery?: () => void;
  orphanCount?: number;
  recentDocuments?: any[];
  onOpenRecentDocument?: (filePath: string) => void;
  onClearRecentDocuments?: () => void;
  onExitApp?: () => void;
  onExportPDF: () => void;
  onExportZPL: () => void;
  onExportJSON: () => void;
  onImportJSON: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onSelectAll: () => void;
  onDuplicate: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  canZoomViewport?: boolean;
  onZoom100: () => void;
  onToggleGrid: () => void;
  onToggleRulers: () => void;
  onToggleGuides: () => void;
  onToggleSnap: () => void;
  showGrid: boolean;
  showRulers: boolean;
  showGuides: boolean;
  snapToGrid: boolean;
  onInsertText: () => void;
  onInsertBarcode: () => void;
  onInsertQR: () => void;
  onInsertDataMatrix: () => void;
  onInsertShape: (type: 'rectangle' | 'circle' | 'line') => void;
  onInsertImage: () => void;
  onInsertTable: () => void;
  onInsertGS1Block: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onBringForward?: () => void;
  onSendBackward?: () => void;
  onAlign?: (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  onDistribute?: (axis: 'horizontal' | 'vertical') => void;
  onMakeSameWidth?: () => void;
  onMakeSameHeight?: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  onLockToggle: () => void;
  onOpenBarcodePicker: () => void;
  onOpenBarcodeProperties?: () => void;
  onOpenTextProperties?: () => void;
  onOpenProperties?: () => void;
  onOpenPrintDialog: () => void;
  onOpenBatchPrint: () => void;
  onOpenApproval: () => void;
  onOpenAuditLogs: () => void;
  onOpenAiAssistant: () => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
  onOpenSerialNumberWizard?: () => void;
  onOpenDateTimeWizard?: () => void;
  onOpenVersionHistory?: () => void;
  onToggleValidationInspector?: () => void;
  onOpenGs1Wizard?: () => void;
  onPageSetup?: () => void;
  onOpenNamedDataSources?: () => void;
  onOpenDocumentScripts?: () => void;
  onOpenScriptEditor?: () => void;
  onOpenDataImport?: () => void;
  onOpenFormulaBuilder?: () => void;
  onOpenDataEntryFormDesigner?: () => void;
  onOpenDataEntryRuntime?: () => void;
  onOpenExcelWizard?: () => void;
  onOpenRecordBrowser?: () => void;
  activeView: string;
  setActiveView: (view: any) => void;
  templateName: string;
  currentUser?: any;
  allUsers?: any[];
  onSwitchUser?: (user: any) => void;
  onLogout?: () => void;
}

export const MenuBar: React.FC<MenuBarProps> = (props) => {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMenu = (menuName: string) => {
    setOpenMenu(openMenu === menuName ? null : menuName);
  };
  const handleMenuClick = toggleMenu;

  const handleMenuHover = (menuName: string) => {
    if (openMenu !== null && openMenu !== menuName) {
      setOpenMenu(menuName);
    }
  };

  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  useEffect(() => {
    const checkMax = async () => {
      const electronAPI = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;
      if (electronAPI?.isWindowMaximized) {
        try {
          const max = await electronAPI.isWindowMaximized();
          setIsMaximized(max);
        } catch {}
      }
    };
    checkMax();

    const handleFullscreenChange = () => {
      setIsMaximized(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleMinimizeWindow = async () => {
    const electronAPI = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;
    if (electronAPI?.minimizeWindow) {
      await electronAPI.minimizeWindow();
    } else {
      // Browser mode: collapse or alert
      console.log('Minimize triggered');
    }
  };

  const handleMaximizeWindow = async () => {
    const electronAPI = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;
    if (electronAPI?.maximizeWindow) {
      try {
        const nowMax = await electronAPI.maximizeWindow();
        setIsMaximized(nowMax);
      } catch {}
    } else {
      // Web browser: Toggle Fullscreen
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
          setIsMaximized(true);
        } else {
          await document.exitFullscreen();
          setIsMaximized(false);
        }
      } catch (err) {
        console.warn('Fullscreen toggle:', err);
      }
    }
  };

  const handleCloseWindow = async () => {
    const electronAPI = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;
    if (electronAPI?.closeWindow) {
      await electronAPI.closeWindow();
    } else {
      props.setActiveView('dashboard');
    }
  };

  const executeAction = (action?: () => void) => {
    setOpenMenu(null);
    if (action) action();
  };

  return (
    <div className="flex flex-col select-none z-50">
      {/* 1. Classic Windows Window Title Bar */}
      <div className="h-7 bg-[#e8edf5] border-b border-[#cbd7e6] flex items-center justify-between px-2 text-slate-800 text-xs select-none shrink-0 overflow-hidden">
        {/* Left: Custom Modern Logo and Window Title */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Custom Brand Logo */}
          <div className="w-4 h-4 bg-gradient-to-tr from-blue-700 via-indigo-600 to-cyan-500 rounded flex items-center justify-center shadow-xs shrink-0">
            <svg viewBox="0 0 24 24" className="w-3 h-3 text-white fill-current">
              <path d="M2 4h2v16H2V4zm4 0h1v16H6V4zm3 0h2v16H9V4zm4 0h3v16h-3V4zm5 0h1v16h-1V4zm3 0h1v16h-1V4z" />
            </svg>
          </div>
          <span className="font-semibold text-slate-900 text-[11.5px] tracking-tight truncate max-w-[180px] sm:max-w-[320px] md:max-w-md lg:max-w-none">
            BarCode Automation Studio - [{props.templateName || 'Document1.btw *'}]
          </span>
        </div>

        {/* Right: Window Controls */}
        <div className="flex items-center -mr-2">
          <button
            type="button"
            onClick={handleMinimizeWindow}
            title="Minimize"
            className="w-10 h-7 flex items-center justify-center hover:bg-[#d5e0ee] text-slate-600 transition-colors cursor-pointer"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleMaximizeWindow}
            title={isMaximized ? "Restore" : "Maximize"}
            className="w-10 h-7 flex items-center justify-center hover:bg-[#d5e0ee] text-slate-600 transition-colors cursor-pointer"
          >
            {isMaximized ? (
              <Copy className="w-3 h-3" />
            ) : (
              <WindowSquare className="w-3 h-3" />
            )}
          </button>
          <button
            type="button"
            onClick={handleCloseWindow}
            title="Close Studio & Return to Dashboard"
            className="w-11 h-7 flex items-center justify-center hover:bg-red-600 hover:text-white text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Menu Bar (Classic BarTender Style) */}
      <div
        ref={menuBarRef}
        className="flex items-center justify-between h-7 px-2 bg-gradient-to-b from-[#f0f4fc] to-[#e2ebf7] border-b border-[#a0b8cf] text-slate-800 select-none text-[11.5px] font-sans shadow-2xs relative z-40"
      >
        <div className="flex items-center gap-0.5">
          {/* FILE MENU (BarTender Windows Architecture) */}
          <div className="relative">
            <button
              onClick={() => toggleMenu('file')}
              onMouseEnter={() => handleMenuHover('file')}
              className={`px-2 py-0.5 rounded-xs transition-colors cursor-pointer ${
                openMenu === 'file' ? 'bg-[#3399ff] text-white shadow-2xs' : 'hover:bg-[#dbe8f5] text-slate-800'
              }`}
            >
              File
            </button>
            {openMenu === 'file' && (
              <div className="absolute left-0 top-full mt-0.5 w-64 bg-white border border-[#b8c5d6] shadow-xl py-1 z-50 text-slate-800 text-[11.5px] rounded-xs">
                <MenuItem
                  icon={<FileText className="w-3.5 h-3.5 text-blue-600" />}
                  label="New..."
                  shortcut="Ctrl+N"
                  onClick={() => executeAction(props.onNew)}
                />
                <MenuItem
                  icon={<Upload className="w-3.5 h-3.5 text-amber-600" />}
                  label="Open..."
                  shortcut="Ctrl+O"
                  onClick={() => executeAction(props.onOpen)}
                />
                {props.onImportBarTender && (
                  <MenuItem icon={<Upload className="w-4 h-4" />} label="Import BarTender Template..."
                    onClick={() => executeAction(props.onImportBarTender)} />
                )}
                {props.onCloseDocument && (
                  <MenuItem
                    icon={<X className="w-3.5 h-3.5 text-slate-500" />}
                    label="Close"
                    shortcut="Ctrl+F4"
                    onClick={() => executeAction(props.onCloseDocument)}
                  />
                )}
                {props.onCloseAllDocuments && (
                  <MenuItem
                    icon={<X className="w-3.5 h-3.5 text-slate-400" />}
                    label="Close All"
                    onClick={() => executeAction(props.onCloseAllDocuments)}
                  />
                )}
                {props.onOpenWelcome && (
                  <MenuItem
                    icon={<Sparkles className="w-3.5 h-3.5 text-amber-500" />}
                    label="Welcome / Start Page..."
                    onClick={() => executeAction(props.onOpenWelcome)}
                  />
                )}
                <MenuDivider />
                <MenuItem
                  icon={<Save className="w-3.5 h-3.5 text-blue-700" />}
                  label="Save"
                  shortcut="Ctrl+S"
                  onClick={() => executeAction(props.onSave)}
                />
                <MenuItem
                  icon={<Copy className="w-3.5 h-3.5 text-slate-600" />}
                  label="Save As..."
                  shortcut="Ctrl+Shift+S"
                  onClick={() => executeAction(props.onSaveAs)}
                />
                {props.onSaveAll && (
                  <MenuItem
                    icon={<Save className="w-3.5 h-3.5 text-indigo-600" />}
                    label="Save All"
                    onClick={() => executeAction(props.onSaveAll)}
                  />
                )}
                <MenuDivider />

                {props.onOpenDatabaseConnection && (
                  <MenuItem
                    icon={<Database className="w-3.5 h-3.5 text-emerald-600" />}
                    label="Database Connection Setup..."
                    onClick={() => executeAction(props.onOpenDatabaseConnection)}
                  />
                )}
                {props.onPageSetup && (
                  <MenuItem
                    icon={<FileText className="w-3.5 h-3.5 text-blue-600" />}
                    label="Page Setup..."
                    onClick={() => executeAction(props.onPageSetup)}
                  />
                )}
                {props.onPrintPreview && (
                  <MenuItem
                    icon={<Eye className="w-3.5 h-3.5 text-indigo-600" />}
                    label="Print Preview"
                    shortcut="Ctrl+R"
                    onClick={() => executeAction(props.onPrintPreview)}
                  />
                )}
                <MenuItem
                  icon={<Printer className="w-3.5 h-3.5 text-blue-700" />}
                  label="Print..."
                  shortcut="Ctrl+P"
                  onClick={() => executeAction(props.onOpenPrintDialog)}
                />
                {props.onOpenPrinterManager && (
                  <MenuItem
                    icon={<Printer className="w-3.5 h-3.5 text-indigo-600" />}
                    label="Printers & Hardware Setup..."
                    onClick={() => executeAction(props.onOpenPrinterManager)}
                  />
                )}
                <MenuItem
                  icon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />}
                  label="Print Station Batch Spooler..."
                  onClick={() => executeAction(props.onOpenBatchPrint)}
                />
                <MenuDivider />
                <MenuItem
                  icon={<Download className="w-3.5 h-3.5 text-emerald-600" />}
                  label="Export High-Resolution PDF"
                  onClick={() => executeAction(props.onExportPDF)}
                />
                <MenuItem
                  icon={<Barcode className="w-3.5 h-3.5 text-purple-600" />}
                  label="Export Zebra ZPL / EPL Code..."
                  shortcut="Ctrl+E"
                  onClick={() => executeAction(props.onExportZPL)}
                />
                <MenuItem
                  icon={<Download className="w-3.5 h-3.5 text-slate-600" />}
                  label="Export Portable Editable Template (.bfl)..."
                  onClick={() => executeAction(props.onExportJSON)}
                />
                <MenuItem
                  icon={<Upload className="w-3.5 h-3.5 text-slate-600" />}
                  label="Import Document (.bfl / JSON)..."
                  onClick={() => executeAction(props.onImportJSON)}
                />
                {/* RECENT DOCUMENTS (BarTender Reference) */}
                {props.recentDocuments && props.recentDocuments.length > 0 && (
                  <>
                    <MenuDivider />
                    <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Recent Documents
                    </div>
                    {props.recentDocuments.slice(0, 5).map((rec: any, idx: number) => (
                      <MenuItem
                        key={rec.filePath}
                        icon={<FileText className="w-3 h-3 text-slate-400" />}
                        label={`${idx + 1}  ${rec.fileName || rec.filePath}`}
                        title={rec.filePath}
                        onClick={() => executeAction(() => props.onOpenRecentDocument?.(rec.filePath))}
                      />
                    ))}
                    {props.onClearRecentDocuments && (
                      <button
                        type="button"
                        onClick={() => executeAction(props.onClearRecentDocuments)}
                        className="w-full text-left px-7 py-1 text-[10px] text-slate-400 hover:text-red-600 hover:bg-slate-50 transition-colors"
                      >
                        Clear Recent Documents List
                      </button>
                    )}
                  </>
                )}
                <MenuDivider />
                <MenuItem
                  icon={<LogOut className="w-3.5 h-3.5 text-red-600" />}
                  label="Exit"
                  shortcut="Ctrl+Q"
                  onClick={() => executeAction(props.onExitApp || props.onLogout)}
                />
              </div>
            )}
          </div>

          {/* EDIT MENU */}
          <div className="relative">
            <button
              onClick={() => handleMenuClick('edit')}
              onMouseEnter={() => handleMenuHover('edit')}
              className={`px-2 py-0.5 rounded-xs transition-colors ${
                openMenu === 'edit' ? 'bg-[#cce0f5] text-blue-900' : 'hover:bg-[#e0e6ed] text-slate-800'
              }`}
            >
              Edit
            </button>
            {openMenu === 'edit' && (
              <div className="absolute left-0 top-full mt-0.5 w-56 bg-white border border-[#b8c5d6] shadow-lg py-1 z-50 text-slate-800 text-[11.5px]">
                <MenuItem
                  icon={<Undo2 className="w-3.5 h-3.5 text-blue-600" />}
                  label="Undo"
                  shortcut="Ctrl+Z"
                  disabled={!props.canUndo}
                  onClick={() => executeAction(props.onUndo)}
                />
                <MenuItem
                  icon={<Redo2 className="w-3.5 h-3.5 text-blue-600" />}
                  label="Redo"
                  shortcut="Ctrl+Y"
                  disabled={!props.canRedo}
                  onClick={() => executeAction(props.onRedo)}
                />
                <MenuDivider />
                <MenuItem
                  icon={<Scissors className="w-3.5 h-3.5 text-slate-600" />}
                  label="Cut"
                  shortcut="Ctrl+X"
                  onClick={() => executeAction(props.onCut)}
                />
                <MenuItem
                  icon={<Copy className="w-3.5 h-3.5 text-slate-600" />}
                  label="Copy"
                  shortcut="Ctrl+C"
                  onClick={() => executeAction(props.onCopy)}
                />
                <MenuItem
                  icon={<Clipboard className="w-3.5 h-3.5 text-amber-600" />}
                  label="Paste"
                  shortcut="Ctrl+V"
                  onClick={() => executeAction(props.onPaste)}
                />
                <MenuItem
                  icon={<Copy className="w-3.5 h-3.5 text-slate-600" />}
                  label="Duplicate"
                  shortcut="Ctrl+D"
                  onClick={() => executeAction(props.onDuplicate)}
                />
                <MenuItem
                  icon={<Trash2 className="w-3.5 h-3.5 text-red-600" />}
                  label="Delete"
                  shortcut="Del"
                  onClick={() => executeAction(props.onDelete)}
                />
                <MenuDivider />
                <MenuItem
                  icon={<CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
                  label="Select All"
                  shortcut="Ctrl+A"
                  onClick={() => executeAction(props.onSelectAll)}
                />
                {(props.onOpenProperties || props.onOpenTextProperties || props.onOpenBarcodeProperties) && (
                  <>
                    <MenuDivider />
                    <MenuItem
                      icon={<Sliders className="w-3.5 h-3.5 text-cyan-600" />}
                      label="Object Properties..."
                      shortcut="F8"
                      onClick={() => executeAction(props.onOpenProperties || props.onOpenBarcodeProperties!)}
                    />
                    {(props.onOpenScriptEditor || props.onOpenDocumentScripts) && (
                      <MenuItem
                        icon={<Code2 className="w-3.5 h-3.5 text-emerald-600" />}
                        label="Scripts..."
                        shortcut="Alt+Enter"
                        onClick={() => executeAction(props.onOpenScriptEditor || props.onOpenDocumentScripts!)}
                      />
                    )}
                  </>
                )}
                <MenuDivider />
                <MenuItem
                  icon={<Sliders className="w-3.5 h-3.5 text-slate-700" />}
                  label="Preferences..."
                  onClick={() => executeAction(props.onOpenPreferences || props.onOpenSettings)}
                />
              </div>
            )}
          </div>

          {/* VIEW MENU */}
          <div className="relative">
            <button
              onClick={() => handleMenuClick('view')}
              onMouseEnter={() => handleMenuHover('view')}
              className={`px-2 py-0.5 rounded-xs transition-colors ${
                openMenu === 'view' ? 'bg-[#cce0f5] text-blue-900' : 'hover:bg-[#e0e6ed] text-slate-800'
              }`}
            >
              View
            </button>
            {openMenu === 'view' && (
              <div className="absolute left-0 top-full mt-0.5 w-56 bg-white border border-[#b8c5d6] shadow-lg py-1 z-50 text-slate-800 text-[11.5px]">
                <MenuItem
                  icon={<ZoomIn className="w-3.5 h-3.5 text-blue-600" />}
                  label="Zoom In"
                  shortcut="Ctrl++"
                  onClick={() => executeAction(props.onZoomIn)}
                />
                <MenuItem
                  icon={<ZoomOut className="w-3.5 h-3.5 text-blue-600" />}
                  label="Zoom Out"
                  shortcut="Ctrl+-"
                  onClick={() => executeAction(props.onZoomOut)}
                />
                <MenuItem
                  label="Zoom 100% (Actual Size)"
                  shortcut="Ctrl+0"
                  onClick={() => executeAction(props.onZoom100)}
                />
                <MenuItem
                  icon={<Maximize2 className="w-3.5 h-3.5 text-slate-600" />}
                  label="Fit to Window"
                  shortcut="F3"
                  disabled={props.canZoomViewport === false}
                  onClick={() => executeAction(props.onZoomFit)}
                />
                <MenuDivider />
                <MenuItem
                  checked={props.showRulers}
                  label="Rulers"
                  onClick={() => executeAction(props.onToggleRulers)}
                />
                <MenuItem
                  checked={props.showGrid}
                  label="Grid"
                  onClick={() => executeAction(props.onToggleGrid)}
                />
                <MenuItem
                  checked={props.showGuides}
                  label="Guidelines"
                  onClick={() => executeAction(props.onToggleGuides)}
                />
                <MenuItem
                  checked={props.snapToGrid}
                  label="Snap to Grid / Objects"
                  onClick={() => executeAction(props.onToggleSnap)}
                />
              </div>
            )}
          </div>

          {/* CREATE MENU */}
          <div className="relative">
            <button
              onClick={() => handleMenuClick('create')}
              onMouseEnter={() => handleMenuHover('create')}
              className={`px-2 py-0.5 rounded-xs transition-colors ${
                openMenu === 'create' ? 'bg-[#cce0f5] text-blue-900' : 'hover:bg-[#e0e6ed] text-slate-800'
              }`}
            >
              Create
            </button>
            {openMenu === 'create' && (
              <div className="absolute left-0 top-full mt-0.5 w-60 bg-white border border-[#b8c5d6] shadow-lg py-1 z-50 text-slate-800 text-[11.5px]">
                <MenuItem
                  icon={<FileText className="w-3.5 h-3.5 text-blue-600" />}
                  label="Text Object..."
                  shortcut="T"
                  onClick={() => executeAction(props.onInsertText)}
                />
                <MenuItem
                  icon={<Barcode className="w-3.5 h-3.5 text-slate-900" />}
                  label="1D Barcode (Code128, EAN, UPC)..."
                  shortcut="B"
                  onClick={() => executeAction(props.onInsertBarcode)}
                />
                <MenuItem
                  icon={<QrCode className="w-3.5 h-3.5 text-purple-600" />}
                  label="2D QR Code..."
                  shortcut="Q"
                  onClick={() => executeAction(props.onInsertQR)}
                />
                <MenuItem
                  icon={<ShieldCheck className="w-3.5 h-3.5 text-blue-600" />}
                  label="GS1 DataMatrix (UDI / Pharma)..."
                  shortcut="M"
                  onClick={() => executeAction(props.onInsertDataMatrix)}
                />
                <MenuItem
                  icon={<ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />}
                  label="GS1 Barcode Wizard..."
                  shortcut="G"
                  onClick={() => executeAction(props.onInsertGS1Block)}
                />
                <MenuDivider />
                <MenuItem
                  icon={<Square className="w-3.5 h-3.5 text-slate-600" />}
                  label="Rectangle / Box"
                  onClick={() => executeAction(() => props.onInsertShape('rectangle'))}
                />
                <MenuItem
                  icon={<Circle className="w-3.5 h-3.5 text-slate-600" />}
                  label="Circle / Ellipse"
                  onClick={() => executeAction(() => props.onInsertShape('circle'))}
                />
                <MenuItem
                  icon={<TableIcon className="w-3.5 h-3.5 text-slate-600" />}
                  label="Specification Table..."
                  onClick={() => executeAction(props.onInsertTable)}
                />
                <MenuItem
                  icon={<ImageIcon className="w-3.5 h-3.5 text-amber-600" />}
                  label="Picture / GHS Symbol..."
                  onClick={() => executeAction(props.onInsertImage)}
                />
              </div>
            )}
          </div>

          {/* ARRANGE MENU */}
          <div className="relative">
            <button
              onClick={() => handleMenuClick('arrange')}
              onMouseEnter={() => handleMenuHover('arrange')}
              className={`px-2 py-0.5 rounded-xs transition-colors ${
                openMenu === 'arrange' ? 'bg-[#cce0f5] text-blue-900' : 'hover:bg-[#e0e6ed] text-slate-800'
              }`}
            >
              Arrange
            </button>
            {openMenu === 'arrange' && (
              <div className="absolute left-0 top-full mt-0.5 w-56 bg-white border border-[#b8c5d6] shadow-lg py-1 z-50 text-slate-800 text-[11.5px]">
                <MenuItem
                  label="Bring to Front"
                  shortcut="Ctrl+Shift+]"
                  onClick={() => executeAction(props.onBringToFront)}
                />
                <MenuItem
                  label="Send to Back"
                  shortcut="Ctrl+Shift+["
                  onClick={() => executeAction(props.onSendToBack)}
                />
                {props.onBringForward && (
                  <MenuItem
                    label="Bring Forward"
                    shortcut="Ctrl+]"
                    onClick={() => executeAction(props.onBringForward!)}
                  />
                )}
                {props.onSendBackward && (
                  <MenuItem
                    label="Send Backward"
                    shortcut="Ctrl+["
                    onClick={() => executeAction(props.onSendBackward!)}
                  />
                )}
                <MenuDivider />
                {props.onAlign && (
                  <>
                    <MenuItem label="Align Left" onClick={() => executeAction(() => props.onAlign!('left'))} />
                    <MenuItem label="Align Horizontal Center" onClick={() => executeAction(() => props.onAlign!('center'))} />
                    <MenuItem label="Align Right" onClick={() => executeAction(() => props.onAlign!('right'))} />
                    <MenuItem label="Align Top" onClick={() => executeAction(() => props.onAlign!('top'))} />
                    <MenuItem label="Align Vertical Middle" onClick={() => executeAction(() => props.onAlign!('middle'))} />
                    <MenuItem label="Align Bottom" onClick={() => executeAction(() => props.onAlign!('bottom'))} />
                    <MenuDivider />
                  </>
                )}
                {props.onDistribute && (
                  <>
                    <MenuItem label="Distribute Horizontally" onClick={() => executeAction(() => props.onDistribute!('horizontal'))} />
                    <MenuItem label="Distribute Vertically" onClick={() => executeAction(() => props.onDistribute!('vertical'))} />
                    <MenuDivider />
                  </>
                )}
                {props.onMakeSameWidth && (
                  <MenuItem label="Make Same Width" onClick={() => executeAction(props.onMakeSameWidth!)} />
                )}
                {props.onMakeSameHeight && (
                  <MenuItem label="Make Same Height" onClick={() => executeAction(props.onMakeSameHeight!)} />
                )}
                {(props.onMakeSameWidth || props.onMakeSameHeight) && <MenuDivider />}
                <MenuItem
                  label="Lock / Unlock Object"
                  shortcut="Ctrl+L"
                  onClick={() => executeAction(props.onLockToggle)}
                />
                <MenuItem
                  label="Group Objects"
                  shortcut="Ctrl+G"
                  onClick={() => executeAction(props.onGroup)}
                />
                <MenuItem
                  label="Ungroup Objects"
                  shortcut="Ctrl+U"
                  onClick={() => executeAction(props.onUngroup)}
                />
              </div>
            )}
          </div>

          {/* DATA MENU */}
          <div className="relative">
            <button
              onClick={() => handleMenuClick('data')}
              onMouseEnter={() => handleMenuHover('data')}
              className={`px-2 py-0.5 rounded-xs transition-colors ${
                openMenu === 'data' ? 'bg-[#cce0f5] text-blue-900' : 'hover:bg-[#e0e6ed] text-slate-800'
              }`}
            >
              Data
            </button>
            {openMenu === 'data' && (
              <div className="absolute left-0 top-full mt-0.5 w-68 bg-white border border-[#b8c5d6] shadow-lg py-1 z-50 text-slate-800 text-[11.5px]">
                {props.onOpenExcelWizard && (
                  <MenuItem
                    icon={<Database className="w-3.5 h-3.5 text-blue-600" />}
                    label="Link Excel Data Source (BarTender Live)..."
                    onClick={() => executeAction(props.onOpenExcelWizard!)}
                  />
                )}
                {props.onOpenRecordBrowser && (
                  <MenuItem
                    icon={<Sliders className="w-3.5 h-3.5 text-indigo-600" />}
                    label="Browse Records & Filter Data Grid..."
                    onClick={() => executeAction(props.onOpenRecordBrowser!)}
                  />
                )}
                <MenuItem
                  icon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />}
                  label="Connect Microsoft Excel File (Live Link)..."
                  onClick={() => executeAction(props.onOpenExcelWizard || props.onOpenDatabaseConnection!)}
                />
                <MenuItem
                  icon={<Database className="w-3.5 h-3.5 text-emerald-600" />}
                  label="Database Connection Setup..."
                  onClick={() => executeAction(props.onOpenDatabaseConnection || props.onOpenDataImport!)}
                />
                {props.onOpenNamedDataSources && (
                  <MenuItem
                    icon={<Sliders className="w-3.5 h-3.5 text-amber-600" />}
                    label="Named Data Sources (Global Variables)..."
                    onClick={() => executeAction(props.onOpenNamedDataSources!)}
                  />
                )}
                {props.onOpenFormulaBuilder && (
                  <MenuItem
                    icon={<Code2 className="w-3.5 h-3.5 text-indigo-600" />}
                    label="Formula & Expression Builder (Live Sandboxed)..."
                    onClick={() => executeAction(props.onOpenFormulaBuilder!)}
                  />
                )}
                <MenuDivider />
                {props.onOpenSerialNumberWizard && (
                  <MenuItem
                    icon={<Sliders className="w-3.5 h-3.5 text-blue-600" />}
                    label="Serialization & Sequences Wizard..."
                    onClick={() => executeAction(props.onOpenSerialNumberWizard!)}
                  />
                )}
                {props.onOpenDateTimeWizard && (
                  <MenuItem
                    icon={<Clock className="w-3.5 h-3.5 text-purple-600" />}
                    label="Date & Time Offset Engine Wizard..."
                    onClick={() => executeAction(props.onOpenDateTimeWizard!)}
                  />
                )}
                {props.onOpenGs1Wizard && (
                  <MenuItem
                    icon={<ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />}
                    label="GS1 Application Identifier (AI) Builder..."
                    onClick={() => executeAction(props.onOpenGs1Wizard!)}
                  />
                )}
                {props.onOpenDocumentScripts && (
                  <>
                    <MenuDivider />
                    <MenuItem
                      icon={<Code2 className="w-3.5 h-3.5 text-teal-600" />}
                      label="Document Event Scripts (JS / VBScript)..."
                      onClick={() => executeAction(props.onOpenDocumentScripts!)}
                    />
                  </>
                )}
              </div>
            )}
          </div>

          {/* PRINT MENU */}
          <div className="relative">
            <button
              onClick={() => handleMenuClick('print')}
              onMouseEnter={() => handleMenuHover('print')}
              className={`px-2 py-0.5 rounded-xs transition-colors ${
                openMenu === 'print' ? 'bg-[#cce0f5] text-blue-900' : 'hover:bg-[#e0e6ed] text-slate-800'
              }`}
            >
              Print
            </button>
            {openMenu === 'print' && (
              <div className="absolute left-0 top-full mt-0.5 w-68 bg-white border border-[#b8c5d6] shadow-lg py-1 z-50 text-slate-800 text-[11.5px]">
                <MenuItem
                  icon={<Printer className="w-3.5 h-3.5 text-blue-600" />}
                  label="Print Document (Standard Spooler)..."
                  shortcut="Ctrl+P"
                  onClick={() => executeAction(props.onOpenPrintDialog)}
                />
                <MenuItem
                  icon={<Layers className="w-3.5 h-3.5 text-indigo-600" />}
                  label="Batch Production Print Engine..."
                  onClick={() => executeAction(props.onOpenBatchPrint)}
                />
                <MenuDivider />
                {props.onOpenDataEntryFormDesigner && (
                  <MenuItem
                    icon={<FileText className="w-3.5 h-3.5 text-emerald-600" />}
                    label="Print-Time Data Entry Form Designer..."
                    onClick={() => executeAction(props.onOpenDataEntryFormDesigner!)}
                  />
                )}
                {props.onOpenDataEntryRuntime && (
                  <MenuItem
                    icon={<Printer className="w-3.5 h-3.5 text-amber-600" />}
                    label="Operator Touch Print Station Runtime..."
                    onClick={() => executeAction(props.onOpenDataEntryRuntime!)}
                  />
                )}
                <MenuDivider />
                <MenuItem
                  icon={<Clock className="w-3.5 h-3.5 text-slate-600" />}
                  label="Spooler Queue & Hardware History..."
                  onClick={() => executeAction(() => props.setActiveView('queue'))}
                />
                {props.onOpenSerializationRecovery && (
                  <MenuItem
                    icon={<Sliders className="w-3.5 h-3.5 text-blue-600" />}
                    label={props.orphanCount && props.orphanCount > 0 ? `Serialization Recovery Center (${props.orphanCount} pending)...` : 'Serialization Recovery Center...'}
                    onClick={() => executeAction(props.onOpenSerializationRecovery!)}
                  />
                )}
                {props.onPageSetup && (
                  <MenuItem
                    icon={<Settings className="w-3.5 h-3.5 text-slate-600" />}
                    label="Printer & Page Setup (DPI, Darkness, Speed)..."
                    onClick={() => executeAction(props.onPageSetup!)}
                  />
                )}
              </div>
            )}
          </div>

          {/* ADMINISTER MENU */}
          <div className="relative">
            <button
              onClick={() => handleMenuClick('administer')}
              onMouseEnter={() => handleMenuHover('administer')}
              className={`px-2 py-0.5 rounded-xs transition-colors ${
                openMenu === 'administer' ? 'bg-[#cce0f5] text-blue-900' : 'hover:bg-[#e0e6ed] text-slate-800'
              }`}
            >
              Administer
            </button>
            {openMenu === 'administer' && (
              <div className="absolute left-0 top-full mt-0.5 w-60 bg-white border border-[#b8c5d6] shadow-lg py-1 z-50 text-slate-800 text-[11.5px]">
                <MenuItem
                  icon={<ShieldCheck className="w-3.5 h-3.5 text-blue-600" />}
                  label="21 CFR Part 11 Approval Center..."
                  onClick={() => executeAction(props.onOpenApproval)}
                />
                {props.onOpenVersionHistory && (
                  <MenuItem
                    icon={<History className="w-3.5 h-3.5 text-purple-600" />}
                    label="Revision Timeline & Version History..."
                    onClick={() => executeAction(props.onOpenVersionHistory!)}
                  />
                )}
                <MenuItem
                  icon={<History className="w-3.5 h-3.5 text-indigo-600" />}
                  label="Security & Audit Trail Log..."
                  onClick={() => executeAction(props.onOpenAuditLogs)}
                />
                <MenuItem
                  icon={<Settings className="w-3.5 h-3.5 text-slate-600" />}
                  label="Global Printer & Port Setup..."
                  onClick={() => executeAction(props.onOpenSettings)}
                />
              </div>
            )}
          </div>

          {/* TOOLS MENU */}
          <div className="relative">
            <button
              onClick={() => handleMenuClick('tools')}
              onMouseEnter={() => handleMenuHover('tools')}
              className={`px-2 py-0.5 rounded-xs transition-colors ${
                openMenu === 'tools' ? 'bg-[#cce0f5] text-blue-900' : 'hover:bg-[#e0e6ed] text-slate-800'
              }`}
            >
              Tools
            </button>
            {openMenu === 'tools' && (
              <div className="absolute left-0 top-full mt-0.5 w-68 bg-white border border-[#b8c5d6] shadow-lg py-1 z-50 text-slate-800 text-[11.5px]">
                <MenuItem
                  icon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />}
                  label="Connect Microsoft Excel File (Live Link)..."
                  onClick={() => executeAction(props.onOpenExcelWizard || props.onOpenDataImport)}
                />
                <MenuItem
                  icon={<Database className="w-3.5 h-3.5 text-emerald-600" />}
                  label="Database Connection Manager (CSV / SQL / REST)..."
                  onClick={() => executeAction(props.onOpenDataImport)}
                />
                {props.onOpenNamedDataSources && (
                  <MenuItem
                    icon={<Sliders className="w-3.5 h-3.5 text-amber-600" />}
                    label="Named Data Sources (Global Variables)..."
                    onClick={() => executeAction(props.onOpenNamedDataSources!)}
                  />
                )}
                {props.onOpenDocumentScripts && (
                  <MenuItem
                    icon={<Code2 className="w-3.5 h-3.5 text-teal-600" />}
                    label="Document Event Scripts (VBScript / JS)..."
                    onClick={() => executeAction(props.onOpenDocumentScripts!)}
                  />
                )}
                <MenuDivider />
                {props.onOpenSerialNumberWizard && (
                  <MenuItem
                    icon={<Sliders className="w-3.5 h-3.5 text-blue-600" />}
                    label="Serial Number & Counter Wizard..."
                    onClick={() => executeAction(props.onOpenSerialNumberWizard!)}
                  />
                )}
                {props.onOpenDateTimeWizard && (
                  <MenuItem
                    icon={<Sliders className="w-3.5 h-3.5 text-indigo-600" />}
                    label="Date & Time Offset Engine Wizard..."
                    onClick={() => executeAction(props.onOpenDateTimeWizard!)}
                  />
                )}
                {props.onOpenGs1Wizard && (
                  <MenuItem
                    icon={<ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />}
                    label="GS1 Application Identifier (AI) Builder..."
                    onClick={() => executeAction(props.onOpenGs1Wizard!)}
                  />
                )}
                {props.onToggleValidationInspector && (
                  <MenuItem
                    icon={<ShieldCheck className="w-3.5 h-3.5 text-amber-600" />}
                    label="Problem & Validation Inspector (Real-Time)..."
                    onClick={() => executeAction(props.onToggleValidationInspector!)}
                  />
                )}
                <MenuDivider />
                <MenuItem
                  icon={<Barcode className="w-3.5 h-3.5 text-purple-600" />}
                  label="Symbology Library Catalog..."
                  onClick={() => executeAction(props.onOpenBarcodePicker)}
                />
                {props.onOpenProperties && (
                  <MenuItem
                    icon={<Sliders className="w-3.5 h-3.5 text-blue-600" />}
                    label="Selected Object Properties..."
                    shortcut="F8"
                    onClick={() => executeAction(props.onOpenProperties!)}
                  />
                )}
                {props.onOpenTextProperties && (
                  <MenuItem
                    icon={<Sliders className="w-3.5 h-3.5 text-emerald-600" />}
                    label="Text Properties..."
                    onClick={() => executeAction(props.onOpenTextProperties!)}
                  />
                )}
                {props.onOpenBarcodeProperties && (
                  <MenuItem
                    icon={<Sliders className="w-3.5 h-3.5 text-blue-600" />}
                    label="Barcode Properties (Data Source & Transforms)..."
                    onClick={() => executeAction(props.onOpenBarcodeProperties!)}
                  />
                )}
                <MenuItem
                  icon={<Sparkles className="w-3.5 h-3.5 text-amber-500" />}
                  label="AI Label Assistant & Optimizer..."
                  onClick={() => executeAction(props.onOpenAiAssistant)}
                />
              </div>
            )}
          </div>

          {/* WINDOW MENU */}
          <div className="relative">
            <button
              onClick={() => handleMenuClick('window')}
              onMouseEnter={() => handleMenuHover('window')}
              className={`px-2 py-0.5 rounded-xs transition-colors ${
                openMenu === 'window' ? 'bg-[#cce0f5] text-blue-900' : 'hover:bg-[#e0e6ed] text-slate-800'
              }`}
            >
              Window
            </button>
            {openMenu === 'window' && (
              <div className="absolute left-0 top-full mt-0.5 w-64 bg-white border border-[#b8c5d6] shadow-lg py-1 z-50 text-slate-800 text-[11.5px]">
                <MenuItem
                  checked={props.activeView === 'designer'}
                  label="Label Designer Canvas (Document1.btw)"
                  onClick={() => executeAction(() => props.setActiveView('designer'))}
                />
                <MenuItem
                  checked={props.activeView === 'workflow'}
                  label="Step 1-4: Regulatory Workflow & Signatures"
                  onClick={() => executeAction(() => props.setActiveView('workflow'))}
                />
                <MenuItem
                  checked={props.activeView === 'viewer'}
                  label="Step 5-6: Viewer & 10-Page Spooler Station"
                  onClick={() => executeAction(() => props.setActiveView('viewer'))}
                />
                <MenuDivider />
                <MenuItem
                  checked={props.activeView === 'dashboard'}
                  label="Operations Dashboard"
                  onClick={() => executeAction(() => props.setActiveView('dashboard'))}
                />
                <MenuItem
                  checked={props.activeView === 'queue'}
                  label="Print Queue Spooler Monitor"
                  onClick={() => executeAction(() => props.setActiveView('queue'))}
                />
              </div>
            )}
          </div>

          {/* HELP MENU */}
          <div className="relative">
            <button
              onClick={() => handleMenuClick('help')}
              onMouseEnter={() => handleMenuHover('help')}
              className={`px-2 py-0.5 rounded-xs transition-colors ${
                openMenu === 'help' ? 'bg-[#cce0f5] text-blue-900' : 'hover:bg-[#e0e6ed] text-slate-800'
              }`}
            >
              Help
            </button>
            {openMenu === 'help' && (
              <div className="absolute left-0 top-full mt-0.5 w-60 bg-white border border-[#b8c5d6] shadow-lg py-1 z-50 text-slate-800 text-[11.5px]">
                <MenuItem
                  icon={<HelpCircle className="w-3.5 h-3.5 text-blue-600" />}
                  label="Keyboard Shortcuts Map..."
                  shortcut="F1"
                  onClick={() => executeAction(props.onOpenShortcuts)}
                />
                {props.onOpenWelcome && (
                  <MenuItem
                    icon={<Sparkles className="w-3.5 h-3.5 text-amber-500" />}
                    label="Welcome Screen..."
                    onClick={() => executeAction(props.onOpenWelcome)}
                  />
                )}
                <MenuItem
                  icon={<ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />}
                  label="About BarCode Automation Studio"
                  onClick={() => executeAction(props.onOpenSettings)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Center / Right: System Status + Logout */}
        <div className="ml-auto flex items-center gap-1 sm:gap-1.5 pr-2 text-slate-700 text-[11px] shrink-0 whitespace-nowrap pl-2">

          <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-300 font-semibold text-[10px] flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="hidden md:inline">ONLINE</span>
          </span>

          {/* User Profile Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggleMenu('profile')}
              title={`Logged in as ${props.currentUser?.name || 'User'} (${props.currentUser?.role || 'Admin'})`}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer border ${
                openMenu === 'profile'
                  ? 'bg-blue-100 text-blue-900 border-blue-400 shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 shadow-2xs'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px] font-bold shrink-0 shadow-xs">
                {props.currentUser?.name ? props.currentUser.name.charAt(0).toUpperCase() : <User className="w-2.5 h-2.5" />}
              </div>
              <span className="hidden sm:inline max-w-[110px] truncate">{props.currentUser?.name || 'Account'}</span>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </button>

            {/* Profile Dropdown Menu */}
            {openMenu === 'profile' && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-[#a6bcd6] shadow-2xl rounded-sm py-1.5 text-slate-800 z-[100] animate-in fade-in slide-in-from-top-1 duration-100 font-sans">
                {/* User Identity Header */}
                <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/70">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                      {props.currentUser?.name ? props.currentUser.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {props.currentUser?.name || 'Administrator'}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate font-mono">
                        {props.currentUser?.email || 'admin@barcodeflow.internal'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded-xs text-[9.5px] font-bold uppercase tracking-wider">
                      {props.currentUser?.role || 'Administrator'}
                    </span>
                    <span className="text-[9.5px] text-slate-400 font-medium">Session Active</span>
                  </div>
                </div>

                {/* Dashboard & Software Options */}
                <div className="py-1">
                  {/* Management Dashboard Option */}
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      props.setActiveView('dashboard');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-blue-50 text-slate-800 hover:text-blue-950 transition-colors group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-md bg-indigo-100 group-hover:bg-indigo-200 text-indigo-700 flex items-center justify-center shrink-0 transition-colors">
                      <LayoutDashboard className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[11.5px] font-semibold text-slate-900 group-hover:text-indigo-900 flex items-center gap-1">
                        <span>Management Dashboard</span>
                      </div>
                      <div className="text-[9.5px] text-slate-500">Templates, users & system overview</div>
                    </div>
                  </button>

                  {/* Download Desktop App (.exe) Option */}
                  <a
                    href="/BarcodeFlow_Setup_v2.5.0.exe"
                    download="BarcodeFlow_Setup_v2.5.0.exe"
                    onClick={() => setOpenMenu(null)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-blue-50 text-slate-800 hover:text-blue-950 transition-colors group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-md bg-blue-100 group-hover:bg-blue-200 text-blue-700 flex items-center justify-center shrink-0 transition-colors">
                      <Download className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[11.5px] font-semibold text-slate-900 group-hover:text-blue-900 flex items-center gap-1">
                        <span>Download Desktop App</span>
                        <span className="px-1 py-0.2 bg-emerald-100 text-emerald-800 text-[8.5px] font-bold rounded">.exe</span>
                      </div>
                      <div className="text-[9.5px] text-slate-500">Offline Windows installer v2.5.0</div>
                    </div>
                  </a>
                </div>

                <div className="h-px bg-slate-200 my-1" />

                {/* Log Out Option */}
                {props.onLogout && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      props.onLogout!();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-md bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                      <LogOut className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-[11.5px] font-bold">Log Out</div>
                      <div className="text-[9.5px] text-red-500">End session & return to login</div>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const MenuItem: React.FC<{
  icon?: React.ReactNode;
  label: string;
  title?: string;
  shortcut?: string;
  disabled?: boolean;
  checked?: boolean;
  onClick: () => void;
}> = ({ icon, label, title, shortcut, disabled, checked, onClick }) => {
  return (
    <button
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-1 text-left select-none hover:bg-[#cce0f5] hover:text-blue-950 transition-colors ${
        disabled ? 'opacity-40 cursor-not-allowed hover:bg-transparent' : 'cursor-pointer text-slate-800'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-4 flex items-center justify-center">
          {checked ? (
            <span className="text-blue-700 font-bold text-xs">✓</span>
          ) : (
            icon || null
          )}
        </div>
        <span className="text-[11.5px]">{label}</span>
      </div>
      {shortcut && <span className="text-[10px] text-slate-500 font-mono ml-4">{shortcut}</span>}
    </button>
  );
};

const MenuDivider: React.FC = () => <div className="h-px bg-[#e0e6ed] my-1 mx-1" />;
