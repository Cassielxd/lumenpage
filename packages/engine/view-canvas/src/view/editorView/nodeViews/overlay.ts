import { docPosToTextOffset } from "../../../core";
import { emitGhostTrace } from "../../debugTrace";
import { getLineAtOffset } from "../../layoutIndex";
import { getLayoutVersion } from "../../layoutRuntimeMetadata";
import { collectAllLayoutBoxesForRange, resolveLayoutBoxRect } from "../../render/geometry";
import { getEditorInternalsSections } from "../internals";

const TEXT_LINE_FRAGMENT_ROLE = "text-line";

const isTextLineBox = (box: any) =>
  String(box?.role || "") === TEXT_LINE_FRAGMENT_ROLE ||
  String(box?.type || "") === TEXT_LINE_FRAGMENT_ROLE;

const hasVisualBlockCapability = (box: any) => {
  const capabilities = box?.layoutCapabilities ?? box?.blockAttrs?.layoutCapabilities;
  return capabilities?.["visual-block"] === true;
};

const VISUAL_BLOCK_NODE_TYPES = new Set([
  "image",
  "video",
  "audio",
  "embedPanel",
  "file",
  "bookmark",
  "signature",
  "webPage",
]);

const requiresBoxAnchoredOverlay = (entry: any) =>
  VISUAL_BLOCK_NODE_TYPES.has(String(entry?.node?.type?.name || ""));

const resolveLayoutVersionToken = (layout: any) => getLayoutVersion(layout);

const canReuseCachedOverlayState = ({
  cached,
  scrollTop,
  viewportWidth,
  layoutVersion,
}: {
  cached: any;
  scrollTop: number;
  viewportWidth: number;
  layoutVersion: number | null;
}) => {
  if (!cached) {
    return false;
  }
  if (
    !Number.isFinite(cached?.x) ||
    !Number.isFinite(cached?.y) ||
    !Number.isFinite(cached?.width) ||
    !Number.isFinite(cached?.height) ||
    !Number.isFinite(cached?.scrollTop) ||
    !Number.isFinite(cached?.viewportWidth)
  ) {
    return false;
  }
  if (Math.abs(Number(viewportWidth) - Number(cached.viewportWidth)) > 1) {
    return false;
  }
  if (
    layoutVersion != null &&
    Number.isFinite(cached?.layoutVersion) &&
    Number(cached.layoutVersion) !== layoutVersion
  ) {
    return false;
  }
  return Math.abs(Number(scrollTop) - Number(cached.scrollTop)) <= Math.max(64, Number(cached.height));
};

const shouldEmitNodeOverlayTrace = ({
  entry,
  boxRect,
  line,
  visible,
  reason,
}: {
  entry: any;
  boxRect?: any;
  line?: any;
  visible?: boolean;
  reason?: string | null;
}) => {
  const nodeType = String(entry?.node?.type?.name || "");
  if (VISUAL_BLOCK_NODE_TYPES.has(nodeType)) {
    return true;
  }
  if (reason) {
    return true;
  }
  const debugOverlay = boxRect?.debugOverlay ?? null;
  if (!boxRect || !debugOverlay) {
    return true;
  }
  if (visible === true && String(nodeType) !== "paragraph") {
    return true;
  }
  if (
    Number(debugOverlay.directBlockHitCount || 0) !== 1 ||
    Number(debugOverlay.exactRangeHitCount || 0) > 0 ||
    Number(debugOverlay.overlapRangeHitCount || 0) > 0 ||
    Number(debugOverlay.visualBlockTypeHitCount || 0) > 0 ||
    Number(debugOverlay.candidateCount || 0) > 1 ||
    Number(debugOverlay.comparableCandidateCount || 0) > 1 ||
    Number(debugOverlay.chosenSizeMismatch || 0) > 0
  ) {
    return true;
  }
  const entryBlockId = String(entry?.blockId || "");
  const lineBlockId = String(line?.blockId || "");
  const boxBlockId = String(boxRect?.box?.blockId ?? boxRect?.box?.nodeId ?? "");
  if ((lineBlockId && lineBlockId !== entryBlockId) || (boxBlockId && boxBlockId !== entryBlockId)) {
    return true;
  }
  return false;
};

const readPositiveDimension = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
};

