import test from "node:test";
import assert from "node:assert/strict";

import { renderLineCompatListMarkerPass } from "../dist/view/render/lineCompatListMarkerPass.js";

const createRenderPlan = (shouldRunListMarkerPass) => ({
  hasTextPayload: false,
  hasAuxiliaryPass: false,
  hasFragmentRenderer: false,
  hasFragmentOwner: false,
  hasLeafTextFragment: false,
  usesDefaultTextLineRenderer: true,
  shouldRunContainerPass: false,
  shouldRunListMarkerPass,
  shouldRunNodeViewPass: false,
  shouldRunRendererLinePass: false,
  shouldRunLeafTextPass: false,
  shouldRunDefaultTextPass: false,
  shouldSkipBodyPassAfterFragment: false,
  shouldRunCompatPass: shouldRunListMarkerPass,
});

test("list-marker compat pass stays idle when the render plan disables marker work", () => {
  const calls = [];
  const handled = renderLineCompatListMarkerPass({
    ctx: {},
    line: {},
    layout: {},
    renderPlan: createRenderPlan(false),
    renderListMarkerImpl: () => calls.push("marker"),
  });

  assert.equal(handled, false);
  assert.deepEqual(calls, []);
});

test("list-marker compat pass delegates to the marker renderer when enabled", () => {
  const calls = [];
  const handled = renderLineCompatListMarkerPass({
    ctx: {},
    line: { listMarker: { text: "1." } },
    layout: {},
    pageX: 8,
    pageTop: 16,
    renderPlan: createRenderPlan(true),
    renderListMarkerImpl: (args) =>
      calls.push({
        pageX: args.pageX,
        pageTop: args.pageTop,
        markerText: args.line.listMarker.text,
      }),
  });

  assert.equal(handled, true);
  assert.deepEqual(calls, [
    {
      pageX: 8,
      pageTop: 16,
      markerText: "1.",
    },
  ]);
});
