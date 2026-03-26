import { Node } from "lumenpage-core";

type CodeBlockCommands<ReturnType> = {
  setCodeBlock: () => ReturnType;
  toggleCodeBlock: () => ReturnType;
  unsetCodeBlock: () => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    codeBlock: CodeBlockCommands<ReturnType>;
  }
}

export { codeBlockNodeSpec } from "./codeBlock";
export { defaultCodeBlockRenderer as codeBlockRenderer } from "lumenpage-render-engine";

export const CodeBlock = Node.create({
  name: "codeBlock",
  priority: 100,
  content: "text*",
  group: "block",
  marks: "",
  code: true,
  addCommands() {
    return {
      setCodeBlock: () => ({ commands }) => commands.setNode(this.name),
      toggleCodeBlock: () => ({ commands }) => commands.toggleNode(this.name, "paragraph"),
      unsetCodeBlock: () => ({ commands }) => commands.setNode("paragraph"),
    };
  },
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