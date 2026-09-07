import { DpiOption } from '../types';

export type PrinterStatus =
  | 'READY'
  | 'OFFLINE'
  | 'PAUSED'
  | 'ERROR'
  | 'PAPER_OUT'
  | 'RIBBON_OUT'
  | 'HEAD_OPEN'
  | 'BUSY'
  | 'UNKNOWN'
  | 'ready'
  | 'offline'
  | 'paused'
  | 'error'
  | 'unknown';

export type ConnectionType =
  | 'windows-driver'
  | 'raw-tcp'
  | 'raw-spooler'
  | 'usb'
  | 'virtual';

export type SupportedRenderer =
  | 'WINDOWS_DRIVER'
  | 'ZPL'
  | 'TSPL'
  | 'EPL'
  | 'CPCL'
  | 'SBPL'
  | 'PDF'
  | 'IMAGE';

export type NativePrinterLanguage =
  | 'ZPL'
  | 'TSPL'
  | 'EPL'
  | 'CPCL'
  | 'SBPL'
  | 'ESC/POS';

export interface PrinterCapabilities {
  color?: boolean;
  duplex?: boolean;
  speedControl?: boolean;
  darknessControl?: boolean;
  gapMedia?: boolean;
  blackMarkMedia?: boolean;
  continuousMedia?: boolean;
  cutter?: boolean;
  peeler?: boolean;
  rfid?: boolean;
  minDpi?: number | null;
  maxDpi?: number | null;
  maxPrintWidthMm?: number;
}

export interface PrinterModel {
  id: string;
  name: string;
  systemName: string;
  displayName?: string;
  manufacturer?: string;
  model?: string;
  driverName?: string;
  port?: string;
  portName?: string;
  connectionType?: ConnectionType;
  isDefault: boolean;
  status: PrinterStatus;
  statusDetails?: string;
  dpi?: number | null;
  nativeLanguages?: NativePrinterLanguage[];
  preferredRenderer?: SupportedRenderer;
  renderer?: SupportedRenderer;
  capabilities?: PrinterCapabilities;
  ipAddress?: string;
  tcpPort?: number;
  isVirtual?: boolean;
}

export type PhysicalUnit = 'mm' | 'inch';

export type LabelShapeType = 'rectangle' | 'rounded' | 'ellipse' | 'circle';

export type PageOrientation = 'portrait' | 'landscape' | 'portrait-180' | 'landscape-180';

export type PrintCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export type PrintDirection = 'horizontal' | 'vertical';

export type StockCategory =
  | 'thermal-roll'
  | 'a4-sheet'
  | 'shipping'
  | 'mrp'
  | 'warehouse'
  | 'pharma'
  | 'custom';

export interface StockPreset {
  id: string;
  name: string;
  category: StockCategory;
  widthMm: number;
  heightMm: number;
  rows: number;
  columns: number;
  horizontalGapMm: number;
  verticalGapMm: number;
  marginTopMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  marginBottomMm: number;
  shape: LabelShapeType;
  cornerRadiusMm?: number;
  description?: string;
  isBuiltIn?: boolean;
  mediaType?: 'gap' | 'continuous' | 'black_mark';
}

export interface DocumentLayoutSetup {
  rows: number;
  columns: number;
  horizontalGap: number;
  verticalGap: number;
  margins: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  printOrder: {
    corner: PrintCorner;
    direction: PrintDirection;
    startPositionIndex: number;
  };
}

export interface DocumentSetup {
  documentId: string;
  name: string;
  units: PhysicalUnit;
  page: {
    width: number;
    height: number;
    orientation: PageOrientation;
    isPrinterDefined?: boolean;
    paperType?: 'custom' | 'a4' | 'a5' | 'letter' | 'roll';
  };
  label: {
    width: number;
    height: number;
    shape: LabelShapeType;
    cornerRadius?: number;
  };
  layout: DocumentLayoutSetup;
  printerProfileId?: string;
  selectedPrinterName?: string;
  dpi: number;
  preferredRenderer: SupportedRenderer;
  background?: {
    type: 'none' | 'color' | 'picture' | 'template-image';
    color?: string;
    imageUrl?: string;
    showInDesigner: boolean;
    printBackground: boolean;
  };
}

export interface PrintValidationItem {
  type: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  field?: string;
}

export interface PrintValidationResult {
  isValid: boolean;
  errors: PrintValidationItem[];
  warnings: PrintValidationItem[];
}

export type PrintJobLifecycleStatus =
  | 'PENDING'
  | 'PREPARING'
  | 'RENDERING'
  | 'SENDING'
  | 'SUBMITTED_TO_PRINTER'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'PAUSED';

export interface PrintJobModel {
  jobId: string;
  clientRequestId?: string;
  templateId: string;
  templateName: string;
  templateVersion: string;
  printerId: string;
  printerName: string;
  renderer: SupportedRenderer;
  format: string;
  recordsCount: number;
  copiesPerRecord: number;
  serializedCount: number;
  totalLabelsCount: number;
  status: PrintJobLifecycleStatus;
  statusMessage?: string;
  rawPayloadPreview?: string;
  dataSnapshot: Record<string, any>[];
  serializedStartValue?: number;
  quantityColumn?: string;
  recordSelectionMode: 'all' | 'current' | 'selected' | 'range';
  createdAt: string;
  createdBy: string;
  completedAt?: string;
  bytesTransmitted?: number;
  errorMessage?: string;
  reprintCount?: number;
  isReprint?: boolean;
  reprintOriginalJobId?: string;
}
