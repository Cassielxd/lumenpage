import { getDefaultNodeRenderer as getBaseDefaultNodeRenderer } from "lumenpage-render-engine";
import { createDefaultImageNodeView, imageRenderer } from "./image";
import { createTableSelectionGeometry, tableRenderer } from "./table";
import { createDefaultVideoNodeView, videoRenderer } from "./video";

const canvasRuntimeRenderers: Record<string, any> = {
  image: imageRenderer,
  video: videoRenderer,
  table: tableRenderer,
};

export const createDefaultTableSelectionGeometry = createTableSelectionGeometry;

export const getDefaultNodeRenderer = (nodeName?: string | null) => {
  if (!nodeName) {
    return null;
  }

  return canvasRuntimeRenderers[nodeName] || getBaseDefaultNodeRenderer(nodeName) || null;
};

export {
  createDefaultImageNodeView,
  createDefaultVideoNodeView,
};
