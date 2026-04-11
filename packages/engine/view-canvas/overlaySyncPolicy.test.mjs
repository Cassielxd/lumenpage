import test from "node:test";
import assert from "node:assert/strict";

import {
  canReuseCachedOverlayState,
  shouldEmitNodeOverlayTrace,
} from "./dist/view/editorView/nodeViews/overlaySyncPolicy.js";

test("canReuseCachedOverlayState rejects stale viewport and layout versions", () => {
  assert.equal(
    canReuseCachedOverlayState({
      cached: {
        x: 10,
        y: 20,
        width: 300,
        height: 120,
        scrollTop: 200,
        viewportWidth: 800,
        layoutVersion: 7,
      },
      scrollTop: 240,
      viewportWidth: 800,
      layoutVersion: 7,
    }),
    true,
  );

  assert.equal(
    canReuseCachedOverlayState({
      cached: {
        x: 10,
        y: 20,
        width: 300,
        height: 120,
        scrollTop: 200,
        viewportWidth: 780,
        layoutVersion: 7,
      },
      scrollTop: 240,
      viewportWidth: 800,
      layoutVersion: 7,
    }),
    false,
  );

  assert.equal(
    canReuseCachedOverlayState({
      cached: {
        x: 10,
        y: 20,
        width: 300,
        height: 120,
        scrollTop: 200,
        viewportWidth: 800,
        layoutVersion: 6,
      },
      scrollTop: 240,
      viewportWidth: 800,
      layoutVersion: 7,
    }),
    false,
  );
});

test("shouldEmitNodeOverlayTrace stays quiet for stable paragraph overlays", () => {
  assert.equal(
    shouldEmitNodeOverlayTrace({
      entry: {
        blockId: "block-1",
        node: {
          type: {
            name: "paragraph",
          },
        },
      },
      line: {
        blockId: "block-1",
      },
      boxRect: {
        box: {
          blockId: "block-1",
        },
        debugOverlay: {
          directBlockHitCount: 1,
          exactRangeHitCount: 0,
          overlapRangeHitCount: 0,
          visualBlockTypeHitCount: 0,
          candidateCount: 1,
          comparableCandidateCount: 1,
          chosenSizeMismatch: 0,
        },
      },
      visible: true,
      reason: null,
    }),
    false,
  );
});

test("shouldEmitNodeOverlayTrace still traces visual blocks and explicit reasons", () => {
  assert.equal(
    shouldEmitNodeOverlayTrace({
      entry: {
        node: {
          type: {
            name: "image",
          },
        },
      },
      visible: true,
      reason: null,
    }),
    true,
  );

  assert.equal(
    shouldEmitNodeOverlayTrace({
      entry: {
        node: {
          type: {
            name: "paragraph",
          },
        },
      },
      visible: false,
      reason: "no-box-or-line",
    }),
    true,
  );
});
