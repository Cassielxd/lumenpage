import type { NodeSpec } from "lumenpage-model";

const readIdAttr = (dom: Element | null) => dom?.getAttribute?.("data-node-id") || null;
const normalizeText = (value: unknown) => String(value || "").trim();
const resolvePositiveDimension = (value: unknown) => {
  if (value == null) {
    return null;
  }
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
};

export const resolveEmbedPanelDefaultSize = (kind: unknown) => {
  const text = normalizeText(kind) || "diagram";
  if (text === "mindMap") {
    return { width: 680, height: 360 };
  }
  if (text === "echarts") {
    return { width: 680, height: 340 };
  }
  return { width: 680, height: 300 };
};

export const serializeEmbedPanelToText = (node: any) => {
  const kind = normalizeText(node?.attrs?.kind) || "embed";
  const title = normalizeText(node?.attrs?.title) || normalizeText(node?.attrs?.source) || "Panel";
  return `[${kind}] ${title}`;
};

const leafOffsetMapping = {
  toText: (node: any) => serializeEmbedPanelToText(node),
  getTextLength: (node: any) => serializeEmbedPanelToText(node).length || 1,
  mapOffsetToPos: (node: any, nodePos: number, offset: number) =>
    offset <= 0 ? nodePos : nodePos + node.nodeSize,
  mapPosToOffset: (_node: any, nodePos: number, pos: number) => (pos <= nodePos ? 0 : 1),
};

export const embedPanelNodeSpec: NodeSpec = {
  group: "block",
  atom: true,
  offsetMapping: leafOffsetMapping,
  attrs: {
    id: { default: null },
    kind: { default: "diagram" },
    title: { default: "" },
    source: { default: "" },
    width: { default: null },
    height: { default: null },
  },
  parseDOM: [
    {
      tag: "div[data-type=embed-panel]",
      getAttrs: (dom: Element) => {
        const kind = normalizeText(dom.getAttribute("data-kind")) || "diagram";
        const source = normalizeText(dom.getAttribute("data-source") || dom.textContent || "");
        if (!source) {
          return false;
        }
        return {
          id: readIdAttr(dom),
          kind,
          title: dom.getAttribute("data-title") || "",
          source,
          width: resolvePositiveDimension(dom.getAttribute("data-width")),
          height: resolvePositiveDimension(dom.getAttribute("data-height")),
        };
      }
    }
  ],
  toDOM(node) {
    const attrs: Record<string, unknown> = {
      "data-type": "embed-panel",
      "data-kind": node.attrs?.kind || "diagram",
      "data-source": normalizeText(node.attrs?.source),
    };
    if (node.attrs?.id) attrs["data-node-id"] = node.attrs.id;
    if (node.attrs?.title) attrs["data-title"] = node.attrs.title;
    if (node.attrs?.width) attrs["data-width"] = node.attrs.width;
    if (node.attrs?.height) attrs["data-height"] = node.attrs.height;
    return ["div", attrs, normalizeText(node.attrs?.source)];
  }
};
