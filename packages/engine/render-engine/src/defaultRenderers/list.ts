import { breakLines } from "../lineBreaker.js";
import { docToRuns, textblockToRuns } from "../textRuns.js";
import { resolveContainerLayoutContext } from "../containerLayout.js";
import { isLeafLayoutNode } from "../layoutRole.js";
import { resolveNodeSplitFragments, resolveRendererFragmentModel } from "../pagination.js";
import { ensureBlockFragmentOwner, shiftFragmentOwners } from "./fragmentOwners.js";

type ListMode = "bullet" | "ordered" | "task";

const getLineHeight = (line, layout) =>
  Number.isFinite(line.lineHeight) ? line.lineHeight : layout.lineHeight;

const measureLinesHeight = (lines, fallbackLineHeight) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    return 0;
  }
  let usedRelativeY = false;
  let maxBottom = 0;
  let cursor = 0;
  for (const line of lines) {
    const lineHeight = Number.isFinite(line?.lineHeight)
      ? line.lineHeight
      : Math.max(1, Number(fallbackLineHeight) || 1);
    if (Number.isFinite(line?.relativeY)) {
      usedRelativeY = true;
      maxBottom = Math.max(maxBottom, line.relativeY + lineHeight);
      continue;
    }
    cursor += lineHeight;
  }
  return usedRelativeY ? maxBottom : cursor;
};

const getFontSize = (font) => {
  const match = /(\d+(?:\.\d+)?)px/.exec(font || "");
  if (!match) {
    return 16;
  }
  const size = Number.parseFloat(match[1]);
  return Number.isFinite(size) ? size : 16;
};

const getBaselineOffset = (lineHeight: number, fontSize: number) =>
  Math.max(0, (lineHeight - fontSize) / 2);

const scaleFontSize = (font: string, multiplier: number) => {
  const ratio = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
  if (!font || ratio === 1) {
    return font;
  }
  return font.replace(/(\d+(?:\.\d+)?)px/, (_match, size) => {
    const next = Math.max(10, Math.round(Number(size) * ratio));
    return `${next}px`;
  });
};

const offsetLine = (line, delta) => {
  if (typeof line.start === "number") {
    line.start += delta;
  }
  if (typeof line.end === "number") {
    line.end += delta;
  }
  if (Number.isFinite(line?.blockStart)) {
    line.blockStart += delta;
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
        ? textblockToRuns(node, blockSettings, node.type.name, blockId, node.attrs, 0, registry)
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
    result = {
      lines,
      length,
      height: measureLinesHeight(lines, blockLineHeight || settings.lineHeight),
    };
  }

  const lines = result?.lines?.length
    ? result.lines
    : [{ text: "", start: 0, end: 0, width: 0, runs: [] }];
  const length = result?.length ?? 0;
  const lineHeightValue =
    Number.isFinite(blockAttrs?.lineHeight) ? blockAttrs.lineHeight : settings.lineHeight;

  let height = Number.isFinite(result?.height) ? result.height : lines.length * lineHeightValue;
  if (!Number.isFinite(height) || height <= 0) {
    height = measureLinesHeight(lines, lineHeightValue);
  }

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
    if (lineCopy.tableOwnerMeta && Number.isFinite(indentOffset)) {
      lineCopy.tableOwnerMeta = {
        ...lineCopy.tableOwnerMeta,
        tableXOffset: (lineCopy.tableOwnerMeta.tableXOffset ?? 0) + indentOffset,
      };
    }
    if (lineCopy.tableMeta && Number.isFinite(indentOffset)) {
      lineCopy.tableMeta = {
        ...lineCopy.tableMeta,
        tableXOffset: (lineCopy.tableMeta.tableXOffset ?? 0) + indentOffset,
      };
    }
    applyContainerStack(lineCopy, context.containerStack);
    lineCopy.fragmentOwners = ensureBlockFragmentOwner({
      line: lineCopy,
      node,
      blockId,
      blockStart: blockStartOffset,
      blockAttrs: lineCopy.blockAttrs,
    });
    if (Array.isArray(lineCopy.fragmentOwners) && lineCopy.fragmentOwners.length > 0) {
      lineCopy.fragmentOwners = shiftFragmentOwners(lineCopy.fragmentOwners, 0, baseY);
    }
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
  const isLeaf = isLeafLayoutNode(renderer, node);

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
  const { nextContext } = resolveContainerLayoutContext({
    renderer,
    node,
    settings,
    registry,
    context,
    baseX: settings.margin.left,
  });

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

const getTaskMarkerText = (item) => (item?.attrs?.checked === true ? "\u2611" : "\u2610");

const getExpectedListItemType = (mode: ListMode) => (mode === "task" ? "taskItem" : "listItem");

const getNodeFragmentKey = (node, fallbackPrefix: string) => {
  if (node?.attrs?.id) {
    return `${fallbackPrefix}:${node.attrs.id}`;
  }
  if (typeof node?.hashCode === "function") {
    const hash = node.hashCode();
    if (hash != null) {
      return `${fallbackPrefix}:${String(hash)}`;
    }
  }
  return `${fallbackPrefix}:${node?.type?.name || "node"}`;
};

const createFragmentContinuationAttrs = (continuation) => ({
  fragmentIdentity: continuation.fragmentIdentity,
  fragmentContinuationToken: continuation.continuationToken,
  fragmentCarryState: continuation.carryState,
});

const getListContinuationOwnerKey = ({ node, listKey }) =>
  node?.attrs?.id ? String(node.attrs.id) : listKey;

const readListSliceMetaFromLines = (lines) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    return {
      firstItemIndex: null,
      lastItemIndex: null,
      firstItemStart: null,
      lastItemStart: null,
    };
  }

  let firstItemIndex = null;
  let lastItemIndex = null;
  let firstItemStart = null;
  let lastItemStart = null;
  for (const line of lines) {
    const meta = resolveListOwnerMeta(line);
    if (!meta) {
      continue;
    }
    if (firstItemIndex == null && Number.isFinite(meta.itemIndex)) {
      firstItemIndex = Number(meta.itemIndex);
    }
    if (Number.isFinite(meta.itemIndex)) {
      lastItemIndex = Number(meta.itemIndex);
    }
    if (firstItemStart == null && Number.isFinite(meta.itemStart)) {
      firstItemStart = Number(meta.itemStart);
    }
    if (Number.isFinite(meta.itemStart)) {
      lastItemStart = Number(meta.itemStart);
    }
  }

  return {
    firstItemIndex,
    lastItemIndex,
    firstItemStart,
    lastItemStart,
  };
};

