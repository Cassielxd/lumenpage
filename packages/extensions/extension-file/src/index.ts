import { Node } from "lumenpage-core";
import { sanitizeLinkHref } from "lumenpage-link";
import { createDefaultFileNodeView } from "./nodeView.js";
import { fileRenderer } from "./renderer.js";
import { fileNodeSpec } from "./file.js";

export { fileNodeSpec, serializeFileToText } from "./file.js";
export { fileRenderer } from "./renderer.js";

type InsertFileOptions = {
  href: string;
  name?: string;
  size?: string;
  mimeType?: string;
};

type FileCommandMethods<ReturnType> = {
  insertFile: (attrs: InsertFileOptions) => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    file: FileCommandMethods<ReturnType>;
  }
}

const insertFileCommand =
  (attrs: InsertFileOptions) =>
  (state: any, dispatch?: (tr: any) => void) => {
    const type = state?.schema?.nodes?.file;
    if (!type) {
      return false;
    }
    const href = sanitizeLinkHref(attrs?.href || "");
    if (!href) {
      return false;
    }
    const node = type.create({
      href,
      name: String(attrs?.name || "").trim(),
      size: String(attrs?.size || "").trim(),
      mimeType: String(attrs?.mimeType || "").trim(),
    });
    if (!dispatch) {
      return true;
    }
    dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
    return true;
  };

export const File = Node.create({
  name: "file",
  priority: 100,
  schema: fileNodeSpec,
  addNodeView() {
    return createDefaultFileNodeView;
  },
  layout() {
    return {
      renderer: fileRenderer,
    };
  },
  addCommands() {
    return {
      insertFile: (attrs: InsertFileOptions) => insertFileCommand(attrs),
    };
  },
  canvas() {
    return {
      nodeSelectionTypes: ["file"],
    };
  },
});

export default File;
