import { isTableLayoutLine } from "../../layoutSemantics";

export const viewHasFocus = (view: any) => {
  const root = view?._internals?.dom?.root;
  const input = view?._internals?.dom?.input;
  const ownerDocument = root?.ownerDocument || (typeof document !== "undefined" ? document : null);
  const active = ownerDocument?.activeElement ?? null;
  if (!active) {
    return false;
  }
  return active === input || active === root || !!root?.contains?.(active);
};

export const focusView = (view: any) => {
  view?._internals?.dom?.input?.focus?.();
};

export const isViewEditable = (view: any) => view?._internals?.dom?.input?.readOnly !== true;

export const getViewPaginationInfo = (view: any) => {
  const layout = view?._internals?.getLayout?.() ?? null;
  const settings = view?._internals?.settings ?? null;
  const scrollArea = view?._internals?.dom?.scrollArea ?? null;
  if (!layout || !settings || !scrollArea) {
    return null;
  }

  const pageGap = Number.isFinite(layout.pageGap) ? layout.pageGap : settings.pageGap ?? 0;
  const pageSpan = layout.pageHeight + pageGap;
  const scrollTop = Number.isFinite(scrollArea.scrollTop) ? scrollArea.scrollTop : 0;
  const viewportHeight = Number.isFinite(scrollArea.clientHeight) ? scrollArea.clientHeight : 0;

  let visibleStartIndex = 0;
  let visibleEndIndex = Math.max(0, (layout.pages?.length ?? 1) - 1);
  if (pageSpan > 0) {
    visibleStartIndex = Math.max(0, Math.floor(scrollTop / pageSpan));
    visibleEndIndex = Math.min(
      Math.max(0, (layout.pages?.length ?? 1) - 1),
      Math.floor((scrollTop + Math.max(0, viewportHeight - 1)) / pageSpan)
    );
  }

  let tableLineCount = 0;
  let tableSliceCount = 0;
  const pages = (layout.pages || []).map((page: any, pageIndex: number) => {
    const lineCount = page?.lines?.length ?? 0;
    let tableLines = 0;
    let tableSlices = 0;
    for (const line of page?.lines || []) {
      if (!isTableLayoutLine(line)) {
        continue;
      }
      tableLines += 1;
      const attrs = line?.blockAttrs || {};
      if (
        attrs.tableSliceFromPrev ||
        attrs.tableSliceHasNext ||
        line?.tableMeta?.continuedFromPrev ||
        line?.tableMeta?.continuesAfter ||
        line?.tableMeta?.rowSplit
      ) {
        tableSlices += 1;
      }
    }
    tableLineCount += tableLines;
    tableSliceCount += tableSlices;
    return {
      index: pageIndex,
      fromY: pageIndex * pageSpan,
      toY: pageIndex * pageSpan + layout.pageHeight,
      lineCount,
      rootIndexMin: Number.isFinite(page?.rootIndexMin) ? page.rootIndexMin : null,
      rootIndexMax: Number.isFinite(page?.rootIndexMax) ? page.rootIndexMax : null,
      tableLines,
      tableSlices,
    };
  });

  return {
    pageCount: layout.pages?.length ?? 0,
    totalHeight: layout.totalHeight ?? 0,
    pageWidth: layout.pageWidth ?? settings.pageWidth ?? 0,
    pageHeight: layout.pageHeight ?? settings.pageHeight ?? 0,
    pageGap,
    margin: layout.margin ?? settings.margin ?? null,
    lineHeight: settings.lineHeight ?? null,
    blockSpacing: settings.blockSpacing ?? null,
    scrollTop,
    viewportHeight,
    visibleRange: {
      startIndex: visibleStartIndex,
      endIndex: visibleEndIndex,
    },
    stats: {
      tableLineCount,
      tableSliceCount,
    },
    pages,
  };
};
