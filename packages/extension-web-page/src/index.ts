import { Node } from "lumenpage-core";
import { createDefaultWebPageNodeView } from "./nodeView";
import { webPageRenderer } from "./renderer";
import { sanitizeWebPageHref, webPageNodeSpec } from "./webPage";

export { sanitizeWebPageHref, webPageNodeSpec, serializeWebPageToText } from "./webPage";
export { webPageRenderer } from "./renderer";

const insertWebPageCommand =
  (attrs: Record<string, unknown> | null | undefined = {}) =>
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
      insertWebPage: (attrs?: Record<string, unknown>) => insertWebPageCommand(attrs)
    };
  },
  canvas() {
    return {
      nodeSelectionTypes: ["webPage"]
    };
  }
});

export default WebPage;
