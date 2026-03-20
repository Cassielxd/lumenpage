import { expect, test } from "@playwright/test";
import {
  attachConsoleGuards,
  clickToolbarAction,
  openToolbarMenu,
  setParagraphDocument,
  waitForLayoutIdle,
  waitForPageCount,
} from "./helpers";

test("preview, image export, and pdf export use paginated rendered pages", async ({ page }) => {
  const guards = attachConsoleGuards(page);

  await page.goto("/", { waitUntil: "networkidle" });

  const paragraphs = Array.from(
    { length: 72 },
    (_, index) =>
      `Export preview paragraph ${index + 1}. ` +
      "This paragraph is intentionally long so preview and export must span multiple pages. ".repeat(
        5,
      ),
  );

  await setParagraphDocument(page, paragraphs);
  await waitForLayoutIdle(page);
  await waitForPageCount(page, 3);

  await openToolbarMenu(page, "page");
  await clickToolbarAction(page, "page-preview");

  const overlay = page.locator("#lumen-print-preview-overlay");
  await expect(overlay).toBeVisible();

  const previewFrame = page.frameLocator("#lumen-print-preview-overlay iframe");
  await expect
    .poll(async () => await previewFrame.locator(".print-page").count())
    .toBeGreaterThanOrEqual(3);

  await page.keyboard.press("Escape");
  await expect(overlay).toBeHidden();

  await openToolbarMenu(page, "base");

  const [imageDownload] = await Promise.all([
    page.waitForEvent("download"),
    clickToolbarAction(page, "export-image"),
  ]);
  expect(imageDownload.suggestedFilename()).toBe("lumen-document.png");
  expect(await imageDownload.failure()).toBeNull();

  const [pdfDownload] = await Promise.all([
    page.waitForEvent("download"),
    clickToolbarAction(page, "export-pdf"),
  ]);
  expect(pdfDownload.suggestedFilename()).toBe("lumen-document.pdf");
  expect(await pdfDownload.failure()).toBeNull();

  guards.assertClean();
});
