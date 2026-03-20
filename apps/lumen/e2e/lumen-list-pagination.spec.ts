import { expect, test } from "@playwright/test";
import {
  attachConsoleGuards,
  getLayoutBoxSummariesByBlockId,
  getLayoutFragmentSummaries,
  getLayoutLineContinuationSummaries,
  getPaginationInfo,
  setDocumentJson,
  waitForLayoutIdle,
  waitForPageCount,
} from "./helpers";

const buildListDocument = (itemCount: number) => ({
  type: "doc",
  content: [
    {
      type: "bulletList",
      content: Array.from({ length: itemCount }, (_, index) => ({
        type: "listItem",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text:
                  `List continuation smoke item ${index + 1}. ` +
                  "This item is intentionally long to force list continuation across multiple pages. ".repeat(
                    5,
                  ),
              },
            ],
          },
        ],
      })),
    },
  ],
});

const buildListTablePaginationDocument = (rowCount = 36, colCount = 3) => ({
  type: "doc",
  content: [
    {
      type: "bulletList",
      attrs: { id: "list-root" },
      content: [
        {
          type: "listItem",
          attrs: { id: "list-item-with-table" },
          content: [
            {
              type: "paragraph",
              attrs: { id: "list-item-intro" },
              content: [{ type: "text", text: "list item intro before table" }],
            },
            {
              type: "table",
              attrs: { id: "list-item-table" },
              content: Array.from({ length: Math.max(1, rowCount) }, (_row, rowIndex) => ({
                type: "tableRow",
                content: Array.from({ length: Math.max(1, colCount) }, (_cell, colIndex) => ({
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        {
                          type: "text",
                          text: `list table row ${rowIndex + 1} col ${colIndex + 1}`,
                        },
                      ],
                    },
                  ],
                })),
              })),
            },
            {
              type: "paragraph",
              attrs: { id: "after-table-in-list-item" },
              content: [
                {
                  type: "text",
                  text: "paragraph after the nested table inside the same list item",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: "paragraph",
      attrs: { id: "after-list-paragraph" },
      content: [{ type: "text", text: "paragraph after the list block" }],
    },
  ],
});

test("lumen list continuation pagination smoke", async ({ page }) => {
  const guards = attachConsoleGuards(page);

  await page.goto("/", { waitUntil: "networkidle" });

  await setDocumentJson(page, buildListDocument(28));
  await waitForLayoutIdle(page);
  await waitForPageCount(page, 2);

  const paginationInfo = await getPaginationInfo(page);
  expect(paginationInfo).not.toBeNull();
  expect(paginationInfo?.pageCount ?? 0).toBeGreaterThanOrEqual(2);

  const lines = await getLayoutLineContinuationSummaries(page);
  const listLines = lines.filter(
    (line) =>
      line.carryStateKind === "list" ||
      (typeof line.fragmentIdentity === "string" && line.fragmentIdentity.startsWith("list:")),
  );

  expect(listLines.length).toBeGreaterThan(1);

  const pageIndexes = new Set(listLines.map((line) => line.pageIndex));
  expect(pageIndexes.size).toBeGreaterThan(1);

  const fragmentIdentities = new Set(
    listLines
      .map((line) => line.fragmentIdentity)
      .filter((value): value is string => typeof value === "string" && value.length > 0),
  );
  expect(fragmentIdentities.size).toBe(1);

  const continuationTokens = new Set(
    listLines
      .map((line) => line.continuationToken)
      .filter((value): value is string => typeof value === "string" && value.length > 0),
  );
  expect(continuationTokens.size).toBe(1);

  guards.assertClean();
});

test("list item nested table stays above following nodes after cross-page pagination", async ({
  page,
}) => {
  const guards = attachConsoleGuards(page);

  await page.goto("/", { waitUntil: "networkidle" });

  await setDocumentJson(page, buildListTablePaginationDocument());
  await waitForLayoutIdle(page);
  await waitForPageCount(page, 2);

  const paginationInfo = await getPaginationInfo(page);
  expect(paginationInfo).not.toBeNull();
  expect(paginationInfo?.pageCount ?? 0).toBeGreaterThanOrEqual(2);

  const tableFragments = (await getLayoutFragmentSummaries(page, "table")).filter(
    (fragment) => fragment.blockId === "list-item-table" || fragment.nodeId === "list-item-table",
  );
  expect(tableFragments.length).toBeGreaterThan(1);

  const tablePages = new Set(tableFragments.map((fragment) => fragment.pageIndex));
  expect(tablePages.size).toBeGreaterThan(1);

  const tableBoxes = (await getLayoutBoxSummariesByBlockId(page, "list-item-table")).filter(
    (box) => box.role === "table",
  );
  expect(tableBoxes.length).toBeGreaterThan(1);

  const afterTableBoxes = await getLayoutBoxSummariesByBlockId(page, "after-table-in-list-item");
  expect(afterTableBoxes.length).toBeGreaterThan(0);

  const afterListBoxes = await getLayoutBoxSummariesByBlockId(page, "after-list-paragraph");
  expect(afterListBoxes.length).toBeGreaterThan(0);

  const assertNoOverlapWithFollowingBlock = (
    followingBoxes: Array<{ pageIndex: number; y: number; height: number }>,
  ) => {
    const pageIndexes = new Set([
      ...tableBoxes.map((box) => box.pageIndex),
      ...followingBoxes.map((box) => box.pageIndex),
    ]);

    for (const pageIndex of pageIndexes) {
      const pageTableBoxes = tableBoxes.filter((box) => box.pageIndex === pageIndex);
      const pageFollowingBoxes = followingBoxes.filter((box) => box.pageIndex === pageIndex);
      if (pageTableBoxes.length === 0 || pageFollowingBoxes.length === 0) {
        continue;
      }

      const tableBottom = Math.max(...pageTableBoxes.map((box) => box.y + box.height));
      const followingTop = Math.min(...pageFollowingBoxes.map((box) => box.y));
      expect(
        followingTop,
        `page ${pageIndex + 1} following block should start below nested table fragment`,
      ).toBeGreaterThanOrEqual(tableBottom - 0.5);
    }
  };

  assertNoOverlapWithFollowingBlock(afterTableBoxes);
  assertNoOverlapWithFollowingBlock(afterListBoxes);

  guards.assertClean();
});
