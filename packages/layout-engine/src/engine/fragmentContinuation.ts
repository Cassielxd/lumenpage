import { getObjectSignature, hashNumber, hashString } from "./signature";

type FragmentContinuationLike = {
  fromPrev?: boolean;
  hasNext?: boolean;
  rowSplit?: boolean;
  continuationToken?: string | null;
  fragmentIdentity?: string | null;
  carryState?: Record<string, unknown> | null;
} | null | undefined;

type PageFragmentAnchorSummary = {
  firstFragmentAnchor: string | null;
  lastFragmentAnchor: string | null;
  fragmentAnchors: string[];
  firstFragmentAnchorLineIndex: number | null;
  lastFragmentAnchorLineIndex: number | null;
};

type FragmentAnchorRef = {
  anchor: string;
  pageIndex: number;
  lineIndex: number;
  line: any;
};

type FragmentBoundaryRange = {
  anchor: string;
  lineIndex: number;
  min: number;
  max: number;
};

const normalizeContinuationString = (value: unknown) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
};

const normalizeCarryState = (value: unknown) =>
  value && typeof value === "object" ? { ...(value as Record<string, unknown>) } : null;

const getLineBlockKey = (line: any) => {
  if (Number.isFinite(line?.blockStart)) {
    return `start:${Number(line.blockStart)}`;
  }
  if (line?.blockId) {
    return `id:${String(line.blockId)}`;
  }
  return null;
};

const getLineTextRange = (line: any) => {
  const candidates = [line?.start, line?.blockStart, line?.end];
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of candidates) {
    if (!Number.isFinite(value)) {
      continue;
    }
    const nextValue = Number(value);
    if (nextValue < min) {
      min = nextValue;
    }
    if (nextValue > max) {
      max = nextValue;
    }
  }
  return {
    min: Number.isFinite(min) ? min : Number.NaN,
    max: Number.isFinite(max) ? max : Number.NaN,
  };
};

const hasContinuationFlag = (line: any) => {
  const attrs = line?.blockAttrs || {};
  const tableMeta = line?.tableOwnerMeta || line?.tableMeta || {};
  return (
    !!attrs.sliceFromPrev ||
    !!attrs.sliceHasNext ||
    !!attrs.sliceRowSplit ||
    !!attrs.tableSliceFromPrev ||
    !!attrs.tableSliceHasNext ||
    !!attrs.tableRowSplit ||
    !!tableMeta.continuedFromPrev ||
    !!tableMeta.continuesAfter ||
    !!tableMeta.rowSplit
  );
};

const hasExplicitContinuationMetadata = (line: any) => {
  const attrs = line?.blockAttrs || {};
  const tableMeta = line?.tableOwnerMeta || line?.tableMeta || {};
  return !!(
    normalizeContinuationString(attrs.fragmentIdentity) ||
    normalizeContinuationString(attrs.fragmentContinuationToken) ||
    normalizeCarryState(attrs.fragmentCarryState) ||
    normalizeContinuationString(tableMeta.fragmentIdentity) ||
    normalizeContinuationString(tableMeta.fragmentContinuationToken) ||
    normalizeCarryState(tableMeta.fragmentCarryState)
  );
};

const isAnchorCandidateLine = (line: any) => {
  const attrs = line?.blockAttrs || {};
  const tableMeta = line?.tableOwnerMeta || line?.tableMeta || {};
  return (
    hasExplicitContinuationMetadata(line) ||
    hasContinuationFlag(line) ||
    normalizeContinuationString(attrs.listOwnerType) != null ||
    normalizeContinuationString(attrs.listType) != null ||
    normalizeContinuationString(attrs.sliceGroup) != null ||
    Number.isFinite(attrs?.rows) ||
    Number.isFinite(attrs?.rowIndex) ||
    Number.isFinite(attrs?.colIndex) ||
    Number.isFinite(tableMeta?.rowIndex) ||
    Number.isFinite(tableMeta?.colIndex)
  );
};

