export const createNodeViewManagerState = () => ({
  nodeViews: new Map<string, any>(),
  nodeViewsByBlockId: new Map<string, any>(),
  selectedNodeViewKey: null as string | null,
  skipNextClickSelection: false,
  lastVisibleOverlayKeys: new Set<string>(),
  lastOverlayStateByKey: new Map<string, any>(),
  docTopLevelBlockIndexCache: new WeakMap<any, any>(),
});
