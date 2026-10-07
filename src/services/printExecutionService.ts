import { LabelTemplate, PrintCommitPolicy, PrintJobBatch, PrintJobItem, PrinterCodeModifierConfig } from '../types';
import { PrinterModel, SupportedRenderer } from '../printer/types';
import { createPrintPlan, PrintPlan } from './printPlanService';
import { generateWindowsDriverHtml } from '../printing/renderers/windowsDriverRenderer';
import { renderZPL } from '../printing/renderers/zplRenderer';
import { renderTSPL } from '../printing/renderers/tsplRenderer';
import { renderEPL } from '../printing/renderers/eplRenderer';
import { renderCPCL } from '../printing/renderers/cpclRenderer';
import { renderSBPL } from '../printing/renderers/sbplRenderer';
import { exportLabelsToPDF } from './pdfExportService';
import { promptSavePdfFile } from './fileSavePromptService';
import { getTelemetryProvider } from './telemetry/printerTelemetry';
import { AtomicSerialReservationService } from './serializationEngine';
import { executeDocumentEventScript, executeVBScript } from './vbscriptEngine';
import { documentEventDispatcher } from './documentEventDispatcher';

/**
 * Applies Printer Code Modifiers (Prefix, Suffix, Search & Replace rules, and custom scripts)
 * to raw printer code payloads (ZPL, TSPL, EPL, CPCL, SBPL) before spooling or file export.
 */
export function applyPrinterCodeModifiers(
  payload: string,
  config?: PrinterCodeModifierConfig
): string {
  if (!config || !config.enabled) {
    return payload;
  }

  let result = payload;

  // 1. Apply find-and-replace substitutions
  if (config.substitutions && config.substitutions.length > 0) {
    for (const sub of config.substitutions) {
      if (!sub.find) continue;
      try {
        if (sub.isRegex) {
          const regex = new RegExp(sub.find, 'g');
          result = result.replace(regex, sub.replace || '');
        } else {
          result = result.split(sub.find).join(sub.replace || '');
        }
      } catch (err) {
        console.warn('[PrintCodeModifier] Substitution error:', err);
      }
    }
  }

  // 2. Apply custom modifier script (VBScript / JavaScript)
  if (config.customScript && config.customScript.trim()) {
    try {
      if (config.scriptLanguage === 'javascript') {
        const fn = new Function('Value', 'Code', `${config.customScript}; return Value !== undefined ? Value : Code;`);
        const scriptRes = fn(result, result);
        if (scriptRes !== undefined && scriptRes !== null) {
          result = String(scriptRes);
        }
      } else {
        const vbRes = executeVBScript(config.customScript, { Value: result, Code: result });
        if (vbRes.success && vbRes.value !== undefined) {
          result = String(vbRes.value);
        }
      }
    } catch (err) {
      console.warn('[PrintCodeModifier] Script execution error:', err);
    }
  }

  // 3. Prepend prefix if configured
  if (config.prefix) {
    result = config.prefix + result;
  }

  // 4. Append suffix if configured
  if (config.suffix) {
    result = result + config.suffix;
  }

  return result;
}

export interface PrintExecutionOptions {
  document: LabelTemplate;
  printer: PrinterModel;
  copies?: number;
  records?: Record<string, any>[];
  recordSelectionMode?: 'all' | 'current' | 'selected' | 'range';
  quantitySource?: 'manual' | 'database_field';
  selectedQtyColumn?: string;
  serialization?: {
    enabled?: boolean;
    labelsCount?: number;
  };
  pageSetup?: any;
  objectPrintMethods?: any;
  darkness?: number;
  speed?: number;
  dpi?: number;
  rendererOverride?: SupportedRenderer;
  jobTitle?: string;
  cancelQueuedJobsBeforePrint?: boolean;
  startingSlot?: number;
  printToFile?: boolean;
  commitPolicy?: PrintCommitPolicy;
  thermalBatchSize?: number;
  jobId?: string;
  reservationId?: string;
  reprintRemainingOptions?: {
    startIndex: number;
    originalPlanItems?: any[];
  };
}

