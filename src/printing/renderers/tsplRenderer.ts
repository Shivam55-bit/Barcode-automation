import { LabelTemplate } from '../../types';
import { mmToDots } from '../../printer/dpiService';
import { evaluateElementData } from '../../services/dataSourceEngine';

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
  const effectiveGapMm = options.gapMm !== undefined
    ? options.gapMm
    : (template.sheetGrid?.gapVertical ?? template.sheetGrid?.gapHorizontal ?? 2);

  const tsplJobs: string[] = [];

  for (const record of records) {
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
      if (!el.visible || el.printable === false) continue;

      const xD = mmToDots(el.x, dpi);
      const yD = mmToDots(el.y, dpi);
      const wD = mmToDots(el.width, dpi);
      const hD = mmToDots(el.height, dpi);
      const rot = el.rotation === 90 ? 90 : el.rotation === 180 ? 180 : el.rotation === 270 ? 270 : 0;

      if (el.type === 'text') {
        const txt = evaluateElementData(el, { record });
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

        lines.push(`TEXT ${xD},${yD},"${fontName}",${rot},${xMult},${yMult},"${escapeTSPL(txt)}"`);
      } else if (el.type === 'barcode') {
        const val = evaluateElementData(el, { record });
        const barH = mmToDots(el.barHeight || el.height, dpi);
        const printText = el.includeText !== false ? 1 : 0;

        switch (el.symbology) {
          case 'code39':
            lines.push(`BARCODE ${xD},${yD},"39",${barH},${printText},${rot},2,4,"${escapeTSPL(val)}"`);
            break;
          case 'ean13':
            lines.push(`BARCODE ${xD},${yD},"EAN13",${barH},${printText},${rot},2,2,"${escapeTSPL(val)}"`);
            break;
          case 'upca':
            lines.push(`BARCODE ${xD},${yD},"UPCA",${barH},${printText},${rot},2,2,"${escapeTSPL(val)}"`);
            break;
          case 'qr':
          case 'gs1-qr':
            const qrMag = Math.max(2, Math.min(10, Math.round(wD / 25)));
            lines.push(`QRCODE ${xD},${yD},L,${qrMag},A,${rot},"${escapeTSPL(val)}"`);
            break;
          case 'datamatrix':
          case 'gs1-datamatrix':
            lines.push(`DMATRIX ${xD},${yD},${wD},${hD},"${escapeTSPL(val)}"`);
            break;
          case 'code128':
          case 'gs1-128':
          default:
            lines.push(`BARCODE ${xD},${yD},"128",${barH},${printText},${rot},2,2,"${escapeTSPL(val)}"`);
            break;
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
