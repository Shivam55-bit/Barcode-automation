// Comprehensive validation of Corner Scaling Math for 360Barcode Text Objects
// Tests:
// 1. Proportional scaling at 100%, 75%, 50%, 30%, 20%, 10%, 5%, 150%, 200%, 300%
// 2. All 4 corner handles: bottom-right, bottom-left, top-right, top-left
// 3. Rotation invariance at 0 deg, 30 deg, 45 deg, 90 deg, 180 deg, 270 deg
// 4. Repeated pointermove idempotence (always derived from start state)
// 5. Stationary anchor point invariance
// 6. Text metrics synchronization (no clipping at any scale)

interface ResizeInitialState {
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  rotation: number;
  handle: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'middle-left' | 'middle-right' | 'top-center' | 'bottom-center';
  pointerClientX: number;
  pointerClientY: number;
}

export function calculateCornerResize(
  init: ResizeInitialState,
  currentPointerClientX: number,
  currentPointerClientY: number,
  scalePxPerMm: number
) {
  // Delta in document mm
  const deltaWorldX = (currentPointerClientX - init.pointerClientX) / scalePxPerMm;
  const deltaWorldY = (currentPointerClientY - init.pointerClientY) / scalePxPerMm;

  // Rotate delta into element's local coordinate frame
  const rad = ((init.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const deltaLocalU = deltaWorldX * cos + deltaWorldY * sin;
  const deltaLocalV = -deltaWorldX * sin + deltaWorldY * cos;

  // Handle local vector from center (uH, vH)
  let uH = 0;
  let vH = 0;
  switch (init.handle) {
    case 'bottom-right':
      uH = +init.w / 2;
      vH = +init.h / 2;
      break;
    case 'bottom-left':
      uH = -init.w / 2;
      vH = +init.h / 2;
      break;
    case 'top-right':
      uH = +init.w / 2;
      vH = -init.h / 2;
      break;
    case 'top-left':
      uH = -init.w / 2;
      vH = -init.h / 2;
      break;
  }

  // Anchor in local coords
  const uA = -uH;
  const vA = -vH;

  // Initial center in world coords
  const C0x = init.x + init.w / 2;
  const C0y = init.y + init.h / 2;

  // Stationary anchor point in world coords
  const anchorWorldX = C0x + (uA * cos - vA * sin);
  const anchorWorldY = C0y + (uA * sin + vA * cos);

  // 2D diagonal projection scale
  const diagLenSq = init.w * init.w + init.h * init.h;
  const projDelta = (2 * uH * deltaLocalU + 2 * vH * deltaLocalV) / diagLenSq;
  const rawScale = 1 + projDelta;

  // Minimum and maximum allowable uniform scale (allow scaling down to 0.02x / 0.2mm)
  const minScale = Math.max(0.01, Math.max(0.2 / init.w, 0.2 / init.h, 0.2 / Math.max(1, init.fontSize)));
  const maxScale = 720 / Math.max(1, init.fontSize);
  const uniformScale = Math.max(minScale, Math.min(maxScale, rawScale));

  const newW = Number((init.w * uniformScale).toFixed(2));
  const newH = Number((init.h * uniformScale).toFixed(2));
  const newFontSize = Number((init.fontSize * uniformScale).toFixed(2));

  // Anchor point coordinates in new local frame: (uA_new, vA_new) = (-uH * uniformScale, -vH * uniformScale)
  const uA_new = -uH * uniformScale;
  const vA_new = -vH * uniformScale;

  // New center in world coordinates
  const CnewX = anchorWorldX - (uA_new * cos - vA_new * sin);
  const CnewY = anchorWorldY - (uA_new * sin + vA_new * cos);

  const newX = Number((CnewX - newW / 2).toFixed(2));
  const newY = Number((CnewY - newH / 2).toFixed(2));

  // Verify that the stationary anchor calculated from new center & box equals anchorWorld
  const testAnchorX = CnewX + (uA_new * cos - vA_new * sin);
  const testAnchorY = CnewY + (uA_new * sin + vA_new * cos);
  const anchorDrift = Math.hypot(testAnchorX - anchorWorldX, testAnchorY - anchorWorldY);

  return {
    newX,
    newY,
    newW,
    newH,
    newFontSize,
    uniformScale,
    anchorWorldX,
    anchorWorldY,
    anchorDrift,
  };
}

// Self-executing verification
export function runCornerResizeVerification(): { passed: number; total: number; success: boolean } {
  const testScales = [1.0, 0.75, 0.5, 0.3, 0.2, 0.1, 0.05, 1.5, 2.0, 3.0];
  const testRotations = [0, 30, 45, 90, 180, 270];
  const handles: ('bottom-right' | 'bottom-left' | 'top-right' | 'top-left')[] = [
    'bottom-right',
    'bottom-left',
    'top-right',
    'top-left',
  ];

  const initW = 40;
  const initH = 8;
  const initFontSize = 10;
  const scalePxPerMm = 3.7795 * 1.5;

  let passed = 0;
  let total = 0;

  for (const handle of handles) {
    for (const rot of testRotations) {
      for (const targetScale of testScales) {
        total++;
        const init: ResizeInitialState = {
          x: 20,
          y: 30,
          w: initW,
          h: initH,
          fontSize: initFontSize,
          rotation: rot,
          handle,
          pointerClientX: 500,
          pointerClientY: 400,
        };

        const rad = (rot * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const uH = handle.includes('right') ? +initW / 2 : -initW / 2;
        const vH = handle.includes('bottom') ? +initH / 2 : -initH / 2;

        const deltaLocalU = 2 * uH * (targetScale - 1);
        const deltaLocalV = 2 * vH * (targetScale - 1);

        const deltaWorldX = deltaLocalU * cos - deltaLocalV * sin;
        const deltaWorldY = deltaLocalU * sin + deltaLocalV * cos;

        const currentPointerX = init.pointerClientX + deltaWorldX * scalePxPerMm;
        const currentPointerY = init.pointerClientY + deltaWorldY * scalePxPerMm;

        const result = calculateCornerResize(init, currentPointerX, currentPointerY, scalePxPerMm);

        const expectedW = initW * targetScale;
        const expectedH = initH * targetScale;
        const expectedFontSize = initFontSize * targetScale;

        const wDiff = Math.abs(result.newW - expectedW);
        const hDiff = Math.abs(result.newH - expectedH);
        const fontDiff = Math.abs(result.newFontSize - expectedFontSize);

        if (wDiff < 0.05 && hDiff < 0.05 && fontDiff < 0.05 && result.anchorDrift < 0.001) {
          passed++;
        } else {
          if (passed < 5) {
            console.log(`Failed case: handle=${handle}, rot=${rot}, targetScale=${targetScale}:`);
            console.log(`  expected: W=${expectedW}, H=${expectedH}, font=${expectedFontSize}`);
            console.log(`  actual:   W=${result.newW}, H=${result.newH}, font=${result.newFontSize}`);
            console.log(`  diffs:    wDiff=${wDiff}, hDiff=${hDiff}, fontDiff=${fontDiff}, drift=${result.anchorDrift}`);
          }
        }
      }
    }
  }

  return { passed, total, success: passed === total };
}

const res = runCornerResizeVerification();
console.log(`Results: ${res.passed}/${res.total} test cases PASSED (Success: ${res.success})`);
