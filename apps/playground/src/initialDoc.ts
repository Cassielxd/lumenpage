type JsonNode = Record<string, any>;

const textNode = (text: string, marks?: any[]): JsonNode =>
  marks && marks.length > 0 ? { type: "text", text, marks } : { type: "text", text };

const paragraphNode = (text: string): JsonNode => ({
  type: "paragraph",
  content: [textNode(text)],
});

const headingNode = (level: number, text: string): JsonNode => ({
  type: "heading",
  attrs: { level },
  content: [textNode(text)],
});

const makePerfParagraphs = (count: number): JsonNode[] => {
  const rows: JsonNode[] = [];
  for (let i = 0; i < count; i += 1) {
    rows.push(
      {
        ...paragraphNode(
          `P${String(i + 1).padStart(4, "0")} | LumenPage performance baseline paragraph for pagination, selection, drag and edit hot-path verification.`
        ),
        attrs: { id: `perf-${String(i + 1).padStart(5, "0")}` },
      }
    );
  }
  return rows;
};

const featureBlocks: JsonNode[] = [
  headingNode(1, "LumenPage Performance Baseline Document"),
  {
    type: "paragraph",
    content: [
      textNode("This paragraph has "),
      textNode("bold", [{ type: "strong" }]),
      textNode(", "),
      textNode("italic", [{ type: "em" }]),
      textNode(", "),
      textNode("underline", [{ type: "underline" }]),
      textNode(", "),
      textNode("strike", [{ type: "strike" }]),
      textNode(", "),
      textNode("inline code", [{ type: "code" }]),
      textNode(", and a "),
      textNode("link", [{ type: "link", attrs: { href: "https://example.com", title: "example" } }]),
      textNode("."),
    ],
  },
  {
    type: "blockquote",
    content: [
      paragraphNode("Blockquote first line."),
      paragraphNode("Blockquote second line."),
    ],
  },
  {
    type: "code_block",
    content: [textNode("const value = 1;\nconsole.log(value);\n")],
  },
  { type: "horizontal_rule" },
  headingNode(2, "Lists"),
  {
    type: "bullet_list",
    content: [
      { type: "list_item", content: [paragraphNode("Bullet item 1")] },
      { type: "list_item", content: [paragraphNode("Bullet item 2")] },
      { type: "list_item", content: [paragraphNode("Bullet item 3")] },
    ],
  },
  {
    type: "ordered_list",
    attrs: { order: 1 },
    content: [
      { type: "list_item", content: [paragraphNode("Numbered item 1")] },
      { type: "list_item", content: [paragraphNode("Numbered item 2")] },
      { type: "list_item", content: [paragraphNode("Numbered item 3")] },
    ],
  },
  headingNode(2, "Media"),
  {
    type: "image",
    attrs: {
      src: "https://picsum.photos/640/360",
      alt: "Sample",
    },
  },
  {
    type: "video",
    attrs: { src: "https://www.w3schools.com/html/mov_bbb.mp4", embed: false },
  },
  headingNode(2, "Table"),
  {
    type: "table",
    content: [
      {
        type: "table_row",
        content: [
          { type: "table_cell", content: [paragraphNode("A1")] },
          { type: "table_cell", content: [paragraphNode("B1")] },
          { type: "table_cell", content: [paragraphNode("C1")] },
        ],
      },
      {
        type: "table_row",
        content: [
          { type: "table_cell", content: [paragraphNode("A2")] },
          { type: "table_cell", content: [paragraphNode("B2")] },
          { type: "table_cell", content: [paragraphNode("C2")] },
        ],
      },
      {
        type: "table_row",
        content: [
          { type: "table_cell", content: [paragraphNode("A3")] },
          { type: "table_cell", content: [paragraphNode("B3")] },
          { type: "table_cell", content: [paragraphNode("C3")] },
        ],
      },
    ],
  },
  headingNode(2, "Performance Blocks"),
];

const smokePerfParagraphCount = 120;
const defaultPerfParagraphCount = 360;
const heavyPerfParagraphCount = 5200;

const withTopLevelIds = (blocks: JsonNode[], prefix: string): JsonNode[] =>
  blocks.map((block, index) => {
    const attrs = block?.attrs && typeof block.attrs === "object" ? { ...block.attrs } : {};
    if (!attrs.id) {
      attrs.id = `${prefix}-${String(index + 1).padStart(5, "0")}`;
    }
    return { ...block, attrs };
  });

const buildInitialDoc = (perfParagraphCount: number) => {
  const combined = [...featureBlocks, ...makePerfParagraphs(perfParagraphCount)];
  return {
    type: "doc",
    content: withTopLevelIds(combined, "docblk"),
  };
};

export const initialDocJson = buildInitialDoc(defaultPerfParagraphCount);
export const initialDocSmokeJson = buildInitialDoc(smokePerfParagraphCount);
export const initialDocPerfJson = buildInitialDoc(heavyPerfParagraphCount);
