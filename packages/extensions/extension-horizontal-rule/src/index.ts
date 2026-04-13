import { Node } from "lumenpage-core";
import { horizontalRuleNodeSpec } from "./horizontalRule.js";

type HorizontalRuleCommands<ReturnType> = {
  setHorizontalRule: () => ReturnType;
  insertHorizontalRule: () => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    horizontalRule: HorizontalRuleCommands<ReturnType>;
  }
}

export { horizontalRuleNodeSpec };
export { defaultHorizontalRuleRenderer as horizontalRuleRenderer } from "lumenpage-render-engine";

export const HorizontalRule = Node.create({
  name: "horizontalRule",
  priority: 100,
  group: "block",
  atom: true,
  selectable: true,
  addCommands() {
    const insertHorizontalRule =
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
      setHorizontalRule: insertHorizontalRule,
      insertHorizontalRule,
    };
  },
  parseHTML() {
    return [{ tag: "hr" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["hr", HTMLAttributes];
  },
  schema: {
    offsetMapping: horizontalRuleNodeSpec.offsetMapping,
  },
  canvas() {
    return {
      nodeSelectionTypes: ["horizontalRule"],
    };
  },
});

export default HorizontalRule;