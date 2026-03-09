const docTopLevelBlockIndexCache = new WeakMap();

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

export const createChangeSummary = (tr, oldState, newState) => {
  if (!tr) {
    return { docChanged: false };
  }

  if (!tr.docChanged) {
    return { docChanged: false };
  }

  const ranges = collectChangedRanges(tr.mapping);
  if (!ranges) {
    return { docChanged: true };
  }

  const { oldRange, newRange } = ranges;
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
