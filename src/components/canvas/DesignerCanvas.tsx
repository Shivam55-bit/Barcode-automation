import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LabelTemplate, LabelElement, TextElement, BarcodeElement, CanvasGuide, ViewportState, OpenDocument } from '../../types';
import { isMultiLineTextElement, isSingleLineTextElement, isTextFitToBoxEnabled, measureTextObject, normalizeTextForObjectType } from '../../services/textMeasurementEngine';
import { evaluateElementData } from '../../services/dataSourceEngine';
import { calculateBarcodeLayout, getSymbologyMetadata, getBarcodeModuleColumns, quantizeBarcodeWidth } from '../../services/barcodeEngine';
import { resizeBox, rotateFromPointer, type ResizeHandle } from '../../services/resizeGeometry';
import {
  CSS_PIXELS_PER_MM,
  MAX_VIEW_ZOOM,
  MIN_VIEW_ZOOM,
  documentToViewport,
  fitDocumentRect,
  normalizeViewportRect,
  viewportToDocument,
  type ViewportPoint,
} from '../../services/viewportGeometry';
import { HorizontalRuler, VerticalRuler, RulerCorner } from './Rulers';
import { CanvasElement } from './CanvasElement';
import { ContextMenu } from './ContextMenu';
import { RightVerticalToolbar } from './RightVerticalToolbar';
import { DocumentTabBar } from './DocumentTabBar';
import { Printer, Plus, ZoomIn, ZoomOut, Target, Maximize2, FileText, FolderOpen, ChevronDown, Check, Scan, MoveHorizontal, Frame } from 'lucide-react';

import { flushSync } from 'react-dom';

interface ResizeInitialState {
  elementId: string;
  element: LabelElement;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  fontSize: number;
  fontWidthScale: number;
  lineHeight: number;
  letterSpacing: number;
  barWidth?: number;
  barHeight?: number;
  xDimensionMm?: number;
  moduleColumns?: number;
  pointerClientX: number;
  pointerClientY: number;
  handle: string;
  isText: boolean;
  isBarcode: boolean;
  isParagraph: boolean;
}

interface DesignerCanvasProps {
  template: LabelTemplate;
  selectedElementIds: string[];
  onSelectElements: (ids: string[]) => void;
  onUpdateElement: (id: string, updates: Partial<LabelElement>, skipHistory?: boolean) => void;
  onRestoreElement: (element: LabelElement) => void;
  onUpdateMultipleElements: (updates: { id: string; updates: Partial<LabelElement> }[], skipHistory?: boolean) => void;
  onCommitHistory?: () => void;
  onDeleteSelected: () => void;
  onDuplicateSelected: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onBringForward?: () => void;
  onSendBackward?: () => void;
  onGroup?: () => void;
  onUngroup?: () => void;
  onLockToggle: () => void;
  onOpenProperties?: () => void;
  onOpenBarcodePicker: () => void;
  onOpenBarcodeProperties?: () => void;
  onOpenRichTextEditor?: (el: TextElement) => void;
  onOpenSymbolPicker?: (el: TextElement) => void;
  onOpenPageSetup?: () => void;
  onInsertElementAt?: (el: Partial<LabelElement>, xMm: number, yMm: number) => void;
  onInsertPresetAt?: (presetKey: string, xMm: number, yMm: number) => void;
  onBindElementToField?: (elementId: string, payload: any) => void;
  onInsertBoundElementAt?: (payload: any, xMm: number, yMm: number, asType?: 'text' | 'barcode' | 'qr') => void;
  viewport: ViewportState;
  setViewport: React.Dispatch<React.SetStateAction<ViewportState>>;
  onRegisterFitToWindow?: (fit: (() => void) | null) => void;
  onRegisterExitFitMode?: (exitFit: (() => void) | null) => void;
  onExitZoomRectangle?: () => void;
  onZoomRectangleTool?: () => void;
  recordData: Record<string, string>;
  onCursorMove?: (xMm: number, yMm: number) => void;
  // Multi-Document Tabs
  documents?: OpenDocument[];
  activeInstanceId?: string | null;
  onSelectTab?: (instanceId: string) => void;
  onCloseTab?: (instanceId: string) => void;
  onNewTemplate?: () => void;
  onNewForm?: () => void;
  onOpenDocument?: () => void;
  onSaveDoc?: (instanceId: string) => void;
  onSaveAll?: () => void;
  onDuplicateDoc?: (instanceId: string) => void;
  onCloseOthers?: (instanceId: string) => void;
  onCloseAll?: () => void;
  activePrinterName?: string;
  activeTool?: string;
  onDataEditElement?: (element: LabelElement) => void;
}

