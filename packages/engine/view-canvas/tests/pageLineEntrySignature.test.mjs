import test from "node:test";
import assert from "node:assert/strict";

import { getRendererLinePaintEntriesSignature } from "../dist/view/render/pageLineEntrySignature.js";

test("line entry signature ignores entries skipped after fragment rendering", () => {
  const skippedEntry = {
    line: {
      text: "hello",
      x: 10,
      y: 20,
    },
    renderPlan: {
      shouldSkipBodyPassAfterFragment: true,
      shouldRunContainerPass: false,
      shouldRunListMarkerPass: false,
      hasTextPayload: true,
    },
  };

  assert.equal(getRendererLinePaintEntriesSignature([skippedEntry]), 0);
});

test("line entry signature changes when visible line paint payload changes", () => {
  const createEntry = (text) => ({
    line: {
      x: 10,
      y: 20,
      width: 100,
      lineHeight: 24,
      blockSignature: 1,
      blockType: "paragraph",
      blockId: "block-1",
      text,
      runs: [{ text, font: "16px serif", color: "#111", width: 60 }],
    },
    renderPlan: {
      shouldSkipBodyPassAfterFragment: false,
      shouldRunContainerPass: false,
      shouldRunListMarkerPass: false,
      hasTextPayload: true,
    },
  });

  const before = getRendererLinePaintEntriesSignature([createEntry("hello")]);
  const after = getRendererLinePaintEntriesSignature([createEntry("world")]);

  assert.notEqual(before, after);
});
