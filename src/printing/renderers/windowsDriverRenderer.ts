import { LabelTemplate, LabelElement, TextElement, BarcodeElement } from '../../types';
import { evaluateElementData, resolveImageElementSrc, evaluateTextElementRuns, hasDataSourceFontOverrides } from '../../services/dataSourceEngine';
import { generateBarcodeSVG, generatePureSymbolSVG, calculateBarcodeLayout, resolveBarcodeData } from '../../services/barcodeEngine';
import { getMultiLineLayoutValue, getSingleLineLayoutValue } from '../../services/controlCharacterService';
import { getTextElementMarkup } from '../../services/textMarkupEngine';
import { getArcTextSvg, measureTextObject } from '../../services/textMeasurementEngine';

/**
 * Generates an exact-dimension, print-ready HTML/SVG document for Windows Driver printing.
 * Injected with @page rules in exact millimeters, vector SVGs for barcodes/QR, and crisp typography.
 * Supports single continuous/die-cut labels as well as multi-up sheets (e.g. A4 matrix grid).
 */
export function generateWindowsDriverHtml(
  template: LabelTemplate,
  records: Record<string, any>[] = [{}],
  copiesOrOptions: number | { copies?: number; startingSlotOffset?: number } = 1
): string {
  const copies = typeof copiesOrOptions === 'number'
    ? Math.max(1, copiesOrOptions)
    : Math.max(1, copiesOrOptions?.copies || 1);

  const startingSlotOffset = typeof copiesOrOptions === 'object' && copiesOrOptions?.startingSlotOffset !== undefined
    ? copiesOrOptions.startingSlotOffset
    : 0;

  // Flatten expanded records for total copies
  const expandedRecords: Record<string, any>[] = [];
  records.forEach((record) => {
    for (let c = 0; c < copies; c++) {
      expandedRecords.push(record);
    }
  });

  const isSheetGrid = Boolean(
    template.sheetGrid?.enabled &&
    (template.sheetGrid.rows > 1 || template.sheetGrid.columns > 1)
  );

  if (isSheetGrid) {
    return generateMultiUpSheetHtml(template, expandedRecords, { startingSlotOffset });
  } else {
    return generateSingleLabelRollHtml(template, expandedRecords);
  }
}

/**
 * Single roll / die-cut label printing (1 label per physical page).
 */
