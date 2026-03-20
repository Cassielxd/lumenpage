import { expect, test } from "@playwright/test";
import {
  attachConsoleGuards,
  clickToolbarAction,
  fillVisibleToolbarDialog,
  forceEditorRender,
  getCaretRect,
  getCoordsAtDocPos,
  getEditorLocators,
  getDocumentSnapshot,
  getNodeAttrsByBlockId,
  getLayoutBoxSummariesByBlockId,
  getLayoutBoxSummaryByBlockId,
  getLayoutBoxViewportRectByBlockId,
  getLayoutFragmentSummaries,
  getLayoutLineContinuationSummaries,
  getOverlayRect,
  probeOverlayCanvasPixel,
  getParagraphDocPos,
  probePageSurfaceRegionByBlockId,
  openToolbarMenu,
  setDocumentJson,
  setTextSelection,
  waitForLayoutIdle,
  waitForPageCount,
} from "./helpers";

const buildTallRowText = (label: string) =>
  Array.from({ length: 12 }, () => `${label} content stretches table pagination cleanly.`).join(" ");

const buildParagraph = (id: string, text: string) => ({
  type: "paragraph",
  attrs: { id },
  content: [{ type: "text", text }],
});

const DATA_URL_SQUARE_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">' +
      '<rect width="320" height="320" fill="#e5e7eb"/>' +
      '<rect x="24" y="24" width="272" height="272" fill="#111827"/>' +
      '<rect x="56" y="56" width="208" height="208" fill="#f9fafb"/>' +
      "</svg>",
  );

const findLastNodeAttrsByType = (value: unknown, targetType: string): Record<string, unknown> | null => {
  let matched: Record<string, unknown> | null = null;
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") {
      return;
    }
    const record = node as {
      type?: string;
      attrs?: Record<string, unknown>;
      content?: unknown[];
    };
    if (record.type === targetType) {
      matched = { ...(record.attrs || {}) };
    }
    if (Array.isArray(record.content)) {
      for (const child of record.content) {
        visit(child);
      }
    }
  };
  visit(value);
  return matched;
};

const isBlueOutlinePixel = (pixel: number[] | null) => {
  if (!Array.isArray(pixel) || pixel.length < 4) {
    return false;
  }
  const [r, g, b, a] = pixel;
  return a > 0 && b >= 180 && g >= 90 && r <= 120;
};

const scrollBlockIntoView = async (page: Parameters<typeof getLayoutBoxSummaryByBlockId>[0], blockId: string) => {
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

    const matchBox = (
      boxes: Array<Record<string, unknown>> | undefined,
    ): Record<string, unknown> | null => {
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
};

const inspectBlock = async (page: Parameters<typeof getLayoutBoxSummaryByBlockId>[0], blockId: string) =>
  page.evaluate((targetBlockId) => {
    const debugWindow = window as Window & {
      __inspectLumenBlock?: ((value: string) => Record<string, unknown> | null) | null;
    };
    return debugWindow.__inspectLumenBlock?.(targetBlockId) ?? null;
  }, blockId);

const listOverlayEntriesByBlockId = async (
  page: Parameters<typeof getLayoutBoxSummaryByBlockId>[0],
  blockId: string,
) =>
  page.evaluate((targetBlockId) => {
    const debugWindow = window as Window & {
      __listLumenNodeOverlays?: (() => Array<Record<string, unknown>>) | null;
    };
    const overlays = debugWindow.__listLumenNodeOverlays?.() ?? [];
    return overlays.filter((entry) => String(entry.blockId ?? "") === String(targetBlockId));
  }, blockId);

const buildTableRow = (text: string) => ({
  type: "tableRow",
  content: [
    {
      type: "tableCell",
      content: [buildParagraph(`cell-${text}`, text)],
    },
  ],
});

const buildTallTableDoc = () => ({
  type: "doc",
  content: [
    buildParagraph(
      "table-preface-1",
      "Preface paragraph before paginated table. ".repeat(18),
    ),
    buildParagraph(
      "table-preface-2",
      "Another preface paragraph to keep the table near the current page boundary. ".repeat(12),
    ),
    {
      type: "table",
      attrs: { id: "table-split-case" },
      content: [
        buildTableRow(buildTallRowText("Row 1")),
        buildTableRow(buildTallRowText("Row 2")),
        buildTableRow(buildTallRowText("Row 3")),
      ],
    },
    buildParagraph("after-table", "Paragraph after paginated table"),
  ],
});

const buildSingleRowOverflowTableDoc = (repeatCount = 220) => ({
  type: "doc",
  content: [
    {
      type: "table",
      attrs: { id: "table-single-row-overflow-case" },
      content: [
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              content: [
                buildParagraph(
                  "table-single-row-overflow-cell",
                  Array.from(
                    { length: repeatCount },
                    (_, index) =>
                      `Single row overflow segment ${index + 1}. This content should keep splitting inside the same table row across multiple pages.`,
                  ).join(" "),
                ),
              ],
            },
          ],
        },
      ],
    },
  ],
});

const buildSingleRowMultiParagraphTableDoc = (paragraphCount = 1, repeatCount = 3) => ({
  type: "doc",
  content: [
    {
      type: "table",
      attrs: { id: "table-single-row-multi-paragraph-case" },
      content: [
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              content: Array.from({ length: paragraphCount }, (_, index) =>
                buildParagraph(
                  `table-single-row-multi-paragraph-${index + 1}`,
                  Array.from(
                    { length: repeatCount },
                    (_, repeatIndex) =>
                      `Multi paragraph row segment ${index + 1}-${repeatIndex + 1}. This paragraph should stay inside the same table row while pagination keeps splitting that row across pages.`,
                  ).join(" "),
                ),
              ),
            },
          ],
        },
      ],
    },
  ],
});

const buildSingleRowTwoCellMultiParagraphTableDoc = () => ({
  type: "doc",
  content: [
    {
      type: "table",
      attrs: { id: "table-two-cell-caret-case" },
      content: [
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              attrs: { id: "table-two-cell-caret-cell-a" },
              content: [buildParagraph("table-two-cell-caret-paragraph-a", "A1 seed")],
            },
            {
              type: "tableCell",
              attrs: { id: "table-two-cell-caret-cell-b" },
              content: [buildParagraph("table-two-cell-caret-paragraph-b", "B1 stable")],
            },
          ],
        },
      ],
    },
  ],
});

