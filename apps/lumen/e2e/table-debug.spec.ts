import { test } from "@playwright/test";
import { setDocumentJson, waitForLayoutIdle, waitForPageCount } from "./helpers";

const buildTallRowText = (label: string) =>
  Array.from({ length: 12 }, () => `${label} content stretches table pagination cleanly.`).join(" ");

const buildParagraph = (id: string, text: string) => ({
  type: "paragraph",
  attrs: { id },
  content: [{ type: "text", text }],
});

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
    buildParagraph("table-preface-1", "Preface paragraph before paginated table. ".repeat(18)),
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

test("debug table split", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await setDocumentJson(page, buildTallTableDoc());
  await waitForLayoutIdle(page);
  await waitForPageCount(page, 2);

  const result = await page.evaluate(() => {
    const debug = (globalThis as typeof globalThis & { __tableSplitDebug?: unknown }).__tableSplitDebug;
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
            getLayout?: () => {
              pages?: Array<{
                fragments?: Array<Record<string, unknown>>;
                lines?: Array<Record<string, unknown>>;
              }>;
            };
          };
        }
      | undefined;
    const layout = view?._internals?.getLayout?.();
    return {
      debug,
      page0Table: (() => {
        const fragment = layout?.pages?.[0]?.fragments?.find((item) => item?.type === "table");
        return fragment
          ? {
              y: fragment?.y,
              height: fragment?.height,
              start: fragment?.start,
              end: fragment?.end,
              meta: fragment?.meta,
            }
          : null;
      })(),
      page1Table: (() => {
        const fragment = layout?.pages?.[1]?.fragments?.find((item) => item?.type === "table");
        return fragment
          ? {
              y: fragment?.y,
              height: fragment?.height,
              start: fragment?.start,
              end: fragment?.end,
              meta: fragment?.meta,
            }
          : null;
      })(),
      page0Rows:
        layout?.pages?.[0]?.lines
          ?.filter((line) => Number.isFinite(line?.blockAttrs?.rowIndex))
          .map((line) => ({
            rowIndex: line?.blockAttrs?.rowIndex,
            start: line?.start,
            end: line?.end,
            relativeY: line?.relativeY,
            sliceFromPrev: line?.blockAttrs?.sliceFromPrev,
            sliceHasNext: line?.blockAttrs?.sliceHasNext,
            sliceRowSplit: line?.blockAttrs?.sliceRowSplit,
            splitSource: line?.blockAttrs?.__splitSource,
            splitValidationReason: line?.blockAttrs?.__splitValidationReason,
            blockCarryState: line?.blockAttrs?.fragmentCarryState,
            tableCarryState: line?.tableOwnerMeta?.fragmentCarryState,
            tableHeight: line?.tableOwnerMeta?.tableHeight,
            tableMetaRows: line?.tableOwnerMeta?.rowHeights,
          })) ?? [],
      page1Rows:
        layout?.pages?.[1]?.lines
          ?.filter((line) => Number.isFinite(line?.blockAttrs?.rowIndex))
          .map((line) => ({
            rowIndex: line?.blockAttrs?.rowIndex,
            start: line?.start,
            end: line?.end,
            relativeY: line?.relativeY,
            sliceFromPrev: line?.blockAttrs?.sliceFromPrev,
            sliceHasNext: line?.blockAttrs?.sliceHasNext,
            sliceRowSplit: line?.blockAttrs?.sliceRowSplit,
            splitSource: line?.blockAttrs?.__splitSource,
            splitValidationReason: line?.blockAttrs?.__splitValidationReason,
            blockCarryState: line?.blockAttrs?.fragmentCarryState,
            tableCarryState: line?.tableOwnerMeta?.fragmentCarryState,
            tableHeight: line?.tableOwnerMeta?.tableHeight,
            tableMetaRows: line?.tableOwnerMeta?.rowHeights,
          })) ?? [],
    };
  });

  console.log(JSON.stringify(result, null, 2));
});
