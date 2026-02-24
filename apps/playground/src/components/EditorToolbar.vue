<template>
  <t-header
    class="toolbar"
    role="toolbar"
    :aria-label="toolbarAriaLabel"
    @mousedown="handleToolbarMouseDown"
    @keydown="handleToolbarKeyDown"
  >
    <div class="toolbar-left">
      <div class="toolbar-group">
        <t-tooltip :content="i18n.toolbar.undo">
          <t-button
            size="small"
            variant="text"
            class="icon-btn"
            :disabled="!canRun('undo')"
            @click="runUndo"
          >
            <Icon name="arrow-left" />
          </t-button>
        </t-tooltip>
        <t-tooltip :content="i18n.toolbar.redo">
          <t-button
            size="small"
            variant="text"
            class="icon-btn"
            :disabled="!canRun('redo')"
            @click="runRedo"
          >
            <Icon name="arrow-right" />
          </t-button>
        </t-tooltip>
        <t-tooltip :content="i18n.toolbar.historyBoundaryTip">
          <t-button size="small" variant="text" class="icon-btn" @click="markHistoryBoundary">
            <span class="history-cut">||</span>
          </t-button>
        </t-tooltip>
        <span class="history-depth">U{{ undoDepthCount }}/R{{ redoDepthCount }}</span>
      </div>

      <t-divider layout="vertical" class="toolbar-divider" />

      <div class="toolbar-group">
        <t-select
          v-model="blockType"
          size="small"
          class="block-select"
          :options="resolvedBlockTypeOptions"
        />
      </div>

      <t-divider layout="vertical" class="toolbar-divider" />

      <div class="toolbar-group">
        <t-tooltip :content="i18n.toolbar.bold">
          <t-button size="small" variant="text" class="icon-btn" @click="toggleBold">
            <Icon name="textformat-bold" />
          </t-button>
        </t-tooltip>
        <t-tooltip :content="i18n.toolbar.italic">
          <t-button size="small" variant="text" class="icon-btn" @click="toggleItalic">
            <Icon name="textformat-italic" />
          </t-button>
        </t-tooltip>
        <t-tooltip :content="i18n.toolbar.underline">
          <t-button size="small" variant="text" class="icon-btn" @click="toggleUnderline">
            <Icon name="textformat-underline" />
          </t-button>
        </t-tooltip>
        <t-tooltip :content="i18n.toolbar.strike">
          <t-button size="small" variant="text" class="icon-btn" @click="toggleStrike">
            <Icon name="textformat-strikethrough" />
          </t-button>
        </t-tooltip>
        <t-tooltip :content="i18n.toolbar.inlineCode">
          <t-button size="small" variant="text" class="icon-btn" @click="toggleInlineCode">
            <Icon name="code" />
          </t-button>
        </t-tooltip>
      </div>

      <t-divider layout="vertical" class="toolbar-divider" />

      <div class="toolbar-group">
        <t-tooltip :content="i18n.toolbar.link">
          <t-button size="small" variant="text" class="icon-btn" @click="toggleLink">
            <Icon name="link" />
          </t-button>
        </t-tooltip>
        <t-tooltip :content="i18n.toolbar.blockquote">
          <t-button size="small" variant="text" class="icon-btn" @click="toggleBlockquote">
            <Icon name="quote" />
          </t-button>
        </t-tooltip>
        <t-tooltip :content="i18n.toolbar.codeBlock">
          <t-button size="small" variant="text" class="icon-btn" @click="toggleCodeBlock">
            <Icon name="code" />
          </t-button>
        </t-tooltip>
        <t-tooltip :content="i18n.toolbar.horizontalRule">
          <t-button size="small" variant="text" class="icon-btn" @click="insertHorizontalRule">
            <Icon name="minus" />
          </t-button>
        </t-tooltip>
      </div>

      <t-divider layout="vertical" class="toolbar-divider" />

      <div class="toolbar-group">
        <t-tooltip :content="i18n.toolbar.bulletList">
          <t-button size="small" variant="text" class="icon-btn" @click="toggleBulletList">
            <Icon name="list" />
          </t-button>
        </t-tooltip>
        <t-tooltip :content="i18n.toolbar.orderedList">
          <t-button size="small" variant="text" class="icon-btn" @click="toggleOrderedList">
            <Icon name="list-numbered" />
          </t-button>
        </t-tooltip>
        <t-tooltip :content="i18n.toolbar.outdent">
          <t-button size="small" variant="text" class="icon-btn" @click="outdent">
            <Icon name="indent-left" />
          </t-button>
        </t-tooltip>
        <t-tooltip :content="i18n.toolbar.indent">
          <t-button size="small" variant="text" class="icon-btn" @click="indent">
            <Icon name="indent-right" />
          </t-button>
        </t-tooltip>
      </div>

      <t-divider layout="vertical" class="toolbar-divider" />

      <div class="toolbar-group">
        <t-tooltip :content="i18n.toolbar.alignLeft">
          <t-button size="small" variant="text" class="icon-btn" @click="alignLeft">
            <Icon name="format-vertical-align-left" />
          </t-button>
        </t-tooltip>
        <t-tooltip :content="i18n.toolbar.alignCenter">
          <t-button size="small" variant="text" class="icon-btn" @click="alignCenter">
            <Icon name="format-vertical-align-center" />
          </t-button>
        </t-tooltip>
        <t-tooltip :content="i18n.toolbar.alignRight">
          <t-button size="small" variant="text" class="icon-btn" @click="alignRight">
            <Icon name="format-vertical-align-right" />
          </t-button>
        </t-tooltip>
      </div>

      <t-divider layout="vertical" class="toolbar-divider" />

      <div class="toolbar-group">
        <t-tooltip :content="i18n.toolbar.insertImage">
          <t-button size="small" variant="text" class="icon-btn" @click="insertImage">
            <Icon name="image" />
          </t-button>
        </t-tooltip>
        <t-tooltip :content="i18n.toolbar.insertVideo">
          <t-button size="small" variant="text" class="icon-btn" @click="insertVideo">
            <Icon name="video" />
          </t-button>
        </t-tooltip>
      </div>

      <t-divider layout="vertical" class="toolbar-divider" />

      <div class="toolbar-group">
        <t-dropdown :options="tableMenuOptions" trigger="click" @click="handleTableMenuClick">
          <t-button size="small" variant="outline" class="table-tools-btn">
            <Icon name="table" />
          </t-button>
        </t-dropdown>
      </div>
    </div>
    <div class="toolbar-right">
      <t-popup trigger="click" placement="bottom-right">
        <template #content>
          <div class="settings-panel">
            <div class="settings-row">
              <span class="settings-label">{{ i18n.toolbar.lineHeight }}</span>
              <t-select
                v-model="lineHeightMultiplier"
                size="small"
                class="settings-select"
                :options="resolvedLineHeightOptions"
              />
            </div>
            <div class="settings-row">
              <span class="settings-label">{{ i18n.toolbar.blockSpacing }}</span>
              <t-select
                v-model="blockSpacing"
                size="small"
                class="settings-select"
                :options="resolvedBlockSpacingOptions"
              />
            </div>
            <div class="settings-row">
              <span class="settings-label">{{ i18n.toolbar.paragraphBefore }}</span>
              <t-select
                v-model="paragraphSpacingBefore"
                size="small"
                class="settings-select"
                :options="resolvedParagraphSpacingOptions"
              />
              <t-button size="small" variant="text" @click="applySpacingBeforeToSelection">
                {{ i18n.toolbar.applyToCurrentParagraph }}
              </t-button>
              <t-button size="small" variant="text" @click="clearSpacingBeforeForSelection">
                {{ i18n.toolbar.clear }}
              </t-button>
            </div>
            <div class="settings-row">
              <span class="settings-label">{{ i18n.toolbar.paragraphAfter }}</span>
              <t-select
                v-model="paragraphSpacingAfter"
                size="small"
                class="settings-select"
                :options="resolvedParagraphSpacingOptions"
              />
              <t-button size="small" variant="text" @click="applySpacingAfterToSelection">
                {{ i18n.toolbar.applyToCurrentParagraph }}
              </t-button>
              <t-button size="small" variant="text" @click="clearSpacingAfterForSelection">
                {{ i18n.toolbar.clear }}
              </t-button>
            </div>
          </div>
        </template>
        <t-button size="small" variant="outline" class="settings-icon-btn" :title="i18n.toolbar.settings">
          <Icon name="setting-1" />
        </t-button>
      </t-popup>
      <span ref="statusEl" class="status">{{ i18n.toolbar.statusZeroPages }}</span>
    </div>
  </t-header>
