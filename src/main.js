/*
 * 文件说明：应用入口与编辑主循环。
 * 主要职责：初始化状态、布局、渲染；处理输入与选区；同步光标与分页渲染。
 * 关键逻辑：文本偏移 <-> PM 位置映射、表格位置映射、渲染调度。
 */

import { DOMParser as PMDOMParser } from "prosemirror-model";
import { TextSelection } from "prosemirror-state";
import { createEditorState, applyTransaction } from "./editor/state.js";
import { schema, docToText, getTableTextLength } from "./editor/schema.js";
import {
  basicCommands,
  runCommand,
  setBlockAlign,
  setHeadingLevel,
  setParagraph,
} from "./editor/commands.js";
import { LayoutPipeline } from "./layout/engine.js";
import { createDefaultNodeRendererRegistry } from "./layout/nodeRegistry.js";
import { coordsAtPos, posAtCoords } from "./layout/posIndex.js";
import { selectionToRects } from "./render/selection.js";
import { attachInputBridge } from "./input/bridge.js";
import { Renderer } from "./core/renderer.js";
import { findLineForOffset, offsetAtX } from "./core/caret.js";

/* 编辑器渲染配置：页尺寸、行高与换行容差等 */
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
  lineHeight: 22,
  font: "16px Arial",
  wrapTolerance: 2,
  pageBuffer: 1,
  maxPageCache: 16,
};

const viewport = document.getElementById("viewport");
const scrollArea = document.getElementById("scrollArea");
const pageLayer = document.getElementById("pageLayer");
const overlayCanvas = document.getElementById("overlayCanvas");
const spacer = document.getElementById("spacer");
const status = document.getElementById("status");
const inputEl = document.getElementById("input");

const initialDocJson = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "LumenPage MVP" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "This is a minimal prototype for paginated canvas rendering with a DOM input layer.",
        },
      ],
    },
    {
      type: "table",
      content: [
        {
          type: "table_row",
          content: [
            {
              type: "table_cell",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "R1C1" }],
                },
              ],
            },
            {
              type: "table_cell",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "R1C2" }],
                },
              ],
            },
            {
              type: "table_cell",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "R1C3" }],
                },
              ],
            },
          ],
        },
        {
          type: "table_row",
          content: [
            {
              type: "table_cell",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "R2C1" }],
                },
              ],
            },
            {
              type: "table_cell",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "R2C2" }],
                },
              ],
            },
            {
              type: "table_cell",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "R2C3" }],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "The table above is editable text in each cell.",
        },
      ],
    },
  ],
};

const nodeRegistry = createDefaultNodeRendererRegistry();
const tools = document.getElementById("tools");
const layoutPipeline = new LayoutPipeline(settings, nodeRegistry);
const renderer = new Renderer(pageLayer, overlayCanvas, settings, nodeRegistry);
const supportsBeforeInput = "onbeforeinput" in inputEl;

let editorState = createEditorState({ json: initialDocJson });
let layout = null;
let rafId = 0;
let caretOffset = 0;
let caretRect = null;
let preferredX = null;
let pendingPreferredUpdate = true;
let isComposing = false;
let isPointerSelecting = false;
let pointerAnchorOffset = 0;
let pointerId = null;
let lastSelectionSignature = "";
const debugDelete = true;

const logDelete = (phase, payload) => {
  if (!debugDelete) {
    return;
  }
  console.log("[delete]", phase, payload);
};


const getText = () => docToText(editorState.doc);

const setInputPosition = (x, y) => {
  inputEl.style.left = `${x}px`;
  inputEl.style.top = `${y}px`;
};

const clampOffset = (offset) => {
  const length = getText().length;
  return Math.max(0, Math.min(offset, length));
};

/* 文本偏移 <-> PM 位置映射（含表格/段落） */
const getBlockTextLength = (node) => {
  if (node.type.name === "table") {
    return getTableTextLength(node);
  }
  return node.textContent.length;
};

const mapOffsetInTextblock = (node, nodePos, offset) => {
  const textStart = nodePos + 1;
  return textStart + offset;
};

