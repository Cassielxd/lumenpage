import { type PageLineEntry } from "./pageLineEntries.js";

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

const hashLinePaintEntry = (
  hash: number,
  entry: PageLineEntry,
  objectSignatureCache: WeakMap<object, number>
) => {
  const { line, renderPlan } = entry;
  if (!line || renderPlan.shouldSkipBodyPassAfterFragment) {
    return hash;
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

  return hash;
};

export const getRendererLinePaintEntriesSignature = (lineEntries: PageLineEntry[]) => {
  let hash = 0;
  const objectSignatureCache = new WeakMap<object, number>();
  for (const entry of lineEntries) {
    hash = hashLinePaintEntry(hash, entry, objectSignatureCache);
  }
  return hash >>> 0;
};
