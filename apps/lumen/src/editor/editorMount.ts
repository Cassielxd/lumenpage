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
import BubbleMenu from "lumenpage-extension-bubble-menu";
import {
  CommentsPluginKey,
  findCommentAnchorRange,
  getCommentsPluginState,
  normalizeCommentId,
} from "lumenpage-extension-comment";
import {
  getTrackChangePluginState,
  listTrackChanges,
  normalizeTrackChangeId,
  type TrackChangeRecord,
} from "lumenpage-extension-track-change";
import { DragHandleExtension } from "lumenpage-extension-drag-handle";
import { EmbedPanelBrowserViewExtension } from "lumenpage-extension-embed-panel/browser";
import { MentionExtension } from "lumenpage-extension-mention";
import { SlashCommandExtension } from "lumenpage-extension-slash-command";

import type { PlaygroundDebugFlags } from "./config";
import { LUMEN_BUBBLE_MENU_ACTIONS, createLumenBubbleMenuRenderer } from "./bubbleMenuRenderer";
import { createCanvasSettings } from "./config";
import {
  createLumenCollaborationRuntime,
  type LumenCollaborationState,
} from "./collaboration";
import { PaginationDocWorkerClient } from "./paginationDocWorkerClient";
import { createPlaygroundPermissionPlugin } from "./permissionPlugin";
import { createPlaygroundI18n } from "./i18n";
import { shouldOpenLinkOnClick } from "./linkPolicy";
import { createMentionPluginOptions } from "./mentionCase";
import { createSlashCommandOptions } from "./slashCommandCase";
import { lumenCommentsStore } from "./commentsStore";
import { createTocOutlinePlugin, type TocOutlineSnapshot } from "./tocOutlinePlugin";
import { createLumenDocumentExtensions } from "./documentExtensions";
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
  onCollaborationStateChange?: ((state: LumenCollaborationState) => void) | null;
  onTocOutlineChange?: ((snapshot: TocOutlineSnapshot) => void) | null;
  tocOutlineEnabled?: boolean;
  onCommentStateChange?: ((snapshot: { activeThreadId: string | null }) => void) | null;
  onTrackChangeStateChange?: ((snapshot: TrackChangeStateSnapshot) => void) | null;
  onStatsChange?: ((stats: EditorStatsSnapshot) => void) | null;
};

type MountedPlaygroundEditor = {
  editor: Editor;
  view: CanvasEditorView;
  setTocOutlineEnabled: (enabled: boolean) => void;
  isTocOutlineEnabled: () => boolean;
  getActiveCommentThreadId: () => string | null;
  setCommentAnchor: (options: { threadId: string; anchorId: string }) => boolean;
  activateCommentThread: (threadId: string | null) => boolean;
  focusCommentThread: (threadId: string) => boolean;
  removeCommentThread: (threadId: string) => boolean;
  isTrackChangesEnabled: () => boolean;
  setTrackChangesEnabled: (enabled: boolean) => boolean;
  getActiveTrackChangeId: () => string | null;
  activateTrackChange: (changeId: string | null) => boolean;
  focusTrackChange: (changeId: string) => boolean;
  acceptTrackChange: (changeId: string) => boolean;
  rejectTrackChange: (changeId: string) => boolean;
  acceptAllTrackChanges: () => boolean;
  rejectAllTrackChanges: () => boolean;
  destroy: () => void;
};

type TrackChangeStateSnapshot = {
  enabled: boolean;
  activeChangeId: string | null;
  changes: TrackChangeRecord[];
};

type EditorStatsSnapshot = {
  pageCount: number;
  currentPage: number;
  nodeCount: number;
  pluginCount: number;
  wordCount: number;
  selectedWordCount: number;
  blockType: string;
};

const toFiniteNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const areTrackChangeRecordsEqual = (
  left: TrackChangeRecord[],
  right: TrackChangeRecord[]
) => {
  if (left === right) {
    return true;
  }
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    const leftRecord = left[index];
    const rightRecord = right[index];
    if (!leftRecord || !rightRecord) {
      return false;
    }
    if (
      leftRecord.changeId !== rightRecord.changeId ||
      leftRecord.from !== rightRecord.from ||
      leftRecord.to !== rightRecord.to ||
      leftRecord.userId !== rightRecord.userId ||
      leftRecord.userName !== rightRecord.userName ||
      leftRecord.createdAt !== rightRecord.createdAt ||
      leftRecord.insertedText !== rightRecord.insertedText ||
      leftRecord.deletedText !== rightRecord.deletedText
    ) {
      return false;
    }
    const leftKinds = Array.isArray(leftRecord.kinds) ? leftRecord.kinds : [];
    const rightKinds = Array.isArray(rightRecord.kinds) ? rightRecord.kinds : [];
    if (leftKinds.length !== rightKinds.length) {
      return false;
    }
    for (let kindIndex = 0; kindIndex < leftKinds.length; kindIndex += 1) {
      if (leftKinds[kindIndex] !== rightKinds[kindIndex]) {
        return false;
      }
    }
  }
  return true;
};

