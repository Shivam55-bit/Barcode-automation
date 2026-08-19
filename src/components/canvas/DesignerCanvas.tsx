import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LabelTemplate, LabelElement, CanvasGuide, ViewportState } from '../../types';
import { HorizontalRuler, VerticalRuler } from './Rulers';
import { CanvasElement } from './CanvasElement';
import { ContextMenu } from './ContextMenu';
import { RightVerticalToolbar } from './RightVerticalToolbar';
import { Printer, Plus, ZoomIn, ZoomOut, Target, Maximize2 } from 'lucide-react';

interface DesignerCanvasProps {
  template: LabelTemplate;
  selectedElementIds: string[];
  onSelectElements: (ids: string[]) => void;
  onUpdateElement: (id: string, updates: Partial<LabelElement>) => void;
  onUpdateMultipleElements: (updates: { id: string; updates: Partial<LabelElement> }[]) => void;
  onDeleteSelected: () => void;
  onDuplicateSelected: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onLockToggle: () => void;
  onOpenBarcodePicker: () => void;
  onOpenBarcodeProperties?: () => void;
  onOpenPageSetup?: () => void;
  onInsertElementAt?: (el: Partial<LabelElement>, xMm: number, yMm: number) => void;
  onInsertPresetAt?: (presetKey: string, xMm: number, yMm: number) => void;
  viewport: ViewportState;
  setViewport: React.Dispatch<React.SetStateAction<ViewportState>>;
  recordData: Record<string, string>;
  onCursorMove?: (xMm: number, yMm: number) => void;
}

