说明：该文档描述 headless ProseMirror + Canvas 的实现步骤。

è¯´æï¼è¯¥ææ¡£æè¿° headless ProseMirror + Canvas çå®ç°æ­¥éª¤ã

ï»¿# Headless ProseMirror + Canvas åé¡µç¼è¾å¨å®ç°ææ¡£

## ç®æ 

- ä»¥ ProseMirror ä½ä¸ºææ¡£æ¨¡åä¸äºå¡å
  æ ¸ï¼å®å
  ¨ headlessï¼ä¸ä½¿ç¨ EditorViewï¼ã
- ä¿çèªç åé¡µå¸å±ä¸ Canvas æ¸²æï¼è·å¾ç±»ä¼¼è
  ¾è®¯ææ¡£çåé¡µä½éªã
- è¾å
  ¥ä¸ IME ç±éè textarea æ¥æ¶ï¼äºå¡é©±å¨æ¸²æã

## ææ¯éå

- ProseMirror core: prosemirror-model/state/transform/commands/history/inputrules/keymap
- åä½å¯éï¼prosemirror-collab æ Yjs
- æå»ºæ¹å¼ï¼äºéä¸ï¼
  1. æ¬å°æå»ºï¼Vite/ESBuild/Rollup + npm ä¾èµï¼æ¨èï¼
  2. æ æå»ºï¼ä½¿ç¨ import map + CDN ESMï¼éåååï¼

## æ»ä½æ¶æ

- ç¼è¾å
  æ ¸ï¼EditorState + Schema + Transaction + pluginsï¼history/collab/inputrulesï¼
- è¾å
  ¥æ¡¥æ¥ï¼textarea æè· beforeinput/keydown/composition/paste â çæ transaction
- å¸å±å¼æï¼state.doc â runs â lines â pagesï¼è¾åºä½ç½®æ å°ï¼
- æ¸²æå¼æï¼Canvas ç»å¶åé¡µãææ¬ãéåºãå
  æ 
- æ å°å±ï¼coordsAtPos / posAtCoords / selectionRects

```
Input/IME â Transaction â EditorState â Layout â Canvas Render
                    â                       â
               Selection update â coords/pos mapping
```

## ç®å½ç»æè§åï¼å»ºè®®ï¼

- src/editor/schema.js: å®ä¹ Schemaãmarksãnodes
- src/editor/state.js: createStateãdispatchTransactionãplugin æ³¨å
  ¥
- src/editor/commands.js: å°è£
  å¸¸ç¨ç¼è¾å½ä»¤ä¸å¿«æ·é®æ å°
- src/input/bridge.js: beforeinput/keydown/composition/paste å¤ç
- src/layout/engine.js: ææ¡£å°åé¡µå¸å±çå
  ¥å£
- src/layout/textRuns.js: doc â runsï¼å¸¦æ ·å¼ï¼
- src/layout/lineBreaker.js: è¡å
  æ­è¡ç­ç¥
- src/layout/posIndex.js: pos â coords æ å°
- src/render/canvasRenderer.js: Canvas æ¸²æ
- src/render/selection.js: selection â rects
- src/core/virtualization.js: å¯è§åé¡µèå´

## å

³é®æ°æ®ç»æ

- LayoutResult
  - pages: PageLayout[]
  - pageWidth/pageHeight/pageGap/margin/lineHeight/font
  - totalHeight
- PageLayout
  - index
  - lines: LineLayout[]
- LineLayout
  - fromPos/toPos
  - y/height
  - runs: RunLayout[]
- RunLayout
  - fromPos/toPos
  - text
  - style: { font, size, color, bold, italic, ... }
  - x/width
- PosIndex
  - posToLine: Map<pos, {pageIndex, lineIndex, x, y}>
  - lineToPos: æ¯è¡å¯æ runs è¿è¡äºåå®ä½

## äºå¡ä¸æ¸²æé¾è·¯

1. è¾å
   ¥äºä»¶çæ transaction
