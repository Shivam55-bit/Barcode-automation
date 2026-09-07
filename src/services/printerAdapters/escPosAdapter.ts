import { LabelTemplate } from '../../types';
import { evaluateElementData } from '../dataSourceEngine';
import { PrinterAdapter, PrinterCapabilities, PrinterStreamOptions } from './types';

export class EscPosAdapter implements PrinterAdapter {
  public readonly id = 'escpos';
  public readonly name = 'Standard ESC/POS Thermal Protocol';
  public readonly language = 'escpos' as const;

  public readonly capabilities: PrinterCapabilities = {
    language: 'escpos',
    displayName: 'ESC/POS Thermal',
    defaultPort: 9100,
    supportedDpi: [203],
    supports2DBarcodes: true,
    supportsShapes: false,
    supportsImages: true,
    supportsCutter: true,
    supportsDirectTcp: true,
  };

  public generateJobStream(
    template: LabelTemplate,
    records: Record<string, string>[] = [{}],
    options?: PrinterStreamOptions
  ): Uint8Array {
    const copies = Math.max(1, options?.copies || 1);
    const recordsToPrint = records.length > 0 ? records : [{}];
    const byteChunks: number[] = [];

    // Helper: Push bytes
    const push = (...bytes: number[]) => {
      byteChunks.push(...bytes);
    };

    // Helper: Push string as UTF-8 / ASCII bytes
    const pushString = (str: string) => {
      const encoder = new TextEncoder();
      const encoded = encoder.encode(str);
      for (let i = 0; i < encoded.length; i++) {
        byteChunks.push(encoded[i]);
      }
    };

    for (let c = 0; c < copies; c++) {
      for (const record of recordsToPrint) {
        // Initialize printer: ESC @
        push(0x1b, 0x40);

        // Sort elements top-to-bottom for ESC/POS sequential paper feed
        const sorted = [...template.elements].sort((a, b) => a.y - b.y);

        for (const el of sorted) {
          if (!el.visible || el.printable === false) continue;

          // Alignment
          const align = (el as any).textAlign === 'center' ? 1 : (el as any).textAlign === 'right' ? 2 : 0;
          push(0x1b, 0x61, align);

          if (el.type === 'text') {
            const textEl = el as any;
            const txt = evaluateElementData(el, { record });
            // Bold if bold
            const isBold = textEl.fontWeight === 'bold' || textEl.fontWeight === '700' || (textEl.fontSize && textEl.fontSize > 16);
            push(0x1b, 0x45, isBold ? 1 : 0);

            // Double size if large font
            const isLarge = textEl.fontSize && textEl.fontSize >= 18;
            push(0x1d, 0x21, isLarge ? 0x11 : 0x00);

            pushString(txt);
            push(0x0a); // LF
          } else if (el.type === 'barcode') {
            const val = evaluateElementData(el, { record });
            if (el.symbology === 'qr' || el.symbology === 'gs1-qr' || el.symbology === 'micro-qr') {
              // ESC/POS QR Code sequence
              const qrData = new TextEncoder().encode(val);
              const pL = (qrData.length + 3) & 0xff;
              const pH = ((qrData.length + 3) >> 8) & 0xff;

              // Select Model 2
              push(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
              // Module size 4
              push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x04);
              // Error correction Level M
              push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x30);
              // Store QR data
              push(0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30);
              for (let b of qrData) push(b);
              // Print QR
              push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
              push(0x0a);
            } else {
              // 1D Barcode (Code 128 via GS k 73)
              const barcodeData = new TextEncoder().encode(val);
              const barHeight = Math.min(255, Math.max(30, Math.round((el.barHeight || el.height || 20) * 3)));
              push(0x1d, 0x68, barHeight); // GS h height
              push(0x1d, 0x77, 2); // GS w module width
              push(0x1d, 0x48, el.includeText ? 2 : 0); // GS H human readable below

              // GS k 73 (Code 128)
              push(0x1d, 0x6b, 73, barcodeData.length);
              for (let b of barcodeData) push(b);
              push(0x0a);
            }
          }
        }

        // Feed paper
        push(0x0a, 0x0a, 0x0a);

        // Cut paper if requested: GS V 66 0
        if (options?.cutAfterJob !== false) {
          push(0x1d, 0x56, 0x42, 0x00);
        }
      }
    }

    return new Uint8Array(byteChunks);
  }

  public validateTemplate(template: LabelTemplate): string[] {
    const warnings: string[] = [];
    if (!template.elements || template.elements.length === 0) {
      warnings.push('Template contains no elements to print.');
    }
    const hasShapes = template.elements.some((e) => e.type === 'shape');
    if (hasShapes) {
      warnings.push('ESC/POS receipt protocol does not natively draw vector shapes or borders.');
    }
    return warnings;
  }
}
