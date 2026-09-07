import { LabelTemplate } from '../../types';
import { generateZPL } from '../zplEngine';
import { PrinterAdapter, PrinterCapabilities, PrinterStreamOptions } from './types';

export class ZplAdapter implements PrinterAdapter {
  public readonly id = 'zpl';
  public readonly name = 'Zebra ZPL-II Industrial Protocol';
  public readonly language = 'zpl' as const;

  public readonly capabilities: PrinterCapabilities = {
    language: 'zpl',
    displayName: 'Zebra ZPL-II',
    defaultPort: 9100,
    supportedDpi: [203, 300, 600],
    supports2DBarcodes: true,
    supportsShapes: true,
    supportsImages: true,
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

    const streamParts: string[] = [];

    // Optional printer setup header (darkness, print speed)
    if (darkness !== undefined || speed !== undefined) {
      const header: string[] = ['^XA'];
      if (darkness !== undefined) {
        // ~SD darkness (00-30)
        const clampedDarkness = Math.min(30, Math.max(0, Math.round(darkness)));
        header.push(`~SD${clampedDarkness.toString().padStart(2, '0')}`);
      }
      if (speed !== undefined) {
        // ^PR print speed (inches/sec)
        const clampedSpeed = Math.min(14, Math.max(2, Math.round(speed)));
        header.push(`^PR${clampedSpeed},${clampedSpeed}`);
      }
      header.push('^XZ');
      streamParts.push(header.join('\n'));
    }

    const recordsToPrint = records.length > 0 ? records : [{}];

    for (const record of recordsToPrint) {
      let zpl = generateZPL(template, record, { dpi });
      
      // Inject print quantity (^PQ) before the closing ^XZ if copies > 1
      if (copies > 1) {
        if (zpl.endsWith('^XZ')) {
          zpl = zpl.slice(0, -3) + `^PQ${copies},0,1,Y\n^XZ`;
        } else {
          zpl += `\n^PQ${copies},0,1,Y`;
        }
      }
      
      streamParts.push(zpl);
    }

    return streamParts.join('\n\n');
  }

  public validateTemplate(template: LabelTemplate): string[] {
    const warnings: string[] = [];
    if (!template.elements || template.elements.length === 0) {
      warnings.push('Template contains no elements to print.');
    }
    return warnings;
  }
}