2. dispatchTransaction æ´æ° EditorState
3. ä» state.doc çæ LayoutResult
4. æ´æ° spacer/scroll é«åº¦ï¼éç» Canvas
5. æ ¹æ® selection æ´æ° caret/selection ç»å¶
6. æ´æ° textarea ä½ç½®ï¼ç¨äº IME åéæ¡ï¼

## è¾å

¥æ¡¥æ¥ï¼headlessï¼

- beforeinput: ä½ä¸ºä¸»å
  ¥å£ï¼æ¯æ insertText/delete/insertParagraph ç­ï¼
- keydown: å¤çå¯¼èªä¸å¿«æ·é®ï¼Arrow/Home/End/Ctrl+B/I/U/Z/Yï¼
- composition: compositionstart/update/end
- paste: HTML â Slice â replaceSelectionï¼çº¯ææ¬ â insertText

è¾å
¥äºä»¶æ å°ï¼ç¤ºä¾ï¼ï¼

- insertText â tr.insertText(text, from, to)
- deleteContentBackward â deleteSelection æ joinBackward
- insertParagraph â splitBlock
- insertFromPaste â replaceSelection(slice)

## IME å¤çï¼å

³é®ï¼

- compositionstart: è®°å½èµ·å§ selection
- compositionupdate: ä¸ç´æ¥åå
  ¥ docï¼ç»å¶ä¸´æ¶ overlayï¼æä½¿ç¨ä¸´æ¶ decorationï¼
- compositionend: å°æç»ææ¬æå
  ¥ docï¼æ¸
  ç overlay
- textarea å§ç»å®ä½å° caret ç coordsAtPos ä½ç½®ï¼ä¿è¯åéæ¡åç¡®

## åæ æ å°

- coordsAtPos(pos)
  - ä» PosIndex è·åè¡ä¿¡æ¯ï¼è®¡ç® x/y/height
- posAtCoords(x,y)
  - æ¾å°é¡µä¸è¡ â å¨ runs å
    æå®½åº¦äºåå®ä½å­ç¬¦ä½ç½®
- selectionRects(from,to)
  - æè¡åççæç©å½¢ï¼Canvas ç»å¶é«äº®

## å¸å±å¼æç»è

- doc â runs
  - ä½¿ç¨ doc.nodesBetween è¾åºææ¬ä¸ marks
  - éææ¬èç¹ï¼å¾ç/å
    ¬å¼ï¼ä½ä¸º inline atomï¼å ä½ä¸ä¸ª glyph
- è¡å
  æ­è¡
  - ä½¿ç¨ Intl.Segmenter + UAX#14 è§å
  - æ¯ä¸ª run ææ ·å¼æµéå®½åº¦ï¼ç¼å­ TextMetrics
- åé¡µ
  - ä»¥ pageHeight/margin/lineHeight åé¡µ
  - å¯¹ block èç¹å®ä¹åé¡µç­ç¥ï¼å¯æåãä¸å¯æåãå­¤å¿/å¯¡å¦è¡ï¼
- è¡¨æ ¼/å¾ç
  - è¡¨æ ¼å
    æè¡å
    å¸å±æ blockï¼è¶
    é¡µæ¶æè¡ææ´ä½ä¸ç§»
  - å¾çæ attrs å®½é«å ä½ï¼å¯å¼æ­¥å è½½åå·æ°å¸å±

## æ¸²æå¼æ

- åªæ¸²æå¯è§é¡µï¼virtualizationï¼
- ç»å¶é¡ºåº
  1. èæ¯é¡µ
  2. ææ¬ runs
  3. è£
     é¥°ï¼ä¸åçº¿/é«äº®ï¼
  4. éåº
  5. å
     æ 
- é« DPI éé
  ï¼canvas.width/height = css \* devicePixelRatio

## åªè´´æ¿

- ç²è´´ HTMLï¼DOMParser.fromSchema(schema).parseSlice
- å¤å¶ï¼DOMSerializer.fromSchema(schema).serializeFragment
- çº¯ææ¬ï¼textBetween + insertText

## åä½ä¸åå²

