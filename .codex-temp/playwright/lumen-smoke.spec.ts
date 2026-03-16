import { expect, test } from "@playwright/test/index.js";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.PW_BASE_URL || "http://127.0.0.1:4173";
const SCREENSHOT_DIR = path.resolve(
  process.cwd(),
  ".codex-temp",
  "playwright",
  "artifacts",
  "lumen-smoke",
);

const ensureScreenshotDir = async () => {
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
};

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "tab";

test("lumen shell smoke", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const screenshots: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await ensureScreenshotDir();
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(BASE_URL, { waitUntil: "networkidle" });

  const shell = page.locator(".doc-shell");
  const topbar = page.locator(".topbar");
  const menuBar = page.locator(".menu-bar");
  const toolbar = page.locator(".toolbar");
  const editorHost = page.locator(".editor-host");
  const footer = page.locator(".doc-footer");
  const canvas = page.locator("canvas").first();

  await expect(shell).toBeVisible();
  await expect(topbar).toBeVisible();
  await expect(menuBar).toBeVisible();
  await expect(toolbar).toBeVisible();
  await expect(editorHost).toBeVisible();
  await expect(footer).toBeVisible();
  await expect(canvas).toBeVisible();

  const mainRegions = [
    { label: "topbar", locator: topbar },
    { label: "menu-bar", locator: menuBar },
    { label: "toolbar", locator: toolbar },
    { label: "editor-host", locator: editorHost },
    { label: "footer", locator: footer },
  ];

  for (const region of mainRegions) {
    const box = await region.locator.boundingBox();
    expect(box, `${region.label} should have a bounding box`).not.toBeNull();
    expect((box?.width || 0) > 0, `${region.label} width should be > 0`).toBeTruthy();
    expect((box?.height || 0) > 0, `${region.label} height should be > 0`).toBeTruthy();
  }

  const initialShot = path.join(SCREENSHOT_DIR, "01-initial.png");
  await page.screenshot({ path: initialShot, fullPage: true });
  screenshots.push(initialShot);

  const tocToggleButton = page.locator(".topbar-right .t-button").first();
  if (await tocToggleButton.isVisible()) {
    await tocToggleButton.click();
    await page.waitForTimeout(600);
    const tocPanel = page.locator(".doc-outline");
    if (await tocPanel.count()) {
      await expect(tocPanel).toBeVisible();
      const tocShot = path.join(SCREENSHOT_DIR, "02-toc-open.png");
      await page.screenshot({ path: tocShot, fullPage: true });
      screenshots.push(tocShot);

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
    await expect(tab).toHaveAttribute("aria-selected", "true");

    const toolbarItemCount = await page
      .locator(".toolbar .icon-btn, .toolbar .toolbar-inline-control, .toolbar .heading-inline-box")
      .count();
    expect(
      toolbarItemCount,
      `toolbar should expose at least one item after switching to ${label}`,
    ).toBeGreaterThan(0);

    const shotPath = path.join(SCREENSHOT_DIR, `tab-${String(index + 1).padStart(2, "0")}-${label}.png`);
    await page.screenshot({ path: shotPath, fullPage: true });
    screenshots.push(shotPath);
  }

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);

  await test.info().attach("screenshots", {
    body: screenshots.join("\n"),
    contentType: "text/plain",
  });
});
