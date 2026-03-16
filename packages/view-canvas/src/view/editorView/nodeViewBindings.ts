// NodeView 在构造阶段的薄绑定层：把 manager 能力映射为 view 层可直接调用的方法。
export const createNodeViewBindings = ({
  manager,
  eventResolution,
  runtime,
}: {
  manager: {
    nodeViewManager: any;
  };
  eventResolution: {
    getEventCoords: (event: any) => any;
    getDocPosFromCoords: (coords: any) => any;
  };
  runtime: {
    docPosToTextOffset: any;
    getLayoutIndex: () => any;
    getChangeSummary: () => any;
    queryEditorProp: (name: any, ...args: any[]) => any;
    dispatchTransaction: (tr: any) => void;
  };
}) => {
  const syncNodeViews = (changeSummary = undefined) => {
    const nextChangeSummary =
      changeSummary === undefined
        ? typeof runtime.getChangeSummary === "function"
          ? runtime.getChangeSummary()
          : null
        : changeSummary;
    manager.nodeViewManager.syncNodeViews(nextChangeSummary);
  };

  const destroyNodeViews = () => {
    manager.nodeViewManager.destroyNodeViews();
  };

  const handleNodeViewClick = (event, handlerName) => {
    return manager.nodeViewManager.handleNodeViewClick({
      event,
      handlerName,
      getEventCoords: eventResolution.getEventCoords,
      getDocPosFromCoords: eventResolution.getDocPosFromCoords,
      docPosToTextOffset: runtime.docPosToTextOffset,
      layoutIndex: runtime.getLayoutIndex(),
      queryEditorProp: runtime.queryEditorProp,
      dispatchTransaction: runtime.dispatchTransaction,
    });
  };

  return {
    syncNodeViews,
    destroyNodeViews,
    handleNodeViewClick,
  };
};
