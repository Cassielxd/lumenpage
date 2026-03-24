import { defaultImageRenderer as baseImageRenderer } from "lumenpage-render-engine";
import { sanitizeImageSrc } from "lumenpage-link";

const MAX_DIMENSION_PERSIST_RETRIES = 12;

const readPositiveDimension = (value) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
};

const parsePixelSize = (value) => {
  if (typeof value !== "string") {
    return null;
  }
  const matched = value.match(/^(\d+(?:\.\d+)?)px$/);
  return matched ? readPositiveDimension(matched[1]) : null;
};

const resolveOverlayHost = (view) =>
  view?.overlayHost ||
  view?._internals?.dom?.overlayHost ||
  view?.dom?.querySelector?.(".lumenpage-overlay-host") ||
  null;

const syncNodeViewBlockId = (element, node) => {
  const blockId = node?.attrs?.id;
  if (blockId != null && blockId !== "") {
    element.setAttribute("data-node-view-block-id", String(blockId));
    return;
  }
  element.removeAttribute("data-node-view-block-id");
};

const createImageElement = (node) => {
  const img = document.createElement("img");
  img.src = sanitizeImageSrc(node.attrs?.src || "");
  img.alt = node.attrs?.alt || "";
  img.decoding = "async";
  img.loading = "lazy";
  img.draggable = false;
  img.style.display = "block";
  img.style.width = "100%";
  img.style.height = "100%";
  img.style.objectFit = "contain";
  img.style.pointerEvents = "auto";
  return img;
};

const resolveExpectedOverlayDimensions = (node) => {
  const width = readPositiveDimension(node?.attrs?.width);
  const height = readPositiveDimension(node?.attrs?.height);
  if (!width || !height) {
    return null;
  }
  return { width, height };
};

