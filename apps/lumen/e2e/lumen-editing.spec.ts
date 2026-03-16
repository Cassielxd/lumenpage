import { expect, test } from "@playwright/test";
import {
  attachConsoleGuards,
  focusEditor,
  getEditorLocators,
  getFooterStats,
  insertTable,
  isNonWhitePixel,
  parseFirstNumber,
  probeTablePixels,
  scrollEditor,
} from "./helpers";

test("lumen editing smoke", async ({ page }) => {
  const guards = attachConsoleGuards(page);

  await page.goto("/", { waitUntil: "networkidle" });

  const { root, input, scrollArea } = getEditorLocators(page);
  const footerStats = getFooterStats(page);

  await expect(root).toBeVisible();
  await expect(input).toBeAttached();
  await expect(scrollArea).toBeVisible();

  const wordStatBefore = parseFirstNumber(await footerStats.nth(2).innerText()) ?? 0;

  await focusEditor(page);
  await page.keyboard.type(" Playwright smoke edit", { delay: 30 });
  await page.waitForTimeout(700);

  const wordStatAfterTyping = parseFirstNumber(await footerStats.nth(2).innerText()) ?? 0;
  expect(
    wordStatAfterTyping,
    `word count should grow after typing, before=${wordStatBefore}, after=${wordStatAfterTyping}`,
  ).toBeGreaterThan(wordStatBefore);

  const pageStatBeforeScroll = parseFirstNumber(await footerStats.nth(0).innerText()) ?? 0;
  await scrollEditor(scrollArea, 1200);
  await page.waitForTimeout(700);
  const pageStatAfterScroll = parseFirstNumber(await footerStats.nth(0).innerText()) ?? 0;
  expect(
    pageStatAfterScroll,
    `current page should stay valid after scrolling, before=${pageStatBeforeScroll}, after=${pageStatAfterScroll}`,
  ).toBeGreaterThan(0);

  await scrollEditor(scrollArea, 0);
  await page.waitForTimeout(500);
  await focusEditor(page);

  await insertTable(page, "2x2");
  await page.waitForTimeout(900);

  const nodeStatAfterTable = parseFirstNumber(await footerStats.nth(5).innerText()) ?? 0;
  expect(nodeStatAfterTable).toBeGreaterThan(0);

  const probe = await probeTablePixels(page);
  expect(probe, "table fragment should be rendered into the page canvas").not.toBeNull();
  expect(probe?.fragment.width ?? 0).toBeGreaterThan(0);
  expect(probe?.fragment.height ?? 0).toBeGreaterThan(0);

  const borderSamples = Object.entries(probe?.samples ?? {});
  expect(borderSamples.length, "table border probes should exist").toBeGreaterThan(0);
  for (const [key, sample] of borderSamples) {
    expect(isNonWhitePixel(sample), `${key} should hit a visible table stroke`).toBeTruthy();
  }

  guards.assertClean();
});
