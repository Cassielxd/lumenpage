import { expect, test, type Page } from "@playwright/test";
import {
  attachConsoleGuards,
  clickToolbarAction,
  fillVisibleToolbarDialog,
  focusEditor,
  getDocumentSnapshot,
  getEditorSettingsSnapshot,
  getParagraphDocPos,
  openToolbarMenu,
  setDocumentJson,
  setParagraphDocument,
  selectToolbarPageSize,
  setTextSelection,
  submitVisibleSignatureDialog,
  waitForLayoutIdle,
} from "./helpers";

type ToolbarMenu = "base" | "insert" | "table" | "tools" | "page" | "export";

type DocSnapshot = Awaited<ReturnType<typeof getDocumentSnapshot>>;
type SettingsSnapshot = Awaited<ReturnType<typeof getEditorSettingsSnapshot>>;

type AuditContext = {
  beforeDoc: DocSnapshot;
  afterDoc: DocSnapshot;
  beforeSettings: SettingsSnapshot;
  afterSettings: SettingsSnapshot;
};

type AuditCase = {
  name: string;
  menu: ToolbarMenu;
  action: string;
  skipActionClick?: boolean;
  prepare?: (page: Page) => Promise<void>;
  submit?: (page: Page) => Promise<void>;
  expectResult?: (context: AuditContext) => boolean;
  assertResult?: (page: Page, context: AuditContext) => Promise<void>;
};

const DEFAULT_PARAGRAPHS = [
  "Toolbar behavior baseline alpha beta gamma delta.",
  "Second paragraph keeps the insertion target stable.",
];

const getTypeCount = (snapshot: DocSnapshot, type: string) => Number(snapshot.typeCounts?.[type] || 0);
const getJsonString = (snapshot: DocSnapshot) => JSON.stringify(snapshot.json ?? null);

const countMarkType = (node: unknown, targetType: string): number => {
  if (!node || typeof node !== "object") {
    return 0;
  }
  const record = node as {
    type?: string;
    marks?: Array<{ type?: string }>;
    content?: unknown[];
  };
  const ownMarks = Array.isArray(record.marks)
    ? record.marks.filter((mark) => mark?.type === targetType).length
    : 0;
  const children = Array.isArray(record.content)
    ? record.content.reduce((sum, child) => sum + countMarkType(child, targetType), 0)
    : 0;
  return ownMarks + children;
};

const docChanged = (beforeDoc: DocSnapshot, afterDoc: DocSnapshot) =>
  getJsonString(beforeDoc) !== getJsonString(afterDoc);

const settingsChanged = (beforeSettings: SettingsSnapshot, afterSettings: SettingsSnapshot) =>
  JSON.stringify(beforeSettings) !== JSON.stringify(afterSettings);

const selectFirstParagraphRange = async (page: Page, fromOffset: number, toOffset: number) => {
  const from = await getParagraphDocPos(page, 0, fromOffset);
  const to = await getParagraphDocPos(page, 0, toOffset);
  expect(from).not.toBeNull();
  expect(to).not.toBeNull();
  await setTextSelection(page, from!, to!);
};

const setNumericDocument = async (page: Page) => {
  await setParagraphDocument(page, ["12345", "Second paragraph keeps the insertion target stable."]);
  await waitForLayoutIdle(page);
  await focusEditor(page);
};

