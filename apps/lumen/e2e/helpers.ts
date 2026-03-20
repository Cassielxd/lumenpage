import { expect, type Locator, type Page } from "@playwright/test";

type LumenTestApi = {
  forceRender?: () => boolean;
  getSelection?: () => { from: number; to: number; empty: boolean; type: string | null } | null;
  setJSON?: (docJson: unknown) => boolean;
  setSelection?: (from: number, to: number) => boolean;
};

export const attachConsoleGuards = (page: Page) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  return {
    assertClean() {
      expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
      expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
    },
  };
};

export const parseFirstNumber = (value: string) => {
  const matched = value.match(/\d+/);
  return matched ? Number(matched[0]) : null;
};

export const getFooterStats = (page: Page) => page.locator(".doc-footer-stat");

export const openToolbarMenu = async (
  page: Page,
  menu: "base" | "insert" | "table" | "tools" | "page" | "export",
) => {
  await page.locator(`[data-toolbar-menu="${menu}"]`).click();
};

export const clickToolbarAction = async (page: Page, action: string) => {
  await page.locator(`[data-toolbar-action="${action}"]`).first().click();
};

export const getEditorLocators = (page: Page) => ({
  root: page.locator(".lumenpage-editor"),
  input: page.locator(".lumenpage-input"),
  scrollArea: page.locator(".lumenpage-scroll-area"),
});

export const focusEditor = async (page: Page) => {
  const { root, input } = getEditorLocators(page);
  await root.click({ position: { x: 430, y: 230 } });
  await input.focus();
};

export const openTableInsertPicker = async (page: Page) => {
  await page.locator(".menu-tab-trigger").nth(2).click();
  await page.locator('[data-toolbar-action="table-insert"]').first().click();
  const picker = page.locator(".table-insert-picker");
  await expect(picker).toBeVisible();
  return picker;
};

export const insertTable = async (page: Page, value: string) => {
  const match = String(value || "")
    .trim()
    .toLowerCase()
    .match(/^(\d+)\s*[xX*]\s*(\d+)$/);
  expect(match, `invalid table size: ${value}`).not.toBeNull();
  const rows = Number(match?.[1] || 0);
  const cols = Number(match?.[2] || 0);
  const picker = await openTableInsertPicker(page);
  await picker.locator(`[data-table-size="${rows}x${cols}"]`).click();
  await expect(picker).toBeHidden();
  await waitForLayoutIdle(page);
};

export const selectToolbarPageSize = async (page: Page, value: string) => {
  await page.locator('[data-toolbar-action="page-size"]').first().click();
  const option = page.locator(".toolbar-page-size-dropdown .t-dropdown__item").filter({
    hasText: new RegExp(`^${value}$`, "i"),
  });
  await expect(option).toBeVisible();
  await option.first().click();
};

export const scrollEditor = async (scrollArea: Locator, top: number) => {
  await scrollArea.evaluate((node, scrollTop) => {
    node.scrollTop = Math.min(node.scrollHeight, scrollTop);
  }, top);
};

type TablePixelProbe = {
  fragment: { x: number; y: number; width: number; height: number };
  samples: Record<string, number[]>;
};

export const probeTablePixels = async (page: Page) =>
  page.evaluate((): TablePixelProbe | null => {
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
            renderer?: {
              pageCache?: Map<number, { canvas?: HTMLCanvasElement }>;
            };
            getLayout?: () => {
              pages?: Array<{
                fragments?: Array<{
                  type?: string;
                  x: number;
                  y: number;
                  width: number;
                  height: number;
                }>;
              }>;
            };
          };
        }
      | undefined;
    const layout = view?._internals?.getLayout?.();
    const page0 = layout?.pages?.[0];
    const fragment = page0?.fragments?.find((item) => item?.type === "table");
    const entry = view?._internals?.renderer?.pageCache?.get(0);
    if (!fragment || !entry?.canvas) {
      return null;
    }
    const ctx = entry.canvas.getContext("2d");
    if (!ctx) {
      return null;
    }
    const points = {
      topBorder: [Math.floor(fragment.x + fragment.width / 2), Math.floor(fragment.y + 1)],
      leftBorder: [Math.floor(fragment.x + 1), Math.floor(fragment.y + fragment.height / 2)],
      rowDivider: [
        Math.floor(fragment.x + fragment.width / 2),
        Math.floor(fragment.y + fragment.height / 2),
      ],
      colDivider: [
        Math.floor(fragment.x + fragment.width / 2),
        Math.floor(fragment.y + fragment.height / 4),
      ],
    } satisfies Record<string, [number, number]>;
    const samples = Object.fromEntries(
      Object.entries(points).map(([key, [x, y]]) => [
        key,
        Array.from(ctx.getImageData(x, y, 1, 1).data),
      ]),
    );
    return {
      fragment: {
        x: fragment.x,
        y: fragment.y,
        width: fragment.width,
        height: fragment.height,
      },
      samples,
    };
  });

