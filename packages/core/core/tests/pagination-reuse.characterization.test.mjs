import test from "node:test";
import assert from "node:assert/strict";

import { resolveFinalizePageReuseDecision } from "../../../engine/layout-engine/src/engine/pageContinuation.ts";
import { resolveDisablePageReuse } from "../../../engine/layout-engine/src/engine/reuseDecision.ts";

const createPage = (lines) => ({
  lines,
  boxes: [],
  fragments: [],
  rootIndexMin: 0,
  rootIndexMax: 0,
});

const createPlainLine = (overrides = {}) => ({
  start: 0,
  end: 12,
  blockStart: 0,
  blockType: "paragraph",
  blockId: "block-1",
  rootIndex: 0,
  blockSignature: 1,
  text: "plain text",
  ...overrides,
});

const createListContinuationLine = (overrides = {}) => ({
  start: 0,
  end: 12,
  blockStart: 0,
  blockType: "listItem",
  blockId: "list-item-1",
  rootIndex: 0,
  blockSignature: 1,
  text: "list item",
  blockAttrs: {
    listOwnerType: "bullet",
    listOwnerBlockId: "list-1",
    listOwnerItemIndex: 0,
    ...overrides.blockAttrs,
  },
  ...overrides,
});

test("same-index boundary reuse stays enabled for non-fragment pages", () => {
  const previousPage = createPage([createPlainLine()]);
  const decision = resolveFinalizePageReuseDecision({
    cascadePagination: true,
    cascadeFromPageIndex: 0,
    pageIndex: 0,
    page: createPage([createPlainLine()]),
    previousLayout: {
      pages: [previousPage, createPage([createPlainLine({ blockId: "tail", blockStart: 12, start: 12, end: 24 })])],
    },
    offsetDelta: 0,
    preferredBoundaryAnchor: null,
  });

  assert.equal(decision?.reason, "same-index-boundary-reuse");
  assert.equal(decision?.syncFromIndex, 0);
});

test("same-index boundary reuse is disabled for continuation-anchor pages", () => {
  const previousPage = createPage([createListContinuationLine()]);
  const decision = resolveFinalizePageReuseDecision({
    cascadePagination: true,
    cascadeFromPageIndex: 0,
    pageIndex: 0,
    page: createPage([createListContinuationLine()]),
    previousLayout: {
      pages: [
        previousPage,
        createPage([
          createListContinuationLine({
            blockId: "list-item-2",
            blockStart: 12,
            start: 12,
            end: 24,
            rootIndex: 1,
          }),
        ]),
      ],
    },
    offsetDelta: 0,
    preferredBoundaryAnchor: null,
  });

  assert.equal(decision, null);
});

test("slice-state pages remain reuse-sensitive even when registry overrides are present", () => {
  const disablePageReuse = resolveDisablePageReuse({
    doc: {
      childCount: 1,
      child: () => ({ type: { name: "bulletList" } }),
    },
    baseSettingsRaw: {},
    previousLayout: {
      pages: [
        createPage([
          createPlainLine({
            rootIndex: 0,
            blockAttrs: {
              sliceFromPrev: true,
              listOwnerType: "bullet",
            },
          }),
        ]),
      ],
    },
    changeSummary: {
      docChanged: true,
      blocks: {
        before: {
          fromIndex: 0,
          toIndex: 0,
        },
        after: {
          fromIndex: 0,
          toIndex: 0,
        },
      },
    },
    registry: {
      get: (typeName) =>
        typeName === "paragraph"
          ? {
              pagination: {
                reusePolicy: "none",
              },
            }
          : null,
    },
  });

  assert.equal(disablePageReuse, true);
});