const buildNestedTableOverflowDoc = (repeatCount = 160) => ({
  type: "doc",
  content: [
    {
      type: "table",
      attrs: { id: "outer-nested-table-case" },
      content: [
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              content: [
                {
                  type: "table",
                  attrs: { id: "inner-nested-table-case" },
                  content: [
                    {
                      type: "tableRow",
                      content: [
                        {
                          type: "tableCell",
                          content: [
                            buildParagraph(
                              "inner-nested-table-cell",
                              Array.from(
                                { length: repeatCount },
                                (_, index) =>
                                  `Nested table segment ${index + 1}. This inner table should keep paginating inside the outer table cell without duplicating stale slices.`,
                              ).join(" "),
                            ),
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
});

const buildMergedSpanOverflowDoc = (repeatCount = 120) => ({
  type: "doc",
  content: [
    buildParagraph(
      "merged-span-preface",
      "Preface paragraph before merged span pagination case. ".repeat(18),
    ),
    {
      type: "table",
      attrs: { id: "table-merged-span-case" },
      content: [
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              attrs: { colspan: 2, rowspan: 2, background: "#fef3c7" },
              content: [
                buildParagraph(
                  "merged-span-primary",
                  Array.from(
                    { length: repeatCount },
                    (_, index) =>
                      `Merged span segment ${index + 1}. This rowspan and colspan cell should keep paginating cleanly across multiple pages without losing downstream rows.`,
                  ).join(" "),
                ),
                buildParagraph(
                  "merged-span-secondary",
                  "Continuation paragraph inside merged span cell. ".repeat(40),
                ),
              ],
            },
            {
              type: "tableCell",
              content: [
                buildParagraph(
                  "merged-span-side-top",
                  "Top side cell content should stay visible while the merged cell stretches. ".repeat(16),
                ),
              ],
            },
          ],
        },
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              content: [
                buildParagraph(
                  "merged-span-side-bottom",
                  "Second-row side cell should remain reachable after merged span pagination. ".repeat(16),
                ),
              ],
            },
          ],
        },
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              content: [buildParagraph("merged-span-row3-a", "Row 3 column A remains after the span.")],
            },
            {
              type: "tableCell",
              content: [buildParagraph("merged-span-row3-b", "Row 3 column B remains after the span.")],
            },
            {
              type: "tableCell",
              content: [buildParagraph("merged-span-row3-c", "Row 3 column C remains after the span.")],
            },
          ],
        },
      ],
    },
    buildParagraph("after-merged-span-table", "Paragraph after merged span table"),
  ],
});

const buildTallCodeBlockDoc = (repeatCount = 220) => ({
  type: "doc",
  content: [
    {
      type: "codeBlock",
      attrs: { id: "code-block-pagination-case" },
      content: [
        {
          type: "text",
          text: Array.from(
            { length: repeatCount },
            (_, index) => `const line${index + 1} = "Code block visual line ${index + 1}";`,
          ).join("\n"),
        },
      ],
    },
  ],
});

const getSelectionTableCellInfo = async (page: Parameters<typeof getLayoutBoxSummaryByBlockId>[0]) =>
  page.evaluate(() => {
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
              resolve?: (pos: number) => {
                depth: number;
                node: (depth: number) => { type?: { name?: string }; attrs?: Record<string, unknown> } | null;
                before: (depth: number) => number;
                start: (depth: number) => number;
              };
            };
            selection?: {
              from: number;
              to: number;
              head: number;
              anchor: number;
            };
          };
        }
      | undefined;
    const head = Number(view?.state?.selection?.head);
    const doc = view?.state?.doc;
    if (!Number.isFinite(head) || !doc?.resolve) {
      return null;
    }
    const $head = doc.resolve(head);
    for (let depth = $head.depth; depth >= 0; depth -= 1) {
      const node = $head.node(depth);
      const typeName = String(node?.type?.name || "");
      if (typeName !== "tableCell" && typeName !== "tableHeader") {
        continue;
      }
      const rowDepth = depth - 1;
      const row = rowDepth >= 0 ? $head.node(rowDepth) : null;
      let colIndex = 0;
      if (row?.type?.name === "tableRow") {
        const targetBefore = $head.before(depth);
        let offset = 0;
        for (let index = 0; index < row.childCount; index += 1) {
          const child = row.child(index);
          const childPos = $head.start(rowDepth) + offset;
          if (childPos === targetBefore) {
            colIndex = index;
            break;
          }
          offset += child.nodeSize;
        }
      }
      return {
        head,
        from: Number(view?.state?.selection?.from),
        to: Number(view?.state?.selection?.to),
        cellType: typeName,
        cellId: String(node?.attrs?.id ?? ""),
        colIndex,
      };
    }
    return {
      head,
      from: Number(view?.state?.selection?.from),
      to: Number(view?.state?.selection?.to),
      cellType: null,
      cellId: "",
      colIndex: -1,
    };
  });

const fillerParagraphs = Array.from({ length: 8 }, (_, index) =>
  buildParagraph(
    `filler-${index + 1}`,
    `Filler paragraph ${index + 1}. ` +
      "This text intentionally fills the current page before a visual block is inserted. ".repeat(8),
  ),
);

const visualCases = [
  {
    name: "qr image block moves as a whole across pages",
    type: "image",
    nodeId: "qr-pagination-case",
    nextId: "after-qr",
    overlaySelector: ".lumenpage-image-overlay",
    doc: {
      type: "doc",
      content: [
        ...fillerParagraphs,
        {
          type: "image",
          attrs: {
            id: "qr-pagination-case",
            src: "https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=codex",
            alt: "QR: codex",
            width: 320,
            height: 320,
          },
        },
        buildParagraph("after-qr", "Paragraph after qr image"),
      ],
    },
  },
  {
    name: "barcode image block moves as a whole across pages",
    type: "image",
    nodeId: "barcode-pagination-case",
    nextId: "after-barcode",
    overlaySelector: ".lumenpage-image-overlay",
    doc: {
      type: "doc",
      content: [
        ...fillerParagraphs,
        {
          type: "image",
          attrs: {
            id: "barcode-pagination-case",
            src: "https://bwipjs-api.metafloor.com/?bcid=code128&text=1234567890",
            alt: "BARCODE: 1234567890",
            width: 360,
            height: 180,
          },
        },
        buildParagraph("after-barcode", "Paragraph after barcode image"),
      ],
    },
  },
  {
    name: "echarts embed panel stays above following paragraph after pagination",
    type: "embedPanel",
    nodeId: "echarts-pagination-case",
    nextId: "after-echarts",
    overlaySelector: ".lumenpage-embed-panel-overlay",
    doc: {
      type: "doc",
      content: [
        ...fillerParagraphs,
        {
          type: "embedPanel",
          attrs: {
            id: "echarts-pagination-case",
            kind: "echarts",
            title: "ECharts",
            source: '{"xAxis":{"type":"category","data":["A","B","C"]},"yAxis":{"type":"value"},"series":[{"type":"bar","data":[3,6,9]}]}',
            width: 680,
            height: 360,
          },
        },
        buildParagraph("after-echarts", "Paragraph after echarts embed"),
      ],
    },
  },
  {
    name: "mind map embed panel stays above following paragraph after pagination",
    type: "embedPanel",
    nodeId: "mindmap-pagination-case",
    nextId: "after-mindmap",
    overlaySelector: ".lumenpage-embed-panel-overlay",
    doc: {
      type: "doc",
      content: [
        ...fillerParagraphs,
        {
          type: "embedPanel",
          attrs: {
            id: "mindmap-pagination-case",
            kind: "mindMap",
            title: "Mind Map",
            source: "mindmap\n  root((Root))\n    Topic A\n    Topic B",
            width: 680,
            height: 360,
          },
        },
        buildParagraph("after-mindmap", "Paragraph after mind map embed"),
      ],
    },
  },
] as const;

test("table pagination splits rows instead of duplicating the whole table slice", async ({ page }) => {
  const guards = attachConsoleGuards(page);

  await page.goto("/", { waitUntil: "networkidle" });
  await setDocumentJson(page, buildTallTableDoc());
  await waitForLayoutIdle(page);
  await waitForPageCount(page, 2);

  const fragments = (await getLayoutFragmentSummaries(page, "table")).filter(
    (fragment) => fragment.nodeId === "table-split-case" || fragment.blockId === "table-split-case",
  );
  expect(fragments.length).toBeGreaterThanOrEqual(2);

  const [firstPageFragment, secondPageFragment] = [...fragments].sort(
    (a, b) => a.pageIndex - b.pageIndex,
  );
  expect(firstPageFragment).not.toBeUndefined();
  expect(secondPageFragment).not.toBeUndefined();
  expect(firstPageFragment?.carryStateKind).toBe("table");
  expect(secondPageFragment?.carryStateKind).toBe("table");
  expect(firstPageFragment?.carryState?.firstRowIndex).toBe(0);
  expect(firstPageFragment?.carryState?.lastRowIndex).toBe(1);
  expect(secondPageFragment?.carryState?.firstRowIndex).toBe(2);
  expect(secondPageFragment?.carryState?.lastRowIndex).toBe(2);
  expect(firstPageFragment?.hasNext).toBeTruthy();
  expect(secondPageFragment?.fromPrev).toBeTruthy();
  expect(firstPageFragment?.rowSplit).toBeFalsy();
  expect(secondPageFragment?.rowSplit).toBeFalsy();

  const tableLines = (await getLayoutLineContinuationSummaries(page)).filter(
    (line) => line.fragmentIdentity === firstPageFragment?.fragmentIdentity,
  );
  const firstFragmentRows = [
    ...new Set(
      tableLines
        .filter((line) => line.pageIndex === firstPageFragment?.pageIndex)
        .map((line) => line.rowIndex),
    ),
  ];
  const secondFragmentRows = [
    ...new Set(
      tableLines
        .filter((line) => line.pageIndex === secondPageFragment?.pageIndex)
        .map((line) => line.rowIndex),
    ),
  ];
  expect(firstFragmentRows).toEqual([0, 1]);
  expect(secondFragmentRows).toEqual([2]);

  const nextParagraph = await getLayoutBoxSummaryByBlockId(page, "after-table");
  expect(nextParagraph).not.toBeNull();
  if (nextParagraph && secondPageFragment && nextParagraph.pageIndex === secondPageFragment.pageIndex) {
    expect(secondPageFragment.y + secondPageFragment.height).toBeLessThanOrEqual(nextParagraph.y + 2);
  }

  guards.assertClean();
});

