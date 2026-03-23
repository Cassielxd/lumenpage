import { Editor, Extension } from "lumenpage-core";
import {
  normalizeNavigableHref,
  resolveLinkHrefAtPos,
  resolveLinkHrefAtSelection,
} from "lumenpage-link";
import { NodeSelection, TextSelection } from "lumenpage-state";
import { getPageIndexForOffset } from "lumenpage-view-runtime";
import {
  CanvasEditorView,
  docPosToTextOffset,
  type NodeSelectionTargetArgs,
  type CanvasEditorViewProps,
} from "lumenpage-view-canvas";
import { ActiveBlockSelectionExtension } from "lumenpage-extension-active-block";
import BubbleMenu, { DEFAULT_BUBBLE_MENU_ACTIONS } from "lumenpage-extension-bubble-menu";
import {
  CommentsPluginKey,
  findCommentAnchorRange,
  getCommentsPluginState,
  normalizeCommentId,
} from "lumenpage-extension-comment";
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
import { initialDocMinimalJson } from "../initialDocMinimal";

type MountPlaygroundEditorParams = {
  host: HTMLElement;
  statusElement?: HTMLElement | null;
  flags: PlaygroundDebugFlags;
  onTocOutlineChange?: ((snapshot: TocOutlineSnapshot) => void) | null;
  tocOutlineEnabled?: boolean;
  onCommentStateChange?: ((snapshot: { activeThreadId: string | null }) => void) | null;
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
  getActiveCommentThreadId: () => string | null;
  activateCommentThread: (threadId: string | null) => boolean;
  focusCommentThread: (threadId: string) => boolean;
  removeCommentThread: (threadId: string) => boolean;
  destroy: () => void;
};

const toFiniteNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const readDomRect = (element: Element | null) => {
  if (!(element instanceof HTMLElement)) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
};

const walkLayoutBoxes = (
  boxes: any[],
  visitor: (box: any, depth: number, parent: any) => void,
  depth = 0,
  parent: any = null
) => {
  if (!Array.isArray(boxes) || boxes.length === 0) {
    return;
  }
  for (const box of boxes) {
    if (!box) {
      continue;
    }
    visitor(box, depth, parent);
    if (Array.isArray(box.children) && box.children.length > 0) {
      walkLayoutBoxes(box.children, visitor, depth + 1, box);
    }
  }
};

const countLayoutBoxes = (boxes: any[]) => {
  let count = 0;
  walkLayoutBoxes(boxes, () => {
    count += 1;
  });
  return count;
};

const listNodeOverlays = () => {
  if (typeof document === "undefined") {
    return [];
  }
  return Array.from(document.querySelectorAll("[data-node-view-block-id]")).map((element) => {
    const html = element as HTMLElement;
    const rect = readDomRect(html);
    return {
      blockId: html.dataset.nodeViewBlockId ?? null,
      key: html.dataset.nodeViewKey ?? null,
      className: html.className || null,
      rect,
      styleWidth: html.style.width || null,
      styleHeight: html.style.height || null,
      styleTransform: html.style.transform || null,
      visible:
        html.style.display !== "none" &&
        html.style.visibility !== "hidden" &&
        rect != null &&
        rect.width > 0 &&
        rect.height > 0,
    };
  });
};

const findNodeByBlockId = (doc: any, blockId: string) => {
  if (!doc || typeof doc.descendants !== "function" || !blockId) {
    return null;
  }
  let match: Record<string, unknown> | null = null;
  doc.descendants((node: any, pos: number) => {
    if (String(node?.attrs?.blockId ?? "") !== blockId) {
      return undefined;
    }
    match = {
      pos,
      nodeType: node?.type?.name ?? null,
      attrs: node?.attrs ?? null,
      nodeSize: Number(node?.nodeSize) || 0,
    };
    return false;
  });
  return match;
};

