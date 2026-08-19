import React, { useState } from 'react';
import {
  FileText,
  FolderOpen,
  Save,
  Printer,
  Scissors,
  Copy,
  Clipboard,
  Trash2,
  Undo2,
  Redo2,
  MousePointer,
  Type,
  Barcode,
  Image as ImageIcon,
  Square,
  Circle,
  Slash,
  Radio,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
  Ruler,
  Magnet,
  ChevronDown,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  RotateCcw,
  RotateCw,
  Sliders,
  X,
  Plus,
  Baseline,
  Highlighter,
  WrapText,
  ShieldCheck,
  Table as TableIcon,
} from 'lucide-react';
import { BarcodeSymbology, LabelElement, TextElement, TextObjectType, BarcodeElement, ShapeElement } from '../../types';

interface ObjectToolbarProps {
  activeTool: 'select' | 'text' | 'barcode' | 'qr' | 'datamatrix' | 'rect' | 'circle' | 'line' | 'table' | 'image';
  setActiveTool: (tool: any) => void;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onPrint: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete?: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
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
  showGrid: boolean;
  onToggleGrid: () => void;
  showRulers: boolean;
  onToggleRulers: () => void;
  showGuides: boolean;
  onToggleGuides: () => void;
  snapToGrid: boolean;
  onToggleSnap: () => void;
  onOpenBarcodeProperties?: () => void;
  // Formatting Props for active selected element
  selectedElement?: LabelElement | null;
  onUpdateSelectedElement?: (updates: Partial<LabelElement>) => void;
  templateDimensions?: { width: number; height: number };
  onUpdateTemplateDimensions?: (dims: { width?: number; height?: number }) => void;
  // Document Tab
  documentName?: string;
}

