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
          :class="{
            'toolbar-left--with-label': showItemDescription,
            'toolbar-left--base-two-line': isBaseMenu,
          }"
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
                <div
                  v-if="isHeadingInlineBoxItem(item)"
                  class="heading-inline-box heading-inline-surface"
                  :data-toolbar-action="item.action"
                >
                  <button
                    v-for="option in headingInlineVisibleOptions"
                    :key="`heading-inline-${String(option.value)}`"
                    type="button"
                    class="heading-inline-option"
                    :disabled="isViewerSession"
                    :aria-disabled="isViewerSession"
                    :class="{
                      'heading-inline-option--active': isHeadingInlineOptionActive(option.value),
                    }"
                    @mousedown.prevent
                    @click="handleHeadingInlineOptionClick(option.value)"
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
                    :disabled="isViewerSession"
                    :aria-disabled="isViewerSession"
                    :aria-expanded="headingInlineMoreOpen"
                    @mousedown.prevent
                    @click.stop="handleToggleHeadingInlineMore"
                  >
                    v
                  </button>
                </div>
                <t-dropdown
                  v-else-if="isFontFamilyItem(item)"
                  trigger="click"
                  placement="bottom-left"
                  :disabled="isItemDisabled(item)"
                  :hide-after-item-click="true"
                  :options="fontFamilyMenuOptions"
                  :popup-props="{ overlayInnerClassName: 'toolbar-check-dropdown toolbar-font-family-dropdown' }"
                  @click="handleFontFamilyDropdownClick"
                >
                  <button
                    type="button"
                    class="toolbar-inline-dropdown-trigger toolbar-inline-dropdown-trigger--font"
                    data-toolbar-action="font-family"
                    :disabled="isItemDisabled(item)"
                    :aria-disabled="isItemDisabled(item)"
                    @mousedown="handleInlineDropdownTriggerMouseDown"
                  >
                    <span class="toolbar-inline-dropdown-trigger-value">
                      {{ fontFamilyDisplayLabel }}
                    </span>
                    <span class="toolbar-inline-dropdown-trigger-arrow" aria-hidden="true"></span>
                  </button>
                </t-dropdown>
                <t-dropdown
                  v-else-if="isFontSizeItem(item)"
                  trigger="click"
                  placement="bottom-left"
                  :disabled="isItemDisabled(item)"
                  :hide-after-item-click="true"
                  :options="fontSizeMenuOptions"
                  :popup-props="{ overlayInnerClassName: 'toolbar-check-dropdown toolbar-font-size-dropdown' }"
                  @click="handleFontSizeDropdownClick"
                >
                  <button
                    type="button"
                    class="toolbar-inline-dropdown-trigger toolbar-inline-dropdown-trigger--size"
                    data-toolbar-action="font-size"
                    :disabled="isItemDisabled(item)"
                    :aria-disabled="isItemDisabled(item)"
                    @mousedown="handleInlineDropdownTriggerMouseDown"
                  >
                    <span class="toolbar-inline-dropdown-trigger-value">
                      {{ fontSizeDisplayLabel }}
                    </span>
                    <span class="toolbar-inline-dropdown-trigger-arrow" aria-hidden="true"></span>
                  </button>
                </t-dropdown>
                <t-dropdown
                  v-else-if="isPageSizeItem(item)"
                  trigger="click"
                  placement="bottom-left"
                  :disabled="isItemDisabled(item)"
                  :hide-after-item-click="true"
                  :options="pageSizeMenuOptions"
                  :popup-props="{ overlayInnerClassName: 'toolbar-page-size-dropdown' }"
                  @click="handlePageSizeDropdownClick"
                >
                  <t-tooltip :content="itemLabel(item)">
                    <t-button
                      size="small"
                      variant="text"
                      class="icon-btn"
                      :data-toolbar-action="item.action"
                      :class="{
                        'icon-btn--with-label': shouldShowItemDescription(group),
                        'icon-btn--base': isBaseGridGroup(group),
                      }"
                      :disabled="isItemDisabled(item)"
                      @mousedown.prevent
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
                        <span v-if="shouldShowItemDescription(group)" class="icon-btn-label">{{
                          itemLabel(item)
                        }}</span>
                      </span>
                    </t-button>
                  </t-tooltip>
                </t-dropdown>
                <t-popup
                  v-else-if="isTableInsertItem(item)"
                  trigger="click"
                  placement="bottom-left"
                  :disabled="isItemDisabled(item)"
                  :visible="tableInsertPickerOpen"
                  overlay-inner-class-name="toolbar-table-insert-popup"
                  @visible-change="handleTableInsertPopupVisibleChange"
                >
                  <template #content>
                    <div class="table-insert-picker heading-inline-surface" @mouseleave="handleTableInsertGridLeave">
                      <div class="table-insert-picker-title">{{ tableInsertPickerText }}</div>
                      <div class="table-insert-picker-grid">
                        <div
                          v-for="row in tableInsertGridRows"
                          :key="`table-grid-row-${row}`"
                          class="table-insert-picker-row"
                        >
                          <button
                            v-for="col in tableInsertGridCols"
                            :key="`table-grid-${row}-${col}`"
                            type="button"
                            class="table-insert-picker-cell"
                            :class="{ 'table-insert-picker-cell--active': isTableInsertCellActive(row, col) }"
                            :data-table-size="`${row}x${col}`"
                            @mousedown.prevent
                            @mouseenter="handleTableInsertCellEnter(row, col)"
                            @focus="handleTableInsertCellEnter(row, col)"
                            @click="handleTableInsertCellClick(row, col)"
                          />
                        </div>
                      </div>
                    </div>
                  </template>
                  <t-tooltip :content="itemLabel(item)">
                    <button
                      type="button"
                      class="icon-btn toolbar-table-picker-trigger"
                      :data-toolbar-action="item.action"
                      :class="{
                        'icon-btn--with-label': shouldShowItemDescription(group),
                        'icon-btn--base': isBaseGridGroup(group),
                      }"
                      :disabled="isItemDisabled(item)"
                      :aria-disabled="isItemDisabled(item)"
                      :aria-expanded="tableInsertPickerOpen"
                      @mousedown.prevent
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
                        <span v-if="shouldShowItemDescription(group)" class="icon-btn-label">{{
                          itemLabel(item)
                        }}</span>
                      </span>
                    </button>
                  </t-tooltip>
                </t-popup>
                <t-tooltip v-else :content="itemLabel(item)">
                  <t-button
                    size="small"
                    variant="text"
                    class="icon-btn"
                    :data-toolbar-action="item.action"
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
                      <span v-if="shouldShowItemDescription(group)" class="icon-btn-label">{{
                        itemLabel(item)
                      }}</span>
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
      class="heading-inline-more-panel heading-inline-more-panel--floating heading-inline-surface"
      :style="headingInlineMorePanelStyle"
    >
      <div class="heading-inline-more-grid">
        <button
          v-for="option in headingInlinePanelOptions"
          :key="`heading-inline-more-${String(option.value)}`"
          type="button"
          class="heading-inline-option heading-inline-more-option"
          :disabled="isViewerSession"
          :aria-disabled="isViewerSession"
          :class="{ 'heading-inline-option--active': isHeadingInlineOptionActive(option.value) }"
          @mousedown.prevent
          @click="handleHeadingInlineOptionClick(option.value)"
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

  <t-dialog
    :visible="colorDialogVisible"
    :header="colorDialogTitle"
    :confirm-btn="localeKey === 'en-US' ? 'Apply' : '\u786e\u5b9a'"
    :cancel-btn="localeKey === 'en-US' ? 'Cancel' : '\u53d6\u6d88'"
    :close-on-overlay-click="false"
    :close-on-esc-keydown="true"
    width="440"
    @update:visible="handleColorDialogVisibleChange"
    @confirm="handleColorDialogConfirm"
    @cancel="handleColorDialogCancel"
    @close="handleColorDialogCancel"
  >
    <div class="toolbar-color-dialog">
      <t-color-picker
        v-if="colorDialogVisible"
        :model-value="colorDialogValue"
        format="HEX"
        clearable
        :enable-alpha="true"
        :show-primary-color-preview="true"
        :recent-colors="toolbarRecentColors"
        :swatch-colors="TOOLBAR_COLOR_SWATCHES"
        @change="handleColorPickerChange"
        @clear="handleColorPickerClear"
      />
      <div class="toolbar-color-dialog-footer">
        <span class="toolbar-color-dialog-value">{{ colorDialogValueText }}</span>
        <t-button size="small" variant="outline" @click="handleColorPickerClear">
          {{ colorDialogTexts.clear }}
        </t-button>
      </div>
    </div>
  </t-dialog>

  <t-dialog
    :visible="inputDialogVisible"
    :header="inputDialogTitle"
    :confirm-btn="inputDialogConfirmText || inputDialogTexts.confirm"
    :cancel-btn="inputDialogCancelText || inputDialogTexts.cancel"
    :close-on-overlay-click="false"
    :close-on-esc-keydown="true"
    :width="inputDialogWidth"
    @update:visible="handleInputDialogVisibleChange"
    @confirm="handleInputDialogConfirm"
    @cancel="handleInputDialogCancel"
    @close="handleInputDialogCancel"
  >
    <div class="toolbar-input-dialog">
      <p v-if="inputDialogDescription" class="toolbar-input-dialog-description">
        {{ inputDialogDescription }}
      </p>
      <div class="toolbar-input-dialog-fields">
        <div v-for="field in inputDialogFields" :key="field.key" class="toolbar-input-dialog-field">
          <div class="toolbar-input-dialog-label">
            <span>{{ field.label }}</span>
            <span v-if="field.required" class="toolbar-input-dialog-required">*</span>
          </div>
          <t-textarea
            v-if="field.type === 'textarea'"
            :model-value="inputDialogValues[field.key] || ''"
            :placeholder="field.placeholder || ''"
            :autosize="{ minRows: 3, maxRows: 8 }"
            @update:model-value="(value) => setInputDialogFieldValue(field.key, value)"
          />
          <t-select
            v-else-if="field.type === 'select'"
            :model-value="inputDialogValues[field.key] || ''"
            :options="resolveInputDialogFieldOptions(field)"
            @update:model-value="(value) => setInputDialogFieldValue(field.key, value)"
          />
          <t-input
            v-else
            :type="field.type === 'number' ? 'number' : 'text'"
            :model-value="inputDialogValues[field.key] || ''"
            :placeholder="field.placeholder || ''"
            @update:model-value="(value) => setInputDialogFieldValue(field.key, value)"
          />
        </div>
      </div>
      <p v-if="inputDialogError" class="toolbar-input-dialog-error">
        {{ inputDialogError }}
      </p>
    </div>
  </t-dialog>
  <SignatureDialog
    v-model:visible="signatureDialogVisible"
    :default-signer="signatureDialogDefaultSigner"
    @confirm="handleSignatureDialogConfirm"
    @cancel="handleSignatureDialogCancel"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRaw, watch } from "vue";
