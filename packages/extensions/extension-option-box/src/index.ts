import { Node } from "lumenpage-core";
import { optionBoxRenderer } from "./renderer.js";
import { optionBoxNodeSpec } from "./optionBox.js";

export { optionBoxNodeSpec, serializeOptionBoxToText } from "./optionBox.js";
export { optionBoxRenderer } from "./renderer.js";

type InsertOptionBoxOptions = {
  title?: string;
  items?: string | string[];
  itemsText?: string;
};

type OptionBoxCommandMethods<ReturnType> = {
  insertOptionBox: (attrs: InsertOptionBoxOptions) => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    optionBox: OptionBoxCommandMethods<ReturnType>;
  }
}

const normalizeItemsText = (value: unknown) =>
  Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean).join("\n")
    : String(value || "").trim();

const insertOptionBoxCommand =
  (attrs: InsertOptionBoxOptions) =>
  (state: any, dispatch?: (tr: any) => void) => {
    const type = state?.schema?.nodes?.optionBox;
    if (!type) {
      return false;
    }
    const itemsText = normalizeItemsText(attrs?.items || attrs?.itemsText);
    if (!itemsText) {
      return false;
    }
    const node = type.create({
      title: String(attrs?.title || "").trim(),
      itemsText,
    });
    if (!dispatch) {
      return true;
    }
    dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
    return true;
  };

export const OptionBox = Node.create({
  name: "optionBox",
  priority: 100,
  schema: optionBoxNodeSpec,
  layout() {
    return {
      renderer: optionBoxRenderer,
    };
  },
  addCommands() {
    return {
      insertOptionBox: (attrs: InsertOptionBoxOptions) => insertOptionBoxCommand(attrs),
    };
  },
  canvas() {
    return {
      nodeSelectionTypes: ["optionBox"],
    };
  },
});

export default OptionBox;
