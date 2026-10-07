import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  FileText,
  FolderOpen,
  Save,
  Layers,
  Database,
  Printer,
  Search,
  Scissors,
  Copy,
  Clipboard,
  Trash2,
  Undo2,
  Redo2,
  MousePointer,
  Paintbrush,
  Type,
  Barcode,
  Image as ImageIcon,
  Square,
  Circle,
  Slash,
  Radio,
  ZoomIn,
  ZoomOut,
  Scan,
  Maximize2,
  Grid,
  Ruler,
  Magnet,
  ChevronDown,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Subscript,
  Superscript,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Minus,
  RotateCcw,
  RotateCw,
  Sliders,
  X,
  Plus,
  Baseline,
  Highlighter,
  WrapText,
  ShieldCheck,
  PaintBucket,
  PenTool,
  Table as TableIcon,
  Lock,
  Unlock,
} from 'lucide-react';
import { BarcodeSymbology, LabelElement, TextElement, TextObjectType, BarcodeElement, ShapeElement } from '../../types';
import { convertTextElementFormat, measureTextObject } from '../../services/textMeasurementEngine';
import { calculateBarcodeLayout, getBarcodeSymbolHeight } from '../../services/barcodeEngine';
import { FontSizeComboBox } from './FontSizeComboBox';

interface ObjectToolbarProps {
  activeTool: 'select' | 'data-edit' | 'text' | 'barcode' | 'qr' | 'datamatrix' | 'rect' | 'circle' | 'line' | 'table' | 'image' | 'zoom-rect';
  setActiveTool: (tool: any) => void;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs?: () => void;
  onPageSetup?: () => void;
  onDatabaseSetup?: () => void;
  onPrint: () => void;
  onPrintPreview?: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete?: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onFormatPainter?: () => void;
  onInsertText: () => void;
  onInsertTextType?: (textType: TextObjectType) => void;
  onInsertBarcode: (symbology?: BarcodeSymbology) => void;
  onInsertQR: () => void;
  onInsertDataMatrix: () => void;
  onInsertShape: (type: 'rectangle' | 'circle' | 'line') => void;
  onInsertTable: () => void;
  onInsertImage: () => void;
  onInsertGS1Block: () => void;
  onOpenBarcodePicker: () => void;
  // Zoom & View Toggles
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoom100: () => void;
  onZoomFit: () => void;
  onZoomToRectangle: () => void;
  canZoomViewport?: boolean;
  showGrid: boolean;
  onToggleGrid: () => void;
  showRulers: boolean;
  onToggleRulers: () => void;
  showGuides: boolean;
  onToggleGuides: () => void;
  snapToGrid: boolean;
  onToggleSnap: () => void;
  onOpenBarcodeProperties?: () => void;
  onOpenTextProperties?: () => void;
  onOpenShapeProperties?: () => void;
  onOpenProperties?: () => void;
  // Formatting Props for active selected element(s)
  selectedElement?: LabelElement | null;
  selectedElements?: LabelElement[];
  onUpdateSelectedElement?: (updates: Partial<LabelElement>) => void;
  onUpdateSelectedElements?: (updates: Array<{ id: string; updates: Partial<LabelElement> }>) => void;
  templateDimensions?: { width: number; height: number };
  onUpdateTemplateDimensions?: (dims: { width?: number; height?: number }) => void;
  // Document Tab
  documentName?: string;
}

export type ToolbarMenu = 'barcode' | 'text' | 'line' | null;

