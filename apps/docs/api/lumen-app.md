# Lumen App 入口 API

这一页不讲抽象 API，直接讲 `apps/lumen` 对外真正可用的入口。

## `mountPlaygroundEditor()`

文件：

- `apps/lumen/src/editor/editorMount.ts`

当前应用层最核心的工厂就是这个函数。

## 参数

```ts
type MountPlaygroundEditorParams = {
  host: HTMLElement;
  statusElement?: HTMLElement | null;
  flags: PlaygroundDebugFlags;
  onTocOutlineChange?: ((snapshot: TocOutlineSnapshot) => void) | null;
  tocOutlineEnabled?: boolean;
  onStatsChange?: ((stats: {
    pageCount: number;
    currentPage: number;
    nodeCount: number;
    pluginCount: number;
    wordCount: number;
    selectedWordCount: number;
    blockType: string;
  }) => void) | null;
};
```

## 返回值

```ts
type MountedPlaygroundEditor = {
  view: CanvasEditorView;
  setTocOutlineEnabled: (enabled: boolean) => void;
  isTocOutlineEnabled: () => boolean;
  destroy: () => void;
};
```

## 它做了什么

- 创建分页配置
- 注入 worker provider
- 组装文档扩展和运行时扩展
- 创建 `Editor`
- 创建并返回 `CanvasEditorView`
- 绑定 stats、selection、scroll、TOC 等回调

## 最小使用方式

```ts
const mounted = mountPlaygroundEditor({
  host: editorHost.value!,
  flags: createPlaygroundDebugFlags(),
});

const view = mounted.view;
```