const createDelegatedChildContinuation = (line, continuation) => {
  if (!line || !continuation || typeof continuation !== "object") {
    return null;
  }
  return {
    blockType: line.blockType || null,
    blockId: line.blockId ?? null,
    fragmentIdentity:
      typeof continuation.fragmentIdentity === "string" ? continuation.fragmentIdentity : null,
    continuationToken:
      typeof continuation.continuationToken === "string" ? continuation.continuationToken : null,
    carryState:
      continuation.carryState && typeof continuation.carryState === "object"
        ? { ...continuation.carryState }
        : null,
  };
};

const createListContinuation = ({
  mode,
  node,
  listKey,
  lines = null,
  firstItemIndex = null,
  lastItemIndex = null,
  firstItemStart = null,
  lastItemStart = null,
  fromPrev = false,
  hasNext = false,
  rowSplit = false,
  delegatedChild = null,
}) => {
  const ownerKey = getListContinuationOwnerKey({ node, listKey });
  const fragmentIdentity = `list:${ownerKey}`;
  const continuationToken = `${fragmentIdentity}:continuation`;
  const sliceMeta = readListSliceMetaFromLines(lines);
  return {
    fromPrev: fromPrev === true,
    hasNext: hasNext === true,
    rowSplit: rowSplit === true,
    continuationToken,
    fragmentIdentity,
    carryState: {
      kind: "list",
      mode,
      ownerBlockId: node?.attrs?.id ?? null,
      firstItemIndex: firstItemIndex ?? sliceMeta.firstItemIndex ?? null,
      lastItemIndex: lastItemIndex ?? sliceMeta.lastItemIndex ?? null,
      firstItemStart: firstItemStart ?? sliceMeta.firstItemStart ?? null,
      lastItemStart: lastItemStart ?? sliceMeta.lastItemStart ?? null,
      ...(delegatedChild ? { delegatedChild } : null),
    },
  };
};

const createListOwnerMeta = ({
  mode,
  node,
  listKey,
  index,
  offset,
  listIndent,
  markerGap,
  markerWidth,
  markerFont,
  markerColor,
  markerText,
  taskChecked,
}) => {
  const continuation = createListContinuation({
    mode,
    node,
    listKey,
    lines: null,
    firstItemIndex: index,
    lastItemIndex: index,
    firstItemStart: offset,
    lastItemStart: offset,
    fromPrev: false,
    hasNext: false,
    rowSplit: false,
  });
  return {
    listOwnerType: mode,
    listOwnerNodeType: node?.type?.name || null,
    listOwnerBlockId: node?.attrs?.id ?? null,
    listOwnerIndent: listIndent,
    listOwnerMarkerGap: markerGap,
    listOwnerMarkerWidth: markerWidth,
    listOwnerMarkerFont: markerFont,
    listOwnerMarkerColor: markerColor,
    listOwnerMarkerText: markerText,
    listOwnerItemIndex: index,
    listOwnerItemStart: offset,
    listOwnerTaskChecked: taskChecked,
    ...createFragmentContinuationAttrs(continuation),
  };
};

