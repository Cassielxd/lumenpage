const hasFallbackVisualBlockData = (line) =>
  !!line?.imageMeta || !!line?.videoMeta || line?.blockType === "horizontalRule";

const resolveFallbackOwnerX = ({ line, blockAttrs, fallbackX = null }) => {
  if (Number.isFinite(blockAttrs?.codeBlockOuterX)) {
    return Number(blockAttrs.codeBlockOuterX);
  }
  if (hasFallbackVisualBlockData(line) && Number.isFinite(line?.x)) {
    return Number(line.x);
  }
  return Number.isFinite(fallbackX) ? Number(fallbackX) : undefined;
};

const resolveFallbackOwnerWidth = ({ line, blockAttrs, fallbackWidth = null }) => {
  if (Number.isFinite(blockAttrs?.codeBlockOuterWidth)) {
    return Math.max(0, Number(blockAttrs.codeBlockOuterWidth));
  }
  if (Number.isFinite(line?.imageMeta?.width)) {
    return Math.max(0, Number(line.imageMeta.width));
  }
  if (Number.isFinite(line?.videoMeta?.width)) {
    return Math.max(0, Number(line.videoMeta.width));
  }
  if (line?.blockType === "horizontalRule" && Number.isFinite(line?.width)) {
    return Math.max(0, Number(line.width));
  }
  return Number.isFinite(fallbackWidth) ? Math.max(0, Number(fallbackWidth)) : undefined;
};

const resolveFallbackOwnerMeta = ({ line, blockAttrs }) => {
  const meta: Record<string, unknown> = {};
  if (typeof blockAttrs?.codeBlockBackground === "string") {
    meta.codeBlockBackground = blockAttrs.codeBlockBackground;
  }
  if (typeof blockAttrs?.codeBlockBorderColor === "string") {
    meta.codeBlockBorderColor = blockAttrs.codeBlockBorderColor;
  }
  if (line?.imageMeta && typeof line.imageMeta === "object") {
    meta.alt = line.imageMeta.alt || "";
  }
  return meta;
};

export const shiftFragmentOwners = (owners, deltaX = 0, deltaY = 0) => {
  if (!Array.isArray(owners) || owners.length === 0) {
    return owners;
  }

  return owners.map((owner) => {
    if (!owner || typeof owner !== "object") {
      return owner;
    }

    const next = {
      ...owner,
      meta:
        owner?.meta && typeof owner.meta === "object" ? { ...owner.meta } : owner?.meta ?? null,
    };

    if (Number.isFinite(next.x)) {
      next.x = Number(next.x) + deltaX;
    }
    if (Number.isFinite(next.y)) {
      next.y = Number(next.y) + deltaY;
    }

    return next;
  });
};

const withLayoutCapabilities = (meta, capabilities = []) => {
  const base = meta && typeof meta === "object" ? { ...meta } : {};
  if (!Array.isArray(capabilities) || capabilities.length === 0) {
    return Object.keys(base).length > 0 ? base : null;
  }
  const nextCapabilities =
    base.layoutCapabilities && typeof base.layoutCapabilities === "object"
      ? { ...base.layoutCapabilities }
      : {};
  for (const capability of capabilities) {
    if (!capability) {
      continue;
    }
    nextCapabilities[capability] = true;
  }
  base.layoutCapabilities = nextCapabilities;
  return base;
};

const getFragmentOwners = (ownersOrLine) => {
  if (Array.isArray(ownersOrLine)) {
    return ownersOrLine;
  }
  if (Array.isArray(ownersOrLine?.fragmentOwners)) {
    return ownersOrLine.fragmentOwners;
  }
  return [];
};

const getNodeFragmentKey = (node, fallbackPrefix: string) => {
  if (node?.attrs?.id) {
    return `${fallbackPrefix}:${node.attrs.id}`;
  }
  if (typeof node?.hashCode === "function") {
    const hash = node.hashCode();
    if (hash != null) {
      return `${fallbackPrefix}:${String(hash)}`;
    }
  }
  return `${fallbackPrefix}:${node?.type?.name || "block"}`;
};

const getExplicitOwnerMeta = ({ line, blockAttrs }) => {
  const meta =
    (blockAttrs?.fragmentOwnerMeta && typeof blockAttrs.fragmentOwnerMeta === "object"
      ? blockAttrs.fragmentOwnerMeta
      : null) ||
    (line?.fragmentOwnerMeta && typeof line.fragmentOwnerMeta === "object"
      ? line.fragmentOwnerMeta
      : null);
  return meta ? { ...meta } : null;
};

const collectCapabilities = (bag) => {
  if (!bag) {
    return [];
  }
  if (Array.isArray(bag)) {
    return bag.filter(Boolean);
  }
  if (typeof bag === "object") {
    return Object.entries(bag)
      .filter(([, enabled]) => enabled === true)
      .map(([capability]) => capability);
  }
  return [];
};

