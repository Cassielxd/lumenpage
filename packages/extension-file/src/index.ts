import { Node } from "lumenpage-core";
import { sanitizeLinkHref } from "lumenpage-link";
import { createDefaultFileNodeView } from "./nodeView";
import { fileRenderer } from "./renderer";
import { fileNodeSpec } from "./file";

export { fileNodeSpec, serializeFileToText } from "./file";
export { fileRenderer } from "./renderer";

const insertFileCommand =
  (attrs: Record<string, unknown> | null | undefined = {}) =>
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
      insertFile: (attrs?: Record<string, unknown>) => insertFileCommand(attrs),
    };
  },
  canvas() {
    return {
      nodeSelectionTypes: ["file"],
    };
  },
});

export default File;
