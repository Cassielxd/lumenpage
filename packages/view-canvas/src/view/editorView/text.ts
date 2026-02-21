import { DOMSerializer, Fragment, Slice } from "lumenpage-model";

// Slice -> HTML 字符串（复制/拖拽用）。
export const serializeSliceToHtml = (slice, schema, ownerDocument = null) => {
  if (!slice || !schema) {
    return "";
  }
  const docRef = ownerDocument || (typeof document !== "undefined" ? document : null);
  if (!docRef) {
    return "";
  }
  const serializer = DOMSerializer.fromSchema(schema);
  const container = docRef.createElement("div");
  container.appendChild(serializer.serializeFragment(slice.content));
  return container.innerHTML;
};

// 文本 -> Slice（粘贴/拖拽文本用）。
export const createSliceFromText = (schema, text) => {
  const normalized = typeof text === "string" ? text.replace(/\r\n?/g, "\n") : "";
  if (!normalized) {
    return Slice.empty;
  }
  const fragment = Fragment.from(schema.text(normalized));
  return Slice.maxOpen(fragment);
};