const createListRootOwner = ({ node, listKey, listIndent, settings, mode }) => ({
  key: listKey,
  type: node?.type?.name || "list",
  role: "list",
  nodeId: node?.attrs?.id ?? null,
  x: settings.margin.left,
  width: Math.max(0, settings.pageWidth - settings.margin.left - settings.margin.right),
  fixedBounds: false,
  meta: {
    mode,
    indent: listIndent,
  },
});

const createListItemOwner = ({
  node,
  listKey,
  index,
  offset,
  contentX,
  contentWidth,
  markerGap,
  markerWidth,
  markerFont,
  markerColor,
  markerText,
  lineHeight,
  taskChecked,
}) => ({
  key: `${listKey}:item:${index}:${offset}`,
  type: node?.type?.name || "list",
  role: "list-item",
  nodeId: node?.attrs?.id ?? null,
  x: contentX,
  width: contentWidth,
  anchorOffset: offset,
  fixedBounds: false,
  meta: {
    markerGap,
    markerWidth,
    markerFont,
    markerColor,
    markerText,
    lineHeight,
    taskChecked,
    layoutCapabilities: {
      "content-container": true,
    },
  },
});

const resolveListOwnerMeta = (line) => {
  const attrs = line?.blockAttrs || {};
  if (
    attrs.listOwnerMarkerText &&
    Number.isFinite(attrs.listOwnerMarkerWidth) &&
    attrs.listOwnerMarkerGap != null
  ) {
    return {
      type: attrs.listOwnerType,
      nodeType: attrs.listOwnerNodeType || null,
      blockId: attrs.listOwnerBlockId ?? null,
      indent: Number.isFinite(attrs.listOwnerIndent) ? attrs.listOwnerIndent : null,
      markerGap: attrs.listOwnerMarkerGap,
      markerWidth: attrs.listOwnerMarkerWidth,
      markerFont: attrs.listOwnerMarkerFont || null,
      markerColor: attrs.listOwnerMarkerColor || null,
      markerText: attrs.listOwnerMarkerText,
      itemIndex: Number.isFinite(attrs.listOwnerItemIndex) ? attrs.listOwnerItemIndex : null,
      itemStart: Number.isFinite(attrs.listOwnerItemStart) ? attrs.listOwnerItemStart : null,
      taskChecked: attrs.listOwnerTaskChecked === true,
    };
  }
  if (attrs.markerText && Number.isFinite(attrs.markerWidth) && attrs.markerGap != null) {
    return {
      type: attrs.listType,
      nodeType: attrs.listNodeType || null,
      blockId: attrs.listBlockId ?? null,
      indent: Number.isFinite(attrs.listIndent) ? attrs.listIndent : null,
      markerGap: attrs.markerGap,
      markerWidth: attrs.markerWidth,
      markerFont: attrs.markerFont || null,
      markerColor: attrs.markerColor || null,
      markerText: attrs.markerText,
      itemIndex: Number.isFinite(attrs.itemIndex) ? attrs.itemIndex : null,
      itemStart: Number.isFinite(attrs.listItemStart) ? attrs.listItemStart : null,
      taskChecked: attrs.taskChecked === true,
    };
  }
  return null;
};

const drawResolvedListMarker = ({
  ctx,
  marker,
  contentX,
  lineY,
  lineHeight,
  fallbackFont,
}) => {
  if (!marker) {
    return;
  }
  const fontSpec = marker.font || fallbackFont;
  const fontSize = getFontSize(fontSpec);
  const resolvedLineHeight = Math.max(1, Number(lineHeight) || fontSize);
  const baselineOffset = Math.max(0, (resolvedLineHeight - fontSize) / 2);
  const markerX = contentX - marker.gap - marker.width;
  const markerY = lineY + baselineOffset;

  if (ctx.fillText) {
    ctx.font = fontSpec;
    ctx.fillStyle = marker.color || "#111827";
    ctx.fillText(marker.text, markerX, markerY);
    return;
  }

  if (ctx.fillRect) {
    const size = Math.max(4, Math.round(fontSize * 0.35));
    ctx.fillRect(markerX, markerY + (fontSize - size) / 2, size, size);
  }
};

