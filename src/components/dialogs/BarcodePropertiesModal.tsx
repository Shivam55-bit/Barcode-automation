import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LabelElement, BarcodeElement, BarcodeSymbology, DataSourceItem, DataSourceType, TransformRule, GS1Field, TransformConfig, HumanReadableConfig } from '../../types';
import { SYMBOLOGY_CATALOG, calculateBarcodeLayout } from '../../services/barcodeEngine';
import { evaluateElementData, formatCustomDate } from '../../services/dataSourceEngine';
import {
  GS1_AI_DICTIONARY,
  calculateGS1CheckDigit,
  validateGS1CheckDigit,
  parseGS1BracketedString,
} from '../../services/gs1Engine';
import {
  X,
  Minus,
  Square,
  Copy,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Sparkles,
  Database,
  Sliders,
  Check,
  Globe,
  Layers,
  BarChart2,
  Calendar,
  Hash,
  Clock,
  Link as LinkIcon,
  Code2,
  ChevronDown,
  Search,
  Printer,
  SlidersHorizontal,
  HelpCircle,
  Edit3,
} from 'lucide-react';

import { GS1ApplicationIdentifierWizardModal } from './GS1ApplicationIdentifierWizardModal';
import { DatabaseFieldSourceConfig } from './DatabaseFieldSourceConfig';
import { NewDataSourceWizardModal } from './NewDataSourceWizardModal';
import { SerializationModal } from './SerializationModal';
import { SpecialCharacterModal } from './SpecialCharacterModal';
import { insertAtSelection, getDataSourceDisplayPreview } from '../../services/controlCharacterService';
import { AdvancedXDimensionModal } from './AdvancedXDimensionModal';
import { SelectVisibleDataSourcesModal } from './SelectVisibleDataSourcesModal';
import { PropertyTree } from './PropertyTree';
import {
  buildPropertyTree,
  PropertyTreeNode,
  PropertyScope,
} from '../../services/propertyTreeService';
import {
  getBarcodeCapability,
  SYMBOLOGY_FULL_METADATA_CATALOG,
  CATEGORIZED_SYMBOLOGY_GROUPS,
} from '../../services/barcodeCapabilityRegistry';
import {
  TEXT_ENCODING_CODEPAGES,
  BarcodeTextEncoding,
} from '../../services/barcodeTextEncodingService';
import {
  calculateActualXDimension,
  calculateBarcodeDensity,
} from '../../services/xDimensionEngine';

import {
  SuppressionModal,
  CharacterFilterModal,
  TruncationModal,
  CharacterLengthModal,
  CharacterTemplateModal,
  SearchReplaceModal,
  ScriptTransformModal,
  PrefixSuffixModal,
} from './TransformSubModals';
import { evaluateSerializedValue } from '../../services/serializationEngine';
import { ProfessionalDataSourceConfig } from './ProfessionalDataSourceConfig';
import { NamedDataSource, CalculatedFieldDefinition } from '../../types';

interface BarcodePropertiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  element: LabelElement | null;
  allElements?: LabelElement[];
  selectedElementIds?: string[];
  onSelectElement?: (id: string) => void;
  activeDocumentName?: string;
  onUpdateElement: (id: string, updates: Partial<LabelElement>) => void;
  availableVariables?: Array<{ name: string; label?: string; sampleValue?: string }>;
  onOpenGs1Wizard?: () => void;
  datasets?: any[];
  currentRecord?: Record<string, any>;
  currentConnection?: any;
  onConnectDataset?: (dataset: any) => void;
  initialCategory?: PropertyCategory | string;
  initialDataSourceIndex?: number;
  namedDataSources?: NamedDataSource[];
  calculatedFields?: CalculatedFieldDefinition[];
  globalData?: Record<string, any>;
  currentRecordIndex?: number;
  totalRecords?: number;
  printerName?: string;
  jobId?: string;
  jobName?: string;
}

export type PropertyCategory =
  | 'symbology'
  | 'human-readable'
  | 'font'
  | 'text-format'
  | 'autofit'
  | 'border'
  | 'position'
  | 'fill'
  | 'line'
  | 'image'
  | 'error-handling'
  | 'datasources'
  | 'datasource-item';

type DataSourceTab = 'source' | 'type' | 'transforms';