const deriveFragmentIdentity = (line: any, continuation: FragmentContinuationLike) => {
  const attrs = line?.blockAttrs || {};
  const tableMeta = line?.tableOwnerMeta || line?.tableMeta || {};
  const explicitIdentity =
    normalizeContinuationString(continuation?.fragmentIdentity) ||
    normalizeContinuationString(attrs.fragmentIdentity) ||
    normalizeContinuationString(tableMeta.fragmentIdentity);
  if (explicitIdentity) {
    return explicitIdentity;
  }

  const listType =
    normalizeContinuationString(attrs.listOwnerType) || normalizeContinuationString(attrs.listType);
  const listBlockId = attrs.listOwnerBlockId ?? attrs.listBlockId ?? line?.blockId ?? null;
  if (listType && listBlockId != null) {
    return `list:${listType}:${String(listBlockId)}`;
  }

  const tableGroup =
    normalizeContinuationString(attrs.sliceGroup) ||
    (Number.isFinite(attrs?.rows) && Number.isFinite(attrs?.cols) ? "table" : null);
  const blockKey = getLineBlockKey(line);
  if (tableGroup === "table" && blockKey) {
    return `table:${blockKey}`;
  }

  const sliceGroup = normalizeContinuationString(attrs.sliceGroup) || line?.blockType || "block";
  if (blockKey) {
    return `${sliceGroup}:${blockKey}`;
  }
  return `${sliceGroup}:line`;
};

const deriveCarryState = (line: any, continuation: FragmentContinuationLike) => {
  const attrs = line?.blockAttrs || {};
  const tableMeta = line?.tableOwnerMeta || line?.tableMeta || {};
  const explicitCarryState =
    normalizeCarryState(continuation?.carryState) ||
    normalizeCarryState(attrs.fragmentCarryState) ||
    normalizeCarryState(tableMeta.fragmentCarryState);
  if (explicitCarryState) {
    return explicitCarryState;
  }

  if (
    normalizeContinuationString(attrs.listOwnerType) ||
    normalizeContinuationString(attrs.listType)
  ) {
    return {
      kind: "list",
      mode:
        normalizeContinuationString(attrs.listOwnerType) ||
        normalizeContinuationString(attrs.listType),
      itemIndex: Number.isFinite(attrs.listOwnerItemIndex)
        ? Number(attrs.listOwnerItemIndex)
        : null,
      blockKey: getLineBlockKey(line),
    };
  }

  if (
    Number.isFinite(attrs?.rowIndex) ||
    Number.isFinite(tableMeta?.rowIndex) ||
    Number.isFinite(attrs?.colIndex) ||
    Number.isFinite(tableMeta?.colIndex)
  ) {
    return {
      kind: "table",
      rows: Number.isFinite(attrs?.rows) ? Number(attrs.rows) : Number.isFinite(tableMeta?.rows) ? Number(tableMeta.rows) : null,
      cols: Number.isFinite(attrs?.cols) ? Number(attrs.cols) : Number.isFinite(tableMeta?.cols) ? Number(tableMeta.cols) : null,
      rowIndex: Number.isFinite(attrs?.rowIndex)
        ? Number(attrs.rowIndex)
        : Number.isFinite(tableMeta?.rowIndex)
          ? Number(tableMeta.rowIndex)
          : null,
      colIndex: Number.isFinite(attrs?.colIndex)
        ? Number(attrs.colIndex)
        : Number.isFinite(tableMeta?.colIndex)
          ? Number(tableMeta.colIndex)
          : null,
      blockKey: getLineBlockKey(line),
    };
  }

  return {
    kind: normalizeContinuationString(attrs.sliceGroup) || line?.blockType || "block",
    blockKey: getLineBlockKey(line),
  };
};

