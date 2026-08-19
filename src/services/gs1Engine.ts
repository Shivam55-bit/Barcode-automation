import { GS1Field } from '../types';

export interface GS1AIDefinition {
  ai: string;
  description: string;
  format: string;
  dataTitle: string;
  minLength: number;
  maxLength: number;
  isVariableLength: boolean;
  type: 'numeric' | 'alphanumeric' | 'date';
}

export const GS1_AI_DICTIONARY: Record<string, GS1AIDefinition> = {
  '00': { ai: '00', description: 'SSCC (Serial Shipping Container Code)', format: 'N18', dataTitle: 'SSCC', minLength: 18, maxLength: 18, isVariableLength: false, type: 'numeric' },
  '01': { ai: '01', description: 'GTIN (Global Trade Item Number)', format: 'N14', dataTitle: 'GTIN', minLength: 14, maxLength: 14, isVariableLength: false, type: 'numeric' },
  '02': { ai: '02', description: 'GTIN of contained trade items', format: 'N14', dataTitle: 'CONTENT', minLength: 14, maxLength: 14, isVariableLength: false, type: 'numeric' },
  '10': { ai: '10', description: 'Batch or Lot Number', format: 'X..20', dataTitle: 'BATCH/LOT', minLength: 1, maxLength: 20, isVariableLength: true, type: 'alphanumeric' },
  '11': { ai: '11', description: 'Production Date (YYMMDD)', format: 'N6', dataTitle: 'PROD DATE', minLength: 6, maxLength: 6, isVariableLength: false, type: 'date' },
  '12': { ai: '12', description: 'Due Date for payment (YYMMDD)', format: 'N6', dataTitle: 'DUE DATE', minLength: 6, maxLength: 6, isVariableLength: false, type: 'date' },
  '13': { ai: '13', description: 'Packaging Date (YYMMDD)', format: 'N6', dataTitle: 'PACK DATE', minLength: 6, maxLength: 6, isVariableLength: false, type: 'date' },
  '15': { ai: '15', description: 'Best Before Date (YYMMDD)', format: 'N6', dataTitle: 'BEST BEFORE', minLength: 6, maxLength: 6, isVariableLength: false, type: 'date' },
  '17': { ai: '17', description: 'Expiration Date (YYMMDD)', format: 'N6', dataTitle: 'USE BY OR EXPIRY', minLength: 6, maxLength: 6, isVariableLength: false, type: 'date' },
  '20': { ai: '20', description: 'Internal Product Variant', format: 'N2', dataTitle: 'VARIANT', minLength: 2, maxLength: 2, isVariableLength: false, type: 'numeric' },
  '21': { ai: '21', description: 'Serial Number', format: 'X..20', dataTitle: 'SERIAL', minLength: 1, maxLength: 20, isVariableLength: true, type: 'alphanumeric' },
  '240': { ai: '240', description: 'Additional Product Identification', format: 'X..30', dataTitle: 'ADDITIONAL ID', minLength: 1, maxLength: 30, isVariableLength: true, type: 'alphanumeric' },
  '241': { ai: '241', description: 'Customer Part Number', format: 'X..30', dataTitle: 'CUST. PART NO', minLength: 1, maxLength: 30, isVariableLength: true, type: 'alphanumeric' },
  '250': { ai: '250', description: 'Secondary Serial Number', format: 'X..30', dataTitle: 'SEC. SERIAL', minLength: 1, maxLength: 30, isVariableLength: true, type: 'alphanumeric' },
  '30': { ai: '30', description: 'Variable Count (Quantity)', format: 'N..8', dataTitle: 'VAR. COUNT', minLength: 1, maxLength: 8, isVariableLength: true, type: 'numeric' },
  '310': { ai: '310', description: 'Net Weight (kg) with decimal point indication', format: 'N6', dataTitle: 'NET WEIGHT(kg)', minLength: 6, maxLength: 6, isVariableLength: false, type: 'numeric' },
  '320': { ai: '320', description: 'Net Length (m)', format: 'N6', dataTitle: 'NET LENGTH(m)', minLength: 6, maxLength: 6, isVariableLength: false, type: 'numeric' },
  '330': { ai: '330', description: 'Gross Weight (kg)', format: 'N6', dataTitle: 'GROSS WEIGHT(kg)', minLength: 6, maxLength: 6, isVariableLength: false, type: 'numeric' },
  '37': { ai: '37', description: 'Count of trade items in a logistic unit', format: 'N..8', dataTitle: 'COUNT', minLength: 1, maxLength: 8, isVariableLength: true, type: 'numeric' },
  '390': { ai: '390', description: 'Amount Payable (Single Monetary Area)', format: 'N..15', dataTitle: 'AMOUNT', minLength: 1, maxLength: 15, isVariableLength: true, type: 'numeric' },
  '400': { ai: '400', description: 'Customer Purchase Order Number', format: 'X..30', dataTitle: 'ORDER NUMBER', minLength: 1, maxLength: 30, isVariableLength: true, type: 'alphanumeric' },
  '414': { ai: '414', description: 'GLN for Physical Location', format: 'N13', dataTitle: 'LOC No.', minLength: 13, maxLength: 13, isVariableLength: false, type: 'numeric' },
  '420': { ai: '420', description: 'Deliver to / Ship to Postal Code', format: 'X..20', dataTitle: 'POSTAL', minLength: 1, maxLength: 20, isVariableLength: true, type: 'alphanumeric' },
  '422': { ai: '422', description: 'Country of Origin (ISO 3166-1 Numeric)', format: 'N3', dataTitle: 'ORIGIN', minLength: 3, maxLength: 3, isVariableLength: false, type: 'numeric' },
  '7001': { ai: '7001', description: 'NATO Stock Number (NSN)', format: 'N13', dataTitle: 'NSN', minLength: 13, maxLength: 13, isVariableLength: false, type: 'numeric' },
  '8005': { ai: '8005', description: 'Price Per Unit of Measure', format: 'N6', dataTitle: 'PRICE/UOM', minLength: 6, maxLength: 6, isVariableLength: false, type: 'numeric' },
  '91': { ai: '91', description: 'Internal Company Use (1)', format: 'X..90', dataTitle: 'INTERNAL', minLength: 1, maxLength: 90, isVariableLength: true, type: 'alphanumeric' },
  '92': { ai: '92', description: 'Internal Company Use (2)', format: 'X..90', dataTitle: 'INTERNAL', minLength: 1, maxLength: 90, isVariableLength: true, type: 'alphanumeric' },
};

