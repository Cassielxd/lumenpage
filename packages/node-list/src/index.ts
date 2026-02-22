import { breakLines, docToRuns, textblockToRuns } from "lumenpage-view-canvas";
import { type NodeSpec } from "lumenpage-model";
import { canSplit } from "lumenpage-transform";
import { Selection } from "lumenpage-state";

const serializeListItemToText = (itemNode) =>
  itemNode.textBetween(0, itemNode.content.size, "\n");

const serializeContainerToText = (node, helpers) => {
  const parts = [];
  node.forEach((child, _pos, index) => {
    parts.push(helpers.serializeNodeToText(child));
    if (index < node.childCount - 1) {
      parts.push("\n");
    }
  });
  return parts.join("");
};

const getContainerTextLength = (node, helpers) => {
  let length = 0;
  node.forEach((child, _pos, index) => {
    length += helpers.getNodeTextLength(child);
    if (index < node.childCount - 1) {
      length += 1;
    }
  });
  return length;
};

const mapOffsetInContainer = (node, nodePos, offset, helpers) => {
  let remaining = offset;
  let innerPos = nodePos + 1;
  for (let i = 0; i < node.childCount; i += 1) {
    const child = node.child(i);
    const childPos = innerPos;
    const textLength = helpers.getNodeTextLength(child);
    if (remaining <= textLength) {
      return helpers.mapOffsetInNode(child, childPos, remaining);
    }
    remaining -= textLength;
    if (i < node.childCount - 1) {
      if (remaining === 0) {
        return childPos + child.nodeSize - 1;
      }
      remaining -= 1;
    }
    innerPos += child.nodeSize;
  }
  return nodePos + node.nodeSize - 1;
};

const mapPosInContainer = (node, nodePos, pos, helpers) => {
  let offset = 0;
  let innerPos = nodePos + 1;
  for (let i = 0; i < node.childCount; i += 1) {
    const child = node.child(i);
    const childPos = innerPos;
    if (pos <= childPos) {
      return offset;
    }
    if (pos < childPos + child.nodeSize) {
      return offset + helpers.mapPosInNode(child, childPos, pos);
    }
    offset += helpers.getNodeTextLength(child);
    if (i < node.childCount - 1) {
      offset += 1;
    }
    innerPos += child.nodeSize;
  }
  return offset;
};

const containerOffsetMapping = {
  toText: (node, helpers) => serializeContainerToText(node, helpers),
  getTextLength: (node, helpers) => getContainerTextLength(node, helpers),
  mapOffsetToPos: (node, nodePos, offset, helpers) =>
    mapOffsetInContainer(node, nodePos, offset, helpers),
  mapPosToOffset: (node, nodePos, pos, helpers) => mapPosInContainer(node, nodePos, pos, helpers),
};

export const serializeListToText = (listNode) => {
  const items = [];

  listNode.forEach((item) => {
    items.push(serializeListItemToText(item));
  });

  return items.join("\n");
};

const readIdAttr = (dom) => dom?.getAttribute?.("data-node-id") || null;

const findAncestorDepthByType = ($pos, typeName) => {
  if (!$pos || !typeName) {
    return -1;
  }
  for (let depth = $pos.depth; depth >= 0; depth -= 1) {
    if ($pos.node(depth)?.type?.name === typeName) {
      return depth;
    }
  }
  return -1;
};

export const splitListItem = (state, dispatch) => {
  const { selection } = state;
  const { $from, $to } = selection;
  if (!$from?.sameParent?.($to)) {
    return false;
  }
  if (!$from.parent?.isTextblock) {
    return false;
  }

  const itemDepth = findAncestorDepthByType($from, "list_item");
  if (itemDepth < 0 || itemDepth - 1 < 0) {
    return false;
  }
  const listNode = $from.node(itemDepth - 1);
  const isList = listNode?.type?.name === "bullet_list" || listNode?.type?.name === "ordered_list";
  if (!isList) {
    return false;
  }

  const splitPos = $from.pos;
  if (!canSplit(state.doc, splitPos, 2)) {
    return false;
  }
  if (!dispatch) {
    return true;
  }

  let tr = state.tr;
  if (!selection.empty) {
    tr = tr.deleteSelection();
  }
  const mappedPos = tr.mapping.map(splitPos);
  tr = tr.split(mappedPos, 2).scrollIntoView();
  dispatch(tr);
  return true;
};

