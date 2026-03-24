import { Mark } from "lumenpage-core";

export const Superscript = Mark.create({
  name: "superscript",
  priority: 100,
  parseHTML() {
    return [
      { tag: "sup" },
      {
        style: "vertical-align",
        getAttrs: (value) => (String(value || "").toLowerCase() === "super" ? {} : false),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["sup", HTMLAttributes, 0];
  },
});

export default Superscript;
