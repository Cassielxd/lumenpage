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
  createBlockIdPlugin,
  createBlockIdTransaction,
  createCanvasState,
} from "lumenpage-view-canvas";
import {
  createActiveBlockSelectionPlugin,
  createDragHandlePlugin,
  createMentionPlugin,
  createSelectionBubblePlugin,
} from "lumenpage-editor-plugins";
import { history } from "lumenpage-history";
import { inputRules, emDash, ellipsis, smartQuotes } from "lumenpage-inputrules";

import type { PlaygroundDebugFlags } from "./config";
import { createCanvasSettings } from "./config";
import { PaginationDocWorkerClient } from "./paginationDocWorkerClient";
import { createPlaygroundPermissionPlugin } from "./permissionPlugin";
import { createPlaygroundI18n } from "./i18n";
import { shouldOpenLinkOnClick } from "./linkPolicy";
import { createLumenMentionPluginOptions } from "./mentionCase";
import { createTocOutlinePlugin, type TocOutlineSnapshot } from "./tocOutlinePlugin";
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
    if (typeName === "table" || typeName === "table_row" || typeName === "table_cell") {
      return true;
    }
  }
  return false;
};

const createTableSelectionGeometry = () => ({
  shouldComputeSelectionRects: ({ editorState, selection }: { editorState: any; selection: any }) => {
    const pmSel = editorState?.selection;
    if (!pmSel) {
      return false;
    }
    if (pmSel?.$anchorCell || pmSel?.$headCell || pmSel?.constructor?.name === "CellSelection") {
      return true;
    }
    if (pmSel?.constructor?.name === "NodeSelection") {
      return pmSel?.node?.type?.name === "table";
    }
    if (!selection || selection.from === selection.to) {
      return false;
    }
    return isInTableAtResolvedPos(pmSel?.$from) || isInTableAtResolvedPos(pmSel?.$to);
  },
  shouldRenderBorderOnly: ({ editorState }: { editorState: any }) => {
    const pmSel = editorState?.selection;
    return pmSel?.constructor?.name === "NodeSelection" && pmSel?.node?.type?.name === "table";
  },
});

export const mountPlaygroundEditor = ({
  host,
  statusElement,
  flags,
  onTocOutlineChange,
  tocOutlineEnabled,
}: MountPlaygroundEditorParams): MountedPlaygroundEditor => {
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

  const nodeRegistry = createDefaultNodeRendererRegistry();
  const tocOutlineController = createTocOutlinePlugin({
    onChange: onTocOutlineChange ?? undefined,
    emptyHeadingText: flags.locale === "en-US" ? "Untitled Heading" : "无标题",
    initialEnabled: tocOutlineEnabled !== false,
  });
  const plugins: any[] = [
    history(),
    createBlockIdPlugin(),
    createActiveBlockSelectionPlugin(),
    createMentionPlugin(createLumenMentionPluginOptions()),
    tocOutlineController.plugin,
    createSelectionBubblePlugin(),
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

  const tableSelectionGeometry = createTableSelectionGeometry();

  const viewProps: CanvasEditorViewProps = {
    state: readyState,
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
    canvasViewConfig: {
      settings,
      nodeRegistry,
      legacyPolicy: { strict: true },
      statusElement: statusElement || undefined,
    },
    commandConfig: {
      basicCommands,
      runCommand,
      setBlockAlign,
      viewCommands: createViewCommands(),
    },
    transformPastedText: (_view: CanvasEditorView, text: string) => normalizePastedText(text),
    transformPastedHTML: (_view: CanvasEditorView, html: string) => sanitizePastedHtml(html),
    selectionGeometry: () => tableSelectionGeometry,
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

  const view = new CanvasEditorView(host, viewProps);
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
      configurePlaygroundSecurityPolicy({ enableAudit: false });
      paginationDocWorkerClient?.destroy?.();
      view.destroy();
    },
  };
};
