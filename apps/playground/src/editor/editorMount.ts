import {
  basicCommands,
  createCanvasEditorKeymap,
  createDefaultNodeRendererRegistry,
  createDocFromText,
  createViewCommands,
  runCommand,
  schema,
  setBlockAlign,
} from "lumenpage-kit-basic";
import { baseKeymap } from "lumenpage-commands";
import { keymap } from "lumenpage-keymap";
import {
  normalizeNavigableHref,
  resolveLinkHrefAtPos,
  resolveLinkHrefAtSelection,
} from "lumenpage-link";
import {
  CanvasEditorView,
  type NodeSelectionTargetArgs,
  type CanvasEditorViewProps,
  Decoration,
  DecorationSet,
  createBlockIdPlugin,
  createBlockIdTransaction,
  createCanvasState,
} from "lumenpage-view-canvas";
import { createDragHandlePlugin } from "lumenpage-drag-handle";
import { createActiveBlockSelectionPlugin } from "lumenpage-plugin-active-block";
import { history } from "lumenpage-history";
import { inputRules, emDash, ellipsis, smartQuotes } from "lumenpage-inputrules";
import { gapCursor } from "lumenpage-gapcursor";
import { applyLumenDevTools } from "lumenpage-dev-tools";

import type { PlaygroundDebugFlags } from "./config";
import { createCanvasSettings } from "./config";
import { PaginationDocWorkerClient } from "./paginationDocWorkerClient";
import { createPlaygroundPermissionPlugin } from "./permissionPlugin";
import { shouldOpenLinkOnClick } from "./linkPolicy";
import { normalizePastedText, sanitizePastedHtml } from "./pastePolicy";
import {
  runBlockOutlineAlignmentSmoke,
  runCoordsSmoke,
  runScrollIntoViewSmoke,
  runDocRoundtripSmoke,
  runDragActionSmoke,
  runDragSelectionSmoke,
  runHistorySmoke,
  runHtmlIoSmoke,
  runImeActionSmoke,
  runLinkInteractionSmoke,
  runListBehaviorSmoke,
  runLegacyConfigSmoke,
  runMappingSmoke,
  runMarkdownIoSmoke,
  runOrderedListPaginationSmoke,
  runPasteActionSmoke,
  runPerfBudgetSmoke,
  runReadonlySmoke,
  runSelectionBoundarySmoke,
  runSelectionImeSmoke,
  runTableBehaviorStrictSmoke,
  runTableNavigationSmoke,
  runToolCommandSmoke,
} from "./smokeTests";
import { initialDocJson, initialDocPerfJson } from "../initialDoc";

type MountPlaygroundEditorParams = {
  host: HTMLElement;
  statusElement?: HTMLElement | null;
  tableDebugPanelElement?: HTMLElement | null;
  flags: PlaygroundDebugFlags;
};

type MountedPlaygroundEditor = {
  view: CanvasEditorView;
  destroy: () => void;
};

const clearLegacyConfigHits = () => {
  (globalThis as any).__lumenLegacyConfigHits = [];
};

