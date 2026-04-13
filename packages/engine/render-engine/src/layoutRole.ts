import { resolveNodeRendererLayoutCapabilities, type NodeRenderer } from "./node.js";

export type NodeLayoutRole = "leaf" | "container";

export const resolveNodeLayoutRole = (
  renderer: Pick<NodeRenderer, "layoutBlock" | "splitBlock" | "toRuns" | "measureBlock" | "paginateBlock"> | null | undefined,
  node: any,
) => {
  const layout = resolveNodeRendererLayoutCapabilities(renderer);
  return layout.layoutBlock ||
    layout.splitBlock ||
    layout.measureBlock ||
    layout.paginateBlock ||
    layout.toRuns ||
    node?.isTextblock ||
    node?.isAtom
    ? "leaf"
    : "container";
};

export const isLeafLayoutNode = (
  renderer: Pick<NodeRenderer, "layoutBlock" | "splitBlock" | "toRuns" | "measureBlock" | "paginateBlock"> | null | undefined,
  node: any,
) => resolveNodeLayoutRole(renderer, node) === "leaf";