const resolveExpectedOverlaySize = (entry: any, layout: any) => {
  const attrs = entry?.node?.attrs ?? null;
  const rawWidth = readPositiveDimension(attrs?.width);
  const rawHeight = readPositiveDimension(attrs?.height);
  if (!rawWidth || !rawHeight) {
    return null;
  }
  const pageWidth = readPositiveDimension(layout?.pageWidth);
  const marginLeft = readPositiveDimension(layout?.margin?.left) ?? 0;
  const marginRight = readPositiveDimension(layout?.margin?.right) ?? 0;
  const maxWidth =
    pageWidth != null ? Math.max(1, pageWidth - marginLeft - marginRight) : rawWidth;
  const width = Math.min(rawWidth, maxWidth);
  const height = rawHeight;
  return { width, height };
};

const getBoxArea = (rect: any) => Math.max(1, Number(rect?.width || 0) * Number(rect?.height || 0));

const compareNodeViewBoxCandidate = (next: any, best: any) => {
  if (!best) {
    return true;
  }
  const nextVisualSizeScore = next.visualBlock ? next.sizeMismatch : Number.POSITIVE_INFINITY;
  const bestVisualSizeScore = best.visualBlock ? best.sizeMismatch : Number.POSITIVE_INFINITY;
  if (nextVisualSizeScore !== bestVisualSizeScore) {
    return nextVisualSizeScore < bestVisualSizeScore;
  }
  if (next.visibleOverlap !== best.visibleOverlap) {
    return next.visibleOverlap > best.visibleOverlap;
  }
  if (next.distanceToViewport !== best.distanceToViewport) {
    return next.distanceToViewport < best.distanceToViewport;
  }
  if (next.sizeMismatch !== best.sizeMismatch) {
    return next.sizeMismatch < best.sizeMismatch;
  }
  if (next.visualBlock !== best.visualBlock) {
    return next.visualBlock;
  }
  if (next.depth !== best.depth) {
    return next.depth < best.depth;
  }
  if (next.area !== best.area) {
    return next.area > best.area;
  }
  return false;
};

const getNodeViewEntryPos = (entry: any) => {
  const livePos = entry?.getPos?.();
  if (Number.isFinite(livePos)) {
    return Number(livePos);
  }
  return Number.isFinite(entry?.pos) ? Number(entry.pos) : null;
};

const matchesNodeViewBlockBox = (entry: any, box: any) => {
  if (!box || !entry?.blockId) {
    return false;
  }
  return (
    String(box?.blockId ?? "") === String(entry.blockId) ||
    String(box?.nodeId ?? "") === String(entry.blockId)
  );
};

const matchesNodeViewRangeBox = (entry: any, box: any) => {
  if (!box) {
    return false;
  }
  if (entry?.blockId && (box?.blockId != null || box?.nodeId != null)) {
    return matchesNodeViewBlockBox(entry, box);
  }
  return String(box?.type || "") === String(entry?.node?.type?.name || "");
};

const walkPageBoxes = (
  boxes: any[],
  visitor: (entry: { box: any; pageIndex: number; depth: number; parent: any }) => void,
  pageIndex: number,
  parent: any = null,
  depth = 0,
) => {
  if (!Array.isArray(boxes) || boxes.length === 0) {
    return;
  }
  for (const box of boxes) {
    if (!box) {
      continue;
    }
    visitor({ box, pageIndex, depth, parent });
    if (Array.isArray(box.children) && box.children.length > 0) {
      walkPageBoxes(box.children, visitor, pageIndex, box, depth + 1);
    }
  }
};

const collectNodeViewBlockBoxHits = ({
  entry,
  layout,
  layoutIndex,
}: {
  entry: any;
  layout: any;
  layoutIndex: any;
}) => {
  if (!entry?.blockId || !layout) {
    return [];
  }

  const hits: Array<{ box: any; pageIndex: number; depth: number; parent: any }> = [];
  const indexedBoxes = Array.isArray(layoutIndex?.boxes) ? layoutIndex.boxes : null;

  if (indexedBoxes && indexedBoxes.length > 0) {
    for (const item of indexedBoxes) {
      if (!matchesNodeViewBlockBox(entry, item?.box)) {
        continue;
      }
      hits.push({
        box: item.box,
        pageIndex: Number(item?.pageIndex) || 0,
        depth: Number(item?.depth) || 0,
        parent: null,
      });
    }
  }

  if (hits.length === 0) {
    const pages = Array.isArray(layout?.pages) ? layout.pages : [];
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
      walkPageBoxes(pages[pageIndex]?.boxes ?? [], (hit) => {
        if (!matchesNodeViewBlockBox(entry, hit.box)) {
          return;
        }
        hits.push(hit);
      }, pageIndex);
    }
  }

  if (hits.length === 0) {
    return hits;
  }

  const deduped = new Map<string, { box: any; pageIndex: number; depth: number; parent: any }>();
  for (const hit of hits) {
    const key = `${hit.pageIndex}:${String(hit?.box?.key || "")}:${String(hit?.box?.blockId || hit?.box?.nodeId || "")}:${hit.depth}`;
    if (!deduped.has(key)) {
      deduped.set(key, hit);
    }
  }

  const nextHits = Array.from(deduped.values());
  const nonTextLineHits = nextHits.filter((hit) => !isTextLineBox(hit.box));
  return (nonTextLineHits.length > 0 ? nonTextLineHits : nextHits).sort((a, b) => {
    if (a.pageIndex !== b.pageIndex) {
      return a.pageIndex - b.pageIndex;
    }
    return a.depth - b.depth;
  });
};

