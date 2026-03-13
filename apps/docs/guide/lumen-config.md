# 如何配置编辑器

`apps/lumen/src/editor/config.ts` 是当前应用层的配置入口。

## 当前配置项来源

`createPlaygroundDebugFlags()` 从 URL query 里读取调试和运行标志。

当前支持的主要参数有：

- `permissionMode=full|comment|readonly`
- `contrast=high`
- `highContrast=1`
- `inputRules=1`
- `debugPerf=1`
- `paginationWorker=1`
- `paginationWorkerForce=1`
- `paginationIncremental=1`
- `paginationIncrementalOff=1`
- `paginationMaxPages=<number>`
- `paginationSettleMs=<number>`
- `pageReuseProbe=<number>`
- `pageReuseRootProbe=<number>`

## 页面与排版配置

`createCanvasSettings()` 里当前最关键的参数是：

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
  font: "16px Arial"
}
```

这些值直接影响：

- 页面尺寸
- 每页可放内容
- 断行高度
- 段间距
- Word 导出分页接近程度

## Worker 配置

如果打开 `enablePaginationWorker`，会在 `editorMount.ts` 中把 `PaginationDocWorkerClient` 注入到 `settings.paginationWorker.provider`。

适用场景：

- 大文档
- 想减少主线程分页压力

## 实际接线位置

`editorMount.ts` 会这样消费配置：

```ts
const settings = createCanvasSettings(
  flags.debugPerf,
  flags.enablePaginationWorker,
  flags.forcePaginationWorker,
  flags.locale,
  flags.highContrast
);
```

然后把它塞进：

```ts
editorProps: {
  canvasViewConfig: {
    settings,
  },
}
```

## 推荐修改策略

1. 页面尺寸、边距、字体、行高统一在 `config.ts` 改
2. 不要把布局配置散落到扩展里
3. 业务开关通过 `flags` 控制，避免写死在 `editorMount.ts`
