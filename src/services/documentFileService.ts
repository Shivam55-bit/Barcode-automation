import { LabelTemplate, OpenDocument, BarcodeFlowDocumentFile, RecentDocumentEntry } from '../types';

const RECENT_DOCS_KEY = 'barcodeflow_recent_documents_v2';
const MAX_RECENT_DOCS = 10;

/**
 * Serializes an open document into the official BarcodeFlow Document format (.bfl).
 * Persists complete layout, elements, page setup, data bindings, printer metadata, and versioning.
 */
export function serializeBarcodeFlowDocument(doc: OpenDocument, currentUserName: string = 'Operator'): BarcodeFlowDocumentFile {
  const tpl = doc.template;
  const now = new Date().toISOString();

  return {
    format: 'BarcodeFlowDocument',
    version: 1,
    documentId: doc.documentId || tpl?.id || `doc-${Date.now()}`,
    name: doc.name || tpl?.name || 'Untitled Document',
    type: doc.type || 'template',
    template: tpl
      ? {
          ...tpl,
          updatedAt: now,
          createdBy: tpl.createdBy || currentUserName,
        }
      : undefined,
    form: doc.form,
    dataConnections: tpl?.databaseConnection ? [tpl.databaseConnection] : [],
    printerSettings: tpl?.printer || null,
    pageSetup: {
      dimensions: tpl?.dimensions,
      margins: tpl?.margins,
      shape: tpl?.shape,
      cornerRadius: tpl?.cornerRadius,
      sheetGrid: tpl?.sheetGrid,
      mediaType: tpl?.mediaType,
      background: tpl?.background,
      printOrder: tpl?.printOrder,
    },
    metadata: {
      createdAt: tpl?.createdAt || now,
      updatedAt: now,
      savedBy: currentUserName,
      appVersion: '2.5.0',
    },
  };
}

/**
 * Deserializes raw file content (.bfl, .btw, or JSON) into a standard OpenDocument model.
 * Handles both BarcodeFlowDocument format and legacy raw LabelTemplate JSON.
 */
