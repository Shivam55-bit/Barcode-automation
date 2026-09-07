import React, { useState, useEffect, useMemo } from 'react';
import {
  PrinterModel,
  StockPreset,
  LabelShapeType,
  PageOrientation,
  PrintCorner,
  PrintDirection,
} from '../../printer/types';
import { BUILTIN_STOCK_PRESETS } from '../../printer/mediaService';
import { PrinterService } from '../../printer/printerService';
import { LabelTemplate, LabelElement } from '../../types';
import { PageSetupModal } from '../dialogs/PageSetupModal';
import { WizardLabelRollPreview } from './WizardLabelRollPreview';
import { X, Check, AlertTriangle } from 'lucide-react';

interface NewDocumentWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFinish: (newTemplate: LabelTemplate) => void;
  currentUser?: string;
}

export const NewDocumentWizardModal: React.FC<NewDocumentWizardModalProps> = ({
  isOpen,
  onClose,
  onFinish,
  currentUser = 'Shivam Enterprise Operator',
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [installedPrinters, setInstalledPrinters] = useState<PrinterModel[]>([]);
  const [isLoadingPrinters, setIsLoadingPrinters] = useState<boolean>(false);
  const [showPrinterPropsDialog, setShowPrinterPropsDialog] = useState<boolean>(false);
  const [showDocPropsDialog, setShowDocPropsDialog] = useState<boolean>(false);
  const [unit, setUnit] = useState<'mm' | 'inch'>('mm');
  const [customStocks, setCustomStocks] = useState<StockPreset[]>(() => {
    try {
      const saved = localStorage.getItem('barcodeflow_custom_stocks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Step 1: Starting Point
  const [startingPoint, setStartingPoint] = useState<'blank' | 'template'>('blank');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('mrp-50x25');
  const [showTemplateLibraryDialog, setShowTemplateLibraryDialog] = useState<boolean>(false);

  // Step 2: Printer
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>('virtual-generic-203');

  // Step 3: Stock
  const [stockMode, setStockMode] = useState<'custom' | 'predefined'>('custom');
  const [selectedStockCategory, setSelectedStockCategory] = useState<string>('mrp');
  const [selectedStockId, setSelectedStockId] = useState<string>('stock-mrp-50x25');
  const [selectedMediaType, setSelectedMediaType] = useState<'gap' | 'continuous' | 'black_mark'>('gap');

  // Step 4: Items Per Page
  const [itemsMode, setItemsMode] = useState<'single' | 'multiple'>('single');
  const [rows, setRows] = useState<number>(1);
  const [columns, setColumns] = useState<number>(1);

  // Step 5: Page Size & Orientation
  const [pageSizeType, setPageSizeType] = useState<string>('user-defined');
  const [pageWidthMm, setPageWidthMm] = useState<number>(50);
  const [pageHeightMm, setPageHeightMm] = useState<number>(25);
  const [orientation, setOrientation] = useState<PageOrientation>('portrait');

  // Step 6: Margins
  const [marginTop, setMarginTop] = useState<number>(0);
  const [marginLeft, setMarginLeft] = useState<number>(0);
  const [marginRight, setMarginRight] = useState<number>(0);
  const [marginBottom, setMarginBottom] = useState<number>(0);

  // Step 7: Label Shape
  const [labelShape, setLabelShape] = useState<LabelShapeType>('rectangle');
  const [cornerRadiusMm, setCornerRadiusMm] = useState<number>(1.5);

  // Step 8: Label Size & Gap
  const [labelWidthMm, setLabelWidthMm] = useState<number>(50);
  const [labelHeightMm, setLabelHeightMm] = useState<number>(25);
  const [horizontalGapMm, setHorizontalGapMm] = useState<number>(0);
  const [verticalGapMm, setVerticalGapMm] = useState<number>(2);
  const [manualGap, setManualGap] = useState<boolean>(false);

  // Step 9: Print Order
  const [printCorner, setPrintCorner] = useState<PrintCorner>('top-left');
  const [printDirection, setPrintDirection] = useState<PrintDirection>('horizontal');
  const [selectStartAtPrint, setSelectStartAtPrint] = useState<boolean>(false);
  const [continueFromPrevious, setContinueFromPrevious] = useState<boolean>(false);

  // Step 10: Background
  const [useBgColor, setUseBgColor] = useState<boolean>(false);
  const [bgColor, setBgColor] = useState<string>('#ffffff');
  const [useBgImage, setUseBgImage] = useState<boolean>(false);
  const [bgImageUrl, setBgImageUrl] = useState<string>('');
  const [showBgInDesigner, setShowBgInDesigner] = useState<boolean>(true);
  const [printBackground, setPrintBackground] = useState<boolean>(false);

  // Step 12: Finish options
  const [saveAsPreset, setSaveAsPreset] = useState<boolean>(false);
  const [setAsPrinterDefault, setSetAsPrinterDefault] = useState<boolean>(true);

  // Load printers on open
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      loadPrinters();
    }
  }, [isOpen]);

  const loadPrinters = async () => {
    setIsLoadingPrinters(true);
    try {
      const printers = await PrinterService.getInstance().loadPrinters(true);
      setInstalledPrinters(printers);
      const stillPresent = printers.find((p) => p.id === selectedPrinterId);
      if (stillPresent) {
        setSelectedPrinterId(stillPresent.id);
      } else {
        const def = printers.find((p) => !p.isVirtual && p.isDefault) || printers.find((p) => p.isDefault) || printers[0];
        if (def) setSelectedPrinterId(def.id);
      }
    } catch (err) {
      console.warn('Printer discovery error:', err);
    } finally {
      setIsLoadingPrinters(false);
    }
  };

  const selectedPrinter = useMemo(() => {
    return installedPrinters.find((p) => p.id === selectedPrinterId) || installedPrinters[0];
  }, [installedPrinters, selectedPrinterId]);

  // Apply selected stock preset
  const handleSelectStockPreset = (preset: StockPreset) => {
    setSelectedStockId(preset.id);
    setSelectedStockCategory(preset.category);
    setLabelWidthMm(preset.widthMm);
    setLabelHeightMm(preset.heightMm);
    setRows(preset.rows);
    setColumns(preset.columns);
    setHorizontalGapMm(preset.horizontalGapMm);
    setVerticalGapMm(preset.verticalGapMm);
    setMarginTop(preset.marginTopMm);
    setMarginLeft(preset.marginLeftMm);
    setMarginRight(preset.marginRightMm);
    setMarginBottom(preset.marginBottomMm);
    setLabelShape(preset.shape);
    if (preset.cornerRadiusMm) setCornerRadiusMm(preset.cornerRadiusMm);
    if (preset.mediaType) {
      setSelectedMediaType(preset.mediaType);
    } else {
      setSelectedMediaType(preset.rows > 1 || preset.columns > 1 ? 'gap' : 'gap');
    }

    if (preset.rows > 1 || preset.columns > 1) {
      setItemsMode('multiple');
      if (preset.category === 'a4-sheet') {
        setPageSizeType('a4');
        setPageWidthMm(210);
        setPageHeightMm(297);
      } else {
        setPageSizeType('user-defined');
        setPageWidthMm(
          preset.columns * preset.widthMm +
            (preset.columns - 1) * preset.horizontalGapMm +
            preset.marginLeftMm +
            preset.marginRightMm
        );
        setPageHeightMm(
          preset.rows * preset.heightMm +
            (preset.rows - 1) * preset.verticalGapMm +
            preset.marginTopMm +
            preset.marginBottomMm
        );
      }
    } else {
      setItemsMode('single');
      setPageSizeType('user-defined');
      setPageWidthMm(preset.widthMm);
      setPageHeightMm(preset.heightMm);
    }
  };

  // Sync single item dimensions
  useEffect(() => {
    if (itemsMode === 'single' && pageSizeType === 'user-defined') {
      setPageWidthMm(labelWidthMm);
      setPageHeightMm(labelHeightMm);
    }
  }, [labelWidthMm, labelHeightMm, itemsMode, pageSizeType]);

  // Validation
  const validationError = useMemo<string | null>(() => {
    if (currentStep === 2 && !selectedPrinterId) {
      return 'Please select a printer.';
    }
    if (currentStep === 4 && itemsMode === 'multiple') {
      if (rows < 1 || columns < 1) return 'Rows and columns must be at least 1.';
    }
    if (currentStep === 5) {
      if (pageWidthMm <= 0 || pageHeightMm <= 0) return 'Page dimensions must be greater than 0 mm.';
    }
    if (currentStep === 6) {
      if (marginTop < 0 || marginLeft < 0 || marginRight < 0 || marginBottom < 0) {
        return 'Margins cannot be negative.';
      }
    }
    if (currentStep === 8) {
      if (labelWidthMm <= 0 || labelHeightMm <= 0) return 'Label dimensions must be greater than 0 mm.';
      if (horizontalGapMm < 0 || verticalGapMm < 0) return 'Gap cannot be negative.';
    }
    return null;
  }, [
    currentStep,
    selectedPrinterId,
    itemsMode,
    rows,
    columns,
    pageWidthMm,
    pageHeightMm,
    marginTop,
    marginLeft,
    marginRight,
    marginBottom,
    labelWidthMm,
    labelHeightMm,
    horizontalGapMm,
    verticalGapMm,
  ]);

  const isCurrentStepValid = !validationError;

  const handleFinishWizard = () => {
    const dpi = selectedPrinter?.dpi || 203;
    let elements: LabelElement[] = [];
    let variables: any[] = [];
    let sampleRecords: any[] = [{}];

    // ONLY populate elements if the user explicitly chose "Select template from library"!
    if (startingPoint === 'template') {
      if (selectedTemplateId === 'mrp-50x25') {
        elements = createMRP50x25Elements();
        variables = [
          { id: 'v1', name: 'PRODUCT_NAME', type: 'static', defaultValue: 'PREMIUM QUALITY SOAP' },
          { id: 'v2', name: 'MRP_PRICE', type: 'static', defaultValue: '₹120.00' },
          { id: 'v3', name: 'BATCH_NO', type: 'static', defaultValue: 'B001' },
          { id: 'v4', name: 'MFG_DATE', type: 'static', defaultValue: '09/2026' },
          { id: 'v5', name: 'EXP_DATE', type: 'static', defaultValue: '09/2027' },
          { id: 'v6', name: 'BARCODE_VAL', type: 'static', defaultValue: '8901030999012' },
        ];
        sampleRecords = [
          {
            PRODUCT_NAME: 'PREMIUM QUALITY SOAP',
            MRP_PRICE: '₹120.00',
            BATCH_NO: 'B001',
            MFG_DATE: '09/2026',
            EXP_DATE: '09/2027',
            BARCODE_VAL: '8901030999012',
            SERIAL_NO: '000001',
          },
        ];
      } else if (selectedTemplateId === 'shipping-4x6') {
        elements = createShipping4x6Elements();
        variables = [
          { id: 'v1', name: 'SHIP_TO', type: 'static', defaultValue: 'APEX FULFILLMENT DOCK 12' },
          { id: 'v2', name: 'TRACKING_NO', type: 'static', defaultValue: '1Z9999999999999999' },
        ];
        sampleRecords = [
          {
            SHIP_TO: 'APEX FULFILLMENT DOCK 12',
            TRACKING_NO: '1Z9999999999999999',
          },
        ];
      }
    } else {
      // User chose "Blank template": Completely empty canvas with 0 elements!
      elements = [];
      variables = [];
      sampleRecords = [{}];
    }

    const docNum = Math.floor(Math.random() * 900 + 100);
    const newTemplate: LabelTemplate = {
      id: `tmpl-${Date.now()}`,
      name:
        startingPoint === 'template'
          ? (selectedTemplateId === 'mrp-50x25' ? 'MRP Product Barcode Label (50 × 25 mm)' : 'Shipping Carton Label (4×6")')
          : `Document${docNum}.btw`,
      description:
        startingPoint === 'template'
          ? `${labelWidthMm} × ${labelHeightMm} mm library template configured via New Document Wizard`
          : `Blank ${labelWidthMm} × ${labelHeightMm} mm document created via New Document Wizard`,
      category: startingPoint === 'template' && selectedTemplateId === 'shipping-4x6' ? 'Logistics' : 'Manufacturing',
      version: '1.0',
      status: 'approved',
      complianceStandard: startingPoint === 'template' ? 'GS1-128' : 'Custom',
      shape: labelShape,
      cornerRadius: labelShape === 'rounded' ? cornerRadiusMm : 0,
      dimensions: {
        width: labelWidthMm,
        height: labelHeightMm,
        unit: 'mm',
        dpi: (selectedPrinter?.dpi as any) || 203,
        orientation: orientation as any,
        shape: labelShape,
        cornerRadius: labelShape === 'rounded' ? cornerRadiusMm : 0,
      },
      margins: {
        top: marginTop,
        right: marginRight,
        bottom: marginBottom,
        left: marginLeft,
        bleed: 0.5,
        safeZone: 1,
      },
      sheetGrid: {
        enabled: rows > 1 || columns > 1,
        rows,
        columns,
        gapHorizontal: horizontalGapMm,
        gapVertical: verticalGapMm,
        labelWidth: labelWidthMm,
        labelHeight: labelHeightMm,
        marginTop,
        marginLeft,
      },
      variables,
      sampleRecords,
      elements,
      tags: startingPoint === 'template' ? ['Library Template', `${selectedPrinter?.dpi || 203} DPI`] : ['Blank Label', 'Draft', `${selectedPrinter?.dpi || 203} DPI`],
      printer: selectedPrinter
        ? {
            id: selectedPrinter.id,
            name: selectedPrinter.name,
            systemName: selectedPrinter.systemName || selectedPrinter.name,
            driverName: selectedPrinter.driverName,
            portName: selectedPrinter.portName || selectedPrinter.port,
            dpi: selectedPrinter.dpi ?? null,
            renderer: selectedPrinter.preferredRenderer || 'WINDOWS_DRIVER',
            manufacturer: selectedPrinter.manufacturer,
            model: selectedPrinter.model,
          }
        : undefined,
      stockId: selectedStockId || undefined,
      stockName: selectedStockId || 'Custom',
      mediaType: selectedMediaType,
      printOrder: {
        startingCorner: printCorner,
        direction: printDirection,
        selectStartingPositionAtPrintTime: selectStartAtPrint,
        continueFromPrevious,
      },
      background: {
        useColor: useBgColor,
        color: bgColor,
        useImage: useBgImage,
        imageUrl: bgImageUrl || undefined,
        showInDesigner: showBgInDesigner,
        printBackground,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: currentUser,
    };

    if (saveAsPreset) {
      try {
        const customStock: StockPreset = {
          id: `custom-stock-${Date.now()}`,
          name: `Custom (${labelWidthMm} × ${labelHeightMm} mm)`,
          category: (rows > 1 || columns > 1 ? 'a4-sheet' : 'custom') as any,
          widthMm: labelWidthMm,
          heightMm: labelHeightMm,
          rows,
          columns,
          horizontalGapMm,
          verticalGapMm,
          marginTopMm: marginTop,
          marginLeftMm: marginLeft,
          marginRightMm: marginRight,
          marginBottomMm: marginBottom,
          shape: labelShape,
          cornerRadiusMm: labelShape === 'rounded' ? cornerRadiusMm : undefined,
          mediaType: selectedMediaType,
        };
        const existing = JSON.parse(localStorage.getItem('barcodeflow_custom_stocks') || '[]');
        const updated = [...existing, customStock];
        localStorage.setItem('barcodeflow_custom_stocks', JSON.stringify(updated));
        setCustomStocks(updated);
      } catch (err) {
        console.warn('Failed to save custom stock preset:', err);
      }
    }

    onFinish(newTemplate);
    onClose();
  };

  // Keyboard shortcuts: Enter = Next, Escape = Cancel
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') return;
        e.preventDefault();
        if (currentStep < 12 && isCurrentStepValid) {
          setCurrentStep((prev) => prev + 1);
        } else if (currentStep === 12) {
          handleFinishWizard();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStep, isCurrentStepValid, handleFinishWizard]);

  const stepMeta = [
    { title: 'Starting Point', desc: 'Select the starting point for the new document.' },
    { title: 'Printer Selection', desc: 'Specify the printer to use with this document.' },
    { title: 'Stock Selection', desc: 'Select a predefined Stock or specify custom media settings.' },
    { title: 'Items Per Page', desc: 'Specify whether the page contains a single item or multiple items.' },
    { title: 'Page Size', desc: 'Specify the page size and orientation.' },
    { title: 'Unused / Margin Area', desc: 'Specify the margins around the edges of the page.' },
    { title: 'Label Shape', desc: 'Select the shape of the label.' },
    { title: 'Size & Gap', desc: 'Specify the size of the template and the spacing between items.' },
    { title: 'Print Order', desc: 'Specify the order in which multiple items are printed.' },
    { title: 'Background Features', desc: 'Specify background color or reference image options.' },
    { title: 'Summary', desc: 'Review the document properties before creating the label.' },
    { title: 'Finish Wizard', desc: 'Ready to create document and open in Designer.' },
  ];

  const renderLivePreview = () => (
    <WizardLabelRollPreview
      pageWidthMm={pageWidthMm}
      pageHeightMm={pageHeightMm}
      labelWidthMm={labelWidthMm}
      labelHeightMm={labelHeightMm}
      rows={rows}
      columns={columns}
      labelShape={labelShape}
      cornerRadiusMm={cornerRadiusMm}
      selectedMediaType={selectedMediaType}
      orientation={orientation}
      marginTop={marginTop}
      marginLeft={marginLeft}
      marginRight={marginRight}
      marginBottom={marginBottom}
      horizontalGapMm={horizontalGapMm}
      verticalGapMm={verticalGapMm}
      startingPoint={startingPoint}
      selectedTemplateId={selectedTemplateId}
      printCorner={printCorner}
      printDirection={printDirection}
      useBgColor={useBgColor}
      bgColor={bgColor}
      unit={unit}
    />
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 select-none">
      {/* Exact Native Windows Dialog Container (720px × 525px, responsive on smaller screens) */}
      <div
        className="w-[720px] max-w-[96vw] h-[525px] max-h-[94vh] bg-[#f0f0f0] border border-[#7a7a7a] rounded-[3px] shadow-[0_10px_35px_rgba(0,0,0,0.35)] flex flex-col overflow-hidden text-[11px] text-[#000000]"
        style={{ fontFamily: '"Segoe UI", Tahoma, Arial, sans-serif' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Real Classic Windows Title Bar with Aero soft-blue gradient */}
        <div
          className="h-[28px] px-2 flex items-center justify-between shrink-0 border-b border-[#a0b8cf]"
          style={{
            background: 'linear-gradient(to bottom, #dbe8f5 0%, #cce0f2 40%, #b8d4ee 50%, #c9ddf2 100%)',
          }}
        >
          <div className="flex items-center gap-1.5">
            {/* 16x16 Document icon */}
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="1" width="12" height="14" rx="1" fill="#ffffff" stroke="#2563eb" strokeWidth="1.2" />
              <line x1="4" y1="4" x2="10" y2="4" stroke="#2563eb" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="4" y1="7" x2="12" y2="7" stroke="#64748b" strokeWidth="1" strokeLinecap="round" />
              <rect x="4" y="9.5" width="8" height="3" fill="#2563eb" fillOpacity="0.15" stroke="#2563eb" strokeWidth="0.8" />
            </svg>
            <span className="font-semibold text-[#111111] text-[12px] tracking-tight">
              New Document Wizard
            </span>
          </div>

          {/* Windows Close button [X] */}
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="w-[36px] h-[20px] -mr-1 flex items-center justify-center rounded-[2px] bg-gradient-to-b from-[#f28e8e] to-[#d9534f] hover:from-[#f47070] hover:to-[#c9302c] active:from-[#d9534f] active:to-[#ac2925] border border-[#b92c28] text-white shadow-2xs"
          >
            <X className="w-3 h-3 stroke-[2.5]" />
          </button>
        </div>

        {/* Real Windows Wizard Top Banner with Iconic Blue Graphic on Right */}
        <div className="h-[68px] bg-white border-b border-[#b0b0b0] flex items-center justify-between shrink-0 relative overflow-hidden pl-4 pr-0">
          <div className="z-10 flex-1 min-w-0 pr-2">
            <div className="font-bold text-[#000000] text-[12px] truncate">
              {stepMeta[currentStep - 1].title}
            </div>
            <div className="text-[11px] text-[#222222] mt-1 leading-snug line-clamp-2">
              {stepMeta[currentStep - 1].desc}
            </div>
          </div>

          {/* Right Banner Watermark: Blue-cyan tech grid with barcode & label graphic */}
          <div className="relative w-[130px] sm:w-[170px] md:w-[210px] h-full shrink-0 flex items-center justify-end pointer-events-none">
            {/* Background cyan tech grid */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(to right, rgba(255,255,255,1) 0%, rgba(255,255,255,0.4) 25%, #469ad0 60%, #0968a8 100%)',
              }}
            />
            {/* Tech grid numbers and vectors simulation */}
            <div className="absolute right-3 top-2 text-[10px] font-mono text-white/50 tracking-wider font-bold">
              597001
            </div>
            <div className="absolute right-12 bottom-2 text-[10px] font-mono text-white/40 tracking-wider">
              A7-118
            </div>

            {/* Graphic items: Label with Barcode, QR sheet, and CD disc */}
            <div className="relative z-10 flex items-center gap-1 mr-3">
              {/* Barcode label icon */}
              <div className="w-[32px] h-[19px] bg-white border border-[#475569] rounded-[1px] p-0.5 shadow-sm flex flex-col justify-between">
                <div className="flex h-2.5 w-full gap-[1px] items-end overflow-hidden">
                  {[2, 1, 3, 1, 2, 1, 3, 2, 1, 2].map((w, i) => (
                    <div key={i} style={{ width: `${w * 1}px` }} className="bg-black h-full" />
                  ))}
                </div>
                <div className="h-[2px] bg-slate-300 w-3/4" />
              </div>

              {/* QR Label Document icon with folded corner */}
              <div className="w-[26px] h-[33px] bg-white border border-[#475569] rounded-[1px] shadow-sm p-1 flex flex-col justify-between relative">
                <div className="w-2.5 h-2.5 border border-black grid grid-cols-2 grid-rows-2 gap-[1px] p-[1px]">
                  <div className="bg-black" />
                  <div className="bg-white" />
                  <div className="bg-white" />
                  <div className="bg-black" />
                </div>
                <div className="space-y-[2px]">
                  <div className="h-[2px] bg-black w-full" />
                  <div className="h-[2px] bg-slate-400 w-3/4" />
                  <div className="h-[2px] bg-slate-400 w-full" />
                </div>
              </div>

              {/* CD / Media Disc icon */}
              <div className="w-[28px] h-[28px] rounded-full border border-[#cbd5e1] bg-gradient-to-br from-[#ffffff] via-[#e2e8f0] to-[#94a3b8] shadow-sm flex items-center justify-center -ml-1">
                <div className="w-2 h-2 rounded-full bg-white border border-slate-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area (Clean Windows White background) */}
        <div className="flex-1 bg-[#ffffff] p-5 overflow-y-auto">
          {/* STEP 1: Starting Point */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <p className="text-[11px] text-[#000000] leading-relaxed">
                You can start with a blank template, or a pre-designed template from a library of several common standards.
              </p>

              <div className="pt-2">
                <div className="font-bold text-[#000000] mb-2.5">Starting Point:</div>

                <div className="space-y-2.5 pl-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="startingPoint"
                      checked={startingPoint === 'blank'}
                      onChange={() => setStartingPoint('blank')}
                      className="accent-[#0078d7]"
                    />
                    <span className="text-[11px] text-[#000000]">Blank template</span>
                  </label>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="startingPoint"
                        checked={startingPoint === 'template'}
                        onChange={() => setStartingPoint('template')}
                        className="accent-[#0078d7]"
                      />
                      <span className="text-[11px] text-[#000000]">Select template from library</span>
                    </label>

                    {/* Select... button underneath */}
                    <div className="pl-6">
                      <button
                        type="button"
                        onClick={() => {
                          setStartingPoint('template');
                          setShowTemplateLibraryDialog(!showTemplateLibraryDialog);
                        }}
                        className="w-[75px] h-[23px] bg-gradient-to-b from-[#f2f2f2] to-[#e1e1e1] hover:from-[#e5f1fb] hover:to-[#d0e5f7] active:from-[#cce4f7] active:to-[#b9daf4] border border-[#707070] rounded-[2px] text-[11px] text-[#000000] shadow-2xs"
                      >
                        Select...
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Template selection list flyout if Select... clicked */}
              {showTemplateLibraryDialog && (
                <div className="mt-3 p-3 bg-[#f8fafc] border border-[#7a7a7a] rounded-[2px] space-y-2">
                  <div className="font-semibold text-[#000000]">Available Templates:</div>
                  <div className="space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer p-1 bg-white border border-[#cbd5e1] hover:border-[#0078d7]">
                      <input
                        type="radio"
                        name="templateSubChoice"
                        checked={selectedTemplateId === 'mrp-50x25'}
                        onChange={() => {
                          setSelectedTemplateId('mrp-50x25');
                          setLabelWidthMm(50);
                          setLabelHeightMm(25);
                          setVerticalGapMm(3);
                        }}
                        className="accent-[#0078d7]"
                      />
                      <div>
                        <strong>MRP Label — 50 × 25 mm</strong> (Pharma / Retail MRP with dynamic barcode & QR)
                      </div>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-1 bg-white border border-[#cbd5e1] hover:border-[#0078d7]">
                      <input
                        type="radio"
                        name="templateSubChoice"
                        checked={selectedTemplateId === 'shipping-4x6'}
                        onChange={() => {
                          setSelectedTemplateId('shipping-4x6');
                          setLabelWidthMm(101.6);
                          setLabelHeightMm(152.4);
                          setVerticalGapMm(3.17);
                        }}
                        className="accent-[#0078d7]"
                      />
                      <div>
                        <strong>Shipping Label — 4" × 6"</strong> (101.6 × 152.4 mm GS1-128 carton format)
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Printer Selection (Matches BarTender Windows layout) */}
          {currentStep === 2 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-bold text-[#000000]">Printer:</div>
                {selectedPrinter && (
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        selectedPrinter.status?.toLowerCase() === 'ready'
                          ? 'bg-emerald-100 text-emerald-800'
                          : selectedPrinter.status?.toLowerCase() === 'busy'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {selectedPrinter.status || 'READY'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {selectedPrinter.dpi ? `${selectedPrinter.dpi} DPI` : 'DPI: Unknown'}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-start">
                {/* Classic Windows ListBox (65% width) */}
                <div className="w-full sm:w-[66%] h-[180px] sm:h-[220px] md:h-[240px] border border-[#7a7a7a] bg-white rounded-[1px] overflow-y-auto shadow-inner shrink-0">
                  {isLoadingPrinters ? (
                    <div className="p-3 text-slate-400 text-xs">Discovering Windows printers...</div>
                  ) : installedPrinters.length === 0 ? (
                    <div className="p-3 text-slate-400 text-xs">No printers detected.</div>
                  ) : (
                    <div>
                      {/* Section 1: Real Installed Windows Printers */}
                      <div className="px-2 py-1 bg-slate-100 text-[10px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                        Installed Windows Printers
                      </div>
                      {installedPrinters
                        .filter((p) => !p.isVirtual)
                        .map((p) => {
                          const isSelected = selectedPrinterId === p.id;
                          return (
                            <div
                              key={p.id}
                              onClick={() => setSelectedPrinterId(p.id)}
                              className={`px-2 py-[3px] cursor-pointer text-[11px] leading-tight truncate select-none flex items-center justify-between ${
                                isSelected
                                  ? 'bg-[#3399ff] text-white font-normal'
                                  : 'text-[#000000] hover:bg-[#eef5fc]'
                              }`}
                            >
                              <span>{p.isDefault ? `Default (currently ${p.name})` : p.name}</span>
                              {p.status?.toLowerCase() === 'offline' && (
                                <span className={`text-[9px] px-1 rounded ${isSelected ? 'bg-white/30 text-white' : 'bg-red-100 text-red-700'}`}>
                                  Offline
                                </span>
                              )}
                            </div>
                          );
                        })}

                      {/* Section 2: Virtual Profiles */}
                      {installedPrinters.some((p) => p.isVirtual) && (
                        <>
                          <div className="px-2 py-1 bg-slate-100 text-[10px] font-bold text-slate-600 uppercase tracking-wider border-y border-slate-200 mt-1">
                            Virtual BarcodeFlow Printers
                          </div>
                          {installedPrinters
                            .filter((p) => p.isVirtual)
                            .map((p) => {
                              const isSelected = selectedPrinterId === p.id;
                              return (
                                <div
                                  key={p.id}
                                  onClick={() => setSelectedPrinterId(p.id)}
                                  className={`px-2 py-[3px] cursor-pointer text-[11px] leading-tight truncate select-none ${
                                    isSelected
                                      ? 'bg-[#3399ff] text-white font-normal'
                                      : 'text-[#000000] hover:bg-[#eef5fc]'
                                  }`}
                                >
                                  {p.name}
                                </div>
                              );
                            })}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Right side command buttons */}
                <div className="w-[34%] space-y-2 pt-1">
                  {/* Refresh button (P1-1) */}
                  <button
                    type="button"
                    onClick={loadPrinters}
                    disabled={isLoadingPrinters}
                    className="w-full h-[25px] bg-gradient-to-b from-[#f5f5f5] to-[#e5e5e5] hover:from-[#e5f1fb] hover:to-[#d0e5f7] active:from-[#cce4f7] active:to-[#b9daf4] border border-[#707070] rounded-[2px] text-[11px] text-[#000000] shadow-2xs flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    <span>🔄 Refresh Printers</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowDocPropsDialog(true)}
                    className="w-full h-[25px] bg-gradient-to-b from-[#f5f5f5] to-[#e5e5e5] hover:from-[#e5f1fb] hover:to-[#d0e5f7] active:from-[#cce4f7] active:to-[#b9daf4] border border-[#707070] rounded-[2px] text-[11px] text-[#000000] shadow-2xs"
                  >
                    Document Properties...
                  </button>

                  {/* Real Windows Printer Properties (P1-2) */}
                  <button
                    type="button"
                    onClick={async () => {
                      if (!selectedPrinter) return;
                      if (window.barcodeFlow?.printers?.openProperties) {
                        try {
                          const res = await window.barcodeFlow.printers.openProperties(
                            selectedPrinter.systemName || selectedPrinter.name
                          );
                          if (!res?.success) {
                            setShowPrinterPropsDialog(true);
                          }
                        } catch {
                          setShowPrinterPropsDialog(true);
                        }
                      } else {
                        setShowPrinterPropsDialog(true);
                      }
                    }}
                    className="w-full h-[25px] bg-gradient-to-b from-[#f5f5f5] to-[#e5e5e5] hover:from-[#e5f1fb] hover:to-[#d0e5f7] active:from-[#cce4f7] active:to-[#b9daf4] border border-[#707070] rounded-[2px] text-[11px] text-[#000000] shadow-2xs"
                  >
                    Printer Properties...
                  </button>

                  {/* Info notice */}
                  {(showPrinterPropsDialog || showDocPropsDialog) && (
                    <div className="p-2 mt-2 bg-[#f0f9ff] border border-[#bae6fd] rounded-[2px] text-[10.5px] text-[#0369a1]">
                      {showPrinterPropsDialog ? (
                        <div>
                          <strong>{selectedPrinter?.name}</strong>
                          <div>DPI: {selectedPrinter?.dpi ? `${selectedPrinter.dpi} DPI` : 'Unknown'}</div>
                          <div>Driver: {selectedPrinter?.driverName || 'Windows GDI Spooler'}</div>
                          <div>Port: {selectedPrinter?.portName || selectedPrinter?.port || 'N/A'}</div>
                          <div>Status: {selectedPrinter?.status || 'Unknown'}</div>
                        </div>
                      ) : (
                        <div>Document target: {labelWidthMm} × {labelHeightMm} mm</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Stock Selection */}
          {currentStep === 3 && (
            <div className="flex items-start justify-between gap-4 h-full">
              <div className="flex-1 space-y-3">
                <p className="text-[11px] text-[#000000] leading-relaxed">
                  A Stock specifies the size of the page, and the size, number, and position of the items on the page. You may select a predefined Stock or specify your own custom settings.
                </p>

                <div className="pt-1 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="stockMode"
                      checked={stockMode === 'custom'}
                      onChange={() => setStockMode('custom')}
                      className="accent-[#0078d7]"
                    />
                    <span className="text-[11px] text-[#000000]">Specify Custom Settings</span>
                  </label>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="stockMode"
                        checked={stockMode === 'predefined'}
                        onChange={() => setStockMode('predefined')}
                        className="accent-[#0078d7]"
                      />
                      <span className="text-[11px] text-[#000000]">Use a Predefined Stock</span>
                    </label>

                    {/* Predefined dropdowns */}
                    <div className="pl-6 space-y-2 max-w-[340px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`w-18 shrink-0 ${stockMode === 'predefined' ? 'text-[#000000]' : 'text-[#888888]'}`}>
                          Category:
                        </span>
                        <select
                          disabled={stockMode !== 'predefined'}
                          value={selectedStockCategory}
                          onChange={(e) => {
                            setSelectedStockCategory(e.target.value);
                            const matching = BUILTIN_STOCK_PRESETS.find((s) => s.category === e.target.value);
                            if (matching) handleSelectStockPreset(matching);
                          }}
                          className="flex-1 h-[22px] px-1 border border-[#7a7a7a] rounded-[1px] bg-white text-[11px] disabled:bg-[#f1f5f9] disabled:text-[#888888]"
                        >
                          <option value="mrp">Thermal Roll — MRP & Retail</option>
                          <option value="shipping">Thermal Roll — Shipping & Logistics</option>
                          <option value="product">Thermal Roll — Product & Asset</option>
                          <option value="a4-sheet">Sheet Labels — A4 Multi-up</option>
                        </select>
                      </div>

                      <div className="flex items-start justify-between gap-2">
                        <span className={`w-18 pt-1 shrink-0 ${stockMode === 'predefined' ? 'text-[#000000]' : 'text-[#888888]'}`}>
                          Stock Name:
                        </span>
                        <div className="flex-1 h-[130px] border border-[#7a7a7a] rounded-[1px] bg-white overflow-y-auto">
                          {BUILTIN_STOCK_PRESETS.filter((s) => s.category === selectedStockCategory).map((s) => {
                            const isSelected = selectedStockId === s.id;
                            return (
                              <div
                                key={s.id}
                                onClick={() => {
                                  if (stockMode === 'predefined') handleSelectStockPreset(s);
                                }}
                                className={`px-2 py-1 cursor-pointer text-[11px] truncate ${
                                  isSelected && stockMode === 'predefined'
                                    ? 'bg-[#3399ff] text-white'
                                    : 'text-[#000000] hover:bg-[#eef5fc]'
                                }`}
                              >
                                {s.name} ({s.widthMm} × {s.heightMm} mm)
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Media Tracking Type Selection */}
                  <div className="pt-2 border-t border-[#e5e5e5] space-y-1">
                    <div className="text-[11px] font-semibold text-[#000000]">Media Tracking Type:</div>
                    <div className="flex flex-wrap items-center gap-3 pl-2">
                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-[#000000]">
                        <input
                          type="radio"
                          name="wizardMediaType"
                          checked={selectedMediaType === 'gap'}
                          onChange={() => setSelectedMediaType('gap')}
                          className="accent-[#0078d7]"
                        />
                        <span>Die-Cut / Gap</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-[#000000]">
                        <input
                          type="radio"
                          name="wizardMediaType"
                          checked={selectedMediaType === 'continuous'}
                          onChange={() => setSelectedMediaType('continuous')}
                          className="accent-[#0078d7]"
                        />
                        <span>Continuous Roll</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-[#000000]">
                        <input
                          type="radio"
                          name="wizardMediaType"
                          checked={selectedMediaType === 'black_mark'}
                          onChange={() => setSelectedMediaType('black_mark')}
                          className="accent-[#0078d7]"
                        />
                        <span>Black Mark</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Preview Panel */}
              {renderLivePreview()}
            </div>
          )}

          {/* STEP 4: Items Per Page */}
          {currentStep === 4 && (
            <div className="flex items-start justify-between gap-4 h-full">
              <div className="flex-1 space-y-4">
                <p className="text-[11px] text-[#000000] leading-relaxed">
                  Specify whether the page contains a single item or multiple rows/columns of items.
                </p>

                <div className="space-y-3 pl-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="itemsMode"
                      checked={itemsMode === 'single'}
                      onChange={() => {
                        setItemsMode('single');
                        setRows(1);
                        setColumns(1);
                        setPageWidthMm(labelWidthMm);
                        setPageHeightMm(labelHeightMm);
                      }}
                      className="mt-0.5 accent-[#0078d7]"
                    />
                    <div>
                      <div className="font-semibold text-[#000000]">Single item per page</div>
                      <div className="text-[11px] text-[#555555]">Standard continuous roll or individual die-cut label.</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="itemsMode"
                      checked={itemsMode === 'multiple'}
                      onChange={() => {
                        setItemsMode('multiple');
                        const newCols = Math.max(1, columns);
                        const newRows = Math.max(1, rows);
                        setPageWidthMm(newCols * labelWidthMm + (newCols - 1) * horizontalGapMm + marginLeft + marginRight);
                        setPageHeightMm(newRows * labelHeightMm + (newRows - 1) * verticalGapMm + marginTop + marginBottom);
                      }}
                      className="mt-0.5 accent-[#0078d7]"
                    />
                    <div>
                      <div className="font-semibold text-[#000000]">Multiple columns and/or rows</div>
                      <div className="text-[11px] text-[#555555]">Labels arranged in a grid matrix on a sheet or multi-across roll.</div>
                    </div>
                  </label>

                  {itemsMode === 'multiple' && (
                    <div className="pl-6 pt-2 space-y-2 max-w-[280px]">
                      <div className="flex items-center justify-between">
                        <span className="text-[#000000]">Rows:</span>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={rows}
                          onChange={(e) => {
                            const newRows = Math.max(1, parseInt(e.target.value) || 1);
                            setRows(newRows);
                            setPageHeightMm(newRows * labelHeightMm + (newRows - 1) * verticalGapMm + marginTop + marginBottom);
                          }}
                          className="w-24 h-[22px] px-1 border border-[#7a7a7a] rounded-[1px] bg-white text-[11px] font-mono text-center"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#000000]">Columns:</span>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={columns}
                          onChange={(e) => {
                            const newCols = Math.max(1, parseInt(e.target.value) || 1);
                            setColumns(newCols);
                            setPageWidthMm(newCols * labelWidthMm + (newCols - 1) * horizontalGapMm + marginLeft + marginRight);
                          }}
                          className="w-24 h-[22px] px-1 border border-[#7a7a7a] rounded-[1px] bg-white text-[11px] font-mono text-center"
                        />
                      </div>
                      <div className="text-[10.5px] text-[#555555] pt-1">
                        Total: <strong>{rows * columns}</strong> items per page
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Live Preview Panel */}
              {renderLivePreview()}
            </div>
          )}

          {/* STEP 5: Page Size & Orientation */}
          {currentStep === 5 && (
            <div className="flex items-start justify-between gap-4 h-full">
              <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-[#000000] leading-relaxed">
                    Specify the physical page dimensions and printing orientation.
                  </p>
                  <div className="flex items-center gap-1 text-[10px] bg-slate-200 p-0.5 rounded shrink-0">
                    <button
                      type="button"
                      onClick={() => setUnit('mm')}
                      className={`px-1.5 py-0.5 rounded ${unit === 'mm' ? 'bg-white font-bold text-slate-900 shadow-2xs' : 'text-slate-600'}`}
                    >
                      mm
                    </button>
                    <button
                      type="button"
                      onClick={() => setUnit('inch')}
                      className={`px-1.5 py-0.5 rounded ${unit === 'inch' ? 'bg-white font-bold text-slate-900 shadow-2xs' : 'text-slate-600'}`}
                    >
                      inch
                    </button>
                  </div>
                </div>

                <div className="space-y-3 max-w-[340px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="w-24 shrink-0 text-[#000000]">Page Size:</span>
                    <select
                      value={pageSizeType}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPageSizeType(val);
                        let w = pageWidthMm;
                        let h = pageHeightMm;
                        if (val === 'a4') {
                          w = 210;
                          h = 297;
                        } else if (val === 'a5') {
                          w = 148;
                          h = 210;
                        } else if (val === 'letter') {
                          w = 215.9;
                          h = 279.4;
                        } else if (val === '4x6') {
                          w = 101.6;
                          h = 152.4;
                        }
                        setPageWidthMm(w);
                        setPageHeightMm(h);
                        if (itemsMode === 'single') {
                          setLabelWidthMm(w);
                          setLabelHeightMm(h);
                        }
                      }}
                      className="flex-1 h-[22px] px-1 border border-[#7a7a7a] rounded-[1px] bg-white text-[11px]"
                    >
                      <option value="user-defined">User Defined Size</option>
                      <option value="4x6">4" × 6" Shipping (101.6 × 152.4 mm)</option>
                      <option value="a4">A4 (210 × 297 mm)</option>
                      <option value="a5">A5 (148 × 210 mm)</option>
                      <option value="letter">Letter (8.5 × 11 in)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="w-24 shrink-0 text-[#000000]">Width:</span>
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        type="number"
                        step={unit === 'inch' ? '0.01' : '0.1'}
                        min={unit === 'inch' ? '0.2' : '5'}
                        value={unit === 'inch' ? parseFloat((pageWidthMm / 25.4).toFixed(3)) : parseFloat(pageWidthMm.toFixed(2))}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const mmVal = unit === 'inch' ? val * 25.4 : val;
                          setPageWidthMm(mmVal);
                          if (itemsMode === 'single') {
                            setLabelWidthMm(mmVal);
                          }
                        }}
                        className="w-28 h-[22px] px-1 border border-[#7a7a7a] rounded-[1px] bg-white text-[11px] font-mono text-right"
                      />
                      <span>{unit}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="w-24 shrink-0 text-[#000000]">Height:</span>
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        type="number"
                        step={unit === 'inch' ? '0.01' : '0.1'}
                        min={unit === 'inch' ? '0.2' : '5'}
                        value={unit === 'inch' ? parseFloat((pageHeightMm / 25.4).toFixed(3)) : parseFloat(pageHeightMm.toFixed(2))}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const mmVal = unit === 'inch' ? val * 25.4 : val;
                          setPageHeightMm(mmVal);
                          if (itemsMode === 'single') {
                            setLabelHeightMm(mmVal);
                          }
                        }}
                        className="w-28 h-[22px] px-1 border border-[#7a7a7a] rounded-[1px] bg-white text-[11px] font-mono text-right"
                      />
                      <span>{unit}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#dcdcdc]">
                    <div className="font-bold text-[#000000] mb-2">Orientation:</div>
                    <div className="grid grid-cols-2 gap-2 pl-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="orientation"
                          checked={orientation === 'portrait'}
                          onChange={() => setOrientation('portrait')}
                          className="accent-[#0078d7]"
                        />
                        <span>Portrait</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="orientation"
                          checked={orientation === 'landscape'}
                          onChange={() => setOrientation('landscape')}
                          className="accent-[#0078d7]"
                        />
                        <span>Landscape</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="orientation"
                          checked={orientation === 'portrait-180'}
                          onChange={() => setOrientation('portrait-180')}
                          className="accent-[#0078d7]"
                        />
                        <span>Portrait 180°</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="orientation"
                          checked={orientation === 'landscape-180'}
                          onChange={() => setOrientation('landscape-180')}
                          className="accent-[#0078d7]"
                        />
                        <span>Landscape 180°</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Preview Panel */}
              {renderLivePreview()}
            </div>
          )}

          {/* STEP 6: Margins */}
          {currentStep === 6 && (
            <div className="flex items-start justify-between gap-4 h-full">
              <div className="flex-1 space-y-4">
                <p className="text-[11px] text-[#000000] leading-relaxed">
                  Specify the margins around the edges of the page that cannot be printed on.
                </p>

                <div className="space-y-3 max-w-[320px] pl-2">
                  <div className="font-bold text-[#000000]">Unused / Margin Area:</div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <span>Left:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={marginLeft}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setMarginLeft(val);
                            if (itemsMode === 'multiple') {
                              setPageWidthMm(columns * labelWidthMm + (columns - 1) * horizontalGapMm + val + marginRight);
                            }
                          }}
                          className="w-18 h-[22px] px-1 border border-[#7a7a7a] rounded-[1px] bg-white text-[11px] font-mono text-right"
                        />
                        <span>mm</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span>Right:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={marginRight}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setMarginRight(val);
                            if (itemsMode === 'multiple') {
                              setPageWidthMm(columns * labelWidthMm + (columns - 1) * horizontalGapMm + marginLeft + val);
                            }
                          }}
                          className="w-18 h-[22px] px-1 border border-[#7a7a7a] rounded-[1px] bg-white text-[11px] font-mono text-right"
                        />
                        <span>mm</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span>Top:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={marginTop}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setMarginTop(val);
                            if (itemsMode === 'multiple') {
                              setPageHeightMm(rows * labelHeightMm + (rows - 1) * verticalGapMm + val + marginBottom);
                            }
                          }}
                          className="w-18 h-[22px] px-1 border border-[#7a7a7a] rounded-[1px] bg-white text-[11px] font-mono text-right"
                        />
                        <span>mm</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span>Bottom:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={marginBottom}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setMarginBottom(val);
                            if (itemsMode === 'multiple') {
                              setPageHeightMm(rows * labelHeightMm + (rows - 1) * verticalGapMm + marginTop + val);
                            }
                          }}
                          className="w-18 h-[22px] px-1 border border-[#7a7a7a] rounded-[1px] bg-white text-[11px] font-mono text-right"
                        />
                        <span>mm</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Preview Panel */}
              {renderLivePreview()}
            </div>
          )}

          {/* STEP 7: Label Shape */}
          {currentStep === 7 && (
            <div className="flex items-start justify-between gap-4 h-full">
              <div className="flex-1 space-y-4">
                <p className="text-[11px] text-[#000000] leading-relaxed">
                  Select the physical shape of the label.
                </p>

                <div className="space-y-2.5 pl-2 max-w-[280px]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="labelShape"
                      checked={labelShape === 'rectangle'}
                      onChange={() => setLabelShape('rectangle')}
                      className="accent-[#0078d7]"
                    />
                    <span className="font-medium text-[#111111]">Rectangle</span>
                    <span className="text-[10px] text-slate-500">(90° Corners)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="labelShape"
                      checked={labelShape === 'rounded'}
                      onChange={() => setLabelShape('rounded')}
                      className="accent-[#0078d7]"
                    />
                    <span className="font-medium text-[#111111]">Rounded Rectangle</span>
                  </label>

                  {labelShape === 'rounded' && (
                    <div className="pl-6 py-1 flex items-center gap-2 bg-[#f4f7fa] p-2 border border-slate-300 rounded-[2px]">
                      <span className="text-[11px]">Corner Radius:</span>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="20"
                        value={cornerRadiusMm}
                        onChange={(e) => setCornerRadiusMm(parseFloat(e.target.value) || 1.5)}
                        className="w-16 h-[22px] px-1 border border-[#7a7a7a] rounded-[1px] bg-white text-[11px] font-mono text-right"
                      />
                      <span className="text-[11px]">mm</span>
                    </div>
                  )}

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="labelShape"
                      checked={labelShape === 'ellipse'}
                      onChange={() => setLabelShape('ellipse')}
                      className="accent-[#0078d7]"
                    />
                    <span className="font-medium text-[#111111]">Ellipse</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="labelShape"
                      checked={labelShape === 'circle'}
                      onChange={() => setLabelShape('circle')}
                      className="accent-[#0078d7]"
                    />
                    <span className="font-medium text-[#111111]">Circle</span>
                  </label>
                </div>
              </div>

              {/* Live Preview Panel */}
              {renderLivePreview()}
            </div>
          )}

          {/* STEP 8: Size & Gap */}
          {currentStep === 8 && (
            <div className="flex items-start justify-between gap-4 h-full">
              <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-[#000000] leading-relaxed">
                    Specify the size of the template and the spacing between items.
                  </p>
                  <div className="flex items-center gap-1 text-[10px] bg-slate-200 p-0.5 rounded shrink-0">
                    <button
                      type="button"
                      onClick={() => setUnit('mm')}
                      className={`px-1.5 py-0.5 rounded ${unit === 'mm' ? 'bg-white font-bold text-slate-900 shadow-2xs' : 'text-slate-600'}`}
                    >
                      mm
                    </button>
                    <button
                      type="button"
                      onClick={() => setUnit('inch')}
                      className={`px-1.5 py-0.5 rounded ${unit === 'inch' ? 'bg-white font-bold text-slate-900 shadow-2xs' : 'text-slate-600'}`}
                    >
                      inch
                    </button>
                  </div>
                </div>

                <div className="space-y-3 max-w-[320px] pl-2">
                  <div className="space-y-2">
                    <div className="font-bold text-[#000000]">Template Size:</div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Width:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step={unit === 'inch' ? '0.01' : '0.1'}
                          min={unit === 'inch' ? '0.2' : '5'}
                          value={unit === 'inch' ? parseFloat((labelWidthMm / 25.4).toFixed(3)) : parseFloat(labelWidthMm.toFixed(2))}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const mmVal = unit === 'inch' ? val * 25.4 : val;
                            setLabelWidthMm(mmVal);
                            if (itemsMode === 'single') {
                              setPageWidthMm(mmVal);
                            } else {
                              setPageWidthMm(columns * mmVal + (columns - 1) * horizontalGapMm + marginLeft + marginRight);
                            }
                          }}
                          className="w-22 h-[22px] px-1 border border-[#7a7a7a] rounded-[1px] bg-white text-[11px] font-mono text-right"
                        />
                        <span>{unit}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Height:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step={unit === 'inch' ? '0.01' : '0.1'}
                          min={unit === 'inch' ? '0.2' : '5'}
                          value={unit === 'inch' ? parseFloat((labelHeightMm / 25.4).toFixed(3)) : parseFloat(labelHeightMm.toFixed(2))}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const mmVal = unit === 'inch' ? val * 25.4 : val;
                            setLabelHeightMm(mmVal);
                            if (itemsMode === 'single') {
                              setPageHeightMm(mmVal);
                            } else {
                              setPageHeightMm(rows * mmVal + (rows - 1) * verticalGapMm + marginTop + marginBottom);
                            }
                          }}
                          className="w-22 h-[22px] px-1 border border-[#7a7a7a] rounded-[1px] bg-white text-[11px] font-mono text-right"
                        />
                        <span>{unit}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-[#dcdcdc]">
                    <div className="font-bold text-[#000000]">Gap / Pitch:</div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Horizontal:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step={unit === 'inch' ? '0.01' : '0.5'}
                          min="0"
                          value={unit === 'inch' ? parseFloat((horizontalGapMm / 25.4).toFixed(3)) : parseFloat(horizontalGapMm.toFixed(2))}
                          disabled={!manualGap}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const mmVal = unit === 'inch' ? val * 25.4 : val;
                            setHorizontalGapMm(mmVal);
                            if (itemsMode === 'multiple') {
                              setPageWidthMm(columns * labelWidthMm + (columns - 1) * mmVal + marginLeft + marginRight);
                            }
                          }}
                          className="w-22 h-[22px] px-1 border border-[#7a7a7a] rounded-[1px] bg-white text-[11px] font-mono text-right disabled:bg-[#f1f5f9]"
                        />
                        <span>{unit}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Vertical:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step={unit === 'inch' ? '0.01' : '0.5'}
                          min="0"
                          value={unit === 'inch' ? parseFloat((verticalGapMm / 25.4).toFixed(3)) : parseFloat(verticalGapMm.toFixed(2))}
                          disabled={!manualGap}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const mmVal = unit === 'inch' ? val * 25.4 : val;
                            setVerticalGapMm(mmVal);
                            if (itemsMode === 'multiple') {
                              setPageHeightMm(rows * labelHeightMm + (rows - 1) * mmVal + marginTop + marginBottom);
                            }
                          }}
                          className="w-22 h-[22px] px-1 border border-[#7a7a7a] rounded-[1px] bg-white text-[11px] font-mono text-right disabled:bg-[#f1f5f9]"
                        />
                        <span>{unit}</span>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer pt-0.5">
                      <input
                        type="checkbox"
                        checked={manualGap}
                        onChange={(e) => setManualGap(e.target.checked)}
                        className="accent-[#0078d7]"
                      />
                      <span>Set manually</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Live Preview Panel */}
              {renderLivePreview()}
            </div>
          )}

          {/* STEP 9: Print Order */}
          {currentStep === 9 && (
            <div className="flex items-start justify-between gap-4 h-full">
              <div className="flex-1 space-y-4">
                <p className="text-[11px] text-[#000000] leading-relaxed">
                  Specify the order in which items are printed on the page.
                </p>

                <div className="space-y-3 max-w-[320px] pl-2">
                  <div className="font-bold text-[#000000]">Printing Order:</div>

                  <div className="flex items-center justify-between gap-2">
                    <span>Starting Corner:</span>
                    <select
                      value={printCorner}
                      onChange={(e) => setPrintCorner(e.target.value as PrintCorner)}
                      className="w-32 h-[22px] px-1 border border-[#7a7a7a] rounded-[1px] bg-white text-[11px]"
                    >
                      <option value="top-left">Top Left</option>
                      <option value="top-right">Top Right</option>
                      <option value="bottom-left">Bottom Left</option>
                      <option value="bottom-right">Bottom Right</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span>Direction:</span>
                    <select
                      value={printDirection}
                      onChange={(e) => setPrintDirection(e.target.value as PrintDirection)}
                      className="w-32 h-[22px] px-1 border border-[#7a7a7a] rounded-[1px] bg-white text-[11px]"
                    >
                      <option value="horizontal">Horizontal</option>
                      <option value="vertical">Vertical</option>
                    </select>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-[#dcdcdc]">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectStartAtPrint}
                        onChange={(e) => setSelectStartAtPrint(e.target.checked)}
                        className="accent-[#0078d7]"
                      />
                      <span>Select starting position at print time</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={continueFromPrevious}
                        onChange={(e) => setContinueFromPrevious(e.target.checked)}
                        className="accent-[#0078d7]"
                      />
                      <span>Continue from last position of previous job</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Live Preview Panel */}
              {renderLivePreview()}
            </div>
          )}

          {/* STEP 10: Background */}
          {currentStep === 10 && (
            <div className="flex items-start justify-between gap-4 h-full">
              <div className="flex-1 space-y-4">
                <p className="text-[11px] text-[#000000] leading-relaxed">
                  Specify background color or reference image options for the document.
                </p>

                <div className="space-y-3 pl-2 max-w-[340px]">
                  <div className="font-bold text-[#000000]">Background Features:</div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useBgColor}
                      onChange={(e) => setUseBgColor(e.target.checked)}
                      className="accent-[#0078d7]"
                    />
                    <span>Color</span>
                  </label>

                  {useBgColor && (
                    <div className="pl-6 flex items-center gap-2">
                      <input
                        type="color"
                        value={bgColor}
                        onChange={(e) => setBgColor(e.target.value)}
                        className="w-8 h-[22px] p-0 border border-[#7a7a7a] rounded-[1px] cursor-pointer"
                      />
                      <input
                        type="text"
                        value={bgColor}
                        onChange={(e) => setBgColor(e.target.value)}
                        className="w-24 h-[22px] px-1 border border-[#7a7a7a] rounded-[1px] text-[11px] font-mono"
                      />
                    </div>
                  )}

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useBgImage}
                      onChange={(e) => setUseBgImage(e.target.checked)}
                      className="accent-[#0078d7]"
                    />
                    <span>Picture / Template Image</span>
                  </label>

                  {useBgImage && (
                    <div className="pl-6 space-y-2">
                      <input
                        type="text"
                        placeholder="Enter image file path or URL..."
                        value={bgImageUrl}
                        onChange={(e) => setBgImageUrl(e.target.value)}
                        className="w-full h-[22px] px-1 border border-[#7a7a7a] rounded-[1px] text-[11px]"
                      />
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showBgInDesigner}
                          onChange={(e) => setShowBgInDesigner(e.target.checked)}
                          className="accent-[#0078d7]"
                        />
                        <span>Show in Designer as layout guide</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Live Preview Panel */}
              {renderLivePreview()}
            </div>
          )}

          {/* STEP 11: Summary (Split Layout: Properties Table on Left + Live BarTender Roll Preview on Right) */}
          {currentStep === 11 && (
            <div className="flex items-start justify-between gap-5 h-full">
              <div className="flex-1 space-y-3">
                <p className="text-[11px] text-[#000000] leading-relaxed">
                  Review the document properties before creating the new label.
                </p>

                <div className="border border-[#7a7a7a] bg-white rounded-[1px] p-3 w-full shadow-inner">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <tbody>
                      <tr className="border-b border-[#e5e5e5]">
                        <td className="w-28 py-1 text-[#666666]">Printer:</td>
                        <td className="py-1 font-semibold text-[#000000]">{selectedPrinter?.name || 'Default Printer'}</td>
                      </tr>
                      <tr className="border-b border-[#e5e5e5]">
                        <td className="py-1 text-[#666666]">DPI:</td>
                        <td className="py-1 font-mono text-[#000000]">{selectedPrinter?.dpi || 203} DPI</td>
                      </tr>
                      <tr className="border-b border-[#e5e5e5]">
                        <td className="py-1 text-[#666666]">Label Size:</td>
                        <td className="py-1 font-mono text-[#000000]">
                          {labelWidthMm.toFixed(1)} × {labelHeightMm.toFixed(1)} mm
                          <span className="text-slate-500 font-normal ml-1">
                            ({(labelWidthMm / 25.4).toFixed(2)} × {(labelHeightMm / 25.4).toFixed(2)} in)
                          </span>
                        </td>
                      </tr>
                      <tr className="border-b border-[#e5e5e5]">
                        <td className="py-1 text-[#666666]">Page Size:</td>
                        <td className="py-1 font-mono text-[#000000]">
                          {pageWidthMm.toFixed(1)} × {pageHeightMm.toFixed(1)} mm
                          <span className="text-slate-500 font-normal ml-1">
                            ({(pageWidthMm / 25.4).toFixed(2)} × {(pageHeightMm / 25.4).toFixed(2)} in)
                          </span>
                        </td>
                      </tr>
                      <tr className="border-b border-[#e5e5e5]">
                        <td className="py-1 text-[#666666]">Media:</td>
                        <td className="py-1 text-[#000000]">
                          {rows * columns > 1
                            ? `${rows}×${columns} Multi-up (${selectedMediaType})`
                            : selectedMediaType === 'continuous'
                            ? 'Continuous Roll'
                            : selectedMediaType === 'black_mark'
                            ? 'Black Mark Label'
                            : 'Die-Cut Gap Label'}
                        </td>
                      </tr>
                      <tr className="border-b border-[#e5e5e5]">
                        <td className="py-1 text-[#666666]">Margins:</td>
                        <td className="py-1 font-mono text-[#000000]">L:{marginLeft} R:{marginRight} T:{marginTop} B:{marginBottom} mm</td>
                      </tr>
                      <tr className="border-b border-[#e5e5e5]">
                        <td className="py-1 text-[#666666]">Gap:</td>
                        <td className="py-1 font-mono text-[#000000]">H:{horizontalGapMm}mm, V:{verticalGapMm}mm</td>
                      </tr>
                      <tr className="border-b border-[#e5e5e5]">
                        <td className="py-1 text-[#666666]">Orientation:</td>
                        <td className="py-1 capitalize text-[#000000]">{orientation}</td>
                      </tr>
                      <tr className="border-b border-[#e5e5e5]">
                        <td className="py-1 text-[#666666]">Shape:</td>
                        <td className="py-1 capitalize text-[#000000]">{labelShape}</td>
                      </tr>
                      <tr>
                        <td className="py-1 text-[#666666]">Print Order:</td>
                        <td className="py-1 capitalize text-[#000000]">{printCorner} / {printDirection}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* BarTender Live Roll / Sheet Preview */}
              {renderLivePreview()}
            </div>
          )}

          {/* STEP 12: Finish */}
          {currentStep === 12 && (
            <div className="space-y-4">
              <p className="text-[11px] text-[#000000] leading-relaxed">
                Ready to create label document.
              </p>

              <div className="space-y-2 pl-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAsPreset}
                    onChange={(e) => setSaveAsPreset(e.target.checked)}
                    className="accent-[#0078d7]"
                  />
                  <span>Save these settings as a reusable preset</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={setAsPrinterDefault}
                    onChange={(e) => setSetAsPrinterDefault(e.target.checked)}
                    className="accent-[#0078d7]"
                  />
                  <span>Set as default for this printer</span>
                </label>
              </div>

              <p className="text-[11px] text-[#555555] pt-2">
                Click <strong>Finish</strong> to create your document and initialize the Designer.
              </p>
            </div>
          )}

          {/* Validation Error Message */}
          {validationError && (
            <div className="mt-3 p-1.5 bg-[#fef2f2] border border-[#f87171] rounded-[1px] text-[11px] text-[#b91c1c] flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[#dc2626]" />
              <span>{validationError}</span>
            </div>
          )}
        </div>

        {/* Real Classic Win32 Bottom Command Button Bar */}
        <div className="h-[42px] px-3 bg-[#f0f0f0] border-t border-[#d5d5d5] flex items-center justify-end gap-1.5 sm:gap-2 shrink-0 overflow-x-auto no-scrollbar">
          {/* < Back Button */}
          <button
            type="button"
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
            disabled={currentStep === 1}
            className="w-[68px] sm:w-[75px] h-[23px] bg-gradient-to-b from-[#f2f2f2] to-[#e1e1e1] hover:from-[#e5f1fb] hover:to-[#d0e5f7] active:from-[#cce4f7] active:to-[#b9daf4] disabled:opacity-40 disabled:hover:from-[#f2f2f2] disabled:hover:to-[#e1e1e1] border border-[#707070] rounded-[2px] text-[11px] text-[#000000] shadow-2xs shrink-0"
          >
            &lt; Back
          </button>

          {/* Next > Button (Default focus with blue accent ring) */}
          {currentStep < 12 && (
            <button
              type="button"
              onClick={() => {
                if (isCurrentStepValid) {
                  setCurrentStep((prev) => Math.min(12, prev + 1));
                }
              }}
              disabled={!isCurrentStepValid}
              className="w-[68px] sm:w-[75px] h-[23px] bg-gradient-to-b from-[#f8fafc] to-[#e2e8f0] hover:from-[#e5f1fb] hover:to-[#cce4f7] active:from-[#cce4f7] active:to-[#b9daf4] disabled:opacity-40 border-2 border-[#3399ff] rounded-[2px] text-[11px] font-normal text-[#000000] shadow-2xs shrink-0"
            >
              Next &gt;
            </button>
          )}

          {/* Finish Button */}
          <button
            type="button"
            onClick={handleFinishWizard}
            disabled={!isCurrentStepValid}
            className={`w-[68px] sm:w-[75px] h-[23px] bg-gradient-to-b from-[#f2f2f2] to-[#e1e1e1] hover:from-[#e5f1fb] hover:to-[#d0e5f7] active:from-[#cce4f7] active:to-[#b9daf4] disabled:opacity-40 rounded-[2px] text-[11px] text-[#000000] shadow-2xs shrink-0 ${
              currentStep === 12 ? 'border-2 border-[#3399ff]' : 'border border-[#707070]'
            }`}
          >
            Finish
          </button>

          {/* Cancel Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-[68px] sm:w-[75px] h-[23px] bg-gradient-to-b from-[#f2f2f2] to-[#e1e1e1] hover:from-[#e5f1fb] hover:to-[#d0e5f7] active:from-[#cce4f7] active:to-[#b9daf4] border border-[#707070] rounded-[2px] text-[11px] text-[#000000] shadow-2xs ml-0.5 sm:ml-1 shrink-0"
          >
            Cancel
          </button>
        </div>
      </div>

      {showDocPropsDialog && (
        <PageSetupModal
          isOpen={showDocPropsDialog}
          onClose={() => setShowDocPropsDialog(false)}
          template={{
            id: 'temp-doc-setup',
            name: 'Document Setup',
            description: '',
            category: 'Logistics',
            version: '1.0',
            status: 'draft',
            elements: [],
            variables: [],
            sampleRecords: [{}],
            tags: [],
            createdAt: '',
            updatedAt: '',
            createdBy: currentUser,
            dimensions: {
              width: labelWidthMm,
              height: labelHeightMm,
              dpi: (selectedPrinter?.dpi as any) || 203,
              orientation: orientation.includes('landscape') ? 'landscape' : 'portrait',
              unit: 'mm',
            },
            margins: {
              top: marginTop,
              right: marginRight,
              bottom: marginBottom,
              left: marginLeft,
              bleed: 0.5,
              safeZone: 1,
            },
            sheetGrid: {
              enabled: rows > 1 || columns > 1,
              rows,
              columns,
              gapHorizontal: horizontalGapMm,
              gapVertical: verticalGapMm,
              labelWidth: labelWidthMm,
              labelHeight: labelHeightMm,
              marginTop,
              marginLeft,
            },
          }}
          onApplyPageSetup={(updates) => {
            setLabelWidthMm(updates.dimensions.width);
            setLabelHeightMm(updates.dimensions.height);
            setOrientation(updates.dimensions.orientation as any);
            setMarginTop(updates.margins.top);
            setMarginRight(updates.margins.right);
            setMarginBottom(updates.margins.bottom);
            setMarginLeft(updates.margins.left);
            if (updates.sheetGrid) {
              setRows(updates.sheetGrid.rows || 1);
              setColumns(updates.sheetGrid.columns || 1);
              setHorizontalGapMm(updates.sheetGrid.gapHorizontal || 0);
              setVerticalGapMm(updates.sheetGrid.gapVertical || 0);
              setItemsMode((updates.sheetGrid.rows || 1) > 1 || (updates.sheetGrid.columns || 1) > 1 ? 'multiple' : 'single');
            }
            if (updates.shape) {
              setLabelShape(updates.shape as any);
            }
            if (updates.cornerRadius !== undefined) {
              setCornerRadiusMm(updates.cornerRadius);
            }
            if (updates.mediaType) {
              setSelectedMediaType(updates.mediaType);
            }
            setShowDocPropsDialog(false);
          }}
        />
      )}
    </div>
  );
};

// Helper to pre-populate industrial 50x25 MRP elements
function createMRP50x25Elements(): LabelElement[] {
  return [
    // Header Company Name
    {
      id: 'el-header',
      name: 'Company Header',
      type: 'text',
      text: 'ACME HEALTHCARE & PHARMA LTD',
      dataBinding: 'ACME HEALTHCARE & PHARMA LTD',
      fontSize: 6.5,
      fontFamily: 'Arial',
      fontWeight: 'bold',
      fontStyle: 'normal',
      textDecoration: 'none',
      lineHeight: 1.15,
      letterSpacing: 0.2,
      verticalAlign: 'middle',
      color: '#000000',
      textAlign: 'left',
      x: 2,
      y: 1.5,
      width: 46,
      height: 2.8,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: 1,
    },
    // Divider line
    {
      id: 'el-div-1',
      name: 'Header Divider',
      type: 'shape',
      shapeType: 'line',
      strokeColor: '#000000',
      strokeWidth: 0.3,
      strokeStyle: 'solid',
      cornerRadius: 0,
      fillColor: 'transparent',
      x: 2,
      y: 4.5,
      width: 46,
      height: 0.3,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: 1,
    },
    // MRP Text
    {
      id: 'el-mrp',
      name: 'MRP Text',
      type: 'text',
      text: 'MRP: ₹120.00 (Incl. of all taxes)',
      dataBinding: 'MRP: {MRP_PRICE} (Incl. Taxes)',
      fontSize: 7.5,
      fontFamily: 'Arial',
      fontWeight: 'bold',
      fontStyle: 'normal',
      textDecoration: 'none',
      lineHeight: 1.15,
      letterSpacing: 0,
      verticalAlign: 'middle',
      color: '#000000',
      textAlign: 'left',
      x: 2,
      y: 5.5,
      width: 46,
      height: 3.5,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: 2,
    },
    // Batch and MFG
    {
      id: 'el-batch',
      name: 'Batch and Dates',
      type: 'text',
      text: 'B.No: B001  MFG: 09/2026  EXP: 09/2027',
      dataBinding: 'B.No: {BATCH_NO}  MFG: {MFG_DATE}  EXP: {EXP_DATE}',
      fontSize: 6.5,
      fontFamily: 'Arial',
      fontWeight: 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
      lineHeight: 1.15,
      letterSpacing: 0,
      verticalAlign: 'middle',
      color: '#1e293b',
      textAlign: 'left',
      x: 2,
      y: 9.5,
      width: 46,
      height: 3,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: 3,
    },
    // Code128 Barcode
    {
      id: 'el-barcode',
      name: 'EAN/Code128 Barcode',
      type: 'barcode',
      symbology: 'code128',
      value: '8901030999012',
      dataBinding: '{BARCODE_VAL}',
      includeText: true,
      textPosition: 'below',
      barWidth: 1.5,
      barHeight: 7.5,
      quietZone: true,
      foregroundColor: '#000000',
      backgroundColor: '#ffffff',
      checkDigit: false,
      x: 2,
      y: 13.5,
      width: 32,
      height: 10,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: 4,
    },
    // 2D QR Code on the right
    {
      id: 'el-qr',
      name: 'Verify QR Code',
      type: 'barcode',
      symbology: 'qr',
      value: 'https://verify.mfg/track/8901030999012',
      dataBinding: 'https://verify.mfg/track/{BARCODE_VAL}',
      includeText: false,
      textPosition: 'none',
      barWidth: 2,
      barHeight: 9,
      quietZone: false,
      foregroundColor: '#000000',
      backgroundColor: '#ffffff',
      checkDigit: false,
      errorCorrectionLevel: 'M',
      x: 37,
      y: 13.5,
      width: 10,
      height: 10,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: 5,
    },
  ];
}

// Helper to pre-populate industrial 4x6 Shipping carton elements
function createShipping4x6Elements(): LabelElement[] {
  return [
    {
      id: 'el-ship-from',
      name: 'Ship From Header',
      type: 'text',
      text: 'SHIP FROM:\nGLOBAL LOGISTICS HUB #4\n100 INDUSTRIAL PKWY, SECTOR 5',
      fontSize: 9,
      fontFamily: 'Arial',
      fontWeight: 'bold',
      fontStyle: 'normal',
      textDecoration: 'none',
      lineHeight: 1.2,
      letterSpacing: 0,
      verticalAlign: 'top',
      color: '#000000',
      textAlign: 'left',
      multiline: true,
      x: 5,
      y: 5,
      width: 90,
      height: 16,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: 1,
    },
    {
      id: 'el-ship-div-1',
      name: 'Divider 1',
      type: 'shape',
      shapeType: 'line',
      strokeColor: '#000000',
      strokeWidth: 0.8,
      strokeStyle: 'solid',
      cornerRadius: 0,
      fillColor: '#000000',
      x: 5,
      y: 23,
      width: 91.6,
      height: 0.8,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: 2,
    },
    {
      id: 'el-ship-to',
      name: 'Ship To Destination',
      type: 'text',
      text: 'SHIP TO:\nAPEX FULFILLMENT DISTRIBUTION CTR\nDOCK 12, BUILDING B\nCHICAGO IL 60601',
      fontSize: 11,
      fontFamily: 'Arial',
      fontWeight: 'bold',
      fontStyle: 'normal',
      textDecoration: 'none',
      lineHeight: 1.2,
      letterSpacing: 0,
      verticalAlign: 'top',
      color: '#000000',
      textAlign: 'left',
      multiline: true,
      x: 5,
      y: 26,
      width: 90,
      height: 25,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: 3,
    },
    {
      id: 'el-ship-div-2',
      name: 'Divider 2',
      type: 'shape',
      shapeType: 'line',
      strokeColor: '#000000',
      strokeWidth: 0.8,
      strokeStyle: 'solid',
      cornerRadius: 0,
      fillColor: '#000000',
      x: 5,
      y: 54,
      width: 91.6,
      height: 0.8,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: 4,
    },
    {
      id: 'el-ship-barcode',
      name: 'SSCC-18 Pallet Barcode',
      type: 'barcode',
      symbology: 'code128',
      value: '(00) 0 0850006 531238901 2',
      includeText: true,
      textPosition: 'below',
      barWidth: 2,
      barHeight: 28,
      quietZone: true,
      foregroundColor: '#000000',
      backgroundColor: '#ffffff',
      checkDigit: true,
      x: 10,
      y: 60,
      width: 80,
      height: 38,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: 5,
    },
  ];
}
