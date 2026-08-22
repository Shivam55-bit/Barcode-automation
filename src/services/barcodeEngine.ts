import bwipjs from 'bwip-js';
import { BarcodeElement, BarcodeSymbology } from '../types';
import { evaluateElementData, EvaluationContext } from './dataSourceEngine';

export interface SymbologyMetadata {
  id: BarcodeSymbology;
  name: string;
  category: string;
  folderCategories: string[];
  bwipBcId: string;
  description: string;
  defaultSample: string;
  is2D: boolean;
  supportsGS1: boolean;
  validationRegex?: RegExp;
}

export const SYMBOLOGY_CATALOG: SymbologyMetadata[] = [
  // General Purpose & Primary BarTender Barcodes
  {
    id: 'code128',
    name: 'Code 128',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'All Symbologies'],
    bwipBcId: 'code128',
    description: 'High-density alphanumeric barcode supporting all 128 ASCII characters.',
    defaultSample: '12345678',
    is2D: false,
    supportsGS1: false,
  },
  {
    id: 'code39',
    name: 'Code 39',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'All Symbologies'],
    bwipBcId: 'code39',
    description: 'Widely used in automotive, defense, and industrial inventory systems.',
    defaultSample: '12345678',
    is2D: false,
    supportsGS1: false,
  },
  {
    id: 'code93',
    name: 'Code 93',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'All Symbologies'],
    bwipBcId: 'code93',
    description: 'Higher density variant of Code 39 with full ASCII capability.',
    defaultSample: '12345678',
    is2D: false,
    supportsGS1: false,
  },
  {
    id: 'datamatrix',
    name: 'Data Matrix',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'Disc / CD / DVD', 'Health Care', 'Pharmaceutical', 'All Symbologies'],
    bwipBcId: 'datamatrix',
    description: 'Compact 2D matrix code standard for electronics, direct part marking (DPM), and small parts.',
    defaultSample: '12345678',
    is2D: true,
    supportsGS1: false,
  },
  {
    id: 'qr',
    name: 'QR Code',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'Disc / CD / DVD', 'All Symbologies'],
    bwipBcId: 'qrcode',
    description: 'Quick Response 2D matrix code supporting URLs, text, and industrial tracking.',
    defaultSample: 'https://verify.industrial-label.com/12345678',
    is2D: true,
    supportsGS1: false,
  },
  {
    id: 'micro-qr',
    name: 'Micro QR Code',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'Disc / CD / DVD', 'All Symbologies'],
    bwipBcId: 'microqrcode',
    description: 'Miniaturized QR Code for very small electronics and hardware tags.',
    defaultSample: '12345678',
    is2D: true,
    supportsGS1: false,
  },
  {
    id: 'pdf417',
    name: 'PDF417',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'Postal / Shipping', 'All Symbologies'],
    bwipBcId: 'pdf417',
    description: 'High-capacity stacked 2D barcode standard for shipping, logistics, and government IDs.',
    defaultSample: '12345678',
    is2D: true,
    supportsGS1: false,
  },
  {
    id: 'pdf417-truncated',
    name: 'PDF417 Truncated',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'All Symbologies'],
    bwipBcId: 'pdf417compact',
    description: 'Compact version of PDF417 with reduced right stop pattern for space-constrained labels.',
    defaultSample: '12345678',
    is2D: true,
    supportsGS1: false,
  },
  {
    id: 'aztec',
    name: 'Aztec Code',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'Disc / CD / DVD', 'All Symbologies'],
    bwipBcId: 'azteccode',
    description: 'High-density matrix code with a central bullseye finder, widely used in ticketing.',
    defaultSample: 'TKT-AIR-992384-SEC',
    is2D: true,
    supportsGS1: false,
  },
  {
    id: 'maxicode',
    name: 'MaxiCode (UPS)',
    category: 'Postal / Shipping',
    folderCategories: ['Postal / Shipping', 'General Purpose', 'All Symbologies'],
    bwipBcId: 'maxicode',
    description: 'Fixed-size matrix code with hexagonal grid and concentric rings used by UPS for high-speed sorting.',
    defaultSample: '[)>01961234567898400011Z00004951UPSN06X61015912345671/1',
    is2D: true,
    supportsGS1: false,
  },
  {
    id: 'interleaved2of5',
    name: 'Interleaved 2 of 5',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'Postal / Shipping', 'All Symbologies'],
    bwipBcId: 'interleaved2of5',
    description: 'Continuous two-width barcode symbology encoding pairs of digits.',
    defaultSample: '12345678',
    is2D: false,
    supportsGS1: false,
    validationRegex: /^\d+$/,
  },
  {
    id: 'itf14',
    name: 'ITF-14',
    category: 'GS1 (by Symbology)',
    folderCategories: ['GS1 (by Symbology)', 'GS1 (by Application)', 'Postal / Shipping', 'All Symbologies'],
    bwipBcId: 'itf14',
    description: '14-digit carton & master case barcode with heavy bearer bars for corrugated cardboard.',
    defaultSample: '10012345678902',
    is2D: false,
    supportsGS1: true,
    validationRegex: /^\d{13,14}$/,
  },

  // Retail & Consumer
  {
    id: 'ean13',
    name: 'EAN-13',
    category: 'GS1 (by Symbology)',
    folderCategories: ['GS1 (by Symbology)', 'General Purpose', 'All Symbologies'],
    bwipBcId: 'ean13',
    description: 'International standard 13-digit product barcode used in retail worldwide.',
    defaultSample: '5901234123457',
    is2D: false,
    supportsGS1: true,
    validationRegex: /^\d{12,13}$/,
  },
  {
    id: 'ean8',
    name: 'EAN-8',
    category: 'GS1 (by Symbology)',
    folderCategories: ['GS1 (by Symbology)', 'General Purpose', 'All Symbologies'],
    bwipBcId: 'ean8',
    description: 'Compact 8-digit retail barcode for small packages and items.',
    defaultSample: '96385074',
    is2D: false,
    supportsGS1: true,
    validationRegex: /^\d{7,8}$/,
  },
  {
    id: 'upca',
    name: 'UPC-A',
    category: 'GS1 (by Symbology)',
    folderCategories: ['GS1 (by Symbology)', 'General Purpose', 'All Symbologies'],
    bwipBcId: 'upca',
    description: 'Standard 12-digit point-of-sale barcode used primarily in North America.',
    defaultSample: '012345678905',
    is2D: false,
    supportsGS1: true,
    validationRegex: /^\d{11,12}$/,
  },
  {
    id: 'upce',
    name: 'UPC-E',
    category: 'GS1 (by Symbology)',
    folderCategories: ['GS1 (by Symbology)', 'General Purpose', 'All Symbologies'],
    bwipBcId: 'upce',
    description: 'Zero-suppressed 8-digit version of UPC-A for small retail items.',
    defaultSample: '01234565',
    is2D: false,
    supportsGS1: true,
    validationRegex: /^\d{6,8}$/,
  },

  // GS1 Standards
  {
    id: 'gs1-128',
    name: 'GS1-128',
    category: 'GS1 (by Application)',
    folderCategories: ['GS1 (by Application)', 'GS1 (by Symbology)', 'Postal / Shipping', 'All Symbologies'],
    bwipBcId: 'gs1-128',
    description: 'Industry standard for shipping containers, pallets, and logistics with Application Identifiers.',
    defaultSample: '(01)00850006531233(17)261231(10)LOT456(21)SN9876',
    is2D: false,
    supportsGS1: true,
  },
  {
    id: 'gs1-datamatrix',
    name: 'GS1 DataMatrix',
    category: 'GS1 (by Application)',
    folderCategories: ['GS1 (by Application)', 'GS1 (by Symbology)', 'Health Care', 'Pharmaceutical', 'All Symbologies'],
    bwipBcId: 'gs1datamatrix',
    description: 'GS1 compliant 2D matrix code mandatory for FDA UDI medical devices and pharma serialization.',
    defaultSample: '(01)00850006531233(17)261231(10)LOT456(21)SN9876',
    is2D: true,
    supportsGS1: true,
  },
  {
    id: 'gs1-qr',
    name: 'GS1 QR Code',
    category: 'GS1 (by Application)',
    folderCategories: ['GS1 (by Application)', 'GS1 (by Symbology)', 'All Symbologies'],
    bwipBcId: 'gs1qrcode',
    description: 'GS1 2D barcode for consumer engagement and supply chain track and trace.',
    defaultSample: '(01)00850006531233(10)LOT123',
    is2D: true,
    supportsGS1: true,
  },
  {
    id: 'gs1-databar',
    name: 'GS1 DataBar Omnidirectional',
    category: 'GS1 (by Application)',
    folderCategories: ['GS1 (by Application)', 'GS1 (by Symbology)', 'All Symbologies'],
    bwipBcId: 'databarexpanded',
    description: 'GS1 barcode for fresh produce, coupons, and variable weight retail products.',
    defaultSample: '(01)00850006531233',
    is2D: false,
    supportsGS1: true,
  },

  // Health Care & Pharma
  {
    id: 'hibc-128',
    name: 'HIBC Code 128',
    category: 'Health Care',
    folderCategories: ['Health Care', 'All Symbologies'],
    bwipBcId: 'hibccode128',
    description: 'Health Industry Bar Code standard for medical equipment and supplies labeling.',
    defaultSample: '+A99912345/$$5261231LOT456',
    is2D: false,
    supportsGS1: false,
  },
  {
    id: 'hibc-datamatrix',
    name: 'HIBC DataMatrix',
    category: 'Health Care',
    folderCategories: ['Health Care', 'Pharmaceutical', 'All Symbologies'],
    bwipBcId: 'hibcdatamatrix',
    description: '2D HIBC matrix code for surgical instruments and sterile medical packaging.',
    defaultSample: '+A99912345/$$5261231LOT456',
    is2D: true,
    supportsGS1: false,
  },
  {
    id: 'pharmacode',
    name: 'Pharmacode',
    category: 'Pharmaceutical',
    folderCategories: ['Pharmaceutical', 'Health Care', 'All Symbologies'],
    bwipBcId: 'pharmacode',
    description: 'Binary barcode standard used in pharmaceutical packaging control.',
    defaultSample: '12345',
    is2D: false,
    supportsGS1: false,
    validationRegex: /^\d+$/,
  },

  // Patch Code
  {
    id: 'patchcode',
    name: 'Patch Code',
    category: 'Document Imaging',
    folderCategories: ['Document Imaging', 'All Symbologies'],
    bwipBcId: 'code39',
    description: 'Document separation and indexing barcode for production sheet scanners.',
    defaultSample: 'PATCH-T',
    is2D: false,
    supportsGS1: false,
  },

  // Postal & Shipping
  {
    id: 'usps-imb',
    name: 'USPS Intelligent Mail (IMb)',
    category: 'Postal / Shipping',
    folderCategories: ['Postal / Shipping', 'All Symbologies'],
    bwipBcId: 'onecode',
    description: 'US Postal Service 65-bar 4-state barcode sorting and tracking mailpieces.',
    defaultSample: '0123456709498765432101234567891',
    is2D: false,
    supportsGS1: false,
    validationRegex: /^\d{20,31}$/,
  },
  {
    id: 'royalmail',
    name: 'Royal Mail 4-State (RM4SCC)',
    category: 'Postal / Shipping',
    folderCategories: ['Postal / Shipping', 'All Symbologies'],
    bwipBcId: 'royalmail',
    description: 'UK Royal Mail Cleanmail barcode for automated letter sorting.',
    defaultSample: 'SN34RD1A',
    is2D: false,
    supportsGS1: false,
  },
  {
    id: 'codabar',
    name: 'Codabar (NW-7)',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'Health Care', 'All Symbologies'],
    bwipBcId: 'rationalizedCodabar',
    description: 'Self-checking barcode used in libraries, blood banks, and airbills.',
    defaultSample: 'A123456789B',
    is2D: false,
    supportsGS1: false,
  },
  {
    id: 'msi',
    name: 'MSI Plessey',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'All Symbologies'],
    bwipBcId: 'msi',
    description: 'Numeric barcode commonly used for warehouse shelf tagging.',
    defaultSample: '8052194',
    is2D: false,
    supportsGS1: false,
    validationRegex: /^\d+$/,
  },
  {
    id: 'telepen',
    name: 'Telepen',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'All Symbologies'],
    bwipBcId: 'telepen',
    description: 'Compact ASCII barcode with high data integrity.',
    defaultSample: 'TELEPEN123',
    is2D: false,
    supportsGS1: false,
  },
  {
    id: 'tlc39',
    name: 'TLC39 (Telecommunications)',
    category: 'TLC',
    folderCategories: ['TLC', 'All Symbologies'],
    bwipBcId: 'code39',
    description: 'TCIF Linked Code 39 composite barcode.',
    defaultSample: 'TLC39-EQUIP-8849',
    is2D: false,
    supportsGS1: false,
  },
  {
    id: 'posicode-b',
    name: 'PosiCode B',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'All Symbologies'],
    bwipBcId: 'posicode',
    description: 'PosiCode variant B for positional scanning in automated sorting.',
    defaultSample: '12345678',
    is2D: false,
    supportsGS1: false,
  },
  {
    id: 'posicode-a',
    name: 'PosiCode A',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'All Symbologies'],
    bwipBcId: 'posicode',
    description: 'PosiCode variant A with fixed length.',
    defaultSample: '12345678',
    is2D: false,
    supportsGS1: false,
  },
  {
    id: 'posicode-b',
    name: 'PosiCode B',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'All Symbologies'],
    bwipBcId: 'posicode',
    description: 'PosiCode variant B with variable length.',
    defaultSample: '12345678',
    is2D: false,
    supportsGS1: false,
  },
];

