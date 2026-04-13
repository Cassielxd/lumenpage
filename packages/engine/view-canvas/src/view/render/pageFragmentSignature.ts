import { resolveNodeRendererRenderCapabilities } from "lumenpage-render-engine";
import type { PageFragmentPassPlan } from "./pageRenderTypes.js";
import { getRendererLinePaintEntriesSignature } from "./pageLineEntrySignature.js";

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

const getFragmentPaintSignature = ({
  node,
  cache,
  registry,
  hasVisualSelf,
}: {
  node: any;
  cache: WeakMap<object, number>;
  registry: any;
  hasVisualSelf: (node: any, registry: any) => boolean;
}): number | null => {
  if (!node || typeof node !== "object") {
    return null;
  }
  const childSignatures: number[] = [];
  if (Array.isArray(node?.children)) {
    for (const child of node.children) {
      const childSignature = getFragmentPaintSignature({
        node: child,
        cache,
        registry,
        hasVisualSelf,
      });
      if (typeof childSignature === "number") {
        childSignatures.push(childSignature);
      }
    }
  }

  const visualSelf = hasVisualSelf(node, registry);
  if (!visualSelf && childSignatures.length === 0) {
    return null;
  }

  let hash = 17;
  if (visualSelf) {
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

export const getRendererFragmentTreePaintSignature = ({
  nodes,
  registry,
  hasVisualSelf,
}: {
  nodes: any[] | null | undefined;
  registry: any;
  hasVisualSelf: (node: any, registry: any) => boolean;
}) => {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return 0;
  }

  const cache = new WeakMap<object, number>();
  const nodeSignatures: number[] = [];
  for (const node of nodes) {
    const nodeSignature = getFragmentPaintSignature({
      node,
      cache,
      registry,
      hasVisualSelf,
    });
    if (typeof nodeSignature === "number") {
      nodeSignatures.push(nodeSignature);
    }
  }
  if (nodeSignatures.length === 0) {
    return 0;
  }

  let hash = 0;
  hash = hashNumber(hash, nodeSignatures.length);
  for (const nodeSignature of nodeSignatures) {
    hash = hashNumber(hash, nodeSignature);
  }
  return hash >>> 0;
};

export const getRendererFragmentPassSignature = ({
  fragmentPass,
  registry,
}: {
  fragmentPass: PageFragmentPassPlan;
  registry: any;
}) => {
  let hash = getRendererFragmentTreePaintSignature({
    nodes: fragmentPass.pageFragments || null,
    registry,
    hasVisualSelf: (node, targetRegistry) => {
      const fragmentRenderer = node?.type ? targetRegistry?.get(node.type) : null;
      const render = resolveNodeRendererRenderCapabilities(fragmentRenderer);
      return typeof render.renderFragment === "function";
    },
  });
  if (fragmentPass.fragmentOwnedTextLineEntries.length > 0) {
    hash = hashNumber(
      hash,
      getRendererLinePaintEntriesSignature(fragmentPass.fragmentOwnedTextLineEntries)
    );
  }
  return hash >>> 0;
};
