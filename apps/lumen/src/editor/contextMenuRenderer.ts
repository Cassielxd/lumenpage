import { h, render } from "vue";
import type {
  ContextMenuEntry,
  ContextMenuItem,
  ContextMenuRenderLifecycle,
  ContextMenuRenderProps,
} from "lumenpage-extension-context-menu";

import ContextMenuPanel from "../components/ContextMenuPanel.vue";
import { TOOLBAR_MENU_GROUPS } from "./toolbarCatalog";

type ContextMenuPanelItem =
  | {
      type: "separator";
      id: string;
    }
  | {
      type: "item";
      id: string;
      label: string;
      icon?: string;
      shortcut?: string;
      danger: boolean;
      disabled: boolean;
      children?: ContextMenuPanelItem[];
    };

type ToolbarContextMenuMeta = {
  icon: string;
};

const toolbarMenuMetaByCommand = new Map<string, ToolbarContextMenuMeta>();
const toolbarMenuMetaByAction = new Map<string, ToolbarContextMenuMeta>();

for (const groups of Object.values(TOOLBAR_MENU_GROUPS)) {
  for (const group of groups) {
    for (const item of group.items) {
      if (item.command && !toolbarMenuMetaByCommand.has(item.command)) {
        toolbarMenuMetaByCommand.set(item.command, { icon: item.icon });
      }
      if (item.action && !toolbarMenuMetaByAction.has(item.action)) {
        toolbarMenuMetaByAction.set(item.action, { icon: item.icon });
      }
    }
  }
}

const CONTEXT_MENU_ICON_BY_ID: Record<string, string> = {
  "text.styles": "format",
  "text.styles.bold": "bold",
  "text.styles.italic": "italic",
  "text.styles.underline": "underline",
  "text.styles.strike": "strike",
  "text.styles.inline-code": "code",
  "text.styles.subscript": "subscript",
  "text.styles.superscript": "superscript",
  "paragraph.actions": "paragraph",
  "paragraph.actions.bullet-list": "bullet-list",
  "paragraph.actions.ordered-list": "ordered-list",
  "paragraph.actions.task-list": "task-list",
  "paragraph.actions.align": "align-left",
  "paragraph.actions.align-left": "align-left",
  "paragraph.actions.align-center": "align-center",
  "paragraph.actions.align-right": "align-right",
  "selection.select-all": "select-all",
  "block.transform": "node-switch",
  "block.transform.paragraph": "paragraph",
  "block.transform.heading-1": "heading",
  "block.transform.heading-2": "heading",
  "block.transform.heading-3": "heading",
  "block.transform.blockquote": "quote",
  "block.transform.code-block": "code-block",
  "block.transform.bullet-list": "bullet-list",
  "block.transform.ordered-list": "ordered-list",
  "block.delete-selection": "node-delete",
  "link.actions": "link",
  "link.open": "new-window",
  "link.copy": "copy",
  "link.unset": "remove",
  "table.actions": "table",
  "table.merge-selected": "table-merge-cell",
  "table.delete-current": "table-delete",
  "track-change.menu": "edit",
  "track-change.toggle-enabled": "edit",
  "track-change.focus-current": "search-replace",
  "track-change.accept-current": "check",
  "track-change.reject-current": "close",
  "track-change.accept-all": "check",
  "track-change.reject-all": "close",
  "document-lock.lock-selection": "selected",
  "document-lock.unlock-selection": "remove",
  "document-lock.clear-all": "node-delete",
  "document-lock.settings": "setting",
  "document-lock.toggle-enabled": "clickable",
  "document-lock.toggle-markers": "view",
};

const resolveContextMenuIcon = (entry: ContextMenuItem) => {
  const byCommand =
    (entry.command ? toolbarMenuMetaByCommand.get(entry.command)?.icon : "") || "";
  if (byCommand) {
    return byCommand;
  }

  const byAction = toolbarMenuMetaByAction.get(entry.id)?.icon || "";
  if (byAction) {
    return byAction;
  }

  return CONTEXT_MENU_ICON_BY_ID[entry.id] || "";
};

const findContextMenuItemById = (
  entries: ContextMenuEntry[],
  itemId: string
): ContextMenuItem | null => {
  for (const entry of entries) {
    if (entry.type === "separator") {
      continue;
    }
    if (entry.id === itemId) {
      return entry;
    }
    if (Array.isArray(entry.children) && entry.children.length > 0) {
      const nested = findContextMenuItemById(entry.children, itemId);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
};

const toPanelItem = (
  entry: ContextMenuEntry,
  props: ContextMenuRenderProps
): ContextMenuPanelItem => {
  if (entry.type === "separator") {
    return {
      type: "separator",
      id: entry.id,
    };
  }
  return {
    type: "item",
    id: entry.id,
    label: entry.label,
    icon: resolveContextMenuIcon(entry),
    shortcut: entry.shortcut,
    danger: entry.danger === true,
    disabled:
      Array.isArray(entry.children) && entry.children.length > 0
        ? false
        : !props.canRunItem(entry),
    children: Array.isArray(entry.children)
      ? entry.children.map((child) => toPanelItem(child, props))
      : undefined,
  };
};

export const createLumenContextMenuRenderer =
  (): (() => ContextMenuRenderLifecycle) =>
  () => {
    let currentElement: HTMLElement | null = null;

    const mount = (props: ContextMenuRenderProps) => {
      currentElement = props.element;
      const items = props.items.map((entry) => toPanelItem(entry, props));

      render(
        h(ContextMenuPanel, {
          items,
          onRunAction: (itemId: string) => {
            const item = findContextMenuItemById(props.items, itemId);
            if (!item) {
              return;
            }
            props.runItem(item);
          },
        }),
        props.element
      );
    };

    return {
      onStart: mount,
      onUpdate: mount,
      onExit(props) {
        render(null, props.element);
        currentElement = null;
      },
      isEventInside(event: Event) {
        const target = event.target as Node | null;
        return !!(target && currentElement?.contains(target));
      },
    };
  };
