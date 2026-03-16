import { bindViewDomEvents } from "./events/domBindings";
import { createNodeEventRouting } from "./events/nodeEventRouting";
import { createViewportSyncScheduler } from "./events/viewportSync";

export const createViewEventHandlers = ({
  getState,
  hasFocus,
  getEventCoords,
  getDocPosFromCoords,
  dispatchEditorProp,
  handleNodeViewClick,
  consumeSkipNextClickSelection,
  focusInput,
  debugLog,
  updateStatus,
  updateCaret,
  scheduleRender,
  eventTiming = false,
}: {
  getState: () => any;
  hasFocus: () => boolean;
  getEventCoords: (event: any) => any;
  getDocPosFromCoords: (coords: any) => any;
  dispatchEditorProp: (name: any, ...args: any[]) => boolean;
  handleNodeViewClick: (event: any, handlerName: any) => boolean;
  consumeSkipNextClickSelection: () => boolean;
  focusInput: () => void;
  debugLog: (...args: any[]) => void;
  updateStatus: () => void;
  updateCaret: (updatePreferred: boolean) => void;
  scheduleRender: () => void;
  eventTiming?: boolean;
}) => {
  const nodeEventRouting = createNodeEventRouting({
    getState,
    getEventCoords,
    getDocPosFromCoords,
    dispatchEditorProp,
    handleNodeViewClick,
    consumeSkipNextClickSelection,
    focusInput,
    debugLog,
    eventTiming,
  });

  const viewportSync = createViewportSyncScheduler({
    hasFocus,
    updateStatus,
    updateCaret,
    scheduleRender,
    eventTiming,
  });

  return {
    ...nodeEventRouting,
    onDocumentSelectionChange: viewportSync.onDocumentSelectionChange,
    onScroll: viewportSync.onScroll,
    onResize: viewportSync.onResize,
    destroy: viewportSync.destroy,
  };
};

export { bindViewDomEvents };
