import React, { useState, useEffect } from 'react';
import { ShapeElement, ShapeType } from '../../types';
import { X, Square, Circle, Minus, Sliders } from 'lucide-react';

interface ShapePropertiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  element: ShapeElement | null;
  onUpdateElement: (id: string, updates: Partial<ShapeElement>) => void;
}

export const ShapePropertiesModal: React.FC<ShapePropertiesModalProps> = ({
  isOpen,
  onClose,
  element,
  onUpdateElement,
}) => {
  const [shapeType, setShapeType] = useState<ShapeType>('rectangle');
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(1);
  const [strokeDash, setStrokeDash] = useState<string>('solid');
  const [fillColor, setFillColor] = useState<string>('transparent');
  const [cornerRadius, setCornerRadius] = useState<number>(0);
  const [posX, setPosX] = useState(10);
  const [posY, setPosY] = useState(10);
  const [widthMm, setWidthMm] = useState(30);
  const [heightMm, setHeightMm] = useState(20);
  const [rotation, setRotation] = useState<number>(0);

  useEffect(() => {
    if (element && isOpen) {
      setShapeType(element.shapeType || 'rectangle');
      setStrokeColor(element.strokeColor || element.stroke || '#000000');
      setStrokeWidth(element.strokeWidth || 1);
      setStrokeDash(element.strokeDash || 'solid');
      setFillColor(element.fillColor || element.fill || 'transparent');
      setCornerRadius(element.cornerRadius || 0);
      setPosX(element.x || 10);
      setPosY(element.y || 10);
      setWidthMm(element.width || 30);
      setHeightMm(element.height || 20);
      setRotation((element.rotation as any) || 0);
    }
  }, [element, isOpen]);

  if (!isOpen || !element) return null;

  const applyChange = (updates: Partial<ShapeElement>) => {
    onUpdateElement(element.id, updates);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-in fade-in duration-150 font-sans select-none">
      <div
        className="w-[560px] max-w-full bg-[#f0f4f9] rounded-lg shadow-2xl border border-[#718096] flex flex-col overflow-hidden text-slate-800 text-[12px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title Bar */}
        <div className="bg-gradient-to-r from-[#d9e2ec] via-[#bcccdc] to-[#9fb3c8] border-b border-[#829ab1] px-2.5 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xs shadow-xs flex items-center justify-center p-0.5">
              <Square className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-slate-900 text-[12.5px] tracking-tight">
              Shape Properties — [{element.name || 'Shape 1'}]
            </span>
          </div>

          <button
            onClick={onClose}
            title="Close"
            className="w-6 h-5 flex items-center justify-center hover:bg-slate-300 text-slate-700 rounded-xs cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Modal Main Body */}
        <div className="p-4 bg-white space-y-4 max-h-[460px] overflow-y-auto">
          {/* Shape Type */}
          <fieldset className="border border-[#cbd5e1] rounded-xs p-3 pt-2 space-y-2">
            <legend className="px-1 text-slate-700 font-medium">Shape Type</legend>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'rectangle', label: 'Rectangle' },
                { id: 'circle', label: 'Circle / Ellipse' },
                { id: 'line', label: 'Line' },
              ].map((s) => (
                <label key={s.id} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="shape-t"
                    checked={shapeType === s.id}
                    onChange={() => {
                      setShapeType(s.id as any);
                      applyChange({ shapeType: s.id as any });
                    }}
                  />
                  <span>{s.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Stroke / Outline */}
          <fieldset className="border border-[#cbd5e1] rounded-xs p-3 pt-2 space-y-3">
            <legend className="px-1 text-slate-700 font-medium">Line & Border Outline</legend>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <label className="w-16 text-slate-700">Color:</label>
                <input
                  type="color"
                  value={strokeColor}
                  onChange={(e) => {
                    setStrokeColor(e.target.value);
                    applyChange({ strokeColor: e.target.value });
                  }}
                  className="w-20 h-6 border border-[#94a3b8] rounded cursor-pointer p-0"
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="w-16 text-slate-700">Thickness:</label>
                <input
                  type="number"
                  step={0.5}
                  min={0.5}
                  value={strokeWidth}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 1;
                    setStrokeWidth(v);
                    applyChange({ strokeWidth: v });
                  }}
                  className="w-20 bg-white border border-[#94a3b8] rounded px-2 py-0.8 font-mono"
                />
                <span>px</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <label className="w-16 text-slate-700">Dash Style:</label>
              <select
                value={strokeDash}
                onChange={(e) => {
                  setStrokeDash(e.target.value);
                  applyChange({ strokeStyle: e.target.value as any });
                }}
                className="w-36 bg-white border border-[#94a3b8] rounded px-2 py-0.8"
              >
                <option value="solid">Solid Line</option>
                <option value="dashed">Dashed Line</option>
                <option value="dotted">Dotted Line</option>
              </select>
            </div>
          </fieldset>

          {/* Fill & Corners */}
          <fieldset className="border border-[#cbd5e1] rounded-xs p-3 pt-2 space-y-3">
            <legend className="px-1 text-slate-700 font-medium">Fill & Corner Radius</legend>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <label className="w-16 text-slate-700">Fill Color:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={fillColor === 'transparent' ? '#ffffff' : fillColor}
                    onChange={(e) => {
                      setFillColor(e.target.value);
                      applyChange({ fillColor: e.target.value });
                    }}
                    className="w-16 h-6 border border-[#94a3b8] rounded cursor-pointer p-0"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFillColor('transparent');
                      applyChange({ fillColor: 'transparent' });
                    }}
                    className="text-[11px] text-blue-700 hover:underline cursor-pointer"
                  >
                    No Fill
                  </button>
                </div>
              </div>

              {shapeType === 'rectangle' && (
                <div className="flex items-center gap-3">
                  <label className="w-20 text-slate-700">Corner Radius:</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={cornerRadius}
                    onChange={(e) => {
                      const r = parseInt(e.target.value) || 0;
                      setCornerRadius(r);
                      applyChange({ cornerRadius: r });
                    }}
                    className="w-20 bg-white border border-[#94a3b8] rounded px-2 py-0.8 font-mono"
                  />
                  <span>px</span>
                </div>
              )}
            </div>
          </fieldset>

          {/* Position */}
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="flex items-center gap-2">
              <label className="w-12 text-slate-700">X (mm):</label>
              <input
                type="number"
                step={0.1}
                value={posX}
                onChange={(e) => {
                  const v = parseFloat(e.target.value) || 0;
                  setPosX(v);
                  applyChange({ x: v });
                }}
                className="w-24 bg-white border border-[#94a3b8] rounded px-2 py-0.8 font-mono"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="w-12 text-slate-700">Y (mm):</label>
              <input
                type="number"
                step={0.1}
                value={posY}
                onChange={(e) => {
                  const v = parseFloat(e.target.value) || 0;
                  setPosY(v);
                  applyChange({ y: v });
                }}
                className="w-24 bg-white border border-[#94a3b8] rounded px-2 py-0.8 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="bg-[#e4ebf5] border-t border-[#cbd5e1] px-4 py-2 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-6 py-1 bg-[#f8fafc] hover:bg-[#e2e8f0] active:bg-[#cbd5e1] border border-[#94a3b8] rounded-xs text-slate-800 text-[12px] font-medium shadow-2xs cursor-pointer min-w-[80px]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
