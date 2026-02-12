import { Schema } from "prosemirror-model";

const clampRows = (rows) => Math.max(1, Number.parseInt(rows, 10) || 1);
const clampCols = (cols) => Math.max(1, Number.parseInt(cols, 10) || 1);

export const serializeTableToText = (tableNode) => {
  const rows = [];
  tableNode.forEach((row) => {
    const cells = [];
    row.forEach((cell) => {
      const cellText = cell.textBetween(0, cell.content.size, "\n");
      cells.push(cellText);
    });
    rows.push(cells.join("\t"));
  });
  return rows.join("\n");
};

export const getTableTextLength = (tableNode) =>
  serializeTableToText(tableNode).length;

export const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: {
      content: "inline*",
      group: "block",
      attrs: {
        align: { default: "left" },
        indent: { default: 0 },
      },
      parseDOM: [
        {
          tag: "p",
          getAttrs: (dom) => {
            const align = dom.style.textAlign || "left";
            const indentValue = dom.style.textIndent || "0";
            const indent = Number.parseFloat(indentValue) || 0;
            return { align, indent };
          },
        },
      ],
      toDOM(node) {
        const { align, indent } = node.attrs;
        const styles = [];
        if (align && align !== "left") {
          styles.push(`text-align:${align}`);
        }
        if (indent) {
          styles.push(`text-indent:${indent}px`);
        }
        const attrs = styles.length > 0 ? { style: styles.join(";") } : {};
        return ["p", attrs, 0];
      },
    },
    table: {
      group: "block",
      content: "table_row+",
      parseDOM: [{ tag: "table" }],
      toDOM() {
        return ["table", ["tbody", 0]];
      },
    },
    table_row: {
      content: "table_cell+",
      parseDOM: [{ tag: "tr" }],
      toDOM() {
        return ["tr", 0];
      },
    },
    table_cell: {
      content: "paragraph+",
      parseDOM: [{ tag: "td" }, { tag: "th" }],
      toDOM() {
        return ["td", 0];
      },
    },
    text: { group: "inline" },
  },
  marks: {
    strong: {
      parseDOM: [
        { tag: "strong" },
        { tag: "b" },
        {
          style: "font-weight",
          getAttrs: (value) => (value === "bold" ? {} : false),
        },
      ],
      toDOM() {
        return ["strong", 0];
      },
    },
    em: {
      parseDOM: [
        { tag: "em" },
        { tag: "i" },
        {
          style: "font-style",
          getAttrs: (value) => (value === "italic" ? {} : false),
        },
      ],
      toDOM() {
        return ["em", 0];
      },
    },
    underline: {
      parseDOM: [
        { tag: "u" },
        {
          style: "text-decoration",
          getAttrs: (value) => (value && value.includes("underline") ? {} : false),
        },
      ],
      toDOM() {
        return ["u", 0];
      },
    },
  },
});

export function createDocFromText(text = "") {
  const lines = text.split("\n");
  const blocks = lines.map((line) =>
    schema.node("paragraph", null, line ? schema.text(line) : undefined)
  );
  if (blocks.length === 0) {
    return schema.node("doc", null, [schema.node("paragraph")]);
  }
  return schema.node("doc", null, blocks);
}

export function docToText(doc) {
  let result = "";
  doc.forEach((node, _pos, index) => {
    if (node.type.name === "table") {
      result += serializeTableToText(node);
    } else {
      result += node.textBetween(0, node.content.size, "\n");
    }

    if (index < doc.childCount - 1) {
      result += "\n";
    }
  });
  return result;
}
