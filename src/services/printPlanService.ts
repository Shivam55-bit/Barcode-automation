import { LabelTemplate, LabelElement, SheetGridConfig } from '../types';
import { PrinterModel } from '../printer/types';
import { evaluateElementData, EvaluationContext } from './dataSourceEngine';
import { executeDocumentEventScript } from './vbscriptEngine';
import { resolveCalculatedFields } from './calculatedFieldEngine';

export interface PrintPlanItem {
  itemIndex: number; // 0-based global label index
  recordIndex: number; // 0-based dataset row index
  copyIndex: number; // 1-based copy index for this record
  totalCopiesForRecord: number;
  record: Record<string, any>;
  pageIndex: number; // 0-based page index
  slotRow: number; // 0-based row on page
  slotCol: number; // 0-based col on page
  slotIndex: number; // 0-based slot index on this page
  xOffsetMm: number; // Physical mm offset from left edge of page
  yOffsetMm: number; // Physical mm offset from top edge of page
  widthMm: number;
  heightMm: number;
  evaluatedValues: Record<string, string>; // elementId -> evaluated value string
}

export interface PrintPlanPage {
  pageIndex: number;
  pageNumber: number; // 1-based page number
  items: PrintPlanItem[];
  pageWidthMm: number;
  pageHeightMm: number;
  pageSizeName: string;
  orientation: 'portrait' | 'landscape';
  margins: { top: number; left: number; right: number; bottom: number };
  rows: number;
  cols: number;
  gapHorizontal: number;
  gapVertical: number;
}

export interface PrintPlanOptions {
  printer: PrinterModel;
  copies?: number;
  recordsToPrint?: Record<string, any>[];
  recordSelectionMode?: 'all' | 'current' | 'selected' | 'range';
  quantitySource?: 'manual' | 'database_field';
  selectedQtyColumn?: string;
  serializedLabels?: number;
  startingSlot?: number; // 1-based starting slot offset on first page
  effectiveDpi?: number | null;
  jobTitle?: string;
  isTestPrint?: boolean;
  jobId?: string;
  reservationId?: string;
}

export interface PrintPlan {
  documentId: string;
  documentName: string;
  jobId?: string;
  reservationId?: string;
  printer: PrinterModel;
  effectiveDpi: number | null;
  pageSetup: {
    width: number;
    height: number;
    orientation: 'portrait' | 'landscape';
    shape: 'rectangle' | 'rounded-rectangle' | 'ellipse' | 'circle';
    cornerRadius?: number;
    margins: { top: number; left: number; right: number; bottom: number };
    sheetGrid?: {
      rows: number;
      columns: number;
      horizontalGap: number;
      verticalGap: number;
      startCorner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
      printOrder?: 'across-then-down' | 'down-then-across';
      startingSlot?: number;
    };
    pageDimensions?: {
      width: number;
      height: number;
      preset?: string;
    };
    background?: any;
  };
  totalLabels: number;
  totalPages: number;
  items: PrintPlanItem[];
  pages: PrintPlanPage[];
  timestamp: string;
  isTestPrint: boolean;
  documentSnapshot?: LabelTemplate;
  printerSnapshot?: PrinterModel;
}

export const STANDARD_PAGE_SIZES: Record<string, { width: number; height: number; name: string }> = {
  Letter: { width: 215.9, height: 279.4, name: 'Letter' },
  A4: { width: 210, height: 297, name: 'A4' },
  Legal: { width: 215.9, height: 355.6, name: 'Legal' },
  A3: { width: 297, height: 420, name: 'A3' },
  A5: { width: 148, height: 210, name: 'A5' },
};

/**
 * Deterministically generates an immutable print plan from template, printer, and dataset records.
 */