export const isNonWhitePixel = (pixel: number[]) =>
  pixel.length >= 3 && (pixel[0] < 245 || pixel[1] < 245 || pixel[2] < 245);

type PaginationInfo = {
  pageCount: number;
  visibleRange: { startIndex: number; endIndex: number };
};

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

export const setDocumentJson = async (page: Page, json: unknown) => {
  const result = await page.evaluate((docJson) => {
    const testApi = (globalThis as typeof globalThis & { __lumenTestApi?: LumenTestApi })
      .__lumenTestApi;
    const viaTestApi = testApi?.setJSON?.(docJson);
    if (viaTestApi === true) {
      return true;
    }
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
          setJSON?: (value: unknown) => boolean;
          forceLayout?: (options?: { immediate?: boolean }) => boolean;
        }
      | undefined;
    const ok = view?.setJSON?.(docJson) === true;
    if (ok) {
      view?.forceLayout?.({ immediate: true });
    }
    return ok;
  }, json);
  expect(result).toBeTruthy();
};

export const getDocumentSnapshot = async (page: Page) =>
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
              textContent?: string;
              toJSON?: () => unknown;
              descendants?: (fn: (node: { type?: { name?: string } }) => void) => void;
            };
          };
        }
      | undefined;
    const doc = view?.state?.doc;
    const typeCounts: Record<string, number> = {};
    doc?.descendants?.((node) => {
      const typeName = String(node?.type?.name || "unknown");
      typeCounts[typeName] = (typeCounts[typeName] || 0) + 1;
    });
    return {
      textContent: String(doc?.textContent || ""),
      typeCounts,
      json: doc?.toJSON?.() ?? null,
    };
  });

export const setParagraphDocument = async (page: Page, paragraphs: string[]) => {
  await setDocumentJson(page, buildParagraphDocJson(paragraphs));
};

export const submitVisibleToolbarDialog = async (page: Page) => {
  const dialog = page.locator(".t-dialog:visible").last();
  if ((await dialog.count()) === 0) {
    return false;
  }
  await dialog.locator(".t-dialog__footer button").last().click();
  await expect(dialog).toBeHidden();
  return true;
};

export const fillVisibleToolbarDialog = async (page: Page, values: string[] = []) => {
  const dialog = page.locator(".t-dialog:visible").last();
  if ((await dialog.count()) === 0) {
    return false;
  }
  await expect(dialog).toBeVisible();
  const fields = dialog.locator(
    ".toolbar-input-dialog textarea, .toolbar-input-dialog input:not([type='hidden'])",
  );
  const fieldCount = await fields.count();
  for (let index = 0; index < Math.min(values.length, fieldCount); index += 1) {
    await fields.nth(index).fill(values[index] ?? "");
  }
  await dialog.locator(".t-dialog__footer button").last().click();
  await expect(dialog).toBeHidden();
  return true;
};

export const submitVisibleSignatureDialog = async (
  page: Page,
  options: { signer?: string } = {},
) => {
  const dialog = page.locator(".t-dialog:visible").filter({ has: page.locator(".signature-dialog") });
  if ((await dialog.count()) === 0) {
    return false;
  }
  const activeDialog = dialog.last();
  await expect(activeDialog).toBeVisible();
  if (typeof options.signer === "string") {
    const signerInput = activeDialog.locator(".signature-dialog input").first();
    if ((await signerInput.count()) > 0) {
      await signerInput.fill(options.signer);
    }
  }
  const canvas = activeDialog.locator("canvas.signature-dialog-pad");
  await expect(canvas).toBeVisible();
  await canvas.evaluate((node) => {
    const target = node as HTMLCanvasElement;
    const rect = target.getBoundingClientRect();
    const dispatch = (type: string, x: number, y: number) => {
      const event = new PointerEvent(type, {
        bubbles: true,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
        clientX: rect.left + x,
        clientY: rect.top + y,
      });
      target.dispatchEvent(event);
    };
    dispatch("pointerdown", 40, 60);
    dispatch("pointermove", 120, 36);
    dispatch("pointermove", 220, 68);
    dispatch("pointerup", 220, 68);
  });
  const confirmButton = activeDialog.locator(".t-dialog__footer button").filter({ hasText: "Insert" });
  if ((await confirmButton.count()) > 0) {
    await confirmButton.click();
  } else {
    await activeDialog.locator(".t-dialog__footer button").first().click();
  }
  await expect
    .poll(async () => (await activeDialog.count()) === 0 || !(await activeDialog.isVisible()))
    .toBeTruthy();
  return true;
};