const mapOffsetInCell = (cell, cellPos, offset) => {
  let remaining = offset;
  let innerPos = cellPos + 1;
  for (let i = 0; i < cell.childCount; i += 1) {
    const block = cell.child(i);
    const blockPos = innerPos;
    const textLength = block.textContent.length;
    if (remaining <= textLength) {
      return mapOffsetInTextblock(block, blockPos, remaining);
    }
    remaining -= textLength;
    if (i < cell.childCount - 1) {
      if (remaining === 0) {
        return blockPos + block.nodeSize - 1;
      }
      remaining -= 1;
    }
    innerPos += block.nodeSize;
  }
  return cellPos + cell.nodeSize - 1;
};

const mapOffsetInTable = (table, tablePos, offset) => {
  let remaining = offset;
  const tableStart = tablePos + 1;
  let rowPos = tableStart;

  for (let r = 0; r < table.childCount; r += 1) {
    const row = table.child(r);
    const rowStart = rowPos + 1;
    let cellPos = rowStart;

    for (let c = 0; c < row.childCount; c += 1) {
      const cell = row.child(c);
      const cellLength = cell.textBetween(0, cell.content.size, "\n").length;
      if (remaining <= cellLength) {
        return mapOffsetInCell(cell, cellPos, remaining);
      }
      remaining -= cellLength;
      if (c < row.childCount - 1) {
        if (remaining === 0) {
          return cellPos + cell.nodeSize - 1;
        }
        remaining -= 1;
      }
      cellPos += cell.nodeSize;
    }

    if (r < table.childCount - 1) {
      if (remaining === 0) {
        return rowPos + row.nodeSize - 1;
      }
      remaining -= 1;
    }
    rowPos += row.nodeSize;
  }

  return tablePos + table.nodeSize - 1;
};

const textOffsetToDocPos = (doc, offset) => {
  const clamped = clampOffset(offset);
  let remaining = clamped;
  let docPos = 0;

  for (let i = 0; i < doc.childCount; i += 1) {
    const node = doc.child(i);
    const textLength = getBlockTextLength(node);
    const nodeStart = docPos;
    const nodeEnd = nodeStart + node.nodeSize;

    if (remaining <= textLength) {
      if (node.type.name === "table") {
        return mapOffsetInTable(node, nodeStart, remaining);
      }
      return mapOffsetInTextblock(node, nodeStart, remaining);
    }

    remaining -= textLength;

    if (i < doc.childCount - 1) {
      if (remaining === 0) {
        return nodeEnd - 1;
      }
      remaining -= 1;
    }

    docPos += node.nodeSize;
  }

  return doc.content.size;
};

const mapPosInTextblock = (node, nodePos, pos) => {
  const textStart = nodePos + 1;
  const textEnd = textStart + node.textContent.length;
  if (pos <= textStart) {
    return 0;
  }
  if (pos <= textEnd) {
    return pos - textStart;
  }
  return node.textContent.length;
};

const mapPosInCell = (cell, cellPos, pos) => {
  let offset = 0;
  let innerPos = cellPos + 1;
  for (let i = 0; i < cell.childCount; i += 1) {
    const block = cell.child(i);
    const blockPos = innerPos;
    if (pos <= blockPos) {
      return offset;
    }
    if (pos < blockPos + block.nodeSize) {
      return offset + mapPosInTextblock(block, blockPos, pos);
    }
    offset += block.textContent.length;
    if (i < cell.childCount - 1) {
      offset += 1;
    }
    innerPos += block.nodeSize;
  }
  return offset;
};

const mapPosInTable = (table, tablePos, pos) => {
  let offset = 0;
  const tableStart = tablePos + 1;
  let rowPos = tableStart;

  for (let r = 0; r < table.childCount; r += 1) {
    const row = table.child(r);
    const rowStart = rowPos + 1;
    let cellPos = rowStart;

    for (let c = 0; c < row.childCount; c += 1) {
      const cell = row.child(c);
      if (pos <= cellPos) {
        return offset;
      }
      if (pos < cellPos + cell.nodeSize) {
        return offset + mapPosInCell(cell, cellPos, pos);
      }
      offset += cell.textBetween(0, cell.content.size, "\n").length;
      if (c < row.childCount - 1) {
        offset += 1;
      }
      cellPos += cell.nodeSize;
    }

    if (r < table.childCount - 1) {
      offset += 1;
    }
    rowPos += row.nodeSize;
  }

  return offset;
};

