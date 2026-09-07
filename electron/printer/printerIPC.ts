import { ipcMain, BrowserWindow } from 'electron';
import { exec } from 'child_process';
import { discoverSystemPrinters, DetectedSystemPrinter } from './printerDiscovery';
import { sendRawBytesToWindowsSpooler } from './rawSpooler';

export interface DriverPrintRequest {
  printerName: string;
  htmlContent: string;
  widthMm: number;
  heightMm: number;
  copies?: number;
  landscape?: boolean;
  jobTitle?: string;
}

export interface RawPrintRequest {
  printerName: string;
  rawContent: string;
  format: string;
  jobTitle?: string;
}

export function registerPrinterIpc(getMainWindow: () => BrowserWindow | null) {
  // 1. Enumerate Installed Printers
  ipcMain.handle('printers:list', async () => {
    const mainWindow = getMainWindow();
    return await discoverSystemPrinters(mainWindow);
  });

  // 2. Get Default Printer
  ipcMain.handle('printers:get-default', async () => {
    const mainWindow = getMainWindow();
    const printers = await discoverSystemPrinters(mainWindow);
    return printers.find((p) => p.isDefault) || null;
  });

  // 3. Get Specific Printer Status
  ipcMain.handle('printers:get-status', async (_event, printerName: string) => {
    const mainWindow = getMainWindow();
    const printers = await discoverSystemPrinters(mainWindow);
    const target = printers.find(
      (p) => p.name.toLowerCase() === (printerName || '').trim().toLowerCase()
    );
    if (!target) {
      return { status: 'UNKNOWN', message: 'Printer not found in installed devices.' };
    }
    return {
      status: target.status,
      name: target.name,
      driverName: target.driverName,
      port: target.port,
      isDefault: target.isDefault,
    };
  });

  // 4. Universal Windows Driver Printing via Hidden Electron WebContents
  ipcMain.handle('printers:print-driver', async (_event, req: DriverPrintRequest) => {
    const {
      printerName,
      htmlContent,
      widthMm,
      heightMm,
      copies = 1,
      landscape = false,
      jobTitle = 'BarcodeFlow Label Job',
    } = req;

    console.log(`[PRINT] Requested printer: ${printerName}`);
    console.log(`[PRINT] Windows system printer: ${printerName}`);
    console.log(`[PRINT] Renderer: WINDOWS_DRIVER`);
    console.log(`[PRINT] Job submitted: ${copies} label(s) (${widthMm}×${heightMm} mm)`);

    // Verify printer exists in Windows Spooler
    const mainWindow = getMainWindow();
    const installed = await discoverSystemPrinters(mainWindow);
    const targetPrinter = installed.find(
      (p) => p.name.toLowerCase() === (printerName || '').trim().toLowerCase()
    );

    if (!targetPrinter && printerName !== 'Microsoft Print to PDF') {
      console.warn(`[PRINT] Warning: Target printer "${printerName}" not found in installed devices.`);
      return {
        success: false,
        error: 'PRINTER_NOT_FOUND',
        message: `Printer "${printerName}" not found in Windows spooler.`,
      };
    }

    return new Promise<{ success: boolean; message: string; error?: string }>((resolve) => {
      let printWindow: BrowserWindow | null = new BrowserWindow({
        show: false,
        width: Math.max(800, Math.round(widthMm * 3.78)),
        height: Math.max(600, Math.round(heightMm * 3.78)),
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      });

      printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

      printWindow.webContents.on('did-finish-load', () => {
        if (!printWindow) return;

        // Custom page size in microns (1 mm = 1000 microns)
        const widthMicrons = Math.round(widthMm * 1000);
        const heightMicrons = Math.round(heightMm * 1000);

        const printOptions: any = {
          silent: true,
          printBackground: true,
          deviceName: targetPrinter ? targetPrinter.name : printerName,
          color: true,
          margins: {
            marginType: 'none',
          },
          landscape: Boolean(landscape),
          copies: Math.max(1, copies),
          pageSize: {
            width: widthMicrons,
            height: heightMicrons,
          },
        };

        printWindow.webContents.print(printOptions, (success, failureReason) => {
          if (printWindow) {
            printWindow.destroy();
            printWindow = null;
          }

          if (success) {
            console.log(`[PRINT] Job successfully submitted to spooler for "${printerName}".`);
            resolve({
              success: true,
              message: `Submitted ${copies} label(s) to Windows Spooler for "${printerName}" (${widthMm}×${heightMm} mm).`,
            });
          } else {
            console.error(`[PRINT] Print failure for "${printerName}":`, failureReason);
            resolve({
              success: false,
              error: failureReason,
              message: `Windows driver printing failed: ${failureReason}`,
            });
          }
        });
      });

      printWindow.webContents.on('did-fail-load', (_ev, errCode, errDesc) => {
        if (printWindow) {
          printWindow.destroy();
          printWindow = null;
        }
        resolve({
          success: false,
          error: errDesc,
          message: `Failed to render printable label document (${errCode}): ${errDesc}`,
        });
      });
    });
  });

  // 5. Native Raw Spooler Printing (ZPL, TSPL, EPL, ESC/POS)
  ipcMain.handle('printers:print-raw', async (_event, req: RawPrintRequest) => {
    const { printerName, rawContent, format, jobTitle = 'BarcodeFlow Raw Job' } = req;
    console.log(`[PRINT] Requested printer: ${printerName}`);
    console.log(`[PRINT] Windows system printer: ${printerName}`);
    console.log(`[PRINT] Renderer: RAW (${format.toUpperCase()})`);
    console.log(`[PRINT] Job submitted: ${jobTitle}`);
    return await sendRawBytesToWindowsSpooler(printerName, rawContent, jobTitle);
  });

  // 6. Test Print (Exact 1 Label)
  ipcMain.handle('printers:test-print', async (_event, req: { printerName: string; mode: 'driver' | 'raw'; payload: any }) => {
    const { printerName, mode, payload } = req;
    console.log(`[PRINT] [TEST PRINT] Target: "${printerName}", Mode: ${mode}`);

    // Verify printer exists in Windows Spooler
    const mainWindow = getMainWindow();
    const installed = await discoverSystemPrinters(mainWindow);
    const targetPrinter = installed.find(
      (p) => p.name.toLowerCase() === (printerName || '').trim().toLowerCase()
    );

    if (!targetPrinter && printerName !== 'Microsoft Print to PDF') {
      return {
        success: false,
        error: 'PRINTER_NOT_FOUND',
        message: `Printer "${printerName}" not found in Windows spooler.`,
      };
    }

    if (mode === 'raw') {
      return await sendRawBytesToWindowsSpooler(targetPrinter ? targetPrinter.name : printerName, payload.rawContent, 'BarcodeFlow Test Label');
    } else {
      // Driver mode 1-label test print
      return new Promise((resolve) => {
        let printWindow: BrowserWindow | null = new BrowserWindow({
          show: false,
          width: 600,
          height: 400,
          webPreferences: { nodeIntegration: false, contextIsolation: true },
        });

        printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(payload.htmlContent)}`);
        printWindow.webContents.on('did-finish-load', () => {
          if (!printWindow) return;
          printWindow.webContents.print(
            {
              silent: true,
              printBackground: true,
              deviceName: targetPrinter ? targetPrinter.name : printerName,
              margins: { marginType: 'none' },
              copies: 1,
              pageSize: {
                width: Math.round((payload.widthMm || 50) * 1000),
                height: Math.round((payload.heightMm || 25) * 1000),
              },
            },
            (success, reason) => {
              if (printWindow) {
                printWindow.destroy();
                printWindow = null;
              }
              resolve({
                success,
                message: success
                  ? `Test print label sent to "${printerName}" successfully.`
                  : `Test print failed: ${reason}`,
                error: success ? undefined : reason,
              });
            }
          );
        });
      });
    }
  });

  // 7. Open Real Windows Printer Properties / Preferences Dialog
  ipcMain.handle('printers:open-properties', async (_event, printerName: string) => {
    if (process.platform === 'win32' && printerName) {
      try {
        const safeName = printerName.replace(/"/g, '');
        // printui.dll /e opens Printing Preferences for target printer
        exec(`rundll32.exe printui.dll,PrintUIEntry /e /n "${safeName}"`);
        return { success: true };
      } catch (err: any) {
        console.warn('[PrinterIPC] Error opening printer properties:', err);
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: 'Platform not supported' };
  });
}
