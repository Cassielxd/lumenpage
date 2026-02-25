<template>
  <t-header
    class="toolbar"
    :class="{ 'toolbar--with-label': showItemDescription, 'toolbar--base-two-line': isBaseMenu }"
    role="toolbar"
    :aria-label="toolbarAriaLabel"
    @mousedown="handleToolbarMouseDown"
    @keydown="handleToolbarKeyDown"
  >
    <div class="toolbar-left-shell">
      <div
        ref="toolbarLeftViewport"
        class="toolbar-left-viewport"
        @scroll.passive="updateToolbarOverflowState"
      >
        <div
          class="toolbar-left"
          :class="{ 'toolbar-left--with-label': showItemDescription, 'toolbar-left--base-two-line': isBaseMenu }"
        >
          <template v-for="(group, groupIndex) in renderGroups" :key="group.id">
            <div
              class="toolbar-group"
              :class="{
                'toolbar-group--base-two-line': isBaseGridGroup(group),
                'toolbar-group--base-export-row': isBaseExportGroup(group),
              }"
            >
              <template v-for="item in group.items" :key="item.id">
                <div v-if="isHeadingInlineBoxItem(item)" class="heading-inline-box heading-inline-surface">
                  <button
                    v-for="option in headingInlineVisibleOptions"
                    :key="`heading-inline-${String(option.value)}`"
                    type="button"
                    class="heading-inline-option"
                    :class="{ 'heading-inline-option--active': isHeadingInlineOptionActive(option.value) }"
                    @mousedown.prevent
                    @click="applyHeadingInlineOption(option.value)"
                  >
                    <span
                      class="heading-inline-option-label"
                      :class="headingInlineOptionTypographyClass(option.value)"
                      >{{ headingInlineOptionLabel(option.value) }}</span
                    >
                  </button>
                  <button
                    v-if="hasHeadingInlineOverflow"
                    type="button"
                    ref="headingInlineMoreButtonRef"
                    class="heading-inline-more-btn"
                    :aria-expanded="headingInlineMoreOpen"
                    @mousedown.prevent
                    @click.stop="toggleHeadingInlineMore"
                  >
                    v
                  </button>
                </div>
                <t-tooltip v-else :content="itemLabel(item)">
                  <t-button
                    size="small"
                    variant="text"
                    class="icon-btn"
                    :class="{
                      'icon-btn--with-label': shouldShowItemDescription(group),
                      'icon-btn--base': isBaseGridGroup(group),
                    }"
                    :disabled="isItemDisabled(item)"
                    @click="handleItemAction(item)"
                  >
                    <span
                      class="icon-btn-content"
                      :class="{
                        'icon-btn-content--with-label': shouldShowItemDescription(group),
                      }"
                    >
                      <LumenIcon
                        v-if="shouldShowItemIcon(item)"
                        :name="item.icon"
                        :size="resolveIconSize(group)"
                      />
                      <span
                        v-if="shouldShowItemDescription(group)"
                        class="icon-btn-label"
                        >{{ itemLabel(item) }}</span
                      >
                    </span>
                  </t-button>
                </t-tooltip>
              </template>
            </div>
            <t-divider
              v-if="groupIndex < renderGroups.length - 1"
              :key="`${group.id}-divider`"
              layout="vertical"
              class="toolbar-divider"
            />
          </template>
        </div>
      </div>
      <button
        v-if="showScrollLeftArrow"
        type="button"
        class="toolbar-scroll-arrow"
        aria-label="Scroll toolbar left"
        @mousedown.prevent
        @click="scrollToolbarLeft"
      >
        <span class="toolbar-scroll-arrow-icon">&lt;</span>
      </button>
      <button
        v-if="showScrollRightArrow"
        type="button"
        class="toolbar-scroll-arrow"
        aria-label="Scroll toolbar right"
        @mousedown.prevent
        @click="scrollToolbarRight"
      >
        <span class="toolbar-scroll-arrow-icon">&gt;</span>
      </button>
    </div>

    <div class="toolbar-right">
      <span class="history-depth">U{{ undoDepthCount }}/R{{ redoDepthCount }}</span>
      <span ref="statusEl" class="status">{{ i18n.toolbar.statusZeroPages }}</span>
    </div>
  </t-header>

  <teleport to="body">
    <div
      v-if="headingInlineMoreOpen"
      ref="headingInlineMoreRef"
      class="heading-inline-more-panel heading-inline-more-panel--floating heading-inline-surface"
      :style="headingInlineMorePanelStyle"
    >
      <div class="heading-inline-more-grid">
        <button
          v-for="option in headingInlinePanelOptions"
          :key="`heading-inline-more-${String(option.value)}`"
          type="button"
          class="heading-inline-option heading-inline-more-option"
          :class="{ 'heading-inline-option--active': isHeadingInlineOptionActive(option.value) }"
          @mousedown.prevent
          @click="applyHeadingInlineOption(option.value)"
        >
          <span
            class="heading-inline-option-label"
            :class="headingInlineOptionTypographyClass(option.value)"
            >{{ headingInlineOptionLabel(option.value) }}</span
          >
        </button>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRaw, watch } from "vue";