export function deserializeBarcodeFlowDocument(rawData: any, fallbackName: string = 'Opened Document'): {
  template?: LabelTemplate;
  form?: any;
  type: 'template' | 'form';
  name: string;
  documentId: string;
} {
  if (typeof rawData === 'string') {
    try {
      rawData = JSON.parse(rawData);
    } catch (e: any) {
      throw new Error(`Failed to parse document JSON: ${e.message}`);
    }
  }

  if (!rawData || typeof rawData !== 'object') {
    throw new Error('Invalid document format: Expected JSON object');
  }

  // Case 1: Native BarcodeFlow Document (.bfl)
  if (rawData.format === 'BarcodeFlowDocument' || rawData.format === 'BarTenderDocument') {
    if (rawData.version && rawData.version > 1) {
      console.warn(`[DocumentFileService] File version ${rawData.version} is higher than supported version 1. Attempting best-effort parse.`);
    }

    if (rawData.type === 'form' && rawData.form) {
      return {
        type: 'form',
        form: rawData.form,
        name: rawData.name || rawData.form.title || fallbackName,
        documentId: rawData.documentId || rawData.form.id || `form-${Date.now()}`,
      };
    }

    const tpl = rawData.template || {};
    const restoredTemplate: LabelTemplate = {
      id: rawData.documentId || tpl.id || `tmpl-${Date.now()}`,
      name: rawData.name || tpl.name || fallbackName,
      description: tpl.description || 'Imported BarcodeFlow Document',
      category: tpl.category || 'Logistics',
      version: tpl.version || '1.0',
      status: tpl.status || 'draft',
      tags: tpl.tags || ['Desktop File'],
      dimensions: tpl.dimensions || rawData.pageSetup?.dimensions || { width: 100, height: 75, unit: 'mm', dpi: 300, orientation: 'landscape' },
      margins: tpl.margins || rawData.pageSetup?.margins || { top: 2, right: 2, bottom: 2, left: 2, bleed: 1, safeZone: 2 },
      shape: tpl.shape || rawData.pageSetup?.shape || 'rectangle',
      cornerRadius: tpl.cornerRadius || rawData.pageSetup?.cornerRadius || 0,
      sheetGrid: tpl.sheetGrid || rawData.pageSetup?.sheetGrid,
      mediaType: tpl.mediaType || rawData.pageSetup?.mediaType || 'gap',
      background: tpl.background || rawData.pageSetup?.background,
      printOrder: tpl.printOrder || rawData.pageSetup?.printOrder,
      elements: Array.isArray(tpl.elements) ? tpl.elements : [],
      variables: Array.isArray(tpl.variables) ? tpl.variables : [],
      sampleRecords: Array.isArray(tpl.sampleRecords) && tpl.sampleRecords.length > 0 ? tpl.sampleRecords : [{}],
      databaseConnection: tpl.databaseConnection || (rawData.dataConnections && rawData.dataConnections[0]) || undefined,
      printer: tpl.printer || rawData.printerSettings || undefined,
      createdAt: rawData.metadata?.createdAt || tpl.createdAt || new Date().toISOString(),
      updatedAt: rawData.metadata?.updatedAt || tpl.updatedAt || new Date().toISOString(),
      createdBy: rawData.metadata?.savedBy || tpl.createdBy || 'Operator',
    };

    return {
      type: 'template',
      template: restoredTemplate,
      name: restoredTemplate.name,
      documentId: restoredTemplate.id,
    };
  }

  // Case 2: Legacy raw LabelTemplate JSON
  if (rawData.elements && Array.isArray(rawData.elements)) {
    const rawTemplate = rawData as LabelTemplate;
    const restoredTemplate: LabelTemplate = {
      id: rawTemplate.id || `tmpl-${Date.now()}`,
      name: rawTemplate.name || fallbackName,
      description: rawTemplate.description || 'Legacy Template JSON',
      category: rawTemplate.category || 'Logistics',
      version: rawTemplate.version || '1.0',
      status: rawTemplate.status || 'draft',
      tags: rawTemplate.tags || ['Imported'],
      dimensions: rawTemplate.dimensions || { width: 100, height: 75, unit: 'mm', dpi: 300, orientation: 'landscape' },
      margins: rawTemplate.margins || { top: 2, right: 2, bottom: 2, left: 2, bleed: 1, safeZone: 2 },
      shape: rawTemplate.shape || 'rectangle',
      cornerRadius: rawTemplate.cornerRadius || 0,
      sheetGrid: rawTemplate.sheetGrid,
      mediaType: rawTemplate.mediaType || 'gap',
      background: rawTemplate.background,
      printOrder: rawTemplate.printOrder,
      elements: rawTemplate.elements,
      variables: rawTemplate.variables || [],
      sampleRecords: rawTemplate.sampleRecords && rawTemplate.sampleRecords.length > 0 ? rawTemplate.sampleRecords : [{}],
      databaseConnection: rawTemplate.databaseConnection,
      printer: rawTemplate.printer,
      createdAt: rawTemplate.createdAt || new Date().toISOString(),
      updatedAt: rawTemplate.updatedAt || new Date().toISOString(),
      createdBy: rawTemplate.createdBy || 'Operator',
    };

    return {
      type: 'template',
      template: restoredTemplate,
      name: restoredTemplate.name,
      documentId: restoredTemplate.id,
    };
  }

  throw new Error('Unrecognized document format: Missing elements or BarcodeFlow format descriptor');
}

/**
 * Opens native Windows Save As dialog.
 */
export async function promptNativeSaveAsDialog(defaultFileName: string = 'Document1.bfl'): Promise<{
  canceled: boolean;
  filePath?: string;
  fileName?: string;
}> {
  const electronAPI = (window as any).electronAPI;
  if (electronAPI?.showSaveDialog) {
    return await electronAPI.showSaveDialog(defaultFileName);
  }

  // Web Browser fallback
  return { canceled: false, filePath: undefined, fileName: defaultFileName };
}

/**
 * Saves document to disk (via Electron IPC or browser download).
 */
