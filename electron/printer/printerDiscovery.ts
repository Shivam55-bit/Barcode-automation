import { BrowserWindow } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface DetectedSystemPrinter {
  id: string;
  name: string;
  systemName: string;
  displayName: string;
  driverName?: string;
  port?: string;
  portName?: string;
  isDefault: boolean;
  status: 'READY' | 'OFFLINE' | 'PAUSED' | 'ERROR' | 'BUSY' | 'UNKNOWN' | 'ready' | 'offline' | 'paused' | 'error' | 'unknown';
  statusDetails?: string;
  connectionType: 'windows-driver';
  manufacturer?: string;
  model?: string;
  dpi?: number | null;
  nativeLanguages: string[];
  preferredRenderer: 'WINDOWS_DRIVER' | 'ZPL' | 'TSPL' | 'EPL';
  renderer: 'WINDOWS_DRIVER' | 'ZPL' | 'TSPL' | 'EPL';
  capabilities?: {
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
  };
}

/**
 * Discovers real installed Windows printers using Electron WebContents and Windows CIM/Spooler API.
 * Uses Get-CimInstance Win32_Printer for 100% reliable Default, WorkOffline, PortName, and DriverName.
 */
export async function discoverSystemPrinters(
  window?: BrowserWindow | null
): Promise<DetectedSystemPrinter[]> {
  const printerMap = new Map<string, DetectedSystemPrinter>();
  let electronDefaultName: string | null = null;

  // 1. Probe via Electron native getPrintersAsync if window is available
  if (window && !window.isDestroyed()) {
    try {
      const electronPrinters = await window.webContents.getPrintersAsync();
      electronPrinters.forEach((p, idx) => {
        const isDefault = Boolean(p.isDefault);
        if (isDefault) {
          electronDefaultName = p.name;
        }
        const statusStr = p.status === 0 ? 'READY' : p.status === 3 ? 'READY' : 'UNKNOWN';

        const detected = buildDetectedPrinterFromMeta({
          id: `prn-win-${idx + 1}`,
          name: p.name,
          driverName: p.description || p.name,
          isDefault,
          status: statusStr,
        });

        printerMap.set(p.name.trim().toLowerCase(), detected);
      });
    } catch (err) {
      console.warn('[PrinterDiscovery] Electron getPrintersAsync warning:', err);
    }
  }

  // 2. Query Windows CIM Win32_Printer for enriched driver, port, offline state, and exact Default printer
  if (process.platform === 'win32') {
    try {
      const psCommand = `powershell -NoProfile -NonInteractive -Command "$ProgressPreference = 'SilentlyContinue'; Get-CimInstance Win32_Printer | Select-Object Name, Default, DriverName, PortName, PrinterStatus, WorkOffline | ConvertTo-Json -Compress"`;
      const { stdout } = await execAsync(psCommand);
      if (stdout.trim()) {
        const jsonStart = stdout.indexOf('[');
        const jsonObjStart = stdout.indexOf('{');
        const start = jsonStart !== -1 && (jsonObjStart === -1 || jsonStart < jsonObjStart) ? jsonStart : jsonObjStart;
        const end = Math.max(stdout.lastIndexOf(']'), stdout.lastIndexOf('}'));
        const jsonStr = start !== -1 && end !== -1 && end > start ? stdout.slice(start, end + 1) : stdout.trim();
        const parsed = JSON.parse(jsonStr);
        const list = Array.isArray(parsed) ? parsed : [parsed];

        let hasCimDefault = false;

        list.forEach((p: any, idx: number) => {
          const name = String(p.Name || '').trim();
          if (!name) return;
          const key = name.toLowerCase();

          const isDefault = Boolean(p.Default);
          if (isDefault) hasCimDefault = true;

          const isOffline = Boolean(p.WorkOffline);
          const psStatus: DetectedSystemPrinter['status'] = isOffline
            ? 'OFFLINE'
            : p.PrinterStatus === 1
            ? 'PAUSED'
            : p.PrinterStatus === 2
            ? 'ERROR'
            : 'READY';

          if (printerMap.has(key)) {
            const existing = printerMap.get(key)!;
            existing.driverName = p.DriverName || existing.driverName;
            existing.port = p.PortName || existing.port;
            existing.portName = p.PortName || existing.portName;
            existing.status = psStatus;
            if (isDefault) existing.isDefault = true;
          } else {
            const item = buildDetectedPrinterFromMeta({
              id: `prn-cim-${idx + 1}`,
              name,
              driverName: p.DriverName,
              port: p.PortName,
              isDefault,
              status: psStatus,
            });
            printerMap.set(key, item);
          }
        });

        // If CIM didn't indicate default, use Electron's detected default if available
        if (!hasCimDefault && electronDefaultName) {
          const defaultKey = electronDefaultName.toLowerCase();
          if (printerMap.has(defaultKey)) {
            printerMap.get(defaultKey)!.isDefault = true;
          }
        }
      }
    } catch (err) {
      console.warn('[PrinterDiscovery] PowerShell Get-CimInstance Win32_Printer query error:', err);
    }
  }

  // Ensure ONLY ONE printer is marked default (Priority 1: Win32_Printer Default, Priority 2: Electron isDefault)
  let foundDefault = false;
  printerMap.forEach((printer) => {
    if (printer.isDefault) {
      if (foundDefault) {
        printer.isDefault = false;
      } else {
        foundDefault = true;
      }
    }
  });

  return Array.from(printerMap.values());
}

