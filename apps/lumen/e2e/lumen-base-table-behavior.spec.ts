import { expect, test, type Page } from "@playwright/test";
import {
  attachConsoleGuards,
  clickToolbarAction,
  focusEditor,
  getDocumentSnapshot,
  getParagraphDocPos,
  getSelectionRange,
  openToolbarMenu,
  setDocumentJson,
  setParagraphDocument,
  setTextSelection,
  waitForLayoutIdle,
} from "./helpers";

type ToolbarMenu = "base" | "table";

type DocSnapshot = Awaited<ReturnType<typeof getDocumentSnapshot>>;

type AuditContext = {
  beforeDoc: DocSnapshot;
  afterDoc: DocSnapshot;
};

type AuditCase = {
  name: string;
  menu: ToolbarMenu;
  action: string;
  prepare?: (page: Page) => Promise<void>;
  submit?: (page: Page) => Promise<void>;
  expectResult?: (context: AuditContext) => boolean;
  assertResult?: (page: Page, context: AuditContext) => Promise<void>;
};

const DEFAULT_PARAGRAPHS = [
  "Base toolbar baseline alpha beta gamma delta.",
  "Second paragraph keeps selection and block transforms stable.",
];

const getTypeCount = (snapshot: DocSnapshot, type: string) => Number(snapshot.typeCounts?.[type] || 0);

const countMarkType = (node: unknown, targetType: string): number => {
  if (!node || typeof node !== "object") {
    return 0;
  }
  const record = node as {
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

const buildTableDoc = () => ({
  type: "doc",
  content: [
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              content: [{ type: "paragraph", content: [{ type: "text", text: "A1" }] }],
            },
            {
              type: "tableCell",
              content: [{ type: "paragraph", content: [{ type: "text", text: "B1" }] }],
            },
          ],
        },
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              content: [{ type: "paragraph", content: [{ type: "text", text: "A2" }] }],
            },
            {
              type: "tableCell",
              content: [{ type: "paragraph", content: [{ type: "text", text: "B2" }] }],
            },
          ],
        },
      ],
    },
  ],
});

const selectFirstParagraphRange = async (page: Page, fromOffset: number, toOffset: number) => {
  const from = await getParagraphDocPos(page, 0, fromOffset);
  const to = await getParagraphDocPos(page, 0, toOffset);
  expect(from).not.toBeNull();
  expect(to).not.toBeNull();
  await setTextSelection(page, from!, to!);
};

const prepareTextSelection = async (page: Page) => {
  await selectFirstParagraphRange(page, 0, 7);
};

const prepareTableCellSelection = async (page: Page) => {
  await setDocumentJson(page, buildTableDoc());
  await waitForLayoutIdle(page);
  await focusEditor(page);
  await selectFirstParagraphRange(page, 0, 0);
};