const drawListMarkerFromFragment = ({
  ctx,
  fragment,
  pageX,
  pageTop,
  fallbackFont,
}: {
  ctx: any;
  fragment: any;
  pageX: number;
  pageTop: number;
  fallbackFont: string;
}) => {
  if (fragment?.role !== "list-item") {
    return;
  }
  const meta = fragment?.meta || null;
  const markerText = typeof meta?.markerText === "string" ? meta.markerText : null;
  const markerWidth = Number.isFinite(meta?.markerWidth) ? Number(meta.markerWidth) : null;
  const markerGap = Number.isFinite(meta?.markerGap) ? Number(meta.markerGap) : null;
  if (!markerText || markerWidth == null || markerGap == null) {
    return;
  }

  const font = meta?.markerFont || fallbackFont;
  const fontSize = getFontSize(font);
  const lineHeight = Number.isFinite(meta?.lineHeight) ? Number(meta.lineHeight) : fontSize;
  const baselineOffset = getBaselineOffset(lineHeight, fontSize);
  const contentX = pageX + (Number(fragment?.x) || 0);
  const lineY = pageTop + (Number(fragment?.y) || 0);
  const markerX = contentX - markerGap - markerWidth;
  const markerY = lineY + baselineOffset;

  if (ctx.fillText) {
    ctx.font = font;
    ctx.fillStyle = meta?.markerColor || "#111827";
    ctx.fillText(markerText, markerX, markerY);
    return;
  }

  if (ctx.fillRect) {
    const size = Math.max(4, Math.round(fontSize * 0.35));
    ctx.fillRect(markerX, markerY + (fontSize - size) / 2, size, size);
  }
};

const layoutList = (node, settings, registry, mode: ListMode) => {
  const lines = [];
  let offset = 0;
  let cursorY = 0;
  const font = settings.font;
  const lineHeight = settings.lineHeight;
  const listIndent = settings.listIndent ?? 24;
  const markerGap = settings.listMarkerGap ?? 8;
  const baseMarkerFont = settings.listMarkerFont || font;
  const blockSpacing = Number.isFinite(settings.blockSpacing) ? settings.blockSpacing : 0;
  const listKey = getNodeFragmentKey(node, `${mode}-list`);
  const listRootOwner = createListRootOwner({
    node,
    listKey,
    listIndent,
    settings,
    mode,
  });

  node.forEach((item, _pos, index) => {
    if (item.type.name !== getExpectedListItemType(mode)) {
      return;
    }

    const markerText =
      mode === "ordered"
        ? `${(node.attrs?.order || 1) + index}.`
        : mode === "task"
          ? getTaskMarkerText(item)
          : "-";
    const markerFont = mode === "task" ? scaleFontSize(baseMarkerFont, 1.35) : baseMarkerFont;
    const markerColor =
      mode === "task" ? (item?.attrs?.checked === true ? "#10b981" : "#64748b") : "#111827";
    const markerWidth = settings.measureTextWidth ? settings.measureTextWidth(markerFont, markerText) : 0;
    const contentIndent = listIndent + markerGap + markerWidth;
    const contentX = settings.margin.left + contentIndent;
    const contentWidth = Math.max(0, settings.pageWidth - contentX - settings.margin.right);
    const listMeta = createListOwnerMeta({
      mode,
      node,
      listKey,
      index,
      offset,
      listIndent,
      markerGap,
      markerWidth,
      markerFont,
      markerColor,
      markerText,
      taskChecked: mode === "task" ? item?.attrs?.checked === true : undefined,
    });

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
      const markerLineHeight =
        Number.isFinite(line?.lineHeight) && Number(line.lineHeight) > 0
          ? Number(line.lineHeight)
          : settings.lineHeight;
      const listItemOwner = createListItemOwner({
        node,
        listKey,
        index,
        offset,
        contentX,
        contentWidth,
        markerGap,
        markerWidth,
        markerFont,
        markerColor,
        markerText,
        lineHeight: markerLineHeight,
        taskChecked: mode === "task" ? item?.attrs?.checked === true : undefined,
      });
      const lineCopy = {
        ...line,
        runs: line.runs ? line.runs.map((run) => ({ ...run })) : line.runs,
        blockType:
          line?.blockAttrs?.sliceGroup === "table" || line?.tableOwnerMeta || line?.tableMeta
            ? "table"
            : line.blockType || node.type.name,
        blockId: line.blockId ?? null,
        blockAttrs: { ...(line.blockAttrs || {}), ...listMeta },
        fragmentOwners: [listRootOwner, listItemOwner, ...(line.fragmentOwners || [])],
      };
      if (lineIndex === 0) {
        lineCopy.listMarker = {
          text: markerText,
          width: markerWidth,
          gap: markerGap,
          font: markerFont,
          color: markerColor,
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

  const blockContinuation = createListContinuation({
    mode,
    node,
    listKey,
    lines,
    fromPrev: false,
    hasNext: false,
    rowSplit: false,
  });

  return {
    lines,
    length: offset,
    height: Math.max(cursorY, lines.length * lineHeight),
    blockType: node.type.name,
    blockAttrs: {
      listOwnerType: mode,
      listOwnerNodeType: node.type.name,
      listOwnerBlockId: node.attrs?.id ?? null,
      listOwnerIndent: listIndent,
      listOwnerMarkerGap: markerGap,
      listOwnerMarkerFont: baseMarkerFont,
      ...createFragmentContinuationAttrs(blockContinuation),
    },
  };
};

export const resolveListMarker = (line, layout) => {
  if (line?.listMarker) {
    return line.listMarker;
  }
  const meta = resolveListOwnerMeta(line);
  if (!meta) {
    return null;
  }
  if (Number.isFinite(meta.itemStart) && Number.isFinite(line?.start) && meta.itemStart !== line.start) {
    return null;
  }
  if (
    !Number.isFinite(meta.itemStart) &&
    line?.blockStart != null &&
    line?.start != null &&
    line.blockStart !== line.start
  ) {
    return null;
  }
  return {
    text: meta.markerText,
    width: meta.markerWidth,
    gap: meta.markerGap,
    font: meta.markerFont || layout.font,
    color: meta.markerColor || "#111827",
  };
};

export const renderListMarker = ({ ctx, line, pageX, pageTop, layout }) => {
  const marker = resolveListMarker(line, layout);
  if (!marker) {
    return;
  }
  drawResolvedListMarker({
    ctx,
    marker,
    contentX: pageX + line.x,
    lineY: pageTop + line.y,
    lineHeight: getLineHeight(line, layout),
    fallbackFont: layout.font,
  });
};

const inferLengthFromLines = (lines) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    return 0;
  }
  let minStart = Number.POSITIVE_INFINITY;
  let maxEnd = Number.NEGATIVE_INFINITY;
  for (const line of lines) {
    if (Number.isFinite(line?.start)) {
      minStart = Math.min(minStart, Number(line.start));
    }
    if (Number.isFinite(line?.end)) {
      maxEnd = Math.max(maxEnd, Number(line.end));
    }
  }
  if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd)) {
    return 0;
  }
  return Math.max(0, maxEnd - minStart);
};

