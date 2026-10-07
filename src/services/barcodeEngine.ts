import bwipjs from 'bwip-js';
import { BarcodeElement, BarcodeSymbology, DataSourceItem, HumanReadableConfig } from '../types';
import { evaluateElementData, evaluateDataSourceItem, EvaluationContext } from './dataSourceEngine';
import { applyCharacterTemplate } from './transformEngine';
import { executeVBScript, isVBScriptCode } from './vbscriptEngine';
import { parseGS1BracketedString } from './gs1Engine';
import { resolveForRuntime, escapeForDisplay } from './controlCharacterService';

export interface SymbologyMetadata {
  id: BarcodeSymbology;
  name: string;
  category: string;
  folderCategories: string[];
  bwipBcId: string;
  bwipOptions?: Record<string, string | number | boolean>;
  unsupportedReason?: string;
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
    bwipBcId: 'databaromni',
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
    bwipBcId: '',
    unsupportedReason: 'Patch Code is unavailable: no genuine encoder is installed.',
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
    bwipBcId: '',
    unsupportedReason: 'TLC39 is unavailable: no genuine composite encoder is installed.',
    description: 'TCIF Linked Code 39 composite barcode.',
    defaultSample: 'TLC39-EQUIP-8849',
    is2D: false,
    supportsGS1: false,
  },
  {
    id: 'posicode-a',
    name: 'PosiCode A',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'All Symbologies'],
    bwipBcId: 'posicode',
    bwipOptions: { version: 'a' },
    description: 'PosiCode variant A, variable length extended ASCII.',
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
    bwipOptions: { version: 'b' },
    description: 'PosiCode variant B, variable length extended ASCII.',
    defaultSample: '12345678',
    is2D: false,
    supportsGS1: false,
  },
];

export function getSymbologyMetadata(symbology: BarcodeSymbology): SymbologyMetadata {
  return SYMBOLOGY_CATALOG.find(s => s.id === symbology) || {
    id: symbology, name: String(symbology), category: 'Unsupported', folderCategories: [],
    bwipBcId: '', description: 'Unknown barcode symbology.', defaultSample: '', is2D: false,
    supportsGS1: false, unsupportedReason: `Unsupported barcode symbology: ${String(symbology)}`,
  };
}

export function validateBarcodeValue(symbology: BarcodeSymbology, value: string): { valid: boolean; message?: string } {
  const meta = getSymbologyMetadata(symbology);
  if (meta.unsupportedReason) return { valid: false, message: meta.unsupportedReason };
  if (!value || !value.trim()) {
    return { valid: false, message: 'Barcode value cannot be empty' };
  }

  if (meta.validationRegex && !meta.validationRegex.test(value)) {
    return { valid: false, message: `Value does not match required format for ${meta.name}` };
  }

  return { valid: true };
}

function getBarcodeQuietModules(element: BarcodeElement): number {
  if (!element.quietZone) return 0;
  if (element.symbology === 'qr') return 4;
  if (element.symbology === 'datamatrix') return 1;
  if (element.symbology === 'aztec') return 0;
  return getSymbologyMetadata(element.symbology).is2D ? 2 : 11;
}

function getBarcodePadding(element: BarcodeElement): { paddingwidth: number; paddingheight: number } {
  const matrix = getSymbologyMetadata(element.symbology).is2D;
  const padding = getBarcodeQuietModules(element) * (matrix ? 2 : 1);
  return { paddingwidth: padding, paddingheight: matrix ? padding : 0 };
}

export function getBarcodeModuleColumns(element: BarcodeElement, ctxEval?: EvaluationContext): number {
  const metadata = getSymbologyMetadata(element.symbology);
  const resolved = resolveBarcodeData(element, ctxEval);
  const validation = validateBarcodeValue(element.symbology, String(resolved.encodedValue ?? ''));
  if (!validation.valid) throw new Error(validation.message);
  const symbols = bwipjs.raw({ ...metadata.bwipOptions, bcid: metadata.bwipBcId, text: String(resolved.encodedValue), ...(element.errorCorrectionLevel && ['qr', 'aztec'].includes(element.symbology) ? { eclevel: element.errorCorrectionLevel } : {}) });
  const columns = Math.max(...symbols.map(symbol => symbol.pixx ?? symbol.sbs?.reduce((total, width, index, runs) => total + (index === runs.length - 1 && runs.length % 2 === 0 ? 0 : width), 0) ?? 0));
  if (!Number.isFinite(columns) || columns <= 0) throw new Error('Encoder did not supply module geometry.');
  return columns + getBarcodeQuietModules(element) * 2;
}

