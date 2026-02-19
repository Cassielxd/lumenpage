import { type NodeSpec } from "lumenpage-model";

const readIdAttr = (dom: Element | null) => dom?.getAttribute?.("data-node-id") || null;

const toNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export const serializeVideoToText = () => " ";

export const videoNodeSpec: NodeSpec = {
  group: "block",
  atom: true,
  attrs: {
    id: { default: null },
    src: { default: "" },
    poster: { default: "" },
    width: { default: null },
    height: { default: null },
    embed: { default: false },
  },
  parseDOM: [
    {
      tag: "video[src]",
      getAttrs: (dom: Element) => ({
        id: readIdAttr(dom),
        src: dom.getAttribute("src") || "",
        poster: dom.getAttribute("poster") || "",
        width: dom.getAttribute("width"),
        height: dom.getAttribute("height"),
        embed: false,
      }),
    },
    {
      tag: "iframe[src]",
      getAttrs: (dom: Element) => ({
        id: readIdAttr(dom),
        src: dom.getAttribute("src") || "",
        width: dom.getAttribute("width"),
        height: dom.getAttribute("height"),
        embed: true,
      }),
    },
  ],
  toDOM(node) {
    const attrs: Record<string, unknown> = {
      src: node.attrs?.src || "",
    };

    if (node.attrs?.id) {
      attrs["data-node-id"] = node.attrs.id;
    }

    if (node.attrs?.width) {
      attrs.width = node.attrs.width;
    }

    if (node.attrs?.height) {
      attrs.height = node.attrs.height;
    }

    if (node.attrs?.poster) {
      attrs.poster = node.attrs.poster;
    }

    if (node.attrs?.embed) {
      return ["iframe", attrs];
    }

    attrs.controls = true;
    return ["video", attrs];
  },
};

const resolveSize = (node: any, settings: any) => {
  const attrs = node.attrs || {};
  const maxWidth = settings.pageWidth - settings.margin.left - settings.margin.right;
  const desiredWidth = toNumber(attrs.width) || Math.min(480, maxWidth);
  const width = Math.max(1, Math.min(maxWidth, desiredWidth));
  const desiredHeight = toNumber(attrs.height) || Math.round(width * 0.5625);
  const height = Math.max(1, desiredHeight);
  return { width, height };
};

const resolveOverlayHost = (view: any) =>
  view?.overlayHost ||
  view?._internals?.dom?.overlayHost ||
  view?.dom?.querySelector?.(".lumenpage-overlay-host") ||
  null;

const createMediaElement = (node: any) => {
  const attrs = node.attrs || {};
  if (attrs.embed) {
    const iframe = document.createElement("iframe");
    iframe.src = attrs.src || "";
    iframe.allowFullscreen = true;
    iframe.style.border = "0";
    return iframe;
  }

  const video = document.createElement("video");
  video.src = attrs.src || "";
  video.controls = true;
  video.playsInline = true;
  if (attrs.poster) {
    video.poster = attrs.poster;
  }
  return video;
};

export const videoRenderer = {
  allowSplit: false,

  layoutBlock({ node, settings }: { node: any; settings: any }) {
    const { width, height } = resolveSize(node, settings);
    const line = {
      text: "",
      start: 0,
      end: 1,
      width,
      runs: [],
      x: settings.margin.left,
      blockType: "video",
      blockAttrs: {
        lineHeight: height,
        width,
        height,
      },
      videoMeta: {
        width,
        height,
      },
    };

    return {
      lines: [line],
      length: 1,
      height,
      blockLineHeight: height,
      blockAttrs: { width, height, lineHeight: height },
    };
  },

  renderLine({ ctx, line, pageX, pageTop }: any) {
    const width = line.videoMeta?.width ?? line.width ?? 0;
    const height = line.videoMeta?.height ?? line.lineHeight ?? 0;
    if (width <= 0 || height <= 0) {
      return;
    }

    const x = pageX + line.x;
    const y = pageTop + line.y;

    ctx.fillStyle = "#f3f4f6";
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = "#9ca3af";
    ctx.strokeRect(x, y, width, height);

    ctx.fillStyle = "#6b7280";
    ctx.font = "14px Arial";
    ctx.fillText("Video", x + 12, y + 24);

    ctx.fillStyle = "rgba(107, 114, 128, 0.6)";
    ctx.beginPath();
    ctx.moveTo(x + width / 2 - 12, y + height / 2 - 16);
    ctx.lineTo(x + width / 2 - 12, y + height / 2 + 16);
    ctx.lineTo(x + width / 2 + 16, y + height / 2);
    ctx.closePath();
    ctx.fill();
  },

  createNodeView(node: any, view: any) {
    const host = resolveOverlayHost(view);
    if (!host) {
      return null;
    }

    const container = document.createElement("div");
    container.className = "lumenpage-video-overlay";
    container.style.position = "absolute";
    container.style.transform = "translate(0px, 0px)";
    container.style.width = "0";
    container.style.height = "0";
    container.style.pointerEvents = "none";
    container.style.overflow = "hidden";
    container.style.background = "#000";
    host.appendChild(container);

    let mediaEl: HTMLVideoElement | HTMLIFrameElement | null = null;
    let currentNode = node;

    const mountMedia = (nextNode: any) => {
      if (mediaEl) {
        mediaEl.remove();
      }
      mediaEl = createMediaElement(nextNode) as HTMLVideoElement | HTMLIFrameElement;
      mediaEl.style.width = "100%";
      mediaEl.style.height = "100%";
      container.appendChild(mediaEl);
    };

    const updateMedia = (nextNode: any) => {
      const nextEmbed = !!nextNode.attrs?.embed;
      const currentEmbed = !!currentNode.attrs?.embed;
      if (!mediaEl || nextEmbed != currentEmbed) {
        mountMedia(nextNode);
        return;
      }

      if (mediaEl instanceof HTMLVideoElement) {
        const src = nextNode.attrs?.src || "";
        if (mediaEl.src !== src) {
          mediaEl.src = src;
        }
        mediaEl.poster = nextNode.attrs?.poster || "";
      } else {
        const src = nextNode.attrs?.src || "";
        if (mediaEl.src !== src) {
          mediaEl.src = src;
        }
      }
    };

    mountMedia(currentNode);

    return {
      update(nextNode: any) {
        if (nextNode.type !== currentNode.type) {
          return false;
        }
        currentNode = nextNode;
        updateMedia(nextNode);
        return true;
      },
      syncDOM({ x, y, width, height, visible }: any) {
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
    };
  },
};