import type { CanvasEditorView } from "lumenpage-view-canvas";
import { redoDepth, undoDepth } from "lumenpage-history";
import LumenIcon from "./LumenIcon.vue";
import { createPlaygroundI18n, type PlaygroundLocale } from "../editor/i18n";
import {
  TOOLBAR_MENU_GROUPS,
  type ToolbarGroupConfig,
  type ToolbarItemConfig,
  type ToolbarMenuKey,
} from "../editor/toolbarCatalog";

const props = defineProps<{
  editorView: CanvasEditorView | null;
  locale?: PlaygroundLocale;
  activeMenu?: ToolbarMenuKey;
}>();

const i18n = computed(() => createPlaygroundI18n(props.locale));
const localeKey = computed<PlaygroundLocale>(() => (props.locale === "en-US" ? "en-US" : "zh-CN"));
const resolvedActiveMenu = computed<ToolbarMenuKey>(() => props.activeMenu || "base");
const toolbarAriaLabel = computed(() => "Editor formatting toolbar");

const currentGroups = computed(() => TOOLBAR_MENU_GROUPS[resolvedActiveMenu.value] || []);
const isBaseMenu = computed(() => resolvedActiveMenu.value === "base");
const showItemDescription = computed(() => resolvedActiveMenu.value !== "base");
type ToolbarRenderGroup = ToolbarGroupConfig & {
  layoutMode?: "default" | "base-grid" | "base-export-row";
};
type HeadingInlineOption = {
  id: string;
  value: string | number;
};
const HEADING_INLINE_BOX_ACTION = "heading-inline-box";
const HEADING_INLINE_VISIBLE_COUNT = 3;
const HEADING_INLINE_PANEL_COLUMNS = 3;
const HEADING_INLINE_PANEL_WIDTH = 262;
const HEADING_INLINE_PANEL_OPTION_HEIGHT = 44;
const HEADING_INLINE_PANEL_GAP = 3;
const HEADING_INLINE_PANEL_PADDING = 7;
const HEADING_INLINE_OPTIONS: Array<{
  id: string;
  value: string | number;
}> = [
  { id: "paragraph", value: "paragraph" },
  { id: "h1", value: 1 },
  { id: "h2", value: 2 },
  { id: "h3", value: 3 },
  { id: "h4", value: 4 },
  { id: "h5", value: 5 },
  { id: "h6", value: 6 },
];

const createHeadingInlineItems = (): ToolbarItemConfig[] =>
  [
    {
      id: "heading-inline-box",
      icon: "",
      label: { "zh-CN": "", "en-US": "" },
      action: HEADING_INLINE_BOX_ACTION,
      implemented: true,
    },
  ];