export function quantizeBarcodeWidth(widthMm: number, columns: number, dpi: number): { width: number; xDimensionMm: number; moduleDots: number } {
  if (![widthMm, columns, dpi].every(Number.isFinite) || widthMm <= 0 || columns <= 0 || dpi <= 0) throw new Error('Invalid barcode module dimensions.');
  const moduleDots = Math.max(1, Math.round(widthMm * dpi / (25.4 * columns)));
  const xDimensionMm = moduleDots * 25.4 / dpi;
  return { width: columns * xDimensionMm, xDimensionMm, moduleDots };
}

/**
 * Auto-formats or pads values for fixed-length numeric symbologies so BarTender behaves seamlessly
 */
export function formatValueForSymbology(symbology: BarcodeSymbology, rawValue: string): string {
  if (!rawValue) return rawValue;
  // Interleaved 2 of 5 requires an even number of digits. If odd, prepend leading '0'
  if (symbology === 'interleaved2of5') {
    const s = rawValue.trim();
    if (/^\d+$/.test(s) && s.length % 2 !== 0) {
      return '0' + s;
    }
    return s;
  }

  return rawValue;
}

/**
 * Renders barcode to HTML Canvas element with high DPI scaling and BarTender formatting
 */
export interface ResolvedBarcodeData {
  encodedValue: string;
  humanReadableValue: string;
  displayTextLines: string[];
  includeText: boolean;
  placement: 'top' | 'bottom';
  alignment: 'left' | 'centered' | 'right';
  verticalOffsetMm: number;
  horizontalOffsetMm: number;
  hideCheckDigit: boolean;
}

/**
 * Resolves separate encoded barcode payload and transformed human-readable text.
 * Strictly enforces that Human Readable settings NEVER mutate the encoded barcode symbol!
 */