</template>

<script setup lang="ts">
import { computed, ref, toRaw, watch } from "vue";
import { Icon } from "tdesign-icons-vue-next";
import type { CanvasEditorView } from "lumenpage-view-canvas";
import { closeHistory, redoDepth, undoDepth } from "lumenpage-history";
import { createPlaygroundI18n, type PlaygroundLocale } from "../editor/i18n";

const props = defineProps<{
  editorView: CanvasEditorView | null;
  locale?: PlaygroundLocale;
  blockTypeOptions?: Array<{ label: string; value: string }>;
}>();

const i18n = computed(() => createPlaygroundI18n(props.locale));
const toolbarAriaLabel = computed(() =>
  props.locale === "en-US" ? "Editor formatting toolbar" : "编辑格式工具栏"
);

const defaultBlockTypeOptions = computed(() => [
  { label: i18n.value.toolbar.blockTypeParagraph, value: "paragraph" },
  { label: i18n.value.toolbar.blockTypeHeading1, value: "heading-1" },
  { label: i18n.value.toolbar.blockTypeHeading2, value: "heading-2" },
  { label: i18n.value.toolbar.blockTypeHeading3, value: "heading-3" },
]);

const resolvedBlockTypeOptions = computed(
  () => props.blockTypeOptions || defaultBlockTypeOptions.value
);

