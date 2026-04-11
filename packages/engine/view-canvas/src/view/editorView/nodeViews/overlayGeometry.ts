import { docPosToTextOffset } from "../../../core/index.js";
import { collectAllLayoutBoxesForRange, resolveLayoutBoxRect } from "../../render/geometry.js";
import {
  chooseBestNodeViewBoxCandidate,
  getNodeViewEntryPos,
  getOverlayRectArea,
  hasVisualBlockCapability,
  isTextLineBox,
  requiresBoxAnchoredOverlay,
  resolveExpectedOverlaySize,
} from "./overlayGeometryHeuristics.js";

export { getNodeViewEntryPos, requiresBoxAnchoredOverlay, resolveExpectedOverlaySize };

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
  if (!requiresBoxAnchoredOverlay(entry) || !layout) {
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
        pageIndex,
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

export const resolveNodeViewBoxRect = ({
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
    const area = getOverlayRectArea(rect);
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

  const { best: resolvedBest, comparableCandidates } = chooseBestNodeViewBoxCandidate({
    candidates,
    expectedSize,
  });
  best = resolvedBest;
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
