import { Mark } from "lumenpage-core";

export const Bold = Mark.create({
  name: "bold",
  priority: 100,
  parseHTML() {
    return [
      { tag: "strong" },
      { tag: "b" },
      {
        style: "font-weight",
        getAttrs: (value) => (value === "bold" ? {} : false),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["strong", HTMLAttributes, 0];
  },
});

export default Bold;
