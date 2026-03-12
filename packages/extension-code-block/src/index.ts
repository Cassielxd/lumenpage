import { Node } from "lumenpage-core";

export { codeBlockNodeSpec } from "./codeBlock";
export { defaultCodeBlockRenderer as codeBlockRenderer } from "lumenpage-view-canvas";

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
});

export default CodeBlock;
