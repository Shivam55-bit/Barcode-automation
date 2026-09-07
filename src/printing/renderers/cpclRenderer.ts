/**
 * CPCL (Comtec Printer Control Language) Renderer
 * Used primarily for mobile/portable label printers (e.g., Zebra QLn series, ZQ500/600 series, Cameo, Apex).
 * 
 * 🖨 STATUS: NEEDS PHYSICAL HARDWARE TEST
 * (Protocol conforms to Zebra CPCL Programming Manual; physical verification pending on actual CPCL device)
 */

import { LabelTemplate } from '../../types';
import { mmToDots } from '../../printer/dpiService';
import { evaluateElementData } from '../../services/dataSourceEngine';

export interface CpclRenderOptions {
  dpi?: number;
  copies?: number;
  darkness?: number; // 0 (light) to 10 (dark)
  speed?: number;
  gapMm?: number;
}

export function renderCPCL(
  template: LabelTemplate,
  records: Record<string, any>[] = [{}],
  options: CpclRenderOptions = {}
): string {
  const dpi = options.dpi || template.dimensions.dpi || 203;
  const copies = Math.max(1, options.copies || 1);
  const widthDots = mmToDots(template.dimensions.width, dpi);
  const heightDots = mmToDots(template.dimensions.height, dpi);

  const cpclJobs: string[] = [];

  for (const record of records) {
    const lines: string[] = [];

    // Header: ! <offset> <horizontal_res> <vertical_res> <height> <qty>
    lines.push(`! 0 ${dpi} ${dpi} ${heightDots} ${copies}`);
    lines.push(`PAGE-WIDTH ${widthDots}`);

    // Media tracking sensing
    if (template.mediaType === 'continuous') {
      lines.push('JOURNAL');
    }

    if (options.darkness !== undefined) {
      // CONTRAST command (0-10)
      const contrast = Math.max(0, Math.min(10, Math.round(options.darkness / 3)));
      lines.push(`CONTRAST ${contrast}`);
    }

    if (options.speed !== undefined) {
      lines.push(`SPEED ${Math.max(1, Math.min(5, Math.round(options.speed)))}`);
    }

    const sortedElements = [...template.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    for (const el of sortedElements) {
      if (!el.visible || el.printable === false) continue;

      const xD = mmToDots(el.x, dpi);
      const yD = mmToDots(el.y, dpi);
      const wD = mmToDots(el.width, dpi);
      const hD = mmToDots(el.height, dpi);
      const rot = el.rotation || 0;

      // Text command: [T | T90 | T180 | T270] <font> <size> <x> <y> <data>
      if (el.type === 'text') {
        const txt = evaluateElementData(el, { record });
        let textCmd = 'T';
        if (rot === 90) textCmd = 'T90';
        else if (rot === 180) textCmd = 'T180';
        else if (rot === 270) textCmd = 'T270';

        // Select CPCL resident font: 0=scalable/default, 7=standard, 4=large, etc.
        const pt = el.fontSize || 12;
        let fontNum = 7;
        let fontSize = 0;
        if (pt <= 8) {
          fontNum = 7;
          fontSize = 0;
        } else if (pt <= 12) {
          fontNum = 7;
          fontSize = 1;
        } else if (pt <= 18) {
          fontNum = 4;
          fontSize = 1;
        } else {
          fontNum = 4;
          fontSize = 2;
        }

        lines.push(`${textCmd} ${fontNum} ${fontSize} ${xD} ${yD} ${escapeCPCL(txt)}`);
      } else if (el.type === 'barcode') {
        const val = evaluateElementData(el, { record });
        const barHeight = mmToDots(el.barHeight || el.height, dpi);
        const isVertical = rot === 90 || rot === 270;
        const bCmd = isVertical ? 'VBARCODE' : 'BARCODE';

        switch (el.symbology) {
          case 'code39':
            lines.push(`${bCmd} 39 1 1 ${barHeight} ${xD} ${yD} ${escapeCPCL(val)}`);
            break;
          case 'qr':
          case 'gs1-qr': {
            // CPCL QR code: BARCODE QR <x> <y> M 2 U <scale>\nMA,<data>\nENDQR
            const qrScale = Math.max(2, Math.min(8, Math.round(wD / 30)));
            lines.push(`BARCODE QR ${xD} ${yD} M 2 U ${qrScale}`);
            lines.push(`MA,${escapeCPCL(val)}`);
            lines.push('ENDQR');
            break;
          }
          case 'code128':
          case 'gs1-128':
          default:
            // CPCL Code 128: BARCODE 128 1 1 <height> <x> <y> <data>
            lines.push(`${bCmd} 128 1 1 ${barHeight} ${xD} ${yD} ${escapeCPCL(val)}`);
            break;
        }
      } else if (el.type === 'shape') {
        const strokeD = Math.max(1, mmToDots(el.strokeWidth || 0.5, dpi));
        if (el.shapeType === 'rectangle') {
          // BOX <x0> <y0> <x1> <y1> <thickness>
          lines.push(`BOX ${xD} ${yD} ${xD + wD} ${yD + hD} ${strokeD}`);
        } else if (el.shapeType === 'line') {
          // LINE <x0> <y0> <x1> <y1> <thickness>
          lines.push(`LINE ${xD} ${yD} ${xD + wD} ${yD} ${strokeD}`);
        }
      }
    }

    // PRINT command triggers feed and printing of label
    lines.push('PRINT');
    cpclJobs.push(lines.join('\r\n'));
  }

  return cpclJobs.join('\r\n\r\n');
}

function escapeCPCL(str: string): string {
  if (!str) return '';
  // Avoid control breaks
  return str.replace(/[\r\n]/g, ' ');
}