function generateSingleLabelRollHtml(
  template: LabelTemplate,
  records: Record<string, any>[]
): string {
  const widthMm = template.dimensions?.width ?? (template as any).width ?? 100;
  const heightMm = template.dimensions?.height ?? (template as any).height ?? 100;
  const orientation = template.dimensions?.orientation || (template as any).orientation || 'portrait';

  const isLandscape = orientation === 'landscape' || orientation === 'landscape-180';
  const is180 = orientation === 'portrait-180' || orientation === 'landscape-180';

  // Physical page dimensions: retain exact template dimensions unless landscape orientation requests dimension inversion
  const pageWidthMm = isLandscape && widthMm < heightMm ? heightMm : widthMm;
  const pageHeightMm = isLandscape && widthMm < heightMm ? widthMm : heightMm;

  const renderedLabelsHtml: string[] = records.map((record, rIdx) => {
    const innerHtml = renderLabelContentHtml(template, record, rIdx);
    const bgStyle = getBackgroundCss(template);
    return `
    <div class="label-page" data-page="${rIdx + 1}" style="${bgStyle}">
      <div class="label-transform-box ${is180 ? 'rotate-180' : ''}">
        ${innerHtml}
      </div>
    </div>`;
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(template.name || 'BarcodeFlow Print Job')}</title>
  <style>
    @page {
      size: ${pageWidthMm}mm ${pageHeightMm}mm;
      margin: 0;
    }
    @media print {
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: transparent !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .label-page {
        page-break-after: always;
        break-after: page;
      }
      .label-page:last-child {
        page-break-after: avoid;
        break-after: avoid;
      }
    }
    *, *:before, *:after {
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #f8fafc;
    }
    .label-page {
      width: ${pageWidthMm}mm;
      height: ${pageHeightMm}mm;
      position: relative;
      overflow: hidden;
      background: #ffffff;
      page-break-inside: avoid;
    }
    .label-transform-box {
      width: 100%;
      height: 100%;
      position: relative;
      transform-origin: center center;
    }
    .rotate-180 {
      transform: rotate(180deg);
    }
    .label-element {
      position: absolute;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      transform-origin: top left;
      line-height: 1.15;
    }
    .text-content {
      width: 100%;
      word-break: break-word;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
  </style>
</head>
<body>
  ${renderedLabelsHtml.join('\n')}
</body>
</html>`;
}

/**
 * Multi-up Matrix Sheet Printing (e.g. 3x10 labels on an A4 sheet).
 * Renders multiple labels onto one physical sheet, honoring margins, gaps, print order,
 * and optional starting-slot offset to prevent wasting partially-used sheets.
 */
function generateMultiUpSheetHtml(
  template: LabelTemplate,
  records: Record<string, any>[],
  options?: { startingSlotOffset?: number }
): string {
  const grid = template.sheetGrid!;
  const rows = Math.max(1, grid.rows || 1);
  const cols = Math.max(1, grid.columns || 1);
  const labelsPerSheet = rows * cols;

  const labelWidth = grid.labelWidth || template.dimensions.width;
  const labelHeight = grid.labelHeight || template.dimensions.height;
  const gapH = grid.gapHorizontal ?? grid.gapX ?? 0;
  const gapV = grid.gapVertical ?? grid.gapY ?? 0;

  const marginTop = grid.marginTop ?? template.margins?.top ?? 0;
  const marginLeft = grid.marginLeft ?? template.margins?.left ?? 0;
  const marginRight = template.margins?.right ?? marginLeft;
  const marginBottom = template.margins?.bottom ?? marginTop;

  // Compute sheet dimensions (defaults to standard A4 if close)
  const calcWidth = marginLeft + marginRight + cols * labelWidth + (cols - 1) * gapH;
  const calcHeight = marginTop + marginBottom + rows * labelHeight + (rows - 1) * gapV;

  let sheetWidthMm = calcWidth;
  let sheetHeightMm = calcHeight;

  if (calcWidth <= 212 && calcHeight <= 299 && (calcWidth > 170 || calcHeight > 240)) {
    sheetWidthMm = 210;
    sheetHeightMm = 297;
  }

  const startingCorner = template.printOrder?.startingCorner || 'top-left';
  const direction = template.printOrder?.direction || 'horizontal';

  // Calculate coordinates for each slot index 0..(labelsPerSheet - 1)
  const slotPositions: { x: number; y: number }[] = [];
  for (let k = 0; k < labelsPerSheet; k++) {
    let r = 0;
    let c = 0;

    if (direction === 'horizontal') {
      const rowIdx = Math.floor(k / cols);
      const colIdx = k % cols;
      r = startingCorner.startsWith('bottom') ? rows - 1 - rowIdx : rowIdx;
      c = startingCorner.endsWith('right') ? cols - 1 - colIdx : colIdx;
    } else {
      const colIdx = Math.floor(k / rows);
      const rowIdx = k % rows;
      c = startingCorner.endsWith('right') ? cols - 1 - colIdx : colIdx;
      r = startingCorner.startsWith('bottom') ? rows - 1 - rowIdx : rowIdx;
    }

    const posX = marginLeft + c * (labelWidth + gapH);
    const posY = marginTop + r * (labelHeight + gapV);
    slotPositions.push({ x: posX, y: posY });
  }

  const startingSlotOffset = Math.max(
    0,
    Math.min(labelsPerSheet - 1, options?.startingSlotOffset || 0)
  );

  const renderedSheetsHtml: string[] = [];
  let recordCursor = 0;
  let sheetIndex = 0;

  while (recordCursor < records.length || sheetIndex === 0) {
    const isFirstSheet = sheetIndex === 0;
    const currentSlotOffset = isFirstSheet ? startingSlotOffset : 0;
    const currentSheetCapacity = labelsPerSheet - currentSlotOffset;

    const sheetRecords = records.slice(recordCursor, recordCursor + currentSheetCapacity);
    recordCursor += sheetRecords.length;

    const labelsOnSheetHtml = sheetRecords.map((record, itemIdx) => {
      const slotIdx = currentSlotOffset + itemIdx;
      const pos = slotPositions[slotIdx] || { x: 0, y: 0 };
      const globalIdx = (recordCursor - sheetRecords.length) + itemIdx;
      const content = renderLabelContentHtml(template, record, globalIdx);
      const bgStyle = getBackgroundCss(template);
      return `
        <div class="sheet-label-item" style="left: ${pos.x}mm; top: ${pos.y}mm; width: ${labelWidth}mm; height: ${labelHeight}mm; ${bgStyle}">
          ${content}
        </div>`;
    });

    renderedSheetsHtml.push(`
      <div class="physical-sheet" data-sheet="${sheetIndex + 1}">
        ${labelsOnSheetHtml.join('\n')}
      </div>
    `);

    sheetIndex++;
    if (recordCursor >= records.length) break;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(template.name || 'BarcodeFlow Multi-Up Sheet')}</title>
  <style>
    @page {
      size: ${sheetWidthMm}mm ${sheetHeightMm}mm;
      margin: 0;
    }
    @media print {
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: transparent !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .physical-sheet {
        page-break-after: always;
        break-after: page;
      }
      .physical-sheet:last-child {
        page-break-after: avoid;
        break-after: avoid;
      }
    }
    *, *:before, *:after {
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #f8fafc;
    }
    .physical-sheet {
      width: ${sheetWidthMm}mm;
      height: ${sheetHeightMm}mm;
      position: relative;
      overflow: hidden;
      background: #ffffff;
      page-break-inside: avoid;
    }
    .sheet-label-item {
      position: absolute;
      overflow: hidden;
      box-sizing: border-box;
    }
    .label-element {
      position: absolute;
      display: flex;
      align-items: center;
      box-sizing: border-box;
      transform-origin: top left;
      line-height: 1.15;
    }
    .text-content {
      width: 100%;
      word-break: break-word;
      white-space: pre-wrap;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  ${renderedSheetsHtml.join('\n')}
</body>
</html>`;
}

function getBackgroundCss(template: LabelTemplate): string {
  const bg = template.background;
  if (!bg || !bg.printBackground) return '';

  const parts: string[] = [];
  if (bg.useColor && bg.color) {
    parts.push(`background-color: ${bg.color}`);
  }
  if (bg.useImage && bg.imageUrl) {
    parts.push(`background-image: url('${bg.imageUrl}')`);
    parts.push('background-size: cover');
    parts.push('background-position: center');
  }
  return parts.join('; ');
}

function renderLabelContentHtml(
  template: LabelTemplate,
  record: Record<string, any>,
  printIndex: number = 0
): string {
  const sortedElements = [...template.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

  return sortedElements
    .map((el) => {
      if (!el.visible || el.printable === false) return '';

      const x = el.x;
      const y = el.y;
      const w = el.width;
      const textEl = el.type === 'text' ? el as TextElement : null;
      const isParagraphText = !!textEl && (textEl.textType === 'paragraph' || textEl.textFormatType === 'paragraph');
      const paragraphAutoHeight = isParagraphText && !!textEl && (textEl.autoHeight ?? textEl.autoSize === true);
      const paragraphValue = isParagraphText && textEl
        ? evaluateElementData(textEl, { record, currentRecordIndex: printIndex })
        : '';
      const paragraphRuns = isParagraphText && textEl
        ? evaluateTextElementRuns(textEl, { record, currentRecordIndex: printIndex })
        : undefined;
      const h = el.type === 'barcode'
        ? calculateBarcodeLayout(el as any).totalHeightMm
        : paragraphAutoHeight && textEl
          ? measureTextObject({
            text: paragraphValue,
            runs: paragraphRuns,
            fontFamily: textEl.fontFamily,
            fontSize: textEl.fontSize,
            fontWeight: textEl.fontWeight,
            fontStyle: textEl.fontStyle,
            letterSpacing: textEl.letterSpacing,
            lineHeight: textEl.lineHeight,
            fontWidthScale: textEl.fontWidthScale || 100,
            textType: 'paragraph',
            textFormatType: 'paragraph',
            multiline: true,
            wrap: textEl.wrap !== false && textEl.wordWrap !== false,
            containerWidthMm: textEl.width,
            borderConfig: textEl.borderConfig,
          }).height
          : el.height;
      const rot = el.rotation || 0;
      const opacity = el.opacity !== undefined ? el.opacity : 1;

      const style = [
        `left: ${x}mm`,
        `top: ${y}mm`,
        `width: ${w}mm`,
        `height: ${h}mm`,
        `z-index: ${el.zIndex || 1}`,
        `opacity: ${opacity}`,
        rot ? `transform: rotate(${rot}deg)` : '',
      ]
        .filter(Boolean)
        .join('; ');

      if (el.type === 'text') {
        if (isParagraphText && textEl) {
          const markup = getTextElementMarkup(
            { ...textEl, height: h, autoHeight: paragraphAutoHeight || textEl.autoHeight },
            paragraphValue,
            paragraphRuns,
          );
          return `<div class="el" style="position:absolute;${style};overflow:visible">${markup}</div>`;
        }
        const isSingleLine = textEl.textType === 'single-line';
        const hasOverrides = hasDataSourceFontOverrides(textEl);
        const containerStyle = [
          `text-align: ${textEl.textAlign || 'left'}`,
          `line-height: ${textEl.lineHeight || 1.15}`,
          `white-space: ${isSingleLine ? 'nowrap' : 'pre-wrap'}`,
          `word-break: ${isSingleLine ? 'normal' : 'break-word'}`,
        ].join('; ');

        if (hasOverrides) {
          const runs = evaluateTextElementRuns(textEl, { record, printIndex, currentRecordIndex: printIndex });
          const spansHtml = runs
            .map((run) => {
              const runText = isSingleLine ? getSingleLineLayoutValue(run.value) : getMultiLineLayoutValue(run.value);
              if (!runText) return '';
              const s = run.style;
              const runUnderline = s.underline;
              const runStrikeout = s.strikeout;
              const decor =
                runUnderline && runStrikeout
                  ? 'underline line-through'
                  : runUnderline
                  ? 'underline'
                  : runStrikeout
                  ? 'line-through'
                  : 'none';
              const color = s.whiteOnBlack ? '#ffffff' : (s.color || textEl.color || '#000000');
              const bg = s.whiteOnBlack
                ? 'background-color: #000000;'
                : s.backgroundColor && s.backgroundColor !== 'transparent'
                ? `background-color: ${s.backgroundColor};`
                : '';
              const spanStyle = [
                `font-size: ${s.fontSize || textEl.fontSize || 12}pt`,
                `font-family: ${s.fontFamily || textEl.fontFamily || 'Arial'}, sans-serif`,
                `color: ${color}`,
                bg,
                s.fontWeight ? `font-weight: ${s.fontWeight}` : '',
                s.fontStyle ? `font-style: ${s.fontStyle}` : '',
                decor !== 'none' ? `text-decoration: ${decor}` : '',
              ]
                .filter(Boolean)
                .join('; ');
              return `<span style="${spanStyle}">${escapeHtml(runText)}</span>`;
            })
            .join('');
          return `<div class="label-element" style="${style}"><div class="text-content" style="${containerStyle}">${spansHtml}</div></div>`;
        }

        const rawVal = evaluateElementData(el, { record, printIndex, currentRecordIndex: printIndex });
        const textVal = isSingleLine ? getSingleLineLayoutValue(rawVal) : getMultiLineLayoutValue(rawVal);
        if (textEl.textType === 'arc' || textEl.textFormatType === 'arc') {
          return `<div class="label-element" style="${style}">${getArcTextSvg(textEl, getSingleLineLayoutValue(textVal))}</div>`;
        }
        const markup = getTextElementMarkup(textEl, rawVal);
        const textStyle = [
          `font-size: ${el.fontSize}pt`,
          `font-family: ${el.fontFamily || 'Arial'}, sans-serif`,
          `color: ${el.color || '#000000'}`,
          el.fontWeight ? `font-weight: ${el.fontWeight}` : '',
          el.fontStyle ? `font-style: ${el.fontStyle}` : '',
          el.textDecoration ? `text-decoration: ${el.textDecoration}` : '',
          el.textAlign ? `text-align: ${el.textAlign}` : 'text-align: left',
          `line-height: ${el.lineHeight || 1.15}`,
          `white-space: ${isSingleLine ? 'nowrap' : 'pre-wrap'}`,
        ]
          .filter(Boolean)
          .join('; ');

        return `<div class="label-element" style="${style}"><div class="text-content" style="${textStyle}">${markup ?? escapeHtml(textVal)}</div></div>`;
      }

      if (el.type === 'barcode') {
        try {
          const barcodeEl = el as BarcodeElement;
          const resolved = resolveBarcodeData(barcodeEl, { record: record as any, printIndex, currentRecordIndex: printIndex });
          const layout = calculateBarcodeLayout(barcodeEl, resolved);
          const pureSvg = generatePureSymbolSVG(barcodeEl, { record: record as any, printIndex, currentRecordIndex: printIndex });
          const isTop = resolved.placement === 'top';
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

          const symbolRegionHtml = `<div class="barcode-symbol-region" style="width: 100%; height: ${layout.symbolHeightMm}mm; display: flex; align-items: center; justify-content: center;">${pureSvg}</div>`;
          const hrtRegionHtml = resolved.includeText && resolved.displayTextLines.length > 0
            ? `<div class="barcode-hrt-region" style="width: 100%; margin-top: ${isTop ? 0 : layout.hrtGapMm}mm; margin-bottom: ${isTop ? layout.hrtGapMm : 0}mm; font-size: ${layout.fontSizePt}pt; font-family: ${escapeHtml(fontName)}, Arial, sans-serif; font-weight: ${isBold ? 'bold' : 'normal'}; font-style: ${isItalic ? 'italic' : 'normal'}; text-decoration: ${isUnderline ? 'underline' : 'none'}; text-align: ${textAlign}; color: ${textColor}; line-height: 1.25; white-space: nowrap;">${resolved.displayTextLines.map(escapeHtml).join('<br/>')}</div>`
            : '';

          return `<div class="label-element barcode-object" style="${style}; display: flex; flex-direction: column; justify-content: flex-start;">${isTop ? hrtRegionHtml + symbolRegionHtml : symbolRegionHtml + hrtRegionHtml}</div>`;
        } catch {
          return `<div class="label-element" style="${style}; font-size: 8pt; color: red;">Barcode Error</div>`;
        }
      }

      if (el.type === 'shape') {
        const stroke = el.strokeColor && el.strokeColor !== 'transparent' ? el.strokeColor : 'none';
        const strokeW = el.strokeWidth || 0.5;
        const fill = el.fillColor && el.fillColor !== 'transparent' ? el.fillColor : 'none';

        if (el.shapeType === 'rectangle') {
          const radius = el.cornerRadius ? `${el.cornerRadius}mm` : '0';
          return `<div class="label-element" style="${style}; border: ${stroke !== 'none' ? `${strokeW}mm solid ${stroke}` : 'none'}; background: ${fill}; border-radius: ${radius};"></div>`;
        }

        if (el.shapeType === 'circle' || el.shapeType === 'ellipse') {
          return `<div class="label-element" style="${style}; border: ${stroke !== 'none' ? `${strokeW}mm solid ${stroke}` : 'none'}; background: ${fill}; border-radius: 50%;"></div>`;
        }

        if (el.shapeType === 'line') {
          return `<div class="label-element" style="${style}; border-top: ${strokeW}mm solid ${stroke || '#000'}; height: 0;"></div>`;
        }
      }

      if (el.type === 'image') {
        const imgSrc = resolveImageElementSrc(el, { record, printIndex, currentRecordIndex: printIndex });
        if (imgSrc) {
          return `<div class="label-element" style="${style}"><img src="${imgSrc}" style="width: 100%; height: 100%; object-fit: ${el.objectFit || 'contain'};" /></div>`;
        }
        return '';
      }

      return '';
    })
    .filter(Boolean)
    .join('\n');
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
