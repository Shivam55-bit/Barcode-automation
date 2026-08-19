export type UnitType = 'mm' | 'inch' | 'px';
export type DpiOption = 203 | 300 | 600;
export type ElementType = 'text' | 'barcode' | 'shape' | 'image' | 'table' | 'line' | 'container' | 'group';
export type ShapeType = 'rectangle' | 'circle' | 'ellipse' | 'line' | 'polygon';

export type BarcodeSymbology = 
  | 'posicode-b'
  | 'posicode-a'
  | 'code128' 
  | 'code39' 
  | 'code93' 
  | 'datamatrix' 
  | 'qr' 
  | 'pdf417' 
  | 'pdf417-truncated'
  | 'ean13' 
  | 'ean8' 
  | 'upca' 
  | 'upce' 
  | 'itf14' 
  | 'interleaved2of5'
  | 'codabar' 
  | 'msi' 
  | 'gs1-128' 
  | 'gs1-datamatrix' 
  | 'gs1-qr'
  | 'gs1-databar'
  | 'aztec' 
  | 'maxicode' 
  | 'micro-qr'
  | 'pharmacode' 
  | 'patchcode'
  | 'telepen'
  | 'tlc39'
  | 'hibc-128'
  | 'hibc-datamatrix'
  | 'usps-imb'
  | 'royalmail';

export type UserRole = 'Designer' | 'Approver Level 1' | 'Approver Level 2' | 'Admin' | 'Viewer / Print Operator';

export type TemplateStatus = 
  | 'draft' 
  | 'pending_level_1' 
  | 'pending_level_2' 
  | 'approved' 
  | 'rejected' 
  | 'barcode_generated' 
  | 'sent_to_viewer' 
  | 'printed'
  // Legacy aliases for compatibility
  | 'submitted'
  | 'published'
  | 'archived';

export interface BarcodeBatchItem {
  pageNumber: number;
  packNumber: number;
  packLabel: string; // e.g. "Pack 1", "Pack 2"
  itemCode: string;
  batchNumber: string;
  lotNumber: string;
  mfgDate: string;
  expDate: string;
  mrp?: string;
  gtin?: string;
  serialNumber?: string;
  fullBarcodeData: string;
  isPrinted?: boolean;
}

export interface BarcodeBatchJob {
  id: string;
  jobCode: string; // e.g. "BAT-2026-001"
  templateId: string;
  templateName: string;
  productName: string;
  itemCode: string;
  batchNumber: string;
  lotNumber: string;
  mfgDate: string;
  expDate: string;
  mrp: string;
  packFrom: number;
  packTo: number;
  totalPages: number;
  items: BarcodeBatchItem[];
  status: 'barcode_generated' | 'sent_to_viewer' | 'printed';
  generatedBy: string;
  generatedAt: string;
  sentToViewerAt?: string;
  printedAt?: string;
  printedBy?: string;
  printHistoryLogs?: {
    timestamp: string;
    printedPages: string; // "All (1-10)", "Page 3", etc.
    operatorName: string;
    printerName: string;
  }[];
}

export interface ApprovalRecord {
  id: string;
  templateId: string;
  level: 1 | 2;
  action: 'approve' | 'reject';
  comment: string;
  approverName: string;
  approverEmail: string;
  digitalSignature: string;
  timestamp: string;
}

export interface PositionAndSize {
  x: number; // in mm
  y: number; // in mm
  width: number; // in mm
  height: number; // in mm
  rotation: number; // in degrees
}

export type ReferencePoint = 
  | 'top-left' | 'top-center' | 'top-right' 
  | 'center-left' | 'center' | 'center-right' 
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

// --- GS1 DATA TYPES ---
export interface GS1Field {
  ai: string;
  label?: string;
  value: string;
  length?: number;
  isVariableLength?: boolean;
  description?: string;
  dataTitle?: string;
}

// --- DATA SOURCE & TRANSFORMATION ENGINE TYPES ---
export type DataSourceType = 
  | 'embedded' 
  | 'database' 
  | 'serial' 
  | 'clock' 
  | 'prompt' 
  | 'script' 
  | 'variable' 
  | 'system'
  | 'linked'
  | 'gs1_ai'
  | 'gs1_composite'
  | 'gs1_databar';