import { MessagePlugin } from "tdesign-vue-next";
import type { CanvasEditorView } from "lumenpage-view-canvas";
import { redoDepth, undoDepth } from "lumenpage-history";
import { TextSelection } from "lumenpage-state";
import LumenIcon from "./LumenIcon.vue";
import SignatureDialog from "./SignatureDialog.vue";
import { createPlaygroundI18n, type PlaygroundLocale } from "../editor/i18n";
import {
  normalizeEditorSessionMode,
  toggleEditorSessionMode,
  type EditorSessionMode,
} from "../editor/sessionMode";
import { canUseToolbarActionInSession } from "../editor/toolbarAccessPolicy";
import { createExportActions } from "../editor/toolbarActions/exportActions";
import { createInlineMediaActions } from "../editor/toolbarActions/inlineMediaActions";
import { createImportActions } from "../editor/toolbarActions/importActions";
import { createInsertAdvancedActions } from "../editor/toolbarActions/insertAdvancedActions";
import { createLayoutActions, PAGE_SIZE_PRESETS } from "../editor/toolbarActions/layoutActions";
import { createMarkdownActions } from "../editor/toolbarActions/markdownActions";
import { createQuickInsertActions } from "../editor/toolbarActions/quickInsertActions";
import { createSearchReplaceActions } from "../editor/toolbarActions/searchReplaceActions";
import createTableActions from "../editor/toolbarActions/tableActions";
import { createTextFormatActions } from "../editor/toolbarActions/textFormatActions";
import { createTextStyleActions } from "../editor/toolbarActions/textStyleActions";
import { createToolsActions } from "../editor/toolbarActions/toolsActions";
import { showToolbarMessage } from "../editor/toolbarActions/ui/message";
import type {
  RequestToolbarInputDialog,
  ToolbarInputDialogField,
  ToolbarInputDialogOption,
  ToolbarInputDialogResult,
} from "../editor/toolbarActions/ui/inputDialog";
import {
  applyToolbarColorAction,
  getToolbarColorDefault,
  getToolbarColorDialogTitle,
  isToolbarColorAction,
  type ToolbarColorAction,
} from "../editor/toolbarActions/colorPickerActions";
import { createToolbarActionHandlers } from "../editor/toolbarActions/actionHandlers";
import {
  createHeadingInlineActions,
  createHeadingInlineItems,
  isHeadingInlineBoxItem,
} from "../editor/toolbarActions/headingInlineActions";
import {
  TOOLBAR_EXPORT_STRATEGY,
  TOOLBAR_MENU_GROUPS,
  type ToolbarGroupConfig,
  type ToolbarItemConfig,
  type ToolbarMenuKey,
} from "../editor/toolbarCatalog";

