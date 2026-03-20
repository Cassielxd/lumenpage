import { expect, test } from "@playwright/test";
import {
  attachConsoleGuards,
  clickToolbarAction,
  fillVisibleToolbarDialog,
  focusEditor,
  forceEditorRender,
  getDocumentSnapshot,
  getEditorLocators,
  getLayoutBoxSummaryByBlockId,
  getLayoutBoxViewportRectByBlockId,
  getOverlayRect,
  openToolbarMenu,
  getParagraphDocPos,
  setTextSelection,
  setDocumentJson,
  waitForLayoutIdle,
  waitForPageCount,
} from "./helpers";

const buildParagraph = (id: string, text: string) => ({
  type: "paragraph",
  attrs: { id },
  content: [{ type: "text", text }],
});

const fillerParagraphs = Array.from({ length: 8 }, (_, index) =>
  buildParagraph(
    `diagram-filler-${index + 1}`,
    `Diagram filler paragraph ${index + 1}. ` +
      "This paragraph intentionally fills the current page before the diagram block. ".repeat(8),
  ),
);

test("diagram embed panel keeps its DOM overlay after moving to the next page", async ({ page }) => {
  const guards = attachConsoleGuards(page);

  await page.goto("/", { waitUntil: "networkidle" });
  await setDocumentJson(page, {
    type: "doc",
    content: [
      ...fillerParagraphs,
      {
        type: "embedPanel",
        attrs: {
          id: "diagram-pagination-case",
          kind: "diagram",
          title: "Diagram",
          source: "flowchart LR\nA[Start] --> B{Decision}\nB -->|Yes| C[Ship]\nB -->|No| D[Stop]",
          width: 680,
          height: 300,
        },
      },
      buildParagraph("after-diagram", "Paragraph after diagram embed"),
    ],
  });
  await waitForLayoutIdle(page);
  await waitForPageCount(page, 2);

  const box = await getLayoutBoxSummaryByBlockId(page, "diagram-pagination-case");
  expect(box).not.toBeNull();
  expect(box?.pageIndex ?? 0).toBeGreaterThanOrEqual(1);

  await page.evaluate((targetBlockId) => {
    const globalView = (globalThis as typeof globalThis & { __lumenView?: unknown }).__lumenView;
    const app = document.querySelector("#app") as
      | (Element & {
          __vue_app__?: {
            _instance?: {
              setupState?: Record<string, unknown>;
            };
          };
        })
      | null;
    const view = (globalView ?? app?.__vue_app__?._instance?.setupState?.view) as
      | {
          _internals?: {
            dom?: { scrollArea?: HTMLElement };
            getLayout?: () => {
              pageHeight?: number;
              pageGap?: number;
              pages?: Array<{
                boxes?: Array<Record<string, unknown>>;
              }>;
            };
          };
        }
      | undefined;
    const layout = view?._internals?.getLayout?.();
    const scrollArea = view?._internals?.dom?.scrollArea;
    if (!layout || !scrollArea || !Array.isArray(layout.pages)) {
      return;
    }
    const matchBox = (boxes: Array<Record<string, unknown>> | undefined): Record<string, unknown> | null => {
      if (!Array.isArray(boxes)) {
        return null;
      }
      for (const box of boxes) {
        if (
          String(box?.blockId ?? "") === String(targetBlockId) ||
          String(box?.nodeId ?? "") === String(targetBlockId)
        ) {
          return box;
        }
        const childMatch = matchBox(
          Array.isArray(box?.children)
            ? box.children.filter(
                (value): value is Record<string, unknown> => !!value && typeof value === "object",
              )
            : [],
        );
        if (childMatch) {
          return childMatch;
        }
      }
      return null;
    };
    const pageIndex = layout.pages.findIndex((page) => !!matchBox(page?.boxes as Array<Record<string, unknown>>));
    if (pageIndex < 0) {
      return;
    }
    const box = matchBox(layout.pages[pageIndex]?.boxes as Array<Record<string, unknown>>);
    if (!box) {
      return;
    }
    const pageSpan = Number(layout.pageHeight || 0) + Number(layout.pageGap || 0);
    const targetTop = pageIndex * pageSpan + Math.max(0, Number(box.y || 0) - 48);
    scrollArea.scrollTop = Math.max(0, targetTop);
  }, "diagram-pagination-case");
  await waitForLayoutIdle(page);
  await forceEditorRender(page);

  const overlayRect = await expect
    .poll(async () => {
      const rect = await getOverlayRect(page, ".lumenpage-embed-panel-overlay");
      if (!rect || rect.display === "none" || rect.visibility === "hidden") {
        return null;
      }
      if (!(rect.width > 0) || !(rect.height > 60)) {
        return null;
      }
      return rect;
    })
    .not.toBeNull();

  const nodeRect = await getLayoutBoxViewportRectByBlockId(page, "diagram-pagination-case");
  const nextRect = await getLayoutBoxViewportRectByBlockId(page, "after-diagram");
  const visibleOverlayRect = await getOverlayRect(page, ".lumenpage-embed-panel-overlay");

  expect(nodeRect).not.toBeNull();
  expect(nextRect).not.toBeNull();
  expect(visibleOverlayRect).not.toBeNull();

  expect(Math.abs((visibleOverlayRect?.x ?? 0) - (nodeRect?.x ?? 0))).toBeLessThan(8);
  expect(Math.abs((visibleOverlayRect?.y ?? 0) - (nodeRect?.y ?? 0))).toBeLessThan(8);
  expect(Math.abs((visibleOverlayRect?.width ?? 0) - (nodeRect?.width ?? 0))).toBeLessThan(8);
  expect(Math.abs((visibleOverlayRect?.height ?? 0) - (nodeRect?.height ?? 0))).toBeLessThan(8);

  if (nodeRect && nextRect && nodeRect.pageIndex === nextRect.pageIndex) {
    expect(nodeRect.y + nodeRect.height).toBeLessThanOrEqual(nextRect.y + 2);
  }

  guards.assertClean();
});