const isHeadingInlineBoxItem = (item: ToolbarItemConfig) => item.action === HEADING_INLINE_BOX_ACTION;

const renderGroups = computed<ToolbarRenderGroup[]>(() => {
  if (!isBaseMenu.value) {
    return (currentGroups.value || []).map((group) => ({
      ...group,
      layoutMode: "default",
    }));
  }

  let hasHeadingControl = false;
  const baseGroups = (TOOLBAR_MENU_GROUPS.base || [])
    .map((group) => {
      const nextItems = (group.items || []).filter((item) => {
        if (item?.action === "heading") {
          hasHeadingControl = true;
          return false;
        }
        return true;
      });
      return {
        ...group,
        items: nextItems,
        layoutMode: "base-grid" as const,
      };
    })
    .filter((group) => (group.items || []).length > 0);
  const exportItems = (TOOLBAR_MENU_GROUPS.export || []).flatMap((group) => group.items || []);
  const headingItems = hasHeadingControl ? createHeadingInlineItems() : [];
  const inlineItems = [...headingItems, ...exportItems];
  if (inlineItems.length === 0) {
    return baseGroups;
  }
  return [
    ...baseGroups,
    {
      id: "base-export-inline",
      items: inlineItems,
      layoutMode: "base-export-row",
    },
  ];
});

const isBaseExportGroup = (group: ToolbarRenderGroup) => group?.layoutMode === "base-export-row";
const isBaseGridGroup = (group: ToolbarRenderGroup) =>
  isBaseMenu.value && group?.layoutMode !== "base-export-row";
const shouldShowItemDescription = (group: ToolbarRenderGroup) =>
  showItemDescription.value || isBaseExportGroup(group);
const resolveIconSize = (group: ToolbarRenderGroup) =>
  isBaseGridGroup(group) ? 14 : 22;

type MaybeElementRef = HTMLElement | HTMLElement[] | null;
const headingValue = ref<string | number>("paragraph");
const headingInlineMoreButtonRef = ref<MaybeElementRef>(null);
const headingInlineMoreRef = ref<MaybeElementRef>(null);
const headingInlineMoreOpen = ref(false);
const headingInlineMorePanelStyle = ref<Record<string, string>>({});
const toolbarLeftViewport = ref<HTMLElement | null>(null);
const canScrollLeft = ref(false);
const canScrollRight = ref(false);
const statusEl = ref<HTMLElement | null>(null);
const TOOLBAR_SCROLL_STEP = 320;
const TOOLBAR_SCROLL_EPSILON = 2;
const headingInlineVisibleOptions = computed<HeadingInlineOption[]>(() =>
  HEADING_INLINE_OPTIONS.slice(0, HEADING_INLINE_VISIBLE_COUNT)
);
const headingInlineOverflowOptions = computed<HeadingInlineOption[]>(() =>
  HEADING_INLINE_OPTIONS.slice(HEADING_INLINE_VISIBLE_COUNT)
);
const headingInlinePanelOptions = computed<HeadingInlineOption[]>(() => HEADING_INLINE_OPTIONS);
const hasHeadingInlineOverflow = computed(() => headingInlineOverflowOptions.value.length > 0);

const resolveSingleElement = (value: MaybeElementRef): HTMLElement | null => {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.find((element) => element instanceof HTMLElement) || null;
  }
  return value instanceof HTMLElement ? value : null;
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

const updateToolbarOverflowState = () => {
  const el = toolbarLeftViewport.value;
  if (!el) {
    canScrollLeft.value = false;
    canScrollRight.value = false;
    return;
  }
  canScrollLeft.value = el.scrollLeft > TOOLBAR_SCROLL_EPSILON;
  const remaining = el.scrollWidth - el.clientWidth - el.scrollLeft;
  canScrollRight.value = remaining > TOOLBAR_SCROLL_EPSILON;
};

