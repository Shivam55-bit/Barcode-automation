import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LabelElement, BarcodeElement, TextElement, ShapeElement, ImageElement, TableElement } from '../../types';
import { renderBarcodeToCanvas, calculateBarcodeLayout, resolveBarcodeData } from '../../services/barcodeEngine';
import { evaluateElementData, resolveImageElementSrc, evaluateTextElementRuns, hasDataSourceFontOverrides } from '../../services/dataSourceEngine';
import {
  fitTextToBox,
  isTextFitToBoxEnabled,
  measureTextObject,
  scaleTextRunsForFit,
  getArcTextSvg,
} from '../../services/textMeasurementEngine';
import { getMultiLineLayoutValue, getSingleLineLayoutValue } from '../../services/controlCharacterService';
import { getTextElementMarkup } from '../../services/textMarkupEngine';
import { getParagraphInsets } from '../../services/paragraphLayout';
import { InlineTextEditor } from './InlineTextEditor';
import { Lock } from 'lucide-react';

interface CanvasElementProps {
  element: LabelElement;
  isSelected: boolean;
  isEditing?: boolean;
  onSelect: (e: React.MouseEvent, el: LabelElement) => void;
  onDoubleClick?: (el: LabelElement) => void;
  onStartEdit?: (el: LabelElement) => void;
  onCommitEdit?: (id: string, newText: string) => void;
  onCancelEdit?: () => void;
  onDraftResize?: (id: string, widthMm: number, heightMm: number) => void;
  onGrowParagraphToFit?: (element: TextElement, heightMm: number) => void;
  scale: number; // px per mm
  recordData: Record<string, string>;
  onStartDrag: (e: React.MouseEvent, el: LabelElement) => void;
  onStartResize: (e: React.MouseEvent, handle: string, el: LabelElement) => void;
  onStartRotate: (e: React.MouseEvent, el: LabelElement) => void;
  onContextMenu: (e: React.MouseEvent, el: LabelElement) => void;
  onBindField?: (elementId: string, payload: any) => void;
  labelDimensions?: { width: number; height: number };
}

