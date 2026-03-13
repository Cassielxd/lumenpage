# Lumen 配置参数

## `PlaygroundDebugFlags`

文件：

- `apps/lumen/src/editor/config.ts`

```ts
type PlaygroundDebugFlags = {
  locale: PlaygroundLocale;
  highContrast: boolean;
  permissionMode: "full" | "comment" | "readonly";
  enableInputRules: boolean;
  debugPerf: boolean;
  enablePaginationWorker: boolean;
  forcePaginationWorker: boolean;
};
```

## `createPlaygroundDebugFlags()`

作用：

- 从 URL query 读取当前调试和运行开关
- 统一给 `editorMount.ts` 使用

## Query 参数表

| 参数 | 说明 | 常见值 |
| --- | --- | --- |
| `permissionMode` | 权限模式 | `full` / `comment` / `readonly` |
| `contrast` | 对比度模式 | `high` / `normal` |
| `highContrast` | 高对比开关 | `1` / `true` |
| `inputRules` | 输入规则开关 | `1` / `true` |
| `debugPerf` | 性能调试日志 | `1` / `true` |
| `paginationWorker` | 分页 worker 开关 | `1` / `true` |
| `paginationWorkerForce` | 强制走 worker | `1` / `true` |
| `paginationIncremental` | 增量分页开关 | `1` / `true` |
| `paginationIncrementalOff` | 显式关闭增量分页 | `1` / `true` |
| `paginationMaxPages` | 单次增量分页最大页数 | 数字 |
| `paginationSettleMs` | 增量分页稳定延迟 | 数字 |
| `pageReuseProbe` | 分页复用探测半径 | 数字 |
| `pageReuseRootProbe` | rootIndex 复用探测半径 | 数字 |

## `createCanvasSettings()`

作用：

- 生成 Canvas 编辑器和分页引擎使用的布局配置

主要参数：

- `debugPerf`
- `enablePaginationWorker`
- `forcePaginationWorker`
- `locale`
- `highContrast`

输出内容包括：

- 页面宽高
- 页面边距
- 行高
- 字体
- block spacing
- page reuse 配置
- pagination worker 配置

## 常用调整案例

### 调大页面边距

```ts
margin: {
  top: 96,
  right: 96,
  bottom: 96,
  left: 96,
}
```

### 调整默认字号和行高

```ts
font: "18px Arial",
lineHeight: 30,
```

### 强制开启分页 worker

```ts
const flags = {
  ...createPlaygroundDebugFlags(),
  enablePaginationWorker: true,
  forcePaginationWorker: true,
};
```

## 配置应该放哪

推荐按下面边界处理：

- 页面和分页参数：`config.ts`
- 扩展清单：`documentExtensions.ts`
- 浏览器态插件和交互：`editorMount.ts`
