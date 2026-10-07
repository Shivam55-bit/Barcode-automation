/**
 * BarcodeFlow Enterprise - Central Text Measurement Engine
 * 
 * Provides accurate, physical-dimension (mm) font measurement based on real browser/canvas font metrics.
 * Supports:
 * - Single-line tight auto-sizing
 * - Multi-line and paragraph text with word-wrapping reflow
 * - Font families, point sizes (pt), bold/italic weights, letter spacing, line heights
 * - HTML and Rich Text markup container strip/measurement
 * - Unicode special characters (©, ™, ₹, ±, ½, etc.)
 * - Subtle usability padding
 * - High performance LRU caching
 */

import { TextElement, BorderConfig, ResolvedTextRun, DataSourceFontOverride } from '../types';
import { getMultiLineLayoutValue, getSingleLineLayoutValue, decodeEditorControlCharacters } from './controlCharacterService';
import { evaluateTextElementRuns } from './dataSourceEngine';
import { getParagraphInsets, layoutParagraph, measureParagraphLayout, ParagraphGeometry } from './paragraphLayout';

export interface TextMeasurementParams {
  text: string;
  runs?: ResolvedTextRun[];
  fontFamily?: string;
  fontSize?: number; // In pt (standard points, 1 pt = 25.4 / 72 mm)
  fontWeight?: string | number; // 'normal' | 'bold' | '600' | '700' | '800'
  fontStyle?: string; // 'normal' | 'italic' | 'oblique'
  letterSpacing?: number; // In px or pt
  lineHeight?: number; // Multiplier, e.g. 1.15, 1.2
  fontWidthScale?: number; // Percentage, default 100%
  textType?: string;
  textFormatType?: 'single-line' | 'multi-line' | 'paragraph' | 'arc';
  multiline?: boolean;
  wrap?: boolean;
  containerWidthMm?: number; // For paragraph word-wrapping height calculation
  indentationMode?: TextElement['indentationMode'];
  indentationMm?: number;
  tabStops?: number[];
  defaultTabIntervalMm?: number;
  borderConfig?: BorderConfig;
  ignoreMinSize?: boolean; // When true, box hugs actual glyphs (no MIN_WIDTH/HEIGHT floor). Used during corner resize of single-line text.
}

export interface MeasuredDimensions {
  width: number; // In mm
  height: number; // In mm
  linesCount: number;
}

export interface TextFitResult {
  fontSize: number;
  fontWidthScale: number;
  fits: boolean;
  measured: MeasuredDimensions;
}

// 1 point (pt) = 25.4 / 72 mm ≈ 0.352778 mm
export const MM_PER_PT = 25.4 / 72;
// 1 mm in CSS pixels at standard 96 DPI = 96 / 25.4 ≈ 3.779528 px
export const PX_PER_MM = 96 / 25.4;
// 1 pt in CSS pixels = (96 / 72) = 1.333333 px
export const PX_PER_PT = 96 / 72;

// Usability padding in mm (~2-4 screen px at 100% zoom)
const HORIZONTAL_PADDING_MM = 0.8;
const VERTICAL_PADDING_MM = 0.6;

// Minimum selectable dimensions in mm so empty/single char text remains clickable
const MIN_WIDTH_MM = 5.0;
const MIN_HEIGHT_MM = 3.0;

// Singleton canvas & 2D context for high-performance measurement
let measurementCanvas: HTMLCanvasElement | null = null;
let measurementCtx: CanvasRenderingContext2D | null = null;

function getMeasurementContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!measurementCanvas) {
    measurementCanvas = document.createElement('canvas');
    measurementCanvas.width = 2000;
    measurementCanvas.height = 1000;
    measurementCtx = measurementCanvas.getContext('2d', { willReadFrequently: false });
  }
  return measurementCtx;
}

// Simple in-memory LRU cache
const measurementCache = new Map<string, MeasuredDimensions>();
const MAX_CACHE_SIZE = 1500;

