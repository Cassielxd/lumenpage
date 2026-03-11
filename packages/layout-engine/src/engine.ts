/*
 * 鍒嗛〉甯冨眬绠＄嚎銆?
 */

import { docToRuns, textblockToRuns, textToRuns } from "./textRuns";
import { breakLines } from "./lineBreaker";
import { cleanupUnslicedDuplicateSlices } from "./fragments/cleanup";
import { validateNormalizedSplitFragments } from "./fragments/invariants";
import { createAutoSplitResult, normalizeSplitFragments } from "./fragments/normalize";

const now = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

// 鍙樻洿鎽樿锛氱敤浜庡閲忓竷灞€澶嶇敤�?
type LayoutChangeSummary = {
  docChanged?: boolean;
  oldRange?: { from?: number | null; to?: number | null };
  newRange?: { from?: number | null; to?: number | null };
  blocks?: {
    before?: { fromIndex?: number | null; toIndex?: number | null };
    after?: { fromIndex?: number | null; toIndex?: number | null };
  };
};

// 甯冨眬杈撳嚭锛氬垎椤电粨�?+ 鐗堝紡鍙傛暟�?
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

// 甯冨眬杈撳叆锛氫笂涓€鐗堝竷灞€ + 鍙樻洿鎽樿�?
type LayoutFromDocOptions = {
  previousLayout?: LayoutResult | null;
  changeSummary?: LayoutChangeSummary | null;
  docPosToTextOffset?: (doc: any, pos: number) => number;
  layoutSettingsOverride?: Record<string, any> | null;
  // 鎸夐渶绾ц仈鍒嗛〉锛氫粠鍙樻洿椤靛紑濮嬶紝鍙湪椤甸潰楂樺害鍙樺寲鏃剁户缁垎椤?
  cascadePagination?: boolean;
  // 绾ц仈鍒嗛〉鐨勯敋鐐归〉闈㈢储寮曪紙浠庡摢閲屽紑濮嬪垎椤碉�?
  cascadeFromPageIndex?: number | null;
};

// 鍒涘缓鏂扮殑鍒嗛〉瀹瑰櫒銆?
function newPage(index) {
  return { index, lines: [], rootIndexMin: null, rootIndexMax: null };
}

// 鏍囪澶嶇敤椤碉紝娓叉煋闃舵鍙烦杩囩鍚嶈绠椼�?
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

// 鍏嬮殕琛屽璞★紝閬垮厤寮曠敤鍏变韩�?
const cloneLine = (line) => ({
  ...line,
  runs: line.runs,
});

// 璁＄畻琛岀殑姘村钩浣嶇疆锛堝�?+ 棣栬缂╄繘锛夈�?
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

// 灏嗗潡鍐呭亸绉昏浆鎹负鏂囨。鍏ㄥ眬鍋忕Щ�?
const adjustLineOffsets = (line, blockStart) => {
  if (typeof line.start === "number") {
    line.start += blockStart;
  }

  if (typeof line.end === "number") {
    line.end += blockStart;
  }

  if (Number.isFinite(blockStart) && Number(blockStart) !== 0) {
    const baseDelta = Number.isFinite(line?.__offsetDelta) ? Number(line.__offsetDelta) : 0;
    line.__offsetDelta = baseDelta + Number(blockStart);
  }

  if (Number.isFinite(blockStart) && Number.isFinite(line?.blockStart)) {
    line.blockStart += blockStart;
  } else if (line.blockStart == null) {
    line.blockStart = blockStart;
  }

  return line;
};

// 鏍规嵁缂╄繘鐢熸垚鏂扮殑甯冨眬璁剧疆�?
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

// 鏁板€煎搱甯岋紝鐢ㄤ簬椤电鍚嶃�?
const hashNumber = (hash, value) => {
  const num = Number.isFinite(value) ? Math.round(value) : 0;
  return (hash * 31 + num) | 0;
};

// 瀛楃涓插搱甯岋紝鐢ㄤ簬椤电鍚嶃€?
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

// 灏嗕换鎰?attrs 缁撴瀯褰掍竴鍖栧悗鍙備笌鍝堝笇锛屼繚璇佺紦瀛樼鍚嶇ǔ瀹氥�?
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

// 璁＄畻鍧楀竷灞€绛惧悕锛氱敤浜庣紦瀛樺懡涓垽鏂紙涓嶄緷璧栬妭鐐瑰璞″紩鐢級銆?
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

const PAGE_REUSE_SIGNATURE_VERSION = 3;
const ENABLE_CROSS_PAGE_CANDIDATE_REUSE = false;
const ENABLE_SAME_INDEX_TAIL_REUSE = false;
const ENABLE_RESUME_FROM_ANCHOR_REUSE = false;

const isGhostTraceEnabled = (settings) =>
  settings?.debugGhostTrace === true ||
  (typeof globalThis !== "undefined" &&
    (globalThis as typeof globalThis & { __lumenGhostTraceEnabled?: boolean })
      .__lumenGhostTraceEnabled === true);

const appendGhostTrace = (trace, event) => {
  if (!Array.isArray(trace)) {
    return;
  }
  trace.push(event);
  if (trace.length > 80) {
    trace.splice(0, trace.length - 80);
  }
};

const invalidatePageReuseSignature = (page) => {
  if (!page || typeof page !== "object") {
    return;
  }
  delete page.__reuseVisualSignature;
  delete page.__reuseVisualSignatureVersion;
  delete page.__reuseVisualSignatureBuilder;
  delete page.__reuseVisualSignatureBuilderLineCount;
};

const getLineVisualSignature = (line, objectSignatureCache = new WeakMap()) => {
  if (
    Number(line?.__reuseVisualSignatureVersion) === PAGE_REUSE_SIGNATURE_VERSION &&
    typeof line?.__reuseVisualSignature === "number"
  ) {
    return Number(line.__reuseVisualSignature);
  }
  let hash = 17;
  hash = hashNumber(hash, line?.x);
  hash = hashNumber(hash, line?.y);
  hash = hashNumber(hash, line?.width);
  hash = hashNumber(hash, line?.lineHeight);
  hash = hashNumber(hash, line?.blockSignature);
  hash = hashString(hash, line?.blockType || "");
  hash = hashString(hash, line?.blockId || "");
  hash = hashString(hash, line?.text || "");
  hash = hashNumber(hash, getObjectSignature(line?.blockAttrs || null, objectSignatureCache));
  hash = hashNumber(hash, getObjectSignature(line?.tableMeta || null, objectSignatureCache));
  hash = hashNumber(hash, getObjectSignature(line?.containers || null, objectSignatureCache));
  hash = hashNumber(hash, getObjectSignature(line?.listMarker || null, objectSignatureCache));
  hash = hashNumber(hash, getObjectSignature(line?.imageMeta || null, objectSignatureCache));
  hash = hashNumber(hash, getObjectSignature(line?.videoMeta || null, objectSignatureCache));
  if (Array.isArray(line?.runs)) {
    for (const run of line.runs) {
      hash = hashString(hash, run?.text || "");
      hash = hashString(hash, run?.font || "");
      hash = hashString(hash, run?.color || "");
      hash = hashNumber(hash, run?.width);
      hash = hashNumber(hash, run?.underline ? 1 : 0);
      hash = hashNumber(hash, run?.strike ? 1 : 0);
      hash = hashNumber(hash, run?.shiftY);
      hash =
        typeof run?.background === "string"
          ? hashString(hash, run.background)
          : hashNumber(hash, getObjectSignature(run?.background || null, objectSignatureCache));
    }
  }
  const signature = hash >>> 0;
  if (line && typeof line === "object") {
    line.__reuseVisualSignature = signature;
    line.__reuseVisualSignatureVersion = PAGE_REUSE_SIGNATURE_VERSION;
  }
  return signature;
};

