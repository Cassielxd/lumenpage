import { Mark } from "lumenpage-core";
import { sanitizeLinkHref } from "lumenpage-link";

export const Link = Mark.create({
  name: "link",
  priority: 100,
  inclusive: false,
  addAttributes() {
    return {
      href: {
        default: null,
        parseHTML: (element) => sanitizeLinkHref(element?.getAttribute?.("href")),
      },
      title: {
        default: null,
        parseHTML: (element) => element?.getAttribute?.("title") || null,
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "a[href]",
        getAttrs: (element) => (sanitizeLinkHref(element?.getAttribute?.("href")) ? {} : false),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const attrs = {
      ...HTMLAttributes,
      href: sanitizeLinkHref(HTMLAttributes.href) || "#",
    };
    if (!attrs.title) {
      delete attrs.title;
    }
    return ["a", attrs, 0];
  },
});

export default Link;
