import { getTableTextLength } from "./schema.js";

// Text offset <-> ProseMirror position mapping.

const getBlockTextLength = (node) => {


  if (node.type.name === "table") {


    return getTableTextLength(node);


  }


  return node.textContent.length;


};





const mapOffsetInTextblock = (node, nodePos, offset) => {


  const textStart = nodePos + 1;


  return textStart + offset;


};





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


    const nodeEnd = nodeStart + node.nodeSize;





    if (remaining <= textLength) {


      if (node.type.name === "table") {


        return mapOffsetInTable(node, nodeStart, remaining);


      }


      return mapOffsetInTextblock(node, nodeStart, remaining);


    }





    remaining -= textLength;





    if (i < doc.childCount - 1) {


      if (remaining === 0) {


        return nodeEnd - 1;


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


      if (node.type.name === "table") {


        return offset + mapPosInTable(node, nodeStart, clamped);


      }


      return offset + mapPosInTextblock(node, nodeStart, clamped);


    }





    offset += textLength;


    if (i < doc.childCount - 1) {


      offset += 1;


    }





    docPos += node.nodeSize;


  }





  return offset;


};





