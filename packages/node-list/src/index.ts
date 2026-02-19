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
        markerText,
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

  splitBlock({ lines, length, availableHeight, lineHeight }) {
    if (!lines || lines.length === 0) {
      return null;
    }

    const getLineHeight = (line) =>
      Number.isFinite(line?.lineHeight) ? line.lineHeight : lineHeight || 0;

    const groups: Array<{ lines: any[]; height: number }> = [];
    let currentIndex: number | null = null;
    let currentLines: any[] = [];
    let currentHeight = 0;

    for (const line of lines) {
      const index = Number.isFinite(line?.blockAttrs?.itemIndex)
        ? line.blockAttrs.itemIndex
        : 0;
      if (currentIndex === null) {
        currentIndex = index;
      }
      if (index !== currentIndex) {
        groups.push({ lines: currentLines, height: currentHeight });
        currentLines = [];
        currentHeight = 0;
        currentIndex = index;
      }
      const lh = getLineHeight(line);
      currentLines.push(line);
      currentHeight += lh;
    }
    if (currentLines.length) {
      groups.push({ lines: currentLines, height: currentHeight });
    }

    let usedHeight = 0;
    let cutIndex = 0;
    for (; cutIndex < groups.length; cutIndex += 1) {
      const nextHeight = usedHeight + groups[cutIndex].height;
      if (nextHeight > availableHeight) {
        break;
      }
      usedHeight = nextHeight;
    }

    // 没有任何完整列表项能放下，退化为按行拆分，保证布局推进。
    if (cutIndex === 0) {
      const maxLines = Math.max(
        1,
        Math.floor(availableHeight / Math.max(1, lineHeight || getLineHeight(lines[0]) || 1))
      );
      if (maxLines >= lines.length) {
        return null;
      }
      const visibleLines = lines.slice(0, maxLines);
      const overflowLines = lines.slice(maxLines);
      const firstLine = visibleLines[0];
      const lastLine = visibleLines[visibleLines.length - 1];
      const startOffset = typeof firstLine?.start === "number" ? firstLine.start : 0;
      const endOffset = typeof lastLine?.end === "number" ? lastLine.end : startOffset;
      const visibleLength = Math.max(0, endOffset - startOffset);
      const visibleHeight = visibleLines.reduce((sum, line) => sum + getLineHeight(line), 0);
      const overflowHeight = overflowLines.reduce((sum, line) => sum + getLineHeight(line), 0);
      return {
        lines: visibleLines,
        length: visibleLength,
        height: visibleHeight,
        overflow: {
          lines: overflowLines,
          length: Math.max(0, length - visibleLength),
          height: overflowHeight,
        },
      };
    }

    const visibleGroups = groups.slice(0, cutIndex);
    const overflowGroups = groups.slice(cutIndex);
    const visibleLines = visibleGroups.flatMap((group) => group.lines);
    const overflowLines = overflowGroups.flatMap((group) => group.lines);
    const visibleHeight = visibleGroups.reduce((sum, group) => sum + group.height, 0);
    const overflowHeight = overflowGroups.reduce((sum, group) => sum + group.height, 0);
    const firstLine = visibleLines[0];
    const lastLine = visibleLines[visibleLines.length - 1];
    const startOffset = typeof firstLine?.start === "number" ? firstLine.start : 0;
    const endOffset = typeof lastLine?.end === "number" ? lastLine.end : startOffset;
    const visibleLength = Math.max(0, endOffset - startOffset);

    return {
      lines: visibleLines,
      length: visibleLength,
      height: visibleHeight,
      overflow: overflowLines.length
        ? {
            lines: overflowLines,
            length: Math.max(0, length - visibleLength),
            height: overflowHeight,
          }
        : undefined,
    };
  },

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

  splitBlock: bulletListRenderer.splitBlock,

  layoutBlock({ node, settings, registry }) {
    return layoutList(node, settings, registry, true);
  },

  renderLine({ ctx, line, pageX, pageTop, layout, defaultRender }) {
    renderListMarker({ ctx, line, pageX, pageTop, layout });
    defaultRender(line, pageX, pageTop, layout);
  },
};

