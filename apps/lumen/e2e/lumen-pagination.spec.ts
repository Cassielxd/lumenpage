import { expect, test, type Page } from "@playwright/test";
import {
  attachConsoleGuards,
  getDocumentSnapshot,
  getCoordsAtDocPos,
  getPaginationInfo,
  getParagraphDocPos,
  getPosAtViewportCoords,
  getRendererCacheStats,
  scrollDocPosIntoView,
  setParagraphDocument,
  waitForLayoutIdle,
  waitForPageCount,
} from "./helpers";

test("lumen pagination and cross-page scroll smoke", async ({ page }) => {
  const guards = attachConsoleGuards(page);

  await page.goto("/", { waitUntil: "networkidle" });

  const paragraphs = Array.from({ length: 90 }, (_, index) =>
    `Pagination smoke paragraph ${index + 1}. ` +
    "This paragraph is intentionally long to force multi-page pagination and canvas redraw. ".repeat(
      6,
    ),
  );

  await setParagraphDocument(page, paragraphs);
  await waitForLayoutIdle(page);
  await waitForPageCount(page, 4);

  const initialInfo = await getPaginationInfo(page);
  expect(initialInfo).not.toBeNull();
  expect(initialInfo?.pageCount ?? 0).toBeGreaterThanOrEqual(4);

  const targetPos = await getParagraphDocPos(page, 70, 24);
  expect(targetPos).not.toBeNull();

  await scrollDocPosIntoView(page, targetPos!);

  await expect
    .poll(async () => (await getPaginationInfo(page))?.visibleRange.startIndex ?? 0)
    .toBeGreaterThan(0);

  const targetCoords = await getCoordsAtDocPos(page, targetPos!);
  expect(targetCoords).not.toBeNull();

  const roundTripPos = await getPosAtViewportCoords(page, targetCoords!.x, targetCoords!.y);
  expect(roundTripPos).not.toBeNull();
  expect(Math.abs((roundTripPos ?? 0) - targetPos!)).toBeLessThanOrEqual(2);

  const cacheStats = await getRendererCacheStats(page);
  expect(cacheStats.canvasCount).toBeGreaterThan(0);
  expect(cacheStats.entryCount).toBeGreaterThan(0);

  guards.assertClean();
});

const buildSingleLineParagraphs = (count: number) =>
  Array.from({ length: count }, (_, index) => `Single-line pagination seed ${index + 1}.`);

const placeCaretAtDocumentEnd = async (page: Page) => {
  const ok = await page.evaluate(() => {
    const debugWindow = window as Window & {
      __lumenView?: {
        state?: {
          doc?: { content?: { size?: number } };
        };
      } | null;
      __lumenTestApi?: {
        setSelection?: (from: number, to: number) => boolean;
      } | null;
    };
    const docSize = Number(debugWindow.__lumenView?.state?.doc?.content?.size ?? 0);
    return debugWindow.__lumenTestApi?.setSelection?.(docSize, docSize) === true;
  });
  expect(ok).toBeTruthy();
};

const countEnterStepsUntilSecondPage = async (
  page: Page,
  mode: "discrete" | "repeat",
) => {
  for (let step = 1; step <= 96; step += 1) {
    if (mode === "repeat") {
      await page.keyboard.down("Enter");
    } else {
      await page.keyboard.press("Enter");
    }
    await page.waitForTimeout(35);
    const paginationInfo = await getPaginationInfo(page);
    if (Number(paginationInfo?.pageCount ?? 0) >= 2) {
      if (mode === "repeat") {
        await page.keyboard.up("Enter");
      }
      return step;
    }
  }
  if (mode === "repeat") {
    await page.keyboard.up("Enter");
  }
  return null;
};

const countParagraphNodes = async (page: Page) =>
  Number((await getDocumentSnapshot(page)).typeCounts?.paragraph ?? 0);

test("holding enter does not lag page creation behind discrete enter pagination", async ({ page }) => {
  const guards = attachConsoleGuards(page);

  const paragraphs = Array.from(
    { length: 6 },
    (_, index) =>
      `Seed pagination paragraph ${index + 1}. ` +
      "This paragraph is long enough to keep the document close to the first page boundary. ".repeat(
        3,
      ),
  );

  await page.goto("/?pageHeight=640", { waitUntil: "networkidle" });
  await setParagraphDocument(page, paragraphs);
  await waitForLayoutIdle(page);
  await placeCaretAtDocumentEnd(page);
  await page.locator(".lumenpage-input").focus();

  const discreteSteps = await countEnterStepsUntilSecondPage(page, "discrete");
  expect(discreteSteps).not.toBeNull();

  await setParagraphDocument(page, paragraphs);
  await waitForLayoutIdle(page);
  await placeCaretAtDocumentEnd(page);
  await page.locator(".lumenpage-input").focus();

  const repeatSteps = await countEnterStepsUntilSecondPage(page, "repeat");
  expect(repeatSteps).not.toBeNull();
  expect(Number(repeatSteps)).toBeLessThanOrEqual(Number(discreteSteps) + 1);

  guards.assertClean();
});

test("single-page tail overflow creates the second page without hidden enter backlog", async ({
  page,
}) => {
  const guards = attachConsoleGuards(page);
  const paragraphs = buildSingleLineParagraphs(14);

  await page.goto("/?pageHeight=640&paginationIncrementalOff=1", { waitUntil: "networkidle" });
  await setParagraphDocument(page, paragraphs);
  await waitForLayoutIdle(page);
  await placeCaretAtDocumentEnd(page);
  await page.locator(".lumenpage-input").focus();

  const baselineSteps = await countEnterStepsUntilSecondPage(page, "discrete");
  expect(baselineSteps).not.toBeNull();
  const baselineParagraphCount = await countParagraphNodes(page);
  expect(baselineParagraphCount).toBe(paragraphs.length + Number(baselineSteps));

  await page.goto("/?pageHeight=640", { waitUntil: "networkidle" });
  await setParagraphDocument(page, paragraphs);
  await waitForLayoutIdle(page);
  await placeCaretAtDocumentEnd(page);
  await page.locator(".lumenpage-input").focus();

  const incrementalSteps = await countEnterStepsUntilSecondPage(page, "discrete");
  expect(incrementalSteps).not.toBeNull();
  const incrementalParagraphCount = await countParagraphNodes(page);
  expect(incrementalParagraphCount).toBe(paragraphs.length + Number(incrementalSteps));
  expect(Number(incrementalSteps)).toBeLessThanOrEqual(Number(baselineSteps) + 1);

  guards.assertClean();
});
