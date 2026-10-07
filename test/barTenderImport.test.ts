import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { extractBtwIntermediateDocument } from '../src/services/barTenderParser';
import { importBarTenderObservation } from '../src/services/barTenderObservationImporter';
import { deserializeBarcodeFlowDocument, serializeBarcodeFlowDocument } from '../src/services/documentFileService';
import { exportLabelsToPDF } from '../src/services/pdfExportService';
import { PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { detectDocumentFormat } from '../src/services/documentFormatDetector';
import { BarTenderExtractionError, extractBarTenderWorkingCopy, openBarTenderWithConsent } from '../electron/bartenderImport';

function observation() {
  return {
    format: 'BarcodeFlowBarTenderObservation', version: 1, sourceFileName: 'Sanitized.btw',
    sourceSha256: 'a'.repeat(64), pageUnits: 'mm', document: { MeasurementUnits: 3 },
    page: { LabelWidth: 100, LabelHeight: 150 }, objectCount: 3,
    objects: [
      { Name: 'Rule', Type: 2, CollectionIndex: 1, LineStartX: 10, LineStartY: 20, LineEndX: 40, LineEndY: 20,
        LineThickness: 0.5, LineColor: 0xff000000, DoNotPrint: true },
      { Name: 'Dynamic text', Type: 5, CollectionIndex: 2, X: 10, Y: 30, Value: 'processed-only', DoNotPrint: false },
      { Name: 'Unresolved barcode', Type: 4, CollectionIndex: 3, X: 10, Y: 50, Value: 'processed-only', DoNotPrint: true },
    ],
  };
}

test('BTW-001: unverified proprietary records never become guessed visible objects', () => {
  const original = readFileSync(new URL('../public/samples/AIAG_B10_6.25x5_BMW.btw', import.meta.url));
  const digest = createHash('sha256').update(original).digest('hex');
  for (const fileName of ['AIAG_B10_6.25x5_BMW.btw', 'renamed-2x1.btw', 'shared.btw']) {
    assert.throws(
      () => extractBtwIntermediateDocument(original, fileName),
      /binary.*record.*(?:unverified|unsupported)/i,
      'A file name or adjacent metadata must not authorize a fabricated editable import',
    );
  }
  assert.equal(createHash('sha256').update(original).digest('hex'), digest);
});

test('observation import maps real endpoints and preserves editable non-printing objects without static data substitutes', () => {
  const template = importBarTenderObservation(observation());
  assert.equal(template.elements.length, 1);
  assert.deepEqual(template.elements.map(({ x, y, width, height, rotation, visible, printable, editable }) =>
    ({ x, y, width, height, rotation, visible, printable, editable })),
  [{ x: 10, y: 20, width: 30, height: 0, rotation: 0, visible: true, printable: false, editable: true }]);
  assert.equal(template.importReport.importStatus, 'PARTIAL');
  assert.equal(template.importReport.fullyEditable, 0);
  assert.equal(template.importReport.partiallyEditable, 1);
  assert.equal(template.importReport.unsupported, 2);
  assert.equal(template.sourceMetadata?.bartenderImport.productionReady, false);
  assert.equal(JSON.stringify(template).includes('processed-only'), false);
  assert.ok(template.importReport.propertyEvidence.some((entry: any) => entry.property === 'symbology' && entry.status === 'unavailable'));
});

test('observation goes through the actual file loader and persists edits/report in native format without BarTender', () => {
  const imported = deserializeBarcodeFlowDocument('\uFEFF' + JSON.stringify(observation()), 'observation.json');
  assert.equal(imported.imported, true);
  imported.template!.elements[0].x += 2;
  const native = serializeBarcodeFlowDocument(imported.template!);
  const reopened = deserializeBarcodeFlowDocument(JSON.stringify(native), 'saved.bfl');
  assert.equal(reopened.imported, undefined);
  assert.deepEqual(reopened.template!.elements, imported.template!.elements);
  assert.deepEqual(reopened.template!.importReport, imported.template!.importReport);
  assert.deepEqual(reopened.template!.sourceMetadata, imported.template!.sourceMetadata);
  assert.equal(reopened.template!.elements[0].printable, false);
});

test('source units are explicit and diagonal endpoint conversion is centre anchored', () => {
  const input = observation();
  input.document.MeasurementUnits = 1;
  Object.assign(input.objects[0], { LineStartX: 0, LineStartY: 0, LineEndX: 3, LineEndY: 4, LineThickness: 0.01 });
  const element = importBarTenderObservation(input).elements[0];
  assert.ok(Math.abs(element.width - 127) < 1e-9);
  assert.ok(Math.abs(element.rotation - Math.atan2(4, 3) * 180 / Math.PI) < 1e-9);
  assert.ok(Math.abs(element.x + element.width / 2 - 38.1) < 1e-9);
  assert.ok(Math.abs(element.y - 50.8) < 1e-9);
});

test('invalid observations fail before creating a native template', () => {
  for (const mutate of [
    (input: any) => { input.version = 2; },
    (input: any) => { input.pageUnits = undefined; },
    (input: any) => { input.document.MeasurementUnits = 0; },
    (input: any) => { input.objectCount = 10; },
    (input: any) => { input.objects[1].Name = input.objects[0].Name; },
    (input: any) => { input.objects[0].LineThickness = NaN; },
  ]) {
    const input = observation();
    mutate(input);
    assert.throws(() => importBarTenderObservation(input));
  }
});

test('non-printing imported objects are omitted from PDF export, not removed from the editable document', async () => {
  const template = importBarTenderObservation(observation());
  const pdfContents = async () => {
    const blob = await exportLabelsToPDF(template);
    const pdf = await PDFDocument.load(await blob.arrayBuffer());
    return pdf.context.enumerateIndirectObjects().filter(([, object]) => object instanceof PDFRawStream)
      .map(([, object]) => new TextDecoder().decode(decodePDFRawStream(object as PDFRawStream).decode())).join('\n');
  };
  assert.equal((await pdfContents()).includes(' l'), false);
  assert.equal(template.elements.length, 1);
  assert.equal(template.elements[0].visible, true);
  template.elements[0].printable = true;
  assert.equal((await pdfContents()).includes(' l'), true);
});

test('PDF line endpoints match source physical coordinates after anchor/rotation conversion', async () => {
  const input = observation();
  Object.assign(input.objects[0], { LineStartX: 10, LineStartY: 20, LineEndX: 40, LineEndY: 60, DoNotPrint: false });
  const template = importBarTenderObservation(input);
  const blob = await exportLabelsToPDF(template);
  const pdf = await PDFDocument.load(await blob.arrayBuffer());
  const contents = pdf.context.enumerateIndirectObjects().filter(([, object]) => object instanceof PDFRawStream)
    .map(([, object]) => new TextDecoder().decode(decodePDFRawStream(object as PDFRawStream).decode())).join('\n');
  const points = [...contents.matchAll(/([\d.-]+) ([\d.-]+) ([ml])\b/g)].map(match =>
    ({ x: Number(match[1]) * 25.4 / 72, y: (pdf.getPage(0).getHeight() - Number(match[2])) * 25.4 / 72 }));
  assert.equal(points.length, 2);
  assert.ok(Math.abs(points[0].x - 10) < 0.001);
  assert.ok(Math.abs(points[0].y - 20) < 0.001);
  assert.ok(Math.abs(points[1].x - 40) < 0.001);
  assert.ok(Math.abs(points[1].y - 60) < 0.001);
});

test('BarTender metadata inside JSON is not a binary file signature', () => {
  const json = '\uFEFF' + JSON.stringify(observation());
  assert.equal(detectDocumentFormat('observation.json', json).format, 'JSON');
  assert.equal(detectDocumentFormat('observation.json', Buffer.from(json)).isBinary, false);
  assert.equal(detectDocumentFormat('renamed.json', '\r\nBar Tender Format File\r\n').format, 'BARTENDER_BTW');
  assert.equal(detectDocumentFormat('original.btw', json).format, 'BARTENDER_BTW');
});

test('native BTW extraction uses a hash-verified private copy and validates returned identity', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'barcodeflow-btw-extraction-test-'));
  try {
    const original = Buffer.from('\r\nBar Tender Format File\r\nSanitized signature test');
    const sourcePath = path.join(root, 'input.btw');
    const scriptPath = path.join(root, 'fixed-helper.ps1');
    await writeFile(sourcePath, original);
    await writeFile(scriptPath, '');
    const sourceHash = createHash('sha256').update(original).digest('hex');
    const result = await extractBarTenderWorkingCopy({ sourcePath, scriptPath, workingRoot: path.join(root, 'private'),
      run: async (helper, copyPath, outputPath) => {
        assert.equal(helper, scriptPath);
        assert.notEqual(copyPath, sourcePath);
        assert.deepEqual(await readFile(copyPath), original);
        await writeFile(outputPath, '\uFEFF' + JSON.stringify({ ...observation(), sourceSha256: sourceHash }));
      },
    });
    assert.equal(result.sourceSha256, sourceHash);
    assert.equal(importBarTenderObservation(result.observation).elements.length, 1);
    assert.deepEqual(await readFile(sourcePath), original);
    await assert.rejects(() => extractBarTenderWorkingCopy({ sourcePath, scriptPath, workingRoot: path.join(root, 'private'),
      run: async (_helper, _copy, output) => { await writeFile(output, JSON.stringify(observation())); },
    }), /identity/);
    const invalid = path.join(root, 'wrong.btw');
    await writeFile(invalid, JSON.stringify(observation()));
    let called = false;
    await assert.rejects(() => extractBarTenderWorkingCopy({ sourcePath: invalid, scriptPath, workingRoot: path.join(root, 'private'),
      run: async () => { called = true; },
    }), /signature/);
    assert.equal(called, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('BTW entry orchestration requires consent, reports progress, returns an importable draft and cleans owned temporary files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'barcodeflow-btw-consent-test-'));
  try {
    const sourcePath = path.join(root, 'trusted.btw');
    const bytes = Buffer.from('Bar Tender Format File\r\nSanitized');
    const hash = createHash('sha256').update(bytes).digest('hex');
    const scriptPath = path.join(root, 'helper.ps1');
    const workingRoot = path.join(root, 'private');
    await writeFile(sourcePath, bytes);
    await writeFile(scriptPath, '');
    let runs = 0;
    const phases: string[] = [];
    const run = async (_script: string, copy: string, output: string) => {
      runs++;
      assert.notEqual(copy, sourcePath);
      await writeFile(output, JSON.stringify({ ...observation(), sourceSha256: hash }));
    };
    const canceled = await openBarTenderWithConsent({ sourcePath, scriptPath, workingRoot, run, confirm: async () => false });
    assert.deepEqual(canceled, { success: false, canceled: true });
    assert.equal(runs, 0);
    const accepted = await openBarTenderWithConsent({ sourcePath, scriptPath, workingRoot, run, confirm: async () => true,
      onProgress: phase => phases.push(phase) });
    assert.equal(accepted.success, true);
    assert.deepEqual(phases, ['AWAITING_CONSENT', 'EXTRACTING', 'VERIFYING']);
    if (!accepted.success) throw new Error('Expected successful observation');
    const draft = deserializeBarcodeFlowDocument(accepted.document, 'trusted.btw');
    assert.equal(draft.imported, true);
    assert.equal(draft.template!.importReport.productionReady, false);
    assert.deepEqual(await readdir(workingRoot), []);
    assert.deepEqual(await readFile(sourcePath), bytes);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('BTW entry rejects unsupported sources before consent and preserves actionable failure codes with cleanup', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'barcodeflow-btw-failure-test-'));
  try {
    const sourcePath = path.join(root, 'trusted.btw');
    const bytes = Buffer.from('Bar Tender Format File\r\nSanitized');
    const hash = createHash('sha256').update(bytes).digest('hex');
    const scriptPath = path.join(root, 'helper.ps1');
    const workingRoot = path.join(root, 'private');
    await writeFile(scriptPath, '');
    await writeFile(sourcePath, 'Not a BTW file');
    let consentCalls = 0;
    const confirm = async () => { consentCalls++; return true; };
    const rejected = await openBarTenderWithConsent({ sourcePath, scriptPath, workingRoot, confirm });
    assert.equal(rejected.success, false);
    assert.equal('errorCode' in rejected && rejected.errorCode, 'UNSUPPORTED_SOURCE');
    assert.equal(consentCalls, 0);
    await writeFile(sourcePath, bytes);
    for (const code of ['BARTENDER_UNAVAILABLE', 'EXTRACTION_FAILED', 'EXTRACTION_TIMEOUT', 'OWNERSHIP_UNVERIFIED']) {
      const failed = await openBarTenderWithConsent({ sourcePath, scriptPath, workingRoot, confirm,
        run: async () => { throw new BarTenderExtractionError(code, `Actionable ${code}`); } });
      assert.equal(failed.success, false);
      assert.equal('errorCode' in failed && failed.errorCode, code);
      assert.deepEqual(await readdir(workingRoot), []);
      assert.deepEqual(await readFile(sourcePath), bytes);
    }
    for (const output of ['not-json', 'null', '[]', JSON.stringify({ ...observation(), sourceSha256: hash, objectCount: 500 })]) {
      const invalid = await openBarTenderWithConsent({ sourcePath, scriptPath, workingRoot, confirm,
        run: async (_script, _copy, outputPath) => { await writeFile(outputPath, output); } });
      assert.equal('errorCode' in invalid && invalid.errorCode, 'INVALID_OBSERVATION');
      assert.deepEqual(await readdir(workingRoot), []);
    }
    const changed = await openBarTenderWithConsent({ sourcePath, scriptPath, workingRoot, confirm,
      run: async (_script, copy, outputPath) => {
        await writeFile(copy, 'changed copy');
        await writeFile(outputPath, JSON.stringify({ ...observation(), sourceSha256: hash }));
      } });
    assert.equal('errorCode' in changed && changed.errorCode, 'SOURCE_CHANGED');
    assert.deepEqual(await readdir(workingRoot), []);
    assert.deepEqual(await readFile(sourcePath), bytes);
    const missing = await openBarTenderWithConsent({ sourcePath, scriptPath: path.join(root, 'missing.ps1'), workingRoot, confirm });
    assert.equal('errorCode' in missing && missing.errorCode, 'HELPER_UNAVAILABLE');
  } finally { await rm(root, { recursive: true, force: true }); }
});