const splitListBlock = ({ lines, length, availableHeight, lineHeight, settings, registry }) => {
  if (!lines || lines.length === 0) {
    return null;
  }

  const getLineHeightValue = (line) =>
    Number.isFinite(line?.lineHeight) ? line.lineHeight : Math.max(1, lineHeight || 1);

  const normalizeLines = (sourceLines) => {
    const normalized = [];
    let fallbackY = 0;
    for (const line of sourceLines || []) {
      const lh = getLineHeightValue(line);
      const relY = Number.isFinite(line?.relativeY) ? Number(line.relativeY) : fallbackY;
      normalized.push({ line, relY, lh, bottom: relY + lh });
      fallbackY = relY + lh;
    }
    return normalized;
  };

  const normalized = normalizeLines(lines);

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

  const buildSplitResult = ({
    visibleLines,
    overflowLines,
    visibleHeight,
    overflowHeight,
    visibleContinuation,
    overflowContinuation,
  }) => {
    const visibleLength = inferLengthFromLines(visibleLines);
    const overflowLength = Math.max(0, length - visibleLength);
    const result: any = {
      lines: visibleLines,
      length: visibleLength,
      height: visibleHeight,
      continuation: visibleContinuation,
      fragments: [
        {
          kind: "visible" as const,
          lines: visibleLines,
          length: visibleLength,
          height: visibleHeight,
          continuation: visibleContinuation,
        },
      ],
    };
    if (overflowLines.length > 0) {
      result.overflow = {
        lines: overflowLines,
        length: overflowLength,
        height: overflowHeight,
        continuation: overflowContinuation,
      };
      result.fragments.push({
        kind: "overflow" as const,
        lines: overflowLines,
        length: overflowLength,
        height: overflowHeight,
        continuation: overflowContinuation,
      });
    }
    return result;
  };

  const getListItemIndex = (line) => {
    const meta = resolveListOwnerMeta(line);
    return meta && Number.isFinite(meta.itemIndex) ? Number(meta.itemIndex) : 0;
  };

  const getBlockGroupKey = (entry, fallbackIndex) => {
    const line = entry?.line;
    const sliceGroup =
      typeof line?.blockAttrs?.sliceGroup === "string" ? String(line.blockAttrs.sliceGroup) : null;
    if (sliceGroup === "table") {
      const tableKey =
        line?.tableOwnerMeta?.tableKey ||
        line?.tableMeta?.tableKey ||
        line?.blockAttrs?.tableKey ||
        line?.blockId ||
        line?.nodeId ||
        fallbackIndex;
      return `table:${String(tableKey)}`;
    }
    if (Number.isFinite(line?.blockStart)) {
      return `start:${Number(line.blockStart)}`;
    }
    if (line?.blockId) {
      return `id:${line.blockId}`;
    }
    return `${line?.blockType || "unknown"}:${fallbackIndex}`;
  };

  const resolveContinuation = (splitResult, kind, fallback) => {
    const fragments = resolveNodeSplitFragments(splitResult);
    const fragment = kind === "visible" ? fragments.visible : fragments.overflow;
    return fragment?.continuation || fallback;
  };

  const groups = [];
  let currentIndex = null;
  let currentEntries = [];
  for (const entry of normalized) {
    const index = getListItemIndex(entry?.line);
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
    const firstGroup = groups[0];
    if (firstGroup?.entries?.length) {
      const blockGroups = [];
      let currentBlockKey = null;
      let currentBlockEntries = [];
      for (let index = 0; index < firstGroup.entries.length; index += 1) {
        const entry = firstGroup.entries[index];
        const blockKey = getBlockGroupKey(entry, index);
        if (currentBlockKey === null) {
          currentBlockKey = blockKey;
        }
        if (blockKey !== currentBlockKey) {
          blockGroups.push({
            entries: currentBlockEntries,
            top: currentBlockEntries[0].relY,
            bottom: currentBlockEntries[currentBlockEntries.length - 1].bottom,
          });
          currentBlockEntries = [];
          currentBlockKey = blockKey;
        }
        currentBlockEntries.push(entry);
      }
      if (currentBlockEntries.length) {
        blockGroups.push({
          entries: currentBlockEntries,
          top: currentBlockEntries[0].relY,
          bottom: currentBlockEntries[currentBlockEntries.length - 1].bottom,
        });
      }

      let blockCutIndex = 0;
      for (; blockCutIndex < blockGroups.length; blockCutIndex += 1) {
        const nextHeight = blockGroups[blockCutIndex].bottom - blockGroups[0].top;
        if (nextHeight > availableHeight) {
          break;
        }
      }

      if (blockCutIndex > 0 && blockCutIndex < blockGroups.length) {
        const visibleEntries = blockGroups.slice(0, blockCutIndex).flatMap((group) => group.entries);
        const overflowEntries = blockGroups.slice(blockCutIndex).flatMap((group) => group.entries);
        const visible = cloneAndNormalize(visibleEntries);
        const overflow = cloneAndNormalize(overflowEntries);
        return buildSplitResult({
          visibleLines: visible.lines,
          overflowLines: overflow.lines,
          visibleHeight: visible.height,
          overflowHeight: overflow.height,
          visibleContinuation: {
            fromPrev: false,
            hasNext: overflow.lines.length > 0,
            rowSplit: false,
          },
          overflowContinuation: overflow.lines.length
            ? {
                fromPrev: true,
                hasNext: false,
                rowSplit: false,
              }
            : null,
        });
      }

      const firstBlockGroup = blockGroups[0];
      const firstBlockLines = firstBlockGroup?.entries?.map((entry) => entry.line) || [];
      const firstBlockSliceGroup =
        typeof firstBlockLines[0]?.blockAttrs?.sliceGroup === "string"
          ? String(firstBlockLines[0].blockAttrs.sliceGroup)
          : null;
      const firstBlockType =
        firstBlockSliceGroup === "table" || firstBlockLines[0]?.tableOwnerMeta || firstBlockLines[0]?.tableMeta
          ? "table"
          : firstBlockLines[0]?.blockType;
      const childRenderer = firstBlockType ? registry?.get(firstBlockType) : null;
      const childFragmentModel = resolveRendererFragmentModel(childRenderer);
      if (
        childFragmentModel === "continuation" &&
        childRenderer?.splitBlock &&
        firstBlockLines.length > 0
      ) {
        const delegated = childRenderer.splitBlock({
          lines: firstBlockLines,
          length: inferLengthFromLines(firstBlockLines),
          height: Math.max(0, firstBlockGroup.bottom - firstBlockGroup.top),
          availableHeight,
          lineHeight,
          settings,
          registry,
          blockAttrs: firstBlockLines[0]?.blockAttrs || null,
        });
        if (delegated) {
          const delegatedFragments = resolveNodeSplitFragments(delegated);
          const visibleSource = Array.isArray(delegatedFragments.visible?.lines)
            ? delegatedFragments.visible.lines
            : [];
          const visibleNormalized = cloneAndNormalize(normalizeLines(visibleSource));
          const overflowSource = Array.isArray(delegatedFragments.overflow?.lines)
            ? delegatedFragments.overflow.lines
            : [];
          const overflowNormalized = cloneAndNormalize(normalizeLines(overflowSource));
          const overflowLines = [...overflowNormalized.lines];
          let overflowCursorY = overflowNormalized.height;

          for (const group of blockGroups.slice(1)) {
            const normalizedGroup = cloneAndNormalize(group.entries);
            overflowLines.push(
              ...normalizedGroup.lines.map((line) => ({
                ...line,
                runs: line.runs ? line.runs.map((run) => ({ ...run })) : line.runs,
                relativeY: (Number.isFinite(line.relativeY) ? line.relativeY : 0) + overflowCursorY,
              }))
            );
            overflowCursorY += normalizedGroup.height;
          }

          return buildSplitResult({
            visibleLines: visibleNormalized.lines,
            overflowLines,
            visibleHeight: Number.isFinite(delegatedFragments.visible?.height)
              ? Math.max(0, Number(delegatedFragments.visible?.height))
              : visibleNormalized.height,
            overflowHeight: overflowCursorY,
            visibleContinuation: resolveContinuation(delegated, "visible", {
              fromPrev: false,
              hasNext: overflowLines.length > 0,
              rowSplit: false,
            }),
            overflowContinuation: overflowLines.length
              ? resolveContinuation(delegated, "overflow", {
                  fromPrev: true,
                  hasNext: false,
                  rowSplit: false,
                })
              : null,
          });
        }
      }
    }

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
    return buildSplitResult({
      visibleLines: visible.lines,
      overflowLines: overflow.lines,
      visibleHeight: visible.height,
      overflowHeight: overflow.height,
      visibleContinuation: {
        fromPrev: false,
        hasNext: overflow.lines.length > 0,
        rowSplit: false,
      },
      overflowContinuation: overflow.lines.length
        ? {
            fromPrev: true,
            hasNext: false,
            rowSplit: false,
          }
        : null,
    });
  }

  const visibleEntries = groups.slice(0, cutIndex).flatMap((group) => group.entries);
  const overflowEntries = groups.slice(cutIndex).flatMap((group) => group.entries);
  const visible = cloneAndNormalize(visibleEntries);
  const overflow = cloneAndNormalize(overflowEntries);

  return buildSplitResult({
    visibleLines: visible.lines,
    overflowLines: overflow.lines,
    visibleHeight: visible.height,
    overflowHeight: overflow.height,
    visibleContinuation: {
      fromPrev: false,
      hasNext: overflow.lines.length > 0,
      rowSplit: false,
    },
    overflowContinuation: overflow.lines.length
      ? {
          fromPrev: true,
          hasNext: false,
          rowSplit: false,
        }
      : null,
  });
};