test("diagram embed panel keeps its DOM overlay when editing pushes it onto the next page", async ({
  page,
}) => {
  const guards = attachConsoleGuards(page);

  await page.goto("/", { waitUntil: "networkidle" });
  await setDocumentJson(page, {
    type: "doc",
    content: [
      ...fillerParagraphs.slice(0, 2),
      {
        type: "embedPanel",
        attrs: {
          id: "diagram-shift-case",
          kind: "diagram",
          title: "Diagram",
          source:
            "flowchart LR\nA[Collect] --> B[Check]\nB -->|Yes| C[Approve]\nB -->|No| D[Reject]",
          width: 680,
          height: 300,
        },
      },
      buildParagraph("after-shift-diagram", "Paragraph after shifted diagram embed"),
    ],
  });
  await waitForLayoutIdle(page);

  const initialBox = await getLayoutBoxSummaryByBlockId(page, "diagram-shift-case");
  expect(initialBox).not.toBeNull();
  expect(initialBox?.pageIndex ?? 0).toBe(0);

  const editPos = await getParagraphDocPos(page, 1, 9999);
  expect(editPos).not.toBeNull();
  await setTextSelection(page, editPos!, editPos!);
  await getEditorLocators(page).input.focus();

  for (let index = 0; index < 5; index += 1) {
    await page.keyboard.press("Enter");
    await page.keyboard.insertText(
      `Push diagram block ${index + 1}. ` +
        "This inserted paragraph should force the diagram onto the next page. ".repeat(8),
    );
  }

  await waitForLayoutIdle(page);
  await waitForPageCount(page, 2);

  await expect
    .poll(async () => (await getLayoutBoxSummaryByBlockId(page, "diagram-shift-case"))?.pageIndex ?? -1, {
      timeout: 15000,
    })
    .toBeGreaterThanOrEqual(1);

  await page.evaluate((targetBlockId) => {
    const globalView = (globalThis as typeof globalThis & { __lumenView?: unknown }).__lumenView;
    const app = document.querySelector("#app") as
      | (Element & {
          __vue_app__?: {
            _instance?: {
              setupState?: Record<string, unknown>;
            };
          };
        })
      | null;
    const view = (globalView ?? app?.__vue_app__?._instance?.setupState?.view) as
      | {
          _internals?: {
            dom?: { scrollArea?: HTMLElement };
            getLayout?: () => {
              pageHeight?: number;
              pageGap?: number;
              pages?: Array<{
                boxes?: Array<Record<string, unknown>>;
              }>;
            };
          };
        }
      | undefined;
    const layout = view?._internals?.getLayout?.();
    const scrollArea = view?._internals?.dom?.scrollArea;
    if (!layout || !scrollArea || !Array.isArray(layout.pages)) {
      return;
    }
    const matchBox = (boxes: Array<Record<string, unknown>> | undefined): Record<string, unknown> | null => {
      if (!Array.isArray(boxes)) {
        return null;
      }
      for (const box of boxes) {
        if (
          String(box?.blockId ?? "") === String(targetBlockId) ||
          String(box?.nodeId ?? "") === String(targetBlockId)
        ) {
          return box;
        }
        const childMatch = matchBox(
          Array.isArray(box?.children)
            ? box.children.filter(
                (value): value is Record<string, unknown> => !!value && typeof value === "object",
              )
            : [],
        );
        if (childMatch) {
          return childMatch;
        }
      }
      return null;
    };
    const pageIndex = layout.pages.findIndex((page) => !!matchBox(page?.boxes as Array<Record<string, unknown>>));
    if (pageIndex < 0) {
      return;
    }
    const box = matchBox(layout.pages[pageIndex]?.boxes as Array<Record<string, unknown>>);
    if (!box) {
      return;
    }
    const pageSpan = Number(layout.pageHeight || 0) + Number(layout.pageGap || 0);
    const targetTop = pageIndex * pageSpan + Math.max(0, Number(box.y || 0) - 48);
    scrollArea.scrollTop = Math.max(0, targetTop);
  }, "diagram-shift-case");
  await waitForLayoutIdle(page);
  await forceEditorRender(page);

  await expect
    .poll(async () => {
      const rect = await getOverlayRect(page, ".lumenpage-embed-panel-overlay");
      if (!rect || rect.display === "none" || rect.visibility === "hidden") {
        return null;
      }
      if (!(rect.width > 0) || !(rect.height > 60)) {
        return null;
      }
      return rect;
    })
    .not.toBeNull();

  const nodeRect = await getLayoutBoxViewportRectByBlockId(page, "diagram-shift-case");
  const nextRect = await getLayoutBoxViewportRectByBlockId(page, "after-shift-diagram");
  const overlayRect = await getOverlayRect(page, ".lumenpage-embed-panel-overlay");

  expect(nodeRect).not.toBeNull();
  expect(nextRect).not.toBeNull();
  expect(overlayRect).not.toBeNull();
  expect(Math.abs((overlayRect?.y ?? 0) - (nodeRect?.y ?? 0))).toBeLessThan(8);
  expect(Math.abs((overlayRect?.height ?? 0) - (nodeRect?.height ?? 0))).toBeLessThan(8);

  if (nodeRect && nextRect && nodeRect.pageIndex === nextRect.pageIndex) {
    expect(nodeRect.y + nodeRect.height).toBeLessThanOrEqual(nextRect.y + 2);
  }

  guards.assertClean();
});