export const ObjectToolbar: React.FC<ObjectToolbarProps> = (props) => {
  const [openMenu, setOpenMenu] = useState<ToolbarMenu>(null);
  const [lastTextType, setLastTextType] = useState<TextObjectType>('single-line');
  const [lastShapeType, setLastShapeType] = useState<'line' | 'rectangle' | 'circle'>('line');
  const [fontSizeInput, setFontSizeInput] = useState<string | null>(null);

  const barcodeTriggerRef = useRef<HTMLDivElement>(null);
  const textTriggerRef = useRef<HTMLDivElement>(null);
  const shapeTriggerRef = useRef<HTMLDivElement>(null);

  const toggleMenu = useCallback((menu: 'barcode' | 'text' | 'line') => {
    setOpenMenu((prev) => (prev === menu ? null : menu));
  }, []);

  useEffect(() => {
    if (!openMenu) return;

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        (barcodeTriggerRef.current && barcodeTriggerRef.current.contains(target)) ||
        (textTriggerRef.current && textTriggerRef.current.contains(target)) ||
        (shapeTriggerRef.current && shapeTriggerRef.current.contains(target))
      ) {
        return;
      }
      setOpenMenu(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenu(null);
        event.stopPropagation();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenu]);

  const selectedEls = props.selectedElements && props.selectedElements.length > 0
    ? props.selectedElements
    : props.selectedElement
    ? [props.selectedElement]
    : [];
  const primaryEl = selectedEls[0] || props.selectedElement || null;
  const hasSelection = selectedEls.length > 0;
  const selectedTextElements = selectedEls.filter((element): element is TextElement => element.type === 'text');

  const selectedTextEl = primaryEl?.type === 'text' ? (primaryEl as TextElement) : null;
  const selectedBarcodeEl = primaryEl?.type === 'barcode' ? (primaryEl as BarcodeElement) : null;
  const selectedShapeEl = primaryEl?.type === 'shape' ? (primaryEl as ShapeElement) : null;
  const selectedImageEl = primaryEl?.type === 'image' ? (primaryEl as any) : null;
  const selectedTableEl = primaryEl?.type === 'table' ? (primaryEl as any) : null;

  const isBarcode = primaryEl?.type === 'barcode';
  const isText = primaryEl?.type === 'text';

  const currentFont = isText
    ? selectedTextEl?.fontFamily || 'Arial'
    : isBarcode
    ? selectedBarcodeEl?.humanReadableFont || (selectedBarcodeEl as any)?.fontFamily || 'Arial'
    : 'Arial';

  const currentFontSize = isText
    ? selectedTextEl?.fontSize || 12
    : isBarcode
    ? selectedBarcodeEl?.humanReadableFontSize || (selectedBarcodeEl as any)?.fontSize || 10
    : 12;

  const fontSizeDisplay = fontSizeInput !== null ? fontSizeInput : String(Math.round(currentFontSize * 10) / 10);

  const isBold = hasSelection && selectedEls.every((el) => {
    if (el.type === 'text') return (el as TextElement).fontWeight === 'bold';
    if (el.type === 'barcode') {
      const bc = el as BarcodeElement;
      return bc.humanReadableFontStyle === 'bold' || bc.humanReadableFontStyle === 'bold-italic' || (bc as any).fontWeight === 'bold';
    }
    return false;
  });

  const isItalic = hasSelection && selectedEls.every((el) => {
    if (el.type === 'text') return (el as TextElement).fontStyle === 'italic';
    if (el.type === 'barcode') {
      const bc = el as BarcodeElement;
      return bc.humanReadableFontStyle === 'italic' || bc.humanReadableFontStyle === 'bold-italic' || (bc as any).fontStyle === 'italic';
    }
    return false;
  });

  const isUnderline = hasSelection && selectedEls.every((el) => {
    if (el.type === 'text') return (el as TextElement).textDecoration === 'underline' || !!(el as TextElement).underline;
    if (el.type === 'barcode') {
      const bc = el as BarcodeElement;
      return !!bc.humanReadableUnderline || (bc as any).textDecoration === 'underline';
    }
    return false;
  });

  const isWhiteOnBlack = hasSelection && selectedEls.every((el) => {
    if (el.type === 'text') return !!(el as TextElement).whiteOnBlack;
    if (el.type === 'barcode') return !!(el as BarcodeElement).humanReadableWhiteOnBlack;
    return false;
  });

  const textAlign = isText
    ? selectedTextEl?.textAlign || 'left'
    : isBarcode
    ? selectedBarcodeEl?.humanReadableAlignment || 'center'
    : 'left';
  const textAlignmentValues = selectedTextElements.map(element => element.textAlign || element.horizontalAlignment || 'left');
  const textAlignmentMixed = textAlignmentValues.some(value => value !== textAlignmentValues[0]);
  const selectedTextAlignment = textAlignmentMixed ? null : textAlignmentValues[0] || null;
  const isRichTextSelection = selectedTextElements.some(element =>
    ['word-processor', 'rtf', 'html', 'xaml', 'symbol-font'].includes(element.textType || ''),
  );
  const editableTextSelection = selectedTextElements.length > 0 &&
    selectedTextElements.every(element => !element.locked && element.editable !== false && element.isEditable !== false);
  const paragraphTextSelection = selectedTextElements.length > 0 &&
    selectedTextElements.every(element =>
      element.textType === 'multi-line' || element.textType === 'paragraph' ||
      element.multiline === true || element.textFormatType === 'paragraph',
    );
  const arcTextSelection = selectedTextElements.length > 0 &&
    selectedTextElements.every(element => element.textType === 'arc' || element.textFormatType === 'arc');
  const singleLineValues = selectedTextElements.map(element =>
    element.textType === 'single-line' || (!element.multiline && element.textFormatType !== 'paragraph' &&
      element.textType !== 'multi-line' && element.textType !== 'paragraph' &&
      element.textType !== 'arc' && element.textFormatType !== 'arc'),
  );
  const singleLineMixed = singleLineValues.some(value => value !== singleLineValues[0]);
  const orphanValues = selectedTextElements.map(element => element.orphanAlignment || 'left');
  const orphanAlignmentMixed = orphanValues.some(value => value !== orphanValues[0]);
  const selectedOrphanAlignment = orphanAlignmentMixed ? 'mixed' : orphanValues[0] || 'left';
  const arcDirections = selectedTextElements.map(element =>
    element.arcConfig?.direction || element.arcDirection || 'clockwise',
  );
  const arcDirectionMixed = arcDirections.some(direction => direction !== arcDirections[0]);
  const selectedArcDirection = arcDirectionMixed ? null : arcDirections[0] || null;

  const activeFontColor = isText
    ? selectedTextEl?.color || '#000000'
    : isBarcode
    ? selectedBarcodeEl?.humanReadableColor || selectedBarcodeEl?.foregroundColor || '#000000'
    : '#000000';

  const activeBgColor = isText
    ? selectedTextEl?.backgroundColor && selectedTextEl.backgroundColor !== 'transparent' ? selectedTextEl.backgroundColor : '#ffffff'
    : isBarcode
    ? selectedBarcodeEl?.backgroundColor && selectedBarcodeEl.backgroundColor !== 'transparent' ? selectedBarcodeEl.backgroundColor : '#ffffff'
    : '#ffffff';

  const isElementEditable = primaryEl ? (primaryEl.isEditable !== false && primaryEl.editable !== false) : true;

  // Dimension & Position Values
  const currentW = primaryEl
    ? Number(primaryEl.width.toFixed(1))
    : props.templateDimensions?.width || 100;
  const currentH = primaryEl
    ? Number(primaryEl.height.toFixed(1))
    : props.templateDimensions?.height || 60;
  const currentX = primaryEl
    ? Number(primaryEl.x.toFixed(1))
    : 0;
  const currentY = primaryEl
    ? Number(primaryEl.y.toFixed(1))
    : 0;

  const handleWidthChange = (newVal: number) => {
    const val = Math.max(0.1, Number(newVal));
    if (props.onUpdateSelectedElement && hasSelection) {
      if (isText) {
        const sizingMode = primaryEl?.type === 'text' && primaryEl.sizingMode !== 'auto-width' ? primaryEl.sizingMode || 'fixed-width' : 'fixed-width';
        props.onUpdateSelectedElement({ width: val, sizingMode, autoSize: false, autoFit: sizingMode === 'shrink-to-fit' || sizingMode === 'fit-to-box' } as any);
      } else {
        props.onUpdateSelectedElement({ width: val });
      }
    } else if (props.onUpdateTemplateDimensions) {
      props.onUpdateTemplateDimensions({ width: val });
    }
  };

  const handleHeightChange = (newVal: number) => {
    const val = Math.max(0.1, Number(newVal));
    if (props.onUpdateSelectedElement && hasSelection) {
      if (isText) {
        const sizingMode = primaryEl?.type === 'text' && primaryEl.sizingMode !== 'auto-width' ? primaryEl.sizingMode || 'fixed-width' : 'fixed-width';
        props.onUpdateSelectedElement({ height: val, sizingMode, autoSize: false, autoFit: sizingMode === 'shrink-to-fit' || sizingMode === 'fit-to-box' } as any);
      } else {
        props.onUpdateSelectedElement({ height: val });
      }
    } else if (props.onUpdateTemplateDimensions) {
      props.onUpdateTemplateDimensions({ height: val });
    }
  };

  const handleXChange = (newVal: number) => {
    const val = Number(newVal);
    if (props.onUpdateSelectedElement && hasSelection) {
      props.onUpdateSelectedElement({ x: val });
    }
  };

  const handleYChange = (newVal: number) => {
    const val = Number(newVal);
    if (props.onUpdateSelectedElement && hasSelection) {
      props.onUpdateSelectedElement({ y: val });
    }
  };

  const fonts = [
    'Arial',
    'Arial Black',
    'Arial Narrow',
    'Bahnschrift',
    'Calibri',
    'Cambria',
    'Century Gothic',
    'Comic Sans MS',
    'Consolas',
    'Courier New',
    'Georgia',
    'Helvetica',
    'Impact',
    'Lucida Console',
    'Microsoft Sans Serif',
    'OCR-A',
    'OCR-B',
    'Segoe UI',
    'Tahoma',
    'Times New Roman',
    'Trebuchet MS',
    'Verdana',
  ];

  const fontSizes = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72];

  const handleFontChange = (newFont: string) => {
    if (props.onUpdateSelectedElement && hasSelection) {
      if (isBarcode) {
        const barcodeEl = selectedBarcodeEl || (primaryEl as BarcodeElement);
        props.onUpdateSelectedElement({
          humanReadableFont: newFont,
          fontFamily: newFont,
          humanReadable: {
            ...(barcodeEl?.humanReadable || {}),
            fontFamily: newFont,
          },
        } as any);
      } else {
        const textEl = selectedTextEl;
        const isMulti = textEl ? (textEl.textType === 'multi-line' || textEl.multiline || textEl.textFormatType === 'paragraph') : false;
        const isSingleAuto = textEl && !isMulti && (textEl.sizingMode === 'auto-width' || (!textEl.sizingMode && textEl.autoSize !== false));

        if (textEl && isSingleAuto) {
          const dims = measureTextObject({
            text: (textEl.text || 'Sample Text').replace(/\r?\n/g, ' '),
            fontFamily: newFont,
            fontSize: textEl.fontSize || 10,
            fontWeight: textEl.fontWeight,
            fontStyle: textEl.fontStyle,
            letterSpacing: textEl.letterSpacing,
            lineHeight: textEl.lineHeight,
            fontWidthScale: 100,
            textType: 'single-line',
            textFormatType: 'single-line',
            multiline: false,
            wrap: false,
            borderConfig: textEl.borderConfig,
            ignoreMinSize: true,
          });
          props.onUpdateSelectedElement({
            fontFamily: newFont,
            width: dims.width,
            height: dims.height,
            sizingMode: 'auto-width',
            autoSize: true,
          } as any);
        } else {
          props.onUpdateSelectedElement({
            fontFamily: newFont,
          } as any);
        }
      }
    }
  };

  const handleSizeChange = (newSize: number) => {
    const validSize = Math.max(1, Math.min(720, Number(newSize)));
    if (props.onUpdateSelectedElement && hasSelection) {
      if (isBarcode) {
        const barcodeEl = selectedBarcodeEl || (primaryEl as BarcodeElement);
        const persistentBarH = getBarcodeSymbolHeight(barcodeEl);
        const layout = calculateBarcodeLayout({
          ...barcodeEl,
          barHeight: persistentBarH,
          humanReadableFontSize: validSize,
          fontSize: validSize,
        });
        props.onUpdateSelectedElement({
          humanReadableFontSize: validSize,
          fontSize: validSize,
          barHeight: persistentBarH,
          symbol: {
            ...(barcodeEl?.symbol || {}),
            barHeight: persistentBarH,
            moduleWidth: barcodeEl?.symbol?.moduleWidth || barcodeEl?.barWidth || 1.5,
          },
          height: layout.totalHeightMm,
          humanReadable: {
            ...(barcodeEl?.humanReadable || {}),
            fontSize: validSize,
            enabled: barcodeEl?.includeText !== false,
          },
        } as any);
      } else {
        const textEl = selectedTextEl;
        const isMulti = textEl ? (textEl.textType === 'multi-line' || textEl.multiline || textEl.textFormatType === 'paragraph') : false;
        const isSingleAuto = textEl && !isMulti && (textEl.sizingMode === 'auto-width' || (!textEl.sizingMode && textEl.autoSize !== false));

        if (textEl && isSingleAuto) {
          const dims = measureTextObject({
            text: (textEl.text || 'Sample Text').replace(/\r?\n/g, ' '),
            fontFamily: textEl.fontFamily || 'Arial',
            fontSize: validSize,
            fontWeight: textEl.fontWeight,
            fontStyle: textEl.fontStyle,
            letterSpacing: textEl.letterSpacing,
            lineHeight: textEl.lineHeight,
            fontWidthScale: 100,
            textType: 'single-line',
            textFormatType: 'single-line',
            multiline: false,
            wrap: false,
            borderConfig: textEl.borderConfig,
            ignoreMinSize: true,
          });
          props.onUpdateSelectedElement({
            fontSize: validSize,
            width: dims.width,
            height: dims.height,
            sizingMode: 'auto-width',
            autoSize: true,
          } as any);
        } else {
          props.onUpdateSelectedElement({
            fontSize: validSize,
          } as any);
        }
      }
    }
  };

  const commitFontSizeInput = () => {
    if (fontSizeInput !== null) {
      const val = parseFloat(fontSizeInput.trim());
      if (!isNaN(val) && val > 0 && val <= 720) {
        handleSizeChange(val);
      }
      setFontSizeInput(null);
    }
  };

  const toggleBold = () => {
    if (props.onUpdateSelectedElement && hasSelection) {
      const nextBold = !isBold;
      if (isBarcode) {
        const nextStyle = nextBold
          ? isItalic ? 'bold-italic' : 'bold'
          : isItalic ? 'italic' : 'regular';
        props.onUpdateSelectedElement({
          humanReadableFontStyle: nextStyle,
          fontWeight: nextBold ? 'bold' : 'normal',
        } as any);
      } else {
        const textEl = selectedTextEl;
        const nextWeight = nextBold ? 'bold' : 'normal';
        const isMulti = textEl ? (textEl.textType === 'multi-line' || textEl.multiline || textEl.textFormatType === 'paragraph') : false;
        const isSingleAuto = textEl && !isMulti && (textEl.sizingMode === 'auto-width' || (!textEl.sizingMode && textEl.autoSize !== false));

        if (textEl && isSingleAuto) {
          const dims = measureTextObject({
            text: (textEl.text || 'Sample Text').replace(/\r?\n/g, ' '),
            fontFamily: textEl.fontFamily || 'Arial',
            fontSize: textEl.fontSize || 10,
            fontWeight: nextWeight,
            fontStyle: textEl.fontStyle,
            letterSpacing: textEl.letterSpacing,
            lineHeight: textEl.lineHeight,
            fontWidthScale: 100,
            textType: 'single-line',
            textFormatType: 'single-line',
            multiline: false,
            wrap: false,
            borderConfig: textEl.borderConfig,
            ignoreMinSize: true,
          });
          props.onUpdateSelectedElement({
            fontWeight: nextWeight,
            width: dims.width,
            height: dims.height,
            sizingMode: 'auto-width',
            autoSize: true,
          } as any);
        } else {
          props.onUpdateSelectedElement({
            fontWeight: nextWeight,
          } as any);
        }
      }
    }
  };

  const toggleItalic = () => {
    if (props.onUpdateSelectedElement && hasSelection) {
      const nextItalic = !isItalic;
      if (isBarcode) {
        const nextStyle = nextItalic
          ? isBold ? 'bold-italic' : 'italic'
          : isBold ? 'bold' : 'regular';
        props.onUpdateSelectedElement({
          humanReadableFontStyle: nextStyle,
          fontStyle: nextItalic ? 'italic' : 'normal',
        } as any);
      } else {
        const textEl = selectedTextEl;
        const nextStyle = nextItalic ? 'italic' : 'normal';
        const isMulti = textEl ? (textEl.textType === 'multi-line' || textEl.multiline || textEl.textFormatType === 'paragraph') : false;
        const isSingleAuto = textEl && !isMulti && (textEl.sizingMode === 'auto-width' || (!textEl.sizingMode && textEl.autoSize !== false));

        if (textEl && isSingleAuto) {
          const dims = measureTextObject({
            text: (textEl.text || 'Sample Text').replace(/\r?\n/g, ' '),
            fontFamily: textEl.fontFamily || 'Arial',
            fontSize: textEl.fontSize || 10,
            fontWeight: textEl.fontWeight,
            fontStyle: nextStyle,
            letterSpacing: textEl.letterSpacing,
            lineHeight: textEl.lineHeight,
            fontWidthScale: 100,
            textType: 'single-line',
            textFormatType: 'single-line',
            multiline: false,
            wrap: false,
            borderConfig: textEl.borderConfig,
            ignoreMinSize: true,
          });
          props.onUpdateSelectedElement({
            fontStyle: nextStyle,
            width: dims.width,
            height: dims.height,
            sizingMode: 'auto-width',
            autoSize: true,
          } as any);
        } else {
          props.onUpdateSelectedElement({
            fontStyle: nextStyle,
          } as any);
        }
      }
    }
  };

  const toggleUnderline = () => {
    if (props.onUpdateSelectedElement && hasSelection) {
      const nextUnderline = !isUnderline;
      if (isBarcode) {
        props.onUpdateSelectedElement({
          humanReadableUnderline: nextUnderline,
          textDecoration: nextUnderline ? 'underline' : 'none',
        } as any);
      } else {
        props.onUpdateSelectedElement({
          textDecoration: nextUnderline ? 'underline' : 'none',
          underline: nextUnderline,
        } as any);
      }
    }
  };

  const toggleWhiteOnBlack = () => {
    if (props.onUpdateSelectedElement && hasSelection) {
      const nextWob = !isWhiteOnBlack;
      if (isBarcode) {
        props.onUpdateSelectedElement({
          humanReadableWhiteOnBlack: nextWob,
          humanReadableColor: nextWob ? '#ffffff' : '#000000',
        } as any);
      } else {
        props.onUpdateSelectedElement({
          whiteOnBlack: nextWob,
          color: nextWob ? '#ffffff' : '#000000',
          backgroundColor: nextWob ? '#000000' : 'transparent',
        } as any);
      }
    }
  };

  const handleAlign = (align: 'left' | 'center' | 'right' | 'justify') => {
    if (props.onUpdateSelectedElement && hasSelection) {
      if (isBarcode) {
        props.onUpdateSelectedElement({
          humanReadableAlignment: align === 'justify' ? 'center' : align,
          textAlign: align,
        } as any);
      } else {
        props.onUpdateSelectedElement({ textAlign: align } as any);
      }
    }
  };

  const updateTextSelection = (updates: Partial<TextElement>) => {
    if (!editableTextSelection || isRichTextSelection) return;
    const targetedUpdates = selectedTextElements.map(element => ({ id: element.id, updates }));
    if (props.onUpdateSelectedElements) {
      props.onUpdateSelectedElements(targetedUpdates);
    } else if (selectedTextElements.length === 1 && selectedEls.length === 1) {
      props.onUpdateSelectedElement?.(updates);
    }
  };

  const setTextAlignment = (alignment: TextElement['textAlign']) => {
    if (alignment === 'justify' || alignment === 'distributed') {
      if (!paragraphTextSelection) return;
    }
    updateTextSelection({
      textAlign: alignment,
      horizontalAlignment: alignment === 'distributed' ? undefined : alignment,
    });
  };

  const setOrphanAlignment = (alignment: 'left' | 'center' | 'right') => {
    if (paragraphTextSelection) updateTextSelection({ orphanAlignment: alignment });
  };

  const setSingleLineText = () => {
    if (!editableTextSelection || isRichTextSelection) return;
    const targetedUpdates = selectedTextElements.map(element => ({
      id: element.id,
      updates: convertTextElementFormat(element, 'single-line'),
    }));
    if (props.onUpdateSelectedElements) {
      props.onUpdateSelectedElements(targetedUpdates);
    } else if (selectedTextElements.length === 1 && selectedEls.length === 1) {
      props.onUpdateSelectedElement?.(targetedUpdates[0].updates);
    }
  };

  const setArcDirection = (direction: 'clockwise' | 'counter-clockwise') => {
    if (!arcTextSelection) return;
    const arcUpdates = selectedTextElements.map(element => ({
      id: element.id,
      updates: {
        arcDirection: direction,
        arcConfig: {
          radius: element.arcConfig?.radius ?? element.arcRadius ?? 50,
          startAngle: element.arcConfig?.startAngle ?? element.arcStartAngle ?? 0,
          sweepAngle: element.arcConfig?.sweepAngle ?? element.arcSweepAngle ?? 180,
          direction,
          insidePath: element.arcConfig?.insidePath ?? !!element.arcInsidePath,
          characterSpacing: element.arcConfig?.characterSpacing ?? element.arcCharacterSpacing ?? 1,
        },
      },
    }));
    props.onUpdateSelectedElements?.(arcUpdates);
  };

  return (
    <div className="flex flex-col select-none bg-slate-50 border-b border-slate-200 text-slate-800 text-xs relative z-30 shadow-xs">
      {/* ROW 1: STANDARD & CREATION TOOLBAR */}
      <div className="flex items-center gap-1 h-9 px-2 bg-slate-50 border-b border-slate-200/80 overflow-visible relative z-30 shrink-0 whitespace-nowrap">
        {/* Standard File/Edit Buttons matching BarTender */}
        <div className="flex items-center gap-0.5 shrink-0">
          <ToolBtn icon={<FileText className="w-4 h-4 text-blue-600" />} title="New Document (Ctrl+N)" onClick={props.onNew} />
          <ToolBtn icon={<FolderOpen className="w-4 h-4 text-amber-600" />} title="Open Document (Ctrl+O)" onClick={props.onOpen} />
          <ToolBtn icon={<Save className="w-4 h-4 text-blue-600" />} title="Save Document (Ctrl+S)" onClick={props.onSave} />
          {props.onSaveAs && (
            <ToolBtn icon={<Copy className="w-4 h-4 text-slate-600" />} title="Save As... (Ctrl+Shift+S)" onClick={props.onSaveAs} />
          )}
          {props.onPageSetup && (
            <ToolBtn icon={<Layers className="w-4 h-4 text-slate-600" />} title="Page Setup... (Ctrl+D)" onClick={props.onPageSetup} />
          )}
          {props.onDatabaseSetup && (
            <ToolBtn icon={<Database className="w-4 h-4 text-emerald-600" />} title="Database Connection Setup..." onClick={props.onDatabaseSetup} />
          )}
          <ToolBtn icon={<Printer className="w-4 h-4 text-slate-700" />} title="Print (Ctrl+P)" onClick={props.onPrint} />
          {props.onPrintPreview && (
            <ToolBtn icon={<Search className="w-4 h-4 text-purple-600" />} title="Print Preview (Ctrl+R)" onClick={props.onPrintPreview} />
          )}
        </div>

        <Divider />

        {/* Clipboard Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          <ToolBtn icon={<Scissors className="w-4 h-4 text-slate-600" />} title="Cut Selected (Ctrl+X)" onClick={props.onCut} />
          <ToolBtn icon={<Copy className="w-4 h-4 text-slate-600" />} title="Copy Selected (Ctrl+C)" onClick={props.onCopy} />
          <ToolBtn icon={<Clipboard className="w-4 h-4 text-amber-600" />} title="Paste (Ctrl+V)" onClick={props.onPaste} />
          {props.onDelete && (
            <ToolBtn icon={<Trash2 className="w-4 h-4 text-red-600" />} title="Delete Selected (Del / Backspace)" onClick={props.onDelete} />
          )}
          <ToolBtn icon={<Undo2 className="w-4 h-4 text-slate-600" />} title="Undo (Ctrl+Z)" disabled={!props.canUndo} onClick={props.onUndo} />
          <ToolBtn icon={<Redo2 className="w-4 h-4 text-slate-600" />} title="Redo (Ctrl+Y)" disabled={!props.canRedo} onClick={props.onRedo} />
        </div>

        <Divider />

        {/* Pointer / Select Tool */}
        <button
          title="Pointer / Select Tool (V)"
          onClick={() => props.setActiveTool('select')}
          className={`h-7 px-2 rounded-md flex items-center justify-center border transition-all cursor-pointer shrink-0 ${
            props.activeTool === 'select'
              ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-2xs font-semibold'
              : 'hover:bg-slate-200/80 active:bg-slate-300/80 border-transparent text-slate-700'
          }`}
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
            <path d="M4 2l12 12-5.5 1.5 3.5 6.5-2.5 1-3.5-6.5L4 20V2z" />
          </svg>
        </button>

        {/* Data Edit Tool */}
        <button
          title={"Data Edit\nActivates the Data Edit tool used to edit data for barcode and text objects."}
          onClick={() => props.setActiveTool('data-edit')}
          className={`h-7 px-2 rounded-md flex items-center justify-center border transition-all cursor-pointer shrink-0 ${
            props.activeTool === 'data-edit'
              ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-2xs font-semibold'
              : 'hover:bg-slate-200/80 active:bg-slate-300/80 border-transparent text-slate-700'
          }`}
        >
          <div className="flex items-center gap-0.5">
            <span className="font-serif font-black text-xs leading-none">I</span>
            <span className="text-[10px] font-mono text-blue-700 leading-none">✎</span>
          </div>
        </button>

        {/* Format Painter */}
        <ToolBtn
          icon={<Paintbrush className="w-4 h-4 text-slate-700" />}
          title="Format Painter"
          onClick={props.onFormatPainter || (() => {})}
        />

        <Divider />

        {/* Barcode Split Dropdown */}
        <div ref={barcodeTriggerRef} className="relative flex items-center shrink-0">
          <button
            type="button"
            title="Insert 1D Barcode (Code 128) (B)"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              props.onInsertBarcode('code128');
              setOpenMenu(null);
            }}
            className={`h-7 px-2 rounded-l-md flex items-center gap-1 border border-r-0 transition-all cursor-pointer ${
              openMenu === 'barcode'
                ? 'bg-blue-100 border-blue-400 text-blue-900 font-semibold'
                : props.activeTool === 'barcode'
                ? 'bg-amber-100 border-amber-300 text-amber-900 font-semibold'
                : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
              <path d="M2 5h2v14H2V5zm3 0h1v14H5V5zm3 0h2v14H8V5zm4 0h3v14h-3V5zm5 0h1v14h-1V5zm3 0h1v14h-1V5z" />
            </svg>
            <span className="text-[10px] font-mono font-bold">123</span>
          </button>
          <button
            type="button"
            title="Choose Barcode Symbology..."
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              toggleMenu('barcode');
            }}
            className={`h-7 px-1 rounded-r-md border transition-all cursor-pointer ${
              openMenu === 'barcode'
                ? 'bg-blue-100 border-blue-400 text-blue-900'
                : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-600'
            }`}
          >
            <ChevronDown className="w-3 h-3" />
          </button>

          {/* Barcode Dropdown Menu */}
          {openMenu === 'barcode' && (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute left-0 top-full mt-1 bg-white border border-slate-300 rounded-md shadow-2xl py-1 z-[9999] text-[11.5px] select-none min-w-[210px] animate-in fade-in zoom-in-95 duration-75"
            >
              <div className="px-3 py-1 font-bold text-slate-700 text-[10.5px] uppercase tracking-wider bg-slate-50 border-b border-slate-100 select-none">
                Recently Used Barcodes
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onInsertBarcode('code128');
                  setOpenMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-slate-800 transition-colors cursor-pointer flex items-center justify-between"
              >
                <span className="font-medium">Code 128</span>
                <span className="text-[10px] text-slate-400 font-mono">1D</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onInsertBarcode('code39');
                  setOpenMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-slate-800 transition-colors cursor-pointer flex items-center justify-between"
              >
                <span className="font-medium">Code 39</span>
                <span className="text-[10px] text-slate-400 font-mono">1D</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onInsertBarcode('datamatrix');
                  setOpenMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-slate-800 transition-colors cursor-pointer flex items-center justify-between"
              >
                <span className="font-medium">Data Matrix</span>
                <span className="text-[10px] text-slate-400 font-mono">2D</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onInsertQR ? props.onInsertQR() : props.onInsertBarcode('qr');
                  setOpenMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-slate-800 transition-colors cursor-pointer flex items-center justify-between"
              >
                <span className="font-medium">QR Code</span>
                <span className="text-[10px] text-slate-400 font-mono">2D</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onInsertBarcode('posicode-b');
                  setOpenMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-slate-800 transition-colors cursor-pointer flex items-center justify-between"
              >
                <span className="font-medium">PosiCode B</span>
                <span className="text-[10px] text-slate-400 font-mono">1D</span>
              </button>
              <div className="h-px bg-slate-200 my-1" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenu(null);
                  props.onOpenBarcodePicker();
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-amber-50 hover:text-amber-900 text-slate-800 transition-colors font-semibold flex items-center justify-between cursor-pointer"
              >
                <span>More Barcodes...</span>
                <span className="text-[10px] text-amber-600 font-mono">All Symbologies</span>
              </button>
              {props.onOpenBarcodeProperties && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenu(null);
                    props.onOpenBarcodeProperties?.();
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-blue-900 transition-colors font-medium flex items-center justify-between border-t border-slate-100 cursor-pointer"
                >
                  <span>Barcode Properties...</span>
                  <span className="text-[9px] text-slate-500 font-mono">F12</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Text Objects Split Dropdown */}
        <div ref={textTriggerRef} className="relative flex items-center shrink-0">
          <button
            type="button"
            title={`Insert Text Object (${lastTextType.toUpperCase()}) (T)`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (props.onInsertTextType) {
                props.onInsertTextType(lastTextType);
              } else {
                props.onInsertText();
              }
              setOpenMenu(null);
            }}
            className={`h-7 px-2 rounded-l-md flex items-center gap-0.5 border border-r-0 font-serif font-bold text-[13px] transition-all cursor-pointer ${
              openMenu === 'text'
                ? 'bg-blue-100 border-blue-400 text-blue-900 font-bold'
                : props.activeTool === 'text'
                ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold'
                : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
            }`}
          >
            A
          </button>
          <button
            type="button"
            title="Text Object Types & Markup Containers..."
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              toggleMenu('text');
            }}
            className={`h-7 px-1 rounded-r-md border transition-all cursor-pointer ${
              openMenu === 'text'
                ? 'bg-blue-100 border-blue-400 text-blue-900'
                : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-600'
            }`}
          >
            <ChevronDown className="w-3 h-3" />
          </button>

          {/* Text Objects Dropdown Menu */}
          {openMenu === 'text' && (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute left-0 top-full mt-1 bg-white border border-slate-300 rounded-md shadow-2xl py-1 z-[9999] text-[11.5px] select-none min-w-[260px] animate-in fade-in zoom-in-95 duration-75"
            >
              <div className="px-3 py-1 font-bold text-slate-700 text-[10.5px] uppercase tracking-wider bg-slate-50 border-b border-slate-100">
                Text Objects
              </div>
              <button
                type="button"
                title="Content-sized single-line text, non-wrapping"
                onClick={(e) => {
                  e.stopPropagation();
                  setLastTextType('single-line');
                  props.onInsertTextType ? props.onInsertTextType('single-line') : props.onInsertText();
                  setOpenMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-blue-50 text-slate-800 group transition-colors cursor-pointer"
              >
                <div className="flex flex-col text-left">
                  <span className="font-medium">Single Line</span>
                  <span className="text-[10px] text-slate-400">One line, width follows text</span>
                </div>
                <span className="font-serif italic font-bold text-emerald-600 text-xs">A</span>
              </button>
              <button
                type="button"
                title="Dynamic multi-line paragraph text with word wrapping and reflow"
                onClick={(e) => {
                  e.stopPropagation();
                  setLastTextType('multi-line');
                  props.onInsertTextType ? props.onInsertTextType('multi-line') : props.onInsertText();
                  setOpenMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-blue-50 text-slate-800 group transition-colors cursor-pointer"
              >
                <div className="flex flex-col text-left">
                  <span className="font-medium">Multi-line</span>
                  <span className="text-[10px] text-slate-400">Word-wrapped paragraph</span>
                </div>
                <span className="font-serif italic font-bold text-emerald-600 text-xs">¶</span>
              </button>
              <button
                type="button"
                title="Rich formatted text runs with independent styles, fonts, and colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setLastTextType('word-processor');
                  props.onInsertTextType ? props.onInsertTextType('word-processor') : props.onInsertText();
                  setOpenMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-blue-50 text-slate-800 group transition-colors cursor-pointer"
              >
                <div className="flex flex-col text-left">
                  <span className="font-medium">Word Processor</span>
                  <span className="text-[10px] text-slate-400">Rich text runs & styles</span>
                </div>
                <span className="font-sans font-bold text-purple-600 text-[10px]">TT</span>
              </button>
              <button
                type="button"
                title="Curved text along circular or elliptical arc paths"
                onClick={(e) => {
                  e.stopPropagation();
                  setLastTextType('arc');
                  props.onInsertTextType ? props.onInsertTextType('arc') : props.onInsertText();
                  setOpenMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-blue-50 text-slate-800 group transition-colors cursor-pointer"
              >
                <div className="flex flex-col text-left">
                  <span className="font-medium">Arc</span>
                  <span className="text-[10px] text-slate-400">Text on curved path</span>
                </div>
                <span className="font-serif italic font-bold text-emerald-600 text-xs">⌒</span>
              </button>
              <button
                type="button"
                title="Unicode industrial and commercial symbols (©, ®, ™, ⚡, etc.)"
                onClick={(e) => {
                  e.stopPropagation();
                  setLastTextType('symbol-font');
                  props.onInsertTextType ? props.onInsertTextType('symbol-font') : props.onInsertText();
                  setOpenMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-blue-50 text-slate-800 group transition-colors cursor-pointer"
              >
                <div className="flex flex-col text-left">
                  <span className="font-medium">Symbol Font Characters</span>
                  <span className="text-[10px] text-slate-400">Unicode symbol picker</span>
                </div>
                <span className="font-sans font-bold text-amber-600 text-xs">⚡</span>
              </button>
              <div className="px-3 py-1 font-bold text-slate-700 text-[10.5px] uppercase tracking-wider bg-slate-50 border-y border-slate-200 mt-1">
                Markup Language Containers
              </div>
              <button
                type="button"
                title="Rich Text Format container with styled paragraphs and formatting"
                onClick={(e) => {
                  e.stopPropagation();
                  setLastTextType('rtf');
                  props.onInsertTextType ? props.onInsertTextType('rtf') : props.onInsertText();
                  setOpenMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-blue-50 text-slate-800 group transition-colors cursor-pointer"
              >
                <div className="flex flex-col text-left">
                  <span className="font-medium">RTF</span>
                  <span className="text-[10px] text-slate-400">Rich Text Format markup</span>
                </div>
                <span className="font-mono text-slate-500 text-[10px]">rtf</span>
              </button>
              <button
                type="button"
                title="Secure HTML markup container with custom styling and layout"
                onClick={(e) => {
                  e.stopPropagation();
                  setLastTextType('html');
                  props.onInsertTextType ? props.onInsertTextType('html') : props.onInsertText();
                  setOpenMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-blue-50 text-slate-800 group transition-colors cursor-pointer"
              >
                <div className="flex flex-col text-left">
                  <span className="font-medium">HTML</span>
                  <span className="text-[10px] text-slate-400">Sanitized HTML container</span>
                </div>
                <span className="font-mono text-slate-500 text-[10px]">&lt;&gt;</span>
              </button>
              <button
                type="button"
                title="Safe XAML TextBlock and Run markup container"
                onClick={(e) => {
                  e.stopPropagation();
                  setLastTextType('xaml');
                  props.onInsertTextType ? props.onInsertTextType('xaml') : props.onInsertText();
                  setOpenMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-blue-50 text-slate-800 group transition-colors cursor-pointer"
              >
                <div className="flex flex-col text-left">
                  <span className="font-medium">XAML</span>
                  <span className="text-[10px] text-slate-400">Safe XAML TextBlock markup</span>
                </div>
                <span className="font-mono text-slate-500 text-[10px]">xaml</span>
              </button>
              {(props.onOpenTextProperties || props.onOpenProperties) && (
                <>
                  <div className="h-px bg-slate-200 my-1" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenu(null);
                      (props.onOpenTextProperties || props.onOpenProperties)?.();
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-emerald-900 transition-colors font-medium flex items-center justify-between cursor-pointer"
                  >
                    <span>Text Properties...</span>
                    <span className="text-[9px] text-slate-500 font-mono">F8</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Line / Shapes Split Dropdown */}
        <div ref={shapeTriggerRef} className="relative flex items-center shrink-0">
          <button
            type="button"
            title={`Insert Shape (${lastShapeType.charAt(0).toUpperCase() + lastShapeType.slice(1)})`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              props.onInsertShape(lastShapeType);
              setOpenMenu(null);
            }}
            className={`h-7 px-2 rounded-l-md flex items-center border border-r-0 transition-all cursor-pointer ${
              openMenu === 'line'
                ? 'bg-blue-100 border-blue-400 text-blue-900 font-semibold'
                : ['rect', 'circle', 'line'].includes(props.activeTool)
                ? 'bg-amber-100 border-amber-300 text-amber-900 font-semibold'
                : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
            }`}
          >
            {lastShapeType === 'rectangle' ? (
              <Square className="w-3.5 h-3.5" />
            ) : lastShapeType === 'circle' ? (
              <Circle className="w-3.5 h-3.5" />
            ) : (
              <Slash className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            title="Shapes & Tables (Rectangle, Circle, Line, Table)..."
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              toggleMenu('line');
            }}
            className={`h-7 px-1 rounded-r-md border transition-all cursor-pointer ${
              openMenu === 'line'
                ? 'bg-blue-100 border-blue-400 text-blue-900'
                : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-600'
            }`}
          >
            <ChevronDown className="w-3 h-3" />
          </button>

          {/* Line / Shapes Dropdown Menu */}
          {openMenu === 'line' && (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute left-0 top-full mt-1 bg-white border border-slate-300 rounded-md shadow-2xl py-1 z-[9999] text-[11.5px] select-none min-w-[210px] animate-in fade-in zoom-in-95 duration-75"
            >
              <div className="px-3 py-1 font-bold text-slate-700 text-[10.5px] uppercase tracking-wider bg-slate-50 border-b border-slate-100">
                Rectangles
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLastShapeType('rectangle');
                  props.onInsertShape('rectangle');
                  setOpenMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-slate-800 transition-colors cursor-pointer flex items-center gap-2"
              >
                <Square className="w-3.5 h-3.5 text-blue-600" />
                <span>Rectangle / Box</span>
              </button>
              <div className="px-3 py-1 font-bold text-slate-700 text-[10.5px] uppercase tracking-wider bg-slate-50 border-y border-slate-200 mt-1">
                Basic Shapes
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLastShapeType('circle');
                  props.onInsertShape('circle');
                  setOpenMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-slate-800 transition-colors cursor-pointer flex items-center gap-2"
              >
                <Circle className="w-3.5 h-3.5 text-blue-600" />
                <span>Circle / Ellipse</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLastShapeType('line');
                  props.onInsertShape('line');
                  setOpenMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-slate-800 transition-colors cursor-pointer flex items-center gap-2"
              >
                <Slash className="w-3.5 h-3.5 text-blue-600" />
                <span>Straight Line</span>
              </button>
              <div className="px-3 py-1 font-bold text-slate-700 text-[10.5px] uppercase tracking-wider bg-slate-50 border-y border-slate-200 mt-1">
                Tables & Advanced
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onInsertTable();
                  setOpenMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-slate-800 transition-colors cursor-pointer flex items-center gap-2"
              >
                <TableIcon className="w-3.5 h-3.5 text-indigo-600" />
                <span>Specification Table</span>
              </button>
              {(props.onOpenShapeProperties || props.onOpenProperties) && (
                <>
                  <div className="h-px bg-slate-200 my-1" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenu(null);
                      (props.onOpenShapeProperties || props.onOpenProperties)?.();
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-blue-900 transition-colors font-medium flex items-center justify-between cursor-pointer"
                  >
                    <span>Shape Properties...</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Picture / Image Icon */}
        <ToolBtn icon={<ImageIcon className="w-4 h-4 text-emerald-600" />} title="Insert Picture / Industrial Symbol" onClick={props.onInsertImage} />

        {/* RFID / Sensor Icon */}
        <ToolBtn
          icon={<Radio className="w-4 h-4 text-purple-600" />}
          title="RFID Tag Encoding & Sensor (EPC Gen2 / ISO 18000-6C)"
          onClick={() => {
            if (props.selectedElement && props.onUpdateSelectedElement) {
              props.onUpdateSelectedElement({ rfidEnabled: true } as any);
            }
          }}
        />

        <Divider />

        {/* Zoom & View Controls */}
        <div className="flex items-center gap-0.5 shrink-0">
          <ToolBtn icon={<ZoomIn className="w-4 h-4 text-slate-700" />} title="Zoom In (Ctrl++)" onClick={props.onZoomIn} />
          <ToolBtn icon={<ZoomOut className="w-4 h-4 text-slate-700" />} title="Zoom Out (Ctrl+-)" onClick={props.onZoomOut} />
          <ToolBtn
            icon={<Scan className="w-4 h-4 text-slate-700" />}
            title="Zoom to Rectangle"
            active={props.activeTool === 'zoom-rect'}
            disabled={props.canZoomViewport === false}
            onClick={props.onZoomToRectangle}
          />
          <ToolBtn
            icon={<Maximize2 className="w-4 h-4 text-slate-700" />}
            title="Fit Template in Window (F3)"
            disabled={props.canZoomViewport === false}
            onClick={props.onZoomFit}
          />
        </div>

        <Divider />

        {/* View Grid / Ruler / Snap Toggles */}
        <div className="flex items-center gap-0.5 shrink-0">
          <ToolToggle icon={<Grid className="w-4 h-4" />} title="Toggle Grid Lines" active={props.showGrid} onClick={props.onToggleGrid} />
          <ToolToggle icon={<Ruler className="w-4 h-4" />} title="Toggle Metric Rulers" active={props.showRulers} onClick={props.onToggleRulers} />
          <ToolToggle icon={<Magnet className="w-4 h-4" />} title="Snap to Grid / Guides" active={props.snapToGrid} onClick={props.onToggleSnap} />
        </div>

        <Divider />

        {/* Dimension & Position Controls */}
        <div className="flex items-center gap-2 px-2.5 py-1 bg-white border border-slate-200 rounded-lg shadow-2xs text-xs text-slate-800 shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/80">
            {props.selectedElement ? props.selectedElement.type : 'LABEL'}
          </span>

          {/* Width Control */}
          <div className="flex items-center gap-1">
            <span className="font-semibold text-slate-600 text-[11px]">W:</span>
            <div className="flex items-center border border-slate-200 rounded-md bg-slate-50/50 overflow-hidden shadow-2xs focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-100">
              <button
                type="button"
                onClick={() => handleWidthChange(Math.max(1, Number((currentW - 1).toFixed(1))))}
                className="px-1.5 py-0.5 hover:bg-slate-200 text-slate-600 font-bold text-xs select-none transition-colors cursor-pointer border-r border-slate-200"
                title="Decrease Width (-1 mm)"
              >
                -
              </button>
              <input
                type="number"
                step="0.5"
                min="1"
                max="1000"
                value={currentW}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) handleWidthChange(val);
                }}
                className="w-12 text-center text-xs font-mono font-bold text-slate-800 bg-transparent outline-none py-0.5"
                title="Width in mm"
              />
              <button
                type="button"
                onClick={() => handleWidthChange(Number((currentW + 1).toFixed(1)))}
                className="px-1.5 py-0.5 hover:bg-slate-200 text-slate-600 font-bold text-xs select-none transition-colors cursor-pointer border-l border-slate-200"
                title="Increase Width (+1 mm)"
              >
                +
              </button>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">mm</span>
          </div>

          {/* Height Control */}
          <div className="flex items-center gap-1">
            <span className="font-semibold text-slate-600 text-[11px]">H:</span>
            <div className="flex items-center border border-slate-200 rounded-md bg-slate-50/50 overflow-hidden shadow-2xs focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-100">
              <button
                type="button"
                onClick={() => handleHeightChange(Math.max(1, Number((currentH - 1).toFixed(1))))}
                className="px-1.5 py-0.5 hover:bg-slate-200 text-slate-600 font-bold text-xs select-none transition-colors cursor-pointer border-r border-slate-200"
                title="Decrease Height (-1 mm)"
              >
                -
              </button>
              <input
                type="number"
                step="0.5"
                min="1"
                max="1000"
                value={currentH}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) handleHeightChange(val);
                }}
                className="w-12 text-center text-xs font-mono font-bold text-slate-800 bg-transparent outline-none py-0.5"
                title="Height in mm"
              />
              <button
                type="button"
                onClick={() => handleHeightChange(Number((currentH + 1).toFixed(1)))}
                className="px-1.5 py-0.5 hover:bg-slate-200 text-slate-600 font-bold text-xs select-none transition-colors cursor-pointer border-l border-slate-200"
                title="Increase Height (+1 mm)"
              >
                +
              </button>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">mm</span>
          </div>

          {/* Position X & Y */}
          {props.selectedElement && (
            <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="flex items-center gap-1">
                <span className="text-slate-500 text-[10.5px] font-medium">X:</span>
                <input
                  type="number"
                  step="0.5"
                  value={currentX}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) handleXChange(val);
                  }}
                  className="w-10 text-center text-[11px] font-mono border border-slate-200 rounded-md bg-slate-50/50 outline-none py-0.5 font-semibold text-slate-800"
                  title="X Position in mm"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-500 text-[10.5px] font-medium">Y:</span>
                <input
                  type="number"
                  step="0.5"
                  value={currentY}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) handleYChange(val);
                  }}
                  className="w-10 text-center text-[11px] font-mono border border-slate-200 rounded-md bg-slate-50/50 outline-none py-0.5 font-semibold text-slate-800"
                  title="Y Position in mm"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ROW 2: CONTEXT-AWARE FORMATTING & PROPERTIES TOOLBAR */}
      <div className="flex items-center gap-1.5 h-8.5 px-2 bg-slate-100/90 border-b border-slate-200 overflow-x-auto no-scrollbar shrink-0 whitespace-nowrap text-xs">
        {/* Global Element Editable Toggle */}
        {hasSelection && (
          <button
            type="button"
            onClick={() => {
              if (props.onUpdateSelectedElement) {
                props.onUpdateSelectedElement({ isEditable: !isElementEditable, editable: !isElementEditable });
              }
            }}
            className={`h-6.5 px-2 rounded-md flex items-center gap-1.5 text-xs font-semibold border transition-all cursor-pointer shadow-2xs shrink-0 ${
              !isElementEditable
                ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
            }`}
            title={!isElementEditable ? 'Locked: Click to Unlock & Make Editable' : 'Editable: Click to Lock'}
          >
            {!isElementEditable ? (
              <Lock className="w-3.5 h-3.5 text-amber-600" />
            ) : (
              <Unlock className="w-3.5 h-3.5 text-emerald-600" />
            )}
            <span>{!isElementEditable ? 'Locked' : 'Editable'}</span>
          </button>
        )}

        {/* BARCODE ELEMENT SELECTED */}
        {selectedBarcodeEl ? (
          <>
            {/* 1. Font Family Dropdown */}
            <select
              value={currentFont}
              onChange={(e) => handleFontChange(e.target.value)}
              title="Barcode Text Font"
              className="h-6.5 bg-white border border-slate-300 hover:border-slate-400 rounded-md px-2 text-xs font-sans text-slate-800 outline-none w-36 shadow-2xs transition-colors"
            >
              {fonts.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>

            {/* 2. Font Size Combobox */}
            <FontSizeComboBox
              value={currentFontSize}
              onChange={handleSizeChange}
              title="Barcode Text Size"
            />

            <Divider />

            {/* 3. B, I, U, W buttons */}
            <ToolFormatBtn icon={<Bold className="w-3.5 h-3.5" />} active={isBold} title="Bold Text" bold onClick={toggleBold} />
            <ToolFormatBtn icon={<Italic className="w-3.5 h-3.5" />} active={isItalic} title="Italic Text" italic onClick={toggleItalic} />
            <ToolFormatBtn icon={<Underline className="w-3.5 h-3.5" />} active={isUnderline} title="Underline Text" underline onClick={toggleUnderline} />
            <ToolFormatBtn label="W" active={isWhiteOnBlack} title="White on Black Text" onClick={toggleWhiteOnBlack} />

            <Divider />

            {/* 4. Text Color */}
            <label className="h-6.5 px-2 rounded-md flex flex-col items-center justify-center hover:bg-slate-200/80 cursor-pointer border border-slate-300/80 bg-white/80 transition-colors" title="Barcode Text Color">
              <span className="font-serif font-bold text-xs leading-none text-slate-900">A</span>
              <span
                className="w-4 h-1 rounded-full mt-0.5"
                style={{ backgroundColor: activeFontColor }}
              />
              <input
                type="color"
                value={activeFontColor}
                onChange={(e) => {
                  if (props.onUpdateSelectedElement) {
                    props.onUpdateSelectedElement({
                      humanReadableColor: e.target.value,
                      color: e.target.value,
                      humanReadable: {
                        ...(selectedBarcodeEl?.humanReadable || {}),
                        color: e.target.value,
                      },
                    } as any);
                  }
                }}
                className="sr-only"
              />
            </label>

            {/* 5. Highlight / Background Color */}
            <label className="h-6.5 px-2 rounded-md flex flex-col items-center justify-center hover:bg-slate-200/80 cursor-pointer border border-slate-300/80 bg-white/80 transition-colors" title="Barcode Background Color">
              <span className="font-sans font-bold text-[10px] leading-none text-slate-800">ab</span>
              <span
                className="w-4 h-1 rounded-full mt-0.5"
                style={{ backgroundColor: activeBgColor }}
              />
              <input
                type="color"
                value={activeBgColor}
                onChange={(e) => {
                  if (props.onUpdateSelectedElement) {
                    props.onUpdateSelectedElement({
                      backgroundColor: e.target.value,
                      humanReadableBgColor: e.target.value,
                    } as any);
                  }
                }}
                className="sr-only"
              />
            </label>

            <Divider />

            {/* 6. Alignments */}
            <ToolBtn icon={<AlignLeft className="w-3.5 h-3.5" />} active={textAlign === 'left'} title="Align Text Left" onClick={() => handleAlign('left')} />
            <ToolBtn icon={<AlignCenter className="w-3.5 h-3.5" />} active={textAlign === 'center'} title="Align Text Center" onClick={() => handleAlign('center')} />
            <ToolBtn icon={<AlignRight className="w-3.5 h-3.5" />} active={textAlign === 'right'} title="Align Text Right" onClick={() => handleAlign('right')} />

            <Divider />

            {/* 7. Barcode Symbology & Data */}
            <div className="flex items-center gap-1 shrink-0 font-medium text-slate-700">
              <Barcode className="w-4 h-4 text-blue-600" />
              <span>Symbology:</span>
            </div>

            <select
              value={selectedBarcodeEl.symbology}
              onChange={(e) => {
                if (props.onUpdateSelectedElement) {
                  props.onUpdateSelectedElement({ symbology: e.target.value as any });
                }
              }}
              className="h-6.5 bg-white border border-slate-300 hover:border-slate-400 rounded-md px-2 text-xs font-sans text-slate-800 outline-none shadow-2xs transition-colors max-w-[110px]"
            >
              <option value="code128">Code 128</option>
              <option value="posicode-b">PosiCode B</option>
              <option value="posicode-a">PosiCode A</option>
              <option value="datamatrix">Data Matrix</option>
              <option value="qr">QR Code</option>
              <option value="gs1-128">GS1-128</option>
              <option value="ean13">EAN-13</option>
              <option value="itf14">ITF-14</option>
              <option value="code39">Code 39</option>
              <option value="pdf417">PDF417</option>
            </select>

            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-md px-2 h-6.5 shadow-2xs">
              <span className="text-[10.5px] text-slate-500 font-medium">Data:</span>
              <input
                type="text"
                value={selectedBarcodeEl.value || ''}
                onChange={(e) => {
                  if (props.onUpdateSelectedElement) {
                    const newVal = e.target.value;
                    const updatedDs =
                      selectedBarcodeEl.dataSources && selectedBarcodeEl.dataSources.length > 0
                        ? selectedBarcodeEl.dataSources.map((ds, idx) =>
                            idx === 0
                              ? {
                                  ...ds,
                                  value: newVal,
                                  serialization: ds.serialization
                                    ? { ...ds.serialization, currentValue: newVal }
                                    : undefined,
                                }
                              : ds
                          )
                        : [
                            {
                              id: `ds-${Date.now()}`,
                              name: 'Primary Data Source',
                              type: 'embedded' as const,
                              value: newVal,
                              enabled: true,
                            },
                          ];
                    props.onUpdateSelectedElement({
                      value: newVal,
                      barcodeValue: newVal,
                      content: newVal,
                      dataSources: updatedDs,
                    });
                  }
                }}
                className="w-24 text-xs font-mono text-slate-900 outline-none bg-transparent"
                placeholder="Data..."
              />
            </div>

            <Divider />

            {/* 8. Show Text Checkbox */}
            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700 select-none">
              <input
                type="checkbox"
                checked={selectedBarcodeEl.includeText !== false}
                onChange={(e) => {
                  if (props.onUpdateSelectedElement) {
                    props.onUpdateSelectedElement({ includeText: e.target.checked });
                  }
                }}
                className="rounded text-blue-600 focus:ring-0 w-3.5 h-3.5 accent-blue-600"
              />
              <span>Show Text</span>
            </label>

            <Divider />

            {/* Rotation */}
            <ToolBtn
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              title="Rotate 90° CCW"
              onClick={() => {
                if (props.onUpdateSelectedElement) {
                  props.onUpdateSelectedElement({ rotation: ((selectedBarcodeEl.rotation || 0) - 90 + 360) % 360 });
                }
              }}
            />
            <ToolBtn
              icon={<RotateCw className="w-3.5 h-3.5" />}
              title="Rotate 90° CW"
              onClick={() => {
                if (props.onUpdateSelectedElement) {
                  props.onUpdateSelectedElement({ rotation: ((selectedBarcodeEl.rotation || 0) + 90) % 360 });
                }
              }}
            />

            {props.onOpenBarcodeProperties && (
              <button
                onClick={props.onOpenBarcodeProperties}
                className="h-6.5 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer ml-auto transition-colors"
                title="Barcode Properties Dialog (F12)"
              >
                <Sliders className="w-3.5 h-3.5 text-white" />
                <span>Barcode Properties...</span>
              </button>
            )}
          </>
        ) : selectedShapeEl ? (
          <>
            {/* SHAPE ELEMENT SELECTED */}
            <div className="flex items-center gap-1 font-semibold text-slate-700">
              <span>Shape:</span>
              <span className="bg-slate-200/90 text-slate-800 px-2 py-0.5 rounded-md text-[10.5px] font-bold uppercase tracking-wider">
                {selectedShapeEl.shapeType}
              </span>
            </div>

            <Divider />

            {/* Fill Color */}
            <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
              <span className="font-medium">Fill:</span>
              <input
                type="color"
                value={selectedShapeEl.fillColor || '#ffffff'}
                onChange={(e) => {
                  if (props.onUpdateSelectedElement) {
                    props.onUpdateSelectedElement({ fillColor: e.target.value });
                  }
                }}
                className="w-6 h-5 border border-slate-300 rounded cursor-pointer"
              />
            </label>

            {/* Stroke Color */}
            <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer ml-2">
              <span className="font-medium">Border:</span>
              <input
                type="color"
                value={selectedShapeEl.strokeColor || '#000000'}
                onChange={(e) => {
                  if (props.onUpdateSelectedElement) {
                    props.onUpdateSelectedElement({ strokeColor: e.target.value });
                  }
                }}
                className="w-6 h-5 border border-slate-300 rounded cursor-pointer"
              />
            </label>

            {/* Border Width */}
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-xs text-slate-600 font-medium">Thickness:</span>
              <select
                value={selectedShapeEl.strokeWidth || 1}
                onChange={(e) => {
                  if (props.onUpdateSelectedElement) {
                    props.onUpdateSelectedElement({ strokeWidth: Number(e.target.value) });
                  }
                }}
                className="h-6.5 bg-white border border-slate-300 rounded-md px-2 text-xs outline-none"
              >
                <option value={0.5}>0.5 mm</option>
                <option value={1}>1.0 mm</option>
                <option value={2}>2.0 mm</option>
                <option value={3}>3.0 mm</option>
              </select>
            </div>

            <Divider />

            <ToolBtn
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              title="Rotate 90° CCW"
              onClick={() => {
                if (props.onUpdateSelectedElement) {
                  props.onUpdateSelectedElement({ rotation: ((selectedShapeEl.rotation || 0) - 90 + 360) % 360 });
                }
              }}
            />
            <ToolBtn
              icon={<RotateCw className="w-3.5 h-3.5" />}
              title="Rotate 90° CW"
              onClick={() => {
                if (props.onUpdateSelectedElement) {
                  props.onUpdateSelectedElement({ rotation: ((selectedShapeEl.rotation || 0) + 90) % 360 });
                }
              }}
            />

            {(props.onOpenShapeProperties || props.onOpenProperties) && (
              <button
                onClick={props.onOpenShapeProperties || props.onOpenProperties}
                className="h-6.5 px-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer ml-auto transition-colors"
                title="Shape Properties Dialog (F8)"
              >
                <Sliders className="w-3.5 h-3.5 text-white" />
                <span>Shape Properties...</span>
              </button>
            )}
          </>
        ) : selectedTextEl ? (
          <>
            {/* TEXT ELEMENT SELECTED */}
            {/* Font Family Dropdown */}
            <select
              value={currentFont}
              onChange={(e) => handleFontChange(e.target.value)}
              className="h-6.5 bg-white border border-slate-300 hover:border-slate-400 rounded-md px-2 text-xs font-sans text-slate-800 outline-none w-40 shadow-2xs transition-colors"
            >
              {fonts.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>

            {/* Font Size Combobox */}
            <FontSizeComboBox
              value={currentFontSize}
              onChange={handleSizeChange}
              title="Font Size"
            />

            <Divider />

            {/* B, I, U, Auto buttons */}
            <ToolFormatBtn icon={<Bold className="w-3.5 h-3.5" />} active={isBold} title="Bold" bold onClick={toggleBold} />
            <ToolFormatBtn icon={<Italic className="w-3.5 h-3.5" />} active={isItalic} title="Italic" italic onClick={toggleItalic} />
            <ToolFormatBtn icon={<Underline className="w-3.5 h-3.5" />} active={isUnderline} title="Underline" underline onClick={toggleUnderline} />
            {/* CONDITIONAL TEXT CONTROLS: SINGLE-LINE VS MULTI-LINE */}
            {(
              /* SINGLE LINE: Sizing Modes */
              <div className="flex items-center gap-1">
                <span className="text-slate-500 text-[10.5px] font-medium">Sizing:</span>
                <select
                  value={selectedTextEl.sizingMode || (selectedTextEl.autoSize !== false ? 'auto-width' : 'fixed-width')}
                  onChange={(e) => {
                    const newMode = e.target.value as any;
                    if (props.onUpdateSelectedElement && selectedTextEl) {
                      if (newMode === 'auto-width') {
                        const dims = measureTextObject({
                          text: (selectedTextEl.text || 'Sample Text').replace(/\r?\n/g, ' '),
                          fontFamily: selectedTextEl.fontFamily || 'Arial',
                          fontSize: selectedTextEl.fontSize || 10,
                          fontWeight: selectedTextEl.fontWeight,
                          fontStyle: selectedTextEl.fontStyle,
                          letterSpacing: selectedTextEl.letterSpacing,
                          lineHeight: selectedTextEl.lineHeight,
                          fontWidthScale: 100,
                          textType: 'single-line',
                          textFormatType: 'single-line',
                          multiline: false,
                          wrap: false,
                          borderConfig: selectedTextEl.borderConfig,
                          ignoreMinSize: true,
                        });
                        props.onUpdateSelectedElement({
                          sizingMode: 'auto-width',
                          autoSize: true,
                          autoFit: false,
                          autoHeight: false,
                          autoSizeConfig: { ...(selectedTextEl.autoSizeConfig || {}), enabled: false } as any,
                          width: dims.width,
                          height: dims.height,
                        } as any);
                      } else {
                        props.onUpdateSelectedElement({
                          sizingMode: newMode,
                          autoSize: false,
                          autoHeight: newMode === 'fit-to-box' || newMode === 'shrink-to-fit' ? false : selectedTextEl.autoHeight,
                          autoFit: newMode === 'shrink-to-fit' || newMode === 'fit-to-box',
                          autoSizeConfig: {
                            ...(selectedTextEl.autoSizeConfig || {}),
                            enabled: newMode === 'shrink-to-fit' || newMode === 'fit-to-box',
                          } as any,
                        } as any);
                      }
                    }
                  }}
                  className="h-6.5 bg-white border border-slate-300 hover:border-slate-400 rounded-md px-1.5 text-[11px] font-sans text-slate-800 outline-none shadow-2xs transition-colors"
                  title="Text Sizing Mode"
                >
                  <option value="scale-text" title="Corners scale font and geometry proportionally. Edges resize the container without stretching glyphs.">Scale Text</option>
                  <option value="auto-width" title="Font size controls measured content bounds.">Auto Size to Content</option>
                  <option value="fixed-width" title="Resize the container while keeping font size unchanged.">Fixed Width / Wrap</option>
                  <option value="shrink-to-fit" title="Reduce font size only when content exceeds the container.">Shrink to Fit</option>
                  <option value="fit-to-box" title="Fit font size to the container within configured limits.">Fit Text to Box</option>
                </select>
              </div>
            )}

            <Divider />

            {/* Color 'A' */}
            <label className="h-6.5 px-2 rounded-md flex flex-col items-center justify-center hover:bg-slate-200/80 cursor-pointer border border-slate-300/80 bg-white/80 transition-colors" title="Font Color">
              <span className="font-serif font-bold text-xs leading-none text-slate-900">A</span>
              <span
                className="w-4 h-1 rounded-full mt-0.5"
                style={{ backgroundColor: activeFontColor }}
              />
              <input
                type="color"
                value={activeFontColor}
                onChange={(e) => {
                  if (props.onUpdateSelectedElement) {
                    props.onUpdateSelectedElement({ color: e.target.value } as any);
                  }
                }}
                className="sr-only"
              />
            </label>

            {/* Highlight 'ab' */}
            <label className="h-6.5 px-2 rounded-md flex flex-col items-center justify-center hover:bg-slate-200/80 cursor-pointer border border-slate-300/80 bg-white/80 transition-colors" title="Object / Background Fill">
              <span className="font-sans font-bold text-[10px] leading-none text-slate-800">ab</span>
              <span
                className="w-4 h-1 rounded-full mt-0.5"
                style={{ backgroundColor: activeBgColor }}
              />
              <input
                type="color"
                value={activeBgColor}
                onChange={(e) => {
                  if (props.onUpdateSelectedElement) {
                    props.onUpdateSelectedElement({ backgroundColor: e.target.value, fillColor: e.target.value } as any);
                  }
                }}
                className="sr-only"
              />
            </label>

            <Divider />

            {/* Text format and paragraph alignment */}
            <ToolBtn
              icon={<Minus className="w-3.5 h-3.5" />}
              active={singleLineValues.length > 0 && singleLineValues.every(Boolean)}
              mixed={singleLineMixed}
              disabled={!editableTextSelection || isRichTextSelection}
              title={isRichTextSelection
                ? 'Single Line is unavailable for rich-text objects; use the rich-text editor.'
                : 'Single Line text format'}
              onClick={setSingleLineText}
            />
            <ToolBtn
              icon={<AlignLeft className="w-3.5 h-3.5" />}
              active={selectedTextAlignment === 'left'}
              mixed={textAlignmentMixed}
              disabled={!editableTextSelection || isRichTextSelection}
              title="Align Left"
              onClick={() => setTextAlignment('left')}
            />
            <ToolBtn
              icon={<AlignCenter className="w-3.5 h-3.5" />}
              active={selectedTextAlignment === 'center'}
              mixed={textAlignmentMixed}
              disabled={!editableTextSelection || isRichTextSelection}
              title="Align Center"
              onClick={() => setTextAlignment('center')}
            />
            <ToolBtn
              icon={<AlignRight className="w-3.5 h-3.5" />}
              active={selectedTextAlignment === 'right'}
              mixed={textAlignmentMixed}
              disabled={!editableTextSelection || isRichTextSelection}
              title="Align Right"
              onClick={() => setTextAlignment('right')}
            />
            <ToolBtn
              icon={<AlignJustify className="w-3.5 h-3.5" />}
              active={selectedTextAlignment === 'justify'}
              mixed={textAlignmentMixed}
              disabled={!editableTextSelection || isRichTextSelection || !paragraphTextSelection}
              title={!paragraphTextSelection
                ? 'Justify paragraphs (select only plain paragraph text objects).'
                : 'Justify: distribute spaces between words; final lines use Orphan Alignment.'}
              onClick={() => setTextAlignment('justify')}
            />
            <ToolBtn
              icon={<DistributedTextIcon />}
              active={selectedTextAlignment === 'distributed'}
              mixed={textAlignmentMixed}
              disabled={!editableTextSelection || isRichTextSelection || !paragraphTextSelection}
              title={!paragraphTextSelection
                ? 'Distributed alignment (select only plain paragraph text objects).'
                : 'Distributed: space characters across each line; single-word orphans use Orphan Alignment.'}
              onClick={() => setTextAlignment('distributed')}
            />
            <ToolBtn
              icon={<ArcTextIcon direction="clockwise" />}
              active={selectedArcDirection === 'clockwise'}
              mixed={arcDirectionMixed}
              disabled={!editableTextSelection || isRichTextSelection || !arcTextSelection}
              title={arcTextSelection ? 'Arc Text Direction: Clockwise' : 'Arc direction is available only for Arc text objects.'}
              onClick={() => setArcDirection('clockwise')}
            />
            <ToolBtn
              icon={<ArcTextIcon direction="counter-clockwise" />}
              active={selectedArcDirection === 'counter-clockwise'}
              mixed={arcDirectionMixed}
              disabled={!editableTextSelection || isRichTextSelection || !arcTextSelection}
              title={arcTextSelection ? 'Arc Text Direction: Counterclockwise' : 'Arc direction is available only for Arc text objects.'}
              onClick={() => setArcDirection('counter-clockwise')}
            />
            {paragraphTextSelection && (
              <div className="flex items-center gap-1">
                <span className="text-slate-500 text-[10px] font-medium">Orphan:</span>
                <select
                  aria-label="Orphan alignment"
                  title="Alignment of final and explicit-break paragraph lines"
                  value={selectedOrphanAlignment}
                  onChange={event => {
                    if (event.target.value !== 'mixed') {
                      setOrphanAlignment(event.target.value as 'left' | 'center' | 'right');
                    }
                  }}
                  disabled={!editableTextSelection || isRichTextSelection}
                  className="h-6.5 bg-white border border-slate-300 hover:border-slate-400 rounded-md px-1 text-[11px] font-sans text-slate-800 outline-none shadow-2xs transition-colors disabled:opacity-40"
                >
                  {orphanAlignmentMixed && <option value="mixed" disabled>Mixed</option>}
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            )}

            {/* MULTI-LINE CONTROLS: Wrap, Line Height, Vertical Align, Overflow */}
            {(selectedTextEl.textType === 'multi-line' || selectedTextEl.multiline || selectedTextEl.textFormatType === 'paragraph') && (
              <>
                <Divider />

                {/* Wrap toggle */}
                <ToolFormatBtn
                  icon={<WrapText className="w-3.5 h-3.5" />}
                  active={selectedTextEl.wrap !== false}
                  title={selectedTextEl.wrap !== false ? 'Word Wrap: ON' : 'Word Wrap: OFF'}
                  onClick={() => {
                    if (props.onUpdateSelectedElement && selectedTextEl) {
                      const nextWrap = !(selectedTextEl.wrap !== false);
                      props.onUpdateSelectedElement({ wrap: nextWrap, wordWrap: nextWrap } as any);
                    }
                  }}
                />

                {/* Line Height / Spacing */}
                <div className="flex items-center gap-1">
                  <span className="text-slate-500 text-[10.5px] font-medium">Spacing:</span>
                  <select
                    value={String(selectedTextEl.lineHeight || 1.15)}
                    onChange={(e) => {
                      if (props.onUpdateSelectedElement) {
                        props.onUpdateSelectedElement({ lineHeight: Number(e.target.value) } as any);
                      }
                    }}
                    className="h-6.5 bg-white border border-slate-300 hover:border-slate-400 rounded-md px-1 text-[11px] font-sans text-slate-800 outline-none shadow-2xs transition-colors"
                    title="Line Spacing (Height)"
                  >
                    <option value="1">1.0</option>
                    <option value="1.15">1.15</option>
                    <option value="1.2">1.2</option>
                    <option value="1.5">1.5</option>
                    <option value="2">2.0</option>
                  </select>
                </div>

                {/* Vertical Alignment */}
                <div className="flex items-center gap-0.5 border border-slate-300 rounded-md p-0.5 bg-white shadow-2xs">
                  <button
                    type="button"
                    title="Align Top"
                    onClick={() => {
                      if (props.onUpdateSelectedElement) {
                        props.onUpdateSelectedElement({ verticalAlign: 'top', verticalAlignment: 'top' } as any);
                      }
                    }}
                    className={`h-5 px-1.5 rounded text-[10.5px] font-semibold transition-colors cursor-pointer ${
                      (selectedTextEl.verticalAlign || 'top') === 'top'
                        ? 'bg-blue-100 text-blue-800 font-bold'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Top
                  </button>
                  <button
                    type="button"
                    title="Align Middle"
                    onClick={() => {
                      if (props.onUpdateSelectedElement) {
                        props.onUpdateSelectedElement({ verticalAlign: 'middle', verticalAlignment: 'middle' } as any);
                      }
                    }}
                    className={`h-5 px-1.5 rounded text-[10.5px] font-semibold transition-colors cursor-pointer ${
                      selectedTextEl.verticalAlign === 'middle' || (selectedTextEl.verticalAlign as any) === 'center'
                        ? 'bg-blue-100 text-blue-800 font-bold'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Mid
                  </button>
                  <button
                    type="button"
                    title="Align Bottom"
                    onClick={() => {
                      if (props.onUpdateSelectedElement) {
                        props.onUpdateSelectedElement({ verticalAlign: 'bottom', verticalAlignment: 'bottom' } as any);
                      }
                    }}
                    className={`h-5 px-1.5 rounded text-[10.5px] font-semibold transition-colors cursor-pointer ${
                      selectedTextEl.verticalAlign === 'bottom'
                        ? 'bg-blue-100 text-blue-800 font-bold'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Bot
                  </button>
                </div>

                {/* Overflow Behavior */}
                <div className="flex items-center gap-1">
                  <span className="text-slate-500 text-[10.5px] font-medium">Overflow:</span>
                  <select
                    value={selectedTextEl.overflow || 'hidden'}
                    onChange={(e) => {
                      if (props.onUpdateSelectedElement) {
                        props.onUpdateSelectedElement({ overflow: e.target.value as any } as any);
                      }
                    }}
                    className="h-6.5 bg-white border border-slate-300 hover:border-slate-400 rounded-md px-1 text-[11px] font-sans text-slate-800 outline-none shadow-2xs transition-colors"
                    title="Text Overflow Behavior"
                  >
                    <option value="hidden">Clip</option>
                    <option value="visible">Visible</option>
                  </select>
                </div>
              </>
            )}

            <Divider />

            {/* Rotation */}
            <ToolBtn icon={<RotateCcw className="w-3.5 h-3.5" />} title="Rotate 90° CCW" onClick={() => {
              if (props.onUpdateSelectedElement) {
                props.onUpdateSelectedElement({ rotation: ((primaryEl.rotation || 0) - 90 + 360) % 360 });
              }
            }} />
            <ToolBtn icon={<RotateCw className="w-3.5 h-3.5" />} title="Rotate 90° CW" onClick={() => {
              if (props.onUpdateSelectedElement) {
                props.onUpdateSelectedElement({ rotation: ((primaryEl.rotation || 0) + 90) % 360 });
              }
            }} />

            {(props.onOpenTextProperties || props.onOpenProperties) && (
              <button
                onClick={props.onOpenTextProperties || props.onOpenProperties}
                className="h-6.5 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer ml-auto transition-colors"
                title="Text Properties Dialog (F8)"
              >
                <Sliders className="w-3.5 h-3.5 text-white" />
                <span>Text Properties...</span>
              </button>
            )}
          </>
        ) : selectedImageEl ? (
          <>
            {/* IMAGE ELEMENT SELECTED */}
            <div className="flex items-center gap-1 font-semibold text-emerald-900">
              <ImageIcon className="w-4 h-4 text-emerald-600" />
              <span>Image ({selectedImageEl.name || 'Graphic'}):</span>
            </div>

            <button
              type="button"
              onClick={props.onInsertImage}
              className="px-2.5 py-1 bg-white hover:bg-emerald-50 border border-slate-300 hover:border-emerald-400 rounded-md text-xs font-semibold text-slate-700 cursor-pointer shadow-2xs transition-colors"
              title="Replace / Choose New Image File..."
            >
              Change File...
            </button>

            <Divider />

            {/* Grayscale Toggle */}
            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700 select-none">
              <input
                type="checkbox"
                checked={!!selectedImageEl.grayscale}
                onChange={(e) => {
                  if (props.onUpdateSelectedElement) {
                    props.onUpdateSelectedElement({ grayscale: e.target.checked });
                  }
                }}
                className="rounded text-emerald-600 focus:ring-0 w-3.5 h-3.5 accent-emerald-600"
              />
              <span>Grayscale</span>
            </label>

            {/* Invert Toggle */}
            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700 select-none ml-2">
              <input
                type="checkbox"
                checked={!!selectedImageEl.invert}
                onChange={(e) => {
                  if (props.onUpdateSelectedElement) {
                    props.onUpdateSelectedElement({ invert: e.target.checked });
                  }
                }}
                className="rounded text-emerald-600 focus:ring-0 w-3.5 h-3.5 accent-emerald-600"
              />
              <span>Invert</span>
            </label>

            <Divider />

            <ToolBtn
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              title="Rotate 90° CCW"
              onClick={() => {
                if (props.onUpdateSelectedElement) {
                  props.onUpdateSelectedElement({ rotation: ((selectedImageEl.rotation || 0) - 90 + 360) % 360 });
                }
              }}
            />
            <ToolBtn
              icon={<RotateCw className="w-3.5 h-3.5" />}
              title="Rotate 90° CW"
              onClick={() => {
                if (props.onUpdateSelectedElement) {
                  props.onUpdateSelectedElement({ rotation: ((selectedImageEl.rotation || 0) + 90) % 360 });
                }
              }}
            />
          </>
        ) : selectedTableEl ? (
          <>
            {/* TABLE ELEMENT SELECTED */}
            <div className="flex items-center gap-1 font-semibold text-slate-900">
              <TableIcon className="w-4 h-4 text-indigo-600" />
              <span>Specification Table:</span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-700">
              <span className="font-medium">Grid:</span>
              <span className="bg-white border border-slate-300 px-2 py-0.5 rounded-md font-mono font-bold text-xs">
                {selectedTableEl.rows || 3}R × {selectedTableEl.cols || 3}C
              </span>
            </div>

            <Divider />

            <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
              <span className="font-medium">Border:</span>
              <input
                type="color"
                value={selectedTableEl.borderColor || '#000000'}
                onChange={(e) => {
                  if (props.onUpdateSelectedElement) {
                    props.onUpdateSelectedElement({ borderColor: e.target.value });
                  }
                }}
                className="w-6 h-5 border border-slate-300 rounded cursor-pointer"
              />
            </label>

            <Divider />

            <ToolBtn
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              title="Rotate 90° CCW"
              onClick={() => {
                if (props.onUpdateSelectedElement) {
                  props.onUpdateSelectedElement({ rotation: ((selectedTableEl.rotation || 0) - 90 + 360) % 360 });
                }
              }}
            />
            <ToolBtn
              icon={<RotateCw className="w-3.5 h-3.5" />}
              title="Rotate 90° CW"
              onClick={() => {
                if (props.onUpdateSelectedElement) {
                  props.onUpdateSelectedElement({ rotation: ((selectedTableEl.rotation || 0) + 90) % 360 });
                }
              }}
            />
          </>
        ) : hasSelection && primaryEl ? (
          <>
            {/* GENERIC SELECTED ELEMENT */}
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-900 text-xs">
                {primaryEl.name || primaryEl.type.toUpperCase()}:
              </span>
              <span className="bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-md text-[10.5px] font-bold uppercase tracking-wider">
                {primaryEl.type}
              </span>
            </div>

            <Divider />

            <span className="text-xs text-slate-600 font-mono">
              W: {currentW}mm | H: {currentH}mm | X: {currentX}mm | Y: {currentY}mm
            </span>

            <Divider />

            <ToolBtn
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              title="Rotate 90° CCW"
              onClick={() => {
                if (props.onUpdateSelectedElement) {
                  props.onUpdateSelectedElement({ rotation: ((primaryEl.rotation || 0) - 90 + 360) % 360 });
                }
              }}
            />
            <ToolBtn
              icon={<RotateCw className="w-3.5 h-3.5" />}
              title="Rotate 90° CW"
              onClick={() => {
                if (props.onUpdateSelectedElement) {
                  props.onUpdateSelectedElement({ rotation: ((primaryEl.rotation || 0) + 90) % 360 });
                }
              }}
            />
          </>
        ) : (
          <>
            {/* NO ELEMENT SELECTED: FULL DEFAULT FORMATTING TOOLBAR & LABEL STOCK */}
            {/* Font Family Dropdown */}
            <select
              value={currentFont}
              onChange={(e) => handleFontChange(e.target.value)}
              className="h-6.5 bg-white border border-slate-300 hover:border-slate-400 rounded-md px-2 text-xs font-sans text-slate-800 outline-none w-36 shadow-2xs transition-colors"
              title="Font Family"
            >
              {fonts.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>

            {/* Font Size Combobox */}
            <FontSizeComboBox
              value={currentFontSize}
              onChange={handleSizeChange}
              title="Font Size"
            />

            <Divider />

            {/* B, I, U buttons */}
            <ToolFormatBtn icon={<Bold className="w-3.5 h-3.5" />} active={false} title="Bold" bold onClick={() => {}} />
            <ToolFormatBtn icon={<Italic className="w-3.5 h-3.5" />} active={false} title="Italic" italic onClick={() => {}} />
            <ToolFormatBtn icon={<Underline className="w-3.5 h-3.5" />} active={false} title="Underline" underline onClick={() => {}} />

            <Divider />

            {/* Color 'A' */}
            <label className="h-6.5 px-2 rounded-md flex flex-col items-center justify-center hover:bg-slate-200/80 cursor-pointer border border-slate-300/80 bg-white/80 transition-colors" title="Font Color">
              <span className="font-serif font-bold text-xs leading-none text-slate-900">A</span>
              <span className="w-4 h-1 bg-red-600 rounded-full mt-0.5" />
              <input
                type="color"
                value={activeFontColor}
                onChange={(e) => {
                  if (props.onUpdateSelectedElement) {
                    props.onUpdateSelectedElement({ color: e.target.value } as any);
                  }
                }}
                className="sr-only"
              />
            </label>

            {/* Highlight 'ab' */}
            <label className="h-6.5 px-2 rounded-md flex flex-col items-center justify-center hover:bg-slate-200/80 cursor-pointer border border-slate-300/80 bg-white/80 transition-colors" title="Highlight / Fill Color">
              <span className="font-sans font-bold text-[10px] leading-none text-slate-800">ab</span>
              <span className="w-4 h-1 bg-yellow-400 rounded-full mt-0.5" />
              <input
                type="color"
                value={activeBgColor}
                onChange={(e) => {
                  if (props.onUpdateSelectedElement) {
                    props.onUpdateSelectedElement({ backgroundColor: e.target.value, fillColor: e.target.value } as any);
                  }
                }}
                className="sr-only"
              />
            </label>

            <Divider />

            {/* Alignments */}
            <ToolBtn icon={<AlignLeft className="w-3.5 h-3.5" />} title="Align Left" onClick={() => {}} />
            <ToolBtn icon={<AlignCenter className="w-3.5 h-3.5" />} title="Align Center" onClick={() => {}} />
            <ToolBtn icon={<AlignRight className="w-3.5 h-3.5" />} title="Align Right" onClick={() => {}} />
            <ToolBtn icon={<AlignJustify className="w-3.5 h-3.5" />} title="Justify" onClick={() => {}} />

            <Divider />

            {/* Quick Label Stock Presets */}
            <span className="font-semibold text-slate-600 text-xs shrink-0">Stock:</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  handleWidthChange(100);
                  handleHeightChange(60);
                }}
                className="px-2 py-1 bg-white hover:bg-blue-50 border border-slate-300 hover:border-blue-300 rounded-md text-[11px] font-semibold text-slate-700 cursor-pointer shadow-2xs transition-colors"
                title="Set Label to 100 x 60 mm (Standard Shipping)"
              >
                100×60 mm
              </button>
              <button
                type="button"
                onClick={() => {
                  handleWidthChange(101.6);
                  handleHeightChange(152.4);
                }}
                className="px-2 py-1 bg-white hover:bg-blue-50 border border-slate-300 hover:border-blue-300 rounded-md text-[11px] font-semibold text-slate-700 cursor-pointer shadow-2xs transition-colors"
                title="Set Label to 4x6 inch (101.6 x 152.4 mm)"
              >
                4×6″
              </button>
              <button
                type="button"
                onClick={() => {
                  handleWidthChange(50);
                  handleHeightChange(25);
                }}
                className="px-2 py-1 bg-white hover:bg-blue-50 border border-slate-300 hover:border-blue-300 rounded-md text-[11px] font-semibold text-slate-700 cursor-pointer shadow-2xs transition-colors"
                title="Set Label to 50 x 25 mm (Asset Tag)"
              >
                50×25 mm
              </button>
              <button
                type="button"
                onClick={() => {
                  handleWidthChange(75);
                  handleHeightChange(50);
                }}
                className="px-2 py-1 bg-white hover:bg-blue-50 border border-slate-300 hover:border-blue-300 rounded-md text-[11px] font-semibold text-slate-700 cursor-pointer shadow-2xs transition-colors"
                title="Set Label to 75 x 50 mm"
              >
                75×50 mm
              </button>
            </div>
          </>
        )}
      </div>

      {/* ROW 3: DOCUMENT TAB BAR (e.g. Document1.btw *) */}
      <div className="flex items-center h-6.5 bg-slate-200/90 px-1.5 border-b border-slate-300 overflow-x-auto no-scrollbar shrink-0 whitespace-nowrap">
        <div className="flex items-center gap-1.5 bg-white border-t-2 border-t-amber-500 border-x border-slate-300 px-3 py-0.5 rounded-t-sm text-[11.5px] font-medium text-slate-900 shadow-2xs">
          <span>{props.documentName || 'Document1.btw *'}</span>
          <button className="p-0.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-800 transition-colors cursor-pointer">
            <X className="w-3 h-3" />
          </button>
        </div>

        <button
          title="New Label Document Tab"
          onClick={props.onNew}
          className="ml-1 p-1 hover:bg-slate-300/80 rounded-sm text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

