import type { DataSourceFontOverride, ResolvedTextRun, TextElement } from '../types';

export interface ParagraphSegment {
  sourceId: string;
  text: string;
  x: number;
  y: number;
  width: number;
  renderWidth?: number;
  line: number;
  style: DataSourceFontOverride;
}

export type ParagraphMeasure = (text: string, style: DataSourceFontOverride) => number;
export type ParagraphGeometry = Pick<TextElement, 'width' | 'height' | 'fontSize' | 'lineHeight' | 'textAlign' |
  'orphanAlignment' | 'indentationMode' | 'indentationMm' | 'tabStops' | 'defaultTabIntervalMm' |
  'borderConfig' | 'verticalAlign' | 'verticalAlignment'>;
let context: CanvasRenderingContext2D | null = null;
const MM_PER_CSS_PIXEL = 25.4 / 96;
const MM_PER_POINT = 25.4 / 72;

export interface ParagraphInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function getParagraphInsets(element: Pick<ParagraphGeometry, 'borderConfig'>): ParagraphInsets {
  const border = element.borderConfig;
  const borderMm = border && border.type !== 'none' ? (border.thickness || 1) * 0.35 / (96 / 25.4) : 0;
  return {
    top: (border?.marginTop || 0) + borderMm,
    right: (border?.marginRight || 0) + borderMm,
    bottom: (border?.marginBottom || 0) + borderMm,
    left: (border?.marginLeft || 0) + borderMm,
  };
}

export const measureParagraphText: ParagraphMeasure = (text, style) => {
  const size = style.fontSize ?? 10;
  if (!context && typeof document !== 'undefined') context = document.createElement('canvas').getContext('2d');
  if (context) {
    context.font = `${style.fontStyle || 'normal'} ${style.fontWeight || 'normal'} ${size * 96 / 72}px ${style.fontFamily || 'Arial'}`;
    return context.measureText(text).width * MM_PER_CSS_PIXEL * (style.fontWidthScale ?? 100) / 100
      + Math.max(0, [...text].length - 1) * (style.letterSpacing ?? 0) * MM_PER_CSS_PIXEL;
  }
  return [...text].length * size * MM_PER_POINT * 0.55 * (style.fontWidthScale ?? 100) / 100;
};

function paragraphGlyphMetrics(text: string, style: DataSourceFontOverride) {
  const size = style.fontSize ?? 10;
  if (!context && typeof document !== 'undefined') context = document.createElement('canvas').getContext('2d');
  if (context) {
    context.font = `${style.fontStyle || 'normal'} ${style.fontWeight || 'normal'} ${size * 96 / 72}px ${style.fontFamily || 'Arial'}`;
    const metrics = context.measureText(text || 'Mg');
    const ascent = Number.isFinite(metrics.actualBoundingBoxAscent) ? metrics.actualBoundingBoxAscent : size * 96 / 72 * 0.8;
    const descent = Number.isFinite(metrics.actualBoundingBoxDescent) ? metrics.actualBoundingBoxDescent : size * 96 / 72 * 0.25;
    return { ascent: ascent * MM_PER_CSS_PIXEL, descent: descent * MM_PER_CSS_PIXEL };
  }
  const sizeMm = size * MM_PER_POINT;
  return { ascent: sizeMm * 0.8, descent: sizeMm * 0.25 };
}

const graphemeSegmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : null;

function graphemeCount(text: string) {
  return graphemeSegmenter
    ? Array.from(graphemeSegmenter.segment(text)).length
    : Array.from(text).length;
}

function paragraphWordCount(segments: ParagraphSegment[]) {
  const text = segments.map(segment => segment.text).join('').trim();
  return text ? text.split(/\s+/u).length : 0;
}

function wordGapEnds(segments: ParagraphSegment[]) {
  const gaps: number[] = [];
  let index = 0;
  while (index < segments.length) {
    if (!/^\s+$/u.test(segments[index].text)) {
      index++;
      continue;
    }
    let end = index;
    while (end + 1 < segments.length && /^\s+$/u.test(segments[end + 1].text)) end++;
    if (index > 0 && end < segments.length - 1) gaps.push(end);
    index = end + 1;
  }
  return gaps;
}

function justifyLine(segments: ParagraphSegment[], line: ParagraphLine, width: number) {
  const gaps = wordGapEnds(segments);
  if (!gaps.length) return false;
  const extraPerGap = Math.max(0, width - line.end) / gaps.length;
  let gapIndex = 0;
  let addedWidth = 0;
  segments.forEach((segment, index) => {
    segment.x += addedWidth;
    if (gaps[gapIndex] === index) {
      addedWidth += extraPerGap;
      gapIndex++;
    }
  });
  return true;
}

