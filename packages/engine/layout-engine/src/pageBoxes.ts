import type { LayoutBox, LayoutFragmentOwner } from "./nodeRegistry.js";

const TEXT_LINE_FRAGMENT_TYPE = "text-line";

type MutableLayoutBox = Omit<LayoutBox, "children"> & {
  children: MutableLayoutBox[];
  __children: Map<string, MutableLayoutBox>;
  __minLineX: number;
  __maxLineRight: number;
  __minLineY: number;
  __maxLineBottom: number;
  __anchorVisible: boolean;
};

export type PageBoxCollector = {
  consumeLine: (line: any) => void;
  finalize: () => LayoutBox[];
};

const cloneMeta = (meta: Record<string, unknown> | null | undefined) => (meta ? { ...meta } : null);

const withLayoutCapabilities = (meta: Record<string, unknown> | null | undefined, capability: string) => {
  const next = cloneMeta(meta) || {};
  const layoutCapabilities =
    next.layoutCapabilities && typeof next.layoutCapabilities === "object"
      ? { ...(next.layoutCapabilities as Record<string, unknown>) }
      : {};
  layoutCapabilities[capability] = true;
  next.layoutCapabilities = layoutCapabilities;
  return next;
};

const getLineLeft = (line: any) => (Number.isFinite(line?.x) ? Number(line.x) : 0);

const getLineTop = (line: any) => (Number.isFinite(line?.y) ? Number(line.y) : 0);

const getLineWidth = (line: any) => (Number.isFinite(line?.width) ? Number(line.width) : 0);

const getLineHeight = (line: any) =>
  Number.isFinite(line?.lineHeight) ? Number(line.lineHeight) : Math.max(1, Number(line?.height) || 0);

const getLineBottom = (line: any) => getLineTop(line) + getLineHeight(line);

const lineHasTextPayload = (line: any) => {
  if (typeof line?.text === "string" && line.text.length > 0) {
    return true;
  }
  if (!Array.isArray(line?.runs) || line.runs.length === 0) {
    return false;
  }
  return line.runs.some((run: any) => typeof run?.text === "string" && run.text.length > 0);
};

const sortBoxesByPosition = <T extends { x?: number; y?: number }>(boxes: T[]) =>
  boxes.sort((a, b) => {
    const aY = Number.isFinite(a?.y) ? Number(a.y) : 0;
    const bY = Number.isFinite(b?.y) ? Number(b.y) : 0;
    if (aY !== bY) {
      return aY - bY;
    }
    const aX = Number.isFinite(a?.x) ? Number(a.x) : 0;
    const bX = Number.isFinite(b?.x) ? Number(b.x) : 0;
    return aX - bX;
  });

const ensureMutableBox = (owner: LayoutFragmentOwner, key: string, children: MutableLayoutBox[]) =>
  ({
    key,
    type: owner.type,
    role: owner.role,
    nodeId: owner.nodeId ?? null,
    blockId: owner.blockId ?? null,
    x: Number.isFinite(owner.x) ? Number(owner.x) : undefined,
    y: Number.isFinite(owner.y) ? Number(owner.y) : undefined,
    width: Number.isFinite(owner.width) ? Number(owner.width) : undefined,
    height: Number.isFinite(owner.height) ? Number(owner.height) : undefined,
    start: Number.isFinite(owner.start) ? Number(owner.start) : null,
    end: Number.isFinite(owner.end) ? Number(owner.end) : null,
    anchorOffset: Number.isFinite(owner.anchorOffset) ? Number(owner.anchorOffset) : null,
    fixedBounds: owner.fixedBounds === true,
    meta: cloneMeta(owner.meta),
    children,
    __children: new Map<string, MutableLayoutBox>(),
    __minLineX: Number.POSITIVE_INFINITY,
    __maxLineRight: Number.NEGATIVE_INFINITY,
    __minLineY: Number.POSITIVE_INFINITY,
    __maxLineBottom: Number.NEGATIVE_INFINITY,
    __anchorVisible: false,
  }) satisfies MutableLayoutBox;

const createTextLineOwner = (
  line: any,
  key: string,
  lineIndex: number
): LayoutFragmentOwner => ({
  key,
  type: TEXT_LINE_FRAGMENT_TYPE,
  role: TEXT_LINE_FRAGMENT_TYPE,
  nodeId: null,
  blockId: null,
  x: getLineLeft(line),
  y: getLineTop(line),
  width: getLineWidth(line),
  height: getLineHeight(line),
  start: Number.isFinite(line?.start) ? Number(line.start) : null,
  end: Number.isFinite(line?.end) ? Number(line.end) : null,
  fixedBounds: true,
  meta: {
    lineKey: key,
    lineIndex,
    blockType: line?.blockType ?? null,
    blockId: line?.blockId ?? null,
  },
});