const buildContinuationMetadataPatch = (line: any, continuation: FragmentContinuationLike) => {
  if (!line || !continuation || typeof continuation !== "object") {
    return null;
  }

  const fragmentIdentity = deriveFragmentIdentity(line, continuation);
  const carryState = deriveCarryState(line, continuation);
  const continuationToken =
    normalizeContinuationString(continuation.continuationToken) ||
    normalizeContinuationString((line?.blockAttrs || {}).fragmentContinuationToken) ||
    normalizeContinuationString((line?.tableOwnerMeta || line?.tableMeta || {}).fragmentContinuationToken) ||
    (fragmentIdentity ? `${fragmentIdentity}:continuation` : null);

  const patch: Record<string, unknown> = {};
  if (continuationToken) {
    patch.fragmentContinuationToken = continuationToken;
  }
  if (fragmentIdentity) {
    patch.fragmentIdentity = fragmentIdentity;
  }
  if (carryState) {
    patch.fragmentCarryState = carryState;
  }
  return Object.keys(patch).length > 0 ? patch : null;
};

const readLineContinuationMeta = (line: any) => {
  const attrs = line?.blockAttrs || {};
  const tableMeta = line?.tableOwnerMeta || line?.tableMeta || {};
  const baseContinuation = {
    fromPrev:
      !!attrs.sliceFromPrev || !!attrs.tableSliceFromPrev || !!tableMeta.continuedFromPrev,
    hasNext:
      !!attrs.sliceHasNext || !!attrs.tableSliceHasNext || !!tableMeta.continuesAfter,
    rowSplit:
      !!attrs.sliceRowSplit || !!attrs.tableRowSplit || !!tableMeta.rowSplit,
  };
  const metadataPatch = buildContinuationMetadataPatch(line, baseContinuation);
  return {
    ...baseContinuation,
    continuationToken: normalizeContinuationString(metadataPatch?.fragmentContinuationToken),
    fragmentIdentity: normalizeContinuationString(metadataPatch?.fragmentIdentity),
    carryState: normalizeCarryState(metadataPatch?.fragmentCarryState),
  };
};

export const readLineFragmentContinuationState = (line: any) => readLineContinuationMeta(line);

export const buildFragmentContinuationAnchorKey = (
  continuation: FragmentContinuationLike,
  objectSignatureCache = new WeakMap<object, number>()
) => {
  const normalized = continuation && typeof continuation === "object" ? continuation : null;
  const continuationToken = normalizeContinuationString(normalized?.continuationToken);
  const fragmentIdentity = normalizeContinuationString(normalized?.fragmentIdentity);
  const carryState = normalizeCarryState(normalized?.carryState);
  const carryDigest = getObjectSignature(carryState, objectSignatureCache);
  const edge = [
    normalized?.fromPrev ? "1" : "0",
    normalized?.hasNext ? "1" : "0",
    normalized?.rowSplit ? "1" : "0",
  ].join("");
  if (!fragmentIdentity && !continuationToken && carryDigest === 0 && edge === "000") {
    return null;
  }
  return `fragment:${fragmentIdentity || ""}|token:${continuationToken || ""}|carry:${carryDigest}|edge:${edge}`;
};

export const getLineFragmentContinuationAnchorKey = (
  line: any,
  objectSignatureCache = new WeakMap<object, number>()
) => {
  if (!line || !isAnchorCandidateLine(line)) {
    return null;
  }
  return buildFragmentContinuationAnchorKey(readLineContinuationMeta(line), objectSignatureCache);
};

