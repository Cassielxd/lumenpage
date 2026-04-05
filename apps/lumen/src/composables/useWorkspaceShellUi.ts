import { computed, ref, type ComputedRef, type Ref } from "vue";
import { TextSelection } from "lumenpage-state";
import type { CanvasEditorView } from "lumenpage-view-canvas";
import {
  PLAYGROUND_LOCALE_OPTIONS,
  coercePlaygroundLocale,
  setPlaygroundLocale,
  type PlaygroundI18n,
  type PlaygroundLocale,
} from "../editor/i18n";
import {
  findHeadingPosById,
  type TocOutlineItem,
  type TocOutlineSnapshot,
} from "../editor/tocOutlinePlugin";

type WorkspaceFooterStats = {
  pageCount: number;
  currentPage: number;
  nodeCount: number;
  pluginCount: number;
  wordCount: number;
  selectedWordCount: number;
  blockType: string;
};

type UseWorkspaceShellUiOptions = {
  localeKey: ComputedRef<PlaygroundLocale>;
  globalLocale: Ref<string>;
  i18n: ComputedRef<PlaygroundI18n>;
  translate: (key: string, params?: Record<string, unknown>) => string;
  getView: () => CanvasEditorView | null;
  commentCount: Readonly<Ref<number>>;
  trackChangeCount: Readonly<Ref<number>>;
  trackChangesEnabled: Readonly<Ref<boolean>>;
  trackChangesCountLabel: (count: number) => string;
};

const createInitialFooterStats = (): WorkspaceFooterStats => ({
  pageCount: 0,
  currentPage: 0,
  nodeCount: 0,
  pluginCount: 0,
  wordCount: 0,
  selectedWordCount: 0,
  blockType: "",
});

const normalizeFooterStats = (
  stats: Partial<WorkspaceFooterStats> | null | undefined,
): WorkspaceFooterStats => ({
  pageCount: Math.max(0, Number(stats?.pageCount) || 0),
  currentPage: Math.max(0, Number(stats?.currentPage) || 0),
  nodeCount: Math.max(0, Number(stats?.nodeCount) || 0),
  pluginCount: Math.max(0, Number(stats?.pluginCount) || 0),
  wordCount: Math.max(0, Number(stats?.wordCount) || 0),
  selectedWordCount: Math.max(0, Number(stats?.selectedWordCount) || 0),
  blockType: String(stats?.blockType || ""),
});

const resolveBlockTypeLabel = (value: string, i18n: PlaygroundI18n) => {
  if (value === "paragraph") return i18n.shell.blockTypeParagraph;
  if (value === "heading") return i18n.shell.blockTypeHeading;
  if (value === "blockquote") return i18n.shell.blockTypeBlockquote;
  if (value === "codeBlock") return i18n.shell.blockTypeCodeBlock;
  if (value === "bulletList") return i18n.shell.blockTypeBulletList;
  if (value === "orderedList") return i18n.shell.blockTypeOrderedList;
  if (value === "taskList") return i18n.shell.blockTypeTaskList;
  if (value === "table") return i18n.shell.blockTypeTable;
  return value || i18n.shell.blockTypeUnknown;
};

