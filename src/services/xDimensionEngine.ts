import { BarcodeSymbology } from '../types';
import { getSymbologyDefinition } from './barcodeCapabilityRegistry';

export type XDimensionUnit = 'mm' | 'mils' | 'auto';

export interface BarSpaceAdjustment {
  mode: 'none' | 'reduceBar' | 'increaseBar';
  dots: number;
}

export interface XDimensionCalculationResult {
  targetXmm: number;
  targetXMm: number;
  actualDots: number;
  dots: number;
  actualXmm: number;
  actualXMm: number;
  actualXMils: number;
  dpi: number;
  displayValue: string;
  unit: XDimensionUnit;
}

/**
 * Converts millimeter value to mils (thousandths of an inch).
 */
export function mmToMils(mm: number): number {
  return (mm / 25.4) * 1000;
}

/**
 * Converts mils to millimeters.
 */
export function milsToMm(mils: number): number {
  return (mils / 1000) * 25.4;
}

/**
 * Calculates printer-realizable Actual X Dimension based on target X and active device DPI.
 */
export function calculateActualXDimension(
  targetXmm: number,
  dpi: number = 203,
  unit: XDimensionUnit = 'auto'
): XDimensionCalculationResult {
  const safeDpi = dpi > 0 ? dpi : 203;
  const safeTarget = Math.max(0.05, targetXmm || 0.36);

  // Exact dots on target thermal/laser printhead
  const exactDots = (safeTarget / 25.4) * safeDpi;
  const actualDots = Math.max(1, Math.round(exactDots));
  const actualXmm = (actualDots / safeDpi) * 25.4;

  let displayValue: string;
  if (unit === 'mils') {
    displayValue = `${mmToMils(safeTarget).toFixed(2)} mils`;
  } else {
    displayValue = `${safeTarget.toFixed(unit === 'auto' ? 2 : 3)} mm`;
  }

  return {
    targetXmm: safeTarget,
    targetXMm: safeTarget,
    actualDots,
    dots: actualDots,
    actualXmm,
    actualXMm: actualXmm,
    actualXMils: mmToMils(actualXmm),
    dpi: safeDpi,
    displayValue,
    unit,
  };
}

/**
 * Dynamically computes barcode density (characters per millimeter).
 */
export function calculateBarcodeDensity(
  symbologyOrParams: BarcodeSymbology | string | { symbology: BarcodeSymbology | string; data: string; xDimensionMm: number; ratio?: number | string },
  data?: string,
  xDimensionMm?: number,
  ratio?: number | string
): number {
  let sym: BarcodeSymbology | string;
  let strData: string;
  let xDim: number;
  let r: number | string | undefined;

  if (typeof symbologyOrParams === 'object' && symbologyOrParams !== null) {
    sym = symbologyOrParams.symbology;
    strData = symbologyOrParams.data;
    xDim = symbologyOrParams.xDimensionMm;
    r = symbologyOrParams.ratio;
  } else {
    sym = symbologyOrParams as BarcodeSymbology | string;
    strData = data || '';
    xDim = xDimensionMm || 0;
    r = ratio;
  }

  const def = getSymbologyDefinition(sym);
  if (def.is2D || !def.supportsDensity || !strData || xDim <= 0) {
    return 0;
  }

  const charCount = strData.length || 1;
  const numRatio = typeof r === 'number' ? r : 2.5;

  // Estimate total module count based on symbology structure
  let totalModules = 0;
  switch (sym) {
    case 'code128':
    case 'gs1-128':
      // Start (11) + Data (11 * chars) + Check (11) + Stop (13) + Quiet zones (20)
      totalModules = 11 + charCount * 11 + 11 + 13 + 20;
      break;
    case 'code39':
      // Start/Stop '*' (3 wide + 6 narrow = 3*R + 6 per char) + intercharacter spaces
      const charModules = 3 * numRatio + 6 + 1;
      totalModules = (charCount + 2) * charModules + 20;
      break;
    case 'ean13':
    case 'upca':
      // 95 modules + 22 quiet
      totalModules = 95 + 22;
      break;
    case 'ean8':
      totalModules = 67 + 14;
      break;
    case 'itf14':
    case 'interleaved2of5':
      // Start (4) + pairs * (2*R + 3) + Stop (R + 2)
      totalModules = 4 + (charCount / 2) * (2 * numRatio + 3 * 2) + (numRatio + 2) + 20;
      break;
    default:
      totalModules = charCount * 11 + 35;
      break;
  }

  const physicalWidthMm = totalModules * xDimensionMm;
  if (physicalWidthMm <= 0) return 0;

  const density = charCount / physicalWidthMm;
  return parseFloat(density.toFixed(3));
}