function distributeLineCharacters(segments: ParagraphSegment[], line: ParagraphLine, width: number) {
  if (!segments.length) return false;
  const counts = segments.map(segment => graphemeCount(segment.text));
  const contiguousBoundaries = segments.slice(0, -1).map((segment, index) =>
    Math.abs(segment.x + segment.width - segments[index + 1].x) < 0.001);
  let gaps = counts.reduce((sum, count) => sum + Math.max(0, count - 1), 0);
  gaps += contiguousBoundaries.filter(Boolean).length;
  if (!gaps) return false;
  const extraPerGap = Math.max(0, width - line.end) / gaps;
  let addedWidth = 0;
  segments.forEach((segment, index) => {
    segment.x += addedWidth;
    segment.renderWidth = segment.width + Math.max(0, counts[index] - 1) * extraPerGap;
    addedWidth += Math.max(0, counts[index] - 1) * extraPerGap;
    if (contiguousBoundaries[index]) addedWidth += extraPerGap;
  });
  return true;
}

interface ParagraphLine {
  y: number;
  height: number;
  baseline: number;
  start: number;
  end: number;
  ascent: number;
  descent: number;
  paragraph: number;
  paragraphEnd: boolean;
}

export function layoutParagraph(element: ParagraphGeometry, runs: ResolvedTextRun[], measure: ParagraphMeasure = measureParagraphText) {
  const width = Math.max(0.01, element.width);
  const indent = Math.min(width - 0.01, Math.max(0, element.indentationMm ?? 0));
  const firstStart = element.indentationMode === 'first-line' ? indent : 0;
  const continuationStart = element.indentationMode === 'hanging' ? indent : 0;
  const interval = Math.max(0.01, element.defaultTabIntervalMm ?? 12.7);
  const stops = [...(element.tabStops ?? [])].filter(stop => Number.isFinite(stop) && stop > 0).sort((left, right) => left - right);
  const defaultHeight = element.fontSize * MM_PER_POINT * (element.lineHeight || 1.15);
  const initialStyle = runs[0]?.style ?? { fontSize: element.fontSize };
  const initialMetrics = paragraphGlyphMetrics('Mg', initialStyle);
  const lines: ParagraphLine[] = [{
    y: 0,
    height: Math.max(defaultHeight, initialMetrics.ascent + initialMetrics.descent),
    baseline: 0,
    start: firstStart,
    end: firstStart,
    ascent: initialMetrics.ascent,
    descent: initialMetrics.descent,
    paragraph: 0,
    paragraphEnd: false,
  }];
  const segments: ParagraphSegment[] = [];
  let line = 0;
  let paragraphIndex = 0;
  let x = firstStart;
  let previousCR = false;
  const nextLine = (startsParagraph: boolean, style: DataSourceFontOverride) => {
    const current = lines[line];
    if (startsParagraph) current.paragraphEnd = true;
    line++;
    if (startsParagraph) paragraphIndex++;
    x = startsParagraph ? firstStart : continuationStart;
    const metrics = paragraphGlyphMetrics('Mg', style);
    lines.push({
      y: current.y + current.height,
      height: Math.max(defaultHeight, metrics.ascent + metrics.descent),
      baseline: 0,
      start: x,
      end: x,
      ascent: metrics.ascent,
      descent: metrics.descent,
      paragraph: paragraphIndex,
      paragraphEnd: false,
    });
  };
  const append = (text: string, run: ResolvedTextRun) => {
    const advance = measure(text, run.style);
    const sizeMm = (run.style.fontSize ?? element.fontSize) * MM_PER_POINT;
    const metrics = paragraphGlyphMetrics(text, run.style);
    lines[line].ascent = Math.max(lines[line].ascent, metrics.ascent);
    lines[line].descent = Math.max(lines[line].descent, metrics.descent);
    lines[line].height = Math.max(
      lines[line].height,
      sizeMm * (element.lineHeight || 1.15),
      lines[line].ascent + lines[line].descent,
    );
    segments.push({ sourceId: run.sourceId, text, x, y: 0, width: advance, line, style: run.style });
    x += advance;
    lines[line].end = x;
  };

  const appendUnbroken = (token: string, run: ResolvedTextRun) => {
    if (x + measure(token, run.style) <= width) {
      append(token, run);
      return;
    }
    if (x > lines[line].start) nextLine(false, run.style);
    const characters = Array.from(token);
    let offset = 0;
    while (offset < characters.length) {
      if (x > lines[line].start) nextLine(false, run.style);
      let end = offset;
      let candidate = '';
      while (end < characters.length) {
        const next = candidate + characters[end];
        if (x + measure(next, run.style) > width && candidate) break;
        candidate = next;
        end++;
        if (x + measure(candidate, run.style) > width) break;
      }
      append(candidate || characters[offset], run);
      offset = Math.max(offset + 1, end);
      if (offset < characters.length) nextLine(false, run.style);
    }
  };

  for (const run of runs) {
    const tokens = run.value.match(/\r\n|\r|\n|\t|[^\S\r\n\t]+|[^\s]+/gu) ?? [];
    for (const token of tokens) {
      if (token === '\n' && previousCR) { previousCR = false; continue; }
      previousCR = token === '\r';
      if (token === '\r' || token === '\n' || token === '\r\n') { nextLine(true, run.style); continue; }
      if (token === '\t') {
        x = stops.find(stop => stop > x + 1e-9) ?? (Math.floor(x / interval) + 1) * interval;
        lines[line].end = x;
        if (x >= width) nextLine(false, run.style);
        continue;
      }
      const printable = token.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
      if (!printable) continue;
      if (/^\s+$/u.test(printable)) {
        for (const character of Array.from(printable)) {
          const advance = measure(character, run.style);
          if (x + advance > width && x > lines[line].start) nextLine(false, run.style);
          append(character, run);
        }
        continue;
      }
      if (x + measure(printable, run.style) > width && x > lines[line].start) nextLine(false, run.style);
      appendUnbroken(printable, run);
    }
  }

  lines[line].paragraphEnd = true;
  let contentHeight = 0;
  for (const currentLine of lines) {
    currentLine.height = Math.max(currentLine.height, currentLine.ascent + currentLine.descent);
    currentLine.baseline = currentLine.y + currentLine.ascent
      + Math.max(0, currentLine.height - currentLine.ascent - currentLine.descent) / 2;
    contentHeight = currentLine.y + currentLine.height;
  }
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const currentLine = lines[lineIndex];
    const lineSegments = segments.filter(segment => segment.line === lineIndex);
    const textAlign = element.textAlign || 'left';
    let lineAlignment: 'left' | 'center' | 'right' = 'left';
    if (textAlign === 'justify') {
      if (currentLine.paragraphEnd) {
        lineAlignment = element.orphanAlignment === 'center' || element.orphanAlignment === 'right'
          ? element.orphanAlignment
          : 'left';
      } else if (justifyLine(lineSegments, currentLine, width)) {
        lineAlignment = 'left';
      }
    } else if (textAlign === 'distributed') {
      if (currentLine.paragraphEnd && paragraphWordCount(lineSegments) === 1) {
        lineAlignment = element.orphanAlignment === 'center' || element.orphanAlignment === 'right'
          ? element.orphanAlignment
          : 'left';
      } else {
        distributeLineCharacters(lineSegments, currentLine, width);
      }
    } else {
      lineAlignment = textAlign;
    }
    const extent = Math.max(currentLine.start, currentLine.end);
    const shift = lineAlignment === 'right'
      ? width - extent
      : lineAlignment === 'center'
      ? (width - extent) / 2
      : 0;
    for (const segment of lineSegments) {
      segment.x += shift;
      segment.y = currentLine.baseline;
    }
  }
  return { width, height: contentHeight, lines, segments };
}

