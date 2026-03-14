import type { LayoutFragment, LayoutFragmentOwner } from "./nodeRegistry";

type MutableLayoutFragment = Omit<LayoutFragment, "children"> & {
  children: MutableLayoutFragment[];
  __children: Map<string, MutableLayoutFragment>;
  __minLineX: number;
  __maxLineRight: number;
  __minLineY: number;
  __maxLineBottom: number;
  __anchorVisible: boolean;
};

const cloneMeta = (meta: Record<string, unknown> | null | undefined) => (meta ? { ...meta } : null);

const getLineLeft = (line: any) => (Number.isFinite(line?.x) ? Number(line.x) : 0);

const getLineTop = (line: any) => (Number.isFinite(line?.y) ? Number(line.y) : 0);

const getLineWidth = (line: any) => (Number.isFinite(line?.width) ? Number(line.width) : 0);

const getLineHeight = (line: any) =>
  Number.isFinite(line?.lineHeight) ? Number(line.lineHeight) : Math.max(1, Number(line?.height) || 0);

const getLineBottom = (line: any) => getLineTop(line) + getLineHeight(line);

const ensureMutableFragment = (
  owner: LayoutFragmentOwner,
  key: string,
  children: MutableLayoutFragment[]
) =>
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
    fixedBounds: owner.fixedBounds === true,
    meta: cloneMeta(owner.meta),
    children,
    __children: new Map<string, MutableLayoutFragment>(),
    __minLineX: Number.POSITIVE_INFINITY,
    __maxLineRight: Number.NEGATIVE_INFINITY,
    __minLineY: Number.POSITIVE_INFINITY,
    __maxLineBottom: Number.NEGATIVE_INFINITY,
    __anchorVisible: false,
  }) satisfies MutableLayoutFragment;

const updateFragmentBounds = (fragment: MutableLayoutFragment, owner: LayoutFragmentOwner, line: any) => {
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

  fragment.__minLineX = Math.min(fragment.__minLineX, lineLeft);
  fragment.__maxLineRight = Math.max(fragment.__maxLineRight, lineRight);
  fragment.__minLineY = Math.min(fragment.__minLineY, lineTop);
  fragment.__maxLineBottom = Math.max(fragment.__maxLineBottom, lineBottom);

  if (tableMeta && typeof tableMeta === "object") {
    const relativeY = Number.isFinite(line?.relativeY) ? Number(line.relativeY) : 0;
    const ownerY = Number.isFinite(owner?.y) ? Number(owner.y) : 0;
    const tableTop = Number.isFinite(tableMeta?.tableTop) ? Number(tableMeta.tableTop) : 0;
    fragment.y = lineTop - relativeY + ownerY + tableTop;
    fragment.height = Number.isFinite(tableMeta?.tableHeight) ? Number(tableMeta.tableHeight) : fragment.height;
    fragment.width = Number.isFinite(tableMeta?.tableWidth) ? Number(tableMeta.tableWidth) : fragment.width;
    fragment.fixedBounds = true;
    fragment.meta = fragment.meta ? { ...fragment.meta, ...tableMeta } : cloneMeta(tableMeta);
  }

  if (Number.isFinite(owner.start)) {
    fragment.start =
      Number.isFinite(fragment.start) && fragment.start != null
        ? Math.min(Number(fragment.start), Number(owner.start))
        : Number(owner.start);
  } else if (Number.isFinite(line?.start)) {
    fragment.start =
      Number.isFinite(fragment.start) && fragment.start != null
        ? Math.min(Number(fragment.start), Number(line.start))
        : Number(line.start);
  }

  if (Number.isFinite(owner.end)) {
    fragment.end =
      Number.isFinite(fragment.end) && fragment.end != null
        ? Math.max(Number(fragment.end), Number(owner.end))
        : Number(owner.end);
  } else if (Number.isFinite(line?.end)) {
    fragment.end =
      Number.isFinite(fragment.end) && fragment.end != null
        ? Math.max(Number(fragment.end), Number(line.end))
        : Number(line.end);
  }

  if (Number.isFinite(owner.anchorOffset)) {
    const anchor = Number(owner.anchorOffset);
    const start = Number.isFinite(line?.start) ? Number(line.start) : anchor;
    const end = Number.isFinite(line?.end) ? Number(line.end) : start;
    if (anchor >= start && anchor <= end) {
      fragment.__anchorVisible = true;
    }
  }

  if (owner.meta && typeof owner.meta === "object") {
    fragment.meta = fragment.meta ? { ...fragment.meta, ...owner.meta } : cloneMeta(owner.meta);
  }
};