export const CanvasElement: React.FC<CanvasElementProps> = ({
  element,
  isSelected,
  isEditing = false,
  onSelect,
  onDoubleClick,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onDraftResize,
  onGrowParagraphToFit,
  scale,
  recordData,
  onStartDrag,
  onStartResize,
  onStartRotate,
  onContextMenu,
  onBindField,
  labelDimensions,
}) => {
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);
  const paragraphMarkupRef = useRef<HTMLDivElement>(null);
  const latestAutoWidthMeasureRef = useRef<{ elementId: string; text: string; styleKey: string }>({ elementId: '', text: '', styleKey: '' });
  const [barcodeRenderError, setBarcodeRenderError] = useState(false);
  const [isDragOverTarget, setIsDragOverTarget] = useState(false);
  const [loadedFitFontKey, setLoadedFitFontKey] = useState('');
  const [renderedParagraphHeight, setRenderedParagraphHeight] = useState(0);

  const evaluatedContent = evaluateElementData(element, { record: recordData });
  const isLocked = !!element.locked;
  const isEditable = !isLocked && (element.editable !== undefined ? element.editable : element.isEditable !== undefined ? element.isEditable : true);
  const allowMove = isEditable && element.allowMove !== false;
  const allowResize = isEditable && element.allowResize !== false;
  const allowRotate = isEditable && element.allowRotate !== false;
  const isMissingField = typeof evaluatedContent === 'string' && evaluatedContent.startsWith('⚠ Missing Field');

  const isTextEl = element.type === 'text';
  const textEl = isTextEl ? (element as TextElement) : null;
  const isMultiLine =
    textEl?.textType === 'multi-line' ||
    textEl?.multiline === true ||
    textEl?.textFormatType === 'paragraph' ||
    textEl?.textType === 'paragraph';
  const isSingleLine = isTextEl && !isMultiLine;
  const isArc = textEl?.textType === 'arc' || textEl?.textFormatType === 'arc';
  const isParagraphLayout = !!textEl && (textEl.textFormatType === 'paragraph' || textEl.textType === 'paragraph');
  const isTextFitToBox = !!textEl && isTextFitToBoxEnabled(textEl);
  const paragraphAutoHeight = isParagraphLayout && !isTextFitToBox && (textEl!.autoHeight ?? textEl!.autoSize === true);
  const fitSourceRuns = isTextFitToBox && textEl
    ? evaluateTextElementRuns(textEl, { record: recordData })
    : undefined;
  const textFit = isTextFitToBox && textEl
    ? fitTextToBox(textEl, String(evaluatedContent ?? ''), fitSourceRuns)
    : null;
  const fittedRuns = textFit && textEl
    ? scaleTextRunsForFit(textEl, fitSourceRuns, textFit.fontSize, textFit.fontWidthScale)
    : undefined;
  const fitTextValue = String(evaluatedContent ?? '');
  const fitFontRequests = isTextFitToBox && textEl
    ? [...new Set([
      `${textEl.fontStyle || 'normal'} ${textEl.fontWeight || 'normal'} ${(textEl.fontSize || 10) * (96 / 72)}px ${textEl.fontFamily || 'Arial, sans-serif'}`,
      ...(fitSourceRuns || []).map((run) =>
        `${run.style.fontStyle || textEl.fontStyle || 'normal'} ${run.style.fontWeight || textEl.fontWeight || 'normal'} ${(run.style.fontSize || textEl.fontSize || 10) * (96 / 72)}px ${run.style.fontFamily || textEl.fontFamily || 'Arial, sans-serif'}`
      ),
    ])]
    : [];
  const fitFontKey = isTextFitToBox ? JSON.stringify([fitTextValue, fitFontRequests]) : '';
  const renderAsParagraph = isParagraphLayout || (!!isMultiLine && isTextFitToBox);
  const paragraphText = typeof evaluatedContent === 'string' ? evaluatedContent : textEl?.text || '';
  const paragraphRuns = isParagraphLayout && textEl ? evaluateTextElementRuns(textEl, { record: recordData }) : undefined;
  const paragraphDimensions = isParagraphLayout && textEl
    ? measureTextObject({
      text: paragraphText,
      runs: paragraphRuns,
      fontFamily: textEl.fontFamily,
      fontSize: textEl.fontSize,
      fontWeight: textEl.fontWeight,
      fontStyle: textEl.fontStyle,
      letterSpacing: textEl.letterSpacing,
      lineHeight: textEl.lineHeight,
      fontWidthScale: textEl.fontWidthScale || 100,
      textType: textEl.textType,
      textFormatType: 'paragraph',
      multiline: true,
      wrap: textEl.wrap !== false && textEl.wordWrap !== false,
      containerWidthMm: textEl.width,
      borderConfig: textEl.borderConfig,
    })
    : null;
  const measureRenderedParagraphHeight = () => {
    if (!textEl || !paragraphDimensions) return null;
    const svg = paragraphMarkupRef.current?.querySelector<SVGSVGElement>('svg[data-paragraph-layout="native"]');
    if (!svg) return null;
    const textNodes = Array.from(svg.querySelectorAll<SVGTextElement>('text'));
    if (!textNodes.length) return paragraphDimensions.height;
    const contentBottom = Math.max(...textNodes.map(node => {
      const bounds = node.getBBox();
      return bounds.y + bounds.height;
    }));
    return Math.max(paragraphDimensions.height, contentBottom + getParagraphInsets(textEl).bottom);
  };

  // Sizing mode:
  // Multi-line is always a user-controlled layout rectangle (fixed width & height)
  // Single-line defaults to 'auto-width' (hugging text) unless set to fixed-width/shrink-to-fit/fit-to-box
  const sizingMode = textEl?.sizingMode || (isMultiLine ? 'fixed-width' : (textEl?.autoSize !== false ? 'auto-width' : 'fixed-width'));
  const isSingleLineAutoWidth = isSingleLine && sizingMode === 'auto-width' && !isArc;
  const autoWidthText = typeof evaluatedContent === 'string'
    ? getSingleLineLayoutValue(evaluatedContent)
    : getSingleLineLayoutValue(textEl?.text || '');
  const autoWidthStyleKey = JSON.stringify({
    fontFamily: textEl?.fontFamily,
    fontSize: textEl?.fontSize,
    fontWeight: textEl?.fontWeight,
    fontStyle: textEl?.fontStyle,
    fontWidthScale: textEl?.fontWidthScale,
    letterSpacing: textEl?.letterSpacing,
    lineHeight: textEl?.lineHeight,
    borderConfig: textEl?.borderConfig,
    sourceFonts: textEl?.dataSources?.map((source) => [source.fontOverrideEnabled, source.fontStyleOverride, source.fontOverride]),
  });
  latestAutoWidthMeasureRef.current = { elementId: element.id, text: autoWidthText, styleKey: autoWidthStyleKey };

  useEffect(() => {
    if (!isSingleLineAutoWidth || !textEl || isEditing || !document.fonts?.load) return;
    let current = true;
    const text = autoWidthText;
    const requestedStyleKey = autoWidthStyleKey;
    const fontSizePx = (textEl.fontSize || 10) * (96 / 72);
    const font = `${textEl.fontStyle || 'normal'} ${textEl.fontWeight || 'normal'} ${fontSizePx}px ${textEl.fontFamily || 'Arial, sans-serif'}`;
    const runs = textEl.dataSources?.length ? evaluateTextElementRuns(textEl, { record: recordData }) : undefined;
    const runFonts = runs?.map((run) => `${run.style.fontStyle || textEl.fontStyle || 'normal'} ${run.style.fontWeight || textEl.fontWeight || 'normal'} ${(run.style.fontSize || textEl.fontSize || 10) * (96 / 72)}px ${run.style.fontFamily || textEl.fontFamily || 'Arial, sans-serif'}`) || [];

    void Promise.all([...new Set([font, ...runFonts])].map((fontToLoad) => document.fonts.load(fontToLoad, text || 'M'))).then(() => {
      const latest = latestAutoWidthMeasureRef.current;
      if (!current || latest.elementId !== element.id || latest.text !== text || latest.styleKey !== requestedStyleKey) return;
      const dimensions = measureTextObject({
        text,
        runs,
        fontFamily: textEl.fontFamily,
        fontSize: textEl.fontSize,
        fontWeight: textEl.fontWeight,
        fontStyle: textEl.fontStyle,
        letterSpacing: textEl.letterSpacing,
        lineHeight: textEl.lineHeight,
        fontWidthScale: textEl.fontWidthScale || 100,
        textType: 'single-line',
        textFormatType: 'single-line',
        multiline: false,
        wrap: false,
        borderConfig: textEl.borderConfig,
        ignoreMinSize: true,
      });
      if (Math.abs(dimensions.width - element.width) > 0.05 || Math.abs(dimensions.height - element.height) > 0.05) {
        onDraftResize?.(element.id, dimensions.width, dimensions.height);
      }
    }).catch(error => console.warn('[TextLayout] Could not load a single-line font before measuring.', error));

    return () => { current = false; };
  }, [isSingleLineAutoWidth, isEditing, textEl?.id, textEl?.text, textEl?.fontFamily, textEl?.fontSize, textEl?.fontWeight,
    textEl?.fontStyle, textEl?.fontWidthScale, textEl?.letterSpacing, textEl?.lineHeight, textEl?.borderConfig,
    textEl?.dataSources, autoWidthText, autoWidthStyleKey, element.width, element.height, recordData, onDraftResize]);

  useEffect(() => {
    if (!paragraphAutoHeight || !textEl || isEditing || !onDraftResize || !paragraphDimensions) return;
    let current = true;
    const resizeToMeasuredHeight = () => {
      if (!current) return;
      const measured = measureTextObject({
        text: paragraphText,
        runs: evaluateTextElementRuns(textEl, { record: recordData }),
        fontFamily: textEl.fontFamily,
        fontSize: textEl.fontSize,
        fontWeight: textEl.fontWeight,
        fontStyle: textEl.fontStyle,
        letterSpacing: textEl.letterSpacing,
        lineHeight: textEl.lineHeight,
        fontWidthScale: textEl.fontWidthScale || 100,
        textType: textEl.textType,
        textFormatType: 'paragraph',
        multiline: true,
        wrap: textEl.wrap !== false && textEl.wordWrap !== false,
        containerWidthMm: textEl.width,
        borderConfig: textEl.borderConfig,
      });
      const renderedHeight = measureRenderedParagraphHeight();
      const requiredHeight = Math.max(measured.height, renderedHeight ?? 0);
      setRenderedParagraphHeight(current => Math.abs(current - requiredHeight) > 0.01 ? requiredHeight : current);
      if (Math.abs(requiredHeight - element.height) > 0.01) {
        onDraftResize(element.id, element.width, requiredHeight);
      }
    };
    resizeToMeasuredHeight();

    const fontSizePx = (textEl.fontSize || 10) * (96 / 72);
    const font = `${textEl.fontStyle || 'normal'} ${textEl.fontWeight || 'normal'} ${fontSizePx}px ${textEl.fontFamily || 'Arial, sans-serif'}`;
    const runFonts = paragraphRuns?.map((run) =>
      `${run.style.fontStyle || textEl.fontStyle || 'normal'} ${run.style.fontWeight || textEl.fontWeight || 'normal'} ${(run.style.fontSize || textEl.fontSize || 10) * (96 / 72)}px ${run.style.fontFamily || textEl.fontFamily || 'Arial, sans-serif'}`
    ) || [];
    if (document.fonts?.load) {
      void Promise.all([...new Set([font, ...runFonts])].map(fontToLoad => document.fonts.load(fontToLoad, paragraphText || 'Mg')))
        .then(resizeToMeasuredHeight)
        .catch(error => console.warn('[TextLayout] Could not load a paragraph font before measuring.', error));
    }
    return () => { current = false; };
  }, [paragraphAutoHeight, paragraphDimensions?.height, isEditing, textEl?.id, textEl?.fontFamily, textEl?.fontSize,
    textEl?.fontWeight, textEl?.fontStyle, textEl?.fontWidthScale, textEl?.letterSpacing, textEl?.lineHeight,
    textEl?.borderConfig, textEl?.dataSources, textEl?.wrap, textEl?.wordWrap, textEl?.text, paragraphText,
    element.width, element.height, recordData, onDraftResize]);

  useEffect(() => {
    if (!isTextFitToBox || !fitFontKey || loadedFitFontKey === fitFontKey || !document.fonts?.load) return;
    let current = true;
    void Promise.all(fitFontRequests.map(font => document.fonts.load(font, fitTextValue || 'Mg')))
      .then(() => {
        if (current) setLoadedFitFontKey(fitFontKey);
      })
      .catch(error => console.warn('[TextLayout] Could not load a fit-to-box font before measuring.', error));
    return () => { current = false; };
  }, [isTextFitToBox, fitFontKey, fitFontRequests.join('|'), fitTextValue, loadedFitFontKey]);

  let dynamicWidth = element.width;
  let dynamicHeight = element.height;

  if (isSingleLineAutoWidth && textEl && !isEditing) {
    const singleLineContent = typeof evaluatedContent === 'string'
      ? getSingleLineLayoutValue(evaluatedContent)
      : getSingleLineLayoutValue(textEl.text || '');
    const dims = measureTextObject({
      text: singleLineContent,
      runs: textEl.dataSources && textEl.dataSources.length > 0 ? evaluateTextElementRuns(textEl, { record: recordData }) : undefined,
      fontFamily: textEl.fontFamily,
      fontSize: textEl.fontSize,
      fontWeight: textEl.fontWeight,
      fontStyle: textEl.fontStyle,
      letterSpacing: textEl.letterSpacing,
      lineHeight: textEl.lineHeight,
      fontWidthScale: textEl.fontWidthScale || 100,
      textType: 'single-line',
      textFormatType: 'single-line',
      multiline: false,
      wrap: false,
      borderConfig: textEl.borderConfig,
      ignoreMinSize: true,
    });
    dynamicWidth = dims.width;
    dynamicHeight = dims.height;
  }
  if (paragraphAutoHeight && paragraphDimensions && !isEditing) {
    dynamicHeight = Math.max(paragraphDimensions.height, renderedParagraphHeight);
  }

  const paragraphOverflows = isParagraphLayout && !paragraphAutoHeight && !!paragraphDimensions
    && paragraphDimensions.height > element.height + 0.01;

  if (element.type === 'barcode') {
    const layout = calculateBarcodeLayout(element as BarcodeElement);
    dynamicHeight = layout.totalHeightMm;
  }

  useLayoutEffect(() => {
    if (!paragraphAutoHeight || !textEl || isEditing || !onDraftResize || !paragraphDimensions) return;
    const renderedHeight = measureRenderedParagraphHeight();
    if (renderedHeight !== null) {
      setRenderedParagraphHeight(current => Math.abs(current - renderedHeight) > 0.01 ? renderedHeight : current);
      if (renderedHeight > dynamicHeight + 0.01) {
        onDraftResize(element.id, element.width, renderedHeight);
      }
    }
  }, [paragraphAutoHeight, isEditing, paragraphDimensions?.height, dynamicHeight, textEl?.id, textEl?.fontFamily,
    textEl?.fontSize, textEl?.fontWeight, textEl?.fontStyle, textEl?.fontWidthScale, textEl?.letterSpacing,
    textEl?.lineHeight, textEl?.borderConfig, textEl?.dataSources, textEl?.wrap, textEl?.wordWrap,
    paragraphText, element.width, element.height, recordData, onDraftResize]);

  // Position & Dimensions in screen pixels
  const leftPx = element.x * scale;
  const topPx = element.y * scale;
  const widthPx = dynamicWidth * scale;
  const heightPx = dynamicHeight * scale;
  const zeroHeightLine = element.type === 'shape' && element.shapeType === 'line' && heightPx === 0;
  const renderHeightPx = zeroHeightLine ? Math.max(12, element.strokeWidth * scale) : heightPx;
  const lineHitOffset = (renderHeightPx - heightPx) / 2;

  // Out of bounds detection
  const isOutOfBounds = labelDimensions
    ? element.x < 0 ||
      element.y < 0 ||
      element.x + dynamicWidth > labelDimensions.width ||
      element.y + dynamicHeight > labelDimensions.height
    : false;

  // Re-render barcode when value or element specs change
  useEffect(() => {
    if (element.type === 'barcode' && barcodeCanvasRef.current) {
      const barcodeEl = element as BarcodeElement;
      renderBarcodeToCanvas(
        barcodeCanvasRef.current,
        barcodeEl,
        scale,
        { record: recordData, symbolOnly: true }
      )
        .then(() => setBarcodeRenderError(false))
        .catch(() => setBarcodeRenderError(true));
    }
  }, [element, recordData, scale]);

  if (!element.visible) return null;

  return (
    <div
      id={`canvas-el-${element.id}`}
      className={`absolute select-none ${
        isEditing
          ? 'ring-1 ring-[#16a34a] ring-offset-1 shadow-sm bg-white/40'
          : isDragOverTarget
          ? 'ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.6)] bg-emerald-50/25'
          : isMissingField
          ? 'ring-2 ring-red-500 bg-red-50/20'
          : !allowMove
          ? isLocked ? 'cursor-not-allowed ring-1 ring-amber-400/50' : 'cursor-default'
          : 'cursor-move'
      } ${
        isSelected && !isEditing && !isDragOverTarget && !isMissingField
          ? isLocked ? 'ring-2 ring-amber-500 shadow-xs' : 'ring-1.5 ring-[#4ade80] shadow-[0_0_8px_rgba(74,222,128,0.35)]'
          : !isEditing && !isDragOverTarget && !isMissingField ? 'hover:ring-1 hover:ring-[#93c5fd]' : ''
      }`}
      style={{
        left: `${leftPx}px`,
        top: `${topPx - lineHitOffset}px`,
        width: `${widthPx}px`,
        height: `${renderHeightPx}px`,
        transform: `rotate(${element.rotation || 0}deg)`,
        transformOrigin: 'center center',
        opacity: element.opacity !== undefined ? element.opacity : 1,
        zIndex: isDragOverTarget ? 999 : element.zIndex,
      }}
      onMouseDown={(e) => {
        if (e.button === 0) {
          e.stopPropagation();
          onSelect(e, element);
          if (allowMove && !isEditing) {
            onStartDrag(e, element);
          }
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(e, element);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect(e, element);
        onContextMenu(e, element);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (isLocked || element.editable === false || element.isEditable === false) return;
        if (onDoubleClick) {
          onDoubleClick(element);
        } else if (element.type === 'text' && onStartEdit) {
          onStartEdit(element);
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/json')) {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'copy';
          if (!isDragOverTarget) setIsDragOverTarget(true);
        }
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOverTarget(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOverTarget(false);
        try {
          const raw = e.dataTransfer.getData('application/json');
          if (!raw) return;
          const payload = JSON.parse(raw);
          if (payload.type === 'database-field' && onBindField) {
            onBindField(element.id, payload);
          }
        } catch (err) {
          console.error('Error binding dropped field to element:', err);
        }
      }}
    >
      {/* Visual Indicator when hovering over compatible drop target */}
      {isDragOverTarget && (
        <div className="absolute -top-6 left-1/2 -translate-y-1/2 bg-emerald-700 text-white font-bold text-[10px] px-2 py-0.5 rounded shadow-md whitespace-nowrap pointer-events-none z-50">
          ✓ Drop to bind {element.type === 'barcode' ? 'Barcode' : 'Text'}
        </div>
      )}

      {/* Out of Bounds Warning Badge */}
      {isOutOfBounds && isSelected && !isEditing && (
        <div className="absolute -top-6 left-0 bg-amber-600 text-white font-semibold text-[9.5px] px-1.5 py-0.5 rounded shadow z-50 whitespace-nowrap flex items-center gap-1 pointer-events-none ring-1 ring-white/50">
          <span>⚠ {element.type === 'barcode' ? 'Barcode extends outside printable area' : 'Object extends outside printable area'}</span>
        </div>
      )}
      {(paragraphOverflows || (textFit !== null && !textFit.fits)) && (
        <div
          role="status"
          title={paragraphOverflows
            ? 'Fixed-height paragraph content extends beyond its text box.'
            : 'Text cannot fit within the configured Auto Size limits.'}
          className="absolute -bottom-5 right-0 bg-amber-600 text-white font-semibold text-[9.5px] px-1.5 py-0.5 rounded shadow z-50 whitespace-nowrap pointer-events-auto ring-1 ring-white/50 flex items-center gap-1"
        >
          <span>{paragraphOverflows ? 'Text overflow' : 'Auto Size overflow'}</span>
          {paragraphOverflows && isSelected && isEditable && onGrowParagraphToFit && textEl && paragraphDimensions && (
            <button
              type="button"
              title="Grow paragraph height to show all text. Keeps width and font size unchanged."
              className="border-l border-amber-200/70 pl-1 hover:underline focus-visible:outline focus-visible:outline-1"
              onMouseDown={event => event.stopPropagation()}
              onClick={event => {
                event.stopPropagation();
                const renderedHeight = measureRenderedParagraphHeight() ?? 0;
                onGrowParagraphToFit(
                  textEl,
                  Math.max(paragraphDimensions.height, renderedHeight),
                );
              }}
            >
              Grow height
            </button>
          )}
        </div>
      )}

      {/* Element Content Rendering */}
      {element.type === 'text' && (() => {
        const textEl = element as TextElement;

        // Render live Inline Text Editor if actively editing
        if (isEditing && onCommitEdit && onCancelEdit) {
          return (
            <InlineTextEditor
              element={textEl}
              scale={scale}
              onCommit={onCommitEdit}
              onCancel={onCancelEdit}
              onDraftDimensionsChange={onDraftResize}
            />
          );
        }

        // Border configuration
        const border = textEl.borderConfig;
        const hasBorder = border && border.type !== 'none';
        const isEllipseBorder = border?.type === 'ellipse';
        const borderStyle = border?.dashStyle || 'solid';
        const borderWidthPx = (border?.thickness || 1) * (scale / 3.78) * 0.35;
        const cornerRadiusPx = (border?.cornerSize || 0) * scale;
        const borderFill = border?.fillColor && (border?.fillTransparency ?? 0) < 100 ? border.fillColor : 'transparent';

        // Margins in screen pixels
        const mTop = (border?.marginTop || 0) * scale;
        const mLeft = (border?.marginLeft || 0) * scale;
        const mBottom = (border?.marginBottom || 0) * scale;
        const mRight = (border?.marginRight || 0) * scale;

        // Arc Text rendering with SVG Path
        if (textEl.textFormatType === 'arc' || textEl.textType === 'arc') {
          const arcMarkup = getArcTextSvg(textEl, getSingleLineLayoutValue(String(evaluatedContent ?? '')));

          return (
            <div
              className={`w-full h-full overflow-hidden flex items-center justify-center ${
                isEllipseBorder ? 'rounded-full' : ''
              }`}
              style={{
                border: hasBorder ? `${borderWidthPx}px ${borderStyle} ${border?.color || '#000'}` : undefined,
                borderRadius: !isEllipseBorder && cornerRadiusPx > 0 ? `${cornerRadiusPx}px` : undefined,
                backgroundColor: borderFill !== 'transparent' ? borderFill : textEl.whiteOnBlack ? '#000000' : textEl.backgroundColor || 'transparent',
                paddingTop: `${mTop}px`,
                paddingLeft: `${mLeft}px`,
                paddingBottom: `${mBottom}px`,
                paddingRight: `${mRight}px`,
              }}
              dangerouslySetInnerHTML={{ __html: arcMarkup }}
            />
          );
        }

        // Standard Font Size in screen pixels (1 pt = 25.4/72 mm * scale)
        const baseFontSizePx = (textFit?.fontSize ?? textEl.fontSize ?? 10) * (25.4 / 72) * scale;
        const effectiveFontSize = baseFontSizePx;

        const displayText = isSingleLine
          ? getSingleLineLayoutValue(String(evaluatedContent ?? ''))
          : getMultiLineLayoutValue(String(evaluatedContent ?? ''));

        if (renderAsParagraph) {
          const paragraphElement: TextElement = {
            ...textEl,
            ...(isTextFitToBox ? {
              textFormatType: 'paragraph',
              fontSize: textFit!.fontSize,
              fontWidthScale: textFit!.fontWidthScale,
            } : {}),
            height: dynamicHeight,
            autoHeight: paragraphAutoHeight || (!isTextFitToBox && textEl.autoHeight),
          };
          const htmlToRender = getTextElementMarkup(
            paragraphElement,
            String(evaluatedContent ?? ''),
            fittedRuns ?? paragraphRuns,
          ) || '';

          return (
            <div
              ref={paragraphMarkupRef}
              className={`w-full h-full ${isEllipseBorder ? 'rounded-full' : ''}`}
              style={{
                pointerEvents: 'none',
                fontFamily: textEl.fontFamily || 'Arial, sans-serif',
                fontSize: `${effectiveFontSize}px`,
                color: textEl.whiteOnBlack ? '#ffffff' : textEl.color || '#000000',
                backgroundColor: borderFill !== 'transparent' ? borderFill : textEl.whiteOnBlack ? '#000000' : textEl.backgroundColor || 'transparent',
                outline: hasBorder ? `${borderWidthPx}px ${borderStyle} ${border?.color || '#000'}` : undefined,
                outlineOffset: hasBorder ? `-${borderWidthPx}px` : undefined,
                borderRadius: !isEllipseBorder && cornerRadiusPx > 0 ? `${cornerRadiusPx}px` : undefined,
                boxSizing: 'border-box',
                overflow: 'visible',
              }}
              dangerouslySetInnerHTML={{ __html: htmlToRender }}
            />
          );
        }

        // HTML, Word Processor, RTF, and XAML Markup Containers
        if (textEl.textType === 'html' || textEl.textType === 'word-processor' || textEl.textType === 'rtf' || textEl.textType === 'xaml' || textEl.richContentHtml) {
          const htmlToRender = getTextElementMarkup(textEl, String(evaluatedContent ?? ''), evaluateTextElementRuns(textEl, { record: recordData })) || '';

          return (
            <div
              className={`w-full h-full overflow-hidden p-0.5 ${isEllipseBorder ? 'rounded-full' : ''}`}
              style={{
                fontFamily: textEl.fontFamily || 'Arial, sans-serif',
                fontSize: `${effectiveFontSize}px`,
                color: textEl.whiteOnBlack ? '#ffffff' : textEl.color || '#000000',
                backgroundColor: borderFill !== 'transparent' ? borderFill : textEl.whiteOnBlack ? '#000000' : textEl.backgroundColor || 'transparent',
                lineHeight: textEl.lineHeight || 1.25,
                border: hasBorder ? `${borderWidthPx}px ${borderStyle} ${border?.color || '#000'}` : undefined,
                borderRadius: !isEllipseBorder && cornerRadiusPx > 0 ? `${cornerRadiusPx}px` : undefined,
                paddingTop: `${mTop}px`,
                paddingLeft: `${mLeft}px`,
                paddingBottom: `${mBottom}px`,
                paddingRight: `${mRight}px`,
              }}
              dangerouslySetInnerHTML={{ __html: htmlToRender }}
            />
          );
        }

        // Standard Single-Line / Paragraph / Multi-Line text
        const isUnderline = textEl.underline || textEl.textDecoration === 'underline';
        const isStrikeout = textEl.strikeout || textEl.textDecoration === 'line-through';
        const textDecor = isUnderline && isStrikeout ? 'underline line-through' : isUnderline ? 'underline' : isStrikeout ? 'line-through' : 'none';
        const fontScale = (textFit?.fontWidthScale ?? textEl.fontWidthScale ?? 100) / 100;
        const vAlign = textEl.verticalAlign || textEl.verticalAlignment || 'top';
        const hAlign = (textEl.textAlign as any) || textEl.horizontalAlignment || 'left';
        const overflowMode = textEl.overflow || 'hidden';
        const hasFontOverrides = hasDataSourceFontOverrides(textEl);

        return (
          <div
            className={`w-full h-full flex flex-col ${isEllipseBorder ? 'rounded-full' : ''}`}
            style={{
              fontFamily: textEl.fontFamily || 'Arial, sans-serif',
              fontSize: `${effectiveFontSize}px`,
              fontWeight: textEl.fontWeight || 'normal',
              fontStyle: textEl.fontStyle || 'normal',
              textDecoration: textDecor,
              color: textEl.whiteOnBlack ? '#ffffff' : textEl.color || '#000000',
              backgroundColor: borderFill !== 'transparent' ? borderFill : textEl.whiteOnBlack ? '#000000' : textEl.backgroundColor || 'transparent',
              letterSpacing: `${textEl.letterSpacing || 0}px`,
              lineHeight: textEl.lineHeight || 1.15,
              border: hasBorder ? `${borderWidthPx}px ${borderStyle} ${border?.color || '#000'}` : undefined,
              borderRadius: !isEllipseBorder && cornerRadiusPx > 0 ? `${cornerRadiusPx}px` : undefined,
              paddingTop: `${mTop}px`,
              paddingLeft: `${mLeft}px`,
              paddingBottom: `${mBottom}px`,
              paddingRight: `${mRight}px`,
              justifyContent:
                vAlign === 'middle' || (vAlign as any) === 'center'
                  ? 'center'
                  : vAlign === 'bottom'
                  ? 'flex-end'
                  : 'flex-start',
              overflow: textFit && !textFit.fits
                ? 'visible'
                : overflowMode === 'visible' ? 'visible' : overflowMode === 'clip' ? 'clip' : 'hidden',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                width: '100%',
                textAlign: hAlign,
                display: isSingleLine ? 'flex' : undefined,
                justifyContent: hAlign === 'center' ? 'center' : hAlign === 'right' ? 'flex-end' : 'flex-start',
                whiteSpace: isSingleLine
                  ? 'nowrap'
                  : textEl.wrap !== false
                  ? 'pre-wrap'
                  : 'pre',
                wordBreak: isSingleLine ? 'normal' : 'break-word',
                overflowWrap: isSingleLine ? 'normal' : 'break-word',
              }}
            >
              {hasFontOverrides ? (
                <span style={{ display: isSingleLine ? 'inline-block' : undefined }}>
                  {(fittedRuns ?? evaluateTextElementRuns(textEl, { record: recordData })).map((run, idx) => {
                  const runText = isSingleLine
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
                        WebkitTextStroke: s.textOutline?.enabled
                          ? `${s.textOutline.width * 0.5 * (scale / 3.78) * 0.35}px ${s.textOutline.color}`
                          : undefined,
                      }}
                    >
                      {runText}
                    </span>
                  );
                  })}
                </span>
              ) : (
                <span
                  style={{
                    display: fontScale !== 1 ? 'inline-block' : undefined,
                    transform: fontScale !== 1 ? `scaleX(${fontScale})` : undefined,
                    transformOrigin: hAlign === 'center' ? 'center' : hAlign === 'right' ? 'right' : 'left',
                  }}
                >
                  {displayText}
                </span>
              )}
            </div>
          </div>
        );
      })()}

      {element.type === 'barcode' && (() => {
        const barcodeEl = element as BarcodeElement;
        const hasBorder = barcodeEl.borderType && barcodeEl.borderType !== 'none';
        const isEllipse = barcodeEl.borderType === 'ellipse';
        const cornerPx = barcodeEl.cornerRadius ? barcodeEl.cornerRadius * scale : 0;
        const padPx = barcodeEl.borderPadding !== undefined ? barcodeEl.borderPadding * scale : 0;

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
        const isBold = styleRaw === 'bold' || styleRaw === 'bold-italic' || barcodeEl.fontWeight === 'bold' || barcodeEl.humanReadable?.fontWeight === 'bold';
        const isItalic = styleRaw === 'italic' || styleRaw === 'bold-italic' || barcodeEl.fontStyle === 'italic' || barcodeEl.humanReadable?.fontStyle === 'italic';
        const isUnderline = Boolean(barcodeEl.humanReadableUnderline || barcodeEl.underline || barcodeEl.humanReadable?.textDecoration === 'underline');
        const isStrikeout = Boolean(barcodeEl.humanReadableStrikeout || (barcodeEl as any).textDecoration === 'line-through');
        const textColor = barcodeEl.humanReadableColor || barcodeEl.humanReadable?.color || barcodeEl.color || '#000000';
        const textAlign = resolved.alignment === 'left' ? 'left' : resolved.alignment === 'right' ? 'right' : 'center';

        const hOffsetPx = Math.round(resolved.horizontalOffsetMm * (scale / 3.78) * 3.78);

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
              textDecoration: isUnderline && isStrikeout ? 'underline line-through' : isUnderline ? 'underline' : isStrikeout ? 'line-through' : 'none',
              color: textColor,
              textAlign,
              transform: hOffsetPx ? `translateX(${hOffsetPx}px)` : undefined,
              lineHeight: 1.25,
              whiteSpace: 'nowrap',
              overflow: 'visible',
            }}
          >
            {resolved.displayTextLines.map((line, idx) => (
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
              borderRadius: isEllipse ? '50%' : cornerPx > 0 ? `${cornerPx}px` : undefined,
              padding: `${padPx}px`,
            }}
          >
            {isTop && hrtRegion}

            {/* SYMBOL REGION: Height is strictly symbolHeightPx = mmToPx(barHeight) */}
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
                position: 'absolute',
                top: `${(renderHeightPx - (element as ShapeElement).strokeWidth * scale) / 2}px`,
                borderColor: (element as ShapeElement).strokeColor || '#000000',
                borderTopWidth: `${(element as ShapeElement).strokeWidth * scale}px`,
                borderStyle: (element as ShapeElement).strokeStyle || 'solid',
              }}
            />
          )}

          {((element as ShapeElement).shapeType === 'polygon' || (element as any).svgPath) && (
            <svg
              className="w-full h-full overflow-visible"
              viewBox={(element as any).viewBox || '0 0 100 100'}
              preserveAspectRatio="none"
            >
              <path
                d={(element as any).svgPath}
                fill={(element as ShapeElement).fillColor || 'transparent'}
                stroke={(element as ShapeElement).strokeColor || '#000000'}
                strokeWidth={Math.max(1, ((element as ShapeElement).strokeWidth || 0.5) * 2)}
                strokeDasharray={(element as ShapeElement).strokeStyle === 'dashed' ? '6 4' : (element as ShapeElement).strokeStyle === 'dotted' ? '2 2' : undefined}
              />
            </svg>
          )}
        </div>
      )}

      {element.type === 'image' && (
        <div className="w-full h-full overflow-hidden">
          <img
            src={resolveImageElementSrc(element, { record: recordData }) || (element as ImageElement).src}
            alt={element.name}
            className="w-full h-full pointer-events-none"
            onError={(e) => {
              const fb = (element as ImageElement).fallbackSrc;
              const imgEl = e.currentTarget;
              if (fb && imgEl.src !== fb) {
                imgEl.src = fb;
              }
            }}
            style={{
              objectFit: (element as ImageElement).objectFit || 'contain',
              filter: `${(element as ImageElement).grayscale ? 'grayscale(100%)' : ''} ${(element as ImageElement).invert ? 'invert(100%)' : ''}`,
            }}
          />
        </div>
      )}

      {/* Lock Indicator */}
      {isLocked && (
        <div
          title="Field Locked (Fixed Layout / Immutable)"
          className="absolute top-1 right-1 bg-amber-500 text-white p-0.5 rounded shadow-xs z-30 flex items-center justify-center ring-1 ring-white/50"
        >
          <Lock className="w-3 h-3" />
        </div>
      )}

      {/* Resize Handles if selected, not actively editing, and allowed */}
      {isSelected && !isEditing && allowResize && (
        <div
          className="absolute pointer-events-none [&>div]:pointer-events-auto"
          style={{ width: Math.max(32, widthPx), height: Math.max(32, renderHeightPx), left: (widthPx - Math.max(32, widthPx)) / 2, top: (renderHeightPx - Math.max(32, renderHeightPx)) / 2 }}
        >
          {/* Top-Left */}
          <div
            className="absolute -top-1.5 -left-1.5 w-2.5 h-2.5 bg-[#4ade80] border border-[#15803d] rounded-full shadow-xs cursor-nwse-resize z-20 hover:scale-125 transition-transform"
            title="Resize top-left"
            onPointerDown={(e) => {
              e.stopPropagation();
              onStartResize(e, 'top-left', element);
            }}
          />
          {/* Top-Center */}
          <div
            className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[#4ade80] border border-[#15803d] rounded-full shadow-xs cursor-ns-resize z-20 hover:scale-125 transition-transform"
            title="Resize top-center"
            onPointerDown={(e) => {
              e.stopPropagation();
              onStartResize(e, 'top-center', element);
            }}
          />
          {/* Top-Right */}
          <div
            className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 bg-[#4ade80] border border-[#15803d] rounded-full shadow-xs cursor-nesw-resize z-20 hover:scale-125 transition-transform"
            title="Resize top-right"
            onPointerDown={(e) => {
              e.stopPropagation();
              onStartResize(e, 'top-right', element);
            }}
          />
          {/* Middle-Left */}
          <div
            className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-2.5 h-2.5 bg-[#4ade80] border border-[#15803d] rounded-full shadow-xs cursor-ew-resize z-20 hover:scale-125 transition-transform"
            title="Resize middle-left"
            onPointerDown={(e) => {
              e.stopPropagation();
              onStartResize(e, 'middle-left', element);
            }}
          />
          {/* Middle-Right */}
          <div
            className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-2.5 h-2.5 bg-[#4ade80] border border-[#15803d] rounded-full shadow-xs cursor-ew-resize z-20 hover:scale-125 transition-transform"
            title="Resize middle-right"
            onPointerDown={(e) => {
              e.stopPropagation();
              onStartResize(e, 'middle-right', element);
            }}
          />
          {/* Bottom-Left */}
          <div
            className="absolute -bottom-1.5 -left-1.5 w-2.5 h-2.5 bg-[#4ade80] border border-[#15803d] rounded-full shadow-xs cursor-nesw-resize z-20 hover:scale-125 transition-transform"
            title="Resize bottom-left"
            onPointerDown={(e) => {
              e.stopPropagation();
              onStartResize(e, 'bottom-left', element);
            }}
          />
          {/* Bottom-Center */}
          <div
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[#4ade80] border border-[#15803d] rounded-full shadow-xs cursor-ns-resize z-20 hover:scale-125 transition-transform"
            title="Resize bottom-center"
            onPointerDown={(e) => {
              e.stopPropagation();
              onStartResize(e, 'bottom-center', element);
            }}
          />
          {/* Bottom-Right */}
          <div
            className="absolute -bottom-1.5 -right-1.5 w-2.5 h-2.5 bg-[#4ade80] border border-[#15803d] rounded-full shadow-xs cursor-nwse-resize z-20 hover:scale-125 transition-transform"
            title="Resize bottom-right"
            onPointerDown={(e) => {
              e.stopPropagation();
              onStartResize(e, 'bottom-right', element);
            }}
          />
        </div>
      )}

      {/* Rotate Handle if selected, not editing, and allowed (BarTender cyan rotate pin) */}
      {isSelected && !isEditing && allowRotate && (
        <div
          className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center cursor-grab active:cursor-grabbing z-20"
          style={{ top: -28 - (Math.max(32, heightPx) - heightPx) / 2 }}
          title="Rotate object"
          onPointerDown={(e) => {
            e.stopPropagation();
            onStartRotate(e, element);
          }}
        >
          <div className="w-2.5 h-2.5 bg-[#38bdf8] rounded-full border border-[#0284c7] shadow-xs hover:scale-125 transition-transform" />
          <div className="w-0.5 h-3.5 bg-[#38bdf8]" />
        </div>
      )}
    </div>
  );
};
