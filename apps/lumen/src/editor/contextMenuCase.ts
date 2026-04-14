import {
  findDocumentLockRanges,
  findDocumentLockRangesAtPos,
  getDocumentLockPluginState,
} from "lumenpage-extension-document-lock";
import { EDITOR_SHORTCUTS, getShortcutDisplayLabel } from "lumenpage-core";
import { sanitizeLinkHref } from "lumenpage-link";
import { NodeSelection, TextSelection } from "lumenpage-state";
import {
  getTrackChangeIdsAtPos,
  getTrackChangePluginState,
  listTrackChanges,
  type TrackChangeRecord,
} from "lumenpage-extension-track-change";
import type { ContextMenuItemSource } from "lumenpage-extension-context-menu";

import type { PlaygroundLocale } from "./i18n";
import { createPlaygroundI18n } from "./i18n";

const resolveShortcutLabel = (binding: string | readonly string[] | null | undefined) => {
  const label = getShortcutDisplayLabel(binding);
  return label || undefined;
};

const TABLE_NODE_TYPES = new Set(["table", "tableRow", "tableCell", "tableHeader"]);

const selectionHasAncestorType = (
  selection: {
    $from?: {
      depth: number;
      node: (depth: number) => { type?: { name?: string } } | null;
    };
  } | null | undefined,
  typeNames: Set<string>
) => {
  const $from = selection?.$from;
  if (!$from || !Number.isFinite($from.depth)) {
    return false;
  }
  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    const typeName = $from.node(depth)?.type?.name;
    if (typeName && typeNames.has(typeName)) {
      return true;
    }
  }
  return false;
};

const getContextNodeTypeName = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return "";
  }
  const type = (value as { type?: { name?: unknown } }).type;
  return typeof type?.name === "string" ? type.name : "";
};

const getContextNodeHref = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return "";
  }
  const attrs = (value as { attrs?: { href?: unknown } }).attrs;
  return sanitizeLinkHref(attrs?.href) || "";
};

const getLinkMarkHrefAtSelection = (state: {
  doc?: {
    nodesBetween?: (from: number, to: number, fn: (node: any) => void) => void;
  };
  selection?: {
    empty?: boolean;
    from: number;
    to: number;
    $from?: {
      marks?: () => any[];
      nodeBefore?: { marks?: any[] } | null;
      nodeAfter?: { marks?: any[] } | null;
    };
  };
  schema?: { marks?: { link?: any } };
} | null) => {
  const linkType = state?.schema?.marks?.link;
  const selection = state?.selection;
  if (!linkType || !selection) {
    return "";
  }

  const readHref = (marks: any[] | null | undefined) => {
    const mark = Array.isArray(marks) ? marks.find((item) => item?.type === linkType) || null : null;
    return sanitizeLinkHref(mark?.attrs?.href) || "";
  };

  if (selection.empty === true) {
    return (
      readHref(selection.$from?.marks?.()) ||
      readHref(selection.$from?.nodeBefore?.marks) ||
      readHref(selection.$from?.nodeAfter?.marks) ||
      ""
    );
  }

  let href = "";
  state?.doc?.nodesBetween?.(selection.from, selection.to, (node: any) => {
    if (href || !node?.isInline) {
      return;
    }
    href = readHref(node.marks);
  });
  return href;
};

const hasLinkMarkAtSelection = (state: {
  doc?: {
    nodesBetween?: (from: number, to: number, fn: (node: any) => void) => void;
  };
  selection?: {
    empty?: boolean;
    from: number;
    to: number;
    $from?: {
      marks?: () => any[];
      nodeBefore?: { marks?: any[] } | null;
      nodeAfter?: { marks?: any[] } | null;
    };
  };
  schema?: { marks?: { link?: any } };
} | null) => {
  const linkType = state?.schema?.marks?.link;
  const selection = state?.selection;
  if (!linkType || !selection) {
    return false;
  }

  const hasLink = (marks: any[] | null | undefined) =>
    Array.isArray(marks) && marks.some((item) => item?.type === linkType);

  if (selection.empty === true) {
    return (
      hasLink(selection.$from?.marks?.()) ||
      hasLink(selection.$from?.nodeBefore?.marks) ||
      hasLink(selection.$from?.nodeAfter?.marks)
    );
  }

  let matched = false;
  state?.doc?.nodesBetween?.(selection.from, selection.to, (node: any) => {
    if (!matched && node?.isInline && hasLink(node.marks)) {
      matched = true;
    }
  });
  return matched;
};

