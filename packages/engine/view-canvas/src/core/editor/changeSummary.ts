const docTopLevelBlockIndexCache = new WeakMap();
const CHANGE_SUMMARY_HINT_META = "lumenpageChangeSummaryHint";

const getDocTopLevelBlockIndex = (doc) => {
  const cached = docTopLevelBlockIndexCache.get(doc);
  if (cached) {
    return cached;
  }

  const starts = [];
  const ends = [];
  const ids = [];

  doc.forEach((node, pos) => {
    starts.push(pos);
    ends.push(pos + node.nodeSize);
    ids.push(node.attrs?.id ?? null);
  });

  const index = { starts, ends, ids };
  docTopLevelBlockIndexCache.set(doc, index);
  return index;
};

const findFirstIndexWithEndAtOrAfter = (values, target) => {
  let low = 0;
  let high = values.length - 1;
  let best = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (values[mid] >= target) {
      best = mid;
      high = mid - 1;
      continue;
    }
    low = mid + 1;
  }

  return best;
};

const findLastIndexWithStartAtOrBefore = (values, target) => {
  let low = 0;
  let high = values.length - 1;
  let best = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (values[mid] <= target) {
      best = mid;
      low = mid + 1;
      continue;
    }
    high = mid - 1;
  }

  return best;
};

const collectChangedRanges = (mapping) => {
  let oldFrom = Number.POSITIVE_INFINITY;
  let oldTo = Number.NEGATIVE_INFINITY;
  let newFrom = Number.POSITIVE_INFINITY;
  let newTo = Number.NEGATIVE_INFINITY;

  for (const map of mapping.maps) {
    map.forEach((from, to, mappedFrom, mappedTo) => {
      oldFrom = Math.min(oldFrom, from);
      oldTo = Math.max(oldTo, to);
      newFrom = Math.min(newFrom, mappedFrom);
      newTo = Math.max(newTo, mappedTo);
    });
  }

  if (!Number.isFinite(oldFrom) || !Number.isFinite(newFrom)) {
    return null;
  }

  return {
    oldRange: { from: oldFrom, to: oldTo },
    newRange: { from: newFrom, to: newTo },
  };
};

const collectBlockRange = (doc, from, to) => {
  const blockIndex = getDocTopLevelBlockIndex(doc);
  const fromIndex = findFirstIndexWithEndAtOrAfter(blockIndex.ends, from);
  const toIndex = findLastIndexWithStartAtOrBefore(blockIndex.starts, to);
  const hasOverlap = fromIndex >= 0 && toIndex >= fromIndex;

  if (!hasOverlap) {
    const docSize = Number.isFinite(doc?.content?.size) ? Number(doc.content.size) : 0;
    const fallbackPos = Math.max(0, Math.min(docSize, Number.isFinite(from) ? Number(from) : 0));
    try {
      const $pos = doc.resolve(fallbackPos);
      const index = $pos.index(0);
      if (Number.isFinite(index)) {
        const clamped = Math.max(0, Math.min(doc.childCount - 1, Number(index)));
        return {
          fromIndex: clamped,
          toIndex: clamped,
          ids: [],
          indices: [clamped],
        };
      }
    } catch (_error) {
      // ignore and fallback to null range
    }
    return { fromIndex: null, toIndex: null, ids: [], indices: [] };
  }

  const blockIndices = [];
  const blockIds = [];
  for (let index = fromIndex; index <= toIndex; index += 1) {
    blockIndices.push(index);
    const id = blockIndex.ids[index];
    if (id) {
      blockIds.push(id);
    }
  }

  return {
    fromIndex,
    toIndex,
    ids: blockIds,
    indices: blockIndices,
  };
};

const mergeIds = (before, after) => {
  const ids = new Set();
  for (const id of before?.ids || []) {
    ids.add(id);
  }
  for (const id of after?.ids || []) {
    ids.add(id);
  }
  return Array.from(ids);
};

const getBoundaryPosForTopLevelIndex = (doc, childIndex) => {
  if (!doc) {
    return 0;
  }
  const docSize = Number.isFinite(doc?.content?.size) ? Number(doc.content.size) : 0;
  const count = Number.isFinite(doc?.childCount) ? Number(doc.childCount) : 0;
  if (count <= 0) {
    return 0;
  }
  const clampedIndex = Math.max(0, Math.min(count, Number.isFinite(childIndex) ? Number(childIndex) : 0));
  if (clampedIndex >= count) {
    return docSize;
  }
  const blockIndex = getDocTopLevelBlockIndex(doc);
  return Number.isFinite(blockIndex.starts?.[clampedIndex]) ? Number(blockIndex.starts[clampedIndex]) : docSize;
};

