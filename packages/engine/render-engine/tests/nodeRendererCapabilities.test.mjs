import test from "node:test";
import assert from "node:assert/strict";

import {
  mergeNodeRenderers,
  resolveNodeRendererCompatCapabilities,
  resolveNodeRendererLayoutCapabilities,
  resolveNodeRendererRenderCapabilities,
  resolveNodeRendererViewCapabilities,
} from "../dist/node.js";

test("resolves nested renderer capabilities", () => {
  const measureBlock = () => ({ kind: "measure" });
  const paginateBlock = () => ({ slice: { kind: "slice" } });
  const renderLine = () => {};
  const renderFragment = () => {};
  const createNodeView = () => ({});
  const renderer = {
    layout: {
      measureBlock,
      paginateBlock,
      pagination: {
        fragmentModel: "continuation",
      },
    },
    render: {
      renderFragment,
      compat: {
        renderLine,
        lineBodyMode: "default-text",
        listMarkerRenderMode: "fragment",
      },
    },
    view: {
      createNodeView,
    },
  };

  const layout = resolveNodeRendererLayoutCapabilities(renderer);
  const render = resolveNodeRendererRenderCapabilities(renderer);
  const compat = resolveNodeRendererCompatCapabilities(renderer);
  const view = resolveNodeRendererViewCapabilities(renderer);

  assert.equal(layout.measureBlock, measureBlock);
  assert.equal(layout.paginateBlock, paginateBlock);
  assert.equal(layout.pagination?.fragmentModel, "continuation");
  assert.equal(render.renderFragment, renderFragment);
  assert.equal(render.renderLine, undefined);
  assert.equal(compat.renderLine, renderLine);
  assert.equal(compat.lineBodyMode, "default-text");
  assert.equal(compat.listMarkerRenderMode, "fragment");
  assert.equal(view.createNodeView, createNodeView);
});

test("mergeNodeRenderers keeps legacy and nested capabilities compatible", () => {
  const baseToRuns = () => ({ runs: [], length: 0 });
  const baseRenderFragment = () => {};
  const overridePaginateBlock = () => ({ slice: { kind: "slice" } });
  const overrideRenderLine = () => {};
  const overrideRenderContainer = () => {};
  const overrideCreateNodeView = () => ({ updated: true });

  const merged = mergeNodeRenderers(
    {
      toRuns: baseToRuns,
      render: {
        renderFragment: baseRenderFragment,
      },
      view: {
        createNodeView: () => ({ base: true }),
      },
    },
    {
      layout: {
        paginateBlock: overridePaginateBlock,
        allowSplit: false,
      },
      renderLine: overrideRenderLine,
      compat: {
        containerRenderMode: "fragment",
        renderContainer: overrideRenderContainer,
      },
      render: {
        compat: {
          lineBodyMode: "default-text",
        },
      },
      view: {
        createNodeView: overrideCreateNodeView,
      },
    }
  );

  const layout = resolveNodeRendererLayoutCapabilities(merged);
  const render = resolveNodeRendererRenderCapabilities(merged);
  const compat = resolveNodeRendererCompatCapabilities(merged);
  const view = resolveNodeRendererViewCapabilities(merged);

  assert.equal(layout.toRuns, baseToRuns);
  assert.equal(layout.paginateBlock, overridePaginateBlock);
  assert.equal(layout.allowSplit, false);
  assert.equal(render.renderFragment, baseRenderFragment);
  assert.equal(render.renderLine, undefined);
  assert.equal(compat.renderLine, overrideRenderLine);
  assert.equal(compat.lineBodyMode, "default-text");
  assert.equal(compat.containerRenderMode, "fragment");
  assert.equal(compat.renderContainer, overrideRenderContainer);
  assert.equal(view.createNodeView, overrideCreateNodeView);

  assert.equal(merged.toRuns, baseToRuns);
  assert.equal(merged.paginateBlock, overridePaginateBlock);
  assert.equal(merged.renderLine, overrideRenderLine);
  assert.equal(merged.compat?.renderContainer, overrideRenderContainer);
  assert.equal(merged.render?.compat?.lineBodyMode, "default-text");
  assert.equal(merged.createNodeView, overrideCreateNodeView);
});