export const waitForLayoutIdle = async (page: Page) => {
  await expect
    .poll(async () =>
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
              _internals?: {
                renderSync?: {
                  isLayoutPending?: () => boolean;
                };
              };
            }
          | undefined;
        return view?._internals?.renderSync?.isLayoutPending?.() === true ? "pending" : "idle";
      }),
    )
    .toBe("idle");
};

export const forceEditorRender = async (page: Page) => {
  const ok = await page.evaluate(() => {
    const testApi = (globalThis as typeof globalThis & { __lumenTestApi?: LumenTestApi })
      .__lumenTestApi;
    return testApi?.forceRender?.() === true;
  });
  expect(ok).toBeTruthy();
};

export const getPaginationInfo = async (page: Page): Promise<PaginationInfo | null> =>
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
          getPaginationInfo?: () => PaginationInfo | null;
        }
      | undefined;
    return view?.getPaginationInfo?.() ?? null;
  });

export const waitForPageCount = async (page: Page, minPageCount: number) => {
  await expect
    .poll(async () => (await getPaginationInfo(page))?.pageCount ?? 0)
    .toBeGreaterThanOrEqual(minPageCount);
};

export const getSelectionRange = async (page: Page) =>
  page.evaluate(() => {
    const testApi = (globalThis as typeof globalThis & { __lumenTestApi?: LumenTestApi })
      .__lumenTestApi;
    const testSelection = testApi?.getSelection?.();
    if (testSelection) {
      return testSelection;
    }
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

export const getCaretRect = async (page: Page) =>
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
          _internals?: {
            getCaretRect?: () =>
              | {
                  x?: number;
                  y?: number;
                  width?: number;
                  height?: number;
                }
              | null;
          };
        }
      | undefined;
    const rect = view?._internals?.getCaretRect?.() ?? null;
    if (!rect) {
      return null;
    }
    return {
      x: Number(rect.x ?? 0),
      y: Number(rect.y ?? 0),
      width: Number(rect.width ?? 0),
      height: Number(rect.height ?? 0),
    };
  });

export const setTextSelection = async (page: Page, from: number, to: number) => {
  const ok = await page.evaluate(
    ({ selectionFrom, selectionTo }) => {
      const testApi = (globalThis as typeof globalThis & { __lumenTestApi?: LumenTestApi })
        .__lumenTestApi;
      return testApi?.setSelection?.(selectionFrom, selectionTo) === true;
    },
    { selectionFrom: from, selectionTo: to },
  );
  expect(ok).toBeTruthy();
};

export const getParagraphDocPos = async (
  page: Page,
  paragraphIndex: number,
  charOffset: number,
) =>
  page.evaluate(
    ({ targetParagraphIndex, targetCharOffset }) => {
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
                  fn: (node: { type?: { name?: string }; content?: { size?: number } }, pos: number) => void
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

export const getCoordsAtDocPos = async (page: Page, pos: number) =>
  page.evaluate((targetPos) => {
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
          coordsAtPos?: (pos: number) => { left: number; right: number; top: number; bottom: number } | null;
        }
      | undefined;
    const rect = view?.coordsAtPos?.(targetPos);
    if (!rect) {
      return null;
    }
    return {
      x: (rect.left + rect.right) / 2,
      y: (rect.top + rect.bottom) / 2,
      rect,
    };
  }, pos);

export const getPosAtViewportCoords = async (page: Page, x: number, y: number) =>
  page.evaluate(
    ({ targetX, targetY }) => {
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

export const scrollDocPosIntoView = async (page: Page, pos: number) => {
  await page.evaluate((targetPos) => {
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
          scrollIntoView?: (pos?: number) => void;
        }
      | undefined;
    view?.scrollIntoView?.(targetPos);
  }, pos);
};

export const getRendererCacheStats = async (page: Page) =>
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
          _internals?: {
            renderer?: {
              pageCache?: Map<number, { canvas?: HTMLCanvasElement; displayList?: unknown[] }>;
            };
          };
        }
      | undefined;
    const pageCache = view?._internals?.renderer?.pageCache;
    const entries = pageCache ? Array.from(pageCache.entries()) : [];
    return {
      entryCount: entries.length,
      canvasCount: entries.filter(([, entry]) => !!entry?.canvas).length,
      displayListCount: entries.filter(([, entry]) => Array.isArray(entry?.displayList)).length,
    };
  });

