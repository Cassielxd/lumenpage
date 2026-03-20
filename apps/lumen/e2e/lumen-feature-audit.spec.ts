import { expect, test } from "@playwright/test";
import {
  attachConsoleGuards,
  clickToolbarAction,
  focusEditor,
  getDocumentSnapshot,
  openToolbarMenu,
  setParagraphDocument,
  submitVisibleToolbarDialog,
  waitForLayoutIdle,
} from "./helpers";

type FeatureAuditCase = {
  name: string;
  menu: "insert" | "tools" | "page";
  action: string;
  expectResult: (before: Awaited<ReturnType<typeof getDocumentSnapshot>>, after: Awaited<ReturnType<typeof getDocumentSnapshot>>) => boolean;
};

const getTypeCount = (snapshot: Awaited<ReturnType<typeof getDocumentSnapshot>>, type: string) =>
  Number(snapshot.typeCounts?.[type] || 0);

const cases: FeatureAuditCase[] = [
  {
    name: "insert code block",
    menu: "insert",
    action: "code-block",
    expectResult: (before, after) => getTypeCount(after, "codeBlock") > getTypeCount(before, "codeBlock"),
  },
  {
    name: "insert callout",
    menu: "insert",
    action: "callout",
    expectResult: (before, after) =>
      getTypeCount(after, "callout") > getTypeCount(before, "callout") ||
      getTypeCount(after, "blockquote") > getTypeCount(before, "blockquote"),
  },
  {
    name: "insert option box",
    menu: "insert",
    action: "option-box",
    expectResult: (before, after) =>
      getTypeCount(after, "optionBox") > getTypeCount(before, "optionBox") ||
      getTypeCount(after, "taskList") > getTypeCount(before, "taskList"),
  },
  {
    name: "insert QR code",
    menu: "tools",
    action: "qrcode",
    expectResult: (before, after) => getTypeCount(after, "image") > getTypeCount(before, "image"),
  },
  {
    name: "insert mermaid",
    menu: "tools",
    action: "mermaid",
    expectResult: (before, after) =>
      getTypeCount(after, "embedPanel") > getTypeCount(before, "embedPanel") ||
      getTypeCount(after, "codeBlock") > getTypeCount(before, "codeBlock"),
  },
  {
    name: "insert page break",
    menu: "page",
    action: "page-break",
    expectResult: (before, after) =>
      getTypeCount(after, "pageBreak") > getTypeCount(before, "pageBreak"),
  },
];

for (const auditCase of cases) {
  test(`lumen feature audit: ${auditCase.name}`, async ({ page }) => {
    const guards = attachConsoleGuards(page);

    await page.goto("/", { waitUntil: "networkidle" });
    await setParagraphDocument(page, [
      "Feature audit baseline paragraph alpha beta gamma.",
      "Second paragraph keeps the insertion target stable.",
    ]);
    await waitForLayoutIdle(page);
    await focusEditor(page);

    const before = await getDocumentSnapshot(page);

    await openToolbarMenu(page, auditCase.menu);
    await clickToolbarAction(page, auditCase.action);
    await submitVisibleToolbarDialog(page);
    await waitForLayoutIdle(page);

    const after = await getDocumentSnapshot(page);
    expect(
      auditCase.expectResult(before, after),
      `${auditCase.action} should produce an observable document change`,
    ).toBeTruthy();

    guards.assertClean();
  });
}
