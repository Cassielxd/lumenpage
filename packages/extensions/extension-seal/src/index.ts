import { Node } from "lumenpage-core";
import { sealRenderer } from "./renderer.js";
import { sealNodeSpec } from "./seal.js";

export { sealNodeSpec, serializeSealToText } from "./seal.js";
export { sealRenderer } from "./renderer.js";

type InsertSealOptions = {
  text: string;
};

type SealCommandMethods<ReturnType> = {
  insertSeal: (attrs: InsertSealOptions) => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    seal: SealCommandMethods<ReturnType>;
  }
}

const insertSealCommand =
  (attrs: InsertSealOptions) =>
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
      insertSeal: (attrs: InsertSealOptions) => insertSealCommand(attrs),
    };
  },
  canvas() {
    return {
      nodeSelectionTypes: ["seal"],
    };
  },
});

export default Seal;
