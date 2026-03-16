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

export const createPluginDomEventRuntime = ({
  view,
  domRoot,
  getState,
  getEditorPropsList,
}: {
  view: any;
  domRoot: HTMLElement;
  getState: () => any;
  getEditorPropsList: (state?: any) => Array<Record<string, any>>;
}) => {
  let domEventHandlers = new Map<string, { eventName: string; target: any; handler: any }>();

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
    const ownerDocument =
      domRoot?.ownerDocument || (typeof document !== "undefined" ? document : null);
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

  return {
    refreshDomEventHandlers,
    clearDomEventHandlers,
  };
};