export const getRendererDisplayListSnapshot = async (page: Page) =>
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
          _internals?: {
            renderer?: {
              pageCache?: Map<
                number,
                {
                  signature?: number | null;
                  displayList?: { signature?: number | null; items?: unknown[] } | null;
                }
              >;
            };
          };
        }
      | undefined;
    const pageCache = view?._internals?.renderer?.pageCache;
    const entries = pageCache ? Array.from(pageCache.entries()) : [];
    return entries.map(([pageIndex, entry]) => ({
      pageIndex,
      signature: entry?.signature ?? null,
      displayListSignature: entry?.displayList?.signature ?? null,
      displayListItemCount: Array.isArray(entry?.displayList?.items) ? entry.displayList.items.length : 0,
    }));
  });

export const probePageSurfaceRegionByBlockId = async (
  page: Page,
  blockId: string,
  options: {
    paddingX?: number;
    paddingY?: number;
    sampleColumns?: number;
    sampleRows?: number;
    maxWidth?: number;
  } = {},
) =>
  page.evaluate(
    ({ targetBlockId, targetOptions }) => {
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
                pageWidth?: number;
                pages?: Array<{
                  boxes?: Array<Record<string, unknown>>;
                }>;
              };
              renderer?: {
                pageCache?: Map<
                  number,
                  {
                    canvas?: OffscreenCanvas | HTMLCanvasElement;
                    ctx?: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
                    dprX?: number;
                    dprY?: number;
                  }
                >;
              };
            };
          }
        | undefined;
      const layout = view?._internals?.getLayout?.();
      const pageCache = view?._internals?.renderer?.pageCache;
      if (!layout || !Array.isArray(layout.pages) || !pageCache) {
        return null;
      }

      const isTextLineBox = (box: Record<string, unknown> | null | undefined) =>
        String(box?.role || "") === "text-line" || String(box?.type || "") === "text-line";

      const matchesBlockId = (box: Record<string, unknown> | null | undefined) =>
        !!box &&
        (String(box.blockId ?? "") === String(targetBlockId) ||
          String(box.nodeId ?? "") === String(targetBlockId));

      const collect = (
        boxes: Array<Record<string, unknown>>,
        pageIndex: number,
        depth = 0,
        hits: Array<{ box: Record<string, unknown>; pageIndex: number; depth: number }> = [],
      ) => {
        for (const box of boxes) {
          if (!box || typeof box !== "object") {
            continue;
          }
          if (matchesBlockId(box)) {
            hits.push({ box, pageIndex, depth });
          }
          const children = Array.isArray(box.children)
            ? box.children.filter(
                (value): value is Record<string, unknown> => !!value && typeof value === "object",
              )
            : [];
          if (children.length > 0) {
            collect(children, pageIndex, depth + 1, hits);
          }
        }
        return hits;
      };

      const hits = layout.pages.flatMap((pageState, pageIndex) =>
        collect(
          Array.isArray(pageState?.boxes)
            ? pageState.boxes.filter(
                (value): value is Record<string, unknown> => !!value && typeof value === "object",
              )
            : [],
          pageIndex,
        ),
      );
      if (hits.length === 0) {
        return null;
      }

      const filteredHits = hits.some((hit) => !isTextLineBox(hit.box))
        ? hits.filter((hit) => !isTextLineBox(hit.box))
        : hits;
      filteredHits.sort((a, b) => a.depth - b.depth);
      const best = filteredHits[0];
      const box = best?.box;
      const pageIndex = Number(best?.pageIndex ?? -1);
      const entry = pageCache.get(pageIndex);
      const canvas = entry?.canvas;
      const ctx = entry?.ctx ?? canvas?.getContext?.("2d");
      if (!box || pageIndex < 0 || !canvas || !ctx) {
        return null;
      }

      const boxX = Number(box.x ?? 0);
      const boxY = Number(box.y ?? 0);
      const boxWidth = Number(box.width ?? 0);
      const boxHeight = Number(box.height ?? 0);
      const paddingX = Math.max(0, Number(targetOptions?.paddingX ?? 20));
      const paddingY = Math.max(0, Number(targetOptions?.paddingY ?? 20));
      const sampleColumns = Math.max(1, Number(targetOptions?.sampleColumns ?? 4));
      const sampleRows = Math.max(1, Number(targetOptions?.sampleRows ?? 3));
      const maxWidth = Math.max(24, Number(targetOptions?.maxWidth ?? 220));
      const pageWidth = Number(layout.pageWidth ?? 0);
      const rightStart = boxX + boxWidth + paddingX;
      const rightEnd = Math.min(pageWidth - 24, rightStart + maxWidth);
      const top = boxY + Math.min(paddingY, Math.max(0, boxHeight / 4));
      const bottom = boxY + Math.max(boxHeight - paddingY, boxHeight / 2);

      if (!(rightEnd > rightStart && bottom > top)) {
        return null;
      }

      const dprX = Number(entry?.dprX ?? 1) || 1;
      const dprY = Number(entry?.dprY ?? 1) || 1;
      const samples: Array<{
        x: number;
        y: number;
        rgba: number[];
      }> = [];

      for (let row = 0; row < sampleRows; row += 1) {
        const y =
          sampleRows === 1 ? (top + bottom) / 2 : top + ((bottom - top) * row) / (sampleRows - 1);
        for (let col = 0; col < sampleColumns; col += 1) {
          const x =
            sampleColumns === 1
              ? (rightStart + rightEnd) / 2
              : rightStart + ((rightEnd - rightStart) * col) / (sampleColumns - 1);
          const pixelX = Math.max(0, Math.min(canvas.width - 1, Math.round(x * dprX)));
          const pixelY = Math.max(0, Math.min(canvas.height - 1, Math.round(y * dprY)));
          const imageData = ctx.getImageData(pixelX, pixelY, 1, 1).data;
          samples.push({
            x,
            y,
            rgba: Array.from(imageData),
          });
        }
      }

      return {
        pageIndex,
        probeRect: {
          x: rightStart,
          y: top,
          width: rightEnd - rightStart,
          height: bottom - top,
        },
        samples,
      };
    },
    { targetBlockId: blockId, targetOptions: options },
  );

