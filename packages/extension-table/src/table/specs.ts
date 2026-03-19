import type { NodeSpec } from "lumenpage-model";

const readIdAttr = (dom) => dom?.getAttribute?.("data-node-id") || null;

const normalizeTableCellBackground = (value) => {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }
  if (typeof CSS !== "undefined" && typeof CSS.supports === "function") {
    return CSS.supports("color", text) ? text : null;
  }
  if (typeof document === "undefined") {
    return text;
  }
  const probe = document.createElement("span");
  probe.style.color = "";
  probe.style.color = text;
  const normalized = String(probe.style.color || "").trim();
  return normalized || null;
};

export const serializeTableToText = (tableNode) => {
  const rows = [];

  tableNode.forEach((row) => {
    const cells = [];

    row.forEach((cell) => {
      const cellText = cell.textBetween(0, cell.content.size, "\n");

      cells.push(cellText);
    });

    rows.push(cells.join("\t"));
  });

  return rows.join("\n");
};

export const getTableTextLength = (tableNode) => serializeTableToText(tableNode).length;

const serializeCellToText = (cell, helpers) => {
  if (!cell || cell.childCount === 0) {
    return "";
  }
  const parts = [];
  for (let i = 0; i < cell.childCount; i += 1) {
    parts.push(helpers?.serializeNodeToText ? helpers.serializeNodeToText(cell.child(i)) : "");
    if (i < cell.childCount - 1) {
      parts.push("\n");
    }
  }
  return parts.join("");
};

const getCellTextLength = (cell, helpers) => {
  if (!cell || cell.childCount === 0) {
    return 0;
  }
  let length = 0;
  for (let i = 0; i < cell.childCount; i += 1) {
    if (helpers?.getNodeTextLength) {
      length += helpers.getNodeTextLength(cell.child(i));
    } else {
      length += cell.child(i).textContent.length;
    }
    if (i < cell.childCount - 1) {
      length += 1;
    }
  }
  return length;
};

const resolveTerminalTextPos = (node, nodePos, helpers) => {
  if (!node) {
    return nodePos;
  }

  if (node.childCount > 0) {
    let innerPos = nodePos + 1;
    for (let index = 0; index < node.childCount; index += 1) {
      const child = node.child(index);
      if (index === node.childCount - 1) {
        return resolveTerminalTextPos(child, innerPos, helpers);
      }
      innerPos += child.nodeSize;
    }
  }

  if (node.isTextblock) {
    const textLength = helpers?.getNodeTextLength
      ? helpers.getNodeTextLength(node)
      : node.textContent.length;
    return nodePos + 1 + Math.max(0, textLength);
  }

  if (node.isLeaf || node.isAtom) {
    return nodePos + Math.max(0, node.nodeSize);
  }

  return nodePos + Math.max(0, node.nodeSize - 1);
};

const mapOffsetInCell = (cell, cellPos, offset, helpers) => {
  let remaining = offset;
  let innerPos = cellPos + 1;
  for (let i = 0; i < cell.childCount; i += 1) {
    const block = cell.child(i);
    const blockPos = innerPos;
    const textLength = helpers?.getNodeTextLength
      ? helpers.getNodeTextLength(block)
      : block.textContent.length;
    if (remaining <= textLength) {
      return helpers?.mapOffsetInNode
        ? helpers.mapOffsetInNode(block, blockPos, remaining)
        : blockPos + Math.max(0, remaining);
    }
    remaining -= textLength;
    if (i < cell.childCount - 1) {
      if (remaining === 0) {
        return resolveTerminalTextPos(block, blockPos, helpers);
      }
      remaining -= 1;
    }
    innerPos += block.nodeSize;
  }
  return resolveTerminalTextPos(cell, cellPos, helpers);
};

const mapPosInCell = (cell, cellPos, pos, helpers) => {
  let offset = 0;
  let innerPos = cellPos + 1;
  for (let i = 0; i < cell.childCount; i += 1) {
    const block = cell.child(i);
    const blockPos = innerPos;
    if (pos <= blockPos) {
      return offset;
    }
    if (pos < blockPos + block.nodeSize) {
      return helpers?.mapPosInNode ? offset + helpers.mapPosInNode(block, blockPos, pos) : offset;
    }
    offset += helpers?.getNodeTextLength
      ? helpers.getNodeTextLength(block)
      : block.textContent.length;
    if (i < cell.childCount - 1) {
      offset += 1;
    }
    innerPos += block.nodeSize;
  }
  return offset;
};

