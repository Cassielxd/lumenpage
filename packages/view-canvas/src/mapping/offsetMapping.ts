// 文本偏移量 <-> ProseMirror 位置映射
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
  let length = 0;
  for (let i = 0; i < doc.childCount; i += 1) {
    const node = doc.child(i);
    length += getBlockTextLength(node);
    if (i < doc.childCount - 1) {
      length += 1;
    }
  }
  return Math.max(0, Math.min(offset, length));
};

export const textOffsetToDocPos = (doc, offset) => {
  const clamped = clampTextOffset(doc, offset);

  let remaining = clamped;

  let docPos = 0;

  for (let i = 0; i < doc.childCount; i += 1) {
    const node = doc.child(i);

    const textLength = getBlockTextLength(node);

    const nodeStart = docPos;

    if (remaining <= textLength) {
      return mapOffsetInNode(node, nodeStart, remaining);
    }

    remaining -= textLength;

    if (i < doc.childCount - 1) {
      if (remaining === 0) {
        return nodeStart + node.nodeSize - 1;
      }

      remaining -= 1;
    }

    docPos += node.nodeSize;
  }

  return doc.content.size;
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
  const clamped = Math.max(0, Math.min(pos, doc.content.size));

  let docPos = 0;

  let offset = 0;

  for (let i = 0; i < doc.childCount; i += 1) {
    const node = doc.child(i);

    const textLength = getBlockTextLength(node);

    const nodeStart = docPos;

    const nodeEnd = nodeStart + node.nodeSize;

    if (clamped <= nodeStart) {
      return offset;
    }

    if (clamped < nodeEnd) {
      return offset + mapPosInNode(node, nodeStart, clamped);
    }

    offset += textLength;

    if (i < doc.childCount - 1) {
      offset += 1;
    }

    docPos += node.nodeSize;
  }

  return offset;
};
