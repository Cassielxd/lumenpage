import type { EditorState } from "lumenpage-state";
import { findNodeJSON } from "./find-node.js";
import { JSONNode } from "../types/prosemirror.js";

export const logNodeFromJSON =
  (state: EditorState) =>
  ({ doc, node }: { doc: JSONNode; node: JSONNode }) => {
    const fullDoc = state.doc;
    const path = findNodeJSON([], doc, node);
    if (path) {
      console.log(
        path.reduce(
          (node, pathItem) => (node as any)[pathItem],
          fullDoc.toJSON() as JSONNode,
        ),
      );
    } else {
      console.log(node);
    }
  };