export const backspaceEmptyListItem = (state, dispatch) => {
  const { selection } = state;
  if (!selection?.empty) {
    return false;
  }
  const { $from } = selection;
  if (!$from?.parent?.isTextblock) {
    return false;
  }
  if ($from.parentOffset !== 0 || $from.parent.content.size !== 0) {
    return false;
  }

  const itemDepth = findAncestorDepthByType($from, "list_item");
  if (itemDepth < 0 || itemDepth - 1 < 0) {
    return false;
  }
  const listDepth = itemDepth - 1;
  const listNode = $from.node(listDepth);
  const isList = listNode?.type?.name === "bullet_list" || listNode?.type?.name === "ordered_list";
  if (!isList) {
    return false;
  }

  const itemIndex = $from.index(listDepth);
  if (itemIndex <= 0) {
    return false;
  }

  const itemStart = $from.before(itemDepth);
  const itemEnd = $from.after(itemDepth);
  if (!dispatch) {
    return true;
  }

  let tr = state.tr.delete(itemStart, itemEnd);
  const prevPos = Math.max(0, tr.mapping.map(itemStart) - 1);
  tr = tr.setSelection(Selection.near(tr.doc.resolve(prevPos), -1)).scrollIntoView();
  dispatch(tr);
  return true;
};

