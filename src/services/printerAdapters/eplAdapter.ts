import { LabelTemplate } from '../../types';
import { mmToDots } from '../zplEngine';
import { evaluateElementData } from '../dataSourceEngine';
import { PrinterAdapter, PrinterCapabilities, PrinterStreamOptions } from './types';

export class EplAdapter implements PrinterAdapter {
  public readonly id = 'epl';
  public readonly name = 'Eltron EPL2 Protocol';
  public readonly language = 'epl' as const;

  public readonly capabilities: PrinterCapabilities = {
    language: 'epl',
    displayName: 'Eltron EPL2',
    defaultPort: 9100,
    supportedDpi: [203],
    supports2DBarcodes: true,
    supportsShapes: true,
    supportsImages: false,
    supportsCutter: true,
    supportsDirectTcp: true,
  };

  public generateJobStream(
    template: LabelTemplate,
    records: Record<string, string>[] = [{}],
    options?: PrinterStreamOptions
  ): string {
    const dpi = options?.dpi || template.dimensions.dpi || 203;
    const copies = Math.max(1, options?.copies || 1);
    const darkness = options?.darkness;
    const speed = options?.speed;

    const pw = mmToDots(template.dimensions.width, dpi);
    const ph = mmToDots(template.dimensions.height, dpi);

    const streamParts: string[] = [];
    const recordsToPrint = records.length > 0 ? records : [{}];

    for (const record of recordsToPrint) {
      const lines: string[] = [
        'N',
        `q${pw}`,
        `Q${ph},24`,
      ];

      if (darkness !== undefined) {
        const d = Math.min(15, Math.max(0, Math.round((darkness / 30) * 15)));
        lines.push(`D${d}`);
      }

      if (speed !== undefined) {
        const s = Math.min(6, Math.max(1, Math.round(speed / 2)));
        lines.push(`S${s}`);
      }

      const elements = [...template.elements].sort((a, b) => a.zIndex - b.zIndex);

      for (const el of elements) {
        if (!el.visible || el.printable === false) continue;

        const x = mmToDots(el.x, dpi);
        const y = mmToDots(el.y, dpi);
        const w = mmToDots(el.width, dpi);
        const h = mmToDots(el.height, dpi);
        const rot = el.rotation === 90 ? 1 : el.rotation === 180 ? 2 : el.rotation === 270 ? 3 : 0;

        if (el.type === 'text') {
          const txt = evaluateElementData(el, { record });
          const font = el.fontSize > 16 ? 4 : el.fontSize > 12 ? 3 : 2;
          lines.push(`A${x},${y},${rot},${font},1,1,N,"${this.escapeEpl(txt)}"`);
        } else if (el.type === 'barcode') {
          const val = evaluateElementData(el, { record });
          const barH = mmToDots(el.barHeight || el.height, dpi);
          const readable = el.includeText ? 'B' : 'N';

          if (el.symbology === 'code39') {
            lines.push(`B${x},${y},${rot},3,2,4,${barH},${readable},"${this.escapeEpl(val)}"`);
          } else if (el.symbology === 'ean13') {
            lines.push(`B${x},${y},${rot},E30,2,4,${barH},${readable},"${this.escapeEpl(val)}"`);
          } else if (el.symbology === 'qr') {
            lines.push(`b${x},${y},Q,s4,eM,"${this.escapeEpl(val)}"`);
          } else {
            // Default Code 128 (1 in EPL2)
            lines.push(`B${x},${y},${rot},1,2,4,${barH},${readable},"${this.escapeEpl(val)}"`);
          }
        } else if (el.type === 'shape') {
          const stroke = Math.max(1, mmToDots(el.strokeWidth, dpi));
          if (el.shapeType === 'rectangle') {
            lines.push(`X${x},${y},${stroke},${x + w},${y + h}`);
          } else if (el.shapeType === 'line') {
            lines.push(`LO${x},${y},${w},${stroke}`);
          }
        }
      }

      lines.push(`P${copies}`);

      if (options?.cutAfterJob) {
        lines.push('C');
      }

      streamParts.push(lines.join('\n'));
    }

    return streamParts.join('\n\n');
  }

  private escapeEpl(str: string): string {
    if (!str) return '';
    return str.replace(/"/g, "'");
  }

  public validateTemplate(template: LabelTemplate): string[] {
    const warnings: string[] = [];
    if (!template.elements || template.elements.length === 0) {
      warnings.push('Template contains no elements to print.');
    }
    return warnings;
  }
}
