import { Node } from "lumenpage-core";
import { blockquoteNodeSpec } from "./blockquote";

export { blockquoteNodeSpec };
export { defaultBlockquoteRenderer as blockquoteRenderer } from "lumenpage-view-canvas";

export const Blockquote = Node.create({
  name: "blockquote",
  priority: 100,
  content: "block+",
  group: "block",
  parseHTML() {
    return [{ tag: "blockquote" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["blockquote", HTMLAttributes, 0];
  },
  schema: {
    offsetMapping: blockquoteNodeSpec.offsetMapping,
  },
});

export default Blockquote;
