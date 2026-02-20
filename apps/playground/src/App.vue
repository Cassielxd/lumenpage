<template>
  <t-layout class="app-shell">
    <t-header class="topbar">
      <div class="topbar-left">
        <div class="logo">LP</div>
        <div class="brand">腾讯文档</div>
        <t-input v-model="docTitle" class="title-input" size="small" />
        <t-tag size="small" theme="success" variant="light">已保存</t-tag>
      </div>
      <div class="topbar-right">
        <t-button size="small" theme="primary">分享</t-button>
        <t-button size="small" variant="outline">评论</t-button>
        <t-avatar size="small">U</t-avatar>
      </div>
    </t-header>

    <EditorToolbar ref="toolbarRef" :editorView="view" />

  <t-content class="editor-area">
    <div ref="editorHost" class="editor-host"></div>
    <div
      v-if="debugTablePagination"
      ref="tableDebugPanel"
      class="table-debug-panel"
    ></div>
  </t-content>
  </t-layout>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, type Ref } from "vue";
import {
  basicCommands,
  createCanvasEditorKeymap,
  createDefaultNodeRendererRegistry,
  createDocFromText,
  createViewCommands,
  runCommand,
  schema,
  setBlockAlign,
} from "lumenpage-kit-basic";
import { baseKeymap } from "lumenpage-commands";
import { keymap } from "lumenpage-keymap";
import {
  CanvasEditorView,
  Decoration,
  DecorationSet,
  createBlockIdPlugin,
  createBlockIdTransaction,
  createCanvasConfigPlugin,
  createCanvasState,
  docPosToTextOffset,
  textOffsetToDocPos,
} from "lumenpage-view-canvas";
import { history } from "lumenpage-history";
import { inputRules, emDash, ellipsis, smartQuotes } from "lumenpage-inputrules";
import { gapCursor } from "lumenpage-gapcursor";
import { TextSelection } from "lumenpage-state";
import EditorToolbar from "./components/EditorToolbar.vue";
import { initialDocJson } from "./initialDoc";

const docTitle = ref("项目周报");
const editorHost = ref<HTMLElement | null>(null);
type ToolbarExpose = { statusEl: Ref<HTMLElement | null> };
const toolbarRef = ref<ToolbarExpose | null>(null);
const view = shallowRef<CanvasEditorView | null>(null);
const tableDebugPanel = ref<HTMLElement | null>(null);

const resolveDebugFlag = (key: string) => {
  if (typeof window === "undefined") {
    return false;
  }
  const params = new URLSearchParams(window.location.search);
  const value = params.get(key);
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
};

const debugTablePagination = resolveDebugFlag("debugTablePagination");
const debugTableSmoke = resolveDebugFlag("tableSmoke");
const debugListSmoke = resolveDebugFlag("listSmoke");
const debugDuplicateDecorations = resolveDebugFlag("dupDecor");

const settings = {
  pageWidth: 816,
  pageHeight: 720,
  pageGap: 24,
  margin: {
    top: 72,
    right: 72,
    bottom: 72,
    left: 72,
  },
  lineHeight: 26,
  blockSpacing: 8,
  paragraphSpacingBefore: 0,
  paragraphSpacingAfter: 8,
  font: "16px Arial",
  wrapTolerance: 2,
  pageBuffer: 1,
  maxPageCache: 16,
  debugPerf: resolveDebugFlag("debugPerf"),
  disablePageReuse: false,
};

const nodeRegistry = createDefaultNodeRendererRegistry();

const findFirstTableCellPos = (doc) => {
  let tableCellPos = null;
  doc.descendants((node, pos) => {
    if (node.type?.name === "table_cell") {
      tableCellPos = pos;
      return false;
    }
    return true;
  });
  return tableCellPos;
};

