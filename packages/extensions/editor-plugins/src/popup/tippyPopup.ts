import tippy from "tippy.js";

export type PopupRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type PopupController = {
  show: (rect: PopupRect, content: HTMLElement) => void;
  hide: () => void;
  destroy: () => void;
};

type TippyInstanceLike = {
  setContent: (content: HTMLElement | string) => void;
  show: () => void;
  hide: () => void;
  destroy: () => void;
};

type TippyFactoryLike = (
  target: any,
  options?: Record<string, any>
) => TippyInstanceLike | TippyInstanceLike[];

const tippyFactory = tippy as unknown as TippyFactoryLike;

export const createTippyPopupController = (ownerDocument: Document): PopupController => {
  let currentRect: PopupRect = { left: -99999, top: -99999, right: -99999, bottom: -99999 };
  const getReferenceClientRect = () => ({
    width: Math.max(1, currentRect.right - currentRect.left),
    height: Math.max(1, currentRect.bottom - currentRect.top),
    x: currentRect.left,
    y: currentRect.top,
    top: currentRect.top,
    right: currentRect.right,
    bottom: currentRect.bottom,
    left: currentRect.left,
    toJSON() {
      return {
        top: currentRect.top,
        right: currentRect.right,
        bottom: currentRect.bottom,
        left: currentRect.left,
      };
    },
  });
  const contentHost = ownerDocument.createElement("div");
  const rawInstance = tippyFactory(ownerDocument.body, {
    trigger: "manual",
    interactive: true,
    placement: "bottom-start",
    appendTo: () => ownerDocument.body,
    getReferenceClientRect,
    content: contentHost,
    arrow: false,
    maxWidth: 320,
  });
  const instance = Array.isArray(rawInstance) ? rawInstance[0] : rawInstance;
  if (
    !instance ||
    typeof instance.show !== "function" ||
    typeof instance.hide !== "function" ||
    typeof instance.destroy !== "function" ||
    typeof instance.setContent !== "function"
  ) {
    throw new Error("[mention] tippy popup init failed: invalid tippy instance");
  }
  return {
    show(rect, content) {
      currentRect = rect;
      instance.setContent(content);
      instance.show();
    },
    hide() {
      instance.hide();
    },
    destroy() {
      instance.destroy();
    },
  };
};