export const getOverlayRect = async (page: Page, selector: string) =>
  page.evaluate((targetSelector) => {
    const element = document.querySelector(targetSelector) as HTMLElement | null;
    if (!element) {
      return null;
    }
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      display: style.display,
      visibility: style.visibility,
    };
  }, selector);

export const probeOverlayCanvasPixel = async (page: Page, point: { x: number; y: number }) =>
  page.evaluate(({ x, y }) => {
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
            renderer?: {
              overlayCanvas?: HTMLCanvasElement;
            };
          };
        }
      | undefined;
    const canvas = view?._internals?.renderer?.overlayCanvas ?? null;
    const ctx = canvas?.getContext?.("2d") ?? null;
    if (!canvas || !ctx) {
      return null;
    }
    const viewportWidth = Math.max(1, window.innerWidth);
    const viewportHeight = Math.max(1, window.innerHeight);
    const dprX = canvas.width / viewportWidth;
    const dprY = canvas.height / viewportHeight;
    const pixelX = Math.max(0, Math.min(canvas.width - 1, Math.round(x * dprX)));
    const pixelY = Math.max(0, Math.min(canvas.height - 1, Math.round(y * dprY)));
    return Array.from(ctx.getImageData(pixelX, pixelY, 1, 1).data);
  }, point);

export const getEditorSettingsSnapshot = async (page: Page) =>
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
          _internals?: {
            settings?: Record<string, unknown>;
          };
        }
      | undefined;
    const settings = view?._internals?.settings as Record<string, unknown> | undefined;
    const appearance =
      settings?.__lumenPageAppearanceState &&
      typeof settings.__lumenPageAppearanceState === "object"
        ? (settings.__lumenPageAppearanceState as Record<string, unknown>)
        : {};
    const margin =
      settings?.margin && typeof settings.margin === "object"
        ? (settings.margin as Record<string, unknown>)
        : {};
    return {
      pageWidth: Number(settings?.pageWidth || 0),
      pageHeight: Number(settings?.pageHeight || 0),
      lineHeight: Number(settings?.lineHeight || 0),
      margin: {
        left: Number(margin.left || 0),
        right: Number(margin.right || 0),
        top: Number(margin.top || 0),
        bottom: Number(margin.bottom || 0),
      },
      appearance: {
        showLineNumbers: appearance.showLineNumbers === true,
        backgroundColor:
          typeof appearance.backgroundColor === "string" ? appearance.backgroundColor : null,
        watermarkText: typeof appearance.watermarkText === "string" ? appearance.watermarkText : "",
        headerText: typeof appearance.headerText === "string" ? appearance.headerText : "",
        footerText: typeof appearance.footerText === "string" ? appearance.footerText : "",
      },
    };
  });

