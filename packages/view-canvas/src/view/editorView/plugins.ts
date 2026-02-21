const DOM_EVENT_HANDLED_FLAG = "__lumen_dom_event_handled__";

const markEditorDomEventHandled = (event) => {
  if (!event) {
    return;
  }
  try {
    event[DOM_EVENT_HANDLED_FLAG] = true;
  } catch (_error) {
    // Ignore non-extensible event objects.
  }
};

export const isEditorDomEventHandled = (event) => !!event?.[DOM_EVENT_HANDLED_FLAG];

export const createEditorPropHandlers = ({ view, editorProps, getEditorProps, getState, domRoot }) => {
  let domEventHandlers = new Map();
  let pluginViews = [];

  const getEditorPropsList = (state = getState?.()) => {
    const list = [];
    const currentEditorProps =
      typeof getEditorProps === "function" ? getEditorProps() : editorProps;
    if (currentEditorProps) {
      list.push(currentEditorProps);
    }
    const plugins = state?.plugins ?? [];
    for (const plugin of plugins) {
      if (plugin?.props) {
        list.push(plugin.props);
      }
    }
    return list;
  };

  const dispatchEditorProp = (name, ...args) => {
    const propsList = getEditorPropsList();
    for (let i = 0; i < propsList.length; i += 1) {
      const props = propsList[i];
      const handler = props?.[name];
      if (typeof handler === "function" && handler(view, ...args)) {
        return true;
      }
    }
    return false;
  };

  const queryEditorProp = (name, ...args) => {
    const propsList = getEditorPropsList();
    for (let i = 0; i < propsList.length; i += 1) {
      const props = propsList[i];
      const valueOrHandler = props?.[name];
      const value =
        typeof valueOrHandler === "function" ? valueOrHandler(view, ...args) : valueOrHandler;
      if (value != null) {
        return value;
      }
    }
    return null;
  };

  const collectHandleDomEvents = (state = getState?.()) => {
    const events = new Map();
    const propsList = getEditorPropsList(state);
    for (let i = 0; i < propsList.length; i += 1) {
      const props = propsList[i];
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

  const clearDomEventHandlers = () => {
    for (const [, entry] of domEventHandlers.entries()) {
      entry.target.removeEventListener(entry.eventName, entry.handler, true);
    }
    domEventHandlers = new Map();
  };

  const refreshDomEventHandlers = (state = getState?.()) => {
    clearDomEventHandlers();
    const events = collectHandleDomEvents(state);
    const ownerDocument =
      domRoot?.ownerDocument || (typeof document !== "undefined" ? document : null);
    if (!ownerDocument || !domRoot) {
      return;
    }
    for (const [eventName, handlers] of events.entries()) {
      const listener = (event) => {
        for (const handler of handlers) {
          if (handler(view, event)) {
            markEditorDomEventHandled(event);
            return;
          }
        }
      };
      const target = eventName === "selectionchange" ? ownerDocument : domRoot;
      target.addEventListener(eventName, listener, true);
      domEventHandlers.set(eventName, { eventName, target, handler: listener });
    }
  };

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

  const destroyPluginViews = () => {
    for (const entry of pluginViews) {
      entry.view?.destroy?.();
    }
    pluginViews = [];
  };

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

  const init = () => {
    const state = getState?.();
    pluginViews = createPluginViews(state);
    refreshDomEventHandlers(state);
  };

  return {
    getEditorPropsList,
    dispatchEditorProp,
    queryEditorProp,
    refreshDomEventHandlers,
    clearDomEventHandlers,
    updatePluginViews,
    destroyPluginViews,
    init,
  };
};
