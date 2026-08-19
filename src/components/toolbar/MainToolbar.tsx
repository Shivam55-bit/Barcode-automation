import React from 'react';
import {
  FilePlus,
  FolderOpen,
  Save,
  Copy,
  Undo2,
  Redo2,
  Scissors,
  Clipboard,
  Trash2,
  Printer,
  FileSpreadsheet,
  FileCode,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Cpu,
} from 'lucide-react';
import { Tooltip } from '../common/Tooltip';

interface MainToolbarProps {
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  hasSelection: boolean;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  onOpenPrint: () => void;
  onOpenBatchPrint: () => void;
  onExportZPL: () => void;
  onExportPDF: () => void;
  onOpenAiAssistant: () => void;
  currentRecordIndex: number;
  totalRecords: number;
  onPrevRecord: () => void;
  onNextRecord: () => void;
  templateStatus: string;
}

export const MainToolbar: React.FC<MainToolbarProps> = (props) => {
  const zoomOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-2 py-0.5 rounded border border-emerald-300">PUBLISHED</span>;
      case 'approved':
        return <span className="bg-blue-100 text-blue-800 text-[10px] font-semibold px-2 py-0.5 rounded border border-blue-300">APPROVED</span>;
      case 'submitted':
        return <span className="bg-amber-100 text-amber-800 text-[10px] font-semibold px-2 py-0.5 rounded border border-amber-300">IN REVIEW</span>;
      case 'rejected':
        return <span className="bg-rose-100 text-rose-800 text-[10px] font-semibold px-2 py-0.5 rounded border border-rose-300">REJECTED</span>;
      default:
        return <span className="bg-slate-200 text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded border border-slate-300">DRAFT</span>;
    }
  };

  return (
    <div className="flex items-center justify-between h-10 px-3 bg-slate-100 border-b border-slate-200 text-slate-700 select-none shadow-xs text-xs">
      {/* Left Action Buttons */}
      <div className="flex items-center gap-1">
        <Tooltip content="New Template" shortcut="Ctrl+N">
          <button
            onClick={props.onNew}
            className="p-1.5 rounded hover:bg-slate-200 active:bg-slate-300 transition-colors text-slate-700"
          >
            <FilePlus className="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip content="Open Template..." shortcut="Ctrl+O">
          <button
            onClick={props.onOpen}
            className="p-1.5 rounded hover:bg-slate-200 active:bg-slate-300 transition-colors text-slate-700"
          >
            <FolderOpen className="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip content="Save Template" shortcut="Ctrl+S">
          <button
            onClick={props.onSave}
            className="p-1.5 rounded hover:bg-slate-200 active:bg-slate-300 transition-colors text-blue-600 font-medium"
          >
            <Save className="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip content="Save Copy / Duplicate">
          <button
            onClick={props.onSaveAs}
            className="p-1.5 rounded hover:bg-slate-200 active:bg-slate-300 transition-colors text-slate-700"
          >
            <Copy className="w-4 h-4" />
          </button>
        </Tooltip>

        <ToolbarDivider />

        <Tooltip content="Undo" shortcut="Ctrl+Z">
          <button
            onClick={props.onUndo}
            disabled={!props.canUndo}
            className={`p-1.5 rounded transition-colors ${
              props.canUndo ? 'hover:bg-slate-200 text-slate-700' : 'text-slate-300 cursor-not-allowed'
            }`}
          >
            <Undo2 className="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip content="Redo" shortcut="Ctrl+Y">
          <button
            onClick={props.onRedo}
            disabled={!props.canRedo}
            className={`p-1.5 rounded transition-colors ${
              props.canRedo ? 'hover:bg-slate-200 text-slate-700' : 'text-slate-300 cursor-not-allowed'
            }`}
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </Tooltip>

        <ToolbarDivider />

        <Tooltip content="Cut" shortcut="Ctrl+X">
          <button
            onClick={props.onCut}
            disabled={!props.hasSelection}
            className={`p-1.5 rounded transition-colors ${
              props.hasSelection ? 'hover:bg-slate-200 text-slate-700' : 'text-slate-300 cursor-not-allowed'
            }`}
          >
            <Scissors className="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip content="Copy" shortcut="Ctrl+C">
          <button
            onClick={props.onCopy}
            disabled={!props.hasSelection}
            className={`p-1.5 rounded transition-colors ${
              props.hasSelection ? 'hover:bg-slate-200 text-slate-700' : 'text-slate-300 cursor-not-allowed'
            }`}
          >
            <Clipboard className="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip content="Paste" shortcut="Ctrl+V">
          <button
            onClick={props.onPaste}
            className="p-1.5 rounded hover:bg-slate-200 active:bg-slate-300 transition-colors text-slate-700"
          >
            <Copy className="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip content="Delete Selected" shortcut="Del">
          <button
            onClick={props.onDelete}
            disabled={!props.hasSelection}
            className={`p-1.5 rounded transition-colors ${
              props.hasSelection ? 'hover:bg-red-100 text-red-600' : 'text-slate-300 cursor-not-allowed'
            }`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </Tooltip>

        <ToolbarDivider />

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-white px-1.5 py-0.5 rounded border border-slate-200">
          <Tooltip content="Zoom Out" shortcut="Ctrl+-">
            <button
              onClick={props.onZoomOut}
              className="p-1 rounded hover:bg-slate-100 text-slate-600"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
          </Tooltip>

          <select
            value={props.zoom}
            onChange={(e) => props.onZoomChange(Number(e.target.value))}
            className="bg-transparent text-xs text-slate-800 font-semibold px-1 py-0.5 outline-none cursor-pointer"
          >
            {zoomOptions.map((z) => (
              <option key={z} value={z}>
                {Math.round(z * 100)}%
              </option>
            ))}
          </select>

          <Tooltip content="Zoom In" shortcut="Ctrl++">
            <button
              onClick={props.onZoomIn}
              className="p-1 rounded hover:bg-slate-100 text-slate-600"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
          <Tooltip content="Fit to Screen" shortcut="Ctrl+0">
            <button
              onClick={props.onZoomFit}
              className="p-1 rounded hover:bg-slate-100 text-slate-600"
            >
              <Maximize className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </div>

        <ToolbarDivider />

        {/* Batch Record Navigator */}
        {props.totalRecords > 0 && (
          <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200">
            <span className="text-[11px] text-slate-500 font-medium mr-1">Sample Data:</span>
            <button
              onClick={props.onPrevRecord}
              disabled={props.currentRecordIndex <= 0}
              className={`p-0.5 rounded ${
                props.currentRecordIndex > 0 ? 'hover:bg-slate-100 text-slate-700' : 'text-slate-300'
              }`}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono font-bold text-blue-700 px-1">
              {props.currentRecordIndex + 1} / {props.totalRecords}
            </span>
            <button
              onClick={props.onNextRecord}
              disabled={props.currentRecordIndex >= props.totalRecords - 1}
              className={`p-0.5 rounded ${
                props.currentRecordIndex < props.totalRecords - 1 ? 'hover:bg-slate-100 text-slate-700' : 'text-slate-300'
              }`}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Right Print & Smart Actions */}
      <div className="flex items-center gap-2">
        {getStatusBadge(props.templateStatus)}

        <button
          onClick={props.onOpenAiAssistant}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded font-medium shadow-xs transition-all active:scale-98"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Assistant</span>
        </button>

        <button
          onClick={props.onExportZPL}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded font-medium shadow-xs transition-colors"
          title="Inspect and Export Thermal ZPL-II Code"
        >
          <Cpu className="w-3.5 h-3.5 text-emerald-400" />
          <span>ZPL Thermal</span>
        </button>

        <button
          onClick={props.onExportPDF}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded font-medium shadow-xs transition-colors"
          title="Download Vector PDF Label"
        >
          <Download className="w-3.5 h-3.5 text-rose-600" />
          <span>PDF Label</span>
        </button>

        <button
          onClick={props.onOpenPrint}
          className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold shadow-xs transition-colors"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print Center</span>
        </button>
      </div>
    </div>
  );
};

const ToolbarDivider: React.FC = () => <div className="h-5 w-px bg-slate-300 mx-1" />;
