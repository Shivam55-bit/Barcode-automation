import React from 'react';
import { Keyboard, Command, Sparkles } from 'lucide-react';
import { Modal } from '../common/Modal';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  const shortcutSections = [
    {
      title: 'Tools & Insertion',
      shortcuts: [
        { key: 'V', desc: 'Select / Move Tool' },
        { key: 'T', desc: 'Insert Text Box' },
        { key: 'B', desc: 'Insert 1D Barcode (Code128)' },
        { key: 'Q', desc: 'Insert QR Code' },
        { key: 'M', desc: 'Insert DataMatrix 2D' },
        { key: 'R', desc: 'Insert Rectangle' },
        { key: 'C', desc: 'Insert Circle / Ellipse' },
        { key: 'L', desc: 'Insert Line' },
        { key: 'G', desc: 'Insert GS1-128 Wizard Block' },
      ],
    },
    {
      title: 'Editing & Canvas',
      shortcuts: [
        { key: 'Ctrl + Z', desc: 'Undo' },
        { key: 'Ctrl + Y / Ctrl+Shift+Z', desc: 'Redo' },
        { key: 'Ctrl + C', desc: 'Copy selected element' },
        { key: 'Ctrl + X', desc: 'Cut selected element' },
        { key: 'Ctrl + V', desc: 'Paste copied element' },
        { key: 'Ctrl + D', desc: 'Duplicate selected element' },
        { key: 'Delete / Backspace', desc: 'Delete selected element' },
        { key: 'Ctrl + A', desc: 'Select all elements' },
        { key: 'Arrow Keys', desc: 'Nudge element by 0.5mm (Shift + Arrow for 5mm)' },
        { key: 'Space + Drag', desc: 'Pan canvas workspace' },
      ],
    },
    {
      title: 'View & Print Operations',
      shortcuts: [
        { key: 'Ctrl + P', desc: 'Open Print Production Center' },
        { key: 'Ctrl + E', desc: 'Export Thermal ZPL / EPL Code' },
        { key: 'Ctrl + S', desc: 'Save Template changes' },
        { key: 'Ctrl + + / -', desc: 'Zoom in / Zoom out' },
        { key: 'Ctrl + 0', desc: 'Fit label to screen' },
        { key: 'Ctrl + 1', desc: 'Reset zoom to 100%' },
        { key: "Ctrl + '", desc: 'Toggle Canvas Grid' },
        { key: 'Ctrl + R', desc: 'Toggle Precision Rulers' },
      ],
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Keyboard Shortcuts & Accelerators"
      subtitle="Master rapid industrial label design and thermal print controls"
      maxWidth="4xl"
      footer={
        <button
          onClick={onClose}
          className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-lg text-xs font-semibold"
        >
          Close
        </button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {shortcutSections.map((sec) => (
          <div key={sec.title} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5 border-b border-slate-200 pb-2">
              <Keyboard className="w-3.5 h-3.5 text-blue-600" />
              <span>{sec.title}</span>
            </h4>
            <div className="space-y-2.5">
              {sec.shortcuts.map((sc) => (
                <div key={sc.key} className="flex items-center justify-between text-xs gap-2">
                  <span className="text-slate-600">{sc.desc}</span>
                  <kbd className="px-2 py-0.5 bg-white border border-slate-300 rounded shadow-2xs font-mono text-[11px] font-bold text-slate-800 whitespace-nowrap">
                    {sc.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
};
