import { Plugin } from "lumenpage-state";

type NodeViewFactory = (node: any, view: any, getPos: () => number) => any;

type DragHandleOptions = {
  schema: any;
  nodeRegistry: any;
  includeTypes?: string[];
  excludeTypes?: string[];
  onlyTopLevel?: boolean;
  size?: number;
  insetTop?: number;
  insetLeft?: number;
};

const isBlockNodeType = (type: any) => {
  const group = type?.spec?.group;
  return typeof group === "string" && group.split(" ").includes("block");
};

const resolveBlockNodeTypes = (schema: any) => {
  const names = Object.keys(schema?.nodes ?? {});
  return names.filter((name) => isBlockNodeType(schema?.nodes?.[name]));
};

const resolveOverlayHost = (view: any) =>
  view?.overlayHost ||
  view?._internals?.dom?.overlayHost ||
  view?.dom?.querySelector?.(".lumenpage-overlay-host") ||
  null;

const resolveScrollArea = (view: any) =>
  view?._internals?.dom?.scrollArea ||
  view?.dom?.querySelector?.(".lumenpage-scroll-area") ||
  null;

const createGripDots = () => {
  const dots = document.createElement("div");
  dots.style.width = "8px";
  dots.style.height = "10px";
  dots.style.display = "grid";
  dots.style.gridTemplateColumns = "repeat(2, 1fr)";
  dots.style.gridTemplateRows = "repeat(3, 1fr)";
  dots.style.gap = "1px";
  dots.style.margin = "2px auto 0";
  dots.style.pointerEvents = "none";
  for (let i = 0; i < 6; i += 1) {
    const dot = document.createElement("span");
    dot.style.width = "3px";
    dot.style.height = "3px";
    dot.style.borderRadius = "999px";
    dot.style.background = "#64748b";
    dot.style.display = "block";
    dots.appendChild(dot);
  }
  return dots;
};

const createHandleElement = (size: number) => {
  const handle = document.createElement("div");
  handle.className = "lumenpage-block-drag-handle";
  handle.draggable = true;
  handle.title = "Drag block";
  handle.style.position = "absolute";
  handle.style.width = `${size}px`;
  handle.style.height = `${size}px`;
  handle.style.borderRadius = "4px";
  handle.style.background = "rgba(255, 255, 255, 0.96)";
  handle.style.border = "1px solid rgba(148, 163, 184, 0.72)";
  handle.style.boxShadow = "0 1px 2px rgba(15, 23, 42, 0.16)";
  handle.style.cursor = "grab";
  handle.style.pointerEvents = "auto";
  handle.style.zIndex = "12";
  handle.style.display = "none";
  handle.style.boxSizing = "border-box";
  handle.style.userSelect = "none";
  handle.appendChild(createGripDots());
  return handle;
};

const applyDragPosAttribute = (el: HTMLElement, getPos: () => number) => {
  const pos = typeof getPos === "function" ? getPos() : null;
  if (Number.isFinite(pos)) {
    el.setAttribute("data-lumen-drag-pos", String(pos));
  } else {
    el.removeAttribute("data-lumen-drag-pos");
  }
};