const ToolBtn: React.FC<{
  icon: React.ReactNode;
  title: string;
  disabled?: boolean;
  active?: boolean;
  mixed?: boolean;
  onClick: () => void;
}> = ({ icon, title, disabled, active, mixed, onClick }) => {
  return (
    <button
      title={title}
      disabled={disabled}
      aria-pressed={mixed ? 'mixed' : !!active}
      data-mixed={mixed || undefined}
      onClick={onClick}
      className={`h-6.5 min-w-[26px] px-1.5 rounded-md flex items-center justify-center transition-all shrink-0 cursor-pointer ${
        disabled
          ? 'opacity-30 cursor-not-allowed'
          : active
          ? 'bg-blue-100 text-blue-700 border border-blue-300 shadow-2xs font-semibold'
          : mixed
          ? 'bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs'
          : 'hover:bg-slate-200/80 active:bg-slate-300/80 text-slate-700 border border-transparent'
      }`}
    >
      {icon}
    </button>
  );
};

const DistributedTextIcon: React.FC = () => (
  <svg aria-hidden="true" viewBox="0 0 20 16" className="w-4 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M1 5h18M1 9h18M1 13h18M3 1H1v2m16-2h2v2" />
  </svg>
);

const ArcTextIcon: React.FC<{ direction: 'clockwise' | 'counter-clockwise' }> = ({ direction }) => {
  const id = direction === 'clockwise' ? 'toolbar-arc-clockwise' : 'toolbar-arc-counter-clockwise';
  const path = direction === 'clockwise' ? 'M1 15 Q10 0 19 15' : 'M1 3 Q10 18 19 3';
  return (
    <svg aria-hidden="true" viewBox="0 0 20 18" className="w-4 h-3.5">
      <defs><path id={id} d={path} /></defs>
      <text fontFamily="Arial, sans-serif" fontSize="6.5" fill="currentColor">
        <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">ABC</textPath>
      </text>
    </svg>
  );
};

