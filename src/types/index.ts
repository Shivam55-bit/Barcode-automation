import { DataEntryFormDefinition } from './formTypes';

export type UnitType = 'mm' | 'inch' | 'px';
export type DpiOption = 203 | 300 | 600;
export type ElementType = 'text' | 'barcode' | 'shape' | 'image' | 'table' | 'line' | 'container' | 'group';
export type ShapeType = 'rectangle' | 'circle' | 'ellipse' | 'line' | 'polygon';

export type BarcodeSymbology = 
  | 'code128' 
  | 'code39' 
  | 'code93' 
  | 'codabar' 
  | 'ean13' 
  | 'ean8' 
  | 'ean2'
  | 'ean5'
  | 'upca' 
  | 'upce' 
  | 'itf14' 
  | 'interleaved2of5'
  | 'industrial2of5'
  | 'standard2of5'
  | 'matrix2of5'
  | 'datalogic2of5'
  | 'msi' 
  | 'plessey'
  | 'telepen'
  | 'posicode-a'
  | 'posicode-b'
  | 'pharmacode' 
  | 'pzn'
  | 'patchcode'
  | 'tlc39'
  | 'hibc-128'
  | 'hibc-datamatrix'
  | 'deutschepost-identcode'
  | 'deutschepost-leitcode'
  | 'japanpost'
  | 'koreapost'
  | 'kix'
  | 'royalmail'
  | 'usps-imb'
  | 'planet'
  | 'postnet'
  | 'gs1-128' 
  | 'gs1-databar'
  | 'gs1-databar-stacked'
  | 'gs1-databar-expanded'
  | 'gs1-databar-expanded-stacked'
  | 'gs1-composite'
  | 'datamatrix' 
  | 'gs1-datamatrix' 
  | 'qr' 
  | 'micro-qr'
  | 'gs1-qr'
  | 'pdf417' 
  | 'pdf417-truncated'
  | 'micropdf417'
  | 'aztec' 
  | 'maxicode' 
  | 'dotcode'
  | 'hanxin'
  | 'gridmatrix'
  | 'iqr'
  | 'ultracode';

export type UserRole = 'Super Admin' | 'Admin' | 'Designer' | 'Approver Level 1' | 'Approver Level 2' | 'Viewer / Print Operator';

export type UserStatus = 'pending_approval' | 'approved' | 'rejected' | 'suspended';

export interface AdminFeaturePermissions {
  canDesignTemplates: boolean;      // Studio / Template Builder
  canCreateTemplates: boolean;      // New Template / Save As
  canDeleteTemplates: boolean;      // Delete Template
  canApproveWorkflow: boolean;      // 21 CFR Part 11 Approval Workflow
  canPrintAndSpool: boolean;        // Print Center & Batch Spooler
  canManageDatasets: boolean;       // Excel/CSV Dataset Manager
  canCalibratePrinters: boolean;    // Printer Calibration Wizard
  canManageLicense: boolean;        // License & Hardware Machine GUID
  canDownloadDesktopApp: boolean;   // Desktop Software .exe Download
  canViewAuditLogs: boolean;        // View 21 CFR Part 11 Audit Trail
}

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
  | 'database-field'
  | 'serial' 
  | 'clock' 
  | 'formula'
  | 'prompt' 
  | 'script' 
  | 'variable' 
  | 'system'
  | 'linked'
  | 'object'
  | 'global'
  | 'external_file'
  | 'print_job'
  | 'gs1_ai'
  | 'gs1_composite'
  | 'gs1_databar'
  | 'control-character';

export interface TransformRule {
  id: string;
  name?: string;
  order?: number;
  type: 'truncate' | 'substring' | 'search_replace' | 'regex' | 'trim' | 'case' | 'pad' | 'prefix_suffix' | 'math' | 'encode_decode' | 'script';
  params?: {
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
    scriptCode?: string;
    scriptLanguage?: 'javascript' | 'vbscript';
    code?: string;
    language?: 'javascript' | 'vbscript';
  };
  enabled: boolean;
  scriptLanguage?: 'javascript' | 'vbscript';
  scriptCode?: string;
}



export interface EvaluationContext {
  record?: Record<string, any>;
  datasets?: any[];
  connectedDataset?: any;
  variables?: VariableDefinition[];
  namedDataSources?: NamedDataSource[];
  calculatedFields?: CalculatedFieldDefinition[];
  elements?: LabelElement[];
  currentRecordIndex?: number;
  totalRecords?: number;
  printerName?: string;
  jobId?: string;
  jobName?: string;
  userName?: string;
  computerName?: string;
  pageNumber?: number;
  totalPages?: number;
  copyNumber?: number;
  printIndex?: number;
  globalData?: Record<string, any>;
  resolutionStack?: Set<string>;
  documentName?: string;
  filePath?: string;
  databaseRecord?: any;
  batchIndex?: number;
  totalBatches?: number;
  recordsCount?: number;
  error?: string;
  symbolOnly?: boolean;
  isPartial?: boolean;
  system?: any;
  [key: string]: any;
}


export interface DynamicValueSource {
  sourceType: 'constant' | 'database' | 'named_source' | 'unlimited';
  value: number;
  databaseField?: string;
  namedSource?: string;
  allowRecordOverride?: boolean;
  isUnlimited?: boolean;
}

export type SerializationEvent =
  | 'standard'
  | 'record'
  | 'page'
  | 'job'
  | 'data_change'
  | 'copy'
  | 'item'
  | 'interval';

export type SerializationMethod =
  | 'alphabetic_and_numeric'
  | 'numeric'
  | 'alphabetic'
  | 'alphanumeric'
  | 'hexadecimal'
  | 'custom';

export type LetterCaseOption =
  | 'uppercase'
  | 'uppercase_no_io'
  | 'lowercase'
  | 'lowercase_no_l'
  | 'uppercase_hex'
  | 'lowercase_hex';

