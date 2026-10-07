import { BarcodeSymbology } from '../types';

export type SymbologyCategory = '1d' | '2d' | 'postal' | 'gs1';

export interface BarcodeSymbologyDefinition {
  id: BarcodeSymbology;
  displayName: string;
  category: SymbologyCategory;
  bwipBcId: string;
  description: string;
  defaultSample: string;
  is2D: boolean;
  
  // Capability Flags
  supportsXDimension: boolean;
  supportsRatio: boolean;
  supportedRatios?: string[];
  supportsDensity: boolean;
  supportsHeight: boolean;
  supportsCheckDigit: boolean;
  checkDigitLocked?: boolean;
  supportsCodeSet: boolean;
  supportsGS1: boolean;
  supportsTextEncoding: boolean;
  supportsECI: boolean;
  supportsErrorCorrection: boolean;
  supportsHumanReadable: boolean;

  // Defaults
  defaultXDimensionMm: number;
  minXDimensionMm: number;
  maxXDimensionMm: number;
  defaultHeightMm: number;
  defaultRatio?: number;

  // Validation
  validationRegex?: RegExp;
  validate?: (data: string) => { valid: boolean; error?: string };
}

export const BARCODE_SYMBOLOGY_DEFINITIONS: BarcodeSymbologyDefinition[] = [
  // -------------------------------------------------------------
  // 1D LINEAR SYMBOLOGIES
  // -------------------------------------------------------------
  {
    id: 'code128',
    displayName: 'Code 128',
    category: '1d',
    bwipBcId: 'code128',
    description: 'High-density alphanumeric standard for inventory and logistics.',
    defaultSample: '12345678',
    is2D: false,
    supportsXDimension: true,
    supportsRatio: false,
    supportsDensity: true,
    supportsHeight: true,
    supportsCheckDigit: true,
    checkDigitLocked: true,
    supportsCodeSet: true,
    supportsGS1: true,
    supportsTextEncoding: true,
    supportsECI: false,
    supportsErrorCorrection: false,
    supportsHumanReadable: true,
    defaultXDimensionMm: 0.36,
    minXDimensionMm: 0.15,
    maxXDimensionMm: 2.5,
    defaultHeightMm: 12.7,
    validate: (data) => {
      if (!data) return { valid: false, error: 'Barcode data cannot be empty' };
      return { valid: true };
    },
  },
  {
    id: 'code39',
    displayName: 'Code 39',
    category: '1d',
    bwipBcId: 'code39',
    description: 'Standard alphanumeric symbology used in automotive and defense.',
    defaultSample: 'CODE39-TEST',
    is2D: false,
    supportsXDimension: true,
    supportsRatio: true,
    supportedRatios: ['Auto', '2.0:1', '2.1:1', '2.2:1', '2.5:1', '3.0:1'],
    supportsDensity: true,
    supportsHeight: true,
    supportsCheckDigit: true,
    checkDigitLocked: false,
    supportsCodeSet: false,
    supportsGS1: false,
    supportsTextEncoding: true,
    supportsECI: false,
    supportsErrorCorrection: false,
    supportsHumanReadable: true,
    defaultXDimensionMm: 0.38,
    minXDimensionMm: 0.19,
    maxXDimensionMm: 3.0,
    defaultHeightMm: 15.0,
    validationRegex: /^[0-9A-Z\-\.\ \$\/\+\%]*$/,
    validate: (data) => {
      if (!data) return { valid: false, error: 'Barcode data cannot be empty' };
      if (!/^[0-9A-Z\-\.\ \$\/\+\%]*$/i.test(data)) {
        return { valid: false, error: 'Code 39 only supports uppercase alphanumeric and - . $ / + % characters' };
      }
      return { valid: true };
    },
  },
  {
    id: 'code93',
    displayName: 'Code 93',
    category: '1d',
    bwipBcId: 'code93',
    description: 'Higher density alphanumeric symbology with full ASCII capability.',
    defaultSample: 'CODE93-DATA',
    is2D: false,
    supportsXDimension: true,
    supportsRatio: false,
    supportsDensity: true,
    supportsHeight: true,
    supportsCheckDigit: true,
    checkDigitLocked: true,
    supportsCodeSet: false,
    supportsGS1: false,
    supportsTextEncoding: true,
    supportsECI: false,
    supportsErrorCorrection: false,
    supportsHumanReadable: true,
    defaultXDimensionMm: 0.36,
    minXDimensionMm: 0.18,
    maxXDimensionMm: 2.5,
    defaultHeightMm: 12.7,
    validate: (data) => {
      if (!data) return { valid: false, error: 'Barcode data cannot be empty' };
      return { valid: true };
    },
  },
  {
    id: 'codabar',
    displayName: 'Codabar',
    category: '1d',
    bwipBcId: 'rationalizedCodabar',
    description: 'Numeric symbology widely used in blood banks and libraries.',
    defaultSample: 'A12345678B',
    is2D: false,
    supportsXDimension: true,
    supportsRatio: true,
    supportedRatios: ['Auto', '2.0:1', '2.5:1', '3.0:1'],
    supportsDensity: true,
    supportsHeight: true,
    supportsCheckDigit: true,
    checkDigitLocked: false,
    supportsCodeSet: false,
    supportsGS1: false,
    supportsTextEncoding: false,
    supportsECI: false,
    supportsErrorCorrection: false,
    supportsHumanReadable: true,
    defaultXDimensionMm: 0.38,
    minXDimensionMm: 0.18,
    maxXDimensionMm: 2.5,
    defaultHeightMm: 12.7,
    validate: (data) => {
      if (!data) return { valid: false, error: 'Codabar data cannot be empty' };
      if (!/^[A-D][0-9\-\$\:\/\.\+]+[A-D]$/i.test(data)) {
        return { valid: false, error: 'Codabar requires start/stop characters (A, B, C, or D) and numeric content' };
      }
      return { valid: true };
    },
  },
  {
    id: 'ean13',
    displayName: 'EAN/JAN-13',
    category: '1d',
    bwipBcId: 'ean13',
    description: 'Standard 13-digit retail barcode across Europe and International commerce.',
    defaultSample: '8901030382914',
    is2D: false,
    supportsXDimension: true,
    supportsRatio: false,
    supportsDensity: true,
    supportsHeight: true,
    supportsCheckDigit: true,
    checkDigitLocked: true,
    supportsCodeSet: false,
    supportsGS1: true,
    supportsTextEncoding: false,
    supportsECI: false,
    supportsErrorCorrection: false,
    supportsHumanReadable: true,
    defaultXDimensionMm: 0.33,
    minXDimensionMm: 0.26,
    maxXDimensionMm: 0.66,
    defaultHeightMm: 22.85,
    validate: (data) => {
      const clean = data.replace(/[^0-9]/g, '');
      if (clean.length !== 12 && clean.length !== 13) {
        return { valid: false, error: 'EAN-13 requires exactly 12 or 13 numeric digits' };
      }
      return { valid: true };
    },
  },
  {
    id: 'ean8',
    displayName: 'EAN/JAN-8',
    category: '1d',
    bwipBcId: 'ean8',
    description: 'Compact 8-digit retail barcode for small packages.',
    defaultSample: '96385074',
    is2D: false,
    supportsXDimension: true,
    supportsRatio: false,
    supportsDensity: true,
    supportsHeight: true,
    supportsCheckDigit: true,
    checkDigitLocked: true,
    supportsCodeSet: false,
    supportsGS1: true,
    supportsTextEncoding: false,
    supportsECI: false,
    supportsErrorCorrection: false,
    supportsHumanReadable: true,
    defaultXDimensionMm: 0.33,
    minXDimensionMm: 0.26,
    maxXDimensionMm: 0.66,
    defaultHeightMm: 18.23,
    validate: (data) => {
      const clean = data.replace(/[^0-9]/g, '');
      if (clean.length !== 7 && clean.length !== 8) {
        return { valid: false, error: 'EAN-8 requires exactly 7 or 8 numeric digits' };
      }
      return { valid: true };
    },
  },
  {
    id: 'upca',
    displayName: 'UPC-A',
    category: '1d',
    bwipBcId: 'upca',
    description: 'Standard 12-digit retail barcode standard across North America.',
    defaultSample: '012345678905',
    is2D: false,
    supportsXDimension: true,
    supportsRatio: false,
    supportsDensity: true,
    supportsHeight: true,
    supportsCheckDigit: true,
    checkDigitLocked: true,
    supportsCodeSet: false,
    supportsGS1: true,
    supportsTextEncoding: false,
    supportsECI: false,
    supportsErrorCorrection: false,
    supportsHumanReadable: true,
    defaultXDimensionMm: 0.33,
    minXDimensionMm: 0.26,
    maxXDimensionMm: 0.66,
    defaultHeightMm: 22.85,
    validate: (data) => {
      const clean = data.replace(/[^0-9]/g, '');
      if (clean.length !== 11 && clean.length !== 12) {
        return { valid: false, error: 'UPC-A requires exactly 11 or 12 numeric digits' };
      }
      return { valid: true };
    },
  },
  {
    id: 'upce',
    displayName: 'UPC-E',
    category: '1d',
    bwipBcId: 'upce',
    description: 'Zero-suppressed 8-digit compact variant of UPC-A for small retail items.',
    defaultSample: '01234565',
    is2D: false,
    supportsXDimension: true,
    supportsRatio: false,
    supportsDensity: true,
    supportsHeight: true,
    supportsCheckDigit: true,
    checkDigitLocked: true,
    supportsCodeSet: false,
    supportsGS1: true,
    supportsTextEncoding: false,
    supportsECI: false,
    supportsErrorCorrection: false,
    supportsHumanReadable: true,
    defaultXDimensionMm: 0.33,
    minXDimensionMm: 0.26,
    maxXDimensionMm: 0.66,
    defaultHeightMm: 18.23,
    validate: (data) => {
      const clean = data.replace(/[^0-9]/g, '');
      if (clean.length < 6 || clean.length > 8) {
        return { valid: false, error: 'UPC-E requires 6, 7, or 8 numeric digits' };
      }
      return { valid: true };
    },
  },
  {
    id: 'itf14',
    displayName: 'ITF-14',
    category: '1d',
    bwipBcId: 'itf14',
    description: '14-digit master carton and case barcode with bearer bars.',
    defaultSample: '10012345678902',
    is2D: false,
    supportsXDimension: true,
    supportsRatio: true,
    supportedRatios: ['Auto', '2.0:1', '2.5:1', '3.0:1'],
    supportsDensity: true,
    supportsHeight: true,
    supportsCheckDigit: true,
    checkDigitLocked: true,
    supportsCodeSet: false,
    supportsGS1: true,
    supportsTextEncoding: false,
    supportsECI: false,
    supportsErrorCorrection: false,
    supportsHumanReadable: true,
    defaultXDimensionMm: 0.50,
    minXDimensionMm: 0.25,
    maxXDimensionMm: 1.02,
    defaultHeightMm: 31.75,
    validate: (data) => {
      const clean = data.replace(/[^0-9]/g, '');
      if (clean.length !== 13 && clean.length !== 14) {
        return { valid: false, error: 'ITF-14 requires 13 or 14 numeric digits' };
      }
      return { valid: true };
    },
  },
  {
    id: 'interleaved2of5',
    displayName: 'Interleaved 2-of-5',
    category: '1d',
    bwipBcId: 'interleaved2of5',
    description: 'Continuous numeric symbology encoding pairs of digits.',
    defaultSample: '12345678',
    is2D: false,
    supportsXDimension: true,
    supportsRatio: true,
    supportedRatios: ['Auto', '2.0:1', '2.5:1', '3.0:1'],
    supportsDensity: true,
    supportsHeight: true,
    supportsCheckDigit: true,
    checkDigitLocked: false,
    supportsCodeSet: false,
    supportsGS1: false,
    supportsTextEncoding: false,
    supportsECI: false,
    supportsErrorCorrection: false,
    supportsHumanReadable: true,
    defaultXDimensionMm: 0.38,
    minXDimensionMm: 0.20,
    maxXDimensionMm: 2.0,
    defaultHeightMm: 15.0,
    validate: (data) => {
      if (!/^\d+$/.test(data)) {
        return { valid: false, error: 'Interleaved 2-of-5 requires numeric digits only' };
      }
      if (data.length % 2 !== 0) {
        return { valid: false, error: 'Interleaved 2-of-5 requires an even number of digits' };
      }
      return { valid: true };
    },
  },
  {
    id: 'industrial2of5',
    displayName: 'Industrial 2-of-5',
    category: '1d',
    bwipBcId: 'industrial2of5',
    description: 'Discrete numeric 2-of-5 variant for industrial applications.',
    defaultSample: '12345678',
    is2D: false,
    supportsXDimension: true,
    supportsRatio: true,
    supportedRatios: ['Auto', '2.0:1', '2.5:1', '3.0:1'],
    supportsDensity: true,
    supportsHeight: true,
    supportsCheckDigit: true,
    checkDigitLocked: false,
    supportsCodeSet: false,
    supportsGS1: false,
    supportsTextEncoding: false,
    supportsECI: false,
    supportsErrorCorrection: false,
    supportsHumanReadable: true,
    defaultXDimensionMm: 0.38,
    minXDimensionMm: 0.20,
    maxXDimensionMm: 2.0,
    defaultHeightMm: 15.0,
    validate: (data) => {
      if (!/^\d+$/.test(data)) return { valid: false, error: 'Numeric digits only' };
      return { valid: true };
    },
  },
  {
    id: 'msi',
    displayName: 'MSI Plessey',
    category: '1d',
    bwipBcId: 'msi',
    description: 'Modified Plessey barcode used in retail shelf labeling and warehousing.',
    defaultSample: '12345678',
    is2D: false,
    supportsXDimension: true,
    supportsRatio: true,
    supportedRatios: ['Auto', '2.0:1', '2.5:1'],
    supportsDensity: true,
    supportsHeight: true,
    supportsCheckDigit: true,
    checkDigitLocked: false,
    supportsCodeSet: false,
    supportsGS1: false,
    supportsTextEncoding: false,
    supportsECI: false,
    supportsErrorCorrection: false,
    supportsHumanReadable: true,
    defaultXDimensionMm: 0.38,
    minXDimensionMm: 0.20,
    maxXDimensionMm: 2.0,
    defaultHeightMm: 15.0,
    validate: (data) => {
      if (!/^\d+$/.test(data)) return { valid: false, error: 'MSI Plessey requires numeric digits' };
      return { valid: true };
    },
  },
  {
    id: 'gs1-128',
    displayName: 'GS1-128',
    category: 'gs1',
    bwipBcId: 'gs1-128',
    description: 'GS1 Application Identifier carrier standard for global supply chains.',
    defaultSample: '(01)00012345678905(10)ABC1234',
    is2D: false,
    supportsXDimension: true,
    supportsRatio: false,
    supportsDensity: true,
    supportsHeight: true,
    supportsCheckDigit: true,
    checkDigitLocked: true,
    supportsCodeSet: true,
    supportsGS1: true,
    supportsTextEncoding: true,
    supportsECI: false,
    supportsErrorCorrection: false,
    supportsHumanReadable: true,
    defaultXDimensionMm: 0.495,
    minXDimensionMm: 0.25,
    maxXDimensionMm: 1.016,
    defaultHeightMm: 31.75,
    validate: (data) => {
      if (!data) return { valid: false, error: 'GS1-128 data cannot be empty' };
      return { valid: true };
    },
  },
  {
    id: 'gs1-databar',
    displayName: 'GS1 DataBar (RSS)',
    category: 'gs1',
    bwipBcId: 'databarexpanded',
    description: 'GS1 DataBar for fresh foods and healthcare item-level serialization.',
    defaultSample: '(01)90012345678908(3103)000500',
    is2D: false,
    supportsXDimension: true,
    supportsRatio: false,
    supportsDensity: true,
    supportsHeight: true,
    supportsCheckDigit: true,
    checkDigitLocked: true,
    supportsCodeSet: false,
    supportsGS1: true,
    supportsTextEncoding: true,
    supportsECI: false,
    supportsErrorCorrection: false,
    supportsHumanReadable: true,
    defaultXDimensionMm: 0.33,
    minXDimensionMm: 0.25,
    maxXDimensionMm: 1.0,
    defaultHeightMm: 13.0,
    validate: (data) => {
      if (!data) return { valid: false, error: 'GS1 DataBar data cannot be empty' };
      return { valid: true };
    },
  },

  // -------------------------------------------------------------
  // 2D MATRIX & STACKED SYMBOLOGIES
  // -------------------------------------------------------------
  {
    id: 'qr',
    displayName: 'QR Code',
    category: '2d',
    bwipBcId: 'qrcode',
    description: 'Quick Response 2D matrix code for URLs, industrial tagging, and traceability.',
    defaultSample: 'https://verify.industrial-label.com/12345678',
    is2D: true,
    supportsXDimension: true,
    supportsRatio: false,
    supportsDensity: false,
    supportsHeight: false,
    supportsCheckDigit: false,
    supportsCodeSet: false,
    supportsGS1: false,
    supportsTextEncoding: true,
    supportsECI: true,
    supportsErrorCorrection: true,
    supportsHumanReadable: false,
    defaultXDimensionMm: 0.50,
    minXDimensionMm: 0.25,
    maxXDimensionMm: 5.0,
    defaultHeightMm: 25.0,
    validate: (data) => {
      if (!data) return { valid: false, error: 'QR Code data cannot be empty' };
      return { valid: true };
    },
  },
  {
    id: 'micro-qr',
    displayName: 'Micro QR Code',
    category: '2d',
    bwipBcId: 'microqrcode',
    description: 'Miniaturized QR Code for very small electronics and hardware components.',
    defaultSample: 'MQR-12345',
    is2D: true,
    supportsXDimension: true,
    supportsRatio: false,
    supportsDensity: false,
    supportsHeight: false,
    supportsCheckDigit: false,
    supportsCodeSet: false,
    supportsGS1: false,
    supportsTextEncoding: true,
    supportsECI: false,
    supportsErrorCorrection: true,
    supportsHumanReadable: false,
    defaultXDimensionMm: 0.50,
    minXDimensionMm: 0.25,
    maxXDimensionMm: 3.0,
    defaultHeightMm: 15.0,
    validate: (data) => {
      if (!data) return { valid: false, error: 'Micro QR data cannot be empty' };
      return { valid: true };
    },
  },
  {
    id: 'datamatrix',
    displayName: 'Data Matrix',
    category: '2d',
    bwipBcId: 'datamatrix',
    description: 'Compact 2D matrix code standard for electronics, pharma, and aerospace direct part marking.',
    defaultSample: '12345678',
    is2D: true,
    supportsXDimension: true,
    supportsRatio: false,
    supportsDensity: false,
    supportsHeight: false,
    supportsCheckDigit: false,
    supportsCodeSet: false,
    supportsGS1: false,
    supportsTextEncoding: true,
    supportsECI: true,
    supportsErrorCorrection: false,
    supportsHumanReadable: false,
    defaultXDimensionMm: 0.40,
    minXDimensionMm: 0.20,
    maxXDimensionMm: 5.0,
    defaultHeightMm: 20.0,
    validate: (data) => {
      if (!data) return { valid: false, error: 'Data Matrix data cannot be empty' };
      return { valid: true };
    },
  },
  {
    id: 'gs1-datamatrix',
    displayName: 'GS1 DataMatrix',
    category: 'gs1',
    bwipBcId: 'gs1datamatrix',
    description: 'GS1-standard Data Matrix carrier for pharmaceutical UDI and healthcare traceability.',
    defaultSample: '(01)00012345678905(17)261231(10)BATCH999',
    is2D: true,
    supportsXDimension: true,
    supportsRatio: false,
    supportsDensity: false,
    supportsHeight: false,
    supportsCheckDigit: true,
    checkDigitLocked: true,
    supportsCodeSet: false,
    supportsGS1: true,
    supportsTextEncoding: true,
    supportsECI: false,
    supportsErrorCorrection: false,
    supportsHumanReadable: true,
    defaultXDimensionMm: 0.40,
    minXDimensionMm: 0.20,
    maxXDimensionMm: 4.0,
    defaultHeightMm: 20.0,
    validate: (data) => {
      if (!data) return { valid: false, error: 'GS1 DataMatrix data cannot be empty' };
      return { valid: true };
    },
  },
  {
    id: 'pdf417',
    displayName: 'PDF417',
    category: '2d',
    bwipBcId: 'pdf417',
    description: 'High-capacity stacked 2D barcode for shipping labels, boarding passes, and government IDs.',
    defaultSample: 'PDF417-HIGH-CAPACITY-DOCUMENT-123456',
    is2D: true,
    supportsXDimension: true,
    supportsRatio: true,
    supportedRatios: ['Auto', '2.0:1', '3.0:1', '4.0:1'],
    supportsDensity: false,
    supportsHeight: true,
    supportsCheckDigit: false,
    supportsCodeSet: false,
    supportsGS1: false,
    supportsTextEncoding: true,
    supportsECI: false,
    supportsErrorCorrection: true,
    supportsHumanReadable: false,
    defaultXDimensionMm: 0.33,
    minXDimensionMm: 0.18,
    maxXDimensionMm: 1.5,
    defaultHeightMm: 25.0,
    validate: (data) => {
      if (!data) return { valid: false, error: 'PDF417 data cannot be empty' };
      return { valid: true };
    },
  },
  {
    id: 'micropdf417',
    displayName: 'MicroPDF417',
    category: '2d',
    bwipBcId: 'micropdf417',
    description: 'Compact 2D stacked symbology designed for tight spaces.',
    defaultSample: 'MPDF-12345',
    is2D: true,
    supportsXDimension: true,
    supportsRatio: false,
    supportsDensity: false,
    supportsHeight: true,
    supportsCheckDigit: false,
    supportsCodeSet: false,
    supportsGS1: false,
    supportsTextEncoding: true,
    supportsECI: false,
    supportsErrorCorrection: true,
    supportsHumanReadable: false,
    defaultXDimensionMm: 0.30,
    minXDimensionMm: 0.18,
    maxXDimensionMm: 1.5,
    defaultHeightMm: 15.0,
    validate: (data) => {
      if (!data) return { valid: false, error: 'MicroPDF417 data cannot be empty' };
      return { valid: true };
    },
  },
  {
    id: 'aztec',
    displayName: 'Aztec Code',
    category: '2d',
    bwipBcId: 'azteccode',
    description: 'High-density 2D matrix code with bullseye finder used in transportation and ticketing.',
    defaultSample: 'AZTEC-TKT-998822',
    is2D: true,
    supportsXDimension: true,
    supportsRatio: false,
    supportsDensity: false,
    supportsHeight: false,
    supportsCheckDigit: false,
    supportsCodeSet: false,
    supportsGS1: false,
    supportsTextEncoding: true,
    supportsECI: true,
    supportsErrorCorrection: true,
    supportsHumanReadable: false,
    defaultXDimensionMm: 0.50,
    minXDimensionMm: 0.25,
    maxXDimensionMm: 5.0,
    defaultHeightMm: 25.0,
    validate: (data) => {
      if (!data) return { valid: false, error: 'Aztec data cannot be empty' };
      return { valid: true };
    },
  },
  {
    id: 'maxicode',
    displayName: 'MaxiCode',
    category: '2d',
    bwipBcId: 'maxicode',
    description: 'Fixed-size matrix barcode with bullseye rings utilized by UPS shipping.',
    defaultSample: '[)>01961234567898400011Z00004951UPSN06X61015912345671/1',
    is2D: true,
    supportsXDimension: false,
    supportsRatio: false,
    supportsDensity: false,
    supportsHeight: false,
    supportsCheckDigit: false,
    supportsCodeSet: false,
    supportsGS1: false,
    supportsTextEncoding: true,
    supportsECI: false,
    supportsErrorCorrection: false,
    supportsHumanReadable: false,
    defaultXDimensionMm: 1.0,
    minXDimensionMm: 1.0,
    maxXDimensionMm: 1.0,
    defaultHeightMm: 25.4,
    validate: (data) => {
      if (!data) return { valid: false, error: 'MaxiCode data cannot be empty' };
      return { valid: true };
    },
  },
  {
    id: 'dotcode',
    displayName: 'DotCode',
    category: '2d',
    bwipBcId: 'dotcode',
    description: '2D matrix of isolated dots designed for high-speed industrial inkjet and laser marking.',
    defaultSample: 'DOTCODE-123456',
    is2D: true,
    supportsXDimension: true,
    supportsRatio: false,
    supportsDensity: false,
    supportsHeight: false,
    supportsCheckDigit: false,
    supportsCodeSet: false,
    supportsGS1: false,
    supportsTextEncoding: true,
    supportsECI: false,
    supportsErrorCorrection: false,
    supportsHumanReadable: false,
    defaultXDimensionMm: 0.50,
    minXDimensionMm: 0.25,
    maxXDimensionMm: 3.0,
    defaultHeightMm: 20.0,
    validate: (data) => {
      if (!data) return { valid: false, error: 'DotCode data cannot be empty' };
      return { valid: true };
    },
  },
  {
    id: 'hanxin',
    displayName: 'Han Xin Code',
    category: '2d',
    bwipBcId: 'hanxin',
    description: 'Chinese 2D matrix symbology optimized for Chinese characters and digits.',
    defaultSample: 'HX-12345678',
    is2D: true,
    supportsXDimension: true,
    supportsRatio: false,
    supportsDensity: false,
    supportsHeight: false,
    supportsCheckDigit: false,
    supportsCodeSet: false,
    supportsGS1: false,
    supportsTextEncoding: true,
    supportsECI: false,
    supportsErrorCorrection: true,
    supportsHumanReadable: false,
    defaultXDimensionMm: 0.50,
    minXDimensionMm: 0.25,
    maxXDimensionMm: 4.0,
    defaultHeightMm: 25.0,
    validate: (data) => {
      if (!data) return { valid: false, error: 'Han Xin data cannot be empty' };
      return { valid: true };
    },
  },

  // -------------------------------------------------------------
  // POSTAL SYMBOLOGIES
  // -------------------------------------------------------------
  {
    id: 'usps-imb',
    displayName: 'USPS Intelligent Mail Barcode',
    category: 'postal',
    bwipBcId: 'onecode',
    description: '4-state postal barcode standard used by the United States Postal Service.',
    defaultSample: '0123456709498765432101234567891',
    is2D: false,
    supportsXDimension: true,
    supportsRatio: false,
    supportsDensity: false,
    supportsHeight: true,
    supportsCheckDigit: true,
    checkDigitLocked: true,
    supportsCodeSet: false,
    supportsGS1: false,
    supportsTextEncoding: false,
    supportsECI: false,
    supportsErrorCorrection: false,
    supportsHumanReadable: false,
    defaultXDimensionMm: 0.508,
    minXDimensionMm: 0.38,
    maxXDimensionMm: 0.65,
    defaultHeightMm: 4.0,
    validate: (data) => {
      const clean = data.replace(/[^0-9]/g, '');
      if (clean.length !== 20 && clean.length !== 25 && clean.length !== 29 && clean.length !== 31) {
        return { valid: false, error: 'USPS Intelligent Mail requires 20, 25, 29, or 31 numeric digits' };
      }
      return { valid: true };
    },
  },
  {
    id: 'royalmail',
    displayName: 'Royal Mail 4-State Customer Code',
    category: 'postal',
    bwipBcId: 'royalmail',
    description: 'UK Royal Mail 4-state barcode (RM4SCC) for automated mail sorting.',
    defaultSample: 'SN34RD1A',
    is2D: false,
    supportsXDimension: true,
    supportsRatio: false,
    supportsDensity: false,
    supportsHeight: true,
    supportsCheckDigit: true,
    checkDigitLocked: true,
    supportsCodeSet: false,
    supportsGS1: false,
    supportsTextEncoding: false,
    supportsECI: false,
    supportsErrorCorrection: false,
    supportsHumanReadable: false,
    defaultXDimensionMm: 0.50,
    minXDimensionMm: 0.38,
    maxXDimensionMm: 0.65,
    defaultHeightMm: 5.0,
    validate: (data) => {
      if (!/^[0-9A-Z]+$/i.test(data)) {
        return { valid: false, error: 'Royal Mail barcode requires alphanumeric characters' };
      }
      return { valid: true };
    },
  },
  {
    id: 'planet',
    displayName: 'Planet',
    category: 'postal',
    bwipBcId: 'planet',
    description: 'USPS PLANET barcode for mail tracking and delivery confirmation.',
    defaultSample: '401234567891',
    is2D: false,
    supportsXDimension: true,
    supportsRatio: false,
    supportsDensity: false,
    supportsHeight: true,
    supportsCheckDigit: true,
    checkDigitLocked: true,
    supportsCodeSet: false,
    supportsGS1: false,
    supportsTextEncoding: false,
    supportsECI: false,
    supportsErrorCorrection: false,
    supportsHumanReadable: false,
    defaultXDimensionMm: 0.50,
    minXDimensionMm: 0.40,
    maxXDimensionMm: 0.65,
    defaultHeightMm: 4.5,
    validate: (data) => {
      const clean = data.replace(/[^0-9]/g, '');
      if (clean.length !== 11 && clean.length !== 13) {
        return { valid: false, error: 'Planet barcode requires 11 or 13 numeric digits' };
      }
      return { valid: true };
    },
  },
  {
    id: 'postnet',
    displayName: 'POSTNET',
    category: 'postal',
    bwipBcId: 'postnet',
    description: 'USPS POSTNET barcode for ZIP code routing.',
    defaultSample: '12345678901',
    is2D: false,
    supportsXDimension: true,
    supportsRatio: false,
    supportsDensity: false,
    supportsHeight: true,
    supportsCheckDigit: true,
    checkDigitLocked: true,
    supportsCodeSet: false,
    supportsGS1: false,
    supportsTextEncoding: false,
    supportsECI: false,
    supportsErrorCorrection: false,
    supportsHumanReadable: false,
    defaultXDimensionMm: 0.50,
    minXDimensionMm: 0.40,
    maxXDimensionMm: 0.65,
    defaultHeightMm: 4.5,
    validate: (data) => {
      const clean = data.replace(/[^0-9]/g, '');
      if (clean.length !== 5 && clean.length !== 9 && clean.length !== 11) {
        return { valid: false, error: 'POSTNET requires 5, 9, or 11 digits' };
      }
      return { valid: true };
    },
  },
  {
    id: 'japanpost',
    displayName: 'Japanese Post 4-State Customer Code',
    category: 'postal',
    bwipBcId: 'japanpost',
    description: 'Japan Post 4-state customer barcode for postal sorting.',
    defaultSample: '12345678901234',
    is2D: false,
    supportsXDimension: true,
    supportsRatio: false,
    supportsDensity: false,
    supportsHeight: true,
    supportsCheckDigit: true,
    checkDigitLocked: true,
    supportsCodeSet: false,
    supportsGS1: false,
    supportsTextEncoding: false,
    supportsECI: false,
    supportsErrorCorrection: false,
    supportsHumanReadable: false,
    defaultXDimensionMm: 0.50,
    minXDimensionMm: 0.38,
    maxXDimensionMm: 0.65,
    defaultHeightMm: 5.0,
    validate: (data) => {
      if (!data) return { valid: false, error: 'Japan Post data cannot be empty' };
      return { valid: true };
    },
  },
  {
    id: 'koreapost',
    displayName: 'Korea Post',
    category: 'postal',
    bwipBcId: 'koreapost',
    description: 'Korea Post postal barcode.',
    defaultSample: '123456',
    is2D: false,
    supportsXDimension: true,
    supportsRatio: false,
    supportsDensity: false,
    supportsHeight: true,
    supportsCheckDigit: true,
    checkDigitLocked: true,
    supportsCodeSet: false,
    supportsGS1: false,
    supportsTextEncoding: false,
    supportsECI: false,
    supportsErrorCorrection: false,
    supportsHumanReadable: false,
    defaultXDimensionMm: 0.50,
    minXDimensionMm: 0.38,
    maxXDimensionMm: 0.65,
    defaultHeightMm: 5.0,
    validate: (data) => {
      const clean = data.replace(/[^0-9]/g, '');
      if (clean.length !== 6) return { valid: false, error: 'Korea Post requires 6 numeric digits' };
      return { valid: true };
    },
  },
  {
    id: 'kix',
    displayName: 'KIX 4-State Customer Code',
    category: 'postal',
    bwipBcId: 'kix',
    description: 'Royal TNT Post / PostNL KIX 4-state barcode.',
    defaultSample: '1231AB123X',
    is2D: false,
    supportsXDimension: true,
    supportsRatio: false,
    supportsDensity: false,
    supportsHeight: true,
    supportsCheckDigit: true,
    checkDigitLocked: true,
    supportsCodeSet: false,
    supportsGS1: false,
    supportsTextEncoding: false,
    supportsECI: false,
    supportsErrorCorrection: false,
    supportsHumanReadable: false,
    defaultXDimensionMm: 0.50,
    minXDimensionMm: 0.38,
    maxXDimensionMm: 0.65,
    defaultHeightMm: 5.0,
    validate: (data) => {
      if (!data) return { valid: false, error: 'KIX data cannot be empty' };
      return { valid: true };
    },
  },
  {
    id: 'datalogic2of5',
    displayName: 'Datalogic 2-of-5 (China Post)',
    category: 'postal',
    bwipBcId: 'datalogic2of5',
    description: 'China Post standard barcode based on Datalogic 2-of-5.',
    defaultSample: '12345678',
    is2D: false,
    supportsXDimension: true,
    supportsRatio: true,
    supportedRatios: ['Auto', '2.0:1', '2.5:1', '3.0:1'],
    supportsDensity: true,
    supportsHeight: true,
    supportsCheckDigit: true,
    checkDigitLocked: false,
    supportsCodeSet: false,
    supportsGS1: false,
    supportsTextEncoding: false,
    supportsECI: false,
    supportsErrorCorrection: false,
    supportsHumanReadable: true,
    defaultXDimensionMm: 0.38,
    minXDimensionMm: 0.20,
    maxXDimensionMm: 2.0,
    defaultHeightMm: 15.0,
    validate: (data) => {
      if (!/^\d+$/.test(data)) return { valid: false, error: 'China Post requires numeric digits only' };
      return { valid: true };
    },
  },
  {
    id: 'deutschepost-identcode',
    displayName: 'Deutsche Post Identcode',
    category: 'postal',
    bwipBcId: 'identcode',
    description: 'DHL / Deutsche Post 12-digit parcel identification barcode.',
    defaultSample: '123456789012',
    is2D: false,
    supportsXDimension: true,
    supportsRatio: false,
    supportsDensity: true,
    supportsHeight: true,
    supportsCheckDigit: true,
    checkDigitLocked: true,
    supportsCodeSet: false,
    supportsGS1: false,
    supportsTextEncoding: false,
    supportsECI: false,
    supportsErrorCorrection: false,
    supportsHumanReadable: true,
    defaultXDimensionMm: 0.40,
    minXDimensionMm: 0.25,
    maxXDimensionMm: 1.0,
    defaultHeightMm: 25.0,
    validate: (data) => {
      const clean = data.replace(/[^0-9]/g, '');
      if (clean.length !== 11 && clean.length !== 12) {
        return { valid: false, error: 'Deutsche Post Identcode requires 11 or 12 numeric digits' };
      }
      return { valid: true };
    },
  },
  {
    id: 'deutschepost-leitcode',
    displayName: 'Deutsche Post Leitcode',
    category: 'postal',
    bwipBcId: 'leitcode',
    description: 'DHL / Deutsche Post 14-digit parcel routing barcode.',
    defaultSample: '12345678901234',
    is2D: false,
    supportsXDimension: true,
    supportsRatio: false,
    supportsDensity: true,
    supportsHeight: true,
    supportsCheckDigit: true,
    checkDigitLocked: true,
    supportsCodeSet: false,
    supportsGS1: false,
    supportsTextEncoding: false,
    supportsECI: false,
    supportsErrorCorrection: false,
    supportsHumanReadable: true,
    defaultXDimensionMm: 0.40,
    minXDimensionMm: 0.25,
    maxXDimensionMm: 1.0,
    defaultHeightMm: 25.0,
    validate: (data) => {
      const clean = data.replace(/[^0-9]/g, '');
      if (clean.length !== 13 && clean.length !== 14) {
        return { valid: false, error: 'Deutsche Post Leitcode requires 13 or 14 numeric digits' };
      }
      return { valid: true };
    },
  },
  {
    id: 'pharmacode',
    displayName: 'Pharmacode',
    category: '1d',
    bwipBcId: 'pharmacode',
    description: 'Pharmaceutical binary barcode used in packaging control.',
    defaultSample: '12345',
    is2D: false,
    supportsXDimension: true,
    supportsRatio: false,
    supportsDensity: false,
    supportsHeight: true,
    supportsCheckDigit: false,
    supportsCodeSet: false,
    supportsGS1: false,
    supportsTextEncoding: false,
    supportsECI: false,
    supportsErrorCorrection: false,
    supportsHumanReadable: false,
    defaultXDimensionMm: 0.50,
    minXDimensionMm: 0.30,
    maxXDimensionMm: 1.5,
    defaultHeightMm: 10.0,
    validate: (data) => {
      const num = parseInt(data, 10);
      if (isNaN(num) || num < 3 || num > 131070) {
        return { valid: false, error: 'Pharmacode numeric value must be between 3 and 131070' };
      }
      return { valid: true };
    },
  },
  {
    id: 'telepen',
    displayName: 'Telepen',
    category: '1d',
    bwipBcId: 'telepen',
    description: 'Full ASCII linear barcode designed to encode all 128 ASCII characters without shift characters.',
    defaultSample: 'TELEPEN-1234',
    is2D: false,
    supportsXDimension: true,
    supportsRatio: false,
    supportsDensity: true,
    supportsHeight: true,
    supportsCheckDigit: true,
    checkDigitLocked: true,
    supportsCodeSet: false,
    supportsGS1: false,
    supportsTextEncoding: true,
    supportsECI: false,
    supportsErrorCorrection: false,
    supportsHumanReadable: true,
    defaultXDimensionMm: 0.36,
    minXDimensionMm: 0.18,
    maxXDimensionMm: 2.0,
    defaultHeightMm: 12.7,
    validate: (data) => {
      if (!data) return { valid: false, error: 'Telepen data cannot be empty' };
      return { valid: true };
    },
  },
];