const showScrollLeftArrow = computed(() => canScrollLeft.value);
const showScrollRightArrow = computed(() => canScrollRight.value);

const scrollToolbarLeft = () => {
  const el = toolbarLeftViewport.value;
  if (!el) {
    return;
  }
  el.scrollBy({ left: -TOOLBAR_SCROLL_STEP, behavior: "smooth" });
  window.setTimeout(updateToolbarOverflowState, 220);
};

const scrollToolbarRight = () => {
  const el = toolbarLeftViewport.value;
  if (!el) {
    return;
  }
  el.scrollBy({ left: TOOLBAR_SCROLL_STEP, behavior: "smooth" });
  window.setTimeout(updateToolbarOverflowState, 220);
};

const getView = () => (props.editorView ? toRaw(props.editorView) : null);
const getCommands = () => props.editorView?.commands || null;

const run = (name: string, ...args: unknown[]) => {
  const commands = getCommands();
  const command = commands?.[name];
  if (typeof command !== "function") {
    return false;
  }
  return command(...args);
};

const canRun = (name: string, ...args: unknown[]) => {
  const commands = getCommands();
  if (typeof commands?.can === "function") {
    return commands.can(name, ...args) === true;
  }
  return true;
};

const runWithNotice = (name: string, message: string, ...args: unknown[]) => {
  const ok = run(name, ...args);
  if (!ok) {
    window.alert(message);
  }
  return ok;
};

const resolveHeadingOptionLabel = (value: string | number) => {
  if (value === "paragraph") {
    return i18n.value.toolbar.blockTypeParagraph;
  }
  if (value === 1) {
    return i18n.value.toolbar.blockTypeHeading1;
  }
  if (value === 2) {
    return i18n.value.toolbar.blockTypeHeading2;
  }
  if (value === 3) {
    return i18n.value.toolbar.blockTypeHeading3;
  }
  return `H${value}`;
};