export function getSymbologyMetadata(symbology: BarcodeSymbology): SymbologyMetadata {
  return SYMBOLOGY_CATALOG.find(s => s.id === symbology) || SYMBOLOGY_CATALOG[0];
}

export function validateBarcodeValue(symbology: BarcodeSymbology, value: string): { valid: boolean; message?: string } {
  if (!value || !value.trim()) {
    return { valid: false, message: 'Barcode value cannot be empty' };
  }

  const meta = getSymbologyMetadata(symbology);
  if (meta.validationRegex && !meta.validationRegex.test(value)) {
    return { valid: false, message: `Value does not match required format for ${meta.name}` };
  }

  return { valid: true };
}

/**
 * Renders barcode to HTML Canvas element with high DPI scaling and BarTender formatting
 */
export async function renderBarcodeToCanvas(
  canvas: HTMLCanvasElement,
  element: BarcodeElement,
  scale: number = 2,
  ctxEval?: EvaluationContext
): Promise<void> {
  const meta = getSymbologyMetadata(element.symbology);
  const evaluatedValue = evaluateElementData(element, ctxEval) || element.value || meta.defaultSample;

  try {
    const is2D = meta.is2D;
    
    // bwip-js options
    const options: any = {
      bcid: meta.bwipBcId || 'code128',
      text: evaluatedValue || '12345678',
      scale: Math.max(1, Math.round(scale * (element.barWidth || 1.8))),
    };

    if (!is2D) {
      options.height = Math.max(8, Math.round((element.barHeight || 12) * 1.5));
      options.includetext = Boolean(element.includeText);
      options.textxalign = element.humanReadableAlignment || 'center';
      options.textyalign = element.textPosition === 'above' ? 'above' : 'below';

      if (element.humanReadableFontSize) {
        options.textsize = Math.max(6, Math.min(24, Math.round(element.humanReadableFontSize)));
      }
      if (element.humanReadableColor || element.foregroundColor) {
        const col = (element.humanReadableColor || element.foregroundColor || '#000000').replace('#', '');
        if (/^[0-9A-Fa-f]{6}$/.test(col)) {
          options.textcolor = col;
        }
      }
      if (element.humanReadableOffsetV) {
        options.textgap = Math.max(0, Math.round(element.humanReadableOffsetV));
      }
      if (element.humanReadableCustomFormat) {
        // e.g. "(01) {0}" format template
        options.alttext = element.humanReadableCustomFormat.replace('{0}', evaluatedValue);
      }
    }

    if (element.backgroundColor && element.backgroundColor !== 'transparent') {
      const bg = element.backgroundColor.replace('#', '');
      if (/^[0-9A-Fa-f]{6}$/.test(bg)) {
        options.backgroundcolor = bg;
      }
    }
    if (element.foregroundColor) {
      const fg = element.foregroundColor.replace('#', '');
      if (/^[0-9A-Fa-f]{6}$/.test(fg)) {
        options.barcolor = fg;
      }
    }

    if (element.errorCorrectionLevel && (element.symbology === 'qr' || element.symbology === 'aztec')) {
      options.eclevel = element.errorCorrectionLevel;
    }

    bwipjs.toCanvas(canvas, options);

    // If Bearer Bars are enabled (e.g. for ITF-14 or carton labels), draw top & bottom bearer borders
    if (element.bearerBars && !is2D) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = element.foregroundColor || '#000000';
        const barThick = (element.bearerBarThickness || 3) * scale;
        // Top bar
        ctx.fillRect(0, 0, canvas.width, barThick);
        // Bottom bar
        ctx.fillRect(0, canvas.height - barThick, canvas.width, barThick);
        if (element.bearerBarType === 'complete') {
          // Left & Right bars
          ctx.fillRect(0, 0, barThick, canvas.height);
          ctx.fillRect(canvas.width - barThick, 0, barThick, canvas.height);
        }
      }
    }
  } catch (err: any) {
    try {
      const fallbackOptions: any = {
        bcid: meta.bwipBcId || 'code128',
        text: meta.defaultSample,
        scale: Math.max(1, Math.round(scale * (element.barWidth || 1.8))),
      };
      if (!meta.is2D) {
        fallbackOptions.height = Math.max(8, Math.round((element.barHeight || 12) * 1.5));
        fallbackOptions.includetext = Boolean(element.includeText);
      }
      bwipjs.toCanvas(canvas, fallbackOptions);
    } catch {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fef2f2';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
        ctx.fillStyle = '#b91c1c';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(meta.name, canvas.width / 2, canvas.height / 2 - 8);
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#6b7280';
        ctx.fillText('Invalid Data Format', canvas.width / 2, canvas.height / 2 + 8);
      }
    }
  }
}

/**
 * Generates an SVG string representation of a barcode
 */
export function generateBarcodeSVG(element: BarcodeElement, ctxEval?: EvaluationContext): string {
  const meta = getSymbologyMetadata(element.symbology);
  const cleanValue = evaluateElementData(element, ctxEval) || element.value || meta.defaultSample;

  try {
    const is2D = meta.is2D;
    const opts: any = {
      bcid: meta.bwipBcId || 'code128',
      text: cleanValue,
      scale: Math.max(1, Math.round(element.barWidth || 2)),
    };

    if (!is2D) {
      opts.height = Math.max(10, Math.round(element.barHeight * 2));
      opts.includetext = Boolean(element.includeText);
      opts.textxalign = 'center';
    }

    if (element.foregroundColor) {
      const fg = element.foregroundColor.replace('#', '');
      if (/^[0-9A-Fa-f]{6}$/.test(fg)) {
        opts.barcolor = fg;
      }
    }

    return bwipjs.toSVG(opts);
  } catch (e) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><rect width="100%" height="100%" fill="#fef2f2"/><text x="50%" y="50%" text-anchor="middle" fill="#dc2626" font-size="10">Invalid Barcode</text></svg>`;
  }
}
