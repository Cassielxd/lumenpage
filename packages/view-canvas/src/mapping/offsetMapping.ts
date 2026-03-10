// 文本偏移量 <-> ProseMirror 位置映射
const docTopLevelTextIndexCache = new WeakMap();

const serializeContainerToText = (node) => {
  const parts = [];
  node.forEach((child, _pos, index) => {
    parts.push(serializeNodeToText(child));
    if (index < node.childCount - 1) {
      parts.push("\n");
    }
  });
  return parts.join("");
};

const getNodeOffsetMapping = (node) => node?.type?.spec?.offsetMapping || null;

const offsetMappingHelpers = {
  serializeNodeToText: (node) => serializeNodeToText(node),
  getNodeTextLength: (node) => getNodeTextLength(node),
  mapOffsetInNode: (node, nodePos, offset) => mapOffsetInNode(node, nodePos, offset),
  mapPosInNode: (node, nodePos, pos) => mapPosInNode(node, nodePos, pos),
};

const callOffsetMapping = (node, method, args, fallback) => {
  const mapping = getNodeOffsetMapping(node);
  const handler = mapping?.[method];
  if (typeof handler !== "function") {
    return fallback();
  }
  try {
    const value = handler(...args, offsetMappingHelpers);
    if (value != null) {
      return value;
    }
  } catch (_error) {
    // Fall back to legacy mapping logic to avoid hard failures in editing.
  }
  return fallback();
};

const serializeNodeToText = (node) =>
  callOffsetMapping(node, "toText", [node], () => {
    if (node.isTextblock) {
      return node.textBetween(0, node.content.size, "\n");
    }
    if (node.isLeaf || node.isAtom) {
      if (typeof node.type?.spec?.leafText === "function") {
        return node.type.spec.leafText(node) || "";
      }
      return " ";
    }
    return serializeContainerToText(node);
  });

const getContainerTextLength = (node) => {
  let length = 0;
  node.forEach((child, _pos, index) => {
    length += getNodeTextLength(child);
    if (index < node.childCount - 1) {
      length += 1;
    }
  });
  return length;
};

function getNodeTextLength(node) {
  const mapped = callOffsetMapping(node, "getTextLength", [node], () => null);
  if (mapped != null) {
    const length = Number(mapped);
    if (Number.isFinite(length) && length >= 0) {
      return length;
    }
  }

  if (node.isTextblock) {
    return node.textContent.length;
  }
  if (node.isLeaf || node.isAtom) {
    return serializeNodeToText(node).length;
  }
  return getContainerTextLength(node);
}

const getBlockTextLength = (node) => getNodeTextLength(node);

const getDocTopLevelTextIndex = (doc) => {
  if (!doc || !Number.isFinite(doc?.childCount)) {
    return {
      childStarts: [],
      childEnds: [],
      offsetStarts: [],
      childTextLengths: [],
      totalTextLength: 0,
    };
  }

  const cached = docTopLevelTextIndexCache.get(doc);
  if (cached) {
    return cached;
  }

  const childStarts = [];
  const childEnds = [];
  const offsetStarts = [];
  const childTextLengths = [];
  let docPos = 0;
  let textOffset = 0;

  for (let i = 0; i < doc.childCount; i += 1) {
    const child = doc.child(i);
    const textLength = getBlockTextLength(child);
    childStarts.push(docPos);
    childEnds.push(docPos + child.nodeSize);
    offsetStarts.push(textOffset);
    childTextLengths.push(textLength);
    docPos += child.nodeSize;
    textOffset += textLength;
    if (i < doc.childCount - 1) {
      textOffset += 1;
    }
  }

  const index = {
    childStarts,
    childEnds,
    offsetStarts,
    childTextLengths,
    totalTextLength: textOffset,
  };
  docTopLevelTextIndexCache.set(doc, index);
  return index;
};

const findLastIndexAtOrBefore = (values, target) => {
  let low = 0;
  let high = values.length - 1;
  let best = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const value = values[mid];
    if (value <= target) {
      best = mid;
      low = mid + 1;
      continue;
    }
    high = mid - 1;
  }

  return best;
};

export const docToOffsetText = (doc) => {
  const parts = [];
  doc.forEach((node, _pos, index) => {
    parts.push(serializeNodeToText(node));
    if (index < doc.childCount - 1) {
      parts.push("\n");
    }
  });
  return parts.join("");
};

export const getDocTextLength = (doc) => getDocTopLevelTextIndex(doc).totalTextLength;

const mapOffsetInTextblock = (node, nodePos, offset) => {
  const textStart = nodePos + 1;

  return textStart + offset;
};

const mapOffsetInLeaf = (node, nodePos, offset) =>
  offset <= 0 ? nodePos : nodePos + node.nodeSize;