const getContextLinkHref = (
  state: {
    doc?: unknown;
    selection?: unknown;
    schema?: unknown;
  } | null,
  value: unknown
) => getContextNodeHref(value) || getLinkMarkHrefAtSelection(state as any);

const resolveDeleteSelectionTarget = ({
  state,
  context,
}: {
  state: {
    doc: any;
    selection?: {
      from: number;
      to: number;
      empty: boolean;
      $from?: {
        depth: number;
        node: (depth: number) => any;
        before: (depth: number) => number;
        start: (depth: number) => number;
        end: (depth: number) => number;
      };
    };
  } | null;
  context: { node?: unknown; nodePos?: number | null };
}) => {
  const selection = state?.selection;
  const doc = state?.doc;
  if (!selection || !doc) {
    return null;
  }

  const nodePos = Number(context.nodePos);
  if (Number.isFinite(nodePos) && nodePos >= 0) {
    const node = doc.nodeAt?.(nodePos);
    if (node && NodeSelection.isSelectable(node)) {
      return { type: "node" as const, pos: nodePos };
    }
  }

  const $from = selection.$from;
  if ($from) {
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      const node = $from.node(depth);
      if (!node?.type?.isBlock) {
        continue;
      }
      const blockPos = $from.before(depth);
      if (NodeSelection.isSelectable(node)) {
        return { type: "node" as const, pos: blockPos };
      }
      const from = $from.start(depth);
      const to = $from.end(depth);
      if (Number.isFinite(from) && Number.isFinite(to) && to > from) {
        return { type: "text" as const, from, to };
      }
    }
  }

  if (!selection.empty && selection.to > selection.from) {
    return { type: "text" as const, from: selection.from, to: selection.to };
  }

  return null;
};

const deleteCurrentTableAtSelection = ({
  state,
  view,
}: {
  state: {
    selection?: {
      $from?: {
        depth: number;
        node: (depth: number) => any;
        before: (depth: number) => number;
      };
    };
    tr: any;
    schema?: { nodes?: { paragraph?: any } };
  } | null;
  view: { dispatch?: (tr: any) => void } | null | undefined;
}) => {
  const $from = state?.selection?.$from;
  const tr = state?.tr;
  if (!$from || !tr || typeof view?.dispatch !== "function") {
    return false;
  }
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node?.type?.name !== "table") {
      continue;
    }
    const tablePos = $from.before(depth);
    const paragraphType = state?.schema?.nodes?.paragraph;
    const paragraph = paragraphType?.createAndFill?.() ?? paragraphType?.create?.() ?? null;
    const nextTr = paragraph
      ? tr.replaceWith(tablePos, tablePos + node.nodeSize, paragraph)
      : tr.delete(tablePos, tablePos + node.nodeSize);
    view.dispatch(nextTr.scrollIntoView());
    return true;
  }
  return false;
};

const findTrackChangeAtContext = ({
  currentPos,
  selectionFrom,
  selectionTo,
  records,
  activeChangeId,
}: {
  currentPos: number;
  selectionFrom: number | null;
  selectionTo: number | null;
  records: TrackChangeRecord[];
  activeChangeId: string | null;
}) => {
  const hitRecord =
    records.find((record) => currentPos >= record.from && currentPos <= record.to) || null;
  if (hitRecord) {
    return hitRecord;
  }

  if (
    Number.isFinite(selectionFrom) &&
    Number.isFinite(selectionTo) &&
    selectionTo != null &&
    selectionFrom != null &&
    selectionTo > selectionFrom
  ) {
    const selectionRecord =
      records.find((record) => record.from < selectionTo && record.to > selectionFrom) || null;
    if (selectionRecord) {
      return selectionRecord;
    }
  }

  if (activeChangeId) {
    return records.find((record) => record.changeId === activeChangeId) || null;
  }

  return null;
};