const props = defineProps<{
  editorView: CanvasEditorView | null;
  locale?: PlaygroundLocale;
  activeMenu?: ToolbarMenuKey;
  sessionMode?: EditorSessionMode;
}>();

const emit = defineEmits<{
  (e: "update:sessionMode", value: EditorSessionMode): void;
  (e: "toggle-toc"): void;
}>();

const i18n = computed(() => createPlaygroundI18n(props.locale));
const localeKey = computed<PlaygroundLocale>(() => (props.locale === "en-US" ? "en-US" : "zh-CN"));
const resolvedActiveMenu = computed<ToolbarMenuKey>(() => props.activeMenu || "base");
const resolvedSessionMode = computed<EditorSessionMode>(() =>
  normalizeEditorSessionMode(props.sessionMode)
);
const isViewerSession = computed(() => resolvedSessionMode.value === "viewer");
const toolbarAriaLabel = computed(() => "Editor formatting toolbar");

const currentGroups = computed(() => TOOLBAR_MENU_GROUPS[resolvedActiveMenu.value] || []);
const isBaseMenu = computed(() => resolvedActiveMenu.value === "base");
const showItemDescription = computed(() => resolvedActiveMenu.value !== "base");
type ToolbarRenderGroup = ToolbarGroupConfig & {
  layoutMode?: "default" | "base-grid" | "base-export-row";
};

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
  const exportItems = TOOLBAR_EXPORT_STRATEGY.mergeExportIntoBase
    ? (TOOLBAR_MENU_GROUPS.export || [])
        .flatMap((group) => group.items || [])
        .filter((item) =>
          TOOLBAR_EXPORT_STRATEGY.onlyShowImplementedInBase ? item.implemented : true
        )
    : [];
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
const resolveIconSize = (group: ToolbarRenderGroup) => (isBaseGridGroup(group) ? 14 : 22);
const TOOLBAR_COLOR_SWATCHES = [
  "#111827",
  "#1d4ed8",
  "#0f766e",
  "#b45309",
  "#b91c1c",
  "#7c3aed",
  "#fff59d",
  "#fecaca",
  "#bfdbfe",
  "#bbf7d0",
  "#ffffff",
  "#000000",
];
const TOOLBAR_RECENT_COLOR_LIMIT = 8;

const toolbarLeftViewport = ref<HTMLElement | null>(null);
const canScrollLeft = ref(false);
const canScrollRight = ref(false);
const statusEl = ref<HTMLElement | null>(null);
const toolbarRecentColors = ref<string[]>([]);
const TOOLBAR_SCROLL_STEP = 320;
const TOOLBAR_SCROLL_EPSILON = 2;

const pushToolbarRecentColor = (value: string) => {
  const next = String(value || "").trim();
  if (!next) {
    return;
  }
  const normalized = next.toLowerCase();
  const deduped = toolbarRecentColors.value.filter((item) => item.toLowerCase() !== normalized);
  toolbarRecentColors.value = [next, ...deduped].slice(0, TOOLBAR_RECENT_COLOR_LIMIT);
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
    showToolbarMessage(message, "warning");
  }
  return ok;
};

const TOOLBAR_FONT_FAMILY_PRESETS = [
  "Arial",
  "Helvetica",
  "Times New Roman",
  "Georgia",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Courier New",
  "Segoe UI",
  "PingFang SC",
  "Hiragino Sans GB",
  "Microsoft YaHei",
  "SimSun",
  "Noto Sans SC",
  "Noto Serif SC",
];
const TOOLBAR_FONT_SIZE_PRESETS = [10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72];
const fontFamilyValue = ref("Arial");
const fontSizeValue = ref("16");
const pendingInlineStyleSelection = ref<{ from: number; to: number } | null>(null);

const parseBaseFontFamily = (fontSpec: string | null | undefined) => {
  const source = String(fontSpec || "").trim();
  const match = /(?:\d+(?:\.\d+)?)px\s+(.+)/.exec(source);
  if (!match) {
    return "Arial";
  }
  const family = String(match[1] || "").trim();
  return family || "Arial";
};

const parseBaseFontSize = (fontSpec: string | null | undefined) => {
  const source = String(fontSpec || "").trim();
  const match = /(\d+(?:\.\d+)?)px/.exec(source);
  if (!match) {
    return 16;
  }
  const size = Number.parseFloat(match[1]);
  if (!Number.isFinite(size) || size <= 0) {
    return 16;
  }
  return Math.round(size);
};