const findFirstTableCellCursorPos = (doc) => {
  let cursorPos = null;
  doc.descendants((node, pos) => {
    if (node.type?.name !== "table_cell") {
      return true;
    }
    if (node.childCount > 0 && node.child(0)?.isTextblock) {
      cursorPos = pos + 2;
    } else {
      cursorPos = pos + 1;
    }
    return false;
  });
  return cursorPos;
};

const findFirstTableCellParagraphEndPos = (doc) => {
  let cursorPos = null;
  doc.descendants((node, pos) => {
    if (node.type?.name !== "table_cell") {
      return true;
    }
    let childPos = pos + 1;
    for (let i = 0; i < node.childCount; i += 1) {
      const child = node.child(i);
      if (child?.isTextblock) {
        cursorPos = childPos + 1 + child.content.size;
        return false;
      }
      childPos += child.nodeSize;
    }
    cursorPos = pos + 1;
    return false;
  });
  return cursorPos;
};

const findAncestorNodeByType = ($pos, typeName: string) => {
  if (!$pos) {
    return null;
  }
  for (let depth = $pos.depth; depth >= 0; depth -= 1) {
    const node = $pos.node(depth);
    if (node?.type?.name === typeName) {
      return node;
    }
  }
  return null;
};

const verifyOffsetRoundtrip = (doc, pos) => {
  const offset = docPosToTextOffset(doc, pos);
  const mappedPos = textOffsetToDocPos(doc, offset);
  return {
    offset,
    mappedPos,
    ok: mappedPos === pos,
  };
};