const getLineContainerOwners = (line: any): LayoutFragmentOwner[] => {
  const containers = Array.isArray(line?.containers) ? line.containers : [];
  if (containers.length === 0) {
    return [];
  }

  return containers
    .map((container): LayoutFragmentOwner | null => {
      if (!container || typeof container !== "object" || !container.type) {
        return null;
      }

      const baseX = Number.isFinite(container.baseX)
        ? Number(container.baseX)
        : Number.isFinite(container.offset)
          ? Number(container.offset)
          : 0;
      const borderInset = Number.isFinite(container.borderInset) ? Number(container.borderInset) : 0;
      const borderWidth = Number.isFinite(container.borderWidth) ? Number(container.borderWidth) : null;

      return {
        key:
          typeof container.key === "string" && container.key.length > 0
            ? container.key
            : `container:${String(container.type)}`,
        type: String(container.type),
        role: String(container.role || "container"),
        nodeId: container.nodeId ?? null,
        blockId: container.blockId ?? null,
        x: baseX + borderInset,
        y: undefined,
        width: borderWidth != null ? Math.max(0, borderWidth) : undefined,
        height: undefined,
        start: null,
        end: null,
        fixedBounds: false,
        meta: withLayoutCapabilities(
          {
            borderColor: container.borderColor ?? null,
            borderWidth,
            borderInset,
            indent: Number.isFinite(container.indent) ? Number(container.indent) : 0,
            baseX,
          },
          "container-chrome"
        ),
      };
    })
    .filter((owner): owner is LayoutFragmentOwner => !!owner);
};

const updateBoxBounds = (box: MutableLayoutBox, owner: LayoutFragmentOwner, line: any) => {
  const lineLeft = getLineLeft(line);
  const lineRight = lineLeft + getLineWidth(line);
  const lineTop = getLineTop(line);
  const lineBottom = getLineBottom(line);
  const ownerTableMeta =
    owner?.role === "table" && owner?.meta && typeof owner.meta === "object"
      ? owner.meta
      : null;
  const tableMeta =
    owner?.role === "table" && line && typeof line === "object"
      ? ownerTableMeta || line.tableOwnerMeta || line.tableMeta || null
      : null;

  box.__minLineX = Math.min(box.__minLineX, lineLeft);
  box.__maxLineRight = Math.max(box.__maxLineRight, lineRight);
  box.__minLineY = Math.min(box.__minLineY, lineTop);
  box.__maxLineBottom = Math.max(box.__maxLineBottom, lineBottom);

  if (tableMeta && typeof tableMeta === "object") {
    const relativeY = Number.isFinite(line?.relativeY) ? Number(line.relativeY) : 0;
    const ownerY = Number.isFinite(owner?.y) ? Number(owner.y) : null;
    const tableTop = Number.isFinite(tableMeta?.tableTop) ? Number(tableMeta.tableTop) : 0;
    const baseY = Number.isFinite(ownerY) ? Number(ownerY) : lineTop - relativeY;
    box.y = baseY + tableTop;
    box.height = Number.isFinite(tableMeta?.tableHeight) ? Number(tableMeta.tableHeight) : box.height;
    box.width = Number.isFinite(tableMeta?.tableWidth) ? Number(tableMeta.tableWidth) : box.width;
    box.fixedBounds = true;
    box.meta = box.meta ? { ...box.meta, ...tableMeta } : cloneMeta(tableMeta);
  }

  if (Number.isFinite(owner.start)) {
    box.start =
      Number.isFinite(box.start) && box.start != null
        ? Math.min(Number(box.start), Number(owner.start))
        : Number(owner.start);
  } else if (Number.isFinite(line?.start)) {
    box.start =
      Number.isFinite(box.start) && box.start != null
        ? Math.min(Number(box.start), Number(line.start))
        : Number(line.start);
  }

  if (Number.isFinite(owner.end)) {
    box.end =
      Number.isFinite(box.end) && box.end != null
        ? Math.max(Number(box.end), Number(owner.end))
        : Number(owner.end);
  } else if (Number.isFinite(line?.end)) {
    box.end =
      Number.isFinite(box.end) && box.end != null
        ? Math.max(Number(box.end), Number(line.end))
        : Number(line.end);
  }

  if (Number.isFinite(owner.anchorOffset)) {
    box.anchorOffset = Number(owner.anchorOffset);
    const anchor = Number(owner.anchorOffset);
    const start = Number.isFinite(line?.start) ? Number(line.start) : anchor;
    const end = Number.isFinite(line?.end) ? Number(line.end) : start;
    if (anchor >= start && anchor <= end) {
      box.__anchorVisible = true;
    }
  }

  if (owner.meta && typeof owner.meta === "object") {
    box.meta = box.meta ? { ...box.meta, ...owner.meta } : cloneMeta(owner.meta);
  }
};

