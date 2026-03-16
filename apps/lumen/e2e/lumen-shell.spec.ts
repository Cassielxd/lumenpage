import { expect, test } from "@playwright/test";
import { attachConsoleGuards } from "./helpers";

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "tab";

test("lumen shell smoke", async ({ page }) => {
  const guards = attachConsoleGuards(page);

  await page.goto("/", { waitUntil: "networkidle" });

  const shell = page.locator(".doc-shell");
  const topbar = page.locator(".topbar");
  const menuBar = page.locator(".menu-bar");
  const toolbar = page.locator(".toolbar");
  const editorHost = page.locator(".editor-host");
  const footer = page.locator(".doc-footer");
  const canvas = page.locator(".editor-host canvas").last();

  await expect(shell).toBeVisible();
  await expect(topbar).toBeVisible();
  await expect(menuBar).toBeVisible();
  await expect(toolbar).toBeVisible();
  await expect(editorHost).toBeVisible();
  await expect(footer).toBeVisible();
  await expect(canvas).toBeVisible();

  for (const [label, locator] of [
    ["topbar", topbar],
    ["menu-bar", menuBar],
    ["toolbar", toolbar],
    ["editor-host", editorHost],
    ["footer", footer],
  ] as const) {
    const box = await locator.boundingBox();
    expect(box, `${label} should have a bounding box`).not.toBeNull();
    expect((box?.width || 0) > 0, `${label} width should be > 0`).toBeTruthy();
    expect((box?.height || 0) > 0, `${label} height should be > 0`).toBeTruthy();
  }

  const tocToggleButton = page.locator(".topbar-right .t-button").first();
  if (await tocToggleButton.isVisible()) {
    await tocToggleButton.click();
    await page.waitForTimeout(600);
    const tocPanel = page.locator(".doc-outline");
    if ((await tocPanel.count()) > 0) {
      await expect(tocPanel).toBeVisible();
      const tocCloseButton = page.locator(".doc-outline-close");
      if (await tocCloseButton.isVisible()) {
        await tocCloseButton.click();
        await page.waitForTimeout(400);
      }
    }
  }

  const menuTabs = page.locator(".menu-tab-trigger");
  const tabCount = await menuTabs.count();
  expect(tabCount).toBeGreaterThan(0);

  for (let index = 0; index < tabCount; index += 1) {
    const tab = menuTabs.nth(index);
    const label = slugify(await tab.innerText());
    await tab.click();
    await page.waitForTimeout(350);
    await expect(tab, `${label} should become active`).toHaveAttribute("aria-selected", "true");
    const toolbarItemCount = await page
      .locator(".toolbar .icon-btn, .toolbar .toolbar-inline-control, .toolbar .heading-inline-box")
      .count();
    expect(toolbarItemCount, `${label} should expose toolbar content`).toBeGreaterThan(0);
  }

  guards.assertClean();
});