const cases: AuditCase[] = [
  {
    name: "toggle bold",
    menu: "base",
    action: "bold",
    prepare: prepareTextSelection,
    expectResult: ({ beforeDoc, afterDoc }) =>
      countMarkType(afterDoc.json, "bold") > countMarkType(beforeDoc.json, "bold"),
  },
  {
    name: "toggle italic",
    menu: "base",
    action: "italic",
    prepare: prepareTextSelection,
    expectResult: ({ beforeDoc, afterDoc }) =>
      countMarkType(afterDoc.json, "italic") > countMarkType(beforeDoc.json, "italic"),
  },
  {
    name: "toggle underline",
    menu: "base",
    action: "underline",
    prepare: prepareTextSelection,
    expectResult: ({ beforeDoc, afterDoc }) =>
      countMarkType(afterDoc.json, "underline") > countMarkType(beforeDoc.json, "underline"),
  },
  {
    name: "toggle strike",
    menu: "base",
    action: "strike",
    prepare: prepareTextSelection,
    expectResult: ({ beforeDoc, afterDoc }) =>
      countMarkType(afterDoc.json, "strike") > countMarkType(beforeDoc.json, "strike"),
  },
  {
    name: "toggle inline code",
    menu: "base",
    action: "inline-code",
    prepare: prepareTextSelection,
    expectResult: ({ beforeDoc, afterDoc }) =>
      countMarkType(afterDoc.json, "code") > countMarkType(beforeDoc.json, "code"),
  },
  {
    name: "toggle bullet list",
    menu: "base",
    action: "bullet-list",
    expectResult: ({ beforeDoc, afterDoc }) =>
      getTypeCount(afterDoc, "bulletList") > getTypeCount(beforeDoc, "bulletList"),
  },
  {
    name: "toggle ordered list",
    menu: "base",
    action: "ordered-list",
    expectResult: ({ beforeDoc, afterDoc }) =>
      getTypeCount(afterDoc, "orderedList") > getTypeCount(beforeDoc, "orderedList"),
  },
  {
    name: "toggle task list",
    menu: "base",
    action: "task-list",
    expectResult: ({ beforeDoc, afterDoc }) =>
      getTypeCount(afterDoc, "taskList") > getTypeCount(beforeDoc, "taskList"),
  },
  {
    name: "toggle blockquote",
    menu: "base",
    action: "quote",
    expectResult: ({ beforeDoc, afterDoc }) =>
      getTypeCount(afterDoc, "blockquote") > getTypeCount(beforeDoc, "blockquote"),
  },
  {
    name: "clear format",
    menu: "base",
    action: "clear-format",
    prepare: async (page) => {
      await prepareTextSelection(page);
      await openToolbarMenu(page, "base");
      await clickToolbarAction(page, "bold");
      await waitForLayoutIdle(page);
      await prepareTextSelection(page);
    },
    expectResult: ({ afterDoc }) => countMarkType(afterDoc.json, "bold") === 0,
  },
  {
    name: "select all",
    menu: "base",
    action: "select-all",
    assertResult: async (page) => {
      const selection = await getSelectionRange(page);
      expect(selection?.empty).toBeFalsy();
      expect(selection?.to).toBeGreaterThan(selection?.from ?? 0);
    },
  },
  {
    name: "insert table",
    menu: "table",
    action: "table-insert",
    submit: async (page) => {
      await page.locator('.table-insert-picker [data-table-size="2x2"]').click();
    },
    expectResult: ({ beforeDoc, afterDoc }) =>
      getTypeCount(afterDoc, "table") > getTypeCount(beforeDoc, "table"),
  },
  {
    name: "add table row after",
    menu: "table",
    action: "add-row-after",
    prepare: prepareTableCellSelection,
    expectResult: ({ beforeDoc, afterDoc }) =>
      getTypeCount(afterDoc, "tableRow") > getTypeCount(beforeDoc, "tableRow"),
  },
  {
    name: "add table column after",
    menu: "table",
    action: "add-column-after",
    prepare: prepareTableCellSelection,
    expectResult: ({ beforeDoc, afterDoc }) =>
      getTypeCount(afterDoc, "tableCell") > getTypeCount(beforeDoc, "tableCell"),
  },
  {
    name: "toggle table header row",
    menu: "table",
    action: "toggle-header-row",
    prepare: prepareTableCellSelection,
    expectResult: ({ beforeDoc, afterDoc }) =>
      JSON.stringify(beforeDoc.json) !== JSON.stringify(afterDoc.json),
  },
  {
    name: "delete table row",
    menu: "table",
    action: "delete-row",
    prepare: prepareTableCellSelection,
    expectResult: ({ beforeDoc, afterDoc }) =>
      getTypeCount(afterDoc, "tableRow") < getTypeCount(beforeDoc, "tableRow"),
  },
  {
    name: "delete table",
    menu: "table",
    action: "delete-table",
    prepare: prepareTableCellSelection,
    expectResult: ({ beforeDoc, afterDoc }) =>
      getTypeCount(beforeDoc, "table") > 0 && getTypeCount(afterDoc, "table") === 0,
  },
];

for (const auditCase of cases) {
  test(`lumen base/table behavior: ${auditCase.name}`, async ({ page }) => {
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

    await openToolbarMenu(page, auditCase.menu);
    await clickToolbarAction(page, auditCase.action);
    await auditCase.submit?.(page);
    await waitForLayoutIdle(page);

    const afterDoc = await getDocumentSnapshot(page);
    const context = { beforeDoc, afterDoc };
    const failureDetail = `${auditCase.action} should produce an observable effect\n${JSON.stringify(
      {
        action: auditCase.action,
        browserDialogs,
        beforeTypeCounts: beforeDoc.typeCounts,
        afterTypeCounts: afterDoc.typeCounts,
        beforeDoc: beforeDoc.json,
        afterDoc: afterDoc.json,
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
