import { LabelTemplate } from '../types';
import { PrinterModel, PrintValidationResult, PrintValidationItem } from './types';

export interface PreflightPrintOptions {
  template: LabelTemplate;
  printer?: PrinterModel | null;
  records: Record<string, any>[];
  copies: number;
  quantitySource?: 'manual' | 'database_field';
  quantityColumn?: string;
  selectedRenderer?: string;
}

/**
 * Validates a print job before dispatch to prevent wasted media, invalid barcodes, or unprintable layouts.
 */
export function validatePrintJob(options: PreflightPrintOptions): PrintValidationResult {
  const {
    template,
    printer,
    records,
    copies,
    quantitySource,
    quantityColumn,
  } = options;

  const errors: PrintValidationItem[] = [];
  const warnings: PrintValidationItem[] = [];

  // 1. Printer validation
  if (!printer) {
    errors.push({
      type: 'error',
      code: 'NO_PRINTER',
      message: 'No destination printer selected.',
    });
  } else if (printer.status === 'ERROR' || printer.status === 'PAPER_OUT') {
    errors.push({
      type: 'error',
      code: 'PRINTER_ERROR_STATE',
      message: `Selected printer "${printer.name}" is in ${printer.status} state.`,
    });
  } else if (printer.status === 'OFFLINE') {
    warnings.push({
      type: 'warning',
      code: 'PRINTER_OFFLINE',
      message: `Printer "${printer.name}" appears offline. The job will be spooled by Windows Spooler.`,
    });
  }

  // 2. Template dimensions check
  if (!template.dimensions || template.dimensions.width <= 0 || template.dimensions.height <= 0) {
    errors.push({
      type: 'error',
      code: 'INVALID_DIMENSIONS',
      message: 'Label dimensions are invalid or zero.',
    });
  } else if (printer?.capabilities?.maxPrintWidthMm && template.dimensions.width > printer.capabilities.maxPrintWidthMm) {
    errors.push({
      type: 'error',
      code: 'EXCEEDS_PRINT_WIDTH',
      message: `Label width (${template.dimensions.width} mm) exceeds printer maximum printable width (${printer.capabilities.maxPrintWidthMm} mm).`,
    });
  }

  // 3. Records validation
  if (!records || records.length === 0) {
    errors.push({
      type: 'error',
      code: 'NO_RECORDS',
      message: 'No records selected for printing.',
    });
  }

  // 4. Quantity column validation
  if (quantitySource === 'database_field' && quantityColumn) {
    records.forEach((rec, idx) => {
      const val = rec[quantityColumn];
      if (val === undefined || val === null || String(val).trim() === '') {
        warnings.push({
          type: 'warning',
          code: 'MISSING_QUANTITY_VALUE',
          message: `Record #${idx + 1}: Missing quantity in column "${quantityColumn}", defaulting to 1.`,
        });
      } else {
        const num = Number(val);
        if (isNaN(num) || num <= 0) {
          errors.push({
            type: 'error',
            code: 'INVALID_QUANTITY_VALUE',
            message: `Record #${idx + 1}: Invalid quantity "${val}" in column "${quantityColumn}". Must be >= 1.`,
          });
        }
      }
    });
  } else if (copies <= 0) {
    errors.push({
      type: 'error',
      code: 'INVALID_COPIES',
      message: 'Copies must be greater than or equal to 1.',
    });
  }

  // 5. Barcode value checks
  const barcodeElements = template.elements.filter((el) =>
    ['barcode', 'datamatrix', 'qrcode', 'gs1-128'].includes(el.type)
  );

  if (barcodeElements.length > 0 && records.length > 0) {
    // Check first 10 records for performance
    const sampleRecords = records.slice(0, 10);
    sampleRecords.forEach((rec, rIdx) => {
      barcodeElements.forEach((bEl) => {
        let val = '';
        const anyEl = bEl as any;
        if (anyEl.dataSources?.primary?.type === 'database' && anyEl.dataSources?.primary?.databaseField) {
          val = String(rec[anyEl.dataSources.primary.databaseField] ?? '');
        } else if (anyEl.databaseField) {
          val = String(rec[anyEl.databaseField] ?? '');
        } else if (anyEl.dataBinding) {
          const fieldKey = anyEl.dataBinding.replace(/[{}]/g, '').trim();
          val = String(rec[fieldKey] ?? rec[anyEl.dataBinding] ?? '');
        } else {
          val = anyEl.value || anyEl.barcodeValue || anyEl.content || '';
        }

        if (!val.trim()) {
          errors.push({
            type: 'error',
            code: 'EMPTY_BARCODE_VALUE',
            message: `Record #${rIdx + 1}: Barcode "${bEl.name || bEl.id}" has an empty value.`,
          });
        }
      });
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
