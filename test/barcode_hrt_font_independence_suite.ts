import {
  calculateBarcodeLayout,
  getBarcodeSymbolHeight,
  generateBarcodeSVG,
  renderBarcodeToCanvas,
  resolveBarcodeData,
} from '../src/services/barcodeEngine';
(globalThis as any).DOMParser = class {
  parseFromString(svg: string) {
    return { svg, documentElement: { setAttribute() {} } };
  }
};
(globalThis as any).XMLSerializer = class {
  serializeToString(document: { svg: string }) {
    return document.svg;
  }
};
(globalThis as any).Image = class {
  src = '';
  async decode() {
    if (!this.src.startsWith('data:image/svg+xml')) throw new Error('Expected the canonical SVG image source');
  }
};

// Simple mock canvas for headless Node testing of renderBarcodeToCanvas
class MockCanvasContext2D {
  font: string = '';
  fillStyle: string = '';
  strokeStyle: string = '';
  lineWidth: number = 1;
  textAlign: string = 'start';
  textBaseline: string = 'alphabetic';
  imageSmoothingEnabled: boolean = true;
  drawnBars: Array<{ x: number; y: number; w: number; h: number }> = [];
  drawnTexts: Array<{ text: string; x: number; y: number; font: string }> = [];

  clearRect(x: number, y: number, w: number, h: number) {}
  fillRect(x: number, y: number, w: number, h: number) {}
  strokeRect(x: number, y: number, w: number, h: number) {}
  beginPath() {}
  moveTo(x: number, y: number) {}
  lineTo(x: number, y: number) {}
  stroke() {}
  measureText(text: string) {
    const fontSize = parseFloat(this.font) || 12;
    return { width: text.length * fontSize * 0.55 };
  }
  drawImage(img: any, sx: number, sy: number, sw: number, sh: number, dx?: number, dy?: number, dw?: number, dh?: number) {
    if (dw !== undefined && dh !== undefined && dx !== undefined && dy !== undefined) {
      this.drawnBars.push({ x: dx, y: dy, w: dw, h: dh });
    } else {
      this.drawnBars.push({ x: sx, y: sy, w: sw, h: sh });
    }
  }
  fillText(text: string, x: number, y: number) {
    this.drawnTexts.push({ text, x, y, font: this.font });
  }
}

class MockHTMLCanvasElement {
  width: number = 0;
  height: number = 0;
  ctx = new MockCanvasContext2D();

  getContext(type: string) {
    if (type === '2d') return this.ctx;
    return null;
  }
  cloneNode() {
    return new MockHTMLCanvasElement();
  }
}

