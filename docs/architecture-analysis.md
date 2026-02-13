# LumenPage 架构与未实现点分析

## 范围

- Workspace 结构、核心数据流、扩展点设计
- 重点列出明显未实现或待补齐的功能点

## 结构概览

- Monorepo 使用 pnpm workspace，分为 headless core、Canvas 视图层、节点渲染包与 kit、以及 playground 演示应用
- 设计目标是：core 与 DOM 解耦，视图层负责渲染与输入，节点包提供布局/渲染扩展

## 关键数据流

1. 输入事件（beforeinput/keydown/composition/paste）进入 view-canvas 的 handlers
2. handlers 调用 core 的 editorOps / commands 生成交易并更新 EditorState
3. LayoutPipeline 将 doc 转成 runs → lines → pages，得到可视布局
4. Renderer 根据 layout 进行 Canvas 绘制，并结合 selection/caret 做高亮与光标
5. 位置映射在 text offset ↔ PM pos ↔ canvas coords 之间闭环

## 模块职责

### core

- EditorState/Transaction 封装与基础命令（undo/redo/插入/删除/块级变更）
- 文档 → runs → lines → pages 的布局管线
- 文本偏移与 ProseMirror position 映射

### view-canvas

- Canvas 绘制与虚拟化（分页缓存、只渲染可见页）
- 光标/选区计算与绘制
- 输入桥接与键盘/IME/paste 事件处理

### node-\* 与 kit-basic

- node-\* 提供节点布局与绘制（paragraph/heading/table）
- kit-basic 输出默认 schema + 默认 NodeRendererRegistry

### playground

- 作为集成演示：初始化 schema、state、layout、renderer、输入与事件绑定

## 扩展点设计

- NodeRendererRegistry 作为核心扩展点：
  - toRuns：把节点转换为 runs
  - layoutBlock：自定义块级布局
  - splitBlock：支持跨页拆分
  - renderLine：自定义绘制
- LayoutPipeline 在布局阶段根据 registry 决定如何处理不同节点

## 未实现/待补齐

- IME 组合态更新未实现：compositionupdate 为空，缺少中间态渲染/偏移更新
- 表格跨页拆分缺失：table 只有 layoutBlock，没有 splitBlock/allowSplit；大表只能整体占用页面
- 折行策略偏粗：按字符测量与换行，缺少词边界/语言分词（如 UAX#14）
- 无 renderer 的非文本块节点将被 docToRuns 跳过，缺少 fallback/占位渲染
- CanvasRenderer 为空壳继承，尚未有差异化策略或扩展
- legacy LayoutEngine 仍保留但未接入主流程，属于遗留路径

## 备注

- 当前结构已形成“headless + canvas”的闭环，但一些高级排版、IME 体验、复杂节点分页仍需补齐
