import { Node } from "lumenpage-core";
import { pageBreakNodeSpec } from "./pageBreak";

export { pageBreakNodeSpec } from "./pageBreak";

export const PageBreak = Node.create({
  name: "pageBreak",
  priority: 100,
  group: "block",
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: "div[data-page-break]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", { ...HTMLAttributes, "data-page-break": "true" }];
  },
  schema: {
    offsetMapping: pageBreakNodeSpec.offsetMapping,
  },
});

export default PageBreak;
