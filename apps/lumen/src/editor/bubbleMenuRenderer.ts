import { h, render } from "vue";
import type {
  BubbleMenuAction,
  BubbleMenuRenderLifecycle,
  BubbleMenuRenderProps,
} from "lumenpage-extension-bubble-menu";

import BubbleMenuPanel from "../components/BubbleMenuPanel.vue";
import type { PlaygroundLocale } from "./i18n";
import { resolveToolbarCatalogLabel, TOOLBAR_MENU_GROUPS } from "./toolbarCatalog";

type BubbleMenuPanelItem = {
  id: string;
  icon?: string;
  label: string;
  active: boolean;
  disabled: boolean;
};

type ToolbarBubbleMeta = {
  icon: string;
  labelKey: string;
};

type LumenBubbleMenuRendererOptions = {
  locale: PlaygroundLocale;
};

export const LUMEN_BUBBLE_MENU_ACTIONS: BubbleMenuAction[] = [
  { id: "bold", label: "B", command: "toggleBold", icon: "bold", markName: "bold" },
  { id: "italic", label: "I", command: "toggleItalic", icon: "italic", markName: "italic" },
  {
    id: "underline",
    label: "U",
    command: "toggleUnderline",
    icon: "underline",
    markName: "underline",
  },
  { id: "strike", label: "S", command: "toggleStrike", icon: "strike", markName: "strike" },
  {
    id: "inline-code",
    label: "</>",
    command: "toggleInlineCode",
    icon: "code",
    markName: "code",
  },
];

const toolbarItemByAction = new Map<string, ToolbarBubbleMeta>();

for (const groups of Object.values(TOOLBAR_MENU_GROUPS)) {
  for (const group of groups) {
    for (const item of group.items) {
      if (!toolbarItemByAction.has(item.action)) {
        toolbarItemByAction.set(item.action, {
          icon: item.icon,
          labelKey: item.labelKey,
        });
      }
    }
  }
}

const resolvePanelItem = (
  action: BubbleMenuAction,
  locale: PlaygroundLocale,
  props: BubbleMenuRenderProps
): BubbleMenuPanelItem => {
  const toolbarItem = toolbarItemByAction.get(action.id);
  return {
    id: action.id,
    icon: toolbarItem?.icon || action.icon,
    label: (toolbarItem ? resolveToolbarCatalogLabel(locale, toolbarItem.labelKey) : "") || action.label,
    active: props.isActionActive(action),
    disabled: !props.canRunAction(action),
  };
};

export const createLumenBubbleMenuRenderer = ({
  locale,
}: LumenBubbleMenuRendererOptions): (() => BubbleMenuRenderLifecycle) => () => {
  let currentElement: HTMLElement | null = null;

  const mount = (props: BubbleMenuRenderProps) => {
    currentElement = props.element;
    const items = props.actions.map((action) => resolvePanelItem(action, locale, props));

    render(
      h(BubbleMenuPanel, {
        items,
        onRunAction: (actionId: string) => {
          const action = props.actions.find((item) => item.id === actionId);
          if (!action) {
            return;
          }
          props.runAction(action);
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