const finalizeBox = (box: MutableLayoutBox): LayoutBox | null => {
  const children = sortBoxesByPosition(
    box.children.map((child) => finalizeBox(child)).filter((child): child is LayoutBox => !!child)
  );

  const next: LayoutBox = {
    key: box.key,
    type: box.type,
    role: box.role,
    nodeId: box.nodeId ?? null,
    blockId: box.blockId ?? null,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    start: box.start ?? null,
    end: box.end ?? null,
    anchorOffset: box.anchorOffset ?? null,
    fixedBounds: box.fixedBounds === true,
    meta: box.meta ? { ...box.meta } : null,
    children,
  };

  if (box.fixedBounds !== true) {
    if (!Number.isFinite(next.x) && Number.isFinite(box.__minLineX)) {
      next.x = box.__minLineX;
    }
    if (!Number.isFinite(next.y) && Number.isFinite(box.__minLineY)) {
      next.y = box.__minLineY;
    }
    if (!Number.isFinite(next.width)) {
      if (Number.isFinite(box.__maxLineRight) && Number.isFinite(next.x)) {
        next.width = Math.max(0, box.__maxLineRight - Number(next.x));
      } else if (children.length > 0) {
        const minChildX = Math.min(...children.map((child) => Number(child.x) || 0));
        const maxChildRight = Math.max(
          ...children.map((child) => (Number(child.x) || 0) + (Number(child.width) || 0))
        );
        next.x = Number.isFinite(next.x) ? next.x : minChildX;
        next.width = Math.max(0, maxChildRight - Number(next.x));
      }
    }
    if (!Number.isFinite(next.height)) {
      if (Number.isFinite(box.__maxLineBottom) && Number.isFinite(next.y)) {
        next.height = Math.max(0, box.__maxLineBottom - Number(next.y));
      } else if (children.length > 0) {
        const minChildY = Math.min(...children.map((child) => Number(child.y) || 0));
        const maxChildBottom = Math.max(
          ...children.map((child) => (Number(child.y) || 0) + (Number(child.height) || 0))
        );
        next.y = Number.isFinite(next.y) ? next.y : minChildY;
        next.height = Math.max(0, maxChildBottom - Number(next.y));
      }
    }
  }

  if (box.__anchorVisible) {
    next.meta = next.meta ? { ...next.meta, anchorVisible: true } : { anchorVisible: true };
  }

  if (children.length === 0) {
    delete next.children;
  }

  return next;
};

export const createPageBoxCollector = (): PageBoxCollector => {
  const roots: MutableLayoutBox[] = [];
  const rootMap = new Map<string, MutableLayoutBox>();
  let lineIndex = 0;

  const consumeLine = (line: any) => {
    const currentLineIndex = lineIndex;
    lineIndex += 1;
    line.__pageLineIndex = currentLineIndex;
    const owners = [
      ...getLineContainerOwners(line),
      ...(Array.isArray(line?.fragmentOwners) ? line.fragmentOwners : []),
    ];
    if (owners.length === 0) {
      return;
    }

    let parentKey = "";
    let parentChildren = roots;
    let parentMap = rootMap;

    for (const owner of owners) {
      if (!owner || !owner.key || !owner.type) {
        continue;
      }
      const pathKey = parentKey ? `${parentKey}/${owner.key}` : owner.key;
      let box = parentMap.get(pathKey);
      if (!box) {
        box = ensureMutableBox(owner, pathKey, []);
        parentChildren.push(box);
        parentMap.set(pathKey, box);
      }

      updateBoxBounds(box, owner, line);

      parentKey = pathKey;
      parentChildren = box.children;
      parentMap = box.__children;
    }

    if (parentKey && lineHasTextPayload(line)) {
      const textLineKey = `${parentKey}/${TEXT_LINE_FRAGMENT_TYPE}:${currentLineIndex}`;
      line.__textLineFragmentKey = textLineKey;
      let textLineBox = parentMap.get(textLineKey);
      if (!textLineBox) {
        textLineBox = ensureMutableBox(createTextLineOwner(line, textLineKey, currentLineIndex), textLineKey, []);
        parentChildren.push(textLineBox);
        parentMap.set(textLineKey, textLineBox);
      }
    }
  };

  const finalize = () =>
    sortBoxesByPosition(
      roots.map((box) => finalizeBox(box)).filter((box): box is LayoutBox => !!box)
    );

  return {
    consumeLine,
    finalize,
  };
};

export const buildPageBoxesFromLines = (lines: any[]) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    return [];
  }

  const collector = createPageBoxCollector();
  for (const line of lines) {
    collector.consumeLine(line);
  }

  return collector.finalize();
};