export const createDefaultImageNodeView = (node, _view, _getPos) => {
  const host = resolveOverlayHost(_view);
  if (!host) return null;

  const container = document.createElement("div");
  container.className = "lumenpage-image-overlay";
  container.style.position = "absolute";
  container.style.transform = "translate(0px, 0px)";
  container.style.width = "0";
  container.style.height = "0";
  container.style.pointerEvents = "none";
  container.style.overflow = "visible";
  container.style.background = "#f3f4f6";
  container.style.outline = "none";
  syncNodeViewBlockId(container, node);
  host.appendChild(container);

  const image = createImageElement(node);
  container.appendChild(image);

  let currentNode = node;
  let lastResolvedDimensionKey = "";
  let lastRelayoutMismatchKey = "";
  let persistRetryRafId = 0;
  let persistRetryCount = 0;

  const cancelPersistDimensionRetry = () => {
    if (!persistRetryRafId) {
      return;
    }
    cancelAnimationFrame(persistRetryRafId);
    persistRetryRafId = 0;
  };

  const persistResolvedDimensions = () => {
    const naturalWidth = readPositiveDimension(image.naturalWidth);
    const naturalHeight = readPositiveDimension(image.naturalHeight);
    if (!naturalWidth || !naturalHeight) {
      return false;
    }

    const currentWidth = readPositiveDimension(currentNode?.attrs?.width);
    const currentHeight = readPositiveDimension(currentNode?.attrs?.height);
    if (currentWidth && currentHeight) {
      lastResolvedDimensionKey = `${currentWidth}x${currentHeight}`;
      cancelPersistDimensionRetry();
      return true;
    }

    const layoutWidth =
      currentWidth ??
      parsePixelSize(container.style.width) ??
      readPositiveDimension(container.clientWidth) ??
      Math.min(320, naturalWidth);
    const layoutHeight =
      currentHeight ??
      parsePixelSize(container.style.height) ??
      readPositiveDimension(container.clientHeight) ??
      Math.round((layoutWidth * naturalHeight) / naturalWidth);
    const nextWidth = currentWidth ?? layoutWidth;
    const nextHeight =
      currentHeight ?? Math.max(1, Math.round((nextWidth * naturalHeight) / naturalWidth));
    const nextKey = `${nextWidth}x${nextHeight}`;
    if (nextKey === lastResolvedDimensionKey) {
      return false;
    }

    const pos = _getPos?.();
    const state = _view?.state;
    const dispatch = _view?.dispatch;
    if (!Number.isFinite(pos) || !state?.tr || typeof dispatch !== "function") {
      return false;
    }

    const currentAttrs = currentNode?.attrs || {};
    const nextAttrs = {
      ...currentAttrs,
      width: nextWidth,
      height: nextHeight,
    };
    lastResolvedDimensionKey = nextKey;
    dispatch(state.tr.setNodeMarkup(pos, undefined, nextAttrs).scrollIntoView());
    return false;
  };

  const schedulePersistResolvedDimensions = () => {
    const currentWidth = readPositiveDimension(currentNode?.attrs?.width);
    const currentHeight = readPositiveDimension(currentNode?.attrs?.height);
    if (currentWidth && currentHeight) {
      lastResolvedDimensionKey = `${currentWidth}x${currentHeight}`;
      cancelPersistDimensionRetry();
      return;
    }
    if (persistRetryRafId || persistRetryCount >= MAX_DIMENSION_PERSIST_RETRIES) {
      return;
    }
    persistRetryRafId = requestAnimationFrame(() => {
      persistRetryRafId = 0;
      persistRetryCount += 1;
      const resolved = persistResolvedDimensions();
      if (!resolved) {
        schedulePersistResolvedDimensions();
      }
    });
  };

  const updateImage = (nextNode) => {
    const src = sanitizeImageSrc(nextNode.attrs?.src || "");
    if (image.src !== src) image.src = src;
    const alt = nextNode.attrs?.alt || "";
    if (image.alt !== alt) image.alt = alt;
    cancelPersistDimensionRetry();
    persistRetryCount = 0;
    lastResolvedDimensionKey = "";
    if (image.complete) {
      schedulePersistResolvedDimensions();
    }
  };

  const handleImageLoad = () => {
    cancelPersistDimensionRetry();
    persistRetryCount = 0;
    schedulePersistResolvedDimensions();
  };

  image.addEventListener("load", handleImageLoad);
  if (image.complete) {
    schedulePersistResolvedDimensions();
  }

  return {
    update(nextNode) {
      if (nextNode.type !== currentNode.type) return false;
      currentNode = nextNode;
      syncNodeViewBlockId(container, nextNode);
      updateImage(nextNode);
      return true;
    },
    syncDOM({ x, y, width, height, visible }) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        container.style.display = "none";
        return;
      }
      const actualWidth = Math.max(1, Math.round(width));
      const actualHeight = Math.max(1, Math.round(height));
      container.style.display = visible ? "block" : "none";
      container.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      container.style.width = `${actualWidth}px`;
      container.style.height = `${actualHeight}px`;
      const expectedDimensions = resolveExpectedOverlayDimensions(currentNode);
      if (visible && expectedDimensions) {
        const widthShrunk = actualWidth + 2 < expectedDimensions.width;
        const heightShrunk = actualHeight + 2 < expectedDimensions.height;
        if (widthShrunk || heightShrunk) {
          const mismatchKey = `${expectedDimensions.width}x${expectedDimensions.height}:${actualWidth}x${actualHeight}`;
          if (mismatchKey !== lastRelayoutMismatchKey) {
            lastRelayoutMismatchKey = mismatchKey;
            _view?.forceLayout?.({
              clearLayoutCache: true,
              clearPageCache: true,
              immediate: true,
            });
          }
        } else {
          lastRelayoutMismatchKey = "";
        }
      } else if (!visible) {
        lastRelayoutMismatchKey = "";
      }
      if (image.complete) {
        schedulePersistResolvedDimensions();
      }
    },
    destroy() {
      cancelPersistDimensionRetry();
      image.removeEventListener("load", handleImageLoad);
      container.remove();
    },
    selectNode() {
      container.style.outline = "2px solid #3b82f6";
    },
    deselectNode() {
      container.style.outline = "none";
    },
  };
};

export const imageRenderer = {
  ...baseImageRenderer,
  createNodeView: createDefaultImageNodeView,
};
