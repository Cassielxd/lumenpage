import type {
  CanvasEditorViewProps,
  DispatchEditorProp,
  HookReturn,
  QueryEditorProp,
} from "./types";

const DOM_EVENT_HANDLED_FLAG = "__lumen_dom_event_handled__";

const markEditorDomEventHandled = (event: any) => {
  if (!event) {
    return;
  }
  try {
    event[DOM_EVENT_HANDLED_FLAG] = true;
  } catch (_error) {
    // Ignore non-extensible event objects.
  }
};

export const isEditorDomEventHandled = (event: any) => !!event?.[DOM_EVENT_HANDLED_FLAG];

export const createEditorPropHandlers = ({
  view,
  editorProps,
  getEditorProps,
  getState,
  domRoot,
}: {
  view: any;
  editorProps: CanvasEditorViewProps;
  getEditorProps: () => CanvasEditorViewProps;
  getState: () => any;
  domRoot: HTMLElement;
}) => {
  let domEventHandlers = new Map<string, { eventName: string; target: any; handler: any }>();
  let pluginViews: Array<{ plugin: any; view: any }> = [];

  const getEditorPropsList = (state = getState?.()) => {
    const list: Array<Record<string, any>> = [];
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

  const dispatchEditorProp: DispatchEditorProp = (name, ...args) => {
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

  const queryEditorProp: QueryEditorProp = (name, ...args) => {
    const propsList = getEditorPropsList();
    for (let i = 0; i < propsList.length; i += 1) {
      const props = propsList[i];
      const valueOrHandler = props?.[name];
      const value =
        typeof valueOrHandler === "function" ? valueOrHandler(view, ...args) : valueOrHandler;
      if (value != null) {
        return value as HookReturn<CanvasEditorViewProps[typeof name]>;
      }
    }
    return null;
  };

  const collectHandleDomEvents = (state = getState?.()) => {
    const events = new Map<string, Array<(view: any, event: Event) => boolean>>();
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
        events.get(eventName)?.push(handler as (view: any, event: Event) => boolean);
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
    const ownerDocument = domRoot?.ownerDocument || (typeof document !== "undefined" ? document : null);
    if (!ownerDocument || !domRoot) {
      return;
    }
    for (const [eventName, handlers] of events.entries()) {
      const listener = (event: Event) => {
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