test("single table row can keep splitting across 1-N pages as cell content grows", async ({
  page,
}) => {
  const guards = attachConsoleGuards(page);

  await page.goto("/", { waitUntil: "networkidle" });
  await setDocumentJson(page, buildSingleRowOverflowTableDoc());
  await waitForLayoutIdle(page);
  await waitForPageCount(page, 3);

  const fragments = (await getLayoutFragmentSummaries(page, "table"))
    .filter(
      (fragment) =>
        fragment.nodeId === "table-single-row-overflow-case" ||
        fragment.blockId === "table-single-row-overflow-case",
    )
    .sort((a, b) => a.pageIndex - b.pageIndex);
  expect(fragments.length).toBeGreaterThanOrEqual(3);
  expect(new Set(fragments.map((fragment) => fragment.pageIndex)).size).toBeGreaterThanOrEqual(3);

  for (const fragment of fragments) {
    expect(fragment.carryStateKind).toBe("table");
    expect(fragment.carryState?.firstRowIndex).toBe(0);
    expect(fragment.carryState?.lastRowIndex).toBe(0);
    expect(fragment.rowSplit).toBeTruthy();
  }

  expect(fragments[0]?.fromPrev).toBeFalsy();
  expect(fragments[0]?.hasNext).toBeTruthy();
  expect(fragments[fragments.length - 1]?.fromPrev).toBeTruthy();
  expect(fragments[fragments.length - 1]?.hasNext).toBeFalsy();

  const tableLines = (await getLayoutLineContinuationSummaries(page)).filter(
    (line) =>
      line.blockId === "table-single-row-overflow-case" || line.fragmentIdentity === fragments[0]?.fragmentIdentity,
  );
  const pagesForRowZero = [
    ...new Set(
      tableLines.filter((line) => Number(line.rowIndex) === 0).map((line) => Number(line.pageIndex)),
    ),
  ];
  expect(pagesForRowZero.length).toBeGreaterThanOrEqual(3);
  expect(tableLines.every((line) => Number(line.rowIndex) === 0)).toBeTruthy();

  guards.assertClean();
});

test("single table row keeps splitting correctly while typing expands it from 1 page to N pages", async ({
  page,
}) => {
  const guards = attachConsoleGuards(page);

  await page.goto("/", { waitUntil: "networkidle" });
  await setDocumentJson(page, buildSingleRowOverflowTableDoc(18));
  await waitForLayoutIdle(page);

  const editPos = await getParagraphDocPos(page, 0, 9999);
  expect(editPos).not.toBeNull();
  await setTextSelection(page, Number(editPos), Number(editPos));
  await getEditorLocators(page).input.focus();

  let reachedMultiPage = false;
  for (let index = 0; index < 36; index += 1) {
    await page.keyboard.insertText(
      ` Typing growth segment ${index + 1}.` +
        " This should keep increasing a single table row height across more pages.".repeat(6),
    );
    await waitForLayoutIdle(page);
    const pagination = await page.evaluate(() => {
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
            getPaginationInfo?: () => { pageCount?: number } | null;
          }
        | undefined;
      return Number(view?.getPaginationInfo?.()?.pageCount ?? 0);
    });
    if (pagination >= 4) {
      reachedMultiPage = true;
      break;
    }
  }

  expect(reachedMultiPage).toBeTruthy();
  await waitForPageCount(page, 4);

  const fragments = (await getLayoutFragmentSummaries(page, "table"))
    .filter(
      (fragment) =>
        fragment.nodeId === "table-single-row-overflow-case" ||
        fragment.blockId === "table-single-row-overflow-case",
    )
    .sort((a, b) => a.pageIndex - b.pageIndex);
  expect(fragments.length).toBeGreaterThanOrEqual(4);
  expect(new Set(fragments.map((fragment) => fragment.pageIndex)).size).toBeGreaterThanOrEqual(4);
  expect(fragments.every((fragment) => fragment.rowSplit === true)).toBeTruthy();
  expect(
    fragments.every(
      (fragment) =>
        fragment.carryState?.firstRowIndex === 0 && fragment.carryState?.lastRowIndex === 0,
    ),
  ).toBeTruthy();

  const tableLines = (await getLayoutLineContinuationSummaries(page)).filter(
    (line) =>
      line.blockId === "table-single-row-overflow-case" || line.fragmentIdentity === fragments[0]?.fragmentIdentity,
  );
  expect(tableLines.length).toBeGreaterThan(0);
  expect(tableLines.every((line) => Number(line.rowIndex) === 0)).toBeTruthy();
  expect(new Set(tableLines.map((line) => Number(line.pageIndex))).size).toBeGreaterThanOrEqual(4);

  guards.assertClean();
});

test("single table row keeps splitting correctly when enter creates multiple paragraphs inside one cell", async ({
  page,
}) => {
  const guards = attachConsoleGuards(page);

  await page.goto("/", { waitUntil: "networkidle" });
  await setDocumentJson(page, buildSingleRowMultiParagraphTableDoc());
  await waitForLayoutIdle(page);

  const editPos = await getParagraphDocPos(page, 0, 9999);
  expect(editPos).not.toBeNull();
  await setTextSelection(page, Number(editPos), Number(editPos));
  await getEditorLocators(page).input.focus();

  let reachedMultiPage = false;
  for (let index = 0; index < 36; index += 1) {
    await page.keyboard.press("Enter");
    await page.keyboard.insertText(
      `Paragraph growth ${index + 1}. ` +
        "This new paragraph should remain inside the same table row and force that single row to continue across more pages. ".repeat(
          8,
        ),
    );
    await waitForLayoutIdle(page);
    const pagination = await page.evaluate(() => {
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
            getPaginationInfo?: () => { pageCount?: number } | null;
          }
        | undefined;
      return Number(view?.getPaginationInfo?.()?.pageCount ?? 0);
    });
    if (pagination >= 4) {
      reachedMultiPage = true;
      break;
    }
  }

  expect(reachedMultiPage).toBeTruthy();
  await waitForPageCount(page, 4);

  const snapshot = await getDocumentSnapshot(page);
  expect(Number(snapshot.typeCounts?.table ?? 0)).toBe(1);
  expect(Number(snapshot.typeCounts?.tableRow ?? 0)).toBe(1);
  expect(Number(snapshot.typeCounts?.tableCell ?? 0)).toBe(1);
  expect(Number(snapshot.typeCounts?.paragraph ?? 0)).toBeGreaterThan(1);

  const fragments = (await getLayoutFragmentSummaries(page, "table"))
    .filter(
      (fragment) =>
        fragment.nodeId === "table-single-row-multi-paragraph-case" ||
        fragment.blockId === "table-single-row-multi-paragraph-case",
    )
    .sort((a, b) => a.pageIndex - b.pageIndex);
  expect(fragments.length).toBeGreaterThanOrEqual(4);
  expect(new Set(fragments.map((fragment) => fragment.pageIndex)).size).toBeGreaterThanOrEqual(4);
  expect(fragments.every((fragment) => fragment.rowSplit === true)).toBeTruthy();
  expect(
    fragments.every(
      (fragment) =>
        fragment.carryState?.firstRowIndex === 0 && fragment.carryState?.lastRowIndex === 0,
    ),
  ).toBeTruthy();

  const tableLines = (await getLayoutLineContinuationSummaries(page)).filter(
    (line) =>
      line.blockId === "table-single-row-multi-paragraph-case" ||
      line.fragmentIdentity === fragments[0]?.fragmentIdentity,
  );
  expect(tableLines.length).toBeGreaterThan(0);
  expect(tableLines.every((line) => Number(line.rowIndex) === 0)).toBeTruthy();
  expect(new Set(tableLines.map((line) => Number(line.pageIndex))).size).toBeGreaterThanOrEqual(4);

  guards.assertClean();
});

test("caret stays in the original table cell when enter keeps splitting a single row across pages", async ({
  page,
}) => {
  const guards = attachConsoleGuards(page);

  await page.goto("/", { waitUntil: "networkidle" });
  await setDocumentJson(page, buildSingleRowTwoCellMultiParagraphTableDoc());
  await waitForLayoutIdle(page);

  const editPos = await getParagraphDocPos(page, 0, 9999);
  expect(editPos).not.toBeNull();
  await setTextSelection(page, Number(editPos), Number(editPos));
  await getEditorLocators(page).input.focus();

  let reachedMultiPage = false;
  for (let index = 0; index < 48; index += 1) {
    await page.keyboard.press("Enter");
    await page.keyboard.insertText(
      `Caret growth ${index + 1}. ` +
        "This paragraph should stay in the first cell even while that one row keeps flowing across more pages. ".repeat(
          6,
        ),
    );
    await waitForLayoutIdle(page);
    const pagination = await page.evaluate(() => {
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
            getPaginationInfo?: () => { pageCount?: number } | null;
          }
        | undefined;
      return Number(view?.getPaginationInfo?.()?.pageCount ?? 0);
    });
    if (pagination >= 3) {
      reachedMultiPage = true;
      break;
    }
  }

  expect(reachedMultiPage).toBeTruthy();
  await waitForPageCount(page, 3);

  const selectionInfo = await getSelectionTableCellInfo(page);
  expect(selectionInfo).not.toBeNull();
  expect(selectionInfo?.cellType).toBe("tableCell");
  expect(selectionInfo?.cellId).toBe("table-two-cell-caret-cell-a");
  expect(selectionInfo?.colIndex).toBe(0);

  const snapshot = await getDocumentSnapshot(page);
  expect(Number(snapshot.typeCounts?.table ?? 0)).toBe(1);
  expect(Number(snapshot.typeCounts?.tableRow ?? 0)).toBe(1);
  expect(Number(snapshot.typeCounts?.tableCell ?? 0)).toBe(2);
  expect(Number(snapshot.typeCounts?.paragraph ?? 0)).toBeGreaterThan(2);

  guards.assertClean();
});