const runTableNavigationSmoke = (editorView, debugPanelEl: HTMLElement | null) => {
  const commands = editorView?.commands;
  if (!commands) {
    return;
  }

  const cellPos = findFirstTableCellPos(editorView.state.doc);
  const cursorPos = findFirstTableCellCursorPos(editorView.state.doc);
  if (!Number.isFinite(cellPos) || !Number.isFinite(cursorPos)) {
    const message = "[table-smoke] skipped: no table_cell found.";
    console.warn(message);
    if (debugPanelEl) {
      debugPanelEl.textContent = message;
    }
    return;
  }

  let selection;
  try {
    selection = TextSelection.create(editorView.state.doc, cursorPos);
  } catch (_error) {
    selection = editorView.state.selection.constructor.near(
      editorView.state.doc.resolve(cursorPos),
      1
    );
  }
  editorView.dispatch(editorView.state.tr.setSelection(selection).scrollIntoView());

  // Normalize to the first reachable table cell to avoid unstable initial near() landing.
  const moveToBoundary = (direction: "prev" | "next") => {
    let steps = 0;
    while (
      steps < 100 &&
      (direction === "prev"
        ? commands.goToPreviousTableCell?.() === true
        : commands.goToNextTableCell?.() === true)
    ) {
      steps += 1;
    }
    return steps;
  };

  const runNavigationCycle = (label: string) => {
    const normalizeSteps = moveToBoundary("prev");
    const before = editorView.state.selection.head;
    const nextHandled = commands.goToNextTableCell?.() === true;
    const afterNext = editorView.state.selection.head;
    const prevHandled = commands.goToPreviousTableCell?.() === true;
    const afterPrev = editorView.state.selection.head;
    const prevAtFirstHandled = commands.goToPreviousTableCell?.() === true;
    const toLastSteps = moveToBoundary("next");
    const lastHead = editorView.state.selection.head;
    const nextAtLastHandled = commands.goToNextTableCell?.() === true;
    const inTableAfterNext = !!findAncestorNodeByType(editorView.state.selection.$from, "table");
    const ok =
      nextHandled &&
      prevHandled &&
      !prevAtFirstHandled &&
      !nextAtLastHandled &&
      inTableAfterNext;
    return {
      label,
      ok,
      before,
      nextHandled,
      afterNext,
      prevHandled,
      afterPrev,
      prevAtFirstHandled,
      toLastSteps,
      lastHead,
      nextAtLastHandled,
      normalizeSteps,
      inTableAfterNext,
    };
  };

  const baseline = runNavigationCycle("baseline");

  const rowAddHandled = commands.addTableRowAfter?.() === true;
  const afterRowAdd = runNavigationCycle("afterRowAdd");
  const rowDeleteHandled = commands.deleteTableRow?.() === true;
  const afterRowDelete = runNavigationCycle("afterRowDelete");

  const colAddHandled = commands.addTableColumnAfter?.() === true;
  const afterColAdd = runNavigationCycle("afterColAdd");
  const colDeleteHandled = commands.deleteTableColumn?.() === true;
  const afterColDelete = runNavigationCycle("afterColDelete");

  // Ensure merge/split starts from a non-edge cell (first cell).
  moveToBoundary("prev");
  const mergeHandled = commands.mergeTableCellRight?.() === true;
  const afterMerge = runNavigationCycle("afterMerge");
  moveToBoundary("prev");
  const splitHandled = commands.splitTableCell?.() === true;
  const afterSplit = runNavigationCycle("afterSplit");
  moveToBoundary("prev");
  const cellRangeSelectHandled = commands.selectTableCellsRight?.() === true;
  const cellRangeSelectionType = editorView.state.selection?.toJSON?.()?.type ?? null;
  const cellRangeFrom = editorView.state.selection?.from ?? null;
  const cellRangeTo = editorView.state.selection?.to ?? null;
  const mergeSelectedHandled = commands.mergeSelectedTableCells?.() === true;
  const selectionAfterMergeSelectedType = editorView.state.selection?.toJSON?.()?.type ?? null;
  const afterCellRange = runNavigationCycle("afterCellRange");
  moveToBoundary("prev");
  const normalizeForVerticalSplitHandled = commands.splitTableCell?.() === true;
  moveToBoundary("prev");
  const verticalRangeSelectHandled = commands.selectTableCellsDown?.() === true;
  const verticalRangeSelectionType = editorView.state.selection?.toJSON?.()?.type ?? null;
  const mergeVerticalHandled = commands.mergeSelectedTableCells?.() === true;
  const splitVerticalHandled = commands.splitTableCell?.() === true;
  const afterVerticalMergeSplit = runNavigationCycle("afterVerticalMergeSplit");
  const runEnterCaretSmoke = () => {
    const endPos = findFirstTableCellParagraphEndPos(editorView.state.doc);
    if (!Number.isFinite(endPos)) {
      return { ok: false, reason: "no-table-cell-paragraph" };
    }
    let selection;
    try {
      selection = TextSelection.create(editorView.state.doc, endPos);
    } catch (_error) {
      return { ok: false, reason: "invalid-start-selection", endPos };
    }
    editorView.dispatch(editorView.state.tr.setSelection(selection).scrollIntoView());

    const beforeHead = editorView.state.selection.head;
    const beforeRoundtrip = verifyOffsetRoundtrip(editorView.state.doc, beforeHead);
    const enterHandled = runCommand(
      basicCommands.enter,
      editorView.state,
      (tr) => editorView.dispatch(tr)
    );
    const afterHead = editorView.state.selection.head;
    const inTableAfter = !!findAncestorNodeByType(editorView.state.selection.$from, "table");
    const afterRoundtrip = verifyOffsetRoundtrip(editorView.state.doc, afterHead);

    const moved = Number.isFinite(afterHead) && afterHead !== beforeHead;
    const ok =
      enterHandled && inTableAfter && moved && beforeRoundtrip.ok && afterRoundtrip.ok;

    return {
      ok,
      beforeHead,
      afterHead,
      moved,
      enterHandled,
      inTableAfter,
      beforeRoundtrip,
      afterRoundtrip,
    };
  };
  const enterCaret = runEnterCaretSmoke();

  const summary = {
    baseline,
    rowAddHandled,
    afterRowAdd,
    rowDeleteHandled,
    afterRowDelete,
    colAddHandled,
    afterColAdd,
    colDeleteHandled,
    afterColDelete,
    mergeHandled,
    afterMerge,
    splitHandled,
    afterSplit,
    cellRangeSelectHandled,
    cellRangeSelectionType,
    cellRangeFrom,
    cellRangeTo,
    mergeSelectedHandled,
    selectionAfterMergeSelectedType,
    afterCellRange,
    normalizeForVerticalSplitHandled,
    verticalRangeSelectHandled,
    verticalRangeSelectionType,
    mergeVerticalHandled,
    splitVerticalHandled,
    afterVerticalMergeSplit,
    enterCaret,
  };

  const ok =
    baseline.ok &&
    rowAddHandled &&
    afterRowAdd.ok &&
    rowDeleteHandled &&
    afterRowDelete.ok &&
    colAddHandled &&
    afterColAdd.ok &&
    colDeleteHandled &&
    afterColDelete.ok &&
    mergeHandled &&
    afterMerge.ok &&
    splitHandled &&
    afterSplit.ok &&
    cellRangeSelectHandled &&
    cellRangeSelectionType === "table_cell" &&
    mergeSelectedHandled &&
    afterCellRange.ok &&
    verticalRangeSelectHandled &&
    verticalRangeSelectionType === "table_cell" &&
    mergeVerticalHandled &&
    splitVerticalHandled &&
    afterVerticalMergeSplit.ok &&
    enterCaret.ok;

  const text = `[table-smoke] ${ok ? "PASS" : "FAIL"} ${JSON.stringify(summary)}`;
  if (ok) {
    console.info(text);
  } else {
    console.error(text);
  }
  if (debugPanelEl) {
    debugPanelEl.textContent = text;
  }
};

