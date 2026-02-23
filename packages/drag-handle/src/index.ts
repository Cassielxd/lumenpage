import { Plugin } from "lumenpage-state";
import { Decoration } from "lumenpage-view-canvas";

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
  dropCursor?:
    | boolean
    | {
        color?: string;
        width?: number;
      };
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
  // Use internal pointer-driven drag pipeline only. Native draggable on the handle
  // can trigger browser drag/drop side effects on simple clicks.
  handle.draggable = false;
  handle.title = "Drag block";
  handle.style.position = "absolute";
  handle.style.width = `${size}px`;
  handle.style.height = `${size}px`;
  handle.style.borderRadius = "0";
  handle.style.background = "rgba(255, 255, 255, 0.96)";
  handle.style.border = "1px solid rgba(148, 163, 184, 0.72)";
  handle.style.boxShadow = "0 1px 2px rgba(15, 23, 42, 0.16)";
  handle.style.cursor = "grab";
  handle.style.pointerEvents = "auto";
  handle.style.zIndex = "1";
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
    let handleRect = { x: 0, y: 0, width: size, height: size, visible: false };
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
      const hoverPadding = 6;
      const hoverLeft = Math.min(blockRect.x - size - insetLeft, handleRect.x) - hoverPadding;
      const hoverRight = Math.max(blockRect.x + blockRect.width, handleRect.x + handleRect.width) + hoverPadding;
      const hoverTop = Math.min(blockRect.y, handleRect.y) - hoverPadding;
      const hoverBottom = Math.max(blockRect.y + blockRect.height, handleRect.y + handleRect.height) + hoverPadding;
      const hovered = x >= hoverLeft && x <= hoverRight && y >= hoverTop && y <= hoverBottom;
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
      handle.removeAttribute("data-lumen-drag-pos");
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
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      handlePinned = true;
      refreshVisibility();
      applyDragPosAttribute(handle, getPos);
    });
    // Drag is handled by internal pointer pipeline. Prevent native HTML5 drag here.
    handle.addEventListener("dragstart", (event) => {
      event.preventDefault();
      applyDragPosAttribute(handle, getPos);
    });
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
        handleRect = {
          x: handleX,
          y: handleY,
          width: size,
          height: size,
          visible: ctx.visible !== false,
        };
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
  size = 18,
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
      dropCursor:
        options?.dropCursor === undefined ? { color: "#2563eb", width: 2 } : options.dropCursor,
      createDropCursorDecoration: (_view: any, pos: number, context: any) => {
        if (options?.dropCursor === false) {
          return null;
        }
        const color = context?.color || "#2563eb";
        const width = Number.isFinite(context?.width) ? context.width : 2;
        const height = Number.isFinite(context?.height) ? context.height : 22;
        const isBlockBoundary = context?.isBlockBoundary === true;
        const isVisualBlock = context?.isVisualBlock === true;
        const blockWidth = Number.isFinite(context?.blockWidth) ? Number(context.blockWidth) : 0;
        const isLineEnd = context?.isLineEnd === true;
        const lineX = Number.isFinite(context?.lineX) ? Number(context.lineX) : null;
        const marginLeft = Number.isFinite(context?.marginLeft) ? Number(context.marginLeft) : null;
        const contentWidth = Number.isFinite(context?.contentWidth)
          ? Math.max(1, Number(context.contentWidth))
          : blockWidth;
        if ((isBlockBoundary || isVisualBlock) && contentWidth > 0) {
          const thickness = Math.max(1, Math.round(width));
        return Decoration.widget(
          pos,
          (ctx, x, y, renderHeight) => {
            const widgetHeight = Number.isFinite(renderHeight) ? Number(renderHeight) : height;
            const lineTop = y - Math.max(0, (height - widgetHeight) / 2);
            const lineStartX = isLineEnd ? x - blockWidth : x;
            const left =
              Number.isFinite(lineX) && Number.isFinite(marginLeft)
                ? lineStartX - (lineX - marginLeft)
                : lineStartX;
            const top = isLineEnd
                ? lineTop + height - thickness / 2
                : lineTop - thickness / 2;
            ctx.fillStyle = color;
            ctx.fillRect(left, top, contentWidth, thickness);
          },
          { side: isLineEnd ? 1 : -1 }
        );
        }
        return Decoration.widget(
          pos,
          (ctx, x, y, renderHeight) => {
            const widgetHeight = Number.isFinite(renderHeight) ? Number(renderHeight) : height;
            const lineTop = y - Math.max(0, (height - widgetHeight) / 2);
            ctx.fillStyle = color;
            ctx.fillRect(x - width / 2, lineTop, width, height);
          },
          { side: 1 }
        );
      },
      resolveDragNodePos: (_view: any, event: any) => {
        const target = event?.target?.closest?.("[data-lumen-drag-pos]");
        const attr = target?.getAttribute?.("data-lumen-drag-pos");
        const pos = Number(attr);
        return Number.isFinite(pos) ? pos : null;
      },
    },
  });