test("caret stays in the original table cell when enter creates empty paragraphs across pages", async ({
  page,
}) => {
  const guards = attachConsoleGuards(page);

  await page.goto("/", { waitUntil: "networkidle" });
  await setDocumentJson(page, buildSingleRowTwoCellMultiParagraphTableDoc());
  await waitForLayoutIdle(page);

  const editPos = await getParagraphDocPos(page, 0, 9999);
  expect(editPos).not.toBeNull();
  await setTextSelection(page, Number(editPos), Number(editPos));
  await getEditorLocators(page).input.focus();

  let reachedMultiPage = false;
  for (let index = 0; index < 140; index += 1) {
    await page.keyboard.press("Enter");
    await waitForLayoutIdle(page);
    const pagination = await page.evaluate(() => {
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
            getPaginationInfo?: () => { pageCount?: number } | null;
          }
        | undefined;
      return Number(view?.getPaginationInfo?.()?.pageCount ?? 0);
    });
    if (pagination >= 3) {
      reachedMultiPage = true;
      break;
    }
  }

  expect(reachedMultiPage).toBeTruthy();
  await waitForPageCount(page, 3);

  const selectionInfo = await getSelectionTableCellInfo(page);
  expect(selectionInfo).not.toBeNull();
  expect(selectionInfo?.cellType).toBe("tableCell");
  expect(selectionInfo?.cellId).toBe("table-two-cell-caret-cell-a");
  expect(selectionInfo?.colIndex).toBe(0);

  await page.keyboard.insertText(" FINAL-FIRST-CELL-MARKER ");
  await waitForLayoutIdle(page);

  const snapshot = await getDocumentSnapshot(page);
  expect(Number(snapshot.typeCounts?.table ?? 0)).toBe(1);
  expect(Number(snapshot.typeCounts?.tableRow ?? 0)).toBe(1);
  expect(Number(snapshot.typeCounts?.tableCell ?? 0)).toBe(2);
  expect(Number(snapshot.typeCounts?.paragraph ?? 0)).toBeGreaterThan(20);
  expect(JSON.stringify(snapshot.json)).toContain("FINAL-FIRST-CELL-MARKER");
  expect(JSON.stringify(snapshot.json)).not.toContain("B1 stable FINAL-FIRST-CELL-MARKER");

  guards.assertClean();
});

test("visual caret stays in the original table cell column after cross-page table splitting", async ({
  page,
}) => {
  const guards = attachConsoleGuards(page);

  await page.goto("/", { waitUntil: "networkidle" });
  await setDocumentJson(page, buildSingleRowTwoCellMultiParagraphTableDoc());
  await waitForLayoutIdle(page);

  const cellAEnd = await getParagraphDocPos(page, 0, 9999);
  expect(cellAEnd).not.toBeNull();
  await setTextSelection(page, Number(cellAEnd), Number(cellAEnd));
  await page.locator(".lumenpage-input").focus();

  let movedAcrossPages = false;
  for (let index = 0; index < 22; index += 1) {
    await page.keyboard.press("Enter");
    await page.keyboard.insertText(
      `VISUAL-CARET-A-${index + 1} ` +
        "This paragraph should keep the caret visually in the first table cell even while the row keeps splitting across pages. ".repeat(
          5,
        ),
    );
    await waitForLayoutIdle(page);
    const pagination = await page.evaluate(() => window.__lumenView?.getPaginationInfo?.() ?? null);
    if (Number(pagination?.pageCount ?? 0) >= 3) {
      movedAcrossPages = true;
      break;
    }
  }

  expect(movedAcrossPages).toBeTruthy();

  const selectionInfo = await getSelectionTableCellInfo(page);
  expect(selectionInfo?.cellType).toBe("tableCell");
  expect(selectionInfo?.cellId).toBe("table-two-cell-caret-cell-a");

  await getEditorLocators(page).input.focus();
  await forceEditorRender(page);
  await waitForLayoutIdle(page);

  const caretRect = await getCaretRect(page);
  const caretCoords = await getCoordsAtDocPos(page, Number(selectionInfo?.head));
  expect(caretCoords).not.toBeNull();

  const paragraphABox = await getLayoutBoxViewportRectByBlockId(page, "table-two-cell-caret-paragraph-a");
  const paragraphBBox = await getLayoutBoxViewportRectByBlockId(page, "table-two-cell-caret-paragraph-b");
  expect(paragraphABox).not.toBeNull();
  expect(paragraphBBox).not.toBeNull();

  const scanLeft = Math.floor(
    Number(caretRect?.x ?? caretCoords?.rect?.left ?? caretCoords?.x ?? 0) - 2,
  );
  const scanRight = Math.ceil(
    Number(caretRect?.x ?? caretCoords?.rect?.right ?? caretCoords?.x ?? 0) + 2,
  );
  const scanY = Number(
    caretRect != null
      ? Number(caretRect.y ?? 0) + Math.max(1, Number(caretRect.height ?? 0) / 2)
      : caretCoords?.y ?? 0,
  );

  let hasCaretPixel = false;
  for (let sampleX = scanLeft; sampleX <= scanRight; sampleX += 1) {
    const pixel = await probeOverlayCanvasPixel(page, { x: sampleX, y: scanY });
    const isDarkCaretPixel =
      Array.isArray(pixel) &&
      pixel.length >= 4 &&
      (pixel[3] ?? 0) > 0 &&
      (pixel[0] ?? 255) < 80 &&
      (pixel[1] ?? 255) < 80 &&
      (pixel[2] ?? 255) < 80;
    if (isDarkCaretPixel) {
      hasCaretPixel = true;
      break;
    }
  }
  expect(hasCaretPixel).toBeTruthy();

  const caretX = Number(caretRect?.x ?? caretCoords?.rect?.left ?? caretCoords?.x ?? 0);
  const distanceToColumnA = Math.abs(caretX - Number(paragraphABox?.x));
  const distanceToColumnB = Math.abs(caretX - Number(paragraphBBox?.x));
  expect(distanceToColumnA).toBeLessThan(distanceToColumnB);
  expect(caretX).toBeLessThan(Number(paragraphBBox?.x) - 24);

  guards.assertClean();
});

test("nested table inside a table cell keeps paginating across multiple pages", async ({ page }) => {
  const guards = attachConsoleGuards(page);

  await page.goto("/", { waitUntil: "networkidle" });
  await setDocumentJson(page, buildNestedTableOverflowDoc());
  await waitForLayoutIdle(page);
  await waitForPageCount(page, 3);

  const snapshot = await getDocumentSnapshot(page);
  expect(Number(snapshot.typeCounts?.table ?? 0)).toBe(2);
  expect(Number(snapshot.typeCounts?.tableRow ?? 0)).toBe(2);
  expect(Number(snapshot.typeCounts?.tableCell ?? 0)).toBe(2);

  const outerFragments = (await getLayoutFragmentSummaries(page, "table"))
    .filter(
      (fragment) =>
        fragment.nodeId === "outer-nested-table-case" || fragment.blockId === "outer-nested-table-case",
    )
    .sort((a, b) => a.pageIndex - b.pageIndex);
  const innerFragments = (await getLayoutFragmentSummaries(page, "table"))
    .filter(
      (fragment) =>
        fragment.nodeId === "inner-nested-table-case" || fragment.blockId === "inner-nested-table-case",
    )
    .sort((a, b) => a.pageIndex - b.pageIndex);

  expect(outerFragments.length).toBeGreaterThanOrEqual(3);
  expect(innerFragments.length).toBeGreaterThanOrEqual(3);
  expect(new Set(outerFragments.map((fragment) => fragment.pageIndex)).size).toBeGreaterThanOrEqual(3);
  expect(new Set(innerFragments.map((fragment) => fragment.pageIndex)).size).toBeGreaterThanOrEqual(3);
  expect(outerFragments.every((fragment) => fragment.rowSplit === true)).toBeTruthy();
  expect(
    outerFragments.every(
      (fragment) =>
        fragment.carryState?.firstRowIndex === 0 && fragment.carryState?.lastRowIndex === 0,
    ),
  ).toBeTruthy();
  expect(
    innerFragments.every(
      (fragment) =>
        fragment.carryStateKind === "table" &&
        fragment.carryState?.firstRowIndex === 0 &&
        fragment.carryState?.lastRowIndex === 0,
    ),
  ).toBeTruthy();

  const innerBoxes = await getLayoutBoxSummariesByBlockId(page, "inner-nested-table-case");
  expect(innerBoxes.length).toBeGreaterThanOrEqual(3);
  expect(new Set(innerBoxes.map((box) => box.pageIndex)).size).toBeGreaterThanOrEqual(3);

  guards.assertClean();
});

