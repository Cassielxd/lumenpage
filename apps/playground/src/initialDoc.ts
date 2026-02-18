export const initialDocJson = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "项目周报（示例）" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text:
            "本周完成了核心编辑器、分页布局与协同选区渲染，整体稳定性明显提升。",
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "进展摘要" }],
    },
    {
      type: "bullet_list",
      content: [
        {
          type: "list_item",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "完成增量分页与页级缓存复用。" }],
            },
          ],
        },
        {
          type: "list_item",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "补齐 keymap 插件，快捷键体验一致。" }],
            },
          ],
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "下周计划" }],
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
              content: [{ type: "text", text: "完善输入法组合态显示。" }],
            },
          ],
        },
        {
          type: "list_item",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "优化大文档滚动性能。" }],
            },
          ],
        },
      ],
    },
  ],
};
