import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRendererOverlayDisplayList,
  executeRendererOverlayDisplayList,
} from "lumenpage-view-canvas/view/render/overlayRenderer.ts";

const createMockContext = () => {
  const calls = [];
  return {
    calls,
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fill() {},
    roundRect() {},
    rect() {},
    fillText() {},
    arcTo() {},
    fillRect: (...args) => {
      calls.push(["fillRect", ...args]);
    },
    strokeRect: (...args) => {
      calls.push(["strokeRect", ...args]);
    },
  };
};

test("overlay renderer keeps side-specific decoration borders from falling back to full strokeRect", () => {
  const leftBorderCtx = createMockContext();
  const leftBorderDisplayList = buildRendererOverlayDisplayList({
    settings: {},
    clientHeight: 600,
    caret: null,
    decorations: {
      inlineRects: [],
      nodeRects: [
        {
          x: 24,
          y: 40,
          width: 180,
          height: 32,
          decoration: {
            spec: {
              borderColor: "rgba(59, 130, 246, 0.8)",
              borderLeftWidth: 4,
            },
          },
        },
      ],
      textSegments: [],
      widgets: [],
    },
  });
  executeRendererOverlayDisplayList({
    ctx: leftBorderCtx,
    displayList: leftBorderDisplayList,
  });

  assert.deepEqual(leftBorderCtx.calls, [["fillRect", 24, 40, 4, 32]]);

  const fullBorderCtx = createMockContext();
  const fullBorderDisplayList = buildRendererOverlayDisplayList({
    settings: {},
    clientHeight: 600,
    caret: null,
    decorations: {
      inlineRects: [],
      nodeRects: [
        {
          x: 24,
          y: 40,
          width: 180,
          height: 32,
          decoration: {
            spec: {
              borderColor: "rgba(59, 130, 246, 0.8)",
              borderWidth: 2,
            },
          },
        },
      ],
      textSegments: [],
      widgets: [],
    },
  });
  executeRendererOverlayDisplayList({
    ctx: fullBorderCtx,
    displayList: fullBorderDisplayList,
  });

  assert.deepEqual(fullBorderCtx.calls, [["strokeRect", 24, 40, 180, 32]]);
});
