import { defaultWebPageRenderer as baseWebPageRenderer } from "lumenpage-render-engine";
import { sanitizeLinkHref } from "lumenpage-link";

const resolveOverlayHost = (view: any) =>
  view?.overlayHost ||
  view?._internals?.dom?.overlayHost ||
  view?.dom?.querySelector?.(".lumenpage-overlay-host") ||
  null;

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

export const createDefaultWebPageNodeView = (node: any, view: any) => {
  const host = resolveOverlayHost(view);
  if (!host) return null;

  const container = document.createElement("div");
  container.className = "lumenpage-web-page-overlay";
  container.style.position = "absolute";
  container.style.transform = "translate(0px, 0px)";
  container.style.width = "0";
  container.style.height = "0";
  container.style.pointerEvents = "auto";
  container.style.overflow = "hidden";
  container.style.background = "#ffffff";
  container.style.border = "1px solid #cbd5e1";
  host.appendChild(container);

  const header = document.createElement("div");
  header.style.height = "40px";
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.gap = "12px";
  header.style.padding = "0 12px";
  header.style.background = "#e2e8f0";
  header.style.boxSizing = "border-box";
  container.appendChild(header);

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

  const frame = document.createElement("iframe");
  frame.style.display = "block";
  frame.style.width = "100%";
  frame.style.height = "calc(100% - 40px)";
  frame.style.border = "0";
  frame.style.background = "#ffffff";
  frame.setAttribute("loading", "lazy");
  frame.setAttribute("referrerpolicy", "no-referrer");
  container.appendChild(frame);

  let currentNode = node;

  const updateFrame = (nextNode: any) => {
    const href = sanitizeWebPageHref(nextNode.attrs?.href || "");
    title.textContent = String(nextNode.attrs?.title || href || "Embedded page");
    link.href = href || "#";
    frame.src = href || "about:blank";
    frame.title = String(nextNode.attrs?.title || "Embedded page");
  };

  updateFrame(node);

  return {
    update(nextNode: any) {
      if (nextNode.type !== currentNode.type) return false;
      currentNode = nextNode;
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

export const webPageRenderer = {
  ...baseWebPageRenderer,
  createNodeView: createDefaultWebPageNodeView,
};
