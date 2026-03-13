import { Editor, Extension } from "lumenpage-core";
import {
  normalizeNavigableHref,
  resolveLinkHrefAtPos,
  resolveLinkHrefAtSelection,
} from "lumenpage-link";
import { getPageIndexForOffset } from "lumenpage-view-runtime";
import {
  CanvasEditorView,
  docPosToTextOffset,
  type NodeSelectionTargetArgs,
  type CanvasEditorViewProps,
} from "lumenpage-view-canvas";
import { ActiveBlockSelectionExtension } from "lumenpage-extension-active-block";
import BubbleMenu, { DEFAULT_BUBBLE_MENU_ACTIONS } from "lumenpage-extension-bubble-menu";
import { DragHandleExtension } from "lumenpage-extension-drag-handle";
import { EmbedPanelBrowserViewExtension } from "lumenpage-extension-embed-panel/browser";
import { MentionExtension } from "lumenpage-extension-mention";
import { SlashCommandExtension } from "lumenpage-extension-slash-command";

import type { PlaygroundDebugFlags } from "./config";
import { createCanvasSettings } from "./config";
import { PaginationDocWorkerClient } from "./paginationDocWorkerClient";
import { createPlaygroundPermissionPlugin } from "./permissionPlugin";
import { createPlaygroundI18n } from "./i18n";
import { shouldOpenLinkOnClick } from "./linkPolicy";
import { createMentionPluginOptions } from "./mentionCase";
import { createSlashCommandOptions } from "./slashCommandCase";
import { createTocOutlinePlugin, type TocOutlineSnapshot } from "./tocOutlinePlugin";
import { lumenDocumentExtensions } from "./documentExtensions";
import {
  configurePlaygroundSecurityPolicy,
  normalizePastedText,
  sanitizePastedHtml,
} from "./pastePolicy";
import { initialDocJson } from "../initialDoc";

type MountPlaygroundEditorParams = {
  host: HTMLElement;
  statusElement?: HTMLElement | null;
  flags: PlaygroundDebugFlags;
  onTocOutlineChange?: ((snapshot: TocOutlineSnapshot) => void) | null;
  tocOutlineEnabled?: boolean;
  onStatsChange?: ((stats: {
    pageCount: number;
    currentPage: number;
    nodeCount: number;
    pluginCount: number;
    wordCount: number;
    selectedWordCount: number;
    blockType: string;
  }) => void) | null;
};

