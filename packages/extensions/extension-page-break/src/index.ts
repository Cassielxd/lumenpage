import { Node } from "lumenpage-core";
import { pageBreakNodeSpec } from "./pageBreak";

type PageBreakCommands<ReturnType> = {
  setPageBreak: () => ReturnType;
  insertPageBreak: () => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    pageBreak: PageBreakCommands<ReturnType>;
  }
}

export { pageBreakNodeSpec } from "./pageBreak";

export const PageBreak = Node.create({
  name: "pageBreak",
  priority: 100,
  group: "block",
  atom: true,
  selectable: true,
  addCommands() {
    const insertPageBreak =
      () =>
      ({ state, dispatch }) => {
        const type = state.schema.nodes[this.name];

        if (!type) {
          return false;
        }

        if (dispatch) {
          dispatch(state.tr.replaceSelectionWith(type.create()).scrollIntoView());
        }

        return true;
      };

    return {
      setPageBreak: insertPageBreak,
      insertPageBreak,
    };
  },
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