import { Mark } from "lumenpage-core";

export const Italic = Mark.create({
  name: "italic",
  priority: 100,
  parseHTML() {
    return [
      { tag: "em" },
      { tag: "i" },
      {
        style: "font-style",
        getAttrs: (value) => (value === "italic" ? {} : false),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["em", HTMLAttributes, 0];
  },
});

export default Italic;
