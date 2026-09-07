import { StockPreset, DocumentLayoutSetup, DocumentSetup } from './types';

/**
 * Built-in BarcodeFlow Stock Presets
 */
export const BUILTIN_STOCK_PRESETS: StockPreset[] = [
  {
    id: 'stock-mrp-50x25',
    name: 'MRP Label — 50 × 25 mm (Industrial Roll)',
    category: 'mrp',
    widthMm: 50,
    heightMm: 25,
    rows: 1,
    columns: 1,
    horizontalGapMm: 0,
    verticalGapMm: 3, // Typical 3mm roll gap
    marginTopMm: 1,
    marginLeftMm: 1,
    marginRightMm: 1,
    marginBottomMm: 1,
    shape: 'rounded',
    cornerRadiusMm: 1.5,
    description: 'Standard retail & pharmaceutical MRP barcode label with 3mm gap pitch',
    isBuiltIn: true,
  },
  {
    id: 'stock-shipping-4x6',
    name: 'Shipping Label — 4" × 6" (101.6 × 152.4 mm)',
    category: 'shipping',
    widthMm: 101.6,
    heightMm: 152.4,
    rows: 1,
    columns: 1,
    horizontalGapMm: 0,
    verticalGapMm: 3.17,
    marginTopMm: 2,
    marginLeftMm: 2,
    marginRightMm: 2,
    marginBottomMm: 2,
    shape: 'rounded',
    cornerRadiusMm: 2,
    description: 'Standard logistics, freight, and e-commerce shipping label (4x6 inch)',
    isBuiltIn: true,
  },
  {
    id: 'stock-shipping-4x3',
    name: 'Logistics Carton — 4" × 3" (101.6 × 76.2 mm)',
    category: 'shipping',
    widthMm: 101.6,
    heightMm: 76.2,
    rows: 1,
    columns: 1,
    horizontalGapMm: 0,
    verticalGapMm: 3,
    marginTopMm: 1.5,
    marginLeftMm: 1.5,
    marginRightMm: 1.5,
    marginBottomMm: 1.5,
    shape: 'rounded',
    cornerRadiusMm: 2,
    description: 'Warehouse carton and crate labeling',
    isBuiltIn: true,
  },
  {
    id: 'stock-product-50x30',
    name: 'Product Label — 50 × 30 mm',
    category: 'mrp',
    widthMm: 50,
    heightMm: 30,
    rows: 1,
    columns: 1,
    horizontalGapMm: 0,
    verticalGapMm: 2.5,
    marginTopMm: 1,
    marginLeftMm: 1,
    marginRightMm: 1,
    marginBottomMm: 1,
    shape: 'rounded',
    cornerRadiusMm: 1.5,
    description: 'General merchandise barcode and price sticker',
    isBuiltIn: true,
  },
  {
    id: 'stock-asset-2x1',
    name: 'Asset Tag — 2" × 1" (50.8 × 25.4 mm)',
    category: 'warehouse',
    widthMm: 50.8,
    heightMm: 25.4,
    rows: 1,
    columns: 1,
    horizontalGapMm: 0,
    verticalGapMm: 3,
    marginTopMm: 1,
    marginLeftMm: 1,
    marginRightMm: 1,
    marginBottomMm: 1,
    shape: 'rounded',
    cornerRadiusMm: 1.5,
    description: 'Fixed asset tracking with DataMatrix or QR code',
    isBuiltIn: true,
  },
  {
    id: 'stock-pharma-vial',
    name: 'Pharma Cleanroom Vial — 38 × 19 mm',
    category: 'pharma',
    widthMm: 38,
    heightMm: 19,
    rows: 1,
    columns: 1,
    horizontalGapMm: 0,
    verticalGapMm: 2,
    marginTopMm: 0.8,
    marginLeftMm: 0.8,
    marginRightMm: 0.8,
    marginBottomMm: 0.8,
    shape: 'rounded',
    cornerRadiusMm: 1,
    description: 'Cryogenic and pharmaceutical vial label with 2D DataMatrix',
    isBuiltIn: true,
  },
  {
    id: 'stock-a4-sheet-65',
    name: 'A4 Sheet — 65 Labels (38.1 × 21.2 mm, 5×13)',
    category: 'a4-sheet',
    widthMm: 38.1,
    heightMm: 21.2,
    rows: 13,
    columns: 5,
    horizontalGapMm: 2.5,
    verticalGapMm: 0,
    marginTopMm: 10.7,
    marginLeftMm: 4.8,
    marginRightMm: 4.8,
    marginBottomMm: 10.7,
    shape: 'rectangle',
    description: 'Standard A4 sheet mini-stickers for laser and inkjet office printers',
    isBuiltIn: true,
  },
  {
    id: 'stock-a4-sheet-24',
    name: 'A4 Sheet — 24 Labels (70 × 37 mm, 3×8)',
    category: 'a4-sheet',
    widthMm: 70,
    heightMm: 37,
    rows: 8,
    columns: 3,
    horizontalGapMm: 0,
    verticalGapMm: 0,
    marginTopMm: 0.5,
    marginLeftMm: 0,
    marginRightMm: 0,
    marginBottomMm: 0.5,
    shape: 'rectangle',
    description: 'Standard 24-up A4 multi-purpose address & barcode labels',
    isBuiltIn: true,
  },
  {
    id: 'stock-a4-sheet-8',
    name: 'A4 Sheet — 8 Shipping Labels (105 × 74 mm, 2×4)',
    category: 'a4-sheet',
    widthMm: 105,
    heightMm: 74.25,
    rows: 4,
    columns: 2,
    horizontalGapMm: 0,
    verticalGapMm: 0,
    marginTopMm: 0,
    marginLeftMm: 0,
    marginRightMm: 0,
    marginBottomMm: 0,
    shape: 'rectangle',
    description: 'Standard 8-up A4 parcel and box shipping labels',
    isBuiltIn: true,
  },
];