export function measureParagraphLayout(element: ParagraphGeometry, runs: ResolvedTextRun[]) {
  const insets = getParagraphInsets(element);
  const contentWidth = Math.max(0.01, element.width - insets.left - insets.right);
  const layout = layoutParagraph({ ...element, width: contentWidth }, runs);
  return {
    insets,
    layout,
    width: element.width,
    height: layout.height + insets.top + insets.bottom,
  };
}

const escapeXml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export function paragraphSvg(element: TextElement, runs: ResolvedTextRun[]) {
  const measured = measureParagraphLayout(element, runs);
  const { insets, layout } = measured;
  const svgHeight = element.autoHeight === true ? Math.max(measured.height, element.height) : element.height;
  const contentHeight = Math.max(0.01, svgHeight - insets.top - insets.bottom);
  const overflow = layout.height > contentHeight + 0.01;
  const verticalAlignment = element.verticalAlign || element.verticalAlignment || 'top';
  const verticalOffset = verticalAlignment === 'middle'
    ? Math.max(0, (contentHeight - layout.height) / 2)
    : verticalAlignment === 'bottom'
    ? Math.max(0, contentHeight - layout.height)
    : 0;
  const body = layout.segments.map(segment => {
    const style = segment.style;
    const decoration = [style.underline ? 'underline' : '', style.strikeout ? 'line-through' : ''].filter(Boolean).join(' ') || 'none';
    return `<text data-source-id="${escapeXml(segment.sourceId)}" x="${segment.x + insets.left}" y="${segment.y + insets.top + verticalOffset}" font-family="${escapeXml(style.fontFamily || element.fontFamily)}" font-size="${(style.fontSize ?? element.fontSize) * MM_PER_POINT}" font-weight="${escapeXml(style.fontWeight || 'normal')}" font-style="${escapeXml(style.fontStyle || 'normal')}" fill="${escapeXml(style.color || element.color)}" text-decoration="${decoration}" textLength="${segment.renderWidth ?? segment.width}" lengthAdjust="${segment.renderWidth === undefined ? 'spacingAndGlyphs' : 'spacing'}" xml:space="preserve">${escapeXml(segment.text)}</text>`;
  }).join('');
  const overflowAttribute = overflow && element.autoHeight !== true ? ' overflow="visible"' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" data-paragraph-layout="native" data-text-align="${element.textAlign || 'left'}" width="100%" height="100%" viewBox="0 0 ${element.width} ${svgHeight}" preserveAspectRatio="none"${overflowAttribute}>${body}</svg>`;
}