/**
 * Calculates optimal X Dimension to fit a target barcode width.
 */
export function autoFitXDimensionToWidth(
  availableWidthMm: number,
  symbology: BarcodeSymbology | string,
  data: string,
  minXmm: number = 0.15,
  maxXmm: number = 2.5
): number {
  const def = getSymbologyDefinition(symbology);
  const charCount = Math.max(1, data?.length || 8);

  let totalModules = 100;
  if (def.is2D) {
    totalModules = symbology === 'datamatrix' ? 24 : 33;
  } else if (symbology === 'code128' || symbology === 'gs1-128') {
    totalModules = 11 + charCount * 11 + 11 + 13 + 20;
  } else if (symbology === 'ean13' || symbology === 'upca') {
    totalModules = 117;
  } else {
    totalModules = charCount * 12 + 30;
  }

  const calculatedX = availableWidthMm / totalModules;
  const clampedX = Math.min(maxXmm, Math.max(minXmm, calculatedX));
  return parseFloat(clampedX.toFixed(3));
}

export interface AutoSizeXDimensionParams {
  symbology: BarcodeSymbology | string;
  data: string;
  requestedWidthMm: number;
  minXMm: number;
  maxXMm: number;
  ratio?: number;
  printerDpi?: number;
}

export interface AutoSizeXDimensionResult {
  targetXMm: number;
  actualXMm: number;
  actualDots: number;
  totalWidthMm: number;
}

export function calculateAutoSizeXDimension(params: AutoSizeXDimensionParams): AutoSizeXDimensionResult {
  const { symbology, data, requestedWidthMm, minXMm, maxXMm, ratio = 2.5, printerDpi = 203 } = params;
  const def = getSymbologyDefinition(symbology);
  const charCount = Math.max(1, data?.length || 8);

  let totalModules = 100;
  if (def.is2D) {
    totalModules = symbology === 'datamatrix' ? 24 : 33;
  } else if (symbology === 'code128' || symbology === 'gs1-128') {
    totalModules = 11 + charCount * 11 + 11 + 13 + 20;
  } else if (symbology === 'code39') {
    totalModules = (charCount + 2) * (3 * ratio + 7) + 20;
  } else if (symbology === 'ean13' || symbology === 'upca') {
    totalModules = 117;
  } else {
    totalModules = charCount * 12 + 30;
  }

  const rawX = requestedWidthMm / totalModules;
  const clampedX = Math.min(maxXMm, Math.max(minXMm, rawX));
  const quantized = calculateActualXDimension(clampedX, printerDpi);

  return {
    targetXMm: clampedX,
    actualXMm: quantized.actualXmm,
    actualDots: quantized.actualDots,
    totalWidthMm: totalModules * quantized.actualXmm,
  };
}

/**
 * Performs print compensation adjustment on nominal bar/space widths.
 */
export function applyBarSpacePrintCompensation(
  barWidthDots: number,
  spaceWidthDots: number,
  adjustment: BarSpaceAdjustment
): { barDots: number; spaceDots: number } {
  if (!adjustment || adjustment.mode === 'none' || !adjustment.dots) {
    return { barDots: barWidthDots, spaceDots: spaceWidthDots };
  }

  let barDots = barWidthDots;
  let spaceDots = spaceWidthDots;

  if (adjustment.mode === 'reduceBar') {
    barDots = Math.max(1, barWidthDots - adjustment.dots);
    spaceDots = spaceWidthDots + adjustment.dots;
  } else if (adjustment.mode === 'increaseBar') {
    barDots = barWidthDots + adjustment.dots;
    spaceDots = Math.max(1, spaceWidthDots - adjustment.dots);
  }

  return { barDots, spaceDots };
}
