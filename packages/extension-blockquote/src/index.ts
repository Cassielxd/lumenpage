import { Node } from "lumenpage-core";
import { blockquoteNodeSpec, blockquoteRenderer } from "./blockquote";

export { blockquoteNodeSpec, blockquoteRenderer } from "./blockquote";

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
  addLayout() {
    return {
      renderer: blockquoteRenderer,
      pagination: blockquoteRenderer?.pagination,
    };
  },
});

export default Blockquote;
