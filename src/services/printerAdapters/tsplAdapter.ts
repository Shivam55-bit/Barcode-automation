import { LabelTemplate } from '../../types';
import { mmToDots } from '../zplEngine';
import { evaluateElementData } from '../dataSourceEngine';
import { PrinterAdapter, PrinterCapabilities, PrinterStreamOptions } from './types';

import { renderTSPL } from '../../printing/renderers/tsplRenderer';

export class TsplAdapter implements PrinterAdapter {
  public readonly id = 'tspl';
  public readonly name = 'TSC TSPL/TSPL2 Protocol';
  public readonly language = 'tspl' as const;

  public readonly capabilities: PrinterCapabilities = {
    language: 'tspl',
    displayName: 'TSC TSPL / TSPL2',
    defaultPort: 9100,
    supportedDpi: [203, 300],
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
    const density = options?.darkness !== undefined ? Math.min(15, Math.max(0, Math.round((options.darkness / 30) * 15))) : undefined;
    const speed = options?.speed !== undefined ? Math.min(12, Math.max(1, Math.round(options.speed))) : undefined;

    return renderTSPL(template, records.length > 0 ? records : [{}], {
      dpi,
      copies,
      density,
      speed,
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
