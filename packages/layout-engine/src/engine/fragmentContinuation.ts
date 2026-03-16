import { getObjectSignature, hashNumber, hashString } from "./signature";

type FragmentContinuationLike = {
  fromPrev?: boolean;
  hasNext?: boolean;
  rowSplit?: boolean;
  continuationToken?: string | null;
  fragmentIdentity?: string | null;
  carryState?: Record<string, unknown> | null;
} | null | undefined;

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