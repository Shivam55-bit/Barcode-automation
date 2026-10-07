import React from 'react';
import {
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  Sparkles,
  Barcode,
} from 'lucide-react';

export type DocumentImportState =
  | 'IDLE'
  | 'SELECTING_FILE'
  | 'READING_FILE'
  | 'AWAITING_CONSENT'
  | 'EXTRACTING'
  | 'VERIFYING'
  | 'DETECTING_FORMAT'
  | 'PARSING'
  | 'CONVERTING'
  | 'LOADING_DOCUMENT'
  | 'RENDERING'
  | 'SUCCESS'
  | 'ERROR';

export interface DocumentImportProgressModalProps {
  state: DocumentImportState;
  fileName?: string;
  errorMessage?: string;
  stats?: {
    totalDiscovered?: number;
    fullyEditable?: number;
    barcodes?: number;
    text?: number;
    lines?: number;
  };
  onClose: () => void;
}

const STAGE_ORDER: DocumentImportState[] = [
  'READING_FILE',
  'AWAITING_CONSENT',
  'EXTRACTING',
  'VERIFYING',
  'DETECTING_FORMAT',
  'PARSING',
  'CONVERTING',
  'LOADING_DOCUMENT',
  'RENDERING',
  'SUCCESS',
];

export const DocumentImportProgressModal: React.FC<DocumentImportProgressModalProps> = ({
  state,
  fileName,
  errorMessage,
  stats,
  onClose,
}) => {
  if (state === 'IDLE') return null;

  const currentIdx = STAGE_ORDER.indexOf(state);
  const progressPercent =
    state === 'SUCCESS'
      ? 100
      : state === 'ERROR'
      ? 100
      : currentIdx >= 0
      ? Math.round(((currentIdx + 1) / STAGE_ORDER.length) * 90)
      : 10;

  const getStageTitle = () => {
    switch (state) {
      case 'SELECTING_FILE':
        return 'Selecting BarTender Document...';
      case 'READING_FILE':
        return `Opening: ${fileName || 'BarTender Document'}`;
      case 'AWAITING_CONSENT':
        return 'Waiting for BarTender Import Consent...';
      case 'EXTRACTING':
        return 'Extracting Verified Properties with BarTender...';
      case 'VERIFYING':
        return 'Verifying Source Integrity and Observation...';
      case 'DETECTING_FORMAT':
        return 'Detecting Document Format...';
      case 'PARSING':
        return 'Parsing BarTender Document...';
      case 'CONVERTING':
        return 'Creating Editable Template...';
      case 'LOADING_DOCUMENT':
        return 'Loading Document Onto Canvas...';
      case 'RENDERING':
        return 'Rendering Label Layout...';
      case 'SUCCESS':
        return 'Document Opened Successfully';
      case 'ERROR':
        return 'Unable to Import BarTender Document';
      default:
        return 'Processing Document...';
    }
  };

  const getStageSubtitle = () => {
    switch (state) {
      case 'SELECTING_FILE':
        return 'Waiting for Windows file picker selection...';
      case 'READING_FILE':
        return 'Validating the selected file...';
      case 'AWAITING_CONSENT':
        return 'Confirm the dependency and trusted-copy warning in the native dialog.';
      case 'EXTRACTING':
        return 'Installed BarTender is inspecting a private copy. No print or source-save calls are issued.';
      case 'VERIFYING':
        return 'Checking source hashes and the observation schema before creating a draft.';
      case 'DETECTING_FORMAT':
        return 'Identifying the validated document format...';
      case 'PARSING':
        return 'Validating available geometry and property evidence; unresolved settings are not guessed.';
      case 'CONVERTING':
        return 'Normalizing objects into native 360Barcode editable elements...';
      case 'LOADING_DOCUMENT':
        return 'Setting up workspace tabs, undo history, and viewport...';
      case 'RENDERING':
        return 'Generating live barcode vectors and layout geometry...';
      case 'SUCCESS':
        return stats?.totalDiscovered
          ? `Loaded ${(stats.barcodes || 0) + (stats.text || 0) + (stats.lines || 0)} native objects from ${stats.totalDiscovered} source objects. Review the conversion report for unresolved properties.`
          : 'Document loaded. Review any conversion report before output.';
      case 'ERROR':
        return errorMessage || 'An unexpected error occurred while parsing the BarTender document.';
      default:
        return 'Please wait...';
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-150 select-none"
      onClick={(e) => {
        if ((state === 'SUCCESS' || state === 'ERROR') && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-[460px] max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header Bar */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between ${
            state === 'ERROR'
              ? 'bg-rose-50/80 border-rose-200 text-rose-900'
              : state === 'SUCCESS'
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
              : 'bg-slate-50 border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 shadow-xs ${
                state === 'ERROR'
                  ? 'bg-rose-600 text-white'
                  : state === 'SUCCESS'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-blue-600 text-white'
              }`}
            >
              {state === 'ERROR' ? (
                <AlertCircle className="w-5 h-5" />
              ) : state === 'SUCCESS' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <Loader2 className="w-5 h-5 animate-spin" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold leading-tight">{getStageTitle()}</h3>
              <p
                className={`text-xs mt-0.5 truncate max-w-[320px] ${
                  state === 'ERROR'
                    ? 'text-rose-700'
                    : state === 'SUCCESS'
                    ? 'text-emerald-700 font-mono text-[11px]'
                    : 'text-slate-500 font-mono text-[11px]'
                }`}
              >
                {fileName || 'BarTender .BTW Import'}
              </p>
            </div>
          </div>

          {(state === 'SUCCESS' || state === 'ERROR') && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded hover:bg-black/5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">{getStageSubtitle()}</p>

          {/* Progress Bar */}
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
            <div
              className={`h-full transition-all duration-300 ${
                state === 'ERROR'
                  ? 'bg-rose-500'
                  : state === 'SUCCESS'
                  ? 'bg-emerald-500'
                  : 'bg-blue-600'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Detailed Stages Checklist */}
          <div className="p-3 bg-slate-50/70 rounded-md border border-slate-200/80 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5">
                {currentIdx >= 0 ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block" />
                )}
                Read Binary Bytes
              </span>
              <span className="font-mono text-[10px] text-slate-400">Uint8Array</span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5">
                {currentIdx >= 1 ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block" />
                )}
                Validate Document Format
              </span>
              <span className="font-mono text-[10px] text-slate-400">Signature / JSON</span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5">
                {currentIdx >= 2 ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block" />
                )}
                Inspect Verified Properties
              </span>
              <span className="font-mono text-[10px] text-slate-400">
                {stats?.totalDiscovered ? `${stats.totalDiscovered} source objects` : 'Property evidence'}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5">
                {currentIdx >= 3 ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block" />
                )}
                Build Editable Template
              </span>
              <span className="font-mono text-[10px] text-slate-400">Fully Editable</span>
            </div>
          </div>

          {/* Technical Details on Error */}
          {state === 'ERROR' && errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 space-y-1">
              <div className="font-semibold text-rose-900">Technical Details:</div>
              <div className="font-mono text-[11px] break-all bg-white/70 p-2 rounded border border-rose-200/60">
                {errorMessage}
              </div>
              <p className="text-[11px] text-rose-700 mt-1">
                Your current document was left untouched. Please verify that this file is a valid BarTender document or export it as a supported format.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          {state === 'ERROR' ? (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-xs font-semibold transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          ) : state === 'SUCCESS' ? (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Continue to Canvas
            </button>
          ) : (
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
              Importing document...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
