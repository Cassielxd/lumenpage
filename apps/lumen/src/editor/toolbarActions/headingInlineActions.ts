import { computed, nextTick, ref } from "vue";
import type { ToolbarItemConfig } from "../toolbarCatalog";
import type { GetEditorCommandMap } from "./commandUtils";
import { invokeCommand } from "./commandUtils";

type GetView = () => any;

type MaybeElementRef = HTMLElement | HTMLElement[] | null;
export type HeadingInlineValue = string | number;
export type HeadingInlineOption = {
  id: string;
  value: HeadingInlineValue;
};

const HEADING_INLINE_VISIBLE_COUNT = 3;
const HEADING_INLINE_PANEL_COLUMNS = 3;
const HEADING_INLINE_PANEL_WIDTH = 262;
const HEADING_INLINE_PANEL_OPTION_HEIGHT = 44;
const HEADING_INLINE_PANEL_GAP = 3;
const HEADING_INLINE_PANEL_PADDING = 7;

const HEADING_INLINE_OPTIONS: HeadingInlineOption[] = [
  { id: "paragraph", value: "paragraph" },
  { id: "h1", value: 1 },
  { id: "h2", value: 2 },
  { id: "h3", value: 3 },
  { id: "h4", value: 4 },
  { id: "h5", value: 5 },
  { id: "h6", value: 6 },
];

export const HEADING_INLINE_BOX_ACTION = "heading-inline-box";

export const createHeadingInlineItems = (): ToolbarItemConfig[] => [
  {
    id: "heading-inline-box",
    icon: "",
    label: { "zh-CN": "", "en-US": "" },
    action: HEADING_INLINE_BOX_ACTION,
    implemented: true,
  },
];

export const isHeadingInlineBoxItem = (item: ToolbarItemConfig) =>
  item.action === HEADING_INLINE_BOX_ACTION;

const resolveSingleElement = (value: MaybeElementRef): HTMLElement | null => {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.find((element) => element instanceof HTMLElement) || null;
  }
  return value instanceof HTMLElement ? value : null;
};

const resolveTypographyClass = (value: HeadingInlineValue) => {
  if (value === "paragraph") {
    return "heading-inline-label--paragraph";
  }
  const level = Number(value);
  if (level === 1) {
    return "heading-inline-label--h1";
  }
  if (level === 2) {
    return "heading-inline-label--h2";
  }
  if (level === 3) {
    return "heading-inline-label--h3";
  }
  if (level === 4) {
    return "heading-inline-label--h4";
  }
  if (level === 5) {
    return "heading-inline-label--h5";
  }
  return "heading-inline-label--h6";
};

export const createHeadingInlineActions = ({
  getView,
  getEditorCommands,
  getEditorCanCommands,
  resolveOptionLabel,
}: {
  getView: GetView;
  getEditorCommands: GetEditorCommandMap;
  getEditorCanCommands: GetEditorCommandMap;
  resolveOptionLabel: (value: HeadingInlineValue) => string;
}) => {
  const headingValue = ref<HeadingInlineValue>("paragraph");
  const headingInlineMoreButtonRef = ref<MaybeElementRef>(null);
  const headingInlineMoreOpen = ref(false);
  const headingInlineMorePanelStyle = ref<Record<string, string>>({});

  const headingInlineVisibleOptions = computed(() =>
    HEADING_INLINE_OPTIONS.slice(0, HEADING_INLINE_VISIBLE_COUNT)
  );
  const headingInlineOverflowOptions = computed(() =>
    HEADING_INLINE_OPTIONS.slice(HEADING_INLINE_VISIBLE_COUNT)
  );
  const headingInlinePanelOptions = computed(() => HEADING_INLINE_OPTIONS);
  const hasHeadingInlineOverflow = computed(() => headingInlineOverflowOptions.value.length > 0);

  const canApplyHeadingInlineValue = (value: HeadingInlineValue) => {
    const commands = getEditorCanCommands();
    if (value === "paragraph") {
      return invokeCommand(commands?.setParagraph);
    }
    const level = Number(value);
    if (!Number.isFinite(level)) {
      return false;
    }
    return invokeCommand(commands?.setHeading, level);
  };

  const applyHeadingInlineValue = (value: HeadingInlineValue) => {
    const commands = getEditorCommands();
    if (value === "paragraph") {
      return invokeCommand(commands?.setParagraph);
    }
    const level = Number(value);
    if (!Number.isFinite(level)) {
      return false;
    }
    return invokeCommand(commands?.setHeading, level);
  };

  const isHeadingInlineOptionActive = (value: HeadingInlineValue) =>
    String(value) === String(headingValue.value);

  const applyHeadingInlineOption = (value: HeadingInlineValue) => {
    if (!canApplyHeadingInlineValue(value)) {
      return false;
    }
    const ok = applyHeadingInlineValue(value);
    if (ok) {
      headingInlineMoreOpen.value = false;
    }
    return ok;
  };

  const updateHeadingInlineMorePanelPosition = () => {
    const trigger = resolveSingleElement(headingInlineMoreButtonRef.value);
    if (!trigger) {
      return;
    }
    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    const panelWidth = HEADING_INLINE_PANEL_WIDTH;
    const rowCount = Math.max(
      1,
      Math.ceil(headingInlinePanelOptions.value.length / HEADING_INLINE_PANEL_COLUMNS)
    );
    const panelHeight =
      HEADING_INLINE_PANEL_PADDING * 2 +
      rowCount * HEADING_INLINE_PANEL_OPTION_HEIGHT +
      Math.max(0, rowCount - 1) * HEADING_INLINE_PANEL_GAP;

    let left = rect.right - panelWidth;
    if (left < margin) {
      left = margin;
    }
    const maxLeft = window.innerWidth - panelWidth - margin;
    if (left > maxLeft) {
      left = maxLeft;
    }

    let top = rect.bottom + 6;
    if (top + panelHeight > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - panelHeight - 6);
    }

    headingInlineMorePanelStyle.value = {
      left: `${Math.round(left)}px`,
      top: `${Math.round(top)}px`,
    };
  };

  const toggleHeadingInlineMore = () => {
    if (!hasHeadingInlineOverflow.value) {
      return;
    }
    const nextOpen = !headingInlineMoreOpen.value;
    headingInlineMoreOpen.value = nextOpen;
    if (nextOpen) {
      void nextTick(updateHeadingInlineMorePanelPosition);
    }
  };

  const syncHeadingValueFromSelection = () => {
    const view = getView();
    if (!view?.state?.selection) {
      return;
    }
    const parent = view.state.selection.$from?.parent;
    if (!parent) {
      return;
    }
    let nextValue: HeadingInlineValue = "paragraph";
    if (parent.type?.name === "heading") {
      const level = Number(parent.attrs?.level ?? 1);
      nextValue = Number.isFinite(level) ? level : 1;
    }
    headingValue.value = nextValue;
  };

  const closeHeadingInlineMore = () => {
    headingInlineMoreOpen.value = false;
  };

  return {
    headingInlineMoreButtonRef,
    headingInlineMoreOpen,
    headingInlineMorePanelStyle,
    headingInlineVisibleOptions,
    headingInlinePanelOptions,
    hasHeadingInlineOverflow,
    headingInlineOptionLabel: resolveOptionLabel,
    headingInlineOptionTypographyClass: resolveTypographyClass,
    isHeadingInlineOptionActive,
    applyHeadingInlineOption,
    toggleHeadingInlineMore,
    updateHeadingInlineMorePanelPosition,
    syncHeadingValueFromSelection,
    closeHeadingInlineMore,
  };
};