export interface TransformRule {
  id: string;
  type: 'truncate' | 'substring' | 'search_replace' | 'regex' | 'trim' | 'case' | 'pad' | 'prefix_suffix' | 'math' | 'encode_decode';
  params: {
    startIndex?: number;
    length?: number;
    search?: string;
    replace?: string;
    isRegex?: boolean;
    regexPattern?: string;
    regexFlags?: string;
    trimType?: 'both' | 'start' | 'end';
    caseType?: 'uppercase' | 'lowercase' | 'titlecase' | 'sentencecase';
    padLength?: number;
    padChar?: string;
    padSide?: 'left' | 'right';
    prefix?: string;
    suffix?: string;
    mathOperation?: 'add' | 'subtract' | 'multiply' | 'divide' | 'round';
    mathValue?: number;
    encodeType?: 'base64' | 'hex' | 'url';
    encodeAction?: 'encode' | 'decode';
  };
}

export interface DataSourceItem {
  id: string;
  name: string;
  type: DataSourceType;
  value: string;
  // Database
  databaseField?: string;
  // Variable
  variableName?: string;
  // Serial / Counter
  serialStart?: number;
  serialStep?: number;
  serialPad?: number;
  serialPrefix?: string;
  serialSuffix?: string;
  serialDirection?: 'increment' | 'decrement';
  serialResetRule?: 'never' | 'daily' | 'monthly' | 'yearly' | 'job';
  currentSerialValue?: number;
  // Date / Clock
  dateFormat?: string;
  dateOffsetDays?: number;
  dateOffsetMonths?: number;
  dateOffsetYears?: number;
  dateType?: 'current' | 'expiry' | 'mfg' | 'custom';
  // Script
  scriptLanguage?: 'javascript' | 'vbscript';
  scriptCode?: string;
  // Prompt at print time
  promptLabel?: string;
  promptDefault?: string;
  // System variable
  systemVarName?: 'SYSTEM.DATE' | 'SYSTEM.TIME' | 'SYSTEM.USER' | 'SYSTEM.PRINTER' | 'SYSTEM.JOB_ID' | 'SYSTEM.PAGE_NUMBER' | 'SYSTEM.TOTAL_PAGES';
  // Linked object
  linkedObjectId?: string;
  linkedProperty?: string;
  // Transforms
  transforms?: TransformRule[];
  // GS1 Application Identifier Data Source
  gs1AIs?: GS1Field[];
  // GS1 Composite
  gs1CompositeType?: 'CC-A' | 'CC-B' | 'CC-C';
  gs1CompositeLinear?: string;
  gs1Composite2DData?: string;
  // GS1 DataBar
  gs1DataBarVariant?: 'omnidirectional' | 'stacked' | 'expanded' | 'expanded_stacked';
  gs1DataBarSegments?: number;
  enabled: boolean;
}

export interface ObjectEventHook {
  event: 'OnLoad' | 'BeforePrint' | 'AfterPrint' | 'OnValidate';
  script: string;
}

export interface BaseElement extends PositionAndSize {
  id: string;
  name: string;
  type: ElementType;
  locked: boolean;
  visible: boolean;
  printable?: boolean;
  opacity: number; // 0 to 1
  groupId?: string;
  zIndex: number;
  layer?: string;
  referencePoint?: ReferencePoint;
  dataSources?: DataSourceItem[];
  transforms?: TransformRule[];
  events?: ObjectEventHook[];
  shadow?: {
    enabled: boolean;
    color: string;
    blur: number;
    offsetX: number;
    offsetY: number;
  };
  gradient?: {
    enabled: boolean;
    type: 'linear' | 'radial';
    colors: string[];
    angle: number;
  };
}

export type TextObjectType = 
  | 'single-line'
  | 'multi-line'
  | 'word-processor'
  | 'arc'
  | 'symbol-font'
  | 'rtf'
  | 'html'
  | 'xaml';

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  textType?: TextObjectType;
  fontFamily: string;
  fontSize: number; // in pt
  fontWeight: 'normal' | 'bold' | '600' | '700' | '800';
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline' | 'line-through';
  textAlign: 'left' | 'center' | 'right' | 'justify';
  verticalAlign: 'top' | 'middle' | 'bottom';
  color: string;
  backgroundColor?: string;
  lineHeight: number;
  letterSpacing: number;
  dataBinding?: string; // e.g. "{{PRODUCT_NAME}}"
  autoFit?: boolean;
  autoSize?: boolean;
  wordWrap?: boolean;
  multiline?: boolean;
  arcRadius?: number;
  arcStartAngle?: number;
  arcSweepAngle?: number;
  richContentHtml?: string;
  textOutline?: {
    enabled: boolean;
    color: string;
    width: number;
  };
}

