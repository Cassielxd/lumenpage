import {
  blockquoteRenderer,
  bulletListRenderer,
  codeBlockRenderer,
  headingRenderer,
  horizontalRuleRenderer,
  orderedListRenderer,
  paragraphRenderer,
  taskListRenderer,
} from "lumenpage-render-engine";
import { createDefaultImageNodeView, imageRenderer } from "./image";
import { createTableSelectionGeometry, tableRenderer } from "./table";
import { createDefaultVideoNodeView, videoRenderer } from "./video";

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

export const createDefaultTableSelectionGeometry = createTableSelectionGeometry;

export const getDefaultNodeRenderer = (nodeName?: string | null) => {
  if (!nodeName) {
    return null;
  }

  return defaultNodeRenderers[nodeName] || null;
};

export {
  createDefaultImageNodeView,
  createDefaultVideoNodeView,
};
