import { Node } from "lumenpage-core";
import { horizontalRuleNodeSpec } from "./horizontalRule";

export { horizontalRuleNodeSpec };
export { defaultHorizontalRuleRenderer as horizontalRuleRenderer } from "lumenpage-render-engine";

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
  canvas() {
    return {
      nodeSelectionTypes: ["horizontalRule"],
    };
  },
});

export default HorizontalRule;