export interface SerializationDefinition {
  action: 'none' | 'increment' | 'decrement';
  method: SerializationMethod | 'alphanumeric' | 'numeric' | 'alphabetic';
  letterCase?: LetterCaseOption | 'uppercase' | 'lowercase';
  customSequence?: string;
  preserveCharacters: boolean;
  incrementBy: number;
  incrementBySource?: DynamicValueSource;
  event: SerializationEvent;
  eventInterval: number;
  eventIntervalSource?: DynamicValueSource;
  dataItem?: string;
  dataItemSource?: DynamicValueSource;
  serialNumbers?: number;
  serialNumbersSource?: DynamicValueSource;
  copies: number;
  copiesSource?: DynamicValueSource;
  prefix?: string;
  suffix?: string;
  resetRule?: 'never' | 'manual' | 'start' | 'daily' | 'weekly' | 'monthly' | 'record' | 'change';
  resetValue?: string;
}

export interface SerializationConfig extends Partial<SerializationDefinition> {
  enabled?: boolean;
  type?: 'numeric' | 'alphabetic' | 'alphanumeric' | 'custom' | string;
  step?: number;
  direction?: 'increment' | 'decrement';
  currentValue?: string;
  nextValue?: string;
  lastResetAt?: string;
  lastResetReason?: string;
  padZeros?: boolean;
  padLength?: number;
}



export interface SerializationState {
  sourceId: string;
  currentCommittedValue: string;
  lastCommittedAt: string;
  version: number;
}

export type SerialReservationStatus =
  | 'PREPARED'
  | 'RESERVED'
  | 'SUBMITTED'
  | 'COMMITTED'
  | 'ROLLED_BACK'
  | 'PARTIALLY_PRINTED'
  | 'PRINTED_OR_SUBMITTED_BUT_COMMIT_FAILED'
  | 'UNKNOWN';

export interface SerialReservation {
  id: string;
  sourceId: string;
  documentId: string;
  jobId: string;
  startValue: string;
  endValue: string;
  count: number;
  status: SerialReservationStatus;
  createdAt: string;
  updatedAt: string;
  printedCount?: number;
  remainingCount?: number;
  lastBatchIndex?: number;
  totalBatches?: number;
  clientRequestId?: string;
  error?: string;
}

export interface SerialJournalEntry {
  id: string;
  sourceId: string;
  oldValue: string;
  newValue: string;
  jobId?: string;
  reservationId?: string;
  timestamp: string;
  reason: string;
  status: 'committed' | 'rolled_back' | 'reset' | 'failed';
}

export type PrintCommitPolicy =
  | 'WHOLE_JOB_ON_DISPATCH'
  | 'WHOLE_JOB_ON_COMPLETION'
  | 'PER_ITEM'
  | 'PER_BATCH'
  | 'MANUAL_CONFIRMATION';

export interface PrintJobItem {
  itemIndex: number;
  recordIndex: number;
  copyIndex: number;
  serialValue?: string;
  status: 'pending' | 'spooled' | 'printed' | 'unknown' | 'failed';
  printedAt?: string;
}

export interface PrintJobBatch {
  batchIndex: number;
  startIndex: number;
  endIndex: number;
  startSerial?: string;
  endSerial?: string;
  count: number;
  status: 'pending' | 'submitting' | 'submitted' | 'printed' | 'unknown' | 'failed';
  dispatchedAt?: string;
  completedAt?: string;
  rawPayload?: string;
}

export interface DataTypeFormatConfig {
  dataType: 'text' | 'number' | 'integer' | 'decimal' | 'currency' | 'date' | 'time' | 'datetime' | 'boolean';
  decimalPlaces?: number;
  thousandSeparator?: boolean;
  decimalSeparator?: string;
  minDigits?: number;
  leadingZeros?: number;
  currencySymbol?: string;
  currencySymbolPosition?: 'prefix' | 'suffix';
  dateFormat?: string;
}

export interface TransformConfig {
  suppression?: {
    type: 'never' | 'always' | 'empty' | 'equals' | 'not_equals' | 'expression';
    value?: string;
  };
  characterFilter?: {
    type: 'none' | 'digits' | 'letters' | 'alphanumeric' | 'uppercase' | 'lowercase' | 'custom_allowed' | 'custom_blocked';
    customChars?: string;
  };
  truncation?: {
    type: 'none' | 'keep_first' | 'keep_last' | 'delete_first' | 'delete_last';
    count: number;
  };
  characterLength?: {
    min?: number;
    max?: number;
    padChar?: string;
    padSide?: 'left' | 'right';
    overflowAction?: 'truncate' | 'error' | 'none';
  };
  characterTemplate?: {
    template?: string;
  };
  searchReplace?: Array<{
    find: string;
    replace: string;
    caseSensitive?: boolean;
    wholeWord?: boolean;
    isRegex?: boolean;
  }>;
  script?: {
    language: 'javascript' | 'vbscript';
    code: string;
  };
  serialization?: SerializationConfig;
  prefixSuffix?: {
    prefix?: string;
    suffix?: string;
  };
  dataTypeFormat?: DataTypeFormatConfig;
}

export interface BorderConfig {
  type: 'none' | 'rectangle' | 'ellipse';
  marginTop?: number;
  marginLeft?: number;
  marginBottom?: number;
  marginRight?: number;
  thickness: number;
  color: string;
  transparency?: number;
  dashStyle?: 'solid' | 'dashed' | 'dotted';
  compoundStyle?: 'single' | 'double' | 'thick-thin';
  joinType?: 'mitered' | 'round' | 'bevel';
  fillColor?: string;
  fillTransparency?: number;
  cornerType?: 'square' | 'rounded' | 'concave';
  cornerSize?: number;
  sides?: {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
  };
}