const runOrderedListPaginationSmoke = (editorView, debugPanelEl: HTMLElement | null) => {
  const layout = (editorView as any)?._internals?.getLayout?.();
  if (!layout?.pages?.length) {
    const text = "[list-smoke] skipped: no layout pages.";
    console.warn(text);
    if (debugPanelEl) {
      debugPanelEl.textContent = `${debugPanelEl.textContent || ""}\n${text}`.trim();
    }
    return;
  }

  const issues: Array<{
    page: number;
    listStart: number | null;
    listBottom: number;
    nextStart: number | null;
    nextY: number;
  }> = [];

  for (let pageIndex = 0; pageIndex < layout.pages.length; pageIndex += 1) {
    const page = layout.pages[pageIndex];
    const lines = page?.lines || [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line?.blockType !== "ordered_list") {
        i += 1;
        continue;
      }
      const blockStart = Number.isFinite(line.blockStart) ? line.blockStart : null;
      let j = i;
      let blockBottom = Number.NEGATIVE_INFINITY;
      while (j < lines.length) {
        const current = lines[j];
        const sameBlock =
          current?.blockType === "ordered_list" &&
          ((Number.isFinite(current.blockStart) && current.blockStart === blockStart) ||
            (!Number.isFinite(current.blockStart) && blockStart === null));
        if (!sameBlock) {
          break;
        }
        const lineHeight = Number.isFinite(current.lineHeight)
          ? current.lineHeight
          : layout.lineHeight;
        blockBottom = Math.max(blockBottom, (current.y || 0) + lineHeight);
        j += 1;
      }

      if (j < lines.length) {
        const nextLine = lines[j];
        const nextY = Number.isFinite(nextLine?.y) ? nextLine.y : Number.POSITIVE_INFINITY;
        if (nextY + 0.5 < blockBottom) {
          issues.push({
            page: pageIndex + 1,
            listStart: blockStart,
            listBottom: blockBottom,
            nextStart: Number.isFinite(nextLine?.blockStart) ? nextLine.blockStart : null,
            nextY,
          });
        }
      }
      i = j;
    }
  }

  const ok = issues.length === 0;
  const text = `[list-smoke] ${ok ? "PASS" : "FAIL"} ${JSON.stringify({ issues })}`;
  if (ok) {
    console.info(text);
  } else {
    console.error(text);
  }
  if (debugPanelEl) {
    debugPanelEl.textContent = `${debugPanelEl.textContent || ""}\n${text}`.trim();
  }
};

