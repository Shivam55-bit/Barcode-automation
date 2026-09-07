import { LabelElement, LabelTemplate, DpiOption } from '../types';
import { evaluateElementData } from './dataSourceEngine';

/**
 * Calculates dot coordinates from mm based on target printer DPI
 */
export function mmToDots(mm: number, dpi: number = 203): number {
  const dpmm = dpi === 600 ? 23.62 : dpi === 300 ? 11.81 : (dpi / 25.4);
  return Math.round(mm * dpmm);
}

/**
 * Converts dots back to mm
 */
export function dotsToMm(dots: number, dpi: number = 203): number {
  const dpmm = dpi === 600 ? 23.62 : dpi === 300 ? 11.81 : (dpi / 25.4);
  return Number((dots / dpmm).toFixed(2));
}
import { renderZPL } from '../printing/renderers/zplRenderer';

/**
 * Generates production-ready ZPL-II code — Delegated to canonical renderZPL
 */
export function generateZPL(
  template: LabelTemplate,
  recordData: Record<string, string> = {},
  options?: { dpi?: number; copies?: number; darkness?: number; speed?: number; mediaTracking?: 'gap' | 'continuous' | 'black_mark' }
): string {
  return renderZPL(template, [recordData], {
    dpi: options?.dpi,
    copies: options?.copies || 1,
    darkness: options?.darkness,
    speed: options?.speed,
    mediaTracking: options?.mediaTracking,
  });
}

import { renderTSPL } from '../printing/renderers/tsplRenderer';

/**
 * Generates TSPL (TSC Printer Language) code — Delegated to canonical renderTSPL
 */
export function generateTSPL(
  template: LabelTemplate,
  recordData: Record<string, any> = {},
  options?: { dpi?: number; copies?: number; gapMm?: number }
): string {
  return renderTSPL(template, [recordData], {
    dpi: options?.dpi,
    copies: options?.copies || 1,
    gapMm: options?.gapMm,
  });
}

/**
 * Generates EPL2 (Eltron Programming Language) code
 */
export function generateEPL(template: LabelTemplate, recordData: Record<string, string> = {}, options?: { dpi?: number }): string {
  const dpi = options?.dpi || template.dimensions.dpi || 203;
  const pw = mmToDots(template.dimensions.width, dpi);
  const lines: string[] = [
    'N',
    `q${pw}`,
    'Q100,24',
  ];

  for (const el of template.elements) {
    if (!el.visible || el.printable === false) continue;
    const xDots = mmToDots(el.x, dpi);
    const yDots = mmToDots(el.y, dpi);

    if (el.type === 'text') {
      const txt = evaluateElementData(el, { record: recordData });
      lines.push(`A${xDots},${yDots},0,3,1,1,N,"${txt.replace(/"/g, '\\"')}"`);
    } else if (el.type === 'barcode') {
      const val = evaluateElementData(el, { record: recordData });
      const hDots = mmToDots(el.barHeight || el.height, dpi);
      lines.push(`B${xDots},${yDots},0,1,2,4,${hDots},B,"${val.replace(/"/g, '\\"')}"`);
    }
  }

  lines.push('P1');
  return lines.join('\n');
}

function escapeZPL(str: string): string {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/\^/g, '\\^').replace(/~/g, '\\~');
}

export const generateZplCode = generateZPL;
export const generateEplCode = generateEPL;