export interface ArcConfig {
  radius: number;
  startAngle: number;
  sweepAngle: number;
  direction: 'clockwise' | 'counter-clockwise';
  insidePath: boolean;
  characterSpacing: number;
}

export interface AutoSizeConfig {
  enabled: boolean;
  minFontSize: number;
  maxFontSize: number;
  minWidthScale: number;
  maxWidthScale: number;
  objectWidth?: number;
  objectHeight?: number;
  horizontalAlignment?: 'left' | 'center' | 'right' | 'justify';
  verticalAlignment?: 'top' | 'middle' | 'bottom';
}

export interface DataSourceFontOverride {
  fontFamily?: string;
  fontSize?: number; // in pt
  fontWeight?: 'normal' | 'bold' | '600' | '700' | '800';
  fontStyle?: 'normal' | 'italic';
  underline?: boolean;
  strikeout?: boolean;
  whiteOnBlack?: boolean;
  color?: string; // Foreground Color
  backgroundColor?: string; // Background Color
  fontWidthScale?: number; // 100% default
  textOutline?: {
    enabled: boolean;
    color: string;
    width: number;
  };
  letterSpacing?: number;
}

export interface ResolvedTextRun {
  sourceId: string;
  type: 'text' | 'control';
  value: string;
  controlCode?: string;
  style: DataSourceFontOverride;
}

export interface DataSourceItem {
  id: string;
  name: string;
  type: DataSourceType;
  value: string;
  valueEncoding?: 'raw' | 'legacy-control-tokens';
  // Control Character structured fields
  controlCode?: string;
  code?: string;
  decimal?: number;
  hex?: string;
  // Data Type & Formatting
  dataType?: 'text' | 'number' | 'integer' | 'decimal' | 'currency' | 'date' | 'time' | 'datetime' | 'boolean';
  numberFormat?: {
    decimalPlaces?: number;
    thousandSeparator?: boolean;
    decimalSeparator?: string;
    minDigits?: number;
    leadingZeros?: number;
  };
  dateFormat?: string;
  // Transforms & Serialization
  transforms?: TransformRule[];
  transformConfig?: TransformConfig;
  serialization?: SerializationConfig;
  prefixSuffix?: {
    prefix?: string;
    suffix?: string;
  };
  // Font per Data Source Overrides
  fontOverrideEnabled?: boolean;
  fontStyleOverride?: DataSourceFontOverride;
  fontOverride?: DataSourceFontOverride;
  // Database
  databaseField?: string;
  field?: string;
  datasetId?: string;
  datasetName?: string;
  sheetName?: string;
  // Variable
  variableName?: string;
  // Legacy Serial fields for backward compatibility
  serialStart?: number;
  serialStep?: number;
  serialPad?: number;
  serialPrefix?: string;
  serialSuffix?: string;
  serialDirection?: 'increment' | 'decrement';
  serialResetRule?: 'never' | 'daily' | 'monthly' | 'yearly' | 'job';
  currentSerialValue?: number;
  // Date / Clock
  clockBase?: 'date' | 'time' | 'datetime' | 'database_field';
  clockBaseField?: string;
  dateOffsetDays?: number | string;
  dateOffsetDaysSource?: 'fixed' | 'database_field' | 'formula' | 'named_source';
  dateOffsetDaysField?: string;
  dateOffsetMonths?: number | string;
  dateOffsetMonthsSource?: 'fixed' | 'database_field' | 'formula' | 'named_source';
  dateOffsetMonthsField?: string;
  dateOffsetYears?: number | string;
  dateOffsetYearsSource?: 'fixed' | 'database_field' | 'formula' | 'named_source';
  dateOffsetYearsField?: string;
  timeOffsetHours?: number | string;
  timeOffsetHoursSource?: 'fixed' | 'database_field' | 'formula' | 'named_source';
  timeOffsetHoursField?: string;
  timeOffsetMinutes?: number | string;
  timeOffsetMinutesSource?: 'fixed' | 'database_field' | 'formula' | 'named_source';
  timeOffsetMinutesField?: string;
  timeOffsetSeconds?: number | string;
  timeOffsetSecondsSource?: 'fixed' | 'database_field' | 'formula' | 'named_source';
  timeOffsetSecondsField?: string;
  clockDateFormat?: string;
  clockTimeFormat?: string;
  dateType?: 'current' | 'expiry' | 'mfg' | 'custom';
  // Script
  scriptLanguage?: 'javascript' | 'vbscript';
  scriptCode?: string;
  scriptMode?: 'expression' | 'multiline';
  // Prompt at print time
  promptLabel?: string;
  promptDefault?: string;
  // System variable
  systemVarName?: 'SYSTEM.DATE' | 'SYSTEM.TIME' | 'SYSTEM.USER' | 'SYSTEM.PRINTER' | 'SYSTEM.JOB_ID' | 'SYSTEM.PAGE_NUMBER' | 'SYSTEM.TOTAL_PAGES' | 'SYSTEM.RECORD_NUMBER' | 'SYSTEM.TOTAL_RECORDS' | 'SYSTEM.COPY_NUMBER' | 'SYSTEM.COMPUTER_NAME';
  // Named Data Source & Formula binding
  namedSourceId?: string;
  formulaExpression?: string;
  counterId?: string;
  serialSequenceId?: string;
  // Linked / Object value
  linkedObjectId?: string;
  linkedProperty?: string;
  // Global Data
  globalField?: string;
  // External File
  filePath?: string;
  fileEncoding?: string;
  fileRow?: number;
  fileColumn?: string | number;
  // Print Job
  printJobField?: 'job_name' | 'printer_name' | 'copies' | 'record_number' | 'total_records' | 'timestamp';
  // GS1 Application Identifier Data Source
  gs1AIs?: GS1Field[];
  // GS1 Composite
  gs1CompositeType?: 'CC-A' | 'CC-B' | 'CC-C';
  gs1CompositeLinear?: string;
  gs1Composite2DData?: string;
  // GS1 DataBar
  gs1DataBarVariant?: 'omnidirectional' | 'stacked' | 'expanded' | 'expanded_stacked';
  gs1DataBarSegments?: number;
  onProcessDataScript?: string;
  onProcessDataLanguage?: 'javascript' | 'vbscript';
  onProcessDataEnabled?: boolean;
  enabled: boolean;
}

