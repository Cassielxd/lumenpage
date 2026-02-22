<template>
  <t-header class="toolbar" @mousedown="handleToolbarMouseDown">
    <div class="toolbar-left">
      <div class="toolbar-group">
        <t-tooltip content="撤销">
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
        <t-tooltip content="重做">
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
        <t-tooltip content="加粗">
          <t-button size="small" variant="text" class="icon-btn" @click="toggleBold">
            <Icon name="textformat-bold" />
          </t-button>
        </t-tooltip>
        <t-tooltip content="斜体">
          <t-button size="small" variant="text" class="icon-btn" @click="toggleItalic">
            <Icon name="textformat-italic" />
          </t-button>
        </t-tooltip>
        <t-tooltip content="下划线">
          <t-button size="small" variant="text" class="icon-btn" @click="toggleUnderline">
            <Icon name="textformat-underline" />
          </t-button>
        </t-tooltip>
        <t-tooltip content="删除线">
          <t-button size="small" variant="text" class="icon-btn" @click="toggleStrike">
            <Icon name="textformat-strikethrough" />
          </t-button>
        </t-tooltip>
        <t-tooltip content="行内代码">
          <t-button size="small" variant="text" class="icon-btn" @click="toggleInlineCode">
            <Icon name="code" />
          </t-button>
        </t-tooltip>
      </div>

      <t-divider layout="vertical" class="toolbar-divider" />

      <div class="toolbar-group">
        <t-tooltip content="链接">
          <t-button size="small" variant="text" class="icon-btn" @click="toggleLink">
            <Icon name="link" />
          </t-button>
        </t-tooltip>
        <t-tooltip content="引用">
          <t-button size="small" variant="text" class="icon-btn" @click="toggleBlockquote">
            <Icon name="quote" />
          </t-button>
        </t-tooltip>
        <t-tooltip content="代码块">
          <t-button size="small" variant="text" class="icon-btn" @click="toggleCodeBlock">
            <Icon name="code" />
          </t-button>
        </t-tooltip>
        <t-tooltip content="分割线">
          <t-button size="small" variant="text" class="icon-btn" @click="insertHorizontalRule">
            <Icon name="minus" />
          </t-button>
        </t-tooltip>
      </div>

      <t-divider layout="vertical" class="toolbar-divider" />

      <div class="toolbar-group">
        <t-tooltip content="无序列表">
          <t-button size="small" variant="text" class="icon-btn" @click="toggleBulletList">
            <Icon name="list" />
          </t-button>
        </t-tooltip>
        <t-tooltip content="有序列表">
          <t-button size="small" variant="text" class="icon-btn" @click="toggleOrderedList">
            <Icon name="list-numbered" />
          </t-button>
        </t-tooltip>
        <t-tooltip content="减少缩进">
          <t-button size="small" variant="text" class="icon-btn" @click="outdent">
            <Icon name="indent-left" />
          </t-button>
        </t-tooltip>
        <t-tooltip content="增加缩进">
          <t-button size="small" variant="text" class="icon-btn" @click="indent">
            <Icon name="indent-right" />
          </t-button>
        </t-tooltip>
      </div>

      <t-divider layout="vertical" class="toolbar-divider" />

      <div class="toolbar-group">
        <t-tooltip content="左对齐">
          <t-button size="small" variant="text" class="icon-btn" @click="alignLeft">
            <Icon name="format-vertical-align-left" />
          </t-button>
        </t-tooltip>
        <t-tooltip content="居中">
          <t-button size="small" variant="text" class="icon-btn" @click="alignCenter">
            <Icon name="format-vertical-align-center" />
          </t-button>
        </t-tooltip>
        <t-tooltip content="右对齐">
          <t-button size="small" variant="text" class="icon-btn" @click="alignRight">
            <Icon name="format-vertical-align-right" />
          </t-button>
        </t-tooltip>
      </div>

      <t-divider layout="vertical" class="toolbar-divider" />

      <div class="toolbar-group">
        <t-tooltip content="插入图片">
          <t-button size="small" variant="text" class="icon-btn" @click="insertImage">
            <Icon name="image" />
          </t-button>
        </t-tooltip>
        <t-tooltip content="插入视频">
          <t-button size="small" variant="text" class="icon-btn" @click="insertVideo">
            <Icon name="video" />
          </t-button>
        </t-tooltip>
      </div>

      <t-divider layout="vertical" class="toolbar-divider" />

      <div class="toolbar-group">
        <t-popup trigger="click" placement="bottom">
          <template #content>
            <div class="table-tools-panel" @mousedown.prevent>
              <t-button
                size="small"
                variant="text"
                block
                :disabled="!canRun('addTableRowAfter')"
                @click="addTableRowAfter"
              >
                表格加行
              </t-button>
              <t-button
                size="small"
                variant="text"
                block
                :disabled="!canRun('deleteTableRow')"
                @click="deleteTableRow"
              >
                表格删行
              </t-button>
              <t-button
                size="small"
                variant="text"
                block
                :disabled="!canRun('addTableColumnAfter')"
                @click="addTableColumnAfter"
              >
                表格加列
              </t-button>
              <t-button
                size="small"
                variant="text"
                block
                :disabled="!canRun('deleteTableColumn')"
                @click="deleteTableColumn"
              >
                表格删列
              </t-button>
              <t-button
                size="small"
                variant="text"
                block
                :disabled="!canRun('mergeTableCellRight')"
                @click="mergeTableCellRight"
              >
                合并右侧单元格
              </t-button>
              <t-button
                size="small"
                variant="text"
                block
                :disabled="!canRun('splitTableCell')"
                @click="splitTableCell"
              >
                拆分单元格
              </t-button>
            </div>
          </template>
          <t-button size="small" variant="outline" class="table-tools-btn">
            <Icon name="table" />
          </t-button>
        </t-popup>
      </div>
    </div>
    <div class="toolbar-right">
      <t-popup trigger="click" placement="bottom-right">
        <template #content>
          <div class="settings-panel">
            <div class="settings-row">
              <span class="settings-label">行高</span>
              <t-select
                v-model="lineHeightMultiplier"
                size="small"
                class="settings-select"
                :options="resolvedLineHeightOptions"
              />
            </div>
            <div class="settings-row">
              <span class="settings-label">段间距</span>
              <t-select
                v-model="blockSpacing"
                size="small"
                class="settings-select"
                :options="resolvedBlockSpacingOptions"
              />
            </div>
            <div class="settings-row">
              <span class="settings-label">段前</span>
              <t-select
                v-model="paragraphSpacingBefore"
                size="small"
                class="settings-select"
                :options="resolvedParagraphSpacingOptions"
              />
              <t-button size="small" variant="text" @click="applySpacingBeforeToSelection">
                作用当前段
              </t-button>
              <t-button size="small" variant="text" @click="clearSpacingBeforeForSelection">
                清除
              </t-button>
            </div>
            <div class="settings-row">
              <span class="settings-label">段后</span>
              <t-select
                v-model="paragraphSpacingAfter"
                size="small"
                class="settings-select"
                :options="resolvedParagraphSpacingOptions"
              />
              <t-button size="small" variant="text" @click="applySpacingAfterToSelection">
                作用当前段
              </t-button>
              <t-button size="small" variant="text" @click="clearSpacingAfterForSelection">
                清除
              </t-button>
            </div>
          </div>
        </template>
        <t-button size="small" variant="outline">设置</t-button>
      </t-popup>
      <span ref="statusEl" class="status">0 pages</span>
    </div>
  </t-header>
