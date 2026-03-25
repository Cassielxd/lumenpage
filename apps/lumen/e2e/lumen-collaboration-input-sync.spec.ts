import { expect, test } from "@playwright/test";

import {
  attachConsoleGuards,
  focusEditor,
  getDocumentSnapshot,
  getCoordsAtDocPos,
  getParagraphDocPos,
  getRendererDisplayListSnapshot,
  setTextSelection,
  setParagraphDocument,
  scrollDocPosIntoView,
  waitForLayoutIdle,
  waitForPageCount,
} from "./helpers";

const collabUrl = process.env.PW_COLLAB_URL || "ws://127.0.0.1:15345";

const createDocumentId = () =>
  `pw-collab-input-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const buildLumenCollabUrl = ({
  docId,
  user,
  color,
  debugGhostTrace = false,
  debugPerf = false,
}: {
  docId: string;
  user: string;
  color: string;
  debugGhostTrace?: boolean;
  debugPerf?: boolean;
}) => {
  const params = new URLSearchParams({
    locale: "en-US",
    collab: "1",
    collabUrl,
    collabDoc: docId,
    collabField: "default",
    collabUser: user,
    collabColor: color,
  });
  if (debugGhostTrace) {
    params.set("debugGhostTrace", "1");
  }
  if (debugPerf) {
    params.set("debugPerf", "1");
  }
  return `/?${params.toString()}`;
};

const waitForSyncedPresence = async (page: import("@playwright/test").Page, userCount: number) => {
  await expect(page.locator(".collab-status-label")).toHaveText("Synced");
  await expect(page.locator(".collab-status-meta")).toContainText(`${userCount} online`);
};

const getDocPosPageIndex = async (page: import("@playwright/test").Page, pos: number) =>
  page.evaluate(async (targetPos) => {
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
          coordsAtPos?: (pos: number) => { top: number; bottom: number } | null;
          _internals?: {
            getLayout?: () => {
              pageHeight?: number;
              pageGap?: number;
            };
            dom?: {
              scrollArea?: HTMLElement | null;
            };
          };
        }
      | undefined;
    const rect = view?.coordsAtPos?.(targetPos);
    const layout = view?._internals?.getLayout?.();
    const scrollArea = view?._internals?.dom?.scrollArea;
    if (!rect || !layout || !scrollArea) {
      return null;
    }
    const scrollRect = scrollArea.getBoundingClientRect();
    const pageSpan = Number(layout.pageHeight || 0) + Number(layout.pageGap || 0);
    if (!(pageSpan > 0)) {
      return null;
    }
    const absoluteTop = rect.top - scrollRect.top + scrollArea.scrollTop;
    return Math.max(0, Math.floor(absoluteTop / pageSpan));
  }, pos);

const findParagraphPositionsOnPage = async (
  page: import("@playwright/test").Page,
  paragraphCount: number,
  targetPageIndex: number,
) => {
  const positions: number[] = [];
  for (let index = 0; index < paragraphCount; index += 1) {
    const pos = await getParagraphDocPos(page, index, 0);
    if (pos == null) {
      continue;
    }
    const pageIndex = await getDocPosPageIndex(page, pos);
    if (pageIndex === targetPageIndex) {
      positions.push(pos);
    }
  }
  return positions;
};

const getCollabRenderDiagnostics = async (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const globalView = (globalThis as typeof globalThis & {
      __lumenView?: unknown;
      __lumenGhostTrace?: Array<Record<string, unknown>>;
      __lumenPerfLogs?: Array<Record<string, unknown>>;
    }).__lumenView as
      | {
          state?: {
            selection?: {
              head?: number;
            };
          };
          _internals?: {
            getLayout?: () => {
              __version?: number;
              __changeSummary?: Record<string, unknown> | null;
              __layoutPerfSummary?: Record<string, unknown> | null;
              __paginationDiagnostics?: Record<string, unknown> | null;
              pages?: Array<{
                rootIndexMin?: number;
                rootIndexMax?: number;
                __reused?: boolean;
                __signature?: number | null;
                __signatureVersion?: number | null;
              }>;
            };
            renderSync?: {
              isLayoutPending?: () => boolean;
            };
            renderer?: {
              lastLayoutVersion?: number | null;
            };
          };
        }
      | undefined;
    const layout = globalView?._internals?.getLayout?.() ?? null;
    const traces = Array.isArray((globalThis as any).__lumenGhostTrace)
      ? (globalThis as any).__lumenGhostTrace.slice(-12)
      : [];
    return {
      selectionHead: Number(globalView?.state?.selection?.head ?? -1),
      layoutVersion: Number(layout?.__version ?? -1),
      layoutDocChanged: layout?.__changeSummary?.docChanged === true,
      changeSummary: layout?.__changeSummary ?? null,
      layoutPerf: layout?.__layoutPerfSummary ?? null,
      paginationDiagnostics: layout?.__paginationDiagnostics ?? null,
      layoutPending: globalView?._internals?.renderSync?.isLayoutPending?.() === true,
      rendererLastLayoutVersion: Number(globalView?._internals?.renderer?.lastLayoutVersion ?? -1),
      pages: Array.isArray(layout?.pages)
        ? layout.pages.map((page, pageIndex) => ({
            pageIndex,
            rootIndexMin: Number(page?.rootIndexMin ?? -1),
            rootIndexMax: Number(page?.rootIndexMax ?? -1),
            reused: page?.__reused === true,
            signature: Number(page?.__signature ?? -1),
            signatureVersion: Number(page?.__signatureVersion ?? -1),
          }))
        : [],
      traces,
      perfLogs: Array.isArray((globalThis as any).__lumenPerfLogs)
        ? (globalThis as any).__lumenPerfLogs.slice(-8)
        : [],
    };
  });

test("remote typing updates the collaborator renderer without requiring a local transaction", async ({
  browser,
}) => {
  const docId = createDocumentId();
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const alice = await aliceContext.newPage();
  const bob = await bobContext.newPage();
  const aliceGuards = attachConsoleGuards(alice);
  const bobGuards = attachConsoleGuards(bob);

  try {
    await Promise.all([
      alice.goto(
        buildLumenCollabUrl({
          docId,
          user: "Alice",
          color: "#2563eb",
          debugGhostTrace: true,
        }),
        { waitUntil: "networkidle" },
      ),
      bob.goto(
        buildLumenCollabUrl({
          docId,
          user: "Bob",
          color: "#dc2626",
          debugGhostTrace: true,
        }),
        { waitUntil: "networkidle" },
      ),
    ]);

    await Promise.all([waitForSyncedPresence(alice, 2), waitForSyncedPresence(bob, 2)]);

    await setParagraphDocument(alice, ["Seed paragraph for collaboration typing."]);
    await Promise.all([waitForLayoutIdle(alice), waitForLayoutIdle(bob)]);

    await expect
      .poll(async () => (await getDocumentSnapshot(bob)).textContent)
      .toContain("Seed paragraph for collaboration typing.");

    await focusEditor(alice);

    const suffixes = Array.from({ length: 12 }, (_, index) => ` sync-${index + 1}`);

    for (const suffix of suffixes) {
      const baselineDisplayList = JSON.stringify(await getRendererDisplayListSnapshot(bob));

      await alice.keyboard.type(suffix, { delay: 35 });

      await expect
        .poll(async () => (await getDocumentSnapshot(bob)).textContent, {
          message: `Bob should receive text "${suffix}" without local interaction`,
          timeout: 8000,
        })
        .toContain(suffix.trim());

      await expect
        .poll(async () => JSON.stringify(await getRendererDisplayListSnapshot(bob)), {
          message: `Bob renderer should refresh for "${suffix}" without an extra local transaction`,
          timeout: 8000,
        })
        .not.toBe(baselineDisplayList);

      await waitForLayoutIdle(bob);
    }

    aliceGuards.assertClean();
    bobGuards.assertClean();
  } finally {
    await aliceContext.close();
    await bobContext.close();
  }
});

test("remote IME commit updates the collaborator renderer without requiring a local transaction", async ({
  browser,
}) => {
  const docId = createDocumentId();
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const alice = await aliceContext.newPage();
  const bob = await bobContext.newPage();
  const aliceGuards = attachConsoleGuards(alice);
  const bobGuards = attachConsoleGuards(bob);

  try {
    await Promise.all([
      alice.goto(
        buildLumenCollabUrl({
          docId,
          user: "Alice",
          color: "#2563eb",
        }),
        { waitUntil: "networkidle" },
      ),
      bob.goto(
        buildLumenCollabUrl({
          docId,
          user: "Bob",
          color: "#dc2626",
        }),
        { waitUntil: "networkidle" },
      ),
    ]);

    await Promise.all([waitForSyncedPresence(alice, 2), waitForSyncedPresence(bob, 2)]);

    await setParagraphDocument(alice, ["Seed paragraph for IME collaboration."]);
    await Promise.all([waitForLayoutIdle(alice), waitForLayoutIdle(bob)]);

    await expect
      .poll(async () => (await getDocumentSnapshot(bob)).textContent)
      .toContain("Seed paragraph for IME collaboration.");

    await focusEditor(alice);

    const imeSuffixes = ["你好", "协作", "同步", "测试", "输入", "提交"];

    for (const imeText of imeSuffixes) {
      const baselineDisplayList = JSON.stringify(await getRendererDisplayListSnapshot(bob));

      const committed = await alice.evaluate((text) => {
        const input = document.querySelector(".lumenpage-input") as HTMLTextAreaElement | null;
        if (!input) {
          return false;
        }
        input.focus();
        input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "" }));
        input.dispatchEvent(new CompositionEvent("compositionupdate", { bubbles: true, data: text }));
        input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: text }));
        return true;
      }, imeText);

      expect(committed).toBeTruthy();

      await expect
        .poll(async () => (await getDocumentSnapshot(bob)).textContent, {
          message: `Bob should receive the IME commit "${imeText}" without local interaction`,
          timeout: 8000,
        })
        .toContain(imeText);

      await expect
        .poll(async () => JSON.stringify(await getRendererDisplayListSnapshot(bob)), {
          message: `Bob renderer should refresh for IME commit "${imeText}" without an extra local transaction`,
          timeout: 8000,
        })
        .not.toBe(baselineDisplayList);
    }

    aliceGuards.assertClean();
    bobGuards.assertClean();
  } finally {
    await aliceContext.close();
    await bobContext.close();
  }
});

test("concurrent typing from both clients stays in sync without extra transactions", async ({
  browser,
}) => {
  const docId = createDocumentId();
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const alice = await aliceContext.newPage();
  const bob = await bobContext.newPage();
  const aliceGuards = attachConsoleGuards(alice);
  const bobGuards = attachConsoleGuards(bob);

  try {
    await Promise.all([
      alice.goto(
        buildLumenCollabUrl({
          docId,
          user: "Alice",
          color: "#2563eb",
        }),
        { waitUntil: "networkidle" },
      ),
      bob.goto(
        buildLumenCollabUrl({
          docId,
          user: "Bob",
          color: "#dc2626",
        }),
        { waitUntil: "networkidle" },
      ),
    ]);

    await Promise.all([waitForSyncedPresence(alice, 2), waitForSyncedPresence(bob, 2)]);

    await setParagraphDocument(alice, ["Alpha paragraph", "Beta paragraph"]);
    await Promise.all([waitForLayoutIdle(alice), waitForLayoutIdle(bob)]);

    const aliceParagraphEnd = await getParagraphDocPos(alice, 0, "Alpha paragraph".length);
    const bobParagraphEnd = await getParagraphDocPos(bob, 1, "Beta paragraph".length);
    expect(aliceParagraphEnd).not.toBeNull();
    expect(bobParagraphEnd).not.toBeNull();

    await focusEditor(alice);
    await setTextSelection(alice, aliceParagraphEnd!, aliceParagraphEnd!);
    await focusEditor(bob);
    await setTextSelection(bob, bobParagraphEnd!, bobParagraphEnd!);

    for (let index = 0; index < 8; index += 1) {
      const aliceText = ` a${index + 1}`;
      const bobText = ` b${index + 1}`;
      const aliceBaselineDisplayList = JSON.stringify(await getRendererDisplayListSnapshot(alice));
      const bobBaselineDisplayList = JSON.stringify(await getRendererDisplayListSnapshot(bob));

      await Promise.all([
        alice.keyboard.type(aliceText, { delay: 20 }),
        bob.keyboard.type(bobText, { delay: 20 }),
      ]);

      await expect
        .poll(async () => (await getDocumentSnapshot(alice)).textContent, {
          message: `Alice should receive Bob's concurrent input "${bobText}" without another local transaction`,
          timeout: 8000,
        })
        .toContain(bobText.trim());
      await expect
        .poll(async () => (await getDocumentSnapshot(bob)).textContent, {
          message: `Bob should receive Alice's concurrent input "${aliceText}" without another local transaction`,
          timeout: 8000,
        })
        .toContain(aliceText.trim());

      await expect
        .poll(async () => JSON.stringify(await getRendererDisplayListSnapshot(alice)), {
          message: `Alice renderer should refresh after Bob's concurrent input "${bobText}"`,
          timeout: 8000,
        })
        .not.toBe(aliceBaselineDisplayList);
      await expect
        .poll(async () => JSON.stringify(await getRendererDisplayListSnapshot(bob)), {
          message: `Bob renderer should refresh after Alice's concurrent input "${aliceText}"`,
          timeout: 8000,
        })
        .not.toBe(bobBaselineDisplayList);
    }

    aliceGuards.assertClean();
    bobGuards.assertClean();
  } finally {
    await aliceContext.close();
    await bobContext.close();
  }
});

