import { PrinterModel, SupportedRenderer } from './types';

/**
 * Standard Verified Printer Profiles
 * Rules:
 * - Native languages are only attached to explicitly supported/verified printer models.
 * - Unknown printers or office printers use 'windows-driver' preferred renderer.
 * - Virtual printers allow "Design Without Printer" at 203, 300, 600 DPI.
 */
export const VERIFIED_PRINTER_PROFILES: PrinterModel[] = [
  {
    id: 'virtual-generic-203',
    name: 'Virtual Generic Label Printer (203 DPI)',
    systemName: 'Virtual Generic 203 DPI',
    manufacturer: 'BarcodeFlow Virtual',
    model: 'Generic 203 DPI Industrial',
    connectionType: 'virtual',
    isDefault: false,
    status: 'READY',
    dpi: 203,
    nativeLanguages: ['TSPL', 'ZPL'],
    preferredRenderer: 'WINDOWS_DRIVER',
    isVirtual: true,
    capabilities: {
      color: false,
      duplex: false,
      speedControl: true,
      darknessControl: true,
      gapMedia: true,
      blackMarkMedia: true,
      continuousMedia: true,
      cutter: false,
      peeler: false,
      rfid: false,
      minDpi: 203,
      maxDpi: 203,
      maxPrintWidthMm: 108,
    },
  },
  {
    id: 'virtual-generic-300',
    name: 'Virtual Generic Label Printer (300 DPI)',
    systemName: 'Virtual Generic 300 DPI',
    manufacturer: 'BarcodeFlow Virtual',
    model: 'Generic 300 DPI High-Res',
    connectionType: 'virtual',
    isDefault: false,
    status: 'READY',
    dpi: 300,
    nativeLanguages: ['ZPL', 'TSPL'],
    preferredRenderer: 'WINDOWS_DRIVER',
    isVirtual: true,
    capabilities: {
      color: false,
      duplex: false,
      speedControl: true,
      darknessControl: true,
      gapMedia: true,
      blackMarkMedia: true,
      continuousMedia: true,
      cutter: false,
      peeler: false,
      rfid: false,
      minDpi: 300,
      maxDpi: 300,
      maxPrintWidthMm: 104,
    },
  },
  {
    id: 'virtual-generic-600',
    name: 'Virtual Generic Label Printer (600 DPI Micro)',
    systemName: 'Virtual Generic 600 DPI',
    manufacturer: 'BarcodeFlow Virtual',
    model: 'Generic 600 DPI Micro-UDI',
    connectionType: 'virtual',
    isDefault: false,
    status: 'READY',
    dpi: 600,
    nativeLanguages: ['ZPL'],
    preferredRenderer: 'WINDOWS_DRIVER',
    isVirtual: true,
    capabilities: {
      color: false,
      duplex: false,
      speedControl: true,
      darknessControl: true,
      gapMedia: true,
      blackMarkMedia: true,
      continuousMedia: true,
      cutter: false,
      peeler: false,
      rfid: false,
      minDpi: 600,
      maxDpi: 600,
      maxPrintWidthMm: 104,
    },
  },
  {
    id: 'profile-tsc-te210',
    name: 'TSC TE210 Desktop Thermal (203 DPI)',
    systemName: 'TSC TE210',
    manufacturer: 'TSC Auto ID',
    model: 'TE210',
    driverName: 'TSC TE210',
    connectionType: 'windows-driver',
    isDefault: false,
    status: 'READY',
    dpi: 203,
    nativeLanguages: ['TSPL'],
    preferredRenderer: 'WINDOWS_DRIVER',
    capabilities: {
      color: false,
      duplex: false,
      speedControl: true,
      darknessControl: true,
      gapMedia: true,
      blackMarkMedia: true,
      continuousMedia: true,
      cutter: false,
      peeler: false,
      rfid: false,
      minDpi: 203,
      maxDpi: 203,
      maxPrintWidthMm: 108,
    },
  },
  {
    id: 'profile-tsc-ttp244',
    name: 'TSC TTP-244 Pro Industrial (203 DPI)',
    systemName: 'TSC TTP-244 Pro',
    manufacturer: 'TSC Auto ID',
    model: 'TTP-244 Pro',
    driverName: 'TSC TTP-244 Pro',
    connectionType: 'windows-driver',
    isDefault: false,
    status: 'READY',
    dpi: 203,
    nativeLanguages: ['TSPL', 'EPL'],
    preferredRenderer: 'WINDOWS_DRIVER',
    capabilities: {
      color: false,
      duplex: false,
      speedControl: true,
      darknessControl: true,
      gapMedia: true,
      blackMarkMedia: true,
      continuousMedia: true,
      cutter: false,
      peeler: false,
      rfid: false,
      minDpi: 203,
      maxDpi: 203,
      maxPrintWidthMm: 104,
    },
  },
  {
    id: 'profile-zebra-zd220',
    name: 'Zebra ZD220 Desktop (203 DPI)',
    systemName: 'Zebra ZD220',
    manufacturer: 'Zebra Technologies',
    model: 'ZD220',
    driverName: 'ZDesigner ZD220-203dpi ZPL',
    connectionType: 'windows-driver',
    isDefault: false,
    status: 'READY',
    dpi: 203,
    nativeLanguages: ['ZPL', 'EPL'],
    preferredRenderer: 'WINDOWS_DRIVER',
    capabilities: {
      color: false,
      duplex: false,
      speedControl: true,
      darknessControl: true,
      gapMedia: true,
      blackMarkMedia: true,
      continuousMedia: true,
      cutter: false,
      peeler: false,
      rfid: false,
      minDpi: 203,
      maxDpi: 203,
      maxPrintWidthMm: 104,
    },
  },
  {
    id: 'profile-zebra-zt410',
    name: 'Zebra ZT410 Industrial (300 DPI)',
    systemName: 'Zebra ZT410',
    manufacturer: 'Zebra Technologies',
    model: 'ZT410',
    driverName: 'ZDesigner ZT410-300dpi ZPL',
    connectionType: 'windows-driver',
    isDefault: false,
    status: 'READY',
    dpi: 300,
    nativeLanguages: ['ZPL'],
    preferredRenderer: 'ZPL',
    capabilities: {
      color: false,
      duplex: false,
      speedControl: true,
      darknessControl: true,
      gapMedia: true,
      blackMarkMedia: true,
      continuousMedia: true,
      cutter: true,
      peeler: true,
      rfid: true,
      minDpi: 300,
      maxDpi: 300,
      maxPrintWidthMm: 104,
    },
  },
  {
    id: 'profile-ms-pdf',
    name: 'Microsoft Print to PDF',
    systemName: 'Microsoft Print to PDF',
    manufacturer: 'Microsoft',
    model: 'Print to PDF',
    driverName: 'Microsoft Print To PDF',
    connectionType: 'windows-driver',
    isDefault: false,
    status: 'READY',
    dpi: 300,
    nativeLanguages: [],
    preferredRenderer: 'WINDOWS_DRIVER',
    capabilities: {
      color: true,
      duplex: false,
      speedControl: false,
      darknessControl: false,
      gapMedia: false,
      blackMarkMedia: false,
      continuousMedia: true,
      cutter: false,
      peeler: false,
      rfid: false,
      minDpi: 300,
      maxDpi: 600,
    },
  },
  {
    id: 'profile-zebra-zq520-cpcl',
    name: 'Zebra ZQ520 Mobile (CPCL - 203 DPI)',
    systemName: 'Zebra ZQ520',
    manufacturer: 'Zebra Technologies',
    model: 'ZQ520 Mobile',
    driverName: 'ZDesigner ZQ520 (CPCL)',
    connectionType: 'windows-driver',
    isDefault: false,
    status: 'READY',
    dpi: 203,
    nativeLanguages: ['CPCL'],
    preferredRenderer: 'WINDOWS_DRIVER',
    statusDetails: '🖨 NEEDS PHYSICAL HARDWARE TEST',
    capabilities: {
      color: false,
      duplex: false,
      speedControl: true,
      darknessControl: true,
      gapMedia: true,
      blackMarkMedia: true,
      continuousMedia: true,
      cutter: false,
      peeler: false,
      rfid: false,
      minDpi: 203,
      maxDpi: 203,
      maxPrintWidthMm: 104,
    },
  },
  {
    id: 'profile-sato-cl4nx-sbpl',
    name: 'SATO CL4NX Plus (SBPL - 203 DPI)',
    systemName: 'SATO CL4NX',
    manufacturer: 'SATO Corporation',
    model: 'CL4NX Plus',
    driverName: 'SATO CL4NX Plus 203dpi',
    connectionType: 'windows-driver',
    isDefault: false,
    status: 'READY',
    dpi: 203,
    nativeLanguages: ['SBPL'],
    preferredRenderer: 'WINDOWS_DRIVER',
    statusDetails: '🖨 NEEDS PHYSICAL HARDWARE TEST',
    capabilities: {
      color: false,
      duplex: false,
      speedControl: true,
      darknessControl: true,
      gapMedia: true,
      blackMarkMedia: true,
      continuousMedia: true,
      cutter: true,
      peeler: true,
      rfid: true,
      minDpi: 203,
      maxDpi: 600,
      maxPrintWidthMm: 104,
    },
  },
];

