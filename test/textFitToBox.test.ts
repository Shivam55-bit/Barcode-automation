import assert from 'node:assert/strict';
import test from 'node:test';
import type { TextElement } from '../src/types';
import { fitTextToBox, isTextFitToBoxEnabled } from '../src/services/textMeasurementEngine';

function textElement(overrides: Partial<TextElement> = {}): TextElement {
  return {
    id: 'auto-size-test',
    name: 'Auto Size Test',
    type: 'text',
    text: 'Sample Text',
    textType: 'single-line',
    textFormatType: 'single-line',
    sizingMode: 'fit-to-box',
    autoSize: false,
    autoFit: true,
    fontFamily: 'Arial',
    fontSize: 12,
    fontWeight: 'normal',
    fontStyle: 'normal',
    textDecoration: 'none',
    color: '#000000',
    textAlign: 'left',
    verticalAlign: 'top',
    lineHeight: 1.15,
    letterSpacing: 0,
    x: 10,
    y: 10,
    width: 23.9,
    height: 4.9,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 1,
    autoSizeConfig: {
      enabled: true,
      minFontSize: 1,
      maxFontSize: 720,
      minWidthScale: 100,
      maxWidthScale: 100,
      objectWidth: 23.9,
      objectHeight: 4.9,
      horizontalAlignment: 'left',
      verticalAlignment: 'top',
    },
    ...overrides,
  } as TextElement;
}

test('Auto Size fits to a fixed box while preserving 100 percent glyph width and saved geometry', () => {
  const element = textElement();
  const fit = fitTextToBox(element);

  assert.equal(isTextFitToBoxEnabled(element), true);
  assert.equal(fit.fits, true);
  assert.equal(fit.fontWidthScale, 100);
  assert.ok(fit.fontSize >= 1 && fit.fontSize <= 720);
  assert.ok(fit.measured.width <= 23.9);
  assert.ok(fit.measured.height <= 4.9);
  assert.equal(element.fontSize, 12, 'fitting is derived and does not overwrite the saved point size');
  assert.deepEqual([element.width, element.height, element.x, element.y], [23.9, 4.9, 10, 10]);
});

test('minimum and maximum point-size limits independently bound fixed-box fitting', () => {
  const capped = fitTextToBox(textElement({
    text: 'A',
    autoSizeConfig: {
      enabled: true,
      minFontSize: 1,
      maxFontSize: 8,
      minWidthScale: 100,
      maxWidthScale: 100,
    },
  }));
  const floor = fitTextToBox(textElement({
    text: 'A',
    autoSizeConfig: {
      enabled: true,
      minFontSize: 7,
      maxFontSize: 7,
      minWidthScale: 100,
      maxWidthScale: 100,
    },
  }));

  assert.equal(capped.fits, true);
  assert.equal(capped.fontSize, 8);
  assert.equal(floor.fits, true);
  assert.equal(floor.fontSize, 7);
});

test('minimum and maximum width-scale limits change the fitted scale without changing box dimensions', () => {
  const base = textElement({
    text: 'A',
    width: 80,
    height: 10,
    autoSizeConfig: {
      enabled: true,
      minFontSize: 10,
      maxFontSize: 10,
      minWidthScale: 50,
      maxWidthScale: 100,
    },
  });
  const widerRange = fitTextToBox({
    ...base,
    autoSizeConfig: { ...base.autoSizeConfig!, maxWidthScale: 150 },
  });
  const raisedMinimum = fitTextToBox({
    ...base,
    autoSizeConfig: { ...base.autoSizeConfig!, minWidthScale: 75 },
  });

  assert.equal(fitTextToBox(base).fontWidthScale, 100);
  assert.equal(widerRange.fontWidthScale, 150);
  assert.equal(raisedMinimum.fontWidthScale, 100);
  assert.deepEqual([base.width, base.height], [80, 10]);
});

test('multiline Auto Size wraps into the fixed box and keeps the final line within its measured height', () => {
  const text = "errorCode:\n'EXCEL_INVALID_WORKBOOK',\nerror: 'Workbook metadata'";
  const element = textElement({
    text,
    textType: 'multi-line',
    textFormatType: 'paragraph',
    multiline: true,
    wrap: true,
    wordWrap: true,
    width: 23.9,
    height: 4.9,
  });
  const fit = fitTextToBox(element, text);

  assert.equal(fit.fits, true);
  assert.equal(fit.fontWidthScale, 100);
  assert.ok(fit.fontSize < 12);
  assert.ok(fit.measured.height <= element.height);
  assert.equal(element.text, text);
  assert.equal(element.autoHeight, undefined, 'fixed-box fitting is not content-driven auto-height');
});

test('paragraph fitting preserves CR/LF line breaks, blank lines, and mixed Hindi/English content', () => {
  const text = 'प्रिंट Label 42\r\n\r\nकार्टन Batch 7\nEnd';
  const element = textElement({
    text,
    textType: 'paragraph',
    textFormatType: 'paragraph',
    multiline: true,
    wrap: true,
    wordWrap: true,
    width: 40,
    height: 30,
  });
  const fit = fitTextToBox(element, text);

  assert.equal(fit.fits, true);
  assert.equal(fit.fontWidthScale, 100);
  assert.equal(element.text, text, 'fitting must not normalize or delete source line endings');
  assert.ok(fit.measured.linesCount >= 5, 'paragraph layout preserves blank lines and wraps complete text');
});

test('a long unbroken paragraph token wraps in layout instead of clipping', () => {
  const text = 'LONG_UNBROKEN_TOKEN_'.repeat(12);
  const element = textElement({
    text,
    textType: 'paragraph',
    textFormatType: 'paragraph',
    multiline: true,
    wrap: true,
    wordWrap: true,
    width: 23.9,
    height: 60,
  });
  const fit = fitTextToBox(element, text);

  assert.equal(fit.fits, true);
  assert.ok(fit.measured.linesCount > 1);
  assert.ok(fit.measured.width <= element.width);
  assert.ok(fit.measured.height <= element.height);
  assert.equal(element.text, text);
});

test('fixed-box fitting reports overflow when the configured minimum cannot fit', () => {
  const fit = fitTextToBox(textElement({
    text: 'A very long string that cannot fit at the configured minimum',
    fontSize: 20,
    width: 5,
    height: 2,
    autoSizeConfig: {
      enabled: true,
      minFontSize: 12,
      maxFontSize: 12,
      minWidthScale: 100,
      maxWidthScale: 100,
    },
  }));

  assert.equal(fit.fontSize, 12);
  assert.equal(fit.fontWidthScale, 100);
  assert.equal(fit.fits, false);
});

test('content sizing and fixed-box fitting remain distinct modes', () => {
  assert.equal(isTextFitToBoxEnabled(textElement({ sizingMode: 'auto-width', autoSize: true })), false);
  assert.equal(isTextFitToBoxEnabled(textElement({ sizingMode: 'fixed-width', autoFit: false })), false);
  assert.equal(isTextFitToBoxEnabled(textElement({ sizingMode: 'scale-text', autoSizeConfig: { ...textElement().autoSizeConfig!, enabled: true } })), false);
  assert.equal(isTextFitToBoxEnabled(textElement({ sizingMode: undefined, autoFit: true })), true);
});
