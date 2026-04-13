import test from "node:test";
import assert from "node:assert/strict";

import { renderLineCompatPrimaryPass } from "../dist/view/render/lineCompatPrimaryPass.js";

const createBaseRenderPlan = () => ({
  hasTextPayload: true,
  hasAuxiliaryPass: false,
  hasFragmentRenderer: false,
  hasFragmentOwner: false,
  hasLeafTextFragment: false,
  usesDefaultTextLineRenderer: true,
  shouldRunContainerPass: false,
  shouldRunListMarkerPass: false,
  shouldRunNodeViewPass: false,
  shouldRunRendererLinePass: false,
  shouldRunLeafTextPass: false,
  shouldRunDefaultTextPass: false,
  shouldSkipBodyPassAfterFragment: false,
  shouldRunCompatPass: true,
});

test("primary compat pass prefers nodeView rendering over renderer and default text", () => {
  const calls = [];
  const result = renderLineCompatPrimaryPass({
    ctx: {},
    line: { text: "hello" },
    layout: {},
    renderer: {
      compat: {
        renderLine: () => calls.push("renderer"),
      },
    },
    nodeView: {
      render: () => calls.push("nodeView"),
    },
    renderPlan: {
      ...createBaseRenderPlan(),
      shouldRunNodeViewPass: true,
      shouldRunRendererLinePass: true,
      shouldRunLeafTextPass: true,
    },
    defaultRender: () => calls.push("default"),
  });

  assert.equal(result, "node-view");
  assert.deepEqual(calls, ["nodeView"]);
});

test("primary compat pass skips remaining work after fragment-owned content", () => {
  const calls = [];
  const result = renderLineCompatPrimaryPass({
    ctx: {},
    line: { text: "hello" },
    layout: {},
    renderer: {
      compat: {
        renderLine: () => calls.push("renderer"),
      },
    },
    nodeView: null,
    renderPlan: {
      ...createBaseRenderPlan(),
      shouldSkipBodyPassAfterFragment: true,
      shouldRunRendererLinePass: true,
      shouldRunLeafTextPass: true,
    },
    defaultRender: () => calls.push("default"),
  });

  assert.equal(result, "fragment-skip");
  assert.deepEqual(calls, []);
});

test("primary compat pass falls back to default text when renderer line pass is inactive", () => {
  const calls = [];
  const result = renderLineCompatPrimaryPass({
    ctx: {},
    line: { text: "hello" },
    layout: {},
    renderer: {},
    nodeView: null,
    renderPlan: {
      ...createBaseRenderPlan(),
      shouldRunLeafTextPass: true,
    },
    defaultRender: () => calls.push("default"),
  });

  assert.equal(result, "leaf-text");
  assert.deepEqual(calls, ["default"]);
});
