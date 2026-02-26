/*
 * 分页布局管线。
 */

import { docToRuns, textblockToRuns, textToRuns } from "./textRuns";
import { breakLines } from "./lineBreaker";

const now = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

// 变更摘要：用于增量布局复用。
type LayoutChangeSummary = {
  docChanged?: boolean;
  oldRange?: { from?: number | null; to?: number | null };
  newRange?: { from?: number | null; to?: number | null };
  blocks?: {
    before?: { fromIndex?: number | null; toIndex?: number | null };
    after?: { fromIndex?: number | null; toIndex?: number | null };
  };
};

// 布局输出：分页结果 + 版式参数。
type LayoutResult = {
  pages: Array<{ lines: any[] }>;
  pageHeight: number;
  pageWidth: number;
  pageGap: number;
  margin: { left: number; right: number; top: number; bottom: number };
  lineHeight: number;
  font: string;
  totalHeight: number;
};

// 布局输入：上一版布局 + 变更摘要。
type LayoutFromDocOptions = {
  previousLayout?: LayoutResult | null;
  changeSummary?: LayoutChangeSummary | null;
  docPosToTextOffset?: (doc: any, pos: number) => number;
  progressiveMaxPages?: number | null;
};

// 创建新的分页容器。
function newPage(index) {
  return { index, lines: [], rootIndexMin: null, rootIndexMax: null };
}

// 标记复用页，渲染阶段可跳过签名计算。
const markReusedPages = (pages) => {
  if (!Array.isArray(pages)) {
    return pages;
  }
  for (const page of pages) {
    if (page) {
      page.__reused = true;
    }
  }
  return pages;
};

// 克隆行对象，避免引用共享。
const cloneLine = (line) => ({
  ...line,
  runs: line.runs ? line.runs.map((run) => ({ ...run })) : line.runs,
});

// 计算行的水平位置（对齐 + 首行缩进）。
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

// 将块内偏移转换为文档全局偏移。
const adjustLineOffsets = (line, blockStart) => {
  if (typeof line.start === "number") {
    line.start += blockStart;
  }

  if (typeof line.end === "number") {
    line.end += blockStart;
  }

  if (line.runs) {
    for (const run of line.runs) {
      if (typeof run.start === "number") {
        run.start += blockStart;
      }

      if (typeof run.end === "number") {
        run.end += blockStart;
      }
    }
  }

  if (line.blockStart == null) {
    line.blockStart = blockStart;
  }

  return line;
};

// 根据缩进生成新的布局设置。
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

const resolveLineHeight = (line, fallback) =>
  Number.isFinite(line?.lineHeight) && Number(line.lineHeight) > 0
    ? Number(line.lineHeight)
    : Math.max(1, Number(fallback) || 1);

const measureLinesHeight = (lines, fallbackLineHeight) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    return 0;
  }
  let usedRelativeY = false;
  let maxBottom = 0;
  let cursor = 0;
  for (const line of lines) {
    const lineHeight = resolveLineHeight(line, fallbackLineHeight);
    if (Number.isFinite(line?.relativeY)) {
      usedRelativeY = true;
      maxBottom = Math.max(maxBottom, Number(line.relativeY) + lineHeight);
      continue;
    }
    cursor += lineHeight;
  }
  return usedRelativeY ? maxBottom : cursor;
};

const getFittableLineCount = (lines, availableHeight, fallbackLineHeight) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    return 0;
  }
  const limit = Number(availableHeight);
  if (!Number.isFinite(limit) || limit <= 0) {
    return 0;
  }
  let consumed = 0;
  let count = 0;
  for (const line of lines) {
    const lineHeight = resolveLineHeight(line, fallbackLineHeight);
    if (count > 0 && consumed + lineHeight > limit) {
      break;
    }
    if (count === 0 && lineHeight > limit) {
      return 0;
    }
    consumed += lineHeight;
    count += 1;
  }
  return count;
};

// Normalize line.relativeY within a split chunk so follow-up pages start from chunk top.
const normalizeChunkRelativeY = (lines) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    return lines;
  }
  let base = null;
  for (const line of lines) {
    if (Number.isFinite(line?.relativeY)) {
      base = Number(line.relativeY);
      break;
    }
  }
  if (!Number.isFinite(base) || Number(base) === 0) {
    return lines;
  }
  return lines.map((line) => {
    if (!line || !Number.isFinite(line.relativeY)) {
      return line;
    }
    return {
      ...line,
      relativeY: Number(line.relativeY) - Number(base),
    };
  });
};

// 数值哈希，用于页签名。
const hashNumber = (hash, value) => {
  const num = Number.isFinite(value) ? Math.round(value) : 0;
  return (hash * 31 + num) | 0;
};

// 字符串哈希，用于页签名。
const hashString = (hash, value) => {
  if (!value) {
    return hash;
  }
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return hash;
};

const objectIdentityTokens = new WeakMap<object, number>();
let nextObjectIdentityToken = 1;

const getObjectIdentityToken = (value) => {
  const obj = value as object;
  if (objectIdentityTokens.has(obj)) {
    return objectIdentityTokens.get(obj) || 0;
  }
  const token = nextObjectIdentityToken++;
  objectIdentityTokens.set(obj, token);
  return token;
};

const hashCacheSignatureValue = (hash, value) => {
  if (value == null) {
    return hashString(hash, "null");
  }
  if (typeof value === "string") {
    return hashString(hash, value);
  }
  if (typeof value === "number") {
    return hashNumber(hash, value);
  }
  if (typeof value === "boolean") {
    return hashNumber(hash, value ? 1 : 0);
  }
  if (typeof value === "bigint") {
    return hashString(hash, value.toString());
  }
  if (Array.isArray(value)) {
    let next = hashNumber(hash, value.length);
    for (const item of value) {
      next = hashCacheSignatureValue(next, item);
    }
    return next;
  }
  if (typeof value === "object" || typeof value === "function") {
    return hashNumber(hash, getObjectIdentityToken(value));
  }
  return hashString(hash, String(value));
};