export function createPrintPlan(
  template: LabelTemplate,
  options: PrintPlanOptions
): PrintPlan {
  const {
    printer,
    copies = 1,
    recordsToPrint: propRecords,
    quantitySource = 'manual',
    selectedQtyColumn = '',
    serializedLabels = 1,
    startingSlot: propStartingSlot,
    effectiveDpi = null,
    isTestPrint = false,
  } = options;

  // 1. Resolve Records
  const sourceRecords = propRecords && propRecords.length > 0
    ? propRecords
    : template.databaseConnection?.records && template.databaseConnection.records.length > 0
    ? template.databaseConnection.records
    : [{}];

  const recordsToProcess = isTestPrint ? [sourceRecords[0] || {}] : sourceRecords;
  const eventScripts: Record<string, string> = (template as any).eventScripts || {};

  // Lifecycle Event: OnStartJob
  if (eventScripts.OnStartJob) {
    try {
      executeDocumentEventScript('OnStartJob', eventScripts, {
        printerName: printer?.name,
        jobId: options.jobId,
        totalRecords: recordsToProcess.length,
      });
    } catch (err) {
      console.warn('[EventScript] OnStartJob warning:', err);
    }
  }

  // 2. Expand copies and quantities per record
  const expandedItems: {
    recordIndex: number;
    copyIndex: number;
    totalCopiesForRecord: number;
    record: Record<string, any>;
  }[] = [];

  recordsToProcess.forEach((rawRec, rIdx) => {
    let rec = { ...rawRec };

    // Calculated fields (spec 17/40): ensure derived fields exist at print time so
    // printed output matches canvas exactly. Idempotent when already resolved.
    if (template.calculatedFields && template.calculatedFields.length > 0) {
      rec = resolveCalculatedFields(rec, template.calculatedFields, {
        namedSources: template.namedDataSources
          ? Object.fromEntries(template.namedDataSources.map((n) => [n.name, n.defaultValue]))
          : undefined,
        system: { currentRecordIndex: rIdx, totalRecords: recordsToProcess.length, printerName: printer?.name, jobId: options.jobId },
      });
    }

    // Lifecycle Event: OnNewRecord (mutates or enhances row before formatting)
    if (eventScripts.OnNewRecord) {
      try {
        const evRes = executeDocumentEventScript('OnNewRecord', eventScripts, {
          record: rec,
          currentRecordIndex: rIdx,
          totalRecords: recordsToProcess.length,
          printerName: printer?.name,
          jobId: options.jobId,
        });
        if (evRes.record) {
          rec = { ...rec, ...evRes.record };
        }
      } catch (err) {
        console.warn('[EventScript] OnNewRecord warning:', err);
      }
    }

    let copiesForThisRow = isTestPrint ? 1 : Math.max(1, copies);
    if (!isTestPrint && quantitySource === 'database_field' && selectedQtyColumn) {
      let rawVal = rec[selectedQtyColumn];
      if (rawVal === undefined) {
        const foundKey = Object.keys(rec).find((k) => k.toLowerCase() === selectedQtyColumn.toLowerCase());
        if (foundKey) rawVal = rec[foundKey];
      }
      const parsed = parseInt(String(rawVal ?? '1'), 10);
      copiesForThisRow = (isNaN(parsed) || parsed <= 0 ? 1 : parsed) * Math.max(1, copies);
    }

    const serialMultiplier = isTestPrint ? 1 : Math.max(1, serializedLabels);

    for (let c = 1; c <= copiesForThisRow * serialMultiplier; c++) {
      expandedItems.push({
        recordIndex: rIdx,
        copyIndex: c,
        totalCopiesForRecord: copiesForThisRow * serialMultiplier,
        record: rec,
      });
    }
  });

  // 3. Resolve Sheet Geometry
  const labelWidth = template.dimensions.width;
  const labelHeight = template.dimensions.height;
  const rawOrientation = template.dimensions.orientation || 'portrait';
  const orientation: 'portrait' | 'landscape' =
    rawOrientation.startsWith('landscape') ? 'landscape' : 'portrait';

  const rawGrid = template.sheetGrid as any;
  const sheetGrid = {
    rows: Math.max(1, rawGrid?.rows || 1),
    columns: Math.max(1, rawGrid?.columns || 1),
    horizontalGap: Math.max(0, rawGrid?.gapHorizontal ?? rawGrid?.gapX ?? 0),
    verticalGap: Math.max(0, rawGrid?.gapVertical ?? rawGrid?.gapY ?? 0),
    startCorner: (rawGrid?.startCorner || 'top-left') as any,
    printOrder: (rawGrid?.printOrder || 'across-then-down') as any,
    startingSlot: Math.max(1, rawGrid?.startingSlot || 1),
  };

  const rows = sheetGrid.rows;
  const cols = sheetGrid.columns;
  const slotsPerPage = rows * cols;
  const hGap = sheetGrid.horizontalGap;
  const vGap = sheetGrid.verticalGap;

  const margins = {
    top: template.margins?.top || 0,
    left: template.margins?.left || 0,
    right: template.margins?.right || 0,
    bottom: template.margins?.bottom || 0,
  };
  const marginLeft = margins.left;
  const marginTop = margins.top;

  // 4. Physical Page Dimensions
  const tmplAny = template as any;
  let pageWidth = template.dimensions.width;
  let pageHeight = template.dimensions.height;
  let pageSizeName = `${labelWidth} × ${labelHeight} mm`;

  if (tmplAny.pageDimensions?.width && tmplAny.pageDimensions?.height) {
    pageWidth = tmplAny.pageDimensions.width;
    pageHeight = tmplAny.pageDimensions.height;
    pageSizeName = tmplAny.pageDimensions?.preset || `${pageWidth} × ${pageHeight} mm`;
  } else if (tmplAny.pageSize && STANDARD_PAGE_SIZES[tmplAny.pageSize]) {
    pageWidth = STANDARD_PAGE_SIZES[tmplAny.pageSize].width;
    pageHeight = STANDARD_PAGE_SIZES[tmplAny.pageSize].height;
    pageSizeName = STANDARD_PAGE_SIZES[tmplAny.pageSize].name;
  } else if (rows > 1 || cols > 1) {
    // Multi-up sheet grid defaults to standard Letter
    pageWidth = 215.9; // 8.5 x 11 in
    pageHeight = 279.4;
    pageSizeName = 'Letter';
  } else {
    // Exact single continuous / die-cut label dimensions (e.g. 50 x 25 mm) preserved
    pageWidth = labelWidth;
    pageHeight = labelHeight;
    pageSizeName = `${labelWidth} × ${labelHeight} mm`;
  }

  // 5. Starting Slot offset (1-based slot on first page)
  const startSlot1Based = Math.max(
    1,
    Math.min(slotsPerPage, propStartingSlot !== undefined ? propStartingSlot : sheetGrid.startingSlot || 1)
  );
  const startingSlotOffset = isTestPrint ? 0 : startSlot1Based - 1;

  // 6. Build Slot Ordering Matrix for a page
  const slotPositions: { row: number; col: number }[] = [];
  const printOrder = sheetGrid.printOrder;

  if (printOrder === 'across-then-down') {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        slotPositions.push({ row: r, col: c });
      }
    }
  } else {
    // 'down-then-across'
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        slotPositions.push({ row: r, col: c });
      }
    }
  }

  // 7. Generate PrintPlanItems and PrintPlanPages (High-Performance Single-Pass)
  const items: PrintPlanItem[] = [];
  const pages: PrintPlanPage[] = [];

  let currentGlobalSlot = startingSlotOffset;
  const totalPages = expandedItems.length === 0 ? 1 : Math.max(1, Math.ceil((startingSlotOffset + expandedItems.length) / slotsPerPage));

  // Pre-allocate page structures
  for (let p = 0; p < totalPages; p++) {
    pages.push({
      pageIndex: p,
      pageNumber: p + 1,
      items: [],
      pageWidthMm: pageWidth,
      pageHeightMm: pageHeight,
      pageSizeName,
      orientation,
      margins,
      rows,
      cols,
      gapHorizontal: hGap,
      gapVertical: vGap,
    });
  }

  // Pre-allocated evaluation context
  const baseJobId = options.jobId || `JOB-${Date.now()}`;
  const evalCtx: EvaluationContext = {
    record: sourceRecords[0] || {},
    connectedDataset: template.databaseConnection,
    variables: template.variables,
    namedDataSources: template.namedDataSources,
    elements: template.elements,
    currentRecordIndex: 0,
    totalRecords: sourceRecords.length,
    printerName: printer?.name || 'Default Printer',
    jobId: baseJobId,
    pageNumber: 1,
    copyNumber: 1,
    printIndex: 0,
  };

  const numElements = template.elements.length;

  expandedItems.forEach((expItem, globalIdx) => {
    const pageIndex = Math.floor(currentGlobalSlot / slotsPerPage);
    const slotIndexOnPage = currentGlobalSlot % slotsPerPage;
    const { row, col } = slotPositions[slotIndexOnPage] || { row: 0, col: 0 };

    const xOffsetMm = marginLeft + col * (labelWidth + hGap);
    const yOffsetMm = marginTop + row * (labelHeight + vGap);

    evalCtx.record = expItem.record;
    evalCtx.currentRecordIndex = expItem.recordIndex;
    evalCtx.pageNumber = pageIndex + 1;
    evalCtx.copyNumber = expItem.copyIndex;
    evalCtx.printIndex = globalIdx;

    // Lifecycle Event: OnPrePrint (per label copy execution)
    if (eventScripts.OnPrePrint) {
      try {
        executeDocumentEventScript('OnPrePrint', eventScripts, evalCtx);
      } catch (err) {
        console.warn('[EventScript] OnPrePrint warning:', err);
      }
    }

    // Evaluate template elements
    const evaluatedValues: Record<string, string> = {};
    for (let e = 0; e < numElements; e++) {
      const el = template.elements[e];
      evaluatedValues[el.id] = evaluateElementData(el, evalCtx);
    }

    const planItem: PrintPlanItem = {
      itemIndex: globalIdx,
      recordIndex: expItem.recordIndex,
      copyIndex: expItem.copyIndex,
      totalCopiesForRecord: expItem.totalCopiesForRecord,
      record: expItem.record,
      pageIndex,
      slotRow: row,
      slotCol: col,
      slotIndex: slotIndexOnPage,
      xOffsetMm,
      yOffsetMm,
      widthMm: labelWidth,
      heightMm: labelHeight,
      evaluatedValues,
    };

    items.push(planItem);
    if (pages[pageIndex]) {
      pages[pageIndex].items.push(planItem);
    }
    currentGlobalSlot++;
  });

  const rawShape = template.shape || template.dimensions.shape || 'rectangle';
  const shape: 'rectangle' | 'rounded-rectangle' | 'ellipse' | 'circle' =
    rawShape.includes('round')
      ? 'rounded-rectangle'
      : rawShape === 'circle'
      ? 'circle'
      : rawShape === 'ellipse' || rawShape === 'oval'
      ? 'ellipse'
      : 'rectangle';

  return {
    documentId: template.id,
    documentName: template.name || 'Document1.btw',
    jobId: options.jobId,
    reservationId: options.reservationId,
    printer,
    effectiveDpi,
    pageSetup: {
      width: labelWidth,
      height: labelHeight,
      orientation,
      shape,
      cornerRadius: template.cornerRadius || template.dimensions.cornerRadius,
      margins,
      sheetGrid,
      pageDimensions: {
        width: pageWidth,
        height: pageHeight,
        preset: pageSizeName,
      },
      background: template.background,
    },
    totalLabels: items.length,
    totalPages,
    items,
    pages,
    timestamp: new Date().toISOString(),
    isTestPrint,
    documentSnapshot: JSON.parse(JSON.stringify(template)),
    printerSnapshot: printer ? JSON.parse(JSON.stringify(printer)) : undefined,
  };
}
