import { Mark } from "lumenpage-core";

export const Underline = Mark.create({
  name: "underline",
  priority: 100,
  parseHTML() {
    return [
      { tag: "u" },
      {
        style: "text-decoration",
        getAttrs: (value) => (value && value.includes("underline") ? {} : false),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["u", HTMLAttributes, 0];
  },
});

export default Underline;
