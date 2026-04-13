import { Node } from "lumenpage-core";
import { calloutRenderer } from "./renderer.js";
import { calloutNodeSpec } from "./callout.js";

export { calloutNodeSpec, serializeCalloutToText } from "./callout.js";
export { calloutRenderer } from "./renderer.js";

type CalloutCommandMethods<ReturnType> = {
  insertCallout: (attrs?: Record<string, unknown>) => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    callout: CalloutCommandMethods<ReturnType>;
  }
}

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
