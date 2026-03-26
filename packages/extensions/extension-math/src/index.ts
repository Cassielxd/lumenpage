import { Node } from "lumenpage-core";
import { mathRenderer } from "./renderer";
import { mathNodeSpec } from "./math";

export { mathNodeSpec, serializeMathToText } from "./math";
export { mathRenderer } from "./renderer";

type InsertMathOptions = {
  source: string;
  displayMode?: "inline" | "block";
};

type MathCommandMethods<ReturnType> = {
  insertMath: (attrs: InsertMathOptions) => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    math: MathCommandMethods<ReturnType>;
  }
}

const insertMathCommand =
  (attrs: InsertMathOptions) =>
  (state: any, dispatch?: (tr: any) => void) => {
    const type = state?.schema?.nodes?.math;
    if (!type) {
      return false;
    }
    const source = String(attrs?.source || "").trim();
    if (!source) {
      return false;
    }
    const node = type.create({
      source,
      displayMode: attrs?.displayMode === "inline" ? "inline" : "block"
    });
    if (!dispatch) {
      return true;
    }
    dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
    return true;
  };

export const Math = Node.create({
  name: "math",
  priority: 100,
  schema: mathNodeSpec,
  layout() {
    return {
      renderer: mathRenderer,
    };
  },
  addCommands() {
    return {
      insertMath: (attrs: InsertMathOptions) => insertMathCommand(attrs)
    };
  },
  canvas() {
    return {
      nodeSelectionTypes: ["math"]
    };
  }
});

export default Math;
