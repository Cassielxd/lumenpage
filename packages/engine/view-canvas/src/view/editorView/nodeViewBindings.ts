// NodeView 在构造阶段的薄绑定层：把 manager 能力映射为 view 层可直接调用的方法。
export const createNodeViewBindings = ({
  nodeViewManager,
  getEventCoords,
  getDocPosFromCoords,
  docPosToTextOffset,
  getLayoutIndex,
  queryEditorProp,
  dispatchTransaction,
}) => {
  const syncNodeViews = () => {
    nodeViewManager.syncNodeViews();
  };

  const destroyNodeViews = () => {
    nodeViewManager.destroyNodeViews();
  };

  const handleNodeViewClick = (event, handlerName) => {
    return nodeViewManager.handleNodeViewClick({
      event,
      handlerName,
      getEventCoords,
      getDocPosFromCoords,
      docPosToTextOffset,
      layoutIndex: getLayoutIndex(),
      queryEditorProp,
      dispatchTransaction,
    });
  };

  return {
    syncNodeViews,
    destroyNodeViews,
    handleNodeViewClick,
  };
};