const ensurePageReuseSignatureBuilder = (page) => {
  const lines = Array.isArray(page?.lines) ? page.lines : [];
  if (
    Number(page?.__reuseVisualSignatureVersion) === PAGE_REUSE_SIGNATURE_VERSION &&
    typeof page?.__reuseVisualSignatureBuilder === "number" &&
    Number(page?.__reuseVisualSignatureBuilderLineCount) === lines.length
  ) {
    return Number(page.__reuseVisualSignatureBuilder);
  }
  const objectSignatureCache = new WeakMap();
  let hash = 0;
  for (const line of lines) {
    hash = hashNumber(hash, getLineVisualSignature(line, objectSignatureCache));
  }
  if (page && typeof page === "object") {
    page.__reuseVisualSignature = hash >>> 0;
    page.__reuseVisualSignatureVersion = PAGE_REUSE_SIGNATURE_VERSION;
    page.__reuseVisualSignatureBuilder = hash >>> 0;
    page.__reuseVisualSignatureBuilderLineCount = lines.length;
  }
  return hash >>> 0;
};

const appendPageReuseSignature = (page, line) => {
  if (!page || typeof page !== "object") {
    return;
  }
  const currentHash = ensurePageReuseSignatureBuilder(page);
  const nextHash = hashNumber(currentHash, getLineVisualSignature(line, new WeakMap())) >>> 0;
  const nextLineCount = Array.isArray(page.lines) ? page.lines.length + 1 : 1;
  page.__reuseVisualSignature = nextHash;
  page.__reuseVisualSignatureVersion = PAGE_REUSE_SIGNATURE_VERSION;
  page.__reuseVisualSignatureBuilder = nextHash;
  page.__reuseVisualSignatureBuilderLineCount = nextLineCount;
};

// 鐢熸垚椤电鍚嶏紝鐢ㄤ簬鍒ゆ柇椤垫槸鍚︾瓑浠枫€?
// 褰撶敤浜庡鐢ㄥ垽绛夋椂锛岄伩鍏嶄緷璧栫粷瀵规枃妗ｅ亸绉伙紙start/end 绛夛級锛?
// 鍚﹀垯涓€娆″眬閮ㄦ彃鍏ヤ細瀵艰嚧鍚庣画椤甸潰鍏ㄩ儴鍋忕Щ鍙樺寲鑰屾棤娉曞懡涓鐢ㄣ�?
const getPageSignature = (page, offsetDelta = 0, includeAbsoluteOffsets = true) => {
  if (
    includeAbsoluteOffsets === false &&
    Number(page?.__reuseVisualSignatureVersion) === PAGE_REUSE_SIGNATURE_VERSION &&
    typeof page?.__reuseVisualSignature === "number"
  ) {
    return Number(page.__reuseVisualSignature);
  }
  const shift = (value) =>
    Number.isFinite(value) ? Number(value) + Number(offsetDelta || 0) : value;
  const objectSignatureCache = new WeakMap();
  let hash = 0;
  if (!page?.lines) {
    return hash;
  }
  for (const line of page.lines) {
    const lineOffsetDelta = Number.isFinite(line?.__offsetDelta)
      ? Number(line.__offsetDelta) + Number(offsetDelta || 0)
      : Number(offsetDelta || 0);
    if (!includeAbsoluteOffsets) {
      hash = hashNumber(hash, getLineVisualSignature(line, objectSignatureCache));
      continue;
    }
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
    hash = hashNumber(hash, getObjectSignature(line.containers || null, objectSignatureCache));
    hash = hashNumber(hash, getObjectSignature(line.listMarker || null, objectSignatureCache));
    hash = hashNumber(hash, getObjectSignature(line.imageMeta || null, objectSignatureCache));
    hash = hashNumber(hash, getObjectSignature(line.videoMeta || null, objectSignatureCache));
    if (line.runs) {
      for (const run of line.runs) {
        if (includeAbsoluteOffsets) {
          hash = hashNumber(
            hash,
            Number.isFinite(run?.start) ? Number(run.start) + lineOffsetDelta : run?.start
          );
          hash = hashNumber(
            hash,
            Number.isFinite(run?.end) ? Number(run.end) + lineOffsetDelta : run?.end
          );
        }
        hash = hashString(hash, run.text || "");
        hash = hashString(hash, run.font || "");
        hash = hashString(hash, run.color || "");
        hash = hashNumber(hash, run.width);
        hash = hashNumber(hash, run.underline ? 1 : 0);
        hash = hashNumber(hash, run.strike ? 1 : 0);
        hash = hashNumber(hash, run.shiftY);
        hash =
          typeof run.background === "string"
            ? hashString(hash, run.background)
            : hashNumber(hash, getObjectSignature(run.background || null, objectSignatureCache));
      }
    }
  }
  if (includeAbsoluteOffsets === false && page) {
    page.__reuseVisualSignature = hash >>> 0;
    page.__reuseVisualSignatureVersion = PAGE_REUSE_SIGNATURE_VERSION;
    page.__reuseVisualSignatureBuilder = hash >>> 0;
    page.__reuseVisualSignatureBuilderLineCount = Array.isArray(page.lines) ? page.lines.length : 0;
  }
  return hash;
};

