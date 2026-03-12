import { docPosToTextOffset, textOffsetToDocPos } from "lumenpage-view-canvas";
import { NodeSelection, TextSelection } from "lumenpage-state";
import { CellSelection } from "lumenpage-extension-table";
import { DOMParser as PMDOMParser, DOMSerializer } from "lumenpage-model";
import { normalizeNavigableHref } from "lumenpage-link";
import { loadMarkdownModule } from "./markdownBridge";
import { shouldOpenLinkOnClick } from "./linkPolicy";
import {
  consumePlaygroundSecurityAuditLogs,
  normalizePastedText,
  sanitizePastedHtml,
} from "./pastePolicy";
import { createPlaygroundI18n, resolvePlaygroundLocale } from "./i18n";
import { initialDocPerfJson } from "../initialDoc";

const appendDebugLine = (debugPanelEl: HTMLElement | null, text: string) => {
  const globalObj = globalThis as any;
  if (!Array.isArray(globalObj.__lumenSmokeLogs)) {
    globalObj.__lumenSmokeLogs = [];
  }
  globalObj.__lumenSmokeLogs.push(text);
  if (!debugPanelEl) {
    return;
  }
  debugPanelEl.textContent = `${debugPanelEl.textContent || ""}\n${text}`.trim();
};

const getLegacyConfigHits = () => {
  const hits = (globalThis as any).__lumenLegacyConfigHits;
  return Array.isArray(hits) ? hits : [];
};

const findFirstTableCellPos = (doc: any) => {
  let tableCellPos: number | null = null;
  doc.descendants((node: any, pos: number) => {
    if (node.type?.name === "tableCell") {
      tableCellPos = pos;
      return false;
    }
    return true;
  });
  return tableCellPos;
};