function mapOffsetInContainer(container, containerPos, offset) {
  let remaining = offset;
  let innerPos = containerPos + 1;
  for (let i = 0; i < container.childCount; i += 1) {
    const child = container.child(i);
    const childPos = innerPos;
    const textLength = getNodeTextLength(child);
    if (remaining <= textLength) {
      return mapOffsetInNode(child, childPos, remaining);
    }
    remaining -= textLength;
    if (i < container.childCount - 1) {
      if (remaining === 0) {
        return childPos + child.nodeSize - 1;
      }
      remaining -= 1;
    }
    innerPos += child.nodeSize;
  }
  return containerPos + container.nodeSize - 1;
}

function mapOffsetInNode(node, nodePos, offset) {
  const mapped = callOffsetMapping(node, "mapOffsetToPos", [node, nodePos, offset], () => null);
  if (mapped != null) {
    const pos = Number(mapped);
    if (Number.isFinite(pos)) {
      const minPos = nodePos;
      const maxPos = nodePos + node.nodeSize;
      return Math.max(minPos, Math.min(maxPos, pos));
    }
  }

  if (node.isTextblock) {
    return mapOffsetInTextblock(node, nodePos, offset);
  }
  if (node.isLeaf || node.isAtom) {
    return mapOffsetInLeaf(node, nodePos, offset);
  }
  return mapOffsetInContainer(node, nodePos, offset);
}

const clampTextOffset = (doc, offset) => {
  const totalTextLength = getDocTextLength(doc);
  return Math.max(0, Math.min(offset, totalTextLength));
};

export const textOffsetToDocPos = (doc, offset) => {
  if (!doc || doc.childCount <= 0) {
    return doc?.content?.size ?? 0;
  }

  const clamped = clampTextOffset(doc, offset);
  const index = getDocTopLevelTextIndex(doc);
  const childIndex = Math.max(0, findLastIndexAtOrBefore(index.offsetStarts, clamped));
  const node = doc.child(childIndex);
  const nodeStart = index.childStarts[childIndex] ?? 0;
  const offsetStart = index.offsetStarts[childIndex] ?? 0;
  const textLength = index.childTextLengths[childIndex] ?? 0;
  const localOffset = Math.max(0, Math.min(textLength, clamped - offsetStart));

  return mapOffsetInNode(node, nodeStart, localOffset);
};

const mapPosInTextblock = (node, nodePos, pos) => {
  const textStart = nodePos + 1;

  const textEnd = textStart + node.textContent.length;

  if (pos <= textStart) {
    return 0;
  }

  if (pos <= textEnd) {
    return pos - textStart;
  }

  return node.textContent.length;
};

const mapPosInLeaf = (node, nodePos, pos) => (pos <= nodePos ? 0 : getNodeTextLength(node));

function mapPosInContainer(container, containerPos, pos) {
  let offset = 0;
  let innerPos = containerPos + 1;
  for (let i = 0; i < container.childCount; i += 1) {
    const child = container.child(i);
    const childPos = innerPos;
    if (pos <= childPos) {
      return offset;
    }
    if (pos < childPos + child.nodeSize) {
      return offset + mapPosInNode(child, childPos, pos);
    }
    offset += getNodeTextLength(child);
    if (i < container.childCount - 1) {
      offset += 1;
    }
    innerPos += child.nodeSize;
  }
  return offset;
}

function mapPosInNode(node, nodePos, pos) {
  const mapped = callOffsetMapping(node, "mapPosToOffset", [node, nodePos, pos], () => null);
  if (mapped != null) {
    const offset = Number(mapped);
    if (Number.isFinite(offset)) {
      const maxOffset = getNodeTextLength(node);
      return Math.max(0, Math.min(maxOffset, offset));
    }
  }

  if (node.isTextblock) {
    return mapPosInTextblock(node, nodePos, pos);
  }
  if (node.isLeaf || node.isAtom) {
    return mapPosInLeaf(node, nodePos, pos);
  }
  return mapPosInContainer(node, nodePos, pos);
}

export const docPosToTextOffset = (doc, pos) => {
  if (!doc || doc.childCount <= 0) {
    return 0;
  }

  const clamped = Math.max(0, Math.min(pos, doc.content.size));
  const index = getDocTopLevelTextIndex(doc);
  const childIndex = Math.max(0, findLastIndexAtOrBefore(index.childStarts, clamped));
  const node = doc.child(childIndex);
  const nodeStart = index.childStarts[childIndex] ?? 0;
  const nodeEnd = index.childEnds[childIndex] ?? nodeStart;
  const offsetStart = index.offsetStarts[childIndex] ?? 0;

  if (clamped <= nodeStart) {
    return offsetStart;
  }

  if (clamped < nodeEnd) {
    return offsetStart + mapPosInNode(node, nodeStart, clamped);
  }

  if (childIndex >= doc.childCount - 1) {
    return index.totalTextLength;
  }

  const nextOffsetStart = index.offsetStarts[childIndex + 1];
  if (Number.isFinite(nextOffsetStart)) {
    return Number(nextOffsetStart);
  }

  return offsetStart + (index.childTextLengths[childIndex] ?? 0);
};