export const getLayoutFragmentSummaries = async (page: Page, targetType?: string) =>
  page.evaluate((typeFilter) => {
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
              }>;
            };
          };
        }
      | undefined;
    const layout = view?._internals?.getLayout?.();
    const readField = (fragment: Record<string, unknown>, key: string, alias?: string) => {
      const candidates = [
        fragment,
        fragment.continuation,
        fragment.blockAttrs,
        fragment.attrs,
        fragment.meta,
        fragment.listMeta,
        fragment.tableMeta,
        fragment.tableOwnerMeta,
        fragment.ownerMeta,
      ].filter((value): value is Record<string, unknown> => !!value && typeof value === "object");
      for (const candidate of candidates) {
        if (key in candidate) {
          return candidate[key];
        }
        if (alias && alias in candidate) {
          return candidate[alias];
        }
      }
      return null;
    };
    const collectFragments = (fragment: Record<string, unknown>, pageIndex: number) => {
      const children = Array.isArray(fragment?.children)
        ? fragment.children.filter(
            (value): value is Record<string, unknown> => !!value && typeof value === "object",
          )
        : [];
      const carryState = readField(fragment, "carryState", "fragmentCarryState");
      const current =
        !typeFilter || fragment?.type === typeFilter
          ? [
              {
                pageIndex,
                type: fragment?.type ?? null,
                role: fragment?.role ?? null,
                blockId: fragment?.blockId ?? null,
                nodeId: fragment?.nodeId ?? null,
                x: Number(fragment?.x ?? 0),
                y: Number(fragment?.y ?? 0),
                width: Number(fragment?.width ?? 0),
                height: Number(fragment?.height ?? 0),
                fragmentIdentity: readField(fragment, "fragmentIdentity"),
                continuationToken: readField(
                  fragment,
                  "continuationToken",
                  "fragmentContinuationToken",
                ),
                fromPrev: readField(fragment, "fromPrev", "continuedFromPrev"),
                hasNext: readField(fragment, "hasNext", "continuesAfter"),
                rowSplit: readField(fragment, "rowSplit"),
                carryState,
                carryStateKind:
                  carryState && typeof carryState === "object" && "kind" in carryState
                    ? carryState.kind
                    : null,
              },
            ]
          : [];
      return current.concat(children.flatMap((child) => collectFragments(child, pageIndex)));
    };
    return (layout?.pages ?? []).flatMap((page, pageIndex) =>
      (page.fragments ?? []).flatMap((fragment) => collectFragments(fragment, pageIndex)),
    );
  }, targetType);

export const getLayoutLineContinuationSummaries = async (page: Page) =>
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
          _internals?: {
            getLayout?: () => {
              pages?: Array<{
                lines?: Array<Record<string, unknown>>;
              }>;
            };
          };
        }
      | undefined;
    const layout = view?._internals?.getLayout?.();
    const readAttr = (line: Record<string, unknown>, key: string, alias?: string) => {
      const blockAttrs =
        line.blockAttrs && typeof line.blockAttrs === "object"
          ? (line.blockAttrs as Record<string, unknown>)
          : null;
      const tableMeta =
        line.tableMeta && typeof line.tableMeta === "object"
          ? (line.tableMeta as Record<string, unknown>)
          : null;
      const tableOwnerMeta =
        line.tableOwnerMeta && typeof line.tableOwnerMeta === "object"
          ? (line.tableOwnerMeta as Record<string, unknown>)
          : null;
      for (const candidate of [blockAttrs, tableMeta, tableOwnerMeta]) {
        if (!candidate) {
          continue;
        }
        if (key in candidate) {
          return candidate[key];
        }
        if (alias && alias in candidate) {
          return candidate[alias];
        }
      }
      return null;
    };
    return (layout?.pages ?? []).flatMap((page, pageIndex) =>
      (page.lines ?? []).map((line) => {
        const carryState =
          readAttr(line, "carryState", "fragmentCarryState") ??
          readAttr(line, "fragmentCarryState");
        return {
          pageIndex,
          blockType: line?.blockType ?? null,
          blockId: line?.blockId ?? null,
          rowIndex:
            readAttr(line, "absoluteRowIndex") ??
            readAttr(line, "rowIndex"),
          sliceRowIndex: readAttr(line, "sliceRowIndex"),
          rows: readAttr(line, "rows"),
          cols: readAttr(line, "cols"),
          tableKey: readAttr(line, "tableKey"),
          tableHeight: readAttr(line, "tableHeight"),
          fragmentIdentity: readAttr(line, "fragmentIdentity"),
          continuationToken: readAttr(line, "continuationToken", "fragmentContinuationToken"),
          fromPrev: readAttr(line, "fromPrev"),
          hasNext: readAttr(line, "hasNext"),
          rowSplit: readAttr(line, "rowSplit"),
          carryState,
          carryStateKind:
            carryState && typeof carryState === "object" && "kind" in carryState
              ? carryState.kind
              : null,
        };
      }),
    );
  });

