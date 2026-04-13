import test from "node:test";
import assert from "node:assert/strict";

import { renderLineCompatAuxiliaryPasses } from "../dist/view/render/lineCompatAuxiliaryPass.js";

test("auxiliary compat pass uses precomputed container entries without recollecting from registry", () => {
  const calls = [];

  renderLineCompatAuxiliaryPasses({
    ctx: {},
    line: {
      containers: [{ type: "panel" }],
    },
    layout: {},
    registry: {
      get() {
        throw new Error("registry should not be consulted when container entries are precomputed");
      },
    },
    renderPlan: {
      shouldRunContainerPass: true,
      shouldRunListMarkerPass: false,
    },
    containerEntries: [
      {
        container: { type: "panel" },
        renderContainer(args) {
          calls.push({
            type: args.container.type,
            hasDefaultRender: typeof args.defaultRender === "function",
          });
        },
      },
    ],
    defaultRender() {},
  });

  assert.deepEqual(calls, [
    {
      type: "panel",
      hasDefaultRender: true,
    },
  ]);
});
