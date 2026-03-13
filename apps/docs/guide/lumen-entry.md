# 从 Lumen 入口开始

如果你是要接入当前项目，最应该先看的不是底层 `core`，而是 `apps/lumen` 这条应用入口链路。

## 入口链路

当前应用层的主链路是：

1. `apps/lumen/src/App.vue`
2. `apps/lumen/src/editor/editorMount.ts`
3. `apps/lumen/src/editor/config.ts`
4. `apps/lumen/src/editor/documentExtensions.ts`

这四个文件分别解决不同问题：

- `App.vue`：页面壳、工具栏、目录面板、footer 统计
- `editorMount.ts`：真正创建 `Editor` 和 `CanvasEditorView`
- `config.ts`：分页、worker、权限、高对比、locale 等运行配置
- `documentExtensions.ts`：文档级扩展组装

## 推荐阅读顺序

### 第一步：看 `App.vue`

这里决定了页面层怎么挂编辑器：

- 编辑器挂载容器在哪里
- 工具栏怎么接
- 目录面板怎么接
- footer 统计怎么接

### 第二步：看 `editorMount.ts`

这里是核心入口。主要做了几件事：

- 创建 `settings`
- 组装 `extensions`
- 创建 `Editor`
- 从 `editor.view` 拿到 `CanvasEditorView`
- 绑定统计、TOC、scroll、selectionUpdate 等运行时回调

### 第三步：看 `config.ts`

这里决定：

- 页面尺寸
- 页边距
- 行高
- 字体
- block spacing
- worker 开关
- query 参数调试能力

### 第四步：看 `documentExtensions.ts`

这里决定文档支持哪些块和 mark。

## 什么时候再看底层包

只有在你要做下面这些事情时，再继续往下读底层 API：

- 自定义扩展
- 改分页行为
- 改 renderer / node view
- 改 command / transaction 行为