const collectVisualBlockTypeBoxHits = ({
  entry,
  layout,
  layoutIndex,
}: {
  entry: any;
  layout: any;
  layoutIndex: any;
}) => {
  const nodeType = String(entry?.node?.type?.name || "");
  if (!VISUAL_BLOCK_NODE_TYPES.has(nodeType) || !layout) {
    return [];
  }

  const hits: Array<{ box: any; pageIndex: number; depth: number; parent: any }> = [];
  const indexedBoxes = Array.isArray(layoutIndex?.boxes) ? layoutIndex.boxes : null;

  const matchBox = (box: any) =>
    !!box &&
    String(box?.type || "") === nodeType &&
    hasVisualBlockCapability(box);

  if (indexedBoxes && indexedBoxes.length > 0) {
    for (const item of indexedBoxes) {
      if (!matchBox(item?.box)) {
        continue;
      }
      hits.push({
        box: item.box,
        pageIndex: Number(item?.pageIndex) || 0,
        depth: Number(item?.depth) || 0,
        parent: null,
      });
    }
  }

  if (hits.length === 0) {
    const pages = Array.isArray(layout?.pages) ? layout.pages : [];
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
      walkPageBoxes(
        pages[pageIndex]?.boxes ?? [],
        (hit) => {
          if (!matchBox(hit.box)) {
            return;
          }
          hits.push(hit);
        },
        pageIndex
      );
    }
  }

  return hits.sort((a, b) => {
    if (a.pageIndex !== b.pageIndex) {
      return a.pageIndex - b.pageIndex;
    }
    return a.depth - b.depth;
  });
};