export const selectRangeWithMouse = async (page: Page, fromPos: number, toPos: number) => {
  const from = await getCoordsAtDocPos(page, fromPos);
  const to = await getCoordsAtDocPos(page, toPos);
  expect(from).not.toBeNull();
  expect(to).not.toBeNull();
  await page.mouse.move(from!.x, from!.y);
  await page.mouse.down();
  await page.mouse.move(to!.x, to!.y, { steps: 12 });
  await page.mouse.up();
};

export const getLayoutBoxViewportRectByBlockId = async (page: Page, blockId: string) =>
  page.evaluate((targetBlockId) => {
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
            dom?: {
              scrollArea?: HTMLElement;
            };
            getLayout?: () => {
              pageWidth?: number;
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
      return null;
    }

    const matchesBlockId = (box: Record<string, unknown> | null | undefined) => {
      if (!box) {
        return false;
      }
      return (
        String(box.blockId ?? "") === String(targetBlockId) ||
        String(box.nodeId ?? "") === String(targetBlockId)
      );
    };

    const isTextLineBox = (box: Record<string, unknown> | null | undefined) =>
      String(box?.role || "") === "text-line" || String(box?.type || "") === "text-line";

    const collect = (
      boxes: Array<Record<string, unknown>>,
      pageIndex: number,
      depth = 0,
      hits: Array<{ box: Record<string, unknown>; pageIndex: number; depth: number }> = [],
    ) => {
      for (const box of boxes) {
        if (!box || typeof box !== "object") {
          continue;
        }
        if (matchesBlockId(box)) {
          hits.push({ box, pageIndex, depth });
        }
        const children = Array.isArray(box.children)
          ? box.children.filter(
              (value): value is Record<string, unknown> => !!value && typeof value === "object",
            )
          : [];
        if (children.length > 0) {
          collect(children, pageIndex, depth + 1, hits);
        }
      }
      return hits;
    };

    const hits = layout.pages.flatMap((page, pageIndex) =>
      collect(
        Array.isArray(page?.boxes)
          ? page.boxes.filter(
              (value): value is Record<string, unknown> => !!value && typeof value === "object",
            )
          : [],
        pageIndex,
      ),
    );
    if (hits.length === 0) {
      return null;
    }
    const filteredHits = hits.some((hit) => !isTextLineBox(hit.box))
      ? hits.filter((hit) => !isTextLineBox(hit.box))
      : hits;
    filteredHits.sort((a, b) => a.depth - b.depth);
    const best = filteredHits[0];
    const box = best?.box;
    const x = Number(box?.x);
    const y = Number(box?.y);
    const width = Number(box?.width);
    const height = Number(box?.height);
    if (![x, y, width, height].every(Number.isFinite)) {
      return null;
    }

    const pageX = Math.max(0, (scrollArea.clientWidth - Number(layout.pageWidth || 0)) / 2);
    const pageSpan = Number(layout.pageHeight || 0) + Number(layout.pageGap || 0);
    const scrollRect = scrollArea.getBoundingClientRect();
    return {
      x: scrollRect.left + pageX + x,
      y: scrollRect.top + best.pageIndex * pageSpan - scrollArea.scrollTop + y,
      width,
      height,
      pageIndex: best.pageIndex,
    };
  }, blockId);

