import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText,
  Clock,
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
      const targetPath = item.absolutePath || item.filePath;
      const exists = await checkFileExistsOnDisk(targetPath);
      if (!exists) {
        setMissingFileItem(item);
        return;
      }
      onClose();
      onOpenRecentDocument(targetPath);
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
      {/* BarcodeFlow desktop welcome dialog */}
      <div
        ref={modalRef}
        className="relative w-[560px] max-w-[95vw] bg-[#f0f4f9] border border-[#7088a8] rounded-sm shadow-2xl flex flex-col overflow-hidden text-slate-800 font-sans"
        style={{
          boxShadow: '0 12px 36px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.25)',
        }}
      >
        {/* 1. Windows Classic Title Bar */}
        <div className="h-7 bg-gradient-to-r from-[#d9e5f4] via-[#e6effa] to-[#d4e2f2] border-b border-[#a6bcd6] flex items-center justify-between px-2.5">
          <div className="flex items-center gap-1.5">
            {/* BarcodeFlow mark */}
            <div className="w-3.5 h-3.5 bg-[#0052cc] rounded-[2px] flex items-center justify-center shadow-xs">
              <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-white fill-current">
                <path d="M2 4h2v16H2V4zm4 0h1v16H6V4zm3 0h2v16H9V4zm4 0h3v16h-3V4zm5 0h1v16h-1V4zm3 0h1v16h-1V4z" />
              </svg>
            </div>
            <span className="text-[12px] font-semibold text-slate-800 tracking-tight">BarcodeFlow</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-5 h-5 flex items-center justify-center rounded-[2px] hover:bg-[#e81123] hover:text-white text-slate-600 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 2. BarcodeFlow welcome banner */}
        <div className="relative bg-gradient-to-r from-[#ffffff] via-[#ebf4fd] to-[#bfe0f8] border-b border-[#cbd7e6] px-6 py-3.5 flex items-center justify-between overflow-hidden min-h-[76px]">
          {/* Watermark barcode numbers, codes and stripes */}
          <div className="absolute inset-0 pointer-events-none select-none opacity-20 overflow-hidden flex items-center justify-end pr-2">
            <div className="font-mono text-[13px] font-bold text-sky-900 tracking-widest leading-none whitespace-nowrap select-none">
              4359700101110001010&nbsp;&nbsp;[A7-118]&nbsp;&nbsp;||| | |||| | |||
            </div>
          </div>

          {/* Left: Bold Welcome Header */}
          <div className="z-10">
            <h2 className="text-[22px] font-bold text-slate-900 tracking-tight leading-tight">Welcome!</h2>
            <p className="text-[11px] text-slate-600 mt-0.5 font-medium">
              Enterprise Label Design & Automation Suite
            </p>
          </div>

          {/* Barcode and label artwork */}
          <div className="relative z-10 flex items-center gap-1.5 pr-1 shrink-0">
            {/* Horizontal Barcode Label */}
            <div className="w-[52px] h-[26px] bg-white border border-slate-300 rounded-[2px] shadow-xs flex flex-col justify-center px-1">
              <div className="flex justify-between items-center h-3 w-full px-0.5">
                <span className="w-0.5 h-full bg-slate-800"></span>
                <span className="w-1 h-full bg-slate-800"></span>
                <span className="w-0.5 h-full bg-slate-800"></span>
                <span className="w-1.5 h-full bg-slate-800"></span>
                <span className="w-0.5 h-full bg-slate-800"></span>
                <span className="w-1 h-full bg-slate-800"></span>
                <span className="w-0.5 h-full bg-slate-800"></span>
              </div>
              <div className="text-[6.5px] font-mono text-center text-slate-600 leading-none mt-0.5">A7-118</div>
            </div>

            {/* Vertical Barcode / DataMatrix Document */}
            <div className="w-[42px] h-[48px] bg-white border border-slate-300 rounded-[2px] shadow-xs flex flex-col items-center justify-between p-1">
              {/* 2D DataMatrix code icon */}
              <div className="w-4 h-4 grid grid-cols-3 grid-rows-3 gap-[1px] bg-slate-800 p-[1px] rounded-[1px]">
                <div className="bg-white"></div>
                <div className="bg-slate-800"></div>
                <div className="bg-white"></div>
                <div className="bg-slate-800"></div>
                <div className="bg-white"></div>
                <div className="bg-slate-800"></div>
                <div className="bg-white"></div>
                <div className="bg-slate-800"></div>
                <div className="bg-white"></div>
              </div>
              <div className="w-full space-y-0.5">
                <div className="w-full h-[1.5px] bg-slate-300 rounded-full"></div>
                <div className="w-3/4 h-[1.5px] bg-slate-300 rounded-full"></div>
                <div className="w-full h-[1.5px] bg-slate-300 rounded-full"></div>
              </div>
              {/* Mini barcode lines */}
              <div className="w-full h-1.5 flex justify-between">
                <span className="w-0.5 h-full bg-slate-800"></span>
                <span className="w-0.5 h-full bg-slate-800"></span>
                <span className="w-1 h-full bg-slate-800"></span>
                <span className="w-0.5 h-full bg-slate-800"></span>
                <span className="w-1 h-full bg-slate-800"></span>
              </div>
            </div>

            {/* CD-ROM Disc with Label */}
            <div className="relative w-12 h-12 rounded-full bg-gradient-to-tr from-[#9bbce2] via-[#e4edf8] to-[#92b5db] border border-[#6b8dae] shadow-sm flex items-center justify-center -ml-2">
              {/* Disc inner ring */}
              <div className="w-6 h-6 rounded-full bg-[#cbdcee] border border-[#83a6cb] flex items-center justify-center">
                {/* Center hole */}
                <div className="w-2.5 h-2.5 rounded-full bg-[#f0f4f9] border border-slate-400"></div>
              </div>
              {/* Mini barcode printed on disc */}
              <div className="absolute bottom-1 w-5 h-1.5 flex justify-between px-0.5 opacity-80">
                <span className="w-0.5 h-full bg-slate-800"></span>
                <span className="w-0.5 h-full bg-slate-800"></span>
                <span className="w-1 h-full bg-slate-800"></span>
                <span className="w-0.5 h-full bg-slate-800"></span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Main Content Body */}
        <div className="p-6 flex flex-col space-y-4 bg-[#f0f4f9]">
          <p className="text-[12.5px] font-semibold text-slate-800">What would you like to do?</p>

          {/* Action 1: Start a new document */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onNewDocument();
            }}
            className="group flex items-center gap-3.5 w-full p-2.5 text-left rounded-[3px] bg-[#f8fbfe]/60 hover:bg-[#e2ecf7] active:bg-[#d0e0f3] border border-transparent hover:border-[#8cb0db] transition-all cursor-pointer shadow-2xs hover:shadow-xs"
          >
            {/* New document icon */}
            <div className="relative w-9 h-9 rounded-[2px] bg-white border border-[#9ebcdb] shadow-xs flex items-center justify-center shrink-0 group-hover:border-blue-500">
              <FileText className="w-5 h-5 text-slate-700" />
              {/* Golden 8-point Sparkle / Sun Badge */}
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-tr from-amber-400 to-yellow-300 rounded-full border border-amber-600 shadow-xs flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-amber-900 fill-current">
                  <path d="M12 0l2.5 8.5L23 12l-8.5 2.5L12 23l-2.5-8.5L1 12l8.5-2.5z" />
                </svg>
              </div>
            </div>

            <div>
              <div className="text-[12.5px] font-semibold text-slate-900 group-hover:text-blue-900">
                <span className="underline decoration-slate-400 group-hover:decoration-blue-700">S</span>tart a new BarcodeFlow document...
              </div>
              <div className="text-[10.5px] text-slate-500 mt-0.5">
                Create a blank label or choose from predefined industry templates using the New Document Wizard
              </div>
            </div>
          </button>

          {/* Action 2: Open an existing document */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenExisting();
            }}
            className="group flex items-center gap-3.5 w-full p-2.5 text-left rounded-[3px] bg-[#f8fbfe]/60 hover:bg-[#e2ecf7] active:bg-[#d0e0f3] border border-transparent hover:border-[#8cb0db] transition-all cursor-pointer shadow-2xs hover:shadow-xs"
          >
            {/* Manila Open Folder Icon */}
            <div className="relative w-9 h-9 rounded-[2px] bg-gradient-to-b from-[#fffbe6] to-[#fce881] border border-[#d6b43b] shadow-xs flex items-center justify-center shrink-0 group-hover:border-amber-600">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-800 fill-amber-300">
                <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
              </svg>
            </div>

            <div>
              <div className="text-[12.5px] font-semibold text-slate-900 group-hover:text-blue-900">
                <span className="underline decoration-slate-400 group-hover:decoration-blue-700">O</span>pen an existing BarcodeFlow document...
              </div>
              <div className="text-[10.5px] text-slate-500 mt-0.5">
                Open .bfl or JSON files, or choose a .btw file for limited import.
              </div>
            </div>
          </button>

          {/* Action 3: Recent Documents Section */}
          <div className="pt-1">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-4 h-4 rounded-[2px] bg-slate-200 border border-slate-300 flex items-center justify-center">
                <Clock className="w-2.5 h-2.5 text-slate-600" />
              </div>
              <span className="text-[11.5px] font-semibold text-slate-800">
                Open a <span className="underline decoration-slate-400">r</span>ecently used BarcodeFlow document:
              </span>
            </div>

            {/* Sunken List Box */}
            <div
              ref={listRef}
              tabIndex={0}
              className="h-28 bg-white border border-[#7f9db9] rounded-[2px] overflow-y-auto p-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-inner"
            >
              {recentDocuments.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[11px] text-slate-400 italic">
                  No recently opened documents
                </div>
              ) : (
                recentDocuments.slice(0, 10).map((item, index) => {
                  const isSelected = index === selectedIndex;
                  const itemPath = item.absolutePath || item.filePath;
                  const itemName = item.displayName || item.fileName || itemPath.split(/[\\/]/).pop() || 'Document.bfl';
                  return (
                    <div
                      key={item.id || itemPath}
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
                      title={`${itemName}\n${itemPath}`}
                    >
                      <div className="flex items-center gap-1.5 truncate min-w-0 pr-2">
                        <FileText
                          className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-slate-500'}`}
                        />
                        <span className="truncate">{itemName}</span>
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
          {/* Don't show this dialog again checkbox */}
          <label className="flex items-center gap-2 cursor-pointer text-[11.5px] text-slate-700 hover:text-slate-900 select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => {
                const checked = e.target.checked;
                setDontShowAgain(checked);
                onToggleShowWelcomeOnStartup(!checked);
              }}
              className="rounded-[2px] text-blue-600 focus:ring-0 border-slate-400 w-3.5 h-3.5 cursor-pointer"
            />
            <span>Don't show this dialog again</span>
          </label>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!(recentDocuments.length > 0 && selectedIndex >= 0 && selectedIndex < recentDocuments.length)}
              onClick={() => {
                if (recentDocuments.length > 0 && selectedIndex >= 0 && selectedIndex < recentDocuments.length) {
                  handleAttemptOpenRecent(recentDocuments[selectedIndex]);
                }
              }}
              className="px-4 py-1 rounded-[2px] text-[11.5px] font-semibold shadow-xs transition-colors cursor-pointer disabled:cursor-not-allowed disabled:bg-[#d0d7de] disabled:text-[#8c959f] disabled:border disabled:border-[#d0d7de] bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white"
            >
              Open Selected
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-6 py-1 bg-[#e1e1e1] hover:bg-[#e5f1fb] hover:border-[#0078d7] active:bg-[#cce4f7] border border-[#707070] text-slate-900 rounded-[2px] text-[11.5px] font-semibold shadow-xs transition-colors cursor-pointer"
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

      {/* Missing File Error Modal */}
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
                className="w-4 h-4 flex items-center justify-center hover:bg-red-600 hover:text-white text-slate-500 rounded-xs cursor-pointer"
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
