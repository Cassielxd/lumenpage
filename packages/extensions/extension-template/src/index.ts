import { Node } from "lumenpage-core";
import { templateRenderer } from "./renderer";
import { templateNodeSpec } from "./template";

export { templateNodeSpec, serializeTemplateToText } from "./template";
export { templateRenderer } from "./renderer";

type InsertTemplateOptions = {
  title?: string;
  summary?: string;
  items?: string | string[];
  itemsText?: string;
};

type TemplateCommandMethods<ReturnType> = {
  insertTemplate: (attrs: InsertTemplateOptions) => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    templateBlock: TemplateCommandMethods<ReturnType>;
  }
}

const normalizeItemsText = (value: unknown) =>
  Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean).join("\n")
    : String(value || "").trim();

const insertTemplateCommand =
  (attrs: InsertTemplateOptions) =>
  (state: any, dispatch?: (tr: any) => void) => {
    const type = state?.schema?.nodes?.templateBlock;
    if (!type) {
      return false;
    }
    const title = String(attrs?.title || "").trim();
    const summary = String(attrs?.summary || "").trim();
    const itemsText = normalizeItemsText(attrs?.items || attrs?.itemsText);
    if (!title && !summary && !itemsText) {
      return false;
    }
    const node = type.create({ title, summary, itemsText });
    if (!dispatch) {
      return true;
    }
    dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
    return true;
  };

export const Template = Node.create({
  name: "templateBlock",
  priority: 100,
  schema: templateNodeSpec,
  layout() {
    return {
      renderer: templateRenderer,
    };
  },
  addCommands() {
    return {
      insertTemplate: (attrs: InsertTemplateOptions) => insertTemplateCommand(attrs),
    };
  },
  canvas() {
    return {
      nodeSelectionTypes: ["templateBlock"],
    };
  },
});

export default Template;