export interface ScriptLibrary {
  id: string;
  name: string;
  language: 'vbscript' | 'javascript';
  code: string;
  description?: string;
  enabled: boolean;
  filePath?: string;
  isExternal?: boolean;
}

export interface ObjectEventHook {
  event: 'OnLoad' | 'BeforePrint' | 'AfterPrint' | 'OnValidate' | 'OnProcessData' | string;
  script: string;
  language?: 'javascript' | 'vbscript';
}

export interface BaseElement extends PositionAndSize {
  id: string;
  name: string;
  type: ElementType;
  locked: boolean;
  editable?: boolean; // When false, element is read-only and non-editable
  isEditable?: boolean; // Legacy alias for editable
  allowMove?: boolean;
  allowResize?: boolean;
  allowRotate?: boolean;
  allowDelete?: boolean;
  allowContentEdit?: boolean;
  allowPropertyEdit?: boolean;
  allowVariableEdit?: boolean;
  visible: boolean;
  printable?: boolean;
  opacity: number; // 0 to 1
  groupId?: string;
  zIndex: number;
  layer?: string;
  layerId?: string;
  referencePoint?: ReferencePoint;
  dataSources?: DataSourceItem[];
  dataBinding?: any;
  value?: string;
  barcodeValue?: string;
  content?: string;
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
  color?: string;
  foregroundColor?: string;
  backgroundColor?: string;
  isGs1?: boolean;
  effectsConfig?: {
    outline?: boolean;
    outlineColor?: string;
    outlineWidth?: number;
    shadow?: boolean;
    shadowColor?: string;
    shadowBlur?: number;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    opacity?: number;
    letterSpacing?: number;
    lineSpacing?: number;
    strikeout?: boolean;
    underline?: boolean;
  };
}

export type TextObjectType = 
  | 'single-line'
  | 'multi-line'
  | 'paragraph'
  | 'word-processor'
  | 'arc'
  | 'symbol-font'
  | 'rtf'
  | 'html'
  | 'xaml';

export type AutoFitMode = 'none' | 'auto-width' | 'auto-height' | 'fit-text-to-box' | 'shrink-to-fit';
export type TextSizingMode = 'scale-text' | 'auto-width' | 'fixed-width' | 'shrink-to-fit' | 'fit-to-box';

export interface FormattedTextRun {
  id?: string;
  text: string;
  fontFamily?: string;
  fontSize?: number; // pt
  fontWeight?: 'normal' | 'bold' | '600' | '700' | '800';
  fontStyle?: 'normal' | 'italic';
  underline?: boolean;
  strikeout?: boolean;
  color?: string;
  backgroundColor?: string;
  dataBinding?: string;
}