const docPosToTextOffset = (doc, pos) => {
  const clamped = Math.max(0, Math.min(pos, doc.content.size));
  let docPos = 0;
  let offset = 0;

  for (let i = 0; i < doc.childCount; i += 1) {
    const node = doc.child(i);
    const textLength = getBlockTextLength(node);
    const nodeStart = docPos;
    const nodeEnd = nodeStart + node.nodeSize;

    if (clamped <= nodeStart) {
      return offset;
    }

    if (clamped < nodeEnd) {
      if (node.type.name === "table") {
        return offset + mapPosInTable(node, nodeStart, clamped);
      }
      return offset + mapPosInTextblock(node, nodeStart, clamped);
    }

    offset += textLength;
    if (i < doc.childCount - 1) {
      offset += 1;
    }

    docPos += node.nodeSize;
  }

  return offset;
};

const createSelectionStateAtOffset = (offset) => {
  const pos = textOffsetToDocPos(editorState.doc, offset);
  const selection = TextSelection.create(editorState.doc, pos);
  return editorState.apply(editorState.tr.setSelection(selection));
};

const getSelectionOffsets = () => {
  const { from, to } = editorState.selection;
  return {
    from: clampOffset(docPosToTextOffset(editorState.doc, from)),
    to: clampOffset(docPosToTextOffset(editorState.doc, to)),
  };
};

const getSelectionAnchorOffset = () =>
  clampOffset(docPosToTextOffset(editorState.doc, editorState.selection.anchor));

const logSelection = () => {
  const { from, to, anchor, head } = editorState.selection;
  const offsets = getSelectionOffsets();
  const anchorOffset = clampOffset(docPosToTextOffset(editorState.doc, anchor));
  const headOffset = clampOffset(docPosToTextOffset(editorState.doc, head));
  const signature = offsets.from + "-" + offsets.to + "-" + anchorOffset + "-" + headOffset;
  if (signature === lastSelectionSignature) {
    return;
  }
  lastSelectionSignature = signature;
  const selectionText = getText().slice(offsets.from, offsets.to);
  const preview =
    selectionText.length > 80
      ? `${selectionText.slice(0, 80)}...`
      : selectionText;
  console.log("[selection]", {
    from: offsets.from,
    to: offsets.to,
    anchor: anchorOffset,
    head: headOffset,
    length: selectionText.length,
    text: preview,
  });
};

const updateStatus = () => {
  const pageCount = layout ? layout.pages.length : 0;
  const focused = document.activeElement === inputEl ? "typing" : "idle";
  status.textContent = `${pageCount} pages | ${focused}`;
};

/* 渲染调度：合并到 rAF，减少重复重绘 */
const scheduleRender = () => {
  if (rafId) {
    return;
  }
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    const selection = getSelectionOffsets();
    const selectionRects = selectionToRects(
      layout,
      selection.from,
      selection.to,
      scrollArea.scrollTop,
      scrollArea.clientWidth,
      getText().length
    );
    renderer.render(layout, scrollArea, caretRect, selectionRects);
  });
};

const updateCaret = (updatePreferred) => {
  if (!layout) {
    caretRect = null;
    return;
  }
  caretRect = coordsAtPos(
    layout,
    caretOffset,
    scrollArea.scrollTop,
    scrollArea.clientWidth,
    getText().length
  );
  if (caretRect) {
    setInputPosition(caretRect.x, caretRect.y);
    if (updatePreferred) {
      preferredX = caretRect.x;
    }
  }
};

const updateLayout = () => {
  layout = layoutPipeline.layoutFromDoc(editorState.doc);
  spacer.style.height = `${layout.totalHeight}px`;
};

