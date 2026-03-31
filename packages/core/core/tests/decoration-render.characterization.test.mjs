import test from "node:test";
import assert from "node:assert/strict";

import { Decoration } from "lumenpage-view-canvas/view/decorations.ts";
import {
  buildDecorationDrawData,
  clearDecorationCache,
} from "lumenpage-view-canvas/view/render/decorations.ts";

const createOutlineLayout = () => ({
  __version: 1,
  pageWidth: 500,
  pageHeight: 720,
  pageGap: 32,
  lineHeight: 24,
  font: "16px sans-serif",
  margin: {
    left: 48,
    right: 48,
  },
  pages: [
    {
      lines: [
        {
          start: 1,
          end: 5,
          x: 64,
          y: 220,
          width: 140,
          lineHeight: 24,
          text: "test",
          blockId: "paragraph-1",
          blockType: "paragraph",
        },
      ],
      boxes: [],
    },
  ],
});

test("buildDecorationDrawData keeps block outline aligned when cache reuses a scroll bucket", () => {
  clearDecorationCache();

  const layout = createOutlineLayout();
  const decorations = [
    Decoration.node(1, 5, {
      blockOutline: true,
      borderColor: "rgba(59, 130, 246, 0.8)",
      borderWidth: 1,
      blockId: "paragraph-1",
      nodeType: "paragraph",
    }),
  ];
  const baseArgs = {
    layout,
    layoutIndex: null,
    doc: { type: "doc" },
    decorations,
    viewportWidth: 500,
    textLength: 32,
    docPosToTextOffset: (_doc, pos) => pos,
    coordsAtPos: () => null,
    layoutToken: 1,
  };

  const first = buildDecorationDrawData({
    ...baseArgs,
    scrollTop: 120,
  });
  const second = buildDecorationDrawData({
    ...baseArgs,
    scrollTop: 124,
  });

  assert.ok(first);
  assert.ok(second);
  assert.equal(first.nodeRects.length, 1);
  assert.equal(second.nodeRects.length, 1);
  assert.equal(second.nodeRects[0].x, first.nodeRects[0].x);
  assert.equal(second.nodeRects[0].width, first.nodeRects[0].width);
  assert.equal(second.nodeRects[0].height, first.nodeRects[0].height);
  assert.equal(second.nodeRects[0].y, first.nodeRects[0].y - 4);

  clearDecorationCache();
});