export interface BarcodeElement extends BaseElement {
  type: 'barcode';
  symbology: BarcodeSymbology;
  value: string;
  dataBinding?: string;
  includeText: boolean;
  textPosition: 'below' | 'above' | 'none';
  barWidth: number; // narrow bar width multiplier
  barHeight: number;
  quietZone: boolean;
  quietZoneMm?: number;
  foregroundColor: string;
  backgroundColor: string;
  checkDigit: boolean;
  hideCheckDigit?: boolean;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'; // for QR / 2D
  bearerBars?: boolean;
  bearerBarType?: 'top-bottom' | 'complete';
  bearerBarThickness?: number;
  structuredAppend?: {
    enabled: boolean;
    index: number;
    count: number;
    parity?: number;
  };
  maskPattern?: number;
  characterSet?: string;
  gs1AIs?: GS1Field[];
  humanReadableFont?: string;
  humanReadableFontSize?: number;
  humanReadableFontStyle?: 'regular' | 'italic' | 'bold' | 'bold-italic';
  humanReadableAlignment?: 'left' | 'center' | 'right';
  humanReadableOffsetV?: number;
  humanReadableOffsetH?: number;
  humanReadableUnderline?: boolean;
  humanReadableStrikeout?: boolean;
  humanReadableWhiteOnBlack?: boolean;
  humanReadableColor?: string;
  humanReadableBgColor?: string;
  humanReadableCustomFormat?: string; // e.g. "(01) {0}"
  humanReadablePrefix?: string;
  humanReadableSuffix?: string;
  humanReadableLetterSpacing?: number;
  textFormatType?: 'single-line' | 'paragraph';
  autoSizeText?: boolean;
  borderType?: 'none' | 'rectangle' | 'ellipse';
  borderThickness?: number;
  borderColor?: string;
  borderDashStyle?: 'solid' | 'dashed' | 'dotted';
  borderJoinType?: 'mitered' | 'round' | 'bevel';
  borderFillColor?: string;
  borderMargins?: { top: number; left: number; bottom: number; right: number };
  borderCornerType?: 'square' | 'rounded' | 'concave';
  borderCornerSize?: number;
  textEncoding?: string;
  density?: number;
  ratio?: string | number;
  posiCodeVersion?: string;
  useGs1Data?: boolean;
  charTemplate?: string;
  searchReplace?: string;
  vbScript?: string;
  prefixSuffix?: string;
}

export interface ShapeElement extends BaseElement {
  type: 'shape';
  shapeType: ShapeType;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number; // in mm
  strokeStyle: 'solid' | 'dashed' | 'dotted' | 'double';
  cornerRadius: number; // in mm
}

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  objectFit: 'contain' | 'cover' | 'fill';
  grayscale: boolean;
  invert: boolean;
  aspectRatioLocked: boolean;
}

export interface TableCell {
  id: string;
  content: string;
  isHeader?: boolean;
  align?: 'left' | 'center' | 'right';
  colSpan?: number;
  rowSpan?: number;
  dataBinding?: string;
}

export interface TableElement extends BaseElement {
  type: 'table';
  rows: number;
  cols: number;
  cells: TableCell[][];
  borderColor: string;
  borderWidth: number;
  headerBackground: string;
  rowHeight: number; // in mm
  fontSize: number;
}

export interface GroupElement extends BaseElement {
  type: 'group';
  childrenIds: string[];
}

export type LabelElement = TextElement | BarcodeElement | ShapeElement | ImageElement | TableElement | GroupElement;

export type VariableType = 'static' | 'counter' | 'date' | 'time' | 'random' | 'csv' | 'gs1_ai' | 'formula' | 'system';

export interface VariableDefinition {
  id: string;
  name: string;
  type: VariableType;
  defaultValue: string;
  prefix?: string;
  suffix?: string;
  // Counter specific
  counterStart?: number;
  counterStep?: number;
  counterPad?: number;
  currentCounter?: number;
  counterDirection?: 'increment' | 'decrement';
  counterResetRule?: 'never' | 'daily' | 'monthly' | 'yearly' | 'job';
  // Date specific
  dateFormat?: string;
  dateOffsetDays?: number;
  dateOffsetMonths?: number;
  dateOffsetYears?: number;
  dateType?: 'current' | 'expiry' | 'mfg' | 'custom';
  // CSV / Data source
  csvColumn?: string;
  // GS1
  gs1Ai?: string;
  // Formula
  formulaExpression?: string;
}

export interface LabelDimensions {
  width: number; // in mm
  height: number; // in mm
  unit: UnitType;
  dpi: DpiOption;
  orientation: 'portrait' | 'landscape';
}

export interface LabelMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
  bleed: number;
  safeZone: number;
}

