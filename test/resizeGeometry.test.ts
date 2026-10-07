import assert from 'node:assert/strict';
import test from 'node:test';
import { resizeBox, resizeHandles, rotateFromPointer, type ResizeBox, type ResizeHandle } from '../src/services/resizeGeometry';

function anchor(box: ResizeBox, handle: ResizeHandle) {
  const horizontal = handle.includes('left') ? 1 : handle.includes('right') ? -1 : 0;
  const vertical = handle.includes('top') ? 1 : handle.includes('bottom') ? -1 : 0;
  const radians = box.rotation * Math.PI / 180;
  const localX = horizontal * box.width / 2;
  const localY = vertical * box.height / 2;
  return { x: box.x + box.width / 2 + localX * Math.cos(radians) - localY * Math.sin(radians), y: box.y + box.height / 2 + localX * Math.sin(radians) + localY * Math.cos(radians) };
}

for (const zoom of [0.25, 0.5, 1, 2, 4]) {
  for (const rotation of [0, 30, 90, 175, 270]) {
    test(`RESIZE-${zoom}-${rotation}: every handle preserves its opposite anchor and document delta`, () => {
      const original = { x: 20.17, y: 18.93, width: 31.27, height: 8.41, rotation };
      for (const handle of resizeHandles) {
        const reference = resizeBox(original, handle, { x: 12, y: 7 }, 96 / 25.4, { proportional: true });
        const actual = resizeBox(original, handle, { x: 12 * zoom, y: 7 * zoom }, 96 / 25.4 * zoom, { proportional: true });
        for (const property of ['x', 'y', 'width', 'height'] as const) assert.ok(Math.abs(actual[property] - reference[property]) < 1e-10);
        const before = anchor(original, handle);
        const after = anchor(actual, handle);
        assert.ok(Math.hypot(before.x - after.x, before.y - after.y) < 1e-10, `${handle}: opposite anchor moved`);
        if (handle.includes('left') || handle.includes('right')) {
          if (handle.includes('top') || handle.includes('bottom')) assert.ok(Math.abs(actual.width / actual.height - original.width / original.height) < 1e-10);
        }
        const stationary = resizeBox(original, handle, { x: 0, y: 0 }, 96 / 25.4 * zoom);
        assert.ok(Math.abs(stationary.width - original.width) < 1e-10);
        assert.ok(Math.abs(stationary.x - original.x) < 1e-10);
      }
    });
  }
}

test('RESIZE-MINIMUM: crossing an anchor clamps dimensions without mirroring or NaN', () => {
  for (const handle of resizeHandles) {
    const result = resizeBox({ x: 1, y: 1, width: 10, height: 5, rotation: 45 }, handle, { x: -10000, y: 10000 }, 1, { proportional: true });
    assert.ok(result.width >= 0.5 && result.height >= 0.5);
    assert.ok(Object.values(result).every(Number.isFinite));
  }
  assert.throws(() => resizeBox({ x: 0, y: 0, width: 10, height: 5, rotation: 0 }, 'bottom-right', { x: NaN, y: 0 }, 1), /invalid resize/i);
});

test('ROTATE-ANCHOR: pointer-down angle does not jump or lose the existing rotation', () => {
  assert.equal(rotateFromPointer(37, 0.23, 0.23), 37);
  assert.ok(Math.abs(rotateFromPointer(37, 0.23, 0.23 + Math.PI / 2) - 127) < 1e-10);
  assert.equal(rotateFromPointer(0, 0, Math.PI / 4, true), 45);
});

test('RESIZE-MATRIX: every 2D handle preserves aspect and its opposite anchor after quantization', () => {
  for (const rotation of [0, 35, 90]) {
    const original = { x: 12, y: 15, width: 21, height: 21, rotation };
    for (const handle of resizeHandles) {
      const resized = resizeBox(original, handle, { x: 12, y: 15 }, 3, { lockAspectRatio: true, quantizeWidth: width => Math.max(1, Math.round(width / 3)) * 3 });
      assert.ok(Math.abs(resized.width - resized.height) < 1e-10);
      assert.equal(resized.width % 3, 0);
      const before = anchor(original, handle);
      const after = anchor(resized, handle);
      assert.ok(Math.hypot(before.x - after.x, before.y - after.y) < 1e-10);
    }
  }
});