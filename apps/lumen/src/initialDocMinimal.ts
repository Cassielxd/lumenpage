export const initialDocMinimalJson = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: {
        level: 1,
      },
      content: [
        {
          type: "text",
          text: "LumenPage",
        },
      ],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "This startup document is intentionally short so pagination issues are easier to reproduce.",
        },
      ],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Use the toolbar to insert an image, QR code, barcode, chart, or table. Then keep pressing Enter above the node until it moves onto the next page.",
        },
      ],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Check whether the node keeps the correct size after the page break.",
                },
              ],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Check whether the following blocks move down instead of overlapping.",
                },
              ],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Check whether selection and overlay boxes stay attached to the same node.",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "If needed, use view.setJSON(...) from the test API to load a larger document again.",
        },
      ],
    },
  ],
};
