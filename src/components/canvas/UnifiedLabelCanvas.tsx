import React, { useRef, useState, useEffect, useCallback } from 'react';
import { LabelTemplate, LabelElement, TextElement, CanvasAnnotation, ViewportState } from '../../types';
import { CanvasElement } from './CanvasElement';
import { renderBarcodeToCanvas, calculateBarcodeLayout, resolveBarcodeData } from '../../services/barcodeEngine';
import { evaluateElementData, resolveImageElementSrc, evaluateTextElementRuns, hasDataSourceFontOverrides } from '../../services/dataSourceEngine';
import { getTextElementMarkup } from '../../services/textMarkupEngine';
import {
  fitTextToBox,
  isMultiLineTextElement,
  isSingleLineTextElement,
  isTextFitToBoxEnabled,
  measureTextObject,
  scaleTextRunsForFit,
} from '../../services/textMeasurementEngine';
import { getMultiLineLayoutValue, getSingleLineLayoutValue } from '../../services/controlCharacterService';
import { Lock, MessageSquare, AlertCircle, Sparkles, CheckCircle2, Shield } from 'lucide-react';

export interface UnifiedLabelCanvasProps {
  template: LabelTemplate;
  recordData?: Record<string, string>;
  mode?: 'designer' | 'approval' | 'viewer' | 'preview';
  zoom?: number;
  panX?: number;
  panY?: number;
  showMargins?: boolean;
  showGrid?: boolean;
  selectedElementIds?: string[];
  onSelectElement?: (id: string, multi?: boolean) => void;
  onUpdateElement?: (id: string, updates: Partial<LabelElement>) => void;
  onElementDoubleClick?: (el: LabelElement) => void;
  annotations?: CanvasAnnotation[];
  isAnnotating?: boolean;
  onAddAnnotation?: (xMm: number, yMm: number) => void;
  onSelectAnnotation?: (annotation: CanvasAnnotation) => void;
  highlightElementIds?: string[];
  diffMap?: {
    added?: string[];
    removed?: string[];
    modified?: string[];
  };
  onCursorMove?: (xMm: number, yMm: number) => void;
  onContextMenu?: (e: React.MouseEvent, el: LabelElement) => void;
  onStartDrag?: (e: React.MouseEvent, el: LabelElement) => void;
  onStartResize?: (e: React.MouseEvent, handle: string, el: LabelElement) => void;
  onStartRotate?: (e: React.MouseEvent, el: LabelElement) => void;
}

