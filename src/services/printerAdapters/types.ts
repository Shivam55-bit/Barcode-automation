import { LabelTemplate, DpiOption } from '../../types';

export interface PrinterCapabilities {
  language: 'zpl' | 'tspl' | 'epl' | 'escpos' | 'pdf';
  displayName: string;
  defaultPort: number;
  supportedDpi: DpiOption[];
  supports2DBarcodes: boolean;
  supportsShapes: boolean;
  supportsImages: boolean;
  supportsCutter: boolean;
  supportsDirectTcp: boolean;
}

export interface PrinterStreamOptions {
  dpi?: DpiOption;
  copies?: number;
  darkness?: number;
  speed?: number;
  cutAfterJob?: boolean;
}

export interface PrinterAdapter {
  id: string;
  name: string;
  language: 'zpl' | 'tspl' | 'epl' | 'escpos' | 'pdf';
  capabilities: PrinterCapabilities;
  generateJobStream(template: LabelTemplate, records: Record<string, string>[], options?: PrinterStreamOptions): string | Uint8Array;
  validateTemplate?(template: LabelTemplate): string[];
}
