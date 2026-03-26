import { Node } from "lumenpage-core";
import { sanitizeLinkHref } from "lumenpage-link";
import { createDefaultBookmarkNodeView } from "./nodeView";
import { bookmarkRenderer } from "./renderer";
import { bookmarkNodeSpec } from "./bookmark";

export { bookmarkNodeSpec, serializeBookmarkToText } from "./bookmark";
export { bookmarkRenderer } from "./renderer";

type InsertBookmarkOptions = {
  href: string;
  title?: string;
  description?: string;
};

type BookmarkCommandMethods<ReturnType> = {
  insertBookmark: (attrs: InsertBookmarkOptions) => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    bookmark: BookmarkCommandMethods<ReturnType>;
  }
}

const insertBookmarkCommand =
  (attrs: InsertBookmarkOptions) =>
  (state: any, dispatch?: (tr: any) => void) => {
    const type = state?.schema?.nodes?.bookmark;
    if (!type) {
      return false;
    }
    const href = sanitizeLinkHref(attrs?.href || "");
    if (!href) {
      return false;
    }
    const node = type.create({
      href,
      title: String(attrs?.title || "").trim(),
      description: String(attrs?.description || "").trim()
    });
    if (!dispatch) {
      return true;
    }
    dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
    return true;
  };

export const Bookmark = Node.create({
  name: "bookmark",
  priority: 100,
  schema: bookmarkNodeSpec,
  addNodeView() {
    return createDefaultBookmarkNodeView;
  },
  layout() {
    return {
      renderer: bookmarkRenderer,
    };
  },
  addCommands() {
    return {
      insertBookmark: (attrs: InsertBookmarkOptions) => insertBookmarkCommand(attrs)
    };
  },
  canvas() {
    return {
      nodeSelectionTypes: ["bookmark"]
    };
  }
});

export default Bookmark;
