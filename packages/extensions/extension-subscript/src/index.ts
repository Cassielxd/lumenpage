import { Mark } from "lumenpage-core";

export const Subscript = Mark.create({
  name: "subscript",
  priority: 100,
  parseHTML() {
    return [
      { tag: "sub" },
      {
        style: "vertical-align",
        getAttrs: (value) => (String(value || "").toLowerCase() === "sub" ? {} : false),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["sub", HTMLAttributes, 0];
  },
});

export default Subscript;
