import test from "node:test";
import assert from "node:assert/strict";

import {
  collectLineCompatContainerPassEntries,
  renderLineCompatContainerPasses,
} from "../dist/view/render/lineCompatContainerPass.js";

test("container compat pass collects only non-fragment container renderers", () => {
  const entries = collectLineCompatContainerPassEntries({
    line: {
      containers: [{ type: "quote" }, { type: "panel" }, { type: "plain" }],
    },
    registry: {
      get(type) {
        if (type === "quote") {
          return {
            compat: {
              containerRenderMode: "fragment",
              renderContainer: () => {},
            },
          };
        }
        if (type === "panel") {
          return {
            compat: {
              renderContainer: () => {},
            },
          };
        }
        return {};
      },
    },
  });

  assert.equal(entries.length, 1);
  assert.equal(entries[0].container.type, "panel");
});

test("container compat pass forwards render context to collected renderers", () => {
  const calls = [];
  const defaultRender = () => calls.push("default");
  const entries = collectLineCompatContainerPassEntries({
    line: {
      containers: [{ type: "panel" }],
    },
    registry: {
      get() {
        return {
          compat: {
            renderContainer: (args) =>
              calls.push({
                type: args.container.type,
                pageX: args.pageX,
                pageTop: args.pageTop,
                hasDefaultRender: typeof args.defaultRender === "function",
              }),
          },
        };
      },
    },
  });

  renderLineCompatContainerPasses({
    ctx: {},
    line: { text: "hello" },
    layout: {},
    defaultRender,
    entries,
    pageX: 12,
    pageTop: 34,
  });

  assert.deepEqual(calls, [
    {
      type: "panel",
      pageX: 12,
      pageTop: 34,
      hasDefaultRender: true,
    },
  ]);
});
