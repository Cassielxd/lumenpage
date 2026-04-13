import test from "node:test";
import assert from "node:assert/strict";

import { getRendererCompatPassSignature } from "../dist/view/render/pageCompatSignature.js";

test("compat pass signature returns zero when there is no compat work", () => {
  assert.equal(
    getRendererCompatPassSignature({
      compatPass: {
        lineEntries: [],
      },
    }),
    0
  );
});

test("compat pass signature changes when compat-visible line paint changes", () => {
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

  const before = getRendererCompatPassSignature({
    compatPass: {
      lineEntries: [createEntry("hello")],
    },
  });
  const after = getRendererCompatPassSignature({
    compatPass: {
      lineEntries: [createEntry("world")],
    },
  });

  assert.notEqual(before, after);
});