export const getPageFragmentAnchorSummary = (
  page: any,
  objectSignatureCache = new WeakMap<object, number>()
): PageFragmentAnchorSummary => {
  const lines = Array.isArray(page?.lines) ? page.lines : [];
  const fragmentAnchors = new Set<string>();
  let firstFragmentAnchor: string | null = null;
  let lastFragmentAnchor: string | null = null;
  let firstFragmentAnchorLineIndex: number | null = null;
  let lastFragmentAnchorLineIndex: number | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const anchor = getLineFragmentContinuationAnchorKey(lines[index], objectSignatureCache);
    if (!anchor) {
      continue;
    }
    if (firstFragmentAnchor == null) {
      firstFragmentAnchor = anchor;
      firstFragmentAnchorLineIndex = index;
    }
    lastFragmentAnchor = anchor;
    lastFragmentAnchorLineIndex = index;
    fragmentAnchors.add(anchor);
  }

  return {
    firstFragmentAnchor,
    lastFragmentAnchor,
    fragmentAnchors: Array.from(fragmentAnchors.values()),
    firstFragmentAnchorLineIndex,
    lastFragmentAnchorLineIndex,
  };
};

export const getPageFragmentBoundaryRanges = (page: any): FragmentBoundaryRange[] => {
  const lines = Array.isArray(page?.lines) ? page.lines : [];
  if (lines.length === 0) {
    return [];
  }

  const pageRange = lines.reduce(
    (result, line) => {
      const lineRange = getLineTextRange(line);
      if (Number.isFinite(lineRange.min) && lineRange.min < result.min) {
        result.min = lineRange.min;
      }
      if (Number.isFinite(lineRange.max) && lineRange.max > result.max) {
        result.max = lineRange.max;
      }
      return result;
    },
    {
      min: Number.POSITIVE_INFINITY,
      max: Number.NEGATIVE_INFINITY,
    }
  );
  const pageMin = Number.isFinite(pageRange.min) ? Number(pageRange.min) : Number.NaN;
  const pageMax = Number.isFinite(pageRange.max) ? Number(pageRange.max) : Number.NaN;

  const refs: Array<{
    anchor: string;
    lineIndex: number;
    min: number;
    max: number;
  }> = [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const anchor = getLineFragmentContinuationAnchorKey(line);
    if (!anchor) {
      continue;
    }
    const lineRange = getLineTextRange(line);
    refs.push({
      anchor,
      lineIndex,
      min: Number.isFinite(lineRange.min) ? Number(lineRange.min) : Number.NaN,
      max: Number.isFinite(lineRange.max) ? Number(lineRange.max) : Number.NaN,
    });
  }
  if (refs.length === 0) {
    return [];
  }

  const ranges: FragmentBoundaryRange[] = [];
  for (let index = 0; index < refs.length; index += 1) {
    const current = refs[index];
    const next = refs[index + 1] || null;
    const min = Number.isFinite(current.min) ? current.min : pageMin;
    let max = Number.isFinite(current.max) ? current.max : pageMax;
    if (Number.isFinite(next?.min) && Number(next.min) >= min) {
      max = Number(next.min);
    } else if (!Number.isFinite(max)) {
      max = pageMax;
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      continue;
    }
    ranges.push({
      anchor: current.anchor,
      lineIndex: current.lineIndex,
      min,
      max: Math.max(min, max),
    });
  }
  return ranges;
};

export const getPageFragmentChainSignature = (
  page: any,
  objectSignatureCache = new WeakMap<object, number>()
) => {
  const lines = Array.isArray(page?.lines) ? page.lines : [];
  if (
    Number(page?.__fragmentChainSignatureLineCount) === lines.length &&
    typeof page?.__fragmentChainSignature === "number"
  ) {
    return Number(page.__fragmentChainSignature);
  }

  const summary = getPageFragmentAnchorSummary(page, objectSignatureCache);
  let hash = 17;
  hash = hashNumber(hash, lines.length);
  hash = hashNumber(hash, summary.fragmentAnchors.length);
  hash = hashString(hash, summary.firstFragmentAnchor || "");
  hash = hashString(hash, summary.lastFragmentAnchor || "");
  hash = hashNumber(hash, summary.firstFragmentAnchorLineIndex);
  hash = hashNumber(hash, summary.lastFragmentAnchorLineIndex);
  for (const anchor of summary.fragmentAnchors) {
    hash = hashString(hash, anchor);
  }

  const signature = hash >>> 0;
  if (page && typeof page === "object") {
    page.__fragmentChainSignature = signature;
    page.__fragmentChainSignatureLineCount = lines.length;
  }
  return signature;
};

