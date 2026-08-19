import React, { useState, useEffect } from 'react';
import { LabelTemplate, LabelDimensions, LabelMargins, SheetGridConfig } from '../../types';
import { X, Minus, Square, Layers, LayoutGrid, FileText, Check, Sparkles, Printer } from 'lucide-react';

interface PageSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: LabelTemplate;
  onApplyPageSetup: (updates: {
    dimensions: LabelDimensions;
    margins: LabelMargins;
    sheetGrid?: SheetGridConfig;
    shape?: 'rectangle' | 'rounded' | 'oval';
    cornerRadius?: number;
  }) => void;
}

type PageSetupTab = 'page' | 'layout' | 'shape' | 'media' | 'stock';

const PREDEFINED_STOCKS = [
  { name: 'Zebra 4" x 6" Shipping (101.6 x 152.4 mm)', width: 101.6, height: 152.4, rows: 1, cols: 1, type: 'roll', shape: 'rounded' },
  { name: 'Zebra 4" x 3" Logistics (101.6 x 76.2 mm)', width: 101.6, height: 76.2, rows: 1, cols: 1, type: 'roll', shape: 'rounded' },
  { name: 'Zebra 4" x 2" Asset (101.6 x 50.8 mm)', width: 101.6, height: 50.8, rows: 1, cols: 1, type: 'roll', shape: 'rounded' },
  { name: 'Zebra 2" x 1" Product (50.8 x 25.4 mm)', width: 50.8, height: 25.4, rows: 1, cols: 1, type: 'roll', shape: 'rounded' },
  { name: 'Avery 5160 Address (30 per sheet - 66.7 x 25.4 mm)', width: 66.7, height: 25.4, rows: 10, cols: 3, type: 'sheet', shape: 'rounded', gapH: 3.17, gapV: 0, marginTop: 12.7, marginLeft: 4.8 },
  { name: 'Avery 5163 Shipping (10 per sheet - 101.6 x 50.8 mm)', width: 101.6, height: 50.8, rows: 5, cols: 2, type: 'sheet', shape: 'rounded', gapH: 3.8, gapV: 0, marginTop: 12.7, marginLeft: 4.0 },
  { name: 'Avery 5164 Shipping (6 per sheet - 101.6 x 84.6 mm)', width: 101.6, height: 84.6, rows: 3, cols: 2, type: 'sheet', shape: 'rounded', gapH: 3.8, gapV: 0, marginTop: 12.7, marginLeft: 4.0 },
  { name: 'Avery L7160 EU Address (21 per sheet - 63.5 x 38.1 mm)', width: 63.5, height: 38.1, rows: 7, cols: 3, type: 'sheet', shape: 'rounded', gapH: 2.5, gapV: 0, marginTop: 15.1, marginLeft: 7.2 },
  { name: 'Uline 4" x 6" Direct Thermal Fanfold', width: 101.6, height: 152.4, rows: 1, cols: 1, type: 'fanfold', shape: 'rounded' },
  { name: 'Brady 2" x 1" Harsh Environment Polyester', width: 50.8, height: 25.4, rows: 1, cols: 1, type: 'roll', shape: 'rounded' },
];

