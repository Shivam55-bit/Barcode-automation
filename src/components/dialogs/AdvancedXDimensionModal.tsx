import React, { useState, useEffect } from 'react';
import { X, HelpCircle, AlertTriangle } from 'lucide-react';
import { BarcodeElement, BarcodeSymbology } from '../../types';
import {
  calculateActualXDimension,
  calculateAutoSizeXDimension,
  milsToMm,
  mmToMils,
} from '../../services/xDimensionEngine';
import { getBarcodeCapability } from '../../services/barcodeCapabilityRegistry';

interface AdvancedXDimensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  element: BarcodeElement;
  onApply: (updates: Partial<BarcodeElement>) => void;
  printerDpi?: number;
}

export const AdvancedXDimensionModal: React.FC<AdvancedXDimensionModalProps> = ({
  isOpen,
  onClose,
  element,
  onApply,
  printerDpi = 203,
}) => {
  const capability = getBarcodeCapability(element.symbology || 'code128');

  // Local state
  const [units, setUnits] = useState<'mm' | 'mils' | 'auto'>(element.xDimensionUnits || 'mm');
  const [lockX, setLockX] = useState<boolean>(!!element.lockXDimension);
  const [targetXMm, setTargetXMm] = useState<number>(element.xDimensionMm || 0.38);
  const [targetInputValue, setTargetInputValue] = useState<string>('0.38');

  // Auto Size
  const [autoSize, setAutoSize] = useState<boolean>(!!element.autoSizeToWidth);
  const [requestedWidthMm, setRequestedWidthMm] = useState<number>(element.requestedWidthMm || element.width || 50);
  const [minXMm, setMinXMm] = useState<number>(element.minXDimensionMm || capability.minXDimensionMm || 0.15);
  const [maxXMm, setMaxXMm] = useState<number>(element.maxXDimensionMm || capability.maxXDimensionMm || 1.5);

  // Bar / Space Adjustment
  const initialMode = element.barSpaceAdjustment?.mode || 'none';
  const initialDots = element.barSpaceAdjustment?.dots || 1;
  const [adjMode, setAdjMode] = useState<'none' | 'reduce' | 'increase' | 'reduceBar' | 'increaseBar'>(initialMode);
  const [adjDots, setAdjDots] = useState<number>(initialDots);

  // Sync state when modal opens or element changes
  useEffect(() => {
    if (isOpen && element) {
      const u = element.xDimensionUnits || 'mm';
      setUnits(u);
      setLockX(!!element.lockXDimension);
      const xMm = element.xDimensionMm || 0.38;
      setTargetXMm(xMm);
      setTargetInputValue(u === 'mils' ? (xMm * 39.3701).toFixed(2) : xMm.toFixed(3));

      setAutoSize(!!element.autoSizeToWidth);
      setRequestedWidthMm(element.requestedWidthMm || element.width || 50);
      setMinXMm(element.minXDimensionMm || capability.minXDimensionMm || 0.15);
      setMaxXMm(element.maxXDimensionMm || capability.maxXDimensionMm || 1.5);

      setAdjMode(element.barSpaceAdjustment?.mode || 'none');
      setAdjDots(element.barSpaceAdjustment?.dots || 1);
    }
  }, [isOpen, element]);

  if (!isOpen) return null;

  // Compute actual X dimension at current DPI
  const effectiveTargetMm = targetXMm;
  const actualCalc = calculateActualXDimension(effectiveTargetMm, printerDpi);

  // If auto-size is enabled, compute auto module calculation
  const autoSizePreview = autoSize
    ? calculateAutoSizeXDimension({
        symbology: element.symbology || 'code128',
        data: element.value || '12345678',
        requestedWidthMm,
        minXMm,
        maxXMm,
        ratio: typeof element.ratio === 'number' ? element.ratio : parseFloat(String(element.ratio || 2.5)) || 2.5,
        printerDpi,
      })
    : null;

  const handleUnitChange = (newUnit: 'mm' | 'mils' | 'auto') => {
    setUnits(newUnit);
    if (newUnit === 'mils') {
      setTargetInputValue((targetXMm * 39.3701).toFixed(2));
    } else if (newUnit === 'mm' || newUnit === 'auto') {
      setTargetInputValue(targetXMm.toFixed(3));
    }
  };

  const handleTargetInputChange = (valStr: string) => {
    setTargetInputValue(valStr);
    const num = parseFloat(valStr);
    if (!isNaN(num) && num > 0) {
      if (units === 'mils') {
        setTargetXMm(num * 0.0254);
      } else {
        setTargetXMm(num);
      }
    }
  };

  const handleSave = () => {
    const updates: Partial<BarcodeElement> = {
      xDimensionUnits: units,
      lockXDimension: lockX,
      xDimensionMm: autoSize && autoSizePreview ? autoSizePreview.actualXMm : targetXMm,
      autoSizeToWidth: autoSize,
      requestedWidthMm,
      minXDimensionMm: minXMm,
      maxXDimensionMm: maxXMm,
      barSpaceAdjustment: {
        mode: adjMode,
        dots: adjDots,
      },
    };
    onApply(updates);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-100 font-sans select-none"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-[520px] max-w-full bg-[#f0f4f9] rounded-md shadow-2xl border border-[#718096] flex flex-col overflow-hidden text-slate-800 text-[11.5px]">
        {/* Title Bar */}
        <div className="bg-gradient-to-r from-[#d9e2ec] via-[#bcccdc] to-[#9fb3c8] border-b border-[#829ab1] px-3 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-900 text-[12px]">Barcode X Dimension</span>
          </div>
          <button
            onClick={onClose}
            className="w-5 h-5 flex items-center justify-center bg-[#e03131] hover:bg-[#c92a2a] text-white rounded-xs cursor-pointer shadow-xs"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-3 bg-[#f8fafc] overflow-y-auto max-h-[540px]">
          {/* Group 1: X Dimension */}
          <fieldset className="border border-[#cbd5e1] rounded-xs p-3 pt-2 bg-white space-y-2.5">
            <legend className="px-1 text-slate-700 font-semibold text-[11px]">X Dimension</legend>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <label className="text-slate-700 w-16">Units:</label>
                <select
                  value={units}
                  onChange={(e) => handleUnitChange(e.target.value as any)}
                  className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2 py-1 text-[11px]"
                >
                  <option value="mm">mm</option>
                  <option value="mils">mils (1/1000 in)</option>
                  <option value="auto">Auto (mm)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 text-[11px]">
                  <input
                    type="checkbox"
                    checked={lockX}
                    onChange={(e) => setLockX(e.target.checked)}
                    className="rounded-xs text-blue-600"
                  />
                  <span>Lock X Dimension</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="flex items-center gap-2">
                <label className="text-slate-700 w-16">Target X:</label>
                <div className="flex-1 flex items-center gap-1">
                  <input
                    type="number"
                    step={units === 'mils' ? 0.5 : 0.01}
                    min={0.01}
                    value={targetInputValue}
                    onChange={(e) => handleTargetInputChange(e.target.value)}
                    disabled={autoSize}
                    className="w-full bg-white border border-[#94a3b8] rounded-xs px-2 py-0.8 text-right font-mono text-[11.5px] disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  <span className="text-slate-600 text-[10.5px] shrink-0">
                    {units === 'mils' ? 'mils' : 'mm'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col justify-center">
                <div className="text-[10px] text-slate-500 font-medium">Actual X Dimension:</div>
                <div className="font-mono font-bold text-slate-800 text-[11.5px]">
                  {actualCalc.actualXmm.toFixed(4)} mm ({mmToMils(actualCalc.actualXmm).toFixed(1)} mils)
                </div>
              </div>
            </div>

            <div className="text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded-xs border border-slate-200">
              <div className="flex items-start gap-1">
                <span className="text-blue-600 font-bold">ℹ</span>
                <span>
                  At active printer resolution (<strong>{printerDpi} DPI</strong>), 1 printer dot ={' '}
                  <strong>{(25.4 / printerDpi).toFixed(4)} mm</strong>. Actual X Dimension is quantized to{' '}
                  <strong>{actualCalc.actualDots} dots</strong>.
                </span>
              </div>
            </div>
          </fieldset>

          {/* Group 2: Auto Size */}
          <fieldset className="border border-[#cbd5e1] rounded-xs p-3 pt-2 bg-white space-y-2">
            <legend className="px-1 text-slate-700 font-semibold text-[11px]">Auto Size</legend>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 text-[11px] font-medium">
              <input
                type="checkbox"
                checked={autoSize}
                onChange={(e) => setAutoSize(e.target.checked)}
                className="rounded-xs text-blue-600"
              />
              <span>Auto size to fit specified barcode width</span>
            </label>

            {autoSize && (
              <div className="space-y-2.5 pt-1 animate-in fade-in duration-100">
                <div className="flex items-start gap-1.5 p-1.5 bg-amber-50 border border-amber-200 rounded-xs text-amber-800 text-[10px] leading-tight">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Warning:</strong> Setting this option may cause the barcode to become unreadable by some barcode readers if the X dimension becomes too small.
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10.5px] text-slate-600 block mb-0.5">Barcode Width:</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step={1}
                        min={5}
                        value={requestedWidthMm}
                        onChange={(e) => setRequestedWidthMm(parseFloat(e.target.value) || 50)}
                        className="w-full bg-white border border-[#94a3b8] rounded-xs px-1.5 py-0.8 text-right font-mono text-[11px]"
                      />
                      <span className="text-[10px] text-slate-500">mm</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10.5px] text-slate-600 block mb-0.5">Minimum X:</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step={0.01}
                        min={0.05}
                        value={minXMm}
                        onChange={(e) => setMinXMm(parseFloat(e.target.value) || 0.15)}
                        className="w-full bg-white border border-[#94a3b8] rounded-xs px-1.5 py-0.8 text-right font-mono text-[11px]"
                      />
                      <span className="text-[10px] text-slate-500">mm</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10.5px] text-slate-600 block mb-0.5">Maximum X:</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step={0.05}
                        min={0.2}
                        value={maxXMm}
                        onChange={(e) => setMaxXMm(parseFloat(e.target.value) || 1.5)}
                        className="w-full bg-white border border-[#94a3b8] rounded-xs px-1.5 py-0.8 text-right font-mono text-[11px]"
                      />
                      <span className="text-[10px] text-slate-500">mm</span>
                    </div>
                  </div>
                </div>

                {autoSizePreview && (
                  <div className="text-[10.5px] text-slate-600 bg-slate-50 p-1.5 rounded-xs border border-slate-200 flex justify-between">
                    <span>Calculated Auto X: <strong>{autoSizePreview.actualXMm.toFixed(4)} mm</strong></span>
                    <span>Total Width: <strong>{autoSizePreview.totalWidthMm.toFixed(2)} mm</strong></span>
                  </div>
                )}
              </div>
            )}
          </fieldset>

          {/* Group 3: Manual Bar/Space Adjustment */}
          <fieldset className="border border-[#cbd5e1] rounded-xs p-3 pt-2 bg-white space-y-2">
            <legend className="px-1 text-slate-700 font-semibold text-[11px]">Manual Bar/Space Adjustment</legend>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer text-slate-700 text-[11px]">
                <input
                  type="radio"
                  name="bar-adj"
                  checked={adjMode === 'none'}
                  onChange={() => setAdjMode('none')}
                />
                <span>None</span>
              </label>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 text-[11px]">
                  <input
                    type="radio"
                    name="bar-adj"
                    checked={adjMode === 'reduce'}
                    onChange={() => setAdjMode('reduce')}
                  />
                  <span>Reduce bar size by:</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  step={1}
                  value={adjDots}
                  disabled={adjMode !== 'reduce'}
                  onChange={(e) => setAdjDots(parseInt(e.target.value, 10) || 1)}
                  className="w-14 bg-white border border-[#94a3b8] rounded-xs px-1.5 py-0.5 text-right font-mono text-[11px] disabled:bg-slate-100 disabled:text-slate-400"
                />
                <span className="text-[10.5px] text-slate-500">dot(s)</span>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 text-[11px]">
                  <input
                    type="radio"
                    name="bar-adj"
                    checked={adjMode === 'increase'}
                    onChange={() => setAdjMode('increase')}
                  />
                  <span>Increase bar size by:</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  step={1}
                  value={adjDots}
                  disabled={adjMode !== 'increase'}
                  onChange={(e) => setAdjDots(parseInt(e.target.value, 10) || 1)}
                  className="w-14 bg-white border border-[#94a3b8] rounded-xs px-1.5 py-0.5 text-right font-mono text-[11px] disabled:bg-slate-100 disabled:text-slate-400"
                />
                <span className="text-[10.5px] text-slate-500">dot(s)</span>
              </div>
            </div>

            <div className="text-[10px] text-slate-500 italic pt-1">
              Compensates for ink spread or thermal print bleed by adjusting bar thickness by exact dots without mutating nominal X geometry.
            </div>
          </fieldset>
        </div>

        {/* Footer Actions */}
        <div className="bg-[#e2e8f0] border-t border-[#cbd5e1] px-4 py-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => alert('BarTender X Dimension: Configures module width (X Dimension), DPI dot quantization, auto-sizing width limits, and thermal bar/space bleed compensation.')}
            className="px-3 py-1 bg-white hover:bg-slate-100 border border-[#94a3b8] rounded-xs text-slate-700 flex items-center gap-1 cursor-pointer font-medium"
          >
            <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
            <span>Help</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1 bg-[#0078d7] hover:bg-[#0063b1] text-white rounded-xs font-medium cursor-pointer shadow-xs"
            >
              OK
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1 bg-white hover:bg-slate-100 border border-[#94a3b8] rounded-xs text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
