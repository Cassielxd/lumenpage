import { defaultVideoRenderer as baseVideoRenderer } from "lumenpage-render-engine";
import { sanitizePosterSrc, sanitizeVideoSrc } from "lumenpage-link";

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

const createMediaElement = (node) => {
  const attrs = node.attrs || {};
  if (attrs.embed) {
    const iframe = document.createElement("iframe");
    iframe.src = sanitizeVideoSrc(attrs.src || "");
    iframe.allowFullscreen = true;
    iframe.style.border = "0";
    return iframe;
  }

  const video = document.createElement("video");
  video.src = sanitizeVideoSrc(attrs.src || "");
  video.controls = true;
  video.playsInline = true;
  video.draggable = false;
  const safePoster = sanitizePosterSrc(attrs.poster || "");
  if (safePoster) video.poster = safePoster;
  return video;
};

export const createDefaultVideoNodeView = (node, _view, _getPos) => {
  const host = resolveOverlayHost(_view);
  if (!host) return null;

  const container = document.createElement("div");
  container.className = "lumenpage-video-overlay";
  container.style.position = "absolute";
  container.style.transform = "translate(0px, 0px)";
  container.style.width = "0";
  container.style.height = "0";
  container.style.pointerEvents = "none";
  container.style.overflow = "visible";
  container.style.background = "#000";
  container.style.outline = "none";
  syncNodeViewBlockId(container, node);
  host.appendChild(container);

  let mediaEl = null;
  let currentNode = node;

  const mountMedia = (nextNode) => {
    if (mediaEl) mediaEl.remove();
    mediaEl = createMediaElement(nextNode);
    mediaEl.style.width = "100%";
    mediaEl.style.height = "100%";
    mediaEl.style.pointerEvents = "auto";
    container.appendChild(mediaEl);
  };

  const updateMedia = (nextNode) => {
    const nextEmbed = !!nextNode.attrs?.embed;
    const currentEmbed = !!currentNode.attrs?.embed;
    if (!mediaEl || nextEmbed !== currentEmbed) {
      mountMedia(nextNode);
      return;
    }
    if (mediaEl instanceof HTMLVideoElement) {
      const src = sanitizeVideoSrc(nextNode.attrs?.src || "");
      if (mediaEl.src !== src) mediaEl.src = src;
      mediaEl.poster = sanitizePosterSrc(nextNode.attrs?.poster || "");
    } else {
      const src = sanitizeVideoSrc(nextNode.attrs?.src || "");
      if (mediaEl.src !== src) mediaEl.src = src;
    }
  };

  mountMedia(currentNode);

  return {
    update(nextNode) {
      if (nextNode.type !== currentNode.type) return false;
      currentNode = nextNode;
      syncNodeViewBlockId(container, nextNode);
      updateMedia(nextNode);
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

export const videoRenderer = {
  ...baseVideoRenderer,
  createNodeView: createDefaultVideoNodeView,
};
