import test from "node:test";
import assert from "node:assert/strict";

import {
  applyCachedOverlayFrame,
  applyResolvedOverlayFrame,
  createOverlayCacheState,
  hideOverlayEntry,
} from "../dist/view/editorView/nodeViews/overlaySyncApply.js";

test("hideOverlayEntry hides node view overlays", () => {
  let lastPayload = null;
  const visible = hideOverlayEntry({
    view: {
      syncDOM(payload) {
        lastPayload = payload;
      },
    },
  });

  assert.equal(visible, false);
  assert.deepEqual(lastPayload, { visible: false });
});

test("applyResolvedOverlayFrame forwards resolved geometry to syncDOM", () => {
  let lastPayload = null;
  const visible = applyResolvedOverlayFrame({
    entry: {
      view: {
        syncDOM(payload) {
          lastPayload = payload;
        },
      },
    },
    frame: {
      x: 10,
      y: 20,
      width: 300,
      height: 40,
      visible: true,
      pageIndex: 1,
      line: {
        blockId: "block-1",
      },
    },
    layout: {
      pageWidth: 600,
    },
  });

  assert.equal(visible, true);
  assert.equal(lastPayload.x, 10);
  assert.equal(lastPayload.pageIndex, 1);
  assert.equal(lastPayload.line.blockId, "block-1");
});

test("applyCachedOverlayFrame and createOverlayCacheState keep cache metadata aligned", () => {
  let lastPayload = null;
  const frame = {
    x: 12,
    y: 44,
    width: 320,
    height: 180,
    visible: true,
    pageIndex: 3,
  };
  const visible = applyCachedOverlayFrame({
    entry: {
      view: {
        syncDOM(payload) {
          lastPayload = payload;
        },
      },
    },
    frame,
    layout: {
      pageWidth: 600,
    },
  });
  const cacheState = createOverlayCacheState({
    frame,
    scrollTop: 200,
    viewportWidth: 900,
    layoutVersion: 11,
  });

  assert.equal(visible, true);
  assert.equal(lastPayload.pageIndex, 3);
  assert.deepEqual(cacheState, {
    x: 12,
    y: 44,
    width: 320,
    height: 180,
    visible: true,
    pageIndex: 3,
    scrollTop: 200,
    viewportWidth: 900,
    layoutVersion: 11,
  });
});
