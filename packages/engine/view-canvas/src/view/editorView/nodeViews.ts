import {
  getDocTopLevelBlockIndex,
  getNodeViewKey,
  getPosByBlockId,
  getPreferredBlockIdFromLine,
  lineHasTextContent,
  resolveNodeViewEntry,
  resolveSelectableAtResolvedPos,
} from "./nodeViews/helpers.js";
import { createNodeViewDocumentSync } from "./nodeViews/documentSync.js";
import { createNodeViewOverlaySync } from "./nodeViews/overlay.js";
import { createNodeViewSelectionHandlers } from "./nodeViews/selection.js";
import { createNodeViewManagerState } from "./nodeViews/state.js";

export const createNodeViewManager = ({
  view,
  getState,
  getPendingChangeSummary,
  nodeRegistry,
  getNodeViewFactories,
  getDecorations,
  getDefaultNodeSelectionTypes,
  logNodeSelection,
}: {
  view: any;
  getState: () => any;
  getPendingChangeSummary?: () => any;
  nodeRegistry: any;
  getNodeViewFactories?: () => any;
  getDecorations?: () => any;
  getDefaultNodeSelectionTypes: () => Set<string> | null;
  logNodeSelection?: (...args: any[]) => void;
}) => {
  const managerState = createNodeViewManagerState();
  const getDocTopLevelBlockIndexForDoc = (doc: any) => getDocTopLevelBlockIndex(managerState, doc);
  const resolvePosByBlockId = (blockId: any) =>
    getPosByBlockId({
      blockId,
      getState,
      nodeViewsByBlockId: managerState.nodeViewsByBlockId,
      getDocTopLevelBlockIndexForDoc,
    });

  const overlaySync = createNodeViewOverlaySync({
    view,
    managerState,
    getState,
    getPreferredBlockIdFromLine,
    getPendingChangeSummary,
  });

  const selectionHandlers = createNodeViewSelectionHandlers({
    managerState,
    getState,
    getDefaultNodeSelectionTypes,
    logNodeSelection,
    getPreferredBlockIdFromLine,
    lineHasTextContent,
    getPosByBlockId: resolvePosByBlockId,
    resolveSelectableAtResolvedPos,
    getNodeViewAtCoords: overlaySync.getNodeViewAtCoords,
    resolveNodeViewEntry: (nodeView: any) => resolveNodeViewEntry(managerState.nodeViews, nodeView),
  });

  const documentSync = createNodeViewDocumentSync({
    view,
    managerState,
    getState,
    nodeRegistry,
    getNodeViewFactories,
    getDecorations,
    getPosByBlockId: resolvePosByBlockId,
    getDocTopLevelBlockIndexForDoc,
    getNodeViewKey,
    syncNodeViewSelection: selectionHandlers.syncNodeViewSelection,
  });

  return {
    getNodeViewForLine: overlaySync.getNodeViewForLine,
    syncNodeViewOverlays: overlaySync.syncNodeViewOverlays,
    syncNodeViews: documentSync.syncNodeViews,
    destroyNodeViews: documentSync.destroyNodeViews,
    resolveNodeSelectionTarget: selectionHandlers.resolveNodeSelectionTarget,
    handleNodeViewClick: selectionHandlers.handleNodeViewClick,
    setSkipNextClickSelection: selectionHandlers.setSkipNextClickSelection,
    consumeSkipNextClickSelection: selectionHandlers.consumeSkipNextClickSelection,
  };
};
