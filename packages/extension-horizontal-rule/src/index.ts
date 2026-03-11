import { Node } from "lumenpage-core";
import { horizontalRuleNodeSpec, horizontalRuleRenderer } from "./horizontalRule";

export { horizontalRuleNodeSpec, horizontalRuleRenderer } from "./horizontalRule";

export const HorizontalRule = Node.create({
  name: "horizontalRule",
  priority: 100,
  group: "block",
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: "hr" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["hr", HTMLAttributes];
  },
  schema: {
    offsetMapping: horizontalRuleNodeSpec.offsetMapping,
  },
  addLayout() {
    return {
      renderer: horizontalRuleRenderer,
      pagination: horizontalRuleRenderer?.pagination,
    };
  },
  addCanvas() {
    return {
      nodeSelectionTypes: ["horizontalRule"],
    };
  },
});

export default HorizontalRule;
