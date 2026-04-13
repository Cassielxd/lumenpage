import test from "node:test";
import assert from "node:assert/strict";

import { getRendererFragmentTreePaintSignature } from "../dist/view/render/pageFragmentSignature.js";

test("fragment tree signature ignores trees without visual fragments", () => {
  const signature = getRendererFragmentTreePaintSignature({
    nodes: [{ type: "paragraph", children: [] }],
    registry: null,
    hasVisualSelf: () => false,
  });

  assert.equal(signature, 0);
});

test("fragment tree signature changes when visible fragment geometry changes", () => {
  const createNodes = (width) => [
    {
      type: "paragraph",
      role: "block",
      x: 10,
      y: 20,
      width,
      height: 30,
      children: [],
    },
  ];

  const before = getRendererFragmentTreePaintSignature({
    nodes: createNodes(100),
    registry: null,
    hasVisualSelf: () => true,
  });
  const after = getRendererFragmentTreePaintSignature({
    nodes: createNodes(120),
    registry: null,
    hasVisualSelf: () => true,
  });

  assert.notEqual(before, after);
});
