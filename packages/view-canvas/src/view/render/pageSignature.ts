import { resolveLineRenderPlan } from "./lineRenderPlan";

const hashNumber = (hash: number, value: unknown) => {
  const num = Number.isFinite(value) ? Math.round(Number(value)) : 0;

  return (hash * 31 + num) | 0;
};

const hashString = (hash: number, value: unknown) => {
  if (!value) {
    return hash;
  }

  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) | 0;
  }

  return hash;
};

const hashObjectLike = (hash: number, value: unknown, cache?: WeakMap<object, number>) => {
  if (!value || typeof value !== "object") {
    return hash;
  }
  if (cache?.has(value)) {
    return hashNumber(hash, cache.get(value) || 0);
  }
  const keys = Object.keys(value).sort();
  let objectHash = 17;
  for (const key of keys) {
    objectHash = hashString(objectHash, key);
    const item = (value as Record<string, unknown>)[key];
    if (typeof item === "string") {
      objectHash = hashString(objectHash, item);
      continue;
    }
    if (typeof item === "number") {
      objectHash = hashNumber(objectHash, item);
      continue;
    }
    if (typeof item === "boolean") {
      objectHash = hashNumber(objectHash, item ? 1 : 0);
      continue;
    }
    if (Array.isArray(item)) {
      objectHash = hashNumber(objectHash, item.length);
      for (const entry of item) {
        if (typeof entry === "string") {
          objectHash = hashString(objectHash, entry);
        } else if (typeof entry === "number") {
          objectHash = hashNumber(objectHash, entry);
        } else if (typeof entry === "boolean") {
          objectHash = hashNumber(objectHash, entry ? 1 : 0);
        } else if (entry == null) {
          objectHash = hashString(objectHash, "null");
        } else {
          objectHash = hashObjectLike(objectHash, entry, cache);
        }
      }
      continue;
    }
    if (item == null) {
      objectHash = hashString(objectHash, "null");
      continue;
    }
    objectHash = hashObjectLike(objectHash, item, cache);
  }
  const signature = objectHash >>> 0;
  cache?.set(value, signature);
  return hashNumber(hash, signature);
};

const getFragmentPaintSignature = (
  node: any,
  cache: WeakMap<object, number>,
  registry: any
): number | null => {
  if (!node || typeof node !== "object") {
    return null;
  }
  const childSignatures: number[] = [];
  if (Array.isArray(node?.children)) {
    for (const child of node.children) {
      const childSignature = getFragmentPaintSignature(child, cache, registry);
      if (typeof childSignature === "number") {
        childSignatures.push(childSignature);
      }
    }
  }

  const fragmentRenderer = node?.type ? registry?.get(node.type) : null;
  const hasVisualSelf = typeof fragmentRenderer?.renderFragment === "function";
  if (!hasVisualSelf && childSignatures.length === 0) {
    return null;
  }

  let hash = 17;
  if (hasVisualSelf) {
    hash = hashString(hash, node?.type || "");
    hash = hashString(hash, node?.role || "");
    hash = hashNumber(hash, node?.x);
    hash = hashNumber(hash, node?.y);
    hash = hashNumber(hash, node?.width);
    hash = hashNumber(hash, node?.height);
    hash = hashNumber(hash, node?.fixedBounds ? 1 : 0);
    hash = hashObjectLike(hash, node?.meta || null, cache);
  }
  if (childSignatures.length > 0) {
    hash = hashNumber(hash, childSignatures.length);
    for (const childSignature of childSignatures) {
      hash = hashNumber(hash, childSignature);
    }
  }
  return hash >>> 0;
};

const hashLayoutTreeForPaint = (
  hash: number,
  nodes: any[] | null | undefined,
  cache: WeakMap<object, number>,
  registry: any
) => {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return hash;
  }
  const nodeSignatures: number[] = [];
  for (const node of nodes) {
    const nodeSignature = getFragmentPaintSignature(node, cache, registry);
    if (typeof nodeSignature === "number") {
      nodeSignatures.push(nodeSignature);
    }
  }
  if (nodeSignatures.length === 0) {
    return hash;
  }
  hash = hashNumber(hash, nodeSignatures.length);
  for (const nodeSignature of nodeSignatures) {
    hash = hashNumber(hash, nodeSignature);
  }
  return hash;
};

