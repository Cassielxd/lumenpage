type DomEventDescriptor = {
  target: any;
  type: string;
  handler: any;
  options?: boolean | AddEventListenerOptions;
};

const createDomEventDescriptors = ({
  dom,
  updateStatus,
  resetComposing,
  handlers,
  pointerHandlers,
  touchHandlers,
  dragHandlers,
}: {
  dom: any;
  updateStatus: () => void;
  resetComposing: () => void;
  handlers: any;
  pointerHandlers: any;
  touchHandlers: any;
  dragHandlers: any;
}) => {
  const {
    onScroll,
    onClickFocus,
    onDoubleClick,
    onRootFocus,
    onDocumentSelectionChange,
    onResize,
  } = handlers;
  const { handlePointerDown, handlePointerMove, handlePointerUp } = pointerHandlers;
  const { handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel } = touchHandlers;
  const { handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd } =
    dragHandlers;
  const ownerDocument = dom.root?.ownerDocument || document;
  const ownerWindow = ownerDocument.defaultView || window;

  return [
    { target: dom.input, type: "focus", handler: updateStatus },
    { target: dom.input, type: "blur", handler: updateStatus },
    { target: dom.input, type: "blur", handler: resetComposing },
    { target: dom.scrollArea, type: "scroll", handler: onScroll },
    { target: dom.root, type: "pointerdown", handler: handlePointerDown },
    { target: dom.root, type: "pointermove", handler: handlePointerMove },
    { target: dom.root, type: "pointerup", handler: handlePointerUp },
    { target: dom.root, type: "pointercancel", handler: handlePointerUp },
    { target: dom.scrollArea, type: "touchstart", handler: handleTouchStart, options: { passive: false } },
    { target: dom.scrollArea, type: "touchmove", handler: handleTouchMove, options: { passive: false } },
    { target: dom.scrollArea, type: "touchend", handler: handleTouchEnd },
    { target: dom.scrollArea, type: "touchcancel", handler: handleTouchCancel },
    { target: dom.root, type: "dragstart", handler: handleDragStart },
    { target: dom.root, type: "dragover", handler: handleDragOver },
    { target: dom.root, type: "dragleave", handler: handleDragLeave },
    { target: dom.root, type: "drop", handler: handleDrop },
    { target: dom.root, type: "dragend", handler: handleDragEnd },
    { target: dom.root, type: "click", handler: onClickFocus },
    { target: dom.root, type: "dblclick", handler: onDoubleClick },
    { target: dom.root, type: "focus", handler: onRootFocus },
    { target: ownerDocument, type: "selectionchange", handler: onDocumentSelectionChange },
    { target: ownerWindow, type: "resize", handler: onResize },
  ] as DomEventDescriptor[];
};

const applyEventDescriptors = (
  descriptors: DomEventDescriptor[],
  method: "addEventListener" | "removeEventListener"
) => {
  for (const descriptor of descriptors) {
    descriptor.target?.[method]?.(descriptor.type, descriptor.handler, descriptor.options);
  }
};

export const createDomEventBindingController = ({
  dom,
  updateStatus,
  resetComposing,
  handlers,
  pointerHandlers,
  touchHandlers,
  dragHandlers,
}: {
  dom: any;
  updateStatus: () => void;
  resetComposing: () => void;
  handlers: any;
  pointerHandlers: any;
  touchHandlers: any;
  dragHandlers: any;
}) => {
  const descriptors = createDomEventDescriptors({
    dom,
    updateStatus,
    resetComposing,
    handlers,
    pointerHandlers,
    touchHandlers,
    dragHandlers,
  });
  let bound = false;

  const bind = () => {
    if (bound) {
      return;
    }
    applyEventDescriptors(descriptors, "addEventListener");
    bound = true;
  };

  const unbind = () => {
    if (bound) {
      applyEventDescriptors(descriptors, "removeEventListener");
      bound = false;
    }
    handlers?.destroy?.();
  };

  return {
    bind,
    unbind,
  };
};

export const bindViewDomEvents = (args: {
  dom: any;
  updateStatus: () => void;
  resetComposing: () => void;
  handlers: any;
  pointerHandlers: any;
  touchHandlers: any;
  dragHandlers: any;
}) => {
  const controller = createDomEventBindingController(args);
  controller.bind();
  return controller.unbind;
};