export const SYMBOLOGY_MAP: Record<string, BarcodeSymbologyDefinition> = {};
BARCODE_SYMBOLOGY_DEFINITIONS.forEach((def) => {
  SYMBOLOGY_MAP[def.id] = def;
});

export function getSymbologyDefinition(id: BarcodeSymbology | string): BarcodeSymbologyDefinition {
  return SYMBOLOGY_MAP[id] || SYMBOLOGY_MAP['code128'] || BARCODE_SYMBOLOGY_DEFINITIONS[0];
}

export const getBarcodeCapability = getSymbologyDefinition;

export interface SymbologyMetadataCatalogItem {
  id: BarcodeSymbology;
  name: string;
  category: string;
  description: string;
  standard?: string;
  is2D: boolean;
}

export const SYMBOLOGY_FULL_METADATA_CATALOG: SymbologyMetadataCatalogItem[] = BARCODE_SYMBOLOGY_DEFINITIONS.map((def) => {
  let catName = '1D Barcodes';
  if (def.category === '2d') catName = '2D Barcodes';
  else if (def.category === 'postal') catName = 'Postal Barcodes';
  else if (def.category === 'gs1') catName = 'GS1 / Composite';

  return {
    id: def.id,
    name: def.displayName,
    category: catName,
    description: def.description,
    is2D: def.is2D,
  };
});

