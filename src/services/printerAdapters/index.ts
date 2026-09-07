import { LabelTemplate } from '../../types';
import { PrinterAdapter, PrinterCapabilities, PrinterStreamOptions } from './types';
import { ZplAdapter } from './zplAdapter';
import { TsplAdapter } from './tsplAdapter';
import { EplAdapter } from './eplAdapter';
import { EscPosAdapter } from './escPosAdapter';
import { PdfAdapter } from './pdfAdapter';
import { CpclAdapter } from './cpclAdapter';
import { SbplAdapter } from './sbplAdapter';

export * from './types';
export * from './zplAdapter';
export * from './tsplAdapter';
export * from './eplAdapter';
export * from './escPosAdapter';
export * from './pdfAdapter';
export * from './cpclAdapter';
export * from './sbplAdapter';

const adapters = new Map<string, PrinterAdapter>();

const defaultZpl = new ZplAdapter();
const defaultTspl = new TsplAdapter();
const defaultEpl = new EplAdapter();
const defaultEscPos = new EscPosAdapter();
const defaultPdf = new PdfAdapter();
const defaultCpcl = new CpclAdapter();
const defaultSbpl = new SbplAdapter();

adapters.set('zpl', defaultZpl);
adapters.set('tspl', defaultTspl);
adapters.set('epl', defaultEpl);
adapters.set('escpos', defaultEscPos);
adapters.set('pdf', defaultPdf);
adapters.set('cpcl', defaultCpcl);
adapters.set('sbpl', defaultSbpl);

export function registerAdapter(adapter: PrinterAdapter): void {
  adapters.set(adapter.language.toLowerCase(), adapter);
}

export function getPrinterAdapter(protocolOrLang: string = 'zpl'): PrinterAdapter {
  const key = (protocolOrLang || 'zpl').toLowerCase().trim();
  
  if (adapters.has(key)) {
    return adapters.get(key)!;
  }

  if (key.includes('zpl') || key.includes('zebra')) return defaultZpl;
  if (key.includes('tspl') || key.includes('tsc')) return defaultTspl;
  if (key.includes('epl') || key.includes('eltron')) return defaultEpl;
  if (key.includes('cpcl')) return defaultCpcl;
  if (key.includes('sbpl') || key.includes('sato')) return defaultSbpl;
  if (key.includes('esc') || key.includes('pos') || key.includes('receipt')) return defaultEscPos;
  if (key.includes('pdf') || key.includes('driver') || key.includes('windows')) return defaultPdf;

  // Safe fallback to PDF/Driver rendering rather than assuming ZPL
  return defaultPdf;
}

export function getAllAdapters(): PrinterAdapter[] {
  return Array.from(adapters.values());
}

export function getSupportedLanguages(): string[] {
  return Array.from(adapters.keys());
}

export function generatePrintStream(
  protocol: string,
  template: LabelTemplate,
  records: Record<string, string>[] = [{}],
  options?: PrinterStreamOptions
): string | Uint8Array {
  const adapter = getPrinterAdapter(protocol);
  return adapter.generateJobStream(template, records, options);
}
