import React, { useEffect } from 'react';
import { AlertTriangle, Save, Trash2, X } from 'lucide-react';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  documentName: string;
  onSave: () => void;
  onDontSave: () => void;
  onCancel: () => void;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  isOpen,
  documentName,
  onSave,
  onDontSave,
  onCancel,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-100">
      <div className="w-full max-w-md bg-white rounded-lg shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border-b border-amber-100">
          <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Unsaved Changes</span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-700 rounded p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 text-sm text-slate-700">
          <p>
            Do you want to save changes to{' '}
            <span className="font-semibold text-slate-900">"{documentName}"</span> before closing?
          </p>
          <p className="text-xs text-slate-500 mt-2">
            If you close without saving, any modifications made in this tab will be lost.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 border border-slate-300 rounded font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDontSave}
            className="px-3 py-1.5 border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 rounded font-medium transition-colors flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Don't Save
          </button>
          <button
            type="button"
            onClick={onSave}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors shadow-xs flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
