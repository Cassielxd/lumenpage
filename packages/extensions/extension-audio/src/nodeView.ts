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

const findNodePosByBlockId = (doc: any, blockId: string | null) => {
  if (!doc || !blockId || typeof doc.descendants !== "function") {
    return null;
  }
  let found: number | null = null;
  doc.descendants((candidate: any, pos: number) => {
    if (candidate?.attrs?.id === blockId) {
      found = pos;
      return false;
    }
    return true;
  });
  return found;
};

const createAudioElement = (node: any) => {
  const audio = document.createElement("audio");
  audio.src = sanitizeAudioSrc(node.attrs?.src || "");
  audio.controls = true;
  audio.preload = "metadata";
  audio.style.width = "100%";
  audio.style.height = "100%";
  audio.style.display = "block";
  audio.style.pointerEvents = "none";
  audio.style.visibility = "hidden";
  return audio;
};

export const createDefaultAudioNodeView = (node: any, view: any, getPos?: () => number) => {
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

  const interactionCover = document.createElement("div");
  interactionCover.className = "lumenpage-audio-interaction-cover";
  interactionCover.style.position = "absolute";
  interactionCover.style.inset = "0";
  interactionCover.style.zIndex = "1";
  interactionCover.style.background = "transparent";
  interactionCover.style.pointerEvents = "auto";
  interactionCover.style.cursor = "pointer";
  container.appendChild(interactionCover);

  let currentNode = node;
  let isSelected = false;
  let releaseInteractionCoverRaf = 0;

  const cancelPendingInteractionRelease = () => {
    if (!releaseInteractionCoverRaf) {
      return;
    }
    cancelAnimationFrame(releaseInteractionCoverRaf);
    releaseInteractionCoverRaf = 0;
  };

  const resolveNodePos = () => {
    const livePos = getPos?.();
    if (Number.isFinite(livePos)) {
      return Number(livePos);
    }
    return findNodePosByBlockId(view?.state?.doc, currentNode?.attrs?.id ?? null);
  };

  const applyNodeSelection = () => {
    const pos = resolveNodePos();
    const setNodeSelectionAtPos = view?._internals?.setNodeSelectionAtPos;
    if (!Number.isFinite(pos) || typeof setNodeSelectionAtPos !== "function") {
      return false;
    }
    return setNodeSelectionAtPos(pos) === true;
  };

  const stopOverlayEvent = (event: Event) => {
    event.stopPropagation();
    event.preventDefault?.();
  };

  const handleCoverPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) {
      return;
    }
    applyNodeSelection();
    stopOverlayEvent(event);
  };

  const handleCoverClick = (event: MouseEvent) => {
    stopOverlayEvent(event);
  };

  const handleCoverDoubleClick = (event: MouseEvent) => {
    stopOverlayEvent(event);
  };

  const handleCoverSelectStart = (event: Event) => {
    stopOverlayEvent(event);
  };

  interactionCover.addEventListener("pointerdown", handleCoverPointerDown);
  interactionCover.addEventListener("click", handleCoverClick);
  interactionCover.addEventListener("dblclick", handleCoverDoubleClick);
  interactionCover.addEventListener("selectstart", handleCoverSelectStart);

  const syncInteractivity = () => {
    cancelPendingInteractionRelease();
    interactionCover.style.display = "block";
    interactionCover.style.pointerEvents = "auto";
    interactionCover.style.cursor = isSelected ? "default" : "pointer";
    container.style.outline = isSelected ? "2px solid #3b82f6" : "none";
    audio.style.visibility = isSelected ? "visible" : "hidden";
    audio.style.pointerEvents = isSelected ? "auto" : "none";
    if (!isSelected) {
      return;
    }
    releaseInteractionCoverRaf = requestAnimationFrame(() => {
      releaseInteractionCoverRaf = 0;
      if (!isSelected) {
        return;
      }
      interactionCover.style.pointerEvents = "none";
      interactionCover.style.display = "none";
    });
  };

  const updateAudio = (nextNode: any) => {
    const src = sanitizeAudioSrc(nextNode.attrs?.src || "");
    if (audio.src !== src) audio.src = src;
    audio.title = String(nextNode.attrs?.title || "").trim();
  };

  updateAudio(node);
  syncInteractivity();

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
      cancelPendingInteractionRelease();
      interactionCover.removeEventListener("pointerdown", handleCoverPointerDown);
      interactionCover.removeEventListener("click", handleCoverClick);
      interactionCover.removeEventListener("dblclick", handleCoverDoubleClick);
      interactionCover.removeEventListener("selectstart", handleCoverSelectStart);
      container.remove();
    },
    selectNode() {
      isSelected = true;
      syncInteractivity();
    },
    deselectNode() {
      isSelected = false;
      syncInteractivity();
    },
  };
};
