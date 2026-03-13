# 工具栏能力

`apps/lumen` 的工具栏不是一组零散按钮，而是一套按场景拆分的动作体系。

目录位置：

- `apps/lumen/src/editor/toolbarActions/`

## 目录结构

- `textFormatActions.ts`：加粗、斜体、删除线、列表、引用等基础文本格式
- `textStyleActions.ts`：文本样式、颜色、字号等样式类动作
- `headingInlineActions.ts`：标题和部分行内格式切换
- `tableActions.ts`：表格插入、行列操作、合并拆分
- `toolsActions.ts`：业务工具块，例如签名、标签、书签、嵌入等
- `layoutActions.ts`：页面布局相关操作
- `pageAppearanceActions.ts`：页面表现和外观设置
- `inlineMediaActions.ts`：行内媒体或嵌入类动作
- `insertAdvancedActions.ts`：高级插入动作
- `quickInsertActions.ts`：快捷插入
- `importActions.ts`：导入能力
- `exportActions.ts`：导出能力
- `markdownActions.ts`：Markdown 导入导出相关
- `searchReplaceActions.ts`：查找替换
- `colorPickerActions.ts`：颜色拾取

## 触发链路

工具栏动作大致按下面的链路执行：

1. `EditorToolbar.vue` 收到点击
2. `actionHandlers.ts` 负责分发
3. 对应 `handlers/*` 归类处理
4. 最终进入具体的 `*Actions.ts`
5. 调用 `editor.commands` 或 `view.dispatch`

## 推荐阅读顺序

1. `actionHandlers.ts`
2. `handlers/textHandlers.ts`
3. `handlers/tableHandlers.ts`
4. `handlers/toolsHandlers.ts`
5. 再看对应的 `*Actions.ts`

## 适合怎么扩展

如果你要加一个新按钮，建议按这套结构做：

1. 先决定它属于哪一类动作
2. 在对应 `*Actions.ts` 增加实现
3. 在 `handlers/*` 中注册入口
4. 在 `toolbarCatalog.ts` 中补菜单项

## 典型例子

### 1. 文本格式按钮

适合加到：

- `textFormatActions.ts`

### 2. 插入新业务块

适合加到：

- `toolsActions.ts`

### 3. 表格菜单

适合加到：

- `tableActions.ts`

### 4. 导入导出

适合加到：

- `importActions.ts`
- `exportActions.ts`