const headingInlineOptionLabel = (value: string | number) => resolveHeadingOptionLabel(value);
const headingInlineOptionTypographyClass = (value: string | number) => {
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
const itemLabel = (item: ToolbarItemConfig) => item.label[localeKey.value] || "";
const shouldShowItemIcon = (item: ToolbarItemConfig) =>
  Boolean(item.icon) && !isHeadingInlineBoxItem(item);

const canApplyHeadingInlineValue = (value: string | number) => {
  if (value === "paragraph") {
    return canRun("setBlockType", "paragraph");
  }
  const level = Number(value);
  if (!Number.isFinite(level)) {
    return false;
  }
  return canRun("setBlockType", "heading", level);
};

const applyHeadingInlineValue = (value: string | number) => {
  if (value === "paragraph") {
    return run("setBlockType", "paragraph");
  }
  const level = Number(value);
  if (!Number.isFinite(level)) {
    return false;
  }
  return run("setBlockType", "heading", level);
};

const isHeadingInlineOptionActive = (value: string | number) =>
  String(value) === String(headingValue.value);

const applyHeadingInlineOption = (value: string | number) => {
  if (!canApplyHeadingInlineValue(value)) {
    return false;
  }
  const ok = applyHeadingInlineValue(value);
  if (ok) {
    headingInlineMoreOpen.value = false;
  }
  return ok;
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

const isItemDisabled = (item: ToolbarItemConfig) => {
  if (isHeadingInlineBoxItem(item)) {
    return false;
  }
  if (!item.implemented) {
    return true;
  }
  if (item.command) {
    return !canRun(item.command);
  }
  return false;
};

const handleItemAction = (item: ToolbarItemConfig) => {
  if (isItemDisabled(item)) {
    return;
  }
  if (isHeadingInlineBoxItem(item)) {
    return;
  }
  switch (item.action) {
    case "undo":
      runWithNotice("undo", i18n.value.toolbar.alertCannotUndo);
      return;
    case "redo":
      runWithNotice("redo", i18n.value.toolbar.alertCannotRedo);
      return;
    case "bold":
      run("toggleBold");
      return;
    case "italic":
      run("toggleItalic");
      return;
    case "underline":
      run("toggleUnderline");
      return;
    case "strike":
      run("toggleStrike");
      return;
    case "inline-code":
      run("toggleInlineCode");
      return;
    case "ordered-list":
      run("toggleOrderedList");
      return;
    case "bullet-list":
      run("toggleBulletList");
      return;
    case "indent":
      run("indent");
      return;
    case "outdent":
      run("outdent");
      return;
    case "align-left":
      run("alignLeft");
      return;
    case "align-center":
      run("alignCenter");
      return;
    case "align-right":
      run("alignRight");
      return;
    case "quote":
      run("toggleBlockquote");
      return;
    case "link":
      toggleLink();
      return;
    case "code-block":
      if (!run("toggleCodeBlock")) {
        run("setBlockType", "code_block");
      }
      return;
    case "image":
      insertImage();
      return;
    case "video":
      insertVideo();
      return;
    case "hr":
      run("insertHorizontalRule");
      return;
    case "page-break":
      run("insertPageBreak");
      return;
    case "add-row-after":
      runWithNotice("addTableRowAfter", i18n.value.toolbar.alertTableCellRequired);
      return;
    case "add-row-before":
      runWithNotice("addTableRowBefore", i18n.value.toolbar.alertTableCellRequired);
      return;
    case "add-column-after":
      runWithNotice("addTableColumnAfter", i18n.value.toolbar.alertTableCellRequired);
      return;
    case "add-column-before":
      runWithNotice("addTableColumnBefore", i18n.value.toolbar.alertTableCellRequired);
      return;
    case "delete-row":
      runWithNotice("deleteTableRow", i18n.value.toolbar.alertTableCellRequired);
      return;
    case "delete-column":
      runWithNotice("deleteTableColumn", i18n.value.toolbar.alertTableCellRequired);
      return;
    case "merge-cells":
      runWithNotice("mergeTableCellRight", i18n.value.toolbar.alertMergeRightUnavailable);
      return;
    case "split-cell":
      runWithNotice("splitTableCell", i18n.value.toolbar.alertSplitCellUnavailable);
      return;
    case "next-cell":
      runWithNotice("goToNextTableCell", i18n.value.toolbar.alertTableCellRequired);
      return;
    case "previous-cell":
      runWithNotice("goToPreviousTableCell", i18n.value.toolbar.alertTableCellRequired);
      return;
    case "page-break-marks":
      togglePageBreakMarks();
      return;
    default:
      return;
  }
};

const toggleLink = () => {
  const view = getView();
  if (!view) {
    return false;
  }
  const markType = view.state.schema.marks.link;
  if (!markType) {
    return false;
  }
  const { from, to, empty, $cursor } = view.state.selection as any;
  const hasLink = empty
    ? !!markType.isInSet(view.state.storedMarks || $cursor?.marks() || [])
    : view.state.doc.rangeHasMark(from, to, markType);
  const defaultValue = hasLink ? "" : "https://";
  const url = window.prompt(i18n.value.toolbar.promptLinkUrl, defaultValue);
  if (url === null) {
    return false;
  }
  if (!url.trim()) {
    return run("toggleLink");
  }
  const href = url.trim();
  if (empty) {
    let tr = view.state.tr.insertText(href, from, to);
    tr = tr.addMark(from, from + href.length, markType.create({ href, title: href }));
    view.dispatch(tr.scrollIntoView());
    return true;
  }
  const ok = run("toggleLink", { href, title: href });
  if (!ok) {
    window.alert(i18n.value.toolbar.alertLinkRequiresSelection);
  }
  return ok;
};

const insertImage = () => {
  const src = window.prompt(i18n.value.toolbar.promptImageUrl, "");
  if (!src) {
    return false;
  }
  return run("insertImage", { src });
};

const insertVideo = () => {
  const src = window.prompt(i18n.value.toolbar.promptVideoUrl, "");
  if (!src) {
    return false;
  }
  return run("insertVideo", { src, embed: false });
};

const togglePageBreakMarks = () => {
  const view = getView() as any;
  const settings = view?._internals?.settings;
  if (!settings) {
    return false;
  }
  settings.showPageCropMarks = settings.showPageCropMarks === false;
  view?._internals?.renderer?.pageCache?.clear?.();
  view?._internals?.scheduleRender?.();
  return true;
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
  let nextValue: string | number = "paragraph";
  if (parent.type?.name === "heading") {
    const level = Number(parent.attrs?.level ?? 1);
    nextValue = Number.isFinite(level) ? level : 1;
  }
  headingValue.value = nextValue;
};

const getTargetElement = (target: EventTarget | null): Element | null => {
  if (target instanceof Element) {
    return target;
  }
  if (target instanceof Node) {
    return target.parentElement;
  }
  return null;
};

const handleDocumentPointerDown = (event: PointerEvent) => {
  if (!headingInlineMoreOpen.value) {
    return;
  }
  const targetElement = getTargetElement(event.target);
  if (!targetElement) {
    headingInlineMoreOpen.value = false;
    return;
  }
  if (
    targetElement.closest(".heading-inline-box") ||
    targetElement.closest(".heading-inline-more-panel")
  ) {
    return;
  }
  headingInlineMoreOpen.value = false;
};

const handleWindowResize = () => {
  updateToolbarOverflowState();
  if (headingInlineMoreOpen.value) {
    updateHeadingInlineMorePanelPosition();
  }
};

watch(
  () => props.editorView,
  () => {
    syncHeadingValueFromSelection();
  },
  { immediate: true }
);

watch(
  () => props.editorView?.state?.selection?.head,
  () => {
    syncHeadingValueFromSelection();
  }
);

watch(
  () => [resolvedActiveMenu.value, localeKey.value, renderGroups.value.length],
  () => {
    headingInlineMoreOpen.value = false;
    void nextTick(updateToolbarOverflowState);
  }
);

onMounted(() => {
  window.addEventListener("resize", handleWindowResize, { passive: true });
  document.addEventListener("pointerdown", handleDocumentPointerDown, { passive: true });
  void nextTick(updateToolbarOverflowState);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleWindowResize);
  document.removeEventListener("pointerdown", handleDocumentPointerDown);
});

const undoDepthCount = computed(() => {
  const view = getView();
  if (!view?.state) {
    return 0;
  }
  return undoDepth(view.state) || 0;
});

const redoDepthCount = computed(() => {
  const view = getView();
  if (!view?.state) {
    return 0;
  }
  return redoDepth(view.state) || 0;
});

const handleToolbarMouseDown = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null;
  if (!target) {
    return;
  }
  if (target.closest(".t-select") || target.closest(".t-input")) {
    return;
  }
  if (
    target.closest(".t-button") ||
    target.closest(".heading-inline-option") ||
    target.closest(".heading-inline-more-btn") ||
    target.closest(".heading-inline-more-item")
  ) {
    event.preventDefault();
  }
};