const areTrackChangeSnapshotsEqual = (
  left: TrackChangeStateSnapshot | null,
  right: TrackChangeStateSnapshot
) =>
  !!left &&
  left.enabled === right.enabled &&
  left.activeChangeId === right.activeChangeId &&
  areTrackChangeRecordsEqual(left.changes, right.changes);

const areEditorStatsEqual = (left: EditorStatsSnapshot | null, right: EditorStatsSnapshot) =>
  !!left &&
  left.pageCount === right.pageCount &&
  left.currentPage === right.currentPage &&
  left.nodeCount === right.nodeCount &&
  left.pluginCount === right.pluginCount &&
  left.wordCount === right.wordCount &&
  left.selectedWordCount === right.selectedWordCount &&
  left.blockType === right.blockType;

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
  onCollaborationStateChange,
  onTocOutlineChange,
  tocOutlineEnabled,
  onCommentStateChange,
  onTrackChangeStateChange,
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
  const collaborationRuntime = createLumenCollaborationRuntime({
    flags,
    onStateChange: onCollaborationStateChange || null,
  });
  lumenCommentsStore.useCollaborationStore(
    collaborationRuntime.provider?.document || null,
    flags.collaborationField
  );

  const bubbleMenuElement = host.ownerDocument.createElement("div");
  const bubbleMenuRenderer = createLumenBubbleMenuRenderer({ locale: flags.locale });

  const extensions = [
    ...createLumenDocumentExtensions({
      collaboration: collaborationRuntime.provider
        ? {
            document: collaborationRuntime.provider.document,
            field: flags.collaborationField,
            provider: collaborationRuntime.provider,
            user: {
              name: flags.collaborationUserName,
              color: flags.collaborationUserColor,
            },
            onUsersChange: collaborationRuntime.updateUsers,
          }
        : null,
      locale: flags.locale,
    }),
    EmbedPanelBrowserViewExtension,
    ActiveBlockSelectionExtension,
    MentionExtension.configure(createMentionPluginOptions()),
    SlashCommandExtension.configure(createSlashCommandOptions(flags.locale)),
    BubbleMenu.configure({
      element: bubbleMenuElement,
      render: bubbleMenuRenderer,
      actions: LUMEN_BUBBLE_MENU_ACTIONS,
    }),
    DragHandleExtension.configure({ onlyTopLevel: true }),
  ];
  const tocOutlineController = createTocOutlinePlugin({
    onChange: onTocOutlineChange ?? undefined,
    emptyHeadingText: flags.locale === "en-US" ? "Untitled Heading" : "\u65e0\u6807\u9898",
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
    const handled = editor.commands.toggleTaskItemChecked?.(pos, { onlyWhenNearStart: true }) === true;
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
    content: collaborationRuntime.provider ? "" : initialDocJson,
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
  let trackChangeFrameId = 0;
  let cachedTrackChangeDoc: any = null;
  let cachedTrackChangeRevision: number | null = null;
  let cachedTrackChangeRecords: TrackChangeRecord[] = [];
  let lastTrackChangeSnapshot: TrackChangeStateSnapshot | null = null;
  const emitTrackChangeState = () => {
    if (!onTrackChangeStateChange) {
      return;
    }
    const pluginState = getTrackChangePluginState(view?.state);
    const nextRevision = Number.isFinite(pluginState?.revision) ? Number(pluginState.revision) : 0;
    const currentDoc = view?.state?.doc ?? null;
    if (currentDoc !== cachedTrackChangeDoc || nextRevision !== cachedTrackChangeRevision) {
      cachedTrackChangeDoc = currentDoc;
      cachedTrackChangeRevision = nextRevision;
      cachedTrackChangeRecords = listTrackChanges(view?.state);
    }
    const nextSnapshot: TrackChangeStateSnapshot = {
      enabled: pluginState.enabled === true,
      activeChangeId: pluginState.activeChangeId || null,
      changes: cachedTrackChangeRecords,
    };
    if (areTrackChangeSnapshotsEqual(lastTrackChangeSnapshot, nextSnapshot)) {
      return;
    }
    lastTrackChangeSnapshot = {
      enabled: nextSnapshot.enabled,
      activeChangeId: nextSnapshot.activeChangeId,
      changes: nextSnapshot.changes.map((record) => ({
        ...record,
        kinds: Array.isArray(record.kinds) ? record.kinds.slice() : [],
      })),
    };
    onTrackChangeStateChange(nextSnapshot);
  };
  const scheduleTrackChangeStateEmit = () => {
    if (!onTrackChangeStateChange) {
      return;
    }
    if (trackChangeFrameId && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(trackChangeFrameId);
      trackChangeFrameId = 0;
    }
    if (typeof requestAnimationFrame === "function") {
      trackChangeFrameId = requestAnimationFrame(() => {
        trackChangeFrameId = 0;
        emitTrackChangeState();
      });
      return;
    }
    emitTrackChangeState();
  };
  const baseDispatchTransaction =
    typeof view.dispatchTransaction === "function" ? view.dispatchTransaction.bind(view) : null;
  if (baseDispatchTransaction) {
    view.dispatchTransaction = (transaction: any) => {
      baseDispatchTransaction(transaction);
      emitCommentState();
      scheduleTrackChangeStateEmit();
    };
  }
  const setCommentAnchor = (options: { threadId: string; anchorId: string }) =>
    editor.commands.setCommentAnchor?.(options) === true;
  const activateCommentThread = (threadId: string | null) =>
    editor.commands.activateCommentThread?.(threadId) === true;
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
    editor.commands.unsetCommentAnchor?.(normalizeCommentId(threadId)) === true;
  const setTrackChangesEnabled = (enabled: boolean) =>
    editor.commands.setTrackChanges?.(enabled) === true;
  const activateTrackChange = (changeId: string | null) =>
    editor.commands.setActiveTrackChange?.(normalizeTrackChangeId(changeId)) === true;
  const focusTrackChange = (changeId: string) =>
    editor.commands.focusTrackChange?.(normalizeTrackChangeId(changeId)) === true;
  const acceptTrackChange = (changeId: string) =>
    editor.commands.acceptTrackChange?.(normalizeTrackChangeId(changeId)) === true;
  const rejectTrackChange = (changeId: string) =>
    editor.commands.rejectTrackChange?.(normalizeTrackChangeId(changeId)) === true;
  const acceptAllTrackChanges = () => editor.commands.acceptAllTrackChanges?.() === true;
  const rejectAllTrackChanges = () => editor.commands.rejectAllTrackChanges?.() === true;
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
  let cachedStatsDoc: any = null;
  let cachedDocNodeCount = 0;
  let cachedDocWordCount = 0;
  let lastStatsSnapshot: EditorStatsSnapshot | null = null;
  const scrollArea = view?._internals?.dom?.scrollArea ?? null;
  const emitStats = () => {
    if (!onStatsChange) {
      return;
    }
    const pagination = typeof view.getPaginationInfo === "function" ? view.getPaginationInfo() : null;
    const state = view.state;
    const currentDoc = state?.doc ?? null;
    if (currentDoc !== cachedStatsDoc) {
      cachedStatsDoc = currentDoc;
      cachedDocNodeCount = 0;
      cachedDocWordCount = 0;
      try {
        currentDoc?.descendants?.(() => {
          cachedDocNodeCount += 1;
        });
      } catch (_error) {
        cachedDocNodeCount = 0;
      }
      try {
        const docText = String(currentDoc?.textContent || "");
        cachedDocWordCount = docText.replace(/\s+/g, "").length;
      } catch (_error) {
        cachedDocWordCount = 0;
      }
    }
    let wordCount = 0;
    let selectedWordCount = 0;
    try {
      wordCount = cachedDocWordCount;
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

    const nextStats: EditorStatsSnapshot = {
      pageCount,
      currentPage,
      nodeCount: cachedDocNodeCount,
      pluginCount: Math.max(0, Number(state?.plugins?.length) || 0),
      wordCount,
      selectedWordCount,
      blockType,
    };
    if (areEditorStatsEqual(lastStatsSnapshot, nextStats)) {
      return;
    }
    lastStatsSnapshot = nextStats;
    onStatsChange(nextStats);
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
  emitTrackChangeState();

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
    editor,
    view,
    setTocOutlineEnabled: (enabled: boolean) => {
      tocOutlineController.setEnabled(enabled);
    },
    isTocOutlineEnabled: () => tocOutlineController.isEnabled(),
    getActiveCommentThreadId: () => getCommentsPluginState(view?.state).activeThreadId || null,
    setCommentAnchor,
    activateCommentThread,
    focusCommentThread,
    removeCommentThread,
    isTrackChangesEnabled: () => getTrackChangePluginState(view?.state).enabled === true,
    setTrackChangesEnabled,
    getActiveTrackChangeId: () => getTrackChangePluginState(view?.state).activeChangeId || null,
    activateTrackChange,
    focusTrackChange,
    acceptTrackChange,
    rejectTrackChange,
    acceptAllTrackChanges,
    rejectAllTrackChanges,
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
      if (trackChangeFrameId && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(trackChangeFrameId);
      }
      if (statsTimeoutId != null) {
        clearTimeout(statsTimeoutId);
      }
      configurePlaygroundSecurityPolicy({ enableAudit: false });
      paginationDocWorkerClient?.destroy?.();
      collaborationRuntime.destroy();
      editor.destroy();
      lumenCommentsStore.useLocalStore({ clear: true });
    },
  };
};




