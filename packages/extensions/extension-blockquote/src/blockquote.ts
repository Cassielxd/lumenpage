import type { NodeSpec } from "lumenpage-model";

const readIdAttr = (dom: Element | null) => dom?.getAttribute?.("data-node-id") || null;

const containerOffsetMapping = {
  toText: (node: any, helpers: any) => {
    const parts: string[] = [];
    node.forEach((child: any, _pos: number, index: number) => {
      parts.push(helpers.serializeNodeToText(child));
      if (index < node.childCount - 1) {
        parts.push("\n");
      }
    });
    return parts.join("");
  },
  getTextLength: (node: any, helpers: any) => {
    let length = 0;
    node.forEach((child: any, _pos: number, index: number) => {
      length += helpers.getNodeTextLength(child);
      if (index < node.childCount - 1) {
        length += 1;
      }
    });
    return length;
  },
  mapOffsetToPos: (node: any, nodePos: number, offset: number, helpers: any) => {
    let remaining = offset;
    let innerPos = nodePos + 1;
    for (let i = 0; i < node.childCount; i += 1) {
      const child = node.child(i);
      const childPos = innerPos;
      const textLength = helpers.getNodeTextLength(child);
      if (remaining <= textLength) {
        return helpers.mapOffsetInNode(child, childPos, remaining);
      }
      remaining -= textLength;
      if (i < node.childCount - 1) {
        if (remaining === 0) {
          return childPos + child.nodeSize - 1;
        }
        remaining -= 1;
      }
      innerPos += child.nodeSize;
    }
    return nodePos + node.nodeSize - 1;
  },
  mapPosToOffset: (node: any, nodePos: number, pos: number, helpers: any) => {
    let offset = 0;
    let innerPos = nodePos + 1;
    for (let i = 0; i < node.childCount; i += 1) {
      const child = node.child(i);
      const childPos = innerPos;
      if (pos <= childPos) {
        return offset;
      }
      if (pos < childPos + child.nodeSize) {
        return offset + helpers.mapPosInNode(child, childPos, pos);
      }
      offset += helpers.getNodeTextLength(child);
      if (i < node.childCount - 1) {
        offset += 1;
      }
      innerPos += child.nodeSize;
    }
    return offset;
  },
};

export const blockquoteNodeSpec: NodeSpec = {
  content: "block+",
  group: "block",
  offsetMapping: containerOffsetMapping,
  attrs: {
    id: { default: null },
  },
  parseDOM: [
    {
      tag: "blockquote",
      getAttrs: (dom: Element) => ({
        id: readIdAttr(dom),
      }),
    },
  ],
  toDOM(node) {
    const attrs: Record<string, unknown> = {};
    if (node.attrs?.id) {
      attrs["data-node-id"] = node.attrs.id;
    }
    return ["blockquote", attrs, 0];
  },
};
