import { LabelTemplate } from '../../types';
import { PrinterAdapter, PrinterCapabilities, PrinterStreamOptions } from './types';
import { renderCPCL } from '../../printing/renderers/cpclRenderer';

export class CpclAdapter implements PrinterAdapter {
  public readonly id = 'cpcl';
  public readonly name = 'CPCL Mobile Protocol';
  public readonly language = 'cpcl' as any;

  public readonly capabilities: PrinterCapabilities = {
    language: 'cpcl' as any,
    displayName: 'CPCL Mobile (Zebra/Cameo)',
    defaultPort: 9100,
    supportedDpi: [203],
    supports2DBarcodes: true,
    supportsShapes: true,
    supportsImages: false,
    supportsCutter: false,
    supportsDirectTcp: true,
  };

  public generateJobStream(
    template: LabelTemplate,
    records: Record<string, string>[] = [{}],
    options?: PrinterStreamOptions
  ): string {
    const dpi = options?.dpi || template.dimensions.dpi || 203;
    const copies = Math.max(1, options?.copies || 1);

    return renderCPCL(template, records.length > 0 ? records : [{}], {
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
