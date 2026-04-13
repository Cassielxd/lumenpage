import test from "node:test";
import assert from "node:assert/strict";

import {
  chooseBestNodeViewBoxCandidate,
  requiresBoxAnchoredOverlay,
  resolveExpectedOverlaySize,
} from "../dist/view/editorView/nodeViews/overlayGeometryHeuristics.js";

const createLayout = () => ({
  pageWidth: 600,
  pageHeight: 800,
  pageGap: 24,
  margin: {
    left: 40,
    right: 40,
  },
  pages: [
    {
      boxes: [],
    },
  ],
});

test("requires box-anchored overlay for visual block node types", () => {
  assert.equal(
    requiresBoxAnchoredOverlay({
      node: {
        type: {
          name: "image",
        },
      },
    }),
    true,
  );
  assert.equal(
    requiresBoxAnchoredOverlay({
      node: {
        type: {
          name: "paragraph",
        },
      },
    }),
    false,
  );
});

test("resolveExpectedOverlaySize clamps overlay width to page content width", () => {
  const size = resolveExpectedOverlaySize(
    {
      node: {
        attrs: {
          width: 900,
          height: 180,
        },
      },
    },
    createLayout([]),
  );

  assert.deepEqual(size, {
    width: 520,
    height: 180,
  });
});

test("chooseBestNodeViewBoxCandidate keeps visual block overlays anchored to the best matched box", () => {
  const { best, comparableCandidates } = chooseBestNodeViewBoxCandidate({
    expectedSize: {
      width: 320,
      height: 120,
    },
    candidates: [
      {
        hit: {
          box: {
            key: "text-line-box",
          },
        },
        rect: {
          x: 68,
          y: 44,
          width: 340,
          height: 24,
        },
        area: 8160,
        visibleOverlap: 24,
        distanceToViewport: 0,
        sizeMismatch: 136,
        depth: 2,
        visualBlock: false,
      },
      {
        hit: {
          box: {
            key: "image-box",
          },
        },
        rect: {
          x: 82,
          y: 48,
          width: 320,
          height: 120,
        },
        area: 38400,
        visibleOverlap: 120,
        distanceToViewport: 0,
        sizeMismatch: 0,
        depth: 1,
        visualBlock: true,
      },
      {
        hit: {
          box: {
            key: "image-box-offscreen",
          },
        },
        rect: {
          x: 82,
          y: 620,
          width: 320,
          height: 120,
        },
        area: 38400,
        visibleOverlap: 0,
        distanceToViewport: 120,
        sizeMismatch: 2,
        depth: 1,
        visualBlock: true,
      },
    ],
  });

  assert.equal(comparableCandidates.length, 2);
  assert.equal(best.hit.box.key, "image-box");
  assert.deepEqual(best.rect, {
    x: 82,
    y: 48,
    width: 320,
    height: 120,
  });
});