const getOrBuildPageReuseIndex = (layout) => {
  const pages = Array.isArray(layout?.pages) ? layout.pages : null;
  if (!pages || pages.length === 0) {
    return null;
  }
  const cached = layout?.__pageReuseIndex;
  if (
    cached &&
    cached.pageCount === pages.length &&
    cached.firstBlockIdIndex instanceof Map &&
    cached.signatureIndex instanceof Map &&
    Array.isArray(cached.pageRootRanges)
  ) {
    return cached;
  }
  const firstBlockIdIndex = new Map();
  const signatureIndex = new Map();
  const pageRootRanges = [];
  for (let idx = 0; idx < pages.length; idx += 1) {
    const prevPage = pages[idx];
    const firstLine = prevPage?.lines?.[0];
    const firstBlockId = firstLine?.blockId;
    if (firstBlockId) {
      const bucket = firstBlockIdIndex.get(firstBlockId) || [];
      bucket.push(idx);
      firstBlockIdIndex.set(firstBlockId, bucket);
    }
    const lineCount = Array.isArray(prevPage?.lines) ? prevPage.lines.length : 0;
    const sig = getPageSignature(prevPage, 0, false);
    const sigKey = `${lineCount}:${sig}`;
    const sigBucket = signatureIndex.get(sigKey) || [];
    sigBucket.push(idx);
    signatureIndex.set(sigKey, sigBucket);
    pageRootRanges.push({
      min: Number.isFinite(prevPage?.rootIndexMin) ? Number(prevPage.rootIndexMin) : Number.NaN,
      max: Number.isFinite(prevPage?.rootIndexMax) ? Number(prevPage.rootIndexMax) : Number.NaN,
    });
  }
  const index = {
    pageCount: pages.length,
    firstBlockIdIndex,
    signatureIndex,
    pageRootRanges,
  };
  layout.__pageReuseIndex = index;
  return index;
};

const addRootRangeCandidates = (pageReuseIndex, targetRootIndex, radius, addCandidate) => {
  const ranges = Array.isArray(pageReuseIndex?.pageRootRanges) ? pageReuseIndex.pageRootRanges : null;
  if (!ranges || !ranges.length || !Number.isFinite(targetRootIndex)) {
    return;
  }
  const minTarget = Number(targetRootIndex) - Math.max(0, Number(radius) || 0);
  const maxTarget = Number(targetRootIndex) + Math.max(0, Number(radius) || 0);
  let lo = 0;
  let hi = ranges.length - 1;
  let firstIndex = ranges.length;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const rangeMax = Number(ranges[mid]?.max);
    if (!Number.isFinite(rangeMax) || rangeMax >= minTarget) {
      firstIndex = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  for (let idx = firstIndex; idx < ranges.length; idx += 1) {
    const rangeMin = Number(ranges[idx]?.min);
    const rangeMax = Number(ranges[idx]?.max);
    if (!Number.isFinite(rangeMin) || !Number.isFinite(rangeMax)) {
      continue;
    }
    if (rangeMin > maxTarget) {
      break;
    }
    if (rangeMax < minTarget) {
      continue;
    }
    addCandidate(idx);
    addCandidate(idx - 1);
    addCandidate(idx + 1);
  }
};

// 鍒ゆ柇椤甸潰鏄惁绛変环锛堣鏁?+ 绛惧悕锛夈€?
const readLineContinuationState = (line) => {
  const attrs = line?.blockAttrs || {};
  const tableMeta = line?.tableMeta || {};
  return {
    fromPrev:
      !!attrs.sliceFromPrev || !!attrs.tableSliceFromPrev || !!tableMeta.continuedFromPrev,
    hasNext:
      !!attrs.sliceHasNext || !!attrs.tableSliceHasNext || !!tableMeta.continuesAfter,
    rowSplit:
      !!attrs.sliceRowSplit || !!attrs.tableRowSplit || !!tableMeta.rowSplit,
  };
};

const getPageExitToken = (page, offsetDelta = 0) => {
  const lines = Array.isArray(page?.lines) ? page.lines : [];
  const line = lines.length > 0 ? lines[lines.length - 1] : null;
  if (!line) {
    return "empty";
  }
  const totalOffsetDelta =
    (Number.isFinite(page?.__pageOffsetDelta) ? Number(page.__pageOffsetDelta) : 0) +
    Number(offsetDelta || 0);
  const continuation = readLineContinuationState(line);
  let hash = 17;
  hash = hashString(hash, "page-exit");
  hash = hashString(hash, line.blockType || "");
  hash = hashString(hash, line.blockId || "");
  hash = hashNumber(hash, Number.isFinite(line.rootIndex) ? Number(line.rootIndex) : -1);
  hash = hashNumber(hash, Number.isFinite(line.blockSignature) ? Number(line.blockSignature) : 0);
  hash = hashNumber(
    hash,
    Number.isFinite(line.blockStart) ? Number(line.blockStart) + totalOffsetDelta : Number.NaN
  );
  hash = hashNumber(
    hash,
    Number.isFinite(line.end) ? Number(line.end) + totalOffsetDelta : Number.NaN
  );
  hash = hashNumber(hash, continuation.fromPrev ? 1 : 0);
  hash = hashNumber(hash, continuation.hasNext ? 1 : 0);
  hash = hashNumber(hash, continuation.rowSplit ? 1 : 0);
  hash = hashNumber(hash, getObjectSignature(line.containers || null, new WeakMap()));
  return String(hash >>> 0);
};

const applyFragmentContinuation = (lines, continuation) => {
  if (!Array.isArray(lines) || lines.length === 0 || !continuation) {
    return lines;
  }
  const needsFromPrev = continuation.fromPrev === true || continuation.rowSplit === true;
  const needsHasNext = continuation.hasNext === true || continuation.rowSplit === true;
  if (!needsFromPrev && !needsHasNext) {
    return lines;
  }
  const nextLines = lines.slice();
  const updateLineAt = (index, patch) => {
    if (index < 0 || index >= nextLines.length) {
      return;
    }
    const current = nextLines[index];
    nextLines[index] = {
      ...current,
      blockAttrs: {
        ...(current?.blockAttrs || {}),
        ...patch,
      },
    };
  };
  if (needsFromPrev) {
    updateLineAt(0, {
      sliceFromPrev: continuation.fromPrev === true,
      sliceRowSplit: continuation.rowSplit === true,
    });
  }
  if (needsHasNext) {
    updateLineAt(nextLines.length - 1, {
      sliceHasNext: continuation.hasNext === true,
      sliceRowSplit: continuation.rowSplit === true,
    });
  }
  return nextLines;
};

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
  const nextSig = getPageSignature(nextPage, 0, true);
  const prevSig = getPageSignature(prevPage, offsetDelta, true);
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
  if (Number.isFinite(offsetDelta) && Number(offsetDelta) !== 0) {
    const baseDelta = Number.isFinite(line?.__offsetDelta) ? Number(line.__offsetDelta) : 0;
    next.__offsetDelta = baseDelta + Number(offsetDelta);
  }
  return next;
};

const cloneAndShiftPages = (pages, offsetDelta) => {
  if (!Array.isArray(pages) || pages.length === 0) {
    return [];
  }
  const delta = Number.isFinite(offsetDelta) ? Number(offsetDelta) : 0;
  return pages.map((page) => ({
    ...page,
    __sourcePageIndex: Number.isFinite(page?.__sourcePageIndex)
      ? Number(page.__sourcePageIndex)
      : Number.isFinite(page?.index)
      ? Number(page.index)
      : null,
    __pageOffsetDelta:
      (Number.isFinite(page?.__pageOffsetDelta) ? Number(page.__pageOffsetDelta) : 0) + delta,
  }));
};

