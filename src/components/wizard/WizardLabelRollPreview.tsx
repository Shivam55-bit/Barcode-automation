import React, { useState } from 'react';
import { LabelShapeType, PageOrientation, PrintCorner, PrintDirection } from '../../printer/types';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface WizardLabelRollPreviewProps {
  pageWidthMm: number;
  pageHeightMm: number;
  labelWidthMm: number;
  labelHeightMm: number;
  rows: number;
  columns: number;
  labelShape: LabelShapeType;
  cornerRadiusMm: number;
  selectedMediaType: 'gap' | 'continuous' | 'black_mark';
  orientation: PageOrientation;
  marginTop?: number;
  marginLeft?: number;
  marginRight?: number;
  marginBottom?: number;
  horizontalGapMm?: number;
  verticalGapMm?: number;
  startingPoint?: 'blank' | 'template';
  selectedTemplateId?: string;
  printCorner?: PrintCorner;
  printDirection?: PrintDirection;
  useBgColor?: boolean;
  bgColor?: string;
  className?: string;
  unit?: 'mm' | 'inch';
}

export const WizardLabelRollPreview: React.FC<WizardLabelRollPreviewProps> = ({
  pageWidthMm,
  pageHeightMm,
  labelWidthMm,
  labelHeightMm,
  rows,
  columns,
  labelShape,
  cornerRadiusMm,
  selectedMediaType,
  orientation,
  marginTop = 0,
  marginLeft = 0,
  marginRight = 0,
  marginBottom = 0,
  horizontalGapMm = 0,
  verticalGapMm = 2,
  startingPoint = 'blank',
  selectedTemplateId,
  printCorner = 'top-left',
  printDirection = 'horizontal',
  useBgColor = false,
  bgColor = '#ffffff',
  className = '',
  unit = 'mm',
}) => {
  const [zoomFactor, setZoomFactor] = useState<number>(1.0);

  // Safe normalized values (handle NaN, negative, 0, or extreme numbers)
  const safeLabelW = Math.max(1, isFinite(labelWidthMm) && labelWidthMm > 0 ? labelWidthMm : 50);
  const safeLabelH = Math.max(1, isFinite(labelHeightMm) && labelHeightMm > 0 ? labelHeightMm : 25);
  const safeRows = Math.max(1, Math.min(50, Math.floor(rows) || 1));
  const safeCols = Math.max(1, Math.min(50, Math.floor(columns) || 1));
  const totalItems = safeRows * safeCols;

  const safeML = Math.max(0, isFinite(marginLeft) ? marginLeft : 0);
  const safeMR = Math.max(0, isFinite(marginRight) ? marginRight : 0);
  const safeMT = Math.max(0, isFinite(marginTop) ? marginTop : 0);
  const safeMB = Math.max(0, isFinite(marginBottom) ? marginBottom : 0);
  const safeHGap = Math.max(0, isFinite(horizontalGapMm) ? horizontalGapMm : 0);
  const safeVGap = Math.max(0, isFinite(verticalGapMm) ? verticalGapMm : 0);

  // Compute calculated matrix bounds in mm
  const matrixW = safeCols * safeLabelW + (safeCols - 1) * safeHGap + safeML + safeMR;
  const matrixH = safeRows * safeLabelH + (safeRows - 1) * safeVGap + safeMT + safeMB;

  const effPageW = totalItems > 1 ? Math.max(pageWidthMm > 0 ? pageWidthMm : 0, matrixW) : safeLabelW;
  const effPageH = totalItems > 1 ? Math.max(pageHeightMm > 0 ? pageHeightMm : 0, matrixH) : safeLabelH;

  // Orientation logic
  const isLandscape = orientation === 'landscape' || orientation === 'landscape-180';
  const is180 = orientation === 'portrait-180' || orientation === 'landscape-180';

  // Visual dimensions in mm based on orientation
  const visualSheetW = isLandscape ? effPageH : effPageW;
  const visualSheetH = isLandscape ? effPageW : effPageH;

  const visualLabelW = isLandscape ? safeLabelH : safeLabelW;
  const visualLabelH = isLandscape ? safeLabelW : safeLabelH;

  // Formatted dimension strings
  const pageWIn = (effPageW / 25.4).toFixed(2);
  const pageHIn = (effPageH / 25.4).toFixed(2);
  const labelWIn = (safeLabelW / 25.4).toFixed(2);
  const labelHIn = (safeLabelH / 25.4).toFixed(2);

  // Available container bounds in pixels for scale-to-fit
  const viewportW = 168;
  const viewportH = 188;

  // Scale-to-fit calculation
  const baseScale = Math.min(viewportW / visualSheetW, viewportH / visualSheetH);
  const scale = baseScale * zoomFactor;

  const renderSheetW = Math.max(24, Math.round(visualSheetW * scale));
  const renderSheetH = Math.max(24, Math.round(visualSheetH * scale));

  // Individual label dimensions in rendered pixels
  const renderLabelW = Math.max(16, Math.round(visualLabelW * scale));
  const renderLabelH = Math.max(14, Math.round(visualLabelH * scale));

  // Border radius style based on shape
  const getShapeRadius = () => {
    if (labelShape === 'circle') return '9999px';
    if (labelShape === 'ellipse') return '50%';
    if (labelShape === 'rounded') {
      const pxRadius = Math.max(2, Math.min(16, Math.round(cornerRadiusMm * scale)));
      return `${pxRadius}px`;
    }
    return '1px';
  };

  // Helper to compute print order index sequence for multi-up grid
  const getPrintOrderIndex = (r: number, c: number) => {
    if (totalItems <= 1) return null;
    let targetR = r;
    let targetC = c;
    if (printCorner.includes('bottom')) {
      targetR = safeRows - 1 - r;
    }
    if (printCorner.includes('right')) {
      targetC = safeCols - 1 - c;
    }
    if (printDirection === 'horizontal') {
      return targetR * safeCols + targetC + 1;
    } else {
      return targetC * safeRows + targetR + 1;
    }
  };

  return (
    <div className={`flex flex-col items-center select-none shrink-0 ${className}`}>
      {/* Header with Title & Zoom Controls */}
      <div className="w-full flex items-center justify-between mb-1 px-0.5">
        <span className="font-semibold text-[11px] text-[#1e293b]">
          Live Preview:
        </span>
        <div className="flex items-center gap-1 bg-[#e2e8f0] rounded-[2px] p-0.5 border border-[#cbd5e1]">
          <button
            type="button"
            title="Zoom In"
            onClick={() => setZoomFactor((z) => Math.min(2.5, +(z + 0.25).toFixed(2)))}
            className="p-0.5 rounded hover:bg-white text-slate-700 hover:text-slate-900 transition-colors"
          >
            <ZoomIn className="w-3 h-3" />
          </button>
          <span className="text-[9px] font-mono text-slate-600 px-0.5 min-w-[28px] text-center font-medium">
            {Math.round(zoomFactor * 100)}%
          </span>
          <button
            type="button"
            title="Zoom Out"
            onClick={() => setZoomFactor((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
            className="p-0.5 rounded hover:bg-white text-slate-700 hover:text-slate-900 transition-colors"
          >
            <ZoomOut className="w-3 h-3" />
          </button>
          <button
            type="button"
            title="Fit to Preview"
            onClick={() => setZoomFactor(1.0)}
            className="p-0.5 rounded hover:bg-white text-slate-700 hover:text-slate-900 transition-colors"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Main BarTender Gradient Outer Frame */}
      <div
        className="w-[195px] sm:w-[210px] h-[215px] sm:h-[225px] border border-[#7a98b8] rounded-[2px] p-2 flex items-center justify-center relative overflow-hidden shadow-inner bg-[#b8d4ee]"
        style={{
          background: 'linear-gradient(to bottom, #dbe8f5 0%, #b8d4ee 45%, #92bce2 100%)',
        }}
      >
        {/* Dynamic Aspect Ratio Paper Liner / Carrier */}
        <div
          className="relative flex items-center justify-center transition-all duration-150"
          style={{
            width: `${renderSheetW}px`,
            height: `${renderSheetH}px`,
            maxWidth: '100%',
            maxHeight: '100%',
          }}
        >
          {/* Top Scalloped Perforation Edge for Continuous/Roll */}
          {selectedMediaType !== 'continuous' && (
            <div className="absolute -top-1.5 left-0 right-0 h-3 flex justify-between overflow-hidden z-20 pointer-events-none px-0.5">
              {Array.from({ length: Math.max(3, Math.min(8, Math.floor(renderSheetW / 18))) }).map((_, i) => (
                <div
                  key={i}
                  className="w-4 h-2.5 rounded-b-full border-b border-[#7a98b8]"
                  style={{
                    background: 'linear-gradient(to bottom, #dbe8f5, #c8ddf0)',
                  }}
                />
              ))}
            </div>
          )}

          {/* Roll Carrier Paper / Liner Web */}
          <div
            className="w-full h-full border border-[#7a98b8] shadow-[0_4px_14px_rgba(0,0,0,0.25)] flex flex-col justify-center relative z-10 overflow-hidden"
            style={{
              background: 'linear-gradient(to right, #cfdbe6 0%, #f8fafc 10%, #ffffff 50%, #f8fafc 90%, #cfdbe6 100%)',
              padding: totalItems > 1 ? `${Math.max(2, Math.round(safeMT * scale))}px ${Math.max(2, Math.round(safeMR * scale))}px ${Math.max(2, Math.round(safeMB * scale))}px ${Math.max(2, Math.round(safeML * scale))}px` : '3px',
            }}
          >
            {/* Grid of Clean Die-cut Stickers */}
            <div
              className="w-full h-full grid items-stretch justify-items-stretch"
              style={{
                gridTemplateRows: `repeat(${safeRows}, minmax(0, 1fr))`,
                gridTemplateColumns: `repeat(${safeCols}, minmax(0, 1fr))`,
                gap: totalItems > 1 ? `${Math.max(1, Math.round(safeVGap * scale))}px ${Math.max(1, Math.round(safeHGap * scale))}px` : '0px',
              }}
            >
              {Array.from({ length: safeRows }).map((_, r) =>
                Array.from({ length: safeCols }).map((_, c) => {
                  const orderNum = getPrintOrderIndex(r, c);
                  const isWide = renderLabelW >= renderLabelH * 1.6;
                  const isTall = renderLabelH >= renderLabelW * 1.6;

                  return (
                    <div
                      key={`${r}-${c}`}
                      className="w-full h-full border border-[#475569] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.18)] flex flex-col justify-between p-1 relative overflow-hidden transition-all group"
                      style={{
                        backgroundColor: useBgColor ? bgColor : '#ffffff',
                        borderRadius: getShapeRadius(),
                        transform: is180 ? 'rotate(180deg)' : 'none',
                      }}
                    >
                      {/* Content Preview */}
                      {startingPoint === 'template' ? (
                        selectedTemplateId === 'shipping-4x6' ? (
                          <div className="w-full h-full flex flex-col justify-between text-[4.5px] text-slate-800 leading-tight select-none overflow-hidden">
                            <div className="font-bold border-b border-slate-300 pb-0.5 truncate text-[5.5px] text-slate-900">
                              SHIP TO: APEX LOGISTICS
                            </div>
                            <div className="text-[4px] text-slate-600 truncate">
                              400 FULFILLMENT PKWY, DOCK 12
                            </div>
                            {/* Scalable Barcode */}
                            <div className="flex h-3 gap-[1px] items-end my-0.5 overflow-hidden justify-center bg-slate-50 p-0.5 border border-slate-200">
                              {[2, 1, 3, 1, 2, 1, 3, 2, 1, 2, 1, 3, 2, 1, 2].map((w, i) => (
                                <div key={i} style={{ width: `${w * 1}px` }} className="bg-black h-full" />
                              ))}
                            </div>
                            <div className="font-mono text-[4.5px] text-slate-800 font-bold truncate text-center">
                              TRACK: 1Z999999999999
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-full flex flex-col justify-between text-[4.5px] text-slate-800 leading-tight select-none overflow-hidden">
                            <div className="font-bold truncate text-[5px] text-blue-900">
                              ACME PHARMA LTD
                            </div>
                            <div className="flex items-center justify-between gap-0.5 my-0.5">
                              <div className="flex h-2.5 gap-[1px] items-end flex-1 overflow-hidden">
                                {[1, 2, 1, 2, 1, 3, 1, 2, 2, 1, 2].map((w, i) => (
                                  <div key={i} style={{ width: `${w * 1}px` }} className="bg-black h-full" />
                                ))}
                              </div>
                              <div className="w-2.5 h-2.5 bg-black/90 p-[0.5px] grid grid-cols-2 grid-rows-2 gap-[0.5px] shrink-0">
                                <div className="bg-white" />
                                <div className="bg-black" />
                                <div className="bg-black" />
                                <div className="bg-white" />
                              </div>
                            </div>
                            <div className="font-bold text-[5px] text-slate-900 truncate">
                              MRP: ₹120.00
                            </div>
                          </div>
                        )
                      ) : (
                        /* Blank Template: Dynamic Representative Placeholder Vector */
                        <div className="w-full h-full flex flex-col justify-between text-[4.5px] text-slate-700 leading-none select-none overflow-hidden p-0.5">
                          {isWide ? (
                            /* Wide Horizontal Label Layout (e.g. 4.1 x 1 in) */
                            <div className="w-full h-full flex items-center justify-between gap-1">
                              <div className="flex flex-col justify-center gap-0.5 flex-1 min-w-0">
                                <div className="h-1 bg-slate-800 rounded-[0.5px] w-4/5" />
                                <div className="h-0.5 bg-slate-400 rounded-[0.5px] w-3/5" />
                                <div className="text-[4px] font-mono text-slate-500 font-semibold truncate pt-0.5">
                                  {totalItems > 1 ? `LABEL #${orderNum}` : 'BLANK TEMPLATE'}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <div className="flex h-3.5 gap-[1px] items-end overflow-hidden bg-slate-50 p-[1px] border border-slate-200">
                                  {[1, 2, 1, 3, 1, 2, 1, 2, 1, 3, 1].map((w, i) => (
                                    <div key={i} style={{ width: `${w}px` }} className="bg-black h-full" />
                                  ))}
                                </div>
                                <div className="w-3 h-3 bg-slate-900 p-[0.5px] grid grid-cols-2 grid-rows-2 gap-[0.5px] shrink-0">
                                  <div className="bg-white" />
                                  <div className="bg-black" />
                                  <div className="bg-black" />
                                  <div className="bg-white" />
                                </div>
                              </div>
                            </div>
                          ) : isTall ? (
                            /* Tall Vertical Label Layout (e.g. 1 x 4.1 in) */
                            <div className="w-full h-full flex flex-col justify-between items-center text-center gap-0.5">
                              <div className="w-full flex flex-col items-center gap-0.5">
                                <div className="h-1 bg-slate-800 rounded-[0.5px] w-3/4" />
                                <div className="h-0.5 bg-slate-400 rounded-[0.5px] w-1/2" />
                              </div>
                              <div className="w-3.5 h-3.5 bg-slate-900 p-[0.5px] grid grid-cols-2 grid-rows-2 gap-[0.5px]">
                                <div className="bg-white" />
                                <div className="bg-black" />
                                <div className="bg-black" />
                                <div className="bg-white" />
                              </div>
                              <div className="flex h-3 gap-[1px] items-end overflow-hidden w-full justify-center">
                                {[1, 2, 1, 3, 1, 2, 1, 2, 1].map((w, i) => (
                                  <div key={i} style={{ width: `${w}px` }} className="bg-black h-full" />
                                ))}
                              </div>
                              <div className="text-[4px] font-mono text-slate-600 font-bold truncate">
                                {totalItems > 1 ? `#${orderNum}` : 'BLANK'}
                              </div>
                            </div>
                          ) : (
                            /* Standard / Square Label Layout (e.g. 2 x 2 in, 50 x 25 mm) */
                            <div className="w-full h-full flex flex-col justify-between">
                              <div className="flex items-center justify-between">
                                <div className="h-1 bg-slate-800 rounded-[0.5px] w-2/3" />
                                {totalItems > 1 && (
                                  <span className="text-[5px] font-bold text-slate-500 font-mono">
                                    #{orderNum}
                                  </span>
                                )}
                              </div>
                              <div className="flex h-2.5 gap-[1px] items-end justify-center overflow-hidden my-0.5">
                                {[1, 2, 1, 3, 1, 2, 1, 2, 1, 3, 2, 1].map((w, i) => (
                                  <div key={i} style={{ width: `${w}px` }} className="bg-black h-full" />
                                ))}
                              </div>
                              <div className="flex items-center justify-between text-[4px] font-mono text-slate-600 font-semibold">
                                <span>890123456</span>
                                <span>MRP ₹</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Black Mark indicator if reflective tracking is selected */}
                      {selectedMediaType === 'black_mark' && (
                        <div className="absolute bottom-0 right-0 w-2.5 h-1 bg-black z-30" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Bottom Scalloped Perforation Edge */}
          {selectedMediaType !== 'continuous' && (
            <div className="absolute -bottom-1.5 left-0 right-0 h-3 flex justify-between overflow-hidden z-20 pointer-events-none px-0.5">
              {Array.from({ length: Math.max(3, Math.min(8, Math.floor(renderSheetW / 18))) }).map((_, i) => (
                <div
                  key={i}
                  className="w-4 h-2.5 rounded-t-full border-t border-[#7a98b8]"
                  style={{
                    background: 'linear-gradient(to top, #92bce2, #a8cceb)',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dimensions Underneath Preview (Exact BarTender Typography) */}
      <div className="mt-2 text-center text-[10px] text-[#000000] space-y-0.5 leading-tight font-normal">
        <div>
          <span className="font-semibold text-slate-700">Page Size:</span>{' '}
          {unit === 'inch' ? `${pageWIn} × ${pageHIn} in` : `${effPageW.toFixed(1)} × ${effPageH.toFixed(1)} mm`}
          <span className="text-slate-500 font-normal ml-1">
            ({unit === 'inch' ? `${effPageW.toFixed(1)} × ${effPageH.toFixed(1)} mm` : `${pageWIn} × ${pageHIn} in`})
          </span>
        </div>
        <div>
          <span className="font-semibold text-slate-700">Template Size:</span>{' '}
          {unit === 'inch' ? `${labelWIn} × ${labelHIn} in` : `${safeLabelW.toFixed(1)} × ${safeLabelH.toFixed(1)} mm`}
          <span className="text-slate-500 font-normal ml-1">
            ({unit === 'inch' ? `${safeLabelW.toFixed(1)} × ${safeLabelH.toFixed(1)} mm` : `${labelWIn} × ${labelHIn} in`})
          </span>
        </div>
      </div>
    </div>
  );
};
