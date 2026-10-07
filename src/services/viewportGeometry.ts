export const CSS_PIXELS_PER_MM = 96 / 25.4;
export const MIN_VIEW_ZOOM = 0.1;
export const MAX_VIEW_ZOOM = 32;

export interface ViewportPoint {
  x: number;
  y: number;
}

export interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ViewportTransform {
  zoom: number;
  panX: number;
  panY: number;
}

export function documentToViewport(
  point: ViewportPoint,
  transform: ViewportTransform,
): ViewportPoint {
  const scale = CSS_PIXELS_PER_MM * transform.zoom;
  return {
    x: transform.panX + point.x * scale,
    y: transform.panY + point.y * scale,
  };
}

export function viewportToDocument(
  point: ViewportPoint,
  transform: ViewportTransform,
): ViewportPoint {
  const scale = CSS_PIXELS_PER_MM * transform.zoom;
  return {
    x: (point.x - transform.panX) / scale,
    y: (point.y - transform.panY) / scale,
  };
}

export function normalizeViewportRect(start: ViewportPoint, end: ViewportPoint): ViewportRect {
  return {
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

export function getFitZoom(
  documentWidthMm: number,
  documentHeightMm: number,
  viewportWidthPx: number,
  viewportHeightPx: number,
  paddingPx: number,
): number | null {
  if (
    ![documentWidthMm, documentHeightMm, viewportWidthPx, viewportHeightPx, paddingPx].every(Number.isFinite) ||
    documentWidthMm <= 0 ||
    documentHeightMm <= 0 ||
    viewportWidthPx <= paddingPx * 2 ||
    viewportHeightPx <= paddingPx * 2 ||
    paddingPx < 0
  ) {
    return null;
  }

  const usableWidth = viewportWidthPx - paddingPx * 2;
  const usableHeight = viewportHeightPx - paddingPx * 2;
  const zoom = Math.min(
    usableWidth / (documentWidthMm * CSS_PIXELS_PER_MM),
    usableHeight / (documentHeightMm * CSS_PIXELS_PER_MM),
  );
  return Math.max(MIN_VIEW_ZOOM, Math.min(MAX_VIEW_ZOOM, zoom));
}

export function centerDocumentRect(
  rect: ViewportRect,
  transform: Pick<ViewportTransform, 'zoom'>,
  viewportWidthPx: number,
  viewportHeightPx: number,
): ViewportTransform | null {
  if (
    ![rect.left, rect.top, rect.width, rect.height, transform.zoom, viewportWidthPx, viewportHeightPx].every(Number.isFinite) ||
    rect.width <= 0 ||
    rect.height <= 0 ||
    transform.zoom <= 0 ||
    viewportWidthPx <= 0 ||
    viewportHeightPx <= 0
  ) {
    return null;
  }

  const scale = CSS_PIXELS_PER_MM * transform.zoom;
  return {
    zoom: transform.zoom,
    panX: viewportWidthPx / 2 - (rect.left + rect.width / 2) * scale,
    panY: viewportHeightPx / 2 - (rect.top + rect.height / 2) * scale,
  };
}

export function fitDocumentRect(
  rect: ViewportRect,
  viewportWidthPx: number,
  viewportHeightPx: number,
  paddingPx: number,
): ViewportTransform | null {
  const zoom = getFitZoom(rect.width, rect.height, viewportWidthPx, viewportHeightPx, paddingPx);
  return zoom === null ? null : centerDocumentRect(rect, { zoom }, viewportWidthPx, viewportHeightPx);
}
