const now = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

const logEventTiming = (_enabled: boolean, _name: string, _startedAt: number) => {};

export const dispatchNodeEventChain = (
  state: any,
  dispatchEditorProp: (name: any, ...args: any[]) => boolean,
  propName: string,
  pos: any,
  event: any
) => {
  if (!Number.isFinite(pos) || !state?.doc) {
    return false;
  }
  const docSize = Number(state.doc?.content?.size ?? 0);
  const clampedPos = Math.max(0, Math.min(docSize, Number(pos)));
  let $pos = null;
  try {
    $pos = state.doc.resolve(clampedPos);
  } catch (_error) {
    return false;
  }
  for (let depth = $pos.depth; depth >= 0; depth -= 1) {
    const node = $pos.node(depth);
    const nodePos = depth > 0 ? $pos.before(depth) : 0;
    const direct = depth === $pos.depth;
    if (dispatchEditorProp(propName, clampedPos, node, nodePos, event, direct)) {
      return true;
    }
  }
  return false;
};

export const createNodeEventRouting = ({
  getState,
  getEventCoords,
  getDocPosFromCoords,
  dispatchEditorProp,
  handleNodeViewClick,
  consumeSkipNextClickSelection,
  focusInput,
  debugLog,
  eventTiming = false,
}: {
  getState: () => any;
  getEventCoords: (event: any) => any;
  getDocPosFromCoords: (coords: any) => any;
  dispatchEditorProp: (name: any, ...args: any[]) => boolean;
  handleNodeViewClick: (event: any, handlerName: any) => boolean;
  consumeSkipNextClickSelection: () => boolean;
  focusInput: () => void;
  debugLog: (...args: any[]) => void;
  eventTiming?: boolean;
}) => {
  const onClickFocus = (event: any) => {
    const startedAt = eventTiming ? now() : 0;
    try {
      const isHandleTarget = !!event?.target?.closest?.(".lumenpage-block-drag-handle");
      if (isHandleTarget) {
        focusInput();
        logEventTiming(eventTiming, "click:handle-short-circuit", startedAt);
        return;
      }
      const coords = getEventCoords(event);
      const pos = getDocPosFromCoords(coords);
      debugLog("click", { pos, coords });
      if (consumeSkipNextClickSelection()) {
        focusInput();
        logEventTiming(eventTiming, "click:skip-next-selection", startedAt);
        return;
      }
      const state = getState();
      if (event.detail >= 3 && Number.isFinite(pos)) {
        if (dispatchNodeEventChain(state, dispatchEditorProp, "handleTripleClickOn", pos, event)) {
          event.preventDefault();
          logEventTiming(eventTiming, "click:triple-on", startedAt);
          return;
        }
        if (dispatchEditorProp("handleTripleClick", pos, event)) {
          event.preventDefault();
          logEventTiming(eventTiming, "click:triple", startedAt);
          return;
        }
      }
      if (dispatchNodeEventChain(state, dispatchEditorProp, "handleClickOn", pos, event)) {
        event.preventDefault();
        logEventTiming(eventTiming, "click:on", startedAt);
        return;
      }
      if (dispatchEditorProp("handleClick", pos, event)) {
        event.preventDefault();
        logEventTiming(eventTiming, "click", startedAt);
        return;
      }
      if (handleNodeViewClick(event, "handleClick")) {
        event.preventDefault();
        focusInput();
        logEventTiming(eventTiming, "click:node-view", startedAt);
        return;
      }
      focusInput();
      logEventTiming(eventTiming, "click:focus-only", startedAt);
    } catch (error) {
      console.error("[events] onClickFocus error", error);
      focusInput();
      logEventTiming(eventTiming, "click:error-guarded", startedAt);
    }
  };

  const onDoubleClick = (event: any) => {
    const startedAt = eventTiming ? now() : 0;
    try {
      const isHandleTarget = !!event?.target?.closest?.(".lumenpage-block-drag-handle");
      if (isHandleTarget) {
        focusInput();
        logEventTiming(eventTiming, "double-click:handle-short-circuit", startedAt);
        return;
      }
      const coords = getEventCoords(event);
      const pos = getDocPosFromCoords(coords);
      const state = getState();
      if (
        dispatchNodeEventChain(state, dispatchEditorProp, "handleDoubleClickOn", pos, event)
      ) {
        event.preventDefault();
        logEventTiming(eventTiming, "double-click:on", startedAt);
        return;
      }
      if (dispatchEditorProp("handleDoubleClick", pos, event)) {
        event.preventDefault();
        logEventTiming(eventTiming, "double-click", startedAt);
        return;
      }
      if (handleNodeViewClick(event, "handleDoubleClick")) {
        event.preventDefault();
        logEventTiming(eventTiming, "double-click:node-view", startedAt);
        return;
      }
      logEventTiming(eventTiming, "double-click:noop", startedAt);
    } catch (error) {
      console.error("[events] onDoubleClick error", error);
      logEventTiming(eventTiming, "double-click:error-guarded", startedAt);
    }
  };

  const onRootFocus = () => {
    const startedAt = eventTiming ? now() : 0;
    focusInput();
    logEventTiming(eventTiming, "root-focus", startedAt);
  };

  return {
    onClickFocus,
    onDoubleClick,
    onRootFocus,
  };
};