// 鍦ㄦ棫甯冨眬涓畾浣嶉敋鐐硅锛堝閲忓鐢級�?
const getAnchorMatch = (line, options) => {
  if (!line) {
    return null;
  }
  const rootIndex = options?.rootIndex;
  const blockId = options?.blockId;
  const blockStart = options?.blockStart;
  const blockIdMatches = !!blockId && line.blockId === blockId;
  const blockStartMatches =
    Number.isFinite(blockStart) && Number.isFinite(line.blockStart) && line.blockStart === blockStart;
  const rootIndexMatches =
    Number.isFinite(rootIndex) && Number.isFinite(line.rootIndex) && line.rootIndex === rootIndex;
  const score =
    (blockIdMatches ? 8 : 0) + (blockStartMatches ? 4 : 0) + (rootIndexMatches ? 2 : 0);
  if (score <= 0) {
    return null;
  }
  const matchKey = [
    blockIdMatches ? "blockId" : null,
    blockStartMatches ? "blockStart" : null,
    rootIndexMatches ? "rootIndex" : null,
  ]
    .filter(Boolean)
    .join("+");
  return {
    score,
    matchKey: matchKey || "unknown",
    blockIdMatches,
    blockStartMatches,
    rootIndexMatches,
  };
};

const findBlockAnchor = (layout, options) => {
  if (!layout?.pages?.length) {
    return null;
  }
  let bestMatch = null;
  for (let p = 0; p < layout.pages.length; p += 1) {
    const page = layout.pages[p];
    for (let l = 0; l < page.lines.length; l += 1) {
      const line = page.lines[l];
      const match = getAnchorMatch(line, options);
      if (!match) {
        continue;
      }
      if (!bestMatch || match.score > bestMatch.match.score) {
        bestMatch = { pageIndex: p, lineIndex: l, line, match };
      }
    }
  }
  return bestMatch;
};

const findBlockFirstOccurrence = (layout, options) => {
  if (!layout?.pages?.length) {
    return null;
  }
  let bestMatch = null;
  for (let p = 0; p < layout.pages.length; p += 1) {
    const page = layout.pages[p];
    for (let l = 0; l < page.lines.length; l += 1) {
      const line = page.lines[l];
      const match = getAnchorMatch(line, options);
      if (!match) {
        continue;
      }
      if (!bestMatch || match.score > bestMatch.match.score) {
        bestMatch = { pageIndex: p, lineIndex: l, line, match };
      }
    }
  }
  return bestMatch;
};

const getDocChildStartPos = (doc, targetIndex) => {
  let pos = 0;
  for (let i = 0; i < targetIndex && i < doc.childCount; i += 1) {
    pos += doc.child(i).nodeSize;
  }
  return pos;
};

const defaultIsReuseSensitiveNode = (_node) => false;

const defaultIsReuseSensitiveLine = (line) => {
  const attrs = line?.blockAttrs || {};
  return !!attrs.sliceFromPrev || !!attrs.sliceHasNext || !!attrs.sliceRowSplit;
};