const finalizeFragment = (fragment: MutableLayoutFragment): LayoutFragment | null => {
  const children = fragment.children
    .map((child) => finalizeFragment(child))
    .filter((child): child is LayoutFragment => !!child)
    .sort((a, b) => {
      const aY = Number.isFinite(a?.y) ? Number(a.y) : 0;
      const bY = Number.isFinite(b?.y) ? Number(b.y) : 0;
      if (aY !== bY) {
        return aY - bY;
      }
      const aX = Number.isFinite(a?.x) ? Number(a.x) : 0;
      const bX = Number.isFinite(b?.x) ? Number(b.x) : 0;
      return aX - bX;
    });

  const next: LayoutFragment = {
    key: fragment.key,
    type: fragment.type,
    role: fragment.role,
    nodeId: fragment.nodeId ?? null,
    blockId: fragment.blockId ?? null,
    x: fragment.x,
    y: fragment.y,
    width: fragment.width,
    height: fragment.height,
    start: fragment.start ?? null,
    end: fragment.end ?? null,
    fixedBounds: fragment.fixedBounds === true,
    meta: fragment.meta ? { ...fragment.meta } : null,
    children,
  };

  if (fragment.fixedBounds !== true) {
    if (!Number.isFinite(next.x) && Number.isFinite(fragment.__minLineX)) {
      next.x = fragment.__minLineX;
    }
    if (!Number.isFinite(next.y) && Number.isFinite(fragment.__minLineY)) {
      next.y = fragment.__minLineY;
    }
    if (!Number.isFinite(next.width)) {
      if (Number.isFinite(fragment.__maxLineRight) && Number.isFinite(next.x)) {
        next.width = Math.max(0, fragment.__maxLineRight - Number(next.x));
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
      if (Number.isFinite(fragment.__maxLineBottom) && Number.isFinite(next.y)) {
        next.height = Math.max(0, fragment.__maxLineBottom - Number(next.y));
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

  if (fragment.__anchorVisible) {
    next.meta = next.meta ? { ...next.meta, anchorVisible: true } : { anchorVisible: true };
  }

  if (children.length === 0) {
    delete next.children;
  }

  return next;
};

export const buildPageFragmentsFromLines = (lines: any[]) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    return [];
  }

  const roots: MutableLayoutFragment[] = [];
  const rootMap = new Map<string, MutableLayoutFragment>();

  for (const line of lines) {
    const owners = Array.isArray(line?.fragmentOwners) ? line.fragmentOwners : [];
    if (owners.length === 0) {
      continue;
    }

    let parentKey = "";
    let parentChildren = roots;
    let parentMap = rootMap;

    for (const owner of owners) {
      if (!owner || !owner.key || !owner.type) {
        continue;
      }
      const pathKey = parentKey ? `${parentKey}/${owner.key}` : owner.key;
      let fragment = parentMap.get(pathKey);
      if (!fragment) {
        fragment = ensureMutableFragment(owner, pathKey, []);
        parentChildren.push(fragment);
        parentMap.set(pathKey, fragment);
      }

      updateFragmentBounds(fragment, owner, line);

      parentKey = pathKey;
      parentChildren = fragment.children;
      parentMap = fragment.__children;
    }
  }

  return roots
    .map((fragment) => finalizeFragment(fragment))
    .filter((fragment): fragment is LayoutFragment => !!fragment)
    .sort((a, b) => {
      const aY = Number.isFinite(a?.y) ? Number(a.y) : 0;
      const bY = Number.isFinite(b?.y) ? Number(b.y) : 0;
      if (aY !== bY) {
        return aY - bY;
      }
      const aX = Number.isFinite(a?.x) ? Number(a.x) : 0;
      const bX = Number.isFinite(b?.x) ? Number(b.x) : 0;
      return aX - bX;
    });
};
