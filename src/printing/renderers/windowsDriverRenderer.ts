import { LabelTemplate, LabelElement } from '../../types';
import { evaluateElementData } from '../../services/dataSourceEngine';
import { generateBarcodeSVG } from '../../services/barcodeEngine';

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
  const widthMm = template.dimensions.width;
  const heightMm = template.dimensions.height;
  const orientation = template.dimensions.orientation || 'portrait';

  const isLandscape = orientation === 'landscape' || orientation === 'landscape-180';
  const is180 = orientation === 'portrait-180' || orientation === 'landscape-180';

  // Physical page dimensions
  const pageWidthMm = isLandscape ? Math.max(widthMm, heightMm) : Math.min(widthMm, heightMm);
  const pageHeightMm = isLandscape ? Math.min(widthMm, heightMm) : Math.max(widthMm, heightMm);

  const renderedLabelsHtml: string[] = records.map((record, rIdx) => {
    const innerHtml = renderLabelContentHtml(template, record);
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
      const content = renderLabelContentHtml(template, record);
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
  record: Record<string, any>
): string {
  const sortedElements = [...template.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

  return sortedElements
    .map((el) => {
      if (!el.visible || el.printable === false) return '';

      const x = el.x;
      const y = el.y;
      const w = el.width;
      const h = el.height;
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
        const textVal = evaluateElementData(el, { record });
        const textStyle = [
          `font-size: ${el.fontSize}pt`,
          `font-family: ${el.fontFamily || 'Arial'}, sans-serif`,
          `color: ${el.color || '#000000'}`,
          el.fontWeight ? `font-weight: ${el.fontWeight}` : '',
          el.fontStyle ? `font-style: ${el.fontStyle}` : '',
          el.textDecoration ? `text-decoration: ${el.textDecoration}` : '',
          el.textAlign ? `text-align: ${el.textAlign}` : 'text-align: left',
          `line-height: ${el.lineHeight || 1.15}`,
        ]
          .filter(Boolean)
          .join('; ');

        return `<div class="label-element" style="${style}"><div class="text-content" style="${textStyle}">${escapeHtml(textVal)}</div></div>`;
      }

      if (el.type === 'barcode') {
        try {
          const svg = generateBarcodeSVG(el, { record: record as any });
          return `<div class="label-element" style="${style}">${svg}</div>`;
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

      if (el.type === 'image' && el.src) {
        return `<div class="label-element" style="${style}"><img src="${el.src}" style="width: 100%; height: 100%; object-fit: contain;" /></div>`;
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