const findFirstTableCellCursorPos = (doc: any) => {
  let cursorPos: number | null = null;
  doc.descendants((node: any, pos: number) => {
    if (node.type?.name !== "tableCell") {
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

const findFirstTableCellParagraphEndPos = (doc: any) => {
  let cursorPos: number | null = null;
  doc.descendants((node: any, pos: number) => {
    if (node.type?.name !== "tableCell") {
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

const findFirstTableCellParagraphStartPos = (doc: any) => {
  let cursorPos: number | null = null;
  doc.descendants((node: any, pos: number) => {
    if (node.type?.name !== "tableCell") {
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

const findFirstTableShape = (doc: any) => {
  let shape: { rows: number; cols: number } | null = null;
  doc.descendants((node: any) => {
    if (node?.type?.name !== "table") {
      return true;
    }
    let cols = 0;
    node.forEach((row: any) => {
      cols = Math.max(cols, row?.childCount || 0);
    });
    shape = { rows: node.childCount || 0, cols };
    return false;
  });
  return shape;
};

const findAncestorNodeByType = ($pos: any, typeName: string) => {
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

const verifyOffsetRoundtrip = (doc: any, pos: number) => {
  const offset = docPosToTextOffset(doc, pos);
  const mappedPos = textOffsetToDocPos(doc, offset);
  return {
    offset,
    mappedPos,
    ok: mappedPos === pos,
  };
};

const getCommandRuntime = (editorView: any) => editorView?._internals ?? null;

const getBasicCommand = (editorView: any, name: string) =>
  getCommandRuntime(editorView)?.basicCommands?.[name] ?? null;

const getKeymapCommand = (editorView: any, name: string) =>
  getCommandRuntime(editorView)?.commands?.keymap?.[name] ?? null;

const runViewCommand = (editorView: any, command: any) => {
  if (typeof command !== "function") {
    return false;
  }
  const runtimeRunCommand = getCommandRuntime(editorView)?.runCommand;
  if (typeof runtimeRunCommand === "function") {
    return runtimeRunCommand(
      command,
      editorView?.state,
      (tr: any) => editorView.dispatch(tr),
      editorView
    );
  }
  return command(editorView?.state, (tr: any) => editorView.dispatch(tr), editorView);
};

export const runTableNavigationSmoke = (editorView: any, debugPanelEl: HTMLElement | null) => {
  const commands = editorView?.commands;
  if (!commands) {
    return;
  }

  const cellPos = findFirstTableCellPos(editorView.state.doc);
  const cursorPos = findFirstTableCellCursorPos(editorView.state.doc);
  if (!Number.isFinite(cellPos) || !Number.isFinite(cursorPos)) {
    const message = "[table-smoke] skipped: no tableCell found.";
    console.warn(message);
    appendDebugLine(debugPanelEl, message);
    return;
  }

  let selection: any;
  try {
    selection = TextSelection.create(editorView.state.doc, cursorPos);
  } catch (_error) {
    selection = editorView.state.selection.constructor.near(
      editorView.state.doc.resolve(cursorPos),
      1
    );
  }
  editorView.dispatch(editorView.state.tr.setSelection(selection).scrollIntoView());

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
    let selection: any;
    try {
      selection = TextSelection.create(editorView.state.doc, endPos);
    } catch (_error) {
      return { ok: false, reason: "invalid-start-selection", endPos };
    }
    editorView.dispatch(editorView.state.tr.setSelection(selection).scrollIntoView());

    const beforeHead = editorView.state.selection.head;
    const beforeRoundtrip = verifyOffsetRoundtrip(editorView.state.doc, beforeHead);
    const enterHandled = runViewCommand(editorView, getBasicCommand(editorView, "enter"));
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
    cellRangeSelectionType === "tableCell" &&
    mergeSelectedHandled &&
    afterCellRange.ok &&
    verticalRangeSelectHandled &&
    verticalRangeSelectionType === "tableCell" &&
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
  appendDebugLine(debugPanelEl, text);
};

export const runTableBehaviorStrictSmoke = (editorView: any, debugPanelEl: HTMLElement | null) => {
  const commands = editorView?.commands;
  const keymap = (getCommandRuntime(editorView)?.commands?.keymap ?? {}) as Record<string, any>;
  if (!commands || !keymap) {
    return;
  }

  const startPos = findFirstTableCellParagraphStartPos(editorView.state.doc);
  const endPos = findFirstTableCellParagraphEndPos(editorView.state.doc);
  if (!Number.isFinite(startPos) || !Number.isFinite(endPos)) {
    const text = "[table-behavior-smoke] skipped: no table cell paragraph.";
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
    return;
  }

  const runWithDispatch = (command: any) => runViewCommand(editorView, command);

  const setTextSelection = (pos: number, bias: 1 | -1 = 1) => {
    let selection: any;
    try {
      selection = TextSelection.create(editorView.state.doc, pos);
    } catch (_error) {
      selection = editorView.state.selection.constructor.near(
        editorView.state.doc.resolve(pos),
        bias
      );
    }
    editorView.dispatch(editorView.state.tr.setSelection(selection).scrollIntoView());
  };

  const shapeBefore = findFirstTableShape(editorView.state.doc);
  const firstCellPos = findFirstTableCellPos(editorView.state.doc);

  setTextSelection(startPos, 1);
  const backspaceBoundaryHandled = runWithDispatch(keymap.Backspace);
  const backspaceHeadAfter = editorView.state.selection?.head ?? null;
  const backspaceBoundaryStable = backspaceHeadAfter === startPos;

  setTextSelection(endPos, -1);
  const deleteBoundaryHandled = runWithDispatch(keymap.Delete);
  const deleteHeadAfter = editorView.state.selection?.head ?? null;
  const deleteBoundaryStable = deleteHeadAfter === endPos;

  setTextSelection(startPos, 1);
  let selectRangeHandled = false;
  if (Number.isFinite(firstCellPos)) {
    const baseCellSelection = CellSelection.create(editorView.state.doc, Number(firstCellPos));
    editorView.dispatch(editorView.state.tr.setSelection(baseCellSelection).scrollIntoView());
    selectRangeHandled = commands.selectTableCellsRight?.() === true;
  }
  const selectionTypeBeforeDelete = editorView.state.selection?.toJSON?.()?.type ?? null;
  const backspaceRangeHandled = runWithDispatch(keymap.Backspace);
  const shapeAfterRangeDelete = findFirstTableShape(editorView.state.doc);
  const tableShapeStable =
    !!shapeBefore &&
    !!shapeAfterRangeDelete &&
    shapeBefore.rows === shapeAfterRangeDelete.rows &&
    shapeBefore.cols === shapeAfterRangeDelete.cols;

  setTextSelection(startPos, 1);
  let selectRangeForEnterHandled = false;
  if (Number.isFinite(firstCellPos)) {
    const baseCellSelectionForEnter = CellSelection.create(
      editorView.state.doc,
      Number(firstCellPos)
    );
    editorView.dispatch(editorView.state.tr.setSelection(baseCellSelectionForEnter).scrollIntoView());
    selectRangeForEnterHandled = commands.selectTableCellsRight?.() === true;
  }
  const enterHandled = runWithDispatch(keymap.Enter);
  const selectionTypeAfterEnter = editorView.state.selection?.toJSON?.()?.type ?? null;
  const inTableAfterEnter = !!findAncestorNodeByType(editorView.state.selection?.$from, "table");
  const enterCollapsedToText = selectionTypeAfterEnter !== "tableCell" && inTableAfterEnter;

  const summary = {
    backspaceBoundaryHandled,
    backspaceBoundaryStable,
    deleteBoundaryHandled,
    deleteBoundaryStable,
    selectRangeHandled,
    selectionTypeBeforeDelete,
    backspaceRangeHandled,
    tableShapeStable,
    shapeBefore,
    shapeAfterRangeDelete,
    selectRangeForEnterHandled,
    enterHandled,
    selectionTypeAfterEnter,
    inTableAfterEnter,
    enterCollapsedToText,
  };

  const ok =
    backspaceBoundaryHandled &&
    backspaceBoundaryStable &&
    deleteBoundaryHandled &&
    deleteBoundaryStable &&
    selectRangeHandled &&
    selectionTypeBeforeDelete === "tableCell" &&
    backspaceRangeHandled &&
    tableShapeStable &&
    selectRangeForEnterHandled &&
    enterHandled &&
    enterCollapsedToText;

  const text = `[table-behavior-smoke] ${ok ? "PASS" : "FAIL"} ${JSON.stringify(summary)}`;
  if (ok) {
    console.info(text);
  } else {
    console.error(text);
  }
  appendDebugLine(debugPanelEl, text);
};

export const runOrderedListPaginationSmoke = (editorView: any, debugPanelEl: HTMLElement | null) => {
  const layout = editorView?._internals?.getLayout?.();
  if (!layout?.pages?.length) {
    const text = "[list-smoke] skipped: no layout pages.";
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
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
      if (line?.blockType !== "orderedList") {
        i += 1;
        continue;
      }
      const blockStart = Number.isFinite(line.blockStart) ? line.blockStart : null;
      let j = i;
      let blockBottom = Number.NEGATIVE_INFINITY;
      while (j < lines.length) {
        const current = lines[j];
        const sameBlock =
          current?.blockType === "orderedList" &&
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
  appendDebugLine(debugPanelEl, text);
};

const buildPaginationRegressionDoc = (paragraphCount: number) => ({
  type: "doc",
  content: Array.from({ length: Math.max(1, paragraphCount) }, (_value, index) => ({
    type: "paragraph",
    content: [
      {
        type: "text",
        text: `pagination paragraph ${String(index + 1).padStart(3, "0")}`,
      },
    ],
  })),
});

const findFirstParagraphCursorPos = (doc: any) => {
  let cursorPos: number | null = null;
  doc.descendants((node: any, pos: number) => {
    if (!node?.isTextblock || node.type?.name !== "paragraph") {
      return true;
    }
    cursorPos = pos + 1;
    return false;
  });
  return cursorPos;
};

const findLastParagraphCursorPos = (doc: any) => {
  let cursorPos: number | null = null;
  doc.descendants((node: any, pos: number) => {
    if (!node?.isTextblock || node.type?.name !== "paragraph") {
      return true;
    }
    cursorPos = pos + 1;
    return true;
  });
  return cursorPos;
};

const findLastParagraphEndPos = (doc: any) => {
  let endPos: number | null = null;
  doc.descendants((node: any, pos: number) => {
    if (!node?.isTextblock || node.type?.name !== "paragraph") {
      return true;
    }
    endPos = pos + 1 + Number(node.content?.size || 0);
    return true;
  });
  return endPos;
};

const findParagraphRanges = (doc: any) => {
  const ranges: Array<{ start: number; end: number; text: string }> = [];
  doc.descendants((node: any, pos: number) => {
    if (!node?.isTextblock || node.type?.name !== "paragraph") {
      return true;
    }
    const start = pos + 1;
    const end = start + node.content.size;
    ranges.push({
      start,
      end,
      text: node.textBetween(0, node.content.size, "\n"),
    });
    return ranges.length < 3;
  });
  return ranges;
};

const waitForLayoutIdle = async (editorView: any, stableFrames = 2, maxFrames = 240) => {
  const renderSync = editorView?._internals?.renderSync;
  let previousVersion: number | null = null;
  let stableCount = 0;
  for (let frame = 0; frame < maxFrames; frame += 1) {
    await waitRaf();
    const layoutVersion = Number.isFinite(editorView?._internals?.getLayout?.()?.__version)
      ? Number(editorView._internals.getLayout().__version)
      : null;
    const pending = renderSync?.isLayoutPending?.() === true;
    if (!pending && layoutVersion === previousVersion) {
      stableCount += 1;
    } else {
      stableCount = 0;
    }
    previousVersion = layoutVersion;
    if (stableCount >= stableFrames) {
      return {
        timedOut: false,
        frames: frame + 1,
        layoutVersion,
      };
    }
  }
  return {
    timedOut: true,
    frames: maxFrames,
    layoutVersion: Number.isFinite(editorView?._internals?.getLayout?.()?.__version)
      ? Number(editorView._internals.getLayout().__version)
      : null,
  };
};

const inspectPaginationRegressionLayout = (layout: any, expectedBlocks: number) => {
  const emptyPages: number[] = [];
  const pageRangeIssues: Array<Record<string, number | null>> = [];
  const lineOrderIssues: Array<Record<string, number | null>> = [];
  const rootIndexBacktracks: Array<Record<string, number | null>> = [];
  const seenRootIndexes = new Set<number>();
  let previousRootIndex = -1;

  const pages = Array.isArray(layout?.pages) ? layout.pages : [];
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const lines = Array.isArray(page?.lines) ? page.lines : [];
    if (lines.length === 0) {
      emptyPages.push(pageIndex + 1);
    }
    const pageMin = Number.isFinite(page?.rootIndexMin) ? Number(page.rootIndexMin) : null;
    const pageMax = Number.isFinite(page?.rootIndexMax) ? Number(page.rootIndexMax) : null;
    if (pageMin != null && pageMax != null && pageMax < pageMin) {
      pageRangeIssues.push({
        page: pageIndex + 1,
        rootIndexMin: pageMin,
        rootIndexMax: pageMax,
      });
    }
    let previousY = Number.NEGATIVE_INFINITY;
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      const y = Number.isFinite(line?.y) ? Number(line.y) : null;
      if (y != null && y + 0.5 < previousY) {
        lineOrderIssues.push({
          page: pageIndex + 1,
          line: lineIndex,
          previousY,
          y,
        });
      }
      if (y != null) {
        previousY = y;
      }
      const rootIndex = Number.isFinite(line?.rootIndex) ? Number(line.rootIndex) : null;
      if (rootIndex == null) {
        continue;
      }
      seenRootIndexes.add(rootIndex);
      if (previousRootIndex > rootIndex) {
        rootIndexBacktracks.push({
          page: pageIndex + 1,
          line: lineIndex,
          previousRootIndex,
          rootIndex,
        });
      }
      previousRootIndex = Math.max(previousRootIndex, rootIndex);
    }
  }

  const missingRootIndexes: number[] = [];
  for (let index = 0; index < Math.max(0, expectedBlocks); index += 1) {
    if (!seenRootIndexes.has(index)) {
      missingRootIndexes.push(index);
    }
  }

  return {
    ok:
      emptyPages.length === 0 &&
      pageRangeIssues.length === 0 &&
      lineOrderIssues.length === 0 &&
      rootIndexBacktracks.length === 0 &&
      missingRootIndexes.length === 0,
    emptyPages,
    pageRangeIssues,
    lineOrderIssues,
    rootIndexBacktracks,
    missingRootIndexes,
  };
};

export const runPaginationRegressionSmoke = async (
  editorView: any,
  debugPanelEl: HTMLElement | null
) => {
  const getJSON = editorView?.getJSON?.bind(editorView);
  const setJSON = editorView?.setJSON?.bind(editorView);
  if (typeof getJSON !== "function" || typeof setJSON !== "function") {
    const text = "[pagination-regression-smoke] skipped: getJSON/setJSON unavailable.";
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
    return;
  }

  const baseParagraphCount = 84;
  const enterCount = 18;
  const stressDoc = buildPaginationRegressionDoc(baseParagraphCount);
  const original = getJSON();
  const keymapEnter = getKeymapCommand(editorView, "Enter");

  let applied = false;
  let restored = false;
  let beforePages = 0;
  let afterPages = 0;
  let beforeChildCount = 0;
  let afterChildCount = 0;
  let handledCount = 0;
  let settleBefore: any = null;
  let settleAfter: any = null;
  let restoreSettle: any = null;
  let layoutInspection: any = null;

  try {
    applied = setJSON(stressDoc) === true;
    settleBefore = await waitForLayoutIdle(editorView);
    const beforeLayout = editorView?._internals?.getLayout?.();
    beforePages = Number(beforeLayout?.pages?.length ?? 0);
    beforeChildCount = Number(editorView?.state?.doc?.childCount ?? 0);

    const endPos = findLastParagraphEndPos(editorView.state?.doc);
    if (!Number.isFinite(endPos)) {
      const text = "[pagination-regression-smoke] skipped: no paragraph cursor found.";
      console.warn(text);
      appendDebugLine(debugPanelEl, text);
      return;
    }

    let selection: any;
    try {
      selection = TextSelection.create(editorView.state.doc, Number(endPos));
    } catch (_error) {
      selection = editorView.state.selection.constructor.near(
        editorView.state.doc.resolve(Number(endPos)),
        -1
      );
    }
    editorView.dispatch(editorView.state.tr.setSelection(selection).scrollIntoView());

    for (let index = 0; index < enterCount; index += 1) {
      let handled = false;
      if (typeof keymapEnter === "function") {
        handled = runViewCommand(editorView, keymapEnter);
      }
      if (!handled) {
        handled = runViewCommand(editorView, getBasicCommand(editorView, "enter"));
      }
      if (!handled) {
        break;
      }
      handledCount += 1;
    }

    settleAfter = await waitForLayoutIdle(editorView);
    const afterLayout = editorView?._internals?.getLayout?.();
    afterPages = Number(afterLayout?.pages?.length ?? 0);
    afterChildCount = Number(editorView?.state?.doc?.childCount ?? 0);
    layoutInspection = inspectPaginationRegressionLayout(afterLayout, afterChildCount);
  } finally {
    if (original) {
      restored = setJSON(original) === true;
      restoreSettle = await waitForLayoutIdle(editorView);
    }
  }

  const summary = {
    applied,
    restored,
    baseParagraphCount,
    enterCount,
    handledCount,
    beforePages,
    afterPages,
    beforeChildCount,
    afterChildCount,
    expectedChildCount: baseParagraphCount + enterCount,
    settleBefore,
    settleAfter,
    restoreSettle,
    layoutInspection,
  };
  const ok =
    applied &&
    restored &&
    handledCount === enterCount &&
    afterChildCount === baseParagraphCount + enterCount &&
    afterPages > beforePages &&
    settleBefore?.timedOut !== true &&
    settleAfter?.timedOut !== true &&
    restoreSettle?.timedOut !== true &&
    layoutInspection?.ok === true;
  const text = `[pagination-regression-smoke] ${ok ? "PASS" : "FAIL"} ${JSON.stringify(summary)}`;
  if (ok) {
    console.info(text);
  } else {
    console.error(text);
  }
  appendDebugLine(debugPanelEl, text);
};

const findParagraphTextRange = (doc: any) => {
  let range: { from: number; to: number } | null = null;
  doc.descendants((node: any, pos: number) => {
    if (node?.type?.name !== "paragraph" || !node?.isTextblock) {
      return true;
    }
    if (node.content.size < 2) {
      return true;
    }
    const from = pos + 1;
    const to = Math.min(from + 2, from + node.content.size);
    if (to > from) {
      range = { from, to };
      return false;
    }
    return true;
  });
  return range;
};

const hasMarkInSelection = (state: any, markName: string) => {
  const { from, to, empty } = state.selection;
  const markType = state.schema?.marks?.[markName];
  if (!markType || empty) {
    return false;
  }
  let found = false;
  state.doc.nodesBetween(from, to, (node: any) => {
    if (!node?.isText || !node.marks?.length) {
      return;
    }
    if (node.marks.some((mark: any) => mark.type === markType)) {
      found = true;
    }
  });
  return found;
};

const findFirstListItemTextEndPos = (doc: any) => {
  let endPos: number | null = null;
  doc.descendants((node: any, pos: number) => {
    if (node.type?.name !== "listItem") {
      return true;
    }
    let childPos = pos + 1;
    for (let i = 0; i < node.childCount; i += 1) {
      const child = node.child(i);
      if (child?.isTextblock) {
        endPos = childPos + 1 + child.content.size;
        return false;
      }
      childPos += child.nodeSize;
    }
    endPos = pos + 1;
    return false;
  });
  return endPos;
};

const countListItemsInCurrentList = (selection: any) => {
  const $from = selection?.$from;
  if (!$from) {
    return null;
  }
  const list =
    findAncestorNodeByType($from, "orderedList") || findAncestorNodeByType($from, "bulletList");
  if (!list) {
    return null;
  }
  return Number.isFinite(list.childCount) ? list.childCount : null;
};

export const runListBehaviorSmoke = (editorView: any, debugPanelEl: HTMLElement | null) => {
  const commands = editorView?.commands;
  if (!commands) {
    return;
  }

  const paragraphPos = findFirstParagraphCursorPos(editorView.state.doc);
  if (!Number.isFinite(paragraphPos)) {
    const text = "[list-behavior-smoke] skipped: no paragraph found.";
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
    return;
  }

  let selection: any;
  try {
    selection = TextSelection.create(editorView.state.doc, paragraphPos);
  } catch (_error) {
    selection = editorView.state.selection.constructor.near(
      editorView.state.doc.resolve(paragraphPos),
      1
    );
  }
  editorView.dispatch(editorView.state.tr.setSelection(selection).scrollIntoView());

  const toOrdered = commands.toggleOrderedList?.() === true;
  const orderedActive = !!findAncestorNodeByType(editorView.state.selection.$from, "orderedList");
  const toBullet = commands.toggleBulletList?.() === true;
  const bulletActive = !!findAncestorNodeByType(editorView.state.selection.$from, "bulletList");

  const itemEndPos = findFirstListItemTextEndPos(editorView.state.doc);
  let enterHandled = false;
  let beforeCount: number | null = null;
  let afterCount: number | null = null;
  let stillInList = false;
  if (Number.isFinite(itemEndPos)) {
    let listSelection: any;
    try {
      listSelection = TextSelection.create(editorView.state.doc, itemEndPos);
    } catch (_error) {
      listSelection = editorView.state.selection.constructor.near(
        editorView.state.doc.resolve(itemEndPos),
        -1
      );
    }
    editorView.dispatch(editorView.state.tr.setSelection(listSelection).scrollIntoView());
    beforeCount = countListItemsInCurrentList(editorView.state.selection);
    const enterCommand = getKeymapCommand(editorView, "Enter");
    enterHandled =
      (typeof enterCommand === "function" &&
        runViewCommand(editorView, enterCommand)) ||
      runViewCommand(editorView, getBasicCommand(editorView, "enter"));
    afterCount = countListItemsInCurrentList(editorView.state.selection);
    stillInList =
      !!findAncestorNodeByType(editorView.state.selection.$from, "orderedList") ||
      !!findAncestorNodeByType(editorView.state.selection.$from, "bulletList");
  }

  const enterSplitOk =
    enterHandled && stillInList && Number.isFinite(beforeCount) && Number.isFinite(afterCount)
      ? Number(afterCount) >= Number(beforeCount)
      : false;

  const summary = {
    toOrdered,
    orderedActive,
    toBullet,
    bulletActive,
    enterHandled,
    enterSplitOk,
    beforeCount,
    afterCount,
    stillInList,
  };
  const ok = toOrdered && orderedActive && toBullet && bulletActive && enterSplitOk;
  const text = `[list-behavior-smoke] ${ok ? "PASS" : "FAIL"} ${JSON.stringify(summary)}`;
  if (ok) {
    console.info(text);
  } else {
    console.error(text);
  }
  appendDebugLine(debugPanelEl, text);
};

const resolveLinePageX = (layout: any, viewportWidth: number) =>
  Math.max(0, (viewportWidth - layout.pageWidth) / 2);

const validateCodeBlockContainer = (line: any, pageX: number, tolerance: number) => {
  const padding = Number(line?.blockAttrs?.codeBlockPadding);
  if (!Number.isFinite(padding)) {
    return null;
  }
  const lineLeft = pageX + (Number(line?.x) || 0);
  const containerLeft = lineLeft - padding;
  const diff = Math.abs((lineLeft - containerLeft) - padding);
  if (diff <= tolerance) {
    return null;
  }
  return {
    kind: "codeBlock",
    lineStart: line?.start ?? null,
    lineX: line?.x ?? null,
    padding,
    diff,
  };
};

const validateBlockquoteContainer = (line: any, pageX: number, tolerance: number) => {
  const containers = Array.isArray(line?.containers) ? line.containers : [];
  const blockquote = containers.find((container: any) => container?.type === "blockquote");
  if (!blockquote) {
    return null;
  }
  const baseX = Number.isFinite(blockquote.baseX)
    ? Number(blockquote.baseX)
    : Number(line?.x) || 0;
  const borderInset = Number.isFinite(blockquote.borderInset) ? Number(blockquote.borderInset) : 0;
  const borderWidth = Number.isFinite(blockquote.borderWidth) ? Number(blockquote.borderWidth) : 0;
  const barLeft = pageX + baseX + borderInset;
  const barRight = barLeft + borderWidth;
  const textLeft = pageX + (Number(line?.x) || 0);
  const diff = textLeft - barRight;
  if (diff >= -tolerance) {
    return null;
  }
  return {
    kind: "blockquote",
    lineStart: line?.start ?? null,
    barLeft,
    barRight,
    textLeft,
    diff,
  };
};

export const runBlockOutlineAlignmentSmoke = (
  editorView: any,
  debugPanelEl: HTMLElement | null
) => {
  const layout = editorView?._internals?.getLayout?.();
  const scrollArea = editorView?._internals?.dom?.scrollArea;
  if (!layout?.pages?.length || !scrollArea) {
    const text = "[block-outline-smoke] skipped: no layout or scroll area.";
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
    return;
  }

  const pageX = resolveLinePageX(layout, scrollArea.clientWidth || layout.pageWidth);
  const tolerance = 0.5;
  const issues: any[] = [];

  for (const page of layout.pages) {
    const lines = page?.lines || [];
    for (const line of lines) {
      const codeIssue =
        line?.blockType === "codeBlock"
          ? validateCodeBlockContainer(line, pageX, tolerance)
          : null;
      if (codeIssue) {
        issues.push(codeIssue);
      }

      const quoteIssue = validateBlockquoteContainer(line, pageX, tolerance);
      if (quoteIssue) {
        issues.push(quoteIssue);
      }
    }
  }

  const ok = issues.length === 0;
  const text = `[block-outline-smoke] ${ok ? "PASS" : "FAIL"} ${JSON.stringify({
    count: issues.length,
    issues: issues.slice(0, 20),
  })}`;
  if (ok) {
    console.info(text);
  } else {
    console.error(text);
  }
  appendDebugLine(debugPanelEl, text);
};

const findFirstNodePosByType = (doc: any, typeNames: string[]) => {
  let foundPos: number | null = null;
  doc.descendants((node: any, pos: number) => {
    if (!typeNames.includes(node?.type?.name)) {
      return true;
    }
    foundPos = pos;
    return false;
  });
  return foundPos;
};

export const runDragSelectionSmoke = (editorView: any, debugPanelEl: HTMLElement | null) => {
  const internals = editorView?._internals;
  const queryEditorProp = internals?.queryEditorProp;
  const state = editorView?.state;
  if (!state || typeof queryEditorProp !== "function") {
    const text = "[drag-smoke] skipped: no editor state or queryEditorProp.";
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
    return;
  }

  const mediaPos = findFirstNodePosByType(state.doc, ["image", "video"]);
  const handleProbePos = Number.isFinite(mediaPos) ? Number(mediaPos) : 0;
  const fakeTarget = {
    closest: (selector: string) =>
      selector === "[data-lumen-drag-pos]"
        ? {
            getAttribute: (name: string) =>
              name === "data-lumen-drag-pos" ? String(handleProbePos) : null,
          }
        : null,
  };
  const resolvedDragPos = queryEditorProp("resolveDragNodePos", { target: fakeTarget });
  const dragResolverOk = Number.isFinite(resolvedDragPos) && Number(resolvedDragPos) === handleProbePos;

  const dropCursor = queryEditorProp("dropCursor");
  const dropCursorEnabled = dropCursor !== false;

  let nodeSelectionApplied = false;
  let nodeSelectionType: string | null = null;
  let backToTextSelection = false;
  if (Number.isFinite(mediaPos)) {
    const nodeSel = NodeSelection.create(editorView.state.doc, Number(mediaPos));
    editorView.dispatch(editorView.state.tr.setSelection(nodeSel).scrollIntoView());
    nodeSelectionApplied = editorView.state.selection instanceof NodeSelection;
    nodeSelectionType = editorView.state.selection?.node?.type?.name ?? null;

    const fallbackTextPos = Math.max(1, Number(mediaPos) - 1);
    let textSel: any;
    try {
      textSel = TextSelection.create(editorView.state.doc, fallbackTextPos);
    } catch (_error) {
      textSel = editorView.state.selection.constructor.near(
        editorView.state.doc.resolve(fallbackTextPos),
        -1
      );
    }
    editorView.dispatch(editorView.state.tr.setSelection(textSel).scrollIntoView());
    backToTextSelection = editorView.state.selection instanceof TextSelection;
  }

  const summary = {
    dragResolverOk,
    resolvedDragPos,
    handleProbePos,
    dropCursorEnabled,
    hasMediaNode: Number.isFinite(mediaPos),
    nodeSelectionApplied,
    nodeSelectionType,
    backToTextSelection,
  };
  const ok =
    dragResolverOk &&
    dropCursorEnabled &&
    (!Number.isFinite(mediaPos) || (nodeSelectionApplied && backToTextSelection));
  const text = `[drag-smoke] ${ok ? "PASS" : "FAIL"} ${JSON.stringify(summary)}`;
  if (ok) {
    console.info(text);
  } else {
    console.error(text);
  }
  appendDebugLine(debugPanelEl, text);
};

export const runDragActionSmoke = (editorView: any, debugPanelEl: HTMLElement | null) => {
  const internals = editorView?._internals;
  const dragHandlers = internals?.dragHandlers;
  if (!dragHandlers) {
    const text = "[drag-action-smoke] skipped: no drag handlers.";
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
    return;
  }

  const dragEvent = {
    ctrlKey: false,
    altKey: false,
    preventDefault: () => {},
  };

  const ranges = findParagraphRanges(editorView.state.doc);
  if (ranges.length < 2) {
    const text = "[drag-action-smoke] skipped: not enough paragraphs.";
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
    return;
  }

  const getLayoutPageCount = () => {
    const layout = internals?.getLayout?.();
    return Array.isArray(layout?.pages) ? Number(layout.pages.length) : 0;
  };

  let coldHandleProbeRan = false;
  let coldHandleProbeError: string | null = null;
  let coldHandleBeforeDocSize = 0;
  let coldHandleAfterDocSize = 0;
  let coldHandleBeforePages = 0;
  let coldHandleAfterPages = 0;
  let coldHandleDocStable = false;
  let coldHandleSelectionStable = false;
  let coldHandleLayoutStable = false;
  let coldHandleRootConnected = false;
  let coldHandleInputFocused = false;
  let coldHandleBeforeSelection: { from: number | null; to: number | null } | null = null;
  let coldHandleAfterSelection: { from: number | null; to: number | null } | null = null;

  const canProbeColdHandlePath =
    typeof internals?.handlePointerDown === "function" &&
    typeof internals?.handlePointerUp === "function" &&
    typeof internals?.onClickFocus === "function";
  if (canProbeColdHandlePath) {
    coldHandleProbeRan = true;
    try {
      const rootEl = internals?.dom?.root ?? null;
      const inputEl = internals?.dom?.input ?? null;
      const ownerDocument =
        rootEl?.ownerDocument ||
        inputEl?.ownerDocument ||
        (typeof document !== "undefined" ? document : null);
      const handleDragPos = Math.max(0, Number(ranges[0]?.start || 1) - 1);
      const handleTarget = {
        closest: (selector: string) => {
          if (selector === ".lumenpage-block-drag-handle") {
            return { className: "lumenpage-block-drag-handle" };
          }
          if (selector === "[data-lumen-drag-pos]") {
            return {
              getAttribute: (name: string) =>
                name === "data-lumen-drag-pos" ? String(handleDragPos) : null,
            };
          }
          return null;
        },
      };

      const beforeState = editorView.state;
      coldHandleBeforeDocSize = Number(beforeState?.doc?.content?.size ?? 0);
      coldHandleBeforePages = getLayoutPageCount();
      coldHandleBeforeSelection = {
        from: Number.isFinite(beforeState?.selection?.from)
          ? Number(beforeState.selection.from)
          : null,
        to: Number.isFinite(beforeState?.selection?.to) ? Number(beforeState.selection.to) : null,
      };

      // Simulate the bug-prone path: first interaction is handle click without prior canvas selection.
      inputEl?.blur?.();
      const pointerId = 991;
      internals.handlePointerDown({
        button: 0,
        pointerId,
        clientX: 0,
        clientY: 0,
        target: handleTarget,
      });
      internals.handlePointerUp({
        pointerId,
        clientX: 0,
        clientY: 0,
        target: handleTarget,
      });
      internals.onClickFocus({
        detail: 1,
        button: 0,
        defaultPrevented: false,
        preventDefault: () => {},
        clientX: 0,
        clientY: 0,
        target: handleTarget,
      });

      const afterState = editorView.state;
      coldHandleAfterDocSize = Number(afterState?.doc?.content?.size ?? 0);
      coldHandleAfterPages = getLayoutPageCount();
      coldHandleAfterSelection = {
        from: Number.isFinite(afterState?.selection?.from) ? Number(afterState.selection.from) : null,
        to: Number.isFinite(afterState?.selection?.to) ? Number(afterState.selection.to) : null,
      };

      const afterSelFrom = Number(afterState?.selection?.from);
      const afterSelTo = Number(afterState?.selection?.to);
      coldHandleDocStable = coldHandleAfterDocSize === coldHandleBeforeDocSize;
      coldHandleSelectionStable =
        Number.isFinite(afterSelFrom) &&
        Number.isFinite(afterSelTo) &&
        afterSelFrom >= 0 &&
        afterSelTo >= 0 &&
        afterSelFrom <= coldHandleAfterDocSize &&
        afterSelTo <= coldHandleAfterDocSize;
      coldHandleLayoutStable = coldHandleAfterPages > 0;
      coldHandleRootConnected = rootEl?.isConnected !== false;
      coldHandleInputFocused = !!ownerDocument && ownerDocument.activeElement === inputEl;
    } catch (error) {
      coldHandleProbeError = String((error as any)?.message || error);
    }
  }

  const coldHandlePathOk =
    !coldHandleProbeRan ||
    (!coldHandleProbeError &&
      coldHandleDocStable &&
      coldHandleSelectionStable &&
      coldHandleLayoutStable &&
      coldHandleRootConnected);
  const dropTarget = ranges[ranges.length - 1];
  const dropTargetRect = editorView.coordsAtPos(Math.max(dropTarget.start, dropTarget.end - 1));
  const dropPoint =
    dropTargetRect != null
      ? {
          x: Number(dropTargetRect.left) + 2,
          y: Number(dropTargetRect.top) + 2,
        }
      : null;

  const textSource = ranges[0];
  const dragFrom = textSource.start;
  const dragTo = Math.min(
    textSource.end,
    textSource.start + Math.max(1, Math.min(6, textSource.end - textSource.start))
  );
  let textStartHandled = false;
  let textDraggingAfterStart = false;
  let textUpdateHandled = false;
  let textHasDropDecoration = false;
  let textFinishHandled = false;
  let textDraggingAfterFinish = false;
  let textDocChanged = false;
  let textSizeStable = false;
  let movedTextStillExists = false;
  let movedTextLength = 0;
  if (dragTo > dragFrom && dropPoint) {
    const movedText = editorView.state.doc.textBetween(dragFrom, dragTo, "", "");
    movedTextLength = movedText.length;
    const beforeDocText = editorView.state.doc.textBetween(
      0,
      editorView.state.doc.content.size,
      "\n",
      "\n"
    );
    const beforeDocSize = Number(editorView.state.doc.content.size || 0);
    let sourceSelection: any;
    try {
      sourceSelection = TextSelection.create(editorView.state.doc, dragFrom, dragTo);
    } catch (_error) {
      sourceSelection = null;
    }
    if (sourceSelection) {
      editorView.dispatch(editorView.state.tr.setSelection(sourceSelection).scrollIntoView());
      textStartHandled = dragHandlers.startInternalDragFromSelection?.(dragEvent) === true;
      textDraggingAfterStart = dragHandlers.isInternalDragging?.() === true;
      textUpdateHandled = dragHandlers.updateInternalDrag?.(dragEvent, dropPoint) === true;
      textHasDropDecoration = !!dragHandlers.getDropDecoration?.();
      textFinishHandled = dragHandlers.finishInternalDrag?.(dragEvent, dropPoint) === true;
      textDraggingAfterFinish = dragHandlers.isInternalDragging?.() === true;

      const afterDocText = editorView.state.doc.textBetween(
        0,
        editorView.state.doc.content.size,
        "\n",
        "\n"
      );
      const afterDocSize = Number(editorView.state.doc.content.size || 0);
      textDocChanged = afterDocText !== beforeDocText;
      textSizeStable = afterDocSize === beforeDocSize;
      movedTextStillExists = movedText.length > 0 ? afterDocText.includes(movedText) : false;
    }
  }

  const mediaPos = findFirstNodePosByType(editorView.state.doc, ["image", "video"]);
  let mediaStartHandled = false;
  let mediaDraggingAfterStart = false;
  let mediaUpdateHandled = false;
  let mediaHasDropDecoration = false;
  let mediaFinishHandled = false;
  let mediaDraggingAfterFinish = false;
  let mediaMoved = false;
  let mediaType: string | null = null;
  let mediaVerticalProbeRan = false;
  let mediaVerticalTopHandled = false;
  let mediaVerticalBottomHandled = false;
  let mediaVerticalTopDropPos: number | null = null;
  let mediaVerticalBottomDropPos: number | null = null;
  let mediaVerticalExpectedTopPos: number | null = null;
  let mediaVerticalExpectedBottomPos: number | null = null;
  let mediaVerticalProbeFinishHandled = false;
  let mediaVerticalProbeDraggingAfterFinish = false;
  let mediaVerticalProbeOk = false;
  let mediaVerticalStrictCheck = true;
  let mediaVerticalRectHeight = 0;
  let mediaVerticalTopDropPosAllowed = false;
  let mediaVerticalBottomDropPosAllowed = false;
  if (Number.isFinite(mediaPos)) {
    const mediaNode = editorView.state.doc.nodeAt(Number(mediaPos));
    mediaType = mediaNode?.type?.name ?? null;
    const beforeMediaPos = Number(mediaPos);
    const mediaNodeSize = Number(mediaNode?.nodeSize ?? 0);
    const mediaRect = editorView.coordsAtPos(beforeMediaPos);
    if (mediaRect && mediaNodeSize > 0) {
      mediaVerticalProbeRan = true;
      const rectTop = Number(mediaRect.top);
      const rectBottom = Number(mediaRect.bottom);
      mediaVerticalRectHeight = Math.max(0, rectBottom - rectTop);
      const rectHeight = Math.max(2, rectBottom - rectTop);
      const edgePad = Math.max(1, Math.min(3, Math.round(rectHeight * 0.2)));
      const baseLineHeight = Math.max(1, Number(internals?.settings?.lineHeight) || 0);
      const probeX = Number(mediaRect.left) + 2;
      const topPoint = {
        x: probeX,
        y: rectTop + edgePad,
      };
      const bottomPoint = {
        x: probeX,
        y: rectBottom - edgePad,
      };
      mediaVerticalExpectedTopPos = beforeMediaPos;
      mediaVerticalExpectedBottomPos = beforeMediaPos + mediaNodeSize;
      // Only enforce strict top/bottom distinction when media rect is clearly larger than a text line.
      mediaVerticalStrictCheck =
        mediaVerticalRectHeight > Math.max(4, baseLineHeight + 2) && bottomPoint.y > topPoint.y;
      const verticalProbeStarted =
        dragHandlers.startInternalDragFromNodePos?.(beforeMediaPos, dragEvent) === true;
      if (verticalProbeStarted) {
        mediaVerticalTopHandled = dragHandlers.updateInternalDrag?.(dragEvent, topPoint) === true;
        const topDecoration = dragHandlers.getDropDecoration?.();
        mediaVerticalTopDropPos =
          Number.isFinite(topDecoration?.from) ? Number(topDecoration.from) : null;
        mediaVerticalBottomHandled =
          dragHandlers.updateInternalDrag?.(dragEvent, bottomPoint) === true;
        const bottomDecoration = dragHandlers.getDropDecoration?.();
        mediaVerticalBottomDropPos =
          Number.isFinite(bottomDecoration?.from) ? Number(bottomDecoration.from) : null;
        mediaVerticalProbeFinishHandled =
          dragHandlers.finishInternalDrag?.(dragEvent, bottomPoint) === true;
        mediaVerticalProbeDraggingAfterFinish = dragHandlers.isInternalDragging?.() === true;
      }
      const allowedVerticalDropPos = new Set([
        Number(mediaVerticalExpectedTopPos),
        Number(mediaVerticalExpectedBottomPos),
      ]);
      mediaVerticalTopDropPosAllowed =
        Number.isFinite(mediaVerticalTopDropPos) && allowedVerticalDropPos.has(Number(mediaVerticalTopDropPos));
      mediaVerticalBottomDropPosAllowed =
        Number.isFinite(mediaVerticalBottomDropPos) &&
        allowedVerticalDropPos.has(Number(mediaVerticalBottomDropPos));
      mediaVerticalProbeOk =
        mediaVerticalTopHandled &&
        mediaVerticalBottomHandled &&
        (mediaVerticalStrictCheck
          ? mediaVerticalTopDropPos === mediaVerticalExpectedTopPos &&
            mediaVerticalBottomDropPos === mediaVerticalExpectedBottomPos
          : mediaVerticalTopDropPosAllowed && mediaVerticalBottomDropPosAllowed) &&
        mediaVerticalProbeFinishHandled &&
        !mediaVerticalProbeDraggingAfterFinish;
    }

    const mediaDropRanges = findParagraphRanges(editorView.state.doc);
    const mediaDropTarget = mediaDropRanges.length > 0 ? mediaDropRanges[0] : null;
    const mediaDropRect = mediaDropTarget
      ? editorView.coordsAtPos(Math.max(mediaDropTarget.start, mediaDropTarget.start + 1))
      : null;
    const mediaDropPoint = mediaDropRect
      ? {
          x: Number(mediaDropRect.left) + 2,
          y: Number(mediaDropRect.top) + 2,
        }
      : null;
    const beforeMediaDocSnapshot = JSON.stringify(editorView.state.doc.toJSON());
    mediaStartHandled =
      dragHandlers.startInternalDragFromNodePos?.(beforeMediaPos, dragEvent) === true;
    mediaDraggingAfterStart = dragHandlers.isInternalDragging?.() === true;
    mediaUpdateHandled =
      mediaDropPoint != null ? dragHandlers.updateInternalDrag?.(dragEvent, mediaDropPoint) === true : false;
    mediaHasDropDecoration = !!dragHandlers.getDropDecoration?.();
    mediaFinishHandled =
      mediaDropPoint != null ? dragHandlers.finishInternalDrag?.(dragEvent, mediaDropPoint) === true : false;
    mediaDraggingAfterFinish = dragHandlers.isInternalDragging?.() === true;
    const afterMediaPos = findFirstNodePosByType(editorView.state.doc, mediaType ? [mediaType] : ["image", "video"]);
    const afterMediaDocSnapshot = JSON.stringify(editorView.state.doc.toJSON());
    const mediaDocChanged = afterMediaDocSnapshot !== beforeMediaDocSnapshot;
    mediaMoved = mediaDocChanged || (Number.isFinite(afterMediaPos) && Number(afterMediaPos) !== beforeMediaPos);
  }

  const textPathOk =
    textStartHandled &&
    textDraggingAfterStart &&
    textUpdateHandled &&
    textHasDropDecoration &&
    textFinishHandled &&
    !textDraggingAfterFinish &&
    textDocChanged &&
    movedTextStillExists;
  const mediaPathOk =
    !Number.isFinite(mediaPos) ||
    (mediaStartHandled &&
      mediaDraggingAfterStart &&
      mediaUpdateHandled &&
      mediaHasDropDecoration &&
      mediaFinishHandled &&
      !mediaDraggingAfterFinish &&
      mediaMoved &&
      mediaVerticalProbeOk);

  const summary = {
    text: {
      textStartHandled,
      textDraggingAfterStart,
      textUpdateHandled,
      textHasDropDecoration,
      textFinishHandled,
      textDraggingAfterFinish,
      textDocChanged,
      textSizeStable,
      movedTextLength,
      movedTextStillExists,
      ok: textPathOk,
    },
    media: {
      hasMediaNode: Number.isFinite(mediaPos),
      mediaType,
      mediaStartHandled,
      mediaDraggingAfterStart,
      mediaUpdateHandled,
      mediaHasDropDecoration,
      mediaFinishHandled,
      mediaDraggingAfterFinish,
      mediaMoved,
      mediaVerticalProbeRan,
      mediaVerticalTopHandled,
      mediaVerticalBottomHandled,
      mediaVerticalTopDropPos,
      mediaVerticalBottomDropPos,
      mediaVerticalExpectedTopPos,
      mediaVerticalExpectedBottomPos,
      mediaVerticalStrictCheck,
      mediaVerticalRectHeight,
      mediaVerticalTopDropPosAllowed,
      mediaVerticalBottomDropPosAllowed,
      mediaVerticalProbeFinishHandled,
      mediaVerticalProbeDraggingAfterFinish,
      mediaVerticalProbeOk,
      ok: mediaPathOk,
    },
    coldHandleClickPath: {
      coldHandleProbeRan,
      coldHandleProbeError,
      coldHandleBeforeDocSize,
      coldHandleAfterDocSize,
      coldHandleBeforePages,
      coldHandleAfterPages,
      coldHandleDocStable,
      coldHandleSelectionStable,
      coldHandleLayoutStable,
      coldHandleRootConnected,
      coldHandleInputFocused,
      coldHandleBeforeSelection,
      coldHandleAfterSelection,
      ok: coldHandlePathOk,
    },
  };
  const ok = textPathOk && mediaPathOk && coldHandlePathOk;
  const text = `[drag-action-smoke] ${ok ? "PASS" : "FAIL"} ${JSON.stringify(summary)}`;
  if (ok) {
    console.info(text);
  } else {
    console.error(text);
  }
  appendDebugLine(debugPanelEl, text);
};

export const runSelectionImeSmoke = (editorView: any, debugPanelEl: HTMLElement | null) => {
  const state = editorView?.state;
  if (!state?.doc) {
    const text = "[selection-ime-smoke] skipped: no editor state.";
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
    return;
  }

  const paragraphPos = findFirstParagraphCursorPos(state.doc);
  if (!Number.isFinite(paragraphPos)) {
    const text = "[selection-ime-smoke] skipped: no paragraph found.";
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
    return;
  }

  let textSelection: any;
  try {
    textSelection = TextSelection.create(editorView.state.doc, Number(paragraphPos));
  } catch (_error) {
    textSelection = editorView.state.selection.constructor.near(
      editorView.state.doc.resolve(Number(paragraphPos)),
      1
    );
  }
  editorView.dispatch(editorView.state.tr.setSelection(textSelection).scrollIntoView());

  const beforeTextHead = editorView.state.selection.head;
  const beforeRoundtrip = verifyOffsetRoundtrip(editorView.state.doc, beforeTextHead);
  const imeProbeText = "IME_PROBE";
  editorView.dispatch(
    editorView.state.tr.insertText(
      imeProbeText,
      editorView.state.selection.from,
      editorView.state.selection.to
    )
  );
  const afterTextHead = editorView.state.selection.head;
  const afterRoundtrip = verifyOffsetRoundtrip(editorView.state.doc, afterTextHead);
  const insertedDelta = afterTextHead - beforeTextHead;
  const imeLikeInsertOk =
    insertedDelta === imeProbeText.length && beforeRoundtrip.ok && afterRoundtrip.ok;

  const mediaPos = findFirstNodePosByType(editorView.state.doc, ["image", "video"]);
  let nodeSelectionApplied = false;
  let backToTextSelection = false;
  if (Number.isFinite(mediaPos)) {
    const nodeSelection = NodeSelection.create(editorView.state.doc, Number(mediaPos));
    editorView.dispatch(editorView.state.tr.setSelection(nodeSelection).scrollIntoView());
    nodeSelectionApplied = editorView.state.selection instanceof NodeSelection;

    let restoreTextSelection: any;
    try {
      restoreTextSelection = TextSelection.create(editorView.state.doc, Number(paragraphPos));
    } catch (_error) {
      restoreTextSelection = editorView.state.selection.constructor.near(
        editorView.state.doc.resolve(Number(paragraphPos)),
        1
      );
    }
    editorView.dispatch(editorView.state.tr.setSelection(restoreTextSelection).scrollIntoView());
    backToTextSelection = editorView.state.selection instanceof TextSelection;
  }

  const summary = {
    beforeTextHead,
    afterTextHead,
    insertedDelta,
    imeProbeTextLength: imeProbeText.length,
    imeLikeInsertOk,
    beforeRoundtrip,
    afterRoundtrip,
    hasMediaNode: Number.isFinite(mediaPos),
    nodeSelectionApplied,
    backToTextSelection,
  };
  const ok =
    imeLikeInsertOk &&
    (!Number.isFinite(mediaPos) || (nodeSelectionApplied && backToTextSelection));
  const text = `[selection-ime-smoke] ${ok ? "PASS" : "FAIL"} ${JSON.stringify(summary)}`;
  if (ok) {
    console.info(text);
  } else {
    console.error(text);
  }
  appendDebugLine(debugPanelEl, text);
};

const createSyntheticInputEvent = (payload: Record<string, any> = {}) => {
  const event: any = {
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    ...payload,
  };
  return event;
};

export const runImeActionSmoke = (editorView: any, debugPanelEl: HTMLElement | null) => {
  const internals = editorView?._internals;
  const handlers = internals?.inputDebugHandlers;
  if (!handlers) {
    const text = "[ime-action-smoke] skipped: no input debug handlers.";
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
    return;
  }
  const paragraphPos = findFirstParagraphCursorPos(editorView.state?.doc);
  if (!Number.isFinite(paragraphPos)) {
    const text = "[ime-action-smoke] skipped: no paragraph found.";
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
    return;
  }

  let textSelection: any;
  try {
    textSelection = TextSelection.create(editorView.state.doc, Number(paragraphPos));
  } catch (_error) {
    textSelection = editorView.state.selection.constructor.near(
      editorView.state.doc.resolve(Number(paragraphPos)),
      1
    );
  }
  editorView.dispatch(editorView.state.tr.setSelection(textSelection).scrollIntoView());

  const probeText = "COMPOSE_PROBE";
  const beforeText = editorView.state.doc.textBetween(
    0,
    editorView.state.doc.content.size,
    "\n",
    "\n"
  );
  const beforeHead = editorView.state.selection.head;
  const beforeRoundtrip = verifyOffsetRoundtrip(editorView.state.doc, beforeHead);

  const startEvent = createSyntheticInputEvent({ type: "compositionstart" });
  handlers.handleCompositionStart?.(startEvent);
  const updateEvent = createSyntheticInputEvent({ type: "compositionupdate", data: probeText });
  handlers.handleCompositionUpdate?.(updateEvent);
  const endEvent = createSyntheticInputEvent({ type: "compositionend", data: probeText });
  handlers.handleCompositionEnd?.(endEvent);
  const beforeInputEvent = createSyntheticInputEvent({
    type: "beforeinput",
    inputType: "insertFromComposition",
    data: probeText,
    isComposing: false,
  });
  handlers.handleBeforeInput?.(beforeInputEvent);
  const inputEvent = createSyntheticInputEvent({
    type: "input",
    inputType: "insertFromComposition",
    data: probeText,
  });
  handlers.handleInput?.(inputEvent);

  const afterText = editorView.state.doc.textBetween(
    0,
    editorView.state.doc.content.size,
    "\n",
    "\n"
  );
  const afterHead = editorView.state.selection.head;
  const afterRoundtrip = verifyOffsetRoundtrip(editorView.state.doc, afterHead);
  const delta = afterText.length - beforeText.length;
  const insertedOnce = delta === probeText.length;
  const caretMoved = afterHead - beforeHead === probeText.length;
  const composingReset = editorView.composing === false;

  const summary = {
    insertedOnce,
    delta,
    expectedDelta: probeText.length,
    caretMoved,
    beforeRoundtrip,
    afterRoundtrip,
    composingReset,
    beforeInputPrevented: beforeInputEvent.defaultPrevented === true,
  };
  const ok =
    insertedOnce &&
    caretMoved &&
    beforeRoundtrip.ok &&
    afterRoundtrip.ok &&
    composingReset &&
    beforeInputEvent.defaultPrevented === true;
  const text = `[ime-action-smoke] ${ok ? "PASS" : "FAIL"} ${JSON.stringify(summary)}`;
  if (ok) {
    console.info(text);
  } else {
    console.error(text);
  }
  appendDebugLine(debugPanelEl, text);
};

export const runSelectionBoundarySmoke = (editorView: any, debugPanelEl: HTMLElement | null) => {
  const internals = editorView?._internals;
  const setNodeSelectionAtPos = internals?.setNodeSelectionAtPos;

  const mediaPos = findFirstNodePosByType(editorView.state.doc, ["image", "video"]);
  let nodeSelectionApplied = false;
  if (Number.isFinite(mediaPos)) {
    if (typeof setNodeSelectionAtPos === "function") {
      nodeSelectionApplied = setNodeSelectionAtPos(Number(mediaPos)) === true;
    } else {
      const nodeSelection = NodeSelection.create(editorView.state.doc, Number(mediaPos));
      editorView.dispatch(editorView.state.tr.setSelection(nodeSelection).scrollIntoView());
      nodeSelectionApplied = editorView.state.selection instanceof NodeSelection;
    }
  }
  const tablePos = findFirstNodePosByType(editorView.state.doc, ["table"]);
  let tableNodeSelectionBlocked = true;
  if (Number.isFinite(tablePos) && typeof setNodeSelectionAtPos === "function") {
    tableNodeSelectionBlocked = setNodeSelectionAtPos(Number(tablePos)) !== true;
  }

  const paragraphPos = findFirstParagraphCursorPos(editorView.state.doc);
  let backToTextSelection = false;
  if (Number.isFinite(paragraphPos)) {
    let textSelection: any;
    try {
      textSelection = TextSelection.create(editorView.state.doc, Number(paragraphPos));
    } catch (_error) {
      textSelection = editorView.state.selection.constructor.near(
        editorView.state.doc.resolve(Number(paragraphPos)),
        1
      );
    }
    editorView.dispatch(editorView.state.tr.setSelection(textSelection).scrollIntoView());
    backToTextSelection = editorView.state.selection instanceof TextSelection;
  }

  const summary = {
    hasMediaNode: Number.isFinite(mediaPos),
    nodeSelectionApplied,
    hasTableNode: Number.isFinite(tablePos),
    tableNodeSelectionBlocked,
    backToTextSelection,
  };
  const nodePartOk = !Number.isFinite(mediaPos) || nodeSelectionApplied;
  const tablePartOk = !Number.isFinite(tablePos) || tableNodeSelectionBlocked;
  const ok = nodePartOk && tablePartOk && backToTextSelection;
  const text = `[selection-boundary-smoke] ${ok ? "PASS" : "FAIL"} ${JSON.stringify(summary)}`;
  if (ok) {
    console.info(text);
  } else {
    console.error(text);
  }
  appendDebugLine(debugPanelEl, text);
};

export const runToolCommandSmoke = (editorView: any, debugPanelEl: HTMLElement | null) => {
  const commands = editorView?.commands;
  if (!commands) {
    return;
  }
  const range = findParagraphTextRange(editorView.state.doc);
  if (!range) {
    const text = "[tool-smoke] skipped: no suitable paragraph text range.";
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
    return;
  }

  const setRangeSelection = (from: number, to: number) => {
    let selection: any;
    try {
      selection = TextSelection.create(editorView.state.doc, from, to);
    } catch (_error) {
      return false;
    }
    editorView.dispatch(editorView.state.tr.setSelection(selection).scrollIntoView());
    return true;
  };

  const runToggleMarkCycle = (name: string, toggleCommand: any, attrs: any = undefined) => {
    if (typeof toggleCommand !== "function" || !setRangeSelection(range.from, range.to)) {
      return { name, supported: false, addOk: false, removeOk: false };
    }
    const addHandled = attrs === undefined ? toggleCommand() === true : toggleCommand(attrs) === true;
    const hasAfterAdd = hasMarkInSelection(editorView.state, name);
    if (!setRangeSelection(range.from, range.to)) {
      return { name, supported: true, addOk: addHandled && hasAfterAdd, removeOk: false };
    }
    const removeHandled =
      attrs === undefined ? toggleCommand() === true : toggleCommand(attrs) === true;
    const hasAfterRemove = hasMarkInSelection(editorView.state, name);
    return {
      name,
      supported: true,
      addOk: addHandled && hasAfterAdd,
      removeOk: removeHandled && !hasAfterRemove,
    };
  };

  const bold = runToggleMarkCycle("bold", commands.toggleBold);
  const italic = runToggleMarkCycle("italic", commands.toggleItalic);
  const underline = runToggleMarkCycle("underline", commands.toggleUnderline);

  let linkAddOk = false;
  let linkRemoveOk = false;
  if (typeof commands.toggleLink === "function" && setRangeSelection(range.from, range.to)) {
    const addHandled = commands.toggleLink({ href: "https://example.com/tool-smoke", title: "tool" }) === true;
    const hasAfterAdd = hasMarkInSelection(editorView.state, "link");
    linkAddOk = addHandled && hasAfterAdd;
    if (setRangeSelection(range.from, range.to)) {
      const removeHandled = commands.toggleLink({ href: "https://example.com/tool-smoke", title: "tool" }) === true;
      const hasAfterRemove = hasMarkInSelection(editorView.state, "link");
      linkRemoveOk = removeHandled && !hasAfterRemove;
    }
  }

  const paragraphCursor = findFirstParagraphCursorPos(editorView.state.doc);
  let headingSwitchOk = false;
  let paragraphSwitchBackOk = false;
  const hasSetHeading = typeof commands.setHeading === "function";
  const hasSetParagraph = typeof commands.setParagraph === "function";
  if (Number.isFinite(paragraphCursor)) {
    let cursorSelection: any;
    try {
      cursorSelection = TextSelection.create(editorView.state.doc, Number(paragraphCursor));
    } catch (_error) {
      cursorSelection = null;
    }
    if (cursorSelection) {
      editorView.dispatch(editorView.state.tr.setSelection(cursorSelection).scrollIntoView());
      const toHeadingHandled = commands.setHeading?.(2) === true;
      const headingNode = editorView.state.selection?.$from?.parent;
      headingSwitchOk = toHeadingHandled && headingNode?.type?.name === "heading";
      const toParagraphHandled = commands.setParagraph?.() === true;
      const paragraphNode = editorView.state.selection?.$from?.parent;
      paragraphSwitchBackOk = toParagraphHandled && paragraphNode?.type?.name === "paragraph";
    }
  }

  const summary = {
    bold,
    italic,
    underline,
    link: {
      supported: typeof commands.toggleLink === "function",
      addOk: linkAddOk,
      removeOk: linkRemoveOk,
    },
    blockSwitch: {
      hasSetHeading,
      hasSetParagraph,
      headingSwitchOk,
      paragraphSwitchBackOk,
    },
  };
  const ok =
    bold.addOk &&
    bold.removeOk &&
    italic.addOk &&
    italic.removeOk &&
    underline.addOk &&
    underline.removeOk &&
    linkAddOk &&
    linkRemoveOk &&
    headingSwitchOk &&
    paragraphSwitchBackOk;
  const text = `[tool-smoke] ${ok ? "PASS" : "FAIL"} ${JSON.stringify(summary)}`;
  if (ok) {
    console.info(text);
  } else {
    console.error(text);
  }
  appendDebugLine(debugPanelEl, text);
};

export const runPasteActionSmoke = (editorView: any, debugPanelEl: HTMLElement | null) => {
  const handlers = editorView?._internals?.inputDebugHandlers;
  if (!handlers?.handlePaste) {
    const text = "[paste-smoke] skipped: no paste handler.";
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
    return;
  }
  const inputReadOnly = editorView?._internals?.dom?.input?.readOnly === true;
  const viewEditable = editorView?.editable !== false;
  if (inputReadOnly || !viewEditable) {
    const text = "[paste-smoke] skipped: editor is readonly.";
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
    return;
  }

  const paragraphPos = findFirstParagraphCursorPos(editorView.state?.doc);
  if (!Number.isFinite(paragraphPos)) {
    const text = "[paste-smoke] skipped: no paragraph found.";
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
    return;
  }

  let caretSelection: any;
  try {
    caretSelection = TextSelection.create(editorView.state.doc, Number(paragraphPos));
  } catch (_error) {
    caretSelection = editorView.state.selection.constructor.near(
      editorView.state.doc.resolve(Number(paragraphPos)),
      1
    );
  }
  editorView.dispatch(editorView.state.tr.setSelection(caretSelection).scrollIntoView());

  const snapshotText = () =>
    editorView.state.doc.textBetween(0, editorView.state.doc.content.size, "\n", "\n");

  // 闂佺绻愰悧濠勬暜閺夋５鍦偓锝庡亝绗戦梺鍛婄啲缁犳垼銇愰弻銉ョ婵炲棙鐟х粈澶愭⒑椤掆偓閻忔繈宕㈤妶澶婃嵍闁靛鍎卞☉褔鎮归崶鈺冨笡閼垛晝鈧鍠栫换瀣箔閸涙潙绠┑鐘插€舵禍濂告偣閹扳晛鍔ユい鏇樺€濆畷姘跺Χ閸曨喚顦?paste FAIL.
  const probeBefore = snapshotText();
  const probeMarker = "__PASTE_PROBE__";
  const probeFrom = editorView.state.selection.from;
  editorView.dispatch(editorView.state.tr.insertText(probeMarker, probeFrom, probeFrom));
  const probeAfter = snapshotText();
  const writable = probeAfter !== probeBefore;
  if (!writable) {
    const text = "[paste-smoke] skipped: editor is not writable in current mode.";
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
    return;
  }
  // 闂佹悶鍎抽崑鐐靛垝閹绢喖绠抽柕蹇嬪€栫€氭盯鏌熺紒妯虹瑨闁告瑥妫濇俊瀛樼┍濡?
  editorView.dispatch(
    editorView.state.tr.delete(probeFrom, Math.min(probeFrom + probeMarker.length, editorView.state.doc.content.size))
  );

  const before = snapshotText();
  const plainText = "PASTE_TEXT";
  const htmlText = "PASTE_HTML";

  const createClipboardEvent = (text: string, html: string) =>
    createSyntheticInputEvent({
      type: "paste",
      clipboardData: {
        getData: (type: string) => {
          if (type === "text/plain") {
            return text;
          }
          if (type === "text/html") {
            return html;
          }
          return "";
        },
      },
    });

  const plainEvent = createClipboardEvent(plainText, "");
  handlers.handlePaste(plainEvent);
  const afterPlain = snapshotText();
  const plainInserted = afterPlain.includes(plainText);

  const htmlEvent = createClipboardEvent("", `<p>${htmlText}</p>`);
  handlers.handlePaste(htmlEvent);
  const afterHtml = snapshotText();
  const htmlInserted = afterHtml.includes(htmlText);

  const afterHead = editorView.state.selection?.head ?? null;
  const roundtripOk = Number.isFinite(afterHead)
    ? verifyOffsetRoundtrip(editorView.state.doc, Number(afterHead)).ok
    : false;

  const summary = {
    plainPrevented: plainEvent.defaultPrevented === true,
    plainInserted,
    htmlPrevented: htmlEvent.defaultPrevented === true,
    htmlInserted,
    roundtripOk,
    changed: before !== afterHtml,
  };
  const noOpPastePath =
    plainEvent.defaultPrevented === true &&
    htmlEvent.defaultPrevented === true &&
    !plainInserted &&
    !htmlInserted &&
    before === afterHtml &&
    roundtripOk;
  if (noOpPastePath) {
    const text = `[paste-smoke] skipped: paste path is no-op in current integration ${JSON.stringify(
      summary
    )}`;
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
    return;
  }
  const ok =
    plainEvent.defaultPrevented === true &&
    htmlEvent.defaultPrevented === true &&
    plainInserted &&
    htmlInserted &&
    roundtripOk &&
    before !== afterHtml;
  const text = `[paste-smoke] ${ok ? "PASS" : "FAIL"} ${JSON.stringify(summary)}`;
  if (ok) {
    console.info(text);
  } else {
    console.error(text);
  }
  appendDebugLine(debugPanelEl, text);
};

export const runHistorySmoke = (editorView: any, debugPanelEl: HTMLElement | null) => {
  const commands = editorView?.commands;
  if (!commands) {
    return;
  }
  const paragraphPos = findFirstParagraphCursorPos(editorView.state?.doc);
  if (!Number.isFinite(paragraphPos)) {
    const text = "[history-smoke] skipped: no paragraph found.";
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
    return;
  }

  let caretSelection: any;
  try {
    caretSelection = TextSelection.create(editorView.state.doc, Number(paragraphPos));
  } catch (_error) {
    caretSelection = editorView.state.selection.constructor.near(
      editorView.state.doc.resolve(Number(paragraphPos)),
      1
    );
  }
  editorView.dispatch(editorView.state.tr.setSelection(caretSelection).scrollIntoView());

  const snapshotText = () =>
    editorView.state.doc.textBetween(0, editorView.state.doc.content.size, "\n", "\n");

  const marker = "[HISTORY_SMOKE]";
  const before = snapshotText();
  editorView.dispatch(
    editorView.state.tr.insertText(
      marker,
      editorView.state.selection.from,
      editorView.state.selection.to
    )
  );
  const afterInsert = snapshotText();
  const insertApplied = afterInsert.includes(marker) && afterInsert !== before;

  const undoHandled = commands.undo?.() === true;
  const afterUndo = snapshotText();
  const undoRestored = afterUndo === before;

  const redoHandled = commands.redo?.() === true;
  const afterRedo = snapshotText();
  const redoRestored = afterRedo === afterInsert;

  const summary = {
    insertApplied,
    undoHandled,
    undoRestored,
    redoHandled,
    redoRestored,
  };
  const ok = insertApplied && undoHandled && undoRestored && redoHandled && redoRestored;
  const text = `[history-smoke] ${ok ? "PASS" : "FAIL"} ${JSON.stringify(summary)}`;
  if (ok) {
    console.info(text);
  } else {
    console.error(text);
  }
  appendDebugLine(debugPanelEl, text);
};

export const runMappingSmoke = (editorView: any, debugPanelEl: HTMLElement | null) => {
  const doc = editorView?.state?.doc;
  if (!doc) {
    const text = "[mapping-smoke] skipped: no doc.";
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
    return;
  }

  const docSize = Number(doc.content?.size ?? 0);
  const posSet = new Set<number>([0, docSize]);
  doc.descendants((node: any, pos: number) => {
    if (!Number.isFinite(pos)) {
      return true;
    }
    const start = pos;
    const inside = pos + 1;
    const end = pos + Math.max(0, Number(node?.nodeSize || 0) - 1);
    if (start >= 0 && start <= docSize) {
      posSet.add(start);
    }
    if (inside >= 0 && inside <= docSize) {
      posSet.add(inside);
    }
    if (end >= 0 && end <= docSize) {
      posSet.add(end);
    }
    return true;
  });

  const positions = Array.from(posSet).sort((a, b) => a - b);
  const canonicalMismatches: Array<{
    pos: number;
    offset: number;
    canonicalPos: number;
    canonicalOffset: number;
  }> = [];
  const outOfRange: Array<{ pos: number; offset: number; canonicalPos: number }> = [];
  const offsetViolations: Array<{ prevPos: number; pos: number; prevOffset: number; offset: number }> =
    [];
  let prevOffset = Number.NEGATIVE_INFINITY;
  let prevPos = 0;

  for (const pos of positions) {
    const offset = docPosToTextOffset(doc, pos);
    const canonicalPos = textOffsetToDocPos(doc, offset);
    if (!Number.isFinite(offset) || !Number.isFinite(canonicalPos)) {
      outOfRange.push({ pos, offset, canonicalPos });
      continue;
    }
    if (canonicalPos < 0 || canonicalPos > docSize) {
      outOfRange.push({ pos, offset, canonicalPos });
    }
    const canonicalOffset = docPosToTextOffset(doc, canonicalPos);
    if (!Number.isFinite(canonicalOffset) || canonicalOffset !== offset) {
      canonicalMismatches.push({
        pos,
        offset,
        canonicalPos,
        canonicalOffset,
      });
    }
    if (offset < prevOffset) {
      offsetViolations.push({ prevPos, pos, prevOffset, offset });
    }
    prevOffset = offset;
    prevPos = pos;
  }

  const textLength = Number(editorView?._internals?.getText?.()?.length ?? 0);
  const offsetBoundsOk =
    prevOffset !== Number.NEGATIVE_INFINITY && prevOffset >= 0 && prevOffset <= textLength;

  const summary = {
    checked: positions.length,
    textLength,
    canonicalMismatchCount: canonicalMismatches.length,
    canonicalMismatchSample: canonicalMismatches.slice(0, 20),
    outOfRangeCount: outOfRange.length,
    outOfRangeSample: outOfRange.slice(0, 20),
    offsetViolationCount: offsetViolations.length,
    offsetViolationSample: offsetViolations.slice(0, 20),
    offsetBoundsOk,
  };
  const ok =
    canonicalMismatches.length === 0 &&
    outOfRange.length === 0 &&
    offsetViolations.length === 0 &&
    offsetBoundsOk;
  const text = `[mapping-smoke] ${ok ? "PASS" : "FAIL"} ${JSON.stringify(summary)}`;
  if (ok) {
    console.info(text);
  } else {
    console.error(text);
  }
  appendDebugLine(debugPanelEl, text);
};

export const runCoordsSmoke = (editorView: any, debugPanelEl: HTMLElement | null) => {
  const doc = editorView?.state?.doc;
  const scrollArea = editorView?._internals?.dom?.scrollArea;
  if (!doc || !scrollArea) {
    const text = "[coords-smoke] skipped: missing doc or scroll area.";
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
    return;
  }

  const docSize = Number(doc.content?.size ?? 0);
  const sample: number[] = [0, docSize];
  doc.descendants((node: any, pos: number) => {
    if (!Number.isFinite(pos)) {
      return true;
    }
    const start = pos;
    const inside = pos + 1;
    const end = pos + Math.max(0, Number(node?.nodeSize || 0) - 1);
    if (start >= 0 && start <= docSize) {
      sample.push(start);
    }
    if (inside >= 0 && inside <= docSize) {
      sample.push(inside);
    }
    if (end >= 0 && end <= docSize) {
      sample.push(end);
    }
    return sample.length < 200;
  });

  const positions = Array.from(new Set(sample)).sort((a, b) => a - b).slice(0, 160);
  const mismatches: Array<{
    pos: number;
    mappedPos: number | null;
    offset: number;
    mappedOffset: number | null;
  }> = [];
  const invalidRects: Array<{ pos: number }> = [];

  for (const pos of positions) {
    const rect = editorView.coordsAtPos(pos);
    if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.top)) {
      invalidRects.push({ pos });
      continue;
    }
    const mapped = editorView.posAtCoords({ left: rect.left + 0.5, top: rect.top + 0.5 });
    const mappedPos = Number.isFinite(mapped) ? Number(mapped) : null;
    const offset = docPosToTextOffset(doc, pos);
    const mappedOffset =
      mappedPos != null && Number.isFinite(mappedPos) ? docPosToTextOffset(doc, mappedPos) : null;
    const prevPos = Math.max(0, pos - 1);
    const nextPos = Math.min(docSize, pos + 1);
    const prevOffset = docPosToTextOffset(doc, prevPos);
    const nextOffset = docPosToTextOffset(doc, nextPos);
    const allowedOffsets = new Set<number>();
    if (Number.isFinite(offset)) {
      allowedOffsets.add(offset);
    }
    if (Number.isFinite(prevOffset)) {
      allowedOffsets.add(prevOffset);
    }
    if (Number.isFinite(nextOffset)) {
      allowedOffsets.add(nextOffset);
    }
    if (
      !Number.isFinite(offset) ||
      !Number.isFinite(mappedOffset) ||
      !allowedOffsets.has(Number(mappedOffset))
    ) {
      mismatches.push({ pos, mappedPos, offset, mappedOffset });
    }
  }

  const summary = {
    checked: positions.length,
    invalidRectCount: invalidRects.length,
    invalidRectSample: invalidRects.slice(0, 20),
    mismatchCount: mismatches.length,
    mismatchSample: mismatches.slice(0, 20),
  };
  const ok = invalidRects.length === 0 && mismatches.length === 0;
  const text = `[coords-smoke] ${ok ? "PASS" : "FAIL"} ${JSON.stringify(summary)}`;
  if (ok) {
    console.info(text);
  } else {
    console.error(text);
  }
  appendDebugLine(debugPanelEl, text);
};

export const runScrollIntoViewSmoke = (editorView: any, debugPanelEl: HTMLElement | null) => {
  const scrollArea = editorView?._internals?.dom?.scrollArea;
  if (!scrollArea || typeof editorView?.setProps !== "function") {
    const text = "[scroll-smoke] skipped: missing scroll area or setProps.";
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
    return;
  }

  const targetPos = findLastParagraphCursorPos(editorView.state?.doc);
  if (!Number.isFinite(targetPos)) {
    const text = "[scroll-smoke] skipped: no paragraph found.";
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
    return;
  }

  const setCaretAt = (pos: number) => {
    let selection: any;
    try {
      selection = TextSelection.create(editorView.state.doc, pos);
    } catch (_error) {
      return false;
    }
    editorView.dispatch(editorView.state.tr.setSelection(selection).scrollIntoView());
    return true;
  };

  scrollArea.scrollTop = 0;
  const beforeDefault = scrollArea.scrollTop;
  const defaultApplied = setCaretAt(Number(targetPos));
  const afterDefault = scrollArea.scrollTop;
  const defaultScrolled = defaultApplied && afterDefault > beforeDefault;

  let hookCalls = 0;
  editorView.setProps({
    handleScrollToSelection: () => {
      hookCalls += 1;
      return true;
    },
  });

  scrollArea.scrollTop = 0;
  const beforeHook = scrollArea.scrollTop;
  const hookApplied = true;
  editorView.scrollIntoView(Number(targetPos));
  const afterHook = scrollArea.scrollTop;
  const hookBlockedDefault = hookCalls > 0 && afterHook === beforeHook;

  editorView.setProps({
    handleScrollToSelection: undefined,
  });

  const summary = {
    defaultApplied,
    defaultScrolled,
    beforeDefault,
    afterDefault,
    hookCalls,
    hookApplied,
    hookBlockedDefault,
    beforeHook,
    afterHook,
  };
  const ok = defaultScrolled && hookBlockedDefault;
  const text = `[scroll-smoke] ${ok ? "PASS" : "FAIL"} ${JSON.stringify(summary)}`;
  if (ok) {
    console.info(text);
  } else {
    console.error(text);
  }
  appendDebugLine(debugPanelEl, text);
};

export const runReadonlySmoke = (editorView: any, debugPanelEl: HTMLElement | null) => {
  const inputHandlers = editorView?._internals?.inputDebugHandlers;
  const dragHandlers = editorView?._internals?.dragHandlers;
  if (!inputHandlers || !dragHandlers) {
    const text = "[readonly-smoke] skipped: missing debug handlers.";
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
    return;
  }

  const paragraphPos = findFirstParagraphCursorPos(editorView.state?.doc);
  if (!Number.isFinite(paragraphPos)) {
    const text = "[readonly-smoke] skipped: no paragraph found.";
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
    return;
  }

  const snapshotText = () =>
    editorView.state.doc.textBetween(0, editorView.state.doc.content.size, "\n", "\n");

  const beforeText = snapshotText();
  let selection: any;
  try {
    selection = TextSelection.create(editorView.state.doc, Number(paragraphPos));
  } catch (_error) {
    selection = editorView.state.selection.constructor.near(
      editorView.state.doc.resolve(Number(paragraphPos)),
      1
    );
  }
  editorView.dispatch(editorView.state.tr.setSelection(selection).scrollIntoView());

  editorView.setProps({ editable: () => false });
  const readOnlyApplied = editorView.editable === false;
  const inputReadOnly = editorView?._internals?.dom?.input?.readOnly === true;

  const beforeInputEvent = createSyntheticInputEvent({
    type: "beforeinput",
    inputType: "insertText",
    data: "READONLY_BLOCK",
    isComposing: false,
  });
  inputHandlers.handleBeforeInput?.(beforeInputEvent);
  const afterInputText = snapshotText();
  const inputBlocked =
    beforeInputEvent.defaultPrevented === true && afterInputText === beforeText;

  let dragSelection: any;
  try {
    dragSelection = TextSelection.create(
      editorView.state.doc,
      Number(paragraphPos),
      Math.min(Number(paragraphPos) + 2, Number(paragraphPos) + 1)
    );
  } catch (_error) {
    dragSelection = null;
  }
  if (dragSelection) {
    editorView.dispatch(editorView.state.tr.setSelection(dragSelection).scrollIntoView());
  }
  const dragStartBlocked =
    dragHandlers.startInternalDragFromSelection?.({
      ctrlKey: false,
      altKey: false,
      preventDefault: () => {},
    }) !== true;

  editorView.setProps({ editable: () => true });
  const editableRestored = editorView.editable === true;

  const summary = {
    readOnlyApplied,
    inputReadOnly,
    inputBlocked,
    dragStartBlocked,
    editableRestored,
  };
  const ok = readOnlyApplied && inputReadOnly && inputBlocked && dragStartBlocked && editableRestored;
  const text = `[readonly-smoke] ${ok ? "PASS" : "FAIL"} ${JSON.stringify(summary)}`;
  if (ok) {
    console.info(text);
  } else {
    console.error(text);
  }
  appendDebugLine(debugPanelEl, text);
};

export const runA11ySmoke = async (editorView: any, debugPanelEl: HTMLElement | null) => {
  const resolveExpectedHighContrast = () => {
    if (typeof window === "undefined") {
      return false;
    }
    const params = new URLSearchParams(window.location.search);
    const contrast = String(params.get("contrast") || "")
      .trim()
      .toLowerCase();
    if (contrast === "high") {
      return true;
    }
    if (contrast === "normal" || contrast === "default") {
      return false;
    }
    const highContrast = String(params.get("highContrast") || "")
      .trim()
      .toLowerCase();
    return (
      highContrast === "1" ||
      highContrast === "true" ||
      highContrast === "yes" ||
      highContrast === "on"
    );
  };
  const parseRgb = (value: string): [number, number, number] | null => {
    const match = String(value || "").match(/rgba?\(([^)]+)\)/i);
    if (!match || !match[1]) {
      return null;
    }
    const parts = match[1]
      .split(",")
      .slice(0, 3)
      .map((part) => Number.parseFloat(part.trim()));
    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
      return null;
    }
    return [
      Math.max(0, Math.min(255, parts[0])),
      Math.max(0, Math.min(255, parts[1])),
      Math.max(0, Math.min(255, parts[2])),
    ];
  };
  const toLinear = (value: number) => {
    const normalized = value / 255;
    if (normalized <= 0.03928) {
      return normalized / 12.92;
    }
    return ((normalized + 0.055) / 1.055) ** 2.4;
  };
  const getLuminance = (rgb: [number, number, number]) =>
    0.2126 * toLinear(rgb[0]) + 0.7152 * toLinear(rgb[1]) + 0.0722 * toLinear(rgb[2]);
  const getContrastRatio = (a: [number, number, number], b: [number, number, number]) => {
    const la = getLuminance(a);
    const lb = getLuminance(b);
    const lighter = Math.max(la, lb);
    const darker = Math.min(la, lb);
    return (lighter + 0.05) / (darker + 0.05);
  };

  const root = editorView?.dom;
  const input = editorView?._internals?.dom?.input;
  const ownerDocument =
    root?.ownerDocument || (typeof document !== "undefined" ? document : null);
  const statusEl = root?.querySelector?.(".lumenpage-a11y-status") ?? null;
  if (!root || !input || !statusEl) {
    const text = "[a11y-smoke] skipped: missing root/input/status element.";
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
    return;
  }
  const waitFrame = () =>
    new Promise<void>((resolve) => {
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => resolve());
        return;
      }
      setTimeout(() => resolve(), 16);
    });
  const ensureLayoutAndA11ySettled = async () => {
    try {
      editorView?._internals?.updateLayout?.();
    } catch (_error) {
      // no-op
    }
    await waitFrame();
    await waitFrame();
  };

  const rootRole = root.getAttribute("role");
  const inputRole = input.getAttribute("role");
  const rootLabel = root.getAttribute("aria-label");
  const inputLabel = input.getAttribute("aria-label");
  const rootMultiline = root.getAttribute("aria-multiline");
  const inputMultiline = input.getAttribute("aria-multiline");
  const statusRole = statusEl.getAttribute("role");
  const statusLive = statusEl.getAttribute("aria-live");
  const rootTabIndex = Number(root.tabIndex);

  const rootRoleOk = rootRole === "textbox";
  const inputRoleOk = inputRole === "textbox";
  const labelSyncOk = !!rootLabel && rootLabel === inputLabel;
  const multilineSyncOk = rootMultiline === "true" && inputMultiline === "true";
  const statusRoleOk = statusRole === "status";
  const statusLiveOk = statusLive === "polite";
  const tabIndexOk = Number.isFinite(rootTabIndex) && rootTabIndex >= 0;
  const expectedHighContrast = resolveExpectedHighContrast();
  const appShell = ownerDocument?.querySelector?.(".app-shell") as HTMLElement | null;
  const topbar = ownerDocument?.querySelector?.(".topbar") as HTMLElement | null;
  const appHighContrastClass = appShell?.classList?.contains?.("is-high-contrast") === true;
  const rootContrast = String(root.getAttribute("data-contrast") || "");
  const inputContrast = String(input.getAttribute("data-contrast") || "");
  let topbarContrastRatio: number | null = null;
  let topbarContrastOk = true;
  if (expectedHighContrast) {
    const style = topbar ? getComputedStyle(topbar) : null;
    const fg = parseRgb(String(style?.color || ""));
    const bg = parseRgb(String(style?.backgroundColor || ""));
    if (!fg || !bg) {
      topbarContrastOk = false;
    } else {
      topbarContrastRatio = Math.round(getContrastRatio(fg, bg) * 100) / 100;
      topbarContrastOk = topbarContrastRatio >= 7;
    }
  }
  const highContrastStateOk = expectedHighContrast
    ? appHighContrastClass &&
      rootContrast === "high" &&
      inputContrast === "high" &&
      topbarContrastOk
    : rootContrast === "normal" && inputContrast === "normal";

  let focusApplied = false;
  let focusReleased = false;
  if (typeof editorView?.focus === "function") {
    editorView.focus();
    focusApplied = editorView.hasFocus?.() === true;
    if (ownerDocument?.body) {
      const probe = ownerDocument.createElement("button");
      probe.type = "button";
      probe.textContent = "a11y-smoke-probe";
      probe.style.position = "fixed";
      probe.style.left = "-10000px";
      probe.style.top = "0";
      ownerDocument.body.appendChild(probe);
      probe.focus();
      focusReleased = editorView.hasFocus?.() === false;
      probe.remove();
    } else {
      focusReleased = true;
    }
  }

  const dispatchKey = (el: HTMLElement, key: string) => {
    el.dispatchEvent(
      new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
      })
    );
  };

  const menuBarEl = ownerDocument?.querySelector?.(".menu-bar") as HTMLElement | null;
  const menuTriggers = menuBarEl
    ? Array.from(menuBarEl.querySelectorAll<HTMLElement>(".menu-trigger")).filter((trigger) => {
        const htmlButton = trigger as HTMLButtonElement;
        return !htmlButton.disabled && trigger.offsetParent !== null;
      })
    : [];
  let menuNavProbeRan = false;
  let menuArrowNavOk = false;
  let menuHomeEndNavOk = false;
  if (menuBarEl && menuTriggers.length >= 2) {
    menuNavProbeRan = true;
    menuTriggers[0].focus();
    dispatchKey(menuTriggers[0], "ArrowRight");
    const rightTarget = ownerDocument?.activeElement === menuTriggers[1];
    dispatchKey(menuTriggers[1], "ArrowLeft");
    const leftTarget = ownerDocument?.activeElement === menuTriggers[0];
    menuArrowNavOk = rightTarget && leftTarget;

    menuTriggers[1].focus();
    dispatchKey(menuTriggers[1], "Home");
    const homeTarget = ownerDocument?.activeElement === menuTriggers[0];
    menuTriggers[0].focus();
    dispatchKey(menuTriggers[0], "End");
    const endTarget = ownerDocument?.activeElement === menuTriggers[menuTriggers.length - 1];
    menuHomeEndNavOk = homeTarget && endTarget;
  }

  const toolbarEl = ownerDocument?.querySelector?.(".toolbar") as HTMLElement | null;
  const toolbarButtons = toolbarEl
    ? Array.from(toolbarEl.querySelectorAll<HTMLElement>(".toolbar-left .t-button")).filter((button) => {
        const htmlButton = button as HTMLButtonElement;
        return !htmlButton.disabled && button.offsetParent !== null;
      })
    : [];
  let toolbarNavProbeRan = false;
  let toolbarArrowNavOk = false;
  let toolbarHomeEndNavOk = false;
  if (toolbarEl && toolbarButtons.length >= 2) {
    toolbarNavProbeRan = true;
    toolbarButtons[0].focus();
    dispatchKey(toolbarButtons[0], "ArrowRight");
    const rightTarget = ownerDocument?.activeElement === toolbarButtons[1];
    dispatchKey(toolbarButtons[1], "ArrowLeft");
    const leftTarget = ownerDocument?.activeElement === toolbarButtons[0];
    toolbarArrowNavOk = rightTarget && leftTarget;

    toolbarButtons[1].focus();
    dispatchKey(toolbarButtons[1], "Home");
    const homeTarget = ownerDocument?.activeElement === toolbarButtons[0];
    toolbarButtons[0].focus();
    dispatchKey(toolbarButtons[0], "End");
    const endTarget = ownerDocument?.activeElement === toolbarButtons[toolbarButtons.length - 1];
    toolbarHomeEndNavOk = homeTarget && endTarget;
  }

  const editable = editorView.editable === true;
  const rootReadonly = root.getAttribute("aria-readonly");
  const inputReadonly = input.readOnly === true;
  const readonlyStateConsistent = editable
    ? rootReadonly === "false" && !inputReadonly
    : rootReadonly === "true" && inputReadonly;

  const paragraphPos = findFirstParagraphCursorPos(editorView.state?.doc);
  let cursorAnnouncement = "";
  let selectionAnnouncement = "";
  let cursorAnnouncementOk = false;
  let selectionAnnouncementOk = false;
  if (Number.isFinite(paragraphPos)) {
    let cursorSelection: any;
    try {
      cursorSelection = TextSelection.create(editorView.state.doc, Number(paragraphPos));
    } catch (_error) {
      cursorSelection = editorView.state.selection.constructor.near(
        editorView.state.doc.resolve(Number(paragraphPos)),
        1
      );
    }
    editorView.dispatch(editorView.state.tr.setSelection(cursorSelection).scrollIntoView());
    cursorAnnouncement = String(statusEl.textContent || "").trim();
    cursorAnnouncementOk =
      /cursor/i.test(cursorAnnouncement) &&
      /page/i.test(cursorAnnouncement) &&
      /line/i.test(cursorAnnouncement) &&
      /column/i.test(cursorAnnouncement);
    if (!cursorAnnouncementOk) {
      await ensureLayoutAndA11ySettled();
      cursorAnnouncement = String(statusEl.textContent || "").trim();
      cursorAnnouncementOk =
        /cursor/i.test(cursorAnnouncement) &&
        /page/i.test(cursorAnnouncement) &&
        /line/i.test(cursorAnnouncement) &&
        /column/i.test(cursorAnnouncement);
    }

    const selectionEnd = Math.min(
      Number(editorView.state.doc.content.size || 0),
      Number(paragraphPos) + 2
    );
    if (selectionEnd > Number(paragraphPos)) {
      let rangeSelection: any;
      try {
        rangeSelection = TextSelection.create(editorView.state.doc, Number(paragraphPos), selectionEnd);
      } catch (_error) {
        rangeSelection = null;
      }
      if (rangeSelection) {
        editorView.dispatch(editorView.state.tr.setSelection(rangeSelection).scrollIntoView());
        selectionAnnouncement = String(statusEl.textContent || "").trim();
        selectionAnnouncementOk =
          /selection/i.test(selectionAnnouncement) &&
          /characters/i.test(selectionAnnouncement) &&
          /page/i.test(selectionAnnouncement);
        if (!selectionAnnouncementOk) {
          await ensureLayoutAndA11ySettled();
          selectionAnnouncement = String(statusEl.textContent || "").trim();
          selectionAnnouncementOk =
            /selection/i.test(selectionAnnouncement) &&
            /characters/i.test(selectionAnnouncement) &&
            /page/i.test(selectionAnnouncement);
        }
      }
    }
  }

  const summary = {
    rootRole,
    inputRole,
    rootLabel,
    inputLabel,
    rootMultiline,
    inputMultiline,
    statusRole,
    statusLive,
    rootTabIndex,
    rootRoleOk,
    inputRoleOk,
    labelSyncOk,
    multilineSyncOk,
    statusRoleOk,
    statusLiveOk,
    tabIndexOk,
    expectedHighContrast,
    appHighContrastClass,
    rootContrast,
    inputContrast,
    topbarContrastRatio,
    topbarContrastOk,
    highContrastStateOk,
    focusApplied,
    focusReleased,
    menuNavProbeRan,
    menuArrowNavOk,
    menuHomeEndNavOk,
    toolbarNavProbeRan,
    toolbarArrowNavOk,
    toolbarHomeEndNavOk,
    editable,
    rootReadonly,
    inputReadonly,
    readonlyStateConsistent,
    cursorAnnouncement,
    cursorAnnouncementOk,
    selectionAnnouncement,
    selectionAnnouncementOk,
  };
  const ok =
    rootRoleOk &&
    inputRoleOk &&
    labelSyncOk &&
    multilineSyncOk &&
    statusRoleOk &&
    statusLiveOk &&
    tabIndexOk &&
    highContrastStateOk &&
    focusApplied &&
    focusReleased &&
    menuNavProbeRan &&
    menuArrowNavOk &&
    menuHomeEndNavOk &&
    toolbarNavProbeRan &&
    toolbarArrowNavOk &&
    toolbarHomeEndNavOk &&
    readonlyStateConsistent &&
    cursorAnnouncementOk &&
    selectionAnnouncementOk;
  const text = `[a11y-smoke] ${ok ? "PASS" : "FAIL"} ${JSON.stringify(summary)}`;
  if (ok) {
    console.info(text);
  } else {
    console.error(text);
  }
  appendDebugLine(debugPanelEl, text);
};

export const runDocRoundtripSmoke = (editorView: any, debugPanelEl: HTMLElement | null) => {
  const state = editorView?.state;
  if (!state?.doc || !state?.schema?.nodeFromJSON) {
    const text = "[doc-roundtrip-smoke] skipped: no state/schema.";
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
    return;
  }

  let json: any = null;
  let restored: any = null;
  let fromJsonOk = false;
  let eqOk = false;
  try {
    json = state.doc.toJSON();
    restored = state.schema.nodeFromJSON(json);
    fromJsonOk = !!restored;
    eqOk = typeof restored?.eq === "function" ? restored.eq(state.doc) : false;
  } catch (_error) {
    fromJsonOk = false;
    eqOk = false;
  }

  const originalSize = Number(state.doc.content?.size ?? 0);
  const restoredSize = Number(restored?.content?.size ?? -1);
  const sizeStable = originalSize === restoredSize;
  const originalTextLen = Number(editorView?._internals?.getText?.()?.length ?? 0);
  const tailPos = Math.max(0, originalSize);
  const tailOffset = docPosToTextOffset(state.doc, tailPos);
  const tailCanonicalPos = textOffsetToDocPos(state.doc, tailOffset);
  const tailCanonicalOffset = Number.isFinite(tailCanonicalPos)
    ? docPosToTextOffset(state.doc, tailCanonicalPos)
    : null;
  const tailRoundtripOk =
    Number.isFinite(tailOffset) &&
    Number.isFinite(tailCanonicalPos) &&
    Number.isFinite(tailCanonicalOffset) &&
    Number(tailCanonicalOffset) === Number(tailOffset);

  const summary = {
    hasJson: !!json,
    fromJsonOk,
    eqOk,
    sizeStable,
    originalSize,
    restoredSize,
    originalTextLen,
    tailPos,
    tailOffset,
    tailCanonicalPos,
    tailCanonicalOffset,
    tailRoundtripOk,
  };
  const ok = !!json && fromJsonOk && eqOk && sizeStable && tailRoundtripOk;
  const text = `[doc-roundtrip-smoke] ${ok ? "PASS" : "FAIL"} ${JSON.stringify(summary)}`;
  if (ok) {
    console.info(text);
  } else {
    console.error(text);
  }
  appendDebugLine(debugPanelEl, text);
};

export const runMarkdownIoSmoke = async (debugPanelEl: HTMLElement | null) => {
  let markdownMod: any = null;
  try {
    markdownMod = await loadMarkdownModule();
  } catch (_error) {
    const text = "[markdown-io-smoke] skipped: markdown module not available.";
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
    return;
  }

  const parser = markdownMod?.defaultMarkdownParser;
  const serializer = markdownMod?.defaultMarkdownSerializer;
  if (!parser?.parse || !serializer?.serialize) {
    const text = "[markdown-io-smoke] skipped: parser/serializer missing.";
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
    return;
  }

  const sampleMarkdown = [
    "# Markdown Smoke",
    "",
    "Paragraph with **bold**, *italic*, and [link](https://example.com).",
    "",
    "- item 1",
    "- item 2",
    "",
    "> quote line",
    "",
    "```ts",
    "const value = 1",
    "```",
    "",
  ].join("\n");

  let parsed1: any = null;
  let serialized: string | null = null;
  let parsed2: any = null;
  let parseOk = false;
  let serializeOk = false;
  let roundtripEq = false;
  let extendedSerializeOk = false;
  let extendedFeaturesOk = false;
  let extendedSerializedLen = 0;

  try {
    parsed1 = parser.parse(sampleMarkdown);
    parseOk = !!parsed1;
    serialized = serializer.serialize(parsed1);
    serializeOk = typeof serialized === "string" && serialized.length > 0;
    parsed2 = serializeOk ? parser.parse(serialized) : null;
    roundtripEq = !!parsed2 && typeof parsed1?.eq === "function" ? parsed1.eq(parsed2) : false;
  } catch (_error) {
    parseOk = false;
    serializeOk = false;
    roundtripEq = false;
  }

  try {
    const schema = parser?.schema;
    const node = schema?.nodes || {};
    const mark = schema?.marks || {};
    const paragraphType = node.paragraph;
    const docType = node.doc;
    if (schema && paragraphType && docType) {
      const strike = mark.strike ? mark.strike.create() : null;
      const underline = mark.underline ? mark.underline.create() : null;
      const marks = [strike, underline].filter(Boolean);
      const markedText = schema.text("extended-mark");
      const markedNode =
        marks.length > 0 ? markedText.mark(marks as any) : markedText;
      const blocks: any[] = [paragraphType.create(null, [markedNode])];

      if (node.table && node.tableRow && node.tableCell && node.tableHeader) {
        const makeCell = (text: string) =>
          node.tableCell.create(
            { colspan: 1, rowspan: 1 },
            [paragraphType.create(null, text ? [schema.text(text)] : undefined)]
          );
        const makeHeaderCell = (text: string) =>
          node.tableHeader.create(
            { colspan: 1, rowspan: 1 },
            [paragraphType.create(null, text ? [schema.text(text)] : undefined)]
          );
        const row1 = node.tableRow.create(null, [makeHeaderCell("h1"), makeHeaderCell("h2")]);
        const row2 = node.tableRow.create(null, [makeCell("a2"), makeCell("b2")]);
        blocks.push(node.table.create({ id: null }, [row1, row2]));
      }

      if (node.video) {
        blocks.push(
          node.video.create({
            src: "https://example.com/video.mp4",
            width: 320,
            height: 180,
            embed: false,
          })
        );
      }

      const extendedDoc = docType.create(null, blocks);
      const extendedSerialized = serializer.serialize(extendedDoc);
      extendedSerializedLen = typeof extendedSerialized === "string" ? extendedSerialized.length : 0;
      extendedSerializeOk = typeof extendedSerialized === "string" && extendedSerialized.length > 0;
      const hasTable = !node.table || extendedSerialized.includes("<table>");
      const hasTableHeader = !node.table || !node.tableHeader || extendedSerialized.includes("<th>");
      const hasVideo = !node.video || /<video\b|<iframe\b/.test(extendedSerialized);
      const hasStrike = !mark.strike || extendedSerialized.includes("~~");
      const hasUnderline = !mark.underline || extendedSerialized.includes("<u>");
      extendedFeaturesOk = hasTable && hasTableHeader && hasVideo && hasStrike && hasUnderline;
    }
  } catch (_error) {
    extendedSerializeOk = false;
    extendedFeaturesOk = false;
  }

  const summary = {
    parseOk,
    serializeOk,
    roundtripEq,
    extendedSerializeOk,
    extendedFeaturesOk,
    sampleLen: sampleMarkdown.length,
    serializedLen: serialized?.length ?? 0,
    extendedSerializedLen,
  };
  const ok =
    parseOk && serializeOk && roundtripEq && extendedSerializeOk && extendedFeaturesOk;
  const text = `[markdown-io-smoke] ${ok ? "PASS" : "FAIL"} ${JSON.stringify(summary)}`;
  if (ok) {
    console.info(text);
  } else {
    console.error(text);
  }
  appendDebugLine(debugPanelEl, text);
};

export const runLegacyConfigSmoke = (debugPanelEl: HTMLElement | null) => {
  const hits = getLegacyConfigHits();
  const keys = [...new Set(hits.map((item: any) => String(item?.key || "")).filter(Boolean))];
  const summary = {
    hitCount: hits.length,
    keys,
  };
  const ok = hits.length === 0;
  const text = `[legacy-config-smoke] ${ok ? "PASS" : "FAIL"} ${JSON.stringify(summary)}`;
  if (ok) {
    console.info(text);
  } else {
    console.error(text);
  }
  appendDebugLine(debugPanelEl, text);
};

export const runHtmlIoSmoke = (editorView: any, debugPanelEl: HTMLElement | null) => {
  const state = editorView?.state;
  const ownerDocument =
    editorView?.dom?.ownerDocument || (typeof document !== "undefined" ? document : null);
  if (!state?.doc || !state?.schema || !ownerDocument) {
    const text = "[html-io-smoke] skipped: missing doc/schema/document.";
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
    return;
  }

  let html = "";
  let parsedDoc: any = null;
  let serializeOk = false;
  let parseOk = false;
  let exactEq = false;
  let textEq = false;
  let errorMessage: string | null = null;

  try {
    const serializer = DOMSerializer.fromSchema(state.schema);
    const container = ownerDocument.createElement("div");
    container.appendChild(serializer.serializeFragment(state.doc.content));
    html = container.innerHTML;
    serializeOk = html.length > 0;

    const parser = PMDOMParser.fromSchema(state.schema);
    const host = ownerDocument.createElement("div");
    host.innerHTML = html;
    parsedDoc = parser.parse(host);
    parseOk = !!parsedDoc;

    exactEq = typeof state.doc?.eq === "function" ? state.doc.eq(parsedDoc) : false;
    const originalText = state.doc?.textContent ?? "";
    const parsedText = parsedDoc?.textContent ?? "";
    textEq = originalText === parsedText;
  } catch (error: any) {
    errorMessage = String(error?.message || error);
  }

  const summary = {
    serializeOk,
    parseOk,
    exactEq,
    textEq,
    htmlLen: html.length,
    errorMessage,
  };
  const ok = serializeOk && parseOk && (exactEq || textEq);
  const text = `[html-io-smoke] ${ok ? "PASS" : "FAIL"} ${JSON.stringify(summary)}`;
  if (ok) {
    console.info(text);
  } else {
    console.error(text);
  }
  appendDebugLine(debugPanelEl, text);
};

export const runLinkInteractionSmoke = (debugPanelEl: HTMLElement | null) => {
  const cases = [
    { mode: "full", ctrlKey: false, metaKey: false, expected: false },
    { mode: "full", ctrlKey: true, metaKey: false, expected: true },
    { mode: "full", ctrlKey: false, metaKey: true, expected: true },
    { mode: "comment", ctrlKey: false, metaKey: false, expected: true },
    { mode: "readonly", ctrlKey: false, metaKey: false, expected: true },
  ] as const;

  const mismatches = cases.filter((item) => {
    const actual = shouldOpenLinkOnClick(item.mode as any, {
      ctrlKey: item.ctrlKey,
      metaKey: item.metaKey,
    });
    return actual !== item.expected;
  });

  const summary = {
    checked: cases.length,
    mismatchCount: mismatches.length,
    mismatches,
  };
  const ok = mismatches.length === 0;
  const text = `[link-smoke] ${ok ? "PASS" : "FAIL"} ${JSON.stringify(summary)}`;
  if (ok) {
    console.info(text);
  } else {
    console.error(text);
  }
  appendDebugLine(debugPanelEl, text);
};

export const runSecuritySmoke = async (editorView: any, debugPanelEl: HTMLElement | null) => {
  consumePlaygroundSecurityAuditLogs();
  const normalizedText = normalizePastedText("A\r\nB\rC\u00a0D");
  const textNormalizeOk = normalizedText === "A\nB\nC D";

  const dangerousHtml = [
    "<p onclick=\"alert(1)\" style=\"color:red\">x</p>",
    "<script>alert(1)</script>",
    "<iframe src=\"https://evil.example\"></iframe>",
    "<a href=\"javascript:alert(1)\">bad-link</a>",
    "<a href=\"vbscript:msgbox(1)\">bad-link2</a>",
    "<img src=\"javascript:alert(1)\" onerror=\"alert(1)\" />",
    "<img src=\"data:image/svg+xml;base64,PHN2Zy8+\" />",
    "<img src=\"data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==\" />",
  ].join("");
  const sanitizedDangerous = sanitizePastedHtml(dangerousHtml);
  const dangerousSanitizedOk =
    !/script/i.test(sanitizedDangerous) &&
    !/iframe/i.test(sanitizedDangerous) &&
    !/onclick=/i.test(sanitizedDangerous) &&
    !/onerror=/i.test(sanitizedDangerous) &&
    !/style=/i.test(sanitizedDangerous) &&
    !/javascript:/i.test(sanitizedDangerous) &&
    !/vbscript:/i.test(sanitizedDangerous) &&
    !/data:image\/svg\+xml/i.test(sanitizedDangerous) &&
    !/data:text\/html/i.test(sanitizedDangerous);

  const safeHtml = [
    "<a href=\"https://example.com\">safe-link</a>",
    "<a href=\"/docs/ok\">safe-relative</a>",
    "<img src=\"data:image/png;base64,AAAA\" alt=\"img\" />",
  ].join("");
  const sanitizedSafe = sanitizePastedHtml(safeHtml);
  const safePreservedOk =
    /href=\"https:\/\/example\.com/.test(sanitizedSafe) &&
    /href=\"\/docs\/ok/.test(sanitizedSafe) &&
    /src=\"data:image\/png;base64,AAAA\"/i.test(sanitizedSafe);

  const hrefCases = [
    { href: "https://example.com", allowed: true },
    { href: "/relative/path", allowed: true },
    { href: "#anchor", allowed: true },
    { href: "mailto:test@example.com", allowed: true },
    { href: "tel:+123456", allowed: true },
    { href: "javascript:alert(1)", allowed: false },
    { href: "vbscript:msgbox(1)", allowed: false },
    { href: "data:text/html,<script>alert(1)</script>", allowed: false },
    { href: "java\nscript:alert(1)", allowed: false },
  ];
  const hrefMismatches = hrefCases.filter((item) => {
    const actual = normalizeNavigableHref(item.href);
    const ok = item.allowed ? typeof actual === "string" : actual == null;
    return !ok;
  });
  const hrefNormalizeOk = hrefMismatches.length === 0;

  const normalizeDangerousProbe = (value: string) =>
    String(value || "").trim().toLowerCase().replace(/[\u0000-\u0020]+/g, "");
  const isDangerousProbe = (value: string) => {
    const normalized = normalizeDangerousProbe(value);
    return (
      normalized.startsWith("javascript:") ||
      normalized.startsWith("vbscript:") ||
      normalized.startsWith("data:text/html")
    );
  };

  const collectDocSecurityStats = (doc: any) => {
    const linkHrefs: string[] = [];
    const imageSrcs: string[] = [];
    const videoSrcs: string[] = [];
    doc?.descendants?.((node: any) => {
      if (node?.isText && Array.isArray(node.marks)) {
        for (const mark of node.marks) {
          if (mark?.type?.name === "link" && typeof mark?.attrs?.href === "string") {
            linkHrefs.push(String(mark.attrs.href));
          }
        }
      }
      if (node?.type?.name === "image" && typeof node?.attrs?.src === "string") {
        imageSrcs.push(String(node.attrs.src));
      }
      if (node?.type?.name === "video" && typeof node?.attrs?.src === "string") {
        videoSrcs.push(String(node.attrs.src));
      }
      return true;
    });
    const unsafeLinks = linkHrefs.filter(isDangerousProbe);
    const unsafeImages = imageSrcs.filter(isDangerousProbe);
    const unsafeVideos = videoSrcs.filter(isDangerousProbe);
    return {
      linkHrefs,
      imageSrcs,
      videoSrcs,
      unsafeLinks,
      unsafeImages,
      unsafeVideos,
    };
  };

  let schemaParseOk = false;
  let schemaParseSkipped = false;
  let dangerousParsedStats: any = null;
  let safeParsedStats: any = null;
  const ownerDocument = editorView?.dom?.ownerDocument || (typeof document !== "undefined" ? document : null);
  const schema = editorView?.state?.schema;
  if (!ownerDocument || !schema) {
    schemaParseSkipped = true;
  } else {
    try {
      const parser = PMDOMParser.fromSchema(schema);
      const dangerousHost = ownerDocument.createElement("div");
      dangerousHost.innerHTML = [
        "<p><a href=\"javascript:alert(1)\">bad-link</a></p>",
        "<img src=\"javascript:alert(1)\" />",
        "<video src=\"javascript:alert(1)\"></video>",
        "<iframe src=\"javascript:alert(1)\"></iframe>",
      ].join("");
      const dangerousDoc = parser.parse(dangerousHost);
      dangerousParsedStats = collectDocSecurityStats(dangerousDoc);

      const safeHost = ownerDocument.createElement("div");
      safeHost.innerHTML = [
        "<p><a href=\"https://example.com\">good-link</a></p>",
        "<img src=\"https://example.com/a.png\" />",
        "<video src=\"https://example.com/a.mp4\"></video>",
        "<iframe src=\"https://example.com/embed\"></iframe>",
      ].join("");
      const safeDoc = parser.parse(safeHost);
      safeParsedStats = collectDocSecurityStats(safeDoc);

      schemaParseOk =
        dangerousParsedStats.unsafeLinks.length === 0 &&
        dangerousParsedStats.unsafeImages.length === 0 &&
        dangerousParsedStats.unsafeVideos.length === 0 &&
        dangerousParsedStats.linkHrefs.length === 0 &&
        dangerousParsedStats.imageSrcs.length === 0 &&
        dangerousParsedStats.videoSrcs.length === 0 &&
        safeParsedStats.unsafeLinks.length === 0 &&
        safeParsedStats.unsafeImages.length === 0 &&
        safeParsedStats.unsafeVideos.length === 0 &&
        safeParsedStats.linkHrefs.length >= 1 &&
        safeParsedStats.imageSrcs.length >= 1 &&
        safeParsedStats.videoSrcs.length >= 2;
    } catch (_error) {
      schemaParseOk = false;
    }
  }

  let markdownParseOk = false;
  let markdownParseSkipped = false;
  let markdownStats: any = null;
  try {
    const markdownMod = await loadMarkdownModule();
    const parser = markdownMod?.defaultMarkdownParser;
    if (!parser?.parse) {
      markdownParseSkipped = true;
    } else {
      const markdownDoc = parser.parse([
        "[bad](javascript:alert(1))",
        "",
        "![badimg](javascript:alert(1))",
        "",
        "![okimg](https://example.com/a.png)",
      ].join("\n"));
      markdownStats = collectDocSecurityStats(markdownDoc);
      const parsedResourceCount =
        Number(markdownStats.linkHrefs?.length || 0) +
        Number(markdownStats.imageSrcs?.length || 0) +
        Number(markdownStats.videoSrcs?.length || 0);
      const strictDroppedAll = parsedResourceCount === 0;
      markdownParseOk =
        !!markdownStats &&
        markdownStats.unsafeLinks.length === 0 &&
        markdownStats.unsafeImages.length === 0 &&
        markdownStats.unsafeVideos.length === 0 &&
        (parsedResourceCount > 0 || strictDroppedAll);
    }
  } catch (_error) {
    markdownParseSkipped = true;
  }

  let jsonImportOk = false;
  let jsonImportSkipped = false;
  let jsonDangerousStats: any = null;
  let jsonSafeStats: any = null;
  const getJSON = editorView?.getJSON?.bind(editorView);
  const setJSON = editorView?.setJSON?.bind(editorView);
  if (typeof getJSON !== "function" || typeof setJSON !== "function") {
    jsonImportSkipped = true;
  } else {
    const originalJson = getJSON();
    try {
      const dangerousJson = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "bad-link",
                marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
              },
            ],
          },
          {
            type: "image",
            attrs: { src: "data:image/svg+xml;base64,PHN2Zy8+", alt: "bad-image" },
          },
          {
            type: "video",
            attrs: {
              src: "javascript:alert(1)",
              poster: "javascript:alert(1)",
              width: 320,
              height: 180,
              embed: false,
            },
          },
        ],
      };
      const safeJson = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "safe-link",
                marks: [{ type: "link", attrs: { href: "https://example.com" } }],
              },
            ],
          },
          {
            type: "image",
            attrs: { src: "https://example.com/a.png", alt: "safe-image" },
          },
          {
            type: "video",
            attrs: {
              src: "https://example.com/a.mp4",
              poster: "https://example.com/a.poster.png",
              width: 320,
              height: 180,
              embed: false,
            },
          },
        ],
      };

      const dangerousApplied = setJSON(dangerousJson) === true;
      await waitRaf();
      await waitRaf();
      jsonDangerousStats = collectDocSecurityStats(editorView?.state?.doc);
      const dangerousJsonOk =
        dangerousApplied &&
        !!jsonDangerousStats &&
        jsonDangerousStats.unsafeLinks.length === 0 &&
        jsonDangerousStats.unsafeImages.length === 0 &&
        jsonDangerousStats.unsafeVideos.length === 0 &&
        jsonDangerousStats.linkHrefs.length === 0;

      const safeApplied = setJSON(safeJson) === true;
      await waitRaf();
      await waitRaf();
      jsonSafeStats = collectDocSecurityStats(editorView?.state?.doc);
      const safeJsonOk =
        safeApplied &&
        !!jsonSafeStats &&
        jsonSafeStats.unsafeLinks.length === 0 &&
        jsonSafeStats.unsafeImages.length === 0 &&
        jsonSafeStats.unsafeVideos.length === 0 &&
        jsonSafeStats.linkHrefs.length >= 1 &&
        jsonSafeStats.imageSrcs.length >= 1 &&
        jsonSafeStats.videoSrcs.length >= 1;

      jsonImportOk = dangerousJsonOk && safeJsonOk;
    } catch (_error) {
      jsonImportOk = false;
    } finally {
      try {
        if (originalJson) {
          setJSON(originalJson);
          await waitRaf();
          await waitRaf();
        }
      } catch (_error) {
        // no-op: restore best effort only
      }
    }
  }

  const securityAuditLogs = consumePlaygroundSecurityAuditLogs();
  const securityAuditDropCount = securityAuditLogs.filter(
    (entry: any) => entry?.decision === "drop"
  ).length;
  const securityAuditSanitizeCount = securityAuditLogs.filter(
    (entry: any) => entry?.decision === "sanitize"
  ).length;
  const summary = {
    textNormalizeOk,
    dangerousSanitizedOk,
    safePreservedOk,
    hrefNormalizeOk,
    schemaParseOk,
    schemaParseSkipped,
    dangerousParsedStats,
    safeParsedStats,
    markdownParseOk,
    markdownParseSkipped,
    markdownStats,
    jsonImportOk,
    jsonImportSkipped,
    jsonDangerousStats,
    jsonSafeStats,
    hrefMismatchCount: hrefMismatches.length,
    hrefMismatches,
    securityAuditTotal: securityAuditLogs.length,
    securityAuditDropCount,
    securityAuditSanitizeCount,
    securityAuditSample: securityAuditLogs.slice(0, 12),
    sanitizedDangerous,
    sanitizedSafe,
  };
  const ok =
    textNormalizeOk &&
    dangerousSanitizedOk &&
    safePreservedOk &&
    hrefNormalizeOk &&
    (schemaParseSkipped || schemaParseOk) &&
    (markdownParseSkipped || markdownParseOk) &&
    (jsonImportSkipped || jsonImportOk) &&
    securityAuditDropCount > 0;
  const text = `[security-smoke] ${ok ? "PASS" : "FAIL"} ${JSON.stringify(summary)}`;
  if (ok) {
    console.info(text);
  } else {
    console.error(text);
  }
  appendDebugLine(debugPanelEl, text);
};

