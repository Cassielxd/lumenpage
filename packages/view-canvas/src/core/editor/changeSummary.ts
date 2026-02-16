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
  const blockIds = [];
  const blockIndices = [];

  doc.forEach((node, pos, index) => {
    const start = pos;
    const end = pos + node.nodeSize;

    if (end < from || start > to) {
      return;
    }

    blockIndices.push(index);

    if (node.attrs?.id) {
      blockIds.push(node.attrs.id);
    }
  });

  if (blockIndices.length === 0) {
    return { fromIndex: null, toIndex: null, ids: [], indices: [] };
  }

  return {
    fromIndex: Math.min(...blockIndices),
    toIndex: Math.max(...blockIndices),
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