test("typing on the second page syncs without waiting for another transaction", async ({
  browser,
}) => {
  const docId = createDocumentId();
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const alice = await aliceContext.newPage();
  const bob = await bobContext.newPage();
  const aliceGuards = attachConsoleGuards(alice);
  const bobGuards = attachConsoleGuards(bob);

  try {
    await Promise.all([
      alice.goto(
        buildLumenCollabUrl({
          docId,
          user: "Alice",
          color: "#2563eb",
        }),
        { waitUntil: "networkidle" },
      ),
      bob.goto(
        buildLumenCollabUrl({
          docId,
          user: "Bob",
          color: "#dc2626",
        }),
        { waitUntil: "networkidle" },
      ),
    ]);

    await Promise.all([waitForSyncedPresence(alice, 2), waitForSyncedPresence(bob, 2)]);

    const paragraphs = Array.from({ length: 20 }, (_, index) =>
      `Paragraph ${index + 1}. ${"This paragraph is intentionally long to force pagination and remote redraw. ".repeat(10)}`,
    );
    await setParagraphDocument(alice, paragraphs);
    await Promise.all([waitForLayoutIdle(alice), waitForLayoutIdle(bob)]);
    await Promise.all([waitForPageCount(alice, 2), waitForPageCount(bob, 2)]);

    const secondPagePositions = await findParagraphPositionsOnPage(alice, paragraphs.length, 1);
    expect(secondPagePositions.length).toBeGreaterThan(0);
    const targetPos =
      secondPagePositions[Math.min(1, secondPagePositions.length - 1)] ?? null;
    expect(targetPos).not.toBeNull();

    await Promise.all([scrollDocPosIntoView(alice, targetPos!), scrollDocPosIntoView(bob, targetPos!)]);
    await Promise.all([waitForLayoutIdle(alice), waitForLayoutIdle(bob)]);

    const alicePageIndex = await getDocPosPageIndex(alice, targetPos!);
    const bobPageIndex = await getDocPosPageIndex(bob, targetPos!);
    expect(alicePageIndex).toBe(1);
    expect(bobPageIndex).toBe(1);

    const targetCoords = await getCoordsAtDocPos(alice, targetPos!);
    expect(targetCoords).not.toBeNull();

    await focusEditor(alice);
    await setTextSelection(alice, targetPos!, targetPos!);

    const suffixes = Array.from({ length: 8 }, (_, index) => ` page2-${index + 1}`);

    for (const suffix of suffixes) {
      const baselineDisplayList = JSON.stringify(await getRendererDisplayListSnapshot(bob));

      await alice.keyboard.type(suffix, { delay: 30 });

      await expect
        .poll(async () => (await getDocumentSnapshot(bob)).textContent, {
          message: `Bob should receive second-page text "${suffix}" without local interaction`,
          timeout: 8000,
        })
        .toContain(suffix.trim());

      const refreshed = await expect
        .poll(async () => JSON.stringify(await getRendererDisplayListSnapshot(bob)), {
          message: `Bob renderer should refresh for second-page text "${suffix}" without an extra local transaction`,
          timeout: 8000,
        })
        .not.toBe(baselineDisplayList)
        .then(
          () => true,
          async (error) => {
            const diagnostics = await getCollabRenderDiagnostics(bob);
            console.log("[collab-second-page-diagnostics]", JSON.stringify(diagnostics, null, 2));
            throw error;
          },
        );

      expect(refreshed).toBeTruthy();
    }

    aliceGuards.assertClean();
    bobGuards.assertClean();
  } finally {
    await aliceContext.close();
    await bobContext.close();
  }
});