export const BarcodePropertiesModal: React.FC<BarcodePropertiesModalProps> = ({
  isOpen,
  onClose,
  element,
  allElements = [],
  selectedElementIds = [],
  onSelectElement,
  activeDocumentName,
  onUpdateElement,
  availableVariables = [],
  onOpenGs1Wizard,
  datasets,
  currentRecord,
  currentConnection,
  onConnectDataset,
  initialCategory,
  initialDataSourceIndex,
  namedDataSources = [],
  calculatedFields = [],
  globalData = {},
  currentRecordIndex = 0,
  totalRecords = 1,
  printerName = 'Default Zebra ZT410',
  jobId = 'JOB-001',
  jobName = 'PrintJob_1',
}) => {
  const [selectedCategory, setSelectedCategory] = useState<PropertyCategory>('datasource-item');
  const [activeDsIndex, setActiveDsIndex] = useState<number>(0);
  const [activeDsTab, setActiveDsTab] = useState<DataSourceTab>('source');
  const [isAddMenuOpen, setIsAddMenuOpen] = useState<boolean>(false);
  const [isGs1AiWizardOpen, setIsGs1AiWizardOpen] = useState<boolean>(false);
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  // Multi-Object Scope and Tree State (BarTender Standard Architecture)
  const [propertyScope, setPropertyScope] = useState<PropertyScope>('selected');
  const [activeObjectId, setActiveObjectId] = useState<string>(element?.id || '');
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());

  // Determine active element safely
  const elementsList = useMemo(() => {
    if (allElements && allElements.length > 0) return allElements;
    return element ? [element] : [];
  }, [allElements, element]);

  const activeElement = useMemo(() => {
    return elementsList.find((e) => e.id === activeObjectId) || element;
  }, [elementsList, activeObjectId, element]);

  useEffect(() => {
    if (element?.id && isOpen) {
      setActiveObjectId(element.id);
    }
  }, [element?.id, isOpen]);

  useEffect(() => {
    if (isOpen && elementsList.length > 0) {
      const allIds = new Set<string>();
      elementsList.forEach((el) => {
        allIds.add(el.id);
        allIds.add(`${el.id}::dataSources`);
        allIds.add(`${el.id}::datasources`);
      });
      setExpandedNodeIds(allIds);
    }
  }, [isOpen, elementsList]);

  // Sub-modal state for BarTender Transforms & Serialization
  const [activeTransformModal, setActiveTransformModal] = useState<
    'suppression' | 'filter' | 'truncation' | 'length' | 'template' | 'searchReplace' | 'script' | 'serialization' | 'prefixSuffix' | null
  >(null);

  // Special Characters / Symbols Modal
  const [isSpecialCharModalOpen, setIsSpecialCharModalOpen] = useState<boolean>(false);
  const barcodeEmbeddedTextareaRef = useRef<HTMLTextAreaElement>(null);
  const barcodeSavedSelectionRef = useRef<{
    start: number;
    end: number;
    sourceId: string;
    sourceIndex: number;
  }>({ start: 0, end: 0, sourceId: '', sourceIndex: 0 });

  // Snapshot ref for guaranteed Cancel Safety
  const initialSnapshotRef = useRef<BarcodeElement | null>(null);

  // Form local state mirrored from selected element
  const [name, setName] = useState('Barcode 2');
  const [symbology, setSymbology] = useState<BarcodeSymbology>('code128');
  const [value, setValue] = useState('12345678');
  const [dataSources, setDataSources] = useState<DataSourceItem[]>([]);

  // Symbology & Dimensions (BarTender Standard Architecture)
  const [xDimensionMm, setXDimensionMm] = useState<number>(0.38);
  const [lockXDimension, setLockXDimension] = useState<boolean>(false);
  const [xDimensionUnits, setXDimensionUnits] = useState<'mm' | 'mils' | 'auto'>('mm');
  const [autoSizeToWidth, setAutoSizeToWidth] = useState<boolean>(false);
  const [requestedWidthMm, setRequestedWidthMm] = useState<number>(50);
  const [minXDimensionMm, setMinXDimensionMm] = useState<number>(0.15);
  const [maxXDimensionMm, setMaxXDimensionMm] = useState<number>(1.5);
  const [ratioMode, setRatioMode] = useState<'auto' | 'standard' | 'custom' | 'manual'>('standard');
  const [ratio, setRatio] = useState<number>(2.5);
  const [density, setDensity] = useState<number>(2.6);
  const [heightMm, setHeightMm] = useState<number>(12.7);
  const [checkDigit, setCheckDigit] = useState<boolean>(true);
  const [checkDigitMode, setCheckDigitMode] = useState<'auto' | 'include' | 'exclude' | 'none' | 'manual'>('include');
  const [codeSet, setCodeSet] = useState<'Auto' | 'A' | 'B' | 'C' | 'auto'>('Auto');
  const [gs1Mode, setGs1Mode] = useState<boolean>(false);
  const [textEncoding, setTextEncoding] = useState<BarcodeTextEncoding>('utf-8');
  const [barSpaceAdjustment, setBarSpaceAdjustment] = useState<{ mode: 'none' | 'reduce' | 'increase' | 'reduceBar' | 'increaseBar'; dots: number }>({
    mode: 'none',
    dots: 1,
  });
  const [printMethod, setPrintMethod] = useState<'vector' | 'raster' | 'native_printer' | 'auto' | 'native'>('vector');
  const [barcodeColor, setBarcodeColor] = useState<string>('#000000');

  // Sub-modals & Popovers for Symbology and Size
  const [isAdvancedXModalOpen, setIsAdvancedXModalOpen] = useState<boolean>(false);
  const [isPrintMethodModalOpen, setIsPrintMethodModalOpen] = useState<boolean>(false);
  const [isSymbologyDropdownOpen, setIsSymbologyDropdownOpen] = useState<boolean>(false);
  const [symbologySearchQuery, setSymbologySearchQuery] = useState<string>('');
  const [selectedSymbologyCategory, setSelectedSymbologyCategory] = useState<'All' | '1D Barcodes' | '2D Barcodes' | 'Postal Barcodes' | 'GS1 / Composite'>('All');
  const symbologyDropdownRef = useRef<HTMLDivElement>(null);

  // Human Readable State matching BarTender UI
  const [hrVisibility, setHrVisibility] = useState<'full' | 'none' | 'perSource'>('full');
  const [hrVisibleSourceIds, setHrVisibleSourceIds] = useState<string[]>([]);
  const [hrPlacement, setHrPlacement] = useState<'Bottom' | 'Top'>('Bottom');
  const [hrVerticalOffsetMm, setHrVerticalOffsetMm] = useState<number>(0.8);
  const [hrAlignment, setHrAlignment] = useState<'Centered' | 'Left' | 'Right'>('Centered');
  const [hrHorizontalOffsetMm, setHrHorizontalOffsetMm] = useState<number>(0.0);
  const [hrHideCheckDigit, setHrHideCheckDigit] = useState<boolean>(false);
  const [hrGs1Template, setHrGs1Template] = useState<'none' | 'standard' | 'custom'>('none');
  const [hrLineBreakAfterAi, setHrLineBreakAfterAi] = useState<boolean>(false);
  const [hrCharacterTemplate, setHrCharacterTemplate] = useState<{ template?: string }>({});
  const [hrSearchReplace, setHrSearchReplace] = useState<
    Array<{ find: string; replace: string; caseSensitive?: boolean; wholeWord?: boolean; isRegex?: boolean }>
  >([]);
  const [hrScript, setHrScript] = useState<{ language: 'javascript' | 'vbscript'; code: string }>({
    language: 'vbscript',
    code: '',
  });
  const [hrPrefixSuffix, setHrPrefixSuffix] = useState<{ prefix?: string; suffix?: string }>({});
  const [isSelectVisibleSourcesModalOpen, setIsSelectVisibleSourcesModalOpen] = useState<boolean>(false);
  const [activeHrTransformModal, setActiveHrTransformModal] = useState<
    'template' | 'searchReplace' | 'script' | 'prefixSuffix' | null
  >(null);

  // Font
  const [selectedFont, setSelectedFont] = useState('Arial');
  const [pointSize, setPointSize] = useState(12);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikeout, setIsStrikeout] = useState(false);
  const [fontColor, setFontColor] = useState('#000000');

  // Text Format
  const [textFormatType, setTextFormatType] = useState<'single-line' | 'paragraph'>('single-line');
  const [activeTextFormatTab, setActiveTextFormatTab] = useState<'auto-size' | 'tabs' | 'effects'>('auto-size');
  const [autoSize, setAutoSize] = useState(false);
  const [minFontSize, setMinFontSize] = useState(6);
  const [maxFontSize, setMaxFontSize] = useState(20);
  const [minWidthScale, setMinWidthScale] = useState(80);
  const [maxWidthScale, setMaxWidthScale] = useState(100);
  const [objWidthMm, setObjWidthMm] = useState(50);
  const [objHeightMm, setObjHeightMm] = useState(25);
  const [horizAlign, setHorizAlign] = useState<'left' | 'center' | 'right'>('center');
  const [vertAlign, setVertAlign] = useState<'top' | 'middle' | 'bottom'>('middle');

  // Tabs Sub-Tab State
  const [tabsList, setTabsList] = useState<
    Array<{ id: string; positionMm: number; alignment: 'left' | 'center' | 'right' | 'decimal'; leader: 'none' | 'dots' | 'dashes' | 'line' }>
  >([]);
  const [newTabPos, setNewTabPos] = useState<number>(10);
  const [newTabAlign, setNewTabAlign] = useState<'left' | 'center' | 'right' | 'decimal'>('left');
  const [newTabLeader, setNewTabLeader] = useState<'none' | 'dots' | 'dashes' | 'line'>('none');

  // Effects Sub-Tab State
  const [charSpacing, setCharSpacing] = useState(0);
  const [lineSpacing, setLineSpacing] = useState(1.15);
  const [textOpacity, setTextOpacity] = useState(100);
  const [outlineEnabled, setOutlineEnabled] = useState(false);
  const [outlineColor, setOutlineColor] = useState('#000000');
  const [outlineWidth, setOutlineWidth] = useState(1);
  const [shadowEnabled, setShadowEnabled] = useState(false);
  const [shadowColor, setShadowColor] = useState('#888888');
  const [shadowBlur, setShadowBlur] = useState(2);
  const [shadowOffsetX, setShadowOffsetX] = useState(1);
  const [shadowOffsetY, setShadowOffsetY] = useState(1);

  // Border
  const [borderType, setBorderType] = useState<'none' | 'rectangle' | 'ellipse'>('none');
  const [borderThickness, setBorderThickness] = useState(0.5);
  const [borderColor, setBorderColor] = useState('#000000');
  const [borderDashStyle, setBorderDashStyle] = useState<'solid' | 'dashed' | 'dotted'>('solid');
  const [cornerRadius, setCornerRadius] = useState(0);
  const [borderPadding, setBorderPadding] = useState(0);

  // Position
  const [posX, setPosX] = useState(10.9);
  const [posY, setPosY] = useState(22.1);
  const [posWidth, setPosWidth] = useState(50);
  const [posHeight, setPosHeight] = useState(25);
  const [rotationAngle, setRotationAngle] = useState<0 | 90 | 180 | 270>(0);

  // Tree View Mode & Error Handling
  const [treeViewMode, setTreeViewMode] = useState<'single' | 'multi'>('single');
  const [invalidCharHandling, setInvalidCharHandling] = useState<'error' | 'strip' | 'replace' | 'ignore'>('error');
  const [emptyDataBehavior, setEmptyDataBehavior] = useState<'placeholder' | 'error' | 'blank'>('placeholder');
  const [overflowHandling, setOverflowHandling] = useState<'shrink' | 'truncate' | 'error'>('shrink');
  const [strictGs1Validation, setStrictGs1Validation] = useState(true);

  // Symbology Specifics
  const [errorCorrectionLevel, setErrorCorrectionLevel] = useState<'L' | 'M' | 'Q' | 'H'>('M');
  const [bearerBars, setBearerBars] = useState(false);
  const [bearerBarType, setBearerBarType] = useState<'top-bottom' | 'complete'>('top-bottom');
  const [bearerBarThickness, setBearerBarThickness] = useState(1);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setIsAddMenuOpen(false);
      }
      if (symbologyDropdownRef.current && !symbologyDropdownRef.current.contains(event.target as Node)) {
        setIsSymbologyDropdownOpen(false);
      }
    };
    if (isAddMenuOpen || isSymbologyDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAddMenuOpen, isSymbologyDropdownOpen]);

  const treeNodes = useMemo(() => {
    return buildPropertyTree(elementsList, propertyScope, activeObjectId, expandedNodeIds);
  }, [elementsList, propertyScope, activeObjectId, expandedNodeIds]);

  const activeTreeNodeId = useMemo(() => {
    if (!activeElement) return '';
    if (selectedCategory === 'datasource-item') {
      const ds = dataSources[activeDsIndex];
      const dsId = ds?.id || (dataSources.length > 0 ? (dataSources[0]?.id || 'default') : 'default');
      return `${activeElement.id}::ds::${dsId}`;
    }
    if (selectedCategory === 'human-readable') {
      return `${activeElement.id}::humanReadable`;
    }
    if (selectedCategory === 'text-format') {
      return `${activeElement.id}::textFormat`;
    }
    if (selectedCategory === 'datasources') {
      return `${activeElement.id}::dataSources`;
    }
    return `${activeElement.id}::${selectedCategory}`;
  }, [activeElement, selectedCategory, dataSources, activeDsIndex]);

  const handleToggleExpandNode = (nodeId: string) => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleSelectTreeNode = (node: PropertyTreeNode) => {
    if (node.objectId && node.objectId !== activeObjectId) {
      setActiveObjectId(node.objectId);
      if (onSelectElement) {
        onSelectElement(node.objectId);
      }
    }

    if (node.nodeType === 'dataSource') {
      setSelectedCategory('datasource-item');
      if (node.dataSourceIndex !== undefined && node.dataSourceIndex >= 0) {
        setActiveDsIndex(node.dataSourceIndex);
      }
    } else if (node.nodeType === 'section') {
      switch (node.sectionId) {
        case 'symbology':
          setSelectedCategory('symbology');
          setActiveDsIndex(-1);
          break;
        case 'humanReadable':
          setSelectedCategory('human-readable');
          break;
        case 'font':
          setSelectedCategory('font');
          break;
        case 'textFormat':
          setSelectedCategory('text-format');
          break;
        case 'border':
          setSelectedCategory('border');
          break;
        case 'position':
          setSelectedCategory('position');
          break;
        case 'dataSources':
          setSelectedCategory('datasources');
          break;
        default:
          setSelectedCategory(node.sectionId as any);
          break;
      }
    } else if (node.nodeType === 'object') {
      if (node.objectType === 'barcode') {
        setSelectedCategory('symbology');
        setActiveDsIndex(-1);
      } else if (node.objectType === 'text') {
        setSelectedCategory('font');
      } else {
        setSelectedCategory('border');
      }
    }
  };

  // Sync state when activeElement opens or changes
  useEffect(() => {
    if (activeElement && isOpen) {
      initialSnapshotRef.current = JSON.parse(JSON.stringify(activeElement));
      if (initialCategory) {
        setSelectedCategory(initialCategory as PropertyCategory);
      } else {
        if (activeElement.type === 'barcode') {
          setSelectedCategory('symbology');
        } else if (activeElement.type === 'text') {
          setSelectedCategory('font');
        } else {
          setSelectedCategory('border');
        }
      }

      setName(activeElement.name || `${activeElement.type} 1`);
      setSymbology((activeElement as BarcodeElement).symbology || 'code128');
      setValue((activeElement as any).value || (activeElement as any).text || '');

      // Initialize dataSources
      if ((activeElement as any).dataSources && (activeElement as any).dataSources.length > 0) {
        setDataSources(JSON.parse(JSON.stringify((activeElement as any).dataSources)));
      } else {
        const initialDs: DataSourceItem = {
          id: `ds-${Date.now()}`,
          name: 'Primary Data Source',
          type: (activeElement as any).dataBinding ? 'variable' : 'embedded',
          value: (activeElement as any).value || (activeElement as any).text || (activeElement.type === 'barcode' ? '12345678' : 'Sample Text'),
          variableName: (activeElement as any).dataBinding ? (activeElement as any).dataBinding.replace(/[{}]/g, '') : undefined,
          enabled: true,
        };
        setDataSources([initialDs]);
      }
      if (initialDataSourceIndex !== undefined) {
        setActiveDsIndex(initialDataSourceIndex);
      } else {
        setActiveDsIndex(0);
      }

      const symCap = getBarcodeCapability((activeElement as BarcodeElement).symbology || 'code128');
      const initialX = (activeElement as BarcodeElement).xDimensionMm || ((activeElement as BarcodeElement).barWidth ? Number(((activeElement as BarcodeElement).barWidth * 0.35).toFixed(2)) : symCap.defaultXDimensionMm || 0.38);
      setXDimensionMm(initialX);
      setLockXDimension(!!(activeElement as BarcodeElement).lockXDimension);
      setXDimensionUnits((activeElement as BarcodeElement).xDimensionUnits || 'mm');
      setAutoSizeToWidth(!!(activeElement as BarcodeElement).autoSizeToWidth);
      setRequestedWidthMm((activeElement as BarcodeElement).requestedWidthMm || activeElement.width || 50);
      setMinXDimensionMm((activeElement as BarcodeElement).minXDimensionMm || symCap.minXDimensionMm || 0.15);
      setMaxXDimensionMm((activeElement as BarcodeElement).maxXDimensionMm || symCap.maxXDimensionMm || 1.5);
      setRatioMode((activeElement as BarcodeElement).ratioMode || 'standard');
      const parsedRatio = typeof (activeElement as BarcodeElement).ratio === 'number'
        ? ((activeElement as BarcodeElement).ratio as number)
        : parseFloat(String((activeElement as BarcodeElement).ratio || symCap.defaultRatio || 2.5)) || 2.5;
      setRatio(parsedRatio);
      setDensity((activeElement as BarcodeElement).density || 2.6);
      setHeightMm((activeElement as BarcodeElement).barHeight || activeElement.height || symCap.defaultHeightMm || 12.7);
      setBarcodeColor((activeElement as BarcodeElement).foregroundColor || activeElement.color || '#000000');
      setCheckDigit((activeElement as BarcodeElement).checkDigit !== false);
      setCheckDigitMode((activeElement as BarcodeElement).checkDigitMode || ((activeElement as BarcodeElement).checkDigit !== false ? 'include' : 'exclude'));
      setCodeSet((activeElement as BarcodeElement).codeSet || 'Auto');
      setGs1Mode(!!((activeElement as BarcodeElement).gs1Mode || (activeElement as any).isGs1 || (activeElement as BarcodeElement).symbology?.startsWith('gs1')));
      setTextEncoding((activeElement as BarcodeElement).textEncoding || 'utf-8');
      setBarSpaceAdjustment((activeElement as BarcodeElement).barSpaceAdjustment || { mode: 'none', dots: 1 });
      setPrintMethod((activeElement as BarcodeElement).printMethod || 'vector');

      // Human Readable sync
      const hr = (activeElement as BarcodeElement).humanReadable;
      setHrVisibility(hr?.visibility || ((activeElement as BarcodeElement).includeText === false || (activeElement as BarcodeElement).textPosition === 'none' ? 'none' : 'full'));
      setHrVisibleSourceIds(
        hr?.visibleSourceIds ||
        ((activeElement as any).dataSources && (activeElement as any).dataSources.length > 0
          ? (activeElement as any).dataSources.map((ds: any, idx: number) => ds.id || `ds-${idx}`)
          : [])
      );
      setHrPlacement(hr?.placement === 'top' || (activeElement as BarcodeElement).textPosition === 'above' ? 'Top' : 'Bottom');
      setHrVerticalOffsetMm(Number(hr?.verticalOffsetMm ?? (activeElement as any).humanReadableOffsetV ?? 0.8));
      const initAlign =
        hr?.alignment || (activeElement as any).humanReadableAlignment || (activeElement as any).horizontalAlignment || (activeElement as any).textAlign || 'centered';
      setHrAlignment(initAlign === 'left' ? 'Left' : initAlign === 'right' ? 'Right' : 'Centered');
      setHrHorizontalOffsetMm(Number(hr?.horizontalOffsetMm ?? (activeElement as any).humanReadableOffsetH ?? 0.0));
      setHrHideCheckDigit(Boolean(hr?.hideCheckDigit ?? (activeElement as any).hideCheckDigit));
      setHrGs1Template((hr?.gs1Template as any) || ((activeElement as BarcodeElement).gs1Mode ? 'standard' : 'none'));
      setHrLineBreakAfterAi(Boolean(hr?.lineBreakAfterAi));
      setHrCharacterTemplate(
        hr?.characterTemplate || ((activeElement as any).charTemplate ? { template: (activeElement as any).charTemplate } : {})
      );
      setHrSearchReplace(hr?.searchReplace || []);
      setHrScript(
        hr?.script ||
        ((activeElement as any).vbScript
          ? { language: 'vbscript', code: (activeElement as any).vbScript }
          : { language: 'vbscript', code: '' })
      );
      setHrPrefixSuffix(
        hr?.prefixSuffix || {
          prefix: (activeElement as any).humanReadablePrefix || '',
          suffix: (activeElement as any).humanReadableSuffix || '',
        }
      );

      // Font
      setSelectedFont((activeElement as any).humanReadableFont || (activeElement as any).fontFamily || 'Arial');
      setPointSize((activeElement as any).humanReadableFontSize || (activeElement as any).fontSize || 12);
      setIsBold((activeElement as any).fontWeight === 'bold' || (activeElement as any).humanReadableFontStyle === 'bold' || (activeElement as any).humanReadableFontStyle === 'bold-italic');
      setIsItalic((activeElement as any).fontStyle === 'italic' || (activeElement as any).humanReadableFontStyle === 'italic' || (activeElement as any).humanReadableFontStyle === 'bold-italic');
      setIsUnderline(!!(activeElement as any).underline || !!(activeElement as any).humanReadableUnderline);
      setIsStrikeout(!!(activeElement as any).humanReadableStrikeout || (activeElement as any).textDecoration === 'line-through');
      setFontColor((activeElement as any).humanReadableColor || activeElement.color || '#000000');

      // Text Format
      setTextFormatType((activeElement as any).textFormatType || 'single-line');
      setAutoSize(!!((activeElement as any).autoSize || (activeElement as any).autoSizeText));
      setMinFontSize((activeElement as any).minFontSize || 6);
      setMaxFontSize((activeElement as any).maxFontSize || 20);
      setMinWidthScale((activeElement as any).minWidthScale || 80);
      setMaxWidthScale((activeElement as any).maxWidthScale || 100);
      setObjWidthMm(activeElement.width || 50);
      setObjHeightMm(activeElement.height || 25);
      setHorizAlign((activeElement as any).horizontalAlignment || (activeElement as any).humanReadableAlignment || 'center');
      setVertAlign((activeElement as any).verticalAlignment || 'middle');
      setTabsList((activeElement as any).tabsConfig || []);

      // Effects
      const eff = (activeElement as any).effectsConfig || {};
      setCharSpacing(eff.letterSpacing || 0);
      setLineSpacing(eff.lineSpacing || 1.15);
      setTextOpacity(eff.opacity !== undefined ? eff.opacity : 100);
      setOutlineEnabled(!!eff.outline);
      setOutlineColor(eff.outlineColor || '#000000');
      setOutlineWidth(eff.outlineWidth || 1);
      setShadowEnabled(!!eff.shadow);
      setShadowColor(eff.shadowColor || '#888888');
      setShadowBlur(eff.shadowBlur || 2);
      setShadowOffsetX(eff.shadowOffsetX || 1);
      setShadowOffsetY(eff.shadowOffsetY || 1);

      // Border
      setBorderType((activeElement as any).borderType || 'none');
      setBorderThickness((activeElement as any).borderThickness || 0.5);
      setBorderColor((activeElement as any).borderColor || '#000000');
      setBorderDashStyle((activeElement as any).borderDashStyle || 'solid');
      setCornerRadius((activeElement as any).cornerRadius || 0);
      setBorderPadding((activeElement as any).borderPadding || 0);

      // Position
      setPosX(activeElement.x || 10.9);
      setPosY(activeElement.y || 22.1);
      setPosWidth(activeElement.width || 50);
      setPosHeight(activeElement.height || 25);
      setRotationAngle(((activeElement.rotation as any) || 0) as any);

      // Symbology specifics
      setErrorCorrectionLevel((activeElement as any).errorCorrectionLevel || 'M');
      setBearerBars(!!(activeElement as any).bearerBars);
      setBearerBarType((activeElement as any).bearerBarType || 'top-bottom');
      setBearerBarThickness((activeElement as any).bearerBarThickness || 1);
    }
  }, [activeElement, isOpen, initialCategory, initialDataSourceIndex]);

  if (!isOpen || !activeElement) return null;

  const applyChange = (updates: Partial<BarcodeElement>) => {
    if (activeElement) {
      onUpdateElement(activeElement.id, updates);
    }
  };

  const applyHrChange = (updates: Partial<HumanReadableConfig>) => {
    const nextHr: HumanReadableConfig = {
      visibility: updates.visibility ?? hrVisibility,
      visibleSourceIds: updates.visibleSourceIds ?? hrVisibleSourceIds,
      placement: updates.placement ?? (hrPlacement === 'Top' ? 'top' : 'bottom'),
      alignment: updates.alignment ?? (hrAlignment === 'Left' ? 'left' : hrAlignment === 'Right' ? 'right' : 'centered'),
      verticalOffsetMm: updates.verticalOffsetMm ?? hrVerticalOffsetMm,
      horizontalOffsetMm: updates.horizontalOffsetMm ?? hrHorizontalOffsetMm,
      hideCheckDigit: updates.hideCheckDigit ?? hrHideCheckDigit,
      gs1Template: updates.gs1Template ?? hrGs1Template,
      lineBreakAfterAi: updates.lineBreakAfterAi ?? hrLineBreakAfterAi,
      characterTemplate: updates.characterTemplate ?? hrCharacterTemplate,
      searchReplace: updates.searchReplace ?? hrSearchReplace,
      script: updates.script ?? hrScript,
      prefixSuffix: updates.prefixSuffix ?? hrPrefixSuffix,
    };

    const nextInclude = nextHr.visibility !== 'none';
    const sim = {
      ...(activeElement as BarcodeElement),
      barHeight: heightMm,
      includeText: nextInclude,
      humanReadableFontSize: pointSize,
      fontSize: pointSize,
      humanReadableOffsetV: nextHr.verticalOffsetMm,
    };
    const layout = calculateBarcodeLayout(sim);
    const nextH = layout.totalHeightMm;
    setPosHeight(nextH);

    applyChange({
      height: nextH,
      barHeight: heightMm,
      symbol: {
        ...((activeElement as BarcodeElement)?.symbol || {}),
        barHeight: heightMm,
      },
      humanReadable: nextHr,
      includeText: nextInclude,
      textPosition: nextHr.placement === 'top' ? 'above' : !nextInclude ? 'none' : 'below',
      humanReadableAlignment: nextHr.alignment,
      humanReadableOffsetV: nextHr.verticalOffsetMm,
      humanReadableOffsetH: nextHr.horizontalOffsetMm,
      hideCheckDigit: nextHr.hideCheckDigit,
      charTemplate: nextHr.characterTemplate?.template,
      vbScript: nextHr.script?.code,
      humanReadablePrefix: nextHr.prefixSuffix?.prefix,
      humanReadableSuffix: nextHr.prefixSuffix?.suffix,
    });
  };

  const getFullCurrentDraft = (): Partial<BarcodeElement> => {
    const primaryDs = dataSources[0];
    const simulatedElement = { ...element, dataSources };
    const compiled =
      evaluateElementData(simulatedElement as any, { record: currentRecord, datasets }) ||
      primaryDs?.value ||
      value;

    const hrObj: HumanReadableConfig = {
      visibility: hrVisibility,
      visibleSourceIds: hrVisibleSourceIds,
      placement: hrPlacement === 'Top' ? 'top' : 'bottom',
      alignment: hrAlignment === 'Left' ? 'left' : hrAlignment === 'Right' ? 'right' : 'centered',
      verticalOffsetMm: hrVerticalOffsetMm,
      horizontalOffsetMm: hrHorizontalOffsetMm,
      hideCheckDigit: hrHideCheckDigit,
      gs1Template: hrGs1Template,
      lineBreakAfterAi: hrLineBreakAfterAi,
      characterTemplate: hrCharacterTemplate,
      searchReplace: hrSearchReplace,
      script: hrScript,
      prefixSuffix: hrPrefixSuffix,
    };

    return {
      name,
      symbology,
      value: compiled,
      barcodeValue: compiled,
      content: compiled,
      dataSources,
      width: posWidth,
      x: posX,
      y: posY,
      rotation: rotationAngle,
      xDimensionMm,
      lockXDimension,
      xDimensionUnits,
      autoSizeToWidth,
      requestedWidthMm,
      minXDimensionMm,
      maxXDimensionMm,
      ratioMode,
      ratio,
      density,
      barWidth: Math.max(1, Math.round(xDimensionMm / 0.35)),
      barHeight: heightMm,
      height: calculateBarcodeLayout({
        ...(activeElement as BarcodeElement),
        barHeight: heightMm,
        includeText: hrVisibility !== 'none',
        humanReadableFontSize: pointSize,
        fontSize: pointSize,
        humanReadableOffsetV: hrVerticalOffsetMm,
      }).totalHeightMm,
      symbol: {
        barHeight: heightMm,
        moduleWidth: xDimensionMm,
      },
      checkDigit: checkDigitMode !== 'exclude',
      checkDigitMode,
      codeSet,
      gs1Mode,
      textEncoding,
      barSpaceAdjustment,
      printMethod,
      foregroundColor: barcodeColor,
      humanReadable: hrObj,
      includeText: hrVisibility !== 'none',
      textPosition: hrPlacement === 'Top' ? 'above' : hrVisibility === 'none' ? 'none' : 'below',
      humanReadableAlignment: hrAlignment === 'Left' ? 'left' : hrAlignment === 'Right' ? 'right' : 'centered',
      humanReadableOffsetV: hrVerticalOffsetMm,
      humanReadableOffsetH: hrHorizontalOffsetMm,
      hideCheckDigit: hrHideCheckDigit,
      charTemplate: hrCharacterTemplate?.template,
      vbScript: hrScript?.code,
      humanReadablePrefix: hrPrefixSuffix?.prefix,
      humanReadableSuffix: hrPrefixSuffix?.suffix,
      humanReadableFont: selectedFont,
      humanReadableFontSize: pointSize,
      fontFamily: selectedFont,
      fontSize: pointSize,
      fontWeight: isBold ? 'bold' : 'normal',
      fontStyle: isItalic ? 'italic' : 'normal',
      underline: isUnderline,
      humanReadableUnderline: isUnderline,
      humanReadableStrikeout: isStrikeout,
      humanReadableColor: fontColor,
      color: fontColor,
      textFormatType,
      autoSize,
      autoSizeText: autoSize,
      minFontSize,
      maxFontSize,
      minWidthScale,
      maxWidthScale,
      horizontalAlignment: horizAlign,
      verticalAlignment: vertAlign,
      tabsConfig: tabsList,
      effectsConfig: {
        letterSpacing: charSpacing,
        lineSpacing,
        opacity: textOpacity,
        outline: outlineEnabled,
        outlineColor,
        outlineWidth,
        shadow: shadowEnabled,
        shadowColor,
        shadowBlur,
        shadowOffsetX,
        shadowOffsetY,
        strikeout: isStrikeout,
        underline: isUnderline,
      },
      borderType,
      borderThickness,
      borderColor,
      borderDashStyle,
      cornerRadius,
      borderPadding,
      errorCorrectionLevel,
      bearerBars,
      bearerBarType,
      bearerBarThickness,
    };
  };

  const currentDsIndex = Math.max(0, Math.min(activeDsIndex, dataSources.length - 1));
  const activeDataSource: DataSourceItem = dataSources[currentDsIndex] || {
    id: 'ds-default',
    name: 'Embedded Source',
    type: 'embedded',
    value: value || '12345678',
    enabled: true,
  };

  const updateDataSourcesState = (newSources: DataSourceItem[]) => {
    setDataSources(newSources);
    const simulatedElement = { ...(activeElement || element), dataSources: newSources };
    const compiled = evaluateElementData(simulatedElement as any, { record: currentRecord, datasets });
    const primaryDs = newSources[0];
    const finalVal = compiled || primaryDs?.value || value;
    setValue(finalVal);
    const dataBinding = primaryDs?.field
      ? `{{${primaryDs.field}}}`
      : primaryDs?.value && primaryDs.value.includes('{')
        ? primaryDs.value
        : undefined;

    applyChange({
      dataSources: newSources,
      value: finalVal,
      barcodeValue: finalVal,
      content: finalVal,
      ...(dataBinding ? { dataBinding } : {}),
      ...(primaryDs?.field ? { databaseField: primaryDs.field } : {}),
    });
  };

  const updateActiveDataSource = (updates: Partial<DataSourceItem>) => {
    const updated = dataSources.map((ds, idx) => (idx === currentDsIndex ? { ...ds, ...updates } : ds));
    updateDataSourcesState(updated);
  };

  const handleOpenSpecialCharacters = () => {
    const textarea = barcodeEmbeddedTextareaRef.current;
    const currentVal = activeDataSource.value || '';
    const start = textarea ? textarea.selectionStart : (barcodeSavedSelectionRef.current.start ?? currentVal.length);
    const end = textarea ? textarea.selectionEnd : (barcodeSavedSelectionRef.current.end ?? currentVal.length);
    barcodeSavedSelectionRef.current = {
      start,
      end,
      sourceId: activeDataSource.id,
      sourceIndex: currentDsIndex,
    };
    setIsSpecialCharModalOpen(true);
  };

  const handleSelectionChange = (start: number, end: number) => {
    barcodeSavedSelectionRef.current = {
      start,
      end,
      sourceId: activeDataSource.id,
      sourceIndex: currentDsIndex,
    };
  };

  const handleInsertSpecialChar = (symbol: string, _size?: string) => {
    const targetSourceId = barcodeSavedSelectionRef.current.sourceId || activeDataSource.id;
    const targetSourceIndex = barcodeSavedSelectionRef.current.sourceIndex ?? currentDsIndex;

    const targetDs =
      dataSources.find((ds, idx) => (ds.id && ds.id === targetSourceId) || idx === targetSourceIndex) ||
      activeDataSource;

    const currentVal = targetDs.value || '';
    const start = barcodeSavedSelectionRef.current.start ?? currentVal.length;
    const end = barcodeSavedSelectionRef.current.end ?? currentVal.length;

    const { value: nextVal, newCursor } = insertAtSelection(currentVal, symbol, start, end);

    barcodeSavedSelectionRef.current = {
      start: newCursor,
      end: newCursor,
      sourceId: targetDs.id,
      sourceIndex: targetSourceIndex,
    };

    const updated = dataSources.map((ds, idx) => {
      const match = (ds.id && ds.id === targetSourceId) || idx === targetSourceIndex;
      return match ? { ...ds, value: nextVal } : ds;
    });

    updateDataSourcesState(updated);

    setTimeout(() => {
      if (barcodeEmbeddedTextareaRef.current) {
        try {
          barcodeEmbeddedTextareaRef.current.focus();
          barcodeEmbeddedTextareaRef.current.setSelectionRange(newCursor, newCursor);
        } catch {}
      }
    }, 0);
  };

  const updateActiveDsTransform = (updates: Partial<TransformConfig>) => {
    const currentTc = activeDataSource.transformConfig || {};
    const newTc = { ...currentTc, ...updates };
    updateActiveDataSource({
      transformConfig: newTc,
      ...(updates.serialization !== undefined ? { serialization: updates.serialization } : {}),
      ...(updates.prefixSuffix !== undefined ? { prefixSuffix: updates.prefixSuffix } : {}),
    });
  };

  const handleCancel = () => {
    if (initialSnapshotRef.current && element) {
      onUpdateElement(element.id, initialSnapshotRef.current);
    }
    onClose();
  };

  const handleApplyDraft = () => {
    if (element) {
      const draft = getFullCurrentDraft();
      onUpdateElement(element.id, draft);
      initialSnapshotRef.current = JSON.parse(JSON.stringify({ ...element, ...draft }));
    }
  };

  const handleCommitAndClose = () => {
    if (element) {
      const draft = getFullCurrentDraft();
      onUpdateElement(element.id, draft);
    }
    onClose();
  };

  // Summaries for BarTender Transform Tab Rows
  const tc = activeDataSource.transformConfig || {};
  const suppressionSummary = tc.suppression && tc.suppression.type !== 'never' ? tc.suppression.type : '<None>';
  const filterSummary = tc.characterFilter && tc.characterFilter.type !== 'none' ? tc.characterFilter.type : '<None>';
  const truncSummary = tc.truncation && tc.truncation.type !== 'none' ? `${tc.truncation.type} (${tc.truncation.count})` : '<None>';
  const lengthSummary = tc.characterLength && (tc.characterLength.min || tc.characterLength.max) ? `Min: ${tc.characterLength.min || 0}, Max: ${tc.characterLength.max || '∞'}` : '<None>';
  const templateSummary = tc.characterTemplate?.template ? tc.characterTemplate.template : '<None>';
  const searchReplaceSummary = tc.searchReplace && tc.searchReplace.length > 0 ? `${tc.searchReplace.length} rule(s)` : '<None>';
  const scriptSummary = tc.script?.code ? tc.script.language || 'script' : '<None>';
  const activeSerial = activeDataSource.serialization || tc.serialization;
  const serialSummary = activeSerial && activeSerial.action !== 'none'
    ? `${activeSerial.action === 'decrement' ? 'Decrement' : 'Increment'} by ${activeSerial.incrementBy || 1}`
    : '<None>';
  const activePs = activeDataSource.prefixSuffix || tc.prefixSuffix;
  const prefixSuffixSummary = activePs && (activePs.prefix || activePs.suffix)
    ? `Prefix: "${activePs.prefix || ''}", Suffix: "${activePs.suffix || ''}"`
    : '<None>';

  const handleWizardAddDataSource = (newDs: DataSourceItem) => {
    const nextList = [...dataSources, newDs];
    updateDataSourcesState(nextList);
    setActiveDsIndex(nextList.length - 1);
    setSelectedCategory('datasource-item');
  };

  // Add a new Data Source (Supports standard & GS1 Wizards)
  const handleAddNewDataSource = (type: DataSourceType = 'embedded') => {
    setIsAddMenuOpen(false);
    if (type === 'gs1_ai') {
      setIsGs1AiWizardOpen(true);
      return;
    }
    setIsWizardOpen(true);
  };

  const handleApplyGs1Wizard = (fields: GS1Field[], replaceMode: 'replace' | 'insert' | 'append') => {
    const newId = `ds-${Date.now()}`;
    const compiledVal = fields.map((f) => `(${f.ai})${f.value}`).join('');
    const newDs: DataSourceItem = {
      id: newId,
      name: 'GS1 Application Identifier',
      type: 'gs1_ai',
      value: compiledVal,
      gs1AIs: fields,
      enabled: true,
    };

    let nextList: DataSourceItem[];
    if (replaceMode === 'replace') {
      nextList = [newDs];
    } else if (replaceMode === 'insert') {
      nextList = [...dataSources];
      nextList.splice(currentDsIndex, 0, newDs);
    } else {
      nextList = [...dataSources, newDs];
    }

    updateDataSourcesState(nextList);
    setActiveDsIndex(replaceMode === 'insert' ? currentDsIndex : nextList.length - 1);
    setSelectedCategory('datasource-item');
  };

  const handleDeleteActiveDataSource = () => {
    if (dataSources.length <= 1) {
      alert('A barcode element must have at least one data source.');
      return;
    }
    const nextList = dataSources.filter((_, idx) => idx !== currentDsIndex);
    updateDataSourcesState(nextList);
    setActiveDsIndex(Math.max(0, currentDsIndex - 1));
  };

  const handleMoveDataSource = (direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? currentDsIndex - 1 : currentDsIndex + 1;
    if (targetIdx < 0 || targetIdx >= dataSources.length) return;
    const nextList = [...dataSources];
    const temp = nextList[currentDsIndex];
    nextList[currentDsIndex] = nextList[targetIdx];
    nextList[targetIdx] = temp;
    updateDataSourcesState(nextList);
    setActiveDsIndex(targetIdx);
  };

  // Get icon and label for tree display
  const getDsTreeMeta = (ds: DataSourceItem) => {
    switch (ds.type) {
      case 'gs1_ai': {
        const preview = ds.gs1AIs && ds.gs1AIs.length > 0
          ? ds.gs1AIs.map(a => `(${a.ai})`).join('')
          : '(01)...';
        return { icon: '🌐', label: `GS1 AI ${preview}` };
      }
      case 'gs1_composite':
        return { icon: '🧩', label: `GS1 Comp (${ds.gs1CompositeType || 'CC-A'})` };
      case 'gs1_databar':
        return { icon: '📊', label: `DataBar (${ds.gs1DataBarVariant || 'Omni'})` };
      case 'database':
        return { icon: '🗄️', label: ds.databaseField ? `[DB] ${ds.databaseField}` : (ds.name || 'DB Field') };
      case 'serial':
        return { icon: '🔢', label: ds.serialPrefix ? `${ds.serialPrefix}000001` : (ds.name || 'SN Counter') };
      case 'clock':
        return { icon: '🕒', label: ds.dateFormat ? formatCustomDate(new Date(), ds.dateFormat) : 'Date' };
      case 'variable':
        return { icon: '🔗', label: ds.variableName ? `{{${ds.variableName}}}` : (ds.name || 'Variable') };
      case 'system':
        return { icon: '⚙️', label: ds.systemVarName || 'SYSTEM.DATE' };
      case 'script':
        return { icon: '⚡', label: ds.name || 'Script' };
      default:
        return { icon: '💾', label: ds.value || '12345678' };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-in fade-in duration-150 font-sans select-none">
      {/* BarTender Window Frame */}
      <div
        className="w-[890px] max-w-full bg-[#f0f4f9] rounded-lg shadow-2xl border border-[#718096] flex flex-col overflow-hidden text-slate-800 text-[12px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Window Title Bar */}
        <div className="bg-gradient-to-r from-[#d9e2ec] via-[#bcccdc] to-[#9fb3c8] border-b border-[#829ab1] px-2.5 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gradient-to-br from-amber-400 to-cyan-600 rounded-xs shadow-xs flex items-center justify-center p-0.5">
              <div className="w-full h-full bg-white/90 rounded-xs flex items-center justify-center font-bold text-[8px] text-cyan-800">
                |||
              </div>
            </div>
            <span className="font-semibold text-slate-900 text-[12.5px] tracking-tight">
              {activeElement?.type === 'barcode'
                ? 'Barcode Properties'
                : `${(activeElement?.type || 'Object').charAt(0).toUpperCase() + (activeElement?.type || 'Object').slice(1)} Properties`} — [{activeElement?.name || name}]
            </span>
          </div>

          <div className="flex items-center">
            <button
              title="Minimize"
              className="w-6 h-5 flex items-center justify-center text-slate-700 hover:bg-slate-300/60 rounded-xs"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              title="Maximize"
              className="w-6 h-5 flex items-center justify-center text-slate-700 hover:bg-slate-300/60 rounded-xs"
            >
              <Square className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={onClose}
              title="Close"
              className="w-8 h-5 flex items-center justify-center bg-[#e03131] hover:bg-[#c92a2a] text-white rounded-xs ml-1 shadow-xs cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="flex flex-1 min-h-[500px] max-h-[600px] bg-white relative">
          {/* LEFT SIDEBAR: Navigation Tree */}
          <div className="w-64 bg-white border-r border-[#cbd5e1] flex flex-col justify-between select-none relative">
            <div className="flex flex-col h-full overflow-hidden">
              <PropertyTree
                treeNodes={treeNodes}
                selectedNodeId={activeTreeNodeId}
                onSelectNode={handleSelectTreeNode}
                scope={propertyScope}
                onChangeScope={setPropertyScope}
                expandedNodeIds={expandedNodeIds}
                onToggleExpand={handleToggleExpandNode}
              />
            </div>

            {/* Tree Bottom Action Buttons matching BarTender Screenshot */}
            <div className="p-1.5 bg-[#e2e8f0] border-t border-[#cbd5e1] flex items-center justify-between text-slate-700 relative">
              <div className="flex items-center gap-1">
                {/* 1. Add (+) Button with GS1 Dropdown Menu */}
                <div className="relative">
                  <button
                    title="New Data Source Menu..."
                    onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                    className="p-1 hover:bg-[#cbd5e1] rounded-xs text-emerald-600 flex items-center cursor-pointer border border-[#cbd5e1] bg-white"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-600" />
                  </button>
                </div>

                {/* 2. Wizard Action */}
                <button
                  title="GS1 Application Identifier Wizard"
                  onClick={() => handleAddNewDataSource('gs1_ai')}
                  className="p-1 hover:bg-[#cbd5e1] rounded-xs text-blue-700"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </button>

                {/* 3. Delete */}
                <button
                  title="Delete Selected Data Source"
                  onClick={handleDeleteActiveDataSource}
                  className="p-1 hover:bg-[#cbd5e1] rounded-xs text-red-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                {/* 4. Copy */}
                <button
                  title="Copy Value"
                  onClick={() => navigator.clipboard?.writeText(activeDataSource.value || value)}
                  className="p-1 hover:bg-[#cbd5e1] rounded-xs text-slate-700"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  title="Move Up"
                  onClick={() => handleMoveDataSource('up')}
                  disabled={currentDsIndex <= 0}
                  className="p-1 hover:bg-[#cbd5e1] disabled:opacity-30 rounded-xs text-slate-700"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  title="Move Down"
                  onClick={() => handleMoveDataSource('down')}
                  disabled={currentDsIndex >= dataSources.length - 1}
                  className="p-1 hover:bg-[#cbd5e1] disabled:opacity-30 rounded-xs text-slate-700"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* GS1 & Standard Data Sources Dropdown Menu matching User Screenshot */}
            {isAddMenuOpen && (
              <div
                ref={addMenuRef}
                className="absolute bottom-8 left-2 w-72 bg-white border border-[#94a3b8] shadow-2xl rounded-xs py-1 z-50 text-[11.5px] text-slate-800 animate-in fade-in zoom-in-95 duration-100"
              >
                {/* 1. GS1 Specific Options (Highlighted Top) */}
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 border-b border-slate-200">
                  GS1 Wizards
                </div>
                <button
                  onClick={() => handleAddNewDataSource('gs1_ai')}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#0078d7] hover:text-white flex items-center gap-2 cursor-pointer font-medium"
                >
                  <Globe className="w-3.5 h-3.5 text-emerald-600 group-hover:text-white" />
                  <span>GS1 Application Identifier Data Source Wizard</span>
                </button>
                <button
                  onClick={() => handleAddNewDataSource('gs1_composite')}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#0078d7] hover:text-white flex items-center gap-2 cursor-pointer font-medium"
                >
                  <Layers className="w-3.5 h-3.5 text-purple-600 group-hover:text-white" />
                  <span>GS1 Composite Data Source Wizard</span>
                </button>
                <button
                  onClick={() => handleAddNewDataSource('gs1_databar')}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#0078d7] hover:text-white flex items-center gap-2 cursor-pointer font-medium"
                >
                  <BarChart2 className="w-3.5 h-3.5 text-blue-600 group-hover:text-white" />
                  <span>GS1 DataBar Data Source Wizard</span>
                </button>

                <div className="my-1 border-t border-slate-200" />

                {/* 2. Standard Enterprise Data Source Options */}
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 border-b border-slate-200">
                  Standard Data Sources
                </div>
                <button
                  onClick={() => handleAddNewDataSource('embedded')}
                  className="w-full text-left px-3 py-1.2 hover:bg-[#0078d7] hover:text-white flex items-center gap-2 cursor-pointer"
                >
                  <span>💾</span>
                  <span>Embedded Constant Data</span>
                </button>
                <button
                  onClick={() => handleAddNewDataSource('database')}
                  className="w-full text-left px-3 py-1.2 hover:bg-[#0078d7] hover:text-white flex items-center gap-2 cursor-pointer"
                >
                  <span>🗄️</span>
                  <span>Database Field Connection</span>
                </button>
                <button
                  onClick={() => handleAddNewDataSource('serial')}
                  className="w-full text-left px-3 py-1.2 hover:bg-[#0078d7] hover:text-white flex items-center gap-2 cursor-pointer"
                >
                  <span>🔢</span>
                  <span>Serial Number / Counter</span>
                </button>
                <button
                  onClick={() => handleAddNewDataSource('clock')}
                  className="w-full text-left px-3 py-1.2 hover:bg-[#0078d7] hover:text-white flex items-center gap-2 cursor-pointer"
                >
                  <span>🕒</span>
                  <span>Clock / Dynamic Date Offset</span>
                </button>
                <button
                  onClick={() => handleAddNewDataSource('variable')}
                  className="w-full text-left px-3 py-1.2 hover:bg-[#0078d7] hover:text-white flex items-center gap-2 cursor-pointer"
                >
                  <span>🔗</span>
                  <span>Template Variable Link</span>
                </button>
                <button
                  onClick={() => handleAddNewDataSource('system')}
                  className="w-full text-left px-3 py-1.2 hover:bg-[#0078d7] hover:text-white flex items-center gap-2 cursor-pointer"
                >
                  <span>⚙️</span>
                  <span>System Machine Variable</span>
                </button>
                <button
                  onClick={() => handleAddNewDataSource('script')}
                  className="w-full text-left px-3 py-1.2 hover:bg-[#0078d7] hover:text-white flex items-center gap-2 cursor-pointer"
                >
                  <span>⚡</span>
                  <span>JavaScript Expression</span>
                </button>
              </div>
            )}
          </div>

          {/* RIGHT MAIN PANEL: Tabs & Property Inputs */}
          <div className="flex-1 p-5 bg-white overflow-y-auto">
            {/* ========================================================================= */}
            {/* 1. SYMBOLOGY AND SIZE                                                     */}
            {/* ========================================================================= */}
            {/* ========================================================================= */}
            {/* 1. SYMBOLOGY AND SIZE (BarTender Standard Layout & Controls)              */}
            {/* ========================================================================= */}
            {selectedCategory === 'symbology' && (() => {
              const symCap = getBarcodeCapability(symbology);
              const activeDpi = 203;
              const actualXInfo = calculateActualXDimension(xDimensionMm, activeDpi);
              const currentSymMeta = SYMBOLOGY_FULL_METADATA_CATALOG.find((s) => s.id === symbology) || {
                id: symbology,
                name: symbology,
                category: '1D Barcodes',
                description: '',
              };

              const filteredSymbologies = SYMBOLOGY_FULL_METADATA_CATALOG.filter((item) => {
                const matchesCategory =
                  selectedSymbologyCategory === 'All' || item.category === selectedSymbologyCategory;
                const matchesSearch =
                  !symbologySearchQuery ||
                  item.name.toLowerCase().includes(symbologySearchQuery.toLowerCase()) ||
                  item.id.toLowerCase().includes(symbologySearchQuery.toLowerCase()) ||
                  (item.standard && item.standard.toLowerCase().includes(symbologySearchQuery.toLowerCase())) ||
                  (item.description && item.description.toLowerCase().includes(symbologySearchQuery.toLowerCase()));
                return matchesCategory && matchesSearch;
              });

              return (
                <div className="space-y-4">
                  {/* Symbology Searchable Dropdown Row matching Screenshot 1 & 2 */}
                  <div className="relative">
                    <div className="flex items-center gap-3">
                      <label className="w-24 text-slate-700 text-[12px] font-medium shrink-0">Symbology:</label>
                      <div className="flex-1 relative">
                        <button
                          type="button"
                          onClick={() => {
                            setIsSymbologyDropdownOpen(!isSymbologyDropdownOpen);
                            setSymbologySearchQuery('');
                          }}
                          className="w-full bg-white border border-[#94a3b8] hover:border-[#0078d7] rounded-xs px-2.5 py-1 text-[12px] text-slate-900 font-medium flex items-center justify-between shadow-2xs cursor-pointer text-left"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider bg-slate-100 px-1 py-0.2 rounded-2xs border border-slate-200">
                              {currentSymMeta.category.replace(' Barcodes', '')}
                            </span>
                            <span className="font-semibold text-slate-900 truncate">{currentSymMeta.name}</span>
                          </div>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-1" />
                        </button>

                        {/* Searchable / Categorized Symbology Dropdown Popover matching Screenshot 2 */}
                        {isSymbologyDropdownOpen && (
                          <div
                            ref={symbologyDropdownRef}
                            className="absolute top-full left-0 mt-1 w-full min-w-[380px] bg-white border border-[#718096] shadow-2xl rounded-xs z-50 text-[11.5px] text-slate-800 animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-[360px] overflow-hidden"
                          >
                            {/* Search Box */}
                            <div className="p-2 border-b border-slate-200 bg-[#f8fafc] flex items-center gap-1.5">
                              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <input
                                type="text"
                                autoFocus
                                placeholder="Search symbology, standard or code page..."
                                value={symbologySearchQuery}
                                onChange={(e) => setSymbologySearchQuery(e.target.value)}
                                className="w-full bg-white border border-[#cbd5e1] rounded-xs px-2 py-0.8 text-[11.5px] outline-none focus:border-[#0078d7]"
                              />
                            </div>

                            {/* Category Filter Tabs */}
                            <div className="flex items-center gap-1 p-1 bg-slate-100 border-b border-slate-200 text-[10.5px] overflow-x-auto">
                              {(['All', '1D Barcodes', '2D Barcodes', 'Postal Barcodes', 'GS1 / Composite'] as const).map((cat) => (
                                <button
                                  key={cat}
                                  type="button"
                                  onClick={() => setSelectedSymbologyCategory(cat)}
                                  className={`px-2 py-0.5 rounded-2xs whitespace-nowrap font-medium transition-colors cursor-pointer ${selectedSymbologyCategory === cat
                                      ? 'bg-[#0078d7] text-white'
                                      : 'text-slate-700 hover:bg-slate-200'
                                    }`}
                                >
                                  {cat}
                                </button>
                              ))}
                            </div>

                            {/* Symbologies List */}
                            <div className="overflow-y-auto flex-1 p-1 space-y-0.5 max-h-[260px]">
                              {filteredSymbologies.length === 0 ? (
                                <div className="p-4 text-center text-slate-400 italic">No matching symbologies found</div>
                              ) : (
                                filteredSymbologies.map((item) => {
                                  const isSelected = item.id === symbology;
                                  return (
                                    <div
                                      key={item.id}
                                      onClick={() => {
                                        setSymbology(item.id);
                                        const cap = getBarcodeCapability(item.id);
                                        const nextX = cap.defaultXDimensionMm || xDimensionMm;
                                        const nextRatio = cap.defaultRatio || ratio;
                                        const nextHeight = cap.defaultHeightMm || heightMm;
                                        setXDimensionMm(nextX);
                                        setRatio(nextRatio);
                                        setHeightMm(nextHeight);
                                        setIsSymbologyDropdownOpen(false);
                                        applyChange({
                                          symbology: item.id,
                                          xDimensionMm: nextX,
                                          ratio: nextRatio,
                                          barHeight: nextHeight,
                                          height: nextHeight,
                                          barWidth: Math.max(1, Math.round(nextX / 0.35)),
                                        });
                                      }}
                                      className={`px-2 py-1.5 rounded-xs flex items-start justify-between cursor-pointer transition-colors ${isSelected
                                          ? 'bg-[#0078d7] text-white'
                                          : 'hover:bg-[#e5f3ff] text-slate-800'
                                        }`}
                                    >
                                      <div>
                                        <div className="font-semibold text-[11.5px] leading-snug">{item.name}</div>
                                        <div className={`text-[10px] line-clamp-1 ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                                          {item.description}
                                        </div>
                                      </div>
                                      <div className="text-right shrink-0 ml-2">
                                        <span
                                          className={`text-[9.5px] font-mono px-1 py-0.2 rounded-2xs border ${isSelected
                                              ? 'bg-blue-600 text-white border-blue-400'
                                              : 'bg-slate-100 text-slate-600 border-slate-200'
                                            }`}
                                        >
                                          {item.category.replace(' Barcodes', '')}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Group 1: Dimensions matching Screenshot 1 */}
                  <fieldset className="border border-[#cbd5e1] rounded-xs p-3 pt-2 text-[11.5px] space-y-2.5 bg-white">
                    <legend className="px-1 text-slate-700 font-semibold text-[11px]">Dimensions</legend>

                    {/* X Dimension Row with Advanced Button */}
                    <div className="flex items-center gap-2">
                      <label className="w-24 text-slate-700 shrink-0">X Dimension:</label>
                      <div className="flex items-center gap-1.5 flex-1">
                        <input
                          type="number"
                          step={xDimensionUnits === 'mils' ? 0.5 : 0.01}
                          min={0.01}
                          value={xDimensionUnits === 'mils' ? Number((xDimensionMm * 39.3701).toFixed(2)) : xDimensionMm}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0.38;
                            const valMm = xDimensionUnits === 'mils' ? val * 0.0254 : val;
                            setXDimensionMm(valMm);
                            const newDensity = calculateBarcodeDensity({
                              symbology,
                              data: value || '12345678',
                              xDimensionMm: valMm,
                              ratio,
                            });
                            setDensity(newDensity);
                            applyChange({
                              xDimensionMm: valMm,
                              density: newDensity,
                              barWidth: Math.max(1, Math.round(valMm / 0.35)),
                            });
                          }}
                          className="w-24 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.8 text-right font-mono text-[11.5px]"
                        />
                        <span className="text-slate-600 text-[11px] shrink-0 font-medium">
                          {xDimensionUnits === 'mils' ? 'mils' : 'mm'}
                        </span>

                        <button
                          type="button"
                          onClick={() => setIsAdvancedXModalOpen(true)}
                          title="Open Barcode X Dimension Advanced Dialog"
                          className="px-2 py-0.8 bg-[#f1f5f9] hover:bg-[#e2e8f0] border border-[#94a3b8] rounded-xs text-slate-700 font-bold text-[11px] cursor-pointer shadow-2xs"
                        >
                          ...
                        </button>

                        <div className="text-[10px] text-slate-500 font-mono ml-2">
                          (Actual: {(actualXInfo?.actualXmm ?? actualXInfo?.actualXMm ?? 0.375).toFixed(3)} mm @ {activeDpi} DPI)
                        </div>
                      </div>
                    </div>

                    {/* Ratio & Density Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Ratio */}
                      <div className="flex items-center gap-2">
                        <label className={`w-24 shrink-0 ${symCap.supportsRatio ? 'text-slate-700' : 'text-slate-400'}`}>
                          Ratio:
                        </label>
                        <select
                          disabled={!symCap.supportsRatio}
                          value={ratio.toString()}
                          onChange={(e) => {
                            const r = parseFloat(e.target.value) || 2.5;
                            setRatio(r);
                            const newDensity = calculateBarcodeDensity({
                              symbology,
                              data: value || '12345678',
                              xDimensionMm,
                              ratio: r,
                            });
                            setDensity(newDensity);
                            applyChange({ ratio: r, density: newDensity });
                          }}
                          className="flex-1 bg-white border border-[#94a3b8] disabled:bg-slate-100 disabled:text-slate-400 rounded-xs px-2 py-0.8 text-[11px]"
                        >
                          <option value="2">2.0 : 1</option>
                          <option value="2.2">2.2 : 1</option>
                          <option value="2.5">2.5 : 1 (Standard)</option>
                          <option value="3">3.0 : 1</option>
                        </select>
                      </div>

                      {/* Density */}
                      <div className="flex items-center gap-2">
                        <label className={`w-20 shrink-0 ${symCap.supportsDensity ? 'text-slate-700' : 'text-slate-400'}`}>
                          Density:
                        </label>
                        <div className="flex-1 flex items-center gap-1">
                          <input
                            type="number"
                            step={0.1}
                            min={0.1}
                            disabled={!symCap.supportsDensity}
                            value={density}
                            onChange={(e) => {
                              const d = parseFloat(e.target.value) || 2.6;
                              setDensity(d);
                              applyChange({ density: d });
                            }}
                            className="w-20 bg-white border border-[#94a3b8] disabled:bg-slate-100 disabled:text-slate-400 rounded-xs px-2 py-0.8 text-right font-mono text-[11.5px]"
                          />
                          <span className="text-slate-500 text-[10.5px]">ch/mm</span>
                        </div>
                      </div>
                    </div>

                    {/* Height */}
                    <div className="flex items-center gap-2">
                      <label className={`w-24 shrink-0 ${symCap.supportsHeight ? 'text-slate-700' : 'text-slate-400'}`}>
                        Height:
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step={0.5}
                          min={2}
                          disabled={!symCap.supportsHeight}
                          value={heightMm}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 12.7;
                            setHeightMm(val);
                            const sim = {
                              ...(activeElement as BarcodeElement),
                              barHeight: val,
                              includeText: hrVisibility !== 'none',
                              humanReadableFontSize: pointSize,
                              fontSize: pointSize,
                              humanReadableOffsetV: hrVerticalOffsetMm,
                            };
                            const layout = calculateBarcodeLayout(sim);
                            const totalH = layout.totalHeightMm;
                            setPosHeight(totalH);
                            applyChange({
                              height: totalH,
                              barHeight: val,
                              symbol: {
                                barHeight: val,
                                moduleWidth: xDimensionMm,
                              },
                            });
                          }}
                          className="w-24 bg-white border border-[#94a3b8] disabled:bg-slate-100 disabled:text-slate-400 rounded-xs px-2 py-0.8 text-right font-mono text-[11.5px]"
                        />
                        <span className="text-slate-600 text-[11px]">mm</span>
                      </div>
                    </div>
                  </fieldset>

                  {/* Group 2: Symbology-Specific Options matching Screenshot 1 & 4 */}
                  <fieldset className="border border-[#cbd5e1] rounded-xs p-3 pt-2 text-[11.5px] space-y-2.5 bg-white">
                    <legend className="px-1 text-slate-700 font-semibold text-[11px]">Symbology Specific Options</legend>

                    {/* Check Digit */}
                    {symCap.supportsCheckDigit && (
                      <div className="flex items-center gap-2">
                        <label className="w-24 text-slate-700 shrink-0">Check Digit:</label>
                        <select
                          value={checkDigitMode}
                          onChange={(e) => {
                            const mode = e.target.value as 'auto' | 'include' | 'exclude';
                            setCheckDigitMode(mode);
                            setCheckDigit(mode !== 'exclude');
                            applyChange({ checkDigitMode: mode, checkDigit: mode !== 'exclude' });
                          }}
                          className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.8 text-[11px]"
                        >
                          <option value="include">Include Standard Check Digit</option>
                          <option value="auto">Auto (Validate and Append)</option>
                          <option value="exclude">None (Exclude)</option>
                        </select>
                      </div>
                    )}

                    {/* Code Set for Code 128 / GS1-128 */}
                    {symCap.supportsCodeSet && (
                      <div className="flex items-center gap-2">
                        <label className="w-24 text-slate-700 shrink-0">Code Set:</label>
                        <select
                          value={codeSet}
                          onChange={(e) => {
                            const cs = e.target.value as 'Auto' | 'A' | 'B' | 'C';
                            setCodeSet(cs);
                            applyChange({ codeSet: cs });
                          }}
                          className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.8 text-[11px]"
                        >
                          <option value="Auto">Auto (Optimized Switching A/B/C)</option>
                          <option value="A">Code Set A (Standard + Controls)</option>
                          <option value="B">Code Set B (Standard ASCII)</option>
                          <option value="C">Code Set C (Double-Density Numeric Pairs)</option>
                        </select>
                      </div>
                    )}

                    {/* GS1 Compliance Mode & AI Wizard Trigger */}
                    {symCap.supportsGS1 && (
                      <div className="space-y-2 border-t border-slate-200 pt-2">
                        <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                          <input
                            type="checkbox"
                            checked={gs1Mode}
                            onChange={(e) => {
                              setGs1Mode(e.target.checked);
                              applyChange({ gs1Mode: e.target.checked, isGs1: e.target.checked });
                            }}
                            className="rounded-xs text-blue-600"
                          />
                          <span className="font-semibold text-slate-900">GS1 Compliance & AI Bracketing Mode</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => handleAddNewDataSource('gs1_ai')}
                          className="w-full flex items-center justify-center gap-1.5 py-1 px-3 bg-[#f8fafc] hover:bg-[#e2e8f0] border border-[#94a3b8] rounded-xs text-slate-700 font-medium text-[11px] cursor-pointer"
                        >
                          <Globe className="w-3.5 h-3.5 text-emerald-600" />
                          <span>GS1 Application Identifier Data Source Wizard...</span>
                        </button>
                      </div>
                    )}

                    {/* Error Correction Level */}
                    {symCap.supportsErrorCorrection && (
                      <div className="flex items-center gap-2">
                        <label className="w-24 text-slate-700 shrink-0">Error Correction:</label>
                        <select
                          value={errorCorrectionLevel}
                          onChange={(e) => {
                            const lvl = e.target.value as 'L' | 'M' | 'Q' | 'H';
                            setErrorCorrectionLevel(lvl);
                            applyChange({ errorCorrectionLevel: lvl });
                          }}
                          className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.8 text-[11px]"
                        >
                          <option value="L">Level L (7% Recovery - High Density)</option>
                          <option value="M">Level M (15% Recovery - Standard)</option>
                          <option value="Q">Level Q (25% Recovery - Enhanced)</option>
                          <option value="H">Level H (30% Recovery - Maximum Reliability)</option>
                        </select>
                      </div>
                    )}

                    {/* Bearer Bars for ITF-14 / Interleaved 2 of 5 */}
                    {(symbology === 'itf14' || symbology === 'interleaved2of5' || symbology === 'code128') && (
                      <div className="space-y-2 border-t border-slate-200 pt-2">
                        <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                          <input
                            type="checkbox"
                            checked={bearerBars}
                            onChange={(e) => {
                              setBearerBars(e.target.checked);
                              applyChange({ bearerBars: e.target.checked });
                            }}
                            className="rounded-xs text-blue-600"
                          />
                          <span className="font-medium">Enable Bearer Bars</span>
                        </label>
                        {bearerBars && (
                          <div className="grid grid-cols-2 gap-3 pl-5">
                            <div className="flex items-center gap-2">
                              <label className="text-slate-600">Type:</label>
                              <select
                                value={bearerBarType}
                                onChange={(e) => {
                                  const t = e.target.value as 'top-bottom' | 'complete';
                                  setBearerBarType(t);
                                  applyChange({ bearerBarType: t });
                                }}
                                className="bg-white border border-[#94a3b8] rounded-xs px-2 py-0.5 text-[11px]"
                              >
                                <option value="top-bottom">Top and Bottom</option>
                                <option value="complete">Complete Frame</option>
                              </select>
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-slate-600">Thickness:</label>
                              <input
                                type="number"
                                min={0.5}
                                step={0.5}
                                value={bearerBarThickness}
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value) || 1;
                                  setBearerBarThickness(v);
                                  applyChange({ bearerBarThickness: v });
                                }}
                                className="w-16 bg-white border border-[#94a3b8] rounded-xs px-1.5 py-0.5 text-right font-mono text-[11px]"
                              />
                              <span className="text-[10.5px] text-slate-500">mm</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Text Encoding (Authentic Code Pages matching Screenshot 4) */}
                    {symCap.supportsTextEncoding && (
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                        <label className="w-24 text-slate-700 shrink-0">Text Encoding:</label>
                        <select
                          value={textEncoding}
                          onChange={(e) => {
                            const enc = e.target.value as BarcodeTextEncoding;
                            setTextEncoding(enc);
                            applyChange({ textEncoding: enc });
                          }}
                          className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.8 text-[11px]"
                        >
                          {TEXT_ENCODING_CODEPAGES.map((cp) => (
                            <option key={cp.id} value={cp.id}>
                              {cp.label} ({cp.codePage})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </fieldset>

                  {/* Group 3: Barcode Color & Print Method Actions matching Screenshot 1 */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <label className="text-slate-700 font-medium">Barcode Color:</label>
                      <input
                        type="color"
                        value={barcodeColor}
                        onChange={(e) => {
                          setBarcodeColor(e.target.value);
                          applyChange({ foregroundColor: e.target.value, color: e.target.value });
                        }}
                        className="w-7 h-6 p-0 border border-slate-300 rounded-xs cursor-pointer"
                      />
                      <span className="font-mono text-[11px] text-slate-600 font-semibold">{barcodeColor}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsPrintMethodModalOpen(true)}
                      className="px-3 py-1 bg-white hover:bg-slate-100 border border-[#94a3b8] rounded-xs text-slate-700 flex items-center gap-1.5 cursor-pointer font-medium shadow-2xs"
                    >
                      <Printer className="w-3.5 h-3.5 text-blue-600" />
                      <span>Print Method...</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* ========================================================================= */}
            {/* 2. HUMAN READABLE                                                         */}
            {/* ========================================================================= */}
            {/* ========================================================================= */}
            {/* 2. HUMAN READABLE (BarTender Standard Layout & Controls)                  */}
            {/* ========================================================================= */}
            {selectedCategory === 'human-readable' && (() => {
              const symCap = getBarcodeCapability(symbology);
              const supportsCheckDigit = symCap.supportsCheckDigit;
              const isGs1 = Boolean(symCap.supportsGS1 || gs1Mode || symbology?.startsWith('gs1'));

              return (
                <div className="space-y-3.5">
                  {/* Section 1: Visibility */}
                  <fieldset className="border border-[#cbd5e1] rounded-xs p-3 pt-2 text-[11.5px] bg-white">
                    <legend className="px-1 text-slate-700 font-semibold text-[11px]">Visibility</legend>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-5">
                        <label className="flex items-center gap-1.5 cursor-pointer text-slate-800">
                          <input
                            type="radio"
                            name="hr-vis"
                            checked={hrVisibility === 'full'}
                            onChange={() => {
                              setHrVisibility('full');
                              applyHrChange({ visibility: 'full' });
                            }}
                            className="accent-[#0078d7]"
                          />
                          <span>Full</span>
                        </label>

                        <label className="flex items-center gap-1.5 cursor-pointer text-slate-800">
                          <input
                            type="radio"
                            name="hr-vis"
                            checked={hrVisibility === 'none'}
                            onChange={() => {
                              setHrVisibility('none');
                              applyHrChange({ visibility: 'none' });
                            }}
                            className="accent-[#0078d7]"
                          />
                          <span>None</span>
                        </label>

                        <label className="flex items-center gap-1.5 cursor-pointer text-slate-800">
                          <input
                            type="radio"
                            name="hr-vis"
                            checked={hrVisibility === 'perSource'}
                            onChange={() => {
                              setHrVisibility('perSource');
                              applyHrChange({ visibility: 'perSource' });
                            }}
                            className="accent-[#0078d7]"
                          />
                          <span>Set per Data Source</span>
                        </label>
                      </div>

                      <button
                        type="button"
                        disabled={hrVisibility !== 'perSource'}
                        onClick={() => setIsSelectVisibleSourcesModalOpen(true)}
                        className="px-3 py-1 bg-white disabled:bg-slate-100 disabled:text-slate-400 hover:bg-slate-100 border border-[#94a3b8] rounded-xs text-slate-800 font-medium text-[11.5px] shadow-2xs cursor-pointer disabled:cursor-not-allowed"
                      >
                        Select...
                      </button>
                    </div>
                  </fieldset>

                  {/* Section 2: Position */}
                  <fieldset className="border border-[#cbd5e1] rounded-xs p-3 pt-2 text-[11.5px] space-y-2.5 bg-white">
                    <legend className="px-1 text-slate-700 font-semibold text-[11px]">Position</legend>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                      {/* Placement */}
                      <div className="flex items-center gap-2">
                        <label className="w-24 text-slate-700 shrink-0">Placement:</label>
                        <select
                          value={hrPlacement}
                          onChange={(e) => {
                            const p = e.target.value as 'Bottom' | 'Top';
                            setHrPlacement(p);
                            applyHrChange({ placement: p === 'Top' ? 'top' : 'bottom' });
                          }}
                          className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.8 text-[11.5px] text-slate-900"
                        >
                          <option value="Bottom">Bottom</option>
                          <option value="Top">Top</option>
                        </select>
                      </div>

                      {/* Vertical Offset */}
                      <div className="flex items-center gap-2">
                        <label className="w-24 text-slate-700 shrink-0">Vertical Offset:</label>
                        <div className="flex-1 flex items-center gap-1.5">
                          <input
                            type="number"
                            step={0.1}
                            value={hrVerticalOffsetMm}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setHrVerticalOffsetMm(val);
                              applyHrChange({ verticalOffsetMm: val });
                            }}
                            className="w-24 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.8 text-right font-mono text-[11.5px]"
                          />
                          <span className="text-slate-600 text-[11px]">mm</span>
                        </div>
                      </div>

                      {/* Alignment */}
                      <div className="flex items-center gap-2">
                        <label className="w-24 text-slate-700 shrink-0">Alignment:</label>
                        <select
                          value={hrAlignment}
                          onChange={(e) => {
                            const a = e.target.value as 'Centered' | 'Left' | 'Right';
                            setHrAlignment(a);
                            applyHrChange({
                              alignment: a === 'Left' ? 'left' : a === 'Right' ? 'right' : 'centered',
                            });
                          }}
                          className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.8 text-[11.5px] text-slate-900"
                        >
                          <option value="Centered">Centered</option>
                          <option value="Left">Left</option>
                          <option value="Right">Right</option>
                        </select>
                      </div>

                      {/* Horizontal Offset */}
                      <div className="flex items-center gap-2">
                        <label className="w-24 text-slate-700 shrink-0">Horizontal Offset:</label>
                        <div className="flex-1 flex items-center gap-1.5">
                          <input
                            type="number"
                            step={0.1}
                            value={hrHorizontalOffsetMm}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setHrHorizontalOffsetMm(val);
                              applyHrChange({ horizontalOffsetMm: val });
                            }}
                            className="w-24 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.8 text-right font-mono text-[11.5px]"
                          />
                          <span className="text-slate-600 text-[11px]">mm</span>
                        </div>
                      </div>
                    </div>
                  </fieldset>

                  {/* Section 3: Symbology Specific Options */}
                  <fieldset className="border border-[#cbd5e1] rounded-xs p-3 pt-2 text-[11.5px] space-y-2 bg-white">
                    <legend className="px-1 text-slate-700 font-semibold text-[11px]">Symbology Specific Options</legend>

                    {/* Hide Check Digit */}
                    <div>
                      <label className={`flex items-center gap-2 cursor-pointer ${supportsCheckDigit ? 'text-slate-800' : 'text-slate-400'}`}>
                        <input
                          type="checkbox"
                          disabled={!supportsCheckDigit}
                          checked={hrHideCheckDigit}
                          onChange={(e) => {
                            setHrHideCheckDigit(e.target.checked);
                            applyHrChange({ hideCheckDigit: e.target.checked });
                          }}
                          className="rounded-xs accent-[#0078d7]"
                        />
                        <span>Hide Check Digit</span>
                      </label>
                    </div>

                    {/* GS1 Template */}
                    <div className="flex items-center gap-2 pt-1">
                      <label className={`w-24 shrink-0 ${isGs1 ? 'text-slate-700' : 'text-slate-400'}`}>
                        GS1 Template:
                      </label>
                      <select
                        disabled={!isGs1}
                        value={hrGs1Template}
                        onChange={(e) => {
                          const val = e.target.value as 'none' | 'standard' | 'custom';
                          setHrGs1Template(val);
                          applyHrChange({ gs1Template: val });
                        }}
                        className="w-64 bg-white disabled:bg-slate-100 disabled:text-slate-400 border border-[#94a3b8] rounded-xs px-2 py-0.8 text-[11.5px]"
                      >
                        <option value="none">None</option>
                        <option value="standard">Standard Parenthesized AI</option>
                        <option value="custom">Custom Template</option>
                      </select>
                    </div>

                    {/* Line break after each application identifier */}
                    <div className="pt-0.5">
                      <label className={`flex items-center gap-2 cursor-pointer ${isGs1 ? 'text-slate-800' : 'text-slate-400'}`}>
                        <input
                          type="checkbox"
                          disabled={!isGs1 || hrGs1Template === 'none'}
                          checked={hrLineBreakAfterAi}
                          onChange={(e) => {
                            setHrLineBreakAfterAi(e.target.checked);
                            applyHrChange({ lineBreakAfterAi: e.target.checked });
                          }}
                          className="rounded-xs accent-[#0078d7]"
                        />
                        <span>Line break after each application identifier</span>
                      </label>
                    </div>
                  </fieldset>

                  {/* Section 4: Human Readable Transforms */}
                  <fieldset className="border border-[#cbd5e1] rounded-xs p-3 pt-2 text-[11.5px] space-y-2 bg-white">
                    <legend className="px-1 text-slate-700 font-semibold text-[11px]">Human Readable Transforms</legend>

                    {/* 1. Character Template */}
                    <div className="flex items-center gap-2">
                      <label className="w-36 text-slate-700 shrink-0">Character Template:</label>
                      <div className="flex-1 flex items-center gap-1.5">
                        <input
                          type="text"
                          readOnly
                          value={hrCharacterTemplate?.template || '<None>'}
                          className="flex-1 bg-[#f8fafc] border border-[#94a3b8] rounded-xs px-2 py-0.8 text-[11px] text-slate-700 font-mono select-all"
                        />
                        <button
                          type="button"
                          onClick={() => setActiveHrTransformModal('template')}
                          title="Edit Character Template"
                          className="p-1 bg-white hover:bg-slate-100 border border-[#94a3b8] rounded-xs text-slate-700 shadow-2xs cursor-pointer shrink-0"
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                            <rect x="2" y="2" width="10" height="12" rx="1" fill="#ffffff" stroke="#475569" strokeWidth="1.2" />
                            <line x1="4" y1="5" x2="8" y2="5" stroke="#94a3b8" strokeWidth="1" />
                            <line x1="4" y1="8" x2="10" y2="8" stroke="#94a3b8" strokeWidth="1" />
                            <line x1="4" y1="11" x2="7" y2="11" stroke="#94a3b8" strokeWidth="1" />
                            <polygon points="9,14 14,9 15,10 10,15 8,15" fill="#f59e0b" stroke="#b45309" strokeWidth="0.8" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* 2. Search and Replace */}
                    <div className="flex items-center gap-2">
                      <label className="w-36 text-slate-700 shrink-0">Search and Replace:</label>
                      <div className="flex-1 flex items-center gap-1.5">
                        <input
                          type="text"
                          readOnly
                          value={
                            hrSearchReplace.length > 0
                              ? `${hrSearchReplace.length} rule(s) configured`
                              : '<None>'
                          }
                          className="flex-1 bg-[#f8fafc] border border-[#94a3b8] rounded-xs px-2 py-0.8 text-[11px] text-slate-700 select-all"
                        />
                        <button
                          type="button"
                          onClick={() => setActiveHrTransformModal('searchReplace')}
                          title="Edit Search and Replace Rules"
                          className="p-1 bg-white hover:bg-slate-100 border border-[#94a3b8] rounded-xs text-slate-700 shadow-2xs cursor-pointer shrink-0"
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                            <rect x="2" y="2" width="10" height="12" rx="1" fill="#ffffff" stroke="#475569" strokeWidth="1.2" />
                            <line x1="4" y1="5" x2="8" y2="5" stroke="#94a3b8" strokeWidth="1" />
                            <line x1="4" y1="8" x2="10" y2="8" stroke="#94a3b8" strokeWidth="1" />
                            <line x1="4" y1="11" x2="7" y2="11" stroke="#94a3b8" strokeWidth="1" />
                            <polygon points="9,14 14,9 15,10 10,15 8,15" fill="#f59e0b" stroke="#b45309" strokeWidth="0.8" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* 3. VB Script */}
                    <div className="flex items-center gap-2">
                      <label className="w-36 text-slate-700 shrink-0">VB Script:</label>
                      <div className="flex-1 flex items-center gap-1.5">
                        <input
                          type="text"
                          readOnly
                          value={hrScript?.code ? '(Script configured)' : '<None>'}
                          className="flex-1 bg-[#f8fafc] border border-[#94a3b8] rounded-xs px-2 py-0.8 text-[11px] text-slate-700 select-all font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setActiveHrTransformModal('script')}
                          title="Edit VB Script / JavaScript Transform"
                          className="p-1 bg-white hover:bg-slate-100 border border-[#94a3b8] rounded-xs text-slate-700 shadow-2xs cursor-pointer shrink-0"
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                            <rect x="2" y="2" width="10" height="12" rx="1" fill="#ffffff" stroke="#475569" strokeWidth="1.2" />
                            <line x1="4" y1="5" x2="8" y2="5" stroke="#94a3b8" strokeWidth="1" />
                            <line x1="4" y1="8" x2="10" y2="8" stroke="#94a3b8" strokeWidth="1" />
                            <line x1="4" y1="11" x2="7" y2="11" stroke="#94a3b8" strokeWidth="1" />
                            <polygon points="9,14 14,9 15,10 10,15 8,15" fill="#f59e0b" stroke="#b45309" strokeWidth="0.8" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* 4. Prefix and Suffix */}
                    <div className="flex items-center gap-2">
                      <label className="w-36 text-slate-700 shrink-0">Prefix and Suffix:</label>
                      <div className="flex-1 flex items-center gap-1.5">
                        <input
                          type="text"
                          readOnly
                          value={
                            hrPrefixSuffix?.prefix || hrPrefixSuffix?.suffix
                              ? `Prefix: "${hrPrefixSuffix.prefix || ''}" | Suffix: "${hrPrefixSuffix.suffix || ''}"`
                              : '<None>'
                          }
                          className="flex-1 bg-[#f8fafc] border border-[#94a3b8] rounded-xs px-2 py-0.8 text-[11px] text-slate-700 select-all"
                        />
                        <button
                          type="button"
                          onClick={() => setActiveHrTransformModal('prefixSuffix')}
                          title="Edit Prefix and Suffix"
                          className="p-1 bg-white hover:bg-slate-100 border border-[#94a3b8] rounded-xs text-slate-700 shadow-2xs cursor-pointer shrink-0"
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                            <rect x="2" y="2" width="10" height="12" rx="1" fill="#ffffff" stroke="#475569" strokeWidth="1.2" />
                            <line x1="4" y1="5" x2="8" y2="5" stroke="#94a3b8" strokeWidth="1" />
                            <line x1="4" y1="8" x2="10" y2="8" stroke="#94a3b8" strokeWidth="1" />
                            <line x1="4" y1="11" x2="7" y2="11" stroke="#94a3b8" strokeWidth="1" />
                            <polygon points="9,14 14,9 15,10 10,15 8,15" fill="#f59e0b" stroke="#b45309" strokeWidth="0.8" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </fieldset>
                </div>
              );
            })()}

            {/* ========================================================================= */}
            {/* 3. FONT                                                                   */}
            {/* ========================================================================= */}
            {selectedCategory === 'font' && (
              <div className="space-y-4">
                <fieldset className="border border-[#cbd5e1] rounded-xs p-3 pt-2 text-[11.5px] space-y-3">
                  <legend className="px-1 text-slate-700 font-medium">Typography & Font Selection</legend>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-slate-700 text-xs font-medium">Font Family:</label>
                      <select
                        value={selectedFont}
                        onChange={(e) => {
                          setSelectedFont(e.target.value);
                          applyChange({ humanReadableFont: e.target.value, fontFamily: e.target.value });
                        }}
                        className="w-full bg-white border border-[#94a3b8] rounded-xs px-2 py-1 text-xs"
                      >
                        <option value="Arial">Arial</option>
                        <option value="Courier New">Courier New</option>
                        <option value="Helvetica">Helvetica</option>
                        <option value="OCR-A Extended">OCR-A Extended</option>
                        <option value="OCR-B 10 Pitch BT">OCR-B 10 Pitch BT</option>
                        <option value="Consolas">Consolas</option>
                        <option value="Roboto">Roboto</option>
                        <option value="Inter">Inter</option>
                        <option value="Segoe UI">Segoe UI</option>
                        <option value="Times New Roman">Times New Roman</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-slate-700 text-xs font-medium">Font Size (pt):</label>
                      <input
                        type="number"
                        min={4}
                        max={72}
                        value={pointSize}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 12;
                          setPointSize(val);
                          const sim = {
                            ...(activeElement as BarcodeElement),
                            barHeight: heightMm,
                            includeText: hrVisibility !== 'none',
                            humanReadableFontSize: val,
                            fontSize: val,
                            humanReadableOffsetV: hrVerticalOffsetMm,
                          };
                          const layout = calculateBarcodeLayout(sim);
                          setPosHeight(layout.totalHeightMm);
                          applyChange({
                            humanReadableFontSize: val,
                            fontSize: val,
                            height: layout.totalHeightMm,
                            barHeight: heightMm,
                            symbol: {
                              ...((activeElement as BarcodeElement)?.symbol || {}),
                              barHeight: heightMm,
                            },
                          });
                        }}
                        className="w-full bg-white border border-[#94a3b8] rounded-xs px-2 py-1 text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Styles & Color */}
                  <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const next = !isBold;
                          setIsBold(next);
                          applyChange({ fontWeight: next ? 'bold' : 'normal' });
                        }}
                        className={`w-7 h-7 font-bold rounded-xs border text-xs cursor-pointer ${isBold ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
                          }`}
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !isItalic;
                          setIsItalic(next);
                          applyChange({ fontStyle: next ? 'italic' : 'normal' });
                        }}
                        className={`w-7 h-7 italic font-serif rounded-xs border text-xs cursor-pointer ${isItalic ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
                          }`}
                      >
                        I
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !isUnderline;
                          setIsUnderline(next);
                          applyChange({ underline: next, humanReadableUnderline: next });
                        }}
                        className={`w-7 h-7 underline rounded-xs border text-xs cursor-pointer ${isUnderline ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
                          }`}
                      >
                        U
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !isStrikeout;
                          setIsStrikeout(next);
                          applyChange({ humanReadableStrikeout: next });
                        }}
                        className={`w-7 h-7 line-through rounded-xs border text-xs cursor-pointer ${isStrikeout ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
                          }`}
                      >
                        S
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-slate-700 text-xs">Text Color:</label>
                      <input
                        type="color"
                        value={fontColor}
                        onChange={(e) => {
                          setFontColor(e.target.value);
                          applyChange({ humanReadableColor: e.target.value });
                        }}
                        className="w-7 h-6 p-0 border border-slate-300 rounded cursor-pointer"
                      />
                    </div>
                  </div>
                </fieldset>
              </div>
            )}

            {/* ========================================================================= */}
            {/* 4. TEXT FORMAT                                                            */}
            {/* ========================================================================= */}
            {selectedCategory === 'text-format' && (
              <div className="space-y-3">
                {/* Type Selection */}
                <fieldset className="border border-[#cbd5e1] rounded-xs p-2.5 text-[11.5px]">
                  <legend className="px-1 text-slate-700 font-medium">Type</legend>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="text-format-type"
                        checked={textFormatType === 'single-line'}
                        onChange={() => {
                          setTextFormatType('single-line');
                          applyChange({ textFormatType: 'single-line' });
                        }}
                      />
                      <span>Single Line</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="text-format-type"
                        checked={textFormatType === 'paragraph'}
                        onChange={() => {
                          setTextFormatType('paragraph');
                          applyChange({ textFormatType: 'paragraph' });
                        }}
                      />
                      <span>Paragraph</span>
                    </label>
                  </div>
                </fieldset>

                {/* Sub-Tabs: Auto Size | Tabs | Effects */}
                <div className="border border-[#cbd5e1] rounded-xs bg-white overflow-hidden">
                  <div className="flex border-b border-[#cbd5e1] bg-[#f1f5f9] text-[11.5px]">
                    <button
                      type="button"
                      onClick={() => setActiveTextFormatTab('auto-size')}
                      className={`px-4 py-1.5 font-medium border-r border-[#cbd5e1] cursor-pointer transition-colors ${activeTextFormatTab === 'auto-size'
                          ? 'bg-white text-blue-700 font-bold border-b-2 border-b-blue-600'
                          : 'text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                      Auto Size
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTextFormatTab('tabs')}
                      className={`px-4 py-1.5 font-medium border-r border-[#cbd5e1] cursor-pointer transition-colors ${activeTextFormatTab === 'tabs'
                          ? 'bg-white text-blue-700 font-bold border-b-2 border-b-blue-600'
                          : 'text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                      Tabs
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTextFormatTab('effects')}
                      className={`px-4 py-1.5 font-medium cursor-pointer transition-colors ${activeTextFormatTab === 'effects'
                          ? 'bg-white text-blue-700 font-bold border-b-2 border-b-blue-600'
                          : 'text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                      Effects
                    </button>
                  </div>

                  <div className="p-3 text-[11.5px]">
                    {/* 1. AUTO SIZE TAB */}
                    {activeTextFormatTab === 'auto-size' && (
                      <div className="space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
                          <input
                            type="checkbox"
                            checked={autoSize}
                            onChange={(e) => {
                              setAutoSize(e.target.checked);
                              applyChange({ autoSize: e.target.checked, autoSizeText: e.target.checked });
                            }}
                            className="rounded-xs text-blue-600"
                          />
                          <span>Auto Size (Fit readable text dynamically within bounds)</span>
                        </label>

                        {/* Font Point Size Constraints */}
                        <fieldset className="border border-[#e2e8f0] rounded-xs p-2.5 space-y-2">
                          <legend className="px-1 text-slate-600 font-medium">Font Point Size</legend>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-2">
                              <label className="w-16 text-slate-600">Minimum:</label>
                              <input
                                type="number"
                                min={4}
                                max={maxFontSize}
                                value={minFontSize}
                                disabled={!autoSize}
                                onChange={(e) => {
                                  const val = Math.max(1, parseInt(e.target.value) || 6);
                                  setMinFontSize(val);
                                  applyChange({ minFontSize: val });
                                }}
                                className="w-20 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.5 text-right font-mono text-[11px] disabled:bg-slate-100 disabled:text-slate-400"
                              />
                              <span className="text-slate-500 text-[10.5px]">pt</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="w-16 text-slate-600">Maximum:</label>
                              <input
                                type="number"
                                min={minFontSize}
                                max={72}
                                value={maxFontSize}
                                disabled={!autoSize}
                                onChange={(e) => {
                                  const val = Math.max(minFontSize, parseInt(e.target.value) || 20);
                                  setMaxFontSize(val);
                                  applyChange({ maxFontSize: val });
                                }}
                                className="w-20 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.5 text-right font-mono text-[11px] disabled:bg-slate-100 disabled:text-slate-400"
                              />
                              <span className="text-slate-500 text-[10.5px]">pt</span>
                            </div>
                          </div>
                        </fieldset>

                        {/* Font Width Scale Constraints */}
                        <fieldset className="border border-[#e2e8f0] rounded-xs p-2.5 space-y-2">
                          <legend className="px-1 text-slate-600 font-medium">Font Width Scale</legend>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-2">
                              <label className="w-16 text-slate-600">Minimum:</label>
                              <input
                                type="number"
                                min={50}
                                max={maxWidthScale}
                                value={minWidthScale}
                                disabled={!autoSize}
                                onChange={(e) => {
                                  const val = Math.max(10, parseInt(e.target.value) || 80);
                                  setMinWidthScale(val);
                                  applyChange({ minWidthScale: val });
                                }}
                                className="w-20 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.5 text-right font-mono text-[11px] disabled:bg-slate-100 disabled:text-slate-400"
                              />
                              <span className="text-slate-500 text-[10.5px]">%</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="w-16 text-slate-600">Maximum:</label>
                              <input
                                type="number"
                                min={minWidthScale}
                                max={200}
                                value={maxWidthScale}
                                disabled={!autoSize}
                                onChange={(e) => {
                                  const val = Math.max(minWidthScale, parseInt(e.target.value) || 100);
                                  setMaxWidthScale(val);
                                  applyChange({ maxWidthScale: val });
                                }}
                                className="w-20 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.5 text-right font-mono text-[11px] disabled:bg-slate-100 disabled:text-slate-400"
                              />
                              <span className="text-slate-500 text-[10.5px]">%</span>
                            </div>
                          </div>
                        </fieldset>

                        {/* Object Size */}
                        <fieldset className="border border-[#e2e8f0] rounded-xs p-2.5 space-y-2">
                          <legend className="px-1 text-slate-600 font-medium">Object Size</legend>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-2">
                              <label className="w-16 text-slate-600">Width:</label>
                              <input
                                type="number"
                                min={5}
                                step={0.5}
                                value={objWidthMm}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 50;
                                  setObjWidthMm(val);
                                  setPosWidth(val);
                                  applyChange({ width: val });
                                }}
                                className="w-20 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.5 text-right font-mono text-[11px]"
                              />
                              <span className="text-slate-500 text-[10.5px]">mm</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="w-16 text-slate-600">Height:</label>
                              <input
                                type="number"
                                min={5}
                                step={0.5}
                                value={objHeightMm}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 25;
                                  setObjHeightMm(val);
                                  setPosHeight(val);
                                  applyChange({ height: val });
                                }}
                                className="w-20 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.5 text-right font-mono text-[11px]"
                              />
                              <span className="text-slate-500 text-[10.5px]">mm</span>
                            </div>
                          </div>
                        </fieldset>

                        {/* Alignment */}
                        <fieldset className="border border-[#e2e8f0] rounded-xs p-2.5 space-y-2">
                          <legend className="px-1 text-slate-600 font-medium">Alignment</legend>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-2">
                              <label className="w-18 text-slate-600">Horizontal:</label>
                              <select
                                value={horizAlign}
                                onChange={(e) => {
                                  const val = e.target.value as 'left' | 'center' | 'right';
                                  setHorizAlign(val);
                                  applyChange({ horizontalAlignment: val, humanReadableAlignment: val });
                                }}
                                className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.5 text-[11px]"
                              >
                                <option value="left">Left</option>
                                <option value="center">Center</option>
                                <option value="right">Right</option>
                              </select>
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="w-18 text-slate-600">Vertical:</label>
                              <select
                                value={vertAlign}
                                onChange={(e) => {
                                  const val = e.target.value as 'top' | 'middle' | 'bottom';
                                  setVertAlign(val);
                                  applyChange({ verticalAlignment: val });
                                }}
                                className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.5 text-[11px]"
                              >
                                <option value="top">Top</option>
                                <option value="middle">Middle</option>
                                <option value="bottom">Bottom</option>
                              </select>
                            </div>
                          </div>
                        </fieldset>
                      </div>
                    )}

                    {/* 2. TABS TAB */}
                    {activeTextFormatTab === 'tabs' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-700">Tab Stops ({tabsList.length})</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step={1}
                              min={1}
                              value={newTabPos}
                              onChange={(e) => setNewTabPos(parseFloat(e.target.value) || 10)}
                              className="w-16 bg-white border border-[#94a3b8] rounded-xs px-1.5 py-0.5 text-right font-mono text-[11px]"
                            />
                            <span className="text-[10px] text-slate-500">mm</span>
                            <button
                              type="button"
                              onClick={() => {
                                const newTab = {
                                  id: `tab-${Date.now()}`,
                                  positionMm: newTabPos,
                                  alignment: newTabAlign,
                                  leader: newTabLeader,
                                };
                                const updated = [...tabsList, newTab];
                                setTabsList(updated);
                                applyChange({ tabsConfig: updated });
                              }}
                              className="px-2 py-0.5 bg-blue-600 text-white rounded-xs text-[11px] font-medium cursor-pointer"
                            >
                              Add Tab
                            </button>
                          </div>
                        </div>

                        {tabsList.length === 0 ? (
                          <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xs text-center text-slate-500 text-[11px]">
                            No custom tab stops configured. Standard optical barcode text spacing applies.
                          </div>
                        ) : (
                          <div className="border border-slate-200 rounded-xs divide-y divide-slate-200 max-h-36 overflow-y-auto">
                            {tabsList.map((t, idx) => (
                              <div key={t.id || idx} className="p-2 flex items-center justify-between bg-slate-50 text-[11px]">
                                <span className="font-mono font-medium">{t.positionMm} mm</span>
                                <span className="capitalize text-slate-600">{t.alignment} Align</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = tabsList.filter((_, i) => i !== idx);
                                    setTabsList(updated);
                                    applyChange({ tabsConfig: updated });
                                  }}
                                  className="text-red-600 hover:text-red-800 cursor-pointer font-bold"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 3. EFFECTS TAB */}
                    {activeTextFormatTab === 'effects' && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex items-center gap-2">
                            <label className="w-28 text-slate-600">Character Spacing:</label>
                            <input
                              type="number"
                              step={0.5}
                              value={charSpacing}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setCharSpacing(val);
                                applyChange({
                                  effectsConfig: { ...(element.effectsConfig || {}), letterSpacing: val },
                                });
                              }}
                              className="w-18 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.5 text-right font-mono text-[11px]"
                            />
                            <span className="text-[10px] text-slate-500">pt</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <label className="w-24 text-slate-600">Line Spacing:</label>
                            <input
                              type="number"
                              step={0.05}
                              min={0.8}
                              max={3}
                              value={lineSpacing}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 1.15;
                                setLineSpacing(val);
                                applyChange({
                                  effectsConfig: { ...(element.effectsConfig || {}), lineSpacing: val },
                                });
                              }}
                              className="w-18 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.5 text-right font-mono text-[11px]"
                            />
                          </div>
                        </div>

                        {/* Outline */}
                        <fieldset className="border border-[#e2e8f0] rounded-xs p-2 space-y-2">
                          <legend className="px-1 text-slate-600 font-medium">Text Outline</legend>
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={outlineEnabled}
                                onChange={(e) => {
                                  setOutlineEnabled(e.target.checked);
                                  applyChange({
                                    effectsConfig: { ...(element.effectsConfig || {}), outline: e.target.checked },
                                  });
                                }}
                              />
                              <span>Enable Outline</span>
                            </label>
                            {outlineEnabled && (
                              <div className="flex items-center gap-3">
                                <input
                                  type="color"
                                  value={outlineColor}
                                  onChange={(e) => {
                                    setOutlineColor(e.target.value);
                                    applyChange({
                                      effectsConfig: { ...(element.effectsConfig || {}), outlineColor: e.target.value },
                                    });
                                  }}
                                  className="w-6 h-5 p-0 border border-slate-300 rounded cursor-pointer"
                                />
                                <input
                                  type="number"
                                  min={0.5}
                                  step={0.5}
                                  value={outlineWidth}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 1;
                                    setOutlineWidth(val);
                                    applyChange({
                                      effectsConfig: { ...(element.effectsConfig || {}), outlineWidth: val },
                                    });
                                  }}
                                  className="w-14 bg-white border border-[#94a3b8] rounded-xs px-1.5 py-0.5 text-right font-mono text-[11px]"
                                />
                                <span className="text-[10px] text-slate-500">pt</span>
                              </div>
                            )}
                          </div>
                        </fieldset>

                        {/* Shadow */}
                        <fieldset className="border border-[#e2e8f0] rounded-xs p-2 space-y-2">
                          <legend className="px-1 text-slate-600 font-medium">Text Shadow</legend>
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={shadowEnabled}
                                onChange={(e) => {
                                  setShadowEnabled(e.target.checked);
                                  applyChange({
                                    effectsConfig: { ...(element.effectsConfig || {}), shadow: e.target.checked },
                                  });
                                }}
                              />
                              <span>Enable Shadow</span>
                            </label>
                            {shadowEnabled && (
                              <div className="flex items-center gap-3">
                                <input
                                  type="color"
                                  value={shadowColor}
                                  onChange={(e) => {
                                    setShadowColor(e.target.value);
                                    applyChange({
                                      effectsConfig: { ...(element.effectsConfig || {}), shadowColor: e.target.value },
                                    });
                                  }}
                                  className="w-6 h-5 p-0 border border-slate-300 rounded cursor-pointer"
                                />
                                <label className="text-[10.5px] text-slate-500">Blur:</label>
                                <input
                                  type="number"
                                  min={0}
                                  max={10}
                                  value={shadowBlur}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 2;
                                    setShadowBlur(val);
                                    applyChange({
                                      effectsConfig: { ...(element.effectsConfig || {}), shadowBlur: val },
                                    });
                                  }}
                                  className="w-12 bg-white border border-[#94a3b8] rounded-xs px-1 py-0.5 text-right font-mono text-[11px]"
                                />
                              </div>
                            )}
                          </div>
                        </fieldset>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* 4.5 AUTO FIT                                                              */}
            {/* ========================================================================= */}
            {selectedCategory === 'autofit' && (
              <div className="space-y-4">
                <fieldset className="border border-[#cbd5e1] rounded-xs p-3 pt-2 text-[11.5px] space-y-3">
                  <legend className="px-1 text-slate-700 font-medium">Auto Fit Behavior</legend>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoSize}
                      onChange={(e) => {
                        setAutoSize(e.target.checked);
                        applyChange({ autoSize: e.target.checked });
                      }}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-semibold text-slate-800">Auto Fit text and barcode within defined object boundary</span>
                  </label>

                  <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-3">
                    {/* Font Point Size Range */}
                    <div className="space-y-2">
                      <span className="text-slate-700 font-medium text-xs">Font Point Size Limit</span>
                      <div className="flex items-center gap-2">
                        <label className="w-16 text-slate-600">Minimum:</label>
                        <input
                          type="number"
                          min={4}
                          max={maxFontSize}
                          value={minFontSize}
                          disabled={!autoSize}
                          onChange={(e) => {
                            const val = Math.max(4, parseInt(e.target.value) || 6);
                            setMinFontSize(val);
                            applyChange({ minFontSize: val });
                          }}
                          className="w-20 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.5 text-right font-mono text-[11px] disabled:bg-slate-100 disabled:text-slate-400"
                        />
                        <span className="text-slate-500 text-[10.5px]">pt</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="w-16 text-slate-600">Maximum:</label>
                        <input
                          type="number"
                          min={minFontSize}
                          max={72}
                          value={maxFontSize}
                          disabled={!autoSize}
                          onChange={(e) => {
                            const val = Math.max(minFontSize, parseInt(e.target.value) || 20);
                            setMaxFontSize(val);
                            applyChange({ maxFontSize: val });
                          }}
                          className="w-20 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.5 text-right font-mono text-[11px] disabled:bg-slate-100 disabled:text-slate-400"
                        />
                        <span className="text-slate-500 text-[10.5px]">pt</span>
                      </div>
                    </div>

                    {/* Width Scale Range */}
                    <div className="space-y-2">
                      <span className="text-slate-700 font-medium text-xs">Width Scaling Limit</span>
                      <div className="flex items-center gap-2">
                        <label className="w-16 text-slate-600">Minimum:</label>
                        <input
                          type="number"
                          min={50}
                          max={maxWidthScale}
                          value={minWidthScale}
                          disabled={!autoSize}
                          onChange={(e) => {
                            const val = Math.max(10, parseInt(e.target.value) || 80);
                            setMinWidthScale(val);
                            applyChange({ minWidthScale: val });
                          }}
                          className="w-20 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.5 text-right font-mono text-[11px] disabled:bg-slate-100 disabled:text-slate-400"
                        />
                        <span className="text-slate-500 text-[10.5px]">%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="w-16 text-slate-600">Maximum:</label>
                        <input
                          type="number"
                          min={minWidthScale}
                          max={200}
                          value={maxWidthScale}
                          disabled={!autoSize}
                          onChange={(e) => {
                            const val = Math.max(minWidthScale, parseInt(e.target.value) || 100);
                            setMaxWidthScale(val);
                            applyChange({ maxWidthScale: val });
                          }}
                          className="w-20 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.5 text-right font-mono text-[11px] disabled:bg-slate-100 disabled:text-slate-400"
                        />
                        <span className="text-slate-500 text-[10.5px]">%</span>
                      </div>
                    </div>
                  </div>

                  {/* Overflow & Fitting Method */}
                  <div className="border-t border-slate-200 pt-3 space-y-2">
                    <span className="text-slate-700 font-medium text-xs">Fitting Strategy</span>
                    <div className="flex items-center gap-3">
                      <label className="w-24 text-slate-600">Strategy:</label>
                      <select
                        value={overflowHandling}
                        onChange={(e) => setOverflowHandling(e.target.value as any)}
                        className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2 py-1 text-xs"
                      >
                        <option value="shrink">Reduce font size and horizontal compression</option>
                        <option value="truncate">Clip data exceeding bounding box</option>
                        <option value="error">Halt rendering and display overflow warning</option>
                      </select>
                    </div>
                  </div>
                </fieldset>
              </div>
            )}

            {/* ========================================================================= */}
            {/* 5. BORDER                                                                 */}
            {/* ========================================================================= */}
            {selectedCategory === 'border' && (
              <div className="space-y-4">
                <fieldset className="border border-[#cbd5e1] rounded-xs p-3 pt-2 text-[11.5px] space-y-3">
                  <legend className="px-1 text-slate-700 font-medium">Border Type & Shape</legend>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="b-type"
                        checked={borderType === 'none'}
                        onChange={() => {
                          setBorderType('none');
                          applyChange({ borderType: 'none' });
                        }}
                      />
                      <span>None</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="b-type"
                        checked={borderType === 'rectangle'}
                        onChange={() => {
                          setBorderType('rectangle');
                          applyChange({ borderType: 'rectangle' });
                        }}
                      />
                      <span>Rectangle</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="b-type"
                        checked={borderType === 'ellipse'}
                        onChange={() => {
                          setBorderType('ellipse');
                          applyChange({ borderType: 'ellipse' });
                        }}
                      />
                      <span>Ellipse</span>
                    </label>
                  </div>

                  {borderType !== 'none' && (
                    <div className="border-t border-slate-200 pt-3 space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-2">
                          <label className="w-20 text-slate-700">Thickness:</label>
                          <input
                            type="number"
                            min={0.1}
                            step={0.1}
                            value={borderThickness}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0.5;
                              setBorderThickness(val);
                              applyChange({ borderThickness: val });
                            }}
                            className="w-20 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.8 text-right font-mono text-xs"
                          />
                          <span className="text-slate-600 text-xs">mm</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="w-16 text-slate-700">Color:</label>
                          <input
                            type="color"
                            value={borderColor}
                            onChange={(e) => {
                              setBorderColor(e.target.value);
                              applyChange({ borderColor: e.target.value });
                            }}
                            className="w-7 h-6 p-0 border border-slate-300 rounded cursor-pointer"
                          />
                          <span className="font-mono text-xs text-slate-600">{borderColor}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-2">
                          <label className="w-20 text-slate-700">Style:</label>
                          <select
                            value={borderDashStyle}
                            onChange={(e) => {
                              const val = e.target.value as 'solid' | 'dashed' | 'dotted';
                              setBorderDashStyle(val);
                              applyChange({ borderDashStyle: val });
                            }}
                            className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.8 text-xs"
                          >
                            <option value="solid">Solid</option>
                            <option value="dashed">Dashed</option>
                            <option value="dotted">Dotted</option>
                          </select>
                        </div>

                        {borderType === 'rectangle' && (
                          <div className="flex items-center gap-2">
                            <label className="w-24 text-slate-700">Corner Radius:</label>
                            <input
                              type="number"
                              min={0}
                              step={0.5}
                              value={cornerRadius}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setCornerRadius(val);
                                applyChange({ cornerRadius: val });
                              }}
                              className="w-16 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.8 text-right font-mono text-xs"
                            />
                            <span className="text-slate-600 text-xs">mm</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </fieldset>
              </div>
            )}

            {/* ========================================================================= */}
            {/* 6. POSITION & GEOMETRY                                                    */}
            {/* ========================================================================= */}
            {selectedCategory === 'position' && (
              <div className="space-y-4">
                <fieldset className="border border-[#cbd5e1] rounded-xs p-3 pt-2 text-[11.5px] space-y-3">
                  <legend className="px-1 text-slate-700 font-medium">Object Coordinates & Rotation</legend>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <label className="w-14 text-slate-700 text-xs font-medium">X (Left):</label>
                      <input
                        type="number"
                        step={0.1}
                        value={posX}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setPosX(val);
                          applyChange({ x: val });
                        }}
                        className="w-24 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.8 font-mono text-xs text-right"
                      />
                      <span className="text-slate-600 text-xs">mm</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="w-14 text-slate-700 text-xs font-medium">Y (Top):</label>
                      <input
                        type="number"
                        step={0.1}
                        value={posY}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setPosY(val);
                          applyChange({ y: val });
                        }}
                        className="w-24 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.8 font-mono text-xs text-right"
                      />
                      <span className="text-slate-600 text-xs">mm</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <label className="w-14 text-slate-700 text-xs font-medium">Width:</label>
                      <input
                        type="number"
                        step={0.1}
                        min={5}
                        value={posWidth}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 50;
                          setPosWidth(val);
                          setObjWidthMm(val);
                          applyChange({ width: val });
                        }}
                        className="w-24 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.8 font-mono text-xs text-right"
                      />
                      <span className="text-slate-600 text-xs">mm</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="w-14 text-slate-700 text-xs font-medium">Height:</label>
                      <input
                        type="number"
                        step={0.1}
                        min={5}
                        value={posHeight}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 25;
                          setPosHeight(val);
                          setObjHeightMm(val);
                          applyChange({ height: val });
                        }}
                        className="w-24 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.8 font-mono text-xs text-right"
                      />
                      <span className="text-slate-600 text-xs">mm</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 border-t border-slate-200 pt-2">
                    <label className="w-16 text-slate-700 text-xs font-medium">Rotation:</label>
                    <select
                      value={rotationAngle}
                      onChange={(e) => {
                        const r = parseInt(e.target.value) as any;
                        setRotationAngle(r);
                        applyChange({ rotation: r });
                      }}
                      className="w-36 bg-white border border-[#94a3b8] rounded-xs px-2 py-1 text-xs font-medium"
                    >
                      <option value={0}>0° (Normal)</option>
                      <option value={90}>90° (Right)</option>
                      <option value={180}>180° (Inverted)</option>
                      <option value={270}>270° (Left)</option>
                    </select>
                  </div>
                </fieldset>
              </div>
            )}

            {/* ========================================================================= */}
            {/* 6.5 ERROR HANDLING                                                        */}
            {/* ========================================================================= */}
            {selectedCategory === 'error-handling' && (
              <div className="space-y-4">
                <fieldset className="border border-[#cbd5e1] rounded-xs p-3 pt-2 text-[11.5px] space-y-3">
                  <legend className="px-1 text-slate-700 font-medium">Barcode Data & Character Error Handling</legend>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="w-48 text-slate-700 font-medium">Invalid Characters Action:</label>
                      <select
                        value={invalidCharHandling}
                        onChange={(e) => setInvalidCharHandling(e.target.value as any)}
                        className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2 py-1 text-xs"
                      >
                        <option value="error">Halt and show error message on print</option>
                        <option value="strip">Automatically remove unsupported characters</option>
                        <option value="replace">Replace with substitute space character</option>
                        <option value="ignore">Ignore encoding restrictions (best effort)</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="w-48 text-slate-700 font-medium">Empty / Blank Field Handling:</label>
                      <select
                        value={emptyDataBehavior}
                        onChange={(e) => setEmptyDataBehavior(e.target.value as any)}
                        className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2 py-1 text-xs"
                      >
                        <option value="placeholder">Render sample placeholder barcode</option>
                        <option value="blank">Suppress rendering (empty white space)</option>
                        <option value="error">Raise missing required data error</option>
                      </select>
                    </div>
                  </div>

                  {/* 2D / QR Code Error Correction */}
                  <div className="border-t border-slate-200 pt-3 space-y-2">
                    <span className="text-slate-700 font-medium text-xs">2D Barcode (QR / Data Matrix) Error Correction</span>
                    <div className="flex items-center gap-3">
                      <label className="w-48 text-slate-600">Correction Level (ECC):</label>
                      <select
                        value={errorCorrectionLevel}
                        onChange={(e) => {
                          const lvl = e.target.value as 'L' | 'M' | 'Q' | 'H';
                          setErrorCorrectionLevel(lvl);
                          applyChange({ errorCorrectionLevel: lvl });
                        }}
                        className="w-48 bg-white border border-[#94a3b8] rounded-xs px-2 py-1 text-xs"
                      >
                        <option value="L">Level L (~7% recovery)</option>
                        <option value="M">Level M (~15% recovery - Standard)</option>
                        <option value="Q">Level Q (~25% recovery)</option>
                        <option value="H">Level H (~30% recovery - High)</option>
                      </select>
                    </div>
                  </div>

                  {/* GS1 Application Identifiers Strict Mode */}
                  <div className="border-t border-slate-200 pt-3 space-y-2">
                    <span className="text-slate-700 font-medium text-xs">GS1 Application Identifier Validation</span>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={strictGs1Validation}
                        onChange={(e) => setStrictGs1Validation(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-slate-800">Strictly validate GS1 check digits and fixed field lengths</span>
                    </label>
                  </div>
                </fieldset>
              </div>
            )}

            {/* ========================================================================= */}
            {/* 7. DATA SOURCES (ROOT CONCATENATION VIEW)                                  */}
            {/* ========================================================================= */}
            {selectedCategory === 'datasources' && (
              <div className="space-y-4">
                <div className="bg-blue-50/80 border border-blue-200 rounded-sm p-3">
                  <div className="text-xs font-bold text-blue-950 mb-1">
                    Compiled Barcode Output Value:
                  </div>
                  <div className="p-2 bg-white border border-blue-300 rounded font-mono text-sm font-bold text-slate-900 select-all break-all">
                    {value || '12345678'}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Concatenated Data Sources ({dataSources.length})
                    </span>
                    <button
                      onClick={() => setIsAddMenuOpen(true)}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Data Source</span>
                    </button>
                  </div>

                  <div className="border border-slate-300 rounded-xs overflow-hidden divide-y divide-slate-200">
                    {dataSources.map((ds, idx) => {
                      const meta = getDsTreeMeta(ds);
                      return (
                        <div
                          key={ds.id || idx}
                          onClick={() => {
                            setActiveDsIndex(idx);
                            setSelectedCategory('datasource-item');
                          }}
                          className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${idx === currentDsIndex ? 'bg-blue-50/70 border-l-4 border-l-blue-600' : 'hover:bg-slate-50'
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-xs font-bold text-slate-400">#{idx + 1}</span>
                            <span className="text-base">{meta.icon}</span>
                            <div>
                              <div className="text-xs font-bold text-slate-900">
                                {getDataSourceDisplayPreview(ds) || ds.name || `Source ${idx + 1}`}
                              </div>
                              <div className="text-[11px] font-mono text-slate-600 truncate max-w-[320px]">
                                {meta.label}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              title="Edit Data Source"
                              onClick={() => {
                                setActiveDsIndex(idx);
                                setSelectedCategory('datasource-item');
                              }}
                              className="p-1 hover:bg-slate-200 rounded text-blue-600 cursor-pointer"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                            </button>
                            <button
                              title="Delete Data Source"
                              onClick={() => {
                                setActiveDsIndex(idx);
                                handleDeleteActiveDataSource();
                              }}
                              className="p-1 hover:bg-slate-200 rounded text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* 8. ACTIVE DATA SOURCE ITEM (GS1 AI / COMPOSITE / DATABAR & STANDARD)       */}
            {/* ========================================================================= */}
            {selectedCategory === 'datasource-item' && (
              <div className="space-y-4">
                {/* Horizontal Tabs */}
                <div className="flex border-b border-[#94a3b8] text-[12px]">
                  <button
                    onClick={() => setActiveDsTab('source')}
                    className={`px-4 py-1.5 font-medium -mb-px border-t-2 border-x transition-all cursor-pointer ${activeDsTab === 'source'
                        ? 'bg-white border-t-[#0078d7] border-x-[#94a3b8] border-b-transparent text-slate-900 font-bold'
                        : 'bg-[#f1f5f9] border-transparent text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    Data Source
                  </button>
                  <button
                    onClick={() => setActiveDsTab('type')}
                    className={`px-4 py-1.5 font-medium -mb-px border-t-2 border-x transition-all cursor-pointer ${activeDsTab === 'type'
                        ? 'bg-white border-t-[#0078d7] border-x-[#94a3b8] border-b-transparent text-slate-900 font-bold'
                        : 'bg-[#f1f5f9] border-transparent text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    Data Type
                  </button>
                  <button
                    onClick={() => setActiveDsTab('transforms')}
                    className={`px-4 py-1.5 font-medium -mb-px border-t-2 border-x transition-all cursor-pointer ${activeDsTab === 'transforms'
                        ? 'bg-white border-t-[#0078d7] border-x-[#94a3b8] border-b-transparent text-slate-900 font-bold'
                        : 'bg-[#f1f5f9] border-transparent text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    Transforms
                  </button>
                </div>

                {/* TAB 1: DATA SOURCE CONFIGURATION */}
                {activeDsTab === 'source' && (
                  <div className="space-y-3 pt-1 text-[12px]">
                    {/* Name */}
                    <div className="flex items-center gap-3">
                      <label className="w-28 text-slate-700 font-medium">Source Name:</label>
                      <input
                        type="text"
                        value={activeDataSource.name || `Source ${currentDsIndex + 1}`}
                        onChange={(e) => updateActiveDataSource({ name: e.target.value })}
                        className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2.5 py-1 text-slate-900"
                      />
                    </div>

                    {/* Type Selector */}
                    <div className="flex items-center gap-3">
                      <label className="w-28 text-slate-700 font-medium">Type:</label>
                      <div className="flex-1 relative">
                        <select
                          value={activeDataSource.type || 'embedded'}
                          onChange={(e) => {
                            const newType = e.target.value as DataSourceType;
                            if (newType === 'gs1_ai' && (!activeDataSource.gs1AIs || activeDataSource.gs1AIs.length === 0)) {
                              updateActiveDataSource({
                                type: newType,
                                gs1AIs: [
                                  { ai: '01', value: '00850006531234', description: 'GTIN-14', dataTitle: 'GTIN' },
                                  { ai: '10', value: 'LOT456', description: 'Batch/Lot', dataTitle: 'BATCH/LOT' },
                                ],
                              });
                            } else {
                              updateActiveDataSource({ type: newType });
                            }
                          }}
                          className="w-full bg-white border border-[#94a3b8] rounded-xs px-2.5 py-1 text-slate-900 font-medium cursor-pointer"
                        >
                          <option value="gs1_ai">🌐 GS1 Application Identifier Data Source</option>
                          <option value="gs1_composite">🧩 GS1 Composite Data Source</option>
                          <option value="gs1_databar">📊 GS1 DataBar Data Source</option>
                          <option value="embedded">💾 Embedded Constant Data</option>
                          <option value="database">🗄️ Database Field</option>
                          <option value="clock">🕒 Clock / Date-Time (with Dynamic Offsets)</option>
                          <option value="formula">📐 Formula Expression</option>
                          <option value="variable">🔗 Named Template Variable</option>
                          <option value="global">🌐 Global Data Field</option>
                          <option value="object">📦 Object Value (Reference Another Object)</option>
                          <option value="external_file">📄 External File (Text / CSV)</option>
                          <option value="print_job">🖨️ Print Job Data</option>
                          <option value="script">⚡ Standalone Script (VBScript / JavaScript)</option>
                          <option value="serial">🔢 Serial Number / Counter</option>
                          <option value="system">⚙️ System Variable</option>
                        </select>
                      </div>
                    </div>

                    {/* ----------------------------------------------------------------- */}
                    {/* WIZARD 1: GS1 APPLICATION IDENTIFIER (AI) BUILDER                 */}
                    {/* ----------------------------------------------------------------- */}
                    {activeDataSource.type === 'gs1_ai' && (
                      <div className="space-y-3 pt-2 bg-emerald-50/40 border border-emerald-300 p-3.5 rounded-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-emerald-950 font-bold text-xs">
                            <Globe className="w-4 h-4 text-emerald-700" />
                            <span>GS1 Application Identifier Data Source Wizard</span>
                          </div>
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full text-[10.5px] font-semibold">
                            ISO/IEC 15418 Standard
                          </span>
                        </div>

                        {/* Compiled AI Output Preview */}
                        <div className="bg-white border border-emerald-300 p-2.5 rounded-xs space-y-1">
                          <div className="text-[11px] font-bold text-slate-600">Encoded GS1 Bracketed String:</div>
                          <div className="font-mono text-sm font-bold text-slate-900 break-all select-all">
                            {activeDataSource.gs1AIs && activeDataSource.gs1AIs.length > 0
                              ? activeDataSource.gs1AIs.map(a => `(${a.ai})${a.value}`).join('')
                              : '(01)00850006531234'}
                          </div>
                        </div>

                        {/* Quick AI Presets Bar */}
                        <div className="space-y-1">
                          <div className="text-[11px] font-bold text-slate-700">Quick Insert Common AIs:</div>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { ai: '01', label: '+ (01) GTIN-14', defaultVal: '00850006531234', title: 'GTIN' },
                              { ai: '10', label: '+ (10) Batch/Lot', defaultVal: 'LOT456', title: 'BATCH/LOT' },
                              { ai: '17', label: '+ (17) Expiry Date', defaultVal: '261231', title: 'USE BY OR EXPIRY' },
                              { ai: '21', label: '+ (21) Serial No.', defaultVal: 'SN987654', title: 'SERIAL' },
                              { ai: '00', label: '+ (00) SSCC-18', defaultVal: '008500060000000019', title: 'SSCC' },
                              { ai: '11', label: '+ (11) Prod Date', defaultVal: '260819', title: 'PROD DATE' },
                              { ai: '3103', label: '+ (3103) Net Wt (kg)', defaultVal: '001500', title: 'NET WEIGHT(kg)' },
                              { ai: '400', label: '+ (400) Order #', defaultVal: 'PO-99482', title: 'ORDER NUMBER' },
                            ].map((preset) => (
                              <button
                                key={preset.ai}
                                type="button"
                                onClick={() => {
                                  const currentAIs = activeDataSource.gs1AIs || [];
                                  const exists = currentAIs.find(a => a.ai === preset.ai);
                                  if (exists) {
                                    alert(`Application Identifier (${preset.ai}) is already in this data source.`);
                                    return;
                                  }
                                  const newField: GS1Field = {
                                    ai: preset.ai,
                                    value: preset.defaultVal,
                                    description: GS1_AI_DICTIONARY[preset.ai]?.description || preset.title,
                                    dataTitle: preset.title,
                                  };
                                  updateActiveDataSource({ gs1AIs: [...currentAIs, newField] });
                                }}
                                className="px-2 py-0.8 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded text-[11px] font-medium shadow-2xs cursor-pointer transition-colors"
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Configured AIs Table */}
                        <div className="space-y-1.5 pt-1">
                          <div className="text-[11px] font-bold text-slate-700">
                            Configured Application Identifiers ({activeDataSource.gs1AIs?.length || 0}):
                          </div>

                          <div className="border border-slate-300 bg-white rounded-xs overflow-hidden divide-y divide-slate-200">
                            {(!activeDataSource.gs1AIs || activeDataSource.gs1AIs.length === 0) ? (
                              <div className="p-3 text-center text-slate-500 text-xs">
                                No Application Identifiers added yet. Click one of the quick buttons above to add fields.
                              </div>
                            ) : (
                              activeDataSource.gs1AIs.map((item, aiIdx) => {
                                const aiDef = GS1_AI_DICTIONARY[item.ai];
                                const isGtinOrSscc = item.ai === '01' || item.ai === '00' || item.ai === '02';
                                const checkDigitValid = isGtinOrSscc ? validateGS1CheckDigit(item.value) : true;

                                return (
                                  <div key={item.ai || aiIdx} className="p-2.5 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                      <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-950 font-mono font-bold text-xs rounded border border-emerald-300">
                                        ({item.ai})
                                      </span>
                                      <div>
                                        <div className="font-bold text-slate-900 text-xs">
                                          {item.dataTitle || aiDef?.dataTitle || `AI (${item.ai})`}
                                        </div>
                                        <div className="text-[10.5px] text-slate-500">
                                          {aiDef?.description || 'Custom Application Identifier'}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        value={item.value}
                                        onChange={(e) => {
                                          const updatedAIs = activeDataSource.gs1AIs!.map((a, i) =>
                                            i === aiIdx ? { ...a, value: e.target.value } : a
                                          );
                                          updateActiveDataSource({ gs1AIs: updatedAIs });
                                        }}
                                        className="w-48 bg-white border border-[#94a3b8] rounded px-2 py-0.8 font-mono text-xs font-bold text-slate-900"
                                      />

                                      {isGtinOrSscc && (
                                        <button
                                          title="Recalculate Check Digit"
                                          onClick={() => {
                                            const clean = item.value.replace(/\D/g, '');
                                            if (clean.length >= 7) {
                                              const body = clean.slice(0, -1);
                                              const cd = calculateGS1CheckDigit(body);
                                              const updatedAIs = activeDataSource.gs1AIs!.map((a, i) =>
                                                i === aiIdx ? { ...a, value: `${body}${cd}` } : a
                                              );
                                              updateActiveDataSource({ gs1AIs: updatedAIs });
                                            }
                                          }}
                                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${checkDigitValid
                                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                              : 'bg-amber-100 text-amber-900 border-amber-400'
                                            }`}
                                        >
                                          {checkDigitValid ? '✓ Mod10' : 'Fix Mod10'}
                                        </button>
                                      )}

                                      <button
                                        title="Remove AI Field"
                                        onClick={() => {
                                          const updatedAIs = activeDataSource.gs1AIs!.filter((_, i) => i !== aiIdx);
                                          updateActiveDataSource({ gs1AIs: updatedAIs });
                                        }}
                                        className="p-1 hover:bg-red-50 text-red-600 rounded cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ----------------------------------------------------------------- */}
                    {/* WIZARD 2: GS1 COMPOSITE DATA SOURCE WIZARD                         */}
                    {/* ----------------------------------------------------------------- */}
                    {activeDataSource.type === 'gs1_composite' && (
                      <div className="space-y-3 pt-2 bg-purple-50/40 border border-purple-300 p-3.5 rounded-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-purple-950 font-bold text-xs">
                            <Layers className="w-4 h-4 text-purple-700" />
                            <span>GS1 Composite Data Source Wizard</span>
                          </div>
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-900 border border-purple-300 rounded-full text-[10.5px] font-semibold">
                            ISO/IEC 24723 Composite Symbol
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-slate-700 font-medium">Composite 2D Type:</label>
                            <select
                              value={activeDataSource.gs1CompositeType || 'CC-A'}
                              onChange={(e) => updateActiveDataSource({ gs1CompositeType: e.target.value as any })}
                              className="w-full bg-white border border-[#94a3b8] rounded px-2.5 py-1 text-slate-900 font-medium"
                            >
                              <option value="CC-A">CC-A (MicroPDF417 - Up to 56 Digits)</option>
                              <option value="CC-B">CC-B (MicroPDF417 - Up to 338 Digits)</option>
                              <option value="CC-C">CC-C (PDF417 - Up to 2361 Digits for GS1-128)</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-slate-700 font-medium">1D Linear Component Data:</label>
                            <input
                              type="text"
                              value={activeDataSource.gs1CompositeLinear || '(01)00850006531234'}
                              onChange={(e) => updateActiveDataSource({ gs1CompositeLinear: e.target.value })}
                              className="w-full bg-white border border-[#94a3b8] rounded px-2.5 py-1 font-mono text-xs text-slate-900"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-slate-700 font-medium">2D Composite Component Data:</label>
                          <textarea
                            rows={3}
                            value={activeDataSource.gs1Composite2DData || '(10)BATCH123(17)261231(21)SN987654'}
                            onChange={(e) => updateActiveDataSource({ gs1Composite2DData: e.target.value })}
                            className="w-full bg-white border border-[#94a3b8] rounded p-2 font-mono text-xs text-slate-900"
                          />
                        </div>
                      </div>
                    )}

                    {/* ----------------------------------------------------------------- */}
                    {/* WIZARD 3: GS1 DATABAR DATA SOURCE WIZARD                           */}
                    {/* ----------------------------------------------------------------- */}
                    {activeDataSource.type === 'gs1_databar' && (
                      <div className="space-y-3 pt-2 bg-blue-50/40 border border-blue-300 p-3.5 rounded-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-blue-950 font-bold text-xs">
                            <BarChart2 className="w-4 h-4 text-blue-700" />
                            <span>GS1 DataBar Data Source Wizard</span>
                          </div>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-900 border border-blue-300 rounded-full text-[10.5px] font-semibold">
                            POS & Grocery Scanner Ready
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-slate-700 font-medium">DataBar Variant:</label>
                            <select
                              value={activeDataSource.gs1DataBarVariant || 'omnidirectional'}
                              onChange={(e) => updateActiveDataSource({ gs1DataBarVariant: e.target.value as any })}
                              className="w-full bg-white border border-[#94a3b8] rounded px-2.5 py-1 text-slate-900 font-medium"
                            >
                              <option value="omnidirectional">GS1 DataBar Omnidirectional (14-Digit GTIN)</option>
                              <option value="stacked">GS1 DataBar Stacked (Two-Row)</option>
                              <option value="expanded">GS1 DataBar Expanded (GTIN + Variable Weight/Price)</option>
                              <option value="expanded_stacked">GS1 DataBar Expanded Stacked</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-slate-700 font-medium">GTIN-14 Data:</label>
                            <input
                              type="text"
                              value={activeDataSource.value || '00850006531234'}
                              onChange={(e) => updateActiveDataSource({ value: e.target.value })}
                              className="w-full bg-white border border-[#94a3b8] rounded px-2.5 py-1 font-mono text-xs font-bold text-slate-900"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Non-GS1 Data Source Types handled by ProfessionalDataSourceConfig */}
                    {activeDataSource.type !== 'gs1_ai' &&
                      activeDataSource.type !== 'gs1_composite' &&
                      activeDataSource.type !== 'gs1_databar' && (
                        <div className="pt-2">
                          <ProfessionalDataSourceConfig
                            dataSource={activeDataSource}
                            onUpdate={updateActiveDataSource}
                            datasets={datasets}
                            currentRecord={currentRecord}
                            currentConnection={currentConnection}
                            onConnectDataset={onConnectDataset}
                            namedDataSources={namedDataSources}
                            calculatedFields={calculatedFields}
                            availableVariables={availableVariables as any}
                            elements={allElements}
                            globalData={globalData}
                            currentRecordIndex={currentRecordIndex}
                            totalRecords={totalRecords}
                            printerName={printerName}
                            jobId={jobId}
                            jobName={jobName}
                            onOpenSpecialCharacters={handleOpenSpecialCharacters}
                            isBarcodeContext={true}
                            embeddedValueRef={barcodeEmbeddedTextareaRef}
                            onSelectionChange={handleSelectionChange}
                          />
                        </div>
                    )}
                  </div>
                )}

                {/* TAB 2: DATA TYPE */}
                {activeDsTab === 'type' && (
                  <div className="space-y-3 pt-1 text-[12px]">
                    <div className="flex items-center gap-3">
                      <label className="w-28 text-slate-700 font-medium">Data Type:</label>
                      <select
                        value={activeDataSource.dataType || 'text'}
                        onChange={(e) => updateActiveDataSource({ dataType: e.target.value as any })}
                        className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2.5 py-1 text-slate-900 font-medium"
                      >
                        <option value="text">Text / Alphanumeric (String)</option>
                        <option value="number">Number</option>
                        <option value="integer">Integer</option>
                        <option value="decimal">Decimal</option>
                        <option value="currency">Currency</option>
                        <option value="date">Date / Timestamp</option>
                        <option value="time">Time</option>
                        <option value="boolean">Boolean</option>
                      </select>
                    </div>

                    {(activeDataSource.dataType === 'number' ||
                      activeDataSource.dataType === 'integer' ||
                      activeDataSource.dataType === 'decimal' ||
                      activeDataSource.dataType === 'currency') && (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xs space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-700">Decimal Places:</span>
                            <input
                              type="number"
                              min={0}
                              max={6}
                              value={activeDataSource.numberFormat?.decimalPlaces ?? (activeDataSource.dataType === 'integer' ? 0 : 2)}
                              onChange={(e) =>
                                updateActiveDataSource({
                                  numberFormat: {
                                    ...activeDataSource.numberFormat,
                                    decimalPlaces: parseInt(e.target.value, 10) || 0,
                                  },
                                })
                              }
                              className="w-16 bg-white border border-[#94a3b8] rounded-xs px-1.5 py-0.5 text-right font-mono"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-700">Preserve Leading Zeros (Min Digits):</span>
                            <input
                              type="number"
                              min={0}
                              max={20}
                              value={activeDataSource.numberFormat?.leadingZeros ?? 0}
                              onChange={(e) =>
                                updateActiveDataSource({
                                  numberFormat: {
                                    ...activeDataSource.numberFormat,
                                    leadingZeros: parseInt(e.target.value, 10) || 0,
                                  },
                                })
                              }
                              className="w-16 bg-white border border-[#94a3b8] rounded-xs px-1.5 py-0.5 text-right font-mono"
                            />
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer text-slate-800">
                            <input
                              type="checkbox"
                              checked={!!activeDataSource.numberFormat?.thousandSeparator}
                              onChange={(e) =>
                                updateActiveDataSource({
                                  numberFormat: {
                                    ...activeDataSource.numberFormat,
                                    thousandSeparator: e.target.checked,
                                  },
                                })
                              }
                              className="accent-[#0078d7]"
                            />
                            <span>Use 1000 Separator (,)</span>
                          </label>
                        </div>
                      )}
                  </div>
                )}

                {/* TAB 3: TRANSFORMS (BarTender Screenshot 2 Parity) */}
                {activeDsTab === 'transforms' && (
                  <div className="space-y-2 pt-1 text-[12px]">
                    <div className="border border-slate-300 rounded-xs bg-white divide-y divide-slate-200 overflow-hidden shadow-2xs">
                      {[
                        { id: 'suppression', label: 'Suppression:', summary: suppressionSummary, modal: 'suppression' },
                        { id: 'filter', label: 'Character Filter:', summary: filterSummary, modal: 'filter' },
                        { id: 'truncation', label: 'Truncation:', summary: truncSummary, modal: 'truncation' },
                        { id: 'length', label: 'Number of Characters:', summary: lengthSummary, modal: 'length' },
                        { id: 'template', label: 'Character Template:', summary: templateSummary, modal: 'template' },
                        { id: 'searchReplace', label: 'Search and Replace:', summary: searchReplaceSummary, modal: 'searchReplace' },
                        { id: 'script', label: 'VB Script:', summary: scriptSummary, modal: 'script' },
                        { id: 'serialization', label: 'Serialization:', summary: serialSummary, modal: 'serialization' },
                        { id: 'prefixSuffix', label: 'Prefix and Suffix:', summary: prefixSuffixSummary, modal: 'prefixSuffix' },
                      ].map((row) => (
                        <div
                          key={row.id}
                          className="flex items-center justify-between px-3 py-1.5 hover:bg-slate-50 transition-colors"
                        >
                          <span className="w-40 text-slate-800 font-medium text-[11.5px]">{row.label}</span>
                          <span className="flex-1 font-mono text-[11px] text-slate-600 truncate mr-2">
                            {row.summary}
                          </span>
                          <button
                            type="button"
                            title={`Configure ${row.label}`}
                            onClick={() => setActiveTransformModal(row.modal as any)}
                            className="p-1 bg-[#f8fafc] hover:bg-[#e2e8f0] active:bg-[#cbd5e1] border border-[#94a3b8] rounded-xs text-slate-700 shadow-2xs cursor-pointer flex items-center justify-center"
                          >
                            <Sliders className="w-3.5 h-3.5 text-blue-600" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Live Non-Destructive Preview Banner for Serialization & Transforms */}
                    <div className="mt-3 p-2.5 bg-blue-50/70 border border-blue-200 rounded-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-blue-950 text-[11px]">
                          Live Sequence Preview (Non-Destructive):
                        </span>
                        <span className="text-[10px] text-blue-700 font-mono">
                          {activeSerial && activeSerial.action !== 'none'
                            ? `${activeSerial.action.toUpperCase()} By ${activeSerial.incrementBy || 1}`
                            : 'Static (No Serialization)'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[11.5px] text-slate-800 pt-0.5 overflow-x-auto">
                        <span className="bg-white px-2 py-0.5 rounded border border-blue-200">
                          Current: <strong className="text-blue-900">{evaluateSerializedValue(activeDataSource.value || '000001', activeSerial, { printIndex: 0 })}</strong>
                        </span>
                        <span className="text-slate-400">→</span>
                        <span className="bg-white px-2 py-0.5 rounded border border-blue-200">
                          Next: <strong>{evaluateSerializedValue(activeDataSource.value || '000001', activeSerial, { printIndex: 1 })}</strong>
                        </span>
                        <span className="text-slate-400">→</span>
                        <span className="bg-white px-2 py-0.5 rounded border border-blue-200">
                          Next: <strong>{evaluateSerializedValue(activeDataSource.value || '000001', activeSerial, { printIndex: 2 })}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="bg-[#e4ebf5] border-t border-[#cbd5e1] px-4 py-2 flex items-center justify-between">
          <button
            onClick={() => alert('BarTender-compatible Enterprise Barcode Properties.\nUse the left tree to configure Symbology, Human Readable text, Dimensions, Data Sources, and Transforms.')}
            className="px-3 py-1 border border-[#94a3b8] hover:bg-slate-200 rounded text-slate-700 text-[11.5px] flex items-center gap-1 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
            <span>Help</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCommitAndClose}
              className="px-5 py-1 bg-[#0078d7] hover:bg-[#0063b1] text-white font-medium rounded text-[11.5px] shadow-2xs cursor-pointer min-w-[70px]"
            >
              OK
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-1 border border-[#94a3b8] hover:bg-slate-200 text-slate-700 font-medium rounded text-[11.5px] cursor-pointer min-w-[70px]"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyDraft}
              className="px-4 py-1 border border-[#94a3b8] hover:bg-slate-200 text-slate-700 font-medium rounded text-[11.5px] cursor-pointer min-w-[70px]"
            >
              Apply
            </button>
            <button
              onClick={handleCommitAndClose}
              className="px-4 py-1 border border-[#94a3b8] hover:bg-slate-200 text-slate-700 font-medium rounded text-[11.5px] cursor-pointer min-w-[70px]"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Transform Sub-Modals */}
      {activeTransformModal === 'serialization' && (
        <SerializationModal
          isOpen={true}
          onClose={() => setActiveTransformModal(null)}
          initialConfig={activeDataSource.serialization || activeDataSource.transformConfig?.serialization}
          initialValue={activeDataSource.value || '000001'}
          prefix={activeDataSource.prefixSuffix?.prefix || activeDataSource.transformConfig?.prefixSuffix?.prefix || ''}
          suffix={activeDataSource.prefixSuffix?.suffix || activeDataSource.transformConfig?.prefixSuffix?.suffix || ''}
          datasets={datasets}
          currentRecord={currentRecord}
          availableVariables={availableVariables}
          onApply={(config) => {
            updateActiveDataSource({
              serialization: config,
              transformConfig: {
                ...activeDataSource.transformConfig,
                serialization: config,
              },
            });
            setActiveTransformModal(null);
          }}
        />
      )}

      {activeTransformModal === 'suppression' && (
        <SuppressionModal
          isOpen={true}
          title="Data Source Suppression"
          onClose={() => setActiveTransformModal(null)}
          initial={activeDataSource.transformConfig?.suppression}
          onApply={(up) => {
            updateActiveDsTransform(up);
            setActiveTransformModal(null);
          }}
        />
      )}

      {activeTransformModal === 'filter' && (
        <CharacterFilterModal
          isOpen={true}
          title="Character Filter"
          onClose={() => setActiveTransformModal(null)}
          initial={activeDataSource.transformConfig?.characterFilter}
          onApply={(up) => {
            updateActiveDsTransform(up);
            setActiveTransformModal(null);
          }}
        />
      )}

      {activeTransformModal === 'truncation' && (
        <TruncationModal
          isOpen={true}
          title="Truncation Transforms"
          onClose={() => setActiveTransformModal(null)}
          initial={activeDataSource.transformConfig?.truncation}
          onApply={(up) => {
            updateActiveDsTransform(up);
            setActiveTransformModal(null);
          }}
        />
      )}

      {activeTransformModal === 'length' && (
        <CharacterLengthModal
          isOpen={true}
          title="Number of Characters / Padding"
          onClose={() => setActiveTransformModal(null)}
          initial={activeDataSource.transformConfig?.characterLength}
          onApply={(up) => {
            updateActiveDsTransform(up);
            setActiveTransformModal(null);
          }}
        />
      )}

      {activeTransformModal === 'template' && (
        <CharacterTemplateModal
          isOpen={true}
          title="Character Template Mask"
          onClose={() => setActiveTransformModal(null)}
          initial={activeDataSource.transformConfig?.characterTemplate}
          onApply={(up) => {
            updateActiveDsTransform(up);
            setActiveTransformModal(null);
          }}
        />
      )}

      {activeTransformModal === 'searchReplace' && (
        <SearchReplaceModal
          isOpen={true}
          title="Search and Replace Rules"
          onClose={() => setActiveTransformModal(null)}
          initial={activeDataSource.transformConfig?.searchReplace}
          onApply={(up) => {
            updateActiveDsTransform(up);
            setActiveTransformModal(null);
          }}
        />
      )}

      {activeTransformModal === 'script' && (
        <ScriptTransformModal
          isOpen={true}
          title="VB Script / JavaScript Transform"
          onClose={() => setActiveTransformModal(null)}
          initial={activeDataSource.transformConfig?.script}
          sampleRecord={currentRecord}
          onApply={(up) => {
            updateActiveDsTransform(up);
            setActiveTransformModal(null);
          }}
        />
      )}

      {activeTransformModal === 'prefixSuffix' && (
        <PrefixSuffixModal
          isOpen={true}
          title="Prefix and Suffix Transforms"
          onClose={() => setActiveTransformModal(null)}
          initial={activeDataSource.prefixSuffix || activeDataSource.transformConfig?.prefixSuffix}
          onApply={(up) => {
            const ps = up.prefixSuffix;
            updateActiveDataSource({
              prefixSuffix: ps,
              transformConfig: {
                ...activeDataSource.transformConfig,
                prefixSuffix: ps,
              },
            });
            setActiveTransformModal(null);
          }}
        />
      )}

      {/* GS1 Application Identifier Data Source Wizard Modal */}
      {isGs1AiWizardOpen && (
        <GS1ApplicationIdentifierWizardModal
          isOpen={isGs1AiWizardOpen}
          onClose={() => setIsGs1AiWizardOpen(false)}
          onApply={handleApplyGs1Wizard}
          availableVariables={availableVariables}
        />
      )}

      {/* New Data Source Wizard Modal */}
      <NewDataSourceWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onAddDataSource={handleWizardAddDataSource}
        datasets={datasets}
        currentRecord={currentRecord}
        availableVariables={availableVariables}
        currentConnection={currentConnection}
        existingCount={dataSources.length}
      />

      {/* Insert Symbols or Special Characters Modal */}
      <SpecialCharacterModal
        isOpen={isSpecialCharModalOpen}
        onClose={() => setIsSpecialCharModalOpen(false)}
        onInsert={handleInsertSpecialChar}
        currentFont={(element as any)?.fontFamily || 'Arial'}
      />

      {/* BarTender Advanced X Dimension Modal matching Screenshot 3 */}
      {isAdvancedXModalOpen && (
        <AdvancedXDimensionModal
          isOpen={isAdvancedXModalOpen}
          onClose={() => setIsAdvancedXModalOpen(false)}
          element={{
            ...(activeElement as BarcodeElement),
            symbology,
            value,
            xDimensionMm,
            lockXDimension,
            xDimensionUnits,
            autoSizeToWidth,
            requestedWidthMm,
            minXDimensionMm,
            maxXDimensionMm,
            ratio,
            barSpaceAdjustment,
          } as BarcodeElement}
          onApply={(updates) => {
            if (updates.xDimensionMm !== undefined) setXDimensionMm(updates.xDimensionMm);
            if (updates.lockXDimension !== undefined) setLockXDimension(updates.lockXDimension);
            if (updates.xDimensionUnits !== undefined) setXDimensionUnits(updates.xDimensionUnits);
            if (updates.autoSizeToWidth !== undefined) setAutoSizeToWidth(updates.autoSizeToWidth);
            if (updates.requestedWidthMm !== undefined) setRequestedWidthMm(updates.requestedWidthMm);
            if (updates.minXDimensionMm !== undefined) setMinXDimensionMm(updates.minXDimensionMm);
            if (updates.maxXDimensionMm !== undefined) setMaxXDimensionMm(updates.maxXDimensionMm);
            if (updates.barSpaceAdjustment !== undefined) setBarSpaceAdjustment(updates.barSpaceAdjustment);
            applyChange(updates);
          }}
          printerDpi={203}
        />
      )}

      {/* BarTender Print Method Configuration Modal */}
      {isPrintMethodModalOpen && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-100 font-sans select-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-[450px] max-w-full bg-[#f0f4f9] rounded-md shadow-2xl border border-[#718096] flex flex-col overflow-hidden text-slate-800 text-[11.5px]">
            <div className="bg-gradient-to-r from-[#d9e2ec] via-[#bcccdc] to-[#9fb3c8] border-b border-[#829ab1] px-3 py-1.5 flex items-center justify-between">
              <span className="font-semibold text-slate-900 text-[12px]">Barcode Print Method</span>
              <button
                onClick={() => setIsPrintMethodModalOpen(false)}
                className="w-5 h-5 flex items-center justify-center bg-[#e03131] hover:bg-[#c92a2a] text-white rounded-xs cursor-pointer shadow-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-4 bg-white space-y-3">
              <div className="text-slate-700 text-[11px] leading-relaxed">
                Select how BarcodeFlow should render and dispatch this barcode to print engines:
              </div>
              <div className="space-y-2 border border-[#cbd5e1] p-3 rounded-xs bg-[#f8fafc]">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="print-method"
                    checked={printMethod === 'vector'}
                    onChange={() => {
                      setPrintMethod('vector');
                      applyChange({ printMethod: 'vector' });
                    }}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-semibold text-slate-900">Vector Graphics (Recommended)</div>
                    <div className="text-[10.5px] text-slate-500">
                      Renders sharp vector paths in PDF and Windows printing. Supports arbitrary zoom & anti-aliasing.
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-2 cursor-pointer border-t border-slate-200 pt-2">
                  <input
                    type="radio"
                    name="print-method"
                    checked={printMethod === 'raster'}
                    onChange={() => {
                      setPrintMethod('raster');
                      applyChange({ printMethod: 'raster' });
                    }}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-semibold text-slate-900">Raster / Dot-Matrix Quantized</div>
                    <div className="text-[10.5px] text-slate-500">
                      Quantizes bars and spaces to exact printer dots (203/300/600 DPI) to prevent optical edge blurring.
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-2 cursor-pointer border-t border-slate-200 pt-2">
                  <input
                    type="radio"
                    name="print-method"
                    checked={printMethod === 'native_printer'}
                    onChange={() => {
                      setPrintMethod('native_printer');
                      applyChange({ printMethod: 'native_printer' });
                    }}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-semibold text-slate-900">Native Thermal Commands (ZPL / TSPL)</div>
                    <div className="text-[10.5px] text-slate-500">
                      Uses the thermal printer’s internal hardware barcode generator for maximum throughput.
                    </div>
                  </div>
                </label>
              </div>
            </div>
            <div className="bg-[#e2e8f0] border-t border-[#cbd5e1] px-4 py-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsPrintMethodModalOpen(false)}
                className="px-4 py-1 bg-[#0078d7] hover:bg-[#0063b1] text-white rounded-xs font-medium cursor-pointer"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Select Visible Data Sources Modal for Human Readable Per-Source Visibility */}
      <SelectVisibleDataSourcesModal
        isOpen={isSelectVisibleSourcesModalOpen}
        onClose={() => setIsSelectVisibleSourcesModalOpen(false)}
        dataSources={dataSources}
        visibleSourceIds={hrVisibleSourceIds}
        onChangeVisibleSourceIds={(newIds) => {
          setHrVisibleSourceIds(newIds);
          applyHrChange({ visibleSourceIds: newIds });
        }}
      />

      {/* Human Readable Transform: Character Template */}
      <CharacterTemplateModal
        isOpen={activeHrTransformModal === 'template'}
        onClose={() => setActiveHrTransformModal(null)}
        title="Human Readable Character Template"
        initial={hrCharacterTemplate}
        onApply={(updates) => {
          if (updates.characterTemplate) {
            setHrCharacterTemplate(updates.characterTemplate);
            applyHrChange({ characterTemplate: updates.characterTemplate });
          }
        }}
      />

      {/* Human Readable Transform: Search and Replace */}
      <SearchReplaceModal
        isOpen={activeHrTransformModal === 'searchReplace'}
        onClose={() => setActiveHrTransformModal(null)}
        title="Human Readable Search and Replace"
        initial={hrSearchReplace}
        onApply={(updates) => {
          if (updates.searchReplace) {
            setHrSearchReplace(updates.searchReplace);
            applyHrChange({ searchReplace: updates.searchReplace });
          }
        }}
      />

      {/* Human Readable Transform: Script (VB Script / JavaScript) */}
      <ScriptTransformModal
        isOpen={activeHrTransformModal === 'script'}
        onClose={() => setActiveHrTransformModal(null)}
        title="Human Readable VB Script Transform"
        initial={hrScript}
        sampleRecord={currentRecord}
        onApply={(updates) => {
          if (updates.script) {
            setHrScript(updates.script);
            applyHrChange({ script: updates.script });
          }
        }}
      />

      {/* Human Readable Transform: Prefix and Suffix */}
      <PrefixSuffixModal
        isOpen={activeHrTransformModal === 'prefixSuffix'}
        onClose={() => setActiveHrTransformModal(null)}
        title="Human Readable Prefix and Suffix"
        initial={hrPrefixSuffix}
        onApply={(updates) => {
          if (updates.prefixSuffix) {
            setHrPrefixSuffix(updates.prefixSuffix);
            applyHrChange({ prefixSuffix: updates.prefixSuffix });
          }
        }}
      />
    </div>
  );
};
