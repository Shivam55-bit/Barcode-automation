import { LabelTemplate } from '../../types';
import { mmToDots } from '../../printer/dpiService';
import { evaluateElementData } from '../../services/dataSourceEngine';
import { resolveBarcodeData } from '../../services/barcodeEngine';
import { isObjectCompletelyOutOfBounds } from '../../services/labelGeometry';
import { resolveObjectPrintMethod, getEffectiveObjectPrintMethodSettings } from '../../services/objectPrintMethodService';
import { getMultiLineLayoutValue, getSingleLineLayoutValue } from '../../services/controlCharacterService';

export interface ZplRenderOptions {
  dpi?: number;
  copies?: number;
  darkness?: number; // 0 to 30
  speed?: number; // inches per second: 2, 3, 4, 6, 8, 10, 12
  mediaTracking?: 'gap' | 'continuous' | 'black_mark';
}

/**
 * Enhanced ZPL-II Renderer conforming to Zebra Programming Language standards
 */
export function renderZPL(
  template: LabelTemplate,
  records: Record<string, any>[] = [{}],
  options: ZplRenderOptions = {}
): string {
  const dpi = options.dpi || template.dimensions.dpi || 203;
  const copies = Math.max(1, options.copies || 1);
  const pw = mmToDots(template.dimensions.width, dpi);
  const ll = mmToDots(template.dimensions.height, dpi);
  const settings = getEffectiveObjectPrintMethodSettings(template);

  const zplJobs: string[] = [];

  for (const [rIdx, record] of records.entries()) {
    const lines: string[] = [
      '^XA',
      `^PW${pw}`,
      `^LL${ll}`,
      '^LH0,0',
      '^CI28', // UTF-8 Encoding
    ];

    // Media tracking
    const effectiveMedia = options.mediaTracking ?? template.mediaType ?? 'gap';
    if (effectiveMedia === 'continuous') {
      lines.push('^MNM'); // Continuous Media
    } else if (effectiveMedia === 'black_mark') {
      lines.push('^MNM,1'); // Black Mark Media
    } else {
      lines.push('^MNN'); // Default Web / Gap sensing
    }

    // Print speed
    if (options.speed !== undefined && options.speed > 0) {
      lines.push(`^PR${options.speed},${options.speed},${options.speed}`);
    }

    // Print darkness / heat
    if (options.darkness !== undefined && options.darkness >= 0) {
      lines.push(`~SD${Math.min(30, Math.max(0, options.darkness))}`);
    }

    const sortedElements = [...template.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    for (const el of sortedElements) {
      if (!el.visible || el.printable === false || isObjectCompletelyOutOfBounds(el, template)) continue;

      const x = mmToDots(el.x, dpi);
      const y = mmToDots(el.y, dpi);
      const w = mmToDots(el.width, dpi);
      const h = mmToDots(el.height, dpi);
      const zplOrientation = el.rotation === 90 ? 'R' : el.rotation === 180 ? 'I' : el.rotation === 270 ? 'B' : 'N';

      if (el.type === 'text') {
        const rawVal = evaluateElementData(el, { record, printIndex: rIdx, currentRecordIndex: rIdx });
        const isSingleLine = (el as any).textType === 'single-line';
        const isMulti = !isSingleLine && (el.multiline || (el as any).textType === 'multi-line' || (el as any).textType === 'paragraph' || el.width > 20);
        const textVal = isSingleLine ? getSingleLineLayoutValue(rawVal) : getMultiLineLayoutValue(rawVal);
        const fontHeight = Math.max(12, Math.round(el.fontSize * (dpi / 72)));
        const fontWidth = Math.round(fontHeight * 0.85);

        lines.push(`^FO${x},${y}`);
        lines.push(`^A0${zplOrientation},${fontHeight},${fontWidth}`);
        if (isMulti) {
          const align = el.textAlign === 'center' ? 'C' : el.textAlign === 'right' ? 'R' : 'L';
          lines.push(`^FB${w},10,0,${align},0`);
        }
        lines.push(`^FD${escapeZPL(textVal, isMulti)}^FS`);
      } else if (el.type === 'barcode') {
        const resolved = resolveBarcodeData(el, { record, printIndex: rIdx, currentRecordIndex: rIdx });
        const { encodedValue, displayTextLines, includeText, placement, alignment, verticalOffsetMm, horizontalOffsetMm } = resolved;
        const barHeight = mmToDots(el.barHeight || el.height, dpi);
        const symbology = el.symbology || (el as any).barcodeType || 'code128';

        // Check if custom readable text formatting requires discrete ZPL text rendering
        const hasCustomReadable =
          includeText &&
          (placement === 'top' ||
            verticalOffsetMm !== 0.8 ||
            horizontalOffsetMm !== 0 ||
            displayTextLines.length > 1 ||
            resolved.humanReadableValue !== encodedValue ||
            el.humanReadableFont ||
            el.humanReadableFontSize);

        const printTextNative = includeText && !hasCustomReadable ? 'Y' : 'N';

        // Set module width (X dimension in dots) and wide/narrow ratio
        const moduleDots = Math.max(1, Math.round((el.xDimensionMm || 0.38) * (dpi / 25.4)));
        const wideRatio = el.ratio ? Math.max(2.0, Math.min(3.0, Number(el.ratio))) : 2.5;
        lines.push(`^BY${moduleDots},${wideRatio.toFixed(1)},${barHeight}`);

        // If human readable text is at the top, offset barcode bars downwards
        const textH = hasCustomReadable ? Math.round((el.fontSize || 10) * (dpi / 72) * 1.25) : 0;
        const barOffsetY = placement === 'top' && hasCustomReadable ? y + textH + mmToDots(verticalOffsetMm, dpi) : y;

        lines.push(`^FO${x},${barOffsetY}`);

        switch (symbology) {
          case 'code128':
          case 'gs1-128':
            lines.push(`^BC${zplOrientation},${barHeight},${printTextNative},N,N,A`);
            lines.push(`^FD${escapeZPL(encodedValue)}^FS`);
            break;

          case 'code39':
            lines.push(`^B3${zplOrientation},N,${barHeight},${printTextNative},N`);
            lines.push(`^FD${escapeZPL(encodedValue)}^FS`);
            break;

          case 'ean13':
            lines.push(`^BE${zplOrientation},${barHeight},${printTextNative},N`);
            lines.push(`^FD${escapeZPL(encodedValue)}^FS`);
            break;

          case 'upca':
            lines.push(`^BU${zplOrientation},${barHeight},${printTextNative},N,Y`);
            lines.push(`^FD${escapeZPL(encodedValue)}^FS`);
            break;

          case 'qr':
          case 'gs1-qr':
            const qrMag = Math.max(2, Math.min(10, Math.round(w / 25)));
            lines.push(`^BQN,2,${qrMag},Q,7`);
            lines.push(`^FDQA,${escapeZPL(encodedValue)}^FS`);
            break;

          case 'datamatrix':
          case 'gs1-datamatrix':
            lines.push(`^BXN,${Math.max(3, Math.round(w / 20))},200,,,,`);
            lines.push(`^FD${escapeZPL(encodedValue)}^FS`);
            break;

          default:
            lines.push(`^BC${zplOrientation},${barHeight},${printTextNative},N,N,A`);
            lines.push(`^FD${escapeZPL(encodedValue)}^FS`);
            break;
        }

        // Discrete Human-Readable Text rendering for exact BarTender placement/transforms
        if (hasCustomReadable && displayTextLines.length > 0) {
          const fontPt = el.humanReadableFontSize || el.fontSize || 10;
          const fontH = Math.max(10, Math.round(fontPt * (dpi / 72)));
          const fontW = Math.round(fontH * 0.82);
          const vOffsetDots = mmToDots(verticalOffsetMm, dpi);
          const hOffsetDots = mmToDots(horizontalOffsetMm, dpi);

          displayTextLines.forEach((lineText, lIdx) => {
            let lineY = y;
            if (placement === 'top') {
              lineY = y + lIdx * fontH;
            } else {
              lineY = y + barHeight + vOffsetDots + lIdx * fontH;
            }

            const lineX = x + hOffsetDots;
            lines.push(`^FO${lineX},${lineY}`);
            lines.push(`^A0${zplOrientation},${fontH},${fontW}`);
            const zAlign = alignment === 'left' ? 'L' : alignment === 'right' ? 'R' : 'C';
            lines.push(`^FB${w},1,0,${zAlign},0`);
            lines.push(`^FD${escapeZPL(lineText)}^FS`);
          });
        }
      } else if (el.type === 'shape') {
        const borderDots = Math.max(1, mmToDots(el.strokeWidth || 0.5, dpi));
        lines.push(`^FO${x},${y}`);

        if (el.shapeType === 'rectangle') {
          const rounding = el.cornerRadius ? Math.min(8, Math.round(el.cornerRadius * (dpi / 25.4))) : 0;
          lines.push(`^GB${w},${h},${borderDots},B,${rounding}^FS`);
        } else if (el.shapeType === 'circle' || el.shapeType === 'ellipse') {
          lines.push(`^GC${w},${borderDots},B^FS`);
        } else if (el.shapeType === 'line') {
          lines.push(`^GB${w},${borderDots},${borderDots},B^FS`);
        }
      }
    }

    // Number of identical copies per record
    if (copies > 1) {
      lines.push(`^PQ${copies},0,0,Y`);
    }

    lines.push('^XZ');
    zplJobs.push(lines.join('\n'));
  }

  return zplJobs.join('\n\n');
}

function escapeZPL(str: string, isFB = false): string {
  if (!str) return '';
  let res = str.replace(/\\/g, '\\\\').replace(/\^/g, '\\^').replace(/~/g, '\\~');
  if (isFB) {
    res = res.replace(/\r\n|\r|\n/g, '\\&');
  }
  return res;
}