const syncAfterStateChange = () => {
  caretOffset = clampOffset(
    docPosToTextOffset(editorState.doc, editorState.selection.head)
  );
  updateCaret(pendingPreferredUpdate);
  pendingPreferredUpdate = true;
  logSelection();
  updateStatus();
  scheduleRender();
};

/* 事务应用：更新状态 -> 触发布局/光标/渲染 */
const dispatchTransaction = (tr) => {
  editorState = applyTransaction(editorState, tr);
  if (tr.docChanged) {
    updateLayout();
  }
  syncAfterStateChange();
};

const setSelectionOffsets = (anchorOffset, headOffset, updatePreferred) => {
  if (!Number.isFinite(anchorOffset) || !Number.isFinite(headOffset)) {
    return;
  }
  pendingPreferredUpdate = updatePreferred;
  const anchorPos = textOffsetToDocPos(editorState.doc, anchorOffset);
  const headPos = textOffsetToDocPos(editorState.doc, headOffset);
  if (!Number.isFinite(anchorPos) || !Number.isFinite(headPos)) {
    return;
  }
  const tr = editorState.tr.setSelection(
    TextSelection.create(editorState.doc, anchorPos, headPos)
  );
  dispatchTransaction(tr);
  logDelete("after", {
    caretOffset,
    textLength: getText().length,
    lastChar: getText().slice(-1) || null,
  });
};

const setCaretOffset = (offset, updatePreferred) => {
  setSelectionOffsets(offset, offset, updatePreferred);
};

const insertText = (text) => {
  if (!text) {
    return;
  }

  if (text === "\n") {
    pendingPreferredUpdate = true;
    runCommand(basicCommands.splitBlock, editorState, dispatchTransaction);
    return;
  }

  const { from, to } = editorState.selection;
  const tr = editorState.tr.insertText(text, from, to);
  pendingPreferredUpdate = true;
  dispatchTransaction(tr);
  logDelete("after", {
    caretOffset,
    textLength: getText().length,
    lastChar: getText().slice(-1) || null,
  });
};

const parseHtmlToSlice = (html) => {
  const parser = new window.DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  return PMDOMParser.fromSchema(schema).parseSlice(doc.body);
};

const insertTextWithBreaks = (text) => {
  if (!text) {
    return;
  }
  const segments = text.split("\n");
  segments.forEach((segment, index) => {
    if (segment.length > 0) {
      insertText(segment);
    }
    if (index < segments.length - 1) {
      insertText("\n");
    }
  });
};

const deleteSelectionIfNeeded = () => {
  if (!editorState.selection.empty) {
    runCommand(basicCommands.deleteSelection, editorState, dispatchTransaction);
    return true;
  }
  return false;
};

const deleteText = (direction) => {
  const textValue = getText();

  logDelete("before", {
    direction,
    caretOffset,
    textLength: textValue.length,
    prevChar: caretOffset > 0 ? textValue[caretOffset - 1] : null,
    nextChar: caretOffset < textValue.length ? textValue[caretOffset] : null,
  });

  if (deleteSelectionIfNeeded()) {
    logDelete("selection", {
      from: editorState.selection.from,
      to: editorState.selection.to,
    });
    return;
  }

  if (direction === "backward") {
    if (caretOffset === 0) {
      return;
    }

    if (textValue[caretOffset - 1] === "\n") {
      pendingPreferredUpdate = true;
      const selectionState = createSelectionStateAtOffset(caretOffset);
      logDelete("joinBackward", {
        caretOffset,
        from: editorState.selection.from,
        to: editorState.selection.to,
      });
      runCommand(basicCommands.joinBackward, selectionState, dispatchTransaction);
      return;
    }

    const fromPos = textOffsetToDocPos(editorState.doc, caretOffset - 1);
    const toPos = textOffsetToDocPos(editorState.doc, caretOffset);
    const rangeText = editorState.doc.textBetween(fromPos, toPos, "\n");
    logDelete("deleteRange", {
      fromOffset: caretOffset - 1,
      toOffset: caretOffset,
      fromPos,
      toPos,
      rangeText,
    });
    let tr = editorState.tr.setSelection(
      TextSelection.create(editorState.doc, toPos)
    );
    tr = tr.delete(fromPos, toPos);
    pendingPreferredUpdate = true;
    dispatchTransaction(tr);
    logDelete("after", {
      caretOffset,
      textLength: getText().length,
      lastChar: getText().slice(-1) || null,
    });
    return;
  }

  if (caretOffset >= textValue.length) {
    return;
  }

  if (textValue[caretOffset] === "\n") {
    pendingPreferredUpdate = true;
    const selectionState = createSelectionStateAtOffset(caretOffset);
    runCommand(basicCommands.joinForward, selectionState, dispatchTransaction);
    return;
  }

  const fromPos = textOffsetToDocPos(editorState.doc, caretOffset);
  const toPos = textOffsetToDocPos(editorState.doc, caretOffset + 1);
  let tr = editorState.tr.setSelection(
    TextSelection.create(editorState.doc, fromPos)
  );
  tr = tr.delete(fromPos, toPos);
  pendingPreferredUpdate = true;
  dispatchTransaction(tr);
  logDelete("after", {
    caretOffset,
    textLength: getText().length,
    lastChar: getText().slice(-1) || null,
  });
};

