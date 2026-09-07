import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  // Secure Linked Excel Desktop APIs
  selectExcelFile: (): Promise<{ canceled: boolean; filePath?: string; fileName?: string; sizeBytes?: number; lastModified?: string }> =>
    ipcRenderer.invoke('excel:select-file'),
  locateExcelFile: (oldPath?: string): Promise<{ canceled: boolean; filePath?: string; fileName?: string; sizeBytes?: number; lastModified?: string }> =>
    ipcRenderer.invoke('excel:locate-file', oldPath),
  testExcelConnection: (filePath: string, sheetName?: string): Promise<{ success: boolean; filePath?: string; fileName?: string; sheets?: string[]; sheetCount?: number; selectedSheet?: string; totalRecords?: number; lastModified?: string; sizeBytes?: number; error?: string; errorCode?: string; pathChecked?: string }> =>
    ipcRenderer.invoke('excel:test-connection', { filePath, sheetName }),
  readExcelWorkbook: (filePath: string, sheetName?: string, headerRow?: number): Promise<{ success: boolean; sheetNames?: string[]; selectedSheet?: string; columns?: string[]; records?: Record<string, any>[]; previewRows?: Record<string, any>[]; totalRecords?: number; lastModified?: string; sizeBytes?: number; error?: string }> =>
    ipcRenderer.invoke('excel:read-workbook', { filePath, sheetName, headerRow }),
  openExcelLocation: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('excel:open-location', filePath),
  openExcelFile: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('excel:open-file', filePath),
  watchExcelFile: (filePath: string, datasetId: string): Promise<boolean> =>
    ipcRenderer.invoke('excel:watch-file', { filePath, datasetId }),
  unwatchExcelFile: (datasetId: string): Promise<boolean> =>
    ipcRenderer.invoke('excel:unwatch-file', datasetId),
  onExcelFileChanged: (callback: (data: { filePath: string; datasetId: string }) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on('excel:file-changed', listener);
    return () => {
      ipcRenderer.removeListener('excel:file-changed', listener);
    };
  },
});

contextBridge.exposeInMainWorld('barcodeFlow', {
  printers: {
    list: (): Promise<any[]> => ipcRenderer.invoke('printers:list'),
    getDefault: (): Promise<any | null> => ipcRenderer.invoke('printers:get-default'),
    getStatus: (printerName: string): Promise<any> => ipcRenderer.invoke('printers:get-status', printerName),
    printDriver: (req: {
      printerName: string;
      htmlContent: string;
      widthMm: number;
      heightMm: number;
      copies?: number;
      landscape?: boolean;
      jobTitle?: string;
    }): Promise<{ success: boolean; message: string; error?: string }> =>
      ipcRenderer.invoke('printers:print-driver', req),
    printRaw: (req: {
      printerName: string;
      rawContent: string;
      format: string;
      jobTitle?: string;
    }): Promise<{ success: boolean; bytesWritten: number; message: string; error?: string }> =>
      ipcRenderer.invoke('printers:print-raw', req),
    testPrint: (req: {
      printerName: string;
      mode: 'driver' | 'raw';
      payload: any;
    }): Promise<{ success: boolean; message: string; error?: string }> =>
      ipcRenderer.invoke('printers:test-print', req),
    openProperties: (printerName: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('printers:open-properties', printerName),
  },
});

