import test from "node:test";
import assert from "node:assert/strict";

import {
  createOverlayFrameTracePayload,
  createOverlayReasonTracePayload,
} from "./dist/view/editorView/nodeViews/overlayTracePayload.js";

test("createOverlayReasonTracePayload keeps reuse diagnostics on cached traces", () => {
  const payload = createOverlayReasonTracePayload({
    entry: {
      key: "entry-1",
      blockId: "block-1",
      node: {
        type: {
          name: "image",
        },
      },
    },
    visible: true,
    reason: "reuse-last-box-geometry",
    cachedOverlayState: {
      layoutVersion: 9,
      pageIndex: 2,
    },
  });

  assert.deepEqual(payload, {
    key: "entry-1",
    blockId: "block-1",
    nodeType: "image",
    visible: true,
    reason: "reuse-last-box-geometry",
    cachedLayoutVersion: 9,
    cachedPageIndex: 2,
  });
});

test("createOverlayFrameTracePayload carries frame and box diagnostics", () => {
  const payload = createOverlayFrameTracePayload({
    entry: {
      key: "entry-2",
      blockId: "block-2",
      pos: 18,
      node: {
        type: {
          name: "paragraph",
        },
      },
    },
    frame: {
      x: 20,
      y: 30,
      width: 100,
      height: 24,
      visible: true,
      pageIndex: 1,
      line: {
        blockId: "block-2",
        blockType: "paragraph",
        width: 88,
        lineHeight: 22,
      },
      expectedSize: {
        width: 96,
        height: 20,
      },
    },
    boxRect: {
      pageIndex: 1,
      box: {
        key: "box-1",
        role: "text-line",
        type: "text-line",
        blockId: "block-2",
      },
      debugOverlay: {
        directBlockHitCount: 1,
      },
    },
  });

  assert.equal(payload.entryPos, 18);
  assert.equal(payload.pageIndex, 1);
  assert.equal(payload.expectedWidth, 96);
  assert.equal(payload.boxKey, "box-1");
  assert.equal(payload.debugOverlay.directBlockHitCount, 1);
});