const getFocusableToolbarButtons = (scope: HTMLElement | null) => {
  if (!scope) {
    return [] as HTMLElement[];
  }
  const buttons = Array.from(
    scope.querySelectorAll<HTMLElement>(
      ".toolbar-left .t-button, .toolbar-left .heading-inline-option, .toolbar-left .heading-inline-more-btn, .toolbar-left .heading-inline-more-item"
    )
  );
  return buttons.filter((button) => {
    const htmlButton = button as HTMLButtonElement;
    if (htmlButton.disabled || button.getAttribute("aria-disabled") === "true") {
      return false;
    }
    return button.offsetParent !== null;
  });
};

const handleToolbarKeyDown = (event: KeyboardEvent) => {
  if (
    event.key !== "ArrowLeft" &&
    event.key !== "ArrowRight" &&
    event.key !== "Home" &&
    event.key !== "End"
  ) {
    return;
  }
  const scope = event.currentTarget as HTMLElement | null;
  const buttons = getFocusableToolbarButtons(scope);
  if (buttons.length === 0) {
    return;
  }
  const target = event.target as HTMLElement | null;
  const activeButton = target?.closest?.(
    ".t-button, .heading-inline-option, .heading-inline-more-btn, .heading-inline-more-item"
  ) as HTMLElement | null;
  const currentIndex = activeButton ? buttons.indexOf(activeButton) : -1;
  if (currentIndex < 0) {
    return;
  }
  let nextIndex = currentIndex;
  if (event.key === "ArrowRight") {
    nextIndex = (currentIndex + 1) % buttons.length;
  } else if (event.key === "ArrowLeft") {
    nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = buttons.length - 1;
  }
  const nextButton = buttons[nextIndex];
  if (!nextButton || nextButton === activeButton) {
    return;
  }
  event.preventDefault();
  nextButton.focus();
};