export const pageHasFragmentAnchor = (page: any, anchor: string | null | undefined) => {
  if (!anchor) {
    return false;
  }
  const summary = getPageFragmentAnchorSummary(page);
  return summary.fragmentAnchors.includes(String(anchor));
};

export const getPagePreferredBoundaryAnchor = (
  page: any,
  preferredAnchor: string | null | undefined
) => {
  const normalizedPreferredAnchor =
    typeof preferredAnchor === "string" && preferredAnchor.trim().length > 0
      ? preferredAnchor.trim()
      : null;
  if (normalizedPreferredAnchor && pageHasFragmentAnchor(page, normalizedPreferredAnchor)) {
    return normalizedPreferredAnchor;
  }
  const summary = getPageFragmentAnchorSummary(page);
  return summary.firstFragmentAnchor || summary.lastFragmentAnchor || null;
};

export const buildPageBoundaryAnchorToken = (
  page: any,
  preferredAnchor: string | null | undefined = null,
  objectSignatureCache = new WeakMap<object, number>()
) => {
  const lines = Array.isArray(page?.lines) ? page.lines : [];
  const summary = getPageFragmentAnchorSummary(page, objectSignatureCache);
  const boundaryAnchor = getPagePreferredBoundaryAnchor(page, preferredAnchor);
  let hash = 17;
  hash = hashString(hash, "page-boundary");
  hash = hashNumber(hash, lines.length);
  hash = hashString(hash, boundaryAnchor || "");
  hash = hashString(hash, summary.firstFragmentAnchor || "");
  hash = hashString(hash, summary.lastFragmentAnchor || "");
  hash = hashNumber(hash, summary.fragmentAnchors.length);
  hash = hashNumber(hash, summary.firstFragmentAnchorLineIndex);
  hash = hashNumber(hash, summary.lastFragmentAnchorLineIndex);
  hash = hashNumber(hash, getPageFragmentChainSignature(page, objectSignatureCache));
  return String(hash >>> 0);
};

export const findFirstPageFragmentAnchorAfterTextOffset = (
  page: any,
  textOffset: number | null | undefined
): Omit<FragmentAnchorRef, "pageIndex"> | null => {
  if (!Number.isFinite(textOffset)) {
    return null;
  }
  const boundary = Number(textOffset);
  const lines = Array.isArray(page?.lines) ? page.lines : [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const anchor = getLineFragmentContinuationAnchorKey(line);
    if (!anchor) {
      continue;
    }
    const start = Number.isFinite(line?.start)
      ? Number(line.start)
      : Number.isFinite(line?.blockStart)
        ? Number(line.blockStart)
        : null;
    if (start != null && start < boundary) {
      continue;
    }
    return {
      anchor,
      lineIndex,
      line,
    };
  }
  return null;
};

export const findFirstFragmentAnchorAfterBoundary = (
  layout: any,
  options: {
    textOffset?: number | null;
    rootIndex?: number | null;
  }
): FragmentAnchorRef | null => {
  const pages = Array.isArray(layout?.pages) ? layout.pages : null;
  if (!pages?.length) {
    return null;
  }

  const textOffset = Number.isFinite(options?.textOffset) ? Number(options.textOffset) : null;
  const rootIndex = Number.isFinite(options?.rootIndex) ? Number(options.rootIndex) : null;

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const lines = Array.isArray(pages[pageIndex]?.lines) ? pages[pageIndex].lines : [];
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      const anchor = getLineFragmentContinuationAnchorKey(line);
      if (!anchor) {
        continue;
      }
      if (textOffset != null) {
        const start = Number.isFinite(line?.start)
          ? Number(line.start)
          : Number.isFinite(line?.blockStart)
            ? Number(line.blockStart)
            : null;
        if (start != null && start < textOffset) {
          continue;
        }
      } else if (rootIndex != null) {
        const lineRootIndex = Number.isFinite(line?.rootIndex) ? Number(line.rootIndex) : null;
        if (lineRootIndex != null && lineRootIndex <= rootIndex) {
          continue;
        }
      }
      return {
        anchor,
        pageIndex,
        lineIndex,
        line,
      };
    }
  }

  return null;
};

