import { defaultTableRenderer as baseTableRenderer } from "lumenpage-render-engine";
import { NodeSelection } from "lumenpage-state";
import {
  tableCellSelectionToRects,
  tableRangeSelectionToCellRects,
} from "../view/render/selection.js";
import {
  matchesTableSelectionNodeType,
  normalizeTableSelectionSemantics,
  type TableSelectionSemantics,
} from "../view/tableSelectionSemantics.js";

type TableSelectionGeometryConfig = TableSelectionSemantics;

const isInTableAtResolvedPos = ($pos, config: Required<TableSelectionGeometryConfig>) => {
  if (!$pos || !Number.isFinite($pos.depth)) {
    return false;
  }
  for (let depth = $pos.depth; depth >= 0; depth -= 1) {
    const typeName = $pos.node(depth)?.type?.name;
    if (
      matchesTableSelectionNodeType(typeName, config.tableNodeTypes) ||
      matchesTableSelectionNodeType(typeName, config.tableRowNodeTypes) ||
      matchesTableSelectionNodeType(typeName, config.tableCellNodeTypes)
    ) {
      return true;
    }
  }
  return false;
};

export const createTableSelectionGeometry = (config?: TableSelectionGeometryConfig | null) => {
  const resolved = normalizeTableSelectionSemantics(config);

  return {
    shouldComputeSelectionRects: ({ editorState, selection }) => {
      const pmSel = editorState?.selection;
      if (!pmSel) {
        return false;
      }
      if (pmSel?.$anchorCell || pmSel?.$headCell) {
        return true;
      }
      if (pmSel instanceof NodeSelection) {
        return matchesTableSelectionNodeType(pmSel.node?.type?.name, resolved.tableNodeTypes);
      }
      if (!selection || selection.from === selection.to) {
        return false;
      }
      return (
        isInTableAtResolvedPos(pmSel?.$from, resolved) ||
        isInTableAtResolvedPos(pmSel?.$to, resolved)
      );
    },
    shouldRenderBorderOnly: ({ editorState }) => {
      const selection = editorState?.selection;
      return (
        selection instanceof NodeSelection &&
        matchesTableSelectionNodeType(selection.node?.type?.name, resolved.tableNodeTypes)
      );
    },
    resolveSelectionRects: ({
      layout,
      editorState,
      selection,
      scrollTop,
      viewportWidth,
      layoutIndex,
      docPosToTextOffset,
    }) => {
      const tableCellRects = tableCellSelectionToRects({
        layout,
        selection: editorState?.selection,
        doc: editorState?.doc,
        scrollTop,
        viewportWidth,
        layoutIndex,
        docPosToTextOffset,
        semantics: resolved,
      });
      if (Array.isArray(tableCellRects) && tableCellRects.length > 0) {
        return [...tableCellRects, ...tableCellRects];
      }

      const tableRangeRects = tableRangeSelectionToCellRects({
        layout,
        fromOffset: selection?.from,
        toOffset: selection?.to,
        scrollTop,
        viewportWidth,
        layoutIndex,
        semantics: resolved,
      });
      if (Array.isArray(tableRangeRects) && tableRangeRects.length > 0) {
        return [...tableRangeRects, ...tableRangeRects];
      }

      return null;
    },
  };
};

export const tableRenderer = baseTableRenderer;