test("rowspan and colspan merged cell keeps paginating without dropping downstream rows", async ({
  page,
}) => {
  const guards = attachConsoleGuards(page);

  await page.goto("/", { waitUntil: "networkidle" });
  await setDocumentJson(page, buildMergedSpanOverflowDoc());
  await waitForLayoutIdle(page);
  await waitForPageCount(page, 3);

  const snapshot = await getDocumentSnapshot(page);
  expect(Number(snapshot.typeCounts?.table ?? 0)).toBe(1);
  expect(Number(snapshot.typeCounts?.tableRow ?? 0)).toBe(3);
  expect(Number(snapshot.typeCounts?.tableCell ?? 0)).toBe(6);

  const fragments = (await getLayoutFragmentSummaries(page, "table"))
    .filter(
      (fragment) =>
        fragment.nodeId === "table-merged-span-case" || fragment.blockId === "table-merged-span-case",
    )
    .sort((a, b) => a.pageIndex - b.pageIndex);
  expect(fragments.length).toBeGreaterThanOrEqual(3);
  expect(fragments.every((fragment) => fragment.carryStateKind === "table")).toBeTruthy();
  expect(fragments.some((fragment) => fragment.rowSplit === true)).toBeTruthy();

  const tableLines = (await getLayoutLineContinuationSummaries(page)).filter(
    (line) =>
      line.blockId === "table-merged-span-case" ||
      line.fragmentIdentity === fragments[0]?.fragmentIdentity ||
      line.tableKey === "table-merged-span-case",
  );
  expect(tableLines.length).toBeGreaterThan(0);

  const row0Pages = new Set(
    tableLines
      .filter((line) => Number(line.rowIndex) === 0)
      .map((line) => Number(line.pageIndex))
      .filter((value) => Number.isFinite(value)),
  );
  expect(row0Pages.size).toBeGreaterThanOrEqual(2);
  expect(tableLines.some((line) => Number(line.rowIndex) === 1)).toBeTruthy();
  expect(tableLines.some((line) => Number(line.rowIndex) === 2)).toBeTruthy();

  const sideBottomBox = await getLayoutBoxSummaryByBlockId(page, "merged-span-side-bottom");
  const row3Box = await getLayoutBoxSummaryByBlockId(page, "merged-span-row3-c");
  const afterTableBox = await getLayoutBoxSummaryByBlockId(page, "after-merged-span-table");
  expect(sideBottomBox).not.toBeNull();
  expect(row3Box).not.toBeNull();
  expect(afterTableBox).not.toBeNull();

  const lastFragmentPage = fragments[fragments.length - 1]?.pageIndex ?? -1;
  expect((sideBottomBox?.pageIndex ?? -1) >= 0).toBeTruthy();
  expect((row3Box?.pageIndex ?? -1) >= (sideBottomBox?.pageIndex ?? -1)).toBeTruthy();
  expect((afterTableBox?.pageIndex ?? -1) >= lastFragmentPage).toBeTruthy();

  if (
    row3Box &&
    afterTableBox &&
    row3Box.pageIndex === afterTableBox.pageIndex
  ) {
    expect(row3Box.y + row3Box.height).toBeLessThanOrEqual(afterTableBox.y + 2);
  }

  guards.assertClean();
});

test("code block keeps splitting by visual lines across multiple pages", async ({ page }) => {
  const guards = attachConsoleGuards(page);

  await page.goto("/", { waitUntil: "networkidle" });
  await setDocumentJson(page, buildTallCodeBlockDoc());
  await waitForLayoutIdle(page);
  await waitForPageCount(page, 3);

  const fragments = (await getLayoutFragmentSummaries(page, "codeBlock"))
    .filter(
      (fragment) =>
        fragment.nodeId === "code-block-pagination-case" ||
        fragment.blockId === "code-block-pagination-case",
    )
    .sort((a, b) => a.pageIndex - b.pageIndex);
  expect(fragments.length).toBeGreaterThanOrEqual(3);
  expect(new Set(fragments.map((fragment) => fragment.pageIndex)).size).toBeGreaterThanOrEqual(3);

  const codeLines = (await getLayoutLineContinuationSummaries(page)).filter(
    (line) => line.blockId === "code-block-pagination-case",
  );
  expect(codeLines.length).toBeGreaterThan(20);
  expect(new Set(codeLines.map((line) => Number(line.pageIndex))).size).toBeGreaterThanOrEqual(3);

  const firstPageLines = codeLines.filter((line) => Number(line.pageIndex) === fragments[0]?.pageIndex);
  const secondPageLines = codeLines.filter((line) => Number(line.pageIndex) === fragments[1]?.pageIndex);
  expect(firstPageLines.length).toBeGreaterThan(0);
  expect(secondPageLines.length).toBeGreaterThan(0);
  expect(firstPageLines.every((line) => Number.isFinite(Number(line.pageIndex)))).toBeTruthy();
  expect(secondPageLines.every((line) => Number.isFinite(Number(line.pageIndex)))).toBeTruthy();

  guards.assertClean();
});

for (const testCase of visualCases) {
  test(testCase.name, async ({ page }) => {
    const guards = attachConsoleGuards(page);

    await page.goto("/", { waitUntil: "networkidle" });
    await setDocumentJson(page, testCase.doc);
    await waitForLayoutIdle(page);
    await waitForPageCount(page, 2);

    const fragments = (await getLayoutFragmentSummaries(page, testCase.type)).filter(
      (fragment) => fragment.nodeId === testCase.nodeId || fragment.blockId === testCase.nodeId,
    );
    expect(fragments.length).toBe(1);

    const nodeBox = await getLayoutBoxSummaryByBlockId(page, testCase.nodeId);
    const nextBox = await getLayoutBoxSummaryByBlockId(page, testCase.nextId);
    expect(nodeBox).not.toBeNull();
    if ((nodeBox?.pageIndex ?? 0) > 0) {
      await scrollBlockIntoView(page, testCase.nodeId);
      await waitForLayoutIdle(page);
    }
    const nodeViewportRect = await getLayoutBoxViewportRectByBlockId(page, testCase.nodeId);
    const overlayRect = await getOverlayRect(page, testCase.overlaySelector);
    expect(nextBox).not.toBeNull();
    expect(nodeViewportRect).not.toBeNull();
    expect(overlayRect).not.toBeNull();
    expect(nextBox?.pageIndex ?? 0).toBeGreaterThanOrEqual(nodeBox?.pageIndex ?? 0);
    if (nodeBox && nextBox && nodeBox.pageIndex === nextBox.pageIndex) {
      expect(nodeBox.y + nodeBox.height).toBeLessThanOrEqual(nextBox.y + 2);
    }
    expect(Math.abs((overlayRect?.x ?? 0) - (nodeViewportRect?.x ?? 0))).toBeLessThan(8);
    expect(Math.abs((overlayRect?.y ?? 0) - (nodeViewportRect?.y ?? 0))).toBeLessThan(8);
    expect(Math.abs((overlayRect?.width ?? 0) - (nodeViewportRect?.width ?? 0))).toBeLessThan(8);
    expect(Math.abs((overlayRect?.height ?? 0) - (nodeViewportRect?.height ?? 0))).toBeLessThan(8);

    guards.assertClean();
  });
}

