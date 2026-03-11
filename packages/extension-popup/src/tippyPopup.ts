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

export type PopupControllerOptions = {
  placement?: string;
  maxWidth?: number;
  interactive?: boolean;
  offset?: [number, number];
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

const normalizeOffset = (offset: unknown): [number, number] => {
  if (!Array.isArray(offset) || offset.length < 2) {
    return [0, 0];
  }
  const skid = Number(offset[0]);
  const distance = Number(offset[1]);
  return [Number.isFinite(skid) ? skid : 0, Number.isFinite(distance) ? distance : 0];
};

export const createTippyPopupController = (
  ownerDocument: Document,
  options: PopupControllerOptions = {}
): PopupController => {
  const placement =
    typeof options.placement === "string" && options.placement.trim().length > 0
      ? options.placement
      : "bottom-start";
  const maxWidth = Number.isFinite(options.maxWidth) ? Number(options.maxWidth) : 320;
  const interactive = options.interactive !== false;
  const offset = normalizeOffset(options.offset);
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
    interactive,
    placement,
    offset,
    appendTo: () => ownerDocument.body,
    getReferenceClientRect,
    content: contentHost,
    arrow: false,
    maxWidth,
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
