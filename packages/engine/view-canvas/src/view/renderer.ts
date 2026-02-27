/*
 * 渲染器：负责把分页布局结果绘制到离屏画布，并在前景层绘制选区/装饰/光标。
 * 关键步骤：缓存页签名 -> 仅重绘脏页 -> 合成到可见页画布 -> 绘制覆盖层。
 */

import { getVisiblePages } from "./virtualization";

import { measureTextWidth, getFontSize } from "./measure";
import { type DecorationDrawData } from "./render/decorations";

const now = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

const getLineHeight = (line, layout) =>
  Number.isFinite(line.lineHeight) ? line.lineHeight : layout.lineHeight;

const getBaselineOffset = (lineHeight, fontSize) => Math.max(0, (lineHeight - fontSize) / 2);
const alignToDevicePixel = (value, dpr) => Math.round(value * dpr) / dpr;
const toDevicePixels = (value, dpr) => Math.max(1, Math.round(value * dpr));

const hashNumber = (hash, value) => {
  const num = Number.isFinite(value) ? Math.round(value) : 0;

  return (hash * 31 + num) | 0;
};

const hashString = (hash, value) => {
  if (!value) {
    return hash;
  }

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }

  return hash;
};

const hashObjectLike = (hash, value, cache) => {
  if (!value || typeof value !== "object") {
    return hash;
  }
  if (cache?.has(value)) {
    return hashNumber(hash, cache.get(value) || 0);
  }
  const keys = Object.keys(value).sort();
  let objectHash = 17;
  for (const key of keys) {
    objectHash = hashString(objectHash, key);
    const item = value[key];
    if (typeof item === "string") {
      objectHash = hashString(objectHash, item);
      continue;
    }
    if (typeof item === "number") {
      objectHash = hashNumber(objectHash, item);
      continue;
    }
    if (typeof item === "boolean") {
      objectHash = hashNumber(objectHash, item ? 1 : 0);
      continue;
    }
    if (Array.isArray(item)) {
      objectHash = hashNumber(objectHash, item.length);
      for (const entry of item) {
        if (typeof entry === "string") {
          objectHash = hashString(objectHash, entry);
        } else if (typeof entry === "number") {
          objectHash = hashNumber(objectHash, entry);
        } else if (typeof entry === "boolean") {
          objectHash = hashNumber(objectHash, entry ? 1 : 0);
        } else if (entry == null) {
          objectHash = hashString(objectHash, "null");
        } else {
          objectHash = hashObjectLike(objectHash, entry, cache);
        }
      }
      continue;
    }
    if (item == null) {
      objectHash = hashString(objectHash, "null");
      continue;
    }
    objectHash = hashObjectLike(objectHash, item, cache);
  }
  const signature = objectHash >>> 0;
  cache?.set(value, signature);
  return hashNumber(hash, signature);
};

const resolveSelectionStyle = (settings) => {
  const style = settings?.selectionStyle || {};
  const resolveColor = (value, fallback) => {
    if (value === null || value === false || value === "none" || value === "transparent") {
      return null;
    }
    return value ?? fallback;
  };
  return {
    fill: resolveColor(style.fill, "rgba(191, 219, 254, 0.4)"),
    stroke: resolveColor(style.stroke, "rgba(59, 130, 246, 0.8)"),
    strokeWidth: Number.isFinite(style.strokeWidth) ? style.strokeWidth : 1,
    radius: Number.isFinite(style.radius) ? style.radius : 2,
    inset: Number.isFinite(style.inset) ? style.inset : 0,
  };
};

const drawSelectionRectPath = (ctx, x, y, width, height, radius) => {
  const clampedRadius = Math.min(Math.max(radius, 0), width / 2, height / 2);
  if (clampedRadius > 0 && typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, clampedRadius);
    return;
  }

  if (clampedRadius > 0) {
    ctx.beginPath();
    ctx.moveTo(x + clampedRadius, y);
    ctx.arcTo(x + width, y, x + width, y + height, clampedRadius);
    ctx.arcTo(x + width, y + height, x, y + height, clampedRadius);
    ctx.arcTo(x, y + height, x, y, clampedRadius);
    ctx.arcTo(x, y, x + width, y, clampedRadius);
    ctx.closePath();
    return;
  }

  ctx.beginPath();
  ctx.rect(x, y, width, height);
};