const computeLineEdgeOffset = (edge) => {
  if (!layout) {
    return null;
  }
  const info = findLineForOffset(layout, caretOffset, getText().length);
  if (!info) {
    return null;
  }
  return edge === "start" ? info.line.start : info.line.end;
};

const computeVerticalOffset = (direction) => {
  if (!layout) {
    return null;
  }
  const info = findLineForOffset(layout, caretOffset, getText().length);
  if (!info) {
    return null;
  }

  if (preferredX === null) {
    updateCaret(true);
  }

  let targetPageIndex = info.pageIndex;
  let targetLineIndex = info.lineIndex + (direction === "up" ? -1 : 1);

  if (targetLineIndex < 0) {
    targetPageIndex -= 1;
    if (targetPageIndex < 0) {
      return null;
    }
    targetLineIndex = layout.pages[targetPageIndex].lines.length - 1;
  } else if (targetLineIndex >= layout.pages[targetPageIndex].lines.length) {
    targetPageIndex += 1;
    if (targetPageIndex >= layout.pages.length) {
      return null;
    }
    targetLineIndex = 0;
  }

  const targetLine = layout.pages[targetPageIndex].lines[targetLineIndex];
  const pageX = Math.max(0, (scrollArea.clientWidth - layout.pageWidth) / 2);
  const localX = Math.max(0, preferredX - (pageX + targetLine.x));
  return offsetAtX(layout.font, targetLine, localX);
};

const moveHorizontal = (delta) => {
  setCaretOffset(caretOffset + delta, true);
};

const moveLineEdge = (edge) => {
  const nextOffset = computeLineEdgeOffset(edge);
  if (nextOffset === null) {
    return;
  }
  setCaretOffset(nextOffset, true);
};

const moveVertical = (direction) => {
  const nextOffset = computeVerticalOffset(direction);
  if (nextOffset === null) {
    return;
  }
  setCaretOffset(nextOffset, false);
};

const extendSelection = (nextOffset, updatePreferred) => {
  if (nextOffset === null) {
    return;
  }
  setSelectionOffsets(getSelectionAnchorOffset(), nextOffset, updatePreferred);
};

const handlePointerDown = (event) => {
  if (event.button !== 0) {
    return;
  }

  if (!layout) {
    inputEl.focus();
    return;
  }

  const rect = scrollArea.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const hitOffset = posAtCoords(
    layout,
    x,
    y,
    scrollArea.scrollTop,
    scrollArea.clientWidth,
    getText().length
  );

  if (hitOffset !== null) {
    preferredX = null;
    pointerAnchorOffset = event.shiftKey ? getSelectionAnchorOffset() : hitOffset;
    pointerId = event.pointerId;
    isPointerSelecting = true;
    scrollArea.setPointerCapture(pointerId);
    setSelectionOffsets(pointerAnchorOffset, hitOffset, true);
  }

  inputEl.focus();
};