export const createNodeViewOverlaySync = ({
  view,
  managerState,
  getState,
  getPreferredBlockIdFromLine,
  getPendingChangeSummary,
}: {
  view: any;
  managerState: any;
  getState: () => any;
  getPreferredBlockIdFromLine: (line: any) => any;
  getPendingChangeSummary?: () => any;
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
    const entryPos = getNodeViewEntryPos(entry);
    if (!entry?.node || !layout || !layoutIndex) {
      return null;
    }
    const directBlockHits = collectNodeViewBlockBoxHits({
      entry,
      layout,
      layoutIndex,
    });
    const visualBlockTypeHits =
      directBlockHits.length === 0
        ? collectVisualBlockTypeBoxHits({
            entry,
            layout,
            layoutIndex,
          })
        : [];
    const shouldRequireBox = requiresBoxAnchoredOverlay(entry);
    let exactRangeHits: any[] = [];
    let overlapRangeHits: any[] = [];

    if (directBlockHits.length === 0 && visualBlockTypeHits.length === 0 && !shouldRequireBox) {
      if (!Number.isFinite(entryPos) || !doc) {
        return null;
      }
      const fromOffset = docPosToTextOffset(doc, entryPos);
      const endPos = Math.max(entryPos, entryPos + Math.max(1, entry.node.nodeSize ?? 1) - 1);
      const toOffset = docPosToTextOffset(doc, endPos);
      if (!Number.isFinite(fromOffset) || !Number.isFinite(toOffset)) {
        return null;
      }
      const minOffset = Math.min(fromOffset, toOffset);
      const maxOffset = Math.max(fromOffset, toOffset);
      exactRangeHits = collectAllLayoutBoxesForRange(layout, minOffset, maxOffset, {
        exact: true,
        layoutIndex,
        predicate: ({ box }: { box: any }) => {
          return matchesNodeViewRangeBox(entry, box);
        },
      });
      overlapRangeHits =
        exactRangeHits.length > 0
          ? []
          : collectAllLayoutBoxesForRange(layout, minOffset, maxOffset, {
              exact: false,
              layoutIndex,
              predicate: ({ box }: { box: any }) => matchesNodeViewRangeBox(entry, box),
            });
    }
    const boxHits =
      directBlockHits.length > 0
        ? directBlockHits
        : visualBlockTypeHits.length > 0
          ? visualBlockTypeHits
          : exactRangeHits.length > 0
          ? exactRangeHits
          : overlapRangeHits.length > 0
            ? overlapRangeHits
            : [];
    if (boxHits.length === 0) {
      return null;
    }

    const visualBlockHits = boxHits.filter((hit) => hasVisualBlockCapability(hit?.box));
    const prioritizedBoxHits = visualBlockHits.length > 0 ? visualBlockHits : boxHits;

    let best = null;
    const expectedSize = resolveExpectedOverlaySize(entry, layout);
    const candidates = [];
    for (const hit of prioritizedBoxHits) {
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
      const area = getBoxArea(rect);
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
      const candidate = {
        hit,
        rect,
        area,
        visibleOverlap,
        distanceToViewport,
        sizeMismatch:
          expectedSize == null
            ? 0
            : Math.abs(rect.width - expectedSize.width) + Math.abs(rect.height - expectedSize.height),
        depth: Number(hit?.depth) || 0,
        visualBlock: hasVisualBlockCapability(hit?.box),
      };
      candidates.push(candidate);
    }

    if (candidates.length === 0) {
      return null;
    }

    const comparableCandidates =
      expectedSize == null
        ? candidates
        : (() => {
            const minMismatch = Math.min(...candidates.map((candidate) => candidate.sizeMismatch));
            const sizeMatchedCandidates = candidates.filter(
              (candidate) => candidate.sizeMismatch <= minMismatch + 4,
            );
            return sizeMatchedCandidates.length > 0 ? sizeMatchedCandidates : candidates;
          })();

    for (const candidate of comparableCandidates) {
      if (compareNodeViewBoxCandidate(candidate, best)) {
        best = {
          ...candidate,
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
      debugOverlay: {
        directBlockHitCount: directBlockHits.length,
        exactRangeHitCount: exactRangeHits.length,
        overlapRangeHitCount: overlapRangeHits.length,
        visualBlockTypeHitCount: visualBlockTypeHits.length,
        prioritizedHitCount: prioritizedBoxHits.length,
        candidateCount: candidates.length,
        comparableCandidateCount: comparableCandidates.length,
        chosenSizeMismatch: Number.isFinite(best.sizeMismatch) ? Number(best.sizeMismatch) : null,
        chosenVisibleOverlap: Number.isFinite(best.visibleOverlap)
          ? Number(best.visibleOverlap)
          : null,
        chosenDistanceToViewport: Number.isFinite(best.distanceToViewport)
          ? Number(best.distanceToViewport)
          : null,
        expectedWidth: expectedSize?.width ?? null,
        expectedHeight: expectedSize?.height ?? null,
      },
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
    const { core, stateAccessors } = getEditorInternalsSections(view);
    const layout = stateAccessors?.getLayout?.() ?? null;
    const scrollArea = core?.dom?.scrollArea ?? null;
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
    const { core } = getEditorInternalsSections(view);
    const settings = core?.settings ?? null;
    const hasPendingDocLayout = getPendingChangeSummary?.()?.docChanged === true;
    const currentLayoutVersion = resolveLayoutVersionToken(layout);
    const syncOverlayEntry = (entry: any, item: any = null, boxRect: any = null) => {
      if (!entry?.view) {
        return false;
      }
      if (!item && !boxRect) {
        const cachedOverlayState = managerState.lastOverlayStateByKey.get(entry.key) ?? null;
        if (
          requiresBoxAnchoredOverlay(entry) &&
          canReuseCachedOverlayState({
            cached: cachedOverlayState,
            scrollTop,
            viewportWidth,
            layoutVersion: currentLayoutVersion,
          })
        ) {
          const scrollDelta = scrollTop - Number(cachedOverlayState.scrollTop);
          const cachedY = Number(cachedOverlayState.y) - scrollDelta;
          const cachedVisible =
            cachedY + Number(cachedOverlayState.height) > 0 && cachedY < viewportHeight;
          if (shouldEmitNodeOverlayTrace({ entry, reason: "reuse-last-box-geometry" })) {
            emitGhostTrace(
              "node-overlay-box",
              {
                key: entry?.key ?? null,
                blockId: entry?.blockId ?? null,
                nodeType: entry?.node?.type?.name ?? null,
                visible: cachedVisible,
                reason: "reuse-last-box-geometry",
                cachedLayoutVersion: cachedOverlayState.layoutVersion ?? null,
                cachedPageIndex: cachedOverlayState.pageIndex ?? null,
              },
              settings
            );
          }
          entry.view.syncDOM?.({
            x: cachedOverlayState.x,
            y: cachedY,
            width: cachedOverlayState.width,
            height: cachedOverlayState.height,
            visible: cachedVisible,
            pageIndex: cachedOverlayState.pageIndex ?? null,
            layout,
          });
          return cachedVisible;
        }
        if (requiresBoxAnchoredOverlay(entry) && hasPendingDocLayout) {
          const preservedVisible = managerState.lastVisibleOverlayKeys.has(entry.key);
          if (shouldEmitNodeOverlayTrace({ entry, reason: "defer-missing-box-pending-layout" })) {
            emitGhostTrace(
              "node-overlay-box",
              {
                key: entry?.key ?? null,
                blockId: entry?.blockId ?? null,
                nodeType: entry?.node?.type?.name ?? null,
                visible: preservedVisible,
                reason: "defer-missing-box-pending-layout",
              },
              settings
            );
          }
          return preservedVisible;
        }
        managerState.lastOverlayStateByKey.delete(entry.key);
        if (shouldEmitNodeOverlayTrace({ entry, reason: "no-box-or-line" })) {
          emitGhostTrace(
            "node-overlay-box",
            {
              key: entry?.key ?? null,
              blockId: entry?.blockId ?? null,
              nodeType: entry?.node?.type?.name ?? null,
              visible: false,
              reason: "no-box-or-line",
            },
            settings
          );
        }
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
      const expectedSize = resolveExpectedOverlaySize(entry, layout);
      const nextWidth = expectedSize?.width ?? width;
      const nextHeight = expectedSize?.height ?? height;
      const visible = y + nextHeight > 0 && y < viewportHeight;
      if (shouldEmitNodeOverlayTrace({ entry, boxRect, line, visible })) {
        emitGhostTrace(
          "node-overlay-box",
          {
            key: entry?.key ?? null,
            blockId: entry?.blockId ?? null,
            nodeType: entry?.node?.type?.name ?? null,
            entryPos: getNodeViewEntryPos(entry),
            lineBlockId: line?.blockId ?? null,
            lineBlockType: line?.blockType ?? null,
            pageIndex,
            visible,
            usedBoxRect: !!boxRect,
            x,
            y,
            width: nextWidth,
            height: nextHeight,
            expectedWidth: expectedSize?.width ?? null,
            expectedHeight: expectedSize?.height ?? null,
            fallbackLineWidth: Number.isFinite(line?.width) ? Number(line.width) : null,
            fallbackLineHeight: Number.isFinite(line?.lineHeight) ? Number(line.lineHeight) : null,
            boxKey: boxRect?.box?.key ?? null,
            boxRole: boxRect?.box?.role ?? null,
            boxType: boxRect?.box?.type ?? null,
            boxBlockId: boxRect?.box?.blockId ?? boxRect?.box?.nodeId ?? null,
            boxPageIndex: Number.isFinite(boxRect?.pageIndex) ? Number(boxRect.pageIndex) : null,
            debugOverlay: boxRect?.debugOverlay ?? null,
          },
          settings
        );
      }
      entry.view.syncDOM?.({
        x,
        y,
        width: nextWidth,
        height: nextHeight,
        visible,
        line,
        pageIndex,
        layout,
      });
      if (requiresBoxAnchoredOverlay(entry) && boxRect) {
        managerState.lastOverlayStateByKey.set(entry.key, {
          x,
          y,
          width: nextWidth,
          height: nextHeight,
          visible,
          pageIndex,
          scrollTop,
          viewportWidth,
          layoutVersion: currentLayoutVersion,
        });
      }
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
      if (!requiresBoxAnchoredOverlay(entry)) {
        const entryPos = getNodeViewEntryPos(entry);
        if (Number.isFinite(entryPos)) {
          const offset = docPosToTextOffset(state.doc, entryPos);
          item = getLineAtOffset(layoutIndex, offset);
        }
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
