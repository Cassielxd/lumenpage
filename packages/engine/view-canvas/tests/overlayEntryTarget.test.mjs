import test from "node:test";
import assert from "node:assert/strict";

import { resolveNodeViewOverlaySyncTarget } from "../dist/view/editorView/nodeViews/overlayEntryTarget.js";

test("resolveNodeViewOverlaySyncTarget keeps line-based entries on layout line lookup", () => {
  const lookups = [];
  const target = resolveNodeViewOverlaySyncTarget({
    entry: {
      pos: 18,
      blockId: "block-1",
      node: {
        type: {
          name: "paragraph",
        },
      },
    },
    layout: {
      pages: [],
    },
    layoutIndex: {
      boxes: [],
    },
    scrollTop: 0,
    viewportWidth: 900,
    viewportHeight: 400,
    doc: {
      size: 100,
    },
    docPosToTextOffset(_doc, pos) {
      return pos + 2;
    },
    getLineAtOffset(_layoutIndex, offset) {
      lookups.push(offset);
      return {
        line: {
          blockId: "block-1",
        },
        pageIndex: 1,
      };
    },
    getNodeViewEntryPos(entry) {
      return entry.pos;
    },
    requiresBoxAnchoredOverlay() {
      return false;
    },
    resolveNodeViewBoxRect() {
      return null;
    },
  });

  assert.equal(target.boxRect, null);
  assert.equal(target.item.pageIndex, 1);
  assert.deepEqual(lookups, [20]);
});

test("resolveNodeViewOverlaySyncTarget skips line lookup for box-anchored entries", () => {
  let lookupCount = 0;
  const target = resolveNodeViewOverlaySyncTarget({
    entry: {
      pos: 30,
      blockId: "block-2",
      node: {
        type: {
          name: "image",
        },
      },
    },
    layout: {
      pages: [
        {
          boxes: [
            {
              key: "box-1",
              blockId: "block-2",
              type: "image",
              role: "image",
              rect: {
                x: 0,
                y: 0,
                width: 200,
                height: 100,
              },
            },
          ],
        },
      ],
      pageWidth: 600,
      pageHeight: 800,
      pageGap: 32,
      margin: {
        left: 40,
        right: 40,
      },
    },
    layoutIndex: {
      boxes: [
        {
          box: {
            key: "box-1",
            blockId: "block-2",
            type: "image",
            role: "image",
            layoutCapabilities: {
              "visual-block": true,
            },
            rect: {
              x: 0,
              y: 0,
              width: 200,
              height: 100,
            },
          },
          pageIndex: 0,
          depth: 0,
        },
      ],
    },
    scrollTop: 0,
    viewportWidth: 900,
    viewportHeight: 400,
    doc: {
      size: 100,
    },
    docPosToTextOffset() {
      lookupCount += 1;
      return 0;
    },
    getLineAtOffset() {
      lookupCount += 1;
      return null;
    },
    getNodeViewEntryPos(entry) {
      return entry.pos;
    },
    requiresBoxAnchoredOverlay() {
      return true;
    },
    resolveNodeViewBoxRect() {
      return {
        box: {
          blockId: "block-2",
        },
      };
    },
  });

  assert.equal(target.item, null);
  assert.equal(target.boxRect.box.blockId, "block-2");
  assert.equal(lookupCount, 0);
});
