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

export const createDefaultFileNodeView = (node: any, view: any, getPos?: () => number) => {
  const host = resolveOverlayHost(view);
  if (!host) return null;

  const container = document.createElement("div");
  container.className = "lumenpage-file-overlay";
  container.style.position = "absolute";
  container.style.transform = "translate(0px, 0px)";
  container.style.width = "0";
  container.style.height = "0";
  container.style.pointerEvents = "none";
  container.style.overflow = "visible";
  container.style.outline = "none";
  syncNodeViewBlockId(container, node);
  host.appendChild(container);

  const link = document.createElement("a");
  link.style.display = "block";
  link.style.width = "100%";
  link.style.height = "100%";
  link.style.pointerEvents = "auto";
  link.style.background = "transparent";
  link.style.color = "transparent";
  link.style.textDecoration = "none";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  container.appendChild(link);

  let currentNode = node;
  let suppressNextClick = false;

  const resolveNodePos = () => {
    const livePos = getPos?.();
    if (Number.isFinite(livePos)) {
      return Number(livePos);
    }
    return findNodePosByBlockId(view?.state?.doc, currentNode?.attrs?.id ?? null);
  };

  const isNodeSelected = () => {
    const pos = resolveNodePos();
    const selection = view?.state?.selection;
    return (
      Number.isFinite(pos) &&
      selection?.constructor?.name === "NodeSelection" &&
      selection.from === pos
    );
  };

  const applyNodeSelection = () => {
    const pos = resolveNodePos();
    const setNodeSelectionAtPos = view?._internals?.setNodeSelectionAtPos;
    if (!Number.isFinite(pos) || typeof setNodeSelectionAtPos !== "function") {
      return false;
    }
    return setNodeSelectionAtPos(pos) === true;
  };

  const updateLink = (nextNode: any) => {
    const href = sanitizeLinkHref(nextNode.attrs?.href || "");
    link.href = href || "#";
    link.title = String(nextNode.attrs?.name || nextNode.attrs?.href || "Attachment");
    link.download = String(nextNode.attrs?.name || "").trim();
    link.setAttribute("aria-label", link.title);
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || isNodeSelected()) {
      return;
    }
    suppressNextClick = applyNodeSelection();
    if (suppressNextClick) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const handleClick = (event: MouseEvent) => {
    if (suppressNextClick) {
      suppressNextClick = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!isNodeSelected() && applyNodeSelection()) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  link.addEventListener("pointerdown", handlePointerDown, true);
  link.addEventListener("click", handleClick, true);

  updateLink(node);

  return {
    update(nextNode: any) {
      if (nextNode.type !== currentNode.type) return false;
      currentNode = nextNode;
      syncNodeViewBlockId(container, nextNode);
      updateLink(nextNode);
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
      link.removeEventListener("pointerdown", handlePointerDown, true);
      link.removeEventListener("click", handleClick, true);
      container.remove();
    },
    selectNode() {
      suppressNextClick = false;
      container.style.outline = "2px solid #3b82f6";
    },
    deselectNode() {
      suppressNextClick = false;
      container.style.outline = "none";
    },
  };
};
