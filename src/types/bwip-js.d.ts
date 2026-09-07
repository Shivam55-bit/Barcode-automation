declare module 'bwip-js' {
  export interface ToCanvasOptions {
    bcid: string;
    text: string;
    scale?: number;
    height?: number;
    width?: number;
    includetext?: boolean;
    textxalign?: string;
    textsize?: number;
    paddingwidth?: number;
    paddingheight?: number;
    backgroundcolor?: string;
    barcolor?: string;
    rotate?: string;
    [key: string]: any;
  }

  export interface ToSVGOptions extends ToCanvasOptions {
    [key: string]: any;
  }

  export function toCanvas(canvas: HTMLCanvasElement | string, opts: ToCanvasOptions): HTMLCanvasElement;
  export function toSVG(opts: ToSVGOptions): string;
  export function toBuffer(opts: ToCanvasOptions, callback: (err: Error | null, png: Buffer) => void): void;

  const bwipjs: {
    toCanvas: typeof toCanvas;
    toSVG: typeof toSVG;
    toBuffer: typeof toBuffer;
  };

  export default bwipjs;
}
