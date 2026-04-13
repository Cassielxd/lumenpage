import type { PopupRect } from "./popupController.js";

const toFinite = (value: unknown) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
};

export const toPopupRect = (value: any): PopupRect | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const left = toFinite(value.left);
  const right = toFinite(value.right);
  const top = toFinite(value.top);
  const bottom = toFinite(value.bottom);
  if (left == null || right == null || top == null || bottom == null) {
    return null;
  }
  return { left, right, top, bottom };
};

export const toViewportPopupRect = (view: any, rect: PopupRect | null): PopupRect | null => {
  if (!rect) {
    return null;
  }
  const scrollArea = view?._internals?.dom?.scrollArea;
  if (!scrollArea || typeof scrollArea.getBoundingClientRect !== "function") {
    return rect;
  }
  const hostRect = scrollArea.getBoundingClientRect();
  const hostLeft = toFinite(hostRect?.left);
  const hostTop = toFinite(hostRect?.top);
  if (hostLeft == null || hostTop == null) {
    return rect;
  }
  return {
    left: rect.left + hostLeft,
    right: rect.right + hostLeft,
    top: rect.top + hostTop,
    bottom: rect.bottom + hostTop,
  };
};

