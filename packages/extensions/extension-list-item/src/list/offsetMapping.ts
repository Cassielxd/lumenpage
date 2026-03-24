const serializeListItemToText = (itemNode, helpers) => {
  if (helpers?.serializeNodeToText) {
    return helpers.serializeNodeToText(itemNode);
  }
  return itemNode.textBetween(0, itemNode.content.size, "\n");
};

const serializeContainerToText = (node, helpers) => {
  const parts = [];
  node.forEach((child, _pos, index) => {
    parts.push(helpers.serializeNodeToText(child));
    if (index < node.childCount - 1) {
      parts.push("\n");
    }
  });
  return parts.join("");
};

const getContainerTextLength = (node, helpers) => {
  let length = 0;
  node.forEach((child, _pos, index) => {
    length += helpers.getNodeTextLength(child);
    if (index < node.childCount - 1) {
      length += 1;
    }
  });
  return length;
};

const mapOffsetInContainer = (node, nodePos, offset, helpers) => {
  let remaining = offset;
  let innerPos = nodePos + 1;
  for (let i = 0; i < node.childCount; i += 1) {
    const child = node.child(i);
    const childPos = innerPos;
    const textLength = helpers.getNodeTextLength(child);
    if (remaining <= textLength) {
      return helpers.mapOffsetInNode(child, childPos, remaining);
    }
    remaining -= textLength;
    if (i < node.childCount - 1) {
      if (remaining === 0) {
        return childPos + child.nodeSize - 1;
      }
      remaining -= 1;
    }
    innerPos += child.nodeSize;
  }
  return nodePos + node.nodeSize - 1;
};

const mapPosInContainer = (node, nodePos, pos, helpers) => {
  let offset = 0;
  let innerPos = nodePos + 1;
  for (let i = 0; i < node.childCount; i += 1) {
    const child = node.child(i);
    const childPos = innerPos;
    if (pos <= childPos) {
      return offset;
    }
    if (pos < childPos + child.nodeSize) {
      return offset + helpers.mapPosInNode(child, childPos, pos);
    }
    offset += helpers.getNodeTextLength(child);
    if (i < node.childCount - 1) {
      offset += 1;
    }
    innerPos += child.nodeSize;
  }
  return offset;
};

export const containerOffsetMapping = {
  toText: (node, helpers) => serializeContainerToText(node, helpers),
  getTextLength: (node, helpers) => getContainerTextLength(node, helpers),
  mapOffsetToPos: (node, nodePos, offset, helpers) =>
    mapOffsetInContainer(node, nodePos, offset, helpers),
  mapPosToOffset: (node, nodePos, pos, helpers) => mapPosInContainer(node, nodePos, pos, helpers),
};

export const serializeListToText = (listNode, helpers) => {
  const items = [];
  listNode.forEach((item) => {
    items.push(serializeListItemToText(item, helpers));
  });
  return items.join("\n");
};