export const listNodeSpecs: Record<string, NodeSpec> = {
  bullet_list: {
    group: "block",

    content: "list_item+",

    attrs: {
      id: { default: null },
    },
    offsetMapping: containerOffsetMapping,

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
    offsetMapping: containerOffsetMapping,

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
    content: "block+",
    offsetMapping: containerOffsetMapping,

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

const resolveSettingsWithIndent = (settings, indent) => {
  if (!indent) {
    return settings;
  }
  return {
    ...settings,
    margin: {
      ...settings.margin,
      left: settings.margin.left + indent,
    },
  };
};

const computeLineX = (line, settings) => {
  const { pageWidth, margin } = settings;
  const maxWidth = pageWidth - margin.left - margin.right;
  const align = line.blockAttrs?.align || "left";
  const indent = line.blockAttrs?.indent || 0;
  let x = margin.left;

  if (align === "center") {
    x += Math.max(0, (maxWidth - line.width) / 2);
  } else if (align === "right") {
    x += Math.max(0, maxWidth - line.width);
  }

  if (indent && line.blockStart === line.start) {
    x += indent;
  }

  return x;
};

const applyContainerStack = (line, containerStack) => {
  if (containerStack && containerStack.length) {
    line.containers = containerStack;
  }
  return line;
};

const layoutLeafInList = ({
  node,
  settings,
  registry,
  context,
  blockStartOffset,
  baseY,
  listMeta,
}) => {
  const renderer = registry?.get(node.type.name);
  const blockSettings = resolveSettingsWithIndent(settings, context.indent);
  const blockId = node.attrs?.id ?? null;
  let blockAttrs = node.attrs || null;
  let blockLineHeight = null;
  let result = null;

  if (renderer?.layoutBlock) {
    result = renderer.layoutBlock({
      node,
      availableHeight: Number.POSITIVE_INFINITY,
      measureTextWidth: blockSettings.measureTextWidth,
      settings: blockSettings,
      registry,
      indent: context.indent,
      containerStack: context.containerStack,
    });
  } else {
    const runsResult = renderer?.toRuns
      ? renderer.toRuns(node, blockSettings, registry)
      : node.isTextblock
        ? textblockToRuns(
            node,
            blockSettings,
            node.type.name,
            blockId,
            node.attrs,
            0
          )
        : docToRuns(node, blockSettings, registry);

    const { runs, length } = runsResult;
    if (runsResult?.blockAttrs) {
      blockAttrs = runsResult.blockAttrs;
    }
    if (runsResult?.blockAttrs?.lineHeight) {
      blockLineHeight = runsResult.blockAttrs.lineHeight;
    }

    const lines = breakLines(
      runs,
      blockSettings.pageWidth - blockSettings.margin.left - blockSettings.margin.right,
      blockSettings.font,
      length,
      blockSettings.wrapTolerance || 0,
      blockSettings.minLineWidth || 0,
      blockSettings.measureTextWidth,
      blockSettings.segmentText
    );
    result = { lines, length, height: lines.length * (blockLineHeight || settings.lineHeight) };
  }

  const lines = result?.lines?.length
    ? result.lines
    : [{ text: "", start: 0, end: 0, width: 0, runs: [] }];
  const length = result?.length ?? 0;
  const lineHeightValue =
    Number.isFinite(blockAttrs?.lineHeight) ? blockAttrs.lineHeight : settings.lineHeight;

  let height = Number.isFinite(result?.height)
    ? result.height
    : lines.length * lineHeightValue;

  const adjustedLines = lines.map((line, lineIndex) => {
    const lineCopy = {
      ...line,
      runs: line.runs ? line.runs.map((run) => ({ ...run })) : line.runs,
    };
    lineCopy.blockType = lineCopy.blockType || node.type.name;
    lineCopy.blockId = lineCopy.blockId ?? blockId;
    lineCopy.blockAttrs = { ...(blockAttrs || {}), ...(lineCopy.blockAttrs || {}), ...(listMeta || {}) };
    if (lineCopy.blockStart == null) {
      lineCopy.blockStart = blockStartOffset;
    }
    offsetLine(lineCopy, blockStartOffset);
    const localRelY =
      typeof lineCopy.relativeY === "number" ? lineCopy.relativeY : lineIndex * lineHeightValue;
    lineCopy.relativeY = baseY + localRelY;
    lineCopy.lineHeight = lineCopy.lineHeight ?? lineHeightValue;
    if (typeof lineCopy.x !== "number") {
      lineCopy.x = computeLineX(lineCopy, blockSettings);
    }
    const indentOffset = blockSettings.margin.left - settings.margin.left;
    if (lineCopy.tableMeta && Number.isFinite(indentOffset)) {
      lineCopy.tableMeta = {
        ...lineCopy.tableMeta,
        tableXOffset: (lineCopy.tableMeta.tableXOffset ?? 0) + indentOffset,
      };
    }
    applyContainerStack(lineCopy, context.containerStack);
    return lineCopy;
  });

  if (!Number.isFinite(height) || height <= 0) {
    const maxY = adjustedLines.reduce((max, line) => {
      const relY = typeof line.relativeY === "number" ? line.relativeY - baseY : 0;
      const lh = Number.isFinite(line.lineHeight) ? line.lineHeight : lineHeightValue;
      return Math.max(max, relY + lh);
    }, 0);
    height = maxY;
  }

  return { lines: adjustedLines, length, height };
};

const layoutNodeInList = ({
  node,
  settings,
  registry,
  context,
  startOffset,
  baseY,
  blockSpacing,
  listMeta,
}) => {
  const renderer = registry?.get(node.type.name);
  const isLeaf =
    renderer?.layoutBlock || renderer?.toRuns || node.isTextblock || node.isAtom;

  if (isLeaf) {
    return layoutLeafInList({
      node,
      settings,
      registry,
      context,
      blockStartOffset: startOffset,
      baseY,
      listMeta,
    });
  }

  const style = renderer?.getContainerStyle
    ? renderer.getContainerStyle({ node, settings, registry })
    : null;
  const indent = Number.isFinite(style?.indent) ? style.indent : 0;
  const shouldPush = indent > 0 || renderer?.renderContainer || style;
  const nextContext = shouldPush
    ? {
        indent: context.indent + indent,
        containerStack: [
          ...context.containerStack,
          {
            ...style,
            type: node.type.name,
            offset: context.indent,
            indent,
            baseX: settings.margin.left + context.indent,
          },
        ],
      }
    : context;

  let offset = startOffset;
  let y = baseY;
  let height = 0;
  const lines = [];

  for (let i = 0; i < node.childCount; i += 1) {
    const child = node.child(i);
    const childResult = layoutNodeInList({
      node: child,
      settings,
      registry,
      context: nextContext,
      startOffset: offset,
      baseY: y,
      blockSpacing,
      listMeta,
    });
    lines.push(...childResult.lines);
    offset += childResult.length;
    y += childResult.height;
    height += childResult.height;
    if (i < node.childCount - 1) {
      offset += 1;
      if (blockSpacing > 0) {
        y += blockSpacing;
        height += blockSpacing;
      }
    }
  }

  return { lines, length: offset - startOffset, height };
};

const layoutList = (node, settings, registry, ordered) => {
  const lines = [];
  let offset = 0;
  let cursorY = 0;
  const font = settings.font;
  const lineHeight = settings.lineHeight;
  const listIndent = settings.listIndent ?? 24;
  const markerGap = settings.listMarkerGap ?? 8;
  const markerFont = settings.listMarkerFont || font;
  const blockSpacing = Number.isFinite(settings.blockSpacing) ? settings.blockSpacing : 0;

  node.forEach((item, _pos, index) => {
    if (item.type.name !== "list_item") {
      return;
    }

    const markerText = ordered ? `${(node.attrs?.order || 1) + index}.` : "-";
    const markerWidth = settings.measureTextWidth
      ? settings.measureTextWidth(markerFont, markerText)
      : 0;
    const contentIndent = listIndent + markerGap + markerWidth;
    const listMeta = {
      listType: ordered ? "ordered" : "bullet",
      listIndent,
      markerGap,
      markerWidth,
      markerFont,
      markerText,
      itemIndex: index,
    };

    const itemResult = layoutNodeInList({
      node: item,
      settings,
      registry,
      context: { indent: contentIndent, containerStack: [] },
      startOffset: offset,
      baseY: cursorY,
      blockSpacing,
      listMeta,
    });

    itemResult.lines.forEach((line, lineIndex) => {
      const lineCopy = {
        ...line,
        runs: line.runs ? line.runs.map((run) => ({ ...run })) : line.runs,
        blockType: node.type.name,
        blockAttrs: { ...(line.blockAttrs || {}), ...listMeta },
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

    offset += itemResult.length;
    cursorY += itemResult.height;
    if (index < node.childCount - 1) {
      offset += 1;
    }
  });

  return {
    lines,
    length: offset,
    height: Math.max(cursorY, lines.length * lineHeight),
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
  let marker = line.listMarker;
  if (
    !marker &&
    line?.blockAttrs?.markerText &&
    Number.isFinite(line?.blockAttrs?.markerWidth) &&
    line?.blockAttrs?.markerGap != null &&
    (line?.blockStart == null || line?.start == null || line.blockStart === line.start)
  ) {
    marker = {
      text: line.blockAttrs.markerText,
      width: line.blockAttrs.markerWidth,
      gap: line.blockAttrs.markerGap,
      font: line.blockAttrs.markerFont || layout.font,
    };
  }
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

    const getLineHeightValue = (line) =>
      Number.isFinite(line?.lineHeight) ? line.lineHeight : Math.max(1, lineHeight || 1);

    const normalized = [];
    let fallbackY = 0;
    for (const line of lines) {
      const lh = getLineHeightValue(line);
      const relY = Number.isFinite(line?.relativeY) ? line.relativeY : fallbackY;
      normalized.push({ line, relY, lh, bottom: relY + lh });
      fallbackY = relY + lh;
    }

    const cloneAndNormalize = (entries) => {
      if (!entries.length) {
        return { lines: [], height: 0 };
      }
      const top = entries[0].relY;
      const bottom = entries[entries.length - 1].bottom;
      const sliceLines = entries.map((entry) => ({
        ...entry.line,
        runs: entry.line.runs ? entry.line.runs.map((run) => ({ ...run })) : entry.line.runs,
        relativeY: entry.relY - top,
      }));
      return {
        lines: sliceLines,
        height: Math.max(0, bottom - top),
      };
    };

    const groups = [];
    let currentIndex = null;
    let currentEntries = [];
    for (const entry of normalized) {
      const index = Number.isFinite(entry?.line?.blockAttrs?.itemIndex)
        ? entry.line.blockAttrs.itemIndex
        : 0;
      if (currentIndex === null) {
        currentIndex = index;
      }
      if (index !== currentIndex) {
        groups.push({
          entries: currentEntries,
          top: currentEntries[0].relY,
          bottom: currentEntries[currentEntries.length - 1].bottom,
        });
        currentEntries = [];
        currentIndex = index;
      }
      currentEntries.push(entry);
    }
    if (currentEntries.length) {
      groups.push({
        entries: currentEntries,
        top: currentEntries[0].relY,
        bottom: currentEntries[currentEntries.length - 1].bottom,
      });
    }

    let cutIndex = 0;
    for (; cutIndex < groups.length; cutIndex += 1) {
      const nextHeight = groups[cutIndex].bottom - groups[0].top;
      if (nextHeight > availableHeight) {
        break;
      }
    }

    if (cutIndex === 0) {
      let visibleCount = 0;
      for (; visibleCount < normalized.length; visibleCount += 1) {
        const nextHeight = normalized[visibleCount].bottom - normalized[0].relY;
        if (nextHeight > availableHeight) {
          break;
        }
      }
      visibleCount = Math.max(1, visibleCount);
      if (visibleCount >= normalized.length) {
        return null;
      }

      const visibleEntries = normalized.slice(0, visibleCount);
      const overflowEntries = normalized.slice(visibleCount);
      const visible = cloneAndNormalize(visibleEntries);
      const overflow = cloneAndNormalize(overflowEntries);
      const firstLine = visible.lines[0];
      const lastLine = visible.lines[visible.lines.length - 1];
      const startOffset = typeof firstLine?.start === "number" ? firstLine.start : 0;
      const endOffset = typeof lastLine?.end === "number" ? lastLine.end : startOffset;
      const visibleLength = Math.max(0, endOffset - startOffset);
      return {
        lines: visible.lines,
        length: visibleLength,
        height: visible.height,
        overflow: {
          lines: overflow.lines,
          length: Math.max(0, length - visibleLength),
          height: overflow.height,
        },
      };
    }

    const visibleEntries = groups.slice(0, cutIndex).flatMap((group) => group.entries);
    const overflowEntries = groups.slice(cutIndex).flatMap((group) => group.entries);
    const visible = cloneAndNormalize(visibleEntries);
    const overflow = cloneAndNormalize(overflowEntries);
    const firstLine = visible.lines[0];
    const lastLine = visible.lines[visible.lines.length - 1];
    const startOffset = typeof firstLine?.start === "number" ? firstLine.start : 0;
    const endOffset = typeof lastLine?.end === "number" ? lastLine.end : startOffset;
    const visibleLength = Math.max(0, endOffset - startOffset);

    return {
      lines: visible.lines,
      length: visibleLength,
      height: visible.height,
      overflow: overflow.lines.length
        ? {
            lines: overflow.lines,
            length: Math.max(0, length - visibleLength),
            height: overflow.height,
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



