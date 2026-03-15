export const resolveLegacySelectionRects = ({
  geometry,
  layout,
  editorState,
  selection,
  scrollTop,
  viewportWidth,
  layoutIndex,
  docPosToTextOffset,
}) => {
  if (!geometry || typeof geometry !== "object") {
    return null;
  }

  const tableCellRectsResolver =
    typeof geometry?.tableCellSelectionToRects === "function"
      ? geometry.tableCellSelectionToRects
      : null;
  const tableRangeRectsResolver =
    typeof geometry?.tableRangeSelectionToCellRects === "function"
      ? geometry.tableRangeSelectionToCellRects
      : null;

  if (tableCellRectsResolver) {
    const tableCellRects = tableCellRectsResolver({
      layout,
      selection: editorState?.selection,
      doc: editorState?.doc,
      scrollTop,
      viewportWidth,
      layoutIndex,
      docPosToTextOffset,
    });
    if (Array.isArray(tableCellRects) && tableCellRects.length > 0) {
      return [...tableCellRects, ...tableCellRects];
    }
  }

  if (tableRangeRectsResolver) {
    const tableRangeRects = tableRangeRectsResolver({
      layout,
      fromOffset: selection?.from,
      toOffset: selection?.to,
      scrollTop,
      viewportWidth,
      layoutIndex,
      docPosToTextOffset,
    });
    if (Array.isArray(tableRangeRects) && tableRangeRects.length > 0) {
      return [...tableRangeRects, ...tableRangeRects];
    }
  }

  return null;
};