const createWrappedFactory = ({
  baseFactory,
  size,
  insetTop,
  insetLeft,
  onlyTopLevel,
}: {
  baseFactory?: NodeViewFactory | null;
  size: number;
  insetTop: number;
  insetLeft: number;
  onlyTopLevel: boolean;
}): NodeViewFactory => {
  return (node: any, view: any, getPos: () => number) => {
    const baseView = typeof baseFactory === "function" ? baseFactory(node, view, getPos) : null;
    const host = resolveOverlayHost(view);
    const scrollArea = resolveScrollArea(view);
    if (!host || !scrollArea) {
      return baseView;
    }

    const handle = createHandleElement(size);
    host.appendChild(handle);

    let currentNode = node;
    let blockRect = { x: 0, y: 0, width: 0, height: 0, visible: false };
    let blockHovered = false;
    let handleHovered = false;
    let handlePinned = false;

    const isDepthEligible = () => {
      const nodeType = currentNode?.type?.name;
      if (nodeType === "image" || nodeType === "video") {
        return true;
      }
      if (!onlyTopLevel) {
        return true;
      }
      const pos = typeof getPos === "function" ? getPos() : null;
      if (!Number.isFinite(pos)) {
        return false;
      }
      const state = view?.state;
      if (!state?.doc?.resolve) {
        return false;
      }
      try {
        const insidePos = Math.min(state.doc.content.size, Math.max(0, pos + 1));
        return state.doc.resolve(insidePos).depth === 1;
      } catch (_error) {
        return false;
      }
    };

    const refreshVisibility = () => {
      if (!isDepthEligible()) {
        handle.style.display = "none";
        return;
      }
      const alwaysVisible =
        currentNode?.type?.name === "image" || currentNode?.type?.name === "video";
      const shouldShow = blockRect.visible && (alwaysVisible || blockHovered || handleHovered || handlePinned);
      handle.style.display = shouldShow ? "block" : "none";
    };

    const ownerDocument = view?.dom?.ownerDocument || document;

    const onGlobalPointerMove = (event: PointerEvent) => {
      const areaRect = scrollArea.getBoundingClientRect();
      if (
        event.clientX < areaRect.left ||
        event.clientX > areaRect.right ||
        event.clientY < areaRect.top ||
        event.clientY > areaRect.bottom
      ) {
        if (blockHovered) {
          blockHovered = false;
          refreshVisibility();
        }
        return;
      }
      if (!blockRect.visible) {
        if (blockHovered) {
          blockHovered = false;
          refreshVisibility();
        }
        return;
      }
      const x = event.clientX - areaRect.left;
      const y = event.clientY - areaRect.top;
      const hovered =
        x >= blockRect.x - size - insetLeft - 6 &&
        x <= blockRect.x + blockRect.width &&
        y >= blockRect.y &&
        y <= blockRect.y + blockRect.height;
      if (hovered !== blockHovered) {
        blockHovered = hovered;
        refreshVisibility();
      }
    };

    const onGlobalPointerUp = () => {
      if (!handlePinned) {
        return;
      }
      handlePinned = false;
      refreshVisibility();
    };

    const onHandlePointerEnter = () => {
      handleHovered = true;
      refreshVisibility();
    };

    const onHandlePointerLeave = () => {
      handleHovered = false;
      refreshVisibility();
    };

    handle.addEventListener("pointerenter", onHandlePointerEnter);
    handle.addEventListener("pointerleave", onHandlePointerLeave);
    handle.addEventListener("pointerdown", () => {
      handlePinned = true;
      refreshVisibility();
      applyDragPosAttribute(handle, getPos);
    });
    handle.addEventListener("dragstart", () => applyDragPosAttribute(handle, getPos));
    handle.addEventListener("dragend", () => {
      handle.removeAttribute("data-lumen-drag-pos");
      handlePinned = false;
      refreshVisibility();
    });

    ownerDocument.addEventListener("pointermove", onGlobalPointerMove, true);
    ownerDocument.addEventListener("pointerup", onGlobalPointerUp, true);

    return {
      update(nextNode: any, decorations: any) {
        if (nextNode.type !== currentNode.type) {
          return false;
        }
        currentNode = nextNode;
        const updated = baseView?.update?.(nextNode, decorations);
        return updated !== false;
      },
      syncDOM(ctx: any) {
        baseView?.syncDOM?.(ctx);
        if (!Number.isFinite(ctx?.x) || !Number.isFinite(ctx?.y)) {
          blockRect = { x: 0, y: 0, width: 0, height: 0, visible: false };
          refreshVisibility();
          return;
        }
        const width = Math.max(1, Number(ctx.width) || 0);
        const height = Math.max(1, Number(ctx.height) || 0);
        const x = Number(ctx.x);
        const y = Number(ctx.y);
        blockRect = { x, y, width, height, visible: ctx.visible !== false };
        // Align all handles to the page content left edge, so different block indents
        // (table/list/media internal offsets) don't cause jagged left positions.
        let handleAnchorX = x;
        const lineX = Number(ctx?.line?.x);
        const marginLeft = Number(ctx?.layout?.margin?.left);
        if (Number.isFinite(lineX) && Number.isFinite(marginLeft)) {
          handleAnchorX = x - (lineX - marginLeft);
        }
        const handleX = Math.round(handleAnchorX - size - insetLeft);
        const handleY = Math.round(y + insetTop);
        handle.style.transform = `translate(${handleX}px, ${handleY}px)`;
        refreshVisibility();
      },
      handleClick(x: number, y: number) {
        return baseView?.handleClick?.(x, y) ?? false;
      },
      handleDoubleClick(x: number, y: number) {
        return baseView?.handleDoubleClick?.(x, y) ?? false;
      },
      selectNode() {
        baseView?.selectNode?.();
      },
      deselectNode() {
        baseView?.deselectNode?.();
      },
      destroy() {
        ownerDocument.removeEventListener("pointermove", onGlobalPointerMove, true);
        ownerDocument.removeEventListener("pointerup", onGlobalPointerUp, true);
        handle.remove();
        baseView?.destroy?.();
      },
    };
  };
};

export const createBlockDragHandleNodeViews = ({
  schema,
  nodeRegistry,
  includeTypes = [],
  excludeTypes = [],
  onlyTopLevel = false,
  size = 14,
  insetTop = 2,
  insetLeft = 4,
}: DragHandleOptions): Record<string, NodeViewFactory> => {
  const allBlockTypes = includeTypes.length > 0 ? includeTypes : resolveBlockNodeTypes(schema);
  const excludes = new Set(excludeTypes);
  const nodeViews: Record<string, NodeViewFactory> = {};

  for (const typeName of allBlockTypes) {
    if (excludes.has(typeName)) {
      continue;
    }
    const baseFactory = nodeRegistry?.get?.(typeName)?.createNodeView ?? null;
    nodeViews[typeName] = createWrappedFactory({
      baseFactory,
      size,
      insetTop,
      insetLeft,
      onlyTopLevel,
    });
  }

  return nodeViews;
};

export const createDragHandlePlugin = (options: DragHandleOptions) =>
  new Plugin({
    props: {
      nodeViews: createBlockDragHandleNodeViews(options),
      resolveDragNodePos: (_view: any, event: any) => {
        const target = event?.target?.closest?.("[data-lumen-drag-pos]");
        const attr = target?.getAttribute?.("data-lumen-drag-pos");
        const pos = Number(attr);
        return Number.isFinite(pos) ? pos : null;
      },
    },
  });