export function resolveBarcodeData(
  element: BarcodeElement,
  ctxEval?: EvaluationContext
): ResolvedBarcodeData {
  const meta = getSymbologyMetadata(element.symbology || (element as any).barcodeType || 'code128');

  // 1. Resolve ENCODED VALUE (combining all enabled data sources without stripping)
  let rawEncoded = '';
  if (element.dataSources && element.dataSources.length > 0) {
    rawEncoded = element.dataSources
      .filter((ds) => ds.enabled !== false)
      .map((ds, idx) => evaluateDataSourceItem(ds, ctxEval || {}, idx))
      .join('');
  } else {
    const rawEval = evaluateElementData(element, ctxEval);
    rawEncoded =
      rawEval !== undefined && rawEval !== ''
        ? rawEval
        : element.value !== undefined && element.value !== ''
          ? element.value
          : (element as any).barcodeValue !== undefined && (element as any).barcodeValue !== ''
            ? (element as any).barcodeValue
            : (element as any).content !== undefined && (element as any).content !== ''
              ? (element as any).content
              : '';
  }

  const resolvedPayload = resolveForRuntime(rawEncoded);
  const encodedValue = formatValueForSymbology(
    element.symbology || (element as any).barcodeType || 'code128',
    resolvedPayload
  );

  // 2. Resolve HUMAN-READABLE CONFIGURATION
  const hr = element.humanReadable;
  const visibility: 'full' | 'none' | 'perSource' =
    hr?.visibility || (element.includeText === false || element.textPosition === 'none' ? 'none' : 'full');

  const placement: 'top' | 'bottom' =
    hr?.placement || (element.textPosition === 'above' ? 'top' : 'bottom');

  const alignRaw = hr?.alignment || element.humanReadableAlignment || element.horizontalAlignment || element.textAlign || 'centered';
  const alignment: 'left' | 'centered' | 'right' =
    alignRaw === 'left' ? 'left' : alignRaw === 'right' ? 'right' : 'centered';

  const verticalOffsetMm = Number(hr?.verticalOffsetMm ?? element.humanReadableOffsetV ?? 0.8);
  const horizontalOffsetMm = Number(hr?.horizontalOffsetMm ?? element.humanReadableOffsetH ?? 0.0);
  const hideCheckDigit = Boolean(hr?.hideCheckDigit ?? element.hideCheckDigit);

  // If visibility is 'none' or symbology is 2D, human readable text is omitted
  if (visibility === 'none' || meta.is2D) {
    return {
      encodedValue,
      humanReadableValue: '',
      displayTextLines: [],
      includeText: false,
      placement,
      alignment,
      verticalOffsetMm,
      horizontalOffsetMm,
      hideCheckDigit,
    };
  }

  // 3. Resolve BASE HUMAN-READABLE VALUE from data sources
  let baseHrValue = '';
  if (visibility === 'perSource') {
    const allowedIds = hr?.visibleSourceIds || [];
    if (element.dataSources && element.dataSources.length > 0) {
      const activeSources = element.dataSources.filter((ds, idx) => {
        const sid = ds.id || `ds-${idx}`;
        return allowedIds.includes(sid) && ds.enabled !== false;
      });
      baseHrValue = activeSources.map((ds, idx) => evaluateDataSourceItem(ds, ctxEval || {}, idx)).join('');
    } else {
      baseHrValue = '';
    }
  } else {
    // 'full' visibility
    if (element.dataSources && element.dataSources.length > 0) {
      baseHrValue = element.dataSources
        .filter((ds) => ds.enabled !== false)
        .map((ds, idx) => evaluateDataSourceItem(ds, ctxEval || {}, idx))
        .join('');
    } else {
      baseHrValue = rawEncoded;
    }
  }

  // 4. Hide Check Digit for Human-Readable only (where applicable)
  const symId = element.symbology || 'code128';
  if (hideCheckDigit && baseHrValue.length > 1) {
    if (symId === 'ean13' && baseHrValue.length === 13) {
      baseHrValue = baseHrValue.slice(0, 12);
    } else if (symId === 'ean8' && baseHrValue.length === 8) {
      baseHrValue = baseHrValue.slice(0, 7);
    } else if (symId === 'upca' && baseHrValue.length === 12) {
      baseHrValue = baseHrValue.slice(0, 11);
    } else if (symId === 'upce' && baseHrValue.length === 8) {
      baseHrValue = baseHrValue.slice(0, 7);
    } else if (symId === 'itf14' && baseHrValue.length === 14) {
      baseHrValue = baseHrValue.slice(0, 13);
    }
  }

  // 5. Apply Human-Readable Transforms in deterministic order:
  // Step A: Character Template
  const charTemplateStr = hr?.characterTemplate?.template || element.charTemplate;
  if (charTemplateStr) {
    baseHrValue = applyCharacterTemplate(baseHrValue, charTemplateStr);
  }

  // Step B: Search and Replace
  const srRules = hr?.searchReplace || [];
  for (const rule of srRules) {
    if (rule.find) {
      try {
        if (rule.isRegex) {
          const flags = rule.caseSensitive ? 'g' : 'gi';
          baseHrValue = baseHrValue.replace(new RegExp(rule.find, flags), rule.replace || '');
        } else {
          let findStr = rule.find;
          if (rule.wholeWord) {
            findStr = `\\b${findStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`;
            const flags = rule.caseSensitive ? 'g' : 'gi';
            baseHrValue = baseHrValue.replace(new RegExp(findStr, flags), rule.replace || '');
          } else {
            if (rule.caseSensitive) {
              baseHrValue = baseHrValue.split(rule.find).join(rule.replace || '');
            } else {
              const reg = new RegExp(rule.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
              baseHrValue = baseHrValue.replace(reg, rule.replace || '');
            }
          }
        }
      } catch (err) {
        console.warn('[BarcodeEngine] Search & Replace transform error:', err);
      }
    }
  }

  // Step C: VB Script / JavaScript
  const scriptCode = hr?.script?.code || element.vbScript;
  const scriptLang = hr?.script?.language || 'vbscript';
  if (scriptCode && scriptCode.trim()) {
    try {
      if (scriptLang === 'vbscript' || isVBScriptCode(scriptCode)) {
        const vbRes = executeVBScript(scriptCode, {
          value: baseHrValue,
          input: baseHrValue,
          record: ctxEval?.record || {},
          dataSources: element.dataSources || [],
        });
        baseHrValue = vbRes.value;
      } else {
        const scope = {
          value: baseHrValue,
          input: baseHrValue,
          record: ctxEval?.record || {},
          dataSources: element.dataSources || [],
          Date,
          Math,
          String,
          Number,
        };
        const fn = new Function(...Object.keys(scope), `return (function() { ${scriptCode.includes('return') ? scriptCode : 'return ' + scriptCode} })()`);
        const out = fn(...Object.values(scope));
        if (out !== undefined && out !== null) {
          baseHrValue = String(out);
        }
      }
    } catch (err: any) {
      console.warn('[BarcodeEngine] Script transform error:', err);
    }
  }

  // Step D: Prefix and Suffix
  const pfx = hr?.prefixSuffix?.prefix ?? element.humanReadablePrefix ?? '';
  const sfx = hr?.prefixSuffix?.suffix ?? element.humanReadableSuffix ?? '';
  if (pfx || sfx) {
    baseHrValue = `${pfx}${baseHrValue}${sfx}`;
  }

  // Step E: Custom format string (e.g. "(01) {0}")
  if (element.humanReadableCustomFormat) {
    baseHrValue = element.humanReadableCustomFormat.replace('{0}', baseHrValue);
  }

  // Step F: GS1 Template & Line Break per AI
  const gs1Template = hr?.gs1Template || (element.gs1Mode ? 'standard' : 'none');
  const lineBreakAfterAi = Boolean(hr?.lineBreakAfterAi);

  let displayTextLines: string[] = [];

  if ((gs1Template === 'standard' || element.gs1Mode || symId === 'gs1-128') && baseHrValue.includes('(')) {
    const parsed = parseGS1BracketedString(baseHrValue);
    if (parsed.fields.length > 0) {
      if (lineBreakAfterAi) {
        displayTextLines = parsed.fields.map((f) => `(${f.ai}) ${f.value}`);
      } else {
        displayTextLines = [parsed.fields.map((f) => `(${f.ai}) ${f.value}`).join(' ')];
      }
    } else {
      displayTextLines = escapeForDisplay(baseHrValue).split(/\r?\n/);
    }
  } else {
    displayTextLines = escapeForDisplay(baseHrValue).split(/\r?\n/);
  }

  return {
    encodedValue,
    humanReadableValue: displayTextLines.join(lineBreakAfterAi ? '\n' : ' '),
    displayTextLines,
    includeText: true,
    placement,
    alignment,
    verticalOffsetMm,
    horizontalOffsetMm,
    hideCheckDigit,
  };
}

export interface BarcodeLayoutMetrics {
  symbolHeightMm: number;
  hrtHeightMm: number;
  hrtGapMm: number;
  totalHeightMm: number;
  minWidthMm: number;
  singleLineHeightMm: number;
  lineCount: number;
  fontSizePt: number;
}

/**
 * Gets the explicit, independent symbol bar height for a barcode element (in mm)
 */
export function getBarcodeSymbolHeight(element: BarcodeElement): number {
  if (element.barHeight && element.barHeight > 0) {
    return Number(element.barHeight);
  }
  if (element.symbol?.barHeight && element.symbol.barHeight > 0) {
    return Number(element.symbol.barHeight);
  }
  if ((element as any).symbolHeight && (element as any).symbolHeight > 0) {
    return Number((element as any).symbolHeight);
  }
  const meta = getSymbologyMetadata(element.symbology || (element as any).barcodeType || 'code128');
  if (meta.is2D) {
    return Math.min(element.width || 25, element.height || 25);
  }
  // Default symbol height for linear barcodes (15mm)
  return 15;
}

/**
 * Calculates independent Symbol Region and Human-Readable Text Region metrics for a barcode element
 */
export function calculateBarcodeLayout(
  element: BarcodeElement,
  resolvedData?: ResolvedBarcodeData
): BarcodeLayoutMetrics {
  const meta = getSymbologyMetadata(element.symbology || (element as any).barcodeType || 'code128');
  const resolved = resolvedData || resolveBarcodeData(element);
  const { displayTextLines, includeText, verticalOffsetMm } = resolved;
  const is2D = meta.is2D;

  const symbolHeightMm = getBarcodeSymbolHeight(element);

  if (!includeText || is2D || displayTextLines.length === 0) {
    return {
      symbolHeightMm,
      hrtHeightMm: 0,
      hrtGapMm: 0,
      totalHeightMm: symbolHeightMm,
      minWidthMm: Math.max(10, element.width || 40),
      singleLineHeightMm: 0,
      lineCount: 0,
      fontSizePt: 0,
    };
  }

  const fSizePt = Number(
    element.humanReadableFontSize ||
    element.humanReadable?.fontSize ||
    element.fontSize ||
    10
  );
  // 1 pt = 25.4 / 72 mm. Standard typographic line height ratio ≈ 1.25
  const singleLineHeightMm = (fSizePt * (25.4 / 72)) * 1.25;
  const lineCount = Math.max(1, displayTextLines.length);
  const hrtHeightMm = singleLineHeightMm * lineCount;
  const hrtGapMm = Math.max(0.5, Number(verticalOffsetMm ?? element.humanReadableOffsetV ?? element.humanReadable?.gap ?? 1.0));

  const totalHeightMm = symbolHeightMm + hrtGapMm + hrtHeightMm;

  return {
    symbolHeightMm,
    hrtHeightMm,
    hrtGapMm,
    totalHeightMm,
    minWidthMm: Math.max(10, element.width || 40),
    singleLineHeightMm,
    lineCount,
    fontSizePt: fSizePt,
  };
}

function escapeXml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateBwipSvg(options: any): string {
  return bwipjs.toSVG({ ...options, ...(options.bcid === 'code93' ? { includecheck: true } : {}) })
    .replaceAll(' fill=rule=', ' fill-rule=')
    .replace('<svg ', '<svg shape-rendering="crispEdges" ');
}

/**
 * Renders barcode to HTML Canvas element with high DPI scaling, accurate placement, offsets, and BarTender formatting
 */
const barcodeCanvasRenders = new WeakMap<HTMLCanvasElement, symbol>();

export async function renderBarcodeToCanvas(
  canvas: HTMLCanvasElement,
  element: BarcodeElement,
  scale: number = 2,
  ctxEval?: EvaluationContext
): Promise<void> {
  const renderToken = Symbol();
  barcodeCanvasRenders.set(canvas, renderToken);
  const meta = getSymbologyMetadata(element.symbology || (element as any).barcodeType || 'code128');
  const resolved = resolveBarcodeData(element, ctxEval);
  const { encodedValue, displayTextLines, includeText, placement, alignment, horizontalOffsetMm } = resolved;

  try {
    const validation = validateBarcodeValue(meta.id, String(encodedValue ?? ''));
    if (!validation.valid) throw new Error(validation.message);
    const is2D = meta.is2D;
    const layout = calculateBarcodeLayout(element, resolved);
    const symbolHeightMm = layout.symbolHeightMm;

    // 1. Symbol pixel height: STRICTLY DERIVED FROM symbolHeightMm, NEVER FROM (targetH - totalTextAreaHeight)!
    const barAreaHeight = is2D
      ? Math.max(10, Math.round(Math.min(element.width || 25, element.height || 25) * scale))
      : Math.max(6, Math.round(symbolHeightMm * scale));

    // 2. Resolve Human-Readable Font styling (Family, Bold, Italic, Underline, Strikeout, Color, Size)
    const fontName = (element.humanReadableFont || element.humanReadable?.fontFamily || element.fontFamily || 'Arial').trim();
    const styleRaw =
      element.humanReadableFontStyle ||
      (element.fontStyle === 'italic' && element.fontWeight === 'bold'
        ? 'bold-italic'
        : element.fontStyle === 'italic'
          ? 'italic'
          : element.fontWeight === 'bold'
            ? 'bold'
            : 'regular');
    const isBold = styleRaw === 'bold' || styleRaw === 'bold-italic' || element.fontWeight === 'bold' || element.humanReadable?.fontWeight === 'bold';
    const isItalic = styleRaw === 'italic' || styleRaw === 'bold-italic' || element.fontStyle === 'italic' || element.humanReadable?.fontStyle === 'italic';
    const isUnderline = Boolean(element.humanReadableUnderline || element.underline || element.humanReadable?.textDecoration === 'underline');
    const isStrikeout = Boolean(element.humanReadableStrikeout || (element as any).textDecoration === 'line-through');
    const textColor = element.humanReadableColor || element.humanReadable?.color || element.color || '#000000';

    let fSizePt = Number(element.humanReadableFontSize || element.humanReadable?.fontSize || element.fontSize || 10);
    const lineCount = Math.max(1, displayTextLines.length);

    const elWidthMm = Math.max(10, element.width || 50);
    const targetW = Math.max(20, Math.round(elWidthMm * scale));

    if (element.autoSize || element.autoSizeText) {
      const minPt = Math.max(4, element.minFontSize || 6);
      const maxPt = Math.max(minPt, element.maxFontSize || 20);
      const longestLineLen = Math.max(...displayTextLines.map((l) => l.length), 8);
      const charWidthRatio = 0.55;
      const calcPt = Math.floor((targetW * 0.9) / (longestLineLen * charWidthRatio * (scale / 3.78)));
      fSizePt = Math.max(minPt, Math.min(maxPt, calcPt));
    }

    // 1 pt = 25.4 / 72 mm * scale px
    let fontSizePx = Math.max(7, Math.round(fSizePt * (25.4 / 72) * scale));
    const fontStylePrefix = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}`;

    const singleLineHeightPx = Math.round(fontSizePx * 1.25);
    const textGapPx = Math.max(1, Math.round(layout.hrtGapMm * scale));
    const totalTextAreaHeight = includeText && displayTextLines.length > 0 ? singleLineHeightPx * lineCount + textGapPx : 0;

    const isSymbolOnly = Boolean(ctxEval?.symbolOnly);
    // Buffer height accommodates the independent symbol bar height + text area height without shrinking bars
    const totalRequiredH = Math.round(layout.totalHeightMm * scale);
    const targetH = isSymbolOnly ? barAreaHeight : totalRequiredH;

    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, targetW, targetH);

    // Background color if configured
    if (element.backgroundColor && element.backgroundColor !== 'transparent' && element.backgroundColor !== 'None') {
      ctx.fillStyle = element.backgroundColor;
      ctx.fillRect(0, 0, targetW, targetH);
    }

    let barY = 0;
    let textStartY = 0;
    if (!isSymbolOnly && includeText && displayTextLines.length > 0) {
      if (placement === 'top') {
        barY = totalTextAreaHeight;
        textStartY = Math.round(singleLineHeightPx * 0.5);
      } else {
        barY = 0;
        textStartY = Math.round(barAreaHeight + textGapPx + singleLineHeightPx * 0.5);
      }
    }

    // 3. Bar Width & Placement (BarTender behavior: bars snugly span the bounding box)
    const barX = 0;
    const barW = targetW;

    const symbolDocument = new DOMParser().parseFromString(generatePureSymbolSVG(element, ctxEval), 'image/svg+xml');
    const symbolSvg = symbolDocument.documentElement;
    symbolSvg.setAttribute('width', String(barW));
    symbolSvg.setAttribute('height', String(barAreaHeight));
    symbolSvg.setAttribute('preserveAspectRatio', 'none');
    const symbolImage = new Image();
    symbolImage.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(symbolDocument))}`;
    await symbolImage.decode();
    if (barcodeCanvasRenders.get(canvas) !== renderToken) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(symbolImage, barX, barY, barW, barAreaHeight);

    // 5. Draw Human-Readable Text with complete offsets, alignment, multiline & typography
    if (!isSymbolOnly && includeText && displayTextLines.length > 0) {
      ctx.fillStyle = textColor;
      ctx.textBaseline = 'middle';
      ctx.font = `${fontStylePrefix}${fontSizePx}px "${fontName}", Arial, sans-serif`;

      const hOffsetPx = Math.round(horizontalOffsetMm * (scale / 3.78) * 3.78);

      let baseX = targetW / 2;
      ctx.textAlign = 'center';
      if (alignment === 'left') {
        baseX = barX + 2;
        ctx.textAlign = 'left';
      } else if (alignment === 'right') {
        baseX = barX + barW - 2;
        ctx.textAlign = 'right';
      }

      const textX = baseX + hOffsetPx;

      displayTextLines.forEach((lineText, lineIdx) => {
        const lineY = textStartY + lineIdx * singleLineHeightPx;
        ctx.fillText(lineText, textX, lineY);

        // Underline support
        if (isUnderline) {
          const tw = ctx.measureText(lineText).width;
          const ux = alignment === 'left' ? textX : alignment === 'right' ? textX - tw : textX - tw / 2;
          ctx.strokeStyle = textColor;
          ctx.lineWidth = Math.max(1, Math.round(fontSizePx / 13));
          ctx.beginPath();
          ctx.moveTo(ux, lineY + fontSizePx * 0.52);
          ctx.lineTo(ux + tw, lineY + fontSizePx * 0.52);
          ctx.stroke();
        }

        // Strikeout support
        if (isStrikeout) {
          const tw = ctx.measureText(lineText).width;
          const sx = alignment === 'left' ? textX : alignment === 'right' ? textX - tw : textX - tw / 2;
          ctx.strokeStyle = textColor;
          ctx.lineWidth = Math.max(1, Math.round(fontSizePx / 13));
          ctx.beginPath();
          ctx.moveTo(sx, lineY);
          ctx.lineTo(sx + tw, lineY);
          ctx.stroke();
        }
      });
    }

    // 6. Bearer Bars (for ITF-14 or carton shipping barcodes)
    if (element.bearerBars && !is2D) {
      ctx.fillStyle = element.foregroundColor || '#000000';
      const barThick = Math.max(1, Math.round((element.bearerBarThickness || 2) * (scale / 3.78)));
      ctx.fillRect(barX, barY, barW, barThick);
      ctx.fillRect(barX, barY + barAreaHeight - barThick, barW, barThick);
      if (element.bearerBarType === 'complete') {
        ctx.fillRect(barX, barY, barThick, barAreaHeight);
        ctx.fillRect(barX + barW - barThick, barY, barThick, barAreaHeight);
      }
    }
  } catch (err: any) {
    if (barcodeCanvasRenders.get(canvas) !== renderToken) return;
    console.warn(`[BarcodeEngine] Failed to render ${meta.name} with value "${encodedValue}":`, err?.message || err);

    // Clear BarTender invalid barcode warning
    const ctx = canvas.getContext('2d');
    if (ctx) {
      canvas.width = Math.max(120, Math.round(element.width * scale));
      canvas.height = Math.max(40, Math.round(element.height * scale));
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff5f5';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

      // Diagonal subtle stripes
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.15)';
      ctx.lineWidth = 1;
      for (let x = -canvas.height; x < canvas.width + canvas.height; x += 12) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + canvas.height, canvas.height);
        ctx.stroke();
      }

      ctx.fillStyle = '#b91c1c';
      ctx.font = `bold ${Math.max(10, Math.round(11 * (scale / 3.78)))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`⚠ ${meta.name}: Invalid Data`, canvas.width / 2, canvas.height / 2 - 8);

      ctx.font = `${Math.max(8, Math.round(9 * (scale / 3.78)))}px monospace`;
      ctx.fillStyle = '#4b5563';
      const dispText = String(encodedValue).length > 20 ? String(encodedValue).slice(0, 18) + '…' : String(encodedValue);
      ctx.fillText(`"${dispText}"`, canvas.width / 2, canvas.height / 2 + 8);
    }
    throw err;
  }
}

/**
 * Generates an SVG string representation of JUST the barcode symbol bars (pure symbol, no HRT)
 */
export function generatePureSymbolSVG(element: BarcodeElement, ctxEval?: EvaluationContext): string {
  const meta = getSymbologyMetadata(element.symbology || (element as any).barcodeType || 'code128');
  const resolved = resolveBarcodeData(element, ctxEval);
  const { encodedValue } = resolved;
  const validation = validateBarcodeValue(element.symbology || (element as any).barcodeType || 'code128', String(encodedValue ?? ''));
  if (!validation.valid) throw new Error(validation.message || 'Invalid barcode data.');
  const is2D = meta.is2D;
  const layout = calculateBarcodeLayout(element, resolved);
  const symbolHeightMm = layout.symbolHeightMm;

  if (is2D) {
    const opts: any = {
      ...meta.bwipOptions,
      ...getBarcodePadding(element),
      bcid: meta.bwipBcId,
      text: String(encodedValue),
      scale: Math.max(1, Math.round(element.barWidth || 2)),
    };
    if (element.errorCorrectionLevel && (element.symbology === 'qr' || element.symbology === 'aztec')) {
      opts.eclevel = element.errorCorrectionLevel;
    }
    if (element.foregroundColor) {
      const fg = element.foregroundColor.replace('#', '');
      if (/^[0-9A-Fa-f]{6}$/.test(fg)) opts.barcolor = fg;
    }
    return generateBwipSvg(opts);
  }

  const pureBwipOpts: any = {
    ...meta.bwipOptions,
    ...getBarcodePadding(element),
    bcid: meta.bwipBcId,
    text: String(encodedValue),
    scale: Math.max(1, Math.round(element.barWidth || 2)),
    height: Math.max(8, Math.round(symbolHeightMm * 1.5)),
    includetext: false,
  };
  if (element.foregroundColor) {
    const fg = element.foregroundColor.replace('#', '');
    if (/^[0-9A-Fa-f]{6}$/.test(fg)) pureBwipOpts.barcolor = fg;
  }
  if (element.backgroundColor && element.backgroundColor !== 'transparent') {
    const bg = element.backgroundColor.replace('#', '');
    if (/^[0-9A-Fa-f]{6}$/.test(bg)) pureBwipOpts.backgroundcolor = bg;
  }
  return generateBwipSvg(pureBwipOpts);
}

/**
 * Generates an SVG string representation of a barcode with independent Symbol Region and HRT Region
 */
export function generateBarcodeSVG(element: BarcodeElement, ctxEval?: EvaluationContext): string {
  const meta = getSymbologyMetadata(element.symbology || (element as any).barcodeType || 'code128');
  const resolved = resolveBarcodeData(element, ctxEval);
  const { encodedValue, displayTextLines, includeText, placement, alignment, horizontalOffsetMm } = resolved;

  try {
    const is2D = meta.is2D;
    const layout = calculateBarcodeLayout(element, resolved);
    const symbolHeightMm = layout.symbolHeightMm;

    const pureSvg = generatePureSymbolSVG(element, ctxEval);

    if (is2D || !includeText || displayTextLines.length === 0) {
      return pureSvg;
    }

    // 3. Composite SVG: Pure symbol bars + independent Human-Readable Text Region
    const vbMatch = pureSvg.match(/viewBox="([^"]+)"/);
    if (!vbMatch) return pureSvg;
    const parts = vbMatch[1].split(/\s+/).map(Number);
    const symbolW = parts[2] || 200;
    const symbolH = parts[3] || 100;

    const unitPerMm = symbolH / Math.max(1, symbolHeightMm);
    const fSizePt = Number(element.humanReadableFontSize || element.humanReadable?.fontSize || element.fontSize || 10);
    const fontSizeSvg = (fSizePt * (25.4 / 72)) * unitPerMm;
    const gapSvg = layout.hrtGapMm * unitPerMm;
    const lineHeightSvg = fontSizeSvg * 1.25;
    const totalHrtHeightSvg = lineHeightSvg * displayTextLines.length + gapSvg;
    const totalSvgH = symbolH + totalHrtHeightSvg;

    const fontName = (element.humanReadableFont || element.humanReadable?.fontFamily || element.fontFamily || 'Arial').trim();
    const styleRaw =
      element.humanReadableFontStyle ||
      (element.fontStyle === 'italic' && element.fontWeight === 'bold'
        ? 'bold-italic'
        : element.fontStyle === 'italic'
          ? 'italic'
          : element.fontWeight === 'bold'
            ? 'bold'
            : 'regular');
    const isBold = styleRaw === 'bold' || styleRaw === 'bold-italic' || element.fontWeight === 'bold' || element.humanReadable?.fontWeight === 'bold';
    const isItalic = styleRaw === 'italic' || styleRaw === 'bold-italic' || element.fontStyle === 'italic' || element.humanReadable?.fontStyle === 'italic';
    const isUnderline = Boolean(element.humanReadableUnderline || element.underline || element.humanReadable?.textDecoration === 'underline');
    const textColor = element.humanReadableColor || element.humanReadable?.color || element.color || '#000000';

    // Extract path/rect inner content from pure bwip SVG
    const innerContent = pureSvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');

    const isTop = placement === 'top';
    const symbolTransform = isTop ? `transform="translate(0, ${totalHrtHeightSvg.toFixed(2)})"` : '';
    const textBaseY = isTop ? fontSizeSvg * 0.85 : symbolH + gapSvg + fontSizeSvg * 0.85;

    let textAnchor = 'middle';
    let textX = symbolW / 2;
    if (alignment === 'left') {
      textAnchor = 'start';
      textX = 2;
    } else if (alignment === 'right') {
      textAnchor = 'end';
      textX = symbolW - 2;
    }
    const hOffsetSvg = (horizontalOffsetMm || 0) * unitPerMm;
    textX += hOffsetSvg;

    const textElements = displayTextLines.map((line, idx) => {
      const lineY = textBaseY + idx * lineHeightSvg;
      const textDecor = isUnderline ? 'text-decoration="underline"' : '';
      return `<text x="${textX.toFixed(2)}" y="${lineY.toFixed(2)}" font-family="${escapeXml(fontName)}, Arial, sans-serif" font-size="${fontSizeSvg.toFixed(2)}" font-weight="${isBold ? 'bold' : 'normal'}" font-style="${isItalic ? 'italic' : 'normal'}" ${textDecor} fill="${textColor}" text-anchor="${textAnchor}">${escapeXml(line)}</text>`;
    }).join('\n    ');

    return `<svg viewBox="0 0 ${symbolW} ${totalSvgH.toFixed(2)}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
  <g class="barcode-symbol" ${symbolTransform}>
    ${innerContent}
  </g>
  <g class="barcode-hrt">
    ${textElements}
  </g>
</svg>`;
  } catch (e) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><rect width="100%" height="100%" fill="#fef2f2"/><text x="50%" y="50%" text-anchor="middle" fill="#dc2626" font-size="10">Invalid Barcode</text></svg>`;
  }
}
