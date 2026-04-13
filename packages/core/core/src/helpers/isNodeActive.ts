import type { NodeType } from "lumenpage-model";
import type { EditorState } from "lumenpage-state";

import { matchAttributes } from "./matchAttributes.js";

export const isNodeActive = (
  state: EditorState,
  type: NodeType,
  attributes: Record<string, unknown> = {}
) => {
  const selection = state.selection as EditorState["selection"] & {
    $from?: {
      depth: number;
      node: (depth: number) => { type: NodeType; attrs?: Record<string, unknown> } | null;
    };
  };

  for (let depth = selection.$from?.depth ?? -1; depth >= 0; depth -= 1) {
    const node = selection.$from?.node(depth);

    if (node?.type === type && matchAttributes(node.attrs, attributes)) {
      return true;
    }
  }

  let active = false;

  state.doc.nodesBetween(selection.from, selection.to, (node) => {
    if (node.type === type && matchAttributes(node.attrs as Record<string, unknown>, attributes)) {
      active = true;
      return false;
    }

    return undefined;
  });

  return active;
};
