import { sanitizeAudioSrc } from "lumenpage-link";

const resolveOverlayHost = (view: any) =>
  view?.overlayHost ||
  view?._internals?.dom?.overlayHost ||
  view?.dom?.querySelector?.(".lumenpage-overlay-host") ||
  null;

const syncNodeViewBlockId = (element: HTMLElement, node: any) => {
  const blockId = node?.attrs?.id;
  if (blockId != null && blockId !== "") {
    element.setAttribute("data-node-view-block-id", String(blockId));
    return;
  }
  element.removeAttribute("data-node-view-block-id");
};

const createAudioElement = (node: any) => {
  const audio = document.createElement("audio");
  audio.src = sanitizeAudioSrc(node.attrs?.src || "");
  audio.controls = true;
  audio.preload = "metadata";
  audio.style.width = "100%";
  audio.style.height = "100%";
  audio.style.pointerEvents = "auto";
  return audio;
};

export const createDefaultAudioNodeView = (node: any, view: any) => {
  const host = resolveOverlayHost(view);
  if (!host) return null;

  const container = document.createElement("div");
  container.className = "lumenpage-audio-overlay";
  container.style.position = "absolute";
  container.style.transform = "translate(0px, 0px)";
  container.style.width = "0";
  container.style.height = "0";
  container.style.pointerEvents = "none";
  container.style.overflow = "visible";
  container.style.background = "transparent";
  container.style.outline = "none";
  syncNodeViewBlockId(container, node);
  host.appendChild(container);

  const audio = createAudioElement(node);
  container.appendChild(audio);

  let currentNode = node;

  const updateAudio = (nextNode: any) => {
    const src = sanitizeAudioSrc(nextNode.attrs?.src || "");
    if (audio.src !== src) audio.src = src;
    audio.title = String(nextNode.attrs?.title || "").trim();
  };

  return {
    update(nextNode: any) {
      if (nextNode.type !== currentNode.type) return false;
      currentNode = nextNode;
      syncNodeViewBlockId(container, nextNode);
      updateAudio(nextNode);
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
    selectNode() {
      container.style.outline = "2px solid #3b82f6";
    },
    deselectNode() {
      container.style.outline = "none";
    },
  };
};
