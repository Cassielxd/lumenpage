import { computePosition, flip, offset as withOffset, shift, size } from "@floating-ui/dom";

export type PopupRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type PopupReference = PopupRect | (() => DOMRect | null) | null;

export type PopupController = {
  show: (reference: PopupReference, content: HTMLElement) => void;
  hide: () => void;
  destroy: () => void;
};

export type PopupControllerOptions = {
  placement?: string;
  maxWidth?: number;
  interactive?: boolean;
  offset?: [number, number];
};

const toFinite = (value: unknown, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const normalizeOffset = (offset: unknown): [number, number] => {
  if (!Array.isArray(offset) || offset.length < 2) {
    return [0, 0];
  }
  return [toFinite(offset[0], 0), toFinite(offset[1], 0)];
};

const createRectFromPopupRect = (rect: PopupRect): DOMRect => {
  const left = toFinite(rect.left, -99999);
  const top = toFinite(rect.top, -99999);
  const right = toFinite(rect.right, left + 1);
  const bottom = toFinite(rect.bottom, top + 1);
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);
  return {
    x: left,
    y: top,
    left,
    top,
    right,
    bottom,
    width,
    height,
    toJSON() {
      return { x: left, y: top, left, top, right, bottom, width, height };
    },
  } as DOMRect;
};

const resolveReferenceRect = (reference: PopupReference): DOMRect | null => {
  if (!reference) {
    return null;
  }
  if (typeof reference === "function") {
    return reference() || null;
  }
  if (typeof reference === "object") {
    return createRectFromPopupRect(reference);
  }
  return null;
};

export const createPopupController = (
  ownerDocument: Document,
  options: PopupControllerOptions = {}
): PopupController => {
  const placement =
    typeof options.placement === "string" && options.placement.trim().length > 0
      ? options.placement
      : "bottom-start";
  const maxWidth = Number.isFinite(options.maxWidth) ? Number(options.maxWidth) : 320;
  const interactive = options.interactive !== false;
  const [skid, distance] = normalizeOffset(options.offset);

  const floatingEl = ownerDocument.createElement("div");
  floatingEl.style.position = "fixed";
  floatingEl.style.left = "0";
  floatingEl.style.top = "0";
  floatingEl.style.display = "none";
  floatingEl.style.zIndex = "9999";
  floatingEl.style.pointerEvents = interactive ? "auto" : "none";
  floatingEl.style.maxWidth = `${maxWidth}px`;

  ownerDocument.body.appendChild(floatingEl);

  let destroyed = false;
  let currentReference: PopupReference = null;
  let animationFrameId: number | null = null;

  const virtualReference = {
    getBoundingClientRect: () =>
      resolveReferenceRect(currentReference) || createRectFromPopupRect({ left: 0, top: 0, right: 1, bottom: 1 }),
  };

  const updatePosition = async () => {
    const rect = resolveReferenceRect(currentReference);
    if (destroyed || !rect || floatingEl.style.display === "none") {
      return;
    }

    const { x, y } = await computePosition(virtualReference as any, floatingEl, {
      placement: placement as any,
      strategy: "fixed",
      middleware: [
        withOffset({
          crossAxis: skid,
          mainAxis: distance,
        }),
        flip(),
        shift({
          padding: 8,
        }),
        size({
          apply({ availableWidth }) {
            floatingEl.style.maxWidth = `${Math.min(maxWidth, Math.max(160, availableWidth))}px`;
          },
        }),
      ],
    });

    if (destroyed) {
      return;
    }

    floatingEl.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  };

  const stopWatching = () => {
    const defaultView = ownerDocument.defaultView;
    if (animationFrameId != null && defaultView) {
      defaultView.cancelAnimationFrame(animationFrameId);
    }
    animationFrameId = null;
  };

  const startWatching = () => {
    stopWatching();
    const defaultView = ownerDocument.defaultView;
    if (!currentReference || !defaultView) {
      return;
    }

    const tick = () => {
      if (destroyed || !currentReference || floatingEl.style.display === "none") {
        animationFrameId = null;
        return;
      }
      void updatePosition();
      animationFrameId = defaultView.requestAnimationFrame(tick);
    };

    animationFrameId = defaultView.requestAnimationFrame(tick);
  };

  return {
    show(reference, content) {
      if (destroyed) {
        return;
      }
      currentReference = reference;
      if (content.parentNode !== floatingEl) {
        floatingEl.replaceChildren(content);
      } else if (floatingEl.firstChild !== content) {
        floatingEl.replaceChildren(content);
      }
      floatingEl.style.display = "block";
      startWatching();
      void updatePosition();
    },
    hide() {
      if (destroyed) {
        return;
      }
      stopWatching();
      floatingEl.style.display = "none";
    },
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      stopWatching();
      floatingEl.remove();
      currentReference = null;
    },
  };
};
