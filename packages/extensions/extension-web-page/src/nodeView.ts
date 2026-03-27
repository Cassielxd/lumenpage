import { sanitizeLinkHref } from "lumenpage-link";

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

const sanitizeWebPageHref = (value: unknown) => {
  const href = sanitizeLinkHref(value) || "";
  if (!href) {
    return "";
  }
  if (href.startsWith("/") || href.startsWith("./") || href.startsWith("../")) {
    return href;
  }
  return /^https?:\/\//i.test(href) ? href : "";
};

export const createDefaultWebPageNodeView = (node: any, view: any, getPos?: () => number) => {
  const host = resolveOverlayHost(view);
  if (!host) return null;

  const container = document.createElement("div");
  container.className = "lumenpage-web-page-overlay";
  container.style.position = "absolute";
  container.style.transform = "translate(0px, 0px)";
  container.style.width = "0";
  container.style.height = "0";
  container.style.pointerEvents = "none";
  container.style.overflow = "visible";
  container.style.outline = "none";
  syncNodeViewBlockId(container, node);
  host.appendChild(container);

  const shell = document.createElement("div");
  shell.style.width = "100%";
  shell.style.height = "100%";
  shell.style.pointerEvents = "auto";
  shell.style.overflow = "hidden";
  shell.style.background = "#ffffff";
  shell.style.border = "1px solid #cbd5e1";
  shell.style.boxSizing = "border-box";
  shell.style.display = "flex";
  shell.style.flexDirection = "column";
  shell.style.userSelect = "none";
  container.appendChild(shell);

  const header = document.createElement("div");
  header.style.height = "40px";
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.gap = "12px";
  header.style.padding = "0 12px";
  header.style.background = "#e2e8f0";
  header.style.boxSizing = "border-box";
  header.style.flexShrink = "0";
  shell.appendChild(header);

  const title = document.createElement("div");
  title.style.flex = "1";
  title.style.minWidth = "0";
  title.style.font = "14px Arial";
  title.style.color = "#0f172a";
  title.style.whiteSpace = "nowrap";
  title.style.overflow = "hidden";
  title.style.textOverflow = "ellipsis";
  header.appendChild(title);

  const link = document.createElement("a");
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Open";
  link.style.font = "12px Arial";
  link.style.color = "#2563eb";
  link.style.textDecoration = "none";
  header.appendChild(link);

  const body = document.createElement("div");
  body.style.position = "relative";
  body.style.flex = "1";
  body.style.minHeight = "0";
  body.style.background = "#ffffff";
  body.style.overflow = "hidden";
  body.style.userSelect = "none";
  shell.appendChild(body);

  const frame = document.createElement("iframe");
  frame.style.display = "block";
  frame.style.width = "100%";
  frame.style.height = "100%";
  frame.style.border = "0";
  frame.style.background = "#ffffff";
  frame.setAttribute("loading", "lazy");
  frame.setAttribute("referrerpolicy", "no-referrer");
  body.appendChild(frame);

  const interactionCover = document.createElement("div");
  interactionCover.className = "lumenpage-web-page-interaction-cover";
  interactionCover.style.position = "absolute";
  interactionCover.style.inset = "0";
  interactionCover.style.zIndex = "1";
  interactionCover.style.background = "transparent";
  interactionCover.style.pointerEvents = "auto";
  interactionCover.style.cursor = "pointer";
  body.appendChild(interactionCover);

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
    body.style.cursor = isSelected ? "default" : "pointer";
    shell.style.outline = isSelected ? "2px solid #3b82f6" : "none";
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

  const updateFrame = (nextNode: any) => {
    const href = sanitizeWebPageHref(nextNode.attrs?.href || "");
    const nextTitle = String(nextNode.attrs?.title || href || "Embedded page");
    const nextLinkHref = href || "#";
    const nextFrameSrc = href || "about:blank";
    const nextFrameTitle = String(nextNode.attrs?.title || "Embedded page");
    if (title.textContent !== nextTitle) {
      title.textContent = nextTitle;
    }
    if (link.getAttribute("href") !== nextLinkHref) {
      link.href = nextLinkHref;
    }
    if (frame.getAttribute("src") !== nextFrameSrc) {
      frame.src = nextFrameSrc;
    }
    if (frame.title !== nextFrameTitle) {
      frame.title = nextFrameTitle;
    }
  };

  updateFrame(node);
  syncInteractivity();

  return {
    update(nextNode: any) {
      if (nextNode.type !== currentNode.type) return false;
      currentNode = nextNode;
      syncNodeViewBlockId(container, nextNode);
      updateFrame(nextNode);
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