type MountedPlaygroundEditor = {
  view: CanvasEditorView;
  setTocOutlineEnabled: (enabled: boolean) => void;
  isTocOutlineEnabled: () => boolean;
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

export const mountPlaygroundEditor = ({
  host,
  statusElement,
  flags,
  onTocOutlineChange,
  tocOutlineEnabled,
  onStatsChange,
}: MountPlaygroundEditorParams): MountedPlaygroundEditor => {
  const findPageIndexForOffset = (layout: any, offset: number, layoutIndex: any = null) => {
    if (layoutIndex && typeof getPageIndexForOffset === "function") {
      const pageIndex = getPageIndexForOffset(layoutIndex, offset);
      if (Number.isFinite(pageIndex)) {
        return Number(pageIndex);
      }
    }

    if (!layout || !Array.isArray(layout.pages) || layout.pages.length === 0) {
      return null;
    }

    const target = Number.isFinite(offset) ? Number(offset) : 0;
    let lineEndFallback: number | null = null;
    for (let pageIndex = 0; pageIndex < layout.pages.length; pageIndex += 1) {
      const page = layout.pages[pageIndex];
      const lines = Array.isArray(page?.lines) ? page.lines : [];
      for (const line of lines) {
        const start = Number.isFinite(line?.start) ? Number(line.start) : null;
        const end = Number.isFinite(line?.end) ? Number(line.end) : null;
        if (start == null || end == null) {
          continue;
        }
        if (start === end && target === start) {
          return pageIndex;
        }
        if (target >= start && target < end) {
          return pageIndex;
        }
        if (target === end && end > start && lineEndFallback == null) {
          lineEndFallback = pageIndex;
        }
      }
    }

    if (lineEndFallback != null) {
      return lineEndFallback;
    }

    return layout.pages.length - 1;
  };

  const i18n = createPlaygroundI18n(flags.locale);
  configurePlaygroundSecurityPolicy({ enableAudit: false });

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

  const bubbleMenuElement = host.ownerDocument.createElement("div");

  const extensions = [
    ...lumenDocumentExtensions,
    EmbedPanelBrowserViewExtension,
    ActiveBlockSelectionExtension,
    MentionExtension.configure(createMentionPluginOptions()),
    SlashCommandExtension.configure(createSlashCommandOptions(flags.locale)),
    BubbleMenu.configure({
      element: bubbleMenuElement,
      actions: DEFAULT_BUBBLE_MENU_ACTIONS,
    }),
    DragHandleExtension.configure({ onlyTopLevel: true }),
  ];
  const tocOutlineController = createTocOutlinePlugin({
    onChange: onTocOutlineChange ?? undefined,
    emptyHeadingText: flags.locale === "en-US" ? "Untitled Heading" : "无标题",
    initialEnabled: tocOutlineEnabled !== false,
  });
  const permissionPlugin = createPlaygroundPermissionPlugin(flags.permissionMode);
  const runtimeExtensions = [
    Extension.create({
      name: "tocOutline",
      addPlugins() {
        return [tocOutlineController.plugin];
      },
    }),
    ...(permissionPlugin
      ? [
          Extension.create({
            name: "lumenPermission",
            addPlugins() {
              return [permissionPlugin];
            },
          }),
        ]
      : []),
  ];

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

  const toggleTaskCheckboxAtPos = (
    view: CanvasEditorView,
    pos: number,
    event: MouseEvent | KeyboardEvent
  ) => {
    if (flags.permissionMode !== "full") {
      return false;
    }
    if (!Number.isFinite(pos)) {
      return false;
    }
    const command = view?.commands?.toggleTaskItemChecked;
    if (typeof command !== "function") {
      return false;
    }
    const handled = command(pos, { onlyWhenNearStart: true }) === true;
    if (handled) {
      event?.preventDefault?.();
    }
    return handled;
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
      const isSpaceToggleKey =
        (event?.key === " " || event?.key === "Spacebar") &&
        !event?.metaKey &&
        !event?.ctrlKey &&
        !event?.altKey &&
        !event?.shiftKey;
      if (isSpaceToggleKey && _view?.state?.selection?.empty) {
        const pos = Number(_view.state.selection.from);
        if (toggleTaskCheckboxAtPos(_view, pos, event)) {
          return true;
        }
      }

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
      if (toggleTaskCheckboxAtPos(_view, pos, event)) {
        return true;
      }
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

  const editor = new Editor({
    element: host,
    extensions: [...extensions, ...runtimeExtensions],
    content: initialDocJson,
    enableInputRules: flags.enableInputRules,
    editorProps: {
      ...viewProps,
      canvasViewConfig: {
        ...(viewProps.canvasViewConfig || {}),
        settings,
        legacyPolicy: { strict: true },
        statusElement: statusElement || undefined,
      },
    },
  });
  const view = editor.view!;

  let statsFrameId = 0;
  let statsTimeoutId: ReturnType<typeof setTimeout> | null = null;
  const scrollArea = view?._internals?.dom?.scrollArea ?? null;
  const emitStats = () => {
    if (!onStatsChange) {
      return;
    }
    const pagination = typeof view.getPaginationInfo === "function" ? view.getPaginationInfo() : null;
    const state = view.state;
    let nodeCount = 0;
    try {
      state?.doc?.descendants?.(() => {
        nodeCount += 1;
      });
    } catch (_error) {
      nodeCount = 0;
    }
    let wordCount = 0;
    let selectedWordCount = 0;
    try {
      const docText = String(state?.doc?.textContent || "");
      wordCount = docText.replace(/\s+/g, "").length;
      const selectionFrom = Number(state?.selection?.from);
      const selectionTo = Number(state?.selection?.to);
      if (
        Number.isFinite(selectionFrom) &&
        Number.isFinite(selectionTo) &&
        selectionTo > selectionFrom &&
        typeof state?.doc?.textBetween === "function"
      ) {
        const selectedText = String(state.doc.textBetween(selectionFrom, selectionTo, "", "") || "");
        selectedWordCount = selectedText.replace(/\s+/g, "").length;
      }
    } catch (_error) {
      wordCount = 0;
      selectedWordCount = 0;
    }
    const pageCount = Math.max(0, Number(pagination?.pageCount) || 0);
    const pageHeight = Math.max(1, Number(pagination?.pageHeight) || 0);
    const pageGap = Math.max(0, Number(pagination?.pageGap) || 0);
    const pageSpan = Math.max(1, pageHeight + pageGap);
    const scrollTop = Math.max(0, Number(pagination?.scrollTop) || 0);
    const layout = view?._internals?.getLayout?.() ?? null;
    const layoutIndex = view?._internals?.getLayoutIndex?.() ?? null;
    const headPos = Number(state?.selection?.head);
    let currentPageIndex = null as number | null;
    if (layout && Number.isFinite(headPos) && state?.doc) {
      try {
        const headOffset = docPosToTextOffset(state.doc, headPos);
        currentPageIndex = findPageIndexForOffset(layout, headOffset, layoutIndex);
      } catch (_error) {
        currentPageIndex = null;
      }
    }
    const currentPage =
      currentPageIndex != null
        ? Math.min(pageCount, Math.max(1, currentPageIndex + 1))
        : pageCount > 0
          ? Math.min(pageCount, Math.max(1, Math.floor(scrollTop / pageSpan) + 1))
          : 0;
    const blockType = String(state?.selection?.$from?.parent?.type?.name || "").trim();

    onStatsChange({
      pageCount,
      currentPage,
      nodeCount,
      pluginCount: Math.max(0, Number(state?.plugins?.length) || 0),
      wordCount,
      selectedWordCount,
      blockType,
    });
  };
  const scheduleStatsEmit = () => {
    if (!onStatsChange) {
      return;
    }
    if (statsFrameId && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(statsFrameId);
      statsFrameId = 0;
    }
    if (statsTimeoutId != null) {
      clearTimeout(statsTimeoutId);
    }
    if (typeof requestAnimationFrame === "function") {
      statsFrameId = requestAnimationFrame(() => {
        statsFrameId = 0;
        emitStats();
      });
    } else {
      emitStats();
    }
    statsTimeoutId = setTimeout(() => {
      statsTimeoutId = null;
      emitStats();
    }, 180);
  };
  const handleEditorUpdate = () => {
    scheduleStatsEmit();
  };
  const handleEditorSelectionUpdate = () => {
    scheduleStatsEmit();
  };
  const handleEditorTransaction = () => {
    scheduleStatsEmit();
  };
  const handleScroll = () => {
    scheduleStatsEmit();
  };
  editor.on("update", handleEditorUpdate);
  editor.on("selectionUpdate", handleEditorSelectionUpdate);
  editor.on("transaction", handleEditorTransaction);
  scrollArea?.addEventListener?.("scroll", handleScroll, { passive: true });
  scheduleStatsEmit();

  try {
    const currentSelection = view?.state?.selection;
    if (currentSelection && view?.state?.tr) {
      const warmupTr = view.state.tr.setSelection(currentSelection);
      if (warmupTr?.selectionSet) {
        view.dispatch(warmupTr);
      }
    }
  } catch (error) {
    console.error("[lumen] selection warmup failed", error);
  }

  return {
    view,
    setTocOutlineEnabled: (enabled: boolean) => {
      tocOutlineController.setEnabled(enabled);
    },
    isTocOutlineEnabled: () => tocOutlineController.isEnabled(),
    destroy: () => {
      editor.off("update", handleEditorUpdate);
      editor.off("selectionUpdate", handleEditorSelectionUpdate);
      editor.off("transaction", handleEditorTransaction);
      scrollArea?.removeEventListener?.("scroll", handleScroll);
      if (statsFrameId && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(statsFrameId);
      }
      if (statsTimeoutId != null) {
        clearTimeout(statsTimeoutId);
      }
      configurePlaygroundSecurityPolicy({ enableAudit: false });
      paginationDocWorkerClient?.destroy?.();
      editor.destroy();
    },
  };
};