export const useWorkspaceShellUi = ({
  localeKey,
  globalLocale,
  i18n,
  translate,
  getView,
  commentCount,
  trackChangeCount,
  trackChangesEnabled,
  trackChangesCountLabel,
}: UseWorkspaceShellUiOptions) => {
  const footerStats = ref(createInitialFooterStats());
  const tocItems = ref<TocOutlineItem[]>([]);
  const activeTocId = ref<string | null>(null);

  const localeOptions = computed(() =>
    PLAYGROUND_LOCALE_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label[localeKey.value],
    })),
  );
  const outlineTitle = computed(() => i18n.value.shell.outline);
  const commentButtonLabel = computed(() =>
    commentCount.value > 0
      ? `${i18n.value.app.comment} (${commentCount.value})`
      : i18n.value.app.comment,
  );
  const assistantButtonLabel = computed(() => i18n.value.shell.assistant);
  const outlineEmptyLabel = computed(() => i18n.value.shell.outlineEmpty);
  const commentActionLabel = computed(() => i18n.value.shell.addComment);
  const trackChangesActionLabel = computed(() =>
    trackChangesEnabled.value
      ? i18n.value.shell.trackChangesDisable
      : i18n.value.shell.trackChangesEnable,
  );
  const trackChangesStatusLabel = computed(() =>
    trackChangesEnabled.value
      ? i18n.value.shell.trackChangesEnabled
      : i18n.value.shell.trackChangesDisabled,
  );
  const outlineTabLabel = computed(() => i18n.value.shell.outline);
  const collaborationButtonLabel = computed(() => i18n.value.collaborationPanel.title);
  const annotationActionLabel = computed(() => i18n.value.annotationPanel.title);
  const documentStatusLoadingLabel = computed(() => i18n.value.documentCenter.loading);
  const documentStatusLoadingCopy = computed(() => i18n.value.documentCenter.description);
  const documentStatusErrorLabel = computed(() => i18n.value.shareLanding.loadFailed);
  const trackChangesButtonLabel = computed(() =>
    trackChangesCountLabel(trackChangeCount.value),
  );
  const footerPageLabel = computed(() =>
    translate("shell.totalPages", { count: footerStats.value.pageCount }),
  );
  const footerCurrentPageLabel = computed(() =>
    translate("shell.currentPage", { count: footerStats.value.currentPage || 0 }),
  );
  const footerWordLabel = computed(() =>
    translate("shell.words", { count: footerStats.value.wordCount }),
  );
  const footerSelectionWordLabel = computed(() =>
    translate("shell.selectedWords", { count: footerStats.value.selectedWordCount }),
  );
  const footerBlockTypeLabel = computed(() =>
    translate("shell.block", {
      type: resolveBlockTypeLabel(footerStats.value.blockType, i18n.value),
    }),
  );
  const footerStatItems = computed(() => {
    const items = [footerCurrentPageLabel.value, footerPageLabel.value, footerWordLabel.value];
    if (footerStats.value.selectedWordCount > 0) {
      items.push(footerSelectionWordLabel.value);
    }
    if (footerStats.value.blockType) {
      items.push(footerBlockTypeLabel.value);
    }
    return items;
  });
  const handleLocaleChange = (value: string | number) => {
    const nextLocale = coercePlaygroundLocale(value);
    if (nextLocale === localeKey.value) {
      return;
    }
    globalLocale.value = nextLocale;
    setPlaygroundLocale(nextLocale);
  };

  const handleTocOutlineChange = (snapshot: TocOutlineSnapshot) => {
    tocItems.value = Array.isArray(snapshot?.items) ? snapshot.items : [];
    activeTocId.value = snapshot?.activeId || null;
  };

  const handleStatsChange = (stats: WorkspaceFooterStats) => {
    footerStats.value = normalizeFooterStats(stats);
  };

  const handleTocItemClick = (item: TocOutlineItem) => {
    const currentView = getView();
    if (!currentView?.state?.doc || !currentView?.state?.tr || !item?.id) {
      return;
    }
    const pos = findHeadingPosById(currentView.state.doc, item.id);
    if (!Number.isFinite(pos)) {
      return;
    }
    try {
      const tr = currentView.state.tr.setSelection(
        TextSelection.create(currentView.state.doc, Number(pos)),
      );
      currentView.dispatch(tr.scrollIntoView());
      // Keep current focus state to avoid caret jumping to document tail after TOC jump.
    } catch (_error) {
      // noop
    }
  };

  const resetWorkspaceShellUiState = () => {
    footerStats.value = createInitialFooterStats();
    tocItems.value = [];
    activeTocId.value = null;
  };

  return {
    localeOptions,
    tocItems,
    activeTocId,
    outlineTitle,
    commentButtonLabel,
    assistantButtonLabel,
    outlineEmptyLabel,
    commentActionLabel,
    trackChangesActionLabel,
    trackChangesStatusLabel,
    outlineTabLabel,
    collaborationButtonLabel,
    annotationActionLabel,
    documentStatusLoadingLabel,
    documentStatusLoadingCopy,
    documentStatusErrorLabel,
    trackChangesButtonLabel,
    footerStatItems,
    handleLocaleChange,
    handleTocOutlineChange,
    handleStatsChange,
    handleTocItemClick,
    resetWorkspaceShellUiState,
  };
};
