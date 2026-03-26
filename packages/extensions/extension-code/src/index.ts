import { Mark } from "lumenpage-core";

type CodeCommands<ReturnType> = {
  setCode: () => ReturnType;
  toggleCode: () => ReturnType;
  toggleInlineCode: () => ReturnType;
  unsetCode: () => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    code: CodeCommands<ReturnType>;
  }
}

export const Code = Mark.create({
  name: "code",
  priority: 100,
  code: true,
  addCommands() {
    return {
      setCode: () => ({ commands }) => commands.setMark(this.name),
      toggleCode: () => ({ commands }) => commands.toggleMark(this.name),
      toggleInlineCode: () => ({ commands }) => commands.toggleMark(this.name),
      unsetCode: () => ({ commands }) => commands.unsetMark(this.name),
    };
  },
  parseHTML() {
    return [{ tag: "code" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["code", HTMLAttributes, 0];
  },
});

export default Code;