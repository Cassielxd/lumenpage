/*
 * 文件说明：应用入口与编辑主循环。
 * 主要职责：初始化状态、布局、渲染；处理输入与选区；同步光标与分页渲染。
 * 关键逻辑：文本偏移 <-> PM 位置映射、表格位置映射、渲染调度。
 */

import { DOMParser as PMDOMParser } from "prosemirror-model";
import { TextSelection } from "prosemirror-state";

import { schema, docToText, createDocFromText, createDefaultNodeRendererRegistry } from "lumenpage-kit-basic";



import {
  applyTransaction,
  basicCommands,
  createEditorOps,
  createEditorState,
  createSelectionLogger,
  createSelectionStateAtOffset,
  docPosToTextOffset,
  getSelectionAnchorOffset,
  getSelectionOffsets,
  LayoutPipeline,
  runCommand,
  setBlockAlign,
  setHeadingLevel,
  setParagraph,
  textOffsetToDocPos,
} from "lumenpage-core";

import {
  attachInputBridge,
  createInputHandlers,
  createPointerHandlers,
  createHtmlParser,
  createRenderSync,
  createSelectionMovement,
  coordsAtPos,
  posAtCoords,
  findLineForOffset,
  offsetAtX,
  selectionToRects,
  measureTextWidth,
  Renderer,
} from "lumenpage-view-canvas";


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


  measureTextWidth,
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





let editorState = createEditorState({ schema, createDocFromText, json: initialDocJson });


let layout = null;


let rafId = 0;


let caretOffset = 0;


let caretRect = null;


let preferredX = null;


let pendingPreferredUpdate = true;


let isComposing = false;










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


const logSelection = createSelectionLogger({
  getText,
  docPosToTextOffset,
  clampOffset,
});

const {
  updateStatus,
  scheduleRender,
  updateCaret,
  updateLayout,
  syncAfterStateChange,
  dispatchTransaction,
} = createRenderSync({
  getEditorState: () => editorState,
  setEditorState: (state) => {
    editorState = state;
  },
  applyTransaction,
  layoutPipeline,
  renderer,
  spacer,
  scrollArea,
  status,
  inputEl,
  getText,
  clampOffset,
  docPosToTextOffset,
  getSelectionOffsets,
  selectionToRects,
  coordsAtPos,
  logSelection,
  getCaretOffset: () => caretOffset,
  setCaretOffsetValue: (value) => {
    caretOffset = value;
  },
  getCaretRect: () => caretRect,
  setCaretRect: (value) => {
    caretRect = value;
  },
  setPreferredX: (value) => {
    preferredX = value;
  },
  getPendingPreferredUpdate: () => pendingPreferredUpdate,
  setPendingPreferredUpdate: (value) => {
    pendingPreferredUpdate = value;
  },
  getLayout: () => layout,
  setLayout: (value) => {
    layout = value;
  },
  getRafId: () => rafId,
  setRafId: (value) => {
    rafId = value;
  },
  setInputPosition,
});

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





const {
  setCaretOffset,
  insertText,
  insertTextWithBreaks,
  deleteSelectionIfNeeded,
  deleteText,
} = createEditorOps({
  getEditorState: () => editorState,
  dispatchTransaction,
  runCommand,
  basicCommands,
  pendingPreferredUpdateRef: {
    set: (value) => {
      pendingPreferredUpdate = value;
    },
  },
  getCaretOffset: () => caretOffset,
  getText,
  setSelectionOffsets,
  textOffsetToDocPos,
  createSelectionStateAtOffset,
  logDelete,
});
const parseHtmlToSlice = createHtmlParser(schema, PMDOMParser);


const {
  computeLineEdgeOffset,
  computeVerticalOffset,
  moveHorizontal,
  moveLineEdge,
  moveVertical,
  extendSelection,
} = createSelectionMovement({
  getLayout: () => layout,
  getCaretOffset: () => caretOffset,
  setCaretOffset,
  getText,
  getPreferredX: () => preferredX,
  updateCaret,
  scrollArea,
  findLineForOffset,
  offsetAtX,
  getSelectionAnchorOffset: () =>
    getSelectionAnchorOffset(editorState, docPosToTextOffset, clampOffset),
  setSelectionOffsets,
});

const {
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
} = createPointerHandlers({
  getLayout: () => layout,
  scrollArea,
  inputEl,
  getText,
  posAtCoords,
  setSelectionOffsets,
  getSelectionAnchorOffset: () =>
    getSelectionAnchorOffset(editorState, docPosToTextOffset, clampOffset),
  setPreferredX: (value) => {
    preferredX = value;
  },
});

const {
  handleBeforeInput,
  handleInput,
  handleKeyDown,
  handleCompositionStart,
  handleCompositionUpdate,
  handleCompositionEnd,
  handlePaste,
} = createInputHandlers({
  getEditorState: () => editorState,
  dispatchTransaction,
  runCommand,
  basicCommands,
  setBlockAlign,
  insertText,
  insertTextWithBreaks,
  deleteText,
  computeLineEdgeOffset,
  computeVerticalOffset,
  moveHorizontal,
  moveVertical,
  moveLineEdge,
  extendSelection,
  clampOffset,
  getCaretOffset: () => caretOffset,
  supportsBeforeInput,
  getIsComposing: () => isComposing,
  setIsComposing: (value) => {
    isComposing = value;
  },
  inputEl,
  setPendingPreferredUpdate: (value) => {
    pendingPreferredUpdate = value;
  },
});






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