const resolveRendererReusePolicy = (renderer) =>
  renderer?.pagination?.reusePolicy || (renderer?.splitBlock ? "actual-slice-only" : "none");

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
    const pageMin = Number(page?.rootIndexMin);
    const pageMax = Number(page?.rootIndexMax);
    if (
      Number.isFinite(pageMin) &&
      Number.isFinite(pageMax) &&
      (pageMax < from || pageMin > to)
    ) {
      continue;
    }
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
  void doc;
  void isSensitiveNode;
  void minIndex;
  void maxIndex;
  // Do not disable reuse solely because a changed block uses splitBlock.
  // Reuse should only be blocked when the previous layout actually carried
  // cross-page slice state for the affected range.
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

  // 鍒濆鍖栧垎椤靛竷灞€绠＄嚎�?
  constructor(settings, registry = null) {
    this.settings = settings;
    this.registry = registry;
    this.blockCache = new Map();
  }

  // 鏍规�?block id 娓呯悊缂撳瓨�?
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

  // 清除布局缓存
  clearCache() {
    this.blockCache.clear();
  }

  // Debug: get cache stats
  getCacheStats() {
    return {
      size: this.blockCache.size,
      keys: Array.from(this.blockCache.keys()).slice(0, 10),
    };
  }

  // 鍒嗛〉甯冨眬涓诲叆鍙ｏ細鐢熸垚甯冨眬骞跺皾璇曞閲忓鐢ㄣ€?
  layoutFromDoc(doc, options: LayoutFromDocOptions = {}) {
    // 鍩虹璁剧疆锛堜繚鐣欏師寮曠敤鐢ㄤ簬鎬ц兘姹囨姤锛夈€?
    const baseSettingsRaw = options?.layoutSettingsOverride ?? this.settings;
    let disablePageReuse = !!baseSettingsRaw.disablePageReuse;
    const ghostTraceEnabled = isGhostTraceEnabled(baseSettingsRaw);
    const ghostTrace = ghostTraceEnabled ? [] : null;
    if (!disablePageReuse) {
      const changeSummary = options?.changeSummary ?? null;
      const previousLayout = options?.previousLayout ?? null;
      const isSensitiveNodeByRenderer = (node) => {
        const typeName = node?.type?.name;
        if (!typeName || !this.registry?.get) {
          return false;
        }
        const renderer = this.registry.get(typeName);
        return resolveRendererReusePolicy(renderer) === "always-sensitive";
      };
      const isSensitiveLineByRenderer = (line) => {
        const blockType = line?.blockType;
        if (!blockType || !this.registry?.get) {
          return false;
        }
        const renderer = this.registry.get(blockType);
        return resolveRendererReusePolicy(renderer) === "always-sensitive";
      };
      const defaultDecision = shouldDisableReuseForSensitiveChange(
        doc,
        changeSummary,
        previousLayout,
        this.registry
          ? {
              isSensitiveNode: isSensitiveNodeByRenderer,
              isSensitiveLine: isSensitiveLineByRenderer,
            }
          : undefined
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
    appendGhostTrace(ghostTrace, {
      event: "layout-start",
      docChanged: options?.changeSummary?.docChanged === true,
      disablePageReuse,
      hasPreviousLayout: !!options?.previousLayout,
      previousPages: options?.previousLayout?.pages?.length ?? 0,
      cascadePagination: options?.cascadePagination === true,
      cascadeFromPageIndex: Number.isFinite(options?.cascadeFromPageIndex)
        ? Number(options.cascadeFromPageIndex)
        : null,
    });
    const debugPerf = !!baseSettingsRaw.debugPerf;
    const logLayout = (..._args: any[]) => {};
    // 鎬ц兘缁熻锛堝彲閫夛級銆?
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
          resumeAnchorPageIndex: null,
          resumeAnchorLineIndex: null,
          resumeAnchorMatchKey: null,
          resumeAnchorSkippedReason: null,
          reusedPrefixPages: 0,
          reusedPrefixLines: 0,
          maybeSyncReason: "unknown",
          disablePageReuse: false,
          progressiveTruncated: false,
          cascadeMaxPages: null,
          optionsPrevPages: 0,
          maybeSyncCalled: false,
          maybeSyncFailSnapshot: null,
        }
      : null;
    // 鍖呰娴嬮噺鍑芥暟浠ョ粺璁¤皟鐢ㄦ鏁般€?
    const baseMeasure = baseSettingsRaw.measureTextWidth;
    const measureTextWidth = debugPerf
      ? (font, text) => {
          perf.measureCalls += 1;
          perf.measureChars += text ? text.length : 0;
          return baseMeasure(font, text);
        }
      : baseMeasure;
    // 甯冨眬杩囩▼涓娇鐢ㄧ殑璁剧疆銆?
    const baseSettings = debugPerf ? { ...baseSettingsRaw, measureTextWidth } : baseSettingsRaw;
    // 鍥哄畾鐗堝紡鍙傛暟銆?
    const { pageHeight, pageGap, margin, lineHeight, font } = baseSettings;
    const blockSpacing = Number.isFinite(baseSettings.blockSpacing) ? baseSettings.blockSpacing : 0;
    const paragraphSpacingBefore = Number.isFinite(baseSettings.paragraphSpacingBefore)
      ? baseSettings.paragraphSpacingBefore
      : 0;
    const paragraphSpacingAfter = Number.isFinite(baseSettings.paragraphSpacingAfter)
      ? baseSettings.paragraphSpacingAfter
      : 0;
    const rootMarginLeft = margin.left;
    // 澧為噺澶嶇敤鎵€闇€杈撳叆銆?
    let previousLayout = disablePageReuse ? null : (options?.previousLayout ?? null);
    let changeSummary = disablePageReuse ? null : (options?.changeSummary ?? null);
    if (perf) {
      perf.disablePageReuse = !!disablePageReuse;
      perf.progressiveTruncated = false;
      perf.optionsPrevPages = options?.previousLayout?.pages?.length ?? 0;
    }
    // 琛ㄦ牸鍒嗛〉宸蹭慨姝ｏ紝鎭㈠澧為噺澶嶇敤锛堢�?changeSummary 鍐冲畾閲嶆帓鑼冨洿锛?
    const docPosToTextOffset = options?.docPosToTextOffset ?? null;
    
    // 鎸夐渶绾ц仈鍒嗛〉锛氫粠鍙樻洿椤靛紑濮嬶紝鍙湪椤甸潰楂樺害鍙樺寲鏃剁户缁垎椤?
    const cascadePagination = options?.cascadePagination === true;
    const cascadeFromPageIndex = Number.isFinite(options?.cascadeFromPageIndex)
      ? Math.max(0, Number(options.cascadeFromPageIndex))
      : null;
    const incrementalConfig = baseSettingsRaw?.paginationWorker?.incremental ?? null;
    const cascadeMaxPages =
      cascadePagination && Number.isFinite(incrementalConfig?.maxPages)
        ? Math.max(1, Number(incrementalConfig.maxPages))
        : null;
    const cascadeStopPageIndex =
      cascadePagination && cascadeFromPageIndex !== null && Number.isFinite(cascadeMaxPages)
        ? cascadeFromPageIndex + Number(cascadeMaxPages) - 1
        : null;
    if (perf) {
      perf.cascadeMaxPages = cascadeMaxPages;
    }
    // 璁板綍鐢ㄤ簬绾ц仈鍒ゆ柇鐨勫墠涓€椤甸珮搴?
    // 鏍囪鏄惁搴旇鍋滄绾ц仈鍒嗛�?
    
    let progressiveApplied = false;
    let progressiveTruncated = false;
    // 杈撳嚭椤甸泦鍚堛�?
    let pages = [];
    // 褰撳墠椤电储寮曚笌椤靛鍣ㄣ�?
    let pageIndex = 0;
    let page = newPage(pageIndex);
    // 褰撳墠椤靛唴鐨勭旱鍚戞父鏍囥�?
    let cursorY = margin.top;
    // 鏂囨。绾ф枃鏈亸绉伙紙鐢ㄤ簬閫夊尯瀹氫綅锛夈€?
    let textOffset = 0;
    // 澧為噺甯冨眬璧峰鍧楃储寮曘�?
    let startBlockIndex = 0;
    // 鍙樻洿鑼冨洿缁撴潫绱㈠紩锛堜箣鍚庡彲灏濊瘯椤靛鐢級銆?
    let syncAfterIndex = null;
    // 鏄惁婊¤冻椤电骇澶嶇敤鏉′欢�?
    let canSync = false;
    // 鏄惁宸茶蛋杩囧彉鏇磋寖鍥淬�?
    let passedChangedRange = false;
    // 涓€鏃﹀喅瀹氬鐢ㄥ熬椤靛垯鍋滄缁х画甯冨眬銆?
    let shouldStop = false;
    // 浠庤椤电储寮曞紑濮嬪鐢ㄥ墿浣欓〉闈€?
    let syncFromIndex = null;
    // 鏄惁浠庨敋鐐瑰紑濮嬪閲忓竷灞€锛堢敤浜庡榻愬潡棣栦綅缃級�?
    let resumeFromAnchor = false;
    let resumeHasPrefixLines = false;
    let resumeAnchorTargetY: { y: number; relativeY: number } | null = null;
    let resumeAnchorApplied = false;
    let resumeAnchorPageIndex = null;
    let resumeAnchorLineIndex = null;
    let resumeAnchorMatchKey = null;
    let resumeAnchorSkippedReason = null;
    let reusedPrefixPages = 0;
    let reusedPrefixLines = 0;
    const previousPageReuseIndex = previousLayout?.pages?.length
      ? getOrBuildPageReuseIndex(previousLayout)
      : null;
    let previousPageFirstBlockIdIndex: Map<string, number[]> | null =
      previousPageReuseIndex?.firstBlockIdIndex ?? null;
    let previousPageSignatureIndex: Map<string, number[]> | null =
      previousPageReuseIndex?.signatureIndex ?? null;
    const offsetDelta =
      changeSummary?.docChanged && changeSummary?.oldRange && changeSummary?.newRange
        ? Number(changeSummary.newRange.to - changeSummary.newRange.from) -
          Number(changeSummary.oldRange.to - changeSummary.oldRange.from)
        : 0;
    // 澧為噺甯冨眬锛氬湪鏃у竷灞€涓畾浣嶉敋鐐广€?
    if (
      ENABLE_RESUME_FROM_ANCHOR_REUSE &&
      previousLayout &&
      changeSummary?.docChanged &&
      typeof docPosToTextOffset === "function"
    ) {
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
      logLayout(`[layout-engine] incremental mode, prevPages:${previousLayout.pages.length}`);
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
          logLayout(`[layout-engine] looking for anchor: startIndexOld=${startIndexOld}, startIndexNew=${startIndexNew}`);
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
                const match = getAnchorMatch(line, {
                  rootIndex: startIndexOld,
                  blockId,
                  blockStart: startOffset,
                });
                return !!match && match.score >= (anchorRef.match?.score || 0);
              });
              if (matchIndex >= 0) {
                anchorLineIndex = matchIndex;
              }
            }
            const anchorMatch = anchorRef.match || anchor.match || null;
            const anchorCanResume =
              anchorLineIndex === 0 && anchorMatch?.blockIdMatches === true;
            resumeAnchorPageIndex = anchorRef.pageIndex;
            resumeAnchorLineIndex = anchorLineIndex;
            resumeAnchorMatchKey = anchorMatch?.matchKey || null;
            appendGhostTrace(ghostTrace, {
              event: "resume-anchor-found",
              pageIndex: anchorRef.pageIndex,
              lineIndex: anchorLineIndex,
              startIndexOld,
              startIndexNew,
              startOffset: Number.isFinite(startOffset) ? Number(startOffset) : null,
              blockId: blockId ?? null,
              matchKey: resumeAnchorMatchKey,
              blockIdMatches: anchorMatch?.blockIdMatches === true,
              blockStartMatches: anchorMatch?.blockStartMatches === true,
              rootIndexMatches: anchorMatch?.rootIndexMatches === true,
              canResumeAnchor: anchorCanResume,
            });
            logLayout(
              `[layout-engine] anchor FOUND: pageIndex=${anchorRef.pageIndex}, lineIndex=${anchorLineIndex}, match=${resumeAnchorMatchKey}`
            );
            if (!anchorCanResume) {
              resumeAnchorSkippedReason =
                anchorLineIndex !== 0
                  ? "anchor-not-at-page-start"
                  : "anchor-missing-block-id-match";
              appendGhostTrace(ghostTrace, {
                event: "resume-anchor-skipped",
                reason: resumeAnchorSkippedReason,
                pageIndex: anchorRef.pageIndex,
                lineIndex: anchorLineIndex,
                matchKey: resumeAnchorMatchKey,
              });
            } else {
              const anchorLine = anchorLines[anchorLineIndex] || anchorRef.line;
              const reusedLines = anchorLines.slice(0, anchorLineIndex);
              reusedPrefixPages = anchorRef.pageIndex;
              reusedPrefixLines = reusedLines.length;
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
              logLayout(`[layout-engine] syncAfterIndex=${syncAfterIndex}, startBlockIndex=${startBlockIndex}`);
              canSync = Number.isFinite(syncAfterIndex);
              passedChangedRange = canSync && startBlockIndex >= syncAfterIndex;
              logLayout(`[layout-engine] canSync=${canSync}, passedChangedRange=${passedChangedRange}`);
              resumeFromAnchor = true;
              resumeHasPrefixLines = reusedLines.length > 0;
              resumeAnchorApplied = false;
            }
          }
        }
      }
    }
    // 鍒ゆ柇鏄惁鍙湪鍙樻洿鑼冨洿涔嬪悗澶嶇敤灏鹃〉銆?
    const maybeSync = () => {
      if (!ENABLE_CROSS_PAGE_CANDIDATE_REUSE) {
        appendGhostTrace(ghostTrace, {
          event: "maybe-sync-skipped",
          reason: "candidate-reuse-disabled",
          pageIndex,
          canSync,
          passedChangedRange,
        });
        if (perf) {
          perf.maybeSyncReason = "candidate-reuse-disabled";
        }
        return false;
      }
      // 蹇呴』宸插鐞嗗畬鍙樻洿鑼冨洿涓旂増寮忎竴鑷淬€?
      if (perf) {
        perf.maybeSyncCalled = true;
      }
      logLayout(`[layout-engine] maybeSync checking: canSync=${canSync}, passedChangedRange=${passedChangedRange}, pageIndex=${pageIndex}`);
      if (!canSync || !passedChangedRange || !previousLayout) {
        logLayout(`[layout-engine] maybeSync FAILED precheck: canSync=${canSync}, passedChangedRange=${passedChangedRange}`);
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
      logLayout(`[layout-engine] maybeSync checking pageIndex=${pageIndex}, oldPage exists=${!!oldPage}, pages count=${previousLayout.pages?.length}`);
      if (!oldPage) {
        logLayout(`[layout-engine] maybeSync FAILED: old page missing at index ${pageIndex}`);
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
      // changed-range 涔嬪悗锛屼紭鍏堟妸鈥滆鐩栬�?rootIndex鈥濈殑鏃ч〉鍔犲叆鍊欓€夛�?
      // 鑳藉噺灏戣繛缁緭鍏ユ椂椤靛彿婕傜Щ瀵艰嚧鐨?page-not-equivalent�?
      if (Number.isFinite(syncAfterIndex) && Array.isArray(previousLayout?.pages)) {
        const targetRootIndex = Number(syncAfterIndex);
        const rootIndexProbeRadius = Number.isFinite(baseSettings?.pageReuseRootIndexProbeRadius)
          ? Math.max(0, Number(baseSettings.pageReuseRootIndexProbeRadius))
          : 2;
        addRootRangeCandidates(
          previousPageReuseIndex,
          targetRootIndex,
          rootIndexProbeRadius,
          addCandidate
        );
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
      appendGhostTrace(ghostTrace, {
        event: "maybe-sync-candidates",
        pageIndex,
        candidateIndexes: candidateIndexes.slice(0, 20),
        candidateCount: candidateIndexes.length,
        signatureKey,
        syncAfterIndex,
      });
      let matchedOldPageIndex = null;
      for (const candidateIndex of candidateIndexes) {
        const candidatePage = previousLayout.pages?.[candidateIndex];
        if (!candidatePage) {
          continue;
        }
        const diff = perf ? {} : null;
        if (arePagesEquivalent(page, candidatePage, diff, offsetDelta)) {
          matchedOldPageIndex = candidateIndex;
          break;
        }
      }
      if (!Number.isFinite(matchedOldPageIndex)) {
        appendGhostTrace(ghostTrace, {
          event: "maybe-sync-miss",
          pageIndex,
          reason: "page-not-equivalent",
          candidateCount: candidateIndexes.length,
        });
        logLayout(`[layout-engine] maybeSync FAILED: page-not-equivalent, pageIndex=${pageIndex}, candidates checked`);
        if (perf) {
          perf.maybeSyncReason = "page-not-equivalent";
        }
        return false;
      }
      if (perf) {
        perf.maybeSyncReason = "reuse-ok";
      }
      appendGhostTrace(ghostTrace, {
        event: "maybe-sync-hit",
        pageIndex,
        matchedOldPageIndex,
      });
      logLayout(`[layout-engine] maybeSync SUCCESS: matchedOldPageIndex=${matchedOldPageIndex}`);
      syncFromIndex = Number(matchedOldPageIndex);
      shouldStop = true;
      // Mark progressive as applied since we're reusing pages from previous layout
      progressiveApplied = true;
      return true;
    };
    // 鏀跺熬褰撳墠椤碉紝蹇呰鏃惰Е鍙戝鐢ㄥ苟鍋滄�?
    // 鎸夐渶绾ц仈鍒嗛〉锛氬綋鍓嶉〉楂樺害涓庡墠涓€椤电浉鍚屾椂锛屽仠姝㈠垎椤?
    const finalizePage = () => {
      if (page.lines.length > 0) {
        pages.push(page);

        if (
          cascadePagination &&
          cascadeFromPageIndex !== null &&
          pageIndex >= cascadeFromPageIndex &&
          previousLayout
        ) {
          const previousPage = previousLayout.pages?.[pageIndex];
          const nextExitToken = getPageExitToken(page, 0);
          const previousExitToken = getPageExitToken(previousPage, offsetDelta);
          if (previousPage && nextExitToken === previousExitToken) {
            appendGhostTrace(ghostTrace, {
              event: "same-index-boundary-reuse",
              pageIndex,
              nextExitToken,
            });
            syncFromIndex = pageIndex;
            progressiveApplied = true;
            shouldStop = true;
            if (perf) {
              perf.maybeSyncReason = "same-index-boundary-reuse";
            }
            return true;
          }
          if (
            ENABLE_SAME_INDEX_TAIL_REUSE &&
            previousPage &&
            arePagesEquivalent(page, previousPage, null, offsetDelta)
          ) {
            appendGhostTrace(ghostTrace, {
              event: "same-index-tail-reuse",
              pageIndex,
            });
            syncFromIndex = pageIndex;
            progressiveApplied = true;
            shouldStop = true;
            if (perf) {
              perf.maybeSyncReason = "same-index-tail-reuse";
            }
            return true;
          }
        }
      }
      if (maybeSync()) {
        return true;
      }
      if (
        cascadePagination &&
        previousLayout &&
        Number.isFinite(cascadeStopPageIndex) &&
        pageIndex >= Number(cascadeStopPageIndex)
      ) {
        syncFromIndex = pageIndex;
        progressiveApplied = true;
        progressiveTruncated = true;
        shouldStop = true;
        if (perf) {
          perf.progressiveTruncated = true;
          perf.maybeSyncReason = "progressive-cutoff";
        }
        return true;
      }
      pageIndex += 1;
      page = newPage(pageIndex);
      cursorY = margin.top;
      return false;
    };
    // 甯冨眬鍙跺瓙鍧楋紙娈佃惤/鏍囬�?鍥剧�?琛ㄦ牸绛夛級�?
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
      // DEBUG: Show cache stats at start of first block
      if (blockId === 'docblk-00001') {
        logLayout(`[layout-cache] Cache stats at start: ${this.getCacheStats?.()?.size || 0} entries`);
      }
      const cached = canUseCache ? this.blockCache.get(cacheKey) : null;
      // DEBUG: Log cache status (always log for now)
      logLayout(`[layout-cache] blockId=${blockId}, indent=${context.indent}, cacheKey=${cacheKey}, canUseCache=${canUseCache}, hasCached=${!!cached}`);
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
          logLayout(`[layout-cache] HIT: blockId=${blockId}, signature=${blockSignature}`);
          blockLines = cached.lines || [];
          blockLength = cached.length || 0;
          blockHeight = cached.height || 0;
          if (cached.blockAttrs) {
            blockAttrs = cached.blockAttrs;
          }
          if (cached.blockLineHeight) {
            blockLineHeight = cached.blockLineHeight;
          }
        } else {
          logLayout(`[layout-cache] MISS: blockId=${blockId}, hasCached=${!!cached}, cachedSig=${cached?.signature}, newSig=${blockSignature}`);
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
          logLayout(`[layout-cache] SET: blockId=${blockId}, cacheKey=${cacheKey}, signature=${blockSignature}`);
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
      // 灏嗚鍐欏叆褰撳墠椤靛苟琛ラ綈鍧愭爣/鍋忕Щ/瀹瑰櫒淇℃伅�?
      // 灏嗗綋鍓嶅垏鐗囧啓鍏ラ〉闈紝鍚屾椂琛ラ綈鍧愭爣銆乥lockStart銆佸鍣ㄧ瓑鍏冧俊鎭?
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
          // 鍚屼竴鍒楄〃璺ㄩ〉缁鏃讹紝涓嶉噸澶嶇粯鍒?marker
          if (
            lineCopy.blockAttrs &&
            (lineCopy.blockType === "bullet_list" || lineCopy.blockType === "ordered_list")
          ) {
            const itemIndex = lineCopy.blockAttrs.itemIndex;
            const key = `${lineCopy.blockStart ?? "0"}:${itemIndex ?? "0"}`;
            if (!seenListItems.has(key)) {
              seenListItems.add(key);
            } else {
              // 璺ㄩ〉缁涓嶆樉绀?marker锛岄伩鍏嶇湅璧锋潵鍍忔柊鍒楄〃銆?
              lineCopy.listMarker = null;
            }
          }
          // table 绛夎嚜甯︾浉瀵瑰潗鏍囩殑琛岋紝浣跨敤 relativeY 杩涜瀹氫�?
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
          appendPageReuseSignature(page, lineCopy);
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
            // 鍗曡楂樺害瓒呭嚭鏁撮〉锛屽己鍒舵斁鍏ヤ竴琛岄伩鍏嶆寰幆銆?
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
              // 涓嶅彲鎷嗗垎涓旀湰椤典负绌烘椂锛屽己鍒舵斁鍏ワ紝閬垮厤姝诲惊鐜�?
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
          const autoSplitResult = createAutoSplitResult(remainingLines, {
            remainingLength,
            availableHeight,
            lineHeightValue,
            getFittableLineCount,
            measureLinesHeight,
            normalizeChunkRelativeY,
          });
          if (!splitResult) {
            splitResult = autoSplitResult;
          }
          let splitFragments = normalizeSplitFragments(splitResult, {
            fallbackLineHeight: lineHeightValue,
            expectedLength: remainingLength,
            measureLinesHeight,
          });
          let splitValidation = validateNormalizedSplitFragments(splitFragments, remainingLength);
          if (!splitFragments && splitResult) {
            splitFragments = normalizeSplitFragments(autoSplitResult, {
              fallbackLineHeight: lineHeightValue,
              expectedLength: remainingLength,
              measureLinesHeight,
            });
            splitValidation = validateNormalizedSplitFragments(splitFragments, remainingLength);
          }
          if (splitFragments && !splitValidation.ok) {
            splitFragments = normalizeSplitFragments(autoSplitResult, {
              fallbackLineHeight: lineHeightValue,
              expectedLength: remainingLength,
              measureLinesHeight,
            });
            splitValidation = validateNormalizedSplitFragments(splitFragments, remainingLength);
          }
          if (!splitFragments || !splitValidation.ok) {
            if (finalizePage()) {
              return true;
            }
            continue;
          }
          if (
            splitFragments &&
            splitFragments.visible.lines.length === 0 &&
            splitFragments.overflow &&
            splitFragments.overflow.lines.length > 0
          ) {
            const overflowLines = applyFragmentContinuation(
              splitFragments.overflow.lines,
              splitFragments.overflow.continuation
            );
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
            remainingLines = overflowLines;
            remainingLength = splitFragments.overflow.length;
            remainingHeight = Number.isFinite(splitFragments.overflow.height)
              ? splitFragments.overflow.height
              : measureLinesHeight(overflowLines, lineHeightValue);
            continue;
          }
          if (splitFragments && splitFragments.visible.lines.length > 0) {
            const visibleLines = applyFragmentContinuation(
              splitFragments.visible.lines,
              splitFragments.visible.continuation
            );
            const overflowLines =
              splitFragments.overflow && splitFragments.overflow.lines.length > 0
                ? applyFragmentContinuation(
                    splitFragments.overflow.lines,
                    splitFragments.overflow.continuation
                  )
                : null;
            placeLines(visibleLines);
            const placedHeight = Number.isFinite(splitFragments.visible.height)
              ? splitFragments.visible.height
              : measureLinesHeight(visibleLines, lineHeightValue);
            cursorY += placedHeight;
            const hasOverflow = !!overflowLines && overflowLines.length > 0;
            if (finalizePage()) {
              return true;
            }
            // 缁х画澶勭悊婧㈠嚭鍒囩墖锛堣法椤电画鎺掞級
            if (hasOverflow && splitFragments.overflow && overflowLines) {
              remainingLines = overflowLines;
              remainingLength = splitFragments.overflow.length;
              remainingHeight = Number.isFinite(splitFragments.overflow.height)
                ? splitFragments.overflow.height
                : measureLinesHeight(overflowLines, lineHeightValue);
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
    // 娣卞害浼樺厛閬嶅巻鍧楃粨鏋勩�?
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
    // 浠庡閲忚捣鐐瑰竷灞€鍒版枃妗ｆ湯灏撅紙鎴栫洿鍒拌Е鍙戝鐢級銆?
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
      // 鏂囨。缁撴潫浣嗘病鏈夎Е鍙戝垎椤垫椂锛屼篃灏濊瘯鍦ㄦ湯椤佃繘琛屽鐢ㄥ垽鏂?
      if (maybeSync()) {
        // maybeSync 浼氳缃?shouldStop �?syncFromIndex
      }
    }
    // 鑻ヨЕ鍙戝鐢紝杩藉姞鏃у竷灞€鍓╀綑椤点€?
    if (shouldStop && previousLayout && syncFromIndex != null) {
      if (perf) {
        perf.reusedPages =
          previousLayout.pages.length - Math.min(previousLayout.pages.length, syncFromIndex + 1);
      }
      const reusedTail = cloneAndShiftPages(
        previousLayout.pages.slice(syncFromIndex + 1),
        offsetDelta
      );
      appendGhostTrace(ghostTrace, {
        event: "reuse-tail-applied",
        syncFromIndex,
        reusedTailPages: reusedTail.length,
        offsetDelta,
      });
      pages.push(...markReusedPages(reusedTail));
    }
    const cleanupScanUntilPageIndex =
      shouldStop && syncFromIndex != null ? Math.min(pages.length - 1, syncFromIndex + 1) : null;
    pages = cleanupUnslicedDuplicateSlices(pages, {
      scanUntilPageIndex: cleanupScanUntilPageIndex,
    });
    if (Number.isFinite(cleanupScanUntilPageIndex)) {
      for (let idx = 0; idx <= Number(cleanupScanUntilPageIndex); idx += 1) {
        invalidatePageReuseSignature(pages[idx]);
      }
    }
    // 绉婚櫎绌洪〉锛堝彲鑳界敱鍒嗛〉鍒囨崲鎴栧潡绉诲姩寮曞叆锛?
    pages = pages.filter((pg) => pg?.lines?.length > 0);
    // 璁＄畻鎬婚珮搴︾敤浜庢粴鍔ㄣ�?
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
      perf.resumeAnchorPageIndex = resumeAnchorPageIndex;
      perf.resumeAnchorLineIndex = resumeAnchorLineIndex;
      perf.resumeAnchorMatchKey = resumeAnchorMatchKey;
      perf.resumeAnchorSkippedReason = resumeAnchorSkippedReason;
      perf.reusedPrefixPages = reusedPrefixPages;
      perf.reusedPrefixLines = reusedPrefixLines;
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
        resumeAnchorPageIndex: perf.resumeAnchorPageIndex,
        resumeAnchorLineIndex: perf.resumeAnchorLineIndex,
        resumeAnchorMatchKey: perf.resumeAnchorMatchKey,
        resumeAnchorSkippedReason: perf.resumeAnchorSkippedReason,
        reusedPrefixPages: perf.reusedPrefixPages,
        reusedPrefixLines: perf.reusedPrefixLines,
        maybeSyncCalled: perf.maybeSyncCalled,
        maybeSyncReason: perf.maybeSyncReason,
        disablePageReuse: perf.disablePageReuse,
        progressiveTruncated: perf.progressiveTruncated,
        cascadeMaxPages: perf.cascadeMaxPages,
        optionsPrevPages: perf.optionsPrevPages,
        maybeSyncFailSnapshot: perf.maybeSyncFailSnapshot,
        breakLinesMs: Math.round(perf.breakLinesMs),
        layoutLeafMs: Math.round(perf.layoutLeafMs),
      };
      if (baseSettingsRaw?.__perf) {
        baseSettingsRaw.__perf.layout = summary;
      }
      logLayout(`[layout-engine] perf:`, summary);
    }

    logLayout(`[layout-engine] DONE pages:${pages.length}, progressiveApplied:${progressiveApplied}, prevPages:${previousLayout?.pages?.length ?? 0}`);

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
      __progressiveTruncated: progressiveTruncated,
      __ghostTrace: ghostTrace,
    };
  }
  // 绾枃鏈垎椤靛叆鍙ｃ�?
  layoutFromText(text) {
    const { runs, length } = textToRuns(text, this.settings);
    return this.layoutFromRuns(runs, length);
  }
  // 杩愯娈靛垎椤靛叆鍙ｏ紙鐩存帴鎸夎繍琛屾鏂鍒嗛〉锛夈€?
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
    // 褰撳墠椤电储寮曚笌椤靛鍣ㄣ�?
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
    // 璁＄畻鎬婚珮搴︾敤浜庢粴鍔ㄣ�?
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


