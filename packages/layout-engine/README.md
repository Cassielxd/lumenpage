# lumenpage-layout-engine

> 目录：`packages/layout-engine`

## 包定位
分页与布局计算层，负责块级测量、分页拆分、增量复用和布局结果生成。

## 当前职责
- 计算页面、块、行的布局结构。
- 处理分页时的切片、续排、复用和缓存。
- 为 view-canvas 提供可绘制的分页布局数据。

## 入口与结构
- 包名：`lumenpage-layout-engine`
- 主要入口：`src/index.ts`
- 构建方式：以 workspace 包形式被其他包或应用引用

## 对外导出
- `export { LayoutPipeline } from "./engine";`
- `export { breakLines } from "./lineBreaker";`
- `export { docToRuns, textToRuns, textblockToRuns } from "./textRuns";`
- `export { createNodeRegistry } from "./nodeRegistryBuilder";`
- `export { NodeRendererRegistry } from "./nodeRegistry";`
- `export type {`

## 依赖关系
### Workspace 依赖
- `lumenpage-render-engine`

### 第三方依赖
- 无第三方运行时依赖。

## 典型用法
```ts
import * as layout from "lumenpage-layout-engine";
```

## 适用场景
- 需要在当前 monorepo 中复用这部分能力时直接引用该包。
- 需要做二次封装时，可以把它作为更高层扩展或应用包的基础依赖。
- 如果该包属于扩展层，通常会和 `lumenpage-core` 的 `Editor` 一起使用。

## 备注
- 分页异常、块复用和页面缓存问题通常都在这个包内排查。