export const DesignerCanvas: React.FC<DesignerCanvasProps> = ({
  template,
  selectedElementIds,
  onSelectElements,
  onUpdateElement,
  onUpdateMultipleElements,
  onDeleteSelected,
  onDuplicateSelected,
  onCut,
  onCopy,
  onPaste,
  onUndo,
  onRedo,
  onBringToFront,
  onSendToBack,
  onLockToggle,
  onOpenProperties,
  onOpenBarcodePicker,
  onOpenBarcodeProperties,
  onOpenPageSetup,
  onInsertElementAt,
  onInsertPresetAt,
  viewport,
  setViewport,
  recordData,
  onCursorMove,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cursorMm, setCursorMm] = useState({ x: 10.9, y: 22.1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Active Bottom Tab (Template 1, Template 2, Form 1, Form 2, Form 3)
  const [activeBottomTab, setActiveBottomTab] = useState<'Template 1' | 'Template 2' | 'Form 1' | 'Form 2' | 'Form 3'>('Template 2');

  // Dragging elements state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [dragInitialElements, setDragInitialElements] = useState<{ id: string; x: number; y: number }[]>([]);

  // Resizing state
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeInitialState, setResizeInitialState] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [resizingElementId, setResizingElementId] = useState<string | null>(null);

  // Rotation state
  const [isRotating, setIsRotating] = useState(false);
  const [rotatingElementId, setRotatingElementId] = useState<string | null>(null);
  const [rotateCenter, setRotateCenter] = useState<{ x: number; y: number } | null>(null);

  // Selection box state
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);

  // Interactive guides state
  const [guides, setGuides] = useState<CanvasGuide[]>([
    { id: 'g1', type: 'vertical', position: 10 },
    { id: 'g2', type: 'horizontal', position: 10 },
  ]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; element: LabelElement | null } | null>(null);

  // 1mm in screen pixels at 100% zoom = 3.7795px
  const baseScale = 3.7795;
  const scale = baseScale * viewport.zoom;

  // Selected Element
  const selectedElement = template.elements.find(el => selectedElementIds.includes(el.id)) || null;

  // Center label in the workspace viewport
  const centerInView = useCallback((customZoom?: number) => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    if (containerWidth <= 0 || containerHeight <= 0) return;

    const currentZoom = customZoom ?? viewport.zoom;
    const currentScale = baseScale * currentZoom;
    const labelWidth = template.dimensions.width * currentScale;
    const labelHeight = template.dimensions.height * currentScale;

    const targetPanX = Math.max(20, Math.round((containerWidth - labelWidth) / 2));
    const targetPanY = Math.max(20, Math.round((containerHeight - labelHeight) / 2));

    setViewport(prev => ({
      ...prev,
      zoom: currentZoom,
      panX: targetPanX,
      panY: targetPanY,
    }));
  }, [template.dimensions.width, template.dimensions.height, viewport.zoom, setViewport]);

  // Fit label to workspace with padding
  const fitToWindow = useCallback(() => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    if (containerWidth <= 0 || containerHeight <= 0) return;

    const availW = Math.max(100, containerWidth - 80);
    const availH = Math.max(100, containerHeight - 80);

    const baseW = template.dimensions.width * baseScale;
    const baseH = template.dimensions.height * baseScale;

    const zoomW = availW / baseW;
    const zoomH = availH / baseH;
    const targetZoom = Math.max(0.2, Math.min(3.0, Number(Math.min(zoomW, zoomH).toFixed(2))));

    centerInView(targetZoom);
  }, [template.dimensions.width, template.dimensions.height, centerInView]);

  // Auto-fit & center canvas on initial load and template change
  useEffect(() => {
    const timer = setTimeout(() => {
      fitToWindow();
    }, 80);
    return () => clearTimeout(timer);
  }, [template.id, template.dimensions.width, template.dimensions.height, fitToWindow]);

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

  // Handle Mouse Move over workspace
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Convert to mm on canvas
    const xMm = (mouseX - viewport.panX) / scale;
    const yMm = (mouseY - viewport.panY) / scale;
    const roundedX = Math.round(xMm * 10) / 10;
    const roundedY = Math.round(yMm * 10) / 10;
    setCursorMm({ x: roundedX, y: roundedY });
    onCursorMove?.(roundedX, roundedY);

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

    // 2. Dragging Elements with smooth delta & boundary clamping
    if (isDragging && dragInitialElements.length > 0) {
      const deltaX = (e.clientX - dragStartPos.x) / scale;
      const deltaY = (e.clientY - dragStartPos.y) / scale;

      const updates = dragInitialElements.map(item => {
        const targetEl = template.elements.find(el => el.id === item.id);
        const elW = targetEl ? targetEl.width : 20;
        const elH = targetEl ? targetEl.height : 10;

        const maxAllowedX = Math.max(0, template.dimensions.width - elW);
        const maxAllowedY = Math.max(0, template.dimensions.height - elH);

        const targetX = Math.min(maxAllowedX, Math.max(0, item.x + deltaX));
        const targetY = Math.min(maxAllowedY, Math.max(0, item.y + deltaY));

        return {
          id: item.id,
          updates: {
            x: snapValue(targetX),
            y: snapValue(targetY),
          },
        };
      });
      onUpdateMultipleElements(updates);
      return;
    }

    // 3. Resizing Element
    if (isResizing && resizingElementId && resizeInitialState && resizeHandle) {
      const deltaX = (e.clientX - dragStartPos.x) / scale;
      const deltaY = (e.clientY - dragStartPos.y) / scale;
      let { x, y, w, h } = resizeInitialState;

      if (resizeHandle.includes('e')) w = Math.max(4, snapValue(w + deltaX));
      if (resizeHandle.includes('s')) h = Math.max(3, snapValue(h + deltaY));
      if (resizeHandle.includes('w')) {
        const newW = Math.max(4, snapValue(w - deltaX));
        x = snapValue(Math.max(0, x + (w - newW)));
        w = newW;
      }
      if (resizeHandle.includes('n')) {
        const newH = Math.max(3, snapValue(h - deltaY));
        y = snapValue(Math.max(0, y + (h - newH)));
        h = newH;
      }

      onUpdateElement(resizingElementId, { x, y, width: w, height: h });
      return;
    }

    // 4. Rotating Element
    if (isRotating && rotatingElementId && rotateCenter) {
      const angleRad = Math.atan2(e.clientY - rotateCenter.y, e.clientX - rotateCenter.x);
      let angleDeg = Math.round((angleRad * 180) / Math.PI + 90);
      if (angleDeg < 0) angleDeg += 360;
      if (e.shiftKey) {
        angleDeg = Math.round(angleDeg / 15) * 15;
      }
      onUpdateElement(rotatingElementId, { rotation: angleDeg % 360 });
      return;
    }

    // 5. Box Selecting
    if (isBoxSelecting && selectionBox) {
      setSelectionBox(prev => prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null);
    }
  };

  // Mouse Up End Actions
  const handleMouseUp = () => {
    setIsPanning(false);
    setIsDragging(false);
    setIsResizing(false);
    setIsRotating(false);

    if (isBoxSelecting && selectionBox && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const minX = (Math.min(selectionBox.startX, selectionBox.currentX) - rect.left - viewport.panX) / scale;
      const maxX = (Math.max(selectionBox.startX, selectionBox.currentX) - rect.left - viewport.panX) / scale;
      const minY = (Math.min(selectionBox.startY, selectionBox.currentY) - rect.top - viewport.panY) / scale;
      const maxY = (Math.max(selectionBox.startY, selectionBox.currentY) - rect.top - viewport.panY) / scale;

      const hitElements = template.elements.filter(
        el => el.x < maxX && el.x + el.width > minX && el.y < maxY && el.y + el.height > minY
      );
      onSelectElements(hitElements.map(el => el.id));
    }
    setIsBoxSelecting(false);
    setSelectionBox(null);
  };

  // Start Canvas Background Mouse Down (Pan or Box Select or Deselect)
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || isSpacePressed) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (e.button === 0) {
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
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      setViewport(prev => ({
        ...prev,
        zoom: Math.max(0.1, Math.min(8, Number((prev.zoom + delta).toFixed(2)))),
      }));
    } else {
      setViewport(prev => ({
        ...prev,
        panX: prev.panX - e.deltaX * 0.5,
        panY: prev.panY - e.deltaY * 0.5,
      }));
    }
  };

  // Element Selection
  const handleElementSelect = (e: React.MouseEvent, element: LabelElement) => {
    e.stopPropagation();
    if (e.shiftKey) {
      if (selectedElementIds.includes(element.id)) {
        onSelectElements(selectedElementIds.filter(id => id !== element.id));
      } else {
        onSelectElements([...selectedElementIds, element.id]);
      }
    } else {
      if (!selectedElementIds.includes(element.id)) {
        onSelectElements([element.id]);
      }
    }
  };

  // Start Dragging Selected Element(s)
  const handleStartDrag = (e: React.MouseEvent, element: LabelElement) => {
    e.stopPropagation();
    setIsDragging(true);
    setDragStartPos({ x: e.clientX, y: e.clientY });

    const activeIds = selectedElementIds.includes(element.id) ? selectedElementIds : [element.id];
    const initials = template.elements
      .filter(el => activeIds.includes(el.id) && !el.locked)
      .map(el => ({ id: el.id, x: el.x, y: el.y }));

    setDragInitialElements(initials);
  };

  // Start Resizing Handle
  const handleStartResize = (e: React.MouseEvent, handle: string, element: LabelElement) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeHandle(handle);
    setResizingElementId(element.id);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setResizeInitialState({ x: element.x, y: element.y, w: element.width, h: element.height });
  };

  // Start Rotation
  const handleStartRotate = (e: React.MouseEvent, element: LabelElement) => {
    e.stopPropagation();
    setIsRotating(true);
    setRotatingElementId(element.id);

    const elDom = document.getElementById(`canvas-el-${element.id}`);
    if (elDom) {
      const rect = elDom.getBoundingClientRect();
      setRotateCenter({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
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

  const labelWidthPx = template.dimensions.width * scale;
  const labelHeightPx = template.dimensions.height * scale;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#9fbddb] relative overflow-hidden select-none">
      {/* 1. Top Horizontal Ruler */}
      {viewport.showRulers && (
        <div className="flex h-5 bg-[#e4ebf5]">
          <div className="w-5 h-5 bg-[#d8e2ee] border-r border-b border-[#cbd5e1] shrink-0 flex items-center justify-center text-[8px] font-sans font-bold text-slate-700">
            {viewport.unit}
          </div>
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
              onAddGuide={(type, pos) => setGuides(g => [...g, { id: `g-${Date.now()}`, type, position: pos }])}
            />
          </div>
        )}

        {/* Interactive Infinite Canvas Container (Steel Blue Background) */}
        <div
          ref={containerRef}
          className={`flex-1 h-full bg-[#9fbddb] relative overflow-hidden ${
            isSpacePressed || isPanning ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
          }`}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
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

              if (payload.type === 'element' && payload.data && onInsertElementAt) {
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
            {/* The Die-Cut Rounded White Label Sheet */}
            <div
              id="label-canvas-page"
              className="bg-white relative shadow-xl transition-all duration-75 border border-slate-300 rounded-xl"
              style={{
                width: `${labelWidthPx}px`,
                height: `${labelHeightPx}px`,
              }}
            >
              {/* Optional Grid Overlay */}
              {viewport.showGrid && (
                <div
                  className="absolute inset-0 pointer-events-none opacity-30 rounded-xl overflow-hidden"
                  style={{
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
                    className="absolute pointer-events-none border border-dashed border-emerald-400 rounded-lg"
                    style={{
                      top: `${template.margins.top * scale}px`,
                      left: `${template.margins.left * scale}px`,
                      right: `${template.margins.right * scale}px`,
                      bottom: `${template.margins.bottom * scale}px`,
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
                  onSelect={handleElementSelect}
                  onDoubleClick={() => {
                    if (el.type === 'barcode' && onOpenBarcodeProperties) {
                      onOpenBarcodeProperties();
                    } else {
                      onOpenProperties();
                    }
                  }}
                  scale={scale}
                  recordData={recordData}
                  onStartDrag={handleStartDrag}
                  onStartResize={handleStartResize}
                  onStartRotate={handleStartRotate}
                  onContextMenu={(e, element) => {
                    setContextMenu({ x: e.clientX, y: e.clientY, element });
                  }}
                />
              ))}

              {/* Dynamic Interactive Guidelines */}
              {viewport.showGuides &&
                guides.map((g) => {
                  const posPx = g.position * scale;
                  return g.type === 'vertical' ? (
                    <div
                      key={g.id}
                      className="absolute top-0 bottom-0 w-px bg-cyan-500 z-40 pointer-events-none"
                      style={{ left: `${posPx}px` }}
                    />
                  ) : (
                    <div
                      key={g.id}
                      className="absolute left-0 right-0 h-px bg-cyan-500 z-40 pointer-events-none"
                      style={{ top: `${posPx}px` }}
                    />
                  );
                })}
            </div>
          </div>

          {/* Floating Canvas Quick Viewport Controls */}
          <div className="absolute bottom-3 left-3 z-30 bg-white/90 backdrop-blur-xs border border-slate-300 shadow-md rounded-md p-1 flex items-center gap-1 text-slate-700 text-xs">
            <button
              onClick={() => centerInView()}
              className="px-2 py-1 hover:bg-[#e2e8f0] rounded flex items-center gap-1 font-medium text-[11px] text-slate-800 transition-colors cursor-pointer"
              title="Center Label in View (Ctrl+0)"
            >
              <Target className="w-3.5 h-3.5 text-blue-600" />
              <span>Center</span>
            </button>
            <div className="w-px h-4 bg-slate-300" />
            <button
              onClick={fitToWindow}
              className="px-2 py-1 hover:bg-[#e2e8f0] rounded flex items-center gap-1 font-medium text-[11px] text-slate-800 transition-colors cursor-pointer"
              title="Fit Label to Window"
            >
              <Maximize2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Fit to Screen</span>
            </button>
            <div className="w-px h-4 bg-slate-300" />
            <button
              onClick={() => centerInView(1.0)}
              className="px-1.5 py-1 hover:bg-[#e2e8f0] rounded font-mono text-[10.5px] font-semibold text-slate-700 cursor-pointer"
              title="Actual Size (100%)"
            >
              100%
            </button>
          </div>

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

      {/* 4. Bottom Document / Form Tabs Bar (Template 1, Template 2, Form 1, Form 2, Form 3) */}
      <div className="flex items-center h-6 bg-[#d8e2ee] px-1 border-t border-[#b8c5d6] text-xs">
        <div className="flex items-center gap-0.5">
          {(['Template 1', 'Template 2', 'Form 1', 'Form 2', 'Form 3'] as const).map((tab) => {
            const isActive = activeBottomTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveBottomTab(tab)}
                className={`px-3 py-0.5 text-[11px] font-medium rounded-t-xs border-t-2 transition-colors ${
                  isActive
                    ? 'bg-[#fff8db] border-t-amber-500 border-x border-[#b8c5d6] text-slate-900 shadow-xs'
                    : 'bg-[#e4ebf5] border-t-transparent hover:bg-[#d0deec] text-slate-700'
                }`}
              >
                {tab}
              </button>
            );
          })}
          <button
            title="Add Template / Data Form"
            className="p-1 hover:bg-[#c6d4e4] rounded text-slate-600 hover:text-slate-900"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 5. Bottom Status Bar (Matching BarTender Status Bar) */}
      <div className="h-5 bg-[#e4ebf5] border-t border-[#cbd5e1] flex items-center justify-between px-2 text-[11px] text-slate-700 select-none">
        {/* Segment 1: Printer */}
        <div className="flex items-center gap-1.5 border-r border-[#cbd5e1] pr-3">
          <Printer className="w-3 h-3 text-slate-600" />
          <span>Printer: Microsoft Print to PDF</span>
        </div>

        {/* Segment 2: Object identification */}
        <div className="flex items-center gap-1.5 border-r border-[#cbd5e1] pr-3 hidden sm:flex">
          <span>
            {selectedElement ? `Object: ${selectedElement.name}` : 'Object: None (Label Page)'}
          </span>
        </div>

        {/* Segment 3: Coordinates */}
        <div className="flex items-center gap-2 border-r border-[#cbd5e1] pr-3 font-mono text-[10.5px]">
          <span>X: {selectedElement ? selectedElement.x.toFixed(1) : cursorMm.x.toFixed(1)}mm</span>
          <span>Y: {selectedElement ? selectedElement.y.toFixed(1) : cursorMm.y.toFixed(1)}mm</span>
          <span>Angle: {selectedElement ? `${(selectedElement.rotation || 0).toFixed(1)}°` : '0.0°'}</span>
        </div>

        {/* Segment 4: Dimensions */}
        <div className="flex items-center gap-2 border-r border-[#cbd5e1] pr-3 font-mono text-[10.5px] hidden md:flex">
          <span>Width: {selectedElement ? selectedElement.width.toFixed(1) : template.dimensions.width.toFixed(1)}mm</span>
          <span>Height: {selectedElement ? selectedElement.height.toFixed(1) : template.dimensions.height.toFixed(1)}mm</span>
          <span>X Dimension: 0.78mm</span>
        </div>

        {/* Segment 5: Zoom & Centering Controls */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => centerInView()}
            className="px-1.5 py-0.5 hover:bg-[#d0deec] text-slate-800 rounded font-medium text-[10px] flex items-center gap-0.5 border border-slate-300/80 bg-white/60 cursor-pointer"
            title="Center Label in View (Ctrl+0)"
          >
            <Target className="w-3 h-3 text-blue-600" />
            <span>Center</span>
          </button>
          <button
            onClick={fitToWindow}
            className="px-1.5 py-0.5 hover:bg-[#d0deec] text-slate-800 rounded font-medium text-[10px] flex items-center gap-0.5 border border-slate-300/80 bg-white/60 cursor-pointer"
            title="Fit to Window"
          >
            <Maximize2 className="w-3 h-3 text-emerald-600" />
            <span>Fit</span>
          </button>
          <div className="w-px h-3 bg-[#cbd5e1] mx-0.5" />
          <button
            onClick={() => setViewport(v => ({ ...v, zoom: Math.max(0.2, Number((v.zoom - 0.2).toFixed(2))) }))}
            className="w-4 h-4 hover:bg-[#d0deec] rounded flex items-center justify-center font-bold text-xs cursor-pointer"
            title="Zoom Out"
          >
            -
          </button>
          <button
            onClick={() => centerInView(1.0)}
            className="font-mono text-[10.5px] w-12 text-center font-medium hover:bg-[#d0deec] rounded py-0.5 cursor-pointer"
            title="Click for 100% Actual Size"
          >
            {Math.round(viewport.zoom * 100)}%
          </button>
          <button
            onClick={() => setViewport(v => ({ ...v, zoom: Math.min(8, Number((v.zoom + 0.2).toFixed(2))) }))}
            className="w-4 h-4 hover:bg-[#d0deec] rounded flex items-center justify-center font-bold text-xs cursor-pointer"
            title="Zoom In"
          >
            +
          </button>
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
          onOpenProperties={() => {
            if (contextMenu.element?.type === 'barcode' && onOpenBarcodeProperties) {
              onOpenBarcodeProperties();
            } else {
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