const tableOffsetMapping = {
  toText: (tableNode, helpers) => {
    const rows = [];
    tableNode.forEach((row) => {
      const cells = [];
      row.forEach((cell) => {
        if (helpers?.serializeNodeToText) {
          cells.push(serializeCellToText(cell, helpers));
        } else {
          cells.push(cell.textBetween(0, cell.content.size, "\n"));
        }
      });
      rows.push(cells.join("\t"));
    });
    return rows.join("\n");
  },
  getTextLength: (tableNode, helpers) => {
    let length = 0;
    tableNode.forEach((row, _rowPos, rowIndex) => {
      row.forEach((cell, _cellPos, cellIndex) => {
        length += helpers?.getNodeTextLength
          ? getCellTextLength(cell, helpers)
          : cell.textBetween(0, cell.content.size, "\n").length;
        if (cellIndex < row.childCount - 1) {
          length += 1;
        }
      });
      if (rowIndex < tableNode.childCount - 1) {
        length += 1;
      }
    });
    return length;
  },
  mapOffsetToPos: (table, tablePos, offset, helpers) => {
    let remaining = offset;
    let rowPos = tablePos + 1;
    for (let r = 0; r < table.childCount; r += 1) {
      const row = table.child(r);
      const rowStart = rowPos + 1;
      let cellPos = rowStart;
      for (let c = 0; c < row.childCount; c += 1) {
        const cell = row.child(c);
        const cellLength = getCellTextLength(cell, helpers);
        if (remaining <= cellLength) {
          return mapOffsetInCell(cell, cellPos, remaining, helpers);
        }
        remaining -= cellLength;
        if (c < row.childCount - 1) {
          if (remaining === 0) {
            return resolveTerminalTextPos(cell, cellPos, helpers);
          }
          remaining -= 1;
        }
        cellPos += cell.nodeSize;
      }
      if (r < table.childCount - 1) {
        if (remaining === 0) {
          return resolveTerminalTextPos(row, rowPos, helpers);
        }
        remaining -= 1;
      }
      rowPos += row.nodeSize;
    }
    return resolveTerminalTextPos(table, tablePos, helpers);
  },
  mapPosToOffset: (table, tablePos, pos, helpers) => {
    let offset = 0;
    let rowPos = tablePos + 1;
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
          return offset + mapPosInCell(cell, cellPos, pos, helpers);
        }
        offset += getCellTextLength(cell, helpers);
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
  },
};

export const tableNodeSpecs: Record<string, NodeSpec> = {
  table: {
    group: "block",
    content: "tableRow+",
    attrs: {
      id: { default: null },
    },
    offsetMapping: tableOffsetMapping,
    parseDOM: [
      {
        tag: "table",
        getAttrs: (dom) => ({ id: readIdAttr(dom) }),
      },
    ],
    toDOM(node) {
      const attrs = {};

      if (node.attrs?.id) {
        attrs["data-node-id"] = node.attrs.id;
      }

      return ["table", attrs, ["tbody", 0]];
    },
  },

  tableRow: {
    content: "(tableCell|tableHeader)+",
    parseDOM: [{ tag: "tr" }],
    toDOM() {
      return ["tr", 0];
    },
  },

  tableCell: {
    attrs: {
      colspan: { default: 1 },
      rowspan: { default: 1 },
      background: { default: null },
    },
    content: "block+",
    isolating: true,
    parseDOM: [
      {
        tag: "td",
        getAttrs: (dom) => ({
          colspan: Math.max(1, Number.parseInt(dom.getAttribute("colspan") || "1", 10) || 1),
          rowspan: Math.max(1, Number.parseInt(dom.getAttribute("rowspan") || "1", 10) || 1),
          background: normalizeTableCellBackground(
            dom.style?.backgroundColor || dom.getAttribute("data-background")
          ),
        }),
      },
    ],
    toDOM(node) {
      const attrs: Record<string, string | number> = {};
      const colspan = Number.isFinite(node.attrs?.colspan) ? node.attrs.colspan : 1;
      const rowspan = Number.isFinite(node.attrs?.rowspan) ? node.attrs.rowspan : 1;
      if (colspan > 1) {
        attrs.colspan = colspan;
      }
      if (rowspan > 1) {
        attrs.rowspan = rowspan;
      }
      const background = normalizeTableCellBackground(node.attrs?.background);
      if (background) {
        attrs.style = `background-color:${background}`;
        attrs["data-background"] = background;
      }
      return ["td", attrs, 0];
    },
  },

  tableHeader: {
    attrs: {
      colspan: { default: 1 },
      rowspan: { default: 1 },
      background: { default: null },
    },
    content: "block+",
    isolating: true,
    parseDOM: [
      {
        tag: "th",
        getAttrs: (dom) => ({
          colspan: Math.max(1, Number.parseInt(dom.getAttribute("colspan") || "1", 10) || 1),
          rowspan: Math.max(1, Number.parseInt(dom.getAttribute("rowspan") || "1", 10) || 1),
          background: normalizeTableCellBackground(
            dom.style?.backgroundColor || dom.getAttribute("data-background")
          ),
        }),
      },
    ],
    toDOM(node) {
      const attrs: Record<string, string | number> = {};
      const colspan = Number.isFinite(node.attrs?.colspan) ? node.attrs.colspan : 1;
      const rowspan = Number.isFinite(node.attrs?.rowspan) ? node.attrs.rowspan : 1;
      if (colspan > 1) {
        attrs.colspan = colspan;
      }
      if (rowspan > 1) {
        attrs.rowspan = rowspan;
      }
      const background = normalizeTableCellBackground(node.attrs?.background);
      if (background) {
        attrs.style = `background-color:${background}`;
        attrs["data-background"] = background;
      }
      return ["th", attrs, 0];
    },
  },
};

