import { docPosToTextOffset } from "../../../core/index.js";
import { emitGhostTrace } from "../../debugTrace.js";
import { getLineAtOffset } from "../../layoutIndex.js";
import { getLayoutVersion } from "../../layoutRuntimeMetadata.js";
import { getEditorInternalsSections } from "../internals.js";
import {
  getNodeViewEntryPos,
  requiresBoxAnchoredOverlay,
  resolveNodeViewBoxRect,
} from "./overlayGeometry.js";
import { resolveNodeViewEntryAtCoords } from "./overlayHitTesting.js";
import { findNodeViewEntryAtDocPos } from "./overlayHitTestingHeuristics.js";
import { syncNodeViewOverlayEntry } from "./overlayEntrySync.js";
import { resolveNodeViewOverlaySyncTarget } from "./overlayEntryTarget.js";
import { commitNodeViewOverlayVisibility } from "./overlayVisibilityCommit.js";

const resolveLayoutVersionToken = (layout: any) => getLayoutVersion(layout);

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
    const resolvedEntry = resolveNodeViewEntryAtCoords({
      entries: managerState.nodeViews.values(),
      nodeViewsByBlockId: managerState.nodeViewsByBlockId,
      coords,
      getDocPosFromCoords,
      docPosToTextOffset: docPosToTextOffsetImpl,
      getPreferredBlockIdFromLine,
      getLineAtOffset,
      layout,
      layoutIndex,
      scrollTop: scrollArea?.scrollTop ?? 0,
      viewportWidth: scrollArea?.clientWidth ?? 0,
      viewportHeight: scrollArea?.clientHeight ?? 0,
      doc: state.doc,
      resolveNodeViewBoxRect,
      findNodeViewEntryAtDocPos,
    });
    return resolvedEntry?.view ?? null;
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
    const { core } = getEditorInternalsSections(view);
    const settings = core?.settings ?? null;
    const hasPendingDocLayout = getPendingChangeSummary?.()?.docChanged === true;
    const currentLayoutVersion = resolveLayoutVersionToken(layout);
    const emitTrace = (payload: any) => emitGhostTrace("node-overlay-box", payload, settings);

    const nextVisibleOverlayKeys = new Set<string>();
    for (const entry of managerState.nodeViews.values()) {
      const { boxRect, item } = resolveNodeViewOverlaySyncTarget({
        entry,
        layout,
        layoutIndex,
        scrollTop,
        viewportWidth,
        viewportHeight,
        doc: state.doc,
        docPosToTextOffset,
        getLineAtOffset,
        getNodeViewEntryPos,
        requiresBoxAnchoredOverlay,
        resolveNodeViewBoxRect,
      });
      const visible = syncNodeViewOverlayEntry({
        entry,
        item,
        boxRect,
        layout,
        scrollTop,
        viewportWidth,
        viewportHeight,
        hasPendingDocLayout,
        currentLayoutVersion,
        lastVisibleOverlayKeys: managerState.lastVisibleOverlayKeys,
        lastOverlayStateByKey: managerState.lastOverlayStateByKey,
        emitTrace,
      });
      if (visible) {
        nextVisibleOverlayKeys.add(entry.key);
      }
    }

    managerState.lastVisibleOverlayKeys = commitNodeViewOverlayVisibility({
      nodeViews: managerState.nodeViews,
      lastVisibleOverlayKeys: managerState.lastVisibleOverlayKeys,
      nextVisibleOverlayKeys,
    });
  };

  return {
    getNodeViewForLine,
    getNodeViewAtCoords,
    syncNodeViewOverlays,
  };
};