test("edited image keeps explicit overlay size after pagination pushes it onto the next page", async ({
  page,
}) => {
  const guards = attachConsoleGuards(page);

  await page.goto("/", { waitUntil: "networkidle" });
  await setDocumentJson(page, {
    type: "doc",
    content: [
      buildParagraph("before-image-shift", "Lead paragraph before image shift case."),
      {
        type: "image",
        attrs: {
          id: "image-shift-regression",
          src: "https://example.com/demo.png",
          alt: "Image shift regression",
          width: 360,
          height: 220,
        },
      },
      buildParagraph("after-image-shift", "Paragraph after image shift case."),
    ],
  });
  await waitForLayoutIdle(page);

  const editPos = await getParagraphDocPos(page, 0, 9999);
  expect(editPos).not.toBeNull();
  await setTextSelection(page, Number(editPos), Number(editPos));
  await getEditorLocators(page).input.focus();

  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press("Enter");
    await page.keyboard.insertText(
      `Push image ${index + 1}. ` +
        "This inserted paragraph should force the image onto the next page. ".repeat(8),
    );
  }

  await waitForLayoutIdle(page);
  await waitForPageCount(page, 2);

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

    const matchBox = (
      boxes: Array<Record<string, unknown>> | undefined,
    ): Record<string, unknown> | null => {
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
  }, "image-shift-regression");

  await waitForLayoutIdle(page);

  const imageBox = await getLayoutBoxSummaryByBlockId(page, "image-shift-regression");
  const imageViewportRect = await getLayoutBoxViewportRectByBlockId(page, "image-shift-regression");
  const overlayRect = await getOverlayRect(page, ".lumenpage-image-overlay");

  expect(imageBox).not.toBeNull();
  expect(imageViewportRect).not.toBeNull();
  expect(overlayRect).not.toBeNull();
  expect(imageBox?.pageIndex).toBeGreaterThanOrEqual(1);
  expect(imageBox?.width).toBeCloseTo(360, 0);
  expect(imageBox?.height).toBeCloseTo(220, 0);
  expect(Math.abs((overlayRect?.width ?? 0) - 360)).toBeLessThan(8);
  expect(Math.abs((overlayRect?.height ?? 0) - 220)).toBeLessThan(8);
  expect(Math.abs((overlayRect?.x ?? 0) - (imageViewportRect?.x ?? 0))).toBeLessThan(8);
  expect(Math.abs((overlayRect?.y ?? 0) - (imageViewportRect?.y ?? 0))).toBeLessThan(8);
  expect(Math.abs((overlayRect?.width ?? 0) - (imageViewportRect?.width ?? 0))).toBeLessThan(8);
  expect(Math.abs((overlayRect?.height ?? 0) - (imageViewportRect?.height ?? 0))).toBeLessThan(8);

  guards.assertClean();
});

test("toolbar inserted image keeps stable height after enter pushes it onto the next page", async ({
  page,
}) => {
  const guards = attachConsoleGuards(page);

  await page.goto("/", { waitUntil: "networkidle" });
  await setDocumentJson(page, {
    type: "doc",
    content: [
      buildParagraph("insert-image-before", "Paragraph before inserted image."),
      buildParagraph("insert-image-after", "Paragraph after inserted image."),
    ],
  });
  await waitForLayoutIdle(page);

  const insertPos = await getParagraphDocPos(page, 0, 9999);
  expect(insertPos).not.toBeNull();
  await setTextSelection(page, Number(insertPos), Number(insertPos));

  await openToolbarMenu(page, "insert");
  await clickToolbarAction(page, "image");
  await fillVisibleToolbarDialog(page, [DATA_URL_SQUARE_IMAGE]);
  await waitForLayoutIdle(page);

  const insertedImage = findLastNodeAttrsByType((await getDocumentSnapshot(page)).json, "image");
  const blockId = String(insertedImage?.id ?? "");
  expect(blockId).not.toBe("");

  await expect
    .poll(async () => {
      const attrs = await getNodeAttrsByBlockId(page, blockId);
      return {
        width: Number(attrs?.width ?? 0),
        height: Number(attrs?.height ?? 0),
      };
    })
    .toEqual({ width: 320, height: 320 });

  const expectedHeight = 320;
  const editPos = await getParagraphDocPos(page, 0, 9999);
  expect(editPos).not.toBeNull();
  await setTextSelection(page, Number(editPos), Number(editPos));
  await getEditorLocators(page).input.focus();
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press("Enter");
    await page.keyboard.insertText(
      `Push inserted image ${index + 1}. ` +
        "This inserted paragraph should force the image onto the next page. ".repeat(8),
    );
  }

  await waitForLayoutIdle(page);
  await waitForPageCount(page, 2);
  await expect
    .poll(async () => (await getLayoutBoxSummaryByBlockId(page, blockId))?.pageIndex ?? -1, {
      timeout: 15000,
    })
    .toBeGreaterThanOrEqual(1);

  await scrollBlockIntoView(page, blockId);
  await waitForLayoutIdle(page);

  const attrsAfterMove = await getNodeAttrsByBlockId(page, blockId);
  const boxAfterMove = await getLayoutBoxSummaryByBlockId(page, blockId);
  const boxesAfterMove = await getLayoutBoxSummariesByBlockId(page, blockId);
  const overlayAfterMove = await getOverlayRect(page, ".lumenpage-image-overlay");

  expect(Number(attrsAfterMove?.height ?? 0)).toBe(expectedHeight);
  expect(boxAfterMove).not.toBeNull();
  expect(boxAfterMove?.height ?? 0).toBeGreaterThanOrEqual(expectedHeight - 4);
  expect(overlayAfterMove).not.toBeNull();
  expect(overlayAfterMove?.height ?? 0).toBeGreaterThanOrEqual(expectedHeight - 4);
  expect(
    boxesAfterMove.filter((box) => box.pageIndex === boxAfterMove?.pageIndex && box.depth === 0).length,
  ).toBeGreaterThanOrEqual(1);

  guards.assertClean();
});

test("toolbar inserted qr image keeps stable height after enter pushes it onto the next page", async ({
  page,
}) => {
  const guards = attachConsoleGuards(page);

  await page.goto("/", { waitUntil: "networkidle" });
  await setDocumentJson(page, {
    type: "doc",
    content: [
      buildParagraph("insert-qr-before", "Paragraph before inserted qr."),
      buildParagraph("insert-qr-after", "Paragraph after inserted qr."),
    ],
  });
  await waitForLayoutIdle(page);

  const insertPos = await getParagraphDocPos(page, 0, 9999);
  expect(insertPos).not.toBeNull();
  await setTextSelection(page, Number(insertPos), Number(insertPos));

  await openToolbarMenu(page, "tools");
  await clickToolbarAction(page, "qrcode");
  await fillVisibleToolbarDialog(page, ["codex-pagination-qr"]);
  await waitForLayoutIdle(page);

  const insertedQr = findLastNodeAttrsByType((await getDocumentSnapshot(page)).json, "image");
  const blockId = String(insertedQr?.id ?? "");
  expect(blockId).not.toBe("");

  await expect
    .poll(async () => {
      const attrs = await getNodeAttrsByBlockId(page, blockId);
      return {
        width: Number(attrs?.width ?? 0),
        height: Number(attrs?.height ?? 0),
      };
    })
    .toEqual({ width: 256, height: 256 });

  const editPos = await getParagraphDocPos(page, 0, 9999);
  expect(editPos).not.toBeNull();
  await setTextSelection(page, Number(editPos), Number(editPos));
  await getEditorLocators(page).input.focus();
  let movedToNextPage = false;
  for (let index = 0; index < 24; index += 1) {
    await page.keyboard.press("Enter");
    await page.keyboard.insertText(
      `Push inserted qr ${index + 1}. ` +
        "This inserted paragraph should force the qr image onto the next page. ".repeat(8),
    );
    await waitForLayoutIdle(page);
    const currentBox = await getLayoutBoxSummaryByBlockId(page, blockId);
    if ((currentBox?.pageIndex ?? 0) >= 1) {
      movedToNextPage = true;
      break;
    }
  }

  expect(movedToNextPage).toBeTruthy();
  await waitForLayoutIdle(page);
  await waitForPageCount(page, 2);
  await expect
    .poll(async () => (await getLayoutBoxSummaryByBlockId(page, blockId))?.pageIndex ?? -1, {
      timeout: 15000,
    })
    .toBeGreaterThanOrEqual(1);

  await scrollBlockIntoView(page, blockId);
  await waitForLayoutIdle(page);

  const attrsAfterMove = await getNodeAttrsByBlockId(page, blockId);
  const boxAfterMove = await getLayoutBoxSummaryByBlockId(page, blockId);
  const overlayAfterMove = await getOverlayRect(page, ".lumenpage-image-overlay");

  expect(Number(attrsAfterMove?.height ?? 0)).toBe(256);
  expect(boxAfterMove).not.toBeNull();
  expect(boxAfterMove?.height ?? 0).toBeGreaterThanOrEqual(252);
  expect(overlayAfterMove).not.toBeNull();
  expect(overlayAfterMove?.height ?? 0).toBeGreaterThanOrEqual(252);

  guards.assertClean();
});

