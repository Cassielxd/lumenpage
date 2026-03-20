import { expect, test } from "@playwright/test";
import {
  attachConsoleGuards,
  forceEditorRender,
  getLayoutBoxViewportRectByBlockId,
  getOverlayRect,
  setDocumentJson,
  waitForLayoutIdle,
} from "./helpers";

type OverlayCase = {
  name: string;
  selector: string;
  nodeBlockId: string;
  nextBlockId: string;
  doc: unknown;
};

const cases: OverlayCase[] = [
  {
    name: "image overlay matches layout box and stays above next paragraph",
    selector: ".lumenpage-image-overlay",
    nodeBlockId: "image-overlay-case",
    nextBlockId: "paragraph-after-image",
    doc: {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            id: "image-overlay-case",
            src: "https://example.com/demo.png",
            width: 360,
            height: 220,
          },
        },
        {
          type: "paragraph",
          attrs: { id: "paragraph-after-image" },
          content: [{ type: "text", text: "Paragraph after image overlay" }],
        },
      ],
    },
  },
  {
    name: "video overlay matches layout box and stays above next paragraph",
    selector: ".lumenpage-video-overlay",
    nodeBlockId: "video-overlay-case",
    nextBlockId: "paragraph-after-video",
    doc: {
      type: "doc",
      content: [
        {
          type: "video",
          attrs: {
            id: "video-overlay-case",
            src: "https://example.com/demo.mp4",
            width: 480,
            height: 270,
            embed: false,
          },
        },
        {
          type: "paragraph",
          attrs: { id: "paragraph-after-video" },
          content: [{ type: "text", text: "Paragraph after video overlay" }],
        },
      ],
    },
  },  {
    name: "audio overlay matches layout box and stays above next paragraph",
    selector: ".lumenpage-audio-overlay",
    nodeBlockId: "audio-overlay-case",
    nextBlockId: "paragraph-after-audio",
    doc: {
      type: "doc",
      content: [
        {
          type: "audio",
          attrs: {
            id: "audio-overlay-case",
            src: "https://example.com/demo.mp3",
            title: "Overlay audio",
            width: 420,
          },
        },
        {
          type: "paragraph",
          attrs: { id: "paragraph-after-audio" },
          content: [{ type: "text", text: "Paragraph after audio overlay" }],
        },
      ],
    },
  },
  {
    name: "mind map overlay matches layout box and stays above next paragraph",
    selector: ".lumenpage-embed-panel-overlay",
    nodeBlockId: "mindmap-overlay-case",
    nextBlockId: "paragraph-after-mindmap",
    doc: {
      type: "doc",
      content: [
        {
          type: "embedPanel",
          attrs: {
            id: "mindmap-overlay-case",
            kind: "mindMap",
            title: "Mind Map",
            source: "mindmap\n  root((Root))\n    Branch A\n    Branch B",
            width: 680,
            height: 360,
          },
        },
        {
          type: "paragraph",
          attrs: { id: "paragraph-after-mindmap" },
          content: [{ type: "text", text: "Paragraph after embed overlay" }],
        },
      ],
    },
  },
];

const readVisibleOverlayRect = async (page: import("@playwright/test").Page, selector: string) => {
  await expect
    .poll(async () => {
      const rect = await getOverlayRect(page, selector);
      if (!rect || rect.display === "none" || rect.visibility === "hidden") {
        return null;
      }
      if (!(rect.width > 0) || !(rect.height > 0)) {
        return null;
      }
      return rect;
    })
    .not.toBeNull();
  return getOverlayRect(page, selector);
};

for (const testCase of cases) {
  test(testCase.name, async ({ page }) => {
    const guards = attachConsoleGuards(page);

    await page.goto("/", { waitUntil: "networkidle" });
    await setDocumentJson(page, testCase.doc);
    await waitForLayoutIdle(page);
    await forceEditorRender(page);

    const overlayRect = await readVisibleOverlayRect(page, testCase.selector);
    const nodeRect = await getLayoutBoxViewportRectByBlockId(page, testCase.nodeBlockId);
    const nextRect = await getLayoutBoxViewportRectByBlockId(page, testCase.nextBlockId);

    expect(overlayRect, `${testCase.selector} should be visible`).not.toBeNull();
    expect(nodeRect, `${testCase.nodeBlockId} should have a layout box`).not.toBeNull();
    expect(nextRect, `${testCase.nextBlockId} should have a layout box`).not.toBeNull();

    expect(
      Math.abs((overlayRect?.x ?? 0) - (nodeRect?.x ?? 0)),
      `${testCase.selector} x should match the layout box`,
    ).toBeLessThan(8);
    expect(
      Math.abs((overlayRect?.y ?? 0) - (nodeRect?.y ?? 0)),
      `${testCase.selector} y should match the layout box`,
    ).toBeLessThan(8);
    expect(
      Math.abs((overlayRect?.width ?? 0) - (nodeRect?.width ?? 0)),
      `${testCase.selector} width should match the layout box`,
    ).toBeLessThan(8);
    expect(
      Math.abs((overlayRect?.height ?? 0) - (nodeRect?.height ?? 0)),
      `${testCase.selector} height should match the layout box`,
    ).toBeLessThan(8);

    expect(
      (nodeRect?.y ?? 0) + (nodeRect?.height ?? 0),
      `${testCase.nodeBlockId} should not overlap the following paragraph layout box`,
    ).toBeLessThanOrEqual((nextRect?.y ?? 0) + 2);

    guards.assertClean();
  });
}