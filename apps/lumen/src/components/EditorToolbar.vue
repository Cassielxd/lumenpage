<template>
  <t-header
    class="toolbar"
    role="toolbar"
    :aria-label="toolbarAriaLabel"
    @mousedown="handleToolbarMouseDown"
    @keydown="handleToolbarKeyDown"
  >
    <div class="toolbar-left">
      <template v-for="(group, groupIndex) in currentGroups" :key="group.id">
        <div class="toolbar-group">
          <template v-for="item in group.items" :key="item.id">
            <t-select
              v-if="isHeadingItem(item)"
              v-model="headingValue"
              size="small"
              borderless
              class="heading-select"
              :options="headingSelectOptions"
            />
            <t-tooltip v-else :content="itemLabel(item)">
              <t-button
                size="small"
                variant="text"
                class="icon-btn"
                :disabled="isItemDisabled(item)"
                @click="handleItemAction(item)"
              >
                <LumenIcon :name="item.icon" size="15" />
              </t-button>
            </t-tooltip>
          </template>
        </div>
        <t-divider
          v-if="groupIndex < currentGroups.length - 1"
          :key="`${group.id}-divider`"
          layout="vertical"
          class="toolbar-divider"
        />
      </template>
    </div>

    <div class="toolbar-right">
      <span class="history-depth">U{{ undoDepthCount }}/R{{ redoDepthCount }}</span>
      <span ref="statusEl" class="status">{{ i18n.toolbar.statusZeroPages }}</span>
    </div>
  </t-header>
</template>

<script setup lang="ts">
import { computed, ref, toRaw, watch } from "vue";
import type { CanvasEditorView } from "lumenpage-view-canvas";
import { closeHistory, redoDepth, undoDepth } from "lumenpage-history";
import LumenIcon from "./LumenIcon.vue";
import { createPlaygroundI18n, type PlaygroundLocale } from "../editor/i18n";
import {
  TOOLBAR_MENU_GROUPS,
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
const toolbarAriaLabel = computed(() =>
  props.locale === "en-US" ? "Editor formatting toolbar" : "编辑格式工具栏"
);

const currentGroups = computed(() => TOOLBAR_MENU_GROUPS[resolvedActiveMenu.value] || []);

const headingSelectOptions = computed(() => [
  { label: i18n.value.toolbar.blockTypeParagraph, value: "paragraph" },
  { label: i18n.value.toolbar.blockTypeHeading1, value: 1 },
  { label: i18n.value.toolbar.blockTypeHeading2, value: 2 },
  { label: i18n.value.toolbar.blockTypeHeading3, value: 3 },
  { label: "H4", value: 4 },
  { label: "H5", value: 5 },
  { label: "H6", value: 6 },
]);

const headingValue = ref<string | number>("paragraph");
let headingValueSyncing = false;
const statusEl = ref<HTMLElement | null>(null);

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

const itemLabel = (item: ToolbarItemConfig) => item.label[localeKey.value];
const isHeadingItem = (item: ToolbarItemConfig) => item.action === "heading";

const isItemDisabled = (item: ToolbarItemConfig) => {
  if (isHeadingItem(item)) {
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
    case "add-row-after":
      runWithNotice("addTableRowAfter", i18n.value.toolbar.alertTableCellRequired);
      return;
    case "add-column-after":
      runWithNotice("addTableColumnAfter", i18n.value.toolbar.alertTableCellRequired);
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
  headingValueSyncing = true;
  headingValue.value = nextValue;
  queueMicrotask(() => {
    headingValueSyncing = false;
  });
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

watch(headingValue, (value) => {
  if (headingValueSyncing) {
    return;
  }
  if (value === "paragraph") {
    run("setBlockType", "paragraph");
    return;
  }
  const level = Number(value);
  if (Number.isFinite(level)) {
    run("setBlockType", "heading", level);
  }
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
  if (target.closest(".t-button")) {
    event.preventDefault();
  }
};

const getFocusableToolbarButtons = (scope: HTMLElement | null) => {
  if (!scope) {
    return [] as HTMLElement[];
  }
  const buttons = Array.from(scope.querySelectorAll<HTMLElement>(".toolbar-left .t-button"));
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
  const activeButton = target?.closest?.(".t-button") as HTMLElement | null;
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
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 12px;
  height: 46px;
  min-height: 46px;
  background: #ffffff;
  border-bottom: 1px solid #eceff1;
  overflow-x: auto;
  overflow-y: hidden;
}

.toolbar-left {
  display: flex;
  flex: 1 0 auto;
  min-width: max-content;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
}

.toolbar-right {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 3px;
}

.toolbar-divider {
  height: 22px;
}

.heading-select {
  width: 78px;
}

.heading-select :deep(.t-input) {
  min-height: 30px;
  background-color: transparent !important;
  border: 1px solid transparent !important;
  box-shadow: none !important;
  border-radius: 6px !important;
}

.heading-select :deep(.t-input:hover) {
  border-color: #d2d7df !important;
  background: #f1f3f4 !important;
}

.heading-select :deep(.t-is-focused .t-input),
.heading-select :deep(.t-input--focused) {
  border-color: #aecbfa !important;
  background: #e8f0fe !important;
  box-shadow: none !important;
}

.icon-btn {
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid transparent !important;
  border-radius: 6px !important;
  background-color: transparent !important;
  box-shadow: none !important;
}

.icon-btn :deep(.lumen-icon) {
  width: 15px;
  height: 15px;
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
</style>
