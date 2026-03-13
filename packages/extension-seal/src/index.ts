import { Node } from "lumenpage-core";
import { sealRenderer } from "./renderer";
import { sealNodeSpec } from "./seal";

export { sealNodeSpec, serializeSealToText } from "./seal";
export { sealRenderer } from "./renderer";

const insertSealCommand =
  (attrs: Record<string, unknown> | null | undefined = {}) =>
  (state: any, dispatch?: (tr: any) => void) => {
    const type = state?.schema?.nodes?.seal;
    if (!type) {
      return false;
    }
    const text = String(attrs?.text || "").trim();
    if (!text) {
      return false;
    }
    const node = type.create({ text });
    if (!dispatch) {
      return true;
    }
    dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
    return true;
  };

export const Seal = Node.create({
  name: "seal",
  priority: 100,
  schema: sealNodeSpec,
  layout() {
    return {
      renderer: sealRenderer,
    };
  },
  addCommands() {
    return {
      insertSeal: (attrs?: Record<string, unknown>) => insertSealCommand(attrs),
    };
  },
  canvas() {
    return {
      nodeSelectionTypes: ["seal"],
    };
  },
});

export default Seal;
