import test from "node:test";
import assert from "node:assert/strict";

import { syncNodeViewOverlayEntry } from "./dist/view/editorView/nodeViews/overlayEntrySync.js";

test("syncNodeViewOverlayEntry reuses cached box geometry when layout is still compatible", () => {
  let lastPayload = null;
  const traces = [];
  const visible = syncNodeViewOverlayEntry({
    entry: {
      key: "entry-1",
      blockId: "block-1",
      node: {
        type: {
          name: "image",
        },
      },
      view: {
        syncDOM(payload) {
          lastPayload = payload;
        },
      },
    },
    layout: {
      pageWidth: 600,
    },
    scrollTop: 110,
    viewportWidth: 900,
    viewportHeight: 400,
    hasPendingDocLayout: false,
    currentLayoutVersion: 7,
    lastVisibleOverlayKeys: new Set(),
    lastOverlayStateByKey: new Map([
      [
        "entry-1",
        {
          x: 20,
          y: 140,
          width: 300,
          height: 120,
          visible: true,
          pageIndex: 1,
          scrollTop: 100,
          viewportWidth: 900,
          layoutVersion: 7,
        },
      ],
    ]),
    emitTrace(payload) {
      traces.push(payload);
    },
  });

  assert.equal(visible, true);
  assert.equal(lastPayload.visible, true);
  assert.equal(lastPayload.y, 130);
  assert.equal(traces[0].reason, "reuse-last-box-geometry");
});

test("syncNodeViewOverlayEntry keeps visible state when box overlay waits for pending layout", () => {
  let callCount = 0;
  const visible = syncNodeViewOverlayEntry({
    entry: {
      key: "entry-2",
      node: {
        type: {
          name: "image",
        },
      },
      view: {
        syncDOM() {
          callCount += 1;
        },
      },
    },
    layout: {
      pageWidth: 600,
    },
    scrollTop: 0,
    viewportWidth: 900,
    viewportHeight: 400,
    hasPendingDocLayout: true,
    currentLayoutVersion: 4,
    lastVisibleOverlayKeys: new Set(["entry-2"]),
    lastOverlayStateByKey: new Map(),
    emitTrace() {},
  });

  assert.equal(visible, true);
  assert.equal(callCount, 0);
});

test("syncNodeViewOverlayEntry applies resolved geometry and refreshes box cache", () => {
  let lastPayload = null;
  const cache = new Map();
  const visible = syncNodeViewOverlayEntry({
    entry: {
      key: "entry-3",
      blockId: "block-3",
      node: {
        type: {
          name: "image",
        },
        attrs: {
          width: 320,
          height: 180,
        },
      },
      view: {
        syncDOM(payload) {
          lastPayload = payload;
        },
      },
    },
    boxRect: {
      x: 40,
      y: 60,
      width: 300,
      height: 160,
      pageIndex: 2,
      box: {
        key: "box-3",
        blockId: "block-3",
        role: "image",
        type: "image",
      },
      debugOverlay: {
        directBlockHitCount: 1,
      },
    },
    layout: {
      pageWidth: 600,
      pageHeight: 800,
      pageGap: 32,
      lineHeight: 24,
      margin: {
        left: 40,
        right: 40,
      },
    },
    scrollTop: 20,
    viewportWidth: 900,
    viewportHeight: 500,
    hasPendingDocLayout: false,
    currentLayoutVersion: 12,
    lastVisibleOverlayKeys: new Set(),
    lastOverlayStateByKey: cache,
    emitTrace() {},
  });

  assert.equal(visible, true);
  assert.equal(lastPayload.pageIndex, 2);
  assert.equal(cache.get("entry-3").layoutVersion, 12);
  assert.equal(cache.get("entry-3").scrollTop, 20);
});
