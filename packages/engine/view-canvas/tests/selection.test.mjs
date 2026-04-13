import test from "node:test";
import assert from "node:assert/strict";

import { selectionToRects } from "../dist/view/render/selection.js";

test("visual block selection does not include the trailing empty line at the end boundary", () => {
  const layout = {
    pageWidth: 600,
    pageHeight: 800,
    pageGap: 24,
    lineHeight: 20,
    font: "14px Arial",
    margin: {
      left: 48,
      right: 48,
    },
    pages: [
      {
        lines: [
          {
            start: 0,
            end: 1,
            x: 48,
            y: 80,
            width: 320,
            lineHeight: 120,
            blockType: "webPage",
            blockId: "web-page-1",
            text: "",
            runs: [],
            blockAttrs: {
              layoutCapabilities: {
                "visual-block": true,
              },
              visualBounds: {
                x: 48,
                width: 320,
              },
            },
          },
          {
            start: 1,
            end: 1,
            x: 48,
            y: 220,
            width: 0,
            lineHeight: 20,
            blockType: "paragraph",
            text: "",
            runs: [],
          },
        ],
      },
    ],
  };

  const rects = selectionToRects(layout, 0, 1, 0, 800, 1, null);

  assert.equal(rects.length, 1);
  assert.deepEqual(rects[0], {
    x: 148,
    y: 80,
    width: 320,
    height: 120,
  });
});