defineExpose({ statusEl });
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 6px;
  padding: 6px 8px;
  height: 84px;
  min-height: 84px;
  background: #ffffff;
  border-bottom: 1px solid #eceff1;
  overflow: hidden;
}

.toolbar-left-shell {
  display: flex;
  align-items: flex-start;
  flex: 1 1 auto;
  min-width: 0;
}

.toolbar-left-viewport {
  display: block;
  flex: 1 1 auto;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.toolbar-left-viewport::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

.toolbar-left {
  display: flex;
  flex: 0 0 auto;
  min-width: max-content;
  align-items: flex-start;
  gap: 2px;
  flex-wrap: nowrap;
}

.toolbar-right {
  display: flex;
  flex: 0 0 auto;
  align-items: flex-start;
  gap: 6px;
  padding-top: 2px;
}

.toolbar-group {
  display: flex;
  align-items: flex-start;
  gap: 1px;
}

.toolbar-left--with-label {
  align-items: flex-start;
}

.toolbar--with-label .toolbar-group {
  align-items: flex-start;
  gap: 2px;
}

.toolbar--with-label .toolbar-divider {
  height: 50px;
  margin-top: 1px;
}

.toolbar--base-two-line .toolbar-left--base-two-line {
  align-items: center;
}

.toolbar-group--base-two-line {
  display: grid;
  grid-template-rows: repeat(2, minmax(0, 28px));
  grid-auto-flow: column;
  column-gap: 1px;
  row-gap: 1px;
  align-items: center;
}

.toolbar-group--base-export-row {
  display: flex;
  align-items: flex-start;
  gap: 2px;
  margin-left: 4px;
  flex-wrap: nowrap;
}

.heading-inline-surface {
  width: 262px;
  padding: 7px;
  border: 1px solid #d2d7df;
  border-radius: 6px;
  background: #eef1f5;
  box-sizing: border-box;
}

.heading-inline-box {
  position: relative;
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 6px;
  min-height: 64px;
  max-height: 64px;
  padding-right: 30px;
}

.heading-inline-option {
  width: 58px;
  height: 44px;
  padding: 2px 3px;
  border: 1px solid #d2d7df;
  border-radius: 4px;
  background: #ffffff;
  color: #202124;
  font-size: 13px;
  line-height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  white-space: nowrap;
  cursor: pointer;
}

.heading-inline-option:hover {
  background: #f8f9fa;
  border-color: #c5cad3;
}

.heading-inline-option--active {
  border-color: #aecbfa;
  background: #e8f0fe;
  color: #1a73e8;
}

.heading-inline-more-btn {
  position: absolute;
  top: 50%;
  right: 5px;
  width: 18px;
  height: 18px;
  transform: translateY(-50%);
  border: 1px solid #c7ccd4;
  border-radius: 4px;
  background: #ffffff;
  color: #5f6368;
  font-size: 11px;
  line-height: 16px;
  text-align: center;
  cursor: pointer;
}

.heading-inline-more-btn:hover {
  background: #f8f9fa;
}

.heading-inline-more-panel {
  z-index: 3000;
  box-shadow: none;
}

.heading-inline-more-panel--floating {
  position: fixed;
}

.heading-inline-more-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  align-content: flex-start;
}

