import { now } from "../debugTrace";
import { type RendererPageCacheEntry, type RendererPageCanvasSlot } from "./pageCanvasCache";

const alignToDevicePixel = (value: number, dpr: number) => Math.round(value * dpr) / dpr;
const toDevicePixels = (value: number, dpr: number) => Math.max(1, Math.round(value * dpr));

export type PageCompositeState = {
  pageTop: number;
  resized: boolean;
  needsComposite: boolean;
  compositeMs: number;
  canvasDprX: number;
  canvasDprY: number;
};

export const runPageCompositePass = ({
  canvasEntry,
  entry,
  pageIndex,
  layout,
  settings,
  pageX,
  scrollTop,
  dpr,
  pageSpan,
  pageRedrawn,
}: {
  canvasEntry: RendererPageCanvasSlot;
  entry: RendererPageCacheEntry;
  pageIndex: number;
  layout: any;
  settings: any;
  pageX: number;
  scrollTop: number;
  dpr: number;
  pageSpan: number;
  pageRedrawn: boolean;
}): PageCompositeState => {
  const canvas = canvasEntry.canvas;
  const ctx = canvasEntry.ctx;
  const pageTop = alignToDevicePixel(pageIndex * pageSpan - scrollTop, dpr);
  let resized = false;
  const nextWidth = toDevicePixels(layout.pageWidth, dpr);
  const nextHeight = toDevicePixels(layout.pageHeight, dpr);
  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
    resized = true;
  }
  if (canvas.style.width !== `${layout.pageWidth}px`) {
    canvas.style.width = `${layout.pageWidth}px`;
  }
  if (canvas.style.height !== `${layout.pageHeight}px`) {
    canvas.style.height = `${layout.pageHeight}px`;
  }
  const nextLeft = `${pageX}px`;
  const nextTop = `${pageTop}px`;
  if (canvas.style.left !== nextLeft) {
    canvas.style.left = nextLeft;
  }
  if (canvas.style.top !== nextTop) {
    canvas.style.top = nextTop;
  }
  const onPageCanvasStyle = settings?.onPageCanvasStyle;
  if (typeof onPageCanvasStyle === "function") {
    onPageCanvasStyle({ canvas, pageIndex, layout });
  }

  const canvasDprX = canvas.width / Math.max(1, layout.pageWidth);
  const canvasDprY = canvas.height / Math.max(1, layout.pageHeight);

  if (!ctx) {
    return {
      pageTop,
      resized,
      needsComposite: false,
      compositeMs: 0,
      canvasDprX,
      canvasDprY,
    };
  }

  ctx.setTransform(canvasDprX, 0, 0, canvasDprY, 0, 0);

  const needsComposite =
    pageRedrawn ||
    resized ||
    canvasEntry.pageIndex !== pageIndex ||
    canvasEntry.signature !== entry.signature ||
    canvasEntry.dprX !== canvasDprX ||
    canvasEntry.dprY !== canvasDprY;

  if (!needsComposite) {
    return {
      pageTop,
      resized,
      needsComposite,
      compositeMs: 0,
      canvasDprX,
      canvasDprY,
    };
  }

  const compositeStart = settings?.debugPerf ? now() : 0;
  ctx.clearRect(0, 0, layout.pageWidth, layout.pageHeight);
  ctx.drawImage(
    entry.canvas,
    0,
    0,
    entry.canvas.width,
    entry.canvas.height,
    0,
    0,
    entry.width,
    entry.height
  );
  canvasEntry.pageIndex = pageIndex;
  canvasEntry.signature = typeof entry.signature === "number" ? Number(entry.signature) : null;
  canvasEntry.dprX = canvasDprX;
  canvasEntry.dprY = canvasDprY;

  return {
    pageTop,
    resized,
    needsComposite,
    compositeMs: settings?.debugPerf ? now() - compositeStart : 0,
    canvasDprX,
    canvasDprY,
  };
};