const ToolToggle: React.FC<{
  icon: React.ReactNode;
  title: string;
  active: boolean;
  onClick: () => void;
}> = ({ icon, title, active, onClick }) => {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`h-6.5 min-w-[26px] px-1.5 rounded-md flex items-center justify-center transition-all shrink-0 cursor-pointer ${
        active
          ? 'bg-blue-100 text-blue-700 border border-blue-300 shadow-2xs font-medium'
          : 'hover:bg-slate-200/80 active:bg-slate-300/80 text-slate-600 border border-transparent'
      }`}
    >
      {icon}
    </button>
  );
};

const ToolFormatBtn: React.FC<{
  label?: string;
  icon?: React.ReactNode;
  title: string;
  active: boolean;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  onClick: () => void;
}> = ({ label, icon, title, active, bold, italic, underline, onClick }) => {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`h-6 min-w-[26px] px-1.5 rounded-md flex items-center justify-center text-xs transition-all shrink-0 cursor-pointer ${
        active
          ? 'bg-blue-600 text-white font-bold shadow-2xs border border-blue-600'
          : 'hover:bg-slate-200/80 active:bg-slate-300/80 text-slate-700 bg-white/80 border border-slate-300/80'
      } ${bold ? 'font-bold' : ''} ${italic ? 'italic' : ''} ${underline ? 'underline' : ''}`}
    >
      {icon || label}
    </button>
  );
};

const DropdownItem: React.FC<{
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
}> = ({ icon, label, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-blue-50 text-slate-800 text-[11.5px] rounded-sm transition-colors cursor-pointer"
    >
      {icon && <span className="text-slate-600 shrink-0">{icon}</span>}
      <span className="font-medium">{label}</span>
    </button>
  );
};

const Divider: React.FC = () => <div className="w-px h-4.5 bg-slate-300/80 mx-1 shrink-0" />;