const handlePointerMove = (event) => {
  if (!isPointerSelecting || event.pointerId !== pointerId) {
    return;
  }

  const rect = scrollArea.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const hitOffset = posAtCoords(
    layout,
    x,
    y,
    scrollArea.scrollTop,
    scrollArea.clientWidth,
    getText().length
  );

  if (hitOffset !== null) {
    setSelectionOffsets(pointerAnchorOffset, hitOffset, false);
  }
};

const finishPointerSelection = () => {
  if (isPointerSelecting && pointerId !== null) {
    scrollArea.releasePointerCapture(pointerId);
  }
  isPointerSelecting = false;
  pointerId = null;
};

const handlePointerUp = (event) => {
  if (event.pointerId !== pointerId) {
    return;
  }
  finishPointerSelection();
};

const runUndo = () => {
  runCommand(basicCommands.undo, editorState, dispatchTransaction);
};

const runRedo = () => {
  runCommand(basicCommands.redo, editorState, dispatchTransaction);
};

/* 输入事件：beforeinput 作为主入口，避免与 IME 冲突 */
const handleBeforeInput = (event) => {
  if (event.inputType == "insertCompositionText") {
    return;
  }

  if (isComposing || event.isComposing) {
    return;
  }

  switch (event.inputType) {
    case "insertText":
    case "insertReplacementText":
      event.preventDefault();
      insertTextWithBreaks(event.data || "");
      break;
    case "insertLineBreak":
    case "insertParagraph":
      event.preventDefault();
      insertText("\n");
      break;
    case "insertFromPaste":
      event.preventDefault();
      break;
    case "historyUndo":
      event.preventDefault();
      runUndo();
      break;
    case "historyRedo":
      event.preventDefault();
      runRedo();
      break;
    default:
      if (event.inputType && event.inputType.startsWith("delete")) {
        event.preventDefault();
        deleteText(
          event.inputType === "deleteContentForward" ? "forward" : "backward"
        );
      }
      break;
  }
};

const handleKeyDown = (event) => {
  if (event.isComposing) {
    return;
  }

  const metaKey = event.ctrlKey || event.metaKey;

  if (metaKey && event.shiftKey) {
    if (event.key === "L") {
      event.preventDefault();
      runCommand(setBlockAlign("left"), editorState, dispatchTransaction);
      return;
    }
    if (event.key === "C" || event.key === "E") {
      event.preventDefault();
      runCommand(setBlockAlign("center"), editorState, dispatchTransaction);
      return;
    }
    if (event.key === "R") {
      event.preventDefault();
      runCommand(setBlockAlign("right"), editorState, dispatchTransaction);
      return;
    }
  }

  if (metaKey) {
    if (event.key === "z" || event.key === "Z") {
      event.preventDefault();
      if (event.shiftKey) {
        runRedo();
      } else {
        runUndo();
      }
      return;
    }

    if (event.key === "y" || event.key === "Y") {
      event.preventDefault();
      runRedo();
      return;
    }
  }

  switch (event.key) {
    case "ArrowLeft": {
      event.preventDefault();
      const nextOffset = caretOffset - 1;
      if (event.shiftKey) {
        extendSelection(clampOffset(nextOffset), true);
      } else {
        moveHorizontal(-1);
      }
      break;
    }
    case "ArrowRight": {
      event.preventDefault();
      const nextOffset = caretOffset + 1;
      if (event.shiftKey) {
        extendSelection(clampOffset(nextOffset), true);
      } else {
        moveHorizontal(1);
      }
      break;
    }
    case "ArrowUp": {
      event.preventDefault();
      const nextOffset = computeVerticalOffset("up");
      if (event.shiftKey) {
        extendSelection(nextOffset, false);
      } else {
        moveVertical("up");
      }
      break;
    }
    case "ArrowDown": {
      event.preventDefault();
      const nextOffset = computeVerticalOffset("down");
      if (event.shiftKey) {
        extendSelection(nextOffset, false);
      } else {
        moveVertical("down");
      }
      break;
    }
    case "Home": {
      event.preventDefault();
      const nextOffset = computeLineEdgeOffset("start");
      if (event.shiftKey) {
        extendSelection(nextOffset, true);
      } else {
        moveLineEdge("start");
      }
      break;
    }
    case "End": {
      event.preventDefault();
      const nextOffset = computeLineEdgeOffset("end");
      if (event.shiftKey) {
        extendSelection(nextOffset, true);
      } else {
        moveLineEdge("end");
      }
      break;
    }
    case "Tab":
      event.preventDefault();
      insertText("  ");
      break;
    default:
      break;
  }

  if (!supportsBeforeInput && !metaKey && !event.altKey) {
    if (event.key === "Enter") {
      event.preventDefault();
      insertText("\n");
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      deleteText("backward");
      return;
    }

    if (event.key === "Delete") {
      event.preventDefault();
      deleteText("forward");
      return;
    }

    if (event.key.length === 1) {
      event.preventDefault();
      insertText(event.key);
    }
  }
};

