import { Node } from "lumenpage-core";
import { calloutRenderer } from "./renderer";
import { calloutNodeSpec } from "./callout";

export { calloutNodeSpec, serializeCalloutToText } from "./callout";
export { calloutRenderer } from "./renderer";

const insertCalloutCommand =
  (attrs: Record<string, unknown> | null | undefined = {}) =>
  (state: any, dispatch?: (tr: any) => void) => {
    const type = state?.schema?.nodes?.callout;
    if (!type) {
      return false;
    }
    const text = String(attrs?.text || "").trim();
    if (!text) {
      return false;
    }
    const node = type.create({
      title: String(attrs?.title || "").trim(),
      text,
      tone: String(attrs?.tone || "info").trim() || "info",
    });
    if (!dispatch) {
      return true;
    }
    dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
    return true;
  };

export const Callout = Node.create({
  name: "callout",
  priority: 100,
  schema: calloutNodeSpec,
  layout() {
    return {
      renderer: calloutRenderer,
    };
  },
  addCommands() {
    return {
      insertCallout: (attrs?: Record<string, unknown>) => insertCalloutCommand(attrs),
    };
  },
  canvas() {
    return {
      nodeSelectionTypes: ["callout"],
    };
  },
});

export default Callout;