export const PageSetupModal: React.FC<PageSetupModalProps> = ({
  isOpen,
  onClose,
  template,
  onApplyPageSetup,
}) => {
  const [activeTab, setActiveTab] = useState<PageSetupTab>('page');

  // Page Dimensions
  const [widthMm, setWidthMm] = useState<number>(101.6);
  const [heightMm, setHeightMm] = useState<number>(152.4);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [paperSize, setPaperSize] = useState<string>('Custom');

  // Margins
  const [marginTop, setMarginTop] = useState<number>(2.0);
  const [marginLeft, setMarginLeft] = useState<number>(2.0);
  const [marginRight, setMarginRight] = useState<number>(2.0);
  const [marginBottom, setMarginBottom] = useState<number>(2.0);

  // Layout / Grid (Multi-up per sheet)
  const [rows, setRows] = useState<number>(1);
  const [columns, setColumns] = useState<number>(1);
  const [gapHorizontal, setGapHorizontal] = useState<number>(0);
  const [gapVertical, setGapVertical] = useState<number>(0);

  // Shape
  const [labelShape, setLabelShape] = useState<'rectangle' | 'rounded' | 'oval'>('rounded');
  const [cornerRadiusMm, setCornerRadiusMm] = useState<number>(2.0);

  // Media
  const [mediaType, setMediaType] = useState<'roll' | 'sheet' | 'fanfold'>('roll');
  const [sensorType, setSensorType] = useState<'gap' | 'mark' | 'continuous'>('gap');

  // Sync state on open
  useEffect(() => {
    if (template && isOpen) {
      setWidthMm(template.dimensions.width || 101.6);
      setHeightMm(template.dimensions.height || 152.4);
      setOrientation(template.dimensions.orientation || 'portrait');
      setMarginTop(template.margins.top || 2.0);
      setMarginLeft(template.margins.left || 2.0);
      setMarginRight(template.margins.right || 2.0);
      setMarginBottom(template.margins.bottom || 2.0);

      if (template.sheetGrid) {
        setRows(template.sheetGrid.rows || 1);
        setColumns(template.sheetGrid.columns || 1);
        setGapHorizontal(template.sheetGrid.gapHorizontal || 0);
        setGapVertical(template.sheetGrid.gapVertical || 0);
      } else {
        setRows(1);
        setColumns(1);
        setGapHorizontal(0);
        setGapVertical(0);
      }
    }
  }, [template, isOpen]);

  if (!isOpen) return null;

  const handleApply = () => {
    onApplyPageSetup({
      dimensions: {
        width: widthMm,
        height: heightMm,
        unit: 'mm',
        dpi: template.dimensions.dpi || 300,
        orientation,
      },
      margins: {
        top: marginTop,
        left: marginLeft,
        right: marginRight,
        bottom: marginBottom,
        unit: 'mm',
      },
      sheetGrid: {
        enabled: rows > 1 || columns > 1,
        rows,
        columns,
        gapHorizontal,
        gapVertical,
        labelWidth: widthMm,
        labelHeight: heightMm,
      },
      shape: labelShape,
      cornerRadius: cornerRadiusMm,
    });
    onClose();
  };

  const handleSelectStock = (stock: typeof PREDEFINED_STOCKS[0]) => {
    setWidthMm(stock.width);
    setHeightMm(stock.height);
    setRows(stock.rows);
    setColumns(stock.cols);
    setGapHorizontal(stock.gapH || 0);
    setGapVertical(stock.gapV || 0);
    if (stock.marginTop !== undefined) setMarginTop(stock.marginTop);
    if (stock.marginLeft !== undefined) {
      setMarginLeft(stock.marginLeft);
      setMarginRight(stock.marginLeft);
    }
    setLabelShape(stock.shape as any);
    setMediaType(stock.type as any);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-in fade-in duration-150 font-sans select-none">
      <div
        className="w-[660px] max-w-full bg-[#f0f4f9] rounded-lg shadow-2xl border border-[#718096] flex flex-col overflow-hidden text-slate-800 text-[12px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title Bar */}
        <div className="bg-gradient-to-r from-[#d9e2ec] via-[#bcccdc] to-[#9fb3c8] border-b border-[#829ab1] px-2.5 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xs shadow-xs flex items-center justify-center p-0.5">
              <Layers className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-slate-900 text-[12.5px] tracking-tight">
              Page Setup — [{template.name || 'Document1'}]
            </span>
          </div>

          <div className="flex items-center">
            <button
              onClick={onClose}
              title="Close"
              className="w-6 h-5 flex items-center justify-center hover:bg-slate-300 text-slate-700 rounded-xs cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Modal Main Body with Horizontal Tabs */}
        <div className="p-4 bg-white min-h-[360px] max-h-[460px] overflow-y-auto space-y-4">
          {/* BarTender Tabs */}
          <div className="flex border-b border-[#94a3b8] text-[12px]">
            {[
              { id: 'page', label: 'Page' },
              { id: 'layout', label: 'Layout' },
              { id: 'shape', label: 'Shape' },
              { id: 'media', label: 'Media Handling' },
              { id: 'stock', label: 'Stock Library' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as PageSetupTab)}
                className={`px-4 py-1.5 font-medium -mb-px border-t-2 border-x transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-white border-t-[#0078d7] border-x-[#94a3b8] border-b-transparent text-slate-900 font-bold'
                    : 'bg-[#f1f5f9] border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: PAGE */}
          {activeTab === 'page' && (
            <div className="space-y-4 pt-1 text-[12px]">
              <fieldset className="border border-[#cbd5e1] rounded-xs p-3 pt-2 space-y-3">
                <legend className="px-1 text-slate-700 font-medium">Page Size & Dimensions</legend>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <label className="w-16 text-slate-700">Width:</label>
                    <div className="flex-1 flex items-center gap-1">
                      <input
                        type="number"
                        step={0.1}
                        value={widthMm}
                        onChange={(e) => setWidthMm(parseFloat(e.target.value) || 10)}
                        className="w-24 bg-white border border-[#94a3b8] rounded-xs px-2 py-1 text-right font-mono"
                      />
                      <span className="text-slate-600">mm</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="w-16 text-slate-700">Height:</label>
                    <div className="flex-1 flex items-center gap-1">
                      <input
                        type="number"
                        step={0.1}
                        value={heightMm}
                        onChange={(e) => setHeightMm(parseFloat(e.target.value) || 10)}
                        className="w-24 bg-white border border-[#94a3b8] rounded-xs px-2 py-1 text-right font-mono"
                      />
                      <span className="text-slate-600">mm</span>
                    </div>
                  </div>
                </div>
              </fieldset>

              <fieldset className="border border-[#cbd5e1] rounded-xs p-3 pt-2 space-y-2">
                <legend className="px-1 text-slate-700 font-medium">Orientation</legend>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="page-orient"
                      checked={orientation === 'portrait'}
                      onChange={() => setOrientation('portrait')}
                    />
                    <span>Portrait (Height &gt; Width)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="page-orient"
                      checked={orientation === 'landscape'}
                      onChange={() => setOrientation('landscape')}
                    />
                    <span>Landscape (Width &gt; Height)</span>
                  </label>
                </div>
              </fieldset>

              <fieldset className="border border-[#cbd5e1] rounded-xs p-3 pt-2 space-y-2">
                <legend className="px-1 text-slate-700 font-medium">Margins</legend>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-600 block">Top (mm):</label>
                    <input
                      type="number"
                      step={0.1}
                      value={marginTop}
                      onChange={(e) => setMarginTop(parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-[#94a3b8] rounded-xs px-1.5 py-0.8 font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block">Left (mm):</label>
                    <input
                      type="number"
                      step={0.1}
                      value={marginLeft}
                      onChange={(e) => setMarginLeft(parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-[#94a3b8] rounded-xs px-1.5 py-0.8 font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block">Right (mm):</label>
                    <input
                      type="number"
                      step={0.1}
                      value={marginRight}
                      onChange={(e) => setMarginRight(parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-[#94a3b8] rounded-xs px-1.5 py-0.8 font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block">Bottom (mm):</label>
                    <input
                      type="number"
                      step={0.1}
                      value={marginBottom}
                      onChange={(e) => setMarginBottom(parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-[#94a3b8] rounded-xs px-1.5 py-0.8 font-mono text-center"
                    />
                  </div>
                </div>
              </fieldset>
            </div>
          )}

          {/* TAB 2: LAYOUT (MULTI-UP LABELS) */}
          {activeTab === 'layout' && (
            <div className="space-y-4 pt-1 text-[12px]">
              <fieldset className="border border-[#cbd5e1] rounded-xs p-3 pt-2 space-y-3">
                <legend className="px-1 text-slate-700 font-medium">Multiple Labels Per Sheet</legend>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <label className="w-20 text-slate-700">Rows (Down):</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={rows}
                      onChange={(e) => setRows(parseInt(e.target.value) || 1)}
                      className="w-24 bg-white border border-[#94a3b8] rounded-xs px-2 py-1 font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="w-24 text-slate-700">Columns (Across):</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={columns}
                      onChange={(e) => setColumns(parseInt(e.target.value) || 1)}
                      className="w-24 bg-white border border-[#94a3b8] rounded-xs px-2 py-1 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="flex items-center gap-3">
                    <label className="w-20 text-slate-700">Horiz. Gap:</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step={0.1}
                        value={gapHorizontal}
                        onChange={(e) => setGapHorizontal(parseFloat(e.target.value) || 0)}
                        className="w-20 bg-white border border-[#94a3b8] rounded-xs px-2 py-1 font-mono"
                      />
                      <span className="text-slate-600">mm</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="w-24 text-slate-700">Vert. Gap:</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step={0.1}
                        value={gapVertical}
                        onChange={(e) => setGapVertical(parseFloat(e.target.value) || 0)}
                        className="w-20 bg-white border border-[#94a3b8] rounded-xs px-2 py-1 font-mono"
                      />
                      <span className="text-slate-600">mm</span>
                    </div>
                  </div>
                </div>

                <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900">
                  Total labels per print sheet: <strong>{rows * columns}</strong>
                </div>
              </fieldset>
            </div>
          )}

          {/* TAB 3: SHAPE */}
          {activeTab === 'shape' && (
            <div className="space-y-4 pt-1 text-[12px]">
              <fieldset className="border border-[#cbd5e1] rounded-xs p-3 pt-2 space-y-3">
                <legend className="px-1 text-slate-700 font-medium">Label Die-Cut Shape</legend>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="label-shape"
                      checked={labelShape === 'rounded'}
                      onChange={() => setLabelShape('rounded')}
                    />
                    <span>Rounded Rectangle (Standard Die-Cut Roll)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="label-shape"
                      checked={labelShape === 'rectangle'}
                      onChange={() => setLabelShape('rectangle')}
                    />
                    <span>Rectangle (Sharp Corners / Continuous)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="label-shape"
                      checked={labelShape === 'oval'}
                      onChange={() => setLabelShape('oval')}
                    />
                    <span>Oval / Circle</span>
                  </label>
                </div>

                {labelShape === 'rounded' && (
                  <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
                    <label className="w-28 text-slate-700">Corner Radius:</label>
                    <input
                      type="number"
                      step={0.5}
                      value={cornerRadiusMm}
                      onChange={(e) => setCornerRadiusMm(parseFloat(e.target.value) || 2)}
                      className="w-20 bg-white border border-[#94a3b8] rounded-xs px-2 py-1 font-mono"
                    />
                    <span className="text-slate-600">mm</span>
                  </div>
                )}
              </fieldset>
            </div>
          )}

          {/* TAB 4: MEDIA HANDLING */}
          {activeTab === 'media' && (
            <div className="space-y-4 pt-1 text-[12px]">
              <fieldset className="border border-[#cbd5e1] rounded-xs p-3 pt-2 space-y-3">
                <legend className="px-1 text-slate-700 font-medium">Media Sensor & Feed Handling</legend>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <label className="w-28 text-slate-700">Media Type:</label>
                    <select
                      value={mediaType}
                      onChange={(e) => setMediaType(e.target.value as any)}
                      className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2 py-1"
                    >
                      <option value="roll">Thermal Roll with Gaps</option>
                      <option value="sheet">Laser / Inkjet Cut Sheet</option>
                      <option value="fanfold">Fanfold with Notch / Black Mark</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="w-28 text-slate-700">Sensor Type:</label>
                    <select
                      value={sensorType}
                      onChange={(e) => setSensorType(e.target.value as any)}
                      className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2 py-1"
                    >
                      <option value="gap">Transmissive (Web / Gap)</option>
                      <option value="mark">Reflective (Black Mark)</option>
                      <option value="continuous">Continuous (No Sensor)</option>
                    </select>
                  </div>
                </div>
              </fieldset>
            </div>
          )}

          {/* TAB 5: STOCK LIBRARY */}
          {activeTab === 'stock' && (
            <div className="space-y-3 pt-1 text-[12px]">
              <div className="text-slate-700 font-medium">Select Predefined Manufacturer Stock:</div>
              <div className="border border-slate-300 rounded-xs overflow-hidden divide-y divide-slate-200 max-h-[220px] overflow-y-auto">
                {PREDEFINED_STOCKS.map((stock, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectStock(stock)}
                    className="p-2.5 hover:bg-blue-50 cursor-pointer flex items-center justify-between transition-colors"
                  >
                    <div>
                      <div className="font-bold text-slate-900 text-xs">{stock.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {stock.width} x {stock.height} mm • {stock.rows}x{stock.cols} layout
                      </div>
                    </div>
                    <button
                      type="button"
                      className="px-2.5 py-1 bg-white border border-[#94a3b8] hover:bg-blue-600 hover:text-white rounded text-xs font-medium cursor-pointer shadow-2xs"
                    >
                      Apply Stock
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions Bar */}
        <div className="bg-[#e4ebf5] border-t border-[#cbd5e1] px-4 py-2 flex items-center justify-end gap-2">
          <button
            onClick={handleApply}
            className="px-5 py-1 bg-[#0078d7] hover:bg-[#005a9e] text-white border border-[#005a9e] rounded-xs text-[12px] font-bold shadow-2xs cursor-pointer min-w-[70px]"
          >
            OK
          </button>
          <button
            onClick={onClose}
            className="px-5 py-1 bg-[#f8fafc] hover:bg-[#e2e8f0] active:bg-[#cbd5e1] border border-[#94a3b8] rounded-xs text-slate-800 text-[12px] font-medium shadow-2xs cursor-pointer min-w-[70px]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