const getExplicitLayoutCapabilities = ({ line, blockAttrs }) => {
  const candidates = [
    blockAttrs?.layoutCapabilities,
    blockAttrs?.capabilities,
    blockAttrs?.fragmentOwnerMeta?.layoutCapabilities,
    line?.layoutCapabilities,
    line?.blockAttrs?.layoutCapabilities,
    line?.fragmentOwnerMeta?.layoutCapabilities,
  ];
  const capabilities = new Set<string>();
  for (const candidate of candidates) {
    for (const capability of collectCapabilities(candidate)) {
      capabilities.add(capability);
    }
  }
  return Array.from(capabilities);
};

const getExplicitVisualBounds = ({ line, blockAttrs }) => {
  const visualBounds =
    (blockAttrs?.visualBounds && typeof blockAttrs.visualBounds === "object"
      ? blockAttrs.visualBounds
      : null) ||
    (line?.visualBounds && typeof line.visualBounds === "object" ? line.visualBounds : null);
  return visualBounds;
};

const resolveOwnerX = ({ line, blockAttrs, fallbackX = null }) => {
  const visualBounds = getExplicitVisualBounds({ line, blockAttrs });
  if (Number.isFinite(visualBounds?.x)) {
    return Number(visualBounds.x);
  }
  return resolveFallbackOwnerX({ line, blockAttrs, fallbackX });
};

const resolveOwnerWidth = ({ line, blockAttrs, fallbackWidth = null }) => {
  const visualBounds = getExplicitVisualBounds({ line, blockAttrs });
  if (Number.isFinite(visualBounds?.width)) {
    return Math.max(0, Number(visualBounds.width));
  }
  return resolveFallbackOwnerWidth({ line, blockAttrs, fallbackWidth });
};

const resolveOwnerMeta = ({ line, blockAttrs }) => {
  const meta = resolveFallbackOwnerMeta({ line, blockAttrs });
  const explicitMeta = getExplicitOwnerMeta({ line, blockAttrs });
  const explicitCapabilities = getExplicitLayoutCapabilities({ line, blockAttrs });
  return withLayoutCapabilities(
    {
      ...meta,
      ...(explicitMeta || {}),
    },
    [
      ...explicitCapabilities,
      ...(explicitCapabilities.includes("visual-block") || !hasFallbackVisualBlockData(line)
        ? []
        : ["visual-block"]),
    ]
  );
};

export const hasFragmentOwnerType = (ownersOrLine, type, nodeId = null) => {
  if (!type) {
    return false;
  }
  const owners = getFragmentOwners(ownersOrLine);
  return owners.some((owner) => {
    if (!owner || owner.type !== type) {
      return false;
    }
    if (nodeId == null) {
      return true;
    }
    return owner.nodeId === nodeId || owner.blockId === nodeId;
  });
};

export const createImplicitBlockFragmentOwner = ({
  node,
  blockType = null,
  blockId = null,
  blockStart = null,
  line = null,
  blockAttrs = null,
  fallbackX = null,
  fallbackWidth = null,
}) => {
  const type = blockType || node?.type?.name || line?.blockType || "block";
  const nodeId = blockId ?? node?.attrs?.id ?? line?.blockId ?? null;
  const anchorOffset = Number.isFinite(blockStart)
    ? Number(blockStart)
    : Number.isFinite(line?.blockStart)
      ? Number(line.blockStart)
      : Number.isFinite(line?.start)
        ? Number(line.start)
        : null;

  return {
    key: getNodeFragmentKey(node, `block:${type}:${anchorOffset ?? 0}`),
    type,
    role: "block",
    nodeId,
    blockId: nodeId,
    x: resolveOwnerX({ line, blockAttrs, fallbackX }),
    width: resolveOwnerWidth({ line, blockAttrs, fallbackWidth }),
    anchorOffset,
    fixedBounds: false,
    meta: resolveOwnerMeta({ line, blockAttrs }),
  };
};

export const ensureBlockFragmentOwner = ({
  line,
  node,
  blockType = null,
  blockId = null,
  blockStart = null,
  blockAttrs = null,
  fallbackX = null,
  fallbackWidth = null,
}) => {
  const owners = getFragmentOwners(line);
  const type = blockType || node?.type?.name || line?.blockType || "block";
  const nodeId = blockId ?? node?.attrs?.id ?? line?.blockId ?? null;

  if (hasFragmentOwnerType(owners, type, nodeId)) {
    return owners;
  }

  return [
    ...owners,
    createImplicitBlockFragmentOwner({
      node,
      blockType: type,
      blockId: nodeId,
      blockStart,
      line,
      blockAttrs,
      fallbackX,
      fallbackWidth,
    }),
  ];
};