export const hashFragmentContinuationState = (
  hash: number,
  continuation: FragmentContinuationLike,
  objectSignatureCache = new WeakMap<object, number>()
) => {
  const normalized = continuation && typeof continuation === "object" ? continuation : null;
  const continuationToken = normalizeContinuationString(normalized?.continuationToken);
  const fragmentIdentity = normalizeContinuationString(normalized?.fragmentIdentity);
  const carryState = normalizeCarryState(normalized?.carryState);
  hash = hashNumber(hash, normalized?.fromPrev ? 1 : 0);
  hash = hashNumber(hash, normalized?.hasNext ? 1 : 0);
  hash = hashNumber(hash, normalized?.rowSplit ? 1 : 0);
  hash = hashString(hash, continuationToken || "");
  hash = hashString(hash, fragmentIdentity || "");
  hash = hashNumber(hash, getObjectSignature(carryState, objectSignatureCache));
  return hash;
};

export const applyContinuationMetadataPatch = (
  line: any,
  continuation: FragmentContinuationLike,
  edge: "start" | "end"
) => {
  if (!line || !continuation || typeof continuation !== "object") {
    return line;
  }

  const next = {
    ...line,
    blockAttrs: {
      ...(line?.blockAttrs || {}),
    },
  };

  if (edge === "start") {
    next.blockAttrs.sliceFromPrev = continuation.fromPrev === true;
    next.blockAttrs.sliceRowSplit = continuation.rowSplit === true;
  } else {
    next.blockAttrs.sliceHasNext = continuation.hasNext === true;
    next.blockAttrs.sliceRowSplit = continuation.rowSplit === true;
  }

  const metadataPatch = buildContinuationMetadataPatch(line, continuation);
  if (metadataPatch) {
    Object.assign(next.blockAttrs, metadataPatch);
  }

  if (line?.tableOwnerMeta && typeof line.tableOwnerMeta === "object") {
    next.tableOwnerMeta = {
      ...line.tableOwnerMeta,
      ...(edge === "start" ? { continuedFromPrev: continuation.fromPrev === true } : null),
      ...(edge === "end" ? { continuesAfter: continuation.hasNext === true } : null),
      ...(continuation.rowSplit === true ? { rowSplit: true } : null),
      ...(metadataPatch || null),
    };
  }
  if (line?.tableMeta && typeof line.tableMeta === "object") {
    next.tableMeta = {
      ...line.tableMeta,
      ...(edge === "start" ? { continuedFromPrev: continuation.fromPrev === true } : null),
      ...(edge === "end" ? { continuesAfter: continuation.hasNext === true } : null),
      ...(continuation.rowSplit === true ? { rowSplit: true } : null),
      ...(metadataPatch || null),
    };
  }

  return next;
};

export const getFragmentSliceAnchorKey = (line: any) => {
  if (!line) {
    return null;
  }

  const continuation = readLineContinuationMeta(line);
  if (continuation.fragmentIdentity) {
    return `fragment:${continuation.fragmentIdentity}`;
  }
  if (continuation.continuationToken) {
    return `token:${continuation.continuationToken}`;
  }

  const attrs = line.blockAttrs || {};
  const sliceGroup =
    typeof attrs.sliceGroup === "string" && attrs.sliceGroup.trim()
      ? attrs.sliceGroup.trim()
      : line.blockType || "block";
  const blockKey = getLineBlockKey(line);
  return blockKey ? `${sliceGroup}:${blockKey}` : null;
};