export async function saveDocumentToDisk(
  filePath: string | undefined | null,
  doc: OpenDocument,
  currentUserName: string = 'Operator'
): Promise<{
  success: boolean;
  filePath?: string;
  fileName?: string;
  error?: string;
}> {
  const documentPayload = serializeBarcodeFlowDocument(doc, currentUserName);
  const electronAPI = (window as any).electronAPI;

  if (electronAPI?.saveFile && filePath) {
    const result = await electronAPI.saveFile(filePath, documentPayload);
    if (result.success && result.filePath) {
      addRecentDocument({
        filePath: result.filePath,
        fileName: result.fileName || doc.name,
        lastOpenedAt: new Date().toISOString(),
        templateName: doc.name,
      });
    }
    return result;
  }

  // Browser Fallback (trigger .bfl file download)
  try {
    const jsonStr = JSON.stringify(documentPayload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (doc.name || 'Document1').endsWith('.bfl') ? doc.name : `${doc.name}.bfl`;
    a.href = url;
    a.download = safeName;
    a.click();
    URL.revokeObjectURL(url);
    return { success: true, filePath: undefined, fileName: safeName };
  } catch (err: any) {
    return { success: false, error: err.message || 'Browser export failed' };
  }
}

/**
 * Opens native Windows Open dialog.
 */
export async function promptNativeOpenDialog(): Promise<{
  canceled: boolean;
  filePath?: string;
  fileName?: string;
}> {
  const electronAPI = (window as any).electronAPI;
  if (electronAPI?.showOpenDialog) {
    return await electronAPI.showOpenDialog();
  }

  // Web Browser fallback (will trigger hidden input file picker)
  return { canceled: true };
}

/**
 * Reads document from disk by path.
 */
export async function readDocumentFromDisk(filePath: string): Promise<{
  success: boolean;
  data?: any;
  content?: any;
  filePath?: string;
  fileName?: string;
  error?: string;
}> {
  const electronAPI = (window as any).electronAPI;
  if (electronAPI?.readFile) {
    const result = await electronAPI.readFile(filePath);
    if (result.success && result.document) {
      addRecentDocument(result.filePath || filePath, result.fileName || filePath.split(/[\\/]/).pop() || 'Document.bfl');
      return {
        success: true,
        data: result.document,
        content: result.document,
        filePath: result.filePath || filePath,
        fileName: result.fileName || filePath.split(/[\\/]/).pop() || 'Document.bfl',
      };
    }
    return { success: false, error: result.error || 'Failed to read file from disk' };
  }

  return { success: false, error: 'Desktop file system API not available in browser mode' };
}

/**
 * Checks if a file exists on disk.
 */
export async function checkFileExistsOnDisk(filePath: string): Promise<boolean> {
  const electronAPI = (window as any).electronAPI;
  if (electronAPI?.checkFileExists) {
    return await electronAPI.checkFileExists(filePath);
  }
  return true;
}

/**
 * Opens file location in Windows Explorer / OS file manager.
 */
export async function openFileLocationOnDisk(filePath: string): Promise<boolean> {
  const electronAPI = (window as any).electronAPI;
  if (electronAPI?.openDocumentLocation) {
    return await electronAPI.openDocumentLocation(filePath);
  }
  if (electronAPI?.openExcelLocation) {
    return await electronAPI.openExcelLocation(filePath);
  }
  return false;
}

/**
 * Exits the application cleanly.
 */
export async function exitDesktopApplication(): Promise<void> {
  const electronAPI = (window as any).electronAPI;
  if (electronAPI?.exitApp) {
    await electronAPI.exitApp();
  } else {
    window.close();
  }
}

/**
 * Manages Recent Documents in Local Storage.
 */
export function getRecentDocuments(): RecentDocumentEntry[] {
  try {
    const saved = localStorage.getItem(RECENT_DOCS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('[DocumentFileService] Error reading recent documents:', err);
  }
  return [];
}

export function addRecentDocument(filePathOrEntry: string | RecentDocumentEntry, maybeFileName?: string): RecentDocumentEntry[] {
  try {
    const current = getRecentDocuments();
    const entry: RecentDocumentEntry =
      typeof filePathOrEntry === 'string'
        ? {
            filePath: filePathOrEntry,
            fileName: maybeFileName || filePathOrEntry.split(/[\\/]/).pop() || 'Document.bfl',
            lastOpenedAt: new Date().toISOString(),
          }
        : filePathOrEntry;

    const normalizedPath = entry.filePath.toLowerCase().replace(/\\/g, '/');
    const filtered = current.filter((item) => item.filePath.toLowerCase().replace(/\\/g, '/') !== normalizedPath);
    const updated = [entry, ...filtered].slice(0, MAX_RECENT_DOCS);
    localStorage.setItem(RECENT_DOCS_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('[DocumentFileService] Error saving recent document:', err);
    return getRecentDocuments();
  }
}

export function removeRecentDocument(filePath: string): RecentDocumentEntry[] {
  try {
    const current = getRecentDocuments();
    const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');
    const updated = current.filter((item) => item.filePath.toLowerCase().replace(/\\/g, '/') !== normalizedPath);
    localStorage.setItem(RECENT_DOCS_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('[DocumentFileService] Error removing recent document:', err);
    return getRecentDocuments();
  }
}

export function clearRecentDocuments(): void {
  try {
    localStorage.removeItem(RECENT_DOCS_KEY);
  } catch (err) {
    console.warn('[DocumentFileService] Error clearing recent documents:', err);
  }
}