/**
 * Resolves a printer model given system discovery metadata
 */
export function resolvePrinterProfile(
  systemName: string,
  driverName?: string
): Partial<PrinterModel> {
  const lowerName = (systemName || '').toLowerCase();
  const lowerDriver = (driverName || '').toLowerCase();

  // Check user override from localStorage
  const userOverrideKey = `barcodeflow_printer_dpi_${(systemName || '').trim().toLowerCase()}`;
  let userOverrideDpi: number | null = null;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = window.localStorage.getItem(userOverrideKey);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed > 0) {
          userOverrideDpi = parsed;
        }
      }
    } catch {
      // ignore
    }
  }

  // Check matching profile
  for (const p of VERIFIED_PRINTER_PROFILES) {
    if (
      lowerName.includes(p.systemName.toLowerCase()) ||
      (p.driverName && lowerDriver.includes(p.driverName.toLowerCase()))
    ) {
      return { ...p, dpi: userOverrideDpi || p.dpi };
    }
  }

  // TSC detection
  if (lowerName.includes('tsc') || lowerDriver.includes('tsc')) {
    const dpiMatch = (systemName + ' ' + (driverName || '')).match(/(\d{3})\s*dpi/i);
    const dpi = dpiMatch ? parseInt(dpiMatch[1], 10) : userOverrideDpi || null;
    return {
      manufacturer: 'TSC Auto ID',
      dpi,
      nativeLanguages: ['TSPL'],
      preferredRenderer: 'WINDOWS_DRIVER',
      capabilities: {
        color: false,
        duplex: false,
        speedControl: true,
        darknessControl: true,
        gapMedia: true,
        blackMarkMedia: true,
        continuousMedia: true,
        cutter: false,
        peeler: false,
        rfid: false,
        maxPrintWidthMm: 108,
      },
    };
  }

  // Zebra detection
  if (lowerName.includes('zebra') || lowerDriver.includes('zdesigner') || lowerDriver.includes('zpl')) {
    const dpiMatch = (systemName + ' ' + (driverName || '')).match(/(\d{3})\s*dpi/i);
    const dpi = dpiMatch ? parseInt(dpiMatch[1], 10) : userOverrideDpi || null;
    return {
      manufacturer: 'Zebra Technologies',
      dpi,
      nativeLanguages: ['ZPL'],
      preferredRenderer: 'WINDOWS_DRIVER',
      capabilities: {
        color: false,
        duplex: false,
        speedControl: true,
        darknessControl: true,
        gapMedia: true,
        blackMarkMedia: true,
        continuousMedia: true,
        cutter: false,
        peeler: false,
        rfid: false,
        maxPrintWidthMm: 104,
      },
    };
  }

  // SATO detection (SBPL) - 🖨 NEEDS PHYSICAL HARDWARE TEST
  if (lowerName.includes('sato') || lowerDriver.includes('sato')) {
    const dpiMatch = (systemName + ' ' + (driverName || '')).match(/(\d{3})\s*dpi/i);
    const dpi = dpiMatch ? parseInt(dpiMatch[1], 10) : userOverrideDpi || null;
    return {
      manufacturer: 'SATO Corporation',
      dpi,
      nativeLanguages: ['SBPL'],
      preferredRenderer: 'WINDOWS_DRIVER',
      statusDetails: '🖨 NEEDS PHYSICAL HARDWARE TEST',
      capabilities: {
        color: false,
        duplex: false,
        speedControl: true,
        darknessControl: true,
        gapMedia: true,
        blackMarkMedia: true,
        continuousMedia: true,
        cutter: true,
        peeler: true,
        rfid: false,
        maxPrintWidthMm: 104,
      },
    };
  }

  // Standard Windows printer fallback
  return {
    manufacturer: 'Windows Driver',
    dpi: userOverrideDpi || null,
    nativeLanguages: [],
    preferredRenderer: 'WINDOWS_DRIVER',
    capabilities: {
      color: true,
      duplex: false,
      speedControl: false,
      darknessControl: false,
      gapMedia: false,
      blackMarkMedia: false,
      continuousMedia: true,
      cutter: false,
      peeler: false,
      rfid: false,
    },
  };
}
