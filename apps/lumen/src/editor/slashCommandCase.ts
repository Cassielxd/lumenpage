import type {
  SlashCommandItem,
  SlashCommandOptions,
} from "lumenpage-extension-slash-command";

import { createPlaygroundI18n, type PlaygroundLocale } from "./i18n";

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

const createZhCnItems = (): SlashCommandItem[] => {
  const texts = createPlaygroundI18n("zh-CN").slashCommands;
  return [
    {
      id: "paragraph",
      title: texts.paragraphTitle,
      description: texts.paragraphDescription,
      aliases: ["paragraph", "text", "p"],
      keywords: [texts.paragraphTitle, "paragraph", "text"],
      command: () => true,
      isEnabled: () => true,
    },
    createStaticCommandItem({
      id: "heading-1",
      title: texts.heading1Title,
      description: texts.heading1Description,
      aliases: ["h1", "heading1", "title1"],
      keywords: [texts.heading1Title, "heading", "title"],
      commandName: "setHeading",
      args: [1],
    }),
    createStaticCommandItem({
      id: "heading-2",
      title: texts.heading2Title,
      description: texts.heading2Description,
      aliases: ["h2", "heading2", "title2"],
      keywords: [texts.heading2Title, "heading", "title"],
      commandName: "setHeading",
      args: [2],
    }),
    createStaticCommandItem({
      id: "heading-3",
      title: texts.heading3Title,
      description: texts.heading3Description,
      aliases: ["h3", "heading3", "title3"],
      keywords: [texts.heading3Title, "heading", "title"],
      commandName: "setHeading",
      args: [3],
    }),
    createStaticCommandItem({
      id: "bullet-list",
      title: texts.bulletListTitle,
      description: texts.bulletListDescription,
      aliases: ["bullet", "ul", "list"],
      keywords: [texts.bulletListTitle, "list", "bullet"],
      commandName: "toggleBulletList",
    }),
    createStaticCommandItem({
      id: "ordered-list",
      title: texts.orderedListTitle,
      description: texts.orderedListDescription,
      aliases: ["ordered", "ol", "numbered"],
      keywords: [texts.orderedListTitle, "list", "ordered"],
      commandName: "toggleOrderedList",
    }),
    createStaticCommandItem({
      id: "task-list",
      title: texts.taskListTitle,
      description: texts.taskListDescription,
      aliases: ["task", "todo", "checklist"],
      keywords: [texts.taskListTitle, "task", "todo"],
      commandName: "toggleTaskList",
    }),
    createStaticCommandItem({
      id: "blockquote",
      title: texts.blockquoteTitle,
      description: texts.blockquoteDescription,
      aliases: ["quote", "blockquote"],
      keywords: [texts.blockquoteTitle, "quote", "blockquote"],
      commandName: "toggleBlockquote",
    }),
    createStaticCommandItem({
      id: "code-block",
      title: texts.codeBlockTitle,
      description: texts.codeBlockDescription,
      aliases: ["code", "codeblock", "pre"],
      keywords: [texts.codeBlockTitle, "code", "codeblock"],
      commandName: "toggleCodeBlock",
    }),
  ];
};

const createEnUsItems = (): SlashCommandItem[] => {
  const texts = createPlaygroundI18n("en-US").slashCommands;
  return [
    {
      id: "paragraph",
      title: texts.paragraphTitle,
      description: texts.paragraphDescription,
      aliases: ["text", "p"],
      keywords: ["paragraph", "body text"],
      command: () => true,
      isEnabled: () => true,
    },
    createStaticCommandItem({
      id: "heading-1",
      title: texts.heading1Title,
      description: texts.heading1Description,
      aliases: ["h1", "title1"],
      keywords: ["heading", "title"],
      commandName: "setHeading",
      args: [1],
    }),
    createStaticCommandItem({
      id: "heading-2",
      title: texts.heading2Title,
      description: texts.heading2Description,
      aliases: ["h2", "title2"],
      keywords: ["heading", "title"],
      commandName: "setHeading",
      args: [2],
    }),
    createStaticCommandItem({
      id: "heading-3",
      title: texts.heading3Title,
      description: texts.heading3Description,
      aliases: ["h3", "title3"],
      keywords: ["heading", "title"],
      commandName: "setHeading",
      args: [3],
    }),
    createStaticCommandItem({
      id: "bullet-list",
      title: texts.bulletListTitle,
      description: texts.bulletListDescription,
      aliases: ["bullet", "ul", "list"],
      keywords: ["list", "bullet list"],
      commandName: "toggleBulletList",
    }),
    createStaticCommandItem({
      id: "ordered-list",
      title: texts.orderedListTitle,
      description: texts.orderedListDescription,
      aliases: ["ordered", "ol", "numbered"],
      keywords: ["list", "ordered list"],
      commandName: "toggleOrderedList",
    }),
    createStaticCommandItem({
      id: "task-list",
      title: texts.taskListTitle,
      description: texts.taskListDescription,
      aliases: ["task", "todo", "checklist"],
      keywords: ["task", "todo", "list"],
      commandName: "toggleTaskList",
    }),
    createStaticCommandItem({
      id: "blockquote",
      title: texts.blockquoteTitle,
      description: texts.blockquoteDescription,
      aliases: ["quote"],
      keywords: ["blockquote", "quote"],
      commandName: "toggleBlockquote",
    }),
    createStaticCommandItem({
      id: "code-block",
      title: texts.codeBlockTitle,
      description: texts.codeBlockDescription,
      aliases: ["code", "pre"],
      keywords: ["code", "code block"],
      commandName: "toggleCodeBlock",
    }),
  ];
};

export const createSlashCommandOptions = (
  locale: PlaygroundLocale = "zh-CN"
): SlashCommandOptions => ({
  items: locale === "en-US" ? createEnUsItems() : createZhCnItems(),
  emptyLabel: createPlaygroundI18n(locale).slashCommands.emptyLabel,
});