/* IME 组合输入流程 */
const handleCompositionStart = () => {
  isComposing = true;
};

const handleCompositionUpdate = () => {};

const handleCompositionEnd = (event) => {
  isComposing = false;
  const text = event.data || inputEl.value;
  if (text) {
    insertTextWithBreaks(text);
  }
  inputEl.value = "";
};

const handlePaste = (event) => {
  event.preventDefault();
  const html = event.clipboardData?.getData("text/html") || "";
  if (html) {
    try {
      const slice = parseHtmlToSlice(html);
      const tr = editorState.tr.replaceSelection(slice);
      pendingPreferredUpdate = true;
      dispatchTransaction(tr);
      inputEl.value = "";
      return;
    } catch (error) {
      console.warn("Failed to parse HTML paste", error);
    }
  }
  const text = event.clipboardData?.getData("text/plain") || "";
  insertTextWithBreaks(text);
  inputEl.value = "";
};

const handleInput = () => {
  if (isComposing) {
    return;
  }
  inputEl.value = "";
};

attachInputBridge(inputEl, {
  onBeforeInput: handleBeforeInput,
  onInput: handleInput,
  onKeyDown: handleKeyDown,
  onCompositionStart: handleCompositionStart,
  onCompositionUpdate: handleCompositionUpdate,
  onCompositionEnd: handleCompositionEnd,
  onPaste: handlePaste,
});

inputEl.addEventListener("focus", updateStatus);
inputEl.addEventListener("blur", updateStatus);

/* 工具栏：切换段落/标题与对齐 */
tools?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }
  const action = button.dataset.action;
  switch (action) {
    case "block-paragraph":
      runCommand(setParagraph(), editorState, dispatchTransaction);
      break;
    case "block-h1":
      runCommand(setHeadingLevel(1), editorState, dispatchTransaction);
      break;
    case "block-h2":
      runCommand(setHeadingLevel(2), editorState, dispatchTransaction);
      break;
    case "block-h3":
      runCommand(setHeadingLevel(3), editorState, dispatchTransaction);
      break;
    case "align-left":
      runCommand(setBlockAlign("left"), editorState, dispatchTransaction);
      break;
    case "align-center":
      runCommand(setBlockAlign("center"), editorState, dispatchTransaction);
      break;
    case "align-right":
      runCommand(setBlockAlign("right"), editorState, dispatchTransaction);
      break;
    default:
      break;
  }
  inputEl.focus();
});

updateLayout();
syncAfterStateChange();

scrollArea.addEventListener("scroll", () => {
  updateCaret(false);
  scheduleRender();
});

scrollArea.addEventListener("pointerdown", handlePointerDown);
scrollArea.addEventListener("pointermove", handlePointerMove);
scrollArea.addEventListener("pointerup", handlePointerUp);
scrollArea.addEventListener("pointercancel", handlePointerUp);
scrollArea.addEventListener("click", () => inputEl.focus());

window.addEventListener("resize", () => {
  updateCaret(false);
  scheduleRender();
});
