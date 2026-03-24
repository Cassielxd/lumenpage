import type { NodeRenderer } from "./node";

export type NodeLayoutRole = "leaf" | "container";

export const resolveNodeLayoutRole = (
  renderer: Pick<NodeRenderer, "layoutBlock" | "splitBlock" | "toRuns" | "measureBlock" | "paginateBlock"> | null | undefined,
  node: any,
): NodeLayoutRole =>
  renderer?.layoutBlock ||
  renderer?.splitBlock ||
  renderer?.measureBlock ||
  renderer?.paginateBlock ||
  renderer?.toRuns ||
  node?.isTextblock ||
  node?.isAtom
    ? "leaf"
    : "container";

export const isLeafLayoutNode = (
  renderer: Pick<NodeRenderer, "layoutBlock" | "splitBlock" | "toRuns" | "measureBlock" | "paginateBlock"> | null | undefined,
  node: any,
) => resolveNodeLayoutRole(renderer, node) === "leaf";