test("toolbar inserted qr image removes stale next-page overlay after preceding content is deleted", async ({
  page,
}) => {
  const guards = attachConsoleGuards(page);

  await page.goto("/", { waitUntil: "networkidle" });
  await setDocumentJson(page, {
    type: "doc",
    content: [
      buildParagraph("insert-qr-delete-before", "Paragraph before inserted qr delete regression."),
      buildParagraph("insert-qr-delete-after", "Paragraph after inserted qr delete regression."),
    ],
  });
  await waitForLayoutIdle(page);

  const insertPos = await getParagraphDocPos(page, 0, 9999);
  expect(insertPos).not.toBeNull();
  await setTextSelection(page, Number(insertPos), Number(insertPos));

  await openToolbarMenu(page, "tools");
  await clickToolbarAction(page, "qrcode");
  await fillVisibleToolbarDialog(page, ["codex-pagination-delete-qr"]);
  await waitForLayoutIdle(page);

  const insertedQr = findLastNodeAttrsByType((await getDocumentSnapshot(page)).json, "image");
  const blockId = String(insertedQr?.id ?? "");
  expect(blockId).not.toBe("");

  await expect
    .poll(async () => {
      const attrs = await getNodeAttrsByBlockId(page, blockId);
      return {
        width: Number(attrs?.width ?? 0),
        height: Number(attrs?.height ?? 0),
      };
    })
    .toEqual({ width: 256, height: 256 });

  const editPos = await getParagraphDocPos(page, 0, 9999);
  expect(editPos).not.toBeNull();
  await setTextSelection(page, Number(editPos), Number(editPos));
  await getEditorLocators(page).input.focus();

  let movedToNextPage = false;
  for (let index = 0; index < 24; index += 1) {
    await page.keyboard.press("Enter");
    await page.keyboard.insertText(
      `Push inserted qr ${index + 1}. ` +
        "This inserted paragraph should force the qr image onto the next page. ".repeat(8),
    );
    await waitForLayoutIdle(page);
    const currentBox = await getLayoutBoxSummaryByBlockId(page, blockId);
    if ((currentBox?.pageIndex ?? 0) >= 1) {
      movedToNextPage = true;
      break;
    }
  }

  expect(movedToNextPage).toBeTruthy();
  await waitForLayoutIdle(page);
  await waitForPageCount(page, 2);
  await expect
    .poll(async () => (await getLayoutBoxSummaryByBlockId(page, blockId))?.pageIndex ?? -1, {
      timeout: 15000,
    })
    .toBeGreaterThanOrEqual(1);

  await scrollBlockIntoView(page, blockId);
  await waitForLayoutIdle(page);

  await expect
    .poll(async () => (await listOverlayEntriesByBlockId(page, blockId)).length, {
      timeout: 10000,
    })
    .toBe(1);

  const snapshotBeforeDelete = (await getDocumentSnapshot(page)).json as {
    type?: string;
    content?: Array<Record<string, unknown>>;
  } | null;
  expect(Array.isArray(snapshotBeforeDelete?.content)).toBeTruthy();

  const nextDoc = {
    ...(snapshotBeforeDelete ?? {}),
    content:
      snapshotBeforeDelete?.content?.filter((node) => {
        if (String(node?.type ?? "") !== "paragraph") {
          return true;
        }
        const text =
          Array.isArray(node?.content) && node.content.length > 0
            ? node.content
                .map((child) =>
                  child && typeof child === "object" ? String((child as { text?: unknown }).text ?? "") : "",
                )
                .join("")
            : "";
        return !text.startsWith("Push inserted qr ");
      }) ?? [],
  };

  await setDocumentJson(page, nextDoc);
  await waitForLayoutIdle(page);

  await expect
    .poll(async () => (await getLayoutBoxSummaryByBlockId(page, blockId))?.pageIndex ?? -1, {
      timeout: 15000,
    })
    .toBe(0);

  await scrollBlockIntoView(page, blockId);
  await waitForLayoutIdle(page);

  await expect
    .poll(
      async () =>
        ((await inspectBlock(page, blockId)) as {
          overlayEntries?: Array<{ visible?: boolean }>;
          boxMatches?: Array<{ pageIndex?: number }>;
        } | null) ?? null,
      { timeout: 15000 },
    )
    .toMatchObject({
      overlayEntries: [{ visible: true }],
      boxMatches: [{ pageIndex: 0 }],
    });

  const blockStateAfterDelete = (await inspectBlock(page, blockId)) as {
    overlayEntries?: Array<{
      visible?: boolean;
      rect?: { x?: number; y?: number; width?: number; height?: number } | null;
    }>;
    boxMatches?: Array<{ pageIndex?: number }>;
  } | null;
  const overlayEntriesAfterDelete = blockStateAfterDelete?.overlayEntries ?? [];
  expect(overlayEntriesAfterDelete).toHaveLength(1);
  expect(overlayEntriesAfterDelete.every((entry) => entry.visible === true)).toBeTruthy();

  const boxPagesAfterDelete = new Set(
    (blockStateAfterDelete?.boxMatches ?? [])
      .map((entry) => Number(entry?.pageIndex))
      .filter((value) => Number.isFinite(value)),
  );
  expect(Array.from(boxPagesAfterDelete)).toEqual([0]);
  expect(Number(overlayEntriesAfterDelete[0]?.rect?.width ?? 0)).toBeGreaterThanOrEqual(252);
  expect(Number(overlayEntriesAfterDelete[0]?.rect?.height ?? 0)).toBeGreaterThanOrEqual(252);

  guards.assertClean();
});

test("toolbar inserted barcode keeps stable overlay width and height when enter pushes it onto the next page", async ({
  page,
}) => {
  const guards = attachConsoleGuards(page);

  await page.goto("/", { waitUntil: "networkidle" });
  await setDocumentJson(page, {
    type: "doc",
    content: [
      ...fillerParagraphs.slice(0, 5),
      buildParagraph("insert-barcode-before", "Paragraph immediately before inserted barcode."),
      buildParagraph("insert-barcode-after", "Paragraph after inserted barcode."),
    ],
  });
  await waitForLayoutIdle(page);

  const insertPos = await getParagraphDocPos(page, 5, 9999);
  expect(insertPos).not.toBeNull();
  await setTextSelection(page, Number(insertPos), Number(insertPos));

  await openToolbarMenu(page, "tools");
  await clickToolbarAction(page, "barcode");
  await fillVisibleToolbarDialog(page);
  await waitForLayoutIdle(page);

  const insertedBarcode = findLastNodeAttrsByType((await getDocumentSnapshot(page)).json, "image");
  const blockId = String(insertedBarcode?.id ?? "");
  expect(blockId).not.toBe("");

  await expect
    .poll(async () => {
      const attrs = await getNodeAttrsByBlockId(page, blockId);
      return {
        width: Number(attrs?.width ?? 0),
        height: Number(attrs?.height ?? 0),
      };
    })
    .toEqual({ width: 360, height: 180 });

  const editPos = await getParagraphDocPos(page, 5, 9999);
  expect(editPos).not.toBeNull();
  await setTextSelection(page, Number(editPos), Number(editPos));
  await getEditorLocators(page).input.focus();

  let movedToNextPage = false;
  for (let index = 0; index < 24; index += 1) {
    await page.keyboard.press("Enter");
    await waitForLayoutIdle(page);
    const currentBox = await getLayoutBoxSummaryByBlockId(page, blockId);
    if ((currentBox?.pageIndex ?? 0) >= 1) {
      movedToNextPage = true;
      break;
    }
  }

  expect(movedToNextPage).toBeTruthy();

  await expect
    .poll(async () => {
      const overlay = await getOverlayRect(page, ".lumenpage-image-overlay");
      if (!overlay || overlay.display === "none" || overlay.visibility === "hidden") {
        return null;
      }
      return {
        width: Math.round(overlay.width),
        height: Math.round(overlay.height),
      };
    })
    .toEqual({ width: 360, height: 180 });

  const boxAfterMove = await getLayoutBoxSummaryByBlockId(page, blockId);
  const viewportRectAfterMove = await getLayoutBoxViewportRectByBlockId(page, blockId);
  const overlayAfterMove = await getOverlayRect(page, ".lumenpage-image-overlay");
  const nextParagraphAfterMove = await getLayoutBoxSummaryByBlockId(page, "insert-barcode-after");

  expect(boxAfterMove).not.toBeNull();
  expect(boxAfterMove?.pageIndex ?? 0).toBeGreaterThanOrEqual(1);
  expect(boxAfterMove?.width ?? 0).toBeGreaterThanOrEqual(356);
  expect(boxAfterMove?.height ?? 0).toBeGreaterThanOrEqual(176);
  expect(viewportRectAfterMove).not.toBeNull();
  expect(overlayAfterMove).not.toBeNull();
  expect(Math.abs((overlayAfterMove?.x ?? 0) - (viewportRectAfterMove?.x ?? 0))).toBeLessThan(8);
  expect(Math.abs((overlayAfterMove?.y ?? 0) - (viewportRectAfterMove?.y ?? 0))).toBeLessThan(8);
  expect(Math.abs((overlayAfterMove?.width ?? 0) - (viewportRectAfterMove?.width ?? 0))).toBeLessThan(8);
  expect(Math.abs((overlayAfterMove?.height ?? 0) - (viewportRectAfterMove?.height ?? 0))).toBeLessThan(8);
  if (boxAfterMove && nextParagraphAfterMove && boxAfterMove.pageIndex === nextParagraphAfterMove.pageIndex) {
    expect(boxAfterMove.y + boxAfterMove.height).toBeLessThanOrEqual(nextParagraphAfterMove.y + 2);
  }

  guards.assertClean();
});