const collectBoxesForBlockId = (layout: any, blockId: string, scrollArea: HTMLElement | null) => {
  if (!layout || !Array.isArray(layout.pages) || !blockId) {
    return [];
  }
  const scrollTop = Number(scrollArea?.scrollTop) || 0;
  const viewportWidth = Number(scrollArea?.clientWidth) || 0;
  const pageWidth = Number(layout?.pageWidth) || 0;
  const pageHeight = Number(layout?.pageHeight) || 0;
  const pageGap = Number(layout?.pageGap) || 0;
  const pageSpan = pageHeight + pageGap;
  const pageX = Math.max(0, (viewportWidth - pageWidth) / 2);
  const matches: Array<Record<string, unknown>> = [];

  for (let pageIndex = 0; pageIndex < layout.pages.length; pageIndex += 1) {
    const page = layout.pages[pageIndex];
    walkLayoutBoxes(page?.boxes ?? [], (box, depth, parent) => {
      const boxBlockId = String(box?.blockId ?? box?.nodeId ?? "");
      if (boxBlockId !== blockId) {
        return;
      }
      const x = toFiniteNumber(box?.x);
      const y = toFiniteNumber(box?.y);
      const width = toFiniteNumber(box?.width);
      const height = toFiniteNumber(box?.height);
      const pageTop = pageIndex * pageSpan - scrollTop;
      matches.push({
        pageIndex,
        depth,
        key: box?.key ?? null,
        role: box?.role ?? null,
        type: box?.type ?? null,
        parentKey: parent?.key ?? null,
        start: toFiniteNumber(box?.start),
        end: toFiniteNumber(box?.end),
        x,
        y,
        width,
        height,
        viewportLeft: x == null ? null : pageX + x,
        viewportTop: y == null ? null : pageTop + y,
        viewportRight: x == null || width == null ? null : pageX + x + width,
        viewportBottom: y == null || height == null ? null : pageTop + y + height,
        layoutCapabilities:
          box?.layoutCapabilities ??
          box?.meta?.layoutCapabilities ??
          box?.blockAttrs?.layoutCapabilities ??
          null,
      });
    });
  }

  return matches;
};

