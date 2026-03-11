import { Node } from "lumenpage-core";

export { hardBreakNodeSpec } from "./hardBreak";

export const HardBreak = Node.create({
  name: "hardBreak",
  priority: 100,
  inline: true,
  group: "inline",
  selectable: false,
  atom: true,
  parseHTML() {
    return [{ tag: "br" }];
  },
  renderHTML() {
    return ["br"];
  },
  schema: {
    leafText: () => "\n",
  },
});

export default HardBreak;
