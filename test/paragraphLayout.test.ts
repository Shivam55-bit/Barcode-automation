import assert from 'node:assert/strict';
import test from 'node:test';
import type { ResolvedTextRun, TextElement } from '../src/types';
import { layoutParagraph, paragraphSvg } from '../src/services/paragraphLayout';
import {
  getArcTextSvg,
  getArcTextPath,
  normalizeTextForObjectType,
  measureTextObject,
  recalculateTextElementDimensions,
} from '../src/services/textMeasurementEngine';

const fixture = "errorCode:\n'EXCEL_INVALID_WORKBOOK',\nerror: 'Workbook metadata'";

function paragraph(overrides: Partial<TextElement> = {}): TextElement {
  return {
    id: 'paragraph-test',
    name: 'Paragraph Test',
    type: 'text',
    text: fixture,
    textType: 'multi-line',
    textFormatType: 'paragraph',
    multiline: true,
    wrap: true,
    wordWrap: true,
    sizingMode: 'fixed-width',
    autoSize: false,
    autoHeight: true,
    fontFamily: 'Arial',
    fontSize: 10,
    fontWeight: 'normal',
    fontStyle: 'normal',
    textDecoration: 'none',
    textAlign: 'left',
    verticalAlign: 'top',
    color: '#000000',
    lineHeight: 1.2,
    letterSpacing: 0,
    x: 17,
    y: 23,
    width: 38,
    height: 10,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 1,
    ...overrides,
  } as TextElement;
}

function run(value: string): ResolvedTextRun {
  return { sourceId: 'test', type: 'text', value, style: { fontFamily: 'Arial', fontSize: 10, fontWeight: 'normal' } };
}

test('fixed-width auto-height paragraphs reflow while preserving width, font, and source text', () => {
  const element = paragraph({ width: 64, height: 10 });
  const wide = measureTextObject({
    text: fixture,
    fontFamily: element.fontFamily,
    fontSize: element.fontSize,
    fontWeight: element.fontWeight,
    lineHeight: element.lineHeight,
    textType: 'paragraph',
    textFormatType: 'paragraph',
    multiline: true,
    wrap: true,
    containerWidthMm: 64,
  });
  const narrow = measureTextObject({
    text: fixture,
    fontFamily: element.fontFamily,
    fontSize: element.fontSize,
    fontWeight: element.fontWeight,
    lineHeight: element.lineHeight,
    textType: 'paragraph',
    textFormatType: 'paragraph',
    multiline: true,
    wrap: true,
    containerWidthMm: 26,
  });
  const recalculated = recalculateTextElementDimensions({ ...element, width: 26 }, fixture);

  assert.ok(narrow.height > wide.height, 'narrower width increases paragraph height');
  assert.equal(recalculated.width, 26);
  assert.equal(recalculated.height, narrow.height);
  assert.equal(element.fontSize, 10);
  assert.deepEqual([element.x, element.y], [17, 23]);
  assert.equal(normalizeTextForObjectType(fixture, 'multi-line'), fixture);
});

test('explicit fixed-height paragraphs retain their box and visibly report overflow', () => {
  const element = paragraph({ width: 24, height: 4, autoHeight: false });
  const measured = measureTextObject({
    text: fixture,
    fontFamily: element.fontFamily,
    fontSize: element.fontSize,
    lineHeight: element.lineHeight,
    textType: 'paragraph',
    textFormatType: 'paragraph',
    multiline: true,
    wrap: true,
    containerWidthMm: element.width,
  });
  const fixed = recalculateTextElementDimensions(element, fixture);
  const markup = paragraphSvg(element, [run(fixture)]);

  assert.ok(measured.height > element.height);
  assert.equal(fixed.height, element.height);
  assert.match(markup, /overflow="visible"/);
});

test('auto-height SVG uses the full measured paragraph height instead of stale stored geometry', () => {
  const text = 'Implement and verify the Text Properties → Text Format → Auto Size';
  const element = paragraph({ text, width: 50, height: 4.9, fontSize: 12, autoHeight: true });
  const rendered = paragraphSvg(element, [{
    ...run(text),
    style: { fontFamily: 'Arial', fontSize: 12, fontWeight: 'normal' },
  }]);
  const measured = measureTextObject({
    text,
    fontFamily: element.fontFamily,
    fontSize: element.fontSize,
    fontWeight: element.fontWeight,
    lineHeight: element.lineHeight,
    textType: 'paragraph',
    textFormatType: 'paragraph',
    multiline: true,
    wrap: true,
    containerWidthMm: element.width,
  });
  const viewBoxHeight = Number(rendered.match(/viewBox="0 0 [\d.]+ ([\d.]+)"/)?.[1]);

  assert.ok(measured.height > element.height, 'the actual wrapped paragraph exceeds the stale persisted height');
  assert.ok(viewBoxHeight >= measured.height - 1e-6, 'the rendered SVG viewport contains every measured line');
  assert.equal(element.width, 50);
  assert.equal(element.fontSize, 12);
});

test('line boxes include glyph ascent and descent and preserve fractional line spacing', () => {
  const oneLine = paragraph({ width: 80, fontSize: 10, lineHeight: 1 });
  const normal = layoutParagraph(oneLine, [run('gjpqy')]);
  const spaced = layoutParagraph({ ...oneLine, lineHeight: 1.5 }, [run('gjpqy')]);
  const fontHeightMm = 10 * 25.4 / 72;

  assert.ok(normal.height >= fontHeightMm * 1.05 - 1e-9, 'descender metrics extend the nominal one-em line box');
  assert.ok(spaced.height > normal.height);
  assert.ok(Math.abs(spaced.height * 10 - Math.round(spaced.height * 10)) > 1e-4, 'fractional layout height is not rounded to tenths');
});