const blockType = ref("paragraph");
const lineHeightMultiplier = ref(1.5);
const blockSpacing = ref(8);
const paragraphSpacingBefore = ref(0);
const paragraphSpacingAfter = ref(8);
let suppressStyleWatchCount = 0;

const withStyleWatchSuppressed = (fn: () => void) => {
  suppressStyleWatchCount += 1;
  try {
    fn();
  } finally {
    queueMicrotask(() => {
      suppressStyleWatchCount = Math.max(0, suppressStyleWatchCount - 1);
    });
  }
};

const shouldSkipStyleWatch = () => suppressStyleWatchCount > 0;

const getFontPx = (font: string | undefined) => {
  if (!font) {
    return 16;
  }
  const match = /(\d+(?:\.\d+)?)px/.exec(font);
  if (match) {
    return Number.parseFloat(match[1]);
  }
  return 16;
};

const getCurrentLineHeightMultiplier = () => {
  const view = props.editorView ? toRaw(props.editorView) : null;
  const settings = view?._internals?.settings;
  if (!settings) {
    return lineHeightMultiplier.value;
  }
  const fontPx = getFontPx(settings.font);
  const multiplier = Number((settings.lineHeight / fontPx).toFixed(2));
  return Number.isFinite(multiplier) ? multiplier : lineHeightMultiplier.value;
};

const baseLineHeightOptions = [
  { label: "1", value: 1 },
  { label: "1.5", value: 1.5 },
  { label: "2", value: 2 },
];

const resolvedLineHeightOptions = computed(() => {
  const current = getCurrentLineHeightMultiplier();
  const exists = baseLineHeightOptions.some((option) => option.value === current);
  if (exists) {
    return baseLineHeightOptions;
  }
  return [
    { label: `${i18n.value.toolbar.currentValuePrefix}${current}`, value: current },
    ...baseLineHeightOptions,
  ];
});

const baseBlockSpacingOptions = [
  { label: "0", value: 0 },
  { label: "6", value: 6 },
  { label: "12", value: 12 },
  { label: "18", value: 18 },
];

const getCurrentBlockSpacing = () => {
  const view = props.editorView ? toRaw(props.editorView) : null;
  const settings = view?._internals?.settings;
  if (!settings) {
    return blockSpacing.value;
  }
  const value = Number(settings.blockSpacing ?? 0);
  return Number.isFinite(value) ? value : blockSpacing.value;
};

const resolvedBlockSpacingOptions = computed(() => {
  const current = getCurrentBlockSpacing();
  const exists = baseBlockSpacingOptions.some((option) => option.value === current);
  if (exists) {
    return baseBlockSpacingOptions;
  }
  return [
    { label: `${i18n.value.toolbar.currentValuePrefix}${current}`, value: current },
    ...baseBlockSpacingOptions,
  ];
});