export const getRendererPageSignature = ({
  page,
  pageFragments,
  registry,
  nodeViewProvider,
}: {
  page: any;
  pageFragments?: any[] | null;
  registry: any;
  nodeViewProvider?: ((line: any) => any) | null;
}) => {
  const layoutVersion =
    page && Number.isFinite(page.__layoutVersionToken) ? Number(page.__layoutVersionToken) : null;
  if (
    page &&
    typeof page.__signature === "number" &&
    (layoutVersion == null ||
      (Number.isFinite(page.__signatureVersion) &&
        Number(page.__signatureVersion) === layoutVersion))
  ) {
    return page.__signature;
  }

  let hash = 0;
  const objectSignatureCache = new WeakMap<object, number>();

  for (const line of page.lines) {
    const renderer = registry?.get(line.blockType);
    const nodeView = nodeViewProvider?.(line);
    const renderPlan = resolveLineRenderPlan(line, renderer, {
      hasNodeViewRender: !!nodeView?.render,
    });
    if (renderPlan.shouldSkipBodyPassAfterFragment) {
      continue;
    }

    hash = hashNumber(hash, line.x);
    hash = hashNumber(hash, line.y);
    hash = hashNumber(hash, line.width);
    hash = hashNumber(hash, line.lineHeight);
    hash = hashNumber(hash, line.blockSignature);
    hash = hashString(hash, line.blockType || "");
    hash = hashString(hash, line.blockId || "");
    hash = hashString(hash, line.text || "");
    hash = hashObjectLike(hash, line.blockAttrs || null, objectSignatureCache);
    hash = hashObjectLike(hash, line.tableMeta || null, objectSignatureCache);
    hash = hashObjectLike(hash, line.tableOwnerMeta || null, objectSignatureCache);
    if (renderPlan.shouldRunContainerPass) {
      hash = hashObjectLike(hash, line.containers || null, objectSignatureCache);
    }
    hash = hashObjectLike(hash, line.fragmentOwners || null, objectSignatureCache);
    if (renderPlan.shouldRunListMarkerPass) {
      hash = hashObjectLike(hash, line.listMarker || null, objectSignatureCache);
    }
    hash = hashObjectLike(hash, line.imageMeta || null, objectSignatureCache);
    hash = hashObjectLike(hash, line.videoMeta || null, objectSignatureCache);

    if (renderPlan.hasTextPayload && line.runs) {
      for (const run of line.runs) {
        hash = hashString(hash, run.text || "");
        hash = hashString(hash, run.font || "");
        hash = hashString(hash, run.color || "");
        hash = hashNumber(hash, run.width);
        hash = hashNumber(hash, run.underline ? 1 : 0);
        hash = hashString(hash, run.underlineStyle || "");
        hash = hashString(hash, run.underlineColor || "");
        hash = hashNumber(hash, run.strike ? 1 : 0);
        hash = hashString(hash, run.strikeColor || "");
        hash = hashNumber(hash, run.shiftY);
        hash = hashNumber(hash, run.backgroundRadius);
        hash = hashNumber(hash, run.backgroundPaddingX);
        hash = hashString(hash, run.linkHref || "");
        hash = hashString(hash, run.annotationKey || "");
        hash = hashObjectLike(hash, run.annotations || null, objectSignatureCache);
        hash = hashString(hash, run.styleKey || "");
        hash = hashObjectLike(hash, run.extras || null, objectSignatureCache);
        hash = hashObjectLike(hash, run.drawInstructions || null, objectSignatureCache);
        hash =
          typeof run.background === "string"
            ? hashString(hash, run.background)
            : hashObjectLike(hash, run.background || null, objectSignatureCache);
      }
    }
  }

  hash = hashLayoutTreeForPaint(hash, pageFragments || null, objectSignatureCache, registry);

  if (page) {
    page.__signature = hash;
    if (layoutVersion != null) {
      page.__signatureVersion = layoutVersion;
    }
  }

  return hash;
};