async function runTestSuite() {
  console.log('===============================================================');
  console.log('BARCODE HRT FONT INDEPENDENCE ACCEPTANCE TEST SUITE');
  console.log('===============================================================\n');

  let passedAll = true;

  // -------------------------------------------------------------
  // TEST 1: MANDATORY MANUAL TEST (Font 10 -> 12 -> 16 -> 19 -> 24 -> 36)
  // -------------------------------------------------------------
  console.log('--- TEST 1: HRT Font Resizing Independence (10pt -> 36pt) ---');
  const baseBarcode: BarcodeElement = {
    id: 'bc-test-1',
    type: 'barcode',
    name: 'Test Code 128',
    symbology: 'code128',
    value: '10850006531238',
    x: 10,
    y: 10,
    width: 60,
    height: 25,
    barHeight: 20,
    barWidth: 1.5,
    includeText: true,
    textPosition: 'below',
    humanReadableFont: 'Arial',
    humanReadableFontSize: 10,
    fontSize: 10,
    foregroundColor: '#000000',
    backgroundColor: 'transparent',
    quietZone: true,
    checkDigit: true,
    zIndex: 1,
    visible: true,
    locked: false,
  };

  const fontSizes = [10, 12, 16, 19, 24, 36];
  const test1Metrics: Array<{
    fontSize: number;
    barHeightMm: number;
    drawnBarAreaHeightPx: number;
    drawnBarAreaWidthPx: number;
    svgTotalHeight: number;
    totalHeightMm: number;
    data: string;
  }> = [];

  for (const fs of fontSizes) {
    const el: BarcodeElement = {
      ...baseBarcode,
      humanReadableFontSize: fs,
      fontSize: fs,
    };

    const layout = calculateBarcodeLayout(el);
    const canvas = new MockHTMLCanvasElement() as any;
    await renderBarcodeToCanvas(canvas, el, 2);

    const svg = generateBarcodeSVG(el);
    const vb = svg.match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number) || [0, 0, 0, 0];
    const totalSvgH = vb[3];

    const lastBar = canvas.ctx.drawnBars[canvas.ctx.drawnBars.length - 1];

    test1Metrics.push({
      fontSize: fs,
      barHeightMm: layout.symbolHeightMm,
      drawnBarAreaHeightPx: lastBar ? lastBar.h : 0,
      drawnBarAreaWidthPx: lastBar ? lastBar.w : 0,
      svgTotalHeight: totalSvgH,
      totalHeightMm: layout.totalHeightMm,
      data: el.value,
    });
  }

  // Verification 1: barHeight in mm remains exactly 20mm across all font sizes
  const allBarHeights20 = test1Metrics.every((m) => m.barHeightMm === 20);
  console.log(`[PASS 1.1] Barcode barHeight == 20mm at every font size: ${allBarHeights20}`);
  if (!allBarHeights20) passedAll = false;

  // Verification 2: Canvas drawn bar area height remains identical across all font sizes
  const firstDrawnH = test1Metrics[0].drawnBarAreaHeightPx;
  const allCanvasBarHeightsIdentical = test1Metrics.every((m) => m.drawnBarAreaHeightPx === firstDrawnH);
  console.log(
    `[PASS 1.2] Canvas drawn bar pixel height identical (${firstDrawnH}px @ 2x scale): ${allCanvasBarHeightsIdentical}`
  );
  if (!allCanvasBarHeightsIdentical) passedAll = false;

  // Verification 3: Canvas drawn bar width remains identical across all font sizes
  const firstDrawnW = test1Metrics[0].drawnBarAreaWidthPx;
  const allCanvasBarWidthsIdentical = test1Metrics.every((m) => m.drawnBarAreaWidthPx === firstDrawnW);
  console.log(
    `[PASS 1.3] Canvas drawn bar width identical (${firstDrawnW}px): ${allCanvasBarWidthsIdentical}`
  );
  if (!allCanvasBarWidthsIdentical) passedAll = false;

  // Verification 4: Total object height grows when required
  let totalHeightsGrow = true;
  for (let i = 1; i < test1Metrics.length; i++) {
    if (test1Metrics[i].totalHeightMm <= test1Metrics[i - 1].totalHeightMm) totalHeightsGrow = false;
  }
  console.log(`[PASS 1.4] Total object height grows monotonically to accommodate larger text: ${totalHeightsGrow}`);
  if (!totalHeightsGrow) passedAll = false;

  // Verification 5: SVG height grows properly while bars maintain independence
  let svgHeightsGrow = true;
  for (let i = 1; i < test1Metrics.length; i++) {
    if (test1Metrics[i].svgTotalHeight <= test1Metrics[i - 1].svgTotalHeight) svgHeightsGrow = false;
  }
  console.log(`[PASS 1.5] SVG bounds grow vertically to accommodate larger font: ${svgHeightsGrow}`);
  if (!svgHeightsGrow) passedAll = false;

  // Verification 6: Encoded data preserved
  const allDataPreserved = test1Metrics.every((m) => m.data === '10850006531238');
  console.log(`[PASS 1.6] Encoded data stays 10850006531238 across all steps: ${allDataPreserved}\n`);
  if (!allDataPreserved) passedAll = false;

  // -------------------------------------------------------------
  // TEST 2: EXPLICIT BAR HEIGHT CHANGE (Keep font 19pt, change barHeight 20mm -> 30mm -> 15mm)
  // -------------------------------------------------------------
  console.log('--- TEST 2: Explicit Bar Height Changes (20mm -> 30mm -> 15mm with HRT = 19pt) ---');
  const test2Barcode: BarcodeElement = {
    ...baseBarcode,
    humanReadableFontSize: 19,
    fontSize: 19,
  };

  // 20mm
  const layout20 = calculateBarcodeLayout({ ...test2Barcode, barHeight: 20 });
  const canvas20 = new MockHTMLCanvasElement() as any;
  await renderBarcodeToCanvas(canvas20, { ...test2Barcode, barHeight: 20 }, 2);
  const barH20 = canvas20.ctx.drawnBars[0].h;

  // 30mm
  const layout30 = calculateBarcodeLayout({ ...test2Barcode, barHeight: 30 });
  const canvas30 = new MockHTMLCanvasElement() as any;
  await renderBarcodeToCanvas(canvas30, { ...test2Barcode, barHeight: 30 }, 2);
  const barH30 = canvas30.ctx.drawnBars[0].h;

  // 15mm
  const layout15 = calculateBarcodeLayout({ ...test2Barcode, barHeight: 15 });
  const canvas15 = new MockHTMLCanvasElement() as any;
  await renderBarcodeToCanvas(canvas15, { ...test2Barcode, barHeight: 15 }, 2);
  const barH15 = canvas15.ctx.drawnBars[0].h;

  const barsGrowAt30 = barH30 > barH20 && layout30.symbolHeightMm === 30;
  const barsShrinkAt15 = barH15 < barH20 && layout15.symbolHeightMm === 15;
  const fontStays19 = layout20.fontSizePt === 19 && layout30.fontSizePt === 19 && layout15.fontSizePt === 19;

  console.log(`[PASS 2.1] Bars become taller at 30mm (${barH20}px -> ${barH30}px): ${barsGrowAt30}`);
  console.log(`[PASS 2.2] Bars become shorter at 15mm (${barH20}px -> ${barH15}px): ${barsShrinkAt15}`);
  console.log(`[PASS 2.3] HRT font remains exactly 19pt across bar height changes: ${fontStays19}\n`);
  if (!barsGrowAt30 || !barsShrinkAt15 || !fontStays19) passedAll = false;

  // -------------------------------------------------------------
  // TEST 3: SHOW TEXT TOGGLING (ON -> OFF -> ON with Bar Height = 20mm)
  // -------------------------------------------------------------
  console.log('--- TEST 3: Show Text Toggle Independence (ON -> OFF -> ON) ---');
  // ON
  const on1 = { ...baseBarcode, barHeight: 20, includeText: true };
  const layoutOn1 = calculateBarcodeLayout(on1);
  const canvasOn1 = new MockHTMLCanvasElement() as any;
  await renderBarcodeToCanvas(canvasOn1, on1, 2);
  const barOn1 = canvasOn1.ctx.drawnBars[0].h;

  // OFF
  const off = { ...baseBarcode, barHeight: 20, includeText: false };
  const layoutOff = calculateBarcodeLayout(off);
  const canvasOff = new MockHTMLCanvasElement() as any;
  await renderBarcodeToCanvas(canvasOff, off, 2);
  const barOff = canvasOff.ctx.drawnBars[0].h;

  // ON again
  const on2 = { ...baseBarcode, barHeight: 20, includeText: true };
  const layoutOn2 = calculateBarcodeLayout(on2);
  const canvasOn2 = new MockHTMLCanvasElement() as any;
  await renderBarcodeToCanvas(canvasOn2, on2, 2);
  const barOn2 = canvasOn2.ctx.drawnBars[0].h;

  const barHeightConsistently20 =
    layoutOn1.symbolHeightMm === 20 &&
    layoutOff.symbolHeightMm === 20 &&
    layoutOn2.symbolHeightMm === 20;

  const canvasBarHeightIdentical = barOn1 === barOff && barOff === barOn2;
  const offHasNoHrt = layoutOff.hrtHeightMm === 0 && canvasOff.ctx.drawnTexts.length === 0;
  const onHasHrt = layoutOn1.hrtHeightMm > 0 && canvasOn1.ctx.drawnTexts.length > 0;

  console.log(`[PASS 3.1] barHeight remains exactly 20mm regardless of Show Text: ${barHeightConsistently20}`);
  console.log(`[PASS 3.2] Canvas drawn bar height identical across ON/OFF/ON (${barOn1}px): ${canvasBarHeightIdentical}`);
  console.log(`[PASS 3.3] Show Text OFF renders zero text lines: ${offHasNoHrt}`);
  console.log(`[PASS 3.4] Show Text ON renders HRT text lines: ${onHasHrt}\n`);
  if (!barHeightConsistently20 || !canvasBarHeightIdentical || !offHasNoHrt || !onHasHrt) passedAll = false;

  // -------------------------------------------------------------
  // TEST 4: REGRESSION TEST ACROSS ALL LINEAR SYMBOLOGIES
  // -------------------------------------------------------------
  console.log('--- TEST 4: Linear Symbology Regression Suite ---');
  const symbologies = [
    { id: 'code128', data: '10850006531238' },
    { id: 'code39', data: 'CODE39' },
    { id: 'ean13', data: '108500065312' },
    { id: 'upca', data: '01234567890' },
    { id: 'ean8', data: '1234567' },
    { id: 'itf14', data: '10850006531230' },
    { id: 'gs1-128', data: '(01)00850006531233' },
  ];

  for (const s of symbologies) {
    const el10: BarcodeElement = {
      ...baseBarcode,
      symbology: s.id as any,
      value: s.data,
      humanReadableFontSize: 10,
      fontSize: 10,
      barHeight: 20,
    };
    const el19: BarcodeElement = {
      ...baseBarcode,
      symbology: s.id as any,
      value: s.data,
      humanReadableFontSize: 19,
      fontSize: 19,
      barHeight: 20,
    };

    const c10 = new MockHTMLCanvasElement() as any;
    await renderBarcodeToCanvas(c10, el10, 2);
    const h10 = c10.ctx.drawnBars[c10.ctx.drawnBars.length - 1]?.h;
    const w10 = c10.ctx.drawnBars[c10.ctx.drawnBars.length - 1]?.w;

    const c19 = new MockHTMLCanvasElement() as any;
    await renderBarcodeToCanvas(c19, el19, 2);
    const h19 = c19.ctx.drawnBars[c19.ctx.drawnBars.length - 1]?.h;
    const w19 = c19.ctx.drawnBars[c19.ctx.drawnBars.length - 1]?.w;

    const svg10 = generateBarcodeSVG(el10);
    const svg19 = generateBarcodeSVG(el19);
    const vb10 = svg10.match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number) || [0, 0, 0, 0];
    const vb19 = svg19.match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number) || [0, 0, 0, 0];

    const symbolW10 = vb10[2];
    const symbolW19 = vb19[2];

    const sameBarH = h10 === h19 && h10 > 0;
    const sameBarW = w10 === w19 && w10 > 0;
    const sameSvgW = symbolW10 === symbolW19;

    console.log(
      `Symbology [${s.id.padEnd(8)}]: Bar Height 10 vs 19 equal (${h10}px): ${sameBarH} | Bar Width equal (${w10}px): ${sameBarW} | SVG Width equal: ${sameSvgW}`
    );
    if (!sameBarH || !sameBarW || !sameSvgW) passedAll = false;
  }

  // -------------------------------------------------------------
  // TEST 5: 2D Barcode (QR) Non-Regression
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: 2D Barcode (QR Code) Non-Regression ---');
  const qrEl: BarcodeElement = {
    ...baseBarcode,
    symbology: 'qr',
    value: 'https://example.com/item/10850006531238',
    width: 30,
    height: 30,
    includeText: false,
  };
  const qrCanvas = new MockHTMLCanvasElement() as any;
  await renderBarcodeToCanvas(qrCanvas, qrEl, 2);
  const qrDrawn = qrCanvas.ctx.drawnBars[0];
  const qrSquare = qrDrawn && qrDrawn.w === qrDrawn.h && qrDrawn.w > 0;
  console.log(`QR Code renders 1:1 square matrix without linear HRT rules: ${qrSquare}`);
  if (!qrSquare) passedAll = false;

  console.log('\n===============================================================');
  console.log(`FINAL SUITE STATUS: ${passedAll ? 'ALL TESTS PASSED ✓' : 'FAIL ✗'}`);
  console.log('===============================================================\n');

  if (!passedAll) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