const drawWavyLine = (ctx, x, y, width) => {
  if (!Number.isFinite(width) || width <= 0) {
    return;
  }
  const amplitude = 1.5;
  const wavelength = 4;
  const endX = x + width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let px = x; px <= endX; px += 1) {
    const phase = ((px - x) / wavelength) * Math.PI * 2;
    ctx.lineTo(px, y + Math.sin(phase) * amplitude);
  }
  ctx.stroke();
};

const drawDecorationRects = (ctx, rects) => {
  if (!rects || rects.length === 0) {
    return;
  }
  for (const rect of rects) {
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      continue;
    }
    const spec = rect.decoration?.spec || {};
    if (spec.backgroundColor) {
      ctx.fillStyle = spec.backgroundColor;
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
    if (spec.borderColor && (spec.borderWidth ?? 1) > 0) {
      ctx.strokeStyle = spec.borderColor;
      ctx.lineWidth = Number.isFinite(spec.borderWidth) ? spec.borderWidth : 1;
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }
    if (spec.underline?.color) {
      ctx.strokeStyle = spec.underline.color;
      ctx.lineWidth = 1;
      const underlineY = rect.y + rect.height - 2;
      if (spec.underline.style === "wavy") {
        drawWavyLine(ctx, rect.x, underlineY, rect.width);
      } else {
        ctx.beginPath();
        ctx.moveTo(rect.x, underlineY);
        ctx.lineTo(rect.x + rect.width, underlineY);
        ctx.stroke();
      }
    }
  }
};

const drawDecorationTexts = (ctx, segments) => {
  if (!segments || segments.length === 0) {
    return;
  }
  ctx.textBaseline = "top";
  for (const segment of segments) {
    if (!segment.text) {
      continue;
    }
    ctx.font = segment.font;
    ctx.fillStyle = segment.color;
    ctx.fillText(segment.text, segment.x, segment.y);
  }
};

const drawDecorationWidgets = (ctx, widgets) => {
  if (!widgets || widgets.length === 0) {
    return;
  }
  for (const widget of widgets) {
    const render = widget.decoration?.spec?.render;
    if (typeof render === "function") {
      render(ctx, widget.x, widget.y, widget.height);
    }
  }
};

// 构建表格分页调试信息（只统计可见页）
const buildTablePaginationDebug = (layout, visibleRange) => {
  if (!layout?.pages?.length) {
    return "";
  }
  const lines = [];
  // 仅输出可见页范围，避免页面太多时调试面板刷屏
  const start = typeof visibleRange?.startIndex === "number" ? visibleRange.startIndex : 0;
  const end =
    typeof visibleRange?.endIndex === "number" ? visibleRange.endIndex : layout.pages.length - 1;
  for (let p = start; p <= end; p += 1) {
    if (p < 0 || p >= layout.pages.length) {
      continue;
    }
    const page = layout.pages[p];
    if (!page?.lines?.length) {
      continue;
    }
    // 以 blockStart / blockId 为 key 聚合同一张表格在该页的切片信息
    const groups = new Map();
    for (const line of page.lines) {
      if (line?.blockType !== "table") {
        continue;
      }
      const key =
        line.blockId ?? (Number.isFinite(line.blockStart) ? line.blockStart : (line.start ?? 0));
      if (!groups.has(key)) {
        groups.set(key, {
          blockStart: Number.isFinite(line.blockStart)
            ? line.blockStart
            : Number.isFinite(key)
              ? key
              : null,
          minRow: Number.POSITIVE_INFINITY,
          maxRow: -1,
          rows: null,
          sliceFromPrev: false,
          sliceHasNext: false,
          tableHeight: null,
        });
      }
      const entry = groups.get(key);
      const attrs = line.blockAttrs || {};
      const rowIndex = Number.isFinite(attrs.rowIndex) ? attrs.rowIndex : 0;
      entry.minRow = Math.min(entry.minRow, rowIndex);
      entry.maxRow = Math.max(entry.maxRow, rowIndex);
      if (Number.isFinite(attrs.rows)) {
        entry.rows = attrs.rows;
      }
      // blockAttrs / tableMeta 任意一方标记切片都视作跨页
      if (attrs.tableSliceFromPrev) {
        entry.sliceFromPrev = true;
      }
      if (attrs.tableSliceHasNext) {
        entry.sliceHasNext = true;
      }
      if (line.tableMeta?.continuedFromPrev) {
        entry.sliceFromPrev = true;
      }
      if (line.tableMeta?.continuesAfter) {
        entry.sliceHasNext = true;
      }
      if (Number.isFinite(line.tableMeta?.tableHeight)) {
        entry.tableHeight = line.tableMeta.tableHeight;
      }
    }
    if (groups.size === 0) {
      continue;
    }
    lines.push(`Page ${p + 1}`);
    let index = 1;
    for (const entry of groups.values()) {
      const minRow = Number.isFinite(entry.minRow) ? entry.minRow + 1 : 1;
      const maxRow = Number.isFinite(entry.maxRow) ? entry.maxRow + 1 : minRow;
      const rows = Number.isFinite(entry.rows) ? entry.rows : "?";
      const slice =
        entry.sliceFromPrev || entry.sliceHasNext
          ? `${entry.sliceFromPrev ? "cont" : "start"}-${entry.sliceHasNext ? "cont" : "end"}`
          : "full";
      const height = Number.isFinite(entry.tableHeight)
        ? `, height: ${Math.round(entry.tableHeight)}`
        : "";
      const startInfo = Number.isFinite(entry.blockStart) ? `, start: ${entry.blockStart}` : "";
      lines.push(
        `  Table ${index}: rows ${minRow}-${maxRow} / ${rows}, slice: ${slice}${height}${startInfo}`
      );
      index += 1;
    }
  }
  return lines.join("\n");
};

