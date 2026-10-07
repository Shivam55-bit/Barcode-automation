import type { LabelTemplate, ShapeElement } from '../types';
import type { ImportReportStats } from './barTenderParser';

export interface BarTenderPropertyEvidence {
  sourceName: string;
  property: string;
  status: 'verified' | 'unavailable' | 'unsupported';
  mapped: boolean;
  detail: string;
}

type SourceObject = Record<string, unknown> & { Name: string; Type: number; CollectionIndex: number };

function finiteNumber(value: unknown, property: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid BarTender observation: ${property} must be a finite number.`);
  }
  return value;
}

function sourceColor(value: unknown): string {
  const color = finiteNumber(value, 'LineColor');
  if (!Number.isInteger(color) || color < 0 || color > 0xffffffff) {
    throw new Error('Unsupported source line color; system colors cannot be substituted.');
  }
  const alpha = Math.floor(color / 0x1000000);
  if (alpha !== 0 && alpha !== 255) throw new Error('Unsupported source line alpha.');
  return `#${(color % 0x1000000).toString(16).padStart(6, '0')}`;
}

export function importBarTenderObservation(input: unknown): LabelTemplate {
  if (!input || typeof input !== 'object') throw new Error('Invalid BarTender observation.');
  const snapshot = input as Record<string, any>;
  if (snapshot.format !== 'BarcodeFlowBarTenderObservation' || snapshot.version !== 1) {
    throw new Error('Unsupported BarTender observation format or version.');
  }
  if (snapshot.pageUnits !== 'mm' || !snapshot.page || !snapshot.document || !Array.isArray(snapshot.objects)) {
    throw new Error('BarTender observation requires explicit millimetre page units, document settings and objects.');
  }
  if (typeof snapshot.sourceSha256 !== 'string' || !/^[a-f\d]{64}$/i.test(snapshot.sourceSha256)) {
    throw new Error('BarTender observation requires a SHA256 source identity.');
  }
  if (!Number.isInteger(snapshot.objectCount) || snapshot.objectCount !== snapshot.objects.length || snapshot.objectCount > 10000) {
    throw new Error('BarTender observation object count does not match its records.');
  }
  const width = finiteNumber(snapshot.page.LabelWidth, 'LabelWidth');
  const height = finiteNumber(snapshot.page.LabelHeight, 'LabelHeight');
  if (width <= 0 || height <= 0) throw new Error('Source template dimensions must be positive.');
  const unitFactor = ({ 1: 25.4, 2: 10, 3: 1 } as Record<number, number>)[snapshot.document.MeasurementUnits];
  if (!unitFactor) throw new Error('Source object coordinate units are unavailable; conversion is blocked.');

  const evidence: BarTenderPropertyEvidence[] = [];
  const warnings = [
    'PARTIAL IMPORT: not production-ready. Only verified line geometry is converted; unresolved objects are omitted explicitly.',
    'Collection order is not verified stacking order. Source line dash/end-cap styles and print conditions are unavailable.',
    'Source DPI and template shape are unavailable; native defaults are 300 DPI and rectangular stock, not verified source settings.',
    'Source paper layout is retained as evidence, not mapped to label padding. Recheck stock, margins and printer before output.',
    'Processed display values are not imported as source definitions. Data bindings, transforms, forms and counters are unresolved.',
  ];
  const elements: ShapeElement[] = [];
  const sourceNames = new Set<string>();
  const indexes = new Set<number>();
  const sourceObjects: Array<{ sourceId: string; sourceName: string; sourceType: number; doNotPrint: boolean | null; importedElementId?: string }> = [];
  const identity = snapshot.sourceSha256.toLowerCase();
  for (const raw of snapshot.objects) {
    if (!raw || typeof raw.Name !== 'string' || !raw.Name.trim() || raw.Name.length > 1024 ||
        !Number.isInteger(raw.Type) || !Number.isInteger(raw.CollectionIndex) || raw.CollectionIndex < 1 ||
        sourceNames.has(raw.Name) || indexes.has(raw.CollectionIndex)) {
      throw new Error('Source objects require unique names, collection indexes and genuine type records.');
    }
    const source = raw as SourceObject;
    sourceNames.add(source.Name);
    indexes.add(source.CollectionIndex);
    const sourceId = `${identity}:${source.CollectionIndex}`;
    const entry: typeof sourceObjects[number] = { sourceId, sourceName: source.Name, sourceType: source.Type,
      doNotPrint: typeof source.DoNotPrint === 'boolean' ? source.DoNotPrint : null };
    sourceObjects.push(entry);
    const record = (property: string, status: BarTenderPropertyEvidence['status'], mapped: boolean, detail: string) => {
      evidence.push({ sourceName: source.Name, property, status, mapped, detail });
    };
    record('sourceIdentity', 'verified', true, 'Source SHA256, object name and collection index retained; index is not stacking order.');
    record('printable', typeof source.DoNotPrint === 'boolean' ? 'verified' : 'unavailable', false,
      'DoNotPrint is separate from designer visibility; conditional printing still requires verification.');
    record('sourceDataDefinitions', 'unavailable', false, 'Transformed Value is not a raw source definition and is deliberately ignored.');
    record('stackingOrder', 'unavailable', false, 'Collection index is not a verified z-order.');
    for (const property of ['X', 'Y', 'Width', 'Height', 'RotationAngle', 'FontName', 'FontSize', 'FontBold', 'FontItalic',
      'FontUnderline', 'FontStrikeout', 'FontScale', 'TextColor', 'FillColor', 'CornerRadius']) {
      record(property, source[property] !== null && source[property] !== undefined ? 'verified' : 'unavailable', false,
        'Observed through the source API, not mapped without complete object/anchor/source definitions. Zero text width is not a rendered bound.');
    }
    for (const property of ['transforms', 'serialization', 'printConditions', 'groups', 'layer', 'locked']) {
      record(property, 'unavailable', false, 'Not exposed by this observation; no source behavior is fabricated.');
    }
    const endpoints = ['LineStartX', 'LineStartY', 'LineEndX', 'LineEndY'];
    const hasLineEndpoints = endpoints.every(property => typeof source[property] === 'number' && Number.isFinite(source[property]));
    if (source.Type !== 2 || !hasLineEndpoints || typeof source.DoNotPrint !== 'boolean') {
      record('anchor', 'unavailable', false, 'Reference-point coordinates cannot be converted without the source anchor.');
      record('nativeObject', 'unsupported', false, 'Not converted: source definitions, anchor and object-specific settings are unresolved.');
      if (source.Type === 4) {
        for (const property of ['symbology', 'moduleWidth', 'humanReadable', 'barcodeSource']) {
          record(property, 'unavailable', false, 'No verified barcode setting; no substitute encoder or static payload is created.');
        }
      }
      warnings.push(`${source.Name}: not converted; anchor, source definitions and required object settings are unavailable.`);
      continue;
    }
    const startX = finiteNumber(source.LineStartX, 'LineStartX') * unitFactor;
    const startY = finiteNumber(source.LineStartY, 'LineStartY') * unitFactor;
    const endX = finiteNumber(source.LineEndX, 'LineEndX') * unitFactor;
    const endY = finiteNumber(source.LineEndY, 'LineEndY') * unitFactor;
    const length = Math.hypot(endX - startX, endY - startY);
    const strokeWidth = finiteNumber(source.LineThickness, 'LineThickness') * unitFactor;
    if (length <= 0 || strokeWidth <= 0) throw new Error(`Invalid line geometry for ${source.Name}.`);
    const elementId = `btw-${identity.slice(0, 16)}-${source.CollectionIndex}`;
    elements.push({
      id: elementId, name: source.Name, type: 'shape', shapeType: 'line',
      x: (startX + endX - length) / 2, y: (startY + endY) / 2,
      width: length, height: 0, rotation: Math.atan2(endY - startY, endX - startX) * 180 / Math.PI,
      referencePoint: 'center', locked: false, editable: true, visible: true,
      printable: !source.DoNotPrint, opacity: 1, zIndex: elements.length,
      fillColor: 'transparent', strokeColor: sourceColor(source.LineColor), strokeWidth,
      strokeStyle: 'solid', cornerRadius: 0,
    });
    entry.importedElementId = elementId;
    record('lineEndpoints', 'verified', true, 'Endpoint geometry converted exactly to native centre-rotated line coordinates in mm.');
    record('lineColorAndThickness', 'verified', true, 'Source numeric color and physical stroke thickness retained.');
    record('printableMapping', 'verified', true, 'Visible/editable in designer; printable is the inverse of verified DoNotPrint.');
    record('dashAndEndCaps', 'unavailable', false, 'Native solid stroke is provisional; source dash/end-cap style is not exposed.');
  }
  if (!elements.length) throw new Error('No accurately mappable source objects were found. No template was created.');
  const unsupported = sourceObjects.filter(source => !source.importedElementId);
  const unsupportedFeatures = unsupported.map(source => `${source.sourceName}: required properties unavailable; object not converted.`);
  const report: ImportReportStats & { propertyEvidence: BarTenderPropertyEvidence[]; productionReady: false } = {
    sourceFormat: 'BTW', fileName: snapshot.sourceFileName, totalDiscovered: sourceObjects.length,
    fullyEditable: 0, partiallyEditable: elements.length, graphicFallback: 0, unsupported: unsupported.length,
    warnings, unsupportedFeatures, textObjects: sourceObjects.filter(source => source.sourceType === 5).length,
    barcodeObjects: sourceObjects.filter(source => source.sourceType === 4).length,
    lineObjects: sourceObjects.filter(source => source.importedElementId).length,
    shapeObjects: sourceObjects.filter(source => source.sourceType === 3).length,
    imageObjects: 0, unsupportedObjects: unsupported.length, metadataRecords: 0,
    importStatus: 'PARTIAL', allObjectsIndividuallyEditable: false, propertyEvidence: evidence, productionReady: false,
  };
  const sourceName = typeof snapshot.sourceFileName === 'string' ? snapshot.sourceFileName.split(/[\\/]/).pop()! : 'BarTender';
  const now = new Date().toISOString();
  return {
    id: `btw-${identity.slice(0, 24)}`, name: `${sourceName.replace(/\.btw$/i, '')} (partial import)`,
    description: 'Partial BarTender-assisted conversion. Not production-ready; review the preserved import report.',
    category: 'Logistics', version: '1.0', status: 'draft',
    dimensions: { width, height, unit: 'mm', dpi: 300, orientation: width > height ? 'landscape' : 'portrait' },
    margins: { top: 0, right: 0, bottom: 0, left: 0, bleed: 0, safeZone: 0 },
    elements, variables: [], sampleRecords: [], tags: ['BarTender', 'Partial import', 'Not production-ready'],
    createdAt: now, updatedAt: now, createdBy: 'BarTender observation importer', importReport: report,
    sourceMetadata: {
      bartenderImport: { route: 'documented ActiveX observation', sourceFileName: sourceName, sourceSha256: identity,
        productionReady: false, sourceObjects, propertyEvidence: evidence,
        sourcePage: Object.fromEntries(['LabelWidth', 'LabelHeight', 'PaperWidth', 'PaperHeight', 'MarginLeft', 'MarginTop',
          'MarginRight', 'MarginBottom', 'LabelRows', 'LabelColumns'].map(property => [property, snapshot.page[property] ?? null])) },
    },
  };
}