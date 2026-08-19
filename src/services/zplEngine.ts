import { LabelElement, LabelTemplate, DpiOption } from '../types';
import { evaluateElementData } from './dataSourceEngine';

/**
 * Calculates dot coordinates from mm based on target printer DPI
 */
export function mmToDots(mm: number, dpi: number = 203): number {
  const dpmm = dpi === 600 ? 23.62 : dpi === 300 ? 11.81 : (dpi / 25.4);
  return Math.round(mm * dpmm);
}

/**
 * Converts dots back to mm
 */
export function dotsToMm(dots: number, dpi: number = 203): number {
  const dpmm = dpi === 600 ? 23.62 : dpi === 300 ? 11.81 : (dpi / 25.4);
  return Number((dots / dpmm).toFixed(2));
}

/**
 * Generates production-ready ZPL-II code for industrial Zebra thermal printers
 */
export function generateZPL(template: LabelTemplate, recordData: Record<string, string> = {}, options?: { dpi?: number }): string {
  const dpi = options?.dpi || template.dimensions.dpi || 203;
  const pw = mmToDots(template.dimensions.width, dpi);
  const ll = mmToDots(template.dimensions.height, dpi);

  const lines: string[] = [
    '^XA',
    `^PW${pw}`,
    `^LL${ll}`,
    '^LH0,0',
    '^CI28', // UTF-8 character encoding support
  ];

  // Process elements sorted by z-index
  const sortedElements = [...template.elements].sort((a, b) => a.zIndex - b.zIndex);

  for (const el of sortedElements) {
    if (!el.visible || el.printable === false) continue;

    const x = mmToDots(el.x, dpi);
    const y = mmToDots(el.y, dpi);
    const w = mmToDots(el.width, dpi);
    const h = mmToDots(el.height, dpi);

    switch (el.type) {
      case 'text': {
        const textVal = evaluateElementData(el, { record: recordData });
        const fontHeight = Math.max(12, Math.round(el.fontSize * (dpi / 72)));
        const fontWidth = Math.round(fontHeight * 0.85);
        const zplOrientation = el.rotation === 90 ? 'R' : el.rotation === 180 ? 'I' : el.rotation === 270 ? 'B' : 'N';

        lines.push(`^FO${x},${y}`);
        lines.push(`^A0${zplOrientation},${fontHeight},${fontWidth}`);
        if (el.multiline || el.width > 20) {
          lines.push(`^FB${w},5,0,${el.textAlign === 'center' ? 'C' : el.textAlign === 'right' ? 'R' : 'L'},0`);
        }
        lines.push(`^FD${escapeZPL(textVal)}^FS`);
        break;
      }

      case 'barcode': {
        const barVal = evaluateElementData(el, { record: recordData });
        const barHeight = mmToDots(el.barHeight, dpi) || mmToDots(el.height, dpi);
        const zplOrientation = el.rotation === 90 ? 'R' : el.rotation === 180 ? 'I' : el.rotation === 270 ? 'B' : 'N';
        const printText = el.includeText ? 'Y' : 'N';

        lines.push(`^FO${x},${y}`);

        switch (el.symbology) {
          case 'code128':
          case 'gs1-128':
            lines.push(`^BC${zplOrientation},${barHeight},${printText},N,N,A`);
            lines.push(`^FD${escapeZPL(barVal)}^FS`);
            break;

          case 'code39':
          case 'patchcode':
            lines.push(`^B3${zplOrientation},N,${barHeight},${printText},N`);
            lines.push(`^FD${escapeZPL(barVal)}^FS`);
            break;

          case 'ean13':
            lines.push(`^BE${zplOrientation},${barHeight},${printText},N`);
            lines.push(`^FD${escapeZPL(barVal)}^FS`);
            break;

          case 'ean8':
            lines.push(`^B8${zplOrientation},${barHeight},${printText},N`);
            lines.push(`^FD${escapeZPL(barVal)}^FS`);
            break;

          case 'upca':
            lines.push(`^BU${zplOrientation},${barHeight},${printText},N,Y`);
            lines.push(`^FD${escapeZPL(barVal)}^FS`);
            break;

          case 'itf14':
          case 'interleaved2of5':
            lines.push(`^B2${zplOrientation},${barHeight},${printText},N,N`);
            lines.push(`^FD${escapeZPL(barVal)}^FS`);
            break;

          case 'qr':
          case 'gs1-qr':
          case 'micro-qr':
            lines.push(`^BQ${zplOrientation},2,${Math.min(10, Math.max(3, Math.round(el.barWidth * 3)))}`);
            lines.push(`^FDLA,${escapeZPL(barVal)}^FS`);
            break;

          case 'datamatrix':
          case 'gs1-datamatrix':
          case 'hibc-datamatrix':
            lines.push(`^BX${zplOrientation},${Math.min(12, Math.max(4, Math.round(el.barWidth * 3)))},200`);
            lines.push(`^FD${escapeZPL(barVal)}^FS`);
            break;

          case 'pdf417':
          case 'pdf417-truncated':
            lines.push(`^B7${zplOrientation},${barHeight},1,2,6,N`);
            lines.push(`^FD${escapeZPL(barVal)}^FS`);
            break;

          case 'aztec':
            lines.push(`^BO${zplOrientation},${Math.min(10, Math.max(3, Math.round(el.barWidth * 3)))},N,0,B,0`);
            lines.push(`^FD${escapeZPL(barVal)}^FS`);
            break;

          case 'maxicode':
            lines.push(`^BD${zplOrientation},1,1`);
            lines.push(`^FD${escapeZPL(barVal)}^FS`);
            break;

          default:
            lines.push(`^BC${zplOrientation},${barHeight},${printText},N,N,A`);
            lines.push(`^FD${escapeZPL(barVal)}^FS`);
            break;
        }
        break;
      }

      case 'shape': {
        const borderDots = Math.max(1, mmToDots(el.strokeWidth, dpi));
        lines.push(`^FO${x},${y}`);

        if (el.shapeType === 'rectangle') {
          const cornerRounding = el.cornerRadius ? Math.min(8, Math.round(el.cornerRadius)) : 0;
          lines.push(`^GB${w},${h},${borderDots},B,${cornerRounding}^FS`);
        } else if (el.shapeType === 'circle' || el.shapeType === 'ellipse') {
          lines.push(`^GC${w},${borderDots},B^FS`);
        } else if (el.shapeType === 'line') {
          lines.push(`^GB${w},${borderDots},${borderDots},B^FS`);
        }
        break;
      }

      default:
        break;
    }
  }

  lines.push('^XZ');
  return lines.join('\n');
}