function generateCacheKey(p: TextMeasurementParams): string {
  let fontLoadState = 'unavailable';
  if (typeof document !== 'undefined' && document.fonts) {
    const fontSizePx = (p.fontSize || 10) * PX_PER_PT;
    const fonts = [
      `${p.fontStyle || 'normal'} ${p.fontWeight || 'normal'} ${fontSizePx}px ${p.fontFamily || 'Arial, sans-serif'}`,
      ...(p.runs || []).map((run) => {
        const style = run.style;
        return `${style?.fontStyle || p.fontStyle || 'normal'} ${style?.fontWeight || p.fontWeight || 'normal'} ${(style?.fontSize || p.fontSize || 10) * PX_PER_PT}px ${style?.fontFamily || p.fontFamily || 'Arial, sans-serif'}`;
      }),
    ];
    try {
      fontLoadState = fonts.map((font) => document.fonts.check(font, p.text || 'M') ? 'ready' : document.fonts.status).join(',');
    } catch {
      fontLoadState = document.fonts.status;
    }
  }
  return [
    p.text || '',
    p.fontFamily || 'Arial',
    p.fontSize || 10,
    p.fontWeight || 'normal',
    p.fontStyle || 'normal',
    p.letterSpacing || 0,
    p.lineHeight || 1.15,
    p.fontWidthScale || 100,
    p.textType || 'single-line',
    p.textFormatType || 'single-line',
    p.multiline ? '1' : '0',
    p.wrap ? '1' : '0',
    p.containerWidthMm ? p.containerWidthMm.toFixed(1) : 'auto',
    p.borderConfig?.type || 'none',
    p.borderConfig?.thickness || 0,
    p.borderConfig?.marginLeft || 0,
    p.borderConfig?.marginRight || 0,
    p.borderConfig?.marginTop || 0,
    p.borderConfig?.marginBottom || 0,
    p.ignoreMinSize ? '1' : '0',
    p.runs ? p.runs.map((r) => `${r.sourceId}:${r.value}:${r.style?.fontFamily}:${r.style?.fontSize}:${r.style?.fontWeight}:${r.style?.fontStyle}:${r.style?.fontWidthScale}:${r.style?.letterSpacing}`).join(';') : '',
    fontLoadState,
  ].join('|');
}

function measuredGlyphAdvance(metrics: TextMetrics): number {
  const right = Number.isFinite(metrics.actualBoundingBoxRight) ? metrics.actualBoundingBoxRight : metrics.width;
  const leftOverhang = Number.isFinite(metrics.actualBoundingBoxLeft) ? Math.max(0, metrics.actualBoundingBoxLeft) : 0;
  return Math.max(metrics.width, right) + leftOverhang;
}

/**
 * Strips HTML / RTF tags for accurate glyph measurement of rich text containers.
 */