const cases: AuditCase[] = [
  {
    name: "insert link",
    menu: "insert",
    action: "link",
    prepare: async (page) => {
      await selectFirstParagraphRange(page, 0, 7);
    },
    submit: async (page) => {
      await fillVisibleToolbarDialog(page, ["https://example.com/docs"]);
    },
    expectResult: ({ beforeDoc, afterDoc }) =>
      countMarkType(afterDoc.json, "link") > countMarkType(beforeDoc.json, "link"),
  },
  {
    name: "insert image",
    menu: "insert",
    action: "image",
    submit: async (page) => {
      await fillVisibleToolbarDialog(page, ["https://example.com/demo.png"]);
    },
    expectResult: ({ beforeDoc, afterDoc }) =>
      getTypeCount(afterDoc, "image") > getTypeCount(beforeDoc, "image"),
  },
  {
    name: "insert video",
    menu: "insert",
    action: "video",
    submit: async (page) => {
      await fillVisibleToolbarDialog(page, ["https://example.com/demo.mp4"]);
    },
    expectResult: ({ beforeDoc, afterDoc }) =>
      getTypeCount(afterDoc, "video") > getTypeCount(beforeDoc, "video"),
  },
  {
    name: "insert audio",
    menu: "insert",
    action: "audio",
    submit: async (page) => {
      await fillVisibleToolbarDialog(page, ["https://example.com/demo.mp3", "Audio clip"]);
    },
    expectResult: ({ beforeDoc, afterDoc }) =>
      getTypeCount(afterDoc, "audio") > getTypeCount(beforeDoc, "audio") ||
      docChanged(beforeDoc, afterDoc),
  },
  {
    name: "insert file",
    menu: "insert",
    action: "file",
    submit: async (page) => {
      await fillVisibleToolbarDialog(page, ["https://example.com/demo.pdf", "Attachment.pdf"]);
    },
    expectResult: ({ beforeDoc, afterDoc }) =>
      getTypeCount(afterDoc, "file") > getTypeCount(beforeDoc, "file") || docChanged(beforeDoc, afterDoc),
  },
  {
    name: "insert symbol",
    menu: "insert",
    action: "symbol",
    submit: async (page) => {
      await fillVisibleToolbarDialog(page, ["§"]);
    },
    expectResult: ({ beforeDoc, afterDoc }) =>
      afterDoc.textContent.includes("§") && docChanged(beforeDoc, afterDoc),
  },
  {
    name: "insert chinese date",
    menu: "insert",
    action: "chinese-date",
    expectResult: ({ beforeDoc, afterDoc }) =>
      afterDoc.textContent !== beforeDoc.textContent &&
      /\d{4}[-年]\d{1,2}/.test(afterDoc.textContent),
  },
  {
    name: "insert emoji",
    menu: "insert",
    action: "emoji",
    submit: async (page) => {
      await fillVisibleToolbarDialog(page, ["🙂"]);
    },
    expectResult: ({ beforeDoc, afterDoc }) =>
      afterDoc.textContent.includes("🙂") && docChanged(beforeDoc, afterDoc),
  },
  {
    name: "insert tag",
    menu: "insert",
    action: "tag",
    submit: async (page) => {
      await fillVisibleToolbarDialog(page, ["alpha"]);
    },
    expectResult: ({ beforeDoc, afterDoc }) =>
      getTypeCount(afterDoc, "tag") > getTypeCount(beforeDoc, "tag") ||
      afterDoc.textContent.includes("#alpha"),
  },
  {
    name: "insert bookmark",
    menu: "insert",
    action: "bookmark",
    submit: async (page) => {
      await fillVisibleToolbarDialog(page, ["https://example.com/bookmark", "Reference"]);
    },
    expectResult: ({ beforeDoc, afterDoc }) =>
      getTypeCount(afterDoc, "bookmark") > getTypeCount(beforeDoc, "bookmark") ||
      docChanged(beforeDoc, afterDoc),
  },
  {
    name: "insert horizontal rule",
    menu: "insert",
    action: "hr",
    expectResult: ({ beforeDoc, afterDoc }) =>
      getTypeCount(afterDoc, "horizontalRule") > getTypeCount(beforeDoc, "horizontalRule"),
  },
  {
    name: "insert toc placeholder",
    menu: "insert",
    action: "toc",
    prepare: async (page) => {
      await setDocumentJson(page, {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Outline heading" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Body paragraph" }],
          },
        ],
      });
      await waitForLayoutIdle(page);
      await focusEditor(page);
    },
    assertResult: async (page) => {
      await expect(page.locator(".doc-outline")).toBeVisible();
    },
  },
  {
    name: "insert template",
    menu: "insert",
    action: "template",
    submit: async (page) => {
      await fillVisibleToolbarDialog(page, ["Project Plan", "Scope and owners.", "Milestone,Owner,Risk"]);
    },
    expectResult: ({ beforeDoc, afterDoc }) =>
      getTypeCount(afterDoc, "templateBlock") > getTypeCount(beforeDoc, "templateBlock") ||
      getTypeCount(afterDoc, "heading") > getTypeCount(beforeDoc, "heading") ||
      getTypeCount(afterDoc, "bulletList") > getTypeCount(beforeDoc, "bulletList"),
  },
  {
    name: "insert web page",
    menu: "insert",
    action: "web-page",
    submit: async (page) => {
      await fillVisibleToolbarDialog(page, ["https://example.com/embed", "Embedded page"]);
    },
    expectResult: ({ beforeDoc, afterDoc }) =>
      getTypeCount(afterDoc, "webPage") > getTypeCount(beforeDoc, "webPage") ||
      docChanged(beforeDoc, afterDoc),
  },
  {
    name: "insert barcode",
    menu: "tools",
    action: "barcode",
    submit: async (page) => {
      await fillVisibleToolbarDialog(page);
    },
    expectResult: ({ beforeDoc, afterDoc }) =>
      getTypeCount(afterDoc, "image") > getTypeCount(beforeDoc, "image"),
  },
  {
    name: "insert signature",
    menu: "tools",
    action: "signature",
    submit: async (page) => {
      await submitVisibleSignatureDialog(page, { signer: "Signer" });
    },
    expectResult: ({ beforeDoc, afterDoc }) =>
      getTypeCount(afterDoc, "signature") > getTypeCount(beforeDoc, "signature") ||
      docChanged(beforeDoc, afterDoc),
  },
  {
    name: "insert diagrams",
    menu: "tools",
    action: "diagrams",
    submit: async (page) => {
      await fillVisibleToolbarDialog(page);
    },
    expectResult: ({ beforeDoc, afterDoc }) =>
      getTypeCount(afterDoc, "embedPanel") > getTypeCount(beforeDoc, "embedPanel") ||
      getTypeCount(afterDoc, "codeBlock") > getTypeCount(beforeDoc, "codeBlock"),
  },
  {
    name: "insert echarts",
    menu: "tools",
    action: "echarts",
    submit: async (page) => {
      await fillVisibleToolbarDialog(page);
    },
    expectResult: ({ beforeDoc, afterDoc }) =>
      getTypeCount(afterDoc, "embedPanel") > getTypeCount(beforeDoc, "embedPanel") ||
      getTypeCount(afterDoc, "codeBlock") > getTypeCount(beforeDoc, "codeBlock"),
  },
  {
    name: "insert mind map",
    menu: "tools",
    action: "mind-map",
    submit: async (page) => {
      await fillVisibleToolbarDialog(page);
    },
    expectResult: ({ beforeDoc, afterDoc }) =>
      getTypeCount(afterDoc, "embedPanel") > getTypeCount(beforeDoc, "embedPanel") ||
      getTypeCount(afterDoc, "codeBlock") > getTypeCount(beforeDoc, "codeBlock"),
  },
  {
    name: "convert chinese case",
    menu: "tools",
    action: "chinese-case",
    prepare: async (page) => {
      await setNumericDocument(page);
      await selectFirstParagraphRange(page, 0, 5);
    },
    submit: async (page) => {
      await fillVisibleToolbarDialog(page);
    },
    expectResult: ({ beforeDoc, afterDoc }) =>
      beforeDoc.textContent !== afterDoc.textContent &&
      /[零壹贰叁肆伍陆柒捌玖一二三四五六七八九十百千万亿点]/.test(afterDoc.textContent),
  },
  {
    name: "set page margin",
    menu: "page",
    action: "page-margin",
    submit: async (page) => {
      await fillVisibleToolbarDialog(page, ["96"]);
    },
    expectResult: ({ beforeSettings, afterSettings }) =>
      beforeSettings.margin.left !== afterSettings.margin.left &&
      afterSettings.margin.left === 96,
  },
  {
    name: "set page size",
    menu: "page",
    action: "page-size",
    skipActionClick: true,
    submit: async (page) => {
      await selectToolbarPageSize(page, "Letter");
    },
    expectResult: ({ beforeSettings, afterSettings }) =>
      (beforeSettings.pageWidth !== afterSettings.pageWidth ||
        beforeSettings.pageHeight !== afterSettings.pageHeight) &&
      Math.min(afterSettings.pageWidth, afterSettings.pageHeight) === 816 &&
      Math.max(afterSettings.pageWidth, afterSettings.pageHeight) === 1056 &&
      (beforeSettings.pageWidth > beforeSettings.pageHeight) ===
        (afterSettings.pageWidth > afterSettings.pageHeight),
  },
  {
    name: "toggle page orientation",
    menu: "page",
    action: "page-orientation",
    expectResult: ({ beforeSettings, afterSettings }) =>
      beforeSettings.pageWidth === afterSettings.pageHeight &&
      beforeSettings.pageHeight === afterSettings.pageWidth,
  },
  {
    name: "toggle page line number",
    menu: "page",
    action: "page-line-number",
    expectResult: ({ beforeSettings, afterSettings }) =>
      beforeSettings.appearance.showLineNumbers !== afterSettings.appearance.showLineNumbers,
  },
  {
    name: "set page background",
    menu: "page",
    action: "page-background",
    submit: async (page) => {
      await fillVisibleToolbarDialog(page);
    },
    expectResult: ({ beforeSettings, afterSettings }) =>
      beforeSettings.appearance.backgroundColor !== afterSettings.appearance.backgroundColor &&
      typeof afterSettings.appearance.backgroundColor === "string" &&
      afterSettings.appearance.backgroundColor.length > 0,
  },
  {
    name: "set page watermark",
    menu: "page",
    action: "page-watermark",
    submit: async (page) => {
      await fillVisibleToolbarDialog(page, ["CONFIDENTIAL"]);
    },
    expectResult: ({ beforeSettings, afterSettings }) =>
      beforeSettings.appearance.watermarkText !== afterSettings.appearance.watermarkText &&
      afterSettings.appearance.watermarkText === "CONFIDENTIAL",
  },
  {
    name: "set page header",
    menu: "page",
    action: "page-header",
    submit: async (page) => {
      await fillVisibleToolbarDialog(page, ["Header {page}"]);
    },
    expectResult: ({ beforeSettings, afterSettings }) =>
      beforeSettings.appearance.headerText !== afterSettings.appearance.headerText &&
      afterSettings.appearance.headerText === "Header {page}",
  },
  {
    name: "set page footer",
    menu: "page",
    action: "page-footer",
    submit: async (page) => {
      await fillVisibleToolbarDialog(page, ["Footer {page}"]);
    },
    expectResult: ({ beforeSettings, afterSettings }) =>
      beforeSettings.appearance.footerText !== afterSettings.appearance.footerText &&
      afterSettings.appearance.footerText === "Footer {page}",
  },
];

