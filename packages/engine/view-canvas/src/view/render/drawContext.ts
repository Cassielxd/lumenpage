export type DrawContextKind = "canvas-2d" | "leafer-canvas";

// DrawContextV2 is the unified rendering context contract for node renderers,
// decorations and page-level hooks. It intentionally stays close to Canvas2D APIs
// so existing render code can migrate with minimal mechanical changes.
export type DrawContextV2 = {
  kind?: DrawContextKind;
  raw?: unknown;
  canvas?: unknown;
  save: () => void;
  restore: () => void;
  beginPath: () => void;
  closePath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  arcTo: (x1: number, y1: number, x2: number, y2: number, radius: number) => void;
  rect: (x: number, y: number, width: number, height: number) => void;
  roundRect?: (x: number, y: number, width: number, height: number, radii?: number | number[]) => void;
  clip: (...args: any[]) => void;
  fill: (...args: any[]) => void;
  stroke: (...args: any[]) => void;
  clearRect: (x: number, y: number, width: number, height: number) => void;
  fillRect: (x: number, y: number, width: number, height: number) => void;
  strokeRect: (x: number, y: number, width: number, height: number) => void;
  fillText: (text: string, x: number, y: number, maxWidth?: number) => void;
  drawImage: (...args: any[]) => void;
  setTransform: (...args: any[]) => void;
  translate?: (x: number, y: number) => void;
  scale?: (x: number, y: number) => void;
  rotate?: (angle: number) => void;
  fillStyle?: any;
  strokeStyle?: any;
  lineWidth?: number;
  font?: string;
  textBaseline?: string;
  textAlign?: string;
  [key: string]: any;
};

export const asDrawContext = (ctx: any, kind: DrawContextKind = "canvas-2d"): DrawContextV2 => {
  if (!ctx || typeof ctx !== "object") {
    return ctx as DrawContextV2;
  }
  const drawCtx = ctx as DrawContextV2;
  if (!drawCtx.raw) {
    drawCtx.raw = ctx;
  }
  if (!drawCtx.kind) {
    drawCtx.kind = kind;
  }
  return drawCtx;
};
