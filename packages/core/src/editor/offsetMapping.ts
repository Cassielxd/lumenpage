// Text offset <-> ProseMirror position mapping.
const getTableTextLength = (tableNode) => {
  let length = 0;
  tableNode.forEach((row, _pos, rowIndex) => {
    row.forEach((cell, _cellPos, cellIndex) => {
      length += cell.textBetween(0, cell.content.size, "\n").length;
      if (cellIndex < row.childCount - 1) {
        length += 1;
      }
    });
    if (rowIndex < tableNode.childCount - 1) {
      length += 1;
    }
  });
  return length;
};

const getImageTextLength = () => 1;

function getListItemTextLength(item) {
  let length = 0;
  item.forEach((child, _pos, index) => {
    length += getNodeTextLength(child);
    if (index < item.childCount - 1) {
      length += 1;
    }
  });
  return length;
}

function getListTextLength(listNode) {
  let length = 0;
  listNode.forEach((item, _pos, index) => {
    length += getListItemTextLength(item);
    if (index < listNode.childCount - 1) {
      length += 1;
    }
  });
  return length;
}

function getNodeTextLength(node) {
  if (node.type.name === "table") {
    return getTableTextLength(node);
  }

  if (node.type.name === "image") {
    return getImageTextLength();
  }

  if (node.type.name === "bullet_list" || node.type.name === "ordered_list") {
    return getListTextLength(node);
  }

  if (node.type.name === "list_item") {
    return getListItemTextLength(node);
  }

  return node.textContent.length;
}

const getBlockTextLength = (node) => getNodeTextLength(node);

const mapOffsetInTextblock = (node, nodePos, offset) => {
  const textStart = nodePos + 1;

  return textStart + offset;
};

const mapOffsetInImage = (node, nodePos, offset) =>
  offset <= 0 ? nodePos : nodePos + node.nodeSize;

function mapOffsetInListItem(item, itemPos, offset) {
  let remaining = offset;

  let innerPos = itemPos + 1;

  for (let i = 0; i < item.childCount; i += 1) {
    const child = item.child(i);

    const childPos = innerPos;

    const textLength = getNodeTextLength(child);

    if (remaining <= textLength) {
      return mapOffsetInNode(child, childPos, remaining);
    }

    remaining -= textLength;

    if (i < item.childCount - 1) {
      if (remaining === 0) {
        return childPos + child.nodeSize - 1;
      }

      remaining -= 1;
    }

    innerPos += child.nodeSize;
  }

  return itemPos + item.nodeSize - 1;
}

function mapOffsetInList(list, listPos, offset) {
  let remaining = offset;

  const listStart = listPos + 1;

  let itemPos = listStart;

  for (let i = 0; i < list.childCount; i += 1) {
    const item = list.child(i);

    const itemStart = itemPos;

    const itemLength = getListItemTextLength(item);

    if (remaining <= itemLength) {
      return mapOffsetInListItem(item, itemStart, remaining);
    }

    remaining -= itemLength;

    if (i < list.childCount - 1) {
      if (remaining === 0) {
        return itemStart + item.nodeSize - 1;
      }

      remaining -= 1;
    }

    itemPos += item.nodeSize;
  }

  return listPos + list.nodeSize - 1;
}

const mapOffsetInCell = (cell, cellPos, offset) => {
  let remaining = offset;

  let innerPos = cellPos + 1;

  for (let i = 0; i < cell.childCount; i += 1) {
    const block = cell.child(i);

    const blockPos = innerPos;

    const textLength = block.textContent.length;

    if (remaining <= textLength) {
      return mapOffsetInTextblock(block, blockPos, remaining);
    }

    remaining -= textLength;

    if (i < cell.childCount - 1) {
      if (remaining === 0) {
        return blockPos + block.nodeSize - 1;
      }

      remaining -= 1;
    }

    innerPos += block.nodeSize;
  }

  return cellPos + cell.nodeSize - 1;
};

const mapOffsetInTable = (table, tablePos, offset) => {
  let remaining = offset;

  const tableStart = tablePos + 1;

  let rowPos = tableStart;

  for (let r = 0; r < table.childCount; r += 1) {
    const row = table.child(r);

    const rowStart = rowPos + 1;

    let cellPos = rowStart;

    for (let c = 0; c < row.childCount; c += 1) {
      const cell = row.child(c);

      const cellLength = cell.textBetween(0, cell.content.size, "\n").length;

      if (remaining <= cellLength) {
        return mapOffsetInCell(cell, cellPos, remaining);
      }

      remaining -= cellLength;

      if (c < row.childCount - 1) {
        if (remaining === 0) {
          return cellPos + cell.nodeSize - 1;
        }

        remaining -= 1;
      }

      cellPos += cell.nodeSize;
    }

    if (r < table.childCount - 1) {
      if (remaining === 0) {
        return rowPos + row.nodeSize - 1;
      }

      remaining -= 1;
    }

    rowPos += row.nodeSize;
  }

  return tablePos + table.nodeSize - 1;
};

