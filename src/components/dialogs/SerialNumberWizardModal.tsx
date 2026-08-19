import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { DataSourceItem } from '../../types';
import { Hash, Play, RotateCcw, Check, Sparkles } from 'lucide-react';

interface SerialNumberWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (item: Partial<DataSourceItem>) => void;
  initialItem?: Partial<DataSourceItem>;
}

export const SerialNumberWizardModal: React.FC<SerialNumberWizardModalProps> = ({
  isOpen,
  onClose,
  onApply,
  initialItem,
}) => {
  const [startValue, setStartValue] = useState<number>(initialItem?.serialStart ?? 1);
  const [stepValue, setStepValue] = useState<number>(initialItem?.serialStep ?? 1);
  const [padLength, setPadLength] = useState<number>(initialItem?.serialPad ?? 6);
  const [prefix, setPrefix] = useState<string>(initialItem?.serialPrefix ?? 'SN-');
  const [suffix, setSuffix] = useState<string>(initialItem?.serialSuffix ?? '');
  const [direction, setDirection] = useState<'increment' | 'decrement'>(initialItem?.serialDirection ?? 'increment');
  const [resetRule, setResetRule] = useState<'never' | 'daily' | 'monthly' | 'yearly' | 'job'>(initialItem?.serialResetRule ?? 'never');

  const generatePreviewSequence = (): string[] => {
    const list: string[] = [];
    const dir = direction === 'decrement' ? -1 : 1;
    for (let i = 0; i < 5; i++) {
      const val = startValue + (dir * stepValue * i);
      const padded = padLength > 0 ? String(val).padStart(padLength, '0') : String(val);
      list.push(`${prefix}${padded}${suffix}`);
    }
    return list;
  };

  const handleSave = () => {
    onApply({
      type: 'serial',
      name: `Serial (${prefix}${startValue})`,
      serialStart: startValue,
      serialStep: stepValue,
      serialPad: padLength,
      serialPrefix: prefix,
      serialSuffix: suffix,
      serialDirection: direction,
      serialResetRule: resetRule,
      enabled: true,
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Serial Number & Counter Wizard (BarTender Standard)" maxWidth="max-w-lg">
      <div className="space-y-4 text-xs text-slate-700">
        {/* Serialization Parameters */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div>
            <label className="text-[10px] text-slate-500 font-bold block mb-1">Starting Number</label>
            <input
              type="number"
              value={startValue}
              onChange={(e) => setStartValue(parseInt(e.target.value, 10) || 0)}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-500 font-bold block mb-1">Increment / Step Value</label>
            <input
              type="number"
              value={stepValue}
              onChange={(e) => setStepValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-500 font-bold block mb-1">Fixed Length (Zero Padding)</label>
            <input
              type="number"
              min={0}
              max={20}
              value={padLength}
              onChange={(e) => setPadLength(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-500 font-bold block mb-1">Counter Direction</label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as any)}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
            >
              <option value="increment">Increment (+)</option>
              <option value="decrement">Decrement (-)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-500 font-bold block mb-1">Prefix String</label>
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="e.g. SN-"
              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-500 font-bold block mb-1">Suffix String</label>
            <input
              type="text"
              value={suffix}
              onChange={(e) => setSuffix(e.target.value)}
              placeholder="e.g. -USA"
              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Reset Trigger Rules */}
        <div className="p-3 bg-white border border-slate-200 rounded-lg">
          <label className="text-[11px] font-bold text-slate-800 block mb-1.5 flex items-center gap-1.5">
            <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
            Automatic Reset Trigger Rule
          </label>
          <select
            value={resetRule}
            onChange={(e) => setResetRule(e.target.value as any)}
            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
          >
            <option value="never">Never Reset (Continuous Serialization)</option>
            <option value="daily">Reset Daily at Midnight (00:00:00)</option>
            <option value="monthly">Reset Monthly on 1st of Month</option>
            <option value="yearly">Reset Annually on Jan 1st</option>
            <option value="job">Reset at start of each Print Job</option>
          </select>
        </div>

        {/* Live Sequence Preview */}
        <div className="p-3 bg-slate-900 text-slate-100 rounded-lg">
          <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 mb-2 flex items-center justify-between">
            <span>Generated Serialization Preview (First 5 Labels)</span>
            <span className="text-emerald-400 font-bold">● Active</span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {generatePreviewSequence().map((item, idx) => (
              <div key={idx} className="bg-slate-800 p-2 rounded text-center border border-slate-700">
                <span className="text-[9px] text-slate-500 block mb-0.5">#{idx + 1}</span>
                <span className="font-mono font-bold text-xs text-amber-300 truncate block">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-1.5 border border-slate-300 rounded text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold shadow-xs"
          >
            <Check className="w-3.5 h-3.5" />
            Apply Serial Configuration
          </button>
        </div>
      </div>
    </Modal>
  );
};