export const UnifiedLabelCanvas: React.FC<UnifiedLabelCanvasProps> = ({
  template,
  recordData = {},
  mode = 'preview',
  zoom = 1.0,
  panX = 0,
  panY = 0,
  showMargins = true,
  showGrid = false,
  selectedElementIds = [],
  onSelectElement,
  onUpdateElement,
  onElementDoubleClick,
  annotations = [],
  isAnnotating = false,
  onAddAnnotation,
  onSelectAnnotation,
  highlightElementIds = [],
  diffMap,
  onCursorMove,
  onContextMenu,
  onStartDrag,
  onStartResize,
  onStartRotate,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);

  // Precise Base Scale: 1mm = 3.7795275591 px (96 DPI screen standard)
  const baseScale = 3.779528;
  const currentScale = baseScale * zoom;

  const widthPx = template.dimensions.width * currentScale;
  const heightPx = template.dimensions.height * currentScale;

  const margins = template.margins || { top: 2, right: 2, bottom: 2, left: 2 };
  const marginTopPx = (margins.top || 0) * currentScale;
  const marginRightPx = (margins.right || 0) * currentScale;
  const marginBottomPx = (margins.bottom || 0) * currentScale;
  const marginLeftPx = (margins.left || 0) * currentScale;

  const isInteractive = mode === 'designer';
  const isApproval = mode === 'approval';
  const isViewer = mode === 'viewer';

  // Handle click on canvas for annotation creation in approval mode
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isAnnotating && onAddAnnotation && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const xMm = Number((clickX / currentScale).toFixed(1));
      const yMm = Number((clickY / currentScale).toFixed(1));
      if (xMm >= 0 && xMm <= template.dimensions.width && yMm >= 0 && yMm <= template.dimensions.height) {
        onAddAnnotation(xMm, yMm);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (containerRef.current && onCursorMove) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const xMm = Number((mouseX / currentScale).toFixed(1));
      const yMm = Number((mouseY / currentScale).toFixed(1));
      onCursorMove(xMm, yMm);
    }
  };

  const sortedElements = [...template.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

  return (
    <div
      ref={containerRef}
      id={`unified-canvas-${template.id}`}
      className={`relative bg-white shadow-lg border border-slate-300 select-none transition-all duration-75 ${
        isAnnotating ? 'cursor-crosshair' : isViewer ? 'cursor-default' : ''
      }`}
      style={{
        width: `${widthPx}px`,
        height: `${heightPx}px`,
        transform: `translate(${panX}px, ${panY}px)`,
        transformOrigin: '0 0',
      }}
      onClick={handleCanvasClick}
      onMouseMove={handleMouseMove}
    >
      {/* 1. Grid Background */}
      {showGrid && (
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            backgroundImage: `
              linear-gradient(to right, #cbd5e1 1px, transparent 1px),
              linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)
            `,
            backgroundSize: `${5 * currentScale}px ${5 * currentScale}px`,
          }}
        />
      )}

      {/* 2. Margin & Printable Area Boundaries */}
      {showMargins && (
        <div
          className="absolute border border-dashed border-red-300 pointer-events-none z-10 opacity-70"
          style={{
            top: `${marginTopPx}px`,
            left: `${marginLeftPx}px`,
            right: `${marginRightPx}px`,
            bottom: `${marginBottomPx}px`,
          }}
        >
          <span className="absolute top-0.5 left-1 text-[8px] font-mono text-red-400 font-semibold tracking-wider">
            PRINT BOUNDARY
          </span>
        </div>
      )}

      {/* 3. Elements Render Loop */}
      {sortedElements.map((element) => {
        const isSelected = selectedElementIds.includes(element.id);
        const isHighlighted = highlightElementIds.includes(element.id);
        const isAdded = diffMap?.added?.includes(element.id);
        const isRemoved = diffMap?.removed?.includes(element.id);
        const isModified = diffMap?.modified?.includes(element.id);

        if (isInteractive) {
          return (
            <CanvasElement
              key={element.id}
              element={element}
              isSelected={isSelected}
              onSelect={(e, el) => {
                if (onSelectElement) onSelectElement(el.id, e.shiftKey || e.ctrlKey || e.metaKey);
              }}
              onDoubleClick={(el) => onElementDoubleClick && onElementDoubleClick(el)}
              scale={currentScale}
              recordData={recordData}
              onStartDrag={(e, el) => onStartDrag && onStartDrag(e, el)}
              onStartResize={(e, handle, el) => onStartResize && onStartResize(e, handle, el)}
              onStartRotate={(e, el) => onStartRotate && onStartRotate(e, el)}
              onContextMenu={(e, el) => onContextMenu && onContextMenu(e, el)}
            />
          );
        }

        // Read-only / Approval / Viewer Rendering Mode
        return (
          <ReadOnlyCanvasElement
            key={element.id}
            element={element}
            scale={currentScale}
            recordData={recordData}
            isSelected={isSelected}
            isHighlighted={isHighlighted}
            diffType={isAdded ? 'added' : isRemoved ? 'removed' : isModified ? 'modified' : null}
            mode={mode}
            onSelect={() => onSelectElement && onSelectElement(element.id)}
            onHover={(hover) => setHoveredElementId(hover ? element.id : null)}
          />
        );
      })}

      {/* 4. Interactive Annotation Pins Overlay (Approval Mode) */}
      {annotations.map((ann, idx) => (
        <div
          key={ann.id}
          className="absolute z-40 cursor-pointer group transform -translate-x-1/2 -translate-y-full transition-transform hover:scale-110"
          style={{
            left: `${ann.x * currentScale}px`,
            top: `${ann.y * currentScale}px`,
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (onSelectAnnotation) onSelectAnnotation(ann);
          }}
        >
          <div className="relative flex flex-col items-center">
            <div className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] w-6 h-6 rounded-full flex items-center justify-center shadow-md border-2 border-white ring-1 ring-amber-600">
              {idx + 1}
            </div>
            <div className="w-1.5 h-2 bg-amber-500 -mt-0.5 rounded-b-xs" />

            {/* Hover Tooltip Card */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-900 text-white text-[10px] p-2 rounded-lg shadow-xl whitespace-nowrap z-50 pointer-events-none max-w-xs">
              <div className="font-bold text-amber-300 mb-0.5">{ann.author} ({ann.authorRole})</div>
              <div className="text-slate-200">{ann.text}</div>
              <div className="text-[8px] text-slate-400 mt-1">{new Date(ann.createdAt).toLocaleTimeString()}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

interface ReadOnlyCanvasElementProps {
  element: LabelElement;
  scale: number;
  recordData: Record<string, string>;
  isSelected: boolean;
  isHighlighted: boolean;
  diffType?: 'added' | 'removed' | 'modified' | null;
  mode: 'approval' | 'viewer' | 'preview' | 'designer';
  onSelect: () => void;
  onHover: (hover: boolean) => void;
}

const ReadOnlyCanvasElement: React.FC<ReadOnlyCanvasElementProps> = ({
  element,
  scale,
  recordData,
  isSelected,
  isHighlighted,
  diffType,
  mode,
  onSelect,
  onHover,
}) => {
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);

  // Evaluate content with dynamic records
  const evaluatedContent = evaluateElementData(element, { record: recordData });

  const isTextEl = element.type === 'text';
  const textEl = isTextEl ? (element as TextElement) : null;
  const isParagraphLayout = !!textEl && (textEl.textFormatType === 'paragraph' || textEl.textType === 'paragraph');
  const isTextFitToBox = !!textEl && isTextFitToBoxEnabled(textEl);
  const paragraphAutoHeight = isParagraphLayout && !!textEl && !isTextFitToBox
    && (textEl.autoHeight ?? textEl.autoSize === true);
  const isTextAutoWidth = !!textEl && isSingleLineTextElement(textEl) && !isTextFitToBox
    && (textEl.sizingMode === 'auto-width' || (!textEl.sizingMode && textEl.autoSize !== false));
  const textFitRuns = isTextFitToBox && textEl
    ? evaluateTextElementRuns(textEl, { record: recordData })
    : undefined;
  const textFit = isTextFitToBox && textEl
    ? fitTextToBox(textEl, String(evaluatedContent ?? ''), textFitRuns)
    : null;
  const fittedRuns = textFit && textEl
    ? scaleTextRunsForFit(textEl, textFitRuns, textFit.fontSize, textFit.fontWidthScale)
    : undefined;

  let dynamicWidth = element.width;
  let dynamicHeight = element.height;

  if (isTextAutoWidth && textEl) {
    const dims = measureTextObject({
      text: typeof evaluatedContent === 'string' ? evaluatedContent : textEl.text,
      fontFamily: textEl.fontFamily,
      fontSize: textEl.fontSize,
      fontWeight: textEl.fontWeight,
      fontStyle: textEl.fontStyle,
      letterSpacing: textEl.letterSpacing,
      lineHeight: textEl.lineHeight,
      fontWidthScale: textEl.fontWidthScale,
      textType: textEl.textType,
      textFormatType: textEl.textFormatType,
      multiline: textEl.multiline,
      wrap: textEl.wrap || textEl.wordWrap,
      borderConfig: textEl.borderConfig,
    });
    dynamicWidth = dims.width;
    dynamicHeight = dims.height;
  }
  if (paragraphAutoHeight && textEl) {
    const runs = evaluateTextElementRuns(textEl, { record: recordData });
    dynamicHeight = measureTextObject({
      text: typeof evaluatedContent === 'string' ? evaluatedContent : textEl.text,
      runs,
      fontFamily: textEl.fontFamily,
      fontSize: textEl.fontSize,
      fontWeight: textEl.fontWeight,
      fontStyle: textEl.fontStyle,
      letterSpacing: textEl.letterSpacing,
      lineHeight: textEl.lineHeight,
      fontWidthScale: textEl.fontWidthScale,
      textType: 'paragraph',
      textFormatType: 'paragraph',
      multiline: true,
      wrap: textEl.wrap !== false && textEl.wordWrap !== false,
      containerWidthMm: textEl.width,
      borderConfig: textEl.borderConfig,
    }).height;
  }

  if (element.type === 'barcode') {
    const layout = calculateBarcodeLayout(element as any);
    dynamicHeight = layout.totalHeightMm;
  }

  const leftPx = element.x * scale;
  const topPx = element.y * scale;
  const widthPx = dynamicWidth * scale;
  const heightPx = dynamicHeight * scale;

  useEffect(() => {
    if (element.type === 'barcode' && barcodeCanvasRef.current) {
      renderBarcodeToCanvas(
        barcodeCanvasRef.current,
        element as any,
        scale,
        { record: recordData, symbolOnly: true }
      ).catch(() => {});
    }
  }, [element, recordData, scale]);

  if (!element.visible) return null;

  // Diff styles
  const diffClass =
    diffType === 'added'
      ? 'ring-2 ring-emerald-500 bg-emerald-50/20'
      : diffType === 'removed'
      ? 'ring-2 ring-red-500 bg-red-50/20 opacity-60'
      : diffType === 'modified'
      ? 'ring-2 ring-amber-500 bg-amber-50/20'
      : isHighlighted
      ? 'ring-2 ring-blue-500 bg-blue-50/30'
      : isSelected
      ? 'ring-1.5 ring-indigo-600'
      : '';

  const isLocked = element.locked || element.editable === false || (element as any).isEditable === false;

  return (
    <div
      id={`canvas-el-${element.id}`}
      className={`absolute select-none transition-shadow ${diffClass} ${
        mode === 'approval' ? 'hover:ring-1 hover:ring-blue-400 cursor-pointer' : ''
      }`}
      style={{
        left: `${leftPx}px`,
        top: `${topPx}px`,
        width: `${widthPx}px`,
        height: `${heightPx}px`,
        transform: `rotate(${element.rotation || 0}deg)`,
        transformOrigin: 'center center',
        opacity: element.opacity ?? 1,
        zIndex: element.zIndex || 1,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      {/* 1. Text Element */}
      {element.type === 'text' && (() => {
        const textElement = element as TextElement;
        const effectiveFontSize = (textFit?.fontSize ?? textElement.fontSize ?? 10) * (25.4 / 72) * scale;
        const renderAsParagraph = isParagraphLayout || (isMultiLineTextElement(textElement) && isTextFitToBox);

        if (renderAsParagraph) {
          const runs = fittedRuns ?? evaluateTextElementRuns(textElement, { record: recordData });
          const paragraphElement: TextElement = {
            ...textElement,
            ...(isTextFitToBox ? {
              textFormatType: 'paragraph',
              fontSize: textFit!.fontSize,
              fontWidthScale: textFit!.fontWidthScale,
            } : {}),
            height: dynamicHeight,
            autoHeight: paragraphAutoHeight,
          };
          const markup = getTextElementMarkup(
            paragraphElement,
            String(evaluatedContent ?? ''),
            runs,
          ) || '';
          return (
            <div
              className="w-full h-full overflow-visible"
              style={{
                fontFamily: textElement.fontFamily || 'Arial, sans-serif',
                fontSize: `${effectiveFontSize}px`,
                color: textElement.whiteOnBlack ? '#ffffff' : textElement.color || '#000000',
                backgroundColor: textElement.whiteOnBlack ? '#000000' : textElement.backgroundColor || 'transparent',
                lineHeight: textElement.lineHeight || 1.15,
              }}
              dangerouslySetInnerHTML={{ __html: markup }}
            />
          );
        }

        if (textElement.textType === 'html' || textElement.textType === 'word-processor' || textElement.textType === 'rtf' || textElement.richContentHtml) {
          return (
            <div
              className="w-full h-full overflow-hidden p-0.5 text-slate-900"
              style={{
                fontFamily: textElement.fontFamily || 'Arial, sans-serif',
                fontSize: `${effectiveFontSize}px`,
                color: textElement.color || '#000000',
                backgroundColor: textElement.backgroundColor || 'transparent',
                lineHeight: textElement.lineHeight || 1.25,
              }}
              dangerouslySetInnerHTML={{ __html: textElement.richContentHtml || evaluatedContent }}
            />
          );
        }

        const textDecor = [
          textEl.underline || textEl.textDecoration === 'underline' ? 'underline' : '',
          textEl.strikeout || textEl.textDecoration === 'line-through' ? 'line-through' : '',
        ].filter(Boolean).join(' ') || 'none';
        const fontWidthScale = (textFit?.fontWidthScale ?? textEl.fontWidthScale ?? 100) / 100;

        return (
          <div
            className="w-full h-full overflow-hidden flex"
            style={{
              fontFamily: textEl.fontFamily || 'Arial, sans-serif',
              fontSize: `${effectiveFontSize}px`,
              fontWeight: textEl.fontWeight || 'normal',
              fontStyle: textEl.fontStyle || 'normal',
              textDecoration: textDecor,
              color: textEl.whiteOnBlack ? '#ffffff' : textEl.color || '#000000',
              backgroundColor: textEl.whiteOnBlack ? '#000000' : textEl.backgroundColor || 'transparent',
              letterSpacing: `${textEl.letterSpacing || 0}px`,
              lineHeight: textEl.lineHeight || 1.15,
              justifyContent:
                textEl.textAlign === 'center'
                  ? 'center'
                  : textEl.textAlign === 'right'
                  ? 'flex-end'
                  : 'flex-start',
              alignItems:
                textEl.verticalAlign === 'middle'
                  ? 'center'
                  : textEl.verticalAlign === 'bottom'
                  ? 'flex-end'
                  : 'flex-start',
              whiteSpace: isMultiLineTextElement(textEl) ? 'pre-wrap' : 'nowrap',
              textAlign: (textEl.textAlign as any) || 'left',
            }}
          >
            <div
              style={{
                width: '100%',
                transform: fontWidthScale !== 1 ? `scaleX(${fontWidthScale})` : undefined,
                transformOrigin: textEl.textAlign === 'center' ? 'center' : textEl.textAlign === 'right' ? 'right' : 'left',
              }}
            >
              {hasDataSourceFontOverrides(textEl) ? (
                (fittedRuns ?? evaluateTextElementRuns(textEl, { record: recordData })).map((run, idx) => {
                const isSingle = !isMultiLineTextElement(textEl);
                const runText = isSingle
                  ? getSingleLineLayoutValue(run.value)
                  : getMultiLineLayoutValue(run.value);
                if (!runText) return null;
                const s = run.style;
                const runUnderline = s.underline;
                const runStrikeout = s.strikeout;
                const runDecor =
                  runUnderline && runStrikeout
                    ? 'underline line-through'
                    : runUnderline
                    ? 'underline'
                    : runStrikeout
                    ? 'line-through'
                    : 'none';
                const runFontSizePx = (s.fontSize || textEl.fontSize || 10) * (25.4 / 72) * scale;
                const runFontScale = (s.fontWidthScale || 100) / 100;
                const runColor = s.whiteOnBlack ? '#ffffff' : (s.color || textEl.color || '#000000');
                const runBg = s.whiteOnBlack
                  ? '#000000'
                  : s.backgroundColor && s.backgroundColor !== 'transparent'
                  ? s.backgroundColor
                  : undefined;

                return (
                  <span
                    key={run.sourceId || idx}
                    style={{
                      fontFamily: s.fontFamily || textEl.fontFamily || 'Arial, sans-serif',
                      fontSize: `${runFontSizePx}px`,
                      fontWeight: s.fontWeight || 'normal',
                      fontStyle: s.fontStyle || 'normal',
                      textDecoration: runDecor,
                      color: runColor,
                      backgroundColor: runBg,
                      letterSpacing: s.letterSpacing !== undefined ? `${s.letterSpacing}px` : undefined,
                      transform: runFontScale !== 1 ? `scaleX(${runFontScale})` : undefined,
                      display: runFontScale !== 1 ? 'inline-block' : undefined,
                      transformOrigin: 'left center',
                    }}
                  >
                    {runText}
                  </span>
                );
                })
              ) : isMultiLineTextElement(textEl) ? (
                getMultiLineLayoutValue(String(evaluatedContent ?? ''))
              ) : (
                getSingleLineLayoutValue(String(evaluatedContent ?? ''))
              )}
            </div>
          </div>
        );
      })()}

      {/* 2. Barcode Element */}
      {element.type === 'barcode' && (() => {
        const barcodeEl = element as any;
        const isEllipse = barcodeEl.borderType === 'ellipse';
        const hasBorder = barcodeEl.borderType && barcodeEl.borderType !== 'none';
        const layout = calculateBarcodeLayout(barcodeEl);
        const resolved = resolveBarcodeData(barcodeEl, { record: recordData });
        const isTop = resolved.placement === 'top';
        const symbolHeightPx = Math.max(6, Math.round(layout.symbolHeightMm * scale));
        const hrtGapPx = Math.max(1, Math.round(layout.hrtGapMm * scale));
        const fontSizePx = Math.max(7, Math.round(layout.fontSizePt * (25.4 / 72) * scale));

        const fontName = (barcodeEl.humanReadableFont || barcodeEl.humanReadable?.fontFamily || barcodeEl.fontFamily || 'Arial').trim();
        const styleRaw =
          barcodeEl.humanReadableFontStyle ||
          (barcodeEl.fontStyle === 'italic' && barcodeEl.fontWeight === 'bold'
            ? 'bold-italic'
            : barcodeEl.fontStyle === 'italic'
              ? 'italic'
              : barcodeEl.fontWeight === 'bold'
                ? 'bold'
                : 'regular');
        const isBold = styleRaw === 'bold' || styleRaw === 'bold-italic' || barcodeEl.fontWeight === 'bold';
        const isItalic = styleRaw === 'italic' || styleRaw === 'bold-italic' || barcodeEl.fontStyle === 'italic';
        const isUnderline = Boolean(barcodeEl.humanReadableUnderline || barcodeEl.underline);
        const textColor = barcodeEl.humanReadableColor || barcodeEl.color || '#000000';
        const textAlign = resolved.alignment === 'left' ? 'left' : resolved.alignment === 'right' ? 'right' : 'center';

        const hrtRegion = resolved.includeText && resolved.displayTextLines.length > 0 ? (
          <div
            className="barcode-hrt-region select-none shrink-0"
            style={{
              width: '100%',
              marginTop: isTop ? 0 : `${hrtGapPx}px`,
              marginBottom: isTop ? `${hrtGapPx}px` : 0,
              fontFamily: `"${fontName}", Arial, sans-serif`,
              fontSize: `${fontSizePx}px`,
              fontWeight: isBold ? 'bold' : 'normal',
              fontStyle: isItalic ? 'italic' : 'normal',
              textDecoration: isUnderline ? 'underline' : 'none',
              color: textColor,
              textAlign,
              lineHeight: 1.25,
              whiteSpace: 'nowrap',
              overflow: 'visible',
            }}
          >
            {resolved.displayTextLines.map((line: string, idx: number) => (
              <div key={idx}>{line}</div>
            ))}
          </div>
        ) : null;

        return (
          <div
            className={`w-full h-full flex flex-col justify-start overflow-visible ${
              isEllipse ? 'rounded-full' : ''
            }`}
            style={{
              backgroundColor:
                barcodeEl.borderFillColor && barcodeEl.borderFillColor !== 'None'
                  ? barcodeEl.borderFillColor
                  : 'transparent',
              borderWidth: hasBorder ? `${Math.max(1, (barcodeEl.borderThickness || 1) * scale * 0.75)}px` : '0px',
              borderColor: barcodeEl.borderColor || '#000000',
              borderStyle: barcodeEl.borderDashStyle || 'solid',
            }}
          >
            {isTop && hrtRegion}

            {/* SYMBOL REGION */}
            <div
              className="barcode-symbol-region flex items-center justify-center shrink-0"
              style={{
                width: '100%',
                height: `${symbolHeightPx}px`,
              }}
            >
              <canvas
                ref={barcodeCanvasRef}
                style={{
                  width: '100%',
                  height: `${symbolHeightPx}px`,
                  display: 'block',
                }}
              />
            </div>

            {!isTop && hrtRegion}
          </div>
        );
      })()}

      {/* 3. Shape Element */}
      {element.type === 'shape' && (() => {
        const shape = element as any;
        return (
          <div className="w-full h-full">
            {shape.shapeType === 'rectangle' && (
              <div
                className="w-full h-full"
                style={{
                  backgroundColor: shape.fillColor || 'transparent',
                  borderColor: shape.strokeColor || '#000000',
                  borderWidth: `${(shape.strokeWidth || 0.5) * scale}px`,
                  borderStyle: shape.strokeStyle || 'solid',
                  borderRadius: `${(shape.cornerRadius || 0) * scale}px`,
                }}
              />
            )}
            {(shape.shapeType === 'circle' || shape.shapeType === 'ellipse') && (
              <div
                className="w-full h-full rounded-full"
                style={{
                  backgroundColor: shape.fillColor || 'transparent',
                  borderColor: shape.strokeColor || '#000000',
                  borderWidth: `${(shape.strokeWidth || 0.5) * scale}px`,
                  borderStyle: shape.strokeStyle || 'solid',
                }}
              />
            )}
            {shape.shapeType === 'line' && (
              <div
                className="w-full h-0 border-t"
                style={{
                  borderColor: shape.strokeColor || '#000000',
                  borderTopWidth: `${(shape.strokeWidth || 0.5) * scale}px`,
                  borderStyle: shape.strokeStyle || 'solid',
                  marginTop: `${heightPx / 2}px`,
                }}
              />
            )}
            {(shape.shapeType === 'polygon' || shape.svgPath) && (
              <svg
                className="w-full h-full overflow-visible"
                viewBox={shape.viewBox || '0 0 100 100'}
                preserveAspectRatio="none"
              >
                <path
                  d={shape.svgPath}
                  fill={shape.fillColor || 'transparent'}
                  stroke={shape.strokeColor || '#000000'}
                  strokeWidth={Math.max(1, (shape.strokeWidth || 0.5) * 2)}
                  strokeDasharray={shape.strokeStyle === 'dashed' ? '6 4' : shape.strokeStyle === 'dotted' ? '2 2' : undefined}
                />
              </svg>
            )}
          </div>
        );
      })()}

      {/* 4. Image Element */}
      {element.type === 'image' && (
        <div className="w-full h-full overflow-hidden">
          <img
            src={resolveImageElementSrc(element, { record: recordData }) || (element as any).src}
            alt={element.name}
            className="w-full h-full pointer-events-none"
            onError={(e) => {
              const fb = (element as any).fallbackSrc;
              if (fb && e.currentTarget.src !== fb) e.currentTarget.src = fb;
            }}
            style={{
              objectFit: (element as any).objectFit || 'contain',
              filter: `${(element as any).grayscale ? 'grayscale(100%)' : ''} ${(element as any).invert ? 'invert(100%)' : ''}`,
            }}
          />
        </div>
      )}

      {/* Locked Badge (Approval or Designer Inspection) */}
      {isLocked && mode === 'approval' && (
        <div
          title="Field Locked (Fixed Layout)"
          className="absolute -top-2 -right-2 bg-slate-800 text-white p-0.5 rounded-full shadow-sm z-30 ring-1 ring-white"
        >
          <Lock className="w-2.5 h-2.5 text-amber-400" />
        </div>
      )}
    </div>
  );
};
