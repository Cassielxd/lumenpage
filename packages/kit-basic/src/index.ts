export {
  schema,
  createDocFromText,
  docToText,
  serializeTableToText,
  getTableTextLength,
} from "./schema";

import { NodeRendererRegistry } from "lumenpage-view-canvas";
import { paragraphRenderer } from "lumenpage-node-paragraph";
import { blockquoteRenderer } from "lumenpage-node-blockquote";
import { headingRenderer } from "lumenpage-node-heading";
import { codeBlockRenderer } from "lumenpage-node-code-block";
import { tableRenderer } from "lumenpage-node-table";
import { horizontalRuleRenderer } from "lumenpage-node-horizontal-rule";
import { bulletListRenderer, orderedListRenderer } from "lumenpage-node-list";
import { imageRenderer } from "lumenpage-node-image";
import { videoRenderer } from "lumenpage-node-video";

export const registerNodeRenderers = (registry: NodeRendererRegistry) => {
  registry.register("blockquote", blockquoteRenderer);
  registry.register("code_block", codeBlockRenderer);
  registry.register("horizontal_rule", horizontalRuleRenderer);
  registry.register("paragraph", paragraphRenderer);
  registry.register("heading", headingRenderer);
  registry.register("table", tableRenderer);
  registry.register("bullet_list", bulletListRenderer);
  registry.register("ordered_list", orderedListRenderer);
  registry.register("image", imageRenderer);
  registry.register("video", videoRenderer);
  return registry;
};

export const createDefaultNodeRendererRegistry = () =>
  registerNodeRenderers(new NodeRendererRegistry());

export {
  paragraphRenderer,
  blockquoteRenderer,
  codeBlockRenderer,
  horizontalRuleRenderer,
  headingRenderer,
  tableRenderer,
  bulletListRenderer,
  orderedListRenderer,
  imageRenderer,
  videoRenderer,
};


export {
  basicCommands,
  runCommand,
  setBlockAlign,
  setParagraphIndent,
  changeParagraphIndent,
  setHeadingLevel,
  setParagraph,
  setBlockTypeByName,
  createViewCommands,
  createCanvasEditorKeymap,
  addTableRowAfter,
  addTableRowBefore,
  deleteTableRow,
  addTableColumnAfter,
  addTableColumnBefore,
  deleteTableColumn,
  goToNextTableCell,
  goToPreviousTableCell,
  mergeTableCellRight,
  splitTableCell,
  selectCurrentAndNextTableCell,
  selectCurrentAndBelowTableCell,
  mergeSelectedTableCells,
} from "./commands";