const readSelectionSummary = (view: CanvasEditorView | null) => {
  const selection = view?.state?.selection;
  if (!selection) {
    return null;
  }
  return {
    from: selection.from,
    to: selection.to,
    empty: selection.empty === true,
    type:
      selection instanceof NodeSelection
        ? "NodeSelection"
        : selection instanceof TextSelection
          ? "TextSelection"
          : selection.constructor?.name ?? null,
  };
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
  onCommentStateChange,
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
    flags.debugGhostTrace,
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
      content: initialDocMinimalJson,
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
  const emitCommentState = () => {
    onCommentStateChange?.({
      activeThreadId: getCommentsPluginState(view?.state).activeThreadId || null,
    });
  };
  const baseDispatchTransaction =
    typeof view.dispatchTransaction === "function" ? view.dispatchTransaction.bind(view) : null;
  if (baseDispatchTransaction) {
    view.dispatchTransaction = (transaction: any) => {
      baseDispatchTransaction(transaction);
      emitCommentState();
    };
  }
  const activateCommentThread = (threadId: string | null) =>
    view.commands?.activateCommentThread?.(threadId) === true;
  const focusCommentThread = (threadId: string) => {
    const normalizedThreadId = normalizeCommentId(threadId);
    if (!normalizedThreadId) {
      return false;
    }
    const range = findCommentAnchorRange(view?.state, normalizedThreadId);
    if (!range || !view?.state?.tr || !view?.state?.doc) {
      return false;
    }

    try {
      const tr = view.state.tr
        .setSelection(TextSelection.create(view.state.doc, range.from, range.to))
        .setMeta(CommentsPluginKey, { activeThreadId: normalizedThreadId })
        .setMeta("addToHistory", false)
        .scrollIntoView();
      view.dispatch(tr);
      view.focus();
      return true;
    } catch (_error) {
      return false;
    }
  };
  const removeCommentThread = (threadId: string) =>
    view.commands?.unsetCommentAnchor?.(normalizeCommentId(threadId)) === true;
  const inspectCurrentBlock = (blockId: string) => {
    const normalizedBlockId = String(blockId || "");
    if (!normalizedBlockId) {
      return null;
    }
    const internals = view?._internals ?? null;
    const layout = internals?.getLayout?.() ?? null;
    const layoutIndex = internals?.getLayoutIndex?.() ?? null;
    const renderer = internals?.renderer ?? null;
    const scrollArea = internals?.dom?.scrollArea ?? null;
    const boxMatches = collectBoxesForBlockId(layout, normalizedBlockId, scrollArea);
    const pageIndexes = Array.from(
      new Set(
        boxMatches
          .map((entry) => Number(entry.pageIndex))
          .filter((value) => Number.isFinite(value))
      )
    ).sort((a, b) => a - b);
    const overlayEntries = listNodeOverlays().filter(
      (entry) => String(entry.blockId ?? "") === normalizedBlockId
    );
    const pageCache = renderer?.pageCache instanceof Map ? renderer.pageCache : null;
    const pageCanvases = Array.isArray(renderer?.pageCanvases) ? renderer.pageCanvases : [];
    const ghostTrace = Array.isArray((globalThis as any).__lumenGhostTrace)
      ? (globalThis as any).__lumenGhostTrace
      : [];

    return {
      blockId: normalizedBlockId,
      selection: readSelectionSummary(view),
      node: findNodeByBlockId(view.state?.doc, normalizedBlockId),
      layoutVersion:
        toFiniteNumber(layout?.__layoutVersion) ??
        toFiniteNumber(renderer?.lastLayoutVersion) ??
        null,
      overlayEntries,
      boxMatches,
      layoutIndexStats: {
        boxCount: Array.isArray(layoutIndex?.boxes) ? layoutIndex.boxes.length : 0,
        textBoxCount: Array.isArray(layoutIndex?.textBoxes) ? layoutIndex.textBoxes.length : 0,
        pageEntryCount: Array.isArray(layoutIndex?.pageEntries) ? layoutIndex.pageEntries.length : 0,
      },
      pages: pageIndexes.map((pageIndex) => {
        const page = layout?.pages?.[pageIndex] ?? null;
        const cacheEntry = pageCache?.get(pageIndex) ?? null;
        const canvasSlot =
          pageCanvases.find((entry: any) => Number(entry?.pageIndex) === pageIndex) ?? null;
        return {
          pageIndex,
          rootIndexMin: toFiniteNumber(page?.rootIndexMin),
          rootIndexMax: toFiniteNumber(page?.rootIndexMax),
          lineCount: Array.isArray(page?.lines) ? page.lines.length : 0,
          boxCount: countLayoutBoxes(page?.boxes ?? []),
          cacheEntry: cacheEntry
            ? {
                dirty: cacheEntry.dirty === true,
                width: toFiniteNumber(cacheEntry.width),
                height: toFiniteNumber(cacheEntry.height),
                signature: toFiniteNumber(cacheEntry.signature),
                signatureVersion: toFiniteNumber(cacheEntry.signatureVersion),
                displayListItemCount: Array.isArray(cacheEntry.displayList?.items)
                  ? cacheEntry.displayList.items.length
                  : 0,
              }
            : null,
          canvasSlot: canvasSlot
            ? {
                pageIndex: toFiniteNumber(canvasSlot.pageIndex),
                signature: toFiniteNumber(canvasSlot.signature),
                dprX: toFiniteNumber(canvasSlot.dprX),
                dprY: toFiniteNumber(canvasSlot.dprY),
              }
            : null,
        };
      }),
      recentTrace: ghostTrace
        .filter((entry: any) => {
          if (String(entry?.blockId ?? "") === normalizedBlockId) {
            return true;
          }
          if (pageIndexes.includes(Number(entry?.pageIndex))) {
            return true;
          }
          return false;
        })
        .slice(-40),
    };
  };
  if (typeof window !== "undefined") {
    const debugWindow = window as Window & {
      __inspectLumenBlock?: ((blockId: string) => Record<string, unknown> | null) | null;
      __listLumenNodeOverlays?: (() => Array<Record<string, unknown>>) | null;
    };
    debugWindow.__inspectLumenBlock = (blockId: string) => inspectCurrentBlock(blockId);
    debugWindow.__listLumenNodeOverlays = () => listNodeOverlays();
  }

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
  emitCommentState();

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
    getActiveCommentThreadId: () => getCommentsPluginState(view?.state).activeThreadId || null,
    activateCommentThread,
    focusCommentThread,
    removeCommentThread,
    destroy: () => {
      if (typeof window !== "undefined") {
        const debugWindow = window as Window & {
          __inspectLumenBlock?: ((blockId: string) => Record<string, unknown> | null) | null;
          __listLumenNodeOverlays?: (() => Array<Record<string, unknown>>) | null;
        };
        debugWindow.__inspectLumenBlock = null;
        debugWindow.__listLumenNodeOverlays = null;
      }
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


