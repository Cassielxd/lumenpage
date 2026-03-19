import { expect, test, type Page } from "@playwright/test";
import {
  attachConsoleGuards,
  focusEditor,
} from "./helpers";

const buildParagraphDocJson = (paragraphs: string[]) => ({
  type: "doc",
  content: paragraphs.map((text) => ({
    type: "paragraph",
    ...(text
      ? {
          content: [
            {
              type: "text",
              text,
            },
          ],
        }
      : {}),
  })),
});

const setParagraphDocument = async (page: Page, paragraphs: string[]) => {
  const ok = await page.evaluate((docJson) => {
    const globalView = (window as Window & { __lumenView?: unknown }).__lumenView;
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
          setJSON?: (value: unknown) => boolean;
          forceLayout?: (options?: { immediate?: boolean }) => boolean;
        }
      | undefined;
    const applied = view?.setJSON?.(docJson) === true;
    if (applied) {
      view?.forceLayout?.({ immediate: true });
    }
    return applied;
  }, buildParagraphDocJson(paragraphs));
  expect(ok).toBeTruthy();
};

const waitForLayoutIdle = async (page: Page) => {
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const globalView = (window as Window & { __lumenView?: unknown }).__lumenView;
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
                renderSync?: {
                  isLayoutPending?: () => boolean;
                };
              };
            }
          | undefined;
        return view?._internals?.renderSync?.isLayoutPending?.() ? "pending" : "idle";
      }),
    )
    .toBe("idle");
};

const getParagraphDocPos = async (page: Page, paragraphIndex: number, charOffset: number) =>
  page.evaluate(
    ({ targetParagraphIndex, targetCharOffset }) => {
      const globalView = (window as Window & { __lumenView?: unknown }).__lumenView;
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
                  fn: (
                    node: { type?: { name?: string }; content?: { size?: number } },
                    pos: number,
                  ) => void,
                ) => void;
              };
            };
          }
        | undefined;
      const doc = view?.state?.doc;
      if (!doc?.descendants) {
        return null;
      }
      let currentParagraphIndex = -1;
      let foundPos: number | null = null;
      doc.descendants((node, pos) => {
        if (foundPos != null || node?.type?.name !== "paragraph") {
          return;
        }
        currentParagraphIndex += 1;
        if (currentParagraphIndex !== targetParagraphIndex) {
          return;
        }
        const from = pos + 1;
        const size = Number(node?.content?.size) || 0;
        const clampedOffset = Math.max(0, Math.min(targetCharOffset, size));
        foundPos = from + clampedOffset;
      });
      return foundPos;
    },
    { targetParagraphIndex: paragraphIndex, targetCharOffset: charOffset },
  );

const getCoordsAtDocPos = async (page: Page, pos: number) =>
  page.evaluate((targetPos) => {
    const globalView = (window as Window & { __lumenView?: unknown }).__lumenView;
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
          coordsAtPos?: (
            pos: number,
          ) => { left: number; right: number; top: number; bottom: number } | null;
        }
      | undefined;
    const rect = view?.coordsAtPos?.(targetPos);
    if (!rect) {
      return null;
    }
    return {
      x: (rect.left + rect.right) / 2,
      y: (rect.top + rect.bottom) / 2,
    };
  }, pos);

const getPosAtViewportCoords = async (page: Page, x: number, y: number) =>
  page.evaluate(
    ({ targetX, targetY }) => {
      const globalView = (window as Window & { __lumenView?: unknown }).__lumenView;
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
            posAtCoords?: (coords: { left: number; top: number }) => number | { pos?: number } | null;
          }
        | undefined;
      const result = view?.posAtCoords?.({ left: targetX, top: targetY });
      if (typeof result === "number") {
        return result;
      }
      return typeof result?.pos === "number" ? result.pos : null;
    },
    { targetX: x, targetY: y },
  );