/**
 * Calculates GS1 Modulo 10 Check Digit (for GTIN-8, GTIN-12, GTIN-13, GTIN-14, SSCC-18)
 */
export function calculateGS1CheckDigit(digitsWithoutCheckDigit: string): number {
  const cleanDigits = digitsWithoutCheckDigit.replace(/\D/g, '');
  if (!cleanDigits.length) return 0;
  
  let sum = 0;
  let multiplier = 3;
  
  // From right to left, alternate multiplying by 3 and 1
  for (let i = cleanDigits.length - 1; i >= 0; i--) {
    const digit = parseInt(cleanDigits[i], 10);
    sum += digit * multiplier;
    multiplier = multiplier === 3 ? 1 : 3;
  }
  
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

/**
 * Validates a complete GTIN or SSCC string including check digit
 */
export function validateGS1CheckDigit(fullNumber: string): boolean {
  const clean = fullNumber.replace(/\D/g, '');
  if (clean.length < 2) return false;
  
  const body = clean.slice(0, -1);
  const checkDigit = parseInt(clean.slice(-1), 10);
  const calculated = calculateGS1CheckDigit(body);
  
  return checkDigit === calculated;
}

/**
 * Parses GS1 bracketed string (e.g. "(01)00850006531234(17)261231(10)BATCH99") into structured fields
 */
export function parseGS1BracketedString(input: string): { fields: GS1Field[]; isValid: boolean; errors: string[] } {
  const fields: GS1Field[] = [];
  const errors: string[] = [];
  
  if (!input || !input.trim()) {
    return { fields, isValid: true, errors };
  }

  // Regex to match (AI)Value pattern
  const aiRegex = /\((\d{2,4})\)([^(]+)/g;
  let match: RegExpExecArray | null;
  let hasMatches = false;

  while ((match = aiRegex.exec(input)) !== null) {
    hasMatches = true;
    const ai = match[1];
    const value = match[2].trim();
    const def = GS1_AI_DICTIONARY[ai];

    if (!def) {
      errors.push(`Unknown Application Identifier (${ai})`);
    } else {
      // Validate length & type
      if (value.length < def.minLength || value.length > def.maxLength) {
        errors.push(`AI (${ai}) expected length between ${def.minLength} and ${def.maxLength}, got ${value.length}`);
      }
      if (def.type === 'numeric' && !/^\d+$/.test(value)) {
        errors.push(`AI (${ai}) must contain only numeric digits`);
      }
    }

    fields.push({
      ai,
      label: def ? def.dataTitle : `AI ${ai}`,
      value,
      length: value.length,
      isVariableLength: def ? def.isVariableLength : true,
    });
  }

  if (!hasMatches && input.includes('(')) {
    errors.push('Malformed GS1 bracketed string format');
  }

  return {
    fields,
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Builds barcode encoded string with standard FNC1 markers for GS1-128 / GS1 DataMatrix
 */
export function formatGS1ForBarcodeEncoding(fields: GS1Field[]): string {
  if (!fields.length) return '';
  return fields.map(f => `(${f.ai})${f.value}`).join('');
}

/**
 * Builds human readable text with parentheses
 */
export function formatGS1HumanReadable(fields: GS1Field[]): string {
  return fields.map(f => `(${f.ai}) ${f.value}`).join(' ');
}