export interface SheetGridConfig {
  enabled: boolean;
  columns: number;
  rows: number;
  gapX: number;
  gapY: number;
  marginTop: number;
  marginLeft: number;
}

export interface NamedLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  printable: boolean;
  colorTag?: string;
}

export interface TemplateVersionRecord {
  version: string;
  timestamp: string;
  author: string;
  comment: string;
  elementCount: number;
  templateSnapshot?: any;
}

export interface DatabaseConnectionConfig {
  id: string;
  name: string;
  type: 'csv' | 'excel' | 'json' | 'rest_api' | 'sql_mock';
  endpointOrPath?: string;
  headers?: Record<string, string>;
  sqlQuery?: string;
  fields: string[];
  records: Record<string, string>[];
}

export interface ValidationIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  elementId?: string;
  elementName?: string;
  category: 'Barcode Symbology' | 'GS1 Compliance' | 'Print Boundary' | 'Data Binding' | 'Performance';
  message: string;
  autoFixable?: boolean;
  fixAction?: string;
}

export interface LabelTemplate {
  id: string;
  name: string;
  description: string;
  category: 'Logistics' | 'Pharma & Healthcare' | 'Retail' | 'Manufacturing' | 'Chemical & GHS' | 'Asset & Inventory';
  version: string;
  status: TemplateStatus;
  complianceStandard?: 'GS1-128' | 'FDA-UDI' | 'GHS-Hazmat' | 'AIAG-B10' | 'Avery-Standard' | 'Custom';
  dimensions: LabelDimensions;
  margins: LabelMargins;
  sheetGrid?: SheetGridConfig;
  layers?: NamedLayer[];
  elements: LabelElement[];
  variables: VariableDefinition[];
  sampleRecords: Record<string, string>[];
  databaseConnection?: DatabaseConnectionConfig;
  versions?: TemplateVersionRecord[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  comments?: TemplateComment[];
  tags: string[];
}

export interface TemplateComment {
  id: string;
  author: string;
  authorRole: string;
  content: string;
  createdAt: string;
  statusChange?: TemplateStatus;
}

export interface PrinterDefinition {
  id: string;
  name: string;
  model: string;
  brand: 'Zebra' | 'TSC' | 'Citizen' | 'Honeywell' | 'SATO' | 'Desktop PDF';
  dpi: DpiOption;
  ipAddress: string;
  port: number;
  status: 'online' | 'busy' | 'offline' | 'paper_out';
  protocol: 'zpl' | 'epl' | 'tspl' | 'cpcl' | 'escpos' | 'pdf' | 'browser';
  location: string;
  mediaWidth: number; // mm
  mediaHeight: number; // mm
}

export interface PrintJob {
  id: string;
  templateId: string;
  templateName: string;
  printerId: string;
  printerName: string;
  copies: number;
  recordCount: number;
  status: 'queued' | 'printing' | 'completed' | 'failed' | 'paused';
  format: 'zpl' | 'epl' | 'tspl' | 'cpcl' | 'escpos' | 'pdf' | 'png' | 'svg';
  submittedBy: string;
  submittedAt: string;
  completedAt?: string;
  progressPercent: number;
  zplOutput?: string;
  rawOutput?: string;
  errorMessage?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  userRole: string;
  action: 'CREATE_TEMPLATE' | 'EDIT_TEMPLATE' | 'SUBMIT_APPROVAL' | 'APPROVE_TEMPLATE' | 'REJECT_TEMPLATE' | 'PUBLISH_TEMPLATE' | 'PRINT_JOB_DISPATCH' | 'VARIABLE_UPDATE' | 'IMPORT_DATA' | 'SYSTEM_CONFIG' | 'ROLLBACK_VERSION';
  details: string;
  entityId?: string;
  entityName?: string;
  ipAddress: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole | 'Admin' | 'Label Designer' | 'Quality Reviewer' | 'Print Operator' | 'Auditor';
  department: string;
  avatar: string;
}

export interface CanvasGuide {
  id: string;
  type: 'horizontal' | 'vertical';
  position: number; // mm
}

export interface ViewportState {
  zoom: number; // scale e.g. 1 = 100%
  panX: number; // px offset
  panY: number; // px offset
  showGrid: boolean;
  showRulers: boolean;
  showGuides: boolean;
  showMargins: boolean;
  showSafeZone?: boolean;
  showBleed?: boolean;
  snapToGrid: boolean;
  snapToElements: boolean;
  gridSize: number; // in mm
  unit: UnitType;
  previewRecordIndex: number;
}