test("toolbar inserted barcode keeps node selection after enter pushes it onto the next page", async ({
  page,
}) => {
  const guards = attachConsoleGuards(page);

  await page.goto("/", { waitUntil: "networkidle" });
  await setDocumentJson(page, {
    type: "doc",
    content: [
      ...fillerParagraphs.slice(0, 5),
      buildParagraph("insert-barcode-before-select", "Paragraph before barcode selection regression."),
      buildParagraph("insert-barcode-after-select", "Paragraph after barcode selection regression."),
    ],
  });
  await waitForLayoutIdle(page);

  const insertPos = await getParagraphDocPos(page, 5, 9999);
  expect(insertPos).not.toBeNull();
  await setTextSelection(page, Number(insertPos), Number(insertPos));

  await openToolbarMenu(page, "tools");
  await clickToolbarAction(page, "barcode");
  await fillVisibleToolbarDialog(page, ["1234567890"]);
  await waitForLayoutIdle(page);

  const attrs = await getDocumentSnapshot(page);
  const imageAttrs = findLastNodeAttrsByType(attrs.json, "image");
  const barcodeBlockId = String(imageAttrs?.id || "");
  expect(barcodeBlockId).not.toBe("");

  const editPos = await getParagraphDocPos(page, 5, 9999);
  expect(editPos).not.toBeNull();
  await setTextSelection(page, Number(editPos), Number(editPos));
  await getEditorLocators(page).input.focus();

  let movedToNextPage = false;
  for (let index = 0; index < 24; index += 1) {
    await page.keyboard.press("Enter");
    await waitForLayoutIdle(page);
    const currentBox = await getLayoutBoxSummaryByBlockId(page, barcodeBlockId);
    if ((currentBox?.pageIndex ?? 0) >= 1) {
      movedToNextPage = true;
      break;
    }
  }

  expect(movedToNextPage).toBeTruthy();

  const boxAfterMove = await getLayoutBoxSummaryByBlockId(page, barcodeBlockId);
  expect(boxAfterMove).not.toBeNull();
  if ((boxAfterMove?.pageIndex ?? 0) > 0) {
    await scrollBlockIntoView(page, barcodeBlockId);
    await waitForLayoutIdle(page);
  }

  const overlayAfterMove = await getOverlayRect(page, ".lumenpage-image-overlay");
  expect(overlayAfterMove).not.toBeNull();

  await page.mouse.click(
    (overlayAfterMove?.x ?? 0) + (overlayAfterMove?.width ?? 0) / 2,
    (overlayAfterMove?.y ?? 0) + (overlayAfterMove?.height ?? 0) / 2,
  );
  await waitForLayoutIdle(page);

  const selection = await page.evaluate(() => window.__lumenTestApi?.getSelection?.() ?? null);
  expect(selection?.type).toBe("NodeSelection");

  const viewportRectAfterMove = await getLayoutBoxViewportRectByBlockId(page, barcodeBlockId);
  expect(viewportRectAfterMove).not.toBeNull();
  const outsideOutlinePixel = await probeOverlayCanvasPixel(page, {
    x: (viewportRectAfterMove?.x ?? 0) + (viewportRectAfterMove?.width ?? 0) + 24,
    y: (viewportRectAfterMove?.y ?? 0) + 1,
  });
  expect(isBlueOutlinePixel(outsideOutlinePixel)).toBeFalsy();

  guards.assertClean();
});

test("barcode pushed onto an already populated next page also moves downstream content and clears stale paint", async ({
  page,
}) => {
  const guards = attachConsoleGuards(page);
  const downstreamIds = Array.from({ length: 10 }, (_, index) => `barcode-downstream-${index + 1}`);

  await page.goto("/", { waitUntil: "networkidle" });
  await setDocumentJson(page, {
    type: "doc",
    content: [
      ...fillerParagraphs.slice(0, 3),
      {
        type: "image",
        attrs: {
          id: "barcode-populated-next-page",
          src: "https://bwipjs-api.metafloor.com/?bcid=code128&text=1234567890",
          alt: "BARCODE: 1234567890",
          width: 360,
          height: 180,
        },
      },
      ...downstreamIds.map((id, index) =>
        buildParagraph(
          id,
          `Downstream paragraph ${index + 1}. ` +
            "This paragraph should be pushed down when the barcode moves onto the next page. ".repeat(3),
        ),
      ),
    ],
  });
  await waitForLayoutIdle(page);
  await waitForPageCount(page, 2);

  const initialBarcodeBox = await getLayoutBoxSummaryByBlockId(page, "barcode-populated-next-page");
  const initialDownstreamBoxes = (
    await Promise.all(downstreamIds.map((id) => getLayoutBoxSummaryByBlockId(page, id)))
  ).filter((value): value is NonNullable<typeof value> => !!value);
  const initialBarcodePageIndex = initialBarcodeBox?.pageIndex ?? -1;
  expect(initialBarcodePageIndex).toBeGreaterThanOrEqual(0);
  expect(initialDownstreamBoxes.some((entry) => entry.pageIndex > initialBarcodePageIndex)).toBeTruthy();

  const editPos = await getParagraphDocPos(page, 2, 9999);
  expect(editPos).not.toBeNull();
  await setTextSelection(page, Number(editPos), Number(editPos));
  await getEditorLocators(page).input.focus();

  let movedToNextPage = false;
  for (let index = 0; index < 24; index += 1) {
    await page.keyboard.press("Enter");
    await page.keyboard.insertText(
      `Push populated barcode ${index + 1}. ` +
        "This inserted paragraph should keep pushing the barcode and downstream content. ".repeat(6),
    );
    await waitForLayoutIdle(page);
    const currentBox = await getLayoutBoxSummaryByBlockId(page, "barcode-populated-next-page");
    if ((currentBox?.pageIndex ?? -1) > initialBarcodePageIndex) {
      movedToNextPage = true;
      break;
    }
  }
  expect(movedToNextPage).toBeTruthy();

  await waitForLayoutIdle(page);
  const movedBarcodeBox = await getLayoutBoxSummaryByBlockId(page, "barcode-populated-next-page");
  expect(movedBarcodeBox).not.toBeNull();
  expect(movedBarcodeBox?.pageIndex ?? -1).toBeGreaterThan(initialBarcodePageIndex);

  const downstreamBoxes = (
    await Promise.all(downstreamIds.map((id) => getLayoutBoxSummaryByBlockId(page, id)))
  ).filter((value): value is NonNullable<typeof value> => !!value);
  const samePageDownstream = downstreamBoxes.filter(
    (entry) => entry.pageIndex === movedBarcodeBox?.pageIndex,
  );
  expect(samePageDownstream.length).toBeGreaterThan(0);
  for (const downstreamBox of samePageDownstream) {
    expect((movedBarcodeBox?.y ?? 0) + (movedBarcodeBox?.height ?? 0)).toBeLessThanOrEqual(
      downstreamBox.y + 2,
    );
  }

  await scrollBlockIntoView(page, "barcode-populated-next-page");
  await waitForLayoutIdle(page);
  const surfaceProbe = await probePageSurfaceRegionByBlockId(page, "barcode-populated-next-page", {
    paddingX: 20,
    paddingY: 18,
    sampleColumns: 4,
    sampleRows: 3,
    maxWidth: 240,
  });
  expect(surfaceProbe).not.toBeNull();
  const darkSamples =
    surfaceProbe?.samples.filter(
      (sample) =>
        Array.isArray(sample.rgba) &&
        sample.rgba.length >= 3 &&
        (sample.rgba[0] < 235 || sample.rgba[1] < 235 || sample.rgba[2] < 235),
    ) ?? [];
  expect(darkSamples).toEqual([]);

  guards.assertClean();
});