/**
 * Generates TSPL (TSC Printer Language) code
 */
export function generateTSPL(template: LabelTemplate, recordData: Record<string, string> = {}, options?: { dpi?: number }): string {
  const dpi = options?.dpi || template.dimensions.dpi || 203;
  const pw = mmToDots(template.dimensions.width, dpi);
  const ll = mmToDots(template.dimensions.height, dpi);
  const lines: string[] = [
    `SIZE ${template.dimensions.width} mm, ${template.dimensions.height} mm`,
    'GAP 3 mm, 0 mm',
    'DIRECTION 1',
    'CLS',
  ];

  for (const el of template.elements) {
    if (!el.visible || el.printable === false) continue;
    const xDots = mmToDots(el.x, dpi);
    const yDots = mmToDots(el.y, dpi);

    if (el.type === 'text') {
      const txt = evaluateElementData(el, { record: recordData });
      lines.push(`TEXT ${xDots},${yDots},"3",0,1,1,"${txt.replace(/"/g, '\\"')}"`);
    } else if (el.type === 'barcode') {
      const val = evaluateElementData(el, { record: recordData });
      const hDots = mmToDots(el.barHeight || el.height, dpi);
      if (el.symbology === 'qr' || el.symbology === 'gs1-qr') {
        lines.push(`QRCODE ${xDots},${yDots},L,4,A,0,"${val.replace(/"/g, '\\"')}"`);
      } else if (el.symbology === 'datamatrix' || el.symbology === 'gs1-datamatrix') {
        lines.push(`DMATRIX ${xDots},${yDots},${hDots},${hDots},"${val.replace(/"/g, '\\"')}"`);
      } else {
        lines.push(`BARCODE ${xDots},${yDots},"128",${hDots},1,0,2,2,"${val.replace(/"/g, '\\"')}"`);
      }
    }
  }

  lines.push('PRINT 1,1');
  return lines.join('\n');
}

/**
 * Generates EPL2 (Eltron Programming Language) code
 */
export function generateEPL(template: LabelTemplate, recordData: Record<string, string> = {}, options?: { dpi?: number }): string {
  const dpi = options?.dpi || template.dimensions.dpi || 203;
  const pw = mmToDots(template.dimensions.width, dpi);
  const lines: string[] = [
    'N',
    `q${pw}`,
    'Q100,24',
  ];

  for (const el of template.elements) {
    if (!el.visible || el.printable === false) continue;
    const xDots = mmToDots(el.x, dpi);
    const yDots = mmToDots(el.y, dpi);

    if (el.type === 'text') {
      const txt = evaluateElementData(el, { record: recordData });
      lines.push(`A${xDots},${yDots},0,3,1,1,N,"${txt.replace(/"/g, '\\"')}"`);
    } else if (el.type === 'barcode') {
      const val = evaluateElementData(el, { record: recordData });
      const hDots = mmToDots(el.barHeight || el.height, dpi);
      lines.push(`B${xDots},${yDots},0,1,2,4,${hDots},B,"${val.replace(/"/g, '\\"')}"`);
    }
  }

  lines.push('P1');
  return lines.join('\n');
}

function escapeZPL(str: string): string {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/\^/g, '\\^').replace(/~/g, '\\~');
}

export const generateZplCode = generateZPL;
export const generateEplCode = generateEPL;

