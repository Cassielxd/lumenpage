import { defaultTableRenderer as baseTableRenderer } from "lumenpage-render-engine";
import { splitTableBlock } from "./tablePagination/split";

const isTableCellTypeName = (typeName) => typeName === "tableCell" || typeName === "tableHeader";

const isInTableAtResolvedPos = ($pos) => {
  if (!$pos || !Number.isFinite($pos.depth)) {
    return false;
  }
  for (let depth = $pos.depth; depth >= 0; depth -= 1) {
    const typeName = $pos.node(depth)?.type?.name;
    if (typeName === "table" || typeName === "tableRow" || isTableCellTypeName(typeName)) {
      return true;
    }
  }
  return false;
};

export const createTableSelectionGeometry = () => ({
  shouldComputeSelectionRects: ({ editorState, selection }) => {
    const pmSel = editorState?.selection;
    if (!pmSel) {
      return false;
    }
    if (pmSel?.$anchorCell || pmSel?.$headCell || pmSel?.constructor?.name === "CellSelection") {
      return true;
    }
    if (pmSel?.constructor?.name === "NodeSelection") {
      return pmSel.node?.type?.name === "table";
    }
    if (!selection || selection.from === selection.to) {
      return false;
    }
    return isInTableAtResolvedPos(pmSel?.$from) || isInTableAtResolvedPos(pmSel?.$to);
  },
  shouldRenderBorderOnly: ({ editorState }) => {
    const selection = editorState?.selection;
    return selection?.constructor?.name === "NodeSelection" && selection.node?.type?.name === "table";
  },
});

export const tableRenderer = {
  ...baseTableRenderer,
  splitBlock: splitTableBlock,
  pagination: {
    fragmentModel: "continuation",
    reusePolicy: "actual-slice-only",
  },
};