const normalizeFontName = (value: string) =>
  String(value || "")
    .replace(/^["']+|["']+$/g, "")
    .trim()
    .toLowerCase();

const collectRuntimeFontFamilies = () => {
  if (typeof document === "undefined" || !("fonts" in document)) {
    return [] as string[];
  }
  try {
    const set = new Set<string>();
    const fontSet = (document as Document & { fonts: Iterable<{ family?: string }> }).fonts;
    for (const fontFace of fontSet) {
      const family = String(fontFace?.family || "")
        .replace(/^["']+|["']+$/g, "")
        .trim();
      if (family) {
        set.add(family);
      }
    }
    return Array.from(set);
  } catch (_error) {
    return [] as string[];
  }
};

const getCurrentTextStyleAttrs = () => {
  const view = getView();
  const state = view?.state;
  if (!state?.selection?.$from || !state?.schema?.marks?.textStyle) {
    return null;
  }
  const textStyleType = state.schema.marks.textStyle;
  const marks = state.selection.empty
    ? state.storedMarks || state.selection.$from.marks()
    : state.doc.resolve(state.selection.from).marks();
  const mark = (marks || []).find((item: any) => item?.type === textStyleType);
  return mark?.attrs || null;
};

const capturePendingInlineStyleSelection = () => {
  const view = getView();
  const selection = view?.state?.selection;
  if (!selection || selection.empty) {
    pendingInlineStyleSelection.value = null;
    return;
  }
  pendingInlineStyleSelection.value = {
    from: Number(selection.from),
    to: Number(selection.to),
  };
};

const restorePendingInlineStyleSelection = () => {
  const snapshot = pendingInlineStyleSelection.value;
  const view = getView();
  const state = view?.state;
  if (!snapshot || !state?.doc || !state?.selection) {
    return false;
  }
  if (!state.selection.empty) {
    return true;
  }
  const maxPos = Number(state.doc.content?.size) || 0;
  const from = Math.max(0, Math.min(Math.round(snapshot.from), maxPos));
  const to = Math.max(0, Math.min(Math.round(snapshot.to), maxPos));
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) {
    return false;
  }
  try {
    const selection = TextSelection.create(state.doc, from, to);
    view.dispatch(state.tr.setSelection(selection));
    return true;
  } catch (_error) {
    return false;
  }
};

const syncInlineFontControls = () => {
  const view = getView();
  const settingsFont = view?._internals?.settings?.font;
  const styleAttrs = getCurrentTextStyleAttrs();
  const family =
    String(styleAttrs?.fontFamily || "").trim() || parseBaseFontFamily(String(settingsFont || ""));
  const size = Number(styleAttrs?.fontSize);
  const resolvedSize = Number.isFinite(size) && size > 0 ? Math.round(size) : parseBaseFontSize(settingsFont);
  fontFamilyValue.value = family;
  fontSizeValue.value = String(resolvedSize);
};

const fontFamilyOptions = computed<ToolbarInputDialogOption[]>(() => {
  const clearLabel =
    localeKey.value === "en-US" ? "Clear font family" : "\u6e05\u9664\u5b57\u4f53";
  const values = new Map<string, string>();
  const append = (family: string) => {
    const value = String(family || "").trim();
    if (!value) {
      return;
    }
    const key = normalizeFontName(value);
    if (!key || values.has(key)) {
      return;
    }
    values.set(key, value);
  };
  append(fontFamilyValue.value);
  for (const family of TOOLBAR_FONT_FAMILY_PRESETS) {
    append(family);
  }
  for (const family of collectRuntimeFontFamilies()) {
    append(family);
  }
  return [
    { label: clearLabel, value: "" },
    ...Array.from(values.values()).map((family) => ({ label: family, value: family })),
  ];
});

const fontSizeOptions = computed<ToolbarInputDialogOption[]>(() => {
  const clearLabel =
    localeKey.value === "en-US" ? "Clear font size" : "\u6e05\u9664\u5b57\u53f7";
  const current = Number(fontSizeValue.value);
  const set = new Set<number>([
    ...TOOLBAR_FONT_SIZE_PRESETS,
    Number.isFinite(current) && current > 0 ? Math.round(current) : 16,
  ]);
  return [
    { label: clearLabel, value: "" },
    ...Array.from(set)
      .sort((a, b) => a - b)
      .map((size) => ({ label: `${size}px`, value: String(size) })),
  ];
});

const fontFamilyMenuOptions = computed(() =>
  mapToolbarDropdownOptions(fontFamilyOptions.value, fontFamilyValue.value)
);
const fontSizeMenuOptions = computed(() =>
  mapToolbarDropdownOptions(fontSizeOptions.value, fontSizeValue.value)
);
const fontFamilyDisplayLabel = computed(() => {
  const value = String(fontFamilyValue.value || "").trim();
  return value || (localeKey.value === "en-US" ? "Font Family" : "\u5b57\u4f53");
});
const fontSizeDisplayLabel = computed(() => {
  const value = String(fontSizeValue.value || "").trim();
  return value ? `${value}px` : localeKey.value === "en-US" ? "Font Size" : "\u5b57\u53f7";
});

const handleInlineFontFamilyChange = (value: unknown) => {
  const next = String(value ?? "").trim();
  fontFamilyValue.value = next;
  if (isViewerSession.value) {
    pendingInlineStyleSelection.value = null;
    return;
  }
  restorePendingInlineStyleSelection();
  const ok = !next ? run("clearTextFontFamily") : run("setTextFontFamily", next);
  pendingInlineStyleSelection.value = null;
  if (!ok) {
    showToolbarMessage(
      localeKey.value === "en-US"
        ? "Unable to apply font family"
        : "\u65e0\u6cd5\u5e94\u7528\u5b57\u4f53",
      "error"
    );
  }
  syncInlineFontControls();
};

const handleInlineFontSizeChange = (value: unknown) => {
  const next = String(value ?? "").trim();
  fontSizeValue.value = next;
  if (isViewerSession.value) {
    pendingInlineStyleSelection.value = null;
    return;
  }
  restorePendingInlineStyleSelection();
  if (!next) {
    const ok = run("clearTextFontSize");
    pendingInlineStyleSelection.value = null;
    if (!ok) {
      showToolbarMessage(
        localeKey.value === "en-US"
          ? "Unable to apply font size"
          : "\u65e0\u6cd5\u5e94\u7528\u5b57\u53f7",
        "error"
      );
    }
    syncInlineFontControls();
    return;
  }
  const size = Number(next);
  if (!Number.isFinite(size) || size <= 0) {
    showToolbarMessage(
      localeKey.value === "en-US" ? "Invalid font size" : "\u5b57\u53f7\u65e0\u6548",
      "warning"
    );
    syncInlineFontControls();
    return;
  }
  const ok = run("setTextFontSize", Math.round(size));
  pendingInlineStyleSelection.value = null;
  if (!ok) {
    showToolbarMessage(
      localeKey.value === "en-US"
        ? "Unable to apply font size"
        : "\u65e0\u6cd5\u5e94\u7528\u5b57\u53f7",
      "error"
    );
  }
  syncInlineFontControls();
};

const inputDialogTexts = computed(() =>
  localeKey.value === "en-US"
    ? {
        confirm: "Apply",
        cancel: "Cancel",
        required: "Please complete required fields",
      }
    : {
        confirm: "\u786e\u5b9a",
        cancel: "\u53d6\u6d88",
        required: "\u8bf7\u5b8c\u6210\u5fc5\u586b\u9879",
      }
);
const inputDialogVisible = ref(false);
const inputDialogTitle = ref("");
const inputDialogDescription = ref("");
const inputDialogFields = ref<ToolbarInputDialogField[]>([]);
const inputDialogValues = ref<Record<string, string>>({});
const inputDialogError = ref("");
const inputDialogConfirmText = ref("");
const inputDialogCancelText = ref("");
const inputDialogWidth = ref<number | string>(480);
let inputDialogResolver: ((result: ToolbarInputDialogResult | null) => void) | null = null;

const closeInputDialog = (result: ToolbarInputDialogResult | null) => {
  if (inputDialogResolver) {
    inputDialogResolver(result);
    inputDialogResolver = null;
  }
  inputDialogVisible.value = false;
  inputDialogTitle.value = "";
  inputDialogDescription.value = "";
  inputDialogFields.value = [];
  inputDialogValues.value = {};
  inputDialogError.value = "";
  inputDialogConfirmText.value = "";
  inputDialogCancelText.value = "";
  inputDialogWidth.value = 480;
};

const requestInputDialog: RequestToolbarInputDialog = (request) => {
  if (inputDialogResolver) {
    inputDialogResolver(null);
    inputDialogResolver = null;
  }
  inputDialogTitle.value = String(request.title || "").trim();
  inputDialogDescription.value = String(request.description || "").trim();
  inputDialogFields.value = (request.fields || []).map((field) => ({
    key: field.key,
    label: field.label,
    type: field.type || "text",
    defaultValue: field.defaultValue || "",
    placeholder: field.placeholder || "",
    required: field.required === true,
    options: Array.isArray(field.options)
      ? field.options.map((option) => ({
          label: String(option.label || ""),
          value: String(option.value || ""),
        }))
      : undefined,
  }));
  inputDialogValues.value = inputDialogFields.value.reduce<Record<string, string>>((acc, field) => {
    acc[field.key] = String(field.defaultValue || "");
    return acc;
  }, {});
  inputDialogError.value = "";
  inputDialogConfirmText.value = String(request.confirmText || "");
  inputDialogCancelText.value = String(request.cancelText || "");
  inputDialogWidth.value = request.width || 480;
  inputDialogVisible.value = true;
  return new Promise<ToolbarInputDialogResult | null>((resolve) => {
    inputDialogResolver = resolve;
  });
};

const setInputDialogFieldValue = (key: string, value: unknown) => {
  const normalized = String(value ?? "");
  inputDialogValues.value = {
    ...inputDialogValues.value,
    [key]: normalized,
  };
  if (inputDialogError.value) {
    inputDialogError.value = "";
  }
};

const resolveInputDialogFieldOptions = (field: ToolbarInputDialogField): ToolbarInputDialogOption[] =>
  Array.isArray(field.options) ? field.options : [];

const handleInputDialogConfirm = () => {
  for (const field of inputDialogFields.value) {
    if (field.required && !String(inputDialogValues.value[field.key] || "").trim()) {
      inputDialogError.value = inputDialogTexts.value.required;
      return;
    }
  }
  closeInputDialog({ ...inputDialogValues.value });
};

const handleInputDialogCancel = () => {
  closeInputDialog(null);
};

const handleInputDialogVisibleChange = (visible: boolean) => {
  if (!visible) {
    const defer =
      typeof queueMicrotask === "function"
        ? queueMicrotask
        : (callback: () => void) => Promise.resolve().then(callback);
    defer(() => {
      if (!inputDialogVisible.value) {
        return;
      }
      if (inputDialogResolver) {
        handleInputDialogCancel();
      }
    });
  }
};

const signatureDialogVisible = ref(false);
const signatureDialogDefaultSigner = ref("");
let signatureDialogResolver: ((result: SignatureDialogResult | null) => void) | null = null;

const requestSignatureDialog: RequestToolbarSignatureDialog = (request) => {
  if (signatureDialogResolver) {
    signatureDialogResolver(null);
    signatureDialogResolver = null;
  }
  signatureDialogDefaultSigner.value = request?.defaultSigner || "";
  signatureDialogVisible.value = true;
  return new Promise((resolve) => {
    signatureDialogResolver = resolve;
  });
};

const handleSignatureDialogConfirm = (result: SignatureDialogResult) => {
  if (!signatureDialogResolver) {
    return;
  }
  signatureDialogResolver(result);
  signatureDialogResolver = null;
  signatureDialogVisible.value = false;
};

const handleSignatureDialogCancel = () => {
  if (signatureDialogResolver) {
    signatureDialogResolver(null);
    signatureDialogResolver = null;
  }
  signatureDialogVisible.value = false;
};

const layoutActions = createLayoutActions({
  getView,
  run,
  getLocaleKey: () => localeKey.value,
  requestInputDialog,
});

const tableActions = createTableActions({
  getView,
  getLocaleKey: () => localeKey.value,
  requestInputDialog,
});

const mapToolbarDropdownOptions = (
  options: ToolbarInputDialogOption[],
  currentValue: string
) =>
  options.map((option) => ({
    content: option.label,
    value: option.value,
    active: option.value === currentValue,
  }));

const resolveDropdownSelectionValue = (
  payload: { value?: string | number } | string | number
) => {
  const next =
    payload && typeof payload === "object" && "value" in payload ? payload.value : payload;
  return String(next ?? "").trim();
};

const handleInlineDropdownTriggerMouseDown = (event: MouseEvent) => {
  capturePendingInlineStyleSelection();
  event.preventDefault();
};

const pageSizeValue = ref("");
const resolveCurrentPageSizeValue = () => {
  const current = layoutActions.getCurrentPageSizeInfo?.();
  if (!current) {
    return "";
  }
  return current.preset?.value || `custom:${current.width}x${current.height}`;
};
const syncPageSizeControl = () => {
  pageSizeValue.value = resolveCurrentPageSizeValue();
};
const pageSizeOptions = computed<ToolbarInputDialogOption[]>(() => {
  const currentValue = pageSizeValue.value;
  const current = layoutActions.getCurrentPageSizeInfo?.();
  const options = PAGE_SIZE_PRESETS.map((preset) => ({
    label: preset.label[localeKey.value],
    value: preset.value,
  }));
  if (!current?.preset) {
    const customValue = currentValue || resolveCurrentPageSizeValue();
    if (customValue) {
      options.unshift({
        label:
          localeKey.value === "en-US"
            ? `Custom (${current?.width || 0} x ${current?.height || 0})`
            : `自定义 (${current?.width || 0} x ${current?.height || 0})`,
        value: customValue,
      });
    }
  }
  return options;
});
const pageSizeMenuOptions = computed(() =>
  mapToolbarDropdownOptions(pageSizeOptions.value, pageSizeValue.value)
);
const handlePageSizeChange = (value: unknown) => {
  const next = String(value ?? "").trim();
  if (isViewerSession.value || !next || next.startsWith("custom:")) {
    syncPageSizeControl();
    return;
  }
  const ok = layoutActions.applyPageSizePreset?.(next);
  if (!ok) {
    showToolbarMessage(
      localeKey.value === "en-US" ? "Unable to set page size" : "无法设置纸张大小",
      "error"
    );
  }
  syncPageSizeControl();
};
const handlePageSizeDropdownClick = (payload: { value?: string | number } | string | number) => {
  handlePageSizeChange(resolveDropdownSelectionValue(payload));
};
const handleFontFamilyDropdownClick = (payload: { value?: string | number } | string | number) => {
  handleInlineFontFamilyChange(resolveDropdownSelectionValue(payload));
};
const handleFontSizeDropdownClick = (payload: { value?: string | number } | string | number) => {
  handleInlineFontSizeChange(resolveDropdownSelectionValue(payload));
};

const TABLE_INSERT_GRID_ROW_COUNT = 8;
const TABLE_INSERT_GRID_COL_COUNT = 10;
const tableInsertGridRows = Array.from({ length: TABLE_INSERT_GRID_ROW_COUNT }, (_, index) => index + 1);
const tableInsertGridCols = Array.from({ length: TABLE_INSERT_GRID_COL_COUNT }, (_, index) => index + 1);
const tableInsertPickerOpen = ref(false);
const tableInsertHoverSize = ref<{ rows: number; cols: number } | null>(null);
const tableInsertLastSize = ref({ rows: 3, cols: 3 });
const closeTableInsertPicker = () => {
  tableInsertPickerOpen.value = false;
  tableInsertHoverSize.value = null;
};
const handleTableInsertPopupVisibleChange = (visible: boolean) => {
  if (!visible) {
    closeTableInsertPicker();
    return;
  }
  tableInsertHoverSize.value = { ...tableInsertLastSize.value };
  tableInsertPickerOpen.value = true;
};
const handleTableInsertCellEnter = (rows: number, cols: number) => {
  tableInsertHoverSize.value = { rows, cols };
};
const handleTableInsertGridLeave = () => {
  tableInsertHoverSize.value = { ...tableInsertLastSize.value };
};
const isTableInsertCellActive = (rows: number, cols: number) => {
  const current = tableInsertHoverSize.value || tableInsertLastSize.value;
  return rows <= current.rows && cols <= current.cols;
};
const tableInsertPickerText = computed(() => {
  const current = tableInsertHoverSize.value || tableInsertLastSize.value;
  return localeKey.value === "en-US"
    ? `Insert ${current.rows} x ${current.cols} table`
    : `插入 ${current.rows} x ${current.cols} 表格`;
});
const handleTableInsertCellClick = (rows: number, cols: number) => {
  const ok = tableActions.insertTableWithSize?.(rows, cols);
  if (!ok) {
    return;
  }
  tableInsertLastSize.value = { rows, cols };
  closeTableInsertPicker();
};

const exportActions = createExportActions({
  getView,
  getLocaleKey: () => localeKey.value,
  requestInputDialog,
});
const markdownActions = createMarkdownActions({
  getView,
  getLocaleKey: () => localeKey.value,
  getMenuTexts: () => i18n.value.menu,
  downloadTextAsFile: exportActions.downloadTextAsFile,
  requestInputDialog,
});

const inlineMediaActions = createInlineMediaActions({
  getView,
  run,
  getToolbarTexts: () => i18n.value.toolbar,
  requestInputDialog,
});
const importActions = createImportActions({
  getView,
  getLocaleKey: () => localeKey.value,
});
const textFormatActions = createTextFormatActions({
  getView,
  getLocaleKey: () => localeKey.value,
});
const textStyleActions = createTextStyleActions({
  run,
  getView,
  getLocaleKey: () => localeKey.value,
  requestInputDialog,
});
const searchReplaceActions = createSearchReplaceActions({
  getView,
  getLocaleKey: () => localeKey.value,
  requestInputDialog,
});
const quickInsertActions = createQuickInsertActions({
  getView,
  getLocaleKey: () => localeKey.value,
  requestInputDialog,
});
const insertAdvancedActions = createInsertAdvancedActions({
  getView,
  run,
  getLocaleKey: () => localeKey.value,
  requestInputDialog,
});
const toolsActions = createToolsActions({
  getView,
  run,
  getLocaleKey: () => localeKey.value,
  requestInputDialog,
  requestSignatureDialog,
});

const colorDialogVisible = ref(false);
const colorDialogAction = ref<ToolbarColorAction | null>(null);
const colorDialogValue = ref<string>(getToolbarColorDefault("color"));
const colorDialogPendingValue = ref<string | null>(getToolbarColorDefault("color"));
const colorActionLastValues: Record<ToolbarColorAction, string> = {
  color: getToolbarColorDefault("color"),
  "background-color": getToolbarColorDefault("background-color"),
  highlight: getToolbarColorDefault("highlight"),
  "page-background": getToolbarColorDefault("page-background"),
  "cells-background": getToolbarColorDefault("cells-background"),
};
const colorDialogTexts = computed(() =>
  localeKey.value === "en-US"
    ? {
        clear: "Clear",
        cleared: "Cleared. Apply to restore default style.",
      }
    : {
        clear: "\u6e05\u9664",
        cleared:
          "\u5df2\u6e05\u9664\uff0c\u70b9\u51fb\u786e\u5b9a\u540e\u6062\u590d\u9ed8\u8ba4\u6837\u5f0f\u3002",
      }
);
const colorDialogTitle = computed(() => {
  if (!colorDialogAction.value) {
    return "";
  }
  return getToolbarColorDialogTitle(colorDialogAction.value, localeKey.value);
});
const colorDialogValueText = computed(
  () => colorDialogPendingValue.value || colorDialogTexts.value.cleared
);

const openColorDialog = (action: ToolbarColorAction) => {
  colorDialogAction.value = action;
  const currentColor =
    action === "page-background"
      ? String(layoutActions.getPageBackgroundColor?.() || "").trim()
      : action === "cells-background"
        ? String(tableActions.getCurrentCellBackgroundColor?.() || "").trim()
        : "";
  const nextValue = currentColor || colorActionLastValues[action] || getToolbarColorDefault(action);
  colorDialogValue.value = nextValue;
  colorDialogPendingValue.value = nextValue;
  colorDialogVisible.value = true;
};

const closeColorDialog = () => {
  colorDialogVisible.value = false;
  colorDialogAction.value = null;
};

const handleColorDialogVisibleChange = (visible: boolean) => {
  if (!visible) {
    closeColorDialog();
  }
};

const handleColorPickerChange = (value: string) => {
  const next = String(value || "").trim();
  if (!next) {
    return;
  }
  colorDialogValue.value = next;
  colorDialogPendingValue.value = next;
};

const handleColorPickerClear = () => {
  colorDialogPendingValue.value = null;
};

const handleColorDialogCancel = () => {
  closeColorDialog();
};

const handleColorDialogConfirm = () => {
  const action = colorDialogAction.value;
  if (!action) {
    closeColorDialog();
    return;
  }
  const ok = applyToolbarColorAction({
    action,
    color: colorDialogPendingValue.value,
    run,
    setPageBackgroundColor: layoutActions.setPageBackgroundColor,
    setTableCellBackgroundColor: tableActions.setCurrentCellBackgroundColor,
  });
  if (!ok) {
    if (action === "cells-background") {
      showToolbarMessage(i18n.value.toolbar.alertTableCellRequired, "warning");
    }
    return;
  }
  if (colorDialogPendingValue.value) {
    colorActionLastValues[action] = colorDialogPendingValue.value;
    pushToolbarRecentColor(colorDialogPendingValue.value);
  }
  closeColorDialog();
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

const headingInlineActions = createHeadingInlineActions({
  getView,
  run,
  canRun,
  resolveOptionLabel: resolveHeadingOptionLabel,
});
const {
  headingInlineMoreButtonRef,
  headingInlineMoreOpen,
  headingInlineMorePanelStyle,
  headingInlineVisibleOptions,
  headingInlinePanelOptions,
  hasHeadingInlineOverflow,
  headingInlineOptionLabel,
  headingInlineOptionTypographyClass,
  isHeadingInlineOptionActive,
  applyHeadingInlineOption,
  toggleHeadingInlineMore,
  updateHeadingInlineMorePanelPosition,
  syncHeadingValueFromSelection,
  closeHeadingInlineMore,
} = headingInlineActions;

const isFontFamilyItem = (item: ToolbarItemConfig) => item.action === "font-family";
const isFontSizeItem = (item: ToolbarItemConfig) => item.action === "font-size";
const isPageSizeItem = (item: ToolbarItemConfig) => item.action === "page-size";
const isTableInsertItem = (item: ToolbarItemConfig) => item.action === "table-insert";
const itemLabel = (item: ToolbarItemConfig) => item.label[localeKey.value] || "";
const shouldShowItemIcon = (item: ToolbarItemConfig) =>
  Boolean(item.icon) && !isHeadingInlineBoxItem(item);
const setSessionMode = (value: EditorSessionMode) => {
  emit("update:sessionMode", value);
};
const toggleSessionMode = () => {
  setSessionMode(toggleEditorSessionMode(resolvedSessionMode.value));
};
const handleHeadingInlineOptionClick = (value: string | number) => {
  if (isViewerSession.value) {
    return false;
  }
  return applyHeadingInlineOption(value);
};
const handleToggleHeadingInlineMore = () => {
  if (isViewerSession.value) {
    return;
  }
  toggleHeadingInlineMore();
};

const isItemDisabled = (item: ToolbarItemConfig) => {
  if (isHeadingInlineBoxItem(item)) {
    return isViewerSession.value;
  }
  if (!canUseToolbarActionInSession(resolvedSessionMode.value, item.action)) {
    return true;
  }
  if (item.command) {
    return !canRun(item.command);
  }
  return false;
};

const toolbarActionHandlers = createToolbarActionHandlers({
  run,
  runWithNotice,
  getToolbarTexts: () => i18n.value.toolbar,
  toggleTocPanel: () => emit("toggle-toc"),
  getSessionMode: () => resolvedSessionMode.value,
  setSessionMode,
  toggleSessionMode,
  layoutActions,
  tableActions,
  exportActions,
  markdownActions,
  inlineMediaActions,
  textFormatActions,
  textStyleActions,
  searchReplaceActions,
  importActions,
  quickInsertActions,
  insertAdvancedActions,
  toolsActions,
});

const handleItemAction = (item: ToolbarItemConfig) => {
  if (isItemDisabled(item)) {
    return;
  }
  if (isHeadingInlineBoxItem(item)) {
    return;
  }
  if (isFontFamilyItem(item) || isFontSizeItem(item) || isPageSizeItem(item) || isTableInsertItem(item)) {
    return;
  }
  if (!item.implemented) {
    MessagePlugin.warning(
      localeKey.value === "en-US" ? "In development" : "\u5f00\u53d1\u4e2d"
    );
    return;
  }
  if (isToolbarColorAction(item.action)) {
    closeTableInsertPicker();
    openColorDialog(item.action);
    return;
  }
  closeTableInsertPicker();
  toolbarActionHandlers.handleItemAction(item);
  if (item.action === "page-orientation") {
    syncPageSizeControl();
  }
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
  const targetElement = getTargetElement(event.target);
  if (headingInlineMoreOpen.value) {
    if (!targetElement) {
      closeHeadingInlineMore();
    } else if (
      !targetElement.closest(".heading-inline-box") &&
      !targetElement.closest(".heading-inline-more-panel")
    ) {
      closeHeadingInlineMore();
    }
  }
  if (tableInsertPickerOpen.value) {
    if (!targetElement) {
      closeTableInsertPicker();
    } else if (
      !targetElement.closest(".toolbar-table-picker-trigger") &&
      !targetElement.closest(".table-insert-picker")
    ) {
      closeTableInsertPicker();
    }
  }
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
    syncInlineFontControls();
    syncPageSizeControl();
  },
  { immediate: true }
);

watch(
  () => props.editorView?.state?.selection?.head,
  () => {
    syncHeadingValueFromSelection();
    syncInlineFontControls();
  }
);

watch(
  () => [resolvedActiveMenu.value, localeKey.value, renderGroups.value.length],
  () => {
    closeHeadingInlineMore();
    closeTableInsertPicker();
    closeColorDialog();
    handleInputDialogCancel();
    syncPageSizeControl();
    void nextTick(updateToolbarOverflowState);
  }
);

watch(
  () => resolvedSessionMode.value,
  () => {
    closeHeadingInlineMore();
    closeTableInsertPicker();
    closeColorDialog();
    handleInputDialogCancel();
    syncInlineFontControls();
    syncPageSizeControl();
  }
);

onMounted(() => {
  window.addEventListener("resize", handleWindowResize, { passive: true });
  document.addEventListener("pointerdown", handleDocumentPointerDown, { passive: true });
  void nextTick(() => {
    updateToolbarOverflowState();
    syncInlineFontControls();
    syncPageSizeControl();
  });
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleWindowResize);
  document.removeEventListener("pointerdown", handleDocumentPointerDown);
  closeTableInsertPicker();
  handleInputDialogCancel();
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
  if (
    target.closest(".toolbar-inline-dropdown-trigger") ||
    target.closest(".t-select") ||
    target.closest(".t-input")
  ) {
    capturePendingInlineStyleSelection();
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
      ".toolbar-left .t-button, .toolbar-left .toolbar-inline-dropdown-trigger, .toolbar-left .toolbar-page-size-trigger, .toolbar-left .toolbar-table-picker-trigger, .toolbar-left .heading-inline-option, .toolbar-left .heading-inline-more-btn, .toolbar-left .heading-inline-more-item"
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
    ".t-button, .toolbar-inline-dropdown-trigger, .toolbar-page-size-trigger, .toolbar-table-picker-trigger, .heading-inline-option, .heading-inline-more-btn, .heading-inline-more-item"
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

.toolbar-inline-control {
  display: flex;
  align-items: center;
  min-width: 0;
}

.toolbar-inline-dropdown-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  height: 28px;
  padding: 0 8px;
  border: 0;
  background: transparent;
  color: #202124;
  cursor: pointer;
}

.toolbar-inline-dropdown-trigger--font {
  width: 154px;
}

.toolbar-inline-dropdown-trigger--size {
  width: 92px;
}

.toolbar-inline-dropdown-trigger:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.toolbar-inline-dropdown-trigger-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 16px;
  text-align: left;
}

.toolbar-inline-dropdown-trigger-arrow {
  flex: 0 0 auto;
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid #5f6368;
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

.toolbar-check-dropdown :deep(.t-dropdown__item) {
  position: relative;
  padding-right: 28px;
}

.toolbar-check-dropdown :deep(.t-dropdown__item--active) {
  color: #1a73e8;
}

.toolbar-page-size-dropdown :deep(.t-dropdown__item--active::after) {
  content: "√";
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
  color: #1a73e8;
  font-size: 12px;
  line-height: 1;
}

.table-insert-picker {
  position: fixed;
  z-index: 3000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 302px;
  padding: 10px;
}

.table-insert-picker-title {
  font-size: 12px;
  line-height: 16px;
  color: #5f6368;
}

.table-insert-picker-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.table-insert-picker-row {
  display: flex;
  gap: 4px;
}

.table-insert-picker-cell {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid #d2d7df;
  border-radius: 3px;
  background: #ffffff;
  cursor: pointer;
}

.table-insert-picker-cell:hover,
.table-insert-picker-cell--active {
  border-color: #7aa9ff;
  background: #e8f0fe;
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

.toolbar-color-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar-color-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.toolbar-color-dialog-value {
  font-size: 12px;
  color: #5f6368;
  word-break: break-all;
}

.toolbar-input-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar-input-dialog-description {
  margin: 0;
  font-size: 12px;
  color: #5f6368;
}

.toolbar-input-dialog-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.toolbar-input-dialog-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.toolbar-input-dialog-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #334155;
}

.toolbar-input-dialog-required {
  color: #dc2626;
}

.toolbar-input-dialog-error {
  margin: 0;
  font-size: 12px;
  color: #dc2626;
}
</style>


