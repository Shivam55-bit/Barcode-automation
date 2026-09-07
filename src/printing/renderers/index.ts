import { LabelTemplate } from '../../types';
import { PrinterModel, SupportedRenderer } from '../../printer/types';
import { generateWindowsDriverHtml } from './windowsDriverRenderer';
import { renderZPL, ZplRenderOptions } from './zplRenderer';
import { renderTSPL, TsplRenderOptions } from './tsplRenderer';
import { renderEPL, EplRenderOptions } from './eplRenderer';
import { renderCPCL, CpclRenderOptions } from './cpclRenderer';
import { renderSBPL, SbplRenderOptions } from './sbplRenderer';
import { exportLabelsToPDF } from '../../services/pdfExportService';

export * from './windowsDriverRenderer';
export * from './zplRenderer';
export * from './tsplRenderer';
export * from './eplRenderer';
export * from './cpclRenderer';
export * from './sbplRenderer';

export interface RenderExecutionOptions {
  copies?: number;
  dpi?: number;
  darkness?: number;
  speed?: number;
  gapMm?: number;
}

export interface RenderOutputResult {
  renderer: SupportedRenderer;
  format: string;
  isNative: boolean;
  driverHtml?: string;
  rawPayload?: string;
  pdfBlob?: Blob;
}

/**
 * Intelligently resolves the most appropriate renderer following Phase 29 rules:
 * 1. User profile override
 * 2. Verified model profile
 * 3. Installed driver characteristics
 * 4. Fallback: Universal Windows Driver mode
 */
export function resolveRenderer(
  printer?: PrinterModel | null,
  userOverrideRenderer?: SupportedRenderer
): SupportedRenderer {
  if (userOverrideRenderer) {
    return userOverrideRenderer;
  }

  if (!printer) {
    return 'WINDOWS_DRIVER';
  }

  // If printer model has preferredRenderer specified (e.g. verified ZPL profile)
  if (printer.preferredRenderer) {
    return printer.preferredRenderer;
  }

  // Fallback is ALWAYS Windows Driver
  return 'WINDOWS_DRIVER';
}

/**
 * Unified render execution entry point
 */
export async function executeRender(
  template: LabelTemplate,
  records: Record<string, any>[] = [{}],
  printer?: PrinterModel | null,
  options: RenderExecutionOptions = {},
  rendererOverride?: SupportedRenderer
): Promise<RenderOutputResult> {
  const targetRenderer = resolveRenderer(printer, rendererOverride);
  const targetDpi = options.dpi || printer?.dpi || template.dimensions.dpi || 203;

  switch (targetRenderer) {
    case 'ZPL': {
      // Native ZPL
      const zplCode = renderZPL(template, records, {
        dpi: targetDpi,
        copies: options.copies || 1,
        darkness: options.darkness,
        speed: options.speed,
      });
      return {
        renderer: 'ZPL',
        format: 'zpl',
        isNative: true,
        rawPayload: zplCode,
      };
    }

    case 'TSPL': {
      // Native TSPL
      const tsplCode = renderTSPL(template, records, {
        dpi: targetDpi,
        copies: options.copies || 1,
        density: options.darkness,
        speed: options.speed,
        gapMm: options.gapMm,
      });
      return {
        renderer: 'TSPL',
        format: 'tspl',
        isNative: true,
        rawPayload: tsplCode,
      };
    }

    case 'EPL': {
      // Native EPL
      const eplCode = renderEPL(template, records, {
        dpi: targetDpi,
        copies: options.copies || 1,
        density: options.darkness,
        speed: options.speed,
      });
      return {
        renderer: 'EPL',
        format: 'epl',
        isNative: true,
        rawPayload: eplCode,
      };
    }

    case 'CPCL': {
      // Native CPCL (mobile/portable) - 🖨 NEEDS PHYSICAL HARDWARE TEST
      const cpclCode = renderCPCL(template, records, {
        dpi: targetDpi,
        copies: options.copies || 1,
        darkness: options.darkness,
        speed: options.speed,
        gapMm: options.gapMm,
      });
      return {
        renderer: 'CPCL',
        format: 'cpcl',
        isNative: true,
        rawPayload: cpclCode,
      };
    }

    case 'SBPL': {
      // Native SBPL (SATO) - 🖨 NEEDS PHYSICAL HARDWARE TEST
      const sbplCode = renderSBPL(template, records, {
        dpi: targetDpi,
        copies: options.copies || 1,
        darkness: options.darkness,
        speed: options.speed,
        gapMm: options.gapMm,
      });
      return {
        renderer: 'SBPL',
        format: 'sbpl',
        isNative: true,
        rawPayload: sbplCode,
      };
    }

    case 'PDF': {
      const pdfBlob = await exportLabelsToPDF(template, records as any, options.copies || 1);
      return {
        renderer: 'PDF',
        format: 'pdf',
        isNative: false,
        pdfBlob,
      };
    }

    case 'WINDOWS_DRIVER':
    default: {
      // Universal Windows Driver HTML/SVG pipeline
      const driverHtml = generateWindowsDriverHtml(template, records, options.copies || 1);
      return {
        renderer: 'WINDOWS_DRIVER',
        format: 'html-driver',
        isNative: false,
        driverHtml,
      };
    }
  }
}
