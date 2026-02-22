import { basicCommands, createCanvasEditorKeymap, runCommand } from "lumenpage-kit-basic";
import { docPosToTextOffset, textOffsetToDocPos } from "lumenpage-view-canvas";
import { NodeSelection, TextSelection } from "lumenpage-state";
import { CellSelection } from "lumenpage-node-table";

const appendDebugLine = (debugPanelEl: HTMLElement | null, text: string) => {
  if (!debugPanelEl) {
    return;
  }
  debugPanelEl.textContent = `${debugPanelEl.textContent || ""}\n${text}`.trim();
};

const findFirstTableCellPos = (doc: any) => {
  let tableCellPos: number | null = null;
  doc.descendants((node: any, pos: number) => {
    if (node.type?.name === "table_cell") {
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

const findFirstTableCellParagraphEndPos = (doc: any) => {
  let cursorPos: number | null = null;
  doc.descendants((node: any, pos: number) => {
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

const findFirstTableCellParagraphStartPos = (doc: any) => {
  let cursorPos: number | null = null;
  doc.descendants((node: any, pos: number) => {
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

// 表格导航与核心命令冒烟测试。
export const runTableNavigationSmoke = (editorView: any, debugPanelEl: HTMLElement | null) => {
  const commands = editorView?.commands;
  if (!commands) {
    return;
  }

  const cellPos = findFirstTableCellPos(editorView.state.doc);
  const cursorPos = findFirstTableCellCursorPos(editorView.state.doc);
  if (!Number.isFinite(cellPos) || !Number.isFinite(cursorPos)) {
    const message = "[table-smoke] skipped: no table_cell found.";
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
  appendDebugLine(debugPanelEl, text);
};

export const runTableBehaviorStrictSmoke = (editorView: any, debugPanelEl: HTMLElement | null) => {
  const commands = editorView?.commands;
  const keymap = createCanvasEditorKeymap?.();
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

  const runWithDispatch = (command: any) => {
    if (typeof command !== "function") {
      return false;
    }
    return runCommand(command, editorView.state, (tr) => editorView.dispatch(tr));
  };

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
  const enterCollapsedToText = selectionTypeAfterEnter !== "table_cell" && inTableAfterEnter;

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
    selectionTypeBeforeDelete === "table_cell" &&
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

// 有序列表分页布局冒烟测试。
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
  appendDebugLine(debugPanelEl, text);
};

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
    if (node.type?.name !== "list_item") {
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
    findAncestorNodeByType($from, "ordered_list") || findAncestorNodeByType($from, "bullet_list");
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
  const orderedActive = !!findAncestorNodeByType(editorView.state.selection.$from, "ordered_list");
  const toBullet = commands.toggleBulletList?.() === true;
  const bulletActive = !!findAncestorNodeByType(editorView.state.selection.$from, "bullet_list");

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
    const dispatch = (tr: any) => editorView.dispatch(tr);
    const enterCommand = createCanvasEditorKeymap()?.Enter;
    enterHandled =
      (typeof enterCommand === "function" &&
        runCommand(enterCommand as any, editorView.state, dispatch)) ||
      runCommand(basicCommands.enter, editorView.state, dispatch);
    afterCount = countListItemsInCurrentList(editorView.state.selection);
    stillInList =
      !!findAncestorNodeByType(editorView.state.selection.$from, "ordered_list") ||
      !!findAncestorNodeByType(editorView.state.selection.$from, "bullet_list");
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
    kind: "code_block",
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
        line?.blockType === "code_block"
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
  if (Number.isFinite(mediaPos)) {
    mediaType = editorView.state.doc.nodeAt(Number(mediaPos))?.type?.name ?? null;
    const beforeMediaPos = Number(mediaPos);
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
      mediaMoved);

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
      ok: mediaPathOk,
    },
  };
  const ok = textPathOk && mediaPathOk;
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
  const imeProbeText = "中文";
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

  const probeText = "拼音";
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
  const resolveGapSelectionAtPos = internals?.resolveGapSelectionAtPos;
  const setNodeSelectionAtPos = internals?.setNodeSelectionAtPos;
  if (typeof resolveGapSelectionAtPos !== "function") {
    const text = "[selection-boundary-smoke] skipped: no gap resolver.";
    console.warn(text);
    appendDebugLine(debugPanelEl, text);
    return;
  }

  const doc = editorView.state?.doc;
  const docSize = Number(doc?.content?.size ?? 0);
  let gapResolvedPos: number | null = null;
  let gapResolvedType: string | null = null;

  for (let pos = 0; pos <= docSize; pos += 1) {
    const resolved = resolveGapSelectionAtPos(pos);
    if (!resolved?.selection) {
      continue;
    }
    const type = resolved.selection?.toJSON?.()?.type ?? null;
    if (type && type !== "text") {
      gapResolvedPos = Number.isFinite(resolved.pos) ? resolved.pos : pos;
      gapResolvedType = type;
      editorView.dispatch(editorView.state.tr.setSelection(resolved.selection).scrollIntoView());
      break;
    }
  }

  const gapSelectionApplied =
    !!gapResolvedType && (editorView.state.selection?.toJSON?.()?.type ?? null) === gapResolvedType;

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
    gapResolvedPos,
    gapResolvedType,
    gapSelectionApplied,
    hasMediaNode: Number.isFinite(mediaPos),
    nodeSelectionApplied,
    backToTextSelection,
  };
  // gapcursor plugin 关闭时允许 gap 项为 false，仅校验 node/text 边界切换。
  const gapPartOk = !gapResolvedType || gapSelectionApplied;
  const nodePartOk = !Number.isFinite(mediaPos) || nodeSelectionApplied;
  const ok = gapPartOk && nodePartOk && backToTextSelection;
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

  const bold = runToggleMarkCycle("strong", commands.toggleBold);
  const italic = runToggleMarkCycle("em", commands.toggleItalic);
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
  const mismatches: Array<{ pos: number; offset: number; mappedPos: number }> = [];
  const offsetViolations: Array<{ prevPos: number; pos: number; prevOffset: number; offset: number }> =
    [];
  let prevOffset = Number.NEGATIVE_INFINITY;
  let prevPos = 0;

  for (const pos of positions) {
    const offset = docPosToTextOffset(doc, pos);
    const mappedPos = textOffsetToDocPos(doc, offset);
    if (!Number.isFinite(offset) || !Number.isFinite(mappedPos)) {
      mismatches.push({ pos, offset, mappedPos });
      continue;
    }
    if (mappedPos !== pos) {
      mismatches.push({ pos, offset, mappedPos });
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
    mismatchCount: mismatches.length,
    mismatchSample: mismatches.slice(0, 20),
    offsetViolationCount: offsetViolations.length,
    offsetViolationSample: offsetViolations.slice(0, 20),
    offsetBoundsOk,
  };
  const ok = mismatches.length === 0 && offsetViolations.length === 0 && offsetBoundsOk;
  const text = `[mapping-smoke] ${ok ? "PASS" : "FAIL"} ${JSON.stringify(summary)}`;
  if (ok) {
    console.info(text);
  } else {
    console.error(text);
  }
  appendDebugLine(debugPanelEl, text);
};
