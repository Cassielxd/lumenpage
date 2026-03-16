export type RendererPageCanvasSlot = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | null;
  pageIndex: number | null;
  signature: number | null;
  dprX: number;
  dprY: number;
};

export type RendererPageCacheEntry = {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  width: number;
  height: number;
  dpr: number;
  dprX: number;
  dprY: number;
  dirty: boolean;
  signature: number | null;
  signatureVersion: number | null;
};

const toDevicePixels = (value: number, dpr: number) => Math.max(1, Math.round(value * dpr));

export const pruneRendererPageCache = (
  pageCache: Map<number, RendererPageCacheEntry>,
  pageCount: number
) => {
  for (const key of pageCache.keys()) {
    if (key >= pageCount) {
      pageCache.delete(key);
    }
  }
};

export const touchRendererPageCache = (
  pageCache: Map<number, RendererPageCacheEntry>,
  pageIndex: number,
  entry: RendererPageCacheEntry
) => {
  if (!pageCache.has(pageIndex)) {
    return;
  }
  pageCache.delete(pageIndex);
  pageCache.set(pageIndex, entry);
};

export const enforceRendererPageCacheLimit = (
  pageCache: Map<number, RendererPageCacheEntry>,
  activeSet: Set<number> | null | undefined,
  maxCache: number
) => {
  if (!Number.isFinite(maxCache) || maxCache <= 0) {
    return;
  }

  while (pageCache.size > maxCache) {
    const oldestKey = pageCache.keys().next().value;
    if (oldestKey === undefined) {
      return;
    }
    if (activeSet && activeSet.has(oldestKey)) {
      const entry = pageCache.get(oldestKey);
      if (entry) {
        pageCache.delete(oldestKey);
        pageCache.set(oldestKey, entry);
      }
      continue;
    }
    pageCache.delete(oldestKey);
  }
};

export const ensureRendererCanvasPool = ({
  pageCanvases,
  pageLayer,
  count,
}: {
  pageCanvases: RendererPageCanvasSlot[];
  pageLayer: HTMLElement;
  count: number;
}) => {
  const current = pageCanvases.length;

  if (current < count) {
    for (let index = current; index < count; index += 1) {
      const canvas = document.createElement("canvas");
      canvas.className = "page-canvas";
      canvas.style.position = "absolute";
      canvas.style.left = "0";
      canvas.style.top = "0";
      canvas.style.pointerEvents = "none";
      canvas.style.willChange = "transform";
      pageLayer.appendChild(canvas);
      pageCanvases.push({
        canvas,
        ctx: canvas.getContext("2d") as CanvasRenderingContext2D | null,
        pageIndex: null,
        signature: null,
        dprX: 0,
        dprY: 0,
      });
    }
    return;
  }

  if (current > count) {
    const removed = pageCanvases.splice(count);
    for (const entry of removed) {
      entry.canvas.remove();
    }
  }
};

export const getRendererPageCacheEntry = ({
  pageCache,
  pageIndex,
  layout,
  dpr,
}: {
  pageCache: Map<number, RendererPageCacheEntry>;
  pageIndex: number;
  layout: { pageWidth: number; pageHeight: number };
  dpr: number;
}) => {
  let entry = pageCache.get(pageIndex);
  const width = layout.pageWidth;
  const height = layout.pageHeight;

  if (!entry || entry.width !== width || entry.height !== height || entry.dpr !== dpr) {
    const pixelWidth = toDevicePixels(width, dpr);
    const pixelHeight = toDevicePixels(height, dpr);
    const canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(pixelWidth, pixelHeight)
        : document.createElement("canvas");

    if (!(canvas instanceof OffscreenCanvas)) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    entry = {
      canvas,
      ctx: canvas.getContext("2d") as
        | OffscreenCanvasRenderingContext2D
        | CanvasRenderingContext2D
        | null,
      width,
      height,
      dpr,
      dprX: pixelWidth / Math.max(1, width),
      dprY: pixelHeight / Math.max(1, height),
      dirty: true,
      signature: null,
      signatureVersion: null,
    };
    pageCache.set(pageIndex, entry);
  }

  touchRendererPageCache(pageCache, pageIndex, entry);
  return entry;
};