function buildDetectedPrinterFromMeta(meta: {
  id: string;
  name: string;
  driverName?: string;
  port?: string;
  isDefault: boolean;
  status: DetectedSystemPrinter['status'];
}): DetectedSystemPrinter {
  const lowerName = meta.name.toLowerCase();
  const lowerDriver = (meta.driverName || '').toLowerCase();

  const isTsc = lowerName.includes('tsc') || lowerDriver.includes('tsc');
  const isZebra =
    lowerName.includes('zebra') ||
    lowerDriver.includes('zdesigner') ||
    lowerDriver.includes('zpl');
  const isBrother = lowerName.includes('brother');
  const isPdf = lowerName.includes('pdf') || lowerDriver.includes('pdf');

  let manufacturer: string | undefined = undefined;
  let nativeLanguages: string[] = [];
  let preferredRenderer: DetectedSystemPrinter['preferredRenderer'] = 'WINDOWS_DRIVER';
  let dpi: number | null = null;

  // Extract DPI only if driver name or printer name explicitly specifies it (e.g. 203dpi, 300dpi, 600dpi)
  const dpiMatch = (meta.driverName || meta.name).match(/(\d{3})\s*dpi/i);
  if (dpiMatch) {
    dpi = parseInt(dpiMatch[1], 10);
  }

  if (isTsc) {
    manufacturer = 'TSC Auto ID';
    nativeLanguages = ['TSPL'];
  } else if (isZebra) {
    manufacturer = 'Zebra Technologies';
    nativeLanguages = ['ZPL'];
  } else if (isBrother) {
    manufacturer = 'Brother';
  } else if (isPdf) {
    manufacturer = 'Microsoft / Virtual PDF';
  } else {
    manufacturer = meta.driverName?.split(' ')[0] || undefined;
  }

  return {
    id: meta.id,
    name: meta.name,
    systemName: meta.name,
    displayName: meta.name,
    driverName: meta.driverName,
    port: meta.port,
    portName: meta.port,
    isDefault: meta.isDefault,
    status: meta.status,
    connectionType: 'windows-driver',
    manufacturer,
    model: meta.driverName || meta.name,
    dpi: dpi || null,
    nativeLanguages,
    preferredRenderer,
    renderer: preferredRenderer,
    capabilities: {
      color: isPdf || (!isTsc && !isZebra),
      duplex: false,
      speedControl: isTsc || isZebra,
      darknessControl: isTsc || isZebra,
      gapMedia: isTsc || isZebra,
      blackMarkMedia: isTsc || isZebra,
      continuousMedia: true,
      cutter: false,
      peeler: false,
      rfid: false,
      minDpi: dpi,
      maxDpi: dpi,
      maxPrintWidthMm: isTsc ? 108 : isZebra ? 104 : 215.9,
    },
  };
}