- history æä»¶ï¼undo/redo
- collab/Yjsï¼æ¥æ¶ steps â dispatchTransaction â éæ
- åä½å
  æ ï¼è¿ç«¯ selection è½¬ä¸ºè£
  é¥°ç»å¶

## åé¶æ®µæè§£ï¼ææ­¤å®ç°ï¼

### Phase 0: åºç¡å·¥ç¨

- éå®æå»ºæ¹å¼ï¼Vite æ import mapï¼
- å¼å
  ¥ ProseMirror ä¾èµ
- æ°å»º src/editor ä¸ src/layout ç®å½
- éªæ¶ï¼è½å¨æµè§å¨è¿è¡å¹¶å è½½ä¾èµ

### Phase 1: PM å

æ ¸æ¿æ¢ DocModel

- å»ºç« Schemaï¼doc/paragraph/textï¼
- åå»º EditorState ä¸ dispatchTransaction
- ç¨ state.doc.textBetween æ¿ä»£ doc.getText
- éªæ¶ï¼æå
  ¥/å é¤ææ¬é©±å¨éæ

### Phase 2: runs ä¸æ ·å¼

- å®ç° doc â runsï¼å
  å« marksï¼
- LayoutEngine ä½¿ç¨ runs è¿è¡è¡å
  æç
- æ¸²æä¸åæ ·å¼ï¼bold/italic/colorï¼
- éªæ¶ï¼ä¸å marks ææ¬æ­£ç¡®æ¸²æ

### Phase 3: åæ æ å°ä¸éåº

- å®ç° coordsAtPos / posAtCoords
- selectionRects ç¨äºç»å¶éåº
- æ´æ° caret å®ä½é»è¾
- éªæ¶ï¼é¼ æ ç¹å»å®ä½ãæéãé®çç§»å¨æ­£ç¡®

### Phase 4: è¾å

¥æ¡¥æ¥å®å

- beforeinput è¦ç insert/delete/paragraph
- keydown å¿«æ·é®ä¸å¯¼èª
- composition å¤ç IME
- paste è§£æ HTML
- éªæ¶ï¼ä¸­æè¾å
  ¥ãç²è´´ãæ¤é/éåæ­£å¸¸

### Phase 5: å¤æèç¹

- åè¡¨ãå¼ç¨ãä»£ç å
- å¾çä¸è¡¨æ ¼ï¼inline/blockï¼
- åé¡µç­ç¥ï¼ç¦æ­¢æ­é¡µ/å¯æåï¼
- éªæ¶ï¼å¤æèç¹åé¡µä¸å¸å±ç¨³å®

### Phase 6: æ§è½ä¸åä½

- å¢éå¸å±ï¼ä»
  éæåå½±ååï¼
- é¡µé¢ç¼å­/å±é¨éç»
- åä½æ¥å
  ¥ï¼collab æ Yjsï¼
- éªæ¶ï¼å¤§ææ¡£æ»å¨ä¸è¾å
  ¥æµç

## éªæ¶æ¸

åï¼æå°ï¼

- è¾å
  ¥ï¼æ®éæå­ãåè½¦ãéæ ¼ãæ¤é/éå
- éåºï¼ç¹å»ãæéãShift+æ¹åé®
- IMEï¼ä¸­æè¾å
  ¥ãåéæ¡ä½ç½®æ­£ç¡®
- åé¡µï¼è·¨é¡µæå
  ¥ãå é¤ååé¡µç¨³å®
- ç²è´´ï¼HTML ä¸çº¯ææ¬

## åèæ¥å£ï¼ä¼ªä»£ç ï¼

```js
// src/editor/state.js
export function createEditorState(schema, plugins) {}
export function dispatchTransaction(tr) {}

// src/layout/engine.js
export function layoutFromDoc(doc, settings) {}

// src/layout/posIndex.js
export function coordsAtPos(layout, pos) {}
export function posAtCoords(layout, x, y) {}

// src/input/bridge.js
export function attachInputBridge(textarea, editorApi) {}
```