const buildPaginationDebugSummary = (settings, layout, visibleRange) => {
  const customBuilder =
    settings?.paginationDebugBuilder || settings?.tablePaginationDebugBuilder || null;
  if (typeof customBuilder === "function") {
    const summary = customBuilder(layout, visibleRange, {
      defaultBuilder: buildTablePaginationDebug,
    });
    if (typeof summary === "string") {
      return summary;
    }
  }
  return buildTablePaginationDebug(layout, visibleRange);
};

const resolveChangedRootIndexRange = (changeSummary) => {
  const before = changeSummary?.blocks?.before || {};
  const after = changeSummary?.blocks?.after || {};
  const candidates = [before.fromIndex, before.toIndex, after.fromIndex, after.toIndex].filter(
    (value) => Number.isFinite(value)
  );

  if (candidates.length === 0) {
    return null;
  }

  return {
    min: Math.min(...candidates),
    max: Math.max(...candidates),
  };
};
export class Renderer {
  pageLayer: HTMLElement;
  overlayCanvas: HTMLCanvasElement;
  overlayCtx: CanvasRenderingContext2D;
  settings: any;
  registry: any;
  pageCache: Map<number, any>;
  pageCanvases: Array<{
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    pageIndex: number | null;
    signature: number | null;
    dprX: number;
    dprY: number;
  }>;
  lastDpr: number;
  lastLayoutDebug: string | null;
  nodeViewProvider: ((line: any) => any) | null;
  lastPerfLog: number;
  lastLayoutVersion: number | null;
  lastViewportWidth: number;
  lastViewportHeight: number;

  constructor(pageLayer, overlayCanvas, settings, registry = null) {
    this.pageLayer = pageLayer;

    this.overlayCanvas = overlayCanvas;

    const overlayCtx = overlayCanvas.getContext("2d");

    if (!overlayCtx) {
      throw new Error("Renderer overlay canvas requires 2d context.");
    }

    this.overlayCtx = overlayCtx;

    this.settings = settings;

    this.registry = registry;

    this.pageCache = new Map();

    this.pageCanvases = [];

    this.lastDpr = 1;
    this.lastLayoutDebug = null;

    this.nodeViewProvider = null;
    this.lastPerfLog = 0;
    this.lastLayoutVersion = null;
    this.lastViewportWidth = 0;
    this.lastViewportHeight = 0;
  }

  setNodeViewProvider(provider) {
    this.nodeViewProvider = provider;
    return this;
  }