export const runI18nSmoke = async (editorView: any, debugPanelEl: HTMLElement | null) => {
  const getJSON = editorView?.getJSON?.bind(editorView);
  const setJSON = editorView?.setJSON?.bind(editorView);
  if (typeof getJSON !== "function" || typeof setJSON !== "function") {
    const text = "[i18n-smoke] skipped: getJSON/setJSON unavailable.";
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
    return;
  }

  const original = getJSON();
  const locale = resolvePlaygroundLocale();
  const i18n = createPlaygroundI18n(locale);
  const root = editorView?._internals?.dom?.root ?? null;
  const rootAriaLabel = String(root?.getAttribute?.("aria-label") || "");
  const expectedAriaLabel = i18n.app.editorAriaLabel;
  const ariaLocaleLabelOk = rootAriaLabel === expectedAriaLabel;
  const settings = editorView?._internals?.settings ?? null;
  const segmenterConfigured = typeof settings?.segmentText === "function";
  const textLocale = String(settings?.textLocale || "");
  const textLocaleMatched = textLocale === locale;

  const mixedDoc = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "涓枃 English 娣锋帓 123锛屾爣鐐广€侰JK + Latin wrap probe.",
          },
        ],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "CJK mixed wrap probe with ASCII fallback 456.",
          },
        ],
      },
    ],
  } as any;

  let applied = false;
  let lineCount = 0;
  let finiteLineMetrics = false;
  let hasCjkText = false;
  let coordsOk = false;
  let roundtripChecked = 0;
  let roundtripMismatchCount = 0;
  let roundtripMismatchSample: Array<any> = [];
  try {
    applied = setJSON(mixedDoc) === true;
    await waitRaf();
    await waitRaf();

    const doc = editorView.state?.doc;
    const layout = editorView?._internals?.getLayout?.();
    const lines = (layout?.pages || []).flatMap((page: any) => page?.lines || []);
    lineCount = lines.length;
    finiteLineMetrics = lines.every(
      (line: any) =>
        Number.isFinite(line?.x) &&
        Number.isFinite(line?.y) &&
        Number.isFinite(line?.width) &&
        Number.isFinite(line?.lineHeight ?? layout?.lineHeight)
    );

    const text = String(doc?.textBetween?.(0, doc?.content?.size ?? 0, "\n", "\n") || "");
    hasCjkText = /[\u4e00-\u9fff]/.test(text);

    const ranges = findParagraphRanges(doc);
    const probeRange = ranges[0] || null;
    if (probeRange) {
      const probePositions: number[] = [];
      const upper = Math.min(probeRange.end, probeRange.start + 8);
      for (let pos = probeRange.start; pos <= upper; pos += 1) {
        probePositions.push(pos);
      }
      roundtripChecked = probePositions.length;
      for (const pos of probePositions) {
        const offset = docPosToTextOffset(doc, pos);
        const mappedPos = textOffsetToDocPos(doc, offset);
        if (!Number.isFinite(offset) || !Number.isFinite(mappedPos) || Number(mappedPos) !== Number(pos)) {
          roundtripMismatchCount += 1;
          if (roundtripMismatchSample.length < 20) {
            roundtripMismatchSample.push({ pos, offset, mappedPos });
          }
        }
      }

      const startRect = editorView.coordsAtPos(probeRange.start);
      const midRect = editorView.coordsAtPos(
        Math.min(probeRange.end, probeRange.start + Math.max(1, Math.floor((probeRange.end - probeRange.start) / 2)))
      );
      const endRect = editorView.coordsAtPos(Math.max(probeRange.start, probeRange.end - 1));
      const rects = [startRect, midRect, endRect];
      coordsOk = rects.every(
        (rect) =>
          rect != null &&
          Number.isFinite(Number(rect.left)) &&
          Number.isFinite(Number(rect.top)) &&
          Number.isFinite(Number(rect.bottom)) &&
          Number.isFinite(Number(rect.right))
      );
    }
  } finally {
    if (original) {
      setJSON(original);
    }
  }

  const summary = {
    locale,
    rootAriaLabel,
    expectedAriaLabel,
    ariaLocaleLabelOk,
    segmenterConfigured,
    textLocale,
    textLocaleMatched,
    applied,
    lineCount,
    finiteLineMetrics,
    hasCjkText,
    coordsOk,
    roundtripChecked,
    roundtripMismatchCount,
    roundtripMismatchSample,
  };
  const ok =
    applied &&
    lineCount > 0 &&
    finiteLineMetrics &&
    hasCjkText &&
    ariaLocaleLabelOk &&
    segmenterConfigured &&
    textLocaleMatched &&
    coordsOk &&
    roundtripMismatchCount === 0;
  const text = `[i18n-smoke] ${ok ? "PASS" : "FAIL"} ${JSON.stringify(summary)}`;
  if (ok) {
    console.info(text);
  } else {
    console.error(text);
  }
  appendDebugLine(debugPanelEl, text);
};
const waitRaf = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

