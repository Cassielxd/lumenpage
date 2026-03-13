# Canvas / Layout API

本页说明 `lumenpage-view-canvas`、`lumenpage-layout-engine` 和 `lumenpage-render-engine` 的职责分工。

## `lumenpage-view-canvas`

负责：

- `CanvasEditorView`
- 选区、光标、输入处理
- 页面绘制
- node view 运行时

## `lumenpage-layout-engine`

负责：

- 断行
- 块布局
- 页面切分
- 分页结果缓存与复用

## `lumenpage-render-engine`

负责：

- 通用默认 renderer
- mark adapter
- 文本 run 和基础绘制适配

## 当前边界

以下内容不再放入核心渲染层：

- `audio`
- `bookmark`
- `file`
- `webPage`
- `callout`
- `embedPanel`
- `signature`
- `template`

这些能力已回到对应 `extension-*` 包。
