import { type RendererPageDisplayListItem } from "./pageDisplayList.js";

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

export const getRendererPageDisplayListSignature = (
  items: RendererPageDisplayListItem[]
): number | null => {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  let hash = 17;
  for (const item of items) {
    hash = hashString(hash, item.kind);
    hash = hashNumber(hash, item.signature);
  }

  return hash >>> 0;
};