const baseParagraphSpacingOptions = [
  { label: "0", value: 0 },
  { label: "6", value: 6 },
  { label: "12", value: 12 },
  { label: "18", value: 18 },
  { label: "24", value: 24 },
];

const getCurrentParagraphSpacing = (key: "paragraphSpacingBefore" | "paragraphSpacingAfter") => {
  const view = props.editorView ? toRaw(props.editorView) : null;
  const settings = view?._internals?.settings;
  if (!settings) {
    return key === "paragraphSpacingBefore"
      ? paragraphSpacingBefore.value
      : paragraphSpacingAfter.value;
  }
  const value = Number(settings[key] ?? 0);
  return Number.isFinite(value)
    ? value
    : key === "paragraphSpacingBefore"
      ? paragraphSpacingBefore.value
      : paragraphSpacingAfter.value;
};

const getSelectionParagraphSpacing = (
  key: "spacingBefore" | "spacingAfter",
  fallbackKey: "paragraphSpacingBefore" | "paragraphSpacingAfter"
) => {
  const view = props.editorView ? toRaw(props.editorView) : null;
  const settings = view?._internals?.settings;
  const selection = view?.state?.selection;
  const parent = selection?.$from?.parent;
  if (!settings || !parent) {
    return getCurrentParagraphSpacing(fallbackKey);
  }
  if (parent.type?.name !== "paragraph" && parent.type?.name !== "heading") {
    return getCurrentParagraphSpacing(fallbackKey);
  }
  const raw = parent.attrs?.[key];
  if (Number.isFinite(raw)) {
    return Number(raw);
  }
  return Number(settings[fallbackKey] ?? 0);
};

const resolvedParagraphSpacingOptions = computed(() => {
  const beforeValue = getSelectionParagraphSpacing("spacingBefore", "paragraphSpacingBefore");
  const afterValue = getSelectionParagraphSpacing("spacingAfter", "paragraphSpacingAfter");
  const unique = new Set<number>([beforeValue, afterValue, ...baseParagraphSpacingOptions.map((o) => o.value)]);
  const options = Array.from(unique).sort((a, b) => a - b);
  return options.map((value) => ({
    label: String(value),
    value,
  }));
});

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

const runUndo = () => runWithNotice("undo", i18n.value.toolbar.alertCannotUndo);
const runRedo = () => runWithNotice("redo", i18n.value.toolbar.alertCannotRedo);
const markHistoryBoundary = () => {
  const view = props.editorView ? toRaw(props.editorView) : null;
  if (!view?.state?.tr) {
    return false;
  }
  const tr = closeHistory(view.state.tr);
  view.dispatch(tr);
  return true;
};
const toggleBold = () => run("toggleBold");
const toggleItalic = () => run("toggleItalic");
const toggleUnderline = () => run("toggleUnderline");
const toggleStrike = () => run("toggleStrike");
const toggleInlineCode = () => run("toggleInlineCode");
const toggleBlockquote = () => run("toggleBlockquote");
const toggleCodeBlock = () => {
  if (run("toggleCodeBlock")) {
    return true;
  }
  return run("setBlockType", "code_block");
};
const insertHorizontalRule = () => run("insertHorizontalRule");
const toggleBulletList = () => run("toggleBulletList");
const toggleOrderedList = () => run("toggleOrderedList");
const indent = () => run("indent");
const outdent = () => run("outdent");
const alignLeft = () => run("alignLeft");
const alignCenter = () => run("alignCenter");
const alignRight = () => run("alignRight");