const getSelectionRange = async (page: Page) =>
  page.evaluate(() => {
    const globalView = (window as Window & { __lumenView?: unknown }).__lumenView;
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
            selection?: {
              from: number;
              to: number;
              empty?: boolean;
              constructor?: { name?: string };
            };
          };
        }
      | undefined;
    const selection = view?.state?.selection;
    if (!selection) {
      return null;
    }
    return {
      from: selection.from,
      to: selection.to,
      empty: selection.empty === true,
      type: selection.constructor?.name ?? null,
    };
  });

const setTextSelection = async (page: Page, from: number, to: number) => {
  const ok = await page.evaluate(
    ({ selectionFrom, selectionTo }) => {
      const globalView = (window as Window & { __lumenView?: unknown }).__lumenView;
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
              doc?: { content?: { size?: number } };
              tr?: {
                setSelection?: (selection: unknown) => { scrollIntoView?: () => unknown } | unknown;
              };
              selection?: {
                constructor?: {
                  create?: (doc: unknown, from: number, to: number) => unknown;
                };
              };
            };
            dispatch?: (tr: unknown) => void;
          }
        | undefined;
      const selectionCtor = view?.state?.selection?.constructor;
      if (!view?.state?.doc || !view?.state?.tr || !selectionCtor?.create) {
        return false;
      }
      try {
        const docSize = Number(view.state.doc.content?.size) || 0;
        const anchor = Math.max(0, Math.min(selectionFrom, docSize));
        const head = Math.max(0, Math.min(selectionTo, docSize));
        const tr = view.state.tr.setSelection?.(selectionCtor.create(view.state.doc, anchor, head));
        view.dispatch?.(tr);
        return true;
      } catch (_error) {
        return false;
      }
    },
    { selectionFrom: from, selectionTo: to },
  );
  expect(ok).toBeTruthy();
};

const getDocumentSnapshot = async (page: Page) =>
  page.evaluate(() => {
    const globalView = (window as Window & { __lumenView?: unknown }).__lumenView;
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
              textContent?: string;
              toJSON?: () => unknown;
            };
          };
        }
      | undefined;
    const doc = view?.state?.doc;
    return {
      textContent: String(doc?.textContent || ""),
      json: doc?.toJSON?.() ?? null,
    };
  });

const getTopLevelParagraphTexts = (json: unknown) => {
  if (!json || typeof json !== "object") {
    return [];
  }
  const doc = json as { content?: Array<{ type?: string; content?: Array<{ text?: string }> }> };
  return Array.isArray(doc.content)
    ? doc.content
        .filter((node) => node?.type === "paragraph")
        .map((node) =>
          Array.isArray(node?.content)
            ? node.content.map((child) => String(child?.text ?? "")).join("")
            : "",
        )
    : [];
};

test("lumen text selection and coord mapping smoke", async ({ page }) => {
  const guards = attachConsoleGuards(page);

  await page.goto("/", { waitUntil: "networkidle" });

  await setParagraphDocument(page, [
    "Selection smoke paragraph alpha beta gamma delta epsilon zeta eta theta iota kappa lambda.",
    "Second paragraph for cross-line and cross-block selection coverage.",
    "Third paragraph keeps the document structure stable during drag.",
  ]);
  await waitForLayoutIdle(page);
  await focusEditor(page);

  const probePos = await getParagraphDocPos(page, 0, 18);
  expect(probePos).not.toBeNull();

  const probeCoords = await getCoordsAtDocPos(page, probePos!);
  expect(probeCoords).not.toBeNull();

  const roundTripPos = await getPosAtViewportCoords(page, probeCoords!.x, probeCoords!.y);
  expect(roundTripPos).not.toBeNull();
  expect(Math.abs((roundTripPos ?? 0) - probePos!)).toBeLessThanOrEqual(2);

  const fromPos = await getParagraphDocPos(page, 0, 6);
  expect(fromPos).not.toBeNull();
  const toPos = await getParagraphDocPos(page, 0, 34);
  expect(toPos).not.toBeNull();

  await setTextSelection(page, fromPos!, toPos!);

  await expect
    .poll(async () => {
      const selection = await getSelectionRange(page);
      if (!selection) {
        return 0;
      }
      return Math.abs(selection.to - selection.from);
    })
    .toBeGreaterThan(20);

  const selection = await getSelectionRange(page);
  expect(selection).not.toBeNull();
  expect(selection?.empty).toBeFalsy();
  expect(Math.min(selection!.from, selection!.to)).toBeLessThanOrEqual(fromPos! + 1);
  expect(Math.max(selection!.from, selection!.to)).toBeGreaterThanOrEqual(toPos! - 1);

  guards.assertClean();
});

