import { LabelTemplate } from '../../types';
import { mmToDots } from '../../printer/dpiService';
import { evaluateElementData } from '../../services/dataSourceEngine';

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

  const zplJobs: string[] = [];

  for (const record of records) {
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
      if (!el.visible || el.printable === false) continue;

      const x = mmToDots(el.x, dpi);
      const y = mmToDots(el.y, dpi);
      const w = mmToDots(el.width, dpi);
      const h = mmToDots(el.height, dpi);
      const zplOrientation = el.rotation === 90 ? 'R' : el.rotation === 180 ? 'I' : el.rotation === 270 ? 'B' : 'N';

      if (el.type === 'text') {
        const textVal = evaluateElementData(el, { record });
        const fontHeight = Math.max(12, Math.round(el.fontSize * (dpi / 72)));
        const fontWidth = Math.round(fontHeight * 0.85);

        lines.push(`^FO${x},${y}`);
        lines.push(`^A0${zplOrientation},${fontHeight},${fontWidth}`);
        if (el.multiline || el.width > 20) {
          const align = el.textAlign === 'center' ? 'C' : el.textAlign === 'right' ? 'R' : 'L';
          lines.push(`^FB${w},5,0,${align},0`);
        }
        lines.push(`^FD${escapeZPL(textVal)}^FS`);
      } else if (el.type === 'barcode') {
        const barVal = evaluateElementData(el, { record });
        const barHeight = mmToDots(el.barHeight || el.height, dpi);
        const printText = el.includeText ? 'Y' : 'N';

        lines.push(`^FO${x},${y}`);

        switch (el.symbology) {
          case 'code128':
          case 'gs1-128':
            lines.push(`^BC${zplOrientation},${barHeight},${printText},N,N,A`);
            lines.push(`^FD${escapeZPL(barVal)}^FS`);
            break;

          case 'code39':
            lines.push(`^B3${zplOrientation},N,${barHeight},${printText},N`);
            lines.push(`^FD${escapeZPL(barVal)}^FS`);
            break;

          case 'ean13':
            lines.push(`^BE${zplOrientation},${barHeight},${printText},N`);
            lines.push(`^FD${escapeZPL(barVal)}^FS`);
            break;

          case 'upca':
            lines.push(`^BU${zplOrientation},${barHeight},${printText},N,Y`);
            lines.push(`^FD${escapeZPL(barVal)}^FS`);
            break;

          case 'qr':
          case 'gs1-qr':
            const qrMag = Math.max(2, Math.min(10, Math.round(w / 25)));
            lines.push(`^BQN,2,${qrMag},Q,7`);
            lines.push(`^FDQA,${escapeZPL(barVal)}^FS`);
            break;

          case 'datamatrix':
          case 'gs1-datamatrix':
            lines.push(`^BXN,${Math.max(3, Math.round(w / 20))},200,,,,`);
            lines.push(`^FD${escapeZPL(barVal)}^FS`);
            break;

          default:
            lines.push(`^BC${zplOrientation},${barHeight},${printText},N,N,A`);
            lines.push(`^FD${escapeZPL(barVal)}^FS`);
            break;
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

function escapeZPL(str: string): string {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/\^/g, '\\^').replace(/~/g, '\\~');
}