  /* Page signature cache helper. */
  getPageSignature(page) {
    const layoutVersion =
      page && Number.isFinite(page.__layoutVersionToken) ? Number(page.__layoutVersionToken) : null;
    if (
      page &&
      typeof page.__signature === "number" &&
      (layoutVersion == null ||
        (Number.isFinite(page.__signatureVersion) &&
          Number(page.__signatureVersion) === layoutVersion))
    ) {
      return page.__signature;
    }

    let hash = 0;
    const objectSignatureCache = new WeakMap();

    for (const line of page.lines) {
      hash = hashNumber(hash, line.start);

      hash = hashNumber(hash, line.end);

      hash = hashNumber(hash, line.x);

      hash = hashNumber(hash, line.y);

      hash = hashNumber(hash, line.width);

      hash = hashNumber(hash, line.lineHeight);
      hash = hashNumber(hash, line.blockSignature);

      hash = hashString(hash, line.blockType || "");
      hash = hashString(hash, line.blockId || "");
      hash = hashNumber(hash, line.blockStart);

      hash = hashString(hash, line.text || "");
      hash = hashObjectLike(hash, line.blockAttrs || null, objectSignatureCache);
      hash = hashObjectLike(hash, line.tableMeta || null, objectSignatureCache);

      if (line.runs) {
        for (const run of line.runs) {
          hash = hashNumber(hash, run.start);

          hash = hashNumber(hash, run.end);

          hash = hashString(hash, run.text || "");

          hash = hashString(hash, run.font || "");

          hash = hashString(hash, run.color || "");

          hash = hashNumber(hash, run.underline ? 1 : 0);
        }
      }
    }

    if (page) {
      page.__signature = hash;
      if (layoutVersion != null) {
        page.__signatureVersion = layoutVersion;
      }
    }

    return hash;
  }

  prunePageCache(pageCount) {
    for (const key of this.pageCache.keys()) {
      if (key >= pageCount) {
        this.pageCache.delete(key);
      }
    }
  }

  touchPage(pageIndex, entry) {
    if (!this.pageCache.has(pageIndex)) {
      return;
    }

    this.pageCache.delete(pageIndex);

    this.pageCache.set(pageIndex, entry);
  }

  enforceCacheLimit(activeSet, maxCache) {
    if (!Number.isFinite(maxCache) || maxCache <= 0) {
      return;
    }

    while (this.pageCache.size > maxCache) {
      const oldestKey = this.pageCache.keys().next().value;

      if (oldestKey === undefined) {
        return;
      }

      if (activeSet && activeSet.has(oldestKey)) {
        const entry = this.pageCache.get(oldestKey);

        this.pageCache.delete(oldestKey);

        this.pageCache.set(oldestKey, entry);

        continue;
      }

      this.pageCache.delete(oldestKey);
    }
  }

  ensureCanvasPool(count) {
    const current = this.pageCanvases.length;

    if (current < count) {
      for (let i = current; i < count; i += 1) {
        const canvas = document.createElement("canvas");

        canvas.className = "page-canvas";
        canvas.style.position = "absolute";
        canvas.style.left = "0";
        canvas.style.top = "0";
        canvas.style.pointerEvents = "none";
        canvas.style.willChange = "transform";

        this.pageLayer.appendChild(canvas);

        this.pageCanvases.push({
          canvas,
          ctx: canvas.getContext("2d"),
          pageIndex: null,
          signature: null,
          dprX: 0,
          dprY: 0,
        });
      }
    } else if (current > count) {
      const removed = this.pageCanvases.splice(count);

      for (const entry of removed) {
        entry.canvas.remove();
      }
    }
  }

  getPageCache(pageIndex, layout, dpr) {
    let entry = this.pageCache.get(pageIndex);

    const width = layout.pageWidth;

    const height = layout.pageHeight;

    if (!entry || entry.width != width || entry.height != height || entry.dpr != dpr) {
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

      const ctx = canvas.getContext("2d");

      entry = {
        canvas,

        ctx,

        width,

        height,

        dpr,
        dprX: pixelWidth / Math.max(1, width),
        dprY: pixelHeight / Math.max(1, height),

        dirty: true,

        signature: null,
        signatureVersion: null,
      };

      this.pageCache.set(pageIndex, entry);
    }

    this.touchPage(pageIndex, entry);

    return entry;
  }