export interface WordProcessorBlock {
  id?: string;
  type: 'paragraph' | 'heading' | 'bullet-list' | 'numbered-list';
  align?: 'left' | 'center' | 'right' | 'justify';
  lineSpacing?: number;
  runs: FormattedTextRun[];
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  textType?: TextObjectType;
  textFormatType?: 'single-line' | 'multi-line' | 'paragraph' | 'arc';
  sizingMode?: TextSizingMode;
  paragraphWidth?: number;
  overflow?: 'visible' | 'hidden' | 'clip';
  // Typography
  fontFamily: string;
  fontSize: number; // in pt
  fontWeight: 'normal' | 'bold' | '600' | '700' | '800';
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline' | 'line-through';
  underline?: boolean;
  strikeout?: boolean;
  whiteOnBlack?: boolean;
  foregroundColor?: string;
  color: string;
  backgroundColor?: string;
  fontWidthScale?: number; // 100% default
  lineHeight: number;
  letterSpacing: number;
  dataBinding?: string; // e.g. "{{PRODUCT_NAME}}"
  // Format & AutoSize / Fit
  autoFit?: boolean;
  autoSize?: boolean;
  autoHeight?: boolean;
  autoFitMode?: AutoFitMode;
  autoSizeConfig?: AutoSizeConfig;
  minFontSize?: number;
  maxFontSize?: number;
  minWidthScale?: number;
  maxWidthScale?: number;
  textAlign: 'left' | 'center' | 'right' | 'justify' | 'distributed';
  orphanAlignment?: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
  horizontalAlignment?: 'left' | 'center' | 'right' | 'justify';
  verticalAlignment?: 'top' | 'middle' | 'bottom';
  lineSpacing?: number;
  tabStops?: number[];
  indentationMode?: 'none' | 'first-line' | 'hanging';
  indentationMm?: number;
  defaultTabIntervalMm?: number;
  wordWrap?: boolean;
  wrap?: boolean;
  multiline?: boolean;
  // Arc configuration
  arcConfig?: ArcConfig;
  arcRadius?: number;
  arcStartAngle?: number;
  arcSweepAngle?: number;
  arcDirection?: 'clockwise' | 'counter-clockwise';
  arcInsidePath?: boolean;
  arcCharacterSpacing?: number;
  // Border configuration
  borderConfig?: BorderConfig;
  borderType?: 'none' | 'rectangle' | 'ellipse';
  borderThickness?: number;
  borderColor?: string;
  borderDashStyle?: 'solid' | 'dashed' | 'dotted';
  borderJoinType?: 'mitered' | 'round' | 'bevel';
  borderFillColor?: string;
  borderMargins?: { top: number; left: number; bottom: number; right: number };
  borderCornerType?: 'square' | 'rounded' | 'concave';
  borderCornerSize?: number;
  borderSides?: { top: boolean; right: boolean; bottom: boolean; left: boolean };
  // Word Processor structured model & rich runs
  runs?: FormattedTextRun[];
  blocks?: WordProcessorBlock[];
  richContentHtml?: string;
  // Markup containers
  rtfRaw?: string;
  xamlRaw?: string;
  sanitizedHtml?: string;
  // Symbol character properties
  symbolUnicode?: string;
  symbolFont?: string;
  // Text Outline
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
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold' | 'bolder' | 'lighter' | number | string;
  fontStyle?: 'normal' | 'italic' | 'oblique' | string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  color?: string;
  underline?: boolean;
  textDecoration?: 'none' | 'underline' | 'line-through';
  humanReadableFont?: string;
  humanReadableFontSize?: number;
  humanReadableFontStyle?: 'regular' | 'italic' | 'bold' | 'bold-italic';
  humanReadableAlignment?: 'left' | 'center' | 'centered' | 'right';
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
  textFormatType?: 'single-line' | 'multi-line' | 'paragraph';
  autoSize?: boolean;
  autoSizeText?: boolean;
  minFontSize?: number;
  maxFontSize?: number;
  minWidthScale?: number;
  maxWidthScale?: number;
  horizontalAlignment?: 'left' | 'center' | 'centered' | 'right';
  verticalAlignment?: 'top' | 'middle' | 'bottom';
  tabsConfig?: Array<{
    id: string;
    positionMm: number;
    alignment: 'left' | 'center' | 'right' | 'decimal';
    leader: 'none' | 'dots' | 'dashes' | 'line';
  }>;
  borderType?: 'none' | 'rectangle' | 'ellipse';
  borderThickness?: number;
  borderColor?: string;
  borderDashStyle?: 'solid' | 'dashed' | 'dotted';
  borderJoinType?: 'mitered' | 'round' | 'bevel';
  borderFillColor?: string;
  borderMargins?: { top: number; left: number; bottom: number; right: number };
  borderCornerType?: 'square' | 'rounded' | 'concave';
  borderCornerSize?: number;
  cornerRadius?: number;
  borderPadding?: number;
  textEncoding?: string;
  density?: number;
  xDimensionMm?: number;
  lockXDimension?: boolean;
  xDimensionUnits?: 'mm' | 'mils' | 'auto';
  autoSizeToWidth?: boolean;
  requestedWidthMm?: number;
  minXDimensionMm?: number;
  maxXDimensionMm?: number;
  ratioMode?: 'auto' | 'standard' | 'custom' | 'manual';
  ratio?: string | number;
  heightMm?: number;
  checkDigitMode?: 'auto' | 'manual' | 'none' | 'include' | 'exclude';
  codeSet?: 'auto' | 'A' | 'B' | 'C' | 'Auto';
  gs1Mode?: boolean;
  barSpaceAdjustment?: {
    mode: 'none' | 'reduce' | 'increase' | 'reduceBar' | 'increaseBar';
    dots: number;
  };
  printMethod?: 'auto' | 'native' | 'vector' | 'raster' | 'native_printer';
  posiCodeVersion?: string;
  useGs1Data?: boolean;
  charTemplate?: string;
  searchReplace?: string;
  vbScript?: string;
  prefixSuffix?: string;
  moduleWidth?: number;
  symbol?: {
    barHeight?: number;
    moduleWidth?: number;
  };
  humanReadable?: HumanReadableConfig;
}

export interface HumanReadableConfig {
  enabled?: boolean;
  visibility?: 'full' | 'none' | 'perSource';
  visibleSourceIds?: string[];
  placement?: 'bottom' | 'top';
  alignment?: 'left' | 'center' | 'centered' | 'right';
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  color?: string;
  gap?: number;
  marginTop?: number;
  verticalOffsetMm?: number;
  horizontalOffsetMm?: number;
  hideCheckDigit?: boolean;
  gs1Template?: 'none' | 'standard' | 'custom' | string;
  lineBreakAfterAi?: boolean;
  characterTemplate?: {
    template?: string;
  };
  searchReplace?: Array<{
    find: string;
    replace: string;
    caseSensitive?: boolean;
    wholeWord?: boolean;
    isRegex?: boolean;
  }>;
  script?: {
    language: 'javascript' | 'vbscript';
    code: string;
  };
  prefixSuffix?: {
    prefix?: string;
    suffix?: string;
  };
}

export interface ShapeElement extends BaseElement {
  type: 'shape';
  shapeType: ShapeType;
  fillColor: string;
  fill?: string;
  strokeColor: string;
  stroke?: string;
  strokeWidth: number; // in mm
  strokeStyle: 'solid' | 'dashed' | 'dotted' | 'double';
  strokeDash?: string;
  cornerRadius: number; // in mm
}

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  objectFit: 'contain' | 'cover' | 'fill';
  grayscale: boolean;
  invert: boolean;
  aspectRatioLocked: boolean;
  /** Data-bound image (spec 27): database field / token that resolves to a path or URL */
  imageSourceType?: 'static' | 'database';
  imageField?: string;
  /** Optional base folder to resolve relative image file names against */
  imageBaseFolder?: string;
  /** Fallback image src used when the resolved path is missing/invalid/empty */
  fallbackSrc?: string;
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
  orientation: 'portrait' | 'landscape' | 'portrait-180' | 'landscape-180';
  shape?: 'rectangle' | 'rounded' | 'round-rectangle' | 'circle' | 'ellipse' | 'oval';
  cornerRadius?: number;
}

export interface TemplatePrinterConfig {
  id: string;
  name: string;
  systemName: string;
  driverName?: string;
  portName?: string;
  port?: string;
  dpi?: number | null;
  renderer?: string;
  manufacturer?: string;
  model?: string;
  sourcePrinterName?: string;
  isAvailable?: boolean;
}

