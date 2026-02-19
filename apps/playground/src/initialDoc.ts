export const initialDocJson = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "Editor Sample Doc" }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "This paragraph has " },
        { type: "text", text: "bold", marks: [{ type: "strong" }] },
        { type: "text", text: ", " },
        { type: "text", text: "italic", marks: [{ type: "em" }] },
        { type: "text", text: ", " },
        { type: "text", text: "underline", marks: [{ type: "underline" }] },
        { type: "text", text: ", " },
        { type: "text", text: "strike", marks: [{ type: "strike" }] },
        { type: "text", text: ", " },
        { type: "text", text: "inline code", marks: [{ type: "code" }] },
        { type: "text", text: ", and a " },
        {
          type: "text",
          text: "link",
          marks: [{ type: "link", attrs: { href: "https://example.com", title: "example" } }],
        },
        { type: "text", text: "." },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Paragraph spacing test." },
      ],
    },
    {
      type: "blockquote",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Blockquote with multiple lines." }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Second line in blockquote." }],
        },
      ],
    },
    {
      type: "code_block",
      content: [
        { type: "text", text: "const value = 1;\nconsole.log(value);\n" },
      ],
    },
    {
      type: "horizontal_rule",
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Lists" }],
    },
    {
      type: "bullet_list",
      content: [
        {
          type: "list_item",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Bullet item 1" }],
            },
          ],
        },
        {
          type: "list_item",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Bullet item 2" }],
            },
          ],
        },
      ],
    },
    {
      type: "ordered_list",
      attrs: { order: 1 },
      content: [
        {
          type: "list_item",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Numbered item 1" }],
            },
          ],
        },
        {
          type: "list_item",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Numbered item 2" }],
            },
          ],
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Media" }],
    },
    {
      type: "image",
      attrs: {
        src: "https://gimg2.baidu.com/image_search/src=http%3A%2F%2Fimage109.360doc.com%2FDownloadImg%2F2025%2F04%2F0321%2F296122601_4_20250403090445718&refer=http%3A%2F%2Fimage109.360doc.com&app=2002&size=f9999,10000&q=a80&n=0&g=0n&fmt=auto?sec=1774088720&t=8e91576b7b58d320dad6f9a7de353965",
        alt: "Sample",
      },
    },
    {
      type: "video",
      attrs: { src: "https://www.w3schools.com/html/mov_bbb.mp4", embed: false },
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Table" }],
    },
    {
      type: "table",
      content: [
        {
          type: "table_row",
          content: [
            {
              type: "table_cell",
              content: [{ type: "paragraph", content: [{ type: "text", text: "A1" }] }],
            },
            {
              type: "table_cell",
              content: [{ type: "paragraph", content: [{ type: "text", text: "B1" }] }],
            },
          ],
        },
        {
          type: "table_row",
          content: [
            {
              type: "table_cell",
              content: [{ type: "paragraph", content: [{ type: "text", text: "A2" }] }],
            },
            {
              type: "table_cell",
              content: [{ type: "paragraph", content: [{ type: "text", text: "B2" }] }],
            },
          ],
        },
      ],
    },
  ],
};
