import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText,
  FolderOpen,
  Clock,
  Sparkles,
  QrCode,
  Barcode,
  X,
  AlertTriangle,
  FolderSearch,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { RecentDocumentEntry } from '../../types';
import { checkFileExistsOnDisk, openFileLocationOnDisk, removeRecentDocument } from '../../services/documentFileService';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNewDocument: () => void;
  onOpenExisting: () => void;
  onOpenRecentDocument: (filePath: string) => void;
  recentDocuments: RecentDocumentEntry[];
  onRefreshRecent: () => void;
  showWelcomeOnStartup: boolean;
  onToggleShowWelcomeOnStartup: (enabled: boolean) => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({
  isOpen,
  onClose,
  onNewDocument,
  onOpenExisting,
  onOpenRecentDocument,
  recentDocuments,
  onRefreshRecent,
  showWelcomeOnStartup,
  onToggleShowWelcomeOnStartup,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(!showWelcomeOnStartup);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: RecentDocumentEntry } | null>(null);
  const [missingFileItem, setMissingFileItem] = useState<RecentDocumentEntry | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Sync checkbox with incoming state
  useEffect(() => {
    setDontShowAgain(!showWelcomeOnStartup);
  }, [showWelcomeOnStartup]);

  // Keep selected index within range
  useEffect(() => {
    if (recentDocuments.length > 0 && selectedIndex >= recentDocuments.length) {
      setSelectedIndex(recentDocuments.length - 1);
    }
  }, [recentDocuments, selectedIndex]);

  // Handle open recent with disk existence verification
  const handleAttemptOpenRecent = useCallback(
    async (item: RecentDocumentEntry) => {
      const exists = await checkFileExistsOnDisk(item.filePath);
      if (!exists) {
        setMissingFileItem(item);
        return;
      }
      onClose();
      onOpenRecentDocument(item.filePath);
    },
    [onClose, onOpenRecentDocument]
  );

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Missing file modal active -> let it handle its own keys
      if (missingFileItem) {
        if (e.key === 'Escape') {
          setMissingFileItem(null);
        }
        return;
      }

      // Alt + N -> New Document
      if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        onClose();
        onNewDocument();
        return;
      }

      // Alt + O -> Open Existing
      if (e.altKey && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        onClose();
        onOpenExisting();
        return;
      }

      // Escape -> Close Welcome dialog
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Arrow Up in recent list
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(0, prev - 1));
        return;
      }

      // Arrow Down in recent list
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(recentDocuments.length - 1, prev + 1));
        return;
      }

      // Enter -> Open selected recent item
      if (e.key === 'Enter') {
        if (recentDocuments.length > 0 && selectedIndex >= 0 && selectedIndex < recentDocuments.length) {
          e.preventDefault();
          handleAttemptOpenRecent(recentDocuments[selectedIndex]);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, missingFileItem, recentDocuments, selectedIndex, onClose, onNewDocument, onOpenExisting, handleAttemptOpenRecent]);

  // Close context menu on outside click
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 backdrop-blur-[1px] select-none animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Classic Windows Desktop Dialog Window */}
      <div
        ref={modalRef}
        className="relative w-[570px] max-w-[95vw] bg-[#f0f4f9] border border-[#7088a8] rounded-sm shadow-2xl flex flex-col overflow-hidden text-slate-800 font-sans"
        style={{
          boxShadow: '0 10px 30px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.2)',
        }}
      >
        {/* 1. Windows Classic Title Bar */}
        <div className="h-7 bg-gradient-to-r from-[#d9e5f4] via-[#e6effa] to-[#d4e2f2] border-b border-[#a6bcd6] flex items-center justify-between px-2.5">
          <div className="flex items-center gap-1.5">
            {/* BarcodeFlow Icon */}
            <div className="w-3.5 h-3.5 bg-blue-700 rounded-xs flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-white fill-current">
                <path d="M2 4h2v16H2V4zm4 0h1v16H6V4zm3 0h2v16H9V4zm4 0h3v16h-3V4zm5 0h1v16h-1V4zm3 0h1v16h-1V4z" />
              </svg>
            </div>
            <span className="text-[11.5px] font-semibold text-slate-800 tracking-tight">BarcodeFlow</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-5 h-5 flex items-center justify-center rounded-xs hover:bg-[#e81123] hover:text-white text-slate-600 transition-colors"
            title="Close (Esc)"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* 2. Top Header Graphic / Welcome Banner */}
        <div className="relative bg-white border-b border-[#cbd7e6] px-5 py-4 flex items-center justify-between overflow-hidden">
          <div className="z-10">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Welcome!</h2>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              BarcodeFlow Enterprise Label Design & Automation Suite
            </p>
          </div>

          {/* Right Header Illustration (Label, Barcode, Disc Graphics) */}
          <div className="flex items-center gap-2 pr-1 opacity-90">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-700 via-indigo-600 to-cyan-400 p-[2px] shadow-sm flex items-center justify-center">
              <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                <div className="w-3.5 h-3.5 rounded-full bg-slate-800 border-2 border-white" />
              </div>
            </div>

            <div className="bg-gradient-to-b from-white to-slate-100 border border-slate-300 rounded-xs px-2 py-1.5 shadow-xs flex flex-col items-center justify-center min-w-[58px]">
              <Barcode className="w-8 h-4 text-slate-800 stroke-[1.5]" />
              <div className="w-full h-[1px] bg-slate-300 my-0.5" />
              <QrCode className="w-3 h-3 text-blue-700" />
            </div>
          </div>
        </div>

        {/* 3. Main Content Body */}
        <div className="p-5 flex flex-col space-y-3.5 bg-[#f0f4f9]">
          <p className="text-[12px] font-semibold text-slate-800">What would you like to do?</p>

          {/* Action 1: Start New Document */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onNewDocument();
            }}
            className="group flex items-center gap-3 w-full p-2 text-left rounded-sm hover:bg-[#e2ecf7] active:bg-[#d0e0f3] border border-transparent hover:border-[#b8cfe8] transition-all cursor-pointer"
          >
            <div className="w-8 h-8 rounded-sm bg-gradient-to-b from-[#fffae6] to-[#fde99a] border border-[#d6b75c] shadow-xs flex items-center justify-center shrink-0 group-hover:shadow-sm">
              <Sparkles className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <div className="text-[12px] font-medium text-slate-900 group-hover:text-blue-900">
                <span className="underline decoration-slate-400 group-hover:decoration-blue-700">S</span>tart a new BarcodeFlow document...
              </div>
              <div className="text-[10px] text-slate-500">Create a blank or predefined label template using the wizard</div>
            </div>
          </button>

          {/* Action 2: Open Existing Document */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenExisting();
            }}
            className="group flex items-center gap-3 w-full p-2 text-left rounded-sm hover:bg-[#e2ecf7] active:bg-[#d0e0f3] border border-transparent hover:border-[#b8cfe8] transition-all cursor-pointer"
          >
            <div className="w-8 h-8 rounded-sm bg-gradient-to-b from-[#fbfdf7] to-[#e4f0d3] border border-[#a8c78c] shadow-xs flex items-center justify-center shrink-0 group-hover:shadow-sm">
              <FolderOpen className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <div className="text-[12px] font-medium text-slate-900 group-hover:text-blue-900">
                <span className="underline decoration-slate-400 group-hover:decoration-blue-700">O</span>pen an existing BarcodeFlow document...
              </div>
              <div className="text-[10px] text-slate-500">Browse disk for saved .bfl, .btw, or JSON document files</div>
            </div>
          </button>

          {/* Action 3: Recent Documents Header */}
          <div className="pt-1">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-5 h-5 rounded-xs bg-slate-200 border border-slate-300 flex items-center justify-center">
                <Clock className="w-3 h-3 text-slate-600" />
              </div>
              <span className="text-[11.5px] font-semibold text-slate-800">
                Open a <span className="underline decoration-slate-400">r</span>ecently used BarcodeFlow document:
              </span>
            </div>

            {/* Classic Desktop Sunken List Box */}
            <div
              ref={listRef}
              tabIndex={0}
              className="h-32 bg-white border border-[#7f9db9] rounded-xs overflow-y-auto p-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-inner"
            >
              {recentDocuments.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                  No recently opened documents
                </div>
              ) : (
                recentDocuments.slice(0, 10).map((item, index) => {
                  const isSelected = index === selectedIndex;
                  return (
                    <div
                      key={item.filePath}
                      onClick={() => setSelectedIndex(index)}
                      onDoubleClick={() => handleAttemptOpenRecent(item)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedIndex(index);
                        setContextMenu({ x: e.clientX, y: e.clientY, item });
                      }}
                      className={`px-2 py-1 text-[11.5px] cursor-pointer flex items-center justify-between transition-colors ${
                        isSelected
                          ? 'bg-[#3399ff] text-white font-medium'
                          : 'text-slate-800 hover:bg-[#e5f1fb]'
                      }`}
                      title={`${item.fileName || item.filePath}\n${item.filePath}`}
                    >
                      <div className="flex items-center gap-1.5 truncate min-w-0 pr-2">
                        <FileText
                          className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-slate-500'}`}
                        />
                        <span className="truncate">{item.fileName || item.filePath.split(/[\\/]/).pop()}</span>
                      </div>

                      {item.lastOpenedAt && (
                        <span
                          className={`text-[9.5px] font-mono shrink-0 ${
                            isSelected ? 'text-blue-100' : 'text-slate-400'
                          }`}
                        >
                          {new Date(item.lastOpenedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* 4. Bottom Footer Bar */}
        <div className="h-12 bg-[#e4ebf5] border-t border-[#cbd5e1] px-5 flex items-center justify-between">
          {/* Don't show again checkbox */}
          <label className="flex items-center gap-2 cursor-pointer text-[11.5px] text-slate-700 hover:text-slate-900">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => {
                const checked = e.target.checked;
                setDontShowAgain(checked);
                onToggleShowWelcomeOnStartup(!checked);
              }}
              className="rounded-xs text-blue-600 focus:ring-0 border-slate-400 w-3.5 h-3.5 cursor-pointer"
            />
            <span>Don't show this dialog again</span>
          </label>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {recentDocuments.length > 0 && selectedIndex >= 0 && selectedIndex < recentDocuments.length && (
              <button
                type="button"
                onClick={() => handleAttemptOpenRecent(recentDocuments[selectedIndex])}
                className="px-4 py-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xs text-[11.5px] font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Open Selected
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-1 bg-[#e1e1e1] hover:bg-[#d4d4d4] active:bg-[#c4c4c4] border border-[#707070] text-slate-900 rounded-xs text-[11.5px] font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Right Click Context Menu on Recent Document Item */}
      {contextMenu && (
        <div
          className="fixed z-[10000] w-48 bg-white border border-[#b8c5d6] shadow-xl py-1 rounded-xs text-[11.5px] text-slate-800"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              const item = contextMenu.item;
              setContextMenu(null);
              handleAttemptOpenRecent(item);
            }}
            className="w-full flex items-center gap-2 px-3 py-1 hover:bg-[#3399ff] hover:text-white text-left cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span>Open Document</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              const path = contextMenu.item.filePath;
              setContextMenu(null);
              await openFileLocationOnDisk(path);
            }}
            className="w-full flex items-center gap-2 px-3 py-1 hover:bg-[#3399ff] hover:text-white text-left cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
            <span>Open File Location</span>
          </button>

          <div className="h-px bg-slate-200 my-1" />

          <button
            type="button"
            onClick={() => {
              removeRecentDocument(contextMenu.item.filePath);
              onRefreshRecent();
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-1 hover:bg-red-50 text-red-600 text-left cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove from Recent</span>
          </button>
        </div>
      )}

      {/* 5. Missing File Error Modal */}
      {missingFileItem && (
        <div
          className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50 select-none animate-in fade-in duration-100"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMissingFileItem(null);
          }}
        >
          <div className="w-[440px] bg-white border border-[#7088a8] rounded-xs shadow-2xl overflow-hidden text-slate-800">
            {/* Title */}
            <div className="h-7 bg-[#e4ebf5] border-b border-[#cbd5e1] px-3 flex items-center justify-between">
              <span className="text-[11.5px] font-bold text-slate-800">BarcodeFlow - File Not Found</span>
              <button
                type="button"
                onClick={() => setMissingFileItem(null)}
                className="w-4 h-4 flex items-center justify-center hover:bg-red-600 hover:text-white text-slate-500 rounded-xs"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 flex gap-3.5">
              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="space-y-1.5 min-w-0">
                <h4 className="text-xs font-bold text-slate-900">Document could not be found</h4>
                <p className="text-[11px] text-slate-600">
                  The file may have been moved, renamed, or deleted from disk:
                </p>
                <p className="text-[10px] font-mono text-slate-800 bg-slate-100 p-1.5 rounded-xs border border-slate-200 break-all">
                  {missingFileItem.filePath}
                </p>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="h-10 bg-[#f0f4f9] border-t border-[#cbd5e1] px-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={async () => {
                  setMissingFileItem(null);
                  onClose();
                  onOpenExisting();
                }}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xs text-[11px] font-semibold cursor-pointer flex items-center gap-1"
              >
                <FolderSearch className="w-3 h-3" />
                <span>Locate File...</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  removeRecentDocument(missingFileItem.filePath);
                  onRefreshRecent();
                  setMissingFileItem(null);
                }}
                className="px-3 py-1 bg-white hover:bg-red-50 text-red-600 border border-slate-300 rounded-xs text-[11px] font-semibold cursor-pointer"
              >
                Remove from Recent
              </button>
              <button
                type="button"
                onClick={() => setMissingFileItem(null)}
                className="px-3 py-1 bg-[#e1e1e1] hover:bg-[#d4d4d4] border border-[#707070] text-slate-800 rounded-xs text-[11px] font-semibold cursor-pointer"
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
