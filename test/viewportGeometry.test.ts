import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CSS_PIXELS_PER_MM,
  MAX_VIEW_ZOOM,
  MIN_VIEW_ZOOM,
  centerDocumentRect,
  documentToViewport,
  fitDocumentRect,
  getFitZoom,
  normalizeViewportRect,
  viewportToDocument,
} from '../src/services/viewportGeometry';

test('viewport coordinate conversion round-trips without changing document units', () => {
  const transform = { zoom: 2.75, panX: -183.25, panY: 92.5 };
  const documentPoint = { x: 124.5, y: 37.25 };
  const screenPoint = documentToViewport(documentPoint, transform);
  const restored = viewportToDocument(screenPoint, transform);
  assert.ok(Math.abs(restored.x - documentPoint.x) < 1e-10);
  assert.ok(Math.abs(restored.y - documentPoint.y) < 1e-10);
});

test('rectangle normalization supports every drag direction', () => {
  assert.deepEqual(normalizeViewportRect({ x: 90, y: 70 }, { x: 20, y: 10 }), {
    left: 20, top: 10, width: 70, height: 60,
  });
});

test('rectangle fitting preserves aspect ratio and centers its document region', () => {
  const rect = { left: 20, top: 30, width: 80, height: 40 };
  const fitted = fitDocumentRect(rect, 1000, 700, 20);
  assert.ok(fitted);
  const zoom = Math.min(
    960 / (rect.width * CSS_PIXELS_PER_MM),
    660 / (rect.height * CSS_PIXELS_PER_MM),
  );
  assert.ok(Math.abs(fitted.zoom - zoom) < 1e-10);
  const center = documentToViewport(
    { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    fitted,
  );
  assert.ok(Math.abs(center.x - 500) < 1e-10);
  assert.ok(Math.abs(center.y - 350) < 1e-10);
});

test('template fitting uses both usable viewport dimensions and zoom limits', () => {
  const zoom = getFitZoom(100, 200, 800, 600, 24);
  assert.ok(zoom !== null);
  assert.ok(Math.abs(zoom - Math.min(752 / (100 * CSS_PIXELS_PER_MM), 552 / (200 * CSS_PIXELS_PER_MM))) < 1e-10);
  const landscapeZoom = getFitZoom(300, 80, 1000, 700, 24);
  assert.ok(landscapeZoom !== null);
  assert.ok(Math.abs(landscapeZoom - Math.min(952 / (300 * CSS_PIXELS_PER_MM), 652 / (80 * CSS_PIXELS_PER_MM))) < 1e-10);
  assert.equal(getFitZoom(0, 200, 800, 600, 24), null);
  assert.equal(getFitZoom(100, 200, 40, 40, 24), null);
  assert.equal(getFitZoom(100000, 200000, 800, 600, 24), MIN_VIEW_ZOOM);
  assert.equal(getFitZoom(0.001, 0.001, 800, 600, 24), MAX_VIEW_ZOOM);
});

test('center calculation rejects invalid geometry and preserves normalized fit zoom', () => {
  const rect = { left: -10, top: 5, width: 25, height: 50 };
  const centered = centerDocumentRect(rect, { zoom: 1.5 }, 900, 500);
  assert.ok(centered);
  const center = documentToViewport({ x: 2.5, y: 30 }, centered);
  assert.ok(Math.abs(center.x - 450) < 1e-10);
  assert.ok(Math.abs(center.y - 250) < 1e-10);
  assert.equal(centerDocumentRect({ ...rect, width: 0 }, { zoom: 1 }, 900, 500), null);
});