export const CATEGORIZED_SYMBOLOGY_GROUPS = [
  {
    group: '1D Barcodes',
    items: SYMBOLOGY_FULL_METADATA_CATALOG.filter((s) => s.category === '1D Barcodes'),
  },
  {
    group: '2D Barcodes',
    items: SYMBOLOGY_FULL_METADATA_CATALOG.filter((s) => s.category === '2D Barcodes'),
  },
  {
    group: 'Postal Barcodes',
    items: SYMBOLOGY_FULL_METADATA_CATALOG.filter((s) => s.category === 'Postal Barcodes'),
  },
  {
    group: 'GS1 / Composite',
    items: SYMBOLOGY_FULL_METADATA_CATALOG.filter((s) => s.category === 'GS1 / Composite'),
  },
];

export function getAllSymbologies(): BarcodeSymbologyDefinition[] {
  return BARCODE_SYMBOLOGY_DEFINITIONS;
}

export function validateBarcodeData(symbology: BarcodeSymbology | string, data: string): { valid: boolean; error?: string } {
  const def = getSymbologyDefinition(symbology);
  if (def.validate) {
    return def.validate(data);
  }
  if (def.validationRegex) {
    if (!def.validationRegex.test(data)) {
      return { valid: false, error: `Invalid characters for symbology ${def.displayName}` };
    }
  }
  return { valid: true };
}