export function stripMarkupToPlainText(raw: string): string {
  if (!raw) return '';
  // Decode control character tokens to runtime characters first so they are never stripped as HTML tags
  const pre = decodeEditorControlCharacters(raw);
  if (pre.startsWith('{\\rtf')) {
    return pre
      .replace(/\{\\rtf1[^\\]*/g, '')
      .replace(/\\b\s*(.*?)\\b0/g, '$1')
      .replace(/\\i\s*(.*?)\\i0/g, '$1')
      .replace(/\\par/g, '\n')
      .replace(/[\{\}\\]/g, '')
      .trim();
  }
  if (/<[a-z][\s\S]*>/i.test(pre)) {
    return pre
      .replace(/<LineBreak\s*\/?>/gi, '\n')
      .replace(/<Run[^>]*Text=["']([^"']+)["'][^>]*\/?>(?:<\/Run>)?/gi, '$1')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');
  }
  return pre;
}

export function normalizeTextForObjectType(rawText: string, objectType?: string): string {
  const safeText = rawText ?? '';
  const normalizedType = (objectType || '').toLowerCase();
  const isSingleLineType = normalizedType === 'single-line' || normalizedType === 'singlelinetext' || normalizedType === 'single_line_text';
  const isMultiLineType = normalizedType === 'multi-line' || normalizedType === 'multilinetext' || normalizedType === 'multi_line_text' || normalizedType === 'paragraph';

  if (isSingleLineType) {
    return getSingleLineLayoutValue(safeText);
  }

  if (isMultiLineType) {
    return safeText;
  }

  return safeText;
}

export function isSingleLineTextElement(
  element?: Partial<TextElement> | null,
): boolean {
  if (!element) return false;

  const explicitType = (element.textType || '').toLowerCase();
  if (explicitType === 'single-line' || explicitType === 'singlelinetext' || explicitType === 'single_line_text') return true;
  if (explicitType === 'multi-line' || explicitType === 'multilinetext' || explicitType === 'multi_line_text' || explicitType === 'paragraph') return false;

  return !element.multiline && !element.wordWrap && !(element.textFormatType === 'paragraph' || element.textFormatType === 'multi-line');
}

export function isMultiLineTextElement(
  element?: Partial<TextElement> | null,
): boolean {
  if (!element) return false;

  const explicitType = (element.textType || '').toLowerCase();
  if (explicitType === 'multi-line' || explicitType === 'multilinetext' || explicitType === 'multi_line_text' || explicitType === 'paragraph') return true;
  if (explicitType === 'single-line' || explicitType === 'singlelinetext' || explicitType === 'single_line_text') return false;

  return !!(element.multiline || element.wordWrap || element.textFormatType === 'paragraph' || element.textFormatType === 'multi-line');
}

/**
 * Core text measurement function.
 * Measures text using actual browser font metrics and converts accurately to mm.
 */
export function measureTextObject(params: TextMeasurementParams): MeasuredDimensions {
  if (params.textFormatType === 'paragraph' || params.textType === 'paragraph') {
    const element: ParagraphGeometry = { width: params.containerWidthMm ?? 1_000_000, height: 0, fontSize: params.fontSize ?? 10,
      lineHeight: params.lineHeight, textAlign: 'left', indentationMode: params.indentationMode,
      indentationMm: params.indentationMm, tabStops: params.tabStops, defaultTabIntervalMm: params.defaultTabIntervalMm,
      borderConfig: params.borderConfig, verticalAlign: 'top', verticalAlignment: 'top' };
    const runs = params.runs ?? [{ sourceId: 'measurement', type: 'text' as const, value: params.text, style: {
      fontFamily: params.fontFamily, fontSize: params.fontSize, fontWeight: params.fontWeight as TextElement['fontWeight'],
      fontStyle: params.fontStyle as TextElement['fontStyle'], letterSpacing: params.letterSpacing, fontWidthScale: params.fontWidthScale } }];
    const measured = measureParagraphLayout(element, runs);
    const { layout, insets } = measured;
    const naturalWidth = Math.max(0.01, ...layout.segments.map(segment => segment.x + segment.width)) + insets.left + insets.right;
    const width = params.containerWidthMm ?? naturalWidth;
    return { width, height: measured.height, linesCount: layout.lines.length };
  }
  const rawText = params.text ?? '';
  const isMultiLine =
    params.textType === 'multi-line' ||
    params.multiline === true;
  const layoutText = isMultiLine
    ? getMultiLineLayoutValue(rawText)
    : getSingleLineLayoutValue(rawText);
  const cleanText = stripMarkupToPlainText(layoutText);
  const cacheKey = generateCacheKey({ ...params, text: cleanText });

  if (measurementCache.has(cacheKey)) {
    return measurementCache.get(cacheKey)!;
  }

  const fontFamily = params.fontFamily || 'Arial, sans-serif';
  const fontSizePt = Math.max(1, params.fontSize || 10);
  const fontWeight = params.fontWeight || 'normal';
  const fontStyle = params.fontStyle || 'normal';
  const letterSpacing = params.letterSpacing || 0;
  const lineHeightMult = params.lineHeight || 1.15;
  const fontWidthScale = (params.fontWidthScale || 100) / 100;

  const isParagraph = params.multiline && (params.wrap || (params.containerWidthMm !== undefined && params.containerWidthMm > 0));

  const fontSizePx = fontSizePt * PX_PER_PT;
  const fontCss = `${fontStyle} ${fontWeight} ${fontSizePx}px ${fontFamily}`;

  const ctx = getMeasurementContext();
  // When ignoreMinSize is set (corner-resize hug), let the box shrink to the
  // exact glyph size so tiny fonts don't leave empty space inside the box.
  const minW = params.ignoreMinSize ? 0 : MIN_WIDTH_MM;
  const minH = params.ignoreMinSize ? 0 : MIN_HEIGHT_MM;
  const horizontalPadding = params.ignoreMinSize ? 0 : HORIZONTAL_PADDING_MM;
  const verticalPadding = params.ignoreMinSize ? 0 : VERTICAL_PADDING_MM;
  let measuredWidthMm = minW;
  let measuredHeightMm = minH;
  let totalLines = 1;

  const baseLineHeightMm = fontSizePt * MM_PER_PT * lineHeightMult;

  let canvasLetterSpacing = false;
  if (ctx) {
    ctx.font = fontCss;
    try {
      if ('letterSpacing' in ctx) {
        (ctx as any).letterSpacing = `${letterSpacing}px`;
        canvasLetterSpacing = true;
      }
    } catch {
      // Ignore if letterSpacing is not supported in the canvas context
    }

    if (!cleanText || cleanText.trim().length === 0) {
      // Empty text fallback
      const m = ctx.measureText('M');
      measuredWidthMm = Math.max(minW, (m.width * fontWidthScale) / PX_PER_MM + horizontalPadding);
      measuredHeightMm = Math.max(minH, baseLineHeightMm + verticalPadding);
      totalLines = 1;
    } else if (isParagraph && params.containerWidthMm && params.containerWidthMm > MIN_WIDTH_MM) {
      // Paragraph Word-Wrapping reflow calculation
      const availWidthPx = Math.max(1, (params.containerWidthMm - horizontalPadding) * PX_PER_MM);
      const paragraphs = cleanText.split('\n');
      const wrappedLines: string[] = [];

      for (const para of paragraphs) {
        if (!para) {
          wrappedLines.push('');
          continue;
        }
        const words = para.split(' ');
        let currentLine = '';

        for (let i = 0; i < words.length; i++) {
          const testLine = currentLine ? `${currentLine} ${words[i]}` : words[i];
          const testMetrics = ctx.measureText(testLine);
          const testWidth = measuredGlyphAdvance(testMetrics) * fontWidthScale +
            (!canvasLetterSpacing && letterSpacing ? (testLine.length - 1) * letterSpacing : 0);

          if (testWidth > availWidthPx && currentLine) {
            wrappedLines.push(currentLine);
            currentLine = words[i];
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) {
          wrappedLines.push(currentLine);
        }
      }

      totalLines = Math.max(1, wrappedLines.length);
      measuredWidthMm = params.containerWidthMm;
      measuredHeightMm = Math.max(minH, totalLines * baseLineHeightMm + verticalPadding);
    } else if (params.runs && params.runs.length > 0 && params.runs.some((run) => {
      const style = run.style;
      return style && (
        (style.fontSize !== undefined && style.fontSize !== fontSizePt) ||
        (style.fontFamily !== undefined && style.fontFamily !== fontFamily) ||
        (style.fontWeight !== undefined && style.fontWeight !== fontWeight) ||
        (style.fontStyle !== undefined && style.fontStyle !== fontStyle) ||
        (style.fontWidthScale !== undefined && style.fontWidthScale !== params.fontWidthScale) ||
        (style.letterSpacing !== undefined && style.letterSpacing !== letterSpacing)
      );
    })) {
      // Mixed-font multi-line / single-line runs measurement
      interface RunSegment {
        text: string;
        style: DataSourceFontOverride;
      }
      const lines: RunSegment[][] = [[]];

      for (const run of params.runs) {
        const runVal = isMultiLine
          ? getMultiLineLayoutValue(run.value)
          : getSingleLineLayoutValue(run.value);
        const parts = runVal.split('\n');
        for (let i = 0; i < parts.length; i++) {
          if (i > 0) {
            lines.push([]);
          }
          if (parts[i].length > 0) {
            lines[lines.length - 1].push({ text: parts[i], style: run.style });
          }
        }
      }

      totalLines = Math.max(1, lines.length);
      let maxLineWidthPx = 0;
      let totalHeightMm = 0;

      for (const line of lines) {
        let lineW = 0;
        let maxFontSizeInLine = fontSizePt;

        if (line.length === 0) {
          const m = ctx.measureText('M');
          lineW = m.width * fontWidthScale;
        } else {
          for (const seg of line) {
            const segSize = Math.max(1, seg.style?.fontSize || fontSizePt);
            if (segSize > maxFontSizeInLine) maxFontSizeInLine = segSize;
            const segFontCss = `${seg.style?.fontStyle || 'normal'} ${seg.style?.fontWeight || 'normal'} ${segSize * PX_PER_PT}px ${seg.style?.fontFamily || fontFamily}`;
            ctx.font = segFontCss;
            const segLetterSpacing = seg.style?.letterSpacing ?? letterSpacing;
            if (canvasLetterSpacing) (ctx as any).letterSpacing = `${segLetterSpacing}px`;
            const m = ctx.measureText(seg.text);
            const segScale = (seg.style?.fontWidthScale || 100) / 100;
            lineW += measuredGlyphAdvance(m) * segScale +
              (!canvasLetterSpacing && segLetterSpacing ? Math.max(0, seg.text.length - 1) * segLetterSpacing : 0);
          }
        }

        if (lineW > maxLineWidthPx) {
          maxLineWidthPx = lineW;
        }
        totalHeightMm += maxFontSizeInLine * MM_PER_PT * lineHeightMult;
      }

      measuredWidthMm = Math.max(minW, (maxLineWidthPx / PX_PER_MM) + horizontalPadding);
      measuredHeightMm = Math.max(minH, totalHeightMm + verticalPadding);
      ctx.font = fontCss;
    } else {
      // Single-line or standard explicit multi-line (split by \n)
      const lines = cleanText.split('\n');
      totalLines = lines.length;
      let maxLineWidthPx = 0;

      for (const line of lines) {
        const lineStr = line || ' ';
        const metrics = ctx.measureText(lineStr);
        let lineWidth = measuredGlyphAdvance(metrics) * fontWidthScale;
        if (!canvasLetterSpacing && letterSpacing && lineStr.length > 1) {
          lineWidth += (lineStr.length - 1) * letterSpacing;
        }
        if (lineWidth > maxLineWidthPx) {
          maxLineWidthPx = lineWidth;
        }
      }

      measuredWidthMm = Math.max(minW, (maxLineWidthPx / PX_PER_MM) + horizontalPadding);
      measuredHeightMm = Math.max(minH, (totalLines * baseLineHeightMm) + verticalPadding);
    }
  } else {
    // Fallback if canvas context is unavailable (e.g. unit tests / SSR)
    const weightMultiplier =
      fontWeight === 'bold' || fontWeight === '700' || fontWeight === '800' || fontWeight === '900' ? 1.08 : 1.0;
    const approxCharWidthMm = fontSizePt * MM_PER_PT * 0.55 * fontWidthScale * weightMultiplier;

    if (isParagraph && params.containerWidthMm && params.containerWidthMm > MIN_WIDTH_MM) {
      const availCharsPerLine = Math.max(1, Math.floor((params.containerWidthMm - horizontalPadding) / approxCharWidthMm));
      const words = cleanText ? cleanText.split(/\s+/) : ['M'];
      const wrappedLines: string[] = [];
      let currentLine = '';
      for (const w of words) {
        const test = currentLine ? `${currentLine} ${w}` : w;
        if (test.length > availCharsPerLine && currentLine) {
          wrappedLines.push(currentLine);
          currentLine = w;
        } else {
          currentLine = test;
        }
      }
      if (currentLine) wrappedLines.push(currentLine);
      totalLines = Math.max(1, wrappedLines.length);
      measuredWidthMm = params.containerWidthMm;
      measuredHeightMm = Math.max(minH, (totalLines * baseLineHeightMm) + verticalPadding);
    } else {
      const lines = cleanText ? cleanText.split('\n') : ['M'];
      totalLines = lines.length;
      const maxLineWidthMm = Math.max(approxCharWidthMm, ...lines.map((line) =>
        line.length * approxCharWidthMm + Math.max(0, line.length - 1) * letterSpacing / PX_PER_MM
      ));
      measuredWidthMm = Math.max(minW, maxLineWidthMm + horizontalPadding);
      measuredHeightMm = Math.max(minH, (totalLines * baseLineHeightMm) + verticalPadding);
    }
  }

  // Add border margins / border thickness if configured
  if (params.borderConfig && params.borderConfig.type && params.borderConfig.type !== 'none') {
    const b = params.borderConfig;
    const extraH = (b.marginLeft || 0) + (b.marginRight || 0) + (b.thickness ? b.thickness * MM_PER_PT * 2 : 0);
    const extraV = (b.marginTop || 0) + (b.marginBottom || 0) + (b.thickness ? b.thickness * MM_PER_PT * 2 : 0);
    measuredWidthMm += extraH;
    measuredHeightMm += extraV;
  }

  const result: MeasuredDimensions = {
    width: measuredWidthMm,
    height: measuredHeightMm,
    linesCount: totalLines,
  };

  if (measurementCache.size >= MAX_CACHE_SIZE) {
    const firstKey = measurementCache.keys().next().value;
    if (firstKey) measurementCache.delete(firstKey);
  }
  measurementCache.set(cacheKey, result);

  return result;
}

/**
 * Calculates updated dimensions for a TextElement based on its current properties and resolved display content.
 * Single-line with 'auto-width' hugs the measured text bounds.
 * Single-line with 'fixed-width' preserves user-specified width.
 * Multi-line maintains its user-controlled layout rectangle (width & height) without silent collapse.
 */
export function recalculateTextElementDimensions(
  element: TextElement,
  resolvedText?: string,
  targetContainerWidth?: number,
  resolvedRuns?: ResolvedTextRun[],
): { width: number; height: number } {
  const textToMeasure = resolvedText !== undefined ? resolvedText : element.text || '';
  const isMultiLine =
    element.textType === 'multi-line' ||
    element.textType === 'paragraph' ||
    element.multiline ||
    element.textFormatType === 'paragraph';
  const autoHeight = isMultiLine && (element.autoHeight ?? element.autoSize === true);

  // For multi-line text objects with established dimensions, preserve user-controlled layout box
  if (isMultiLine && !autoHeight && element.width > 0 && element.height > 0) {
    return {
      width: targetContainerWidth || element.width,
      height: element.height,
    };
  }

  // For single-line text with fixed-width sizing mode, preserve width
  if (!isMultiLine && (element.sizingMode === 'fixed-width' || element.autoSize === false) && element.width > 0) {
    return {
      width: targetContainerWidth || element.width,
      height: element.height > 0 ? element.height : 6,
    };
  }

  const runs = resolvedRuns ?? (element.dataSources && element.dataSources.length > 0
    ? evaluateTextElementRuns(element as TextElement)
    : undefined);

  const dims = measureTextObject({
    text: textToMeasure,
    runs,
    indentationMode: element.indentationMode,
    indentationMm: element.indentationMm,
    tabStops: element.tabStops,
    defaultTabIntervalMm: element.defaultTabIntervalMm,
    fontFamily: element.fontFamily,
    fontSize: element.fontSize,
    fontWeight: element.fontWeight,
    fontStyle: element.fontStyle,
    letterSpacing: element.letterSpacing,
    lineHeight: element.lineHeight,
    fontWidthScale: element.fontWidthScale || 100,
    textType: element.textType,
    textFormatType: element.textFormatType,
    multiline: isMultiLine,
    wrap: element.wrap || element.wordWrap,
    containerWidthMm: isMultiLine && element.sizingMode !== 'auto-width' ? (targetContainerWidth || element.width) : undefined,
    borderConfig: element.borderConfig,
    ignoreMinSize: !isMultiLine,
  });

  return {
    width: isMultiLine && element.sizingMode !== 'auto-width' && element.width > 0 ? (targetContainerWidth || element.width) : dims.width,
    height: isMultiLine && !autoHeight && element.height > 0 ? element.height : dims.height,
  };
}

export function isTextFitToBoxEnabled(element: TextElement): boolean {
  if (element.sizingMode) {
    return element.sizingMode === 'fit-to-box' || element.sizingMode === 'shrink-to-fit';
  }
  return element.autoSizeConfig?.enabled === true || element.autoFit === true;
}

export function convertTextElementFormat(
  element: TextElement,
  format: 'single-line' | 'paragraph',
  resolvedText = element.text,
  resolvedRuns?: ResolvedTextRun[],
): Partial<TextElement> {
  const isParagraph = element.textType === 'multi-line' || element.textType === 'paragraph' ||
    element.multiline === true || element.textFormatType === 'paragraph';
  const runs = resolvedRuns ?? (element.dataSources?.length ? evaluateTextElementRuns(element) : undefined);
  const fittingEnabled = isTextFitToBoxEnabled(element);

  if (format === 'single-line') {
    const formatUpdates: Partial<TextElement> = {
      textType: 'single-line',
      textFormatType: 'single-line',
      multiline: false,
      wordWrap: false,
      wrap: false,
      autoHeight: false,
    };
    if (fittingEnabled) return formatUpdates;

    const singleLineElement: TextElement = {
      ...element,
      ...formatUpdates,
      sizingMode: 'auto-width',
      autoSize: true,
      autoFit: false,
    };
    const dimensions = recalculateTextElementDimensions(singleLineElement, resolvedText, undefined, runs);
    return {
      ...formatUpdates,
      sizingMode: 'auto-width',
      autoSize: true,
      autoFit: false,
      autoSizeConfig: element.autoSizeConfig
        ? { ...element.autoSizeConfig, enabled: false }
        : undefined,
      paragraphWidth: isParagraph ? element.paragraphWidth ?? element.width : element.paragraphWidth,
      width: dimensions.width,
      height: dimensions.height,
    };
  }

  const paragraphWidth = element.paragraphWidth && element.paragraphWidth > 0
    ? element.paragraphWidth
    : element.width;
  const formatUpdates: Partial<TextElement> = {
    textType: 'paragraph',
    textFormatType: 'paragraph',
    multiline: true,
    wordWrap: true,
    wrap: true,
    paragraphWidth,
  };
  if (fittingEnabled) {
    return {
      ...formatUpdates,
      autoHeight: false,
    };
  }

  const dimensions = measureTextObject({
    text: resolvedText,
    runs,
    fontFamily: element.fontFamily,
    fontSize: element.fontSize,
    fontWeight: element.fontWeight,
    fontStyle: element.fontStyle,
    letterSpacing: element.letterSpacing,
    lineHeight: element.lineHeight,
    fontWidthScale: element.fontWidthScale || 100,
    textType: 'paragraph',
    textFormatType: 'paragraph',
    multiline: true,
    wrap: true,
    containerWidthMm: paragraphWidth,
    indentationMode: element.indentationMode,
    indentationMm: element.indentationMm,
    tabStops: element.tabStops,
    defaultTabIntervalMm: element.defaultTabIntervalMm,
    borderConfig: element.borderConfig,
  });
  return {
    ...formatUpdates,
    sizingMode: 'fixed-width',
    autoSize: false,
    autoFit: false,
    autoHeight: true,
    autoSizeConfig: element.autoSizeConfig
      ? { ...element.autoSizeConfig, enabled: false }
      : undefined,
    width: paragraphWidth,
    height: dimensions.height,
  };
}

export function scaleTextRunsForFit(
  element: TextElement,
  runs: ResolvedTextRun[] | undefined,
  fontSize: number,
  fontWidthScale: number,
): ResolvedTextRun[] | undefined {
  if (!runs?.length) return runs;
  const sourceSize = Math.max(0.01, element.fontSize || 10);
  const sourceWidthScale = Math.max(0.01, element.fontWidthScale || 100);
  return runs.map(run => ({
    ...run,
    style: {
      ...run.style,
      fontSize: (run.style.fontSize ?? sourceSize) * fontSize / sourceSize,
      fontWidthScale: (run.style.fontWidthScale ?? sourceWidthScale) * fontWidthScale / sourceWidthScale,
    },
  }));
}

export function fitTextToBox(
  element: TextElement,
  resolvedText = element.text ?? '',
  runs?: ResolvedTextRun[],
): TextFitResult {
  const config = element.autoSizeConfig;
  const requestedMinFontSize = Math.max(1, Math.min(720,
    config?.minFontSize ?? element.minFontSize ?? 1));
  const requestedMaxFontSize = Math.max(requestedMinFontSize, Math.min(720,
    config?.maxFontSize ?? element.maxFontSize ?? 720));
  const baseFontSize = Math.max(0.01, element.fontSize || 10);
  const isShrinkToFit = element.sizingMode === 'shrink-to-fit';
  const maxFontSize = isShrinkToFit ? Math.min(requestedMaxFontSize, baseFontSize) : requestedMaxFontSize;
  const minFontSize = isShrinkToFit ? Math.min(requestedMinFontSize, maxFontSize) : requestedMinFontSize;
  const minWidthScale = Math.max(25, Math.min(200,
    config?.minWidthScale ?? element.minWidthScale ?? 100));
  const maxWidthScale = Math.max(minWidthScale, Math.max(25, Math.min(200,
    config?.maxWidthScale ?? element.maxWidthScale ?? 100)));
  const baseWidthScale = Math.max(0.01, element.fontWidthScale || 100);
  const multiline = isMultiLineTextElement(element);

  const measure = (fontSize: number, fontWidthScale: number) => {
    const fittedRuns = scaleTextRunsForFit(element, runs, fontSize, fontWidthScale);
    return measureTextObject({
      text: resolvedText,
      runs: fittedRuns,
      fontFamily: element.fontFamily,
      fontSize,
      fontWeight: element.fontWeight,
      fontStyle: element.fontStyle,
      letterSpacing: element.letterSpacing,
      lineHeight: element.lineHeight,
      fontWidthScale,
      textType: multiline ? 'paragraph' : 'single-line',
      textFormatType: multiline ? 'paragraph' : 'single-line',
      multiline,
      wrap: multiline && element.wrap !== false && element.wordWrap !== false,
      containerWidthMm: multiline ? element.width : undefined,
      borderConfig: element.borderConfig,
      ignoreMinSize: true,
    });
  };
  const fits = (dimensions: MeasuredDimensions) =>
    dimensions.width <= element.width + 1e-6 && dimensions.height <= element.height + 1e-6;

  if (!resolvedText.trim()) {
    const fontSize = Math.max(minFontSize, Math.min(maxFontSize, baseFontSize));
    const fontWidthScale = Math.max(minWidthScale, Math.min(maxWidthScale, baseWidthScale));
    const measured = measure(fontSize, fontWidthScale);
    return { fontSize, fontWidthScale, fits: fits(measured), measured };
  }

  const largestFittingWidthScale = (fontSize: number) => {
    let low = minWidthScale;
    let high = maxWidthScale;
    const minimumMeasure = measure(fontSize, low);
    if (!fits(minimumMeasure)) return { fontWidthScale: low, measured: minimumMeasure, fits: false };
    const maximumMeasure = measure(fontSize, high);
    if (fits(maximumMeasure)) return { fontWidthScale: high, measured: maximumMeasure, fits: true };
    let best = minimumMeasure;
    for (let iteration = 0; iteration < 18; iteration++) {
      const middle = (low + high) / 2;
      const dimensions = measure(fontSize, middle);
      if (fits(dimensions)) {
        low = middle;
        best = dimensions;
      } else {
        high = middle;
      }
    }
    const finalScale = Math.min(maxWidthScale, low);
    const finalMeasure = measure(fontSize, finalScale);
    return { fontWidthScale: finalScale, measured: finalMeasure, fits: fits(finalMeasure) };
  };

  let low = minFontSize;
  let high = maxFontSize;
  let best = largestFittingWidthScale(low);
  if (best.fits && largestFittingWidthScale(maxFontSize).fits) {
    low = maxFontSize;
  } else if (best.fits) {
    for (let iteration = 0; iteration < 24; iteration++) {
      const middle = (low + high) / 2;
      const candidate = largestFittingWidthScale(middle);
      if (candidate.fits) {
        low = middle;
        best = candidate;
      } else {
        high = middle;
      }
    }
  }

  const fontSize = Math.floor(low * 1000) / 1000;
  best = largestFittingWidthScale(fontSize);
  return {
    fontSize,
    fontWidthScale: Math.floor(best.fontWidthScale * 1000) / 1000,
    fits: best.fits,
    measured: best.measured,
  };
}

export function getArcTextPath(element: TextElement): string {
  const radius = Math.max(0.5, element.arcConfig?.radius ?? element.arcRadius ?? 50);
  const start = element.arcConfig?.startAngle ?? element.arcStartAngle ?? 0;
  const sweep = Math.max(0, Math.min(360, element.arcConfig?.sweepAngle ?? element.arcSweepAngle ?? 180));
  const direction = (element.arcConfig?.direction ?? element.arcDirection) === 'counter-clockwise' ? -1 : 1;
  const normalize = (angle: number) => (angle % 360 + 360) % 360;
  const angles = [start, start + direction * sweep];
  for (const cardinal of [0, 90, 180, 270]) {
    if (normalize(direction * (cardinal - start)) <= sweep) angles.push(cardinal);
  }
  const horizontal = angles.map(angle => radius * Math.cos(angle * Math.PI / 180));
  const vertical = angles.map(angle => radius * Math.sin(angle * Math.PI / 180));
  const centerX = element.width / 2 - (Math.min(...horizontal) + Math.max(...horizontal)) / 2;
  const centerY = element.height / 2 - (Math.min(...vertical) + Math.max(...vertical)) / 2;
  const pointAt = (angle: number) => `${centerX + radius * Math.cos(angle * Math.PI / 180)},${centerY + radius * Math.sin(angle * Math.PI / 180)}`;
  let path = `M ${pointAt(start)}`;
  const segments = Math.max(1, Math.ceil(sweep / 180));
  for (let segment = 1; segment <= segments; segment++) {
    path += ` A ${radius},${radius} 0 0 ${direction === 1 ? 1 : 0} ${pointAt(start + direction * sweep * segment / segments)}`;
  }
  return path;
}

export function getArcTextSvg(element: TextElement, text: string): string {
  const arc = element.arcConfig;
  const pathId = `arc-text-${encodeURIComponent(element.id)}`;
  const alignment = element.textAlign || 'center';
  const textAnchor = alignment === 'left' ? 'start' : alignment === 'right' ? 'end' : 'middle';
  const startOffset = alignment === 'left' ? '0%' : alignment === 'right' ? '100%' : '50%';
  const escapeXml = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
  const fontSize = (element.fontSize || 10) * MM_PER_PT;
  const letterSpacing = (arc?.characterSpacing ?? element.arcCharacterSpacing ?? 1) * MM_PER_PT;
  const insidePath = arc?.insidePath ?? !!element.arcInsidePath;
  return `<svg xmlns="http://www.w3.org/2000/svg" data-arc-text="native" width="100%" height="100%" viewBox="0 0 ${element.width} ${element.height}" preserveAspectRatio="xMidYMid meet"><defs><path id="${pathId}" d="${getArcTextPath(element)}"/></defs><text fill="${element.whiteOnBlack ? '#ffffff' : escapeXml(element.color || '#000000')}" font-family="${escapeXml(element.fontFamily || 'Arial, sans-serif')}" font-size="${fontSize}" font-weight="${escapeXml(element.fontWeight || 'normal')}" font-style="${escapeXml(element.fontStyle || 'normal')}" letter-spacing="${letterSpacing}" dy="${insidePath ? fontSize : 0}"><textPath href="#${pathId}" startOffset="${startOffset}" text-anchor="${textAnchor}">${escapeXml(text)}</textPath></text></svg>`;
}