test("toolbar-inserted diagram keeps its DOM overlay when later editing pushes it onto the next page", async ({
  page,
}) => {
  const guards = attachConsoleGuards(page);

  await page.goto("/", { waitUntil: "networkidle" });
  await setDocumentJson(page, {
    type: "doc",
    content: fillerParagraphs.slice(0, 2),
  });
  await waitForLayoutIdle(page);

  const insertPos = await getParagraphDocPos(page, 1, 9999);
  expect(insertPos).not.toBeNull();
  await setTextSelection(page, insertPos!, insertPos!);
  await focusEditor(page);

  await openToolbarMenu(page, "tools");
  await clickToolbarAction(page, "diagrams");
  await fillVisibleToolbarDialog(page);
  await waitForLayoutIdle(page);

  const snapshot = await getDocumentSnapshot(page);
  const embedNode = (snapshot.json as { content?: Array<{ type?: string; attrs?: Record<string, unknown> }> } | null)
    ?.content?.find((node) => node?.type === "embedPanel");
  const blockId = String(embedNode?.attrs?.id || "");
  expect(blockId).not.toBe("");

  const initialBox = await getLayoutBoxSummaryByBlockId(page, blockId);
  expect(initialBox).not.toBeNull();
  expect(initialBox?.pageIndex ?? 0).toBe(0);

  const editPos = await page.evaluate((targetBlockId) => {
    const globalView = (globalThis as typeof globalThis & { __lumenView?: unknown }).__lumenView;
    const app = document.querySelector("#app") as
      | (Element & {
          __vue_app__?: {
            _instance?: {
              setupState?: Record<string, unknown>;
            };
          };
        })
      | null;
    const view = (globalView ?? app?.__vue_app__?._instance?.setupState?.view) as
      | {
          state?: {
            doc?: {
              descendants?: (
                fn: (node: { attrs?: Record<string, unknown>; content?: { size?: number } }, pos: number) => void
              ) => void;
            };
          };
        }
      | undefined;
    const doc = view?.state?.doc;
    if (!doc?.descendants) {
      return null;
    }
    let foundPos: number | null = null;
    doc.descendants((node, pos) => {
      if (foundPos != null) {
        return;
      }
      if (String(node?.attrs?.id ?? "") !== String(targetBlockId)) {
        return;
      }
      const size = Number(node?.content?.size) || 0;
      foundPos = pos + 1 + size;
    });
    return foundPos;
  }, "diagram-filler-1");
  expect(editPos).not.toBeNull();
  await setTextSelection(page, editPos!, editPos!);
  await getEditorLocators(page).input.focus();

  for (let index = 0; index < 5; index += 1) {
    await page.keyboard.press("Enter");
    await page.keyboard.insertText(
      `Push toolbar diagram ${index + 1}. ` +
        "This inserted paragraph should force the diagram onto the next page. ".repeat(8),
    );
  }

  await waitForLayoutIdle(page);
  await waitForPageCount(page, 2);

  await expect
    .poll(async () => (await getLayoutBoxSummaryByBlockId(page, blockId))?.pageIndex ?? -1, {
      timeout: 15000,
    })
    .toBeGreaterThanOrEqual(1);

  await page.evaluate((targetBlockId) => {
    const globalView = (globalThis as typeof globalThis & { __lumenView?: unknown }).__lumenView;
    const app = document.querySelector("#app") as
      | (Element & {
          __vue_app__?: {
            _instance?: {
              setupState?: Record<string, unknown>;
            };
          };
        })
      | null;
    const view = (globalView ?? app?.__vue_app__?._instance?.setupState?.view) as
      | {
          _internals?: {
            dom?: { scrollArea?: HTMLElement };
            getLayout?: () => {
              pageHeight?: number;
              pageGap?: number;
              pages?: Array<{
                boxes?: Array<Record<string, unknown>>;
              }>;
            };
          };
        }
      | undefined;
    const layout = view?._internals?.getLayout?.();
    const scrollArea = view?._internals?.dom?.scrollArea;
    if (!layout || !scrollArea || !Array.isArray(layout.pages)) {
      return;
    }
    const matchBox = (boxes: Array<Record<string, unknown>> | undefined): Record<string, unknown> | null => {
      if (!Array.isArray(boxes)) {
        return null;
      }
      for (const box of boxes) {
        if (
          String(box?.blockId ?? "") === String(targetBlockId) ||
          String(box?.nodeId ?? "") === String(targetBlockId)
        ) {
          return box;
        }
        const childMatch = matchBox(
          Array.isArray(box?.children)
            ? box.children.filter(
                (value): value is Record<string, unknown> => !!value && typeof value === "object",
              )
            : [],
        );
        if (childMatch) {
          return childMatch;
        }
      }
      return null;
    };
    const pageIndex = layout.pages.findIndex((pageState) =>
      !!matchBox(pageState?.boxes as Array<Record<string, unknown>>),
    );
    if (pageIndex < 0) {
      return;
    }
    const box = matchBox(layout.pages[pageIndex]?.boxes as Array<Record<string, unknown>>);
    if (!box) {
      return;
    }
    const pageSpan = Number(layout.pageHeight || 0) + Number(layout.pageGap || 0);
    const targetTop = pageIndex * pageSpan + Math.max(0, Number(box.y || 0) - 48);
    scrollArea.scrollTop = Math.max(0, targetTop);
  }, blockId);
  await waitForLayoutIdle(page);
  await forceEditorRender(page);

  await expect
    .poll(async () => {
      const rect = await getOverlayRect(page, ".lumenpage-embed-panel-overlay");
      if (!rect || rect.display === "none" || rect.visibility === "hidden") {
        return null;
      }
      if (!(rect.width > 0) || !(rect.height > 60)) {
        return null;
      }
      return rect;
    })
    .not.toBeNull();

  const nodeRect = await getLayoutBoxViewportRectByBlockId(page, blockId);
  const overlayRect = await getOverlayRect(page, ".lumenpage-embed-panel-overlay");
  expect(nodeRect).not.toBeNull();
  expect(overlayRect).not.toBeNull();
  expect(Math.abs((overlayRect?.y ?? 0) - (nodeRect?.y ?? 0))).toBeLessThan(8);
  expect(Math.abs((overlayRect?.height ?? 0) - (nodeRect?.height ?? 0))).toBeLessThan(8);

  guards.assertClean();
});
