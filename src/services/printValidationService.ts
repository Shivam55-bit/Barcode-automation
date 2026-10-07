/**
 * BarcodeFlow Pre-Print Data Validation Service (spec 28/34)
 *
 * Validates the FINAL resolved barcode values (using the same central resolver
 * as canvas + print) against the selected symbology BEFORE any labels are
 * dispatched, so invalid barcode data is never silently printed.
 */

import { LabelTemplate, BarcodeElement } from '../types';
import { evaluateElementData } from './dataSourceEngine';
import { validateBarcodeValue } from './barcodeEngine';

export interface BarcodeValidationIssue {
  recordIndex: number; // 0-based index within the records-to-print set
  recordNumber: number; // 1-based, human friendly
  elementId: string;
  elementName: string;
  symbology: string;
  value: string;
  message: string;
}

export interface PrintValidationResult {
  valid: boolean;
  issues: BarcodeValidationIssue[];
  checkedRecords: number;
  totalBarcodeChecks: number;
  truncated: boolean; // true when scanning stopped at maxRecords
}

export interface ValidatePrintDataOptions {
  /** Max records to scan (protects against 100k-row jobs). Default 5000. */
  maxRecords?: number;
  /** Stop after collecting this many issues. Default 50. */
  maxIssues?: number;
}

/**
 * Scans every barcode element across the records that are about to print and
 * returns any records whose resolved value is invalid for its symbology.
 */
export function validatePrintDataBarcodes(
  template: LabelTemplate,
  records: Record<string, any>[],
  options: ValidatePrintDataOptions = {}
): PrintValidationResult {
  const maxRecords = options.maxRecords ?? 5000;
  const maxIssues = options.maxIssues ?? 50;

  const barcodeElements = (template.elements || []).filter(
    (el): el is BarcodeElement => el.type === 'barcode' && el.visible !== false
  );

  const issues: BarcodeValidationIssue[] = [];
  const safeRecords = records && records.length > 0 ? records : [{}];
  const scanCount = Math.min(safeRecords.length, maxRecords);
  let totalBarcodeChecks = 0;

  for (let r = 0; r < scanCount; r++) {
    const record = safeRecords[r];
    for (const el of barcodeElements) {
      totalBarcodeChecks++;
      const symbology = el.symbology || (el as any).barcodeType || 'code128';
      let value = '';
      try {
        value = evaluateElementData(el, {
          record,
          currentRecordIndex: r,
          printIndex: r,
          totalRecords: safeRecords.length,
          variables: template.variables,
          namedDataSources: template.namedDataSources,
          elements: template.elements,
        });
      } catch (err: any) {
        issues.push({
          recordIndex: r,
          recordNumber: r + 1,
          elementId: el.id,
          elementName: el.name || 'Barcode',
          symbology,
          value: '',
          message: `Resolver error: ${err?.message || 'unknown'}`,
        });
        continue;
      }

      // GS1 / composite payloads carry their own AI validation; skip strict regex
      const isGs1 = String(symbology).toLowerCase().includes('gs1') || String(symbology).toLowerCase().includes('databar');
      const check = isGs1
        ? { valid: value.trim().length > 0, message: 'GS1 payload cannot be empty' }
        : validateBarcodeValue(symbology as any, value);

      if (!check.valid) {
        issues.push({
          recordIndex: r,
          recordNumber: r + 1,
          elementId: el.id,
          elementName: el.name || 'Barcode',
          symbology: String(symbology),
          value,
          message: check.message || 'Invalid barcode value',
        });
        if (issues.length >= maxIssues) {
          return {
            valid: false,
            issues,
            checkedRecords: r + 1,
            totalBarcodeChecks,
            truncated: true,
          };
        }
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    checkedRecords: scanCount,
    totalBarcodeChecks,
    truncated: safeRecords.length > maxRecords,
  };
}

/**
 * Human-readable summary for surfacing in a dialog / toast.
 */
export function summarizeBarcodeIssues(result: PrintValidationResult): string {
  if (result.valid) return 'All barcode values are valid.';
  const first = result.issues
    .slice(0, 5)
    .map(
      (i) =>
        `Record ${i.recordNumber} · ${i.elementName} (${i.symbology}): "${i.value}" — ${i.message}`
    )
    .join('\n');
  const more = result.issues.length > 5 ? `\n…and ${result.issues.length - 5} more issue(s).` : '';
  return `${result.issues.length} invalid barcode value(s) detected:\n${first}${more}`;
}
