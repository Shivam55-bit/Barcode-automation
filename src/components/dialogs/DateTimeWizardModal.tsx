import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { DataSourceItem } from '../../types';
import { formatCustomDate } from '../../services/dataSourceEngine';
import { Calendar, Clock, Check, Sparkles } from 'lucide-react';

interface DateTimeWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (item: Partial<DataSourceItem>) => void;
  initialItem?: Partial<DataSourceItem>;
}

const COMMON_DATE_FORMATS = [
  { label: 'ISO Standard (YYYY-MM-DD)', mask: 'YYYY-MM-DD' },
  { label: 'GS1 Standard (YYMMDD)', mask: 'YYMMDD' },
  { label: 'European Format (DD/MM/YYYY)', mask: 'DD/MM/YYYY' },
  { label: 'US Format (MM/DD/YYYY)', mask: 'MM/DD/YYYY' },
  { label: 'Pharma / Medical (DD-MMM-YYYY)', mask: 'DD-MMM-YYYY' },
  { label: 'Timestamp (YYYY-MM-DD HH:mm:ss)', mask: 'YYYY-MM-DD HH:mm:ss' },
  { label: 'Time Only (HH:mm:ss)', mask: 'HH:mm:ss' },
];

export const DateTimeWizardModal: React.FC<DateTimeWizardModalProps> = ({
  isOpen,
  onClose,
  onApply,
  initialItem,
}) => {
  const [dateType, setDateType] = useState<'current' | 'expiry' | 'mfg' | 'custom'>(initialItem?.dateType ?? 'current');
  const [formatMask, setFormatMask] = useState<string>(initialItem?.dateFormat ?? 'YYYY-MM-DD');
  const [offsetDays, setOffsetDays] = useState<number>(initialItem?.dateOffsetDays ?? 0);
  const [offsetMonths, setOffsetMonths] = useState<number>(initialItem?.dateOffsetMonths ?? 0);
  const [offsetYears, setOffsetYears] = useState<number>(initialItem?.dateOffsetYears ?? 0);

  const computeDate = (): Date => {
    const d = new Date();
    if (offsetDays) d.setDate(d.getDate() + offsetDays);
    if (offsetMonths) d.setMonth(d.getMonth() + offsetMonths);
    if (offsetYears) d.setFullYear(d.getFullYear() + offsetYears);
    return d;
  };

  const handleSave = () => {
    onApply({
      type: 'clock',
      name: `Date/Time (${formatMask})`,
      dateFormat: formatMask,
      dateOffsetDays: offsetDays,
      dateOffsetMonths: offsetMonths,
      dateOffsetYears: offsetYears,
      dateType,
      enabled: true,
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Date & Time Engine Wizard (BarTender Standard)" maxWidth="max-w-lg">
      <div className="space-y-4 text-xs text-slate-700">
        {/* Source Purpose */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <label className="text-[10px] text-slate-500 font-bold block mb-1">Date Source Purpose</label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'current', label: 'Current Print Date' },
              { id: 'expiry', label: 'Expiry Date' },
              { id: 'mfg', label: 'Manufacturing Date' },
              { id: 'custom', label: 'Custom Calculation' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setDateType(opt.id as any);
                  if (opt.id === 'expiry' && offsetDays === 0 && offsetMonths === 0 && offsetYears === 0) {
                    setOffsetYears(2); // default 2-year shelf life for pharma/food
                  }
                }}
                className={`p-2 rounded text-center border font-semibold text-[11px] transition-colors ${
                  dateType === opt.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Offsets */}
        <div className="p-3 bg-white border border-slate-200 rounded-lg">
          <label className="text-[11px] font-bold text-slate-800 block mb-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            Dynamic Date & Time Offsets
          </label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-slate-500 font-medium block mb-1">Offset Days (+/-)</label>
              <input
                type="number"
                value={offsetDays}
                onChange={(e) => setOffsetDays(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-500 font-medium block mb-1">Offset Months (+/-)</label>
              <input
                type="number"
                value={offsetMonths}
                onChange={(e) => setOffsetMonths(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-500 font-medium block mb-1">Offset Years (+/-)</label>
              <input
                type="number"
                value={offsetYears}
                onChange={(e) => setOffsetYears(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Format Selection */}
        <div className="p-3 bg-white border border-slate-200 rounded-lg">
          <label className="text-[11px] font-bold text-slate-800 block mb-1.5">Format Template String</label>
          <select
            value={formatMask}
            onChange={(e) => setFormatMask(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none mb-2"
          >
            {COMMON_DATE_FORMATS.map((fmt) => (
              <option key={fmt.mask} value={fmt.mask}>
                {fmt.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={formatMask}
            onChange={(e) => setFormatMask(e.target.value)}
            placeholder="Custom Format e.g. YYYY-MM-DD"
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-mono focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>

        {/* Live Output Preview */}
        <div className="p-3 bg-slate-900 text-slate-100 rounded-lg flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">Calculated Result Preview</span>
            <span className="font-mono font-bold text-base text-emerald-400">{formatCustomDate(computeDate(), formatMask)}</span>
          </div>
          <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-1 rounded">BarTender Engine</span>
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
            Apply Date Configuration
          </button>
        </div>
      </div>
    </Modal>
  );
};