export const createLumenContextMenuItems = ({
  locale,
}: {
  locale: PlaygroundLocale;
}): ContextMenuItemSource => {
  return ({ state, context }) => {
    const i18n = createPlaygroundI18n(locale);
    const texts = i18n.contextMenu;
    const pluginState = getDocumentLockPluginState(state);
    const currentPos = Number.isFinite(context.pos)
      ? Number(context.pos)
      : Number(state?.selection?.from ?? 0);
    const currentLockRanges = findDocumentLockRangesAtPos(state, currentPos);
    const allLockRanges = findDocumentLockRanges(state);
    const trackChangeState = getTrackChangePluginState(state);
    const allTrackChanges = listTrackChanges(state);
    const selection = context.selection;
    const hasRangeSelection = !!selection && selection.empty !== true && selection.to > selection.from;
    const selectionFrom = hasRangeSelection ? Number(selection?.from ?? 0) : null;
    const selectionTo = hasRangeSelection ? Number(selection?.to ?? 0) : null;
    const currentTrackChangeId =
      getTrackChangeIdsAtPos(state, currentPos)[0] || trackChangeState.activeChangeId || null;
    const currentTrackChange = findTrackChangeAtContext({
      currentPos,
      selectionFrom,
      selectionTo,
      records: allTrackChanges,
      activeChangeId: currentTrackChangeId,
    });
    const isTableContext =
      TABLE_NODE_TYPES.has(getContextNodeTypeName(context.node)) ||
      selectionHasAncestorType(state?.selection, TABLE_NODE_TYPES);
    const currentLinkHref = getContextLinkHref(state as any, context.node);
    const hasActiveLinkMark = hasLinkMarkAtSelection(state as any);

    return [
      {
        id: "history.undo",
        label: texts.undo,
        command: "undo",
        shortcut: resolveShortcutLabel(EDITOR_SHORTCUTS.undo),
      },
      {
        id: "history.redo",
        label: texts.redo,
        command: "redo",
        shortcut: resolveShortcutLabel(EDITOR_SHORTCUTS.redo),
      },
      {
        type: "separator" as const,
        id: "block.sep.history",
      },
      {
        id: "text.styles",
        label: texts.textStyles,
        children: [
          {
            id: "text.styles.bold",
            label: texts.toggleBold,
            command: "toggleBold",
            shortcut: resolveShortcutLabel(EDITOR_SHORTCUTS.toggleBold),
          },
          {
            id: "text.styles.italic",
            label: texts.toggleItalic,
            command: "toggleItalic",
            shortcut: resolveShortcutLabel(EDITOR_SHORTCUTS.toggleItalic),
          },
          {
            id: "text.styles.underline",
            label: texts.toggleUnderline,
            command: "toggleUnderline",
            shortcut: resolveShortcutLabel(EDITOR_SHORTCUTS.toggleUnderline),
          },
          {
            id: "text.styles.strike",
            label: texts.toggleStrike,
            command: "toggleStrike",
            shortcut: resolveShortcutLabel(EDITOR_SHORTCUTS.toggleStrike),
          },
          {
            type: "separator" as const,
            id: "text.styles.sep.inline-code",
          },
          {
            id: "text.styles.inline-code",
            label: texts.toggleInlineCode,
            command: "toggleInlineCode",
            shortcut: resolveShortcutLabel(EDITOR_SHORTCUTS.toggleInlineCode),
          },
          {
            type: "separator" as const,
            id: "text.styles.sep.script",
          },
          {
            id: "text.styles.subscript",
            label: texts.toggleSubscript,
            command: "toggleSubscript",
          },
          {
            id: "text.styles.superscript",
            label: texts.toggleSuperscript,
            command: "toggleSuperscript",
          },
        ],
      },
      {
        id: "paragraph.actions",
        label: texts.paragraphActions,
        children: [
          {
            id: "paragraph.actions.bullet-list",
            label: texts.turnToBulletList,
            command: "toggleBulletList",
            shortcut: resolveShortcutLabel(EDITOR_SHORTCUTS.toggleBulletList),
          },
          {
            id: "paragraph.actions.ordered-list",
            label: texts.turnToOrderedList,
            command: "toggleOrderedList",
            shortcut: resolveShortcutLabel(EDITOR_SHORTCUTS.toggleOrderedList),
          },
          {
            id: "paragraph.actions.task-list",
            label: texts.toggleTaskList,
            command: "toggleTaskList",
          },
          {
            type: "separator" as const,
            id: "paragraph.actions.sep.align",
          },
          {
            id: "paragraph.actions.align",
            label: texts.alignActions,
            children: [
              {
                id: "paragraph.actions.align-left",
                label: texts.alignLeft,
                command: "alignLeft",
              },
              {
                id: "paragraph.actions.align-center",
                label: texts.alignCenter,
                command: "alignCenter",
              },
              {
                id: "paragraph.actions.align-right",
                label: texts.alignRight,
                command: "alignRight",
              },
            ],
          },
        ],
      },
      {
        type: "separator" as const,
        id: "block.sep.text",
      },
      {
        id: "selection.select-all",
        label: texts.selectAll,
        command: "selectAll",
        shortcut: resolveShortcutLabel(EDITOR_SHORTCUTS.selectAll),
      },
      {
        type: "separator" as const,
        id: "selection.sep.all",
      },
      {
        id: "block.transform",
        label: texts.transformBlock,
        children: [
          {
            id: "block.transform.paragraph",
            label: texts.turnToParagraph,
            command: "setParagraph",
          },
          {
            id: "block.transform.heading-1",
            label: texts.turnToHeading1,
            command: "setHeading",
            args: [{ level: 1 }],
            shortcut: resolveShortcutLabel(EDITOR_SHORTCUTS.toggleHeading1),
          },
          {
            id: "block.transform.heading-2",
            label: texts.turnToHeading2,
            command: "setHeading",
            args: [{ level: 2 }],
            shortcut: resolveShortcutLabel(EDITOR_SHORTCUTS.toggleHeading2),
          },
          {
            id: "block.transform.heading-3",
            label: texts.turnToHeading3,
            command: "setHeading",
            args: [{ level: 3 }],
            shortcut: resolveShortcutLabel(EDITOR_SHORTCUTS.toggleHeading3),
          },
          {
            type: "separator" as const,
            id: "block.transform.sep.rich",
          },
          {
            id: "block.transform.blockquote",
            label: texts.turnToBlockquote,
            command: "toggleBlockquote",
            shortcut: resolveShortcutLabel(EDITOR_SHORTCUTS.toggleBlockquote),
          },
          {
            id: "block.transform.code-block",
            label: texts.turnToCodeBlock,
            command: "toggleCodeBlock",
          },
          {
            id: "block.transform.bullet-list",
            label: texts.turnToBulletList,
            command: "toggleBulletList",
            shortcut: resolveShortcutLabel(EDITOR_SHORTCUTS.toggleBulletList),
          },
          {
            id: "block.transform.ordered-list",
            label: texts.turnToOrderedList,
            command: "toggleOrderedList",
            shortcut: resolveShortcutLabel(EDITOR_SHORTCUTS.toggleOrderedList),
          },
        ],
      },
      {
        id: "block.delete-selection",
        label: texts.deleteCurrentBlock,
        run: ({ editor, state, view, context: currentContext }) => {
          const target = resolveDeleteSelectionTarget({
            state,
            context: currentContext,
          });
          if (!target || !view?.dispatch) {
            return false;
          }
          if (target.type === "node") {
            view.dispatch(
              state.tr
                .setSelection(NodeSelection.create(state.doc, target.pos))
                .setMeta("addToHistory", false)
            );
          } else {
            view.dispatch(
              state.tr
                .setSelection(TextSelection.create(state.doc, target.from, target.to))
                .setMeta("addToHistory", false)
            );
          }
          return editor.commands.deleteSelection?.() === true;
        },
        danger: true,
      },
      {
        type: "separator" as const,
        id: "link.sep.primary",
      },
      {
        id: "link.actions",
        label: texts.linkActions,
        isVisible: () => !!currentLinkHref,
        children: [
          {
            id: "link.open",
            label: texts.openLink,
            run: () => {
              if (!currentLinkHref || typeof window === "undefined") {
                return false;
              }
              window.open(currentLinkHref, "_blank", "noopener,noreferrer");
              return true;
            },
          },
          {
            id: "link.copy",
            label: texts.copyLink,
            run: () => {
              if (!currentLinkHref || typeof navigator === "undefined") {
                return false;
              }
              void navigator.clipboard?.writeText?.(currentLinkHref);
              return true;
            },
          },
          {
            type: "separator" as const,
            id: "link.sep.remove",
          },
          {
            id: "link.unset",
            label: texts.unsetLink,
            command: "unsetLink",
            isVisible: () => hasActiveLinkMark,
          },
        ],
      },
      {
        type: "separator" as const,
        id: "table.sep.primary",
      },
      {
        id: "table.actions",
        label: texts.tableActions,
        isVisible: () => isTableContext,
        children: [
          {
            id: "table.add-row-before",
            label: texts.addTableRowBefore,
            command: "addTableRowBefore",
          },
          {
            id: "table.add-row-after",
            label: texts.addTableRowAfter,
            command: "addTableRowAfter",
          },
          {
            id: "table.delete-row",
            label: texts.deleteTableRow,
            command: "deleteTableRow",
            danger: true,
          },
          {
            type: "separator" as const,
            id: "table.sep.columns",
          },
          {
            id: "table.add-column-before",
            label: texts.addTableColumnBefore,
            command: "addTableColumnBefore",
          },
          {
            id: "table.add-column-after",
            label: texts.addTableColumnAfter,
            command: "addTableColumnAfter",
          },
          {
            id: "table.delete-column",
            label: texts.deleteTableColumn,
            command: "deleteTableColumn",
            danger: true,
          },
          {
            type: "separator" as const,
            id: "table.sep.cells",
          },
          {
            id: "table.merge-right",
            label: texts.mergeTableCellRight,
            command: "mergeTableCellRight",
          },
          {
            id: "table.split-cell",
            label: texts.splitTableCell,
            command: "splitTableCell",
          },
          {
            id: "table.merge-selected",
            label: texts.mergeSelectedTableCells,
            command: "mergeSelectedTableCells",
          },
          {
            type: "separator" as const,
            id: "table.sep.delete",
          },
          {
            id: "table.delete-current",
            label: texts.deleteCurrentTable,
            danger: true,
            run: ({ state, view }) => deleteCurrentTableAtSelection({ state, view }),
          },
        ],
      },
      {
        type: "separator" as const,
        id: "track-change.sep.primary",
      },
      {
        id: "track-change.menu",
        label: texts.trackChanges,
        children: [
          {
            id: "track-change.toggle-enabled",
            label:
              trackChangeState.enabled === true
                ? texts.disableTrackChanges
                : texts.enableTrackChanges,
            command: "setTrackChanges",
            args: [trackChangeState.enabled !== true],
          },
          {
            type: "separator" as const,
            id: "track-change.sep.current",
          },
          {
            id: "track-change.focus-current",
            label: texts.focusCurrentChange,
            command: "focusTrackChange",
            args: currentTrackChange ? [currentTrackChange.changeId] : [],
            isVisible: () => !!currentTrackChange,
          },
          {
            id: "track-change.accept-current",
            label: texts.acceptCurrentChange,
            command: "acceptTrackChange",
            args: currentTrackChange ? [currentTrackChange.changeId] : [],
            isVisible: () => !!currentTrackChange,
          },
          {
            id: "track-change.reject-current",
            label: texts.rejectCurrentChange,
            command: "rejectTrackChange",
            args: currentTrackChange ? [currentTrackChange.changeId] : [],
            danger: true,
            isVisible: () => !!currentTrackChange,
          },
          {
            type: "separator" as const,
            id: "track-change.sep.all",
          },
          {
            id: "track-change.accept-all",
            label: texts.acceptAllChanges,
            command: "acceptAllTrackChanges",
            isVisible: () => allTrackChanges.length > 0,
          },
          {
            id: "track-change.reject-all",
            label: texts.rejectAllChanges,
            command: "rejectAllTrackChanges",
            danger: true,
            isVisible: () => allTrackChanges.length > 0,
          },
        ],
      },
      {
        type: "separator" as const,
        id: "document-lock.sep.history",
      },
      {
        id: "document-lock.lock-selection",
        label: texts.lockSelection,
        command: "lockSelection",
        isVisible: () => hasRangeSelection,
      },
      {
        id: "document-lock.unlock-selection",
        label: texts.unlockCurrent,
        command: "unlockSelection",
        isVisible: () => currentLockRanges.length > 0,
      },
      {
        type: "separator" as const,
        id: "document-lock.sep.primary",
      },
      {
        id: "document-lock.clear-all",
        label: texts.clearAllLocks,
        command: "clearAllDocumentLocks",
        danger: true,
        isVisible: () => allLockRanges.length > 0,
      },
      {
        type: "separator" as const,
        id: "document-lock.sep.settings",
      },
      {
        id: "document-lock.settings",
        label: texts.lockSettings,
        children: [
          {
            id: "document-lock.toggle-enabled",
            label: pluginState.enabled === true ? texts.disableProtection : texts.enableProtection,
            command: "setDocumentLocking",
            args: [pluginState.enabled !== true],
          },
          {
            id: "document-lock.toggle-markers",
            label: pluginState.showMarkers === true ? texts.hideLockMarkers : texts.showLockMarkers,
            command: "setDocumentLockMarkersVisible",
            args: [pluginState.showMarkers !== true],
          },
        ],
      },
    ];
  };
};
