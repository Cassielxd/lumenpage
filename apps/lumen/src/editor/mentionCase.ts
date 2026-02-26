import type { MentionItem, MentionPluginOptions } from "lumenpage-editor-plugins";

const LUMEN_MENTION_ITEMS: MentionItem[] = [
  { id: "u-alex", label: "Alex" },
  { id: "u-ava", label: "Ava" },
  { id: "u-liam", label: "Liam" },
  { id: "u-emma", label: "Emma" },
  { id: "u-noah", label: "Noah" },
  { id: "u-olivia", label: "Olivia" },
];

export const createLumenMentionPluginOptions = (): MentionPluginOptions => ({
  items: ({ query }) => {
    const keyword = String(query || "")
      .trim()
      .toLowerCase();
    if (!keyword) {
      return LUMEN_MENTION_ITEMS;
    }
    return LUMEN_MENTION_ITEMS.filter((item) =>
      item.label.toLowerCase().includes(keyword)
    );
  },
  emptyLabel: "No matching users",
});

