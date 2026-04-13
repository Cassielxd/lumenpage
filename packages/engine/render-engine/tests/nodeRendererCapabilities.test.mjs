import test from "node:test";
import assert from "node:assert/strict";

import {
  mergeNodeRenderers,
  resolveNodeRendererCompatCapabilities,
  resolveNodeRendererLayoutCapabilities,
  resolveNodeRendererRenderCapabilities,
  resolveNodeRendererViewCapabilities,
} from "../dist/node.js";
import {
  codeBlockRenderer,
  horizontalRuleRenderer,
  imageRenderer,
  tableRenderer,
  videoRenderer,
} from "../dist/defaultRenderers/index.js";
import { audioRenderer } from "../../../extensions/extension-audio/dist/renderer.js";
import { bookmarkRenderer } from "../../../extensions/extension-bookmark/dist/renderer.js";
import { calloutRenderer } from "../../../extensions/extension-callout/dist/renderer.js";
import { columnsRenderer } from "../../../extensions/extension-columns/dist/renderer.js";
import { embedPanelRenderer } from "../../../extensions/extension-embed-panel/dist/renderer.js";
import { fileRenderer } from "../../../extensions/extension-file/dist/renderer.js";
import { mathRenderer } from "../../../extensions/extension-math/dist/renderer.js";
import { optionBoxRenderer } from "../../../extensions/extension-option-box/dist/renderer.js";
import { sealRenderer } from "../../../extensions/extension-seal/dist/renderer.js";
import { signatureRenderer } from "../../../extensions/extension-signature/dist/renderer.js";
import { templateRenderer } from "../../../extensions/extension-template/dist/renderer.js";
import { textBoxRenderer } from "../../../extensions/extension-text-box/dist/renderer.js";
import { webPageRenderer } from "../../../extensions/extension-web-page/dist/renderer.js";

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

test("visual block renderers rely on fragment rendering instead of compat line rendering", () => {
  for (const renderer of [horizontalRuleRenderer, imageRenderer, videoRenderer]) {
    const render = resolveNodeRendererRenderCapabilities(renderer);
    const compat = resolveNodeRendererCompatCapabilities(renderer);

    assert.equal(typeof render.renderFragment, "function");
    assert.equal(compat.renderLine, undefined);
  }
});

test("code block renderer relies on fragment chrome and fragment-owned leaf text", () => {
  const render = resolveNodeRendererRenderCapabilities(codeBlockRenderer);
  const compat = resolveNodeRendererCompatCapabilities(codeBlockRenderer);

  assert.equal(typeof render.renderFragment, "function");
  assert.equal(compat.lineBodyMode, "default-text");
  assert.equal(compat.renderLine, undefined);
});

test("table renderer relies on fragment chrome and fragment-owned leaf text", () => {
  const render = resolveNodeRendererRenderCapabilities(tableRenderer);
  const compat = resolveNodeRendererCompatCapabilities(tableRenderer);

  assert.equal(typeof render.renderFragment, "function");
  assert.equal(compat.lineBodyMode, "default-text");
  assert.equal(compat.renderLine, undefined);
});

test("math renderer relies on fragment chrome and fragment-owned leaf text", () => {
  const render = resolveNodeRendererRenderCapabilities(mathRenderer);
  const compat = resolveNodeRendererCompatCapabilities(mathRenderer);

  assert.equal(typeof render.renderFragment, "function");
  assert.equal(compat.lineBodyMode, "default-text");
  assert.equal(compat.renderLine, undefined);
});

test("simple extension visual blocks rely on fragment rendering instead of compat line rendering", () => {
  for (const renderer of [
    audioRenderer,
    bookmarkRenderer,
    calloutRenderer,
    columnsRenderer,
    embedPanelRenderer,
    fileRenderer,
    optionBoxRenderer,
    sealRenderer,
    signatureRenderer,
    templateRenderer,
    textBoxRenderer,
    webPageRenderer,
  ]) {
    const render = resolveNodeRendererRenderCapabilities(renderer);
    const compat = resolveNodeRendererCompatCapabilities(renderer);

    assert.equal(typeof render.renderFragment, "function");
    assert.equal(compat.renderLine, undefined);
  }
});
