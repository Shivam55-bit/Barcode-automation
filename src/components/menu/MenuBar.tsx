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
} from 'lucide-react';

interface MenuBarProps {
  onSubmitForApproval?: () => void;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
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
  onGroup: () => void;
  onUngroup: () => void;
  onLockToggle: () => void;
  onOpenBarcodePicker: () => void;
  onOpenBarcodeProperties?: () => void;
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
  activeView: 'designer' | 'dashboard' | 'queue' | 'workflow' | 'viewer';
  setActiveView: (view: 'designer' | 'dashboard' | 'queue' | 'workflow' | 'viewer') => void;
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

  const handleMenuClick = (menuName: string) => {
    setOpenMenu(openMenu === menuName ? null : menuName);
  };

  const handleMenuHover = (menuName: string) => {
    if (openMenu !== null) {
      setOpenMenu(menuName);
    }
  };

  const executeAction = (action: () => void) => {
    action();
    setOpenMenu(null);
  };

  return (
    <div className="flex flex-col select-none z-50">
      {/* 1. Classic Windows Window Title Bar */}
      <div className="h-7 bg-[#e8edf5] border-b border-[#cbd7e6] flex items-center justify-between px-2 text-slate-800 text-xs select-none">
        {/* Left: Custom Modern Logo and Window Title */}
        <div className="flex items-center gap-2">
          {/* Exit to BarcodeFlow Portal Button */}
          <button
            onClick={() => props.setActiveView('dashboard')}
            title="Exit Studio & Return to BarcodeFlow Dashboard Portal"
            className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded text-[10.5px] font-bold shadow-2xs transition-colors cursor-pointer mr-1"
          >
            <LayoutDashboard className="w-3 h-3" />
            <span>← Dashboard</span>
          </button>

          {/* Custom Brand Logo */}
          <div className="w-4 h-4 bg-gradient-to-tr from-blue-700 via-indigo-600 to-cyan-500 rounded flex items-center justify-center shadow-xs">
            <svg viewBox="0 0 24 24" className="w-3 h-3 text-white fill-current">
              <path d="M2 4h2v16H2V4zm4 0h1v16H6V4zm3 0h2v16H9V4zm4 0h3v16h-3V4zm5 0h1v16h-1V4zm3 0h1v16h-1V4z" />
            </svg>
          </div>
          <span className="font-semibold text-slate-900 text-[11.5px] tracking-tight">
            BarCode Automation Studio - [{props.templateName || 'Document1.btw *'}]
          </span>
        </div>

        {/* Right: Window Controls */}
        <div className="flex items-center -mr-2">
          <button
            title="Minimize"
            className="w-10 h-7 flex items-center justify-center hover:bg-[#d5e0ee] text-slate-600 transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            title="Maximize"
            className="w-10 h-7 flex items-center justify-center hover:bg-[#d5e0ee] text-slate-600 transition-colors"
          >
            <WindowSquare className="w-3 h-3" />
          </button>
          <button
            onClick={() => props.setActiveView('dashboard')}
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
        className="flex items-center h-6 bg-[#f0f2f5] text-slate-800 text-[11.5px] px-1 border-b border-[#d8dfe8] relative z-40"
      >
        <div className="flex items-center">
          {/* FILE MENU */}
          <div className="relative">
            <button
              onClick={() => handleMenuClick('file')}
              onMouseEnter={() => handleMenuHover('file')}
              className={`px-2 py-0.5 rounded-xs transition-colors ${
                openMenu === 'file' ? 'bg-[#cce0f5] text-blue-900' : 'hover:bg-[#e0e6ed] text-slate-800'
              }`}
            >
              File
            </button>
            {openMenu === 'file' && (
              <div className="absolute left-0 top-full mt-0.5 w-60 bg-white border border-[#b8c5d6] shadow-lg py-1 z-50 text-slate-800 text-[11.5px]">
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
                <MenuDivider />
                <MenuItem
                  icon={<Save className="w-3.5 h-3.5 text-blue-600" />}
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
                  label="Export Document (.btw / JSON)..."
                  onClick={() => executeAction(props.onExportJSON)}
                />
                <MenuItem
                  icon={<Upload className="w-3.5 h-3.5 text-slate-600" />}
                  label="Import Document (.btw / JSON)..."
                  onClick={() => executeAction(props.onImportJSON)}
                />
                <MenuDivider />
                {props.onPageSetup && (
                  <MenuItem
                    icon={<Layers className="w-3.5 h-3.5 text-blue-600" />}
                    label="Page Setup (Dimensions, Margins, Stock)..."
                    shortcut="Ctrl+D"
                    onClick={() => executeAction(props.onPageSetup!)}
                  />
                )}
                <MenuItem
                  icon={<Printer className="w-3.5 h-3.5 text-blue-700" />}
                  label="Print..."
                  shortcut="Ctrl+P"
                  onClick={() => executeAction(props.onOpenPrintDialog)}
                />
                <MenuItem
                  icon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />}
                  label="Print Station Batch Spooler..."
                  onClick={() => executeAction(props.onOpenBatchPrint)}
                />
                {props.onLogout && (
                  <>
                    <MenuDivider />
                    <MenuItem
                      icon={<LogOut className="w-3.5 h-3.5 text-red-600" />}
                      label="Log Out / Exit Session"
                      shortcut="Ctrl+Q"
                      onClick={() => executeAction(props.onLogout)}
                    />
                  </>
                )}
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
                  icon={<Copy className="w-3.5 h-3.5 text-indigo-600" />}
                  label="Duplicate Object"
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
                  label="Select All"
                  shortcut="Ctrl+A"
                  onClick={() => executeAction(props.onSelectAll)}
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
                  onClick={() => executeAction(props.onBringToFront)}
                />
                <MenuItem
                  label="Send to Back"
                  onClick={() => executeAction(props.onSendToBack)}
                />
                <MenuDivider />
                <MenuItem
                  label="Lock / Unlock Object"
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
                <MenuItem
                  icon={<ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />}
                  label="About BarCode Automation Studio"
                  onClick={() => executeAction(props.onOpenSettings)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Center / Right: Workflow & Viewer Buttons + System Status + Logout */}
        <div className="ml-auto flex items-center gap-1.5 pr-2 text-slate-700 text-[11px]">
          {props.onSubmitForApproval && (
            <button
              onClick={props.onSubmitForApproval}
              title="Freeze Version & Submit for Level 1 Approval Review"
              className="px-2.5 py-0.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded text-[10.5px] font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1 border border-blue-700"
            >
              <Send className="w-3 h-3" />
              <span>Submit for Approval</span>
            </button>
          )}

          <button
            onClick={() => props.setActiveView('workflow')}
            title="Open Regulatory Approval & e-Signature Workflow Station"
            className="px-2.5 py-0.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-900 rounded text-[10.5px] font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1 border border-amber-600"
          >
            <ShieldCheck className="w-3 h-3 text-slate-900" />
            <span>Approval Workflow</span>
          </button>

          <button
            onClick={() => props.setActiveView('viewer')}
            title="Open Viewer & 10-Pack Serialized Batch Print Station"
            className="px-2.5 py-0.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded text-[10.5px] font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1 border border-indigo-700 mr-2"
          >
            <Eye className="w-3 h-3" />
            <span>Viewer Station</span>
          </button>

          <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-300 font-semibold text-[10px] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>ONLINE</span>
          </span>

          {props.onLogout && (
            <button
              onClick={props.onLogout}
              title="Sign Out / Switch User (Return to Login Screen)"
              className="px-2.5 py-0.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded text-[10.5px] font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1 border border-red-700"
            >
              <LogOut className="w-3 h-3" />
              <span>Log Out</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const MenuItem: React.FC<{
  icon?: React.ReactNode;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  checked?: boolean;
  onClick: () => void;
}> = ({ icon, label, shortcut, disabled, checked, onClick }) => {
  return (
    <button
      disabled={disabled}
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
