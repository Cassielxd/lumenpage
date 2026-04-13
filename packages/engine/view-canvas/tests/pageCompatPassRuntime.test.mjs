import test from "node:test";
import assert from "node:assert/strict";

import { collectRunnablePageCompatEntries } from "../dist/view/render/pageCompatPassRuntime.js";

test("compat pass runtime drops entries with no remaining compat work", () => {
  const runtimeEntries = collectRunnablePageCompatEntries({
    compatPass: {
      lineEntries: [
        {
          line: {
            text: "",
            runs: [],
          },
          nodeView: null,
          renderer: {},
          fragmentOwnsLeafText: false,
          textLineKey: null,
          renderPlan: {
            hasTextPayload: false,
            hasAuxiliaryPass: false,
            hasFragmentRenderer: true,
            hasFragmentOwner: true,
            hasLeafTextFragment: false,
            usesDefaultTextLineRenderer: true,
            shouldRunContainerPass: false,
            shouldRunListMarkerPass: false,
            shouldRunNodeViewPass: false,
            shouldRunRendererLinePass: false,
            shouldRunLeafTextPass: false,
            shouldRunDefaultTextPass: false,
            shouldSkipBodyPassAfterFragment: true,
            shouldRunCompatPass: false,
          },
        },
      ],
    },
    renderedLeafTextKeys: new Set(),
  });

  assert.deepEqual(runtimeEntries, []);
});

test("compat pass runtime suppresses default leaf-text pass after fragment-owned text is painted", () => {
  const compatPass = {
    lineEntries: [
      {
        line: {
          text: "hello",
          runs: [{ text: "hello" }],
        },
        nodeView: null,
        renderer: {},
        fragmentOwnsLeafText: true,
        textLineKey: "line-1",
        renderPlan: {
          hasTextPayload: true,
          hasAuxiliaryPass: false,
          hasFragmentRenderer: true,
          hasFragmentOwner: true,
          hasLeafTextFragment: false,
          usesDefaultTextLineRenderer: true,
          shouldRunContainerPass: false,
          shouldRunListMarkerPass: false,
          shouldRunNodeViewPass: false,
          shouldRunRendererLinePass: false,
          shouldRunLeafTextPass: true,
          shouldRunDefaultTextPass: true,
          shouldSkipBodyPassAfterFragment: false,
          shouldRunCompatPass: true,
        },
      },
    ],
  };

  const beforeFragmentPaint = collectRunnablePageCompatEntries({
    compatPass,
    renderedLeafTextKeys: new Set(),
  });
  const afterFragmentPaint = collectRunnablePageCompatEntries({
    compatPass,
    renderedLeafTextKeys: new Set(["line-1"]),
  });

  assert.equal(beforeFragmentPaint.length, 1);
  assert.equal(beforeFragmentPaint[0].renderPlan.shouldRunLeafTextPass, true);
  assert.equal(afterFragmentPaint.length, 0);
});