export interface PrintExecutionResult {
  status: 'submitted' | 'completed' | 'cancelled' | 'failed' | 'PARTIAL';
  printerName: string;
  deviceName: string;
  jobId?: string;
  reservationId?: string;
  error?: string;
  outputType: 'windows-spooler' | 'interactive-driver' | 'raw-spooler' | 'pdf-fallback' | 'file-download';
  bytesWritten?: number;
  pagesPrinted?: number;
  confirmedCount?: number;
  remainingCount?: number;
  filePath?: string;
  durationMs: number;
  timestamp: string;
  batches?: PrintJobBatch[];
  items?: PrintJobItem[];
  commitPolicy?: PrintCommitPolicy;
}

/**
 * Resolves UI display strings (e.g. "Default (currently Export to WPS PDF)") to exact Windows deviceName.
 */
export function resolveExactDeviceName(printer: PrinterModel): string {
  const raw = (printer.deviceName || printer.systemName || printer.name || '').trim();
  if (raw.toLowerCase().startsWith('default (')) {
    const match = raw.match(/^default\s*\((?:currently\s+)?([^)]+)\)$/i);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return raw;
}

/**
 * Unified, enterprise-grade print pipeline service.
 * Dispatches to physical Windows spoolers, virtual PDF drivers, raw language thermal printers,
 * and handles genuine fallback PDF creation without fake toasts or premature state mutation.
 */
export class PrintExecutionService {
  private static instance: PrintExecutionService;

  private constructor() {}

  public static getInstance(): PrintExecutionService {
    if (!PrintExecutionService.instance) {
      PrintExecutionService.instance = new PrintExecutionService();
    }
    return PrintExecutionService.instance;
  }