// 缂傚倸鍊归悧鐐垫椤愶箑闂柕濞垮劤閺夎棄銆掑顒夊剰闁搞劌宕娆愭姜閹殿喚鎲块梻浣哥氨閸嬫挻鎱ㄩ敐鍕獢闁逞屽墯濡叉帞娆㈤锔解挅闁糕剝娲濋崢顒勬煥濞戞鎼紁p.vue 闂佸憡鐟禍锝囩矆鐎ｎ剚瀚婚柨婵嗩槶閳ь剙顦靛Λ鍐閿濆孩顥婇梻浣规緲缁夋煡鍩€椤戣法绠?
export const mountPlaygroundEditor = ({
  host,
  statusElement,
  tableDebugPanelElement,
  flags,
}: MountPlaygroundEditorParams): MountedPlaygroundEditor => {
  clearLegacyConfigHits();
  const paginationDocWorkerClient =
    flags.enablePaginationWorker ? new PaginationDocWorkerClient() : null;
  const settings = createCanvasSettings(
    flags.debugPerf,
    flags.enablePaginationWorker,
    flags.forcePaginationWorker
  );
  if (flags.enablePaginationWorker) {
    settings.paginationWorker = {
      ...(settings.paginationWorker || {}),
      enabled: true,
      provider: paginationDocWorkerClient,
    };
  }
  const nodeRegistry = createDefaultNodeRendererRegistry();

  const plugins: any[] = [
    history(),
    createBlockIdPlugin(),
    createActiveBlockSelectionPlugin(),
    keymap(createCanvasEditorKeymap()),
    keymap(baseKeymap),
  ];
  const permissionPlugin = createPlaygroundPermissionPlugin(flags.permissionMode);
  if (permissionPlugin) {
    plugins.push(permissionPlugin);
  }

  if (flags.enableInputRules) {
    const rules = [ellipsis, emDash, ...smartQuotes].filter(Boolean);
    plugins.push(inputRules({ rules }));
  }

  if (flags.enableGapCursor) {
    plugins.push(gapCursor());
  }

  plugins.push(
    createDragHandlePlugin({
      schema,
      nodeRegistry,
      onlyTopLevel: true,
    })
  );

  const editorState = createCanvasState({
    schema,
    createDocFromText,
    json: flags.usePerfDoc ? initialDocPerfJson : initialDocJson,
    plugins,
  });
  const initBlockIdTr = createBlockIdTransaction(editorState);
  const readyState = initBlockIdTr ? editorState.apply(initBlockIdTr) : editorState;

  const isInNodeTypeAtPos = (state: any, pos: number, typeName: string) => {
    if (!state?.doc || !Number.isFinite(pos) || !typeName) {
      return false;
    }
    try {
      const $pos = state.doc.resolve(pos);
      for (let depth = $pos.depth; depth >= 0; depth -= 1) {
        if ($pos.node(depth)?.type?.name === typeName) {
          return true;
        }
      }
    } catch (_error) {
      return false;
    }
    return false;
  };

  const viewProps: CanvasEditorViewProps = {
    state: readyState,
    editable: () => flags.permissionMode !== "readonly",
    canvasViewConfig: {
      settings,
      nodeRegistry,
      debug: flags.debugTimingLogs
        ? ({ timing: true, eventTiming: true, paginationTiming: true, renderTiming: true } as any)
        : undefined,
      legacyPolicy: { strict: true },
      statusElement: statusElement || undefined,
      tablePaginationPanelEl: flags.debugTablePagination
        ? tableDebugPanelElement || undefined
        : undefined,
    },
    commandConfig: {
      basicCommands,
      runCommand,
      setBlockAlign,
      viewCommands: createViewCommands(),
    },
    transformPastedText: (_view: CanvasEditorView, text: string) => normalizePastedText(text),
    transformPastedHTML: (_view: CanvasEditorView, html: string) => sanitizePastedHtml(html),
    nodeSelectionTypes: ["image", "video", "horizontal_rule"],
    isInSpecialStructureAtPos: (_view: CanvasEditorView, state: any, pos: number) =>
      isInNodeTypeAtPos(state, pos, "table"),
    isNodeSelectionTarget: (_view: CanvasEditorView, args: NodeSelectionTargetArgs) => {
      const nodeType = args?.node?.type?.name;
      if (nodeType === "table" || nodeType === "table_row" || nodeType === "table_cell") {
        return false;
      }
      return null;
    },
    handleKeyDown: (_view: CanvasEditorView, event: KeyboardEvent) => {
      const isMod = !!event?.metaKey || !!event?.ctrlKey;
      const isEnter = event?.key === "Enter";
      if (!isMod || !isEnter) {
        return false;
      }
      const rawHref = resolveLinkHrefAtSelection(_view?.state);
      const href = normalizeNavigableHref(rawHref || "");
      if (!href) {
        return false;
      }
      if (typeof window !== "undefined") {
        window.open(href, "_blank", "noopener,noreferrer");
      }
      event?.preventDefault?.();
      return true;
    },
    handleClick: (_view: CanvasEditorView, pos: number, event: MouseEvent) => {
      const rawHref = resolveLinkHrefAtPos(_view?.state, pos);
      const href = normalizeNavigableHref(rawHref || "");
      if (!href) {
        return false;
      }
      const wantsOpen = shouldOpenLinkOnClick(flags.permissionMode, event);
      if (!wantsOpen) {
        return false;
      }
      if (typeof window !== "undefined") {
        window.open(href, "_blank", "noopener,noreferrer");
      }
      event?.preventDefault?.();
      return true;
    },
  };

  if (flags.debugDuplicateDecorations) {
    viewProps.decorations = (state: any) => {
      const docSize = state?.doc?.content?.size ?? 0;
      const from = Math.min(2, Math.max(0, docSize));
      const to = Math.min(from + 8, docSize);
      if (to <= from) {
        return null;
      }
      return DecorationSet.create(state.doc, [
        Decoration.inline(from, to, { backgroundColor: "rgba(239, 68, 68, 0.28)" }),
      ]);
    };
  }

  const view = new CanvasEditorView(host, viewProps);
  let detachDevTools: null | (() => void) = null;
  if (flags.debugDevTools) {
    detachDevTools = applyLumenDevTools(view as any);
  }

  if (flags.debugTablePagination && tableDebugPanelElement) {
    tableDebugPanelElement.textContent = "Waiting for table pagination...";
  }
  const smokeQueue: Array<() => void | Promise<void>> = [];
  const enqueueSmoke = (enabled: boolean, runner: () => void | Promise<void>) => {
    if (enabled) {
      smokeQueue.push(runner);
    }
  };
  const addSmokeByFlags = () => {
    enqueueSmoke(
      flags.debugTableBehaviorSmoke,
      () => runTableBehaviorStrictSmoke(view, tableDebugPanelElement || null)
    );
    enqueueSmoke(
      flags.debugTableSmoke,
      () => runTableNavigationSmoke(view, tableDebugPanelElement || null)
    );
    enqueueSmoke(
      flags.debugListSmoke,
      () => runOrderedListPaginationSmoke(view, tableDebugPanelElement || null)
    );
    enqueueSmoke(
      flags.debugListBehaviorSmoke,
      () => runListBehaviorSmoke(view, tableDebugPanelElement || null)
    );
    enqueueSmoke(
      flags.debugBlockOutlineSmoke,
      () => runBlockOutlineAlignmentSmoke(view, tableDebugPanelElement || null)
    );
    enqueueSmoke(
      flags.debugDragSmoke,
      () => runDragSelectionSmoke(view, tableDebugPanelElement || null)
    );
    enqueueSmoke(
      flags.debugDragActionSmoke,
      () => runDragActionSmoke(view, tableDebugPanelElement || null)
    );
    enqueueSmoke(
      flags.debugSelectionImeSmoke,
      () => runSelectionImeSmoke(view, tableDebugPanelElement || null)
    );
    enqueueSmoke(
      flags.debugSelectionBoundarySmoke,
      () => runSelectionBoundarySmoke(view, tableDebugPanelElement || null)
    );
    enqueueSmoke(
      flags.debugToolSmoke,
      () => runToolCommandSmoke(view, tableDebugPanelElement || null)
    );
    enqueueSmoke(
      flags.debugPasteSmoke,
      () => runPasteActionSmoke(view, tableDebugPanelElement || null)
    );
    enqueueSmoke(
      flags.debugMappingSmoke,
      () => runMappingSmoke(view, tableDebugPanelElement || null)
    );
    enqueueSmoke(
      flags.debugCoordsSmoke,
      () => runCoordsSmoke(view, tableDebugPanelElement || null)
    );
    enqueueSmoke(
      flags.debugScrollSmoke,
      () => runScrollIntoViewSmoke(view, tableDebugPanelElement || null)
    );
    enqueueSmoke(
      flags.debugReadonlySmoke,
      () => runReadonlySmoke(view, tableDebugPanelElement || null)
    );
    enqueueSmoke(
      flags.debugDocRoundtripSmoke,
      () => runDocRoundtripSmoke(view, tableDebugPanelElement || null)
    );
    enqueueSmoke(flags.debugMarkdownIoSmoke, () => runMarkdownIoSmoke(tableDebugPanelElement || null));
    enqueueSmoke(flags.debugHtmlIoSmoke, () =>
      runHtmlIoSmoke(view, tableDebugPanelElement || null)
    );
    enqueueSmoke(flags.debugLinkSmoke, () =>
      runLinkInteractionSmoke(tableDebugPanelElement || null)
    );
    enqueueSmoke(
      flags.debugPerfBudgetSmoke,
      () => runPerfBudgetSmoke(view, tableDebugPanelElement || null)
    );
    enqueueSmoke(
      flags.debugLegacyConfigSmoke,
      () => runLegacyConfigSmoke(tableDebugPanelElement || null)
    );
    enqueueSmoke(
      flags.debugHistorySmoke,
      () => runHistorySmoke(view, tableDebugPanelElement || null)
    );
    enqueueSmoke(
      flags.debugImeActionSmoke,
      () => runImeActionSmoke(view, tableDebugPanelElement || null)
    );
  };
  if (flags.debugAllSmoke) {
    enqueueSmoke(true, () => runTableBehaviorStrictSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runTableNavigationSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runOrderedListPaginationSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runListBehaviorSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runBlockOutlineAlignmentSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runDragSelectionSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runDragActionSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runSelectionImeSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runSelectionBoundarySmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runToolCommandSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runPasteActionSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runMappingSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runCoordsSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runScrollIntoViewSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runReadonlySmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runDocRoundtripSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runHtmlIoSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runLinkInteractionSmoke(tableDebugPanelElement || null));
    enqueueSmoke(true, () => runMarkdownIoSmoke(tableDebugPanelElement || null));
    enqueueSmoke(true, () => runPerfBudgetSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runLegacyConfigSmoke(tableDebugPanelElement || null));
    enqueueSmoke(true, () => runHistorySmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runImeActionSmoke(view, tableDebugPanelElement || null));
  } else if (flags.debugP0Smoke) {
    // P0 快速回归包：输入/选区、拖拽、表格、列表、块几何与基础自动化链路。
    enqueueSmoke(true, () => runTableBehaviorStrictSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runTableNavigationSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runOrderedListPaginationSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runListBehaviorSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runBlockOutlineAlignmentSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runDragSelectionSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runDragActionSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runSelectionImeSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runImeActionSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runSelectionBoundarySmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runPasteActionSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runDocRoundtripSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runScrollIntoViewSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runLegacyConfigSmoke(tableDebugPanelElement || null));
  } else {
    addSmokeByFlags();
  }
  if (smokeQueue.length > 0) {
    requestAnimationFrame(() => {
      const runSmokeQueue = async () => {
      const globalObj = globalThis as any;
      globalObj.__lumenSmokeLogs = [];
      for (const runSmoke of smokeQueue) {
          try {
            await Promise.resolve(runSmoke());
          } catch (error) {
            console.error("[smoke-runner] uncaught error", error);
            const text = `[smoke-runner] FAIL ${String((error as any)?.message || error)}`;
            if (tableDebugPanelElement) {
              const prev = tableDebugPanelElement.textContent || "";
              tableDebugPanelElement.textContent = `${prev}\n${text}`.trim();
            }
          }
      }
      const shouldSummarizeBatch = flags.debugAllSmoke || flags.debugP0Smoke;
      if (shouldSummarizeBatch) {
        const logLines = Array.isArray(globalObj.__lumenSmokeLogs) ? globalObj.__lumenSmokeLogs : [];
        const lines = logLines
          .map((line: string) => String(line || "").trim())
          .filter((line: string) => /^\[[^\]]+-smoke\]\s+(PASS|FAIL)\b/.test(line));
        const passLines = lines.filter((line: string) => /\]\s+PASS\b/.test(line));
        const failLines = lines.filter((line: string) => /\]\s+FAIL\b/.test(line));
        const failNames = failLines
          .map((line: string) => {
            const match = line.match(/^\[([^\]]+)\]/);
            return match?.[1] ?? line;
          })
          .join(", ");
        const smokeNames = lines
          .map((line: string) => {
            const match = line.match(/^\[([^\]]+)\]/);
            return match?.[1] ?? "";
          })
          .filter(Boolean);
        let missingNames: string[] = [];
        if (flags.debugP0Smoke) {
          const requiredP0Smokes = [
            "table-behavior-smoke",
            "table-smoke",
            "list-smoke",
            "list-behavior-smoke",
            "block-outline-smoke",
            "drag-smoke",
            "drag-action-smoke",
            "selection-ime-smoke",
            "ime-action-smoke",
            "selection-boundary-smoke",
            "paste-smoke",
            "doc-roundtrip-smoke",
            "scroll-smoke",
            "legacy-config-smoke",
          ];
          missingNames = requiredP0Smokes.filter((name) => !smokeNames.includes(name));
        }
        const summaryTag = flags.debugAllSmoke ? "all-smoke-summary" : "p0-smoke-summary";
        const summary = `[${summaryTag}] total=${lines.length} pass=${passLines.length} fail=${failLines.length}${
          failLines.length > 0 ? ` failed=[${failNames}]` : ""
        }${
          missingNames.length > 0 ? ` missing=[${missingNames.join(", ")}]` : ""
        }`;
        if (tableDebugPanelElement) {
          const text = tableDebugPanelElement.textContent || "";
          tableDebugPanelElement.textContent = `${text}\n${summary}`.trim();
        }
        if (failLines.length > 0 || missingNames.length > 0) {
          console.error(summary);
        } else {
          console.info(summary);
        }
      }
      };
      void runSmokeQueue();
    });
  }

  return {
    view,
    destroy: () => {
      detachDevTools?.();
      detachDevTools = null;
      paginationDocWorkerClient?.destroy?.();
      view.destroy();
    },
  };
};
