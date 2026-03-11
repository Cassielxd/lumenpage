import { Mark } from "lumenpage-core";

export const Code = Mark.create({
  name: "code",
  priority: 100,
  code: true,
  parseHTML() {
    return [{ tag: "code" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["code", HTMLAttributes, 0];
  },
});

export default Code;