  drawLine(ctx, line, pageX, pageTop, layout) {
    const lineHeight = getLineHeight(line, layout);

    if (line.runs && line.runs.length > 0) {
      let cursorX = pageX + line.x;

      for (const run of line.runs) {
        const font = run.font || layout.font;

        const color = run.color || "#111827";

        const fontSize = getFontSize(font);

        const baselineOffset = getBaselineOffset(lineHeight, fontSize);

        const width = typeof run.width === "number" ? run.width : measureTextWidth(font, run.text);

        const shiftY = Number.isFinite(run.shiftY) ? Number(run.shiftY) : 0;

        const textY = pageTop + line.y + baselineOffset + shiftY;

        const background = run.background;

        if (background) {
          const paddingX = 2;
          ctx.fillStyle = background;
          ctx.fillRect(cursorX - paddingX, pageTop + line.y, width + paddingX * 2, lineHeight);
        }

        ctx.font = font;

        ctx.fillStyle = color;

        ctx.fillText(run.text, cursorX, textY);

        if (run.underline && run.text.length > 0) {
          const underlineY = textY + fontSize - 2;

          ctx.strokeStyle = color;

          ctx.lineWidth = 1;

          ctx.beginPath();

          ctx.moveTo(cursorX, underlineY);

          ctx.lineTo(cursorX + width, underlineY);

          ctx.stroke();
        }

        if (run.strike && run.text.length > 0) {
          const strikeY = textY + fontSize * 0.6;

          ctx.strokeStyle = color;

          ctx.lineWidth = 1;

          ctx.beginPath();

          ctx.moveTo(cursorX, strikeY);

          ctx.lineTo(cursorX + width, strikeY);

          ctx.stroke();
        }

        cursorX += width;
      }
    } else {
      const font = layout.font;

      const fontSize = getFontSize(font);

      const baselineOffset = getBaselineOffset(lineHeight, fontSize);

      const textY = pageTop + line.y + baselineOffset;

      ctx.font = font;

      ctx.fillStyle = "#111827";

      ctx.fillText(line.text, pageX + line.x, textY);
    }
  }

