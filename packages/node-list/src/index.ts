import { breakLines, docToRuns } from "lumenpage-view-canvas";
import { type NodeSpec } from "lumenpage-model";

const serializeListItemToText = (itemNode) =>
  itemNode.textBetween(0, itemNode.content.size, "\n");

export const serializeListToText = (listNode) => {
  const items = [];

  listNode.forEach((item) => {
    items.push(serializeListItemToText(item));
  });

  return items.join("\n");
};

const readIdAttr = (dom) => dom?.getAttribute?.("data-node-id") || null;

export const listNodeSpecs: Record<string, NodeSpec> = {
  bullet_list: {
    group: "block",

    content: "list_item+",

    attrs: {
      id: { default: null },
    },

    parseDOM: [
      {
        tag: "ul",

        getAttrs: (dom) => ({ id: readIdAttr(dom) }),
      },
    ],

    toDOM(node) {
      const attrs: Record<string, unknown> = {};

      if (node.attrs?.id) {
        attrs["data-node-id"] = node.attrs.id;
      }

      return ["ul", attrs, 0];
    },
  },

  ordered_list: {
    group: "block",

    content: "list_item+",

    attrs: {
      id: { default: null },

      order: { default: 1 },
    },

    parseDOM: [
      {
        tag: "ol",

        getAttrs: (dom) => {
          const start = dom.getAttribute("start");

          const order = start ? Number.parseInt(start, 10) || 1 : 1;

          return { order, id: readIdAttr(dom) };
        },
      },
    ],

    toDOM(node) {
      const attrs: Record<string, unknown> = {};

      if (node.attrs?.order && node.attrs.order !== 1) {
        attrs.start = node.attrs.order;
      }

      if (node.attrs?.id) {
        attrs["data-node-id"] = node.attrs.id;
      }

      return ["ol", attrs, 0];
    },
  },

  list_item: {
    content: "paragraph+",

    parseDOM: [{ tag: "li" }],

    toDOM() {
      return ["li", 0];
    },
  },
};

const getLineHeight = (line, layout) =>
  Number.isFinite(line.lineHeight) ? line.lineHeight : layout.lineHeight;

const getFontSize = (font) => {
  const match = /(\d+(?:\.\d+)?)px/.exec(font || "");
  if (!match) {
    return 16;
  }
  const size = Number.parseFloat(match[1]);
  return Number.isFinite(size) ? size : 16;
};

const offsetLine = (line, delta) => {
  if (typeof line.start === "number") {
    line.start += delta;
  }
  if (typeof line.end === "number") {
    line.end += delta;
  }
  if (line.runs) {
    for (const run of line.runs) {
      if (typeof run.start === "number") {
        run.start += delta;
      }
      if (typeof run.end === "number") {
        run.end += delta;
      }
    }
  }
  return line;
};

const layoutList = (node, settings, registry, ordered) => {
  const lines = [];
  let offset = 0;
  const font = settings.font;
  const lineHeight = settings.lineHeight;
  const listIndent = settings.listIndent ?? 24;
  const markerGap = settings.listMarkerGap ?? 8;
  const markerFont = settings.listMarkerFont || font;
  const maxWidth = settings.pageWidth - settings.margin.left - settings.margin.right;

  node.forEach((item, _pos, index) => {
    if (item.type.name !== "list_item") {
      return;
    }

    const runsResult = docToRuns(item, settings, registry);
    const { runs, length } = runsResult;

    const markerText = ordered ? `${(node.attrs?.order || 1) + index}.` : "-";
    const markerWidth = settings.measureTextWidth
      ? settings.measureTextWidth(markerFont, markerText)
      : 0;
    const contentWidth = Math.max(0, maxWidth - listIndent - markerGap - markerWidth);

    const itemLines = breakLines(
      runs,
      contentWidth,
      font,
      length,
      settings.wrapTolerance || 0,
      settings.minLineWidth || 0,
      settings.measureTextWidth,
      settings.segmentText
    );

    const resolvedLines = itemLines.length
      ? itemLines
      : [{ text: "", start: 0, end: 0, width: 0, runs: [] }];

    resolvedLines.forEach((line, lineIndex) => {
      const lineCopy = {
        ...line,
        runs: line.runs ? line.runs.map((run) => ({ ...run })) : line.runs,
      };
      offsetLine(lineCopy, offset);
      lineCopy.x = settings.margin.left + listIndent + markerGap + markerWidth;
      lineCopy.blockType = node.type.name;
      lineCopy.blockAttrs = {
        listType: ordered ? "ordered" : "bullet",
        listIndent,
        markerGap,
        markerWidth,
        markerFont,
        itemIndex: index,
      };
      if (lineIndex === 0) {
        lineCopy.listMarker = {
          text: markerText,
          width: markerWidth,
          gap: markerGap,
          font: markerFont,
        };
      }
      lines.push(lineCopy);
    });

    offset += length;
    if (index < node.childCount - 1) {
      offset += 1;
    }
  });

  return {
    lines,
    length: offset,
    height: lines.length * lineHeight,
    blockType: node.type.name,
    blockAttrs: {
      listType: ordered ? "ordered" : "bullet",
      listIndent,
      markerGap,
      markerFont,
    },
  };
};

const renderListMarker = ({ ctx, line, pageX, pageTop, layout }) => {
  const marker = line.listMarker;
  if (!marker) {
    return;
  }
  const fontSpec = marker.font || layout.font;
  const fontSize = getFontSize(fontSpec);
  const lineHeight = getLineHeight(line, layout);
  const baselineOffset = Math.max(0, (lineHeight - fontSize) / 2);
  const markerX = pageX + line.x - marker.gap - marker.width;
  const markerY = pageTop + line.y + baselineOffset;

  if (ctx.fillText) {
    ctx.font = fontSpec;
    ctx.fillStyle = "#111827";
    ctx.fillText(marker.text, markerX, markerY);
    return;
  }

  if (ctx.fillRect) {
    const size = Math.max(4, Math.round(fontSize * 0.35));
    ctx.fillRect(markerX, markerY + (fontSize - size) / 2, size, size);
  }
};

export const bulletListRenderer = {
  allowSplit: true,

  layoutBlock({ node, settings, registry }) {
    return layoutList(node, settings, registry, false);
  },

  renderLine({ ctx, line, pageX, pageTop, layout, defaultRender }) {
    renderListMarker({ ctx, line, pageX, pageTop, layout });
    defaultRender(line, pageX, pageTop, layout);
  },
};

export const orderedListRenderer = {
  allowSplit: true,

  layoutBlock({ node, settings, registry }) {
    return layoutList(node, settings, registry, true);
  },

  renderLine({ ctx, line, pageX, pageTop, layout, defaultRender }) {
    renderListMarker({ ctx, line, pageX, pageTop, layout });
    defaultRender(line, pageX, pageTop, layout);
  },
};