const toggleLink = () => {
  const view = props.editorView ? toRaw(props.editorView) : null;
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
    const from = view.state.selection.from;
    const to = view.state.selection.to;
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

const addTableRowAfter = () =>
  runWithNotice("addTableRowAfter", i18n.value.toolbar.alertTableCellRequired);
const deleteTableRow = () =>
  runWithNotice("deleteTableRow", i18n.value.toolbar.alertTableCellRequired);
const addTableColumnAfter = () =>
  runWithNotice("addTableColumnAfter", i18n.value.toolbar.alertTableCellRequired);
const deleteTableColumn = () =>
  runWithNotice("deleteTableColumn", i18n.value.toolbar.alertTableCellRequired);
const mergeTableCellRight = () =>
  runWithNotice("mergeTableCellRight", i18n.value.toolbar.alertMergeRightUnavailable);
const splitTableCell = () =>
  runWithNotice("splitTableCell", i18n.value.toolbar.alertSplitCellUnavailable);

const tableMenuOptions = computed(() => [
  {
    content: i18n.value.toolbar.tableAddRow,
    value: "addTableRowAfter",
    disabled: !canRun("addTableRowAfter"),
  },
  {
    content: i18n.value.toolbar.tableDeleteRow,
    value: "deleteTableRow",
    disabled: !canRun("deleteTableRow"),
  },
  {
    content: i18n.value.toolbar.tableAddColumn,
    value: "addTableColumnAfter",
    disabled: !canRun("addTableColumnAfter"),
  },
  {
    content: i18n.value.toolbar.tableDeleteColumn,
    value: "deleteTableColumn",
    disabled: !canRun("deleteTableColumn"),
  },
  {
    content: i18n.value.toolbar.tableMergeRight,
    value: "mergeTableCellRight",
    disabled: !canRun("mergeTableCellRight"),
  },
  {
    content: i18n.value.toolbar.tableSplitCell,
    value: "splitTableCell",
    disabled: !canRun("splitTableCell"),
  },
]);

const handleTableMenuClick = (payload: any) => {
  const value = payload?.value ?? payload;
  switch (value) {
    case "addTableRowAfter":
      addTableRowAfter();
      break;
    case "deleteTableRow":
      deleteTableRow();
      break;
    case "addTableColumnAfter":
      addTableColumnAfter();
      break;
    case "deleteTableColumn":
      deleteTableColumn();
      break;
    case "mergeTableCellRight":
      mergeTableCellRight();
      break;
    case "splitTableCell":
      splitTableCell();
      break;
    default:
      break;
  }
};

const handleBlockTypeChange = (value: string) => {
  if (value === "paragraph") {
    run("setBlockType", "paragraph");
    return;
  }
  if (value.startsWith("heading-")) {
    const level = Number.parseInt(value.replace("heading-", ""), 10);
    if (Number.isFinite(level)) {
      run("setBlockType", "heading", level);
    }
  }
};

watch(blockType, (value) => {
  handleBlockTypeChange(value);
});

const statusEl = ref<HTMLElement | null>(null);

const undoDepthCount = computed(() => {
  const view = props.editorView ? toRaw(props.editorView) : null;
  if (!view?.state) {
    return 0;
  }
  return undoDepth(view.state) || 0;
});

const redoDepthCount = computed(() => {
  const view = props.editorView ? toRaw(props.editorView) : null;
  if (!view?.state) {
    return 0;
  }
  return redoDepth(view.state) || 0;
});

const applyLineHeightMultiplier = (value: number) => {
  const view = props.editorView ? toRaw(props.editorView) : null;
  const settings = view?._internals?.settings;
  if (!settings || !Number.isFinite(value)) {
    return;
  }
  const fontPx = getFontPx(settings.font);
  const nextLineHeight = Math.max(1, Math.round(fontPx * value));
  settings.lineHeight = nextLineHeight;
  view?._internals?.layoutPipeline?.clearCache?.();
  const inputEl = view?._internals?.dom?.input;
  if (inputEl) {
    inputEl.style.height = `${nextLineHeight}px`;
    inputEl.style.lineHeight = `${nextLineHeight}px`;
  }
  view?._internals?.updateLayout?.();
  view?._internals?.updateCaret?.(true);
  view?._internals?.scheduleRender?.();
};

const applyBlockSpacing = (value: number) => {
  const view = props.editorView ? toRaw(props.editorView) : null;
  const settings = view?._internals?.settings;
  if (!settings || !Number.isFinite(value)) {
    return;
  }
  settings.blockSpacing = Math.max(0, Math.round(value));
  view?._internals?.layoutPipeline?.clearCache?.();
  view?._internals?.updateLayout?.();
  view?._internals?.updateCaret?.(true);
  view?._internals?.scheduleRender?.();
};

const applyParagraphSpacing = (key: "paragraphSpacingBefore" | "paragraphSpacingAfter", value: number) => {
  const view = props.editorView ? toRaw(props.editorView) : null;
  const settings = view?._internals?.settings;
  if (!settings || !Number.isFinite(value)) {
    return;
  }
  settings[key] = Math.max(0, Math.round(value));
  view?._internals?.layoutPipeline?.clearCache?.();
  view?._internals?.updateLayout?.();
  view?._internals?.updateCaret?.(true);
  view?._internals?.scheduleRender?.();
};

const applySpacingBeforeToSelection = () => {
  run("setParagraphSpacingBefore", paragraphSpacingBefore.value);
};

const applySpacingAfterToSelection = () => {
  run("setParagraphSpacingAfter", paragraphSpacingAfter.value);
};

const clearSpacingBeforeForSelection = () => {
  run("clearParagraphSpacingBefore");
};

const clearSpacingAfterForSelection = () => {
  run("clearParagraphSpacingAfter");
};

const syncSpacingFromSelection = () => {
  const before = getSelectionParagraphSpacing("spacingBefore", "paragraphSpacingBefore");
  const after = getSelectionParagraphSpacing("spacingAfter", "paragraphSpacingAfter");
  withStyleWatchSuppressed(() => {
    paragraphSpacingBefore.value = before;
    paragraphSpacingAfter.value = after;
  });
};

watch(
  () => props.editorView,
  () => {
    withStyleWatchSuppressed(() => {
      lineHeightMultiplier.value = getCurrentLineHeightMultiplier();
      blockSpacing.value = getCurrentBlockSpacing();
    });
    syncSpacingFromSelection();
  },
  { immediate: true }
);

watch(
  () => props.editorView?.state?.selection?.head,
  () => {
    syncSpacingFromSelection();
  }
);

watch(lineHeightMultiplier, (value) => {
  if (shouldSkipStyleWatch()) {
    return;
  }
  applyLineHeightMultiplier(value);
});

watch(blockSpacing, (value) => {
  if (shouldSkipStyleWatch()) {
    return;
  }
  applyBlockSpacing(value);
});

watch(paragraphSpacingBefore, (value) => {
  if (shouldSkipStyleWatch()) {
    return;
  }
  applyParagraphSpacing("paragraphSpacingBefore", value);
});

watch(paragraphSpacingAfter, (value) => {
  if (shouldSkipStyleWatch()) {
    return;
  }
  applyParagraphSpacing("paragraphSpacingAfter", value);
});

defineExpose({ statusEl });
</script>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: 6px 10px;
  padding: 10px 16px;
  height: auto;
  min-height: 0;
  background: #ffffff;
  border-bottom: 1px solid #e5e6eb;
}

