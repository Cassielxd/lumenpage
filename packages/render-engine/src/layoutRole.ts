import type { NodeRenderer } from "./node";

export type NodeLayoutRole = "leaf" | "container";

export const resolveNodeLayoutRole = (
  renderer: Pick<NodeRenderer, "layoutBlock" | "toRuns"> | null | undefined,
  node: any
): NodeLayoutRole =>
  renderer?.layoutBlock || renderer?.toRuns || node?.isTextblock || node?.isAtom
    ? "leaf"
    : "container";

export const isLeafLayoutNode = (
  renderer: Pick<NodeRenderer, "layoutBlock" | "toRuns"> | null | undefined,
  node: any
) => resolveNodeLayoutRole(renderer, node) === "leaf";
