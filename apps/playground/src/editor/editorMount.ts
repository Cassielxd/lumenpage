import { Editor } from "lumenpage-core";
import { Selection, TextSelection } from "lumenpage-state";
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
} from "lumenpage-view-canvas";
import { ActiveBlockSelectionExtension } from "lumenpage-extension-active-block";
import { DragHandleExtension } from "lumenpage-extension-drag-handle";

import type { PlaygroundDebugFlags } from "./config";
import { createCanvasSettings } from "./config";
import { PaginationDocWorkerClient } from "./paginationDocWorkerClient";
import { createPlaygroundPermissionPlugin } from "./permissionPlugin";
import { createPlaygroundI18n } from "./i18n";
import { shouldOpenLinkOnClick } from "./linkPolicy";
import { playgroundDocumentExtensions } from "./documentExtensions";
import {
  configurePlaygroundSecurityPolicy,
  normalizePastedText,
  sanitizePastedHtml,
} from "./pastePolicy";
import {
  runA11ySmoke,
  runBlockOutlineAlignmentSmoke,
  runCoordsSmoke,
  runScrollIntoViewSmoke,
  runDocRoundtripSmoke,
  runDragActionSmoke,
  runDragSelectionSmoke,
  runHistorySmoke,
  runHtmlIoSmoke,
  runI18nSmoke,
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
  runSecuritySmoke,
  runSelectionBoundarySmoke,
  runSelectionImeSmoke,
  runTableBehaviorStrictSmoke,
  runTableNavigationSmoke,
  runToolCommandSmoke,
} from "./smokeTests";
import * as smokeTests from "./smokeTests";
import { initialDocJson, initialDocPerfJson, initialDocSmokeJson } from "../initialDoc";

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

const isInTableAtResolvedPos = ($pos: any) => {
  if (!$pos || !Number.isFinite($pos.depth)) {
    return false;
  }
  for (let depth = $pos.depth; depth >= 0; depth -= 1) {
    const typeName = $pos.node(depth)?.type?.name;
    if (
      typeName === "table" ||
      typeName === "tableRow" ||
      typeName === "tableCell" ||
      typeName === "tableHeader"
    ) {
      return true;
    }
  }
  return false;
};

const clearLegacyConfigHits = () => {
  (globalThis as any).__lumenLegacyConfigHits = [];
};

const shouldUseSmokeDoc = (flags: PlaygroundDebugFlags) => {
  if (flags.usePerfDoc) {
    return false;
  }
  return (
    flags.debugAllSmoke ||
    flags.debugP0Smoke ||
    flags.debugTableSmoke ||
    flags.debugTableBehaviorSmoke ||
    flags.debugListSmoke ||
    flags.debugListBehaviorSmoke ||
    flags.debugBlockOutlineSmoke ||
    flags.debugDragSmoke ||
    flags.debugDragActionSmoke ||
    flags.debugSelectionImeSmoke ||
    flags.debugImeActionSmoke ||
    flags.debugSelectionBoundarySmoke ||
    flags.debugToolSmoke ||
    flags.debugPasteSmoke ||
    flags.debugHistorySmoke ||
    flags.debugMappingSmoke ||
    flags.debugCoordsSmoke ||
    flags.debugScrollSmoke ||
    flags.debugReadonlySmoke ||
    flags.debugA11ySmoke ||
    flags.debugI18nSmoke ||
    flags.debugSecuritySmoke ||
    flags.debugDocRoundtripSmoke ||
    flags.debugMarkdownIoSmoke ||
    flags.debugHtmlIoSmoke ||
    flags.debugLinkSmoke ||
    flags.debugPerfBudgetSmoke ||
    flags.debugLegacyConfigSmoke
  );
};