function mapOffsetInNode(node, nodePos, offset) {
  if (node.type.name === "table") {
    return mapOffsetInTable(node, nodePos, offset);
  }

  if (node.type.name === "image") {
    return mapOffsetInImage(node, nodePos, offset);
  }

  if (node.type.name === "bullet_list" || node.type.name === "ordered_list") {
    return mapOffsetInList(node, nodePos, offset);
  }

  if (node.type.name === "list_item") {
    return mapOffsetInListItem(node, nodePos, offset);
  }

  return mapOffsetInTextblock(node, nodePos, offset);
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

const mapPosInImage = (node, nodePos, pos) =>
  pos <= nodePos ? 0 : getImageTextLength();

function mapPosInListItem(item, itemPos, pos) {
  let offset = 0;

  let innerPos = itemPos + 1;

  for (let i = 0; i < item.childCount; i += 1) {
    const child = item.child(i);

    const childPos = innerPos;

    if (pos <= childPos) {
      return offset;
    }

    if (pos < childPos + child.nodeSize) {
      return offset + mapPosInNode(child, childPos, pos);
    }

    offset += getNodeTextLength(child);

    if (i < item.childCount - 1) {
      offset += 1;
    }

    innerPos += child.nodeSize;
  }

  return offset;
}

function mapPosInList(list, listPos, pos) {
  let offset = 0;

  const listStart = listPos + 1;

  let itemPos = listStart;

  for (let i = 0; i < list.childCount; i += 1) {
    const item = list.child(i);

    const itemStart = itemPos;

    if (pos <= itemStart) {
      return offset;
    }

    if (pos < itemStart + item.nodeSize) {
      return offset + mapPosInListItem(item, itemStart, pos);
    }

    offset += getListItemTextLength(item);

    if (i < list.childCount - 1) {
      offset += 1;
    }

    itemPos += item.nodeSize;
  }

  return offset;
}

const mapPosInCell = (cell, cellPos, pos) => {
  let offset = 0;

  let innerPos = cellPos + 1;

  for (let i = 0; i < cell.childCount; i += 1) {
    const block = cell.child(i);

    const blockPos = innerPos;

    if (pos <= blockPos) {
      return offset;
    }

    if (pos < blockPos + block.nodeSize) {
      return offset + mapPosInTextblock(block, blockPos, pos);
    }

    offset += block.textContent.length;

    if (i < cell.childCount - 1) {
      offset += 1;
    }

    innerPos += block.nodeSize;
  }

  return offset;
};

const mapPosInTable = (table, tablePos, pos) => {
  let offset = 0;

  const tableStart = tablePos + 1;

  let rowPos = tableStart;

  for (let r = 0; r < table.childCount; r += 1) {
    const row = table.child(r);

    const rowStart = rowPos + 1;

    let cellPos = rowStart;

    for (let c = 0; c < row.childCount; c += 1) {
      const cell = row.child(c);

      if (pos <= cellPos) {
        return offset;
      }

      if (pos < cellPos + cell.nodeSize) {
        return offset + mapPosInCell(cell, cellPos, pos);
      }

      offset += cell.textBetween(0, cell.content.size, "\n").length;

      if (c < row.childCount - 1) {
        offset += 1;
      }

      cellPos += cell.nodeSize;
    }

    if (r < table.childCount - 1) {
      offset += 1;
    }

    rowPos += row.nodeSize;
  }

  return offset;
};

function mapPosInNode(node, nodePos, pos) {
  if (node.type.name === "table") {
    return mapPosInTable(node, nodePos, pos);
  }

  if (node.type.name === "image") {
    return mapPosInImage(node, nodePos, pos);
  }

  if (node.type.name === "bullet_list" || node.type.name === "ordered_list") {
    return mapPosInList(node, nodePos, pos);
  }

  if (node.type.name === "list_item") {
    return mapPosInListItem(node, nodePos, pos);
  }

  return mapPosInTextblock(node, nodePos, pos);
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

    if (clamped === nodeEnd && node.type.name === "image") {
      return offset + getImageTextLength();
    }

    offset += textLength;

    if (i < doc.childCount - 1) {
      offset += 1;
    }

    docPos += node.nodeSize;
  }

  return offset;
};

