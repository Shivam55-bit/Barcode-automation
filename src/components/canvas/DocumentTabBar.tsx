import React, { useState, useRef, useEffect } from 'react';
import { OpenDocument } from '../../types';
import { Plus, X, FileText, LayoutTemplate, Copy, Save, Check, ChevronLeft, ChevronRight } from 'lucide-react';

interface DocumentTabBarProps {
  documents: OpenDocument[];
  activeInstanceId: string | null;
  onSelectTab: (instanceId: string) => void;
  onCloseTab: (instanceId: string) => void;
  onNewTemplate: () => void;
  onNewForm: () => void;
  onSaveDoc?: (instanceId: string) => void;
  onSaveAll?: () => void;
  onDuplicateDoc?: (instanceId: string) => void;
  onCloseOthers?: (instanceId: string) => void;
  onCloseAll?: () => void;
}

export const DocumentTabBar: React.FC<DocumentTabBarProps> = ({
  documents,
  activeInstanceId,
  onSelectTab,
  onCloseTab,
  onNewTemplate,
  onNewForm,
  onSaveDoc,
  onSaveAll,
  onDuplicateDoc,
  onCloseOthers,
  onCloseAll,
}) => {
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    instanceId: string;
  } | null>(null);

  const addMenuRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setIsAddMenuOpen(false);
      }
      setContextMenu(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAddMenuOpen(false);
        setContextMenu(null);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Auto-scroll active tab into view
  useEffect(() => {
    if (activeTabRef.current && scrollContainerRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [activeInstanceId]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -150 : 150;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handleContextMenu = (e: React.MouseEvent, instanceId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAddMenuOpen(false);
    setContextMenu({
      x: e.clientX,
      y: e.clientY - 120, // offset above bottom bar
      instanceId,
    });
  };

  return (
    <div className="relative flex items-center h-7 bg-[#d8e2ee] border-t border-[#b8c5d6] text-xs select-none shrink-0">
      {/* Scroll Left Button if needed */}
      <button
        type="button"
        onClick={() => handleScroll('left')}
        className="px-1 h-full text-slate-500 hover:text-slate-800 hover:bg-[#c6d4e4] border-r border-[#b8c5d6] flex items-center justify-center transition-colors"
        title="Scroll Tabs Left"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>

      {/* Tabs Container */}
      <div
        ref={scrollContainerRef}
        className="flex-1 flex items-center gap-1 px-1 overflow-x-auto no-scrollbar whitespace-nowrap h-full"
      >
        {documents.map((doc) => {
          const isActive = doc.instanceId === activeInstanceId;
          return (
            <div
              key={doc.instanceId}
              ref={isActive ? activeTabRef : null}
              onContextMenu={(e) => handleContextMenu(e, doc.instanceId)}
              onClick={() => onSelectTab(doc.instanceId)}
              className={`group flex items-center gap-1.5 h-[26px] px-2.5 rounded-t-sm border-t-2 text-[11.5px] font-medium cursor-pointer transition-all ${
                isActive
                  ? 'bg-[#fff8db] border-t-amber-500 border-x border-[#b8c5d6] text-slate-900 shadow-xs'
                  : 'bg-[#e4ebf5] border-t-transparent hover:bg-[#d0deec] text-slate-700 border-x border-transparent'
              }`}
              title={`${doc.name} ${doc.isDirty ? '(Modified)' : ''}`}
            >
              {/* Icon according to document type */}
              {doc.type === 'form' ? (
                <LayoutTemplate className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-600' : 'text-slate-500'}`} />
              ) : (
                <FileText className={`w-3.5 h-3.5 ${isActive ? 'text-amber-600' : 'text-slate-500'}`} />
              )}

              {/* Document Name */}
              <span className="truncate max-w-[140px] select-none">{doc.name}</span>

              {/* Dirty Indicator */}
              {doc.isDirty && (
                <span className="text-amber-600 font-bold text-sm leading-none" title="Unsaved Changes">
                  *
                </span>
              )}

              {/* Close Tab Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(doc.instanceId);
                }}
                className={`p-0.5 rounded-xs transition-colors ${
                  isActive
                    ? 'text-slate-500 hover:text-red-700 hover:bg-amber-200'
                    : 'text-slate-400 hover:text-red-700 hover:bg-slate-300 opacity-60 group-hover:opacity-100'
                }`}
                title="Close Document"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Scroll Right Button */}
      <button
        type="button"
        onClick={() => handleScroll('right')}
        className="px-1 h-full text-slate-500 hover:text-slate-800 hover:bg-[#c6d4e4] border-l border-[#b8c5d6] flex items-center justify-center transition-colors"
        title="Scroll Tabs Right"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>

      {/* Add Tab Button & Dropdown Menu */}
      <div className="relative h-full" ref={addMenuRef}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsAddMenuOpen((prev) => !prev);
          }}
          className="h-full px-2 text-slate-600 hover:text-slate-900 hover:bg-[#c6d4e4] border-l border-[#b8c5d6] flex items-center justify-center transition-colors"
          title="New Document / Form"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        {isAddMenuOpen && (
          <div className="absolute right-0 bottom-full mb-1 w-48 bg-white rounded-md shadow-xl border border-slate-200 py-1 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
            <button
              type="button"
              onClick={() => {
                setIsAddMenuOpen(false);
                onNewTemplate();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-amber-50 hover:text-amber-900 transition-colors text-left"
            >
              <FileText className="w-4 h-4 text-amber-600" />
              <div>
                <div className="font-semibold text-slate-800">New Label Template</div>
                <div className="text-[10px] text-slate-500">Design barcode/label layout</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAddMenuOpen(false);
                onNewForm();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-indigo-50 hover:text-indigo-900 transition-colors text-left border-t border-slate-100"
            >
              <LayoutTemplate className="w-4 h-4 text-indigo-600" />
              <div>
                <div className="font-semibold text-slate-800">New Data Entry Form</div>
                <div className="text-[10px] text-slate-500">Operator input form</div>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Tab Right-Click Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-white rounded-md shadow-2xl border border-slate-200 py-1 z-50 text-xs min-w-[160px]"
          style={{
            left: `${Math.min(contextMenu.x, window.innerWidth - 180)}px`,
            top: `${Math.max(10, contextMenu.y)}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {onSaveDoc && (
            <button
              type="button"
              onClick={() => {
                onSaveDoc(contextMenu.instanceId);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-700 hover:bg-slate-100 text-left"
            >
              <Save className="w-3.5 h-3.5 text-slate-500" />
              <span>Save</span>
            </button>
          )}
          {onSaveAll && (
            <button
              type="button"
              onClick={() => {
                onSaveAll();
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-700 hover:bg-slate-100 text-left"
            >
              <Save className="w-3.5 h-3.5 text-blue-500" />
              <span>Save All</span>
            </button>
          )}
          {onDuplicateDoc && (
            <button
              type="button"
              onClick={() => {
                onDuplicateDoc(contextMenu.instanceId);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-700 hover:bg-slate-100 text-left"
            >
              <Copy className="w-3.5 h-3.5 text-slate-500" />
              <span>Duplicate Tab</span>
            </button>
          )}
          <div className="h-px bg-slate-200 my-1" />
          <button
            type="button"
            onClick={() => {
              onCloseTab(contextMenu.instanceId);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-red-600 hover:bg-red-50 text-left"
          >
            <X className="w-3.5 h-3.5" />
            <span>Close</span>
          </button>
          {onCloseOthers && (
            <button
              type="button"
              onClick={() => {
                onCloseOthers(contextMenu.instanceId);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-700 hover:bg-slate-100 text-left"
            >
              <span>Close Other Tabs</span>
            </button>
          )}
          {onCloseAll && (
            <button
              type="button"
              onClick={() => {
                onCloseAll();
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-700 hover:bg-slate-100 text-left"
            >
              <span>Close All Tabs</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