test("lumen internal drag from block position reorders blocks without out-of-range errors", async ({
  page,
}) => {
  const guards = attachConsoleGuards(page);

  await page.goto("/", { waitUntil: "networkidle" });

  const paragraphs = [
    "Drag paragraph alpha should move below the third paragraph.",
    "Drag paragraph beta stays near the top.",
    "Drag paragraph gamma is the anchor above the drop position.",
    "Drag paragraph delta remains after the drop target.",
  ];

  await setParagraphDocument(page, paragraphs);
  await waitForLayoutIdle(page);
  await focusEditor(page);

  const firstPos = await getParagraphDocPos(page, 0, 0);
  const fourthPos = await getParagraphDocPos(page, 3, 0);
  expect(firstPos).not.toBeNull();
  expect(fourthPos).not.toBeNull();

  const fourthCoords = await getCoordsAtDocPos(page, fourthPos!);
  expect(fourthCoords).not.toBeNull();

  const dragResult = await page.evaluate(
    ({ fromPos, targetX, targetY }) => {
      const globalView = (window as Window & { __lumenView?: unknown }).__lumenView;
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
              dragHandlers?: {
                startInternalDragFromNodePos?: (pos: number, event: unknown) => boolean;
                finishInternalDrag?: (
                  event: unknown,
                  coords: { x: number; y: number },
                ) => boolean;
                isInternalDragging?: () => boolean;
              };
            };
          }
        | undefined;
      const dragHandlers = view?._internals?.dragHandlers;
      if (
        typeof dragHandlers?.startInternalDragFromNodePos !== "function" ||
        typeof dragHandlers?.finishInternalDrag !== "function"
      ) {
        return {
          hasHandlers: false,
          started: false,
          finished: false,
          hasView: !!view,
          internalsKeys: Object.keys(view?._internals ?? {}),
        };
      }
      const started = dragHandlers.startInternalDragFromNodePos(fromPos, {
        ctrlKey: false,
        altKey: false,
        metaKey: false,
      });
      const finished =
        started &&
        dragHandlers.finishInternalDrag(
          {
            ctrlKey: false,
            altKey: false,
            metaKey: false,
          },
          { x: targetX, y: targetY },
        ) === true;
      return {
        hasHandlers: true,
        started,
        finished,
        hasView: true,
        internalsKeys: Object.keys(view?._internals ?? {}),
        internalDragging: dragHandlers.isInternalDragging?.() === true,
      };
    },
    {
      fromPos: firstPos! - 1,
      targetX: fourthCoords!.x,
      targetY: fourthCoords!.y - 8,
    },
  );

  expect(dragResult.hasHandlers, JSON.stringify(dragResult)).toBeTruthy();
  expect(dragResult.started).toBeTruthy();
  expect(dragResult.finished).toBeTruthy();

  await waitForLayoutIdle(page);

  const snapshot = await getDocumentSnapshot(page);
  const texts = getTopLevelParagraphTexts(snapshot.json);
  expect(texts).toHaveLength(4);
  expect(texts[0]).toBe(paragraphs[1]);
  expect(texts[1]).toBe(paragraphs[2]);
  expect(texts[2]).toBe(paragraphs[0]);
  expect(texts[3]).toBe(paragraphs[3]);

  guards.assertClean();
});
