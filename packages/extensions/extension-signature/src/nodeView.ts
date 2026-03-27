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

export const createDefaultSignatureNodeView = (node: any, view: any) => {
  const host = resolveOverlayHost(view);
  if (!host) {
    return null;
  }

  const container = document.createElement("div");
  container.className = "lumenpage-signature-overlay";
  container.style.position = "absolute";
  container.style.transform = "translate(0px, 0px)";
  container.style.width = "0";
  container.style.height = "0";
  container.style.pointerEvents = "none";
  container.style.overflow = "visible";
  container.style.outline = "none";
  syncNodeViewBlockId(container, node);
  host.appendChild(container);

  const image = document.createElement("img");
  image.style.width = "100%";
  image.style.height = "100%";
  image.style.objectFit = "contain";
  image.style.display = "block";
  image.draggable = false;
  container.appendChild(image);

  let currentNode = node;

  const updateImage = (nextNode: any) => {
    const src = String(nextNode.attrs?.src || "").trim();
    if (src) {
      image.src = src;
      image.style.visibility = "visible";
    } else {
      image.removeAttribute("src");
      image.style.visibility = "hidden";
    }
    image.alt = String(nextNode.attrs?.signer || "Signature");
    image.style.background = String(nextNode.attrs?.backgroundColor || "transparent");
  };

  updateImage(node);

  return {
    get dom() {
      return container;
    },
    update(nextNode: any) {
      if (nextNode.type !== currentNode.type) {
        return false;
      }
      currentNode = nextNode;
      syncNodeViewBlockId(container, nextNode);
      updateImage(nextNode);
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
      container.style.outline = "2px solid #2563eb";
    },
    deselectNode() {
      container.style.outline = "none";
    },
  };
};
