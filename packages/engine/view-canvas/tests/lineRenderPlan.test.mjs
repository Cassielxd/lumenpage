import test from "node:test";
import assert from "node:assert/strict";

import { resolveLineRenderPlan } from "../dist/view/render/lineRenderPlan.js";

test("line render plan skips body pass when fragment-owned lines only carry fragment-rendered markers", () => {
  const plan = resolveLineRenderPlan(
    {
      fragmentOwners: [{ key: "frag-1" }],
      listMarker: { text: "1." },
      text: "",
      runs: [],
    },
    {
      render: {
        renderFragment() {},
      },
      compat: {
        listMarkerRenderMode: "fragment",
      },
    }
  );

  assert.equal(plan.shouldRunListMarkerPass, false);
  assert.equal(plan.hasAuxiliaryPass, false);
  assert.equal(plan.shouldSkipBodyPassAfterFragment, true);
  assert.equal(plan.shouldRunCompatPass, false);
});

test("line render plan skips body pass when containers exist but none require compat rendering", () => {
  const plan = resolveLineRenderPlan(
    {
      fragmentOwners: [{ key: "frag-1" }],
      containers: [{ type: "panel" }],
      text: "",
      runs: [],
    },
    {
      render: {
        renderFragment() {},
      },
    },
    {
      hasContainerCompatWork: false,
    }
  );

  assert.equal(plan.shouldRunContainerPass, false);
  assert.equal(plan.hasAuxiliaryPass, false);
  assert.equal(plan.shouldSkipBodyPassAfterFragment, true);
  assert.equal(plan.shouldRunCompatPass, false);
});

test("line render plan keeps compat path when container compat work is present", () => {
  const plan = resolveLineRenderPlan(
    {
      fragmentOwners: [{ key: "frag-1" }],
      containers: [{ type: "panel" }],
      text: "",
      runs: [],
    },
    {
      render: {
        renderFragment() {},
      },
    },
    {
      hasContainerCompatWork: true,
    }
  );

  assert.equal(plan.shouldRunContainerPass, true);
  assert.equal(plan.hasAuxiliaryPass, true);
  assert.equal(plan.shouldSkipBodyPassAfterFragment, false);
  assert.equal(plan.shouldRunCompatPass, true);
});
