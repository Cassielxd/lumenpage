import type {
  LayoutChangeSummary,
  LayoutLine,
  LayoutResult,
  TopLevelIndexableDoc,
} from "./types.js";

const getDocChildCount = (doc: TopLevelIndexableDoc | null | undefined) =>
  Number.isFinite(doc?.childCount) ? Number(doc?.childCount) : 0;

/**
 * 默认情况下，节点本身不被视为页复用敏感节点。
 */
function defaultIsReuseSensitiveNode(_node: unknown) {
  return false;
}

/**
 * 默认根据切片字段判断一条行是否对页复用敏感。
 */
function defaultIsReuseSensitiveLine(line: LayoutLine | null | undefined) {
  const attrs = line?.blockAttrs || {};
  return !!attrs.sliceFromPrev || !!attrs.sliceHasNext || !!attrs.sliceRowSplit;
}

/**
 * 检查给定顶层索引范围内是否存在敏感节点。
 */
function hasTopLevelSensitiveNodeInRange(
  doc: TopLevelIndexableDoc | null | undefined,
  fromIndex: number,
  toIndex: number,
  isSensitiveNode: (node: unknown) => boolean
) {
  const childCount = getDocChildCount(doc);
  if (childCount === 0 || !Number.isFinite(fromIndex) || !Number.isFinite(toIndex)) {
    return false;
  }
  const from = Math.max(0, Math.min(childCount - 1, fromIndex));
  const to = Math.max(0, Math.min(childCount - 1, toIndex));
  if (to < from) {
    return false;
  }
  for (let i = from; i <= to; i += 1) {
    if (isSensitiveNode(doc?.child?.(i)) === true) {
      return true;
    }
  }
  return false;
}

/**
 * 检查整棵文档是否包含任意敏感顶层节点。
 */
function hasAnyTopLevelSensitiveNode(
  doc: TopLevelIndexableDoc | null | undefined,
  isSensitiveNode: (node: unknown) => boolean
) {
  const childCount = getDocChildCount(doc);
  if (childCount === 0) {
    return false;
  }
  for (let i = 0; i < childCount; i += 1) {
    if (isSensitiveNode(doc?.child?.(i)) === true) {
      return true;
    }
  }
  return false;
}

/**
 * 检查旧布局中是否存在任意敏感行。
 */
function previousLayoutHasSensitiveLine(
  previousLayout: LayoutResult | null | undefined,
  isSensitiveLine: (line: LayoutLine | null | undefined) => boolean
) {
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
}

/**
 * 检查旧布局在指定顶层范围内是否存在敏感行。
 */
function previousLayoutHasSensitiveLineInRange(
  previousLayout: LayoutResult | null | undefined,
  fromIndex: number,
  toIndex: number,
  isSensitiveLine: (line: LayoutLine | null | undefined) => boolean
) {
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
}

/**
 * 判断一次变更是否必须禁用页复用，避免跨页切片状态被错误复用。
 */
export function shouldDisableReuseForSensitiveChange(
  doc: TopLevelIndexableDoc | null | undefined,
  changeSummary: LayoutChangeSummary | null | undefined,
  previousLayout: LayoutResult | null | undefined,
  options: {
    isSensitiveNode?: (node: unknown) => boolean;
    isSensitiveLine?: (line: LayoutLine | null | undefined) => boolean;
  } = {}
) {
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
  // 这里只检查旧布局实际带有跨页切片状态的范围，避免因为节点具备 split 能力就过度禁用复用。
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
}

void hasTopLevelSensitiveNodeInRange;
void hasAnyTopLevelSensitiveNode;
void previousLayoutHasSensitiveLine;