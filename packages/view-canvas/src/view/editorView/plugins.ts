export const createEditorPropHandlers = ({ view, editorProps, getState, domRoot }) => {
  let domEventHandlers = new Map();
  let pluginViews = [];

  // 汇总插件 props + 传入 editorProps。
  const getEditorPropsList = (state = getState?.()) => {
    const list = [];
    const plugins = state?.plugins ?? [];
    for (const plugin of plugins) {
      if (plugin?.props) {
        list.push(plugin.props);
      }
    }
    if (editorProps) {
      list.push(editorProps);
    }
    return list;
  };

  // 调度 EditorProps 中的 handler（返回 true 即截断）。
  const dispatchEditorProp = (name, ...args) => {
    const propsList = getEditorPropsList();
    for (const props of propsList) {
      const handler = props?.[name];
      if (typeof handler === "function" && handler(view, ...args)) {
        return true;
      }
    }
    return false;
  };

  // 收集 handleDOMEvents 并按事件名分组。
  const collectHandleDomEvents = (state = getState?.()) => {
    const events = new Map();
    const propsList = getEditorPropsList(state);
    for (const props of propsList) {
      const handleDomEvents = props?.handleDOMEvents;
      if (!handleDomEvents) {
        continue;
      }
      for (const [eventName, handler] of Object.entries(handleDomEvents)) {
        if (typeof handler !== "function") {
          continue;
        }
        if (!events.has(eventName)) {
          events.set(eventName, []);
        }
        events.get(eventName).push(handler);
      }
    }
    return events;
  };

  // 清空旧的 DOM 事件绑定。
  const clearDomEventHandlers = () => {
    for (const [eventName, handler] of domEventHandlers.entries()) {
      domRoot.removeEventListener(eventName, handler, true);
    }
    domEventHandlers = new Map();
  };

  // 重新挂载 DOM 事件（支持插件动态更新）。
  const refreshDomEventHandlers = (state = getState?.()) => {
    clearDomEventHandlers();
    const events = collectHandleDomEvents(state);
    for (const [eventName, handlers] of events.entries()) {
      const listener = (event) => {
        let handled = false;
        for (const handler of handlers) {
          if (handler(view, event)) {
            handled = true;
            break;
          }
        }
        if (handled) {
          event.preventDefault();
          event.stopPropagation();
        }
      };
      domRoot.addEventListener(eventName, listener, true);
      domEventHandlers.set(eventName, listener);
    }
  };

  // 创建插件视图实例。
  const createPluginViews = (state) => {
    const views = [];
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

  // 销毁插件视图。
  const destroyPluginViews = () => {
    for (const entry of pluginViews) {
      entry.view?.destroy?.();
    }
    pluginViews = [];
  };

  // 更新插件视图（插件集变化时重建）。
  const updatePluginViews = (prevState, nextState) => {
    const prevPlugins = prevState?.plugins ?? [];
    const nextPlugins = nextState?.plugins ?? [];
    const samePlugins =
      prevPlugins.length === nextPlugins.length &&
      prevPlugins.every((plugin, index) => plugin === nextPlugins[index]);

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

  // 初始化插件视图与事件绑定。
  const init = () => {
    const state = getState?.();
    pluginViews = createPluginViews(state);
    refreshDomEventHandlers(state);
  };

  return {
    getEditorPropsList,
    dispatchEditorProp,
    refreshDomEventHandlers,
    clearDomEventHandlers,
    updatePluginViews,
    destroyPluginViews,
    init,
  };
};