  /**
   * Executes a print job end-to-end and returns a structured result.
   */
  public async print(options: PrintExecutionOptions): Promise<PrintExecutionResult> {
    const startTime = Date.now();
    const {
      document,
      printer,
      copies = 1,
      records,
      quantitySource = 'manual',
      selectedQtyColumn,
      serialization,
      darkness = 18,
      speed = 4,
      dpi,
      rendererOverride,
      jobTitle = `BarcodeFlow Job: ${document.name || 'Document'}`,
      cancelQueuedJobsBeforePrint = false,
      startingSlot = 1,
      printToFile = false,
    } = options;

    const deviceName = resolveExactDeviceName(printer);
    const effectiveDpi = dpi || printer.dpi || document.dimensions.dpi || 203;

    console.group(`[PrintExecutionService] Job Execution Start: "${jobTitle}"`);
    console.log(`Document: "${document.name}" (ID: ${document.id})`);
    console.log(`Target Printer: "${printer.displayName || printer.name}" -> Resolved OS deviceName: "${deviceName}"`);
    console.log(`Driver: "${printer.driverName || 'N/A'}", Port: "${printer.portName || printer.port || 'N/A'}"`);
    console.log(`Interactive Driver: ${printer.isInteractive ? 'YES' : 'NO'}, Status: ${printer.status}`);
    console.log(`Copies: ${copies}, Serialized: ${serialization?.enabled ? 'YES' : 'NO'}`);

    // 1. Offline Physical Printer Check (Section 14)
    if (!printer.isInteractive && (printer.status === 'OFFLINE' || printer.status === 'ERROR')) {
      console.warn(`[PrintExecutionService] Physical printer "${deviceName}" is OFFLINE or in ERROR state.`);
      console.groupEnd();
      return {
        status: 'failed',
        printerName: printer.name,
        deviceName,
        error: 'PRINTER_UNAVAILABLE',
        outputType: 'windows-spooler',
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }

    // 2. Pre-job Queue Cancellation if requested
    if (cancelQueuedJobsBeforePrint && typeof window !== 'undefined' && window.barcodeFlow?.printers?.cancelQueuedJobs) {
      try {
        console.log(`[PrintExecutionService] Cancelling queued jobs for "${deviceName}"...`);
        await window.barcodeFlow.printers.cancelQueuedJobs(deviceName);
      } catch (err) {
        console.warn('[PrintExecutionService] Pre-job cancel queue warning:', err);
      }
    }

    // 3. Build Single Authoritative Print Plan (Section 21)
    const plan = createPrintPlan(document, {
      printer,
      copies,
      recordsToPrint: records,
      quantitySource,
      selectedQtyColumn,
      serializedLabels: serialization?.enabled && serialization.labelsCount ? serialization.labelsCount : 1,
      startingSlot,
      effectiveDpi,
    });

    console.log(`[PrintExecutionService] PrintPlan assembled: ${plan.totalLabels} label(s), ${plan.totalPages} page(s)`);
    const dispatchedRecords = plan.items.map((it) => it.record);

    // 4. Resolve Target Renderer
    const targetRenderer: SupportedRenderer = rendererOverride || printer.preferredRenderer || 'WINDOWS_DRIVER';

    // Lifecycle Event: OnPrintJobStart
    documentEventDispatcher.dispatch('OnPrintJobStart', document, {
      printerName: printer.name,
      jobId: options.jobId,
      totalRecords: dispatchedRecords.length,
      totalPages: plan.totalPages,
    });

    // 5. Audit "Print to File" Checkbox (Section 26)
    if (printToFile) {
      return await this.handlePrintToFile({
        document,
        plan,
        dispatchedRecords,
        targetRenderer,
        effectiveDpi,
        darkness,
        speed,
        startTime,
        deviceName,
        printerName: printer.name,
      });
    }

    // 6. Native RAW Printing Pipeline (ZPL, TSPL, EPL, CPCL, SBPL)
    const isRawFormat = ['ZPL', 'TSPL', 'EPL', 'CPCL', 'SBPL'].includes(targetRenderer);
    const telemetry = getTelemetryProvider(printer, targetRenderer.toLowerCase());
    const effectivePolicy: PrintCommitPolicy = options.commitPolicy || telemetry.getCommitPolicy(printer, targetRenderer.toLowerCase());

    if (isRawFormat) {
      const batchSize = Math.max(1, options.thermalBatchSize || 10);
      const totalItems = plan.items.length;
      const batches: PrintJobBatch[] = [];
      const items: PrintJobItem[] = plan.items.map((it, idx) => ({
        itemIndex: idx,
        recordIndex: it.recordIndex,
        copyIndex: it.copyIndex,
        serialValue: Object.values(it.evaluatedValues)[0] || '',
        status: 'pending',
      }));

      // Split into batches if batchSize < totalItems
      const needsBatching = totalItems > batchSize && effectivePolicy === 'PER_BATCH';
      const numBatches = needsBatching ? Math.ceil(totalItems / batchSize) : 1;

      for (let b = 0; b < numBatches; b++) {
        const sIdx = b * batchSize;
        const eIdx = Math.min(totalItems, (b + 1) * batchSize);
        const batchRecords = dispatchedRecords.slice(sIdx, eIdx);
        
        let batchPayload = '';
        if (targetRenderer === 'ZPL') {
          batchPayload = renderZPL(document, batchRecords as any, { copies: 1, dpi: effectiveDpi, darkness, speed });
        } else if (targetRenderer === 'TSPL') {
          batchPayload = renderTSPL(document, batchRecords as any, { copies: 1, dpi: effectiveDpi, density: darkness, speed });
        } else if (targetRenderer === 'EPL') {
          batchPayload = renderEPL(document, batchRecords as any, { copies: 1, dpi: effectiveDpi, density: darkness, speed });
        } else if (targetRenderer === 'CPCL') {
          batchPayload = renderCPCL(document, batchRecords as any, { copies: 1, dpi: effectiveDpi, darkness, speed });
        } else if (targetRenderer === 'SBPL') {
          batchPayload = renderSBPL(document, batchRecords as any, { copies: 1, dpi: effectiveDpi, darkness, speed });
        }

        // Apply printer code modifiers if configured
        batchPayload = applyPrinterCodeModifiers(batchPayload, document.codeModifierConfig);

        batches.push({
          batchIndex: b + 1,
          startIndex: sIdx,
          endIndex: eIdx - 1,
          startSerial: items[sIdx]?.serialValue,
          endSerial: items[eIdx - 1]?.serialValue,
          count: eIdx - sIdx,
          status: 'pending',
          rawPayload: batchPayload,
        });
      }

      if (typeof window !== 'undefined' && window.barcodeFlow?.printers?.printRaw) {
        let confirmedPrinted = 0;
        let failedBatchIndex: number | null = null;
        let batchError: string | undefined = undefined;

        for (const batch of batches) {
          batch.status = 'submitting';
          batch.dispatchedAt = new Date().toISOString();
          
          // Lifecycle Event: OnPrePrint
          documentEventDispatcher.dispatch('OnPrePrint', document, {
            printerName: printer.name,
            jobId: options.jobId,
            batchIndex: batch.batchIndex,
            totalBatches: batches.length,
            recordsCount: batch.count,
          });

          try {
            const rawRes = await window.barcodeFlow.printers.printRaw({
              printerName: deviceName,
              rawContent: batch.rawPayload || '',
              format: targetRenderer.toLowerCase(),
              jobTitle: `${jobTitle} (Batch ${batch.batchIndex}/${batches.length})`,
            });

            if (rawRes.success) {
              batch.status = 'printed';
              batch.completedAt = new Date().toISOString();
              confirmedPrinted += batch.count;
              for (let i = batch.startIndex; i <= batch.endIndex; i++) {
                if (items[i]) items[i].status = 'printed';
              }
              // Lifecycle Event: OnPostPrint
              documentEventDispatcher.dispatch('OnPostPrint', document, {
                printerName: printer.name,
                jobId: options.jobId,
                batchIndex: batch.batchIndex,
                totalRecords: confirmedPrinted,
              });
            } else {
              batch.status = 'failed';
              batchError = rawRes.error || 'Raw spooler write failure';
              failedBatchIndex = batch.batchIndex;
              for (let i = batch.startIndex; i <= batch.endIndex; i++) {
                if (items[i]) items[i].status = 'failed';
              }
              break;
            }
          } catch (err: any) {
            batch.status = 'failed';
            batchError = err.message || 'Raw print exception';
            failedBatchIndex = batch.batchIndex;
            break;
          }
        }

        console.groupEnd();
        const isPartial = failedBatchIndex !== null && confirmedPrinted > 0;
        const isFailed = failedBatchIndex !== null && confirmedPrinted === 0;

        // Lifecycle Event: OnPrintJobEnd / OnPrintJobCancel
        if (isFailed) {
          documentEventDispatcher.dispatch('OnPrintJobCancel', document, {
            printerName: printer.name,
            jobId: options.jobId,
            error: batchError,
          });
        } else {
          documentEventDispatcher.dispatch('OnPrintJobEnd', document, {
            printerName: printer.name,
            jobId: options.jobId,
            totalRecords: confirmedPrinted,
            isPartial,
          });
        }

        return {
          status: isPartial ? 'PARTIAL' : isFailed ? 'failed' : 'submitted',
          printerName: printer.name,
          deviceName,
          jobId: options.jobId || `RAW-${Date.now()}`,
          reservationId: options.reservationId,
          error: batchError,
          outputType: 'raw-spooler',
          bytesWritten: batches.reduce((acc, b) => acc + (b.rawPayload?.length || 0), 0),
          pagesPrinted: confirmedPrinted,
          confirmedCount: confirmedPrinted,
          remainingCount: totalItems - confirmedPrinted,
          durationMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          batches,
          items,
          commitPolicy: effectivePolicy,
        };
      }
    }

    // 7. Universal Windows Driver Printing Pipeline (Section 5 & 6)
    // If target printer is a virtual PDF / XPS / WPS / Interactive driver,
    // directly invoke Save As PDF + Auto-Open (matches BarTender behavior)
    const isVirtualOrInteractive =
      printer.isInteractive ||
      deviceName.toLowerCase().includes('pdf') ||
      deviceName.toLowerCase().includes('wps') ||
      deviceName.toLowerCase().includes('onenote');

    if (isVirtualOrInteractive) {
      console.log(`[PrintExecutionService] Target printer "${deviceName}" is an interactive/virtual driver. Invoking Save As PDF + Auto-Open.`);
      console.groupEnd();
      const pdfRes = await this.saveAsPdfFallback(document, dispatchedRecords, 1);
      return {
        ...pdfRes,
        jobId: options.jobId,
        reservationId: options.reservationId,
        confirmedCount: plan.totalLabels,
        remainingCount: 0,
        commitPolicy: 'WHOLE_JOB_ON_DISPATCH',
      };
    }

    // Render clean printable HTML/SVG document containing ONLY label content (no UI, rulers, handles)
    const driverHtml = generateWindowsDriverHtml(document, dispatchedRecords, 1);

    if (typeof window !== 'undefined' && window.barcodeFlow?.printers?.printDriver) {
      console.log(`[PrintExecutionService] Dispatching driver print job to Windows Spooler for "${deviceName}"...`);
      const driverRes = await window.barcodeFlow.printers.printDriver({
        printerName: deviceName,
        htmlContent: driverHtml,
        widthMm: plan.pageSetup.width,
        heightMm: plan.pageSetup.height,
        copies: 1, // Authoritative copy strategy: HTML already contains all expanded pages
        landscape: plan.pageSetup.orientation === 'landscape',
        jobTitle,
      });

      console.groupEnd();

      // Lifecycle Event: OnEndJob
      const eventScripts = (document as any).eventScripts || {};
      if (driverRes.success && eventScripts.OnEndJob) {
        try {
          executeDocumentEventScript('OnEndJob', eventScripts, {
            printerName: printer.name,
            jobId: options.jobId,
            totalRecords: dispatchedRecords.length,
          });
        } catch (e) {
          console.warn('[EventScript] OnEndJob warning:', e);
        }
      }

      return {
        status: driverRes.success ? 'submitted' : (driverRes.cancelled ? 'cancelled' : 'failed'),
        printerName: printer.name,
        deviceName,
        jobId: options.jobId || `GDI-${Date.now()}`,
        reservationId: options.reservationId,
        error: driverRes.error,
        outputType: printer.isInteractive ? 'interactive-driver' : 'windows-spooler',
        pagesPrinted: plan.totalPages,
        confirmedCount: driverRes.success ? plan.totalLabels : 0,
        remainingCount: driverRes.success ? 0 : plan.totalLabels,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        commitPolicy: effectivePolicy,
      };
    }

    // 8. Fallback for Web Browser Environment (Native Save As Dialog / Folder Selection)
    console.log('[PrintExecutionService] Browser environment detected. Prompting destination for PDF export.');
    const pdfBlob = await exportLabelsToPDF(document, dispatchedRecords as any, 1);
    const saveRes = await promptSavePdfFile({
      data: pdfBlob,
      defaultFileName: (document.name || 'BarcodeFlow_Document').replace(/[^a-zA-Z0-9_-]/g, '_'),
    });

    if (saveRes.status === 'cancelled') {
      console.groupEnd();
      return {
        status: 'cancelled',
        printerName: printer.name,
        deviceName: 'PDF File Export',
        outputType: 'pdf-fallback',
        pagesPrinted: 0,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }

    console.groupEnd();
    return {
      status: 'completed',
      printerName: printer.name,
      deviceName: saveRes.filePath || 'Selected Folder',
      filePath: saveRes.filePath || saveRes.fileName,
      outputType: 'pdf-fallback',
      pagesPrinted: plan.totalPages,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Section 12: BarcodeFlow Internal "Save as PDF" Fallback.
   * Invokes native Electron showSavePdfDialog, generates vector PDF, writes verified file to disk.
   */
  public async saveAsPdfFallback(
    document: LabelTemplate,
    records: Record<string, any>[] = [{}],
    copies: number = 1,
    destinationOptions?: { targetFolderHandle?: any; targetFolderPath?: string }
  ): Promise<PrintExecutionResult> {
    const startTime = Date.now();
    const defaultFileName = (document.name || 'Document1').replace(/[^a-zA-Z0-9_-]/g, '_');

    console.log(`[PrintExecutionService] Initiating Save as PDF Fallback for "${defaultFileName}"...`);

    // 1. Prompt user with native Windows Save As dialog in Electron
    if (typeof window !== 'undefined' && window.electronAPI?.showSavePdfDialog) {
      const dialogRes = await window.electronAPI.showSavePdfDialog(defaultFileName, destinationOptions?.targetFolderPath);
      if (dialogRes.canceled || !dialogRes.filePath) {
        console.log('[PrintExecutionService] User canceled Save as PDF dialog.');
        return {
          status: 'cancelled',
          printerName: 'Save as PDF',
          deviceName: 'PDF File Export',
          outputType: 'pdf-fallback',
          pagesPrinted: 0,
          durationMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        };
      }

      const targetPath = dialogRes.filePath;
      console.log(`[PrintExecutionService] Generating PDF for target path: "${targetPath}"...`);

      let base64Data = '';
      const isSheetGrid = Boolean(
        document.sheetGrid?.enabled &&
        (document.sheetGrid.rows > 1 || document.sheetGrid.columns > 1)
      );

      // Determine dimensions in mm
      let widthMm = document.dimensions.width;
      let heightMm = document.dimensions.height;
      if (isSheetGrid) {
        const grid = document.sheetGrid!;
        const rows = Math.max(1, grid.rows || 1);
        const cols = Math.max(1, grid.columns || 1);
        const labelW = grid.labelWidth || widthMm;
        const labelH = grid.labelHeight || heightMm;
        const gapH = grid.gapHorizontal ?? grid.gapX ?? 0;
        const gapV = grid.gapVertical ?? grid.gapY ?? 0;
        const mTop = grid.marginTop ?? document.margins?.top ?? 0;
        const mLeft = grid.marginLeft ?? document.margins?.left ?? 0;
        const mRight = document.margins?.right ?? mLeft;
        const mBottom = document.margins?.bottom ?? mTop;
        const cW = mLeft + mRight + cols * labelW + (cols - 1) * gapH;
        const cH = mTop + mBottom + rows * labelH + (rows - 1) * gapV;
        widthMm = (cW <= 212 && cH <= 299 && (cW > 170 || cH > 240)) ? 210 : cW;
        heightMm = (cW <= 212 && cH <= 299 && (cW > 170 || cH > 240)) ? 297 : cH;
      }

      // Try Chromium printToPDF first (pixel-perfect SVG and multi-up support)
      if (typeof window !== 'undefined' && window.barcodeFlow?.printers?.generatePdf) {
        try {
          const htmlContent = generateWindowsDriverHtml(document, records, copies);
          const pdfRes = await window.barcodeFlow.printers.generatePdf({
            htmlContent,
            widthMm,
            heightMm,
            landscape: document.dimensions.orientation === 'landscape',
          });
          if (pdfRes.success && pdfRes.base64Data) {
            base64Data = pdfRes.base64Data;
          }
        } catch (pdfGenErr) {
          console.warn('[PrintExecutionService] Chromium printToPDF error, falling back to jsPDF:', pdfGenErr);
        }
      }

      // Fallback to jsPDF if printToPDF didn't produce data
      if (!base64Data) {
        const pdfBlob = await exportLabelsToPDF(document, records as any, copies);
        const arrayBuffer = await pdfBlob.arrayBuffer();
        base64Data = this.arrayBufferToBase64(arrayBuffer);
      }

      // 3. Write verified binary file to disk
      const saveRes = await window.electronAPI.saveBinaryFile(targetPath, base64Data);
      if (!saveRes.success || !saveRes.sizeBytes || saveRes.sizeBytes <= 0) {
        return {
          status: 'failed',
          printerName: 'Save as PDF',
          deviceName: 'PDF File Export',
          error: saveRes.error || 'Failed to write PDF file to disk.',
          outputType: 'pdf-fallback',
          durationMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        };
      }

      console.log(`[PrintExecutionService] PDF file successfully written: "${targetPath}" (${saveRes.sizeBytes} bytes)`);

      // 4. Auto-Open Saved PDF in Default System Viewer (e.g. WPS Office / Adobe / Edge)
      try {
        if (window.electronAPI?.openDocumentFile) {
          console.log(`[PrintExecutionService] Automatically opening PDF in system default viewer: "${targetPath}"`);
          await window.electronAPI.openDocumentFile(targetPath);
        }
      } catch (openErr) {
        console.warn('[PrintExecutionService] Auto-open failed:', openErr);
      }

      return {
        status: 'completed',
        printerName: 'Save as PDF',
        deviceName: 'PDF File Export',
        filePath: targetPath,
        bytesWritten: saveRes.sizeBytes,
        outputType: 'pdf-fallback',
        pagesPrinted: records.length * copies,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }

    // Web browser environment: Prompt native Windows Save As dialog / folder picker
    console.log('[PrintExecutionService] Web environment: Prompting user for destination folder/file...');
    const pdfBlob = await exportLabelsToPDF(document, records as any, copies);
    const saveRes = await promptSavePdfFile({
      data: pdfBlob,
      defaultFileName,
      targetFolderHandle: destinationOptions?.targetFolderHandle,
      targetFolderPath: destinationOptions?.targetFolderPath,
    });

    if (saveRes.status === 'cancelled') {
      console.log('[PrintExecutionService] User canceled destination dialog.');
      return {
        status: 'cancelled',
        printerName: 'Save as PDF',
        deviceName: 'PDF File Export',
        outputType: 'pdf-fallback',
        pagesPrinted: 0,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }

    if (saveRes.status === 'failed') {
      return {
        status: 'failed',
        printerName: 'Save as PDF',
        deviceName: 'PDF File Export',
        error: saveRes.error || 'Failed to save PDF to chosen folder.',
        outputType: 'pdf-fallback',
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      status: 'completed',
      printerName: 'Save as PDF',
      deviceName: saveRes.filePath || 'Selected Folder',
      filePath: saveRes.filePath || saveRes.fileName,
      outputType: 'pdf-fallback',
      pagesPrinted: records.length * copies,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Section 28: Test Print (Exact 1 label with controlled test data).
   */
  public async executeTestPrint(
    template: LabelTemplate,
    printer: PrinterModel,
    sampleRecord: Record<string, any> = {}
  ): Promise<PrintExecutionResult> {
    const deviceName = resolveExactDeviceName(printer);
    const testTemplate: LabelTemplate = {
      ...template,
      id: `test-print-${Date.now()}`,
      name: `Printer Test - ${deviceName}`,
      elements: [
        {
          id: 'test-text-title',
          type: 'text',
          text: 'BarcodeFlow Printer Test',
          x: 2,
          y: 2,
          width: Math.max(20, template.dimensions.width - 4),
          height: 5,
          fontSize: 10,
          fontWeight: 'bold',
          color: '#000000',
          visible: true,
          zIndex: 1,
        } as any,
        {
          id: 'test-text-printer',
          type: 'text',
          text: `Printer: ${deviceName}`,
          x: 2,
          y: 8,
          width: Math.max(20, template.dimensions.width - 4),
          height: 4,
          fontSize: 8,
          color: '#333333',
          visible: true,
          zIndex: 2,
        } as any,
        {
          id: 'test-barcode-sample',
          type: 'barcode',
          symbology: 'code128',
          data: '12345678',
          x: 2,
          y: 13,
          width: Math.max(20, template.dimensions.width - 4),
          height: Math.max(8, template.dimensions.height - 18),
          visible: true,
          zIndex: 3,
        } as any,
      ],
    };

    return await this.print({
      document: testTemplate,
      printer,
      copies: 1,
      records: [sampleRecord],
      jobTitle: `[Test Print] ${deviceName}`,
    });
  }

  /**
   * Handles real "Print to File" by opening a Save As dialog and writing output to disk.
   */
  private async handlePrintToFile(params: {
    document: LabelTemplate;
    plan: PrintPlan;
    dispatchedRecords: Record<string, any>[];
    targetRenderer: SupportedRenderer;
    effectiveDpi: number;
    darkness: number;
    speed: number;
    startTime: number;
    deviceName: string;
    printerName: string;
  }): Promise<PrintExecutionResult> {
    const {
      document,
      plan,
      dispatchedRecords,
      targetRenderer,
      effectiveDpi,
      darkness,
      speed,
      startTime,
      deviceName,
      printerName,
    } = params;

    const baseName = (document.name || 'Document1').replace(/[^a-zA-Z0-9_-]/g, '_');

    // 1. Raw Thermal Print to File (.prn, .zpl, .txt)
    if (['ZPL', 'TSPL', 'EPL', 'CPCL', 'SBPL'].includes(targetRenderer)) {
      let code = '';
      let ext = 'prn';
      if (targetRenderer === 'ZPL') {
        code = renderZPL(document, dispatchedRecords as any, { copies: 1, dpi: effectiveDpi, darkness, speed });
        ext = 'zpl';
      } else if (targetRenderer === 'TSPL') {
        code = renderTSPL(document, dispatchedRecords as any, { copies: 1, dpi: effectiveDpi, density: darkness, speed });
        ext = 'txt';
      } else {
        code = renderEPL(document, dispatchedRecords as any, { copies: 1, dpi: effectiveDpi, density: darkness, speed });
      }

      // Apply printer code modifiers
      code = applyPrinterCodeModifiers(code, document.codeModifierConfig);

      if (typeof window !== 'undefined' && window.electronAPI?.showSaveDialog) {
        const dialogRes = await window.electronAPI.showSaveDialog(`${baseName}.${ext}`);
        if (dialogRes.canceled || !dialogRes.filePath) {
          return {
            status: 'cancelled',
            printerName,
            deviceName,
            outputType: 'file-download',
            durationMs: Date.now() - startTime,
            timestamp: new Date().toISOString(),
          };
        }
        await window.electronAPI.saveFile(dialogRes.filePath, code);
        return {
          status: 'completed',
          printerName,
          deviceName,
          filePath: dialogRes.filePath,
          bytesWritten: code.length,
          outputType: 'file-download',
          pagesPrinted: plan.totalPages,
          durationMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        };
      }
    }

    // 2. Windows Driver Print to File -> Save as PDF
    return await this.saveAsPdfFallback(document, dispatchedRecords, 1);
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}