const createListRenderer = (mode: ListMode) => ({
  allowSplit: true,
  lineBodyMode: "default-text",
  listMarkerRenderMode: "fragment",
  splitBlock(ctx) {
    const result = splitListBlock(ctx);
    if (!result) {
      return result;
    }

    const lines = Array.isArray(ctx?.lines) ? ctx.lines : [];
    const attrs = ctx?.blockAttrs || lines[0]?.blockAttrs || {};
    const listNode = {
      attrs: {
        id: attrs.listOwnerBlockId ?? attrs.listBlockId ?? null,
      },
    };
    const listKey =
      typeof attrs.fragmentIdentity === "string" && attrs.fragmentIdentity.startsWith("list:")
        ? attrs.fragmentIdentity.slice("list:".length)
        : getListContinuationOwnerKey({
            node: listNode,
            listKey: attrs.listOwnerBlockId ?? attrs.listBlockId ?? "list",
          });
    const delegatedVisible = createDelegatedChildContinuation(
      Array.isArray(ctx?.lines) ? ctx.lines[0] : null,
      result.continuation
    );
    const delegatedOverflow = createDelegatedChildContinuation(
      Array.isArray(result?.overflow?.lines) ? result.overflow.lines[0] : null,
      result?.overflow?.continuation
    );

    const visibleContinuation = createListContinuation({
      mode,
      node: listNode,
      listKey,
      lines: result.lines,
      fromPrev: result.continuation?.fromPrev === true,
      hasNext: result.continuation?.hasNext === true,
      rowSplit: result.continuation?.rowSplit === true,
      delegatedChild: delegatedVisible,
    });
    const overflowContinuation =
      result.overflow && Array.isArray(result.overflow.lines) && result.overflow.lines.length > 0
        ? createListContinuation({
            mode,
            node: listNode,
            listKey,
            lines: result.overflow.lines,
            fromPrev: result.overflow.continuation?.fromPrev === true,
            hasNext: result.overflow.continuation?.hasNext === true,
            rowSplit: result.overflow.continuation?.rowSplit === true,
            delegatedChild: delegatedOverflow,
          })
        : null;

    return {
      ...result,
      continuation: visibleContinuation,
      fragments: Array.isArray(result.fragments)
        ? result.fragments.map((fragment) =>
            fragment?.kind === "overflow"
              ? { ...fragment, continuation: overflowContinuation }
              : { ...fragment, continuation: visibleContinuation }
          )
        : result.fragments,
      overflow: result.overflow
        ? {
            ...result.overflow,
            continuation: overflowContinuation,
          }
        : result.overflow,
    };
  },
  measureBlock(ctx: any) {
    const { node, settings, registry } = ctx || {};
    const layout = layoutList(node, settings, registry, mode);
    const startPos = Number.isFinite(ctx?.startPos ?? ctx?.blockStart)
      ? Number(ctx?.startPos ?? ctx?.blockStart)
      : 0;
    return {
      kind: node?.type?.name || `${mode}List`,
      nodeId: node?.attrs?.id ?? null,
      blockId: node?.attrs?.id ?? null,
      startPos,
      endPos: startPos + Math.max(0, Number(layout?.length || 0)),
      width: Math.max(
        0,
        Number(settings?.pageWidth || 0) - Number(settings?.margin?.left || 0) - Number(settings?.margin?.right || 0),
      ),
      height: Number.isFinite(layout?.height) ? Number(layout.height) : null,
      meta: {
        source: "list-modern-measure",
        layoutSnapshot: {
          lines: Array.isArray(layout?.lines) ? layout.lines : [],
          length: Math.max(0, Number(layout?.length || 0)),
          height: Number.isFinite(layout?.height) ? Number(layout.height) : 0,
          blockAttrs: layout?.blockAttrs || null,
          continuation: (layout as any)?.continuation || null,
        },
      },
    };
  },
  paginateBlock(ctx: any) {
    const measured = ctx?.measured;
    const fullSnapshot = measured?.meta?.layoutSnapshot || null;
    const currentSnapshot = ctx?.cursor?.localCursor?.snapshot || fullSnapshot;
    if (!currentSnapshot || !Array.isArray(currentSnapshot.lines)) {
      return null;
    }

    const splitResult = this.splitBlock({
      lines: currentSnapshot.lines,
      length: currentSnapshot.length,
      availableHeight: ctx?.availableHeight,
      lineHeight: ctx?.lineHeight,
      settings: ctx?.settings,
      registry: ctx?.registry,
      blockAttrs: currentSnapshot.blockAttrs,
    });
    if (!splitResult) {
      return null;
    }

    const visibleLength = Math.max(0, Number(splitResult?.length || 0));
    const sliceStartPos = Number(ctx?.cursor?.startPos ?? measured?.startPos ?? 0);
    const sliceEndPos = sliceStartPos + visibleLength;
    const overflowSnapshot = splitResult?.overflow
      ? {
          lines: splitResult.overflow.lines,
          length: Math.max(0, Number(splitResult.overflow.length || 0)),
          height: Number.isFinite(splitResult.overflow.height) ? Number(splitResult.overflow.height) : 0,
          blockAttrs: currentSnapshot.blockAttrs,
          continuation: splitResult.overflow.continuation || null,
          startPos: sliceEndPos,
          endPos: Number(measured?.endPos ?? sliceEndPos),
        }
      : null;
    const nextCursor = overflowSnapshot
      ? {
          nodeId: measured?.nodeId ?? null,
          blockId: measured?.blockId ?? null,
          startPos: overflowSnapshot.startPos,
          endPos: overflowSnapshot.endPos,
          localCursor: {
            kind: "list-snapshot",
            snapshot: overflowSnapshot,
          },
          meta: {
            source: "list-modern-paginate",
            fragmentIdentity: overflowSnapshot.continuation?.fragmentIdentity ?? null,
            continuationToken: overflowSnapshot.continuation?.continuationToken ?? null,
          },
        }
      : null;

    return {
      slice: {
        kind: measured?.kind || `${mode}List`,
        nodeId: measured?.nodeId ?? null,
        blockId: measured?.blockId ?? null,
        startPos: sliceStartPos,
        endPos: sliceEndPos,
        fromPrev: splitResult?.continuation?.fromPrev === true,
        hasNext: splitResult?.continuation?.hasNext === true || !!nextCursor,
        rowSplit: splitResult?.continuation?.rowSplit === true,
        boxes: [],
        fragments: [],
        lines: Array.isArray(splitResult?.lines) ? splitResult.lines : [],
        nextCursor,
        meta: {
          source: "list-modern-paginate",
          continuation: splitResult?.continuation || null,
          overflowLength: Number(splitResult?.overflow?.length || 0),
        },
      },
      nextCursor,
      exhausted: !nextCursor,
    };
  },
  pagination: {
    fragmentModel: "continuation",
    reusePolicy: "actual-slice-only",
  },
  layoutBlock({ node, settings, registry }) {
    return layoutList(node, settings, registry, mode);
  },
  renderFragment({ ctx, fragment, pageX, pageTop, layout }) {
    drawListMarkerFromFragment({
      ctx,
      fragment,
      pageX,
      pageTop,
      fallbackFont: layout?.font || "16px sans-serif",
    });
  },
});

export const bulletListRenderer = createListRenderer("bullet");
export const orderedListRenderer = createListRenderer("ordered");
export const taskListRenderer = createListRenderer("task");











