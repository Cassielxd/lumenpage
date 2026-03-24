import { hasFragmentOwnerType } from "./fragmentOwners";

const readIdAttr = (dom: Element | null) => dom?.getAttribute?.("data-node-id") || null;

export const horizontalRuleNodeSpec: any = {
  group: "block",
  atom: true,
  selectable: true,
  offsetMapping: {
    toText: () => " ",
    getTextLength: () => 1,
    mapOffsetToPos: (node: any, nodePos: number, offset: number) =>
      offset <= 0 ? nodePos : nodePos + node.nodeSize,
    mapPosToOffset: (_node: any, nodePos: number, pos: number) => (pos <= nodePos ? 0 : 1),
  },
  attrs: {
    id: { default: null },
  },
  parseDOM: [
    {
      tag: "hr",
      getAttrs: (dom: Element) => ({
        id: readIdAttr(dom),
      }),
    },
  ],
  toDOM(node) {
    const attrs: Record<string, unknown> = {};
    if (node.attrs?.id) {
      attrs["data-node-id"] = node.attrs.id;
    }
    return ["hr", attrs];
  },
};

const buildHorizontalRuleLayout = (settings: any) => {
  const width = settings.pageWidth - settings.margin.left - settings.margin.right;
  const height = Math.max(8, Math.round(settings.lineHeight * 0.8));
  const blockAttrs = {
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
    runs: [],
    x: settings.margin.left,
    blockType: "horizontalRule",
    blockAttrs,
  };
  return {
    width,
    height,
    line,
    blockAttrs,
  };
};

export const horizontalRuleRenderer = {
  allowSplit: false,
  layoutBlock({ settings }: { node: any; settings: any }) {
    const layout = buildHorizontalRuleLayout(settings);
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
    const layout = buildHorizontalRuleLayout(settings);
    const startPos = Number.isFinite(ctx?.startPos ?? ctx?.blockStart)
      ? Number(ctx?.startPos ?? ctx?.blockStart)
      : 0;
    return {
      kind: "horizontalRule",
      nodeId: node?.attrs?.id ?? null,
      blockId: node?.attrs?.id ?? null,
      startPos,
      endPos: startPos + 1,
      width: layout.width,
      height: layout.height,
      meta: {
        source: "horizontal-rule-modern-measure",
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
          kind: "horizontalRule",
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
            source: "horizontal-rule-modern-paginate",
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
          source: "horizontal-rule-modern-paginate",
          reason: "retry-on-fresh-page",
        },
      };
      return {
        slice: {
          kind: "horizontalRule",
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
            source: "horizontal-rule-modern-paginate",
            deferred: true,
          },
        },
        nextCursor,
        exhausted: false,
      };
    }

    return {
      slice: {
        kind: "horizontalRule",
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
          source: "horizontal-rule-modern-paginate",
          placed: true,
        },
      },
      nextCursor: null,
      exhausted: true,
    };
  },
  renderLine({ ctx, line, pageX, pageTop, layout }: any) {
    const width = Math.max(0, Number.isFinite(line?.width) ? Number(line.width) : 0);
    const x = pageX + (Number.isFinite(line?.x) ? Number(line.x) : layout.margin.left);
    const height = line.lineHeight ?? layout.lineHeight;
    const y = pageTop + line.y + height / 2;
    if (hasFragmentOwnerType(line, "horizontalRule", line?.blockId)) {
      return;
    }
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width, y);
    ctx.stroke();
  },
  renderFragment({ ctx, fragment, pageX, pageTop, layout }: any) {
    if (fragment?.type !== "horizontalRule") {
      return;
    }
    const width = Math.max(0, Number(fragment?.width) || 0);
    const x =
      pageX +
      (Number.isFinite(fragment?.x) ? Number(fragment.x) : Number(layout?.margin?.left) || 0);
    const height = Number(fragment?.height) || Number(layout?.lineHeight) || 0;
    const y = pageTop + (Number(fragment?.y) || 0) + height / 2;
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width, y);
    ctx.stroke();
  },
};