// 将任意 attrs 结构归一化后参与哈希，保证缓存签名稳定。
const hashAttrs = (hash, attrs) => {
  if (!attrs || typeof attrs !== "object") {
    return hash;
  }
  const keys = Object.keys(attrs).sort();
  for (const key of keys) {
    hash = hashString(hash, key);
    const value = attrs[key];
    if (typeof value === "string") {
      hash = hashString(hash, value);
      continue;
    }
    if (typeof value === "number") {
      hash = hashNumber(hash, value);
      continue;
    }
    if (typeof value === "boolean") {
      hash = hashNumber(hash, value ? 1 : 0);
      continue;
    }
    if (Array.isArray(value)) {
      hash = hashNumber(hash, value.length);
      for (const item of value) {
        if (typeof item === "string") {
          hash = hashString(hash, item);
        } else if (typeof item === "number") {
          hash = hashNumber(hash, item);
        } else if (typeof item === "boolean") {
          hash = hashNumber(hash, item ? 1 : 0);
        } else if (item != null) {
          hash = hashString(hash, JSON.stringify(item));
        }
      }
      continue;
    }
    if (value == null) {
      hash = hashString(hash, "null");
      continue;
    }
    hash = hashString(hash, JSON.stringify(value));
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

const getObjectSignature = (value, cache) => {
  if (!value || typeof value !== "object") {
    return 0;
  }
  if (cache?.has(value)) {
    return cache.get(value) || 0;
  }
  const signature = hashObjectLike(17, value, cache) >>> 0;
  cache?.set(value, signature);
  return signature;
};

// 计算块布局签名：用于缓存命中判断（不依赖节点对象引用）。
const getBlockLayoutSignature = (block, settings, indent, renderer, registry) => {
  let hash = 17;
  const blockHash =
    block && typeof block.hashCode === "function" ? Number(block.hashCode()) : Number.NaN;
  if (Number.isFinite(blockHash)) {
    hash = hashNumber(hash, blockHash);
  } else {
    hash = hashString(hash, block?.type?.name || "");
    hash = hashAttrs(hash, block?.attrs || null);
    hash = hashNumber(hash, block?.nodeSize);
    hash = hashNumber(hash, block?.childCount);
    hash = hashString(hash, block?.textContent || "");
  }
  hash = hashNumber(hash, indent || 0);
  hash = hashNumber(hash, settings?.pageWidth);
  hash = hashNumber(hash, settings?.lineHeight);
  hash = hashString(hash, settings?.font || "");
  const getCacheSignature = renderer?.getCacheSignature;
  if (typeof getCacheSignature === "function") {
    try {
      const customSignature = getCacheSignature({
        node: block,
        settings,
        registry,
        indent,
      });
      hash = hashString(hash, "__custom_cache_signature__");
      hash = hashCacheSignatureValue(hash, customSignature);
    } catch (_error) {
      // Custom signatures are optional; ignore signature hook failures.
    }
  }
  return hash >>> 0;
};

// 生成页签名，用于判断页是否等价。
// 当用于复用判等时，避免依赖绝对文档偏移（start/end 等），
// 否则一次局部插入会导致后续页面全部偏移变化而无法命中复用。
const getPageSignature = (page, offsetDelta = 0, includeAbsoluteOffsets = true) => {
  const shift = (value) =>
    Number.isFinite(value) ? Number(value) + Number(offsetDelta || 0) : value;
  const objectSignatureCache = new WeakMap();
  let hash = 0;
  if (!page?.lines) {
    return hash;
  }
  for (const line of page.lines) {
    if (includeAbsoluteOffsets) {
      hash = hashNumber(hash, shift(line.start));
      hash = hashNumber(hash, shift(line.end));
      hash = hashNumber(hash, shift(line.blockStart));
    }
    hash = hashNumber(hash, line.x);
    hash = hashNumber(hash, line.y);
    hash = hashNumber(hash, line.width);
    hash = hashNumber(hash, line.lineHeight);
    hash = hashNumber(hash, line.blockSignature);
    hash = hashString(hash, line.blockType || "");
    hash = hashString(hash, line.blockId || "");
    hash = hashString(hash, line.text || "");
    hash = hashNumber(hash, getObjectSignature(line.blockAttrs || null, objectSignatureCache));
    hash = hashNumber(hash, getObjectSignature(line.tableMeta || null, objectSignatureCache));
    if (line.runs) {
      for (const run of line.runs) {
        if (includeAbsoluteOffsets) {
          hash = hashNumber(hash, shift(run.start));
          hash = hashNumber(hash, shift(run.end));
        }
        hash = hashString(hash, run.text || "");
        hash = hashString(hash, run.font || "");
        hash = hashString(hash, run.color || "");
        hash = hashNumber(hash, run.underline ? 1 : 0);
      }
    }
  }
  return hash;
};

// 判断页面是否等价（行数 + 签名）。
const arePagesEquivalent = (nextPage, prevPage, debug, offsetDelta = 0) => {
  if (!nextPage || !prevPage) {
    if (debug) {
      debug.reason = "missing-page";
    }
    return false;
  }
  const nextLines = nextPage.lines || [];
  const prevLines = prevPage.lines || [];
  if (nextLines.length !== prevLines.length) {
    if (debug) {
      debug.reason = "line-count";
      debug.nextLines = nextLines.length;
      debug.prevLines = prevLines.length;
    }
    return false;
  }
  const nextSig = getPageSignature(nextPage, 0, false);
  const prevSig = getPageSignature(prevPage, offsetDelta, false);
  if (nextSig !== prevSig && debug) {
    debug.reason = "signature";
    debug.nextSig = nextSig;
    debug.prevSig = prevSig;
    const sample = [];
    for (let i = 0; i < Math.min(3, nextLines.length); i += 1) {
      sample.push({
        index: i,
        next: {
          start: nextLines[i]?.start,
          end: nextLines[i]?.end,
          blockStart: nextLines[i]?.blockStart,
          x: nextLines[i]?.x,
          y: nextLines[i]?.y,
          width: nextLines[i]?.width,
          lineHeight: nextLines[i]?.lineHeight,
          blockType: nextLines[i]?.blockType,
          blockId: nextLines[i]?.blockId,
          text: nextLines[i]?.text,
        },
        prev: {
          start:
            Number.isFinite(prevLines[i]?.start) && Number.isFinite(offsetDelta)
              ? prevLines[i]?.start + offsetDelta
              : prevLines[i]?.start,
          end:
            Number.isFinite(prevLines[i]?.end) && Number.isFinite(offsetDelta)
              ? prevLines[i]?.end + offsetDelta
              : prevLines[i]?.end,
          blockStart:
            Number.isFinite(prevLines[i]?.blockStart) && Number.isFinite(offsetDelta)
              ? prevLines[i]?.blockStart + offsetDelta
              : prevLines[i]?.blockStart,
          x: prevLines[i]?.x,
          y: prevLines[i]?.y,
          width: prevLines[i]?.width,
          lineHeight: prevLines[i]?.lineHeight,
          blockType: prevLines[i]?.blockType,
          blockId: prevLines[i]?.blockId,
          text: prevLines[i]?.text,
        },
      });
    }
    debug.sample = sample;
  }
  return nextSig === prevSig;
};

const shiftLineOffsets = (line, offsetDelta) => {
  const next = { ...line };
  if (Number.isFinite(next.start)) {
    next.start += offsetDelta;
  }
  if (Number.isFinite(next.end)) {
    next.end += offsetDelta;
  }
  if (Number.isFinite(next.blockStart)) {
    next.blockStart += offsetDelta;
  }
  if (Array.isArray(next.runs) && next.runs.length > 0) {
    next.runs = next.runs.map((run) => {
      const nextRun = { ...run };
      if (Number.isFinite(nextRun.start)) {
        nextRun.start += offsetDelta;
      }
      if (Number.isFinite(nextRun.end)) {
        nextRun.end += offsetDelta;
      }
      return nextRun;
    });
  }
  return next;
};

const cloneAndShiftPages = (pages, offsetDelta) => {
  if (!Array.isArray(pages) || pages.length === 0) {
    return [];
  }
  if (!Number.isFinite(offsetDelta) || Number(offsetDelta) === 0) {
    return pages.map((page) => ({
      ...page,
      lines: Array.isArray(page?.lines) ? page.lines.map((line) => ({ ...line })) : [],
    }));
  }
  return pages.map((page) => ({
    ...page,
    lines: Array.isArray(page?.lines)
      ? page.lines.map((line) => shiftLineOffsets(line, Number(offsetDelta)))
      : [],
  }));
};

// 在旧布局中定位锚点行（增量复用）。
const findBlockAnchor = (layout, options) => {
  if (!layout?.pages?.length) {
    return null;
  }
  const rootIndex = options?.rootIndex;
  const blockId = options?.blockId;
  const blockStart = options?.blockStart;
  for (let p = 0; p < layout.pages.length; p += 1) {
    const page = layout.pages[p];
    for (let l = 0; l < page.lines.length; l += 1) {
      const line = page.lines[l];
      if (blockId && line.blockId === blockId) {
        return { pageIndex: p, lineIndex: l, line };
      }
      if (Number.isFinite(blockStart) && line.blockStart === blockStart) {
        return { pageIndex: p, lineIndex: l, line };
      }
      if (Number.isFinite(rootIndex) && line.rootIndex === rootIndex) {
        return { pageIndex: p, lineIndex: l, line };
      }
    }
  }
  return null;
};

// 查找块在旧布局中的首次出现位置（用于跨页块回退对齐）。
const findBlockFirstOccurrence = (layout, options) => {
  if (!layout?.pages?.length) {
    return null;
  }
  const rootIndex = options?.rootIndex;
  const blockId = options?.blockId;
  const blockStart = options?.blockStart;
  for (let p = 0; p < layout.pages.length; p += 1) {
    const page = layout.pages[p];
    for (let l = 0; l < page.lines.length; l += 1) {
      const line = page.lines[l];
      if (blockId && line.blockId === blockId) {
        return { pageIndex: p, lineIndex: l, line };
      }
      if (Number.isFinite(blockStart) && line.blockStart === blockStart) {
        return { pageIndex: p, lineIndex: l, line };
      }
      if (Number.isFinite(rootIndex) && line.rootIndex === rootIndex) {
        return { pageIndex: p, lineIndex: l, line };
      }
    }
  }
  return null;
};

// 计算顶层块的起始文档位置。
const getDocChildStartPos = (doc, targetIndex) => {
  let pos = 0;
  for (let i = 0; i < targetIndex && i < doc.childCount; i += 1) {
    pos += doc.child(i).nodeSize;
  }
  return pos;
};

const defaultIsReuseSensitiveNode = (node) => node?.type?.name === "table";

const defaultIsReuseSensitiveLine = (line) => line?.blockType === "table";

const hasTopLevelSensitiveNodeInRange = (doc, fromIndex, toIndex, isSensitiveNode) => {
  if (!doc || !Number.isFinite(fromIndex) || !Number.isFinite(toIndex)) {
    return false;
  }
  const from = Math.max(0, Math.min(doc.childCount - 1, fromIndex));
  const to = Math.max(0, Math.min(doc.childCount - 1, toIndex));
  if (to < from) {
    return false;
  }
  for (let i = from; i <= to; i += 1) {
    if (isSensitiveNode(doc.child(i)) === true) {
      return true;
    }
  }
  return false;
};

const hasAnyTopLevelSensitiveNode = (doc, isSensitiveNode) => {
  if (!doc?.childCount) {
    return false;
  }
  for (let i = 0; i < doc.childCount; i += 1) {
    if (isSensitiveNode(doc.child(i)) === true) {
      return true;
    }
  }
  return false;
};

const previousLayoutHasSensitiveLine = (previousLayout, isSensitiveLine) => {
  const pages = previousLayout?.pages;
  if (!Array.isArray(pages)) {
    return false;
  }
  for (const page of pages) {
    for (const line of page?.lines || []) {
      if (isSensitiveLine(line) === true) {
        return true;
      }
    }
  }
  return false;
};

const previousLayoutHasSensitiveLineInRange = (
  previousLayout,
  fromIndex,
  toIndex,
  isSensitiveLine
) => {
  const pages = previousLayout?.pages;
  if (!Array.isArray(pages) || !Number.isFinite(fromIndex) || !Number.isFinite(toIndex)) {
    return false;
  }
  const from = Math.min(Number(fromIndex), Number(toIndex));
  const to = Math.max(Number(fromIndex), Number(toIndex));
  for (const page of pages) {
    for (const line of page?.lines || []) {
      const rootIndex = line?.rootIndex;
      if (!Number.isFinite(rootIndex) || rootIndex < from || rootIndex > to) {
        continue;
      }
      if (isSensitiveLine(line) === true) {
        return true;
      }
    }
  }
  return false;
};

const shouldDisableReuseForSensitiveChange = (
  doc,
  changeSummary,
  previousLayout,
  options: {
    isSensitiveNode?: (node: any) => boolean;
    isSensitiveLine?: (line: any) => boolean;
  } = {}
) => {
  const isSensitiveNode =
    typeof options?.isSensitiveNode === "function"
      ? options.isSensitiveNode
      : defaultIsReuseSensitiveNode;
  const isSensitiveLine =
    typeof options?.isSensitiveLine === "function"
      ? options.isSensitiveLine
      : defaultIsReuseSensitiveLine;
  if (!changeSummary?.docChanged) {
    return false;
  }
  const before = changeSummary.blocks?.before || {};
  const after = changeSummary.blocks?.after || {};
  const candidates = [before.fromIndex, before.toIndex, after.fromIndex, after.toIndex].filter(
    (value) => Number.isFinite(value)
  );

  if (candidates.length === 0) {
    return false;
  }

  const minIndex = Math.min(...candidates);
  const maxIndex = Math.max(...candidates);
  if (hasTopLevelSensitiveNodeInRange(doc, minIndex, maxIndex, isSensitiveNode)) {
    return true;
  }
  // Handle sensitive-structure deletion: new doc range may miss removed nodes, so inspect old range only.
  const beforeFrom = Number.isFinite(before.fromIndex) ? Number(before.fromIndex) : null;
  const beforeTo = Number.isFinite(before.toIndex) ? Number(before.toIndex) : null;
  if (beforeFrom == null || beforeTo == null) {
    return false;
  }
  return previousLayoutHasSensitiveLineInRange(
    previousLayout,
    beforeFrom,
    beforeTo,
    isSensitiveLine
  );
};

export class LayoutPipeline {
  settings;
  registry;
  blockCache;

  // 初始化分页布局管线。
  constructor(settings, registry = null) {
    this.settings = settings;
    this.registry = registry;
    this.blockCache = new Map();
  }

  // 根据 block id 清理缓存。
  invalidateBlocks(ids = []) {
    for (const id of ids) {
      if (!id) {
        continue;
      }
      const prefix = `${id}:`;
      for (const key of this.blockCache.keys()) {
        if (key === id || String(key).startsWith(prefix)) {
          this.blockCache.delete(key);
        }
      }
    }
  }

  // 清空布局缓存。
  clearCache() {
    this.blockCache.clear();
  }

  // 分页布局主入口：生成布局并尝试增量复用。
  layoutFromDoc(doc, options: LayoutFromDocOptions = {}) {
    // 基础设置（保留原引用用于性能汇报）。
    const baseSettingsRaw = this.settings;
    let disablePageReuse = !!baseSettingsRaw.disablePageReuse;
    if (!disablePageReuse) {
      const changeSummary = options?.changeSummary ?? null;
      const previousLayout = options?.previousLayout ?? null;
      const defaultDecision = shouldDisableReuseForSensitiveChange(
        doc,
        changeSummary,
        previousLayout
      );
      const customGuard = baseSettingsRaw?.shouldDisablePageReuseForChange;
      if (typeof customGuard === "function") {
        try {
          const customDecision = customGuard({
            doc,
            changeSummary,
            previousLayout,
            defaultDecision,
            shouldDisableReuseForSensitiveChange,
          });
          if (customDecision === true || customDecision === false) {
            disablePageReuse = customDecision;
          } else {
            disablePageReuse = defaultDecision;
          }
        } catch (_error) {
          disablePageReuse = defaultDecision;
        }
      } else {
        disablePageReuse = defaultDecision;
      }
    }
    const debugPerf = !!baseSettingsRaw.debugPerf;
    // 性能统计（可选）。
    const perf = debugPerf
      ? {
          start: now(),
          blocks: 0,
          cachedBlocks: 0,
          lines: 0,
          pages: 0,
          measureCalls: 0,
          measureChars: 0,
          reusedPages: 0,
          breakLinesMs: 0,
          layoutLeafMs: 0,
          reuseReason: "unknown",
          syncAfterIndex: null,
          canSync: false,
          passedChangedRange: false,
          syncFromIndex: null,
          resumeFromAnchor: false,
          maybeSyncReason: "unknown",
          disablePageReuse: false,
          optionsPrevPages: 0,
          maybeSyncCalled: false,
          maybeSyncFailSnapshot: null,
        }
      : null;
    // 包装测量函数以统计调用次数。
    const baseMeasure = baseSettingsRaw.measureTextWidth;
    const measureTextWidth = debugPerf
      ? (font, text) => {
          perf.measureCalls += 1;
          perf.measureChars += text ? text.length : 0;
          return baseMeasure(font, text);
        }
      : baseMeasure;
    // 布局过程中使用的设置。
    const baseSettings = debugPerf ? { ...baseSettingsRaw, measureTextWidth } : baseSettingsRaw;
    // 固定版式参数。
    const { pageHeight, pageGap, margin, lineHeight, font } = baseSettings;
    const blockSpacing = Number.isFinite(baseSettings.blockSpacing) ? baseSettings.blockSpacing : 0;
    const paragraphSpacingBefore = Number.isFinite(baseSettings.paragraphSpacingBefore)
      ? baseSettings.paragraphSpacingBefore
      : 0;
    const paragraphSpacingAfter = Number.isFinite(baseSettings.paragraphSpacingAfter)
      ? baseSettings.paragraphSpacingAfter
      : 0;
    const rootMarginLeft = margin.left;
    // 增量复用所需输入。
    let previousLayout = disablePageReuse ? null : (options?.previousLayout ?? null);
    let changeSummary = disablePageReuse ? null : (options?.changeSummary ?? null);
    if (perf) {
      perf.disablePageReuse = !!disablePageReuse;
      perf.optionsPrevPages = options?.previousLayout?.pages?.length ?? 0;
    }
    // 表格分页已修正，恢复增量复用（由 changeSummary 决定重排范围）
    const docPosToTextOffset = options?.docPosToTextOffset ?? null;
    const progressiveMaxPages = Number.isFinite(options?.progressiveMaxPages)
      ? Math.max(0, Number(options.progressiveMaxPages))
      : 0;
    let progressiveApplied = false;
    // 输出页集合。
    let pages = [];
    // 当前页索引与页容器。
    let pageIndex = 0;
    let page = newPage(pageIndex);
    // 当前页内的纵向游标。
    let cursorY = margin.top;
    // 文档级文本偏移（用于选区定位）。
    let textOffset = 0;
    // 增量布局起始块索引。
    let startBlockIndex = 0;
    // 变更范围结束索引（之后可尝试页复用）。
    let syncAfterIndex = null;
    // 是否满足页级复用条件。
    let canSync = false;
    // 是否已走过变更范围。
    let passedChangedRange = false;
    // 一旦决定复用尾页则停止继续布局。
    let shouldStop = false;
    // 从该页索引开始复用剩余页面。
    let syncFromIndex = null;
    // 是否从锚点开始增量布局（用于对齐块首位置）。
    let resumeFromAnchor = false;
    let resumeHasPrefixLines = false;
    let resumeAnchorTargetY: { y: number; relativeY: number } | null = null;
    let resumeAnchorApplied = false;
    let previousPageFirstBlockIdIndex: Map<string, number[]> | null = null;
    let previousPageSignatureIndex: Map<string, number[]> | null = null;
    const offsetDelta =
      changeSummary?.docChanged && changeSummary?.oldRange && changeSummary?.newRange
        ? Number(changeSummary.newRange.to - changeSummary.newRange.from) -
          Number(changeSummary.oldRange.to - changeSummary.oldRange.from)
        : 0;
    if (previousLayout?.pages?.length) {
      previousPageFirstBlockIdIndex = new Map();
      previousPageSignatureIndex = new Map();
      for (let idx = 0; idx < previousLayout.pages.length; idx += 1) {
        const prevPage = previousLayout.pages[idx];
        const firstLine = prevPage?.lines?.[0];
        const firstBlockId = firstLine?.blockId;
        if (!firstBlockId) {
          // continue scanning signature index even when first block id is missing
        } else {
          const bucket = previousPageFirstBlockIdIndex.get(firstBlockId) || [];
          bucket.push(idx);
          previousPageFirstBlockIdIndex.set(firstBlockId, bucket);
        }
        const lineCount = Array.isArray(prevPage?.lines) ? prevPage.lines.length : 0;
        const sig = getPageSignature(prevPage, 0, false);
        const sigKey = `${lineCount}:${sig}`;
        const sigBucket = previousPageSignatureIndex.get(sigKey) || [];
        sigBucket.push(idx);
        previousPageSignatureIndex.set(sigKey, sigBucket);
      }
    }
    // 增量布局：在旧布局中定位锚点。
    if (previousLayout && changeSummary?.docChanged && typeof docPosToTextOffset === "function") {
      const settingsMatch =
        previousLayout.pageHeight === pageHeight &&
        previousLayout.pageWidth === baseSettings.pageWidth &&
        previousLayout.pageGap === pageGap &&
        previousLayout.lineHeight === lineHeight &&
        previousLayout.margin?.left === margin.left &&
        previousLayout.margin?.right === margin.right &&
        previousLayout.margin?.top === margin.top &&
        previousLayout.margin?.bottom === margin.bottom;

      if (settingsMatch && previousLayout.pages?.length) {
        const before = changeSummary.blocks?.before || {};
        const after = changeSummary.blocks?.after || {};
        const startIndexOld = Number.isFinite(before.fromIndex) ? before.fromIndex : null;
        const startIndexNew = Number.isFinite(after.fromIndex)
          ? after.fromIndex
          : Number.isFinite(startIndexOld)
            ? startIndexOld
            : null;
        const lastIndexNew = Number.isFinite(after.toIndex)
          ? after.toIndex
          : Number.isFinite(after.fromIndex)
            ? after.fromIndex
            : Number.isFinite(before.toIndex)
              ? before.toIndex
              : Number.isFinite(before.fromIndex)
                ? before.fromIndex
                : null;

        if (
          Number.isFinite(startIndexOld) &&
          Number.isFinite(startIndexNew) &&
          startIndexNew < doc.childCount
        ) {
          const blockPos = getDocChildStartPos(doc, startIndexNew);
          const startOffset = docPosToTextOffset(doc, blockPos);
          const blockNode = doc.child(startIndexNew);
          const blockId = blockNode?.attrs?.id ?? null;
          const anchor = findBlockAnchor(previousLayout, {
            rootIndex: startIndexOld,
            blockId,
            blockStart: startOffset,
          });

          if (anchor) {
            const firstOccurrence = findBlockFirstOccurrence(previousLayout, {
              rootIndex: startIndexOld,
              blockId,
              blockStart: startOffset,
            });
            const anchorRef = firstOccurrence || anchor;
            const anchorPage = previousLayout.pages[anchorRef.pageIndex];
            const anchorLines = anchorPage?.lines || [];
            let anchorLineIndex = anchorRef.lineIndex;
            if (anchorLines.length > 0) {
              const matchIndex = anchorLines.findIndex((line) => {
                if (blockId && line.blockId === blockId) {
                  return true;
                }
                if (Number.isFinite(startOffset) && line.blockStart === startOffset) {
                  return true;
                }
                if (Number.isFinite(startIndexOld) && line.rootIndex === startIndexOld) {
                  return true;
                }
                return false;
              });
              if (matchIndex >= 0) {
                anchorLineIndex = matchIndex;
              }
            }
            const anchorLine = anchorLines[anchorLineIndex] || anchorRef.line;
            const reusedLines = anchorLines.slice(0, anchorLineIndex);
            pages = markReusedPages(previousLayout.pages.slice(0, anchorRef.pageIndex));
            pageIndex = anchorRef.pageIndex;
            page = newPage(pageIndex);
            page.lines = reusedLines;
            const anchorY = Number.isFinite(anchorLine?.y) ? anchorLine.y : margin.top;
            const anchorRelativeY = Number.isFinite(anchorLine?.relativeY)
              ? anchorLine.relativeY
              : 0;
            cursorY = anchorY;
            resumeAnchorTargetY = { y: anchorY, relativeY: anchorRelativeY };
            textOffset = Number.isFinite(startOffset) ? startOffset : 0;
            startBlockIndex = startIndexNew;
            syncAfterIndex = Number.isFinite(lastIndexNew) ? lastIndexNew : null;
            canSync = Number.isFinite(syncAfterIndex);
            passedChangedRange = canSync && startBlockIndex > syncAfterIndex;
            resumeFromAnchor = true;
            resumeHasPrefixLines = reusedLines.length > 0;
            resumeAnchorApplied = false;
          }
        }
      }
    }
    // 判断是否可在变更范围之后复用尾页。
    const maybeSync = () => {
      // 必须已处理完变更范围且版式一致。
      if (perf) {
        perf.maybeSyncCalled = true;
      }
      if (!canSync || !passedChangedRange || !previousLayout) {
        if (perf) {
          perf.maybeSyncReason = "precheck-failed";
          perf.maybeSyncFailSnapshot = {
            canSync,
            passedChangedRange,
            hasPrev: !!previousLayout,
          };
        }
        return false;
      }
      const oldPage = previousLayout.pages?.[pageIndex];
      if (!oldPage) {
        if (perf) {
          perf.maybeSyncReason = "old-page-missing";
        }
        return false;
      }
      const candidateSet = new Set<number>();
      const maxPageIndex = (previousLayout.pages?.length ?? 1) - 1;
      const addCandidate = (idx) => {
        if (!Number.isFinite(idx)) {
          return;
        }
        if (idx < 0 || idx > maxPageIndex) {
          return;
        }
        candidateSet.add(Number(idx));
      };
      addCandidate(pageIndex);
      const probeRadius = Number.isFinite(baseSettings?.pageReuseProbeRadius)
        ? Math.max(2, Number(baseSettings.pageReuseProbeRadius))
        : 8;
      for (let delta = 1; delta <= probeRadius; delta += 1) {
        addCandidate(pageIndex - delta);
        addCandidate(pageIndex + delta);
      }
      const pageFirstBlockId = page?.lines?.[0]?.blockId;
      if (pageFirstBlockId && previousPageFirstBlockIdIndex?.has(pageFirstBlockId)) {
        const byBlockId = previousPageFirstBlockIdIndex.get(pageFirstBlockId) || [];
        for (const idx of byBlockId) {
          addCandidate(idx);
          addCandidate(idx - 1);
          addCandidate(idx + 1);
        }
      }
      // changed-range 之后，优先把“覆盖该 rootIndex”的旧页加入候选，
      // 能减少连续输入时页号漂移导致的 page-not-equivalent。
      if (Number.isFinite(syncAfterIndex) && Array.isArray(previousLayout?.pages)) {
        const targetRootIndex = Number(syncAfterIndex);
        const rootIndexProbeRadius = Number.isFinite(baseSettings?.pageReuseRootIndexProbeRadius)
          ? Math.max(0, Number(baseSettings.pageReuseRootIndexProbeRadius))
          : 2;
        for (let idx = 0; idx < previousLayout.pages.length; idx += 1) {
          const candidatePage: any = previousLayout.pages[idx];
          const min = Number(candidatePage?.rootIndexMin);
          const max = Number(candidatePage?.rootIndexMax);
          if (!Number.isFinite(min) || !Number.isFinite(max)) {
            continue;
          }
          if (
            targetRootIndex >= min - rootIndexProbeRadius &&
            targetRootIndex <= max + rootIndexProbeRadius
          ) {
            addCandidate(idx);
            addCandidate(idx - 1);
            addCandidate(idx + 1);
          }
        }
      }
      const pageLineCount = Array.isArray(page?.lines) ? page.lines.length : 0;
      const pageSignature = getPageSignature(page, 0, false);
      const signatureKey = `${pageLineCount}:${pageSignature}`;
      if (previousPageSignatureIndex?.has(signatureKey)) {
        const bySignature = previousPageSignatureIndex.get(signatureKey) || [];
        for (const idx of bySignature) {
          addCandidate(idx);
          addCandidate(idx - 1);
          addCandidate(idx + 1);
        }
      }
      const candidateIndexes = Array.from(candidateSet.values());
      let matchedOldPageIndex = null;
      let lastDiff = null;
      for (const candidateIndex of candidateIndexes) {
        const candidatePage = previousLayout.pages?.[candidateIndex];
        if (!candidatePage) {
          continue;
        }
        const diff = perf ? {} : null;
        if (arePagesEquivalent(page, candidatePage, diff, offsetDelta)) {
          matchedOldPageIndex = candidateIndex;
          lastDiff = null;
          break;
        }
        lastDiff = diff;
      }
      if (!Number.isFinite(matchedOldPageIndex)) {
        if (perf) {
          perf.maybeSyncReason = "page-not-equivalent";
        }
        return false;
      }
      if (perf) {
        perf.maybeSyncReason = "reuse-ok";
      }
      syncFromIndex = Number(matchedOldPageIndex);
      shouldStop = true;
      return true;
    };
    // 收尾当前页，必要时触发复用并停止。
    const finalizePage = () => {
      if (page.lines.length > 0) {
        pages.push(page);
      }
      if (progressiveMaxPages > 0 && previousLayout && pages.length >= progressiveMaxPages) {
        const tailStartIndex = pageIndex + 1;
        if (tailStartIndex < previousLayout.pages.length) {
          const reusedTail = cloneAndShiftPages(
            previousLayout.pages.slice(tailStartIndex),
            offsetDelta
          );
          pages.push(...markReusedPages(reusedTail));
        }
        progressiveApplied = true;
        if (perf) {
          perf.maybeSyncReason = "progressive-cutoff";
          perf.syncFromIndex = tailStartIndex;
        }
        shouldStop = true;
        return true;
      }
      if (maybeSync()) {
        return true;
      }
      pageIndex += 1;
      page = newPage(pageIndex);
      cursorY = margin.top;
      return false;
    };
    // 布局叶子块（段落/标题/图片/表格等）。
    const layoutLeafBlock = (block, context) => {
      if (shouldStop) {
        return true;
      }

      const leafStart = perf ? now() : 0;
      const blockId = block.attrs?.id ?? null;

      if (perf) {
        perf.blocks += 1;
      }

      const renderer = this.registry?.get(block.type.name);
      const blockSettings = resolveSettingsWithIndent(baseSettings, context.indent);
      const blockTypeName = block.type?.name;
      const isTopLevel = !context?.containerStack || context.containerStack.length === 0;

      // Hard page break: finish current page and continue from next page top.
      if (blockTypeName === "page_break") {
        textOffset += 1;
        if (page.lines.length > 0) {
          if (finalizePage()) {
            return true;
          }
        }
        if (perf) {
          perf.layoutLeafMs += now() - leafStart;
        }
        return shouldStop;
      }

      let blockLines = [];
      let blockLength = 0;
      let blockHeight = 0;
      let blockAttrs = block.attrs || null;
      let blockLineHeight = null;

      let spacingBefore = Number.isFinite(blockAttrs?.spacingBefore)
        ? blockAttrs.spacingBefore
        : isTopLevel && (blockTypeName === "paragraph" || blockTypeName === "heading")
          ? paragraphSpacingBefore
          : blockSpacing;
      const spacingAfter = Number.isFinite(blockAttrs?.spacingAfter)
        ? blockAttrs.spacingAfter
        : isTopLevel && (blockTypeName === "paragraph" || blockTypeName === "heading")
          ? paragraphSpacingAfter
          : blockSpacing;
      if (resumeFromAnchor && !resumeAnchorApplied && context.rootIndex === startBlockIndex) {
        if (resumeAnchorTargetY && Number.isFinite(resumeAnchorTargetY.y)) {
          const relativeY = Number.isFinite(resumeAnchorTargetY.relativeY)
            ? resumeAnchorTargetY.relativeY
            : 0;
          cursorY = Math.max(margin.top, resumeAnchorTargetY.y - spacingBefore - relativeY);
          resumeAnchorApplied = true;
        }
      }

      const cacheKey = blockId != null ? `${blockId}:${context.indent}` : null;
      const rendererCacheable = renderer?.cacheLayout !== false;
      const canUseCache = rendererCacheable && cacheKey !== null;
      const cached = canUseCache ? this.blockCache.get(cacheKey) : null;
      // Always compute block signature so downstream page signatures can detect
      // style-only node changes even when line geometry/text stays the same.
      const blockSignature = getBlockLayoutSignature(
        block,
        blockSettings,
        context.indent,
        renderer,
        this.registry
      );

      if (canUseCache) {
        if (cached && cached.signature === blockSignature) {
          if (perf) {
            perf.cachedBlocks += 1;
          }
          blockLines = cached.lines || [];
          blockLength = cached.length || 0;
          blockHeight = cached.height || 0;
          if (cached.blockAttrs) {
            blockAttrs = cached.blockAttrs;
          }
          if (cached.blockLineHeight) {
            blockLineHeight = cached.blockLineHeight;
          }
        }
      }

      if (!canUseCache || !cached || cached.signature !== blockSignature) {
        if (renderer?.layoutBlock) {
          const result = renderer.layoutBlock({
            node: block,
            availableHeight: pageHeight - margin.bottom - cursorY,
            measureTextWidth: baseSettings.measureTextWidth,
            settings: blockSettings,
            registry: this.registry,
            indent: context.indent,
            containerStack: context.containerStack,
          });
          blockLines = result?.lines || [];
          blockLength = result?.length || 0;
          blockHeight = result?.height || 0;
          if (result?.blockAttrs) {
            blockAttrs = result.blockAttrs;
          }
          if (result?.blockAttrs?.lineHeight) {
            blockLineHeight = result.blockAttrs.lineHeight;
          }
        } else {
          const runsResult = renderer?.toRuns
            ? renderer.toRuns(block, blockSettings, this.registry)
            : block.isTextblock
              ? textblockToRuns(block, blockSettings, block.type.name, blockId, block.attrs, 0)
              : docToRuns(block, blockSettings, this.registry);

          const { runs, length } = runsResult;
          blockLength = length;
          if (runsResult?.blockAttrs) {
            blockAttrs = runsResult.blockAttrs;
          }
          if (runsResult?.blockAttrs?.lineHeight) {
            blockLineHeight = runsResult.blockAttrs.lineHeight;
          }
          const breakBaseLineHeight = Number.isFinite(blockLineHeight)
            ? blockLineHeight
            : lineHeight;

          if (perf) {
            const breakStart = now();
            blockLines = breakLines(
              runs,
              blockSettings.pageWidth - blockSettings.margin.left - blockSettings.margin.right,
              blockSettings.font,
              length,
              blockSettings.wrapTolerance || 0,
              blockSettings.minLineWidth || 0,
              measureTextWidth,
              blockSettings.segmentText,
              breakBaseLineHeight
            );
            perf.breakLinesMs += now() - breakStart;
          } else {
            blockLines = breakLines(
              runs,
              blockSettings.pageWidth - blockSettings.margin.left - blockSettings.margin.right,
              blockSettings.font,
              length,
              blockSettings.wrapTolerance || 0,
              blockSettings.minLineWidth || 0,
              measureTextWidth,
              blockSettings.segmentText,
              breakBaseLineHeight
            );
          }
          blockHeight = measureLinesHeight(blockLines, breakBaseLineHeight);
        }

        if (canUseCache) {
          this.blockCache.set(cacheKey, {
            signature: blockSignature,
            lines: blockLines,
            length: blockLength,
            height: blockHeight,
            blockAttrs,
            blockLineHeight,
          });
        }
      }

      const lineHeightValue = blockLineHeight || lineHeight;
      const canSplit = renderer?.allowSplit ?? !renderer?.layoutBlock;
      const splitBlock = renderer?.splitBlock;
      const safeLines =
        blockLines.length > 0
          ? blockLines
          : [
              {
                text: "",
                start: 0,
                end: 0,
                width: 0,
                runs: [],
                blockType: block.type.name,
                blockAttrs,
              },
            ];

      let remainingLines = safeLines;
      let remainingLength = blockLength;
      let remainingHeight =
        Number.isFinite(blockHeight) && blockHeight > 0
          ? blockHeight
          : measureLinesHeight(safeLines, lineHeightValue);

      const blockStart = textOffset;
      const containerStack = context.containerStack;
      // 将行写入当前页并补齐坐标/偏移/容器信息。
      // 将当前切片写入页面，同时补齐坐标、blockStart、容器等元信息
      const placeLines = (linesToPlace) => {
        const seenListItems = new Set<string>();
        let relativeCursor = 0;
        linesToPlace.forEach((line) => {
          const lineCopy = cloneLine(line);
          const resolvedLineHeight = resolveLineHeight(lineCopy, lineHeightValue);
          lineCopy.blockType = lineCopy.blockType || block.type.name;
          lineCopy.blockId = lineCopy.blockId ?? blockId;
          lineCopy.blockSignature =
            Number.isFinite(blockSignature) && Number(blockSignature) > 0
              ? Number(blockSignature)
              : null;
          lineCopy.blockAttrs = lineCopy.blockAttrs || blockAttrs;
          lineCopy.rootIndex = context.rootIndex;
          adjustLineOffsets(lineCopy, blockStart);
          // 同一列表跨页续行时，不重复绘制 marker
          if (
            lineCopy.blockAttrs &&
            (lineCopy.blockType === "bullet_list" || lineCopy.blockType === "ordered_list")
          ) {
            const itemIndex = lineCopy.blockAttrs.itemIndex;
            const key = `${lineCopy.blockStart ?? "0"}:${itemIndex ?? "0"}`;
            if (!seenListItems.has(key)) {
              seenListItems.add(key);
            } else {
              // 跨页续行不显示 marker，避免看起来像新列表。
              lineCopy.listMarker = null;
            }
          }
          // table 等自带相对坐标的行，使用 relativeY 进行定位
          if (typeof lineCopy.relativeY === "number") {
            lineCopy.y = cursorY + lineCopy.relativeY;
            relativeCursor = Math.max(relativeCursor, lineCopy.relativeY + resolvedLineHeight);
          } else {
            lineCopy.relativeY = relativeCursor;
            lineCopy.y = cursorY + relativeCursor;
            relativeCursor += resolvedLineHeight;
          }
          lineCopy.lineHeight = resolvedLineHeight;
          if (typeof lineCopy.x !== "number") {
            lineCopy.x = computeLineX(lineCopy, blockSettings);
          }
          if (containerStack.length) {
            lineCopy.containers = containerStack;
          }
          page.lines.push(lineCopy);
          if (Number.isFinite(lineCopy.rootIndex)) {
            if (page.rootIndexMin == null || lineCopy.rootIndex < page.rootIndexMin) {
              page.rootIndexMin = lineCopy.rootIndex;
            }
            if (page.rootIndexMax == null || lineCopy.rootIndex > page.rootIndexMax) {
              page.rootIndexMax = lineCopy.rootIndex;
            }
          }
        });
        if (perf) {
          perf.lines += linesToPlace.length;
        }
      };

      while (remainingLines.length > 0) {
        if (shouldStop) {
          return true;
        }
        if (remainingLines === safeLines && spacingBefore > 0) {
          if (cursorY + spacingBefore > pageHeight - margin.bottom) {
            if (finalizePage()) {
              return true;
            }
          }
          cursorY += spacingBefore;
        }
        const availableHeight = pageHeight - margin.bottom - cursorY;
        if (remainingHeight > availableHeight) {
          const fullAvailableHeight = pageHeight - margin.top - margin.bottom;
          const firstLineHeight = resolveLineHeight(remainingLines[0], lineHeightValue);
          if (availableHeight < firstLineHeight) {
            if (finalizePage()) {
              return true;
            }
            if (fullAvailableHeight >= firstLineHeight) {
              continue;
            }
            // 单行高度超出整页，强制放入一行避免死循环。
            const forcedLine = remainingLines[0];
            if (!forcedLine) {
              break;
            }
            const forcedStart = typeof forcedLine?.start === "number" ? forcedLine.start : 0;
            const forcedEnd = typeof forcedLine?.end === "number" ? forcedLine.end : forcedStart;
            const forcedLength = Math.max(0, forcedEnd - forcedStart);
            const forcedHeight = Number.isFinite(forcedLine?.lineHeight)
              ? forcedLine.lineHeight
              : lineHeightValue;
            placeLines([forcedLine]);
            cursorY += forcedHeight;
            remainingLines = remainingLines.slice(1);
            remainingLength = Math.max(0, remainingLength - forcedLength);
            remainingHeight = Math.max(0, remainingHeight - forcedHeight);
            if (finalizePage()) {
              return true;
            }
            continue;
          }
          if (!canSplit) {
            if (page.lines.length === 0) {
              // 不可拆分且本页为空时，强制放入，避免死循环。
              placeLines(remainingLines);
              cursorY += remainingHeight;
              remainingLines = [];
              break;
            }
            if (finalizePage()) {
              return true;
            }
            continue;
          }
          let splitResult = null;
          if (splitBlock) {
            splitResult = splitBlock({
              node: block,
              lines: remainingLines,
              length: remainingLength,
              height: remainingHeight,
              availableHeight,
              lineHeight: lineHeightValue,
              settings: blockSettings,
              registry: this.registry,
              indent: context.indent,
              containerStack,
              blockAttrs,
            });
          }
          if (!splitResult) {
            const maxLines = Math.max(
              1,
              getFittableLineCount(remainingLines, availableHeight, lineHeightValue)
            );
            if (maxLines < remainingLines.length) {
              const visibleLinesRaw = remainingLines.slice(0, maxLines);
              const lastLine = visibleLinesRaw[visibleLinesRaw.length - 1];
              const firstLine = visibleLinesRaw[0];
              const startOffset = typeof firstLine?.start === "number" ? firstLine.start : 0;
              const endOffset = typeof lastLine?.end === "number" ? lastLine.end : remainingLength;
              const visibleLength = Math.max(0, endOffset - startOffset);
              const visibleLines = normalizeChunkRelativeY(visibleLinesRaw);
              const visibleHeight = measureLinesHeight(visibleLines, lineHeightValue);
              const overflowLines = normalizeChunkRelativeY(remainingLines.slice(maxLines));
              const overflowLength = Math.max(0, remainingLength - visibleLength);
              const overflowHeight = measureLinesHeight(overflowLines, lineHeightValue);
              splitResult = {
                lines: visibleLines,
                length: visibleLength,
                height: visibleHeight,
                overflow: {
                  lines: overflowLines,
                  length: overflowLength,
                  height: overflowHeight,
                },
              };
            }
          }
          if (
            splitResult &&
            splitResult.lines.length === 0 &&
            splitResult.overflow &&
            splitResult.overflow.lines.length > 0
          ) {
            if (page.lines.length === 0 && remainingLines.length > 0) {
              const fullAvailableHeight = pageHeight - margin.top - margin.bottom;
              if (remainingHeight <= fullAvailableHeight) {
                if (finalizePage()) {
                  return true;
                }
                continue;
              }
              const forcedLine = remainingLines[0];
              if (!forcedLine) {
                break;
              }
              const forcedStart = typeof forcedLine?.start === "number" ? forcedLine.start : 0;
              const forcedEnd = typeof forcedLine?.end === "number" ? forcedLine.end : forcedStart;
              const forcedLength = Math.max(0, forcedEnd - forcedStart);
              const forcedHeight = Number.isFinite(forcedLine?.lineHeight)
                ? forcedLine.lineHeight
                : lineHeightValue;
              placeLines([forcedLine]);
              cursorY += forcedHeight;
              remainingLines = remainingLines.slice(1);
              remainingLength = Math.max(0, remainingLength - forcedLength);
              remainingHeight = Math.max(0, remainingHeight - forcedHeight);
              if (finalizePage()) {
                return true;
              }
              continue;
            }
            if (finalizePage()) {
              return true;
            }
            remainingLines = splitResult.overflow.lines;
            remainingLength = splitResult.overflow.length;
            remainingHeight = Number.isFinite(splitResult.overflow.height)
              ? splitResult.overflow.height
              : measureLinesHeight(splitResult.overflow.lines, lineHeightValue);
            continue;
          }
          if (splitResult && splitResult.lines.length > 0) {
            placeLines(splitResult.lines);
            const placedHeight = Number.isFinite(splitResult.height)
              ? splitResult.height
              : measureLinesHeight(splitResult.lines, lineHeightValue);
            cursorY += placedHeight;
            if (finalizePage()) {
              return true;
            }
            // 继续处理溢出切片（跨页续排）
            if (splitResult.overflow && splitResult.overflow.lines.length > 0) {
              remainingLines = splitResult.overflow.lines;
              remainingLength = splitResult.overflow.length;
              remainingHeight = Number.isFinite(splitResult.overflow.height)
                ? splitResult.overflow.height
                : measureLinesHeight(splitResult.overflow.lines, lineHeightValue);
              continue;
            }
            remainingLines = [];
            break;
          }
          if (finalizePage()) {
            return true;
          }
          continue;
        }
        placeLines(remainingLines);
        cursorY += remainingHeight;
        remainingLines = [];
      }

      textOffset += blockLength;

      if (spacingAfter > 0) {
        cursorY += spacingAfter;
      }
      if (cursorY + lineHeight > pageHeight - margin.bottom) {
        if (finalizePage()) {
          return true;
        }
      }

      if (perf) {
        perf.layoutLeafMs += now() - leafStart;
      }

      return shouldStop;
    };
    // 深度优先遍历块结构。
    const walkBlocks = (node, context) => {
      if (shouldStop) {
        return true;
      }
      const renderer = this.registry?.get(node.type.name);
      const isLeaf = renderer?.layoutBlock || renderer?.toRuns || node.isTextblock || node.isAtom;

      if (isLeaf) {
        return layoutLeafBlock(node, context);
      }

      const style = renderer?.getContainerStyle
        ? renderer.getContainerStyle({ node, settings: baseSettings, registry: this.registry })
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
                baseX: rootMarginLeft + context.indent,
              },
            ],
            rootIndex: context.rootIndex,
          }
        : context;

      for (let index = 0; index < node.childCount; index += 1) {
        const child = node.child(index);
        if (walkBlocks(child, nextContext)) {
          return true;
        }
        if (index < node.childCount - 1) {
          textOffset += 1;
        }
      }

      return shouldStop;
    };
    // 从增量起点布局到文档末尾（或直到触发复用）。
    for (let index = startBlockIndex; index < doc.childCount; index += 1) {
      if (shouldStop) {
        break;
      }
      const block = doc.child(index);
      const renderer = this.registry?.get(block.type.name);
      const isLeaf = renderer?.layoutBlock || renderer?.toRuns || block.isTextblock || block.isAtom;
      if (walkBlocks(block, { indent: 0, containerStack: [], rootIndex: index })) {
        break;
      }
      if (!isLeaf && blockSpacing > 0 && index < doc.childCount - 1) {
        cursorY += blockSpacing;
        if (cursorY + lineHeight > pageHeight - margin.bottom) {
          if (finalizePage()) {
            break;
          }
        }
      }
      if (index < doc.childCount - 1) {
        textOffset += 1;
      }
      if (canSync && syncAfterIndex != null && index >= syncAfterIndex) {
        passedChangedRange = true;
      }
    }

    if (!shouldStop) {
      if (page.lines.length > 0) {
        pages.push(page);
      }
      // 文档结束但没有触发分页时，也尝试在末页进行复用判断
      if (maybeSync()) {
        // maybeSync 会设置 shouldStop 与 syncFromIndex
      }
    }
    // 若触发复用，追加旧布局剩余页。
    if (shouldStop && previousLayout && syncFromIndex != null) {
      if (perf) {
        perf.reusedPages =
          previousLayout.pages.length - Math.min(previousLayout.pages.length, syncFromIndex + 1);
      }
      const reusedTail = cloneAndShiftPages(
        previousLayout.pages.slice(syncFromIndex + 1),
        offsetDelta
      );
      pages.push(...markReusedPages(reusedTail));
    }
    // 清理重复的表格块：若同一表格已出现分片，则移除无分片标记的完整表格行。
    const tableSliceStarts = new Set<number>();
    for (const pg of pages) {
      for (const line of pg.lines || []) {
        if (line?.blockType !== "table") {
          continue;
        }
        const attrs = line.blockAttrs || {};
        const hasSlice =
          !!attrs.tableSliceFromPrev ||
          !!attrs.tableSliceHasNext ||
          !!line.tableMeta?.continuedFromPrev ||
          !!line.tableMeta?.continuesAfter ||
          !!line.tableMeta?.rowSplit;
        if (hasSlice && Number.isFinite(line.blockStart)) {
          tableSliceStarts.add(line.blockStart);
        }
      }
    }
    if (tableSliceStarts.size > 0) {
      for (const pg of pages) {
        if (!pg?.lines?.length) {
          continue;
        }
        pg.lines = pg.lines.filter((line) => {
          if (line?.blockType !== "table") {
            return true;
          }
          if (!Number.isFinite(line.blockStart)) {
            return true;
          }
          if (!tableSliceStarts.has(line.blockStart)) {
            return true;
          }
          const attrs = line.blockAttrs || {};
          const hasSlice =
            !!attrs.tableSliceFromPrev ||
            !!attrs.tableSliceHasNext ||
            !!line.tableMeta?.continuedFromPrev ||
            !!line.tableMeta?.continuesAfter ||
            !!line.tableMeta?.rowSplit;
          return hasSlice;
        });
      }
    }
    // 移除空页（可能由分页切换或块移动引入）
    pages = pages.filter((pg) => pg?.lines?.length > 0);
    // 计算总高度用于滚动。
    const totalHeight = pages.length * pageHeight + Math.max(0, pages.length - 1) * pageGap;

    if (perf) {
      if (!previousLayout) {
        perf.reuseReason = "no-previous-layout";
      } else if (!changeSummary) {
        perf.reuseReason = "no-change-summary";
      } else if (!changeSummary.docChanged) {
        perf.reuseReason = "no-doc-changed";
      } else {
        perf.reuseReason = "eligible";
      }
      perf.syncAfterIndex = syncAfterIndex;
      perf.canSync = canSync;
      perf.passedChangedRange = passedChangedRange;
      perf.syncFromIndex = syncFromIndex;
      perf.resumeFromAnchor = resumeFromAnchor;
      perf.pages = pages.length;
      const duration = now() - perf.start;
      const cacheHitRate =
        perf.blocks > 0 ? Math.round((perf.cachedBlocks / perf.blocks) * 100) : 0;
      const summary = {
        ms: Math.round(duration),
        pages: perf.pages,
        blocks: perf.blocks,
        cachedBlocks: perf.cachedBlocks,
        blockCacheHitRate: `${cacheHitRate}%`,
        lines: perf.lines,
        measureCalls: perf.measureCalls,
        measureChars: perf.measureChars,
        reusedPages: perf.reusedPages,
        reuseReason: perf.reuseReason,
        syncAfterIndex: perf.syncAfterIndex,
        canSync: perf.canSync,
        passedChangedRange: perf.passedChangedRange,
        syncFromIndex: perf.syncFromIndex,
        resumeFromAnchor: perf.resumeFromAnchor,
        maybeSyncCalled: perf.maybeSyncCalled,
        maybeSyncReason: perf.maybeSyncReason,
        disablePageReuse: perf.disablePageReuse,
        optionsPrevPages: perf.optionsPrevPages,
        maybeSyncFailSnapshot: perf.maybeSyncFailSnapshot,
        breakLinesMs: Math.round(perf.breakLinesMs),
        layoutLeafMs: Math.round(perf.layoutLeafMs),
      };
      if (baseSettingsRaw?.__perf) {
        baseSettingsRaw.__perf.layout = summary;
      }
    }

    return {
      pages,
      pageHeight,
      pageWidth: baseSettings.pageWidth,
      pageGap,
      margin,
      lineHeight,
      font,
      totalHeight,
      __progressiveApplied: progressiveApplied,
    };
  }
  // 纯文本分页入口。
  layoutFromText(text) {
    const { runs, length } = textToRuns(text, this.settings);
    return this.layoutFromRuns(runs, length);
  }
  // 运行段分页入口（直接按运行段断行分页）。
  layoutFromRuns(runs, totalLength) {
    const { pageHeight, pageGap, margin, lineHeight, font } = this.settings;
    const maxWidth = this.settings.pageWidth - margin.left - margin.right;

    const lines = breakLines(
      runs,
      maxWidth,
      font,
      totalLength,
      this.settings.wrapTolerance || 0,
      this.settings.minLineWidth || 0,
      this.settings.measureTextWidth,
      this.settings.segmentText,
      lineHeight
    );

    const pages = [];
    // 当前页索引与页容器。
    let pageIndex = 0;
    let page = newPage(pageIndex);
    let y = margin.top;

    for (const line of lines) {
      const lineHeightValue = resolveLineHeight(line, lineHeight);
      if (page.lines.length > 0 && y + lineHeightValue > pageHeight - margin.bottom) {
        pages.push(page);
        pageIndex += 1;
        page = newPage(pageIndex);
        y = margin.top;
      }
      page.lines.push({
        ...line,
        lineHeight: lineHeightValue,
        x: computeLineX(line, this.settings),
        y,
      });

      y += lineHeightValue;
    }

    if (page.lines.length > 0) {
      pages.push(page);
    }
    // 计算总高度用于滚动。
    const totalHeight = pages.length * pageHeight + Math.max(0, pages.length - 1) * pageGap;

    return {
      pages,
      pageHeight,
      pageWidth: this.settings.pageWidth,
      pageGap,
      margin,
      lineHeight,
      font,
      totalHeight,
    };
  }
}