.heading-inline-more-option {
  width: 58px;
  flex: 0 0 auto;
}

.heading-inline-option-label {
  display: inline-block;
  line-height: 1.2;
  white-space: nowrap;
}

.heading-inline-label--paragraph {
  font-size: 11px;
  font-weight: 500;
}

.heading-inline-label--h1 {
  font-size: 16px;
  font-weight: 700;
}

.heading-inline-label--h2 {
  font-size: 15px;
  font-weight: 700;
}

.heading-inline-label--h3 {
  font-size: 14px;
  font-weight: 700;
}

.heading-inline-label--h4 {
  font-size: 13px;
  font-weight: 650;
}

.heading-inline-label--h5 {
  font-size: 12px;
  font-weight: 650;
}

.heading-inline-label--h6 {
  font-size: 11px;
  font-weight: 650;
}

.toolbar--base-two-line .toolbar-divider {
  height: 62px;
  margin-top: 0;
}

.toolbar-divider {
  height: 22px;
}

.icon-btn {
  width: 34px;
  height: 32px;
  padding: 0;
  border: 1px solid transparent !important;
  border-radius: 4px !important;
  background-color: transparent !important;
  box-shadow: none !important;
}

.icon-btn-content {
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-btn--with-label {
  width: 68px;
  height: 60px;
  padding: 3px 4px;
}

.icon-btn-content--with-label {
  flex-direction: column;
  gap: 3px;
}

.icon-btn--base {
  width: 30px;
  height: 28px;
  padding: 0;
}

.icon-btn-label {
  max-width: 62px;
  font-size: 12px;
  line-height: 13px;
  color: #5f6368;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.icon-btn :deep(.lumen-icon) {
  width: 18px;
  height: 18px;
}

.toolbar--with-label .icon-btn :deep(.lumen-icon) {
  width: 22px;
  height: 22px;
}

.toolbar--base-two-line .icon-btn--base :deep(.lumen-icon) {
  width: 14px;
  height: 14px;
}

.icon-btn:hover,
.icon-btn:active,
.icon-btn:focus,
.icon-btn:focus-visible {
  background-color: transparent !important;
  box-shadow: none !important;
}

.icon-btn:hover {
  border-color: #d2d7df !important;
  background: #f1f3f4 !important;
}

.icon-btn:active,
.icon-btn:focus,
.icon-btn:focus-visible {
  border-color: #aecbfa !important;
  background: #e8f0fe !important;
}

.status {
  font-size: 12px;
  color: #5f6368;
  white-space: nowrap;
}

.history-depth {
  font-size: 11px;
  color: #8f959e;
  padding-left: 2px;
  min-width: 48px;
}

.toolbar-scroll-arrow {
  width: 26px;
  height: 62px;
  margin-left: 4px;
  border: 1px solid #d2d7df;
  border-radius: 6px;
  background: #ffffff;
  color: #5f6368;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex: 0 0 auto;
}

.toolbar-scroll-arrow:hover {
  background: #f1f3f4;
  border-color: #c5cad3;
}

.toolbar-scroll-arrow:focus-visible {
  outline: 2px solid #aecbfa;
  outline-offset: 1px;
}

.toolbar-scroll-arrow-icon {
  font-size: 16px;
  line-height: 1;
}
</style>

