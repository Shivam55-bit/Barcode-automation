import { LabelTemplate } from '../../types';
import { mmToDots } from '../../printer/dpiService';
import { evaluateElementData } from '../../services/dataSourceEngine';

export interface EplRenderOptions {
  dpi?: number;
  copies?: number;
  density?: number; // 0 to 15
  speed?: number; // 1 to 5
}

/**
 * EPL2 (Eltron Programming Language) Renderer
 */
export function renderEPL(
  template: LabelTemplate,
  records: Record<string, any>[] = [{}],
  options: EplRenderOptions = {}
): string {
  const dpi = options.dpi || template.dimensions.dpi || 203;
  const copies = Math.max(1, options.copies || 1);
  const pw = mmToDots(template.dimensions.width, dpi);
  const eplJobs: string[] = [];

  for (const record of records) {
    const lines: string[] = [
      'N', // Clear image buffer
      `q${pw}`, // Label width in dots
    ];

    if (options.density !== undefined) {
      lines.push(`D${Math.max(0, Math.min(15, options.density))}`);
    }

    if (options.speed !== undefined) {
      lines.push(`S${options.speed}`);
    }

    const sortedElements = [...template.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    for (const el of sortedElements) {
      if (!el.visible || el.printable === false) continue;

      const xD = mmToDots(el.x, dpi);
      const yD = mmToDots(el.y, dpi);

      if (el.type === 'text') {
        const txt = evaluateElementData(el, { record });
        // Font 3, standard 1x multiplier
        lines.push(`A${xD},${yD},0,3,1,1,N,"${escapeEPL(txt)}"`);
      } else if (el.type === 'barcode') {
        const val = evaluateElementData(el, { record });
        const hDots = mmToDots(el.barHeight || el.height, dpi);
        lines.push(`B${xD},${yD},0,1,2,4,${hDots},B,"${escapeEPL(val)}"`);
      }
    }

    // Print command: P[number of label sets], [number of copies per label set]
    lines.push(`P${copies}`);
    eplJobs.push(lines.join('\n'));
  }

  return eplJobs.join('\n\n');
}

function escapeEPL(str: string): string {
  if (!str) return '';
  return str.replace(/"/g, '\\"');
}
