import React from 'react';
import { AlertTriangle, RotateCcw, Trash2, X } from 'lucide-react';

interface DocumentRecoveryModalProps {
  savedAt: string;
  documentNames: string[];
  error?: string;
  onRecover: () => void;
  onDiscard: () => void;
  onClose: () => void;
}

export const DocumentRecoveryModal: React.FC<DocumentRecoveryModalProps> = ({
  savedAt,
  documentNames,
  error,
  onRecover,
  onDiscard,
  onClose,
}) => (
  <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
    <div className="w-full max-w-lg overflow-hidden rounded border border-slate-300 bg-white text-slate-800 shadow-2xl">
      <header className="flex items-center justify-between border-b border-amber-200 bg-amber-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-700" />
          <h2 id="recovery-title" className="text-sm font-semibold">Recover unsaved BarcodeFlow documents?</h2>
        </div>
        <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-white hover:text-slate-900" title="Decide later" aria-label="Close recovery prompt">
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="space-y-3 p-4 text-sm">
        <p className="text-slate-700">A completed recovery snapshot is available from {new Date(savedAt).toLocaleString()}.</p>
        <ul className="max-h-36 list-inside list-disc overflow-auto rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
          {documentNames.map((name, index) => <li key={`${index}-${name}`} className="break-all py-0.5">{name}</li>)}
        </ul>
        <p className="text-xs text-slate-500">Recovery opens separate unsaved copies and does not overwrite originals. Changes made after the last completed snapshot may be missing.</p>
        {error && <p className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</p>}
      </div>
      <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
        <button type="button" onClick={onClose} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100">Decide Later</button>
        <button type="button" onClick={onDiscard} className="inline-flex items-center gap-1.5 rounded border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" />Discard Snapshot</button>
        <button type="button" onClick={onRecover} className="inline-flex items-center gap-1.5 rounded bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"><RotateCcw className="h-3.5 w-3.5" />Recover Snapshot</button>
      </footer>
    </div>
  </div>
);