// 缂傚倸鍊搁崐褰掓偋閻愬灚顐芥い鎰剁畱闂傤垶鏌曟繛鍨姢闁哄妫勯妴鎺戭潩椤掑鍓伴梺鎼炲妼瀹曨剟顢氬▎鎰闁规鍠氶幉鍧楁⒒娴ｅ摜姘ㄩ柛瀣尰閹便劑鏁愰崟顓犵崲闂侀€炲苯澧俊鍙夊笧濞嗐垽顢曢敂瑙ｆ寘闂佺硶鍓濆ú婵嬪储椤掑嫭鐓ユ繛鎴烆焽閹肩磥p.vue 闂備礁鎲￠悷顖涚閿濆洨鐭嗛悗锝庡墯鐎氬鏌ㄥ┑鍡╂Ф闁逞屽墮椤﹂潧螞閸愵喖顫呴柨婵嗗椤ュ﹪姊绘担瑙勭凡缂佸鐓￠崺鈧い鎴ｆ硶缁?
export const mountPlaygroundEditor = ({
  host,
  statusElement,
  tableDebugPanelElement,
  flags,
}: MountPlaygroundEditorParams): MountedPlaygroundEditor => {
  clearLegacyConfigHits();
  const i18n = createPlaygroundI18n(flags.locale);
  configurePlaygroundSecurityPolicy({
    enableAudit: flags.debugSecuritySmoke,
  });
  const paginationDocWorkerClient =
    flags.enablePaginationWorker ? new PaginationDocWorkerClient() : null;
  const settings = createCanvasSettings(
    flags.debugPerf,
    flags.enablePaginationWorker,
    flags.forcePaginationWorker,
    flags.locale,
    flags.highContrast
  );
  if (flags.enablePaginationWorker) {
    settings.paginationWorker = {
      ...(settings.paginationWorker || {}),
      enabled: true,
      provider: paginationDocWorkerClient,
    };
  }
  const extensions = [
    ...playgroundDocumentExtensions,
    ActiveBlockSelectionExtension,
    DragHandleExtension.configure({ onlyTopLevel: true }),
  ];

  const plugins: any[] = [];
  const permissionPlugin = createPlaygroundPermissionPlugin(flags.permissionMode);
  if (permissionPlugin) {
    plugins.push(permissionPlugin);
  }

  const initialDoc = flags.usePerfDoc
    ? initialDocPerfJson
    : shouldUseSmokeDoc(flags)
      ? initialDocSmokeJson
      : initialDocJson;

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

  const viewProps: Partial<CanvasEditorViewProps> = {
    attributes: {
      "aria-label": i18n.app.editorAriaLabel,
      lang: flags.locale,
      "data-contrast": flags.highContrast ? "high" : "normal",
    },
    formatStatusText: (_view: CanvasEditorView, args: any) => {
      const pageCount = Math.max(0, Number(args?.pageCount) || 0);
      const focused = args?.focused === "typing" ? i18n.toolbar.statusTyping : i18n.toolbar.statusIdle;
      return `${pageCount} ${i18n.toolbar.statusPageUnit} | ${focused}`;
    },
    editable: () => flags.permissionMode !== "readonly",
    transformPastedText: (_view: CanvasEditorView, text: string) => normalizePastedText(text),
    transformPastedHTML: (_view: CanvasEditorView, html: string) => sanitizePastedHtml(html),
    isInSpecialStructureAtPos: (_view: CanvasEditorView, state: any, pos: number) =>
      isInNodeTypeAtPos(state, pos, "table"),
    isNodeSelectionTarget: (_view: CanvasEditorView, args: NodeSelectionTargetArgs) => {
      const nodeType = args?.node?.type?.name;
      if (
        nodeType === "table" ||
        nodeType === "tableRow" ||
        nodeType === "tableCell" ||
        nodeType === "tableHeader"
      ) {
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

  const editor = new Editor({
    element: host,
    extensions,
    content: initialDoc,
    plugins,
    enableInputRules: flags.enableInputRules,
    canvas: {
      settings,
      debug: flags.debugTimingLogs
        ? ({ timing: true, eventTiming: true, paginationTiming: true, renderTiming: true } as any)
        : undefined,
      legacyPolicy: { strict: true },
      statusElement: statusElement || undefined,
      tablePaginationPanelEl: flags.debugTablePagination
        ? tableDebugPanelElement || undefined
        : undefined,
    },
    editorProps: viewProps,
  });
  const view = editor.view!;
  try {
    const currentSelection = view?.state?.selection;
    if (currentSelection && view?.state?.tr) {
      const warmupTr = view.state.tr.setSelection(currentSelection);
      if (warmupTr?.selectionSet) {
        view.dispatch(warmupTr);
      }
    }
  } catch (error) {
    console.error("[playground] selection warmup failed", error);
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
      flags.debugPaginationRegressionSmoke,
      () => smokeTests.runPaginationRegressionSmoke?.(view, tableDebugPanelElement || null)
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
      flags.debugA11ySmoke,
      () => runA11ySmoke(view, tableDebugPanelElement || null)
    );
    enqueueSmoke(
      flags.debugI18nSmoke,
      () => runI18nSmoke(view, tableDebugPanelElement || null)
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
    enqueueSmoke(flags.debugSecuritySmoke, () =>
      runSecuritySmoke(view, tableDebugPanelElement || null)
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
    enqueueSmoke(true, () => smokeTests.runPaginationRegressionSmoke?.(view, tableDebugPanelElement || null));
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
    enqueueSmoke(true, () => runA11ySmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runI18nSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runDocRoundtripSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runHtmlIoSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runLinkInteractionSmoke(tableDebugPanelElement || null));
    enqueueSmoke(true, () => runSecuritySmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runMarkdownIoSmoke(tableDebugPanelElement || null));
    enqueueSmoke(true, () => runPerfBudgetSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runLegacyConfigSmoke(tableDebugPanelElement || null));
    enqueueSmoke(true, () => runHistorySmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runImeActionSmoke(view, tableDebugPanelElement || null));
  } else if (flags.debugP0Smoke) {
    // P0 蹇€熷洖褰掑寘锛氳緭鍏?閫夊尯銆佹嫋鎷姐€佽〃鏍笺€佸垪琛ㄣ€佸潡鍑犱綍涓庡熀纭€鑷姩鍖栭摼璺€?
    enqueueSmoke(true, () => runTableBehaviorStrictSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runTableNavigationSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runOrderedListPaginationSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runListBehaviorSmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => smokeTests.runPaginationRegressionSmoke?.(view, tableDebugPanelElement || null));
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
        const snapshot = (() => {
          const rawView = view as any;
          const state = rawView?.state;
          const selection = state?.selection;
          const scrollArea = rawView?._internals?.dom?.scrollArea ?? null;
          const json =
            typeof rawView?.getJSON === "function"
              ? rawView.getJSON()
              : state?.doc?.toJSON?.() ?? null;
          return {
            json,
            docRef: state?.doc ?? null,
            selection:
              Number.isFinite(selection?.from) && Number.isFinite(selection?.to)
                ? {
                    from: Number(selection.from),
                    to: Number(selection.to),
                    head: Number.isFinite(selection?.head) ? Number(selection.head) : Number(selection.to),
                  }
                : null,
            scrollTop: Number.isFinite(scrollArea?.scrollTop) ? Number(scrollArea.scrollTop) : null,
          };
        })();
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
              "pagination-regression-smoke",
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
        try {
          const rawView = view as any;
          const docChangedBySmoke =
            snapshot.docRef != null && rawView?.state?.doc != null
              ? rawView.state.doc !== snapshot.docRef
              : true;
          if (docChangedBySmoke && snapshot.json && typeof rawView?.setJSON === "function") {
            rawView.setJSON(snapshot.json);
          }
          if (snapshot.selection && rawView?.state?.doc && rawView?.state?.tr) {
            const docSize = Number(rawView.state.doc.content?.size || 0);
            const from = Math.max(0, Math.min(Number(snapshot.selection.from), docSize));
            const to = Math.max(0, Math.min(Number(snapshot.selection.to), docSize));
            const head = Math.max(0, Math.min(Number(snapshot.selection.head), docSize));
            let selection: any = null;
            try {
              selection = TextSelection.create(rawView.state.doc, from, to);
            } catch (_error) {
              selection = Selection.near(rawView.state.doc.resolve(head), 1);
            }
            if (selection) {
              rawView.dispatch(rawView.state.tr.setSelection(selection).scrollIntoView());
            }
          }
          const scrollArea = rawView?._internals?.dom?.scrollArea;
          if (scrollArea && Number.isFinite(snapshot.scrollTop)) {
            scrollArea.scrollTop = Number(snapshot.scrollTop);
          }
          rawView?._internals?.updateLayout?.();
          rawView?._internals?.updateCaret?.(true);
          rawView?._internals?.scheduleRender?.();
        } catch (error) {
          console.error("[smoke-runner] restore snapshot failed", error);
        }
      };
      void runSmokeQueue();
    });
  }

  return {
    view,
    destroy: () => {
      configurePlaygroundSecurityPolicy({ enableAudit: false });
      paginationDocWorkerClient?.destroy?.();
      editor.destroy();
    },
  };
};