export const getLayoutBoxSummaryByBlockId = async (page: Page, blockId: string) =>
  page.evaluate((targetBlockId) => {
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
                boxes?: Array<Record<string, unknown>>;
              }>;
            };
          };
        }
      | undefined;
    const layout = view?._internals?.getLayout?.();
    if (!layout || !Array.isArray(layout.pages)) {
      return null;
    }

    const matchesBlockId = (box: Record<string, unknown> | null | undefined) => {
      if (!box) {
        return false;
      }
      return (
        String(box.blockId ?? "") === String(targetBlockId) ||
        String(box.nodeId ?? "") === String(targetBlockId)
      );
    };

    const isTextLineBox = (box: Record<string, unknown> | null | undefined) =>
      String(box?.role || "") === "text-line" || String(box?.type || "") === "text-line";

    const collect = (
      boxes: Array<Record<string, unknown>>,
      pageIndex: number,
      depth = 0,
      hits: Array<{ box: Record<string, unknown>; pageIndex: number; depth: number }> = [],
    ) => {
      for (const box of boxes) {
        if (!box || typeof box !== "object") {
          continue;
        }
        if (matchesBlockId(box)) {
          hits.push({ box, pageIndex, depth });
        }
        const children = Array.isArray(box.children)
          ? box.children.filter(
              (value): value is Record<string, unknown> => !!value && typeof value === "object",
            )
          : [];
        if (children.length > 0) {
          collect(children, pageIndex, depth + 1, hits);
        }
      }
      return hits;
    };

    const hits = layout.pages.flatMap((page, pageIndex) =>
      collect(
        Array.isArray(page?.boxes)
          ? page.boxes.filter(
              (value): value is Record<string, unknown> => !!value && typeof value === "object",
            )
          : [],
        pageIndex,
      ),
    );
    if (hits.length === 0) {
      return null;
    }

    const filteredHits = hits.some((hit) => !isTextLineBox(hit.box))
      ? hits.filter((hit) => !isTextLineBox(hit.box))
      : hits;
    filteredHits.sort((a, b) => a.depth - b.depth);
    const best = filteredHits[0];
    return {
      pageIndex: best.pageIndex,
      x: Number(best.box?.x ?? 0),
      y: Number(best.box?.y ?? 0),
      width: Number(best.box?.width ?? 0),
      height: Number(best.box?.height ?? 0),
    };
  }, blockId);

export const getLayoutBoxSummariesByBlockId = async (page: Page, blockId: string) =>
  page.evaluate((targetBlockId) => {
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
                boxes?: Array<Record<string, unknown>>;
              }>;
            };
          };
        }
      | undefined;
    const layout = view?._internals?.getLayout?.();
    if (!layout || !Array.isArray(layout.pages)) {
      return [];
    }

    const matchesBlockId = (box: Record<string, unknown> | null | undefined) =>
      !!box &&
      (String(box.blockId ?? "") === String(targetBlockId) ||
        String(box.nodeId ?? "") === String(targetBlockId));

    const collect = (
      boxes: Array<Record<string, unknown>>,
      pageIndex: number,
      depth = 0,
      hits: Array<{
        pageIndex: number;
        depth: number;
        x: number;
        y: number;
        width: number;
        height: number;
        role: string;
        type: string;
        blockId: string;
        nodeId: string;
      }> = [],
    ) => {
      for (const box of boxes) {
        if (!box || typeof box !== "object") {
          continue;
        }
        if (matchesBlockId(box)) {
          hits.push({
            pageIndex,
            depth,
            x: Number(box.x ?? 0),
            y: Number(box.y ?? 0),
            width: Number(box.width ?? 0),
            height: Number(box.height ?? 0),
            role: String(box.role ?? ""),
            type: String(box.type ?? ""),
            blockId: String(box.blockId ?? ""),
            nodeId: String(box.nodeId ?? ""),
          });
        }
        const children = Array.isArray(box.children)
          ? box.children.filter(
              (value): value is Record<string, unknown> => !!value && typeof value === "object",
            )
          : [];
        if (children.length > 0) {
          collect(children, pageIndex, depth + 1, hits);
        }
      }
      return hits;
    };

    return layout.pages.flatMap((page, pageIndex) =>
      collect(
        Array.isArray(page?.boxes)
          ? page.boxes.filter(
              (value): value is Record<string, unknown> => !!value && typeof value === "object",
            )
          : [],
        pageIndex,
      ),
    );
  }, blockId);

export const getNodeAttrsByBlockId = async (page: Page, blockId: string) =>
  page.evaluate((targetBlockId) => {
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
                fn: (node: { attrs?: Record<string, unknown> }, pos: number) => boolean | void,
              ) => void;
            };
          };
        }
      | undefined;
    const doc = view?.state?.doc;
    if (!doc?.descendants) {
      return null;
    }
    let matchedAttrs: Record<string, unknown> | null = null;
    doc.descendants((node) => {
      if (String(node?.attrs?.id ?? "") !== String(targetBlockId)) {
        return;
      }
      matchedAttrs = { ...(node.attrs || {}) };
      return false;
    });
    return matchedAttrs;
  }, blockId);



