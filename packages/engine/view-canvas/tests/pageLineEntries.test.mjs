import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPageCompatLineEntries,
  isLeafTextExpectedFromFragment,
} from "../dist/view/render/pageLineEntries.js";
import { resolveLineRenderPlan } from "../dist/view/render/lineRenderPlan.js";
import { tableRenderer } from "../../render-engine/dist/defaultRenderers/index.js";
import { mathRenderer } from "../../../extensions/extension-math/dist/renderer.js";
import { optionBoxRenderer } from "../../../extensions/extension-option-box/dist/renderer.js";

test("fragment-owned default-text lines without compat renderLine stay out of compat entries", () => {
  const line = {
    blockType: "codeBlock",
    blockId: "code-1",
    text: "const value = 1;",
    runs: [{ text: "const value = 1;" }],
    fragmentOwners: [{ key: "block:codeBlock:1", type: "codeBlock", role: "block" }],
    __textLineFragmentKey: "text-line:code-1:0",
  };
  const renderer = {
    render: {
      renderFragment() {},
    },
    compat: {
      lineBodyMode: "default-text",
    },
  };
  const entry = {
    line,
    nodeView: null,
    renderer,
    renderPlan: resolveLineRenderPlan(line, renderer),
    textLineKey: "text-line:code-1:0",
    hasContainerCompatWork: false,
  };

  assert.equal(isLeafTextExpectedFromFragment(entry), true);
  assert.deepEqual(buildPageCompatLineEntries([entry]), []);
});

test("fragment-owned table text lines stay out of compat entries", () => {
  const line = {
    blockType: "table",
    blockId: "table-1",
    text: "cell text",
    runs: [{ text: "cell text" }],
    fragmentOwners: [
      { key: "table:table-1", type: "table", role: "table" },
      { key: "table:table-1/row:0", type: "tableRow", role: "table-row" },
      { key: "table:table-1/row:0/cell:0", type: "tableCell", role: "table-cell" },
    ],
    __textLineFragmentKey: "text-line:table-1:0",
    tableOwnerMeta: {
      tableKey: "table-1",
      tableWidth: 320,
      tableHeight: 48,
      tableTop: 0,
    },
  };
  const entry = {
    line,
    nodeView: null,
    renderer: tableRenderer,
    renderPlan: resolveLineRenderPlan(line, tableRenderer),
    textLineKey: "text-line:table-1:0",
    containerCompatEntries: [],
  };

  assert.equal(isLeafTextExpectedFromFragment(entry), true);
  assert.deepEqual(buildPageCompatLineEntries([entry]), []);
});

test("fragment-owned visual blocks without compat renderLine stay out of compat entries", () => {
  const line = {
    blockType: "optionBox",
    blockId: "option-1",
    text: "",
    runs: [],
    fragmentOwners: [{ key: "block:optionBox:1", type: "optionBox", role: "block" }],
    optionBoxMeta: {
      title: "Options",
      items: ["One", "Two"],
      width: 320,
      height: 120,
    },
    blockAttrs: {
      lineHeight: 120,
      width: 320,
      height: 120,
      fragmentOwnerMeta: {
        optionBoxMeta: {
          title: "Options",
          items: ["One", "Two"],
        },
      },
      layoutCapabilities: {
        "visual-block": true,
      },
      visualBounds: {
        x: 48,
        width: 320,
      },
    },
  };
  const entry = {
    line,
    nodeView: null,
    renderer: optionBoxRenderer,
    renderPlan: resolveLineRenderPlan(line, optionBoxRenderer),
    textLineKey: null,
    containerCompatEntries: [],
  };

  assert.deepEqual(buildPageCompatLineEntries([entry]), []);
});

test("fragment-owned math text lines stay out of compat entries", () => {
  const line = {
    blockType: "math",
    blockId: "math-1",
    text: "x + y = z",
    runs: [{ text: "x + y = z" }],
    fragmentOwners: [{ key: "block:math:1", type: "math", role: "block" }],
    __textLineFragmentKey: "text-line:math-1:0",
    blockAttrs: {
      source: "x + y = z",
      mathPadding: 16,
      width: 280,
      fragmentOwnerMeta: {
        mathMeta: {
          source: "x + y = z",
          padding: 16,
          width: 280,
          label: "SUM",
        },
      },
      layoutCapabilities: {
        "visual-block": true,
      },
      visualBounds: {
        x: 48,
        width: 280,
      },
    },
  };
  const entry = {
    line,
    nodeView: null,
    renderer: mathRenderer,
    renderPlan: resolveLineRenderPlan(line, mathRenderer),
    textLineKey: "text-line:math-1:0",
    containerCompatEntries: [],
  };

  assert.equal(isLeafTextExpectedFromFragment(entry), true);
  assert.deepEqual(buildPageCompatLineEntries([entry]), []);
});