for (const auditCase of cases) {
  test(`lumen toolbar behavior: ${auditCase.name}`, async ({ page }) => {
    const guards = attachConsoleGuards(page);
    const browserDialogs: string[] = [];
    page.on("dialog", async (dialog) => {
      browserDialogs.push(`${dialog.type()}:${dialog.message()}`);
      await dialog.dismiss();
    });

    await page.goto("/", { waitUntil: "networkidle" });
    await setParagraphDocument(page, DEFAULT_PARAGRAPHS);
    await waitForLayoutIdle(page);
    await focusEditor(page);

    await auditCase.prepare?.(page);

    const beforeDoc = await getDocumentSnapshot(page);
    const beforeSettings = await getEditorSettingsSnapshot(page);

    await openToolbarMenu(page, auditCase.menu);
    if (!auditCase.skipActionClick) {
      await clickToolbarAction(page, auditCase.action);
    }
    await auditCase.submit?.(page);
    await waitForLayoutIdle(page);

    const afterDoc = await getDocumentSnapshot(page);
    const afterSettings = await getEditorSettingsSnapshot(page);

    const context = {
      beforeDoc,
      afterDoc,
      beforeSettings,
      afterSettings,
    };
    const failureDetail = `${auditCase.action} should produce an observable effect\n${JSON.stringify(
      {
        action: auditCase.action,
        browserDialogs,
        beforeTypeCounts: beforeDoc.typeCounts,
        afterTypeCounts: afterDoc.typeCounts,
        beforeSettings,
        afterSettings,
      },
      null,
      2,
    )}`;

    if (auditCase.assertResult) {
      await auditCase.assertResult(page, context);
    } else {
      expect(auditCase.expectResult?.(context), failureDetail).toBeTruthy();
    }

    guards.assertClean();
  });
}
