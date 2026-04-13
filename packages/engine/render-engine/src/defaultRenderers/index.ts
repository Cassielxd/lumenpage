import { blockquoteRenderer } from "./blockquote.js";
import { codeBlockRenderer } from "./codeBlock.js";
import { headingRenderer } from "./heading.js";
import { horizontalRuleRenderer } from "./horizontalRule.js";
import { imageRenderer } from "./image.js";
import { paragraphRenderer } from "./paragraph.js";
import { pageBreakRenderer } from "./pageBreak.js";
import { splitTableBlock, tableRenderer } from "./table.js";
import { videoRenderer } from "./video.js";
import {
  bulletListRenderer,
  orderedListRenderer,
  renderListMarker,
  resolveListMarker,
  taskListRenderer,
} from "./list.js";
import {
  createImplicitBlockFragmentOwner,
  ensureBlockFragmentOwner,
  hasFragmentOwnerType,
  shiftFragmentOwners,
} from "./fragmentOwners.js";

export { blockquoteRenderer };
export { codeBlockRenderer };
export { headingRenderer };
export { horizontalRuleRenderer };
export { imageRenderer };
export { paragraphRenderer };
export { pageBreakRenderer };
export { tableRenderer };
export { splitTableBlock };
export { videoRenderer };
export {
  bulletListRenderer,
  orderedListRenderer,
  renderListMarker,
  resolveListMarker,
  taskListRenderer,
};
export {
  createImplicitBlockFragmentOwner,
  ensureBlockFragmentOwner,
  hasFragmentOwnerType,
  shiftFragmentOwners,
};

export { blockquoteRenderer as defaultBlockquoteRenderer };
export { codeBlockRenderer as defaultCodeBlockRenderer };
export { headingRenderer as defaultHeadingRenderer };
export { horizontalRuleRenderer as defaultHorizontalRuleRenderer };
export { imageRenderer as defaultImageRenderer };
export { paragraphRenderer as defaultParagraphRenderer };
export { pageBreakRenderer as defaultPageBreakRenderer };
export { tableRenderer as defaultTableRenderer };
export { splitTableBlock as defaultTableSplitBlock };
export { videoRenderer as defaultVideoRenderer };
export {
  bulletListRenderer as defaultBulletListRenderer,
  orderedListRenderer as defaultOrderedListRenderer,
  renderListMarker as defaultRenderListMarker,
  resolveListMarker as defaultResolveListMarker,
  taskListRenderer as defaultTaskListRenderer,
};

const defaultNodeRenderers: Record<string, any> = {
  paragraph: paragraphRenderer,
  heading: headingRenderer,
  blockquote: blockquoteRenderer,
  codeBlock: codeBlockRenderer,
  horizontalRule: horizontalRuleRenderer,
  bulletList: bulletListRenderer,
  orderedList: orderedListRenderer,
  taskList: taskListRenderer,
  pageBreak: pageBreakRenderer,
  image: imageRenderer,
  video: videoRenderer,
  table: tableRenderer,
};

export const getDefaultNodeRenderer = (nodeName?: string | null) => {
  if (!nodeName) {
    return null;
  }

  return defaultNodeRenderers[nodeName] || null;
};

export { defaultNodeRenderers };
