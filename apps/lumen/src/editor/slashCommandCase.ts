import type {
  SlashCommandItem,
  SlashCommandOptions,
} from "lumenpage-extension-slash-command";

import type { PlaygroundLocale } from "./i18n";

const executeEditorCommand = (editor: any, name: string, ...args: unknown[]) => {
  const command = editor?.commands?.[name];
  if (typeof command !== "function") {
    return false;
  }
  return command(...args) === true;
};

const canExecuteEditorCommand = (editor: any, name: string, ...args: unknown[]) => {
  const can = editor?.commands?.can;
  if (typeof can !== "function") {
    return true;
  }
  return can(name, ...args) === true;
};

const createStaticCommandItem = (
  config: Omit<SlashCommandItem, "command" | "isEnabled"> & {
    commandName: string;
    args?: unknown[];
  }
): SlashCommandItem => ({
  id: config.id,
  title: config.title,
  description: config.description,
  aliases: config.aliases,
  keywords: config.keywords,
  command: ({ editor }) => executeEditorCommand(editor, config.commandName, ...(config.args || [])),
  isEnabled: ({ editor }) => canExecuteEditorCommand(editor, config.commandName, ...(config.args || [])),
});

const createZhCnItems = (): SlashCommandItem[] => [
  {
    id: "paragraph",
    title: "正文",
    description: "保留为普通段落",
    aliases: ["paragraph", "text", "p"],
    keywords: ["正文", "段落", "普通文本"],
    command: () => true,
    isEnabled: () => true,
  },
  createStaticCommandItem({
    id: "heading-1",
    title: "标题 1",
    description: "替换为一级标题",
    aliases: ["h1", "heading1", "title1"],
    keywords: ["标题", "一级标题"],
    commandName: "setHeading",
    args: [1],
  }),
  createStaticCommandItem({
    id: "heading-2",
    title: "标题 2",
    description: "替换为二级标题",
    aliases: ["h2", "heading2", "title2"],
    keywords: ["标题", "二级标题"],
    commandName: "setHeading",
    args: [2],
  }),
  createStaticCommandItem({
    id: "heading-3",
    title: "标题 3",
    description: "替换为三级标题",
    aliases: ["h3", "heading3", "title3"],
    keywords: ["标题", "三级标题"],
    commandName: "setHeading",
    args: [3],
  }),
  createStaticCommandItem({
    id: "bullet-list",
    title: "无序列表",
    description: "替换为项目符号列表",
    aliases: ["bullet", "ul", "list"],
    keywords: ["列表", "无序列表", "项目符号"],
    commandName: "toggleBulletList",
  }),
  createStaticCommandItem({
    id: "ordered-list",
    title: "有序列表",
    description: "替换为编号列表",
    aliases: ["ordered", "ol", "numbered"],
    keywords: ["列表", "有序列表", "编号"],
    commandName: "toggleOrderedList",
  }),
  createStaticCommandItem({
    id: "task-list",
    title: "任务列表",
    description: "替换为可勾选任务列表",
    aliases: ["task", "todo", "checklist"],
    keywords: ["任务", "待办", "清单"],
    commandName: "toggleTaskList",
  }),
  createStaticCommandItem({
    id: "blockquote",
    title: "引用",
    description: "替换为引用块",
    aliases: ["quote", "blockquote"],
    keywords: ["引用", "引用块"],
    commandName: "toggleBlockquote",
  }),
  createStaticCommandItem({
    id: "code-block",
    title: "代码块",
    description: "替换为代码块",
    aliases: ["code", "codeblock", "pre"],
    keywords: ["代码", "代码块"],
    commandName: "toggleCodeBlock",
  }),
];

const createEnUsItems = (): SlashCommandItem[] => [
  {
    id: "paragraph",
    title: "Paragraph",
    description: "Keep as a normal paragraph",
    aliases: ["text", "p"],
    keywords: ["paragraph", "body text"],
    command: () => true,
    isEnabled: () => true,
  },
  createStaticCommandItem({
    id: "heading-1",
    title: "Heading 1",
    description: "Replace with a level 1 heading",
    aliases: ["h1", "title1"],
    keywords: ["heading", "title"],
    commandName: "setHeading",
    args: [1],
  }),
  createStaticCommandItem({
    id: "heading-2",
    title: "Heading 2",
    description: "Replace with a level 2 heading",
    aliases: ["h2", "title2"],
    keywords: ["heading", "title"],
    commandName: "setHeading",
    args: [2],
  }),
  createStaticCommandItem({
    id: "heading-3",
    title: "Heading 3",
    description: "Replace with a level 3 heading",
    aliases: ["h3", "title3"],
    keywords: ["heading", "title"],
    commandName: "setHeading",
    args: [3],
  }),
  createStaticCommandItem({
    id: "bullet-list",
    title: "Bullet List",
    description: "Replace with a bullet list",
    aliases: ["bullet", "ul", "list"],
    keywords: ["list", "bullet list"],
    commandName: "toggleBulletList",
  }),
  createStaticCommandItem({
    id: "ordered-list",
    title: "Ordered List",
    description: "Replace with a numbered list",
    aliases: ["ordered", "ol", "numbered"],
    keywords: ["list", "ordered list"],
    commandName: "toggleOrderedList",
  }),
  createStaticCommandItem({
    id: "task-list",
    title: "Task List",
    description: "Replace with a checklist",
    aliases: ["task", "todo", "checklist"],
    keywords: ["task", "todo", "list"],
    commandName: "toggleTaskList",
  }),
  createStaticCommandItem({
    id: "blockquote",
    title: "Blockquote",
    description: "Replace with a blockquote",
    aliases: ["quote"],
    keywords: ["blockquote", "quote"],
    commandName: "toggleBlockquote",
  }),
  createStaticCommandItem({
    id: "code-block",
    title: "Code Block",
    description: "Replace with a code block",
    aliases: ["code", "pre"],
    keywords: ["code", "code block"],
    commandName: "toggleCodeBlock",
  }),
];

export const createSlashCommandOptions = (
  locale: PlaygroundLocale = "zh-CN"
): SlashCommandOptions => ({
  items: locale === "en-US" ? createEnUsItems() : createZhCnItems(),
  emptyLabel: locale === "en-US" ? "No matching blocks" : "没有匹配的块",
});
