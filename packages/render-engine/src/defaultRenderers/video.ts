import { hasFragmentOwnerType } from "./fragmentOwners";

const resolvePositiveDimension = (value: unknown) => {
  if (value == null) {
    return null;
  }
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
};

const drawVideoPlaceholder = ({ ctx, x, y, width, height }: any) => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return;
  }

  ctx.fillStyle = "#f3f4f6";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "#9ca3af";
  ctx.strokeRect(x, y, width, height);

  ctx.fillStyle = "#6b7280";
  ctx.font = "14px Arial";
  ctx.fillText("Video", x + 12, y + 24);

  ctx.fillStyle = "rgba(107, 114, 128, 0.6)";
  ctx.beginPath();
  ctx.moveTo(x + width / 2 - 12, y + height / 2 - 16);
  ctx.lineTo(x + width / 2 - 12, y + height / 2 + 16);
  ctx.lineTo(x + width / 2 + 16, y + height / 2);
  ctx.closePath();
  ctx.fill();
};

const buildVideoLayout = ({ node, settings }: { node: any; settings: any }) => {
  const attrs = node?.attrs || {};
  const maxWidth = settings.pageWidth - settings.margin.left - settings.margin.right;
  const desiredWidth = resolvePositiveDimension(attrs.width) ?? Math.min(480, maxWidth);
  const width = Math.max(1, Math.min(maxWidth, desiredWidth));
  const desiredHeight = resolvePositiveDimension(attrs.height) ?? Math.round(width * 0.5625);
  const height = Math.max(1, desiredHeight);
  const blockAttrs = {
    width,
    height,
    lineHeight: height,
    layoutCapabilities: {
      "visual-block": true,
    },
    visualBounds: {
      x: settings.margin.left,
      width,
    },
  };
  const line = {
    text: "",
    start: 0,
    end: 1,
    width,
    lineHeight: height,
    runs: [],
    x: settings.margin.left,
    blockType: "video",
    blockAttrs,
    videoMeta: { width, height },
  };
  return { width, height, line, blockAttrs };
};

export const videoRenderer = {
  allowSplit: false,

  layoutBlock({ node, settings }) {
    const layout = buildVideoLayout({ node, settings });

    return {
      lines: [layout.line],
      length: 1,
      height: layout.height,
      blockLineHeight: layout.height,
      blockAttrs: layout.blockAttrs,
    };
  },

  measureBlock(ctx: any) {
    const { node, settings } = ctx || {};
    const layout = buildVideoLayout({ node, settings });
    const startPos = Number.isFinite(ctx?.startPos ?? ctx?.blockStart)
      ? Number(ctx?.startPos ?? ctx?.blockStart)
      : 0;
    return {
      kind: "video",
      nodeId: node?.attrs?.id ?? null,
      blockId: node?.attrs?.id ?? null,
      startPos,
      endPos: startPos + 1,
      width: layout.width,
      height: layout.height,
      meta: {
        source: "video-modern-measure",
        line: layout.line,
        blockAttrs: layout.blockAttrs,
      },
    };
  },

  paginateBlock(ctx: any) {
    const measured = ctx?.measured;
    const line = measured?.meta?.line
      ? { ...measured.meta.line, blockAttrs: { ...(measured.meta.line.blockAttrs || {}) } }
      : null;
    const blockAttrs = measured?.meta?.blockAttrs ? { ...measured.meta.blockAttrs } : null;
    const cursorPlaced = ctx?.cursor?.localCursor?.placed === true;
    if (!measured || !line || !blockAttrs || cursorPlaced) {
      return {
        slice: {
          kind: "video",
          nodeId: measured?.nodeId ?? null,
          blockId: measured?.blockId ?? null,
          startPos: Number(measured?.endPos || measured?.startPos || 0),
          endPos: Number(measured?.endPos || measured?.startPos || 0),
          fromPrev: false,
          hasNext: false,
          boxes: [],
          fragments: [],
          lines: [],
          nextCursor: null,
          meta: {
            source: "video-modern-paginate",
            exhausted: true,
          },
        },
        nextCursor: null,
        exhausted: true,
      };
    }

    const availableHeight = Number(ctx?.availableHeight || 0);
    const pageHasLines = ctx?.pageHasLines === true;
    const fits = availableHeight >= Number(measured.height || 0);

    if (!fits && pageHasLines) {
      const nextCursor = {
        nodeId: measured?.nodeId ?? null,
        blockId: measured?.blockId ?? null,
        startPos: Number(measured?.startPos || 0),
        endPos: Number(measured?.endPos || measured?.startPos || 0),
        localCursor: { placed: false },
        meta: {
          source: "video-modern-paginate",
          reason: "retry-on-fresh-page",
        },
      };
      return {
        slice: {
          kind: "video",
          nodeId: measured?.nodeId ?? null,
          blockId: measured?.blockId ?? null,
          startPos: Number(measured?.startPos || 0),
          endPos: Number(measured?.startPos || 0),
          fromPrev: false,
          hasNext: true,
          boxes: [],
          fragments: [],
          lines: [],
          nextCursor,
          meta: {
            source: "video-modern-paginate",
            deferred: true,
          },
        },
        nextCursor,
        exhausted: false,
      };
    }

    return {
      slice: {
        kind: "video",
        nodeId: measured?.nodeId ?? null,
        blockId: measured?.blockId ?? null,
        startPos: Number(measured?.startPos || 0),
        endPos: Number(measured?.endPos || measured?.startPos || 0),
        fromPrev: false,
        hasNext: false,
        boxes: [],
        fragments: [],
        lines: [{ ...line, blockAttrs }],
        nextCursor: null,
        meta: {
          source: "video-modern-paginate",
          placed: true,
        },
      },
      nextCursor: null,
      exhausted: true,
    };
  },

  renderLine({ ctx, line, pageX, pageTop }) {
    const width = line.videoMeta?.width ?? line.width ?? 0;
    const height = line.videoMeta?.height ?? line.lineHeight ?? 0;
    if (width <= 0 || height <= 0) return;
    if (hasFragmentOwnerType(line, "video", line?.blockId)) {
      return;
    }

    drawVideoPlaceholder({ ctx, x: pageX + line.x, y: pageTop + line.y, width, height });
  },
  renderFragment({ ctx, fragment, pageX, pageTop }) {
    if (fragment?.type !== "video") {
      return;
    }
    drawVideoPlaceholder({
      ctx,
      x: pageX + (Number(fragment?.x) || 0),
      y: pageTop + (Number(fragment?.y) || 0),
      width: Number(fragment?.width) || 0,
      height: Number(fragment?.height) || 0,
    });
  },
};
