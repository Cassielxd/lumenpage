const getPageOffsetDelta = (page: any) =>
  Number.isFinite(page?.__pageOffsetDelta) ? Number(page.__pageOffsetDelta) : 0;

const buildTablePaginationDebug = (layout: any, visibleRange: any) => {
  if (!layout?.pages?.length) {
    return "";
  }

  const lines = [];
  const start = typeof visibleRange?.startIndex === "number" ? visibleRange.startIndex : 0;
  const end =
    typeof visibleRange?.endIndex === "number" ? visibleRange.endIndex : layout.pages.length - 1;

  for (let pageIndex = start; pageIndex <= end; pageIndex += 1) {
    if (pageIndex < 0 || pageIndex >= layout.pages.length) {
      continue;
    }

    const page = layout.pages[pageIndex];
    if (!page?.lines?.length) {
      continue;
    }

    const pageOffsetDelta = getPageOffsetDelta(page);
    const groups = new Map();
    for (const line of page.lines) {
      const attrs = line?.blockAttrs || {};
      const tableMeta = line?.tableOwnerMeta || line?.tableMeta;
      if (attrs?.sliceGroup !== "table" && !tableMeta) {
        continue;
      }

      const tableOwnerKey = Array.isArray(line?.fragmentOwners)
        ? line.fragmentOwners.find((owner: any) => owner?.role === "table")?.key
        : null;
      const key =
        tableOwnerKey ??
        line.blockId ??
        (Number.isFinite(line.blockStart)
          ? Number(line.blockStart) + pageOffsetDelta
          : Number.isFinite(line.start)
            ? Number(line.start) + pageOffsetDelta
            : 0);

      if (!groups.has(key)) {
        groups.set(key, {
          blockStart: Number.isFinite(line.blockStart)
            ? Number(line.blockStart) + pageOffsetDelta
            : Number.isFinite(key)
              ? key
              : null,
          minRow: Number.POSITIVE_INFINITY,
          maxRow: -1,
          rows: null,
          sliceFromPrev: false,
          sliceHasNext: false,
          tableHeight: null,
        });
      }

      const entry = groups.get(key);
      const rowIndex = Number.isFinite(attrs.rowIndex) ? attrs.rowIndex : 0;
      entry.minRow = Math.min(entry.minRow, rowIndex);
      entry.maxRow = Math.max(entry.maxRow, rowIndex);
      if (Number.isFinite(attrs.rows)) {
        entry.rows = attrs.rows;
      }
      if (attrs.tableSliceFromPrev) {
        entry.sliceFromPrev = true;
      }
      if (attrs.tableSliceHasNext) {
        entry.sliceHasNext = true;
      }
      if (tableMeta?.continuedFromPrev) {
        entry.sliceFromPrev = true;
      }
      if (tableMeta?.continuesAfter) {
        entry.sliceHasNext = true;
      }
      if (Number.isFinite(tableMeta?.tableHeight)) {
        entry.tableHeight = tableMeta.tableHeight;
      }
    }

    if (groups.size === 0) {
      continue;
    }

    lines.push(`Page ${pageIndex + 1}`);
    let index = 1;
    for (const entry of groups.values()) {
      const minRow = Number.isFinite(entry.minRow) ? entry.minRow + 1 : 1;
      const maxRow = Number.isFinite(entry.maxRow) ? entry.maxRow + 1 : minRow;
      const rows = Number.isFinite(entry.rows) ? entry.rows : "?";
      const slice =
        entry.sliceFromPrev || entry.sliceHasNext
          ? `${entry.sliceFromPrev ? "cont" : "start"}-${entry.sliceHasNext ? "cont" : "end"}`
          : "full";
      const height = Number.isFinite(entry.tableHeight)
        ? `, height: ${Math.round(entry.tableHeight)}`
        : "";
      const startInfo = Number.isFinite(entry.blockStart) ? `, start: ${entry.blockStart}` : "";
      lines.push(
        `  Table ${index}: rows ${minRow}-${maxRow} / ${rows}, slice: ${slice}${height}${startInfo}`
      );
      index += 1;
    }
  }

  return lines.join("\n");
};

export const updatePaginationDebugPanel = ({
  settings,
  layout,
  visible,
}: {
  settings: any;
  layout: any;
  visible: { startIndex: number; endIndex: number };
}) => {
  const tablePanel = settings?.tablePaginationPanelEl;
  if (!tablePanel) {
    return;
  }

  const customBuilder =
    settings?.paginationDebugBuilder || settings?.tablePaginationDebugBuilder || null;
  let summary = buildTablePaginationDebug(layout, visible);
  if (typeof customBuilder === "function") {
    const customSummary = customBuilder(layout, visible, {
      defaultBuilder: buildTablePaginationDebug,
    });
    if (typeof customSummary === "string") {
      summary = customSummary;
    }
  }

  tablePanel.textContent = summary || "No table slices on visible pages.";
};
