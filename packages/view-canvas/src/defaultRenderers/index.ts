import {
  audioRenderer,
  blockquoteRenderer,
  bookmarkRenderer,
  bulletListRenderer,
  codeBlockRenderer,
  fileRenderer,
  headingRenderer,
  horizontalRuleRenderer,
  orderedListRenderer,
  paragraphRenderer,
  taskListRenderer,
  webPageRenderer,
} from "lumenpage-render-engine";
import { createDefaultAudioNodeView } from "./audio";
import { createDefaultBookmarkNodeView } from "./bookmark";
import { createDefaultFileNodeView } from "./file";
import { createDefaultImageNodeView, imageRenderer } from "./image";
import { createTableSelectionGeometry, tableRenderer } from "./table";
import { createDefaultVideoNodeView, videoRenderer } from "./video";
import { createDefaultWebPageNodeView } from "./webPage";

const defaultNodeRenderers: Record<string, any> = {
  audio: audioRenderer,
  bookmark: bookmarkRenderer,
  paragraph: paragraphRenderer,
  heading: headingRenderer,
  blockquote: blockquoteRenderer,
  codeBlock: codeBlockRenderer,
  file: fileRenderer,
  horizontalRule: horizontalRuleRenderer,
  bulletList: bulletListRenderer,
  orderedList: orderedListRenderer,
  taskList: taskListRenderer,
  image: imageRenderer,
  video: videoRenderer,
  table: tableRenderer,
  webPage: webPageRenderer,
};

export const createDefaultTableSelectionGeometry = createTableSelectionGeometry;

export const getDefaultNodeRenderer = (nodeName?: string | null) => {
  if (!nodeName) {
    return null;
  }

  return defaultNodeRenderers[nodeName] || null;
};

export {
  createDefaultAudioNodeView,
  createDefaultBookmarkNodeView,
  createDefaultFileNodeView,
  createDefaultImageNodeView,
  createDefaultVideoNodeView,
  createDefaultWebPageNodeView,
};
