import { Mark } from "lumenpage-core";

export const Strike = Mark.create({
  name: "strike",
  priority: 100,
  parseHTML() {
    return [
      { tag: "s" },
      { tag: "del" },
      { tag: "strike" },
      {
        style: "text-decoration",
        getAttrs: (value) => (value && value.includes("line-through") ? {} : false),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["s", HTMLAttributes, 0];
  },
});

export default Strike;
