import { sanitizeLinkHref } from "lumenpage-link";

const resolveOverlayHost = (view: any) =>
  view?.overlayHost ||
  view?._internals?.dom?.overlayHost ||
  view?.dom?.querySelector?.(".lumenpage-overlay-host") ||
  null;

export const createDefaultFileNodeView = (node: any, view: any) => {
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

  const updateLink = (nextNode: any) => {
    const href = sanitizeLinkHref(nextNode.attrs?.href || "");
    link.href = href || "#";
    link.title = String(nextNode.attrs?.name || nextNode.attrs?.href || "Attachment");
    link.download = String(nextNode.attrs?.name || "").trim();
    link.setAttribute("aria-label", link.title);
  };

  updateLink(node);

  return {
    update(nextNode: any) {
      if (nextNode.type !== currentNode.type) return false;
      currentNode = nextNode;
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
