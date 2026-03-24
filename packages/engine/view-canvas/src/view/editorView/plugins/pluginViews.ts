export const createPluginViewRuntime = ({
  view,
  getState,
  refreshDomEventHandlers,
}: {
  view: any;
  getState: () => any;
  refreshDomEventHandlers: (state?: any) => void;
}) => {
  let pluginViews: Array<{ plugin: any; view: any }> = [];

  const createPluginViews = (state: any) => {
    const views: Array<{ plugin: any; view: any }> = [];
    const plugins = state?.plugins ?? [];
    for (const plugin of plugins) {
      const viewFactory = plugin?.spec?.view;
      if (typeof viewFactory !== "function") {
        continue;
      }
      const pluginView = viewFactory(view);
      if (pluginView) {
        views.push({ plugin, view: pluginView });
      }
    }
    return views;
  };

  const destroyPluginViews = () => {
    for (const entry of pluginViews) {
      entry.view?.destroy?.();
    }
    pluginViews = [];
  };

  const updatePluginViews = (prevState: any, nextState: any) => {
    const prevPlugins = prevState?.plugins ?? [];
    const nextPlugins = nextState?.plugins ?? [];
    const samePlugins =
      prevPlugins.length === nextPlugins.length &&
      prevPlugins.every((plugin: any, index: number) => plugin === nextPlugins[index]);

    if (!samePlugins) {
      destroyPluginViews();
      pluginViews = createPluginViews(nextState);
      refreshDomEventHandlers(nextState);
      return;
    }

    for (const entry of pluginViews) {
      entry.view?.update?.(view, prevState);
    }
  };

  const init = () => {
    const state = getState?.();
    pluginViews = createPluginViews(state);
    refreshDomEventHandlers(state);
  };

  return {
    updatePluginViews,
    destroyPluginViews,
    init,
  };
};
