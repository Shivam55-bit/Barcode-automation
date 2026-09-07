import { PhysicalUnit } from './types';

export const MM_PER_INCH = 25.4;

/**
 * Converts physical millimeters to printer dots at target DPI.
 * Standard label printer DPIs:
 * 203 DPI = 8.00 dots/mm (203.2 / 25.4 = 8.0)
 * 300 DPI = 11.81 dots/mm
 * 600 DPI = 23.62 dots/mm
 */
export function mmToDots(mm: number, dpi: number = 203): number {
  if (isNaN(mm) || mm <= 0) return 0;
  // Precise industrial standard: 203 DPI printer heads have 8 dots/mm exactly
  const dpmm = dpi === 203 ? 8.0 : dpi === 300 ? 11.811 : dpi === 600 ? 23.622 : dpi / MM_PER_INCH;
  return Math.round(mm * dpmm);
}

/**
 * Converts printer dots back to millimeters with configurable precision.
 */
export function dotsToMm(dots: number, dpi: number = 203, decimals: number = 2): number {
  if (isNaN(dots) || dots <= 0) return 0;
  const dpmm = dpi === 203 ? 8.0 : dpi === 300 ? 11.811 : dpi === 600 ? 23.622 : dpi / MM_PER_INCH;
  return Number((dots / dpmm).toFixed(decimals));
}

/**
 * Converts inches to millimeters.
 */
export function inchesToMm(inches: number): number {
  return Number((inches * MM_PER_INCH).toFixed(3));
}

/**
 * Converts millimeters to inches.
 */
export function mmToInches(mm: number): number {
  return Number((mm / MM_PER_INCH).toFixed(3));
}

/**
 * Converts value from given source unit to target unit.
 */
export function convertUnit(value: number, from: PhysicalUnit, to: PhysicalUnit): number {
  if (from === to) return value;
  if (from === 'inch' && to === 'mm') return inchesToMm(value);
  if (from === 'mm' && to === 'inch') return mmToInches(value);
  return value;
}

/**
 * Standard paper sizes in millimeters [width, height]
 */
export const STANDARD_PAPER_SIZES_MM: Record<string, { width: number; height: number; name: string }> = {
  a4: { width: 210, height: 297, name: 'A4 (210 × 297 mm)' },
  a5: { width: 148, height: 210, name: 'A5 (148 × 210 mm)' },
  letter: { width: 215.9, height: 279.4, name: 'US Letter (8.5 × 11 in)' },
  legal: { width: 215.9, height: 355.6, name: 'US Legal (8.5 × 14 in)' },
};

/**
 * Calculates dots for both dimensions [widthDots, heightDots]
 */
export function getDimensionsInDots(
  widthMm: number,
  heightMm: number,
  dpi: number = 203
): { widthDots: number; heightDots: number } {
  return {
    widthDots: mmToDots(widthMm, dpi),
    heightDots: mmToDots(heightMm, dpi),
  };
}
