import test from "node:test";
import assert from "node:assert/strict";

import {
  findFallbackNodeViewEntryAtDocPos,
  findNodeViewEntryAtDocPos,
} from "./dist/view/editorView/nodeViews/overlayHitTestingHeuristics.js";
import { resolveNodeViewEntryAtCoords } from "./dist/view/editorView/nodeViews/overlayHitTesting.js";

test("findFallbackNodeViewEntryAtDocPos prefers the smallest containing node view", () => {
  const entry = findFallbackNodeViewEntryAtDocPos({
    entries: [
      {
        key: "outer",
        pos: 10,
        node: {
          nodeSize: 12,
        },
      },
      {
        key: "inner",
        pos: 12,
        node: {
          nodeSize: 4,
        },
      },
    ],
    pos: 13,
  });

  assert.equal(entry?.key, "inner");
});

test("findNodeViewEntryAtDocPos falls back to block-mapped entry before doc-range fallback", () => {
  const blockEntry = {
    key: "block-entry",
    pos: 18,
    view: {
      id: "view-1",
    },
    node: {
      nodeSize: 6,
    },
  };
  const fallbackEntry = {
    key: "fallback-entry",
    pos: 18,
    view: {
      id: "view-2",
    },
    node: {
      nodeSize: 10,
    },
  };

  const entry = findNodeViewEntryAtDocPos({
    entries: [fallbackEntry, blockEntry],
    nodeViewsByBlockId: new Map([["block-1", blockEntry]]),
    pos: 19,
    docPosToTextOffset: () => 25,
    getPreferredBlockIdFromLine: () => "block-1",
    getLineAtOffset(_layoutIndex, _offset) {
      return {
        line: {
          blockId: "block-1",
        },
      };
    },
    layoutIndex: {
      lines: [
        {
          start: 20,
          end: 30,
          line: {
            blockId: "block-1",
          },
        },
      ],
    },
    doc: {},
  });

  assert.equal(entry?.key, "block-entry");
});

test("resolveNodeViewEntryAtCoords prefers box hit before doc-position fallback", () => {
  const entry = resolveNodeViewEntryAtCoords({
    entries: [
      {
        key: "paragraph-entry",
        pos: 10,
        node: {
          nodeSize: 8,
          type: {
            name: "paragraph",
          },
        },
      },
      {
        key: "image-entry",
        pos: 20,
        node: {
          type: {
            name: "image",
          },
        },
      },
    ],
    nodeViewsByBlockId: new Map(),
    coords: {
      x: 50,
      y: 50,
    },
    getDocPosFromCoords() {
      return 12;
    },
    docPosToTextOffset() {
      return 0;
    },
    getPreferredBlockIdFromLine() {
      return null;
    },
    getLineAtOffset() {
      return null;
    },
    layout: {},
    layoutIndex: {},
    scrollTop: 0,
    viewportWidth: 900,
    viewportHeight: 400,
    doc: {},
    resolveNodeViewBoxRect({ entry }) {
      if (entry.key !== "image-entry") {
        return null;
      }
      return {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      };
    },
    findNodeViewEntryAtDocPos() {
      return {
        key: "fallback-entry",
      };
    },
  });

  assert.equal(entry?.key, "image-entry");
});

test("resolveNodeViewEntryAtCoords falls back to doc-position lookup when no box hit matches", () => {
  const entry = resolveNodeViewEntryAtCoords({
    entries: [],
    nodeViewsByBlockId: new Map(),
    coords: {
      x: 500,
      y: 500,
    },
    getDocPosFromCoords() {
      return 22;
    },
    docPosToTextOffset() {
      return 0;
    },
    getPreferredBlockIdFromLine() {
      return null;
    },
    getLineAtOffset() {
      return null;
    },
    layout: {},
    layoutIndex: {},
    scrollTop: 0,
    viewportWidth: 900,
    viewportHeight: 400,
    doc: {},
    resolveNodeViewBoxRect() {
      return null;
    },
    findNodeViewEntryAtDocPos({ pos }) {
      return {
        key: `fallback-${pos}`,
      };
    },
  });

  assert.equal(entry?.key, "fallback-22");
});
