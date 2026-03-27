import { expect, test } from "@playwright/test";
import {
  attachConsoleGuards,
  forceEditorRender,
  getOverlayRect,
  getSelectionRange,
  setDocumentJson,
  waitForLayoutIdle,
} from "./helpers";

type SelectionCase = {
  name: string;
  selector: string;
  doc: unknown;
};

const cases: SelectionCase[] = [
  {
    name: "embed panel click selects node without leaking into following paragraph",
    selector: ".lumenpage-embed-panel-overlay",
    doc: {
      type: "doc",
      content: [
        {
          type: "embedPanel",
          attrs: {
            id: "echarts-selection-case",
            kind: "echarts",
            title: "Sales Chart",
            source:
              '{"xAxis":{"type":"category","data":["Mon","Tue"]},"yAxis":{"type":"value"},"series":[{"type":"bar","data":[120,200]}]}',
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
    },
  },
  {
    name: "audio overlay click selects node without leaking into following paragraph",
    selector: ".lumenpage-audio-overlay",
    doc: {
      type: "doc",
      content: [
        {
          type: "audio",
          attrs: {
            id: "audio-selection-case",
            src: "https://example.com/demo.mp3",
            title: "Selection audio",
            width: 420,
          },
        },
        {
          type: "paragraph",
          attrs: { id: "paragraph-after-audio" },
          content: [{ type: "text", text: "Paragraph after audio" }],
        },
      ],
    },
  },
  {
    name: "bookmark overlay click selects node without leaking into following paragraph",
    selector: ".lumenpage-bookmark-overlay",
    doc: {
      type: "doc",
      content: [
        {
          type: "bookmark",
          attrs: {
            id: "bookmark-selection-case",
            href: "https://example.com/reference",
            title: "Reference bookmark",
            description: "Bookmark description",
          },
        },
        {
          type: "paragraph",
          attrs: { id: "paragraph-after-bookmark" },
          content: [{ type: "text", text: "Paragraph after bookmark" }],
        },
      ],
    },
  },
  {
    name: "file overlay click selects node without leaking into following paragraph",
    selector: ".lumenpage-file-overlay",
    doc: {
      type: "doc",
      content: [
        {
          type: "file",
          attrs: {
            id: "file-selection-case",
            href: "https://example.com/demo.pdf",
            name: "Demo PDF",
            size: "2 MB",
            mimeType: "application/pdf",
          },
        },
        {
          type: "paragraph",
          attrs: { id: "paragraph-after-file" },
          content: [{ type: "text", text: "Paragraph after file" }],
        },
      ],
    },
  },
  {
    name: "web page preview click selects node without leaking into following paragraph",
    selector: ".lumenpage-web-page-overlay",
    doc: {
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
    },
  },
  {
    name: "signature overlay click selects node without leaking into following paragraph",
    selector: ".lumenpage-signature-overlay",
    doc: {
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
    },
  },
];

for (const testCase of cases) {
  test(testCase.name, async ({ page }) => {
    const guards = attachConsoleGuards(page);

    await page.goto("/", { waitUntil: "networkidle" });
    await setDocumentJson(page, testCase.doc);
    await waitForLayoutIdle(page);
    await forceEditorRender(page);

    await expect
      .poll(async () => {
        const rect = await getOverlayRect(page, testCase.selector);
        if (!rect || rect.display === "none" || rect.visibility === "hidden") {
          return null;
        }
        if (!(rect.width > 0) || !(rect.height > 0)) {
          return null;
        }
        return rect;
      })
      .not.toBeNull();

    const rect = await getOverlayRect(page, testCase.selector);
    expect(rect).not.toBeNull();

    await page.mouse.click(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2);
    await page.waitForTimeout(150);

    const selection = await getSelectionRange(page);
    expect(selection).not.toBeNull();
    expect(selection?.type).toBe("NodeSelection");
    expect(selection?.empty).toBe(false);

    guards.assertClean();
  });
}