const getNodeStructuralHash = (node) => {
  if (!node || typeof node !== "object") {
    return null;
  }
  try {
    const hash = node.hashCode?.();
    return Number.isFinite(hash) ? Number(hash) : null;
  } catch (_error) {
    return null;
  }
};

const areTopLevelNodesEquivalent = (leftNode, rightNode) => {
  if (leftNode === rightNode) {
    return true;
  }

  if (!leftNode || !rightNode) {
    return false;
  }

  if (leftNode?.eq?.(rightNode) === true) {
    return true;
  }

  const leftHash = getNodeStructuralHash(leftNode);
  const rightHash = getNodeStructuralHash(rightNode);
  if (leftHash != null && rightHash != null) {
    return leftHash === rightHash;
  }

  return false;
};

const collectTopLevelDiffWindow = (oldDoc, newDoc) => {
  const oldCount = Number.isFinite(oldDoc?.childCount) ? Number(oldDoc.childCount) : 0;
  const newCount = Number.isFinite(newDoc?.childCount) ? Number(newDoc.childCount) : 0;
  const commonCount = Math.min(oldCount, newCount);

  let prefixCount = 0;
  while (
    prefixCount < commonCount &&
    areTopLevelNodesEquivalent(oldDoc.child(prefixCount), newDoc.child(prefixCount))
  ) {
    prefixCount += 1;
  }

  let suffixCount = 0;
  while (
    suffixCount < oldCount - prefixCount &&
    suffixCount < newCount - prefixCount &&
    areTopLevelNodesEquivalent(
      oldDoc.child(oldCount - suffixCount - 1),
      newDoc.child(newCount - suffixCount - 1)
    )
  ) {
    suffixCount += 1;
  }

  return {
    prefixCount,
    suffixCount,
    oldCount,
    newCount,
  };
};

const collectBlockRangeFromTopLevelWindow = (doc, fromIndex, toIndex, boundaryIndex) => {
  const count = Number.isFinite(doc?.childCount) ? Number(doc.childCount) : 0;
  if (count <= 0) {
    return { fromIndex: null, toIndex: null, ids: [], indices: [] };
  }

  if (Number.isFinite(fromIndex) && Number.isFinite(toIndex) && Number(toIndex) >= Number(fromIndex)) {
    const blockIndex = getDocTopLevelBlockIndex(doc);
    const start = Math.max(0, Math.min(count - 1, Number(fromIndex)));
    const end = Math.max(start, Math.min(count - 1, Number(toIndex)));
    const indices = [];
    const ids = [];
    for (let index = start; index <= end; index += 1) {
      indices.push(index);
      const id = blockIndex.ids[index];
      if (id) {
        ids.push(id);
      }
    }
    return {
      fromIndex: start,
      toIndex: end,
      ids,
      indices,
    };
  }

  const fallbackIndex = Math.max(
    0,
    Math.min(count - 1, Number.isFinite(boundaryIndex) ? Number(boundaryIndex) : 0)
  );
  return {
    fromIndex: fallbackIndex,
    toIndex: fallbackIndex,
    ids: [],
    indices: [fallbackIndex],
  };
};

const collectTightTopLevelChangeSummary = (oldDoc, newDoc) => {
  if (!oldDoc || !newDoc) {
    return null;
  }

  const { prefixCount, suffixCount, oldCount, newCount } = collectTopLevelDiffWindow(oldDoc, newDoc);
  const oldChangedFromIndex = prefixCount < oldCount ? prefixCount : null;
  const oldChangedToIndex = oldCount - suffixCount - 1 >= prefixCount ? oldCount - suffixCount - 1 : null;
  const newChangedFromIndex = prefixCount < newCount ? prefixCount : null;
  const newChangedToIndex = newCount - suffixCount - 1 >= prefixCount ? newCount - suffixCount - 1 : null;

  const oldRange = {
    from: getBoundaryPosForTopLevelIndex(oldDoc, prefixCount),
    to: getBoundaryPosForTopLevelIndex(oldDoc, oldCount - suffixCount),
  };
  const newRange = {
    from: getBoundaryPosForTopLevelIndex(newDoc, prefixCount),
    to: getBoundaryPosForTopLevelIndex(newDoc, newCount - suffixCount),
  };

  const before = collectBlockRangeFromTopLevelWindow(
    oldDoc,
    oldChangedFromIndex,
    oldChangedToIndex,
    prefixCount
  );
  const after = collectBlockRangeFromTopLevelWindow(
    newDoc,
    newChangedFromIndex,
    newChangedToIndex,
    prefixCount
  );

  return {
    oldRange,
    newRange,
    blocks: {
      before,
      after,
      ids: mergeIds(before, after),
    },
  };
};

