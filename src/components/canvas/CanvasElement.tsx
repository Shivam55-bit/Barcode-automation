import React, { useEffect, useRef, useState } from 'react';
import { LabelElement, BarcodeElement, TextElement, ShapeElement, ImageElement, TableElement } from '../../types';
import { renderBarcodeToCanvas } from '../../services/barcodeEngine';
import { evaluateElementData } from '../../services/dataSourceEngine';
import { Lock } from 'lucide-react';

interface CanvasElementProps {
  element: LabelElement;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent, el: LabelElement) => void;
  onDoubleClick?: (el: LabelElement) => void;
  scale: number; // px per mm
  recordData: Record<string, string>;
  onStartDrag: (e: React.MouseEvent, el: LabelElement) => void;
  onStartResize: (e: React.MouseEvent, handle: string, el: LabelElement) => void;
  onStartRotate: (e: React.MouseEvent, el: LabelElement) => void;
  onContextMenu: (e: React.MouseEvent, el: LabelElement) => void;
}

export const CanvasElement: React.FC<CanvasElementProps> = ({
  element,
  isSelected,
  onSelect,
  onDoubleClick,
  scale,
  recordData,
  onStartDrag,
  onStartResize,
  onStartRotate,
  onContextMenu,
}) => {
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);
  const [barcodeRenderError, setBarcodeRenderError] = useState(false);

  // Position & Dimensions in screen pixels
  const leftPx = element.x * scale;
  const topPx = element.y * scale;
  const widthPx = element.width * scale;
  const heightPx = element.height * scale;

  // Re-render barcode when value or element specs change
  useEffect(() => {
    if (element.type === 'barcode' && barcodeCanvasRef.current) {
      const barcodeEl = element as BarcodeElement;
      renderBarcodeToCanvas(
        barcodeCanvasRef.current,
        barcodeEl,
        2,
        { record: recordData }
      )
        .then(() => setBarcodeRenderError(false))
        .catch(() => setBarcodeRenderError(true));
    }
  }, [element, recordData, scale]);

  if (!element.visible) return null;

  const evaluatedContent = evaluateElementData(element, { record: recordData });

  return (
    <div
      id={`canvas-el-${element.id}`}
      className={`absolute select-none cursor-move transition-shadow duration-75 ${
        isSelected
          ? 'ring-1 ring-[#16a34a] shadow-xs'
          : 'hover:ring-1 hover:ring-[#93c5fd]'
      } ${element.locked ? 'cursor-not-allowed' : ''}`}
      style={{
        left: `${leftPx}px`,
        top: `${topPx}px`,
        width: `${widthPx}px`,
        height: `${heightPx}px`,
        transform: `rotate(${element.rotation || 0}deg)`,
        transformOrigin: 'center center',
        opacity: element.opacity,
        zIndex: element.zIndex,
      }}
      onMouseDown={(e) => {
        if (e.button === 0) {
          onSelect(e, element);
          if (!element.locked) {
            onStartDrag(e, element);
          }
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect(e, element);
        onContextMenu(e, element);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (onDoubleClick) onDoubleClick(element);
      }}
    >
      {/* Element Content Rendering */}
      {element.type === 'text' && (() => {
        const textEl = element as TextElement;

        // Arc Text rendering
        if (textEl.textType === 'arc') {
          const pathId = `arc-path-${textEl.id}`;
          return (
            <div className="w-full h-full overflow-hidden flex items-center justify-center">
              <svg className="w-full h-full" viewBox="0 0 200 100" preserveAspectRatio="xMidYMid meet">
                <path
                  id={pathId}
                  d="M 15,85 A 85,85 0 0,1 185,85"
                  fill="none"
                  stroke="transparent"
                />
                <text
                  fill={textEl.color || '#000000'}
                  fontSize={textEl.fontSize * 2.2}
                  fontFamily={textEl.fontFamily || 'Arial, sans-serif'}
                  fontWeight={textEl.fontWeight || 'bold'}
                  fontStyle={textEl.fontStyle || 'normal'}
                  letterSpacing={textEl.letterSpacing || 1}
                >
                  <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
                    {evaluatedContent}
                  </textPath>
                </text>
              </svg>
            </div>
          );
        }

        // HTML & Word Processor Rich Text Markup Container
        if (textEl.textType === 'html' || textEl.textType === 'word-processor' || textEl.textType === 'rtf' || textEl.textType === 'xaml') {
          let htmlToRender = textEl.richContentHtml || evaluatedContent;
          if (textEl.textType === 'rtf' && htmlToRender.startsWith('{\\rtf')) {
            htmlToRender = htmlToRender
              .replace(/\{\\rtf1[^\\]*/g, '')
              .replace(/\\b\s*(.*?)\\b0/g, '<b>$1</b>')
              .replace(/\\i\s*(.*?)\\i0/g, '<i>$1</i>')
              .replace(/\\par/g, '<br/>')
              .replace(/[\{\}]/g, '');
          }

          return (
            <div
              className="w-full h-full overflow-hidden p-0.5 text-slate-900"
              style={{
                fontFamily: textEl.fontFamily || 'Arial, sans-serif',
                fontSize: `${textEl.fontSize * (scale / 3.78) * 0.85}px`,
                color: textEl.color || '#000000',
                backgroundColor: textEl.backgroundColor || 'transparent',
                lineHeight: textEl.lineHeight || 1.25,
              }}
              dangerouslySetInnerHTML={{ __html: htmlToRender }}
            />
          );
        }

        // Standard Single-Line / Multi-Line / Symbol Font text
        return (
          <div
            className="w-full h-full overflow-hidden flex"
            style={{
              fontFamily: textEl.fontFamily || 'Arial, sans-serif',
              fontSize: `${textEl.fontSize * (scale / 3.78) * 0.85}px`,
              fontWeight: textEl.fontWeight || 'normal',
              fontStyle: textEl.fontStyle || 'normal',
              textDecoration: textEl.textDecoration || 'none',
              color: textEl.color || '#000000',
              backgroundColor: textEl.backgroundColor || 'transparent',
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
              whiteSpace: textEl.multiline || textEl.textType === 'multi-line' ? 'pre-wrap' : 'nowrap',
            }}
          >
            {evaluatedContent}
          </div>
        );
      })()}

      {element.type === 'barcode' && (() => {
        const barcodeEl = element as BarcodeElement;
        const hasBorder = barcodeEl.borderType && barcodeEl.borderType !== 'none';
        const isEllipse = barcodeEl.borderType === 'ellipse';

        return (
          <div
            className={`w-full h-full flex flex-col items-center justify-center overflow-hidden ${
              isEllipse ? 'rounded-full' : ''
            }`}
            style={{
              backgroundColor:
                barcodeEl.borderFillColor && barcodeEl.borderFillColor !== 'None'
                  ? barcodeEl.borderFillColor
                  : 'rgba(255, 255, 255, 0.6)',
              borderWidth: hasBorder ? `${Math.max(1, (barcodeEl.borderThickness || 1) * scale * 0.75)}px` : '0px',
              borderColor: barcodeEl.borderColor || '#000000',
              borderStyle: barcodeEl.borderDashStyle || 'solid',
            }}
          >
            <canvas
              ref={barcodeCanvasRef}
              className="max-w-full max-h-full object-contain p-1"
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        );
      })()}

      {element.type === 'shape' && (
        <div className="w-full h-full">
          {(element as ShapeElement).shapeType === 'rectangle' && (
            <div
              className="w-full h-full"
              style={{
                backgroundColor: (element as ShapeElement).fillColor || 'transparent',
                borderColor: (element as ShapeElement).strokeColor || '#000000',
                borderWidth: `${(element as ShapeElement).strokeWidth * scale}px`,
                borderStyle: (element as ShapeElement).strokeStyle || 'solid',
                borderRadius: `${(element as ShapeElement).cornerRadius * scale}px`,
              }}
            />
          )}

          {(element as ShapeElement).shapeType === 'circle' && (
            <div
              className="w-full h-full rounded-full"
              style={{
                backgroundColor: (element as ShapeElement).fillColor || 'transparent',
                borderColor: (element as ShapeElement).strokeColor || '#000000',
                borderWidth: `${(element as ShapeElement).strokeWidth * scale}px`,
                borderStyle: (element as ShapeElement).strokeStyle || 'solid',
              }}
            />
          )}

          {(element as ShapeElement).shapeType === 'line' && (
            <div
              className="w-full h-0 border-t"
              style={{
                borderColor: (element as ShapeElement).strokeColor || '#000000',
                borderTopWidth: `${(element as ShapeElement).strokeWidth * scale}px`,
                borderStyle: (element as ShapeElement).strokeStyle || 'solid',
                marginTop: `${heightPx / 2}px`,
              }}
            />
          )}
        </div>
      )}

      {element.type === 'image' && (
        <div className="w-full h-full overflow-hidden">
          <img
            src={(element as ImageElement).src}
            alt={element.name}
            className="w-full h-full pointer-events-none"
            style={{
              objectFit: (element as ImageElement).objectFit || 'contain',
              filter: `${(element as ImageElement).grayscale ? 'grayscale(100%)' : ''} ${(element as ImageElement).invert ? 'invert(100%)' : ''}`,
            }}
          />
        </div>
      )}

      {/* Lock Indicator */}
      {element.locked && (
        <div className="absolute top-1 right-1 bg-amber-500/90 text-white p-0.5 rounded shadow-2xs">
          <Lock className="w-3 h-3" />
        </div>
      )}

      {/* Resize & Rotate Handles if selected and not locked */}
      {isSelected && !element.locked && (
        <>
          {/* Top-Left */}
          <div
            className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-[#16a34a] rounded-xs cursor-nwse-resize z-20"
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartResize(e, 'top-left', element);
            }}
          />
          {/* Top-Center */}
          <div
            className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-[#16a34a] rounded-xs cursor-ns-resize z-20"
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartResize(e, 'top-center', element);
            }}
          />
          {/* Top-Right */}
          <div
            className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-[#16a34a] rounded-xs cursor-nesw-resize z-20"
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartResize(e, 'top-right', element);
            }}
          />
          {/* Middle-Left */}
          <div
            className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-white border-2 border-[#16a34a] rounded-xs cursor-ew-resize z-20"
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartResize(e, 'middle-left', element);
            }}
          />
          {/* Middle-Right */}
          <div
            className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-white border-2 border-[#16a34a] rounded-xs cursor-ew-resize z-20"
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartResize(e, 'middle-right', element);
            }}
          />
          {/* Bottom-Left */}
          <div
            className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-[#16a34a] rounded-xs cursor-nesw-resize z-20"
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartResize(e, 'bottom-left', element);
            }}
          />
          {/* Bottom-Center */}
          <div
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-[#16a34a] rounded-xs cursor-ns-resize z-20"
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartResize(e, 'bottom-center', element);
            }}
          />
          {/* Bottom-Right */}
          <div
            className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-[#16a34a] rounded-xs cursor-nwse-resize z-20"
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartResize(e, 'bottom-right', element);
            }}
          />

          {/* Rotate Handle */}
          <div
            className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center cursor-grab active:cursor-grabbing z-20"
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartRotate(e, element);
            }}
          >
            <div className="w-3.5 h-3.5 bg-emerald-600 rounded-full border-2 border-white shadow-xs" />
            <div className="w-0.5 h-3.5 bg-emerald-600" />
          </div>
        </>
      )}
    </div>
  );
};