  renderPage(pageIndex, layout, entry) {
    const { ctx, width, height, dprX, dprY } = entry;

    const page = layout.pages[pageIndex];

    ctx.setTransform(dprX, 0, 0, dprY, 0, 0);

    ctx.clearRect(0, 0, width, height);

    const renderPageBackground = this.settings?.renderPageBackground;
    let backgroundHandled = false;
    if (typeof renderPageBackground === "function") {
      backgroundHandled =
        renderPageBackground({
          ctx,
          width,
          height,
          pageIndex,
          layout,
          drawDefaultBackground: () => {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, width, height);
            ctx.strokeStyle = "#d1d5db";
            ctx.strokeRect(0, 0, width, height);
          },
        }) === true;
    }
    if (!backgroundHandled) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "#d1d5db";
      ctx.strokeRect(0, 0, width, height);
    }

    const renderPageChrome = this.settings?.renderPageChrome;
    const drawDefaultPageChrome = () => {};
    let chromeHandled = false;
    if (typeof renderPageChrome === "function") {
      chromeHandled =
        renderPageChrome({
          ctx,
          width,
          height,
          pageIndex,
          layout,
          drawDefaultCornerMarks: drawDefaultPageChrome,
        }) === true;
    }
    if (!chromeHandled) {
      drawDefaultPageChrome();
    }

    ctx.textBaseline = "top";

    const defaultRender = (line, pageX, pageTop, layoutRef) =>
      this.drawLine(ctx, line, pageX, pageTop, layoutRef);

    for (const line of page.lines) {
      const containers = line.containers;

      if (containers && this.registry) {
        for (const container of containers) {
          const containerRenderer = this.registry.get(container.type);
          if (containerRenderer?.renderContainer) {
            containerRenderer.renderContainer({
              ctx,
              line,
              pageTop: 0,
              pageX: 0,
              layout,
              container,
              defaultRender,
            });
          }
        }
      }
      const nodeView = this.nodeViewProvider?.(line);
      if (nodeView?.render) {
        nodeView.render({
          ctx,
          line,
          pageTop: 0,
          pageX: 0,
          layout,
          defaultRender,
        });
        continue;
      }

      const renderer = this.registry?.get(line.blockType);

      if (renderer?.renderLine) {
        renderer.renderLine({
          ctx,

          line,

          pageTop: 0,

          pageX: 0,

          layout,

          defaultRender,
        });
      } else {
        defaultRender(line, 0, 0, layout);
      }
    }

    entry.dirty = false;
  }

  /* 锟斤拷锟斤拷染锟斤拷锟斤拷锟斤拷锟斤拷锟斤拷 + 锟斤拷锟斤拷锟斤?锟斤拷锟接诧拷锟斤拷?*/

  render(
    layout,
    viewport,
    caret,
    selectionRects = [],
    blockRects = [],
    decorations: DecorationDrawData | null = null
  ) {
    if (!layout) {
      return;
    }

    const perfStart = this.settings?.debugPerf ? now() : 0;
    let signatureMs = 0;
    let renderPagesMs = 0;
    let compositeMs = 0;
    let overlayMs = 0;

    const layoutVersion = typeof layout.__version === "number" ? layout.__version : null;
    const prevLayoutVersion = this.lastLayoutVersion;
    const layoutVersionChanged = layoutVersion !== prevLayoutVersion;
    const skippedLayoutVersions =
      Number.isFinite(layoutVersion) &&
      Number.isFinite(prevLayoutVersion) &&
      Number(layoutVersion) > Number(prevLayoutVersion) + 1;
    let forceRedraw = !!layout.__forceRedraw || skippedLayoutVersions;
    if (forceRedraw) {
      this.pageCache.clear();
      layout.__forceRedraw = false;
    }
    if (layoutVersionChanged) {
      this.lastLayoutVersion = layoutVersion;
    }
    const { clientWidth, clientHeight, scrollTop } = viewport;
    if (Number.isFinite(layoutVersion) && Array.isArray(layout?.pages)) {
      for (const page of layout.pages) {
        if (page && Number(page.__layoutVersionToken) !== Number(layoutVersion)) {
          page.__layoutVersionToken = Number(layoutVersion);
        }
      }
    }

    const rawDpr = window.devicePixelRatio || 1;
    const dprStrategy = this.settings?.pixelRatioStrategy;
    const dpr = dprStrategy === "integer" ? Math.max(1, Math.ceil(rawDpr)) : rawDpr;

    if (this.lastDpr !== dpr) {
      this.pageCache.clear();

      this.lastDpr = dpr;
    }

    if (clientWidth !== this.lastViewportWidth || clientHeight !== this.lastViewportHeight) {
      this.overlayCanvas.width = toDevicePixels(clientWidth, dpr);
      this.overlayCanvas.height = toDevicePixels(clientHeight, dpr);
      this.overlayCanvas.style.width = `${clientWidth}px`;
      this.overlayCanvas.style.height = `${clientHeight}px`;
      this.lastViewportWidth = clientWidth;
      this.lastViewportHeight = clientHeight;
    }

    const overlayDprX = this.overlayCanvas.width / Math.max(1, clientWidth);
    const overlayDprY = this.overlayCanvas.height / Math.max(1, clientHeight);
    this.overlayCtx.setTransform(overlayDprX, 0, 0, overlayDprY, 0, 0);

    this.overlayCtx.clearRect(0, 0, clientWidth, clientHeight);

    const pageX = alignToDevicePixel(Math.max(0, (clientWidth - layout.pageWidth) / 2), dpr);

    if (this.settings?.debugLayout) {
      const signature = `${clientWidth}|${layout.pageWidth}|${layout.pageAlign}|${layout.pageOffsetX}|${pageX}`;
      if (signature !== this.lastLayoutDebug) {
        this.lastLayoutDebug = signature;
      }
    }

    const pageSpan = layout.pageHeight + layout.pageGap;

    const visible = getVisiblePages(layout, scrollTop, clientHeight);

    const buffer = this.settings.pageBuffer ?? 1;

    const startIndex = Math.max(0, visible.startIndex - buffer);

    const endIndex = Math.min(layout.pages.length - 1, visible.endIndex + buffer);

    const activePages = new Set<number>();

    for (let i = startIndex; i <= endIndex; i += 1) {
      activePages.add(i);
    }
    const tablePanel = this.settings?.tablePaginationPanelEl;
    if (tablePanel) {
      const summary = buildPaginationDebugSummary(this.settings, layout, visible);
      tablePanel.textContent = summary || "No table slices on visible pages.";
    }

    this.prunePageCache(layout.pages.length);

    this.ensureCanvasPool(activePages.size);

    const pageIndices = Array.from(activePages.values());

    pageIndices.sort((a, b) => a - b);

    let redrawCount = 0;
    let cachedPages = 0;
    const changedRange = resolveChangedRootIndexRange(layout.__changeSummary);
    for (let i = 0; i < pageIndices.length; i += 1) {
      const pageIndex = pageIndices[i];

      const entry = this.getPageCache(pageIndex, layout, dpr);
      let pageRedrawn = false;

      let signature = entry.signature;
      const page = layout.pages[pageIndex];
      const currentVersion = Number.isFinite(layoutVersion) ? Number(layoutVersion) : null;
      const entryVersion = Number.isFinite(entry?.signatureVersion)
        ? Number(entry.signatureVersion)
        : null;
      const pageVersion = Number.isFinite(page?.__signatureVersion)
        ? Number(page.__signatureVersion)
        : null;
      const hasEntrySignature =
        typeof signature === "number" && (currentVersion == null || entryVersion === currentVersion);
      const hasPageSignature =
        page &&
        typeof page.__signature === "number" &&
        (currentVersion == null || pageVersion === currentVersion);
      const hasCachedSignature = hasEntrySignature || hasPageSignature;
      const canSkipSignature =
        !forceRedraw &&
        hasCachedSignature &&
        (!layoutVersionChanged ||
          page?.__reused === true ||
          (changedRange &&
            page &&
            Number.isFinite(page.rootIndexMax) &&
            page.rootIndexMax < changedRange.min));

      if (!canSkipSignature) {
        const sigStart = this.settings?.debugPerf ? now() : 0;
        signature = this.getPageSignature(page);
        if (this.settings?.debugPerf) {
          signatureMs += now() - sigStart;
        }
      } else if (signature == null && hasPageSignature) {
        signature = page.__signature;
      }

      if (Number.isFinite(layoutVersion) && Number.isFinite(signature)) {
        entry.signatureVersion = Number(layoutVersion);
      }

      if (forceRedraw || entry.signature !== signature) {
        entry.signature = signature;

        entry.dirty = true;
      }

      if (entry.dirty) {
        redrawCount += 1;
        pageRedrawn = true;
        const renderStart = this.settings?.debugPerf ? now() : 0;
        this.renderPage(pageIndex, layout, entry);
        if (this.settings?.debugPerf) {
          renderPagesMs += now() - renderStart;
        }
      } else {
        cachedPages += 1;
      }

      const canvasEntry = this.pageCanvases[i];

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
      const onPageCanvasStyle = this.settings?.onPageCanvasStyle;
      if (typeof onPageCanvasStyle === "function") {
        onPageCanvasStyle({ canvas, pageIndex, layout });
      }

      const canvasDprX = canvas.width / Math.max(1, layout.pageWidth);
      const canvasDprY = canvas.height / Math.max(1, layout.pageHeight);
      ctx.setTransform(canvasDprX, 0, 0, canvasDprY, 0, 0);

      const needsComposite =
        // Visual-only force redraw can repaint offscreen page while signature remains unchanged.
        // In that case we still must composite to onscreen canvas.
        pageRedrawn ||
        resized ||
        canvasEntry.pageIndex !== pageIndex ||
        canvasEntry.signature !== entry.signature ||
        canvasEntry.dprX !== canvasDprX ||
        canvasEntry.dprY !== canvasDprY;
      if (needsComposite) {
        const compositeStart = this.settings?.debugPerf ? now() : 0;
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
        canvasEntry.signature =
          typeof entry.signature === "number" ? Number(entry.signature) : null;
        canvasEntry.dprX = canvasDprX;
        canvasEntry.dprY = canvasDprY;
        if (this.settings?.debugPerf) {
          compositeMs += now() - compositeStart;
        }
      }
    }

    const maxCache = this.settings.maxPageCache ?? Math.max(activePages.size * 2, 12);

    this.enforceCacheLimit(activePages, maxCache);

    const overlayStart = this.settings?.debugPerf ? now() : 0;
    const decorationData = decorations;
    if (decorationData) {
      drawDecorationRects(this.overlayCtx, decorationData.inlineRects);
      drawDecorationTexts(this.overlayCtx, decorationData.textSegments);
      drawDecorationRects(this.overlayCtx, decorationData.nodeRects);
      drawDecorationWidgets(this.overlayCtx, decorationData.widgets);
    }
    const hasSelectionRects = Array.isArray(selectionRects) && selectionRects.length > 0;
    const hasBlockRects = Array.isArray(blockRects) && blockRects.length > 0;
    const overlayRects = hasSelectionRects ? selectionRects : hasBlockRects ? blockRects : [];

    if (overlayRects && overlayRects.length > 0) {
      const selectionStyle = resolveSelectionStyle(this.settings);
      // 块级高亮（段落/标题激活态）仅保留边框，不做背景填充。
      const isBlockHighlightOnly = !hasSelectionRects && hasBlockRects;
      const hasFill = !isBlockHighlightOnly && !!selectionStyle.fill;
      const hasStroke = !!selectionStyle.stroke && selectionStyle.strokeWidth > 0;

      if (hasFill) {
        this.overlayCtx.fillStyle = selectionStyle.fill;
      }
      if (hasStroke) {
        this.overlayCtx.strokeStyle = selectionStyle.stroke;
        this.overlayCtx.lineWidth = selectionStyle.strokeWidth;
      }

      for (const rect of overlayRects) {
        const inset = selectionStyle.inset || 0;
        const x = rect.x + inset;
        const y = rect.y + inset;
        const width = rect.width - inset * 2;
        const height = rect.height - inset * 2;

        if (width <= 0 || height <= 0) {
          continue;
        }

        drawSelectionRectPath(this.overlayCtx, x, y, width, height, selectionStyle.radius || 0);

        if (hasFill) {
          this.overlayCtx.fill();
        }
        if (hasStroke) {
          this.overlayCtx.stroke();
        }
      }
    }

    if (caret) {
      const caretBottom = caret.y + caret.height;

      if (caretBottom >= 0 && caret.y <= clientHeight) {
        this.overlayCtx.fillStyle = "#111827";

        this.overlayCtx.fillRect(caret.x, caret.y, 1, caret.height);
      }
    }

    if (this.settings?.debugPerf) {
      overlayMs += now() - overlayStart;
      const elapsed = now() - perfStart;
      const sinceLast = now() - this.lastPerfLog;
      if (!this.lastPerfLog || sinceLast > 250) {
        this.lastPerfLog = now();
        const summary = {
          ms: Math.round(elapsed),
          activePages: activePages.size,
          redrawPages: redrawCount,
          cachedPages,
          cacheSize: this.pageCache.size,
          signatureMs: Math.round(signatureMs),
          renderPagesMs: Math.round(renderPagesMs),
          compositeMs: Math.round(compositeMs),
          overlayMs: Math.round(overlayMs),
        };
        if (this.settings?.__perf) {
          this.settings.__perf.render = summary;
        }
        const panel = this.settings?.perfPanelEl;
        if (panel) {
          const layoutPerf = this.settings.__perf?.layout;
          panel.textContent = [
            "layout",
            `  ms: ${layoutPerf?.ms ?? "-"}`,
            `  pages: ${layoutPerf?.pages ?? "-"}`,
            `  blocks: ${layoutPerf?.blocks ?? "-"}`,
            `  cache: ${layoutPerf?.blockCacheHitRate ?? "-"}`,
            `  lines: ${layoutPerf?.lines ?? "-"}`,
            `  measure: ${layoutPerf?.measureCalls ?? "-"}`,
            `  reused: ${layoutPerf?.reusedPages ?? "-"}`,
            `  breakLinesMs: ${layoutPerf?.breakLinesMs ?? "-"}`,
            `  layoutLeafMs: ${layoutPerf?.layoutLeafMs ?? "-"}`,
            "render",
            `  ms: ${summary.ms}`,
            `  active: ${summary.activePages}`,
            `  redraw: ${summary.redrawPages}`,
            `  cached: ${summary.cachedPages}`,
            `  cacheSize: ${summary.cacheSize}`,
            `  signatureMs: ${summary.signatureMs}`,
            `  renderPagesMs: ${summary.renderPagesMs}`,
            `  compositeMs: ${summary.compositeMs}`,
            `  overlayMs: ${summary.overlayMs}`,
          ].join("\n");
        }
      }
    }
  }
}
