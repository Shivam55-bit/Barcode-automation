import { LabelTemplate } from '../../types';
import { mmToDots } from '../../printer/dpiService';
import { evaluateElementData } from '../../services/dataSourceEngine';
import { resolveBarcodeData } from '../../services/barcodeEngine';
import { isObjectCompletelyOutOfBounds } from '../../services/labelGeometry';
import { resolveObjectPrintMethod, getEffectiveObjectPrintMethodSettings } from '../../services/objectPrintMethodService';
import { getMultiLineLayoutValue, getSingleLineLayoutValue } from '../../services/controlCharacterService';

export interface TsplRenderOptions {
  dpi?: number;
  copies?: number;
  density?: number; // 0 to 15
  speed?: number; // 1.5, 2, 3, 4, 5, 6
  direction?: 0 | 1;
  gapMm?: number;
}

/**
 * Enhanced TSPL / TSPL2 Renderer for TSC industrial and desktop thermal label printers
 */
export function renderTSPL(
  template: LabelTemplate,
  records: Record<string, any>[] = [{}],
  options: TsplRenderOptions = {}
): string {
  const dpi = options.dpi || template.dimensions.dpi || 203;
  const copies = Math.max(1, options.copies || 1);
  const widthMm = template.dimensions.width;
  const heightMm = template.dimensions.height;
  const settings = getEffectiveObjectPrintMethodSettings(template);
  const effectiveGapMm = options.gapMm !== undefined
    ? options.gapMm
    : (template.sheetGrid?.gapVertical ?? template.sheetGrid?.gapHorizontal ?? 2);

  const tsplJobs: string[] = [];

  for (const [rIdx, record] of records.entries()) {
    const lines: string[] = [
      `SIZE ${widthMm} mm, ${heightMm} mm`,
    ];

    if (template.mediaType === 'continuous') {
      lines.push('GAP 0 mm, 0 mm');
    } else if (template.mediaType === 'black_mark') {
      lines.push(`BLINE ${effectiveGapMm} mm, 0 mm`);
    } else {
      lines.push(`GAP ${effectiveGapMm} mm, 0 mm`);
    }

    lines.push(`DIRECTION ${options.direction !== undefined ? options.direction : 1}`);
    lines.push('CLS');

    if (options.density !== undefined) {
      lines.push(`DENSITY ${Math.max(0, Math.min(15, options.density))}`);
    }

    if (options.speed !== undefined) {
      lines.push(`SPEED ${options.speed}`);
    }

    const sortedElements = [...template.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    for (const el of sortedElements) {
      if (!el.visible || el.printable === false || isObjectCompletelyOutOfBounds(el, template)) continue;

      const xD = mmToDots(el.x, dpi);
      const yD = mmToDots(el.y, dpi);
      const wD = mmToDots(el.width, dpi);
      const hD = mmToDots(el.height, dpi);
      const rot = el.rotation === 90 ? 90 : el.rotation === 180 ? 180 : el.rotation === 270 ? 270 : 0;

      if (el.type === 'text') {
        const rawTxt = evaluateElementData(el, { record, printIndex: rIdx, currentRecordIndex: rIdx });
        const isSingleLine = (el as any).textType === 'single-line';
        const layoutTxt = isSingleLine ? getSingleLineLayoutValue(rawTxt) : getMultiLineLayoutValue(rawTxt);
        const pt = el.fontSize || 12;
        let fontName = '3';
        let xMult = 1;
        let yMult = 1;

        if (pt <= 8) {
          fontName = '1';
        } else if (pt <= 11) {
          fontName = '2';
        } else if (pt <= 16) {
          fontName = '3';
        } else if (pt <= 22) {
          fontName = '4';
        } else if (pt <= 30) {
          fontName = '5';
        } else {
          fontName = '4';
          const scale = Math.min(8, Math.max(1, Math.round(pt / 18)));
          xMult = scale;
          yMult = scale;
        }

        const lineSpacingDots = Math.round(pt * (dpi / 72) * (el.lineHeight || 1.15));
        const textLines = layoutTxt.split('\n');
        textLines.forEach((tLine, lineIndex) => {
          const lineY = yD + lineIndex * lineSpacingDots;
          lines.push(`TEXT ${xD},${lineY},"${fontName}",${rot},${xMult},${yMult},"${escapeTSPL(tLine)}"`);
        });
      } else if (el.type === 'barcode') {
        const resolved = resolveBarcodeData(el, { record, printIndex: rIdx, currentRecordIndex: rIdx });
        const { encodedValue, displayTextLines, includeText, placement, alignment, verticalOffsetMm, horizontalOffsetMm } = resolved;
        const barH = mmToDots(el.barHeight || el.height, dpi);
        const symbology = el.symbology || (el as any).barcodeType || 'code128';
        const narrowDots = Math.max(1, Math.round((el.xDimensionMm || 0.38) * (dpi / 25.4)));
        const wideDots = Math.max(narrowDots + 1, Math.round(narrowDots * (Number(el.ratio) || 2.5)));

        const hasCustomReadable =
          includeText &&
          (placement === 'top' ||
            verticalOffsetMm !== 0.8 ||
            horizontalOffsetMm !== 0 ||
            displayTextLines.length > 1 ||
            resolved.humanReadableValue !== encodedValue ||
            el.humanReadableFont ||
            el.humanReadableFontSize);

        const printTextNative = includeText && !hasCustomReadable ? 1 : 0;
        const fontPt = el.humanReadableFontSize || el.fontSize || 10;
        const fontH = Math.max(10, Math.round(fontPt * (dpi / 72)));
        const barOffsetY = placement === 'top' && hasCustomReadable ? yD + fontH + mmToDots(verticalOffsetMm, dpi) : yD;

        switch (symbology) {
          case 'code39':
            lines.push(`BARCODE ${xD},${barOffsetY},"39",${barH},${printTextNative},${rot},${narrowDots},${wideDots},"${escapeTSPL(encodedValue)}"`);
            break;
          case 'ean13':
            lines.push(`BARCODE ${xD},${barOffsetY},"EAN13",${barH},${printTextNative},${rot},${narrowDots},${narrowDots},"${escapeTSPL(encodedValue)}"`);
            break;
          case 'upca':
            lines.push(`BARCODE ${xD},${barOffsetY},"UPCA",${barH},${printTextNative},${rot},${narrowDots},${narrowDots},"${escapeTSPL(encodedValue)}"`);
            break;
          case 'qr':
          case 'gs1-qr':
            const qrMag = Math.max(2, Math.min(10, Math.round(wD / 25)));
            lines.push(`QRCODE ${xD},${barOffsetY},L,${qrMag},A,${rot},"${escapeTSPL(encodedValue)}"`);
            break;
          case 'datamatrix':
          case 'gs1-datamatrix':
            lines.push(`DMATRIX ${xD},${barOffsetY},${wD},${hD},"${escapeTSPL(encodedValue)}"`);
            break;
          case 'code128':
          case 'gs1-128':
          default:
            lines.push(`BARCODE ${xD},${barOffsetY},"128",${barH},${printTextNative},${rot},${narrowDots},${narrowDots},"${escapeTSPL(encodedValue)}"`);
            break;
        }

        // Discrete Human-Readable Text rendering for exact BarTender placement/transforms
        if (hasCustomReadable && displayTextLines.length > 0) {
          const vOffsetDots = mmToDots(verticalOffsetMm, dpi);
          const hOffsetDots = mmToDots(horizontalOffsetMm, dpi);

          displayTextLines.forEach((lineText, lIdx) => {
            let lineY = yD;
            if (placement === 'top') {
              lineY = yD + lIdx * fontH;
            } else {
              lineY = yD + barH + vOffsetDots + lIdx * fontH;
            }
            const lineX = xD + hOffsetDots;
            lines.push(`TEXT ${lineX},${lineY},"3",${rot},1,1,"${escapeTSPL(lineText)}"`);
          });
        }
      } else if (el.type === 'shape') {
        const strokeD = Math.max(1, mmToDots(el.strokeWidth || 0.5, dpi));
        if (el.shapeType === 'rectangle') {
          lines.push(`BOX ${xD},${yD},${xD + wD},${yD + hD},${strokeD}`);
        } else if (el.shapeType === 'line') {
          lines.push(`BAR ${xD},${yD},${wD},${strokeD}`);
        }
      }
    }

    // PRINT [count], [copies]
    lines.push(`PRINT ${copies},1`);
    tsplJobs.push(lines.join('\n'));
  }

  return tsplJobs.join('\n\n');
}

function escapeTSPL(str: string): string {
  if (!str) return '';
  return str.replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
}
