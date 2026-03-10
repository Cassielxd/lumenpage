import { LumenExtension, LumenNodeExtension } from "lumenpage-core";
import { baseKeymap } from "lumenpage-commands";
import { history } from "lumenpage-history";
import { schemaMarks, schemaNodes } from "lumenpage-schema-basic";
import { ellipsis, emDash, smartQuotes } from "lumenpage-inputrules";
import {
  paragraphRenderer,
  blockquoteRenderer,
  headingRenderer,
  codeBlockRenderer,
  horizontalRuleRenderer,
} from "lumenpage-node-basic";
import {
  bulletListRenderer,
  orderedListRenderer,
  taskListRenderer,
} from "lumenpage-node-list";
import { imageRenderer, videoRenderer } from "lumenpage-node-media";
import { createTableSelectionGeometry, tableRenderer } from "lumenpage-node-table";
import { basicCommands, createCanvasEditorKeymap, createViewCommands } from "./commands";

const createLayoutNodeExtension = ({
  name,
  renderer,
  nodeSelectionTypes,
  selectionGeometry,
}: {
  name: string;
  renderer: any;
  nodeSelectionTypes?: string[];
  selectionGeometry?: any;
}) =>
  LumenNodeExtension.create({
    name,
    priority: 100,
    addLayout: () => ({
      renderer,
      pagination: renderer?.pagination,
    }),
    addCanvas: () => ({
      nodeSelectionTypes,
      selectionGeometries: selectionGeometry ? [selectionGeometry] : [],
    }),
  });

export const SchemaExtension = LumenExtension.create({
  name: "schema",
  priority: 1000,
  addSchema: () => ({
    nodes: schemaNodes,
    marks: schemaMarks,
  }),
});

export const HistoryExtension = LumenExtension.create({
  name: "history",
  priority: 900,
  addPlugins: () => [history()],
});

export const EditingCommandsExtension = LumenExtension.create({
  name: "editing-commands",
  priority: 850,
  addCommands: () => ({
    ...basicCommands,
    ...createViewCommands(),
  }),
});

export const BaseKeymapExtension = LumenExtension.create({
  name: "base-keymap",
  priority: 800,
  addShortcuts: () => baseKeymap,
});

export const CanvasKeymapExtension = LumenExtension.create({
  name: "canvas-keymap",
  priority: 810,
  addShortcuts: () => createCanvasEditorKeymap(),
});

type InputRulesExtensionOptions = {
  name?: string;
  rules?: any[];
};

export const createLumenInputRulesExtension = (options: InputRulesExtensionOptions = {}) =>
  LumenExtension.create({
    name: options.name || "smart-input-rules",
    priority: 700,
    addInputRules: () => {
      const defaultRules = [ellipsis, emDash, ...smartQuotes].filter(Boolean);
      const resolvedRules = Array.isArray(options.rules) && options.rules.length > 0 ? options.rules : defaultRules;
      return resolvedRules;
    },
  });

export const BlockquoteExtension = createLayoutNodeExtension({
  name: "blockquote",
  renderer: blockquoteRenderer,
});

export const CodeBlockExtension = createLayoutNodeExtension({
  name: "code_block",
  renderer: codeBlockRenderer,
});

export const HorizontalRuleExtension = createLayoutNodeExtension({
  name: "horizontal_rule",
  renderer: horizontalRuleRenderer,
  nodeSelectionTypes: ["horizontal_rule"],
});

export const ParagraphExtension = createLayoutNodeExtension({
  name: "paragraph",
  renderer: paragraphRenderer,
});

export const HeadingExtension = createLayoutNodeExtension({
  name: "heading",
  renderer: headingRenderer,
});

export const TableExtension = createLayoutNodeExtension({
  name: "table",
  renderer: tableRenderer,
  selectionGeometry: createTableSelectionGeometry(),
});

export const BulletListExtension = createLayoutNodeExtension({
  name: "bullet_list",
  renderer: bulletListRenderer,
});

export const OrderedListExtension = createLayoutNodeExtension({
  name: "ordered_list",
  renderer: orderedListRenderer,
});

export const TaskListExtension = createLayoutNodeExtension({
  name: "task_list",
  renderer: taskListRenderer,
});

export const ImageExtension = createLayoutNodeExtension({
  name: "image",
  renderer: imageRenderer,
  nodeSelectionTypes: ["image"],
});

export const VideoExtension = createLayoutNodeExtension({
  name: "video",
  renderer: videoRenderer,
  nodeSelectionTypes: ["video"],
});

export const LumenStarterKit = [
  SchemaExtension,
  HistoryExtension,
  EditingCommandsExtension,
  BaseKeymapExtension,
  CanvasKeymapExtension,
  BlockquoteExtension,
  CodeBlockExtension,
  HorizontalRuleExtension,
  ParagraphExtension,
  HeadingExtension,
  TableExtension,
  BulletListExtension,
  OrderedListExtension,
  TaskListExtension,
  ImageExtension,
  VideoExtension,
] as const;