export const ObjectToolbar: React.FC<ObjectToolbarProps> = (props) => {
  const [barcodeDropdownOpen, setBarcodeDropdownOpen] = useState(false);
  const [textDropdownOpen, setTextDropdownOpen] = useState(false);
  const [shapeDropdownOpen, setShapeDropdownOpen] = useState(false);
  const [fontColor, setFontColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');

  const selectedTextEl = props.selectedElement?.type === 'text' ? (props.selectedElement as TextElement) : null;
  const selectedBarcodeEl = props.selectedElement?.type === 'barcode' ? (props.selectedElement as BarcodeElement) : null;
  const selectedShapeEl = props.selectedElement?.type === 'shape' ? (props.selectedElement as ShapeElement) : null;

  const currentFont = selectedTextEl?.fontFamily || 'Arial';
  const currentFontSize = selectedTextEl?.fontSize || 12;
  const isBold = selectedTextEl?.fontWeight === 'bold';
  const isItalic = selectedTextEl?.fontStyle === 'italic';
  const isUnderline = selectedTextEl?.textDecoration === 'underline';
  const textAlign = selectedTextEl?.textAlign || 'left';

  // Dimension & Position Values
  const currentW = props.selectedElement
    ? Number(props.selectedElement.width.toFixed(1))
    : props.templateDimensions?.width || 100;
  const currentH = props.selectedElement
    ? Number(props.selectedElement.height.toFixed(1))
    : props.templateDimensions?.height || 60;
  const currentX = props.selectedElement
    ? Number(props.selectedElement.x.toFixed(1))
    : 0;
  const currentY = props.selectedElement
    ? Number(props.selectedElement.y.toFixed(1))
    : 0;

  const handleWidthChange = (newVal: number) => {
    const val = Math.max(1, Number(newVal));
    if (props.selectedElement && props.onUpdateSelectedElement) {
      props.onUpdateSelectedElement({ width: val });
    } else if (props.onUpdateTemplateDimensions) {
      props.onUpdateTemplateDimensions({ width: val });
    }
  };

  const handleHeightChange = (newVal: number) => {
    const val = Math.max(1, Number(newVal));
    if (props.selectedElement && props.onUpdateSelectedElement) {
      props.onUpdateSelectedElement({ height: val });
    } else if (props.onUpdateTemplateDimensions) {
      props.onUpdateTemplateDimensions({ height: val });
    }
  };

  const handleXChange = (newVal: number) => {
    const val = Number(newVal);
    if (props.selectedElement && props.onUpdateSelectedElement) {
      props.onUpdateSelectedElement({ x: val });
    }
  };

  const handleYChange = (newVal: number) => {
    const val = Number(newVal);
    if (props.selectedElement && props.onUpdateSelectedElement) {
      props.onUpdateSelectedElement({ y: val });
    }
  };

  const fonts = [
    'Arial',
    'Helvetica',
    'Times New Roman',
    'Courier New',
    'Verdana',
    'Georgia',
    'Trebuchet MS',
    'Impact',
    'OCR-A',
    'OCR-B',
  ];

  const fontSizes = [6, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72];

  const handleFontChange = (newFont: string) => {
    if (props.selectedElement && props.onUpdateSelectedElement) {
      props.onUpdateSelectedElement({ fontFamily: newFont } as any);
    }
  };

  const handleSizeChange = (newSize: number) => {
    if (props.selectedElement && props.onUpdateSelectedElement) {
      props.onUpdateSelectedElement({ fontSize: newSize } as any);
    }
  };

  const toggleBold = () => {
    if (props.selectedElement && props.onUpdateSelectedElement) {
      props.onUpdateSelectedElement({ fontWeight: isBold ? 'normal' : 'bold' } as any);
    }
  };

  const toggleItalic = () => {
    if (props.selectedElement && props.onUpdateSelectedElement) {
      props.onUpdateSelectedElement({ fontStyle: isItalic ? 'normal' : 'italic' } as any);
    }
  };

  const toggleUnderline = () => {
    if (props.selectedElement && props.onUpdateSelectedElement) {
      props.onUpdateSelectedElement({ textDecoration: isUnderline ? 'none' : 'underline' } as any);
    }
  };

  const handleAlign = (align: 'left' | 'center' | 'right' | 'justify') => {
    if (props.selectedElement && props.onUpdateSelectedElement) {
      props.onUpdateSelectedElement({ textAlign: align } as any);
    }
  };

  return (
    <div className="flex flex-col select-none bg-[#f0f2f5] border-b border-[#cbd5e1] text-slate-800 text-xs">
      {/* ROW 1: STANDARD & CREATION TOOLBAR */}
      <div className="flex items-center gap-0.5 h-8 px-1.5 border-b border-[#e2e8f0]">
        {/* Standard File/Edit Buttons */}
        <ToolBtn icon={<FileText className="w-4 h-4 text-blue-600" />} title="New Document (Ctrl+N)" onClick={props.onNew} />
        <ToolBtn icon={<FolderOpen className="w-4 h-4 text-amber-500" />} title="Open Document (Ctrl+O)" onClick={props.onOpen} />

        <Divider />

        <ToolBtn icon={<Scissors className="w-4 h-4 text-slate-700" />} title="Cut Selected (Ctrl+X / Esko Cut)" onClick={props.onCut} />
        <ToolBtn icon={<Copy className="w-4 h-4 text-slate-700" />} title="Copy Selected (Ctrl+C)" onClick={props.onCopy} />
        <ToolBtn icon={<Clipboard className="w-4 h-4 text-amber-600" />} title="Paste (Ctrl+V)" onClick={props.onPaste} />
        {props.onDelete && (
          <ToolBtn icon={<Trash2 className="w-4 h-4 text-red-600" />} title="Delete / Remove Selected (Del / Backspace)" onClick={props.onDelete} />
        )}
        <ToolBtn icon={<Undo2 className="w-4 h-4 text-blue-600" />} title="Undo (Ctrl+Z)" disabled={!props.canUndo} onClick={props.onUndo} />
        <ToolBtn icon={<Redo2 className="w-4 h-4 text-blue-600" />} title="Redo (Ctrl+Y)" disabled={!props.canRedo} onClick={props.onRedo} />

        <Divider />

        {/* POINTER ARROW (Active yellow highlight just like BarTender) */}
        <button
          title="Pointer / Select Tool (V)"
          onClick={() => props.setActiveTool('select')}
          className={`h-6 px-1.5 rounded-xs flex items-center justify-center border transition-all ${
            props.activeTool === 'select'
              ? 'bg-[#fef08a] border-[#eab308] shadow-xs text-amber-900'
              : 'hover:bg-[#e2e8f0] border-transparent text-slate-700'
          }`}
        >
          {/* Classic Yellow Pointer Arrow SVG */}
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
            <path d="M4 2l12 12-5.5 1.5 3.5 6.5-2.5 1-3.5-6.5L4 20V2z" />
          </svg>
        </button>

        <Divider />

        {/* Text Tool - Insertion Beam */}
        <button
          title="Text Insertion Tool (T)"
          onClick={props.onInsertText}
          className="h-6 px-1.5 rounded-xs flex items-center hover:bg-[#e2e8f0] text-slate-800"
        >
          <span className="font-serif font-bold text-sm tracking-tighter">I</span>
        </button>

        {/* Barcode Tool (|||| 123 with dropdown) */}
        <div className="relative flex items-center">
          <button
            title="Insert Barcode (B)"
            onClick={() => setBarcodeDropdownOpen(!barcodeDropdownOpen)}
            className={`h-6 px-1.5 rounded-l-xs flex items-center gap-1 border transition-all ${
              barcodeDropdownOpen
                ? 'bg-[#fef08a] border-[#eab308] shadow-xs text-amber-950'
                : 'hover:bg-[#e2e8f0] border-transparent text-slate-900'
            }`}
          >
            <div className="flex items-center gap-0.5">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                <path d="M2 5h2v14H2V5zm3 0h1v14H5V5zm3 0h2v14H8V5zm4 0h3v14h-3V5zm5 0h1v14h-1V5zm3 0h1v14h-1V5z" />
              </svg>
              <span className="text-[10px] font-mono font-bold">123</span>
            </div>
          </button>
          <button
            title="Choose Barcode Symbology..."
            onClick={() => setBarcodeDropdownOpen(!barcodeDropdownOpen)}
            className={`h-6 px-1 rounded-r-xs border-y border-r transition-all ${
              barcodeDropdownOpen
                ? 'bg-[#fef08a] border-[#eab308] text-amber-950'
                : 'hover:bg-[#e2e8f0] border-transparent text-slate-600 border-l border-slate-300'
            }`}
          >
            <ChevronDown className="w-3 h-3" />
          </button>

          {/* Classic BarTender Barcode Dropdown matching Screenshot */}
          {barcodeDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setBarcodeDropdownOpen(false)}
              />
              <div className="absolute left-0 top-full mt-0.5 w-48 bg-white border border-[#94a3b8] shadow-xl py-0.5 z-50 text-[11.5px] rounded-xs">
                {/* Header: Recently Used Barcodes */}
                <div className="px-3 py-1 font-bold text-slate-800 text-[11px] select-none">
                  Recently Used Barcodes
                </div>

                <button
                  onClick={() => {
                    props.onInsertBarcode('posicode-b');
                    setBarcodeDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-[#cce0f5] text-slate-800 hover:text-slate-900"
                >
                  PosiCode B
                </button>

                <button
                  onClick={() => {
                    props.onInsertBarcode('code128');
                    setBarcodeDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-[#cce0f5] text-slate-800 hover:text-slate-900"
                >
                  Code 128
                </button>

                <button
                  onClick={() => {
                    props.onInsertBarcode('datamatrix');
                    setBarcodeDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-[#cce0f5] text-slate-800 hover:text-slate-900"
                >
                  Data Matrix
                </button>

                <div className="h-px bg-[#cbd5e1] my-0.5" />

                {/* More Barcodes... with yellow highlight on hover just like screenshot */}
                <button
                  onClick={() => {
                    setBarcodeDropdownOpen(false);
                    props.onOpenBarcodePicker();
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-[#fef08a] hover:text-amber-950 text-slate-800 transition-colors"
                >
                  More Barcodes...
                </button>

                {props.onOpenBarcodeProperties && (
                  <button
                    onClick={() => {
                      setBarcodeDropdownOpen(false);
                      props.onOpenBarcodeProperties?.();
                    }}
                    className="w-full text-left px-3 py-1 hover:bg-[#cce0f5] text-blue-900 transition-colors font-medium flex items-center justify-between border-t border-slate-100"
                  >
                    <span>Barcode Properties...</span>
                    <span className="text-[9px] text-slate-500 font-mono">F12</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Text Objects Tool (A ▾ with dropdown matching screenshot) */}
        <div className="relative flex items-center">
          <button
            title="Insert Text Object (T)"
            onClick={() => setTextDropdownOpen(!textDropdownOpen)}
            className={`h-6 px-1.5 rounded-l-xs flex items-center gap-0.5 border transition-all font-serif font-bold text-[13px] ${
              textDropdownOpen
                ? 'bg-[#fef08a] border-[#eab308] shadow-xs text-amber-950'
                : 'hover:bg-[#e2e8f0] border-transparent text-slate-900'
            }`}
          >
            A
          </button>
          <button
            title="Text Object Types & Markup Containers..."
            onClick={() => setTextDropdownOpen(!textDropdownOpen)}
            className={`h-6 px-1 rounded-r-xs border-y border-r transition-all ${
              textDropdownOpen
                ? 'bg-[#fef08a] border-[#eab308] text-amber-950'
                : 'hover:bg-[#e2e8f0] border-transparent text-slate-600 border-l border-slate-300'
            }`}
          >
            <ChevronDown className="w-3 h-3" />
          </button>

          {/* Classic BarTender Text Objects & Markup Containers Dropdown */}
          {textDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setTextDropdownOpen(false)}
              />
              <div className="absolute left-0 top-full mt-0.5 w-60 bg-white border border-[#94a3b8] shadow-xl py-0.5 z-50 text-[11.5px] rounded-xs select-none">
                {/* Section 1: Text Objects */}
                <div className="px-3 py-1 font-bold text-slate-800 text-[11px] bg-slate-50/70 border-b border-slate-100">
                  Text Objects
                </div>

                <button
                  onClick={() => {
                    props.onInsertTextType ? props.onInsertTextType('single-line') : props.onInsertText();
                    setTextDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#cce0f5] text-slate-800 hover:text-slate-900 group transition-colors"
                >
                  <span>Single Line</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-slate-700">
                      <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z" />
                    </svg>
                    <span className="font-serif italic font-bold text-[#059669] text-[11px] leading-none">O</span>
                    <span className="font-sans font-extrabold text-[#7c3aed] text-[10px] leading-none tracking-tighter">TT</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    props.onInsertTextType ? props.onInsertTextType('multi-line') : props.onInsertText();
                    setTextDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#cce0f5] text-slate-800 hover:text-slate-900 group transition-colors"
                >
                  <span>Multi-line</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-slate-700">
                      <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z" />
                    </svg>
                    <span className="font-serif italic font-bold text-[#059669] text-[11px] leading-none">O</span>
                    <span className="font-sans font-extrabold text-[#7c3aed] text-[10px] leading-none tracking-tighter">TT</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    props.onInsertTextType ? props.onInsertTextType('word-processor') : props.onInsertText();
                    setTextDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#cce0f5] text-slate-800 hover:text-slate-900 group transition-colors"
                >
                  <span>Word Processor</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-serif italic font-bold text-[#059669] text-[11px] leading-none">O</span>
                    <span className="font-sans font-extrabold text-[#7c3aed] text-[10px] leading-none tracking-tighter">TT</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    props.onInsertTextType ? props.onInsertTextType('arc') : props.onInsertText();
                    setTextDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#cce0f5] text-slate-800 hover:text-slate-900 group transition-colors"
                >
                  <span>Arc</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-serif italic font-bold text-[#059669] text-[11px] leading-none">O</span>
                    <span className="font-sans font-extrabold text-[#7c3aed] text-[10px] leading-none tracking-tighter">TT</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    props.onInsertTextType ? props.onInsertTextType('symbol-font') : props.onInsertText();
                    setTextDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#cce0f5] text-slate-800 hover:text-slate-900 group transition-colors"
                >
                  <span>Symbol Font Characters</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-serif italic font-bold text-[#059669] text-[11px] leading-none">O</span>
                    <span className="font-sans font-extrabold text-[#7c3aed] text-[10px] leading-none tracking-tighter">TT</span>
                  </div>
                </button>

                {/* Section 2: Markup Language Containers */}
                <div className="px-3 py-1 font-bold text-slate-800 text-[11px] bg-slate-50/70 border-y border-slate-200 mt-1">
                  Markup Language Containers
                </div>

                <button
                  onClick={() => {
                    props.onInsertTextType ? props.onInsertTextType('rtf') : props.onInsertText();
                    setTextDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#cce0f5] text-slate-800 hover:text-slate-900 group transition-colors"
                >
                  <span>RTF</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-serif italic font-bold text-[#059669] text-[11px] leading-none">O</span>
                    <span className="font-sans font-extrabold text-[#7c3aed] text-[10px] leading-none tracking-tighter">TT</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    props.onInsertTextType ? props.onInsertTextType('html') : props.onInsertText();
                    setTextDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#cce0f5] text-slate-800 hover:text-slate-900 group transition-colors"
                >
                  <span>HTML</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-serif italic font-bold text-[#059669] text-[11px] leading-none">O</span>
                    <span className="font-sans font-extrabold text-[#7c3aed] text-[10px] leading-none tracking-tighter">TT</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    props.onInsertTextType ? props.onInsertTextType('xaml') : props.onInsertText();
                    setTextDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#cce0f5] text-slate-800 hover:text-slate-900 group transition-colors"
                >
                  <span>XAML</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-serif italic font-bold text-[#059669] text-[11px] leading-none">O</span>
                    <span className="font-sans font-extrabold text-[#7c3aed] text-[10px] leading-none tracking-tighter">TT</span>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Line / Shapes Tool */}
        <div className="relative flex items-center">
          <button
            title="Draw Line"
            onClick={() => props.onInsertShape('line')}
            className="h-6 px-1.5 rounded-l-xs flex items-center hover:bg-[#e2e8f0] text-slate-700"
          >
            <Slash className="w-3.5 h-3.5" />
          </button>
          <button
            title="Shapes (Rectangle, Circle, Table)"
            onClick={() => setShapeDropdownOpen(!shapeDropdownOpen)}
            className="h-6 px-1 rounded-r-xs hover:bg-[#e2e8f0] text-slate-600 border-l border-slate-300"
          >
            <ChevronDown className="w-3 h-3" />
          </button>

          {shapeDropdownOpen && (
            <div className="absolute left-0 top-full mt-1 w-44 bg-white border border-[#b8c5d6] shadow-xl py-1 z-50 text-[11.5px] rounded-xs">
              <DropdownItem label="Rectangle / Box" icon={<Square className="w-3.5 h-3.5" />} onClick={() => { props.onInsertShape('rectangle'); setShapeDropdownOpen(false); }} />
              <DropdownItem label="Circle / Ellipse" icon={<Circle className="w-3.5 h-3.5" />} onClick={() => { props.onInsertShape('circle'); setShapeDropdownOpen(false); }} />
              <DropdownItem label="Straight Line" icon={<Slash className="w-3.5 h-3.5" />} onClick={() => { props.onInsertShape('line'); setShapeDropdownOpen(false); }} />
              <DropdownItem label="Specification Table" icon={<TableIcon className="w-3.5 h-3.5" />} onClick={() => { props.onInsertTable(); setShapeDropdownOpen(false); }} />
            </div>
          )}
        </div>

        {/* Picture / Cactus / Image Icon */}
        <button
          title="Insert Picture / Industrial Symbol"
          onClick={props.onInsertImage}
          className="h-6 px-1.5 rounded-xs flex items-center hover:bg-[#e2e8f0] text-emerald-700"
        >
          <ImageIcon className="w-4 h-4" />
        </button>

        {/* RFID / Sensor Icon */}
        <button
          title="RFID Tag Encoding & Sensor Properties"
          onClick={() => alert('RFID Tag Configuration: EPC Gen2, ISO 18000-6C active on this template.')}
          className="h-6 px-1.5 rounded-xs flex items-center hover:bg-[#e2e8f0] text-purple-700"
        >
          <Radio className="w-4 h-4" />
        </button>

        <Divider />

        {/* Zoom & View Controls */}
        <ToolBtn icon={<ZoomIn className="w-4 h-4 text-slate-700" />} title="Zoom In (Ctrl++)" onClick={props.onZoomIn} />
        <ToolBtn icon={<ZoomOut className="w-4 h-4 text-slate-700" />} title="Zoom Out (Ctrl+-)" onClick={props.onZoomOut} />
        <ToolBtn icon={<Maximize2 className="w-4 h-4 text-slate-700" />} title="Fit to Screen" onClick={props.onZoomFit} />

        <Divider />

        <ToolToggle icon={<Grid className="w-4 h-4" />} title="Toggle Grid Lines" active={props.showGrid} onClick={props.onToggleGrid} />
        <ToolToggle icon={<Ruler className="w-4 h-4" />} title="Toggle Metric Rulers" active={props.showRulers} onClick={props.onToggleRulers} />
        <ToolToggle icon={<Magnet className="w-4 h-4" />} title="Snap to Grid / Guides" active={props.snapToGrid} onClick={props.onToggleSnap} />

        <Divider />

        {/* Height and Width Interactive Controls (Directly next to Snap / Magnet as requested) */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white border border-[#b8c5d6] rounded shadow-2xs text-[11px] text-slate-800">
          <div className="flex items-center gap-1 pr-1 border-r border-slate-200">
            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
              {props.selectedElement ? props.selectedElement.type.toUpperCase() : 'LABEL'}
            </span>
          </div>

          {/* Width Control */}
          <div className="flex items-center gap-0.5">
            <span className="font-bold text-slate-700 text-[10.5px]">W:</span>
            <div className="flex items-center border border-slate-300 rounded bg-white overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => handleWidthChange(Math.max(1, Number((currentW - 1).toFixed(1))))}
                className="px-1 py-0.5 bg-slate-50 hover:bg-slate-200 text-slate-700 font-bold text-[10px] select-none cursor-pointer border-r border-slate-200"
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
                className="w-11 text-center text-[11px] font-mono font-bold text-slate-900 bg-transparent outline-none py-0.5"
                title="Width in mm"
              />
              <button
                type="button"
                onClick={() => handleWidthChange(Number((currentW + 1).toFixed(1)))}
                className="px-1 py-0.5 bg-slate-50 hover:bg-slate-200 text-slate-700 font-bold text-[10px] select-none cursor-pointer border-l border-slate-200"
                title="Increase Width (+1 mm)"
              >
                +
              </button>
            </div>
            <span className="text-[9px] text-slate-500 font-mono">mm</span>
          </div>

          {/* Height Control */}
          <div className="flex items-center gap-0.5">
            <span className="font-bold text-slate-700 text-[10.5px]">H:</span>
            <div className="flex items-center border border-slate-300 rounded bg-white overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => handleHeightChange(Math.max(1, Number((currentH - 1).toFixed(1))))}
                className="px-1 py-0.5 bg-slate-50 hover:bg-slate-200 text-slate-700 font-bold text-[10px] select-none cursor-pointer border-r border-slate-200"
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
                className="w-11 text-center text-[11px] font-mono font-bold text-slate-900 bg-transparent outline-none py-0.5"
                title="Height in mm"
              />
              <button
                type="button"
                onClick={() => handleHeightChange(Number((currentH + 1).toFixed(1)))}
                className="px-1 py-0.5 bg-slate-50 hover:bg-slate-200 text-slate-700 font-bold text-[10px] select-none cursor-pointer border-l border-slate-200"
                title="Increase Height (+1 mm)"
              >
                +
              </button>
            </div>
            <span className="text-[9px] text-slate-500 font-mono">mm</span>
          </div>

          {/* Position X & Y */}
          {props.selectedElement && (
            <div className="hidden md:flex items-center gap-1.5 pl-1.5 border-l border-slate-200">
              <div className="flex items-center gap-0.5">
                <span className="text-slate-500 text-[10px] font-semibold">X:</span>
                <input
                  type="number"
                  step="0.5"
                  value={currentX}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) handleXChange(val);
                  }}
                  className="w-9 text-center text-[10.5px] font-mono border border-slate-300 rounded bg-white outline-none py-0.5"
                  title="X Position in mm"
                />
              </div>
              <div className="flex items-center gap-0.5">
                <span className="text-slate-500 text-[10px] font-semibold">Y:</span>
                <input
                  type="number"
                  step="0.5"
                  value={currentY}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) handleYChange(val);
                  }}
                  className="w-9 text-center text-[10.5px] font-mono border border-slate-300 rounded bg-white outline-none py-0.5"
                  title="Y Position in mm"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modern Save & Print Action Group placed directly under Logout area */}
        <div className="ml-auto flex items-center gap-1.5 pl-3">
          {/* Enhanced Save Button */}
          <button
            onClick={props.onSave}
            title="Save Template (Ctrl+S)"
            className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-blue-50 active:bg-blue-100 text-blue-700 hover:text-blue-800 border border-blue-200 hover:border-blue-400 rounded-md font-semibold text-[11px] shadow-2xs transition-all cursor-pointer group"
          >
            <Save className="w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition-transform" />
            <span>Save</span>
          </button>

          {/* Enhanced Print Button */}
          <button
            onClick={props.onPrint}
            title="Print Production Labels (Ctrl+P)"
            className="flex items-center gap-1.5 px-3.5 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 text-white rounded-md font-bold text-[11px] shadow-xs hover:shadow transition-all cursor-pointer group border border-blue-500/30"
          >
            <Printer className="w-3.5 h-3.5 text-white group-hover:scale-110 transition-transform" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* ROW 2: CONTEXT-AWARE FORMATTING & PROPERTIES TOOLBAR */}
      <div className="flex items-center gap-1 h-7 px-1.5 bg-[#e8ecf2] border-b border-[#d8dfe8] overflow-x-auto text-[11px]">
        {/* BARCODE ELEMENT SELECTED */}
        {selectedBarcodeEl ? (
          <>
            <span className="font-bold text-blue-900 text-[10.5px] shrink-0 flex items-center gap-1">
              <Barcode className="w-3.5 h-3.5 text-blue-700" />
              <span>Barcode:</span>
            </span>

            {/* Symbology Selector */}
            <select
              value={selectedBarcodeEl.symbology}
              onChange={(e) => {
                if (props.onUpdateSelectedElement) {
                  props.onUpdateSelectedElement({ symbology: e.target.value as any });
                }
              }}
              className="h-5 bg-white border border-[#cbd5e1] rounded-xs px-1 text-[11px] font-sans text-slate-800 outline-none max-w-[110px]"
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

            {/* Barcode Value / Data input */}
            <div className="flex items-center gap-1 bg-white border border-[#cbd5e1] rounded px-1.5 py-0.5">
              <span className="text-[10px] text-slate-500 font-semibold">Data:</span>
              <input
                type="text"
                value={selectedBarcodeEl.value}
                onChange={(e) => {
                  if (props.onUpdateSelectedElement) {
                    props.onUpdateSelectedElement({ value: e.target.value });
                  }
                }}
                className="w-28 text-[11px] font-mono text-slate-900 outline-none bg-transparent"
                placeholder="Barcode data..."
              />
            </div>

            <Divider />

            {/* Quick Size Presets for Barcode */}
            <span className="text-[10px] text-slate-600 font-semibold hidden lg:inline">Size:</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (props.onUpdateSelectedElement) {
                    props.onUpdateSelectedElement({ width: 45, height: 18 });
                  }
                }}
                className="px-1.5 py-0.5 bg-white hover:bg-blue-50 border border-slate-300 rounded text-[10px] font-medium text-slate-700 cursor-pointer"
                title="Small Barcode (45 x 18 mm)"
              >
                45×18
              </button>
              <button
                type="button"
                onClick={() => {
                  if (props.onUpdateSelectedElement) {
                    props.onUpdateSelectedElement({ width: 60, height: 22 });
                  }
                }}
                className="px-1.5 py-0.5 bg-white hover:bg-blue-50 border border-slate-300 rounded text-[10px] font-medium text-slate-700 cursor-pointer"
                title="Standard Barcode (60 x 22 mm)"
              >
                60×22
              </button>
              <button
                type="button"
                onClick={() => {
                  if (props.onUpdateSelectedElement) {
                    props.onUpdateSelectedElement({ width: 80, height: 28 });
                  }
                }}
                className="px-1.5 py-0.5 bg-white hover:bg-blue-50 border border-slate-300 rounded text-[10px] font-medium text-slate-700 cursor-pointer"
                title="Wide Barcode (80 x 28 mm)"
              >
                80×28
              </button>
              <button
                type="button"
                onClick={() => {
                  if (props.onUpdateSelectedElement) {
                    props.onUpdateSelectedElement({ width: 35, height: 35 });
                  }
                }}
                className="px-1.5 py-0.5 bg-white hover:bg-blue-50 border border-slate-300 rounded text-[10px] font-medium text-slate-700 cursor-pointer"
                title="Square 2D Matrix (35 x 35 mm)"
              >
                35×35
              </button>
            </div>

            <Divider />

            {/* Human Readable Text Toggle */}
            <label className="flex items-center gap-1 cursor-pointer text-[10.5px] text-slate-700 select-none">
              <input
                type="checkbox"
                checked={selectedBarcodeEl.includeText !== false}
                onChange={(e) => {
                  if (props.onUpdateSelectedElement) {
                    props.onUpdateSelectedElement({ includeText: e.target.checked });
                  }
                }}
                className="rounded text-blue-600 focus:ring-0 w-3 h-3"
              />
              <span>Show Text</span>
            </label>

            <Divider />

            {/* Rotation */}
            <ToolBtn
              icon={<RotateCcw className="w-3.5 h-3.5 text-slate-700" />}
              title="Rotate 90° CCW"
              onClick={() => {
                if (props.onUpdateSelectedElement) {
                  props.onUpdateSelectedElement({ rotation: ((selectedBarcodeEl.rotation || 0) - 90 + 360) % 360 });
                }
              }}
            />
            <ToolBtn
              icon={<RotateCw className="w-3.5 h-3.5 text-slate-700" />}
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
                className="h-5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10.5px] font-semibold flex items-center gap-1 shadow-2xs cursor-pointer ml-auto"
                title="Barcode Properties Dialog (F12)"
              >
                <Sliders className="w-3 h-3 text-white" />
                <span>Barcode Properties...</span>
              </button>
            )}
          </>
        ) : selectedShapeEl ? (
          <>
            {/* SHAPE ELEMENT SELECTED */}
            <span className="font-bold text-slate-800 text-[10.5px] shrink-0">Shape:</span>
            <span className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase">
              {selectedShapeEl.shapeType}
            </span>

            <Divider />

            {/* Fill Color */}
            <label className="flex items-center gap-1 text-[10.5px] text-slate-700 cursor-pointer">
              <span>Fill:</span>
              <input
                type="color"
                value={selectedShapeEl.fillColor || '#ffffff'}
                onChange={(e) => {
                  if (props.onUpdateSelectedElement) {
                    props.onUpdateSelectedElement({ fillColor: e.target.value });
                  }
                }}
                className="w-5 h-4 border border-slate-300 rounded cursor-pointer"
              />
            </label>

            {/* Stroke Color */}
            <label className="flex items-center gap-1 text-[10.5px] text-slate-700 cursor-pointer ml-2">
              <span>Border:</span>
              <input
                type="color"
                value={selectedShapeEl.strokeColor || '#000000'}
                onChange={(e) => {
                  if (props.onUpdateSelectedElement) {
                    props.onUpdateSelectedElement({ strokeColor: e.target.value });
                  }
                }}
                className="w-5 h-4 border border-slate-300 rounded cursor-pointer"
              />
            </label>

            {/* Border Width */}
            <div className="flex items-center gap-1 ml-2">
              <span className="text-[10px] text-slate-500">Thickness:</span>
              <select
                value={selectedShapeEl.strokeWidth || 1}
                onChange={(e) => {
                  if (props.onUpdateSelectedElement) {
                    props.onUpdateSelectedElement({ strokeWidth: Number(e.target.value) });
                  }
                }}
                className="h-5 bg-white border border-[#cbd5e1] rounded px-1 text-[10.5px] outline-none"
              >
                <option value={0.5}>0.5 mm</option>
                <option value={1}>1.0 mm</option>
                <option value={2}>2.0 mm</option>
                <option value={3}>3.0 mm</option>
              </select>
            </div>
          </>
        ) : selectedTextEl ? (
          <>
            {/* TEXT ELEMENT SELECTED */}
            {/* Font Family Dropdown */}
            <select
              value={currentFont}
              onChange={(e) => handleFontChange(e.target.value)}
              className="h-5 bg-white border border-[#cbd5e1] rounded-xs px-1 text-[11px] font-sans text-slate-800 outline-none w-36"
            >
              {fonts.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>

            {/* Font Size Dropdown */}
            <select
              value={currentFontSize}
              onChange={(e) => handleSizeChange(Number(e.target.value))}
              className="h-5 bg-white border border-[#cbd5e1] rounded-xs px-1 text-[11px] font-sans text-slate-800 outline-none w-14 text-center"
            >
              {fontSizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <Divider />

            {/* B, I, U, W buttons */}
            <ToolFormatBtn label="B" active={isBold} title="Bold" bold onClick={toggleBold} />
            <ToolFormatBtn label="I" active={isItalic} title="Italic" italic onClick={toggleItalic} />
            <ToolFormatBtn label="U" active={isUnderline} title="Underline" underline onClick={toggleUnderline} />
            <ToolFormatBtn label="W" active={false} title="Word Wrap / Fit" onClick={() => {}} />

            <Divider />

            {/* Color 'A' with color bar below */}
            <label className="h-5 px-1.5 rounded-xs flex flex-col items-center justify-center hover:bg-[#d8dfe8] cursor-pointer" title="Font Color">
              <span className="font-serif font-bold text-xs leading-none text-slate-900">A</span>
              <span className="w-3.5 h-1 bg-red-600 rounded-2xs mt-0.5" />
              <input
                type="color"
                value={fontColor}
                onChange={(e) => {
                  setFontColor(e.target.value);
                  if (props.selectedElement && props.onUpdateSelectedElement) {
                    props.onUpdateSelectedElement({ color: e.target.value } as any);
                  }
                }}
                className="sr-only"
              />
            </label>

            {/* Highlight / Background 'ab' with yellow bar */}
            <label className="h-5 px-1.5 rounded-xs flex flex-col items-center justify-center hover:bg-[#d8dfe8] cursor-pointer" title="Object / Background Fill">
              <span className="font-sans font-bold text-[10px] leading-none text-slate-800">ab</span>
              <span className="w-3.5 h-1 bg-yellow-400 rounded-2xs mt-0.5" />
              <input
                type="color"
                value={bgColor}
                onChange={(e) => {
                  setBgColor(e.target.value);
                  if (props.selectedElement && props.onUpdateSelectedElement) {
                    props.onUpdateSelectedElement({ backgroundColor: e.target.value, fillColor: e.target.value } as any);
                  }
                }}
                className="sr-only"
              />
            </label>

            <Divider />

            {/* Alignments */}
            <ToolBtn icon={<AlignLeft className="w-3.5 h-3.5 text-slate-700" />} title="Align Left" onClick={() => handleAlign('left')} />
            <ToolBtn icon={<AlignCenter className="w-3.5 h-3.5 text-slate-700" />} title="Align Center" onClick={() => handleAlign('center')} />
            <ToolBtn icon={<AlignRight className="w-3.5 h-3.5 text-slate-700" />} title="Align Right" onClick={() => handleAlign('right')} />
            <ToolBtn icon={<AlignJustify className="w-3.5 h-3.5 text-slate-700" />} title="Justify" onClick={() => handleAlign('justify')} />

            <Divider />

            {/* Rotation tools */}
            <ToolBtn icon={<RotateCcw className="w-3.5 h-3.5 text-slate-700" />} title="Rotate 90° CCW" onClick={() => {
              if (props.selectedElement && props.onUpdateSelectedElement) {
                props.onUpdateSelectedElement({ rotation: ((props.selectedElement.rotation || 0) - 90 + 360) % 360 });
              }
            }} />
            <ToolBtn icon={<RotateCw className="w-3.5 h-3.5 text-slate-700" />} title="Rotate 90° CW" onClick={() => {
              if (props.selectedElement && props.onUpdateSelectedElement) {
                props.onUpdateSelectedElement({ rotation: ((props.selectedElement.rotation || 0) + 90) % 360 });
              }
            }} />
          </>
        ) : (
          <>
            {/* NO ELEMENT SELECTED: LABEL TEMPLATE QUICK STOCK PRESETS */}
            <span className="font-bold text-slate-700 text-[10.5px] shrink-0">Label Stock:</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  handleWidthChange(100);
                  handleHeightChange(60);
                }}
                className="px-2 py-0.5 bg-white hover:bg-blue-50 border border-slate-300 rounded text-[10px] font-semibold text-slate-800 cursor-pointer"
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
                className="px-2 py-0.5 bg-white hover:bg-blue-50 border border-slate-300 rounded text-[10px] font-semibold text-slate-800 cursor-pointer"
                title="Set Label to 4x6 inch (101.6 x 152.4 mm)"
              >
                4×6″ (102×152 mm)
              </button>
              <button
                type="button"
                onClick={() => {
                  handleWidthChange(50);
                  handleHeightChange(25);
                }}
                className="px-2 py-0.5 bg-white hover:bg-blue-50 border border-slate-300 rounded text-[10px] font-semibold text-slate-800 cursor-pointer"
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
                className="px-2 py-0.5 bg-white hover:bg-blue-50 border border-slate-300 rounded text-[10px] font-semibold text-slate-800 cursor-pointer"
                title="Set Label to 75 x 50 mm"
              >
                75×50 mm
              </button>
            </div>

            <Divider />

            <span className="text-[10px] text-slate-500">
              Click any element on canvas to inspect & resize it directly
            </span>
          </>
        )}
      </div>

      {/* ROW 3: DOCUMENT TAB BAR (e.g. Document1.btw *) */}
      <div className="flex items-center h-6 bg-[#d8e2ee] px-1 border-b border-[#b8c5d6]">
        <div className="flex items-center gap-1 bg-[#fff8db] border-t-2 border-t-amber-500 border-x border-[#b8c5d6] px-2.5 py-0.5 rounded-t-xs text-[11px] font-medium text-slate-900 shadow-xs">
          <span>{props.documentName || 'Document1.btw *'}</span>
          <button className="p-0.5 hover:bg-amber-200 rounded text-slate-500 hover:text-slate-900">
            <X className="w-2.5 h-2.5" />
          </button>
        </div>

        <button
          title="New Label Document Tab"
          onClick={props.onNew}
          className="ml-1 p-1 hover:bg-[#c6d4e4] rounded text-slate-600 hover:text-slate-900"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

const ToolBtn: React.FC<{
  icon: React.ReactNode;
  title: string;
  disabled?: boolean;
  onClick: () => void;
}> = ({ icon, title, disabled, onClick }) => {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`w-6 h-6 rounded-xs flex items-center justify-center transition-colors ${
        disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-[#d8dfe8] text-slate-700'
      }`}
    >
      {icon}
    </button>
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
      className={`w-6 h-6 rounded-xs flex items-center justify-center transition-all ${
        active ? 'bg-[#cce0f5] text-blue-900 border border-blue-400' : 'hover:bg-[#d8dfe8] text-slate-600'
      }`}
    >
      {icon}
    </button>
  );
};

const ToolFormatBtn: React.FC<{
  label: string;
  title: string;
  active: boolean;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  onClick: () => void;
}> = ({ label, title, active, bold, italic, underline, onClick }) => {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`w-5 h-5 rounded-xs flex items-center justify-center text-xs transition-all ${
        active
          ? 'bg-[#cce0f5] text-blue-900 border border-blue-400 font-bold'
          : 'hover:bg-[#d8dfe8] text-slate-800'
      } ${bold ? 'font-bold' : ''} ${italic ? 'italic' : ''} ${underline ? 'underline' : ''}`}
    >
      {label}
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
      className="w-full flex items-center gap-2 px-3 py-1 text-left hover:bg-[#cce0f5] text-slate-800 text-[11.5px]"
    >
      {icon && <span className="text-slate-600">{icon}</span>}
      <span>{label}</span>
    </button>
  );
};

const Divider: React.FC = () => <div className="w-px h-4 bg-[#cbd5e1] mx-1" />;
