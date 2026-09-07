import React, { useState, useEffect, useRef } from 'react';
import { Save, X, FileText } from 'lucide-react';

interface SaveAsModalProps {
  isOpen: boolean;
  initialName: string;
  onSave: (newName: string, description?: string) => Promise<void> | void;
  onClose: () => void;
}

export const SaveAsModal: React.FC<SaveAsModalProps> = ({
  isOpen,
  initialName,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const cleanName = initialName.endsWith('.btw')
        ? `${initialName.replace(/\.btw$/i, '')} (Copy).btw`
        : `${initialName} (Copy)`;
      setName(cleanName);
      setDescription('');
      setIsSubmitting(false);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [isOpen, initialName]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, name, description]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSave(trimmed, description.trim());
      onClose();
    } catch (err) {
      console.error('Error in Save As:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 select-none">
      <div
        className="w-[440px] max-w-[95vw] bg-[#f0f0f0] border border-[#7a7a7a] rounded-[3px] shadow-[0_10px_35px_rgba(0,0,0,0.35)] flex flex-col overflow-hidden text-[11px] text-[#000000]"
        style={{ fontFamily: '"Segoe UI", Tahoma, Arial, sans-serif' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title Bar */}
        <div
          className="h-[28px] px-2 flex items-center justify-between shrink-0 border-b border-[#a0b8cf]"
          style={{
            background: 'linear-gradient(to bottom, #dbe8f5 0%, #cce0f2 40%, #b8d4ee 50%, #c9ddf2 100%)',
          }}
        >
          <div className="flex items-center gap-1.5">
            <Save className="w-3.5 h-3.5 text-blue-700" />
            <span className="font-semibold text-[#111111] text-[12px] tracking-tight">
              Save Document As
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-[36px] h-[20px] -mr-1 flex items-center justify-center rounded-[2px] bg-gradient-to-b from-[#f28e8e] to-[#d9534f] hover:from-[#f47070] hover:to-[#c9302c] active:from-[#d9534f] active:to-[#ac2925] border border-[#b92c28] text-white shadow-2xs"
          >
            <X className="w-3 h-3 stroke-[2.5]" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 bg-white space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-[12px] font-semibold text-slate-900">
                Save a new copy of this document
              </p>
              <p className="text-[11px] text-slate-500">
                A separate template will be created with the specified name and assigned a new unique identity.
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div className="space-y-1">
              <label className="block font-medium text-slate-800 text-[11px]">
                Document / Template Name: <span className="text-red-500">*</span>
              </label>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Shipping Carton Label 4x6"
                className="w-full h-7 px-2 border border-[#7a7a7a] rounded-[1px] bg-white text-[11px] text-slate-900 focus:border-blue-600 focus:outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-medium text-slate-800 text-[11px]">
                Description (Optional):
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief notes or purpose..."
                className="w-full h-7 px-2 border border-[#7a7a7a] rounded-[1px] bg-white text-[11px] text-slate-900 focus:border-blue-600 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="h-[38px] px-3 bg-[#f0f0f0] border-t border-[#dcdcdc] flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-20 h-[22px] px-2 border border-[#7a7a7a] rounded-[2px] bg-gradient-to-b from-[#fbfbfb] to-[#e1e1e1] hover:from-[#eef5fd] hover:to-[#cfe1f5] hover:border-[#3399ff] text-[11px] text-[#000000]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim() || isSubmitting}
            className="w-24 h-[22px] px-2 border border-[#0055ea] rounded-[2px] bg-gradient-to-b from-[#3399ff] to-[#0066cc] hover:from-[#4da6ff] hover:to-[#0073e6] active:from-[#0055ea] active:to-[#0044bb] text-[11px] font-medium text-white shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
          >
            <Save className="w-3 h-3" />
            <span>{isSubmitting ? 'Saving...' : 'Save As'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