const resolveTruthySearchParam = (key: string) => {
  if (typeof window === "undefined") {
    return false;
  }
  const raw = new URLSearchParams(window.location.search).get(key);
  if (!raw) {
    return false;
  }
  const normalized = String(raw).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
};

export const runPerfBudgetSmoke = async (editorView: any, debugPanelEl: HTMLElement | null) => {
  const getJSON = editorView?.getJSON?.bind(editorView);
  const setJSON = editorView?.setJSON?.bind(editorView);
  if (typeof getJSON !== "function" || typeof setJSON !== "function") {
    const text = "[perf-budget-smoke] skipped: getJSON/setJSON unavailable.";
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
    return;
  }

  const original = getJSON();
  const keepLargeDoc = resolveTruthySearchParam("perfBudgetKeepDoc");
  const keepLargeDocRaw =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("perfBudgetKeepDoc")
      : null;
  const largeDoc = initialDocPerfJson;
  const blockCount = Array.isArray(largeDoc?.content) ? largeDoc.content.length : 0;

  const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
  let applied = false;
  let elapsedMs = 0;
  let pageCount = 0;
  let textLength = 0;
  let layoutPerf: any = null;
  let renderPerf: any = null;
  try {
    applied = setJSON(largeDoc) === true;
    await waitRaf();
    await waitRaf();
    const endedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    elapsedMs = Math.round((endedAt - startedAt) * 100) / 100;
    const layout = editorView?._internals?.getLayout?.();
    pageCount = Number(layout?.pages?.length ?? 0);
    textLength = Number(editorView?._internals?.getText?.()?.length ?? 0);
    layoutPerf = editorView?._internals?.settings?.__perf?.layout ?? null;
    renderPerf = editorView?._internals?.settings?.__perf?.render ?? null;
  } finally {
    if (!keepLargeDoc && original) {
      setJSON(original);
    }
  }

  const budgets = {
    maxElapsedMs: 15000,
    minPageCount: 100,
    minTextLength: 100000,
  };
  const summary = {
    applied,
    blockCount,
    keepLargeDoc,
    keepLargeDocRaw,
    elapsedMs,
    pageCount,
    textLength,
    budgets,
    layoutPerf,
    renderPerf,
  };
  const ok =
    applied &&
    elapsedMs <= budgets.maxElapsedMs &&
    pageCount >= budgets.minPageCount &&
    textLength >= budgets.minTextLength;
  const text = `[perf-budget-smoke] ${ok ? "PASS" : "FAIL"} ${JSON.stringify(summary)}`;
  if (ok) {
    console.info(text);
  } else {
    console.error(text);
  }
  appendDebugLine(debugPanelEl, text);
};
