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
  CanvasEditorView,
  Decoration,
  DecorationSet,
  createBlockIdPlugin,
  createBlockIdTransaction,
  createCanvasConfigPlugin,
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
import { resolveLinkHrefAtPos } from "./link";
import {
  runBlockOutlineAlignmentSmoke,
  runCoordsSmoke,
  runDragActionSmoke,
  runDragSelectionSmoke,
  runHistorySmoke,
  runImeActionSmoke,
  runListBehaviorSmoke,
  runMappingSmoke,
  runOrderedListPaginationSmoke,
  runPasteActionSmoke,
  runReadonlySmoke,
  runSelectionBoundarySmoke,
  runSelectionImeSmoke,
  runTableBehaviorStrictSmoke,
  runTableNavigationSmoke,
  runToolCommandSmoke,
} from "./smokeTests";
import { initialDocJson } from "../initialDoc";

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

// 编辑器实例创建与销毁逻辑集中，App.vue 只负责页面装配。
export const mountPlaygroundEditor = ({
  host,
  statusElement,
  tableDebugPanelElement,
  flags,
}: MountPlaygroundEditorParams): MountedPlaygroundEditor => {
  const settings = createCanvasSettings(flags.debugPerf);
  const nodeRegistry = createDefaultNodeRendererRegistry();

  const canvasConfig = {
    settings,
    nodeRegistry,
    debug: { layout: true, selection: true, delete: true },
    commands: {
      basicCommands,
      runCommand,
      setBlockAlign,
      viewCommands: createViewCommands(),
    },
    statusElement: statusElement || undefined,
    tablePaginationPanelEl: flags.debugTablePagination ? tableDebugPanelElement || undefined : undefined,
  };

  const plugins: any[] = [
    history(),
    createBlockIdPlugin(),
    createCanvasConfigPlugin(canvasConfig),
    createActiveBlockSelectionPlugin(),
    keymap(createCanvasEditorKeymap()),
    keymap(baseKeymap),
  ];

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
    json: initialDocJson,
    plugins,
  });
  const initBlockIdTr = createBlockIdTransaction(editorState);
  const readyState = initBlockIdTr ? editorState.apply(initBlockIdTr) : editorState;

  const viewProps: Record<string, unknown> = {
    state: readyState,
    handleClick: (_view: any, pos: number, event: MouseEvent) => {
      const href = resolveLinkHrefAtPos(_view?.state, pos);
      if (!href) {
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
  const smokeQueue: Array<() => void> = [];
  const enqueueSmoke = (enabled: boolean, runner: () => void) => {
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
      flags.debugReadonlySmoke,
      () => runReadonlySmoke(view, tableDebugPanelElement || null)
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
    enqueueSmoke(true, () => runReadonlySmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runHistorySmoke(view, tableDebugPanelElement || null));
    enqueueSmoke(true, () => runImeActionSmoke(view, tableDebugPanelElement || null));
  } else {
    addSmokeByFlags();
  }
  if (smokeQueue.length > 0) {
    requestAnimationFrame(() => {
      for (const runSmoke of smokeQueue) {
        runSmoke();
      }
    });
  }

  return {
    view,
    destroy: () => {
      detachDevTools?.();
      detachDevTools = null;
      view.destroy();
    },
  };
};
