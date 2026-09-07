import { LabelTemplate } from '../../types';
import { PrinterAdapter, PrinterCapabilities, PrinterStreamOptions } from './types';
import { renderSBPL } from '../../printing/renderers/sbplRenderer';

export class SbplAdapter implements PrinterAdapter {
  public readonly id = 'sbpl';
  public readonly name = 'SATO SBPL Protocol';
  public readonly language = 'sbpl' as any;

  public readonly capabilities: PrinterCapabilities = {
    language: 'sbpl' as any,
    displayName: 'SATO SBPL Industrial',
    defaultPort: 9100,
    supportedDpi: [203, 300, 600],
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

    return renderSBPL(template, records.length > 0 ? records : [{}], {
      dpi,
      copies,
      darkness: options?.darkness,
      speed: options?.speed,
    });
  }

  public validateTemplate(template: LabelTemplate): string[] {
    const warnings: string[] = [];
    if (!template.elements || template.elements.length === 0) {
      warnings.push('Template contains no elements to print.');
    }
    return warnings;
  }
}