export interface TemplatePrintOrder {
  startingCorner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  direction: 'horizontal' | 'vertical';
  selectStartingPositionAtPrintTime?: boolean;
  continueFromPrevious?: boolean;
}

export interface TemplateBackgroundConfig {
  useColor?: boolean;
  color?: string;
  useImage?: boolean;
  imageUrl?: string;
  showInDesigner?: boolean;
  printBackground?: boolean;
}

export interface LabelMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
  bleed: number;
  safeZone: number;
  unit?: UnitType;
}

export interface SheetGridConfig {
  enabled: boolean;
  columns: number;
  rows: number;
  gapX?: number;
  gapY?: number;
  gapHorizontal?: number;
  gapVertical?: number;
  labelWidth?: number;
  labelHeight?: number;
  marginTop?: number;
  marginLeft?: number;
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

export type ExcelDataSourceMode = 'import' | 'link' | 'imported' | 'linked';

export type ExcelConnectionStatus =
  | 'READY'
  | 'CONNECTED'
  | 'FILE_CHANGED'
  | 'REFRESHING'
  | 'FILE_MISSING'
  | 'FILE_LOCKED'
  | 'INVALID_FILE'
  | 'SHEET_MISSING'
  | 'ERROR';

export interface ExcelColumnDefinition {
  name: string;
  originalName?: string;
  type?: 'string' | 'text' | 'number' | 'date' | 'barcode' | 'boolean';
  dataType?: 'text' | 'number' | 'date' | 'boolean' | 'string' | 'barcode';
  format?: string;
  allowEmpty?: boolean;
  defaultValue?: string;
}

export type RecordFilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'isNull'
  | 'isNotNull'
  | 'between';

export interface RecordFilterCondition {
  field: string;
  operator: RecordFilterOperator;
  value?: any;
  value2?: any;
  logic?: 'AND' | 'OR';
}

export interface RecordSortCondition {
  field: string;
  direction: 'asc' | 'desc';
}

export interface DatabaseConnectionConfig {
  id: string;
  name: string;
  type: 'csv' | 'excel' | 'json' | 'rest_api' | 'sql_mock' | 'sample';
  mode?: ExcelDataSourceMode;
  filePath?: string;
  fileName?: string;
  sheetName?: string;
  availableSheets?: string[];
  headerRow?: number;
  status?: ExcelConnectionStatus;
  statusMessage?: string;
  endpointOrPath?: string;
  headers?: Record<string, string>;
  sqlQuery?: string;
  fields: string[];
  columns?: ExcelColumnDefinition[];
  records: Record<string, any>[];
  lastModified?: string;
  lastRefreshed?: string;
  autoRefresh?: boolean;
  quantityColumn?: string;
  mapping?: Record<string, string>;
  /** Persisted structured filters that drive the visible record set (spec 23) */
  recordFilters?: RecordFilterCondition[];
  /** Persisted multi-field sort priority list (spec 24) */
  recordSort?: RecordSortCondition[];
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

export interface NamedDataSource {
  id: string;
  name: string; // e.g. "PRODUCT_NAME", "SKU", "BARCODE", "BATCH_NO", "EXP_DATE", "MRP", "SERIAL_NO"
  description?: string;
  type: DataSourceType;
  defaultValue?: string;
  currentValue?: string;
  databaseField?: string;
  formulaExpression?: string;
  serialSequenceId?: string;
  counterId?: string;
  transforms?: TransformRule[];
}

/**
 * Calculated (derived) field available like a regular field to Text, Barcode,
 * Scripts and Named Sources. Example: Total = Price * Quantity (spec 17).
 */
export interface CalculatedFieldDefinition {
  id: string;
  name: string; // e.g. "Total", "GSTAmount", "FinalPrice"
  formula: string; // formulaEngine expression, e.g. "Price * Quantity"
  description?: string;
  enabled?: boolean;
  format?: DataTypeFormatConfig;
}

export type TextPrintMethod = 'auto' | 'text-output' | 'vector' | 'raster';
export type BarcodePrintMethod = 'auto' | 'native' | 'vector' | 'raster';
export type ShapePrintMethod = 'auto' | 'native' | 'vector' | 'raster';

export interface ObjectPrintMethodSettings {
  scope: 'global' | 'document';
  trueTypeText: TextPrintMethod;
  unsupported1D: BarcodePrintMethod;
  unsupported2D: BarcodePrintMethod;
  lines: ShapePrintMethod;
  boxes: ShapePrintMethod;
  ellipses: ShapePrintMethod;
}

export interface LabelTemplate {
  id: string;
  name: string;
  description: string;
  authorEmail?: string;
  author?: string;
  category: 'Logistics' | 'Pharma & Healthcare' | 'Retail' | 'Manufacturing' | 'Chemical & GHS' | 'Asset & Inventory';
  version: string;
  status: TemplateStatus;
  complianceStandard?: 'GS1-128' | 'FDA-UDI' | 'GHS-Hazmat' | 'AIAG-B10' | 'Avery-Standard' | 'Custom';
  dimensions: LabelDimensions;
  margins: LabelMargins;
  shape?: 'rectangle' | 'rounded' | 'round-rectangle' | 'circle' | 'ellipse' | 'oval';
  cornerRadius?: number;
  sheetGrid?: SheetGridConfig;
  layers?: NamedLayer[];
  elements: LabelElement[];
  variables: VariableDefinition[];
  namedDataSources?: NamedDataSource[];
  calculatedFields?: CalculatedFieldDefinition[];
  dataEntryForm?: import('./formTypes').DataEntryFormDefinition;
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
  printer?: TemplatePrinterConfig;
  stockId?: string;
  stockName?: string;
  mediaType?: 'gap' | 'continuous' | 'black_mark' | 'die_cut';
  printOrder?: TemplatePrintOrder;
  background?: TemplateBackgroundConfig;
  objectPrintMethodSettings?: ObjectPrintMethodSettings;
  eventScripts?: Record<string, string>;
  eventScriptLanguages?: Record<string, 'javascript' | 'vbscript'>;
  scriptLibraries?: ScriptLibrary[];
  codeModifierConfig?: PrinterCodeModifierConfig;
  sourceMetadata?: Record<string, any>;
  importReport?: any;
}

export interface PrinterCodeModifierRule {
  id: string;
  name: string;
  type: 'prefix' | 'suffix' | 'search_replace' | 'custom_script';
  enabled: boolean;
  searchPattern?: string;
  replacementText?: string;
  isRegex?: boolean;
  prefixText?: string;
  suffixText?: string;
  script?: string;
  scriptLanguage?: 'javascript' | 'vbscript';
}

export interface PrinterCodeModifierConfig {
  enabled: boolean;
  rules?: PrinterCodeModifierRule[];
  prefix?: string;
  suffix?: string;
  substitutions?: Array<{ find: string; replace: string; isRegex?: boolean }>;
  customScript?: string;
  scriptLanguage?: 'javascript' | 'vbscript';
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
  type?: string;
  isDefault?: boolean;
  driverName?: string;
  isThermal?: boolean;
  darkness?: number;
  speed?: number;
  mediaType?: 'continuous' | 'gap' | 'black_mark' | 'die_cut';
  capabilities?: string[];
}

export interface PrintJob {
  id: string;
  clientRequestId?: string;
  templateId: string;
  templateName: string;
  printerId: string;
  printerName: string;
  copies: number;
  recordCount: number;
  status: 'queued' | 'printing' | 'completed' | 'failed' | 'paused' | 'CREATED' | 'RESERVED' | 'RENDERED' | 'SUBMITTING' | 'SUBMITTED' | 'SPOOLING' | 'PRINTING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'PARTIAL' | 'UNKNOWN';
  format: 'zpl' | 'epl' | 'tspl' | 'cpcl' | 'sbpl' | 'escpos' | 'pdf' | 'png' | 'svg';
  submittedBy: string;
  submittedAt: string;
  completedAt?: string;
  progressPercent: number;
  zplOutput?: string;
  rawOutput?: string;
  errorMessage?: string;
  dataSnapshot?: Record<string, any>[];
  printMode?: 'all' | 'current' | 'selected' | 'filtered' | 'range';
  selectedRecordIndices?: number[];
  quantityColumn?: string;
  totalLabelsPrinted?: number;
  datasetName?: string;
  excelFilePath?: string;
  excelSheetName?: string;
  // Production Serialization & Telemetry fields
  reservationId?: string;
  serialStart?: string;
  serialEnd?: string;
  confirmedCount?: number;
  unknownCount?: number;
  failedCount?: number;
  commitPolicy?: PrintCommitPolicy;
  spoolerJobId?: number | string;
  batches?: PrintJobBatch[];
  items?: PrintJobItem[];
  templateSnapshot?: LabelTemplate;
}

export interface CanvasAnnotation {
  id: string;
  x: number; // in mm
  y: number; // in mm
  elementId?: string;
  elementName?: string;
  text: string;
  author: string;
  authorRole: string;
  createdAt: string;
  resolved?: boolean;
}

export interface ApprovalTierRecord {
  id: string;
  level: 1 | 2;
  role: string;
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
  reviewerName?: string;
  reviewerEmail?: string;
  timestamp?: string;
  comment?: string;
  digitalSignature?: string;
}

export interface TemplateVersionSnapshot {
  id: string;
  version: string;
  templateId: string;
  templateName: string;
  snapshotJson: LabelTemplate;
  canvasJson: {
    dimensions: LabelDimensions;
    margins: LabelMargins;
    sheetGrid?: SheetGridConfig;
    scaleDpi: DpiOption;
    elementCount: number;
  };
  svgSnapshot: string;
  pngSnapshot: string;
  pdfSnapshot?: string;
  objectTree: Array<{
    id: string;
    name: string;
    type: ElementType;
    locked: boolean;
    editable: boolean;
    position: { x: number; y: number; width: number; height: number; rotation: number };
    zIndex: number;
  }>;
  objectProperties: Record<string, any>;
  variableMapping: Record<string, { type: VariableType; defaultValue: string; dataBinding?: string }>;
  hash: string; // SHA-256 integrity hash
  checksum: string;
  status: TemplateStatus;
  submittedBy: string;
  submittedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  approvalTimeline: ApprovalTierRecord[];
  annotations?: CanvasAnnotation[];
  comments?: TemplateComment[];
  diffSummary?: string;
}

export interface VersionDiffResult {
  versionA: string;
  versionB: string;
  hasChanges: boolean;
  addedElements: LabelElement[];
  removedElements: LabelElement[];
  modifiedElements: Array<{
    id: string;
    name: string;
    type: ElementType;
    changes: Array<{
      property: string;
      oldValue: any;
      newValue: any;
    }>;
  }>;
  dimensionChanged: boolean;
  variableChanges: Array<{
    name: string;
    action: 'added' | 'removed' | 'modified';
    details: string;
  }>;
}

export interface ViewerLogEntry {
  id: string;
  timestamp: string;
  templateId: string;
  templateVersion: string;
  jobId?: string;
  action: 'VIEW' | 'ZOOM' | 'DOWNLOAD_PDF' | 'DOWNLOAD_PNG' | 'PRINT_DISPATCH';
  userName: string;
  userRole: string;
  details: string;
  pagesViewedOrPrinted?: string;
  printerName?: string;
  ipAddress?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  userRole: string;
  action:
    | 'CREATE_TEMPLATE'
    | 'EDIT_TEMPLATE'
    | 'SUBMIT_APPROVAL'
    | 'APPROVE_TEMPLATE'
    | 'REJECT_TEMPLATE'
    | 'REQUEST_CHANGE'
    | 'PUBLISH_TEMPLATE'
    | 'PRINT_JOB_DISPATCH'
    | 'VARIABLE_UPDATE'
    | 'IMPORT_DATA'
    | 'SYSTEM_CONFIG'
    | 'ROLLBACK_VERSION'
    | 'VIEW_TEMPLATE'
    | 'DOWNLOAD_PDF'
    | 'DOWNLOAD_PNG'
    | 'ANNOTATE_TEMPLATE';
  details: string;
  entityId?: string;
  entityName?: string;
  ipAddress: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole | string;
  department: string;
  avatar: string;
  status?: UserStatus;
  isApproved?: boolean;
  createdAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  permissions?: AdminFeaturePermissions;
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

export interface OpenDocument {
  instanceId: string;
  documentId: string | null;
  filePath?: string | null;
  type: 'template' | 'form';
  name: string;
  isDirty: boolean;
  isNew: boolean;
  template?: LabelTemplate;
  form?: DataEntryFormDefinition;
  selectedElementIds: string[];
  dependencies?: BarcodeFlowDocumentFile['dependencies'];
  history: {
    entries: LabelElement[][];
    index: number;
  };
  viewState: {
    zoom: number;
    panX: number;
    panY: number;
  };
  dataState?: {
    connectionId?: string;
    currentRecordIndex: number;
    selectedRecordIndices: number[];
  };
}

export interface BarcodeFlowDocumentFile {
  format: 'BarcodeFlowDocument' | 'BarTenderDocument';
  version: number;
  documentId: string;
  name: string;
  type: 'template' | 'form';
  template?: LabelTemplate;
  form?: DataEntryFormDefinition;
  dataConnections?: any[];
  printerSettings?: any;
  pageSetup?: any;
  dependencies?: {
    fonts: string[];
    images: Array<{ objectId: string; embedded: boolean }>;
    credentialsIncluded: false;
    sampleDataIncluded: boolean;
    warnings: string[];
  };
  metadata?: {
    createdAt?: string;
    updatedAt?: string;
    savedBy?: string;
    appVersion?: string;
  };
}

export interface RecentDocumentEntry {
  id?: string;
  absolutePath?: string;
  displayName?: string;
  filePath: string;
  fileName: string;
  lastOpenedAt: string;
  lastModified?: string;
  fileType?: string;
  fileSize?: number;
  templateName?: string;
}

export interface BarcodeFlowAPI {
  printers: {
    list: () => Promise<any[]>;
    getDefault: () => Promise<any | null>;
    getStatus: (printerName: string) => Promise<any>;
    printDriver: (req: any) => Promise<{ success: boolean; message: string; error?: string; cancelled?: boolean }>;
    printRaw: (req: any) => Promise<{ success: boolean; bytesWritten: number; message: string; error?: string }>;
    testPrint: (req: any) => Promise<{ success: boolean; message: string; error?: string }>;
    openProperties?: (printerName: string) => Promise<{ success: boolean; error?: string }>;
    cancelQueuedJobs?: (printerName: string) => Promise<{ success: boolean; message: string; error?: string }>;
    generatePdf?: (req: {
      htmlContent: string;
      widthMm: number;
      heightMm: number;
      landscape?: boolean;
    }) => Promise<{ success: boolean; base64Data?: string; sizeBytes?: number; error?: string }>;
  };
  database?: {
    detectDependencies: (providerType: string) => Promise<any>;
    testConnection: (config: any) => Promise<any>;
    listDatabases: (config: any) => Promise<any[]>;
    listTables: (config: any) => Promise<any[]>;
    listColumns: (config: any, table?: string) => Promise<any[]>;
    query: (config: any, query: any) => Promise<any>;
    enumerateOleDbProviders: () => Promise<any[]>;
    enumerateOdbcDsns: () => Promise<any[]>;
    enumerateOdbcDrivers: () => Promise<any[]>;
    parseIdoc: (filePath: string, options?: any) => Promise<any>;
    selectIdocFile: () => Promise<any>;
  };
  dataSources?: {
    excel?: {
      selectFile: () => Promise<{ canceled: boolean; filePath?: string; fileName?: string; sizeBytes?: number; lastModified?: string }>;
      locateFile: (oldPath?: string) => Promise<{ canceled: boolean; filePath?: string; fileName?: string; sizeBytes?: number; lastModified?: string }>;
      inspectWorkbook: (payload: { filePath: string; projectDir?: string }) => Promise<any>;
      getSheets: (payload: { filePath: string; projectDir?: string }) => Promise<any>;
      getFields: (payload: { filePath: string; sheetName: string; headerRow?: number; hasHeaders?: boolean; projectDir?: string }) => Promise<any>;
      getPreview: (payload: {
        filePath: string;
        sheetName: string;
        headerRow?: number;
        hasHeaders?: boolean;
        page?: number;
        pageSize?: number;
        projectDir?: string;
        sort?: any;
        filters?: any;
        search?: any;
      }) => Promise<any>;
      getRecords: (payload: {
        filePath: string;
        sheetName: string;
        headerRow?: number;
        hasHeaders?: boolean;
        query?: any;
        projectDir?: string;
      }) => Promise<any>;
      watch: (payload: { filePath: string; connectionId: string; projectDir?: string }) => Promise<boolean>;
      unwatch: (connectionId: string) => Promise<boolean>;
      onFileChanged: (callback: (data: { filePath: string; connectionId: string }) => void) => () => void;
      openLocation: (filePath: string) => Promise<boolean>;
      openFile: (filePath: string) => Promise<boolean>;
    };
  };
}

declare global {
  interface Window {
    barcodeFlow?: BarcodeFlowAPI;
    electronAPI?: any;
  }
}

export * from './formTypes';
