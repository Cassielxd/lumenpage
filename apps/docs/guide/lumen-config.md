# Lumen 运行时配置

Lumen 的运行时配置主要集中在：

- `apps/lumen/src/editor/config.ts`
- `apps/lumen/src/editor/i18n.ts`
- `apps/lumen/src/editor/collaboration.ts`

其中 `config.ts` 是入口。

## `createPlaygroundDebugFlags()`

这个函数负责从 URL 和本地存储读取运行时 flags。

当前关键项包括：

- `locale`
- `highContrast`
- `permissionMode`
- `enableInputRules`
- `debugPerf`
- `debugGhostTrace`
- `enablePaginationWorker`
- `forcePaginationWorker`
- `collaborationEnabled`
- `collaborationUrl`
- `collaborationDocument`
- `collaborationField`
- `collaborationToken`
- `collaborationUserName`
- `collaborationUserColor`

## 协作参数来源

协作参数不是只靠 URL。

当前逻辑是：

- URL 可显式覆盖
- 本地存储负责持久化
- 页面刷新后会继续使用上次的协作设置

这比把所有参数长期堆在 query 里更接近真实产品行为。

## `createCanvasSettings()`

这个函数决定分页视图和布局相关的核心参数。

默认会产出一组页面配置，例如：

```ts
{
  pageWidth: 794,
  pageHeight: 1123,
  pageGap: 24,
  margin: { top: 72, right: 72, bottom: 72, left: 72 },
  lineHeight: 26,
  blockSpacing: 8,
  paragraphSpacingBefore: 0,
  paragraphSpacingAfter: 8,
  font: "16px Arial",
}
```

这些值直接影响：

- 分页结果
- 页面版心
- 文本排版
- 页面 chrome
- 标尺拖拽后的即时重排

## 分页 worker 相关配置

Lumen 支持分页 worker，并且现在已经把“即时同步布局”和“worker 路径”做了更清晰的区分。

主要开关包括：

- `paginationWorker`
- `paginationWorkerForce`
- `paginationIncremental`
- `paginationIncrementalOff`
- `paginationMaxPages`
- `paginationSettleMs`

适合场景：

- 大文档
- 高频分页重算
- 需要降低主线程压力

## 页面 chrome

`createCanvasSettings()` 里还会注册 `renderPageChrome`。

当前 Lumen 用它做：

- 页面 corner
- 页面视觉辅助线

而标尺并不直接画在 page canvas 内部，它属于 Lumen 产品壳自己的工作区 UI。

## 和标尺、标注的关系

当前这两类能力分工明确：

- 标尺
  读分页信息，直接调整 `settings.margin`
- 标注
  不写进文档模型，属于覆盖层和工作区能力

也就是说：

- 页面布局配置在 `config.ts`
- 产品壳交互在 `App.vue` 和对应组件
- 不把产品层工作区逻辑塞回 engine 核心
