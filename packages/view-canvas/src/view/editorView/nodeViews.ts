import {
  getDocTopLevelBlockIndex,
  getNodeViewKey,
  getPosByBlockId,
  getPreferredBlockIdFromLine,
  lineHasTextContent,
  resolveNodeViewEntry,
  resolveSelectableAtResolvedPos,
} from "./nodeViews/helpers";
import { createNodeViewDocumentSync } from "./nodeViews/documentSync";
import { createNodeViewOverlaySync } from "./nodeViews/overlay";
import { createNodeViewSelectionHandlers } from "./nodeViews/selection";
import { createNodeViewManagerState } from "./nodeViews/state";

export const createNodeViewManager = ({
  view,
  getState,
  nodeRegistry,
  getNodeViewFactories,
  getDecorations,
  getDefaultNodeSelectionTypes,
  logNodeSelection,
}: {
  view: any;
  getState: () => any;
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
