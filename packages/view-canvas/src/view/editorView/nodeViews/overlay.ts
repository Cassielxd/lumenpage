import { docPosToTextOffset } from "../../../core";
import { getLineAtOffset } from "../../layoutIndex";
import { collectAllLayoutBoxesForRange, resolveLayoutBoxRect } from "../../render/geometry";

export const createNodeViewOverlaySync = ({
  view,
  managerState,
  getState,
  getPreferredBlockIdFromLine,
}: {
  view: any;
  managerState: any;
  getState: () => any;
  getPreferredBlockIdFromLine: (line: any) => any;
}) => {
  const resolveNodeViewBoxRect = ({
    entry,
    layout,
    layoutIndex,
    scrollTop,
    viewportWidth,
    viewportHeight,
    doc,
  }: {
    entry: any;
    layout: any;
    layoutIndex: any;
    scrollTop: number;
    viewportWidth: number;
    viewportHeight: number;
    doc: any;
  }) => {
    if (!entry?.node || !Number.isFinite(entry?.pos) || !layout || !layoutIndex || !doc) {
      return null;
    }
    const fromOffset = docPosToTextOffset(doc, entry.pos);
    const endPos = Math.max(entry.pos, entry.pos + Math.max(1, entry.node.nodeSize ?? 1) - 1);
    const toOffset = docPosToTextOffset(doc, endPos);
    if (!Number.isFinite(fromOffset) || !Number.isFinite(toOffset)) {
      return null;
    }
    const minOffset = Math.min(fromOffset, toOffset);
    const maxOffset = Math.max(fromOffset, toOffset);
    const boxHits = collectAllLayoutBoxesForRange(layout, minOffset, maxOffset, {
      exact: true,
      layoutIndex,
      predicate: ({ box }: { box: any }) => {
        if (!box) {
          return false;
        }
        if (entry.blockId && (box?.blockId != null || box?.nodeId != null)) {
          return (
            String(box.blockId ?? "") === String(entry.blockId) ||
            String(box.nodeId ?? "") === String(entry.blockId)
          );
        }
        return String(box?.type || "") === String(entry.node?.type?.name || "");
      },
    });
    if (boxHits.length === 0) {
      return null;
    }

    let best = null;
    for (const hit of boxHits) {
      const rect = resolveLayoutBoxRect({
        layout,
        box: hit.box,
        pageIndex: hit.pageIndex,
        scrollTop,
        viewportWidth,
      });
      if (!rect) {
        continue;
      }
      const area = Math.max(1, rect.width * rect.height);
      const viewportBottom =
        Number.isFinite(viewportHeight) && Number(viewportHeight) > 0
          ? Number(viewportHeight)
          : null;
      const visibleOverlap =
        viewportBottom == null
          ? 0
          : Math.max(0, Math.min(rect.y + rect.height, viewportBottom) - Math.max(rect.y, 0));
      const distanceToViewport =
        viewportBottom == null
          ? Math.abs(rect.y)
          : rect.y + rect.height < 0
            ? Math.abs(rect.y + rect.height)
            : rect.y > viewportBottom
              ? Math.abs(rect.y - viewportBottom)
              : 0;
      if (
        !best ||
        visibleOverlap > best.visibleOverlap ||
        (visibleOverlap === best.visibleOverlap && distanceToViewport < best.distanceToViewport) ||
        (visibleOverlap === best.visibleOverlap &&
          distanceToViewport === best.distanceToViewport &&
          area < best.area)
      ) {
        best = {
          hit,
          rect,
          area,
          visibleOverlap,
          distanceToViewport,
        };
      }
    }
    if (!best) {
      return null;
    }

    return {
      ...best.rect,
      pageIndex: best.hit.pageIndex,
      box: best.hit.box,
    };
  };

  const getNodeViewForLine = (line: any) => {
    const blockId = getPreferredBlockIdFromLine(line);
    if (blockId && managerState.nodeViewsByBlockId.has(blockId)) {
      return managerState.nodeViewsByBlockId.get(blockId).view;
    }
    return null;
  };

  const getNodeViewAtCoords = ({
    coords,
    getDocPosFromCoords,
    docPosToTextOffset: docPosToTextOffsetImpl,
    layoutIndex,
  }: {
    coords: any;
    getDocPosFromCoords: (coords: any) => any;
    docPosToTextOffset: (doc: any, pos: number) => number;
    layoutIndex: any;
  }) => {
    if (!layoutIndex) {
      return null;
    }
    const state = getState();
    if (!state?.doc) {
      return null;
    }
    const layout = view?._internals?.getLayout?.() ?? null;
    const scrollArea = view?._internals?.dom?.scrollArea ?? null;
    if (layout && scrollArea) {
      let bestBoxEntry = null;
      let bestBoxArea = Number.POSITIVE_INFINITY;
      for (const entry of managerState.nodeViews.values()) {
        const rect = resolveNodeViewBoxRect({
          entry,
          layout,
          layoutIndex,
          scrollTop: scrollArea.scrollTop,
          viewportWidth: scrollArea.clientWidth,
          viewportHeight: scrollArea.clientHeight,
          doc: state.doc,
        });
        if (!rect) {
          continue;
        }
        const withinX = coords.x >= rect.x && coords.x <= rect.x + rect.width;
        const withinY = coords.y >= rect.y && coords.y <= rect.y + rect.height;
        if (!withinX || !withinY) {
          continue;
        }
        const area = Math.max(1, rect.width * rect.height);
        if (!bestBoxEntry || area <= bestBoxArea) {
          bestBoxEntry = entry;
          bestBoxArea = area;
        }
      }
      if (bestBoxEntry?.view) {
        return bestBoxEntry.view;
      }
    }
    const pos = getDocPosFromCoords(coords);
    if (!Number.isFinite(pos)) {
      return null;
    }
    const offset = docPosToTextOffsetImpl(state.doc, pos);
    const lineItem = getLineAtOffset(layoutIndex, offset);
    const blockId = getPreferredBlockIdFromLine(lineItem?.line);
    if (blockId) {
      const fromBlockId = managerState.nodeViewsByBlockId.get(blockId)?.view ?? null;
      if (fromBlockId) {
        return fromBlockId;
      }
    }
    let fallback = null;
    for (const entry of managerState.nodeViews.values()) {
      if (!entry?.node || !Number.isFinite(entry?.pos)) {
        continue;
      }
      const from = entry.pos;
      const to = entry.pos + (entry.node.nodeSize ?? 0);
      if (pos >= from && pos <= to) {
        if (!fallback) {
          fallback = entry;
          continue;
        }
        const currentSize = fallback.node?.nodeSize ?? Number.MAX_SAFE_INTEGER;
        const nextSize = entry.node?.nodeSize ?? Number.MAX_SAFE_INTEGER;
        if (nextSize <= currentSize) {
          fallback = entry;
        }
      }
    }
    return fallback?.view ?? null;
  };

  const syncNodeViewOverlays = ({
    layout,
    layoutIndex,
    scrollArea,
  }: {
    layout: any;
    layoutIndex: any;
    scrollArea: any;
  }) => {
    if (!layout || !layoutIndex || managerState.nodeViews.size === 0) {
      return;
    }
    const state = getState();
    if (!state?.doc) {
      return;
    }
    const scrollTop = scrollArea.scrollTop;
    const viewportWidth = scrollArea.clientWidth;
    const viewportHeight = scrollArea.clientHeight;
    const pageSpan = layout.pageHeight + layout.pageGap;
    const pageX = Math.max(0, (viewportWidth - layout.pageWidth) / 2);
    const syncOverlayEntry = (entry: any, item: any = null, boxRect: any = null) => {
      if (!entry?.view) {
        return false;
      }
      if (!item && !boxRect) {
        entry.view.syncDOM?.({ visible: false });
        return false;
      }
      const line = item?.line ?? null;
      const pageIndex = Number.isFinite(boxRect?.pageIndex)
        ? Number(boxRect.pageIndex)
        : item?.pageIndex ?? 0;
      const pageTop = pageIndex * pageSpan - scrollTop;
      const x = boxRect?.x ?? pageX + (line?.x ?? 0);
      const y = boxRect?.y ?? pageTop + (line?.y ?? 0);
      const width =
        boxRect?.width ??
        (Number.isFinite(line?.width)
          ? line.width
          : layout.pageWidth - layout.margin.left - layout.margin.right);
      const height =
        boxRect?.height ??
        (Number.isFinite(line?.lineHeight) ? line.lineHeight : layout.lineHeight);
      const visible = y + height > 0 && y < viewportHeight;
      entry.view.syncDOM?.({ x, y, width, height, visible, line, pageIndex, layout });
      return visible;
    };

    const nextVisibleOverlayKeys = new Set<string>();
    for (const entry of managerState.nodeViews.values()) {
      const boxRect = resolveNodeViewBoxRect({
        entry,
        layout,
        layoutIndex,
        scrollTop,
        viewportWidth,
        viewportHeight,
        doc: state.doc,
      });
      let item = null;
      if (Number.isFinite(entry?.pos)) {
        const offset = docPosToTextOffset(state.doc, entry.pos);
        item = getLineAtOffset(layoutIndex, offset);
      }
      const visible = syncOverlayEntry(entry, item, boxRect);
      if (visible) {
        nextVisibleOverlayKeys.add(entry.key);
      }
    }

    for (const key of managerState.lastVisibleOverlayKeys) {
      if (nextVisibleOverlayKeys.has(key)) {
        continue;
      }
      const entry = managerState.nodeViews.get(key);
      entry?.view?.syncDOM?.({ visible: false });
    }
    managerState.lastVisibleOverlayKeys = nextVisibleOverlayKeys;
  };

  return {
    getNodeViewForLine,
    getNodeViewAtCoords,
    syncNodeViewOverlays,
  };
};