const shouldTightenWholeDocumentReplace = (oldRange, newRange, oldDoc, newDoc) =>
  Number(oldRange?.from) <= 0 &&
  Number(newRange?.from) <= 0 &&
  Number(oldRange?.to) >= Number(oldDoc?.content?.size ?? 0) &&
  Number(newRange?.to) >= Number(newDoc?.content?.size ?? 0);

const normalizeHintedRootIndices = (hint) => {
  const rootIndices = Array.isArray(hint?.rootIndices) ? hint.rootIndices : [];
  const unique = new Set<number>();
  for (const value of rootIndices) {
    if (Number.isFinite(value)) {
      unique.add(Number(value));
    }
  }
  return Array.from(unique.values()).sort((left, right) => left - right);
};

const collectHintedChangeSummary = (oldDoc, newDoc, rootIndices) => {
  if (!oldDoc || !newDoc || !Array.isArray(rootIndices) || rootIndices.length === 0) {
    return null;
  }

  const minIndex = Math.min(...rootIndices);
  const maxIndex = Math.max(...rootIndices);
  const oldCount = Number.isFinite(oldDoc?.childCount) ? Number(oldDoc.childCount) : 0;
  const newCount = Number.isFinite(newDoc?.childCount) ? Number(newDoc.childCount) : 0;
  const before = collectBlockRangeFromTopLevelWindow(
    oldDoc,
    minIndex < oldCount ? minIndex : null,
    maxIndex < oldCount ? maxIndex : null,
    minIndex
  );
  const after = collectBlockRangeFromTopLevelWindow(
    newDoc,
    minIndex < newCount ? minIndex : null,
    maxIndex < newCount ? maxIndex : null,
    minIndex
  );

  return {
    oldRange: {
      from: getBoundaryPosForTopLevelIndex(oldDoc, minIndex),
      to: getBoundaryPosForTopLevelIndex(oldDoc, Math.min(oldCount, maxIndex + 1)),
    },
    newRange: {
      from: getBoundaryPosForTopLevelIndex(newDoc, minIndex),
      to: getBoundaryPosForTopLevelIndex(newDoc, Math.min(newCount, maxIndex + 1)),
    },
    blocks: {
      before,
      after,
      ids: mergeIds(before, after),
    },
  };
};

export const createChangeSummary = (tr, oldState, newState) => {
  if (!tr) {
    return { docChanged: false };
  }

  if (!tr.docChanged) {
    return { docChanged: false };
  }

  const hintedRootIndices = normalizeHintedRootIndices(
    tr?.getMeta?.(CHANGE_SUMMARY_HINT_META) ?? null
  );
  if (hintedRootIndices.length > 0) {
    const hintedSummary = collectHintedChangeSummary(oldState?.doc, newState?.doc, hintedRootIndices);
    if (hintedSummary) {
      return {
        docChanged: true,
        ...hintedSummary,
      };
    }
  }

  const ranges = collectChangedRanges(tr.mapping);
  if (!ranges) {
    return { docChanged: true };
  }

  const { oldRange, newRange } = ranges;
  if (shouldTightenWholeDocumentReplace(oldRange, newRange, oldState?.doc, newState?.doc)) {
    const tightSummary = collectTightTopLevelChangeSummary(oldState?.doc, newState?.doc);
    if (tightSummary) {
      return {
        docChanged: true,
        ...tightSummary,
      };
    }
  }

  const before = collectBlockRange(oldState.doc, oldRange.from, oldRange.to);
  const after = collectBlockRange(newState.doc, newRange.from, newRange.to);

  return {
    docChanged: true,
    oldRange,
    newRange,
    blocks: {
      before,
      after,
      ids: mergeIds(before, after),
    },
  };
};
