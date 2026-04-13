import { Node } from "lumenpage-core";
import { createDefaultWebPageNodeView } from "./nodeView.js";
import { webPageRenderer } from "./renderer.js";
import { sanitizeWebPageHref, webPageNodeSpec } from "./webPage.js";

export { sanitizeWebPageHref, webPageNodeSpec, serializeWebPageToText } from "./webPage.js";
export { webPageRenderer } from "./renderer.js";

type InsertWebPageOptions = {
  href: string;
  title?: string;
  width?: number;
  height?: number;
};

type WebPageCommandMethods<ReturnType> = {
  insertWebPage: (attrs: InsertWebPageOptions) => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    webPage: WebPageCommandMethods<ReturnType>;
  }
}

const insertWebPageCommand =
  (attrs: InsertWebPageOptions) =>
  (state: any, dispatch?: (tr: any) => void) => {
    const type = state?.schema?.nodes?.webPage;
    if (!type) {
      return false;
    }
    const href = sanitizeWebPageHref(attrs?.href || "");
    if (!href) {
      return false;
    }
    const width = Number(attrs?.width);
    const height = Number(attrs?.height);
    const node = type.create({
      href,
      title: String(attrs?.title || "").trim(),
      width: Number.isFinite(width) && width > 0 ? width : null,
      height: Number.isFinite(height) && height > 0 ? height : null
    });
    if (!dispatch) {
      return true;
    }
    dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
    return true;
  };

export const WebPage = Node.create({
  name: "webPage",
  priority: 100,
  schema: webPageNodeSpec,
  addNodeView() {
    return createDefaultWebPageNodeView;
  },
  layout() {
    return {
      renderer: webPageRenderer,
    };
  },
  addCommands() {
    return {
      insertWebPage: (attrs: InsertWebPageOptions) => insertWebPageCommand(attrs)
    };
  },
  canvas() {
    return {
      nodeSelectionTypes: ["webPage"]
    };
  }
});

export default WebPage;
