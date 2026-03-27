import { expect, test } from "@playwright/test";
import {
  attachConsoleGuards,
  forceEditorRender,
  getOverlayRect,
  getSelectionRange,
  setDocumentJson,
  waitForLayoutIdle,
} from "./helpers";

test("embed panel click selects node without leaking into following paragraph", async ({ page }) => {
  const guards = attachConsoleGuards(page);

  await page.goto("/", { waitUntil: "networkidle" });
  await setDocumentJson(page, {
    type: "doc",
    content: [
      {
        type: "embedPanel",
        attrs: {
          id: "echarts-selection-case",
          kind: "echarts",
          title: "Sales Chart",
          source: '{"xAxis":{"type":"category","data":["Mon","Tue"]},"yAxis":{"type":"value"},"series":[{"type":"bar","data":[120,200]}]}',
          width: 680,
          height: 340,
        },
      },
      {
        type: "paragraph",
        attrs: { id: "paragraph-after-chart" },
        content: [{ type: "text", text: "Paragraph after chart" }],
      },
    ],
  });
  await waitForLayoutIdle(page);
  await forceEditorRender(page);

  await expect
    .poll(async () => {
      const rect = await getOverlayRect(page, ".lumenpage-embed-panel-overlay");
      if (!rect || rect.display === "none" || rect.visibility === "hidden") {
        return null;
      }
      if (!(rect.width > 0) || !(rect.height > 0)) {
        return null;
      }
      return rect;
    })
    .not.toBeNull();

  const rect = await getOverlayRect(page, ".lumenpage-embed-panel-overlay");
  expect(rect).not.toBeNull();

  await page.mouse.click((rect!.x + rect!.width / 2), (rect!.y + rect!.height / 2));
  await page.waitForTimeout(150);

  const selection = await getSelectionRange(page);
  expect(selection).not.toBeNull();
  expect(selection?.type).toBe("NodeSelection");
  expect(selection?.empty).toBe(false);

  guards.assertClean();
});

test("web page preview click selects node without leaking into following paragraph", async ({ page }) => {
  const guards = attachConsoleGuards(page);

  await page.goto("/", { waitUntil: "networkidle" });
  await setDocumentJson(page, {
    type: "doc",
    content: [
      {
        type: "webPage",
        attrs: {
          id: "web-page-selection-case",
          title: "Embedded page",
          width: 620,
          height: 360,
        },
      },
      {
        type: "paragraph",
        attrs: { id: "paragraph-after-web-page" },
        content: [{ type: "text", text: "Paragraph after web page" }],
      },
    ],
  });
  await waitForLayoutIdle(page);
  await forceEditorRender(page);

  await expect
    .poll(async () => {
      const rect = await getOverlayRect(page, ".lumenpage-web-page-overlay");
      if (!rect || rect.display === "none" || rect.visibility === "hidden") {
        return null;
      }
      if (!(rect.width > 0) || !(rect.height > 0)) {
        return null;
      }
      return rect;
    })
    .not.toBeNull();

  const rect = await getOverlayRect(page, ".lumenpage-web-page-overlay");
  expect(rect).not.toBeNull();

  await page.mouse.click(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2);
  await page.waitForTimeout(150);

  const selection = await getSelectionRange(page);
  expect(selection).not.toBeNull();
  expect(selection?.type).toBe("NodeSelection");
  expect(selection?.empty).toBe(false);

  guards.assertClean();
});

test("signature overlay click selects node without leaking into following paragraph", async ({ page }) => {
  const guards = attachConsoleGuards(page);

  await page.goto("/", { waitUntil: "networkidle" });
  await setDocumentJson(page, {
    type: "doc",
    content: [
      {
        type: "signature",
        attrs: {
          id: "signature-selection-case",
          signer: "Jane Doe",
          signedAt: "2026-03-27",
          src: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
          width: 320,
          height: 120,
        },
      },
      {
        type: "paragraph",
        attrs: { id: "paragraph-after-signature" },
        content: [{ type: "text", text: "Paragraph after signature" }],
      },
    ],
  });
  await waitForLayoutIdle(page);
  await forceEditorRender(page);

  await expect
    .poll(async () => {
      const rect = await getOverlayRect(page, ".lumenpage-signature-overlay");
      if (!rect || rect.display === "none" || rect.visibility === "hidden") {
        return null;
      }
      if (!(rect.width > 0) || !(rect.height > 0)) {
        return null;
      }
      return rect;
    })
    .not.toBeNull();

  const rect = await getOverlayRect(page, ".lumenpage-signature-overlay");
  expect(rect).not.toBeNull();

  await page.mouse.click(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2);
  await page.waitForTimeout(150);

  const selection = await getSelectionRange(page);
  expect(selection).not.toBeNull();
  expect(selection?.type).toBe("NodeSelection");
  expect(selection?.empty).toBe(false);

  guards.assertClean();
});
