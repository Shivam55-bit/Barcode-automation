export const resizeHandles = ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right'] as const;
export type ResizeHandle = typeof resizeHandles[number];

export interface ResizeBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

const directions: Record<ResizeHandle, [number, number]> = {
  'top-left': [-1, -1], 'top-center': [0, -1], 'top-right': [1, -1],
  'middle-left': [-1, 0], 'middle-right': [1, 0],
  'bottom-left': [-1, 1], 'bottom-center': [0, 1], 'bottom-right': [1, 1],
};

export function resizeBox(
  original: ResizeBox,
  handle: ResizeHandle,
  clientDelta: { x: number; y: number },
  pixelsPerMm: number,
  options: { proportional?: boolean; lockAspectRatio?: boolean; minSize?: number; minScale?: number; maxScale?: number; snapDelta?: (value: number) => number; quantizeWidth?: (width: number) => number } = {}
): ResizeBox & { scale: number } {
  if (![original.x, original.y, original.width, original.height, original.rotation, clientDelta.x, clientDelta.y, pixelsPerMm].every(Number.isFinite) ||
      original.width <= 0 || original.height <= 0 || pixelsPerMm <= 0 || !directions[handle]) {
    throw new Error('Invalid resize geometry or pointer coordinates.');
  }
  const [horizontal, vertical] = directions[handle];
  const radians = original.rotation * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const worldX = clientDelta.x / pixelsPerMm;
  const worldY = clientDelta.y / pixelsPerMm;
  const localX = worldX * cosine + worldY * sine;
  const localY = -worldX * sine + worldY * cosine;
  const minimum = options.minSize ?? 0.5;
  let scale = 1;
  let width = original.width;
  let height = original.height;
  const proportional = options.lockAspectRatio || (horizontal && vertical && options.proportional);
  if (proportional) {
    const projection = horizontal && vertical
      ? (horizontal * original.width * localX + vertical * original.height * localY) / (original.width ** 2 + original.height ** 2)
      : horizontal ? horizontal * localX / original.width : vertical * localY / original.height;
    const lower = Math.max(minimum / original.width, minimum / original.height, options.minScale ?? 0);
    scale = Math.max(lower, Math.min(options.maxScale ?? Infinity, 1 + projection));
    width *= scale;
    height *= scale;
  } else {
    const snap = options.snapDelta ?? ((value: number) => value);
    if (horizontal) width = Math.max(minimum, original.width + horizontal * snap(localX));
    if (vertical) height = Math.max(minimum, original.height + vertical * snap(localY));
  }
  if (options.quantizeWidth && (horizontal || options.lockAspectRatio)) {
    width = Math.max(minimum, options.quantizeWidth(width));
    if (proportional) {
      scale = width / original.width;
      height = original.height * scale;
    }
  }
  const anchorLocalX = -horizontal * original.width / 2;
  const anchorLocalY = -vertical * original.height / 2;
  const anchorX = original.x + original.width / 2 + anchorLocalX * cosine - anchorLocalY * sine;
  const anchorY = original.y + original.height / 2 + anchorLocalX * sine + anchorLocalY * cosine;
  const newAnchorX = -horizontal * width / 2;
  const newAnchorY = -vertical * height / 2;
  return {
    x: anchorX - newAnchorX * cosine + newAnchorY * sine - width / 2,
    y: anchorY - newAnchorX * sine - newAnchorY * cosine - height / 2,
    width, height, rotation: original.rotation, scale,
  };
}

export function rotateFromPointer(originalRotation: number, originalAngle: number, currentAngle: number, snap = false): number {
  const difference = Math.atan2(Math.sin(currentAngle - originalAngle), Math.cos(currentAngle - originalAngle));
  const rotation = originalRotation + difference * 180 / Math.PI;
  const rounded = snap ? Math.round(rotation / 15) * 15 : rotation;
  return (rounded % 360 + 360) % 360;
}