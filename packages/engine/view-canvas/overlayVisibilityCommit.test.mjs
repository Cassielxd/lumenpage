import test from "node:test";
import assert from "node:assert/strict";

import { commitNodeViewOverlayVisibility } from "./dist/view/editorView/nodeViews/overlayVisibilityCommit.js";

test("commitNodeViewOverlayVisibility hides stale overlays and preserves next visible set", () => {
  const hiddenPayloads = [];
  const nextVisibleOverlayKeys = new Set(["entry-2"]);
  const committed = commitNodeViewOverlayVisibility({
    nodeViews: new Map([
      [
        "entry-1",
        {
          view: {
            syncDOM(payload) {
              hiddenPayloads.push(payload);
            },
          },
        },
      ],
      [
        "entry-2",
        {
          view: {
            syncDOM() {
              throw new Error("next visible overlay should not be hidden");
            },
          },
        },
      ],
    ]),
    lastVisibleOverlayKeys: new Set(["entry-1", "entry-2"]),
    nextVisibleOverlayKeys,
  });

  assert.equal(hiddenPayloads.length, 1);
  assert.deepEqual(hiddenPayloads[0], { visible: false });
  assert.equal(committed, nextVisibleOverlayKeys);
});
