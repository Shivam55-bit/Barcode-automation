/**
 * SBPL (SATO Barcode Printer Language) Renderer
 * Used for SATO industrial, desktop, and portable barcode label printers (e.g. CL4NX, CL6NX, CT4-LX, WS4).
 * 
 * 🖨 STATUS: NEEDS PHYSICAL HARDWARE TEST
 * (Conforms to SATO Standard SBPL Command Reference; physical verification pending on actual SATO hardware)
 */

import { LabelTemplate } from '../../types';
import { mmToDots } from '../../printer/dpiService';
import { evaluateElementData } from '../../services/dataSourceEngine';

export interface SbplRenderOptions {
  dpi?: number;
  copies?: number;
  darkness?: number;
  speed?: number;
  gapMm?: number;
}

const ESC = '\x1B';

export function renderSBPL(
  template: LabelTemplate,
  records: Record<string, any>[] = [{}],
  options: SbplRenderOptions = {}
): string {
  const dpi = options.dpi || template.dimensions.dpi || 203;
  const copies = Math.max(1, options.copies || 1);
  const widthDots = mmToDots(template.dimensions.width, dpi);
  const heightDots = mmToDots(template.dimensions.height, dpi);

  const sbplJobs: string[] = [];

  for (const record of records) {
    const commands: string[] = [];

    // Start of Job / Label
    commands.push(`${ESC}A`);

    // Set Label Dimensions (Pitch and Width): <ESC>A1 <V> <H>
    const vPitch = String(heightDots).padStart(4, '0');
    const hPitch = String(widthDots).padStart(4, '0');
    commands.push(`${ESC}A1${vPitch}${hPitch}`);

    // Print speed (if specified) <ESC>CS <speed> (1-6)
    if (options.speed !== undefined) {
      const spd = Math.max(1, Math.min(6, Math.round(options.speed)));
      commands.push(`${ESC}CS${spd}`);
    }

    // Print darkness (if specified) <ESC>#E <darkness> (1-5)
    if (options.darkness !== undefined) {
      const dark = Math.max(1, Math.min(5, Math.round(options.darkness / 6)));
      commands.push(`${ESC}#E${dark}`);
    }

    const sortedElements = [...template.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    for (const el of sortedElements) {
      if (!el.visible || el.printable === false) continue;

      const xD = mmToDots(el.x, dpi);
      const yD = mmToDots(el.y, dpi);
      const wD = mmToDots(el.width, dpi);
      const hD = mmToDots(el.height, dpi);

      // SATO Coordinate positioning: <ESC>V<vertical_dots> <ESC>H<horizontal_dots>
      const vPos = `${ESC}V${String(yD).padStart(4, '0')}`;
      const hPos = `${ESC}H${String(xD).padStart(4, '0')}`;

      if (el.type === 'text') {
        const txt = evaluateElementData(el, { record });
        const pt = el.fontSize || 12;

        // Select SATO font: M (medium), U (large), WB (vector scale)
        let fontCmd = `${ESC}M`;
        if (pt <= 8) {
          fontCmd = `${ESC}S`; // Smallest standard matrix
        } else if (pt <= 12) {
          fontCmd = `${ESC}M`; // Medium standard matrix
        } else if (pt <= 18) {
          fontCmd = `${ESC}U`; // Large matrix
        } else {
          // Vector scalable font: <ESC>$=<width>,<height><ESC>$
          const scale = Math.min(99, Math.round(pt * 2));
          fontCmd = `${ESC}WB1${ESC}$=${scale},${scale}${ESC}$`;
        }

        commands.push(`${vPos}${hPos}${fontCmd}${escapeSBPL(txt)}`);
      } else if (el.type === 'barcode') {
        const val = evaluateElementData(el, { record });
        const barH = String(mmToDots(el.barHeight || el.height, dpi)).padStart(3, '0');

        switch (el.symbology) {
          case 'code39':
            // Code 39: <ESC>B1 <narrow> <wide> <height>
            commands.push(`${vPos}${hPos}${ESC}B10204${barH}${escapeSBPL(val)}`);
            break;
          case 'qr':
          case 'gs1-qr': {
            // QR Code in SBPL: <ESC>2D30,L,05,0,0 <ESC>DS <data>
            const qrSize = String(Math.max(2, Math.min(12, Math.round(wD / 25)))).padStart(2, '0');
            commands.push(`${vPos}${hPos}${ESC}2D30,L,${qrSize},0,0${ESC}DS${escapeSBPL(val)}`);
            break;
          }
          case 'datamatrix':
          case 'gs1-datamatrix':
            // Data Matrix in SBPL: <ESC>2D50,...
            commands.push(`${vPos}${hPos}${ESC}2D50,0,05,0,0${ESC}DS${escapeSBPL(val)}`);
            break;
          case 'code128':
          case 'gs1-128':
          default:
            // Code 128: <ESC>BG <narrow> <wide> <height>
            commands.push(`${vPos}${hPos}${ESC}BG0204${barH}${escapeSBPL(val)}`);
            break;
        }
      } else if (el.type === 'shape') {
        const strokeD = Math.max(1, mmToDots(el.strokeWidth || 0.5, dpi));
        const sStr = String(strokeD).padStart(2, '0');
        if (el.shapeType === 'rectangle') {
          // Box line drawing in SBPL: <ESC>FW <v_thick> <h_thick> <v_len> <h_len>
          const hLen = String(wD).padStart(4, '0');
          const vLen = String(hD).padStart(4, '0');
          commands.push(`${vPos}${hPos}${ESC}FW${sStr}${sStr}${vLen}${hLen}`);
        } else if (el.shapeType === 'line') {
          // Horizontal line
          const hLen = String(wD).padStart(4, '0');
          commands.push(`${vPos}${hPos}${ESC}FW00${sStr}0000${hLen}`);
        }
      }
    }

    // Quantity to print: <ESC>Q <copies>
    commands.push(`${ESC}Q${copies}`);

    // End of Label: <ESC>Z
    commands.push(`${ESC}Z`);

    sbplJobs.push(commands.join('\n'));
  }

  return sbplJobs.join('\n');
}

function escapeSBPL(str: string): string {
  if (!str) return '';
  return str.replace(/\x1B/g, ''); // Strip any embedded ESC characters
}
