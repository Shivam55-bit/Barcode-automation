import React, { useEffect, useRef } from 'react';
import {
  Scissors,
  Copy,
  Clipboard,
  Trash2,
  Lock,
  Unlock,
  Layers,
  ArrowUp,
  ArrowDown,
  Sliders,
  ShieldCheck,
} from 'lucide-react';
import { LabelElement } from '../../types';

interface ContextMenuProps {
  x: number;
  y: number;
  element: LabelElement | null;
  onClose: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onLockToggle: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onOpenProperties: () => void;
  onConvertToGS1?: () => void;
  onOpenPageSetup?: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  element,
  onClose,
  onCut,
  onCopy,
  onPaste,
  onDuplicate,
  onDelete,
  onLockToggle,
  onBringToFront,
  onSendToBack,
  onOpenProperties,
  onConvertToGS1,
  onOpenPageSetup,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-52 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1 text-slate-200 text-xs animate-in fade-in zoom-in-95 duration-100"
      style={{
        left: `${Math.min(x, window.innerWidth - 220)}px`,
        top: `${Math.min(y, window.innerHeight - 300)}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {element ? (
        <>
          <div className="px-3 py-1.5 font-semibold text-[10px] text-slate-400 border-b border-slate-800 truncate">
            {element.name} ({element.type})
          </div>

          <ContextItem icon={<Scissors className="w-3.5 h-3.5" />} label="Cut" shortcut="Ctrl+X" onClick={() => { onCut(); onClose(); }} />
          <ContextItem icon={<Copy className="w-3.5 h-3.5" />} label="Copy" shortcut="Ctrl+C" onClick={() => { onCopy(); onClose(); }} />
          <ContextItem icon={<Copy className="w-3.5 h-3.5" />} label="Duplicate" shortcut="Ctrl+D" onClick={() => { onDuplicate(); onClose(); }} />
          <ContextItem icon={<Trash2 className="w-3.5 h-3.5 text-red-400" />} label="Delete" shortcut="Del" onClick={() => { onDelete(); onClose(); }} />

          <div className="h-px bg-slate-800 my-1" />

          <ContextItem
            icon={element.locked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            label={element.locked ? 'Unlock Element' : 'Lock Element'}
            shortcut="Ctrl+L"
            onClick={() => { onLockToggle(); onClose(); }}
          />
          <ContextItem icon={<ArrowUp className="w-3.5 h-3.5" />} label="Bring to Front" shortcut="Ctrl+Shift+]" onClick={() => { onBringToFront(); onClose(); }} />
          <ContextItem icon={<ArrowDown className="w-3.5 h-3.5" />} label="Send to Back" shortcut="Ctrl+Shift+[" onClick={() => { onSendToBack(); onClose(); }} />

          {element.type === 'barcode' && onConvertToGS1 && (
            <>
              <div className="h-px bg-slate-800 my-1" />
              <ContextItem
                icon={<ShieldCheck className="w-3.5 h-3.5 text-blue-400" />}
                label="Configure GS1 Identifiers..."
                onClick={() => { onConvertToGS1(); onClose(); }}
              />
            </>
          )}

          <div className="h-px bg-slate-800 my-1" />

          <ContextItem icon={<Sliders className="w-3.5 h-3.5" />} label="Properties..." shortcut="F8" onClick={() => { onOpenProperties(); onClose(); }} />
        </>
      ) : (
        <>
          <ContextItem icon={<Clipboard className="w-3.5 h-3.5" />} label="Paste" shortcut="Ctrl+V" onClick={() => { onPaste(); onClose(); }} />
          {onOpenPageSetup && (
            <>
              <div className="h-px bg-slate-800 my-1" />
              <ContextItem
                icon={<Layers className="w-3.5 h-3.5 text-blue-400" />}
                label="Page Setup..."
                shortcut="Ctrl+D"
                onClick={() => { onOpenPageSetup(); onClose(); }}
              />
            </>
          )}
        </>
      )}
    </div>
  );
};

const ContextItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
}> = ({ icon, label, shortcut, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-blue-600 hover:text-white transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="w-4 h-4 flex items-center justify-center">{icon}</span>
        <span>{label}</span>
      </div>
      {shortcut && <span className="text-[10px] text-slate-400 font-mono">{shortcut}</span>}
    </button>
  );
};
