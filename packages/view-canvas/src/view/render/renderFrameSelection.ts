import { now } from "../debugTrace";

type CreateRenderFrameSelectionArgs = {
  queryEditorProp?: (name: string, args?: any) => any;
  docPosToTextOffset: (doc: any, pos: number) => number;
  selectionToRects: (
    layout: any,
    from: number,
    to: number,
    scrollTop: number,
    viewportWidth: number,
    textLength: number,
    layoutIndex: any
  ) => any[];
};

export const createRenderFrameSelection = ({
  queryEditorProp,
  docPosToTextOffset,
  selectionToRects,
}: CreateRenderFrameSelectionArgs) => {
  let lastSelectionRectsKey = "";
  let lastSelectionRects: any[] | null = null;
  let lastSelectionScrollTop = Number.NaN;
  let lastTableSelectionRectsKey = "";
  let lastTableSelectionRects: any[] | null = null;
  let lastTableSelectionScrollTop = Number.NaN;

  const resolveFallbackSelectionRects = ({
    geometry,
    layout,
    editorState,
    selection,
    scrollTop,
    viewportWidth,
    layoutIndex,
  }: {
    geometry: any;
    layout: any;
    editorState: any;
    selection: { from: number; to: number };
    scrollTop: number;
    viewportWidth: number;
    layoutIndex: any;
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

  const resolveSelectionGeometry = () => {
    const fromProps =
      typeof queryEditorProp === "function" ? queryEditorProp("selectionGeometry") : null;
    if (fromProps && typeof fromProps === "object") {
      return fromProps;
    }
    return null;
  };

  const resolveSpecialSelectionRects = ({
    layout,
    editorState,
    selection,
    layoutIndex,
    scrollTop,
    viewportWidth,
  }: {
    layout: any;
    editorState: any;
    selection: { from: number; to: number };
    layoutIndex: any;
    scrollTop: number;
    viewportWidth: number;
  }) => {
    const geometry = resolveSelectionGeometry();
    if (typeof geometry?.resolveSelectionRects === "function") {
      const resolved = geometry.resolveSelectionRects({
        layout,
        editorState,
        selection,
        scrollTop,
        viewportWidth,
        layoutIndex,
        docPosToTextOffset,
      });
      if (Array.isArray(resolved) && resolved.length > 0) {
        return resolved;
      }
    }

    const fallbackResolved = resolveFallbackSelectionRects({
      geometry,
      layout,
      editorState,
      selection,
      scrollTop,
      viewportWidth,
      layoutIndex,
    });
    if (Array.isArray(fallbackResolved) && fallbackResolved.length > 0) {
      return fallbackResolved;
    }

    return null;
  };

  const shouldComputeSpecialSelectionRects = (
    editorState: any,
    selection: { from: number; to: number }
  ) => {
    const geometry = resolveSelectionGeometry();
    const fromProps = geometry?.shouldComputeSelectionRects;
    if (typeof fromProps === "function") {
      return (
        fromProps({
          editorState,
          selection,
        }) === true
      );
    }
    return false;
  };

  const resolveSelectionRects = ({
    layout,
    layoutIndex,
    editorState,
    selection,
    textLength,
    layoutToken,
    isProgressive,
    scrollTop,
    viewportWidth,
  }: {
    layout: any;
    layoutIndex: any;
    editorState: any;
    selection: { from: number; to: number };
    textLength: number;
    layoutToken: number;
    isProgressive: boolean;
    scrollTop: number;
    viewportWidth: number;
  }) => {
    const selectionStart = now();
    const selectionRectsKey = `${layoutToken}|${selection.from}|${selection.to}|${viewportWidth}|${textLength}`;
    const canShiftSelectionRects =
      !isProgressive &&
      selectionRectsKey === lastSelectionRectsKey &&
      Array.isArray(lastSelectionRects) &&
      Number.isFinite(lastSelectionScrollTop);

    let selectionRects = canShiftSelectionRects
      ? lastSelectionRects!.map((rect) => ({
          ...rect,
          y: rect.y - (scrollTop - lastSelectionScrollTop),
        }))
      : selectionToRects(
          layout,
          selection.from,
          selection.to,
          scrollTop,
          viewportWidth,
          textLength,
          layoutIndex
        );

    lastSelectionRectsKey = selectionRectsKey;
    lastSelectionRects = selectionRects;
    lastSelectionScrollTop = scrollTop;
    const selectionMs = Math.round((now() - selectionStart) * 100) / 100;

    const tableSelectionStart = now();
    let tableSelectionRects = null;
    if (shouldComputeSpecialSelectionRects(editorState, selection)) {
      const geometry = resolveSelectionGeometry();
      const useBorderOnly = !!(
        geometry &&
        typeof geometry.shouldRenderBorderOnly === "function" &&
        geometry.shouldRenderBorderOnly({
          editorState,
          selection,
        }) === true
      );
      const tableSelectionKey = `${layoutToken}|${selection.from}|${selection.to}|${viewportWidth}|table`;
      const canShiftTableSelectionRects =
        tableSelectionKey === lastTableSelectionRectsKey &&
        Array.isArray(lastTableSelectionRects) &&
        Number.isFinite(lastTableSelectionScrollTop);
      tableSelectionRects = canShiftTableSelectionRects
        ? lastTableSelectionRects!.map((rect) => ({
            ...rect,
            y: rect.y - (scrollTop - lastTableSelectionScrollTop),
          }))
        : resolveSpecialSelectionRects({
            layout,
            editorState,
            selection,
            layoutIndex,
            scrollTop,
            viewportWidth,
          });
      if (useBorderOnly && Array.isArray(tableSelectionRects)) {
        tableSelectionRects = tableSelectionRects.map((rect) => ({
          ...rect,
          borderOnly: true,
        }));
      }
      lastTableSelectionRectsKey = tableSelectionKey;
      lastTableSelectionRects = tableSelectionRects;
      lastTableSelectionScrollTop = scrollTop;
    }
    if (Array.isArray(tableSelectionRects) && tableSelectionRects.length > 0) {
      selectionRects = tableSelectionRects;
    }
    const tableSelectionMs = Math.round((now() - tableSelectionStart) * 100) / 100;

    return {
      selectionRects,
      selectionMs,
      tableSelectionMs,
    };
  };

  return {
    resolveSelectionRects,
  };
};
