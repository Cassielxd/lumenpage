import { defaultImageRenderer as baseImageRenderer } from "lumenpage-render-engine";
import { sanitizeImageSrc } from "lumenpage-link";

const resolveOverlayHost = (view) =>
  view?.overlayHost ||
  view?._internals?.dom?.overlayHost ||
  view?.dom?.querySelector?.(".lumenpage-overlay-host") ||
  null;

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
  host.appendChild(container);

  const image = createImageElement(node);
  container.appendChild(image);

  let currentNode = node;

  const updateImage = (nextNode) => {
    const src = sanitizeImageSrc(nextNode.attrs?.src || "");
    if (image.src !== src) image.src = src;
    const alt = nextNode.attrs?.alt || "";
    if (image.alt !== alt) image.alt = alt;
  };

  return {
    update(nextNode) {
      if (nextNode.type !== currentNode.type) return false;
      currentNode = nextNode;
      updateImage(nextNode);
      return true;
    },
    syncDOM({ x, y, width, height, visible }) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        container.style.display = "none";
        return;
      }
      container.style.display = visible ? "block" : "none";
      container.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      container.style.width = `${Math.max(1, Math.round(width))}px`;
      container.style.height = `${Math.max(1, Math.round(height))}px`;
    },
    destroy() {
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
