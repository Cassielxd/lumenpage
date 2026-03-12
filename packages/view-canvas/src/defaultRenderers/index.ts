import type { NodeRenderer } from "../layout-pagination/index";
import { blockquoteRenderer } from "./blockquote";
import { codeBlockRenderer } from "./codeBlock";
import { headingRenderer } from "./heading";
import { horizontalRuleRenderer } from "./horizontalRule";
import { imageRenderer } from "./image";
import { bulletListRenderer, orderedListRenderer, taskListRenderer } from "./list";
import { paragraphRenderer } from "./paragraph";
import {
  createTableSelectionGeometry,
  getTableTextLength,
  serializeTableToText,
  tableRenderer,
} from "./table";
import { videoRenderer } from "./video";

const defaultNodeRenderers: Record<string, any> = {
  paragraph: paragraphRenderer,
  heading: headingRenderer,
  blockquote: blockquoteRenderer,
  codeBlock: codeBlockRenderer,
  horizontalRule: horizontalRuleRenderer,
  bulletList: bulletListRenderer,
  orderedList: orderedListRenderer,
  taskList: taskListRenderer,
  image: imageRenderer,
  video: videoRenderer,
  table: tableRenderer,
};

export const defaultParagraphRenderer = paragraphRenderer;
export const defaultHeadingRenderer = headingRenderer;
export const defaultBlockquoteRenderer = blockquoteRenderer;
export const defaultCodeBlockRenderer = codeBlockRenderer;
export const defaultHorizontalRuleRenderer = horizontalRuleRenderer;
export const defaultBulletListRenderer = bulletListRenderer;
export const defaultOrderedListRenderer = orderedListRenderer;
export const defaultTaskListRenderer = taskListRenderer;
export const defaultImageRenderer = imageRenderer;
export const defaultVideoRenderer = videoRenderer;
export const defaultTableRenderer = tableRenderer;
export const createDefaultTableSelectionGeometry = createTableSelectionGeometry;
export const serializeDefaultTableToText = serializeTableToText;
export const getDefaultTableTextLength = getTableTextLength;

export const getDefaultNodeRenderer = (nodeName?: string | null) => {
  if (!nodeName) {
    return null;
  }

  return defaultNodeRenderers[nodeName] || null;
};

export const getDefaultNodeRenderers = () => ({ ...defaultNodeRenderers });