onMounted(() => {
  if (!editorHost.value) {
    return;
  }
  const enableInputRules = resolveDebugFlag("inputRules");
  const enableGapCursor = resolveDebugFlag("gapCursor");
  const canvasConfig = {
    settings,
    nodeRegistry,
    layoutWorker: { enabled: false, modules: ["lumenpage-kit-basic"] },
    debug: { layout: true, selection: true, delete: true },
    commands: {
      basicCommands,
      runCommand,
      setBlockAlign,
      viewCommands: createViewCommands(),
    },
    statusElement: toolbarRef.value?.statusEl?.value || undefined,
    tablePaginationPanelEl: debugTablePagination ? tableDebugPanel.value || undefined : undefined,
  };
  const plugins = [
    history(),
    createBlockIdPlugin(),
    createCanvasConfigPlugin(canvasConfig),
    keymap(createCanvasEditorKeymap()),
    keymap(baseKeymap),
  ];
  if (enableInputRules) {
    const rules = [ellipsis, emDash, ...smartQuotes].filter(Boolean);
    plugins.push(inputRules({ rules }));
  }
  if (enableGapCursor) {
    plugins.push(gapCursor());
  }
  const editorState = createCanvasState({
    schema,
    createDocFromText,
    json: initialDocJson,
    plugins,
  });
  const initBlockIdTr = createBlockIdTransaction(editorState);
  const readyState = initBlockIdTr ? editorState.apply(initBlockIdTr) : editorState;
  const viewProps: Record<string, unknown> = { state: readyState };
  if (debugDuplicateDecorations) {
    viewProps.decorations = (state) => {
      const docSize = state?.doc?.content?.size ?? 0;
      const from = Math.min(2, Math.max(0, docSize));
      const to = Math.min(from + 8, docSize);
      if (to <= from) {
        return null;
      }
      return DecorationSet.create(state.doc, [
        Decoration.inline(from, to, { backgroundColor: "rgba(239, 68, 68, 0.28)" }),
      ]);
    };
  }
  view.value = new CanvasEditorView(editorHost.value, viewProps);
  if (debugTablePagination && tableDebugPanel.value) {
    tableDebugPanel.value.textContent = "Waiting for table pagination...";
  }
  if (debugTableSmoke) {
    runTableNavigationSmoke(view.value, tableDebugPanel.value);
  }
  if (debugListSmoke) {
    requestAnimationFrame(() => runOrderedListPaginationSmoke(view.value, tableDebugPanel.value));
  }
});

onBeforeUnmount(() => {
  view.value?.destroy();
  view.value = null;
});
</script>

<style scoped>
.app-shell {
  height: 100vh;
  width: 100%;
  background: #f5f6f8;
  color: #1f2329;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #ffffff;
  border-bottom: 1px solid #e5e6eb;
  padding: 0 20px;
  height: 52px;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand {
  font-weight: 600;
  font-size: 14px;
}

.logo {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: #3370ff;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.title-input {
  width: 200px;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.editor-area {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding: 0;
  background: #f5f6f8;
  overflow: hidden;
  position: relative;
}

.editor-host {
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  position: relative;
}

.editor-host .lumenpage-editor {
  position: relative;
  width: 100%;
  height: 100%;
  margin: 0 auto;
}

.editor-host .lumenpage-viewport {
  width: 100%;
  height: 100%;
}

.table-debug-panel {
  position: absolute;
  right: 24px;
  bottom: 24px;
  width: 320px;
  max-height: 45vh;
  padding: 12px 14px;
  background: rgba(15, 23, 42, 0.9);
  color: #e5e7eb;
  font-size: 12px;
  line-height: 1.4;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.35);
  overflow: auto;
  white-space: pre-wrap;
  pointer-events: auto;
  user-select: text;
  z-index: 10;
}
</style>