</template>

<script setup lang="ts">
import { computed, ref, toRaw, watch } from "vue";
import { Icon } from "tdesign-icons-vue-next";
import type { CanvasEditorView } from "lumenpage-view-canvas";

const props = defineProps<{
  editorView: CanvasEditorView | null;
  blockTypeOptions?: Array<{ label: string; value: string }>;
}>();

const defaultBlockTypeOptions = [
  { label: "正文", value: "paragraph" },
  { label: "标题 1", value: "heading-1" },
  { label: "标题 2", value: "heading-2" },
  { label: "标题 3", value: "heading-3" },
];

const resolvedBlockTypeOptions = computed(
  () => props.blockTypeOptions || defaultBlockTypeOptions
);

const blockType = ref("paragraph");
const lineHeightMultiplier = ref(1.5);
const blockSpacing = ref(8);
const paragraphSpacingBefore = ref(0);
const paragraphSpacingAfter = ref(8);

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
  return [{ label: `当前 ${current}`, value: current }, ...baseLineHeightOptions];
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
  return [{ label: `当前 ${current}`, value: current }, ...baseBlockSpacingOptions];
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

const runUndo = () => runWithNotice("undo", "当前没有可撤销的操作");
const runRedo = () => runWithNotice("redo", "当前没有可重做的操作");
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
  const url = window.prompt("请输入链接地址", defaultValue);
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
    window.alert("请先选中文本，或将光标放在文本中后再添加链接");
  }
  return ok;
};

const insertImage = () => {
  const src = window.prompt("请输入图片地址", "");
  if (!src) {
    return false;
  }
  return run("insertImage", { src });
};

const insertVideo = () => {
  const src = window.prompt("请输入视频地址", "");
  if (!src) {
    return false;
  }
  return run("insertVideo", { src, embed: false });
};

const addTableRowAfter = () => runWithNotice("addTableRowAfter", "请先将光标放在表格单元格内");
const deleteTableRow = () => runWithNotice("deleteTableRow", "请先将光标放在表格单元格内");
const addTableColumnAfter = () =>
  runWithNotice("addTableColumnAfter", "请先将光标放在表格单元格内");
const deleteTableColumn = () =>
  runWithNotice("deleteTableColumn", "请先将光标放在表格单元格内");
const mergeTableCellRight = () =>
  runWithNotice("mergeTableCellRight", "当前单元格无法向右合并");
const splitTableCell = () => runWithNotice("splitTableCell", "当前单元格无法拆分");

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
  paragraphSpacingBefore.value = before;
  paragraphSpacingAfter.value = after;
};

watch(
  () => props.editorView,
  () => {
    lineHeightMultiplier.value = getCurrentLineHeightMultiplier();
    blockSpacing.value = getCurrentBlockSpacing();
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
  applyLineHeightMultiplier(value);
});

watch(blockSpacing, (value) => {
  applyBlockSpacing(value);
});

watch(paragraphSpacingBefore, (value) => {
  applyParagraphSpacing("paragraphSpacingBefore", value);
});

watch(paragraphSpacingAfter, (value) => {
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

.table-tools-panel {
  display: flex;
  flex-direction: column;
  min-width: 168px;
  padding: 6px;
  gap: 2px;
}
</style>
