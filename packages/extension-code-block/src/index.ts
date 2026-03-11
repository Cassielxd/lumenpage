import { Node } from "lumenpage-core";
import { codeBlockRenderer } from "./codeBlock";

export { codeBlockNodeSpec, codeBlockRenderer } from "./codeBlock";

export const CodeBlock = Node.create({
  name: "codeBlock",
  priority: 100,
  content: "text*",
  group: "block",
  marks: "",
  code: true,
  parseHTML() {
    return [
      {
        tag: "pre",
        preserveWhitespace: "full",
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["pre", HTMLAttributes, ["code", 0]];
  },
  addLayout() {
    return {
      renderer: codeBlockRenderer,
      pagination: codeBlockRenderer?.pagination,
    };
  },
});

export default CodeBlock;
