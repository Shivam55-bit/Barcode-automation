import { LabelTemplate } from '../../types';
import { PrinterAdapter, PrinterCapabilities, PrinterStreamOptions } from './types';

export class PdfAdapter implements PrinterAdapter {
  public readonly id = 'pdf';
  public readonly name = 'Desktop PDF Vector Document Spooler';
  public readonly language = 'pdf' as const;

  public readonly capabilities: PrinterCapabilities = {
    language: 'pdf',
    displayName: 'PDF Vector Spooler',
    defaultPort: 0,
    supportedDpi: [300, 600],
    supports2DBarcodes: true,
    supportsShapes: true,
    supportsImages: true,
    supportsCutter: false,
    supportsDirectTcp: false,
  };

  public generateJobStream(
    template: LabelTemplate,
    records: Record<string, string>[] = [{}],
    options?: PrinterStreamOptions
  ): string {
    const copies = Math.max(1, options?.copies || 1);
    // For synchronous stream representation, return document summary JSON
    return JSON.stringify({
      format: 'pdf',
      templateId: template.id,
      templateName: template.name,
      dimensions: template.dimensions,
      recordsCount: records.length,
      copies,
      generatedAt: new Date().toISOString(),
    }, null, 2);
  }

  public async generatePdfBlob(
    template: LabelTemplate,
    records: Record<string, string>[] = [{}],
    options?: PrinterStreamOptions
  ): Promise<Blob> {
    const { exportLabelsToPDF } = await import('../pdfExportService');
    const copies = Math.max(1, options?.copies || 1);
    return exportLabelsToPDF(template, records, copies);
  }

  public validateTemplate(template: LabelTemplate): string[] {
    const warnings: string[] = [];
    if (!template.elements || template.elements.length === 0) {
      warnings.push('Template contains no elements to print.');
    }
    return warnings;
  }
}
