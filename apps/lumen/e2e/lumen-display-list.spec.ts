import { expect, test } from "@playwright/test";
import {
  attachConsoleGuards,
  forceEditorRender,
  getParagraphDocPos,
  getRendererDisplayListSnapshot,
  scrollDocPosIntoView,
  setParagraphDocument,
  waitForLayoutIdle,
  waitForPageCount,
} from "./helpers";

test("lumen display list cache smoke", async ({ page }) => {
  const guards = attachConsoleGuards(page);

  await page.goto("/", { waitUntil: "networkidle" });

  const paragraphs = Array.from({ length: 72 }, (_, index) =>
    `Display list smoke paragraph ${index + 1}. ` +
    "This paragraph is intentionally long so the renderer has to maintain cached page paint plans. ".repeat(
      5,
    ),
  );

  await setParagraphDocument(page, paragraphs);
  await waitForLayoutIdle(page);
  await waitForPageCount(page, 3);

  const initialSnapshot = await getRendererDisplayListSnapshot(page);
  expect(initialSnapshot.length).toBeGreaterThan(0);
  expect(initialSnapshot.some((entry) => entry.displayListItemCount > 0)).toBeTruthy();
  expect(initialSnapshot.some((entry) => entry.displayListSignature != null)).toBeTruthy();

  await forceEditorRender(page);

  const rerenderSnapshot = await getRendererDisplayListSnapshot(page);
  const rerenderByPage = new Map(rerenderSnapshot.map((entry) => [entry.pageIndex, entry]));
  const stablePages = initialSnapshot.filter((entry) => {
    const next = rerenderByPage.get(entry.pageIndex);
    return (
      next &&
      next.displayListSignature != null &&
      next.displayListSignature === entry.displayListSignature &&
      next.displayListItemCount === entry.displayListItemCount
    );
  });
  expect(stablePages.length).toBeGreaterThan(0);

  const farPos = await getParagraphDocPos(page, 58, 20);
  expect(farPos).not.toBeNull();
  await scrollDocPosIntoView(page, farPos!);
  await waitForLayoutIdle(page);

  const returnPos = await getParagraphDocPos(page, 0, 8);
  expect(returnPos).not.toBeNull();
  await scrollDocPosIntoView(page, returnPos!);
  await waitForLayoutIdle(page);

  const scrolledSnapshot = await getRendererDisplayListSnapshot(page);
  expect(scrolledSnapshot.some((entry) => entry.displayListItemCount > 0)).toBeTruthy();
  expect(scrolledSnapshot.some((entry) => entry.displayListSignature != null)).toBeTruthy();

  guards.assertClean();
});