const LOCAL_STORAGE_STOCKS_KEY = 'barcodeflow_saved_stocks';

export class MediaService {
  private static instance: MediaService;

  public static getInstance(): MediaService {
    if (!MediaService.instance) {
      MediaService.instance = new MediaService();
    }
    return MediaService.instance;
  }

  public getAllStocks(): StockPreset[] {
    return [...BUILTIN_STOCK_PRESETS, ...this.getCustomStocks()];
  }

  public getStockById(id: string): StockPreset | undefined {
    return this.getAllStocks().find(s => s.id === id);
  }

  public getCustomStocks(): StockPreset[] {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_STOCKS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore parse errors
    }
    return [];
  }

  public saveCustomStock(stock: StockPreset): void {
    const current = this.getCustomStocks().filter((s) => s.id !== stock.id);
    current.push({ ...stock, isBuiltIn: false });
    try {
      localStorage.setItem(LOCAL_STORAGE_STOCKS_KEY, JSON.stringify(current));
    } catch (err) {
      console.warn('Failed to persist custom stock:', err);
    }
  }

  public deleteCustomStock(stockId: string): void {
    const updated = this.getCustomStocks().filter((s) => s.id !== stockId);
    try {
      localStorage.setItem(LOCAL_STORAGE_STOCKS_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('Failed to delete custom stock:', err);
    }
  }

  /**
   * Validates whether a grid of items fits within the physical page bounds
   */
  public validateLayoutFit(
    pageWidthMm: number,
    pageHeightMm: number,
    layout: DocumentLayoutSetup,
    labelWidthMm: number,
    labelHeightMm: number
  ): { fits: boolean; requiredWidthMm: number; requiredHeightMm: number; message?: string } {
    const totalLabelWidth = layout.columns * labelWidthMm;
    const totalGapsX = Math.max(0, layout.columns - 1) * layout.horizontalGap;
    const requiredWidthMm = layout.margins.left + totalLabelWidth + totalGapsX + layout.margins.right;

    const totalLabelHeight = layout.rows * labelHeightMm;
    const totalGapsY = Math.max(0, layout.rows - 1) * layout.verticalGap;
    const requiredHeightMm = layout.margins.top + totalLabelHeight + totalGapsY + layout.margins.bottom;

    const fits = requiredWidthMm <= pageWidthMm + 0.1 && requiredHeightMm <= pageHeightMm + 0.1;

    let message: string | undefined;
    if (!fits) {
      message = `Items exceed page boundary: Layout requires ${requiredWidthMm.toFixed(1)} × ${requiredHeightMm.toFixed(1)} mm, but page is ${pageWidthMm} × ${pageHeightMm} mm.`;
    }

    return {
      fits,
      requiredWidthMm: Number(requiredWidthMm.toFixed(2)),
      requiredHeightMm: Number(requiredHeightMm.toFixed(2)),
      message,
    };
  }

  /**
   * Calculates individual label positions on a sheet in physical mm
   */
  public calculateLabelPositionsOnPage(
    layout: DocumentLayoutSetup,
    labelWidthMm: number,
    labelHeightMm: number
  ): { index: number; row: number; col: number; xMm: number; yMm: number }[] {
    const positions: { index: number; row: number; col: number; xMm: number; yMm: number }[] = [];
    const { rows, columns, horizontalGap, verticalGap, margins, printOrder } = layout;

    const totalItems = rows * columns;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        // Calculate coordinate relative to corner/direction
        const targetRow = printOrder.corner.includes('bottom') ? rows - 1 - r : r;
        const targetCol = printOrder.corner.includes('right') ? columns - 1 - c : c;

        let logicalIndex = 0;
        if (printOrder.direction === 'horizontal') {
          logicalIndex = targetRow * columns + targetCol;
        } else {
          logicalIndex = targetCol * rows + targetRow;
        }

        const xMm = margins.left + targetCol * (labelWidthMm + horizontalGap);
        const yMm = margins.top + targetRow * (labelHeightMm + verticalGap);

        positions.push({
          index: logicalIndex,
          row: targetRow,
          col: targetCol,
          xMm: Number(xMm.toFixed(2)),
          yMm: Number(yMm.toFixed(2)),
        });
      }
    }

    // Sort by logical print index
    return positions.sort((a, b) => a.index - b.index);
  }
}

export const mediaService = new MediaService();