export const DesignerCanvas: React.FC<DesignerCanvasProps> = ({
  template,
  selectedElementIds,
  onSelectElements,
  onUpdateElement,
  onRestoreElement,
  onUpdateMultipleElements,
  onCommitHistory,
  onDeleteSelected,
  onDuplicateSelected,
  onCut,
  onCopy,
  onPaste,
  onUndo,
  onRedo,
  onBringToFront,
  onSendToBack,
  onBringForward,
  onSendBackward,
  onGroup,
  onUngroup,
  onLockToggle,
  onOpenProperties,
  onOpenBarcodePicker,
  onOpenBarcodeProperties,
  onOpenRichTextEditor,
  onOpenSymbolPicker,
  onOpenPageSetup,
  onInsertElementAt,
  onInsertPresetAt,
  onBindElementToField,
  onInsertBoundElementAt,
  viewport,
  setViewport,
  onRegisterFitToWindow,
  onRegisterExitFitMode,
  onExitZoomRectangle,
  onZoomRectangleTool,
  recordData,
  onCursorMove,
  documents,
  activeInstanceId,
  onSelectTab,
  onCloseTab,
  onNewTemplate,
  onNewForm,
  onOpenDocument,
  onSaveDoc,
  onSaveAll,
  onDuplicateDoc,
  onCloseOthers,
  onCloseAll,
  activePrinterName,
  activeTool,
  onDataEditElement,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cursorMm, setCursorMm] = useState({ x: 10.9, y: 22.1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isFitMode, setIsFitMode] = useState(false);
  const isFitModeRef = useRef(false);
  const [zoomRect, setZoomRect] = useState<{ start: ViewportPoint; current: ViewportPoint } | null>(null);
  const zoomRectGestureRef = useRef<{
    pointerId: number;
    start: ViewportPoint;
    current: ViewportPoint;
    transform: { zoom: number; panX: number; panY: number };
  } | null>(null);

  // Dragging elements state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [dragInitialElements, setDragInitialElements] = useState<{ id: string; x: number; y: number }[]>([]);

  // Resizing state
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizingElementId, setResizingElementId] = useState<string | null>(null);
  const [resizeInitialState, setResizeInitialState] = useState<ResizeInitialState | null>(null);

  // Rotation state
  const [isRotating, setIsRotating] = useState(false);
  const [rotatingElementId, setRotatingElementId] = useState<string | null>(null);
  const [rotateCenter, setRotateCenter] = useState<{ x: number; y: number } | null>(null);
  const gestureRef = useRef<{ element: LabelElement; pointerId: number; originalAngle?: number } | null>(null);

  // Selection box state
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);

  const cancelGesture = useCallback(() => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    gestureRef.current = null;
    onRestoreElement(gesture.element);
    if (containerRef.current?.hasPointerCapture(gesture.pointerId)) containerRef.current.releasePointerCapture(gesture.pointerId);
    setIsResizing(false);
    setIsRotating(false);
    setResizeInitialState(null);
  }, [onRestoreElement]);

  const exitFitMode = useCallback(() => {
    isFitModeRef.current = false;
    setIsFitMode(false);
  }, []);
  const cancelZoomRectangle = useCallback(() => {
    const gesture = zoomRectGestureRef.current;
    zoomRectGestureRef.current = null;
    setZoomRect(null);
    if (gesture && containerRef.current?.hasPointerCapture(gesture.pointerId)) {
      containerRef.current.releasePointerCapture(gesture.pointerId);
    }
    if (activeTool === 'zoom-rect') onExitZoomRectangle?.();
  }, [activeTool, onExitZoomRectangle]);

  useEffect(() => {
    if (activeTool !== 'zoom-rect' && zoomRectGestureRef.current) {
      cancelZoomRectangle();
    }
  }, [activeTool, cancelZoomRectangle]);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && activeTool === 'zoom-rect') {
        event.preventDefault();
        event.stopPropagation();
        cancelZoomRectangle();
      } else if (event.key === 'Escape' && gestureRef.current) {
        event.preventDefault();
        event.stopPropagation();
        cancelGesture();
      }
    };
    window.addEventListener('keydown', onEscape, true);
    return () => window.removeEventListener('keydown', onEscape, true);
  }, [activeTool, cancelGesture, cancelZoomRectangle]);

  // Interactive guides state
  const [guides, setGuides] = useState<CanvasGuide[]>([
    { id: 'g1', type: 'vertical', position: 10 },
    { id: 'g2', type: 'horizontal', position: 10 },
  ]);

  // Inline direct text editing state
  const [editingElementId, setEditingElementId] = useState<string | null>(null);

  // Exit edit mode if edited element is deselected
  useEffect(() => {
    if (editingElementId && !selectedElementIds.includes(editingElementId)) {
      setEditingElementId(null);
    }
  }, [selectedElementIds, editingElementId]);

  const handleStartTextEdit = useCallback((el: LabelElement) => {
    if (activeTool === 'zoom-rect') return;
    if (el.locked || el.isEditable === false || el.editable === false) return;
    if (el.type !== 'text') return;

    // Check if element is data-bound
    const isDataBound = Boolean(
      el.dataBinding ||
      (el.dataSources && el.dataSources.length > 0 && el.dataSources.some(ds => ds.type !== 'embedded' && ds.enabled !== false)) ||
      (el.dataSources && el.dataSources.length > 1)
    );

    if (isDataBound) {
      if (onDataEditElement) {
        onDataEditElement(el);
      } else if (onOpenProperties) {
        onOpenProperties();
      }
      return;
    }

    setEditingElementId(el.id);
  }, [activeTool, onDataEditElement, onOpenProperties]);

  const handleCommitInlineText = useCallback((id: string, newText: string) => {
    const targetEl = template.elements.find((e) => e.id === id);
    if (!targetEl || targetEl.type !== 'text') {
      setEditingElementId(null);
      return;
    }

    const textEl = targetEl as TextElement;
    const normalizedText = normalizeTextForObjectType(newText, textEl.textType || (isSingleLineTextElement(textEl) ? 'single-line' : 'multi-line'));
    if (textEl.text === normalizedText) {
      setEditingElementId(null);
      return;
    }

    const updates: Partial<TextElement> = {
      text: normalizedText,
    };

    if (textEl.dataSources && textEl.dataSources.length === 1 && textEl.dataSources[0].type === 'embedded') {
      updates.dataSources = [{ ...textEl.dataSources[0], value: newText }];
    }

    const isMultiLine = isMultiLineTextElement(textEl);

    // Only single-line in explicit auto-width mode recalculates container width and height
    const isSingleLineAutoWidth =
      isSingleLineTextElement(textEl) &&
      (textEl.sizingMode === 'auto-width' || (!textEl.sizingMode && textEl.autoSize !== false));

    if (isSingleLineAutoWidth) {
      const dims = measureTextObject({
        text: newText,
        fontFamily: textEl.fontFamily,
        fontSize: textEl.fontSize,
        fontWeight: textEl.fontWeight,
        fontStyle: textEl.fontStyle,
        letterSpacing: textEl.letterSpacing,
        lineHeight: textEl.lineHeight,
        fontWidthScale: textEl.fontWidthScale || 100,
        textType: 'single-line',
        textFormatType: 'single-line',
        multiline: false,
        wrap: false,
        borderConfig: textEl.borderConfig,
        ignoreMinSize: true,
      });
      updates.width = dims.width;
      updates.height = dims.height;
      updates.autoSize = true;
      updates.sizingMode = 'auto-width';
    }

    const autoHeightEnabled = textEl.autoHeight ?? textEl.autoSize === true;
    if (autoHeightEnabled && (textEl.textFormatType === 'paragraph' || textEl.textType === 'paragraph')) {
      const dimensions = measureTextObject({
        text: normalizedText,
        fontFamily: textEl.fontFamily,
        fontSize: textEl.fontSize,
        fontWeight: textEl.fontWeight,
        fontStyle: textEl.fontStyle,
        letterSpacing: textEl.letterSpacing,
        lineHeight: textEl.lineHeight,
        fontWidthScale: textEl.fontWidthScale || 100,
        textType: 'paragraph',
        textFormatType: 'paragraph',
        multiline: true,
        wrap: textEl.wrap !== false && textEl.wordWrap !== false,
        containerWidthMm: textEl.width,
        borderConfig: textEl.borderConfig,
      });
      updates.height = dimensions.height;
    }

    onUpdateElement(id, updates);
    setEditingElementId(null);
  }, [template.elements, onUpdateElement]);

  const handleCancelInlineText = useCallback(() => {
    setEditingElementId(null);
  }, []);

  const handleDraftResize = useCallback((id: string, widthMm: number, heightMm: number) => {
    const el = template.elements.find((e) => e.id === id);
    if (el && el.type === 'text') {
      const txt = el as TextElement;
      const isMulti = isMultiLineTextElement(txt);
      const autoHeight = txt.autoHeight ?? txt.autoSize === true;
      if (!isMulti && (txt.sizingMode === 'auto-width' || (!txt.sizingMode && txt.autoSize !== false))) {
        onUpdateElement(id, { width: widthMm, height: heightMm, autoSize: true }, true);
      } else if (isMulti && autoHeight && (txt.textFormatType === 'paragraph' || txt.textType === 'paragraph')) {
        onUpdateElement(id, { height: heightMm }, true);
      }
    }
  }, [template.elements, onUpdateElement]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; element: LabelElement | null } | null>(null);

  // BarTender style Zoom popup menu state
  const [isZoomMenuOpen, setIsZoomMenuOpen] = useState(false);
  const zoomMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (zoomMenuRef.current && !zoomMenuRef.current.contains(e.target as Node)) {
        setIsZoomMenuOpen(false);
      }
    };
    if (isZoomMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isZoomMenuOpen]);

  const baseScale = CSS_PIXELS_PER_MM;
  const scale = baseScale * viewport.zoom;

  // Selected Element
  const selectedElement = template.elements.find(el => selectedElementIds.includes(el.id)) || null;

  // Center label in the workspace viewport
  const centerInView = useCallback((customZoom?: number) => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    if (containerWidth <= 0 || containerHeight <= 0) return;

    setViewport(prev => {
      const currentZoom = customZoom !== undefined ? customZoom : prev.zoom;
      const currentScale = baseScale * currentZoom;
      const labelWidth = template.dimensions.width * currentScale;
      const labelHeight = template.dimensions.height * currentScale;

      // Center label precisely in the viewport
      const targetPanX = Math.round((containerWidth - labelWidth) / 2);
      const targetPanY = Math.round((containerHeight - labelHeight) / 2);

      return {
        ...prev,
        zoom: currentZoom,
        panX: targetPanX,
        panY: targetPanY,
      };
    });
  }, [template.dimensions.width, template.dimensions.height, setViewport]);

  // Zoom In (Centered on viewport)
  const handleZoomIn = useCallback(() => {
    exitFitMode();
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    setViewport(v => {
      const nextZoom = Math.min(MAX_VIEW_ZOOM, Number((v.zoom * 1.25).toFixed(2)));
      const factor = nextZoom / v.zoom;
      const cX = containerWidth / 2;
      const cY = containerHeight / 2;
      const nextPanX = Math.round(cX - (cX - v.panX) * factor);
      const nextPanY = Math.round(cY - (cY - v.panY) * factor);
      return { ...v, zoom: nextZoom, panX: nextPanX, panY: nextPanY };
    });
  }, [setViewport, exitFitMode]);

  // Zoom Out (Centered on viewport)
  const handleZoomOut = useCallback(() => {
    exitFitMode();
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    setViewport(v => {
      const nextZoom = Math.max(MIN_VIEW_ZOOM, Number((v.zoom / 1.25).toFixed(2)));
      const factor = nextZoom / v.zoom;
      const cX = containerWidth / 2;
      const cY = containerHeight / 2;
      const nextPanX = Math.round(cX - (cX - v.panX) * factor);
      const nextPanY = Math.round(cY - (cY - v.panY) * factor);
      return { ...v, zoom: nextZoom, panX: nextPanX, panY: nextPanY };
    });
  }, [setViewport, exitFitMode]);

  // Fit label to workspace with padding
  const fitToWindow = useCallback(() => {
    const viewportElement = containerRef.current;
    if (!viewportElement) return;
    const fitted = fitDocumentRect(
      { left: 0, top: 0, width: template.dimensions.width, height: template.dimensions.height },
      viewportElement.clientWidth,
      viewportElement.clientHeight,
      24,
    );
    if (!fitted) return;
    setViewport(previous => ({ ...previous, ...fitted }));
    isFitModeRef.current = true;
    setIsFitMode(true);
  }, [template.dimensions.width, template.dimensions.height, setViewport]);

  useEffect(() => {
    onRegisterFitToWindow?.(fitToWindow);
    return () => onRegisterFitToWindow?.(null);
  }, [fitToWindow, onRegisterFitToWindow]);

  useEffect(() => {
    onRegisterExitFitMode?.(exitFitMode);
    return () => onRegisterExitFitMode?.(null);
  }, [exitFitMode, onRegisterExitFitMode]);

  useEffect(() => {
    const viewportElement = containerRef.current;
    if (!isFitMode || !viewportElement) return;

    const observer = new ResizeObserver(() => {
      if (!isFitModeRef.current) return;
      const fitted = fitDocumentRect(
        { left: 0, top: 0, width: template.dimensions.width, height: template.dimensions.height },
        viewportElement.clientWidth,
        viewportElement.clientHeight,
        24,
      );
      if (fitted) setViewport(previous => ({ ...previous, ...fitted }));
    });
    observer.observe(viewportElement);
    return () => observer.disconnect();
  }, [template.dimensions.width, template.dimensions.height, setViewport, isFitMode]);

  // Fit label width in window
  const fitTemplateWidthInWindow = useCallback(() => {
    exitFitMode();
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    if (containerWidth <= 0 || containerHeight <= 0) return;

    const availW = Math.max(100, containerWidth - 60);
    const baseW = template.dimensions.width * baseScale;
    const targetZoom = Math.max(0.1, Math.min(10.0, Number((availW / baseW).toFixed(2))));

    const labelHeight = template.dimensions.height * baseScale * targetZoom;
    const targetPanX = Math.round((containerWidth - baseW * targetZoom) / 2);
    const targetPanY = labelHeight < containerHeight ? Math.round((containerHeight - labelHeight) / 2) : 30;

    setViewport(v => ({
      ...v,
      zoom: targetZoom,
      panX: targetPanX,
      panY: targetPanY,
    }));
  }, [template.dimensions.width, template.dimensions.height, setViewport, exitFitMode]);

  // Fit all objects in window
  const fitAllObjectsInWindow = useCallback(() => {
    exitFitMode();
    if (!containerRef.current || template.elements.length === 0) {
      fitToWindow();
      return;
    }
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    if (containerWidth <= 0 || containerHeight <= 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    template.elements.forEach(el => {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    });

    const bboxW = Math.max(5, maxX - minX);
    const bboxH = Math.max(5, maxY - minY);
    const centerObjX = (minX + maxX) / 2;
    const centerObjY = (minY + maxY) / 2;

    const availW = Math.max(100, containerWidth - 80);
    const availH = Math.max(100, containerHeight - 80);

    const baseW = bboxW * baseScale;
    const baseH = bboxH * baseScale;

    const targetZoom = Math.max(0.1, Math.min(16.0, Number(Math.min(availW / baseW, availH / baseH).toFixed(2))));

    const targetPanX = Math.round(containerWidth / 2 - centerObjX * baseScale * targetZoom);
    const targetPanY = Math.round(containerHeight / 2 - centerObjY * baseScale * targetZoom);

    setViewport(v => ({
      ...v,
      zoom: targetZoom,
      panX: targetPanX,
      panY: targetPanY,
    }));
  }, [template.elements, fitToWindow, setViewport, exitFitMode]);

  // Zoom to selection / rectangle
  const zoomToSelection = useCallback(() => {
    exitFitMode();
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    if (containerWidth <= 0 || containerHeight <= 0) return;

    const selectedEls = template.elements.filter(el => selectedElementIds.includes(el.id));
    if (selectedEls.length === 0) {
      fitToWindow();
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedEls.forEach(el => {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    });

    const bboxW = Math.max(5, maxX - minX);
    const bboxH = Math.max(5, maxY - minY);
    const centerSelX = (minX + maxX) / 2;
    const centerSelY = (minY + maxY) / 2;

    const availW = Math.max(100, containerWidth - 80);
    const availH = Math.max(100, containerHeight - 80);

    const baseW = bboxW * baseScale;
    const baseH = bboxH * baseScale;

    const targetZoom = Math.max(0.1, Math.min(24.0, Number(Math.min(availW / baseW, availH / baseH).toFixed(2))));

    const targetPanX = Math.round(containerWidth / 2 - centerSelX * baseScale * targetZoom);
    const targetPanY = Math.round(containerHeight / 2 - centerSelY * baseScale * targetZoom);

    setViewport(v => ({
      ...v,
      zoom: targetZoom,
      panX: targetPanX,
      panY: targetPanY,
    }));
  }, [selectedElementIds, template.elements, fitToWindow, setViewport, exitFitMode]);

  // Auto-fit & center canvas ONLY on initial load and template ID change
  useEffect(() => {
    const timer = setTimeout(() => {
      fitToWindow();
    }, 80);
    return () => clearTimeout(timer);
  }, [template.id]);

  // Track spacebar for pan tool
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Snap helper function with fine precision (0.5mm on grid, 0.1mm free)
  const snapValue = useCallback((val: number, gridSizeMm: number = 0.5) => {
    if (!viewport.snapToGrid) return Number((Math.round(val * 10) / 10).toFixed(1));
    return Number((Math.round(val / gridSizeMm) * gridSizeMm).toFixed(1));
  }, [viewport.snapToGrid]);

  const getClippedViewportPoint = (clientX: number, clientY: number): ViewportPoint | null => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Math.max(0, Math.min(rect.width, clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, clientY - rect.top)),
    };
  };

  const beginZoomRectangle = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool !== 'zoom-rect' || event.button !== 0 || !containerRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    exitFitMode();
    const start = getClippedViewportPoint(event.clientX, event.clientY);
    if (!start) return;
    zoomRectGestureRef.current = {
      pointerId: event.pointerId,
      start,
      current: start,
      transform: { zoom: viewport.zoom, panX: viewport.panX, panY: viewport.panY },
    };
    setZoomRect({ start, current: start });
    containerRef.current.setPointerCapture(event.pointerId);
  };

  const updateZoomRectangle = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = zoomRectGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const current = getClippedViewportPoint(event.clientX, event.clientY);
    if (!current) return;
    gesture.current = current;
    setZoomRect({ start: gesture.start, current });
  };

  const finishZoomRectangle = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = zoomRectGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const current = getClippedViewportPoint(event.clientX, event.clientY) || gesture.current;
    const selection = normalizeViewportRect(gesture.start, current);
    const viewportElement = containerRef.current;
    zoomRectGestureRef.current = null;
    setZoomRect(null);

    if (
      viewportElement &&
      selection.width >= 8 &&
      selection.height >= 8
    ) {
      const docStart = viewportToDocument(
        { x: selection.left, y: selection.top },
        gesture.transform,
      );
      const docEnd = viewportToDocument(
        { x: selection.left + selection.width, y: selection.top + selection.height },
        gesture.transform,
      );
      const documentRect = normalizeViewportRect(docStart, docEnd);
      const fitted = fitDocumentRect(
        documentRect,
        viewportElement.clientWidth,
        viewportElement.clientHeight,
        24,
      );
      if (fitted) setViewport(previous => ({ ...previous, ...fitted }));
    }

    if (viewportElement.hasPointerCapture(event.pointerId)) {
      viewportElement.releasePointerCapture(event.pointerId);
    }
    onExitZoomRectangle?.();
  };

  const cancelZoomRectanglePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (zoomRectGestureRef.current?.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    cancelZoomRectangle();
  };

  // Handle Mouse Move over workspace
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Convert to mm on canvas
    const { x: xMm, y: yMm } = viewportToDocument(
      { x: mouseX, y: mouseY },
      viewport,
    );
    const roundedX = Math.round(xMm * 10) / 10;
    const roundedY = Math.round(yMm * 10) / 10;
    setCursorMm({ x: roundedX, y: roundedY });
    onCursorMove?.(roundedX, roundedY);

    if (activeTool === 'zoom-rect') return;

    // 1. Panning Workspace
    if (isPanning) {
      setViewport(prev => ({
        ...prev,
        panX: prev.panX + (e.clientX - panStart.x),
        panY: prev.panY + (e.clientY - panStart.y),
      }));
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // 2. Dragging Elements with smooth delta & unbounded movement beyond label boundaries
    if (isDragging && dragInitialElements.length > 0) {
      const startPoint = viewportToDocument({ x: dragStartPos.x, y: dragStartPos.y }, { ...viewport, panX: 0, panY: 0 });
      const currentPoint = viewportToDocument({ x: e.clientX, y: e.clientY }, { ...viewport, panX: 0, panY: 0 });
      const deltaX = currentPoint.x - startPoint.x;
      const deltaY = currentPoint.y - startPoint.y;

      const updates = dragInitialElements.map(item => {
        const targetX = item.x + deltaX;
        const targetY = item.y + deltaY;

        return {
          id: item.id,
          updates: {
            x: snapValue(targetX),
            y: snapValue(targetY),
          },
        };
      });
      onUpdateMultipleElements(updates, true);
      return;
    }

    // 3. Resizing Element
    if (isResizing && resizeInitialState) {
      const init = resizeInitialState;
      const isCornerHandle =
        init.handle === 'top-left' ||
        init.handle === 'top-right' ||
        init.handle === 'bottom-left' ||
        init.handle === 'bottom-right';
      const targetEl = init.element;
      const isText = targetEl && targetEl.type === 'text';
      const textEl = isText ? (targetEl as TextElement) : null;
      const isArc = textEl ? (textEl.textType === 'arc' || textEl.textFormatType === 'arc') : false;
      const isMultiLine = textEl ? (textEl.textType === 'multi-line' || textEl.multiline || textEl.textFormatType === 'paragraph' || textEl.textType === 'paragraph') : false;
      const isSingleLineText = isText && !!textEl && !isMultiLine && !isArc;
      // BarTender parity: corner handles proportionally scale a text object's font (and
      // letter spacing / per-run sizes), while the side handles change the wrap box only.
      const scaleTextFont = isCornerHandle && (
        textEl?.sizingMode === 'scale-text' ||
        isArc ||
        (isSingleLineText && !!textEl && !isTextFitToBoxEnabled(textEl))
      );
      const is2D = targetEl.type === 'barcode' && getSymbologyMetadata((targetEl as BarcodeElement).symbology).is2D;
      const isBarcode = targetEl.type === 'barcode';
      const resized = resizeBox(
        { x: init.x, y: init.y, width: init.w, height: init.h, rotation: init.rotation },
        init.handle as ResizeHandle,
        { x: e.clientX - init.pointerClientX, y: e.clientY - init.pointerClientY },
        scale,
        {
          // 1D barcodes resize width (module/X-dimension) and height (bar height)
          // independently; only 2D symbologies keep square modules via lockAspectRatio.
          proportional: (!isText && !isBarcode) || isArc || textEl?.sizingMode === 'scale-text' || scaleTextFont,
          lockAspectRatio: is2D,
          quantizeWidth: init.moduleColumns ? width => quantizeBarcodeWidth(width, init.moduleColumns!, template.dimensions.dpi || 300).width : undefined,
          minScale: isText && scaleTextFont ? (textEl?.minFontSize ?? 1) / init.fontSize : undefined,
          maxScale: isText && scaleTextFont ? (textEl?.maxFontSize ?? 720) / init.fontSize : undefined,
          snapDelta: viewport.snapToGrid && viewport.gridSize > 0 ? delta => Math.round(delta / viewport.gridSize) * viewport.gridSize : undefined,
        }
      );
      const { x: newX, y: newY, width: newW, height: newH, scale: uniformScale } = resized;

      if (isText && textEl) {
        if (scaleTextFont) {
          onUpdateElement(init.elementId, {
            x: newX,
            y: newY,
            width: newW,
            height: newH,
            fontSize: Number((init.fontSize * uniformScale).toFixed(4)),
            fontWidthScale: 100,
            letterSpacing: init.letterSpacing * uniformScale,
            runs: textEl.runs?.map(run => ({ ...run, fontSize: (run.fontSize ?? init.fontSize) * uniformScale })),
            blocks: textEl.blocks?.map(block => ({ ...block, runs: block.runs.map(run => ({ ...run, fontSize: (run.fontSize ?? init.fontSize) * uniformScale })) })),
            ...(isArc ? {
              arcRadius: (textEl.arcConfig?.radius ?? textEl.arcRadius ?? 50) * uniformScale,
              arcConfig: {
                startAngle: textEl.arcStartAngle ?? 0,
                sweepAngle: textEl.arcSweepAngle ?? 180,
                direction: textEl.arcDirection ?? 'clockwise',
                insidePath: !!textEl.arcInsidePath,
                characterSpacing: textEl.arcCharacterSpacing ?? 1,
                ...textEl.arcConfig,
                radius: (textEl.arcConfig?.radius ?? textEl.arcRadius ?? 50) * uniformScale,
              },
            } : {}),
            sizingMode: isArc ? textEl.sizingMode : 'scale-text',
            autoSize: false,
            autoFit: false,
          }, true);
        } else if (isMultiLine) {
          // Multi-line container resize (any of the 8 handles):
          // Left: x changes + width changes
          // Right: width changes
          // Top: y changes + height changes
          // Bottom: height changes
          // Corners: width + height change
          // Text reflows inside container; font size NEVER changes.
          const autoHeightEnabled = !isTextFitToBoxEnabled(textEl) && (textEl.autoHeight ?? textEl.autoSize === true);
          const setsFixedHeight = init.handle !== 'middle-left' && init.handle !== 'middle-right';
          onUpdateElement(init.elementId, {
            x: newX,
            y: newY,
            width: newW,
            height: newH,
            autoSize: false,
            autoHeight: autoHeightEnabled && !setsFixedHeight,
            autoFit: isTextFitToBoxEnabled(textEl),
          }, true);
        } else {
          // Single-line text resize (any of the 8 handles):
          // User manually sizing width switches single-line to fixed-width mode
          // Glyph shapes NEVER scale or distort; font size NEVER changes.
          onUpdateElement(init.elementId, {
            x: newX,
            y: newY,
            width: newW,
            height: newH,
            sizingMode: textEl.sizingMode === 'auto-width' ? 'fixed-width' : textEl.sizingMode || 'fixed-width',
            autoSize: false,
            autoFit: isTextFitToBoxEnabled(textEl),
          }, true);
        }
      } else if (targetEl && targetEl.type === 'barcode') {
        const barcodeEl = targetEl as BarcodeElement;
        const widthScale = newW / Math.max(1, init.w);
        const newXDim = init.moduleColumns
          ? newW / init.moduleColumns
          : (init.xDimensionMm || barcodeEl.xDimensionMm || 0.38) * widthScale;

        const hrtMetrics = calculateBarcodeLayout(barcodeEl);
        const newBarH = barcodeEl.includeText && hrtMetrics.hrtHeightMm > 0
          ? Math.max(0.5, newH - hrtMetrics.hrtHeightMm - hrtMetrics.hrtGapMm)
          : newH;

        onUpdateElement(init.elementId, {
          x: newX,
          y: newY,
          width: newW,
          height: newH,
          barHeight: newBarH,
          xDimensionMm: newXDim,
          moduleWidth: newXDim,
          symbol: { ...barcodeEl.symbol, barHeight: newBarH, moduleWidth: newXDim },
        }, true);
      } else {
        onUpdateElement(init.elementId, {
          x: newX,
          y: newY,
          width: newW,
          height: newH,
        }, true);
      }
      return;
    }

    // 4. Rotating Element
    if (isRotating && rotatingElementId && rotateCenter) {
      const angleRad = Math.atan2(e.clientY - rotateCenter.y, e.clientX - rotateCenter.x);
      const gesture = gestureRef.current;
      if (gesture?.originalAngle !== undefined) {
        onUpdateElement(rotatingElementId, { rotation: rotateFromPointer(gesture.element.rotation || 0, gesture.originalAngle, angleRad, e.shiftKey) }, true);
      }
      return;
    }

    // 5. Box Selecting
    if (isBoxSelecting && selectionBox) {
      setSelectionBox(prev => prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null);
    }
  };

  // Mouse Up End Actions
  const handleMouseUp = () => {
    if (activeTool === 'zoom-rect') return;
    const gesture = gestureRef.current;
    gestureRef.current = null;
    if (gesture && containerRef.current?.hasPointerCapture(gesture.pointerId)) containerRef.current.releasePointerCapture(gesture.pointerId);
    flushSync(() => {
      if (isDragging || isResizing || isRotating) {
        onCommitHistory?.();
      }
      setIsPanning(false);
      setIsDragging(false);
      setIsResizing(false);
      setIsRotating(false);
      setResizeInitialState(null);
    });

    if (isBoxSelecting && selectionBox && containerRef.current) {
      const dragDist = Math.hypot(selectionBox.startX - selectionBox.currentX, selectionBox.startY - selectionBox.currentY);
      // Only perform multi-element bounding box selection if user actively dragged > 4px
      if (dragDist > 4) {
        const rect = containerRef.current.getBoundingClientRect();
        const startDoc = viewportToDocument(
          { x: Math.min(selectionBox.startX, selectionBox.currentX) - rect.left, y: Math.min(selectionBox.startY, selectionBox.currentY) - rect.top },
          viewport,
        );
        const endDoc = viewportToDocument(
          { x: Math.max(selectionBox.startX, selectionBox.currentX) - rect.left, y: Math.max(selectionBox.startY, selectionBox.currentY) - rect.top },
          viewport,
        );
        const minX = startDoc.x;
        const maxX = endDoc.x;
        const minY = startDoc.y;
        const maxY = endDoc.y;

        const hitElements = template.elements.filter(
          el => el.x < maxX && el.x + el.width > minX && el.y < maxY && el.y + el.height > minY
        );
        onSelectElements(hitElements.map(el => el.id));
      }
    }
    setIsBoxSelecting(false);
    setSelectionBox(null);
  };

  // Start Canvas Background Mouse Down (Pan or Box Select or Deselect)
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (activeTool === 'zoom-rect') {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.button === 1 || isSpacePressed) {
      exitFitMode();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (e.button === 0) {
      const target = e.target as HTMLElement;
      const isElementClick = target.closest('[id^="canvas-el-"]');
      if (isElementClick) {
        return; // Clicked on element, do not trigger background deselection or box select
      }
      if (!e.shiftKey) {
        onSelectElements([]);
      }
      setIsBoxSelecting(true);
      setSelectionBox({
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
      });
    }
  };

  // Mouse Wheel Zoom / Pan
  const handleWheel = (e: React.WheelEvent) => {
    exitFitMode();
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      setViewport(prev => ({
        ...prev,
        zoom: Math.max(MIN_VIEW_ZOOM, Math.min(MAX_VIEW_ZOOM, Number((prev.zoom + delta).toFixed(2)))),
      }));
    } else {
      setViewport(prev => ({
        ...prev,
        panX: prev.panX - e.deltaX * 0.5,
        panY: prev.panY - e.deltaY * 0.5,
      }));
    }
  };

  // Element Selection with Group Awareness
  const handleElementSelect = (e: React.MouseEvent, element: LabelElement) => {
    if (activeTool === 'zoom-rect') {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    e.stopPropagation();
    if (activeTool === 'data-edit') {
      onSelectElements([element.id]);
      if (onDataEditElement) {
        onDataEditElement(element);
      }
      return;
    }

    const targetGroupIds = element.groupId
      ? template.elements.filter((el) => el.groupId === element.groupId).map((el) => el.id)
      : [element.id];

    if (e.shiftKey) {
      const allSelected = targetGroupIds.every((id) => selectedElementIds.includes(id));
      if (allSelected) {
        onSelectElements(selectedElementIds.filter((id) => !targetGroupIds.includes(id)));
      } else {
        onSelectElements(Array.from(new Set([...selectedElementIds, ...targetGroupIds])));
      }
    } else {
      // Direct click selects this element or its group cleanly
      onSelectElements(targetGroupIds);
    }
  };

  // Start Dragging Selected Element(s)
  const handleStartDrag = (e: React.MouseEvent, element: LabelElement) => {
    if (activeTool === 'data-edit' || activeTool === 'zoom-rect') {
      return;
    }
    e.stopPropagation();
    setIsDragging(true);
    setDragStartPos({ x: e.clientX, y: e.clientY });

    const targetGroupIds = element.groupId
      ? template.elements.filter((el) => el.groupId === element.groupId).map((el) => el.id)
      : [element.id];

    const activeIds = selectedElementIds.includes(element.id)
      ? Array.from(new Set([...selectedElementIds, ...targetGroupIds]))
      : targetGroupIds;

    const initials = template.elements
      .filter((el) => activeIds.includes(el.id) && !el.locked)
      .map((el) => ({ id: el.id, x: el.x, y: el.y }));

    setDragInitialElements(initials);
  };

  // Start Resizing Handle
  const handleStartResize = (e: React.MouseEvent, handle: string, element: LabelElement) => {
    if (activeTool === 'zoom-rect') return;
    if (element.locked || element.allowResize === false || element.editable === false || element.isEditable === false) return;
    e.preventDefault();
    e.stopPropagation();
    const pointerId = (e as React.PointerEvent).pointerId;
    gestureRef.current = { element: structuredClone(element), pointerId };
    containerRef.current?.setPointerCapture(pointerId);
    setIsResizing(true);
    setResizeHandle(handle);
    setResizingElementId(element.id);
    setDragStartPos({ x: e.clientX, y: e.clientY });

    const isTextEl = element.type === 'text';
    const textEl = isTextEl ? (element as TextElement) : null;
    // Match the renderer's auto-size detection (CanvasElement) so the resize starts
    // from the exact dimensions currently drawn on screen. Otherwise corner scaling
    // divides by a stale width/height and the font size jumps incorrectly.
    const isSingleLine =
      !textEl?.textType || textEl.textType === 'single-line' || textEl?.textFormatType === 'single-line';
    const isTextAutoSize =
      isTextEl &&
      !!textEl &&
      textEl.textType !== 'arc' && textEl.textFormatType !== 'arc' &&
      (textEl.sizingMode === 'auto-width' || (!textEl.sizingMode && textEl.autoSize !== false && isSingleLine));

    let effectiveW = element.width;
    let effectiveH = element.height;
    let moduleColumns: number | undefined;
    if (element.type === 'barcode') {
      effectiveH = calculateBarcodeLayout(element as BarcodeElement).totalHeightMm;
      try { moduleColumns = getBarcodeModuleColumns(element as BarcodeElement, { record: recordData }); } catch { moduleColumns = undefined; }
    }

    if (textEl) {
      const isParagraph = textEl.textFormatType === 'paragraph' || textEl.textType === 'paragraph';
      if (isTextAutoSize || effectiveW <= 0 || effectiveH <= 0) {
        const evaluatedContent = evaluateElementData(textEl, { record: recordData });
        const dims = measureTextObject({
          text: typeof evaluatedContent === 'string' ? evaluatedContent : textEl.text,
          fontFamily: textEl.fontFamily,
          fontSize: textEl.fontSize || 12,
          fontWeight: textEl.fontWeight,
          fontStyle: textEl.fontStyle,
          letterSpacing: textEl.letterSpacing,
          lineHeight: textEl.lineHeight,
          fontWidthScale: textEl.fontWidthScale,
          textType: textEl.textType,
          textFormatType: textEl.textFormatType,
          multiline: textEl.multiline,
          wrap: textEl.wrap || textEl.wordWrap,
          containerWidthMm: isParagraph && textEl.width > 0 ? textEl.width : undefined,
          borderConfig: textEl.borderConfig,
        });
        effectiveW = isParagraph && textEl.width > 0 ? textEl.width : dims.width;
        effectiveH = dims.height;
      }
    }

    setResizeInitialState({
      elementId: element.id,
      element: structuredClone(element),
      x: element.x,
      y: element.y,
      w: Math.max(0.5, effectiveW),
      h: Math.max(0.5, effectiveH),
      rotation: element.rotation || 0,
      fontSize: textEl ? (textEl.fontSize || 12) : 12,
      fontWidthScale: textEl?.fontWidthScale || 100,
      lineHeight: textEl?.lineHeight || 1.15,
      letterSpacing: textEl?.letterSpacing || 0,
      barWidth: (element as any).barWidth,
      barHeight: (element as any).barHeight || element.height,
      xDimensionMm: (element as any).xDimensionMm,
      moduleColumns,
      pointerClientX: e.clientX,
      pointerClientY: e.clientY,
      handle,
      isText: isTextEl,
      isBarcode: element.type === 'barcode',
      isParagraph: isTextEl && (textEl?.textFormatType === 'paragraph' || textEl?.textType === 'paragraph'),
    });
  };

  // Start Rotation
  const handleStartRotate = (e: React.MouseEvent, element: LabelElement) => {
    if (activeTool === 'zoom-rect') return;
    if (element.locked || element.allowRotate === false || element.editable === false || element.isEditable === false) return;
    e.preventDefault();
    e.stopPropagation();
    setIsRotating(true);
    setRotatingElementId(element.id);

    const elDom = document.getElementById(`canvas-el-${element.id}`);
    if (elDom) {
      const rect = elDom.getBoundingClientRect();
      const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      const pointerId = (e as React.PointerEvent).pointerId;
      gestureRef.current = { element: structuredClone(element), pointerId, originalAngle: Math.atan2(e.clientY - center.y, e.clientX - center.x) };
      containerRef.current?.setPointerCapture(pointerId);
      setRotateCenter(center);
    }
  };

  // Alignment Helpers from Right Dock
  const handleAlign = (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (!selectedElementIds.length) return;
    const selected = template.elements.filter(el => selectedElementIds.includes(el.id));
    if (selected.length === 1) {
      // Align to page bounds
      const el = selected[0];
      let updates: Partial<LabelElement> = {};
      if (alignment === 'left') updates.x = 0;
      if (alignment === 'center') updates.x = (template.dimensions.width - el.width) / 2;
      if (alignment === 'right') updates.x = template.dimensions.width - el.width;
      if (alignment === 'top') updates.y = 0;
      if (alignment === 'middle') updates.y = (template.dimensions.height - el.height) / 2;
      if (alignment === 'bottom') updates.y = template.dimensions.height - el.height;
      onUpdateElement(el.id, updates);
    } else {
      // Align relative to each other
      const minX = Math.min(...selected.map(e => e.x));
      const maxX = Math.max(...selected.map(e => e.x + e.width));
      const minY = Math.min(...selected.map(e => e.y));
      const maxY = Math.max(...selected.map(e => e.y + e.height));
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      const updates = selected.map(el => {
        let u: Partial<LabelElement> = {};
        if (alignment === 'left') u.x = minX;
        if (alignment === 'center') u.x = centerX - el.width / 2;
        if (alignment === 'right') u.x = maxX - el.width;
        if (alignment === 'top') u.y = minY;
        if (alignment === 'middle') u.y = centerY - el.height / 2;
        if (alignment === 'bottom') u.y = maxY - el.height;
        return { id: el.id, updates: u };
      });
      onUpdateMultipleElements(updates);
    }
  };

  const handleCenterPage = (axis: 'h' | 'v' | 'both') => {
    if (!selectedElementIds.length) return;
    const selected = template.elements.filter(el => selectedElementIds.includes(el.id));
    selected.forEach(el => {
      let updates: Partial<LabelElement> = {};
      if (axis === 'h' || axis === 'both') {
        updates.x = Number(((template.dimensions.width - el.width) / 2).toFixed(2));
      }
      if (axis === 'v' || axis === 'both') {
        updates.y = Number(((template.dimensions.height - el.height) / 2).toFixed(2));
      }
      onUpdateElement(el.id, updates);
    });
  };

  const handleDistribute = (axis: 'horizontal' | 'vertical') => {
    const selected = template.elements.filter(el => selectedElementIds.includes(el.id));
    if (selected.length < 3) return;
    if (axis === 'horizontal') {
      const sorted = [...selected].sort((a, b) => a.x - b.x);
      const minX = sorted[0].x;
      const maxX = sorted[sorted.length - 1].x;
      const totalSpan = maxX - minX;
      const step = totalSpan / (sorted.length - 1);
      const updates = sorted.map((el, i) => ({ id: el.id, updates: { x: Number((minX + i * step).toFixed(2)) } }));
      onUpdateMultipleElements(updates);
    } else {
      const sorted = [...selected].sort((a, b) => a.y - b.y);
      const minY = sorted[0].y;
      const maxY = sorted[sorted.length - 1].y;
      const totalSpan = maxY - minY;
      const step = totalSpan / (sorted.length - 1);
      const updates = sorted.map((el, i) => ({ id: el.id, updates: { y: Number((minY + i * step).toFixed(2)) } }));
      onUpdateMultipleElements(updates);
    }
  };

  const handleRotateDock = (deltaDeg: number) => {
    if (!selectedElementIds.length) return;
    const selected = template.elements.filter(el => selectedElementIds.includes(el.id));
    selected.forEach(el => {
      onUpdateElement(el.id, { rotation: ((el.rotation || 0) + deltaDeg) % 360 });
    });
  };

  if (documents && documents.length === 0) {
    return (
      <div className="flex-1 flex flex-col bg-[#9fbddb] select-none h-full relative overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-white/50 border border-white/80 rounded-2xl flex items-center justify-center mb-4 shadow-sm backdrop-blur-xs">
            <FileText className="w-8 h-8 text-slate-700" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">No document is open</h3>
          <p className="text-xs text-slate-700 mb-6 max-w-sm">
            Create a new BarcodeFlow label template or open an existing file to start designing.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onNewTemplate}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-md text-xs font-bold shadow-sm flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Document</span>
            </button>
            {onOpenDocument && (
              <button
                onClick={onOpenDocument}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-md text-xs font-bold shadow-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                <FolderOpen className="w-4 h-4 text-emerald-700" />
                <span>Open Document...</span>
              </button>
            )}
          </div>
        </div>
        {/* Bottom Status Bar */}
        <div className="h-5 bg-[#e4ebf5] border-t border-[#cbd5e1] flex items-center justify-between px-2 text-[10.5px] text-slate-600">
          <span>Ready</span>
          <span>BarcodeFlow Enterprise Suite v2.5.0</span>
        </div>
      </div>
    );
  }

  const labelScreenSize = documentToViewport(
    { x: template.dimensions.width, y: template.dimensions.height },
    { zoom: viewport.zoom, panX: 0, panY: 0 },
  );
  const labelWidthPx = labelScreenSize.x;
  const labelHeightPx = labelScreenSize.y;

  // Determine label physical shape and corner radius
  const rawShape = (template as any).shape || (template.dimensions as any)?.shape || 'rectangle';
  const labelShape = rawShape === 'rounded' || rawShape === 'round-rectangle' ? 'rounded' : rawShape;
  const rawCornerRadiusMm = (template as any).cornerRadius ?? (template.dimensions as any)?.cornerRadius ?? (labelShape === 'rounded' ? 1.5 : 0);

  let sheetBorderRadius = '0px';
  let innerBorderRadius = '0px';

  if (labelShape === 'circle' || labelShape === 'ellipse' || labelShape === 'oval') {
    sheetBorderRadius = '50%';
    innerBorderRadius = '50%';
  } else if (labelShape === 'rounded') {
    const radiusPx = Math.max(0, rawCornerRadiusMm * scale);
    sheetBorderRadius = `${radiusPx}px`;
    innerBorderRadius = `${Math.max(0, radiusPx - 2)}px`;
  } else {
    // 'rectangle' -> sharp 90-degree square corners
    sheetBorderRadius = '0px';
    innerBorderRadius = '0px';
  }

  // Status Bar Metrics & Unit Scaling
  const unitLabel = viewport.unit === 'inch' ? 'in' : viewport.unit;
  const unitMultiplier = viewport.unit === 'inch' ? 1 / 25.4 : viewport.unit === 'px' ? 96 / 25.4 : 1;
  const unitDecimals = viewport.unit === 'inch' ? 3 : viewport.unit === 'px' ? 0 : 1;
  const formatUnitVal = (valMm: number) => (valMm * unitMultiplier).toFixed(unitDecimals);

  // Selected Object Identification & Bounding Box
  let objectLabel = 'Object: None (Label Page)';
  let coordX = '0.0';
  let coordY = '0.0';
  let angleStr = '0.0°';
  let widthStr = formatUnitVal(template.dimensions.width);
  let heightStr = formatUnitVal(template.dimensions.height);
  let xDimDisplay = '--';

  if (selectedElementIds.length === 1 && selectedElement) {
    objectLabel = `Object: ${selectedElement.name}`;
    coordX = formatUnitVal(selectedElement.x);
    coordY = formatUnitVal(selectedElement.y);
    angleStr = `${(selectedElement.rotation || 0).toFixed(1)}°`;
    widthStr = formatUnitVal(selectedElement.width);
    heightStr = formatUnitVal(selectedElement.height);

    if (selectedElement.type === 'barcode') {
      const rawModuleWidth = (selectedElement as any).moduleWidth || (selectedElement as any).xDimension || (selectedElement.width / 50);
      const xDimMm = typeof rawModuleWidth === 'number' ? rawModuleWidth : parseFloat(rawModuleWidth) || 0.33;
      xDimDisplay = `${(xDimMm * unitMultiplier).toFixed(2)}${unitLabel}`;
    }
  } else if (selectedElementIds.length > 1) {
    const selectedList = template.elements.filter(e => selectedElementIds.includes(e.id));
    if (selectedList.length > 0) {
      const minX = Math.min(...selectedList.map(e => e.x));
      const minY = Math.min(...selectedList.map(e => e.y));
      const maxX = Math.max(...selectedList.map(e => e.x + e.width));
      const maxY = Math.max(...selectedList.map(e => e.y + e.height));
      objectLabel = `Object: ${selectedElementIds.length} Objects Selected`;
      coordX = formatUnitVal(minX);
      coordY = formatUnitVal(minY);
      angleStr = '--';
      widthStr = formatUnitVal(maxX - minX);
      heightStr = formatUnitVal(maxY - minY);
    }
  } else {
    // When no object is selected, show label origin (0.0, 0.0)
    coordX = '0.0';
    coordY = '0.0';
    angleStr = '0.0°';
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#9fbddb] relative overflow-hidden select-none">
      {/* 1. Top Horizontal Ruler */}
      {viewport.showRulers && (
        <div className="flex h-5 bg-[#e4ebf5]">
          <RulerCorner
            unit={viewport.unit}
            onToggleUnit={() => setViewport(v => ({ ...v, unit: v.unit === 'mm' ? 'inch' : 'mm' }))}
          />
          <div className="flex-1 overflow-hidden">
            <HorizontalRuler
              widthMm={template.dimensions.width}
              heightMm={template.dimensions.height}
              zoom={viewport.zoom}
              unit={viewport.unit}
              cursorX={cursorMm.x}
              cursorY={cursorMm.y}
              panX={viewport.panX}
              panY={viewport.panY}
              guides={guides}
              onAddGuide={(type, pos) => setGuides(g => [...g, { id: `g-${Date.now()}`, type, position: pos }])}
            />
          </div>
          {/* Top-right filler for right toolbar width */}
          <div className="w-8 h-5 bg-[#e4ebf5] border-b border-l border-[#cbd5e1] shrink-0" />
        </div>
      )}

      {/* 2. Main Workspace Stage (Canvas + Right Dock) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Vertical Ruler */}
        {viewport.showRulers && (
          <div className="w-5 h-full shrink-0 overflow-hidden bg-[#e4ebf5]">
            <VerticalRuler
              widthMm={template.dimensions.width}
              heightMm={template.dimensions.height}
              zoom={viewport.zoom}
              unit={viewport.unit}
              cursorX={cursorMm.x}
              cursorY={cursorMm.y}
              panX={viewport.panX}
              panY={viewport.panY}
              guides={guides}
              onAddGuide={(type, pos) => setGuides(g => [...g, { id: `g-${Date.now()}`, type, position: pos }])}
            />
          </div>
        )}

        {/* Interactive Infinite Canvas Container (Steel Blue Background) */}
        <div
          ref={containerRef}
          className={`flex-1 h-full bg-[#9fbddb] relative overflow-hidden ${
            activeTool === 'zoom-rect'
              ? 'cursor-crosshair'
              : isSpacePressed || isPanning
              ? 'cursor-grab active:cursor-grabbing'
              : activeTool === 'data-edit'
              ? 'cursor-cell'
              : 'cursor-default'
          }`}
          onPointerDownCapture={beginZoomRectangle}
          onPointerMoveCapture={updateZoomRectangle}
          onPointerUpCapture={finishZoomRectangle}
          onPointerCancelCapture={cancelZoomRectanglePointer}
          onMouseDown={handleCanvasMouseDown}
          onPointerMove={handleMouseMove}
          onPointerUp={handleMouseUp}
          onPointerCancel={cancelGesture}
          onLostPointerCapture={(event) => {
            cancelGesture();
            if (zoomRectGestureRef.current?.pointerId === event.pointerId) cancelZoomRectangle();
          }}
          onWheel={handleWheel}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Calculate precise drop coordinate in mm on the label sheet
            const rawX = (mouseX - viewport.panX) / scale;
            const rawY = (mouseY - viewport.panY) / scale;
            const dropX = Math.max(0, snapValue(rawX));
            const dropY = Math.max(0, snapValue(rawY));

            try {
              const rawData = e.dataTransfer.getData('application/json');
              if (!rawData) return;
              const payload = JSON.parse(rawData);

              if (payload.type === 'database-field' && onInsertBoundElementAt) {
                onInsertBoundElementAt(payload, dropX, dropY, payload.suggestedType);
              } else if (payload.type === 'element' && payload.data && onInsertElementAt) {
                onInsertElementAt(payload.data, dropX, dropY);
              } else if (payload.type === 'preset' && payload.presetKey && onInsertPresetAt) {
                onInsertPresetAt(payload.presetKey, dropX, dropY);
              }
            } catch (err) {
              console.error('Error handling canvas drop:', err);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, element: null });
          }}
        >
          {/* Workspace Pan/Zoom Container */}
          <div
            className="absolute transition-transform duration-0 ease-linear origin-top-left"
            style={{
              transform: `translate(${viewport.panX}px, ${viewport.panY}px)`,
            }}
          >
            {/* The Die-Cut Label Sheet */}
            <div
              id="label-canvas-page"
              className="relative shadow-xl transition-all duration-75 border border-slate-300"
              style={{
                width: `${labelWidthPx}px`,
                height: `${labelHeightPx}px`,
                borderRadius: sheetBorderRadius,
                backgroundColor:
                  template.background?.showInDesigner && template.background?.useColor && template.background?.color
                    ? template.background.color
                    : '#ffffff',
                backgroundImage:
                  template.background?.showInDesigner && template.background?.useImage && template.background?.imageUrl
                    ? `url('${template.background.imageUrl}')`
                    : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            >
              {/* Optional Grid Overlay */}
              {viewport.showGrid && (
                <div
                  className="absolute inset-0 pointer-events-none opacity-30 overflow-hidden"
                  style={{
                    borderRadius: sheetBorderRadius,
                    backgroundImage: `
                      linear-gradient(to right, #94a3b8 1px, transparent 1px),
                      linear-gradient(to bottom, #94a3b8 1px, transparent 1px)
                    `,
                    backgroundSize: `${viewport.gridSize * scale}px ${viewport.gridSize * scale}px`,
                  }}
                />
              )}

              {/* Optional Margin & Bleed Guides */}
              {viewport.showMargins && (
                <>
                  {/* Safe Zone Inner Border */}
                  <div
                    className="absolute pointer-events-none border border-dashed border-emerald-400"
                    style={{
                      top: `${template.margins.top * scale}px`,
                      left: `${template.margins.left * scale}px`,
                      right: `${template.margins.right * scale}px`,
                      bottom: `${template.margins.bottom * scale}px`,
                      borderRadius: innerBorderRadius,
                    }}
                  />
                </>
              )}

              {/* Render All Label Elements */}
              {template.elements.map((el) => (
                <CanvasElement
                  key={el.id}
                  element={el}
                  isSelected={selectedElementIds.includes(el.id)}
                  isEditing={editingElementId === el.id}
                  onSelect={handleElementSelect}
                  onDoubleClick={() => {
                    if (el.type === 'text') {
                      const textEl = el as TextElement;
                      const isRichOrMarkup =
                        textEl.textType === 'word-processor' ||
                        textEl.textType === 'rtf' ||
                        textEl.textType === 'html' ||
                        textEl.textType === 'xaml';
                      const isSymbol = textEl.textType === 'symbol-font';

                      if (isRichOrMarkup && onOpenRichTextEditor) {
                        onOpenRichTextEditor(textEl);
                      } else if (isSymbol && onOpenSymbolPicker) {
                        onOpenSymbolPicker(textEl);
                      } else {
                        handleStartTextEdit(el);
                      }
                    } else if (el.type === 'barcode' && onOpenBarcodeProperties) {
                      onOpenBarcodeProperties();
                    } else if (onOpenProperties) {
                      onOpenProperties();
                    }
                  }}
                  onStartEdit={handleStartTextEdit}
                  onCommitEdit={handleCommitInlineText}
                  onCancelEdit={handleCancelInlineText}
                  onDraftResize={handleDraftResize}
                  onGrowParagraphToFit={(textElement, heightMm) => onUpdateElement(textElement.id, {
                    height: heightMm,
                    autoHeight: true,
                    autoSize: false,
                    autoFit: false,
                    sizingMode: 'fixed-width',
                    autoSizeConfig: {
                      ...(textElement.autoSizeConfig || {}),
                      enabled: false,
                      minFontSize: textElement.autoSizeConfig?.minFontSize ?? textElement.minFontSize ?? 1,
                      maxFontSize: textElement.autoSizeConfig?.maxFontSize ?? textElement.maxFontSize ?? 720,
                      minWidthScale: textElement.autoSizeConfig?.minWidthScale ?? textElement.minWidthScale ?? 100,
                      maxWidthScale: textElement.autoSizeConfig?.maxWidthScale ?? textElement.maxWidthScale ?? 100,
                    },
                  })}
                  scale={scale}
                  recordData={recordData}
                  onStartDrag={handleStartDrag}
                  onStartResize={handleStartResize}
                  onStartRotate={handleStartRotate}
                  onContextMenu={(e, element) => {
                    if (!selectedElementIds.includes(element.id)) {
                      onSelectElements([element.id]);
                    }
                    setContextMenu({ x: e.clientX, y: e.clientY, element });
                  }}
                  onBindField={onBindElementToField}
                  labelDimensions={{ width: template.dimensions.width, height: template.dimensions.height }}
                />
              ))}

              {/* Dynamic Interactive Guidelines */}
              {viewport.showGuides &&
                guides.map((g) => {
                  const guidePoint = documentToViewport(
                    { x: g.position, y: g.position },
                    { zoom: viewport.zoom, panX: 0, panY: 0 },
                  );
                  return g.type === 'vertical' ? (
                    <div
                      key={g.id}
                      className="absolute top-0 bottom-0 w-px bg-cyan-500 z-40 pointer-events-none"
                      style={{ left: `${guidePoint.x}px` }}
                    />
                  ) : (
                    <div
                      key={g.id}
                      className="absolute left-0 right-0 h-px bg-cyan-500 z-40 pointer-events-none"
                      style={{ top: `${guidePoint.y}px` }}
                    />
                  );
                })}
            </div>
          </div>

          {zoomRect && (
            <div
              aria-label="Zoom rectangle selection"
              data-testid="zoom-rectangle-overlay"
              className="absolute pointer-events-none z-50 border border-blue-700 bg-blue-500/20"
              style={{
                left: `${Math.min(zoomRect.start.x, zoomRect.current.x)}px`,
                top: `${Math.min(zoomRect.start.y, zoomRect.current.y)}px`,
                width: `${Math.abs(zoomRect.current.x - zoomRect.start.x)}px`,
                height: `${Math.abs(zoomRect.current.y - zoomRect.start.y)}px`,
              }}
            />
          )}

          {/* Rubberband Selection Box */}
          {isBoxSelecting && selectionBox && (
            <div
              className="fixed bg-green-500/20 border border-green-600 pointer-events-none z-50 rounded-xs"
              style={{
                left: `${Math.min(selectionBox.startX, selectionBox.currentX)}px`,
                top: `${Math.min(selectionBox.startY, selectionBox.currentY)}px`,
                width: `${Math.abs(selectionBox.currentX - selectionBox.startX)}px`,
                height: `${Math.abs(selectionBox.currentY - selectionBox.startY)}px`,
              }}
            />
          )}
        </div>

        {/* 3. Right Vertical Toolbar (Alignment & Transformation Dock) */}
        <RightVerticalToolbar
          onAlign={handleAlign}
          onDistribute={handleDistribute}
          onRotate={handleRotateDock}
          onCenterPage={handleCenterPage}
          onBringToFront={onBringToFront}
          onSendToBack={onSendToBack}
          onLockToggle={onLockToggle}
          hasSelection={selectedElementIds.length > 0}
          isLocked={selectedElement?.locked}
        />
      </div>

      {/* 4. Bottom Document / Form Tabs Bar */}
      {documents && documents.length > 0 && (
        <DocumentTabBar
          documents={documents}
          activeInstanceId={activeInstanceId || null}
          onSelectTab={onSelectTab || (() => {})}
          onCloseTab={onCloseTab || (() => {})}
          onNewTemplate={onNewTemplate || (() => {})}
          onNewForm={onNewForm || (() => {})}
          onSaveDoc={onSaveDoc}
          onSaveAll={onSaveAll}
          onDuplicateDoc={onDuplicateDoc}
          onCloseOthers={onCloseOthers}
          onCloseAll={onCloseAll}
        />
      )}

      {/* 5. Bottom Status Bar (Matching BarTender Status Bar) */}
      <div className="h-5 bg-[#e4ebf5] border-t border-[#cbd5e1] flex items-center justify-between px-2 text-[10.5px] sm:text-[11px] text-slate-700 select-none shrink-0 whitespace-nowrap relative z-50 overflow-visible">
        {/* Left Informational Segments */}
        <div className="flex items-center min-w-0 overflow-hidden">
          {/* Segment 1: Printer */}
          <div className="flex items-center gap-1.5 border-r border-[#cbd5e1] pr-3 shrink-0">
            <Printer className="w-3 h-3 text-slate-600 shrink-0" />
            <span className="truncate max-w-[120px] sm:max-w-[200px] md:max-w-none">
              Printer: {activePrinterName || 'Microsoft Print to PDF'}
            </span>
          </div>

          {/* Segment 2: Object identification */}
          <div className="flex items-center gap-1.5 border-r border-[#cbd5e1] pr-3 hidden sm:flex shrink-0">
            <span className="truncate max-w-[160px] md:max-w-[240px]">
              {objectLabel}
            </span>
          </div>

          {/* Segment 3: Coordinates */}
          <div className="flex items-center gap-2 border-r border-[#cbd5e1] pr-3 font-mono text-[10px] sm:text-[10.5px] shrink-0">
            <span>X: {coordX}{unitLabel}</span>
            <span>Y: {coordY}{unitLabel}</span>
            <span>Angle: {angleStr}</span>
          </div>

          {/* Segment 4: Dimensions */}
          <div className="flex items-center gap-2 border-r border-[#cbd5e1] pr-3 font-mono text-[10px] sm:text-[10.5px] hidden lg:flex shrink-0">
            <span>Width: {widthStr}{unitLabel}</span>
            <span>Height: {heightStr}{unitLabel}</span>
            <span>X Dim: {xDimDisplay}</span>
          </div>
        </div>

        {/* Segment 5: BarTender-Style Zoom Menu Control */}
        <div className="relative ml-auto shrink-0 pl-2 overflow-visible" ref={zoomMenuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsZoomMenuOpen(prev => !prev);
            }}
            className={`px-2 py-0.5 rounded-[2px] flex items-center gap-1.5 font-medium text-[11px] cursor-pointer border transition-colors select-none ${
              isZoomMenuOpen
                ? 'bg-[#ffe8a6] border-[#d2b470] text-slate-900 shadow-inner'
                : 'hover:bg-[#d0deec] border-transparent hover:border-slate-300 text-slate-800'
            }`}
            title="Zoom&#10;Click to set zoom level."
          >
            <ZoomIn className="w-3.5 h-3.5 text-slate-700 shrink-0" />
            <span className="font-mono text-[11px] font-semibold text-slate-800">
              {Math.round(viewport.zoom * 100)}%
            </span>
            <ChevronDown className="w-3 h-3 text-slate-600 shrink-0 -ml-0.5" />
          </button>

          {/* BarTender Zoom Popup Menu */}
          {isZoomMenuOpen && (
            <div
              className="absolute bottom-full right-0 mb-1 z-[9999] bg-white border border-[#999999] shadow-2xl rounded-[2px] py-1 min-w-[220px] text-slate-800 text-[11.5px] select-none"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  handleZoomIn();
                  setIsZoomMenuOpen(false);
                }}
                className="w-full flex items-center px-3 py-1 hover:bg-[#0078d7] hover:text-white text-left cursor-pointer transition-colors"
              >
                <ZoomIn className="w-3.5 h-3.5 mr-2.5 shrink-0" />
                <span>Zoom In</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleZoomOut();
                  setIsZoomMenuOpen(false);
                }}
                className="w-full flex items-center px-3 py-1 hover:bg-[#0078d7] hover:text-white text-left cursor-pointer transition-colors"
              >
                <ZoomOut className="w-3.5 h-3.5 mr-2.5 shrink-0" />
                <span>Zoom Out</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  zoomToSelection();
                  setIsZoomMenuOpen(false);
                }}
                className="w-full flex items-center px-3 py-1 hover:bg-[#0078d7] hover:text-white text-left cursor-pointer transition-colors"
              >
                <Scan className="w-3.5 h-3.5 mr-2.5 shrink-0" />
                <span>Zoom to Selection</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onZoomRectangleTool?.();
                  setIsZoomMenuOpen(false);
                }}
                className="w-full flex items-center px-3 py-1 hover:bg-[#0078d7] hover:text-white text-left cursor-pointer transition-colors"
              >
                <Scan className="w-3.5 h-3.5 mr-2.5 shrink-0" />
                <span>Zoom to Rectangle</span>
              </button>

              <div className="border-t border-slate-200 my-1 mx-1" />

              {/* Preset Zoom Levels */}
              {[3200, 1600, 800, 400, 200, 100, 50, 25].map(pct => {
                const isCurrent = Math.round(viewport.zoom * 100) === pct;
                return (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                        exitFitMode();
                        centerInView(pct / 100);
                        setIsZoomMenuOpen(false);
                    }}
                    className={`w-full flex items-center px-3 py-1 hover:bg-[#0078d7] hover:text-white text-left cursor-pointer transition-colors ${
                      isCurrent ? 'font-bold' : ''
                    }`}
                  >
                    <span className="w-3.5 h-3.5 mr-2.5 flex items-center justify-center shrink-0">
                      {isCurrent && <Check className="w-3 h-3" />}
                    </span>
                    <span>{pct}%</span>
                  </button>
                );
              })}

              <div className="border-t border-slate-200 my-1 mx-1" />

              <button
                type="button"
                onClick={() => {
                  fitToWindow();
                  setIsZoomMenuOpen(false);
                }}
                className="w-full flex items-center px-3 py-1 hover:bg-[#0078d7] hover:text-white text-left cursor-pointer transition-colors"
              >
                <Maximize2 className="w-3.5 h-3.5 mr-2.5 shrink-0" />
                <span>Fit Template in Window</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  fitTemplateWidthInWindow();
                  setIsZoomMenuOpen(false);
                }}
                className="w-full flex items-center px-3 py-1 hover:bg-[#0078d7] hover:text-white text-left cursor-pointer transition-colors"
              >
                <MoveHorizontal className="w-3.5 h-3.5 mr-2.5 shrink-0" />
                <span>Fit Template Width in Window</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  fitAllObjectsInWindow();
                  setIsZoomMenuOpen(false);
                }}
                className="w-full flex items-center px-3 py-1 hover:bg-[#0078d7] hover:text-white text-left cursor-pointer transition-colors"
              >
                <Frame className="w-3.5 h-3.5 mr-2.5 shrink-0" />
                <span>Fit All Objects in Window</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Click Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          element={contextMenu.element}
          onClose={() => setContextMenu(null)}
          onCut={onCut}
          onCopy={onCopy}
          onPaste={onPaste}
          onDuplicate={onDuplicateSelected}
          onDelete={onDeleteSelected}
          onLockToggle={onLockToggle}
          onBringToFront={onBringToFront}
          onSendToBack={onSendToBack}
          onBringForward={onBringForward}
          onSendBackward={onSendBackward}
          onGroup={onGroup}
          onUngroup={onUngroup}
          onEditText={() => {
            if (contextMenu.element && contextMenu.element.type === 'text') {
              handleStartTextEdit(contextMenu.element);
            }
          }}
          onOpenProperties={() => {
            if (contextMenu.element) {
              if (!selectedElementIds.includes(contextMenu.element.id)) {
                onSelectElements([contextMenu.element.id]);
              }
              if (contextMenu.element.type === 'barcode' && onOpenBarcodeProperties) {
                onOpenBarcodeProperties();
                return;
              }
            }
            if (onOpenProperties) {
              onOpenProperties();
            }
          }}
          onConvertToGS1={onOpenBarcodePicker}
          onOpenPageSetup={onOpenPageSetup || onOpenProperties}
        />
      )}
    </div>
  );
};