test('justified paragraphs expand word gaps only on wrapped lines and honor orphan alignment', () => {
  const element = paragraph({ width: 7, textAlign: 'justify', orphanAlignment: 'left' });
  const layout = layoutParagraph(element, [run('aa bb cc')], text => [...text].length);
  const firstLine = layout.segments.filter(segment => segment.line === 0);
  const lastLine = layout.segments.filter(segment => segment.line === 1);
  const firstLineRight = Math.max(...firstLine.map(segment => segment.x + segment.width));

  assert.ok(Math.abs(firstLineRight - element.width) < 1e-9, 'a wrapped line distributes its available space between words');
  assert.equal(lastLine[0].x, 0, 'the paragraph final line keeps the default left orphan alignment');

  const explicitBreak = layoutParagraph(
    paragraph({ width: 12, textAlign: 'justify', orphanAlignment: 'left' }),
    [run('one two\nx')],
    text => [...text].length,
  );
  const firstParagraph = explicitBreak.segments.filter(segment => segment.line === 0);
  assert.equal(Math.max(...firstParagraph.map(segment => segment.x + segment.width)), 7,
    'an explicit line break ends a paragraph and does not stretch the preceding line');

  const centeredOrphan = layoutParagraph(
    paragraph({ width: 12, textAlign: 'justify', orphanAlignment: 'center' }),
    [run('one two')],
    text => [...text].length,
  );
  assert.equal(centeredOrphan.segments[0].x, 2.5, 'the configured orphan alignment positions a short final line');
});

test('distributed paragraphs add character spacing and align a single-word orphan by its configured edge', () => {
  const element = paragraph({ width: 10, textAlign: 'distributed', orphanAlignment: 'right' });
  const layout = layoutParagraph(element, [run('aa bb')], text => [...text].length);
  const rightEdge = Math.max(...layout.segments.map(segment => segment.x + (segment.renderWidth ?? segment.width)));

  assert.ok(Math.abs(rightEdge - element.width) < 1e-9, 'distributed alignment fills the full line using inter-character spacing');
  assert.ok(layout.segments.some(segment => (segment.renderWidth ?? segment.width) > segment.width),
    'character spacing is applied without scaling the original glyph advances');

  const orphan = layoutParagraph(element, [run('word')], text => [...text].length);
  assert.equal(orphan.segments[0].x, 6, 'a one-word paragraph orphan follows the configured right alignment');
  assert.equal(orphan.segments[0].renderWidth, undefined, 'orphan alignment does not stretch a single word');
});

test('arc SVG preserves direction, alignment, text content, and inside-path settings', () => {
  const element = paragraph({
    id: 'arc-test',
    textType: 'arc',
    textFormatType: 'arc',
    textAlign: 'left',
    arcConfig: {
      radius: 14,
      startAngle: 0,
      sweepAngle: 180,
      direction: 'clockwise',
      insidePath: true,
      characterSpacing: 1,
    },
  });
  const clockwisePath = getArcTextPath(element);
  const clockwiseSvg = getArcTextSvg(element, 'A&B');
  const counterClockwise = {
    ...element,
    arcConfig: { ...element.arcConfig!, direction: 'counter-clockwise' as const },
    textAlign: 'right' as const,
  };
  const counterClockwiseSvg = getArcTextSvg(counterClockwise, 'A&B');

  assert.notEqual(clockwisePath, getArcTextPath(counterClockwise), 'direction changes the actual curved path');
  assert.match(clockwiseSvg, /startOffset="0%" text-anchor="start"/, 'left arc alignment anchors to the start of the arc');
  assert.match(counterClockwiseSvg, /startOffset="100%" text-anchor="end"/, 'right arc alignment anchors to the end of the reversed arc');
  assert.match(clockwiseSvg, /dy="3\.5277777777777777"/, 'inside-path placement offsets the glyph baseline toward the path interior');
  assert.match(clockwiseSvg, />A&amp;B<\/textPath>/, 'arc source content is XML-escaped without changing text');
});

test('CR, LF, CRLF, blank lines, trailing newlines, spaces, tabs, Unicode, and long words survive layout', () => {
  const explicitBreaks = 'one\r\ntwo\rlast\n';
  const breakLayout = layoutParagraph(paragraph({ width: 90 }), [run(explicitBreaks)]);
  const preservedSpacing = '  A   B   ';
  const spacingLayout = layoutParagraph(paragraph({ width: 90 }), [run(preservedSpacing)]);
  const tabLayout = layoutParagraph(paragraph({ width: 90 }), [run('a\tb')]);
  const unicode = 'हिंदी English';
  const unicodeLayout = layoutParagraph(paragraph({ width: 90 }), [run(unicode)]);
  const unbroken = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const longWordLayout = layoutParagraph(
    paragraph({ width: 8 }),
    [run(unbroken)],
    text => [...text].length,
  );

  assert.equal(normalizeTextForObjectType(explicitBreaks, 'multi-line'), explicitBreaks);
  assert.equal(breakLayout.lines.length, 4);
  assert.equal(spacingLayout.segments.map(segment => segment.text).join(''), preservedSpacing);
  assert.ok(tabLayout.segments[1].x >= 12.7, 'tab advances to the configured default stop');
  assert.equal(unicodeLayout.segments.map(segment => segment.text).join(''), unicode);
  assert.equal(longWordLayout.segments.map(segment => segment.text).join(''), unbroken);
  assert.ok(longWordLayout.lines.length > 1, 'long unbroken strings wrap without dropping characters');
});