.toolbar-left {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  align-items: center;
  gap: 6px 10px;
  flex-wrap: wrap;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.toolbar-divider {
  height: 24px;
}

.block-select {
  width: 120px;
}

.block-select :deep(.t-input) {
  background-color: transparent !important;
  border: 1px solid #d9dce3 !important;
  box-shadow: none !important;
}

.block-select :deep(.t-input:hover) {
  border-color: #bfc4d0 !important;
}

.block-select :deep(.t-is-focused .t-input),
.block-select :deep(.t-input--focused) {
  border-color: #2f6bff !important;
  box-shadow: none !important;
}

.icon-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid #d9dce3 !important;
  background-color: transparent !important;
  box-shadow: none !important;
}

.icon-btn :deep(.t-icon) {
  font-size: 16px;
}

.icon-btn:hover,
.icon-btn:active,
.icon-btn:focus,
.icon-btn:focus-visible {
  background-color: transparent !important;
  box-shadow: none !important;
}

.icon-btn:hover {
  border-color: #bfc4d0 !important;
}

.icon-btn:active,
.icon-btn:focus,
.icon-btn:focus-visible {
  border-color: #2f6bff !important;
}


.status {
  font-size: 12px;
  color: #8f959e;
}

.history-cut {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: -1px;
  line-height: 1;
}

.history-depth {
  font-size: 11px;
  color: #8f959e;
  padding-left: 2px;
  min-width: 48px;
}

.settings-panel {
  padding: 10px 12px;
  min-width: 160px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.settings-label {
  font-size: 12px;
  color: #4e5969;
}

.settings-select {
  width: 90px;
}

.table-tools-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.settings-icon-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid #d9dce3 !important;
  background-color: transparent !important;
  box-shadow: none !important;
}

.settings-icon-btn :deep(.t-icon) {
  font-size: 16px;
}

</style>
