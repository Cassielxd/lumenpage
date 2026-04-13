import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveCachedOverlayReuseFrame,
  resolveOverlaySyncFrame,
} from "../dist/view/editorView/nodeViews/overlayFrame.js";

test("resolveCachedOverlayReuseFrame adjusts y by scroll delta and preserves visibility", () => {
  const frame = resolveCachedOverlayReuseFrame({
    cachedOverlayState: {
      x: 40,
      y: 220,
      width: 300,
      height: 100,
      scrollTop: 180,
      pageIndex: 2,
    },
    scrollTop: 200,
    viewportHeight: 500,
  });

  assert.deepEqual(frame, {
    x: 40,
    y: 200,
    width: 300,
    height: 100,
    visible: true,
    pageIndex: 2,
  });
});

test("resolveOverlaySyncFrame prefers expected visual size over fallback line size", () => {
  const frame = resolveOverlaySyncFrame({
    entry: {
      node: {
        attrs: {
          width: 900,
          height: 180,
        },
      },
    },
    item: {
      pageIndex: 1,
      line: {
        x: 20,
        y: 30,
        width: 100,
        lineHeight: 24,
      },
    },
    layout: {
      pageWidth: 600,
      pageHeight: 800,
      pageGap: 24,
      lineHeight: 22,
      margin: {
        left: 40,
        right: 40,
      },
    },
    scrollTop: 100,
    viewportWidth: 700,
    viewportHeight: 500,
  });

  assert.equal(frame.x, 70);
  assert.equal(frame.y, 754);
  assert.equal(frame.width, 520);
  assert.equal(frame.height, 180);
  assert.equal(frame.pageIndex, 1);
  assert.equal(frame.visible, false);
});
