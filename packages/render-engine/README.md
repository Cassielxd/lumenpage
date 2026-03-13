# lumenpage-render-engine

> 目录：`packages/render-engine`

## 包定位
Canvas 渲染抽象层，负责把文档节点和 mark 转成可绘制的布局信息与绘制行为。

## 当前职责
- 提供默认节点渲染器和默认 mark 适配器。
- 负责 text run、line break、标注、占位符等渲染辅助逻辑。
- 允许扩展覆盖默认 node/mark 渲染实现。

## 入口与结构
- 包名：`lumenpage-render-engine`
- 主要入口：`src/index.ts`
- 构建方式：以 workspace 包形式被其他包或应用引用

## 对外导出
- `export {`
- `export {`
- `export { breakLines } from "./lineBreaker";`
- `export { docToRuns, textToRuns, textblockToRuns } from "./textRuns";`
- `export * from "./defaultRenderers/index";`

## 依赖关系
### Workspace 依赖
- 无 workspace 依赖。

### 第三方依赖
- 无第三方运行时依赖。

## 典型用法
```ts
import {
  getDefaultMarkRenderAdapter,
} from "lumenpage-render-engine";
```

## 适用场景
- 需要在当前 monorepo 中复用这部分能力时直接引用该包。
- 需要做二次封装时，可以把它作为更高层扩展或应用包的基础依赖。
- 如果该包属于扩展层，通常会和 `lumenpage-core` 的 `Editor` 一起使用。

## 备注
- 这个包是扩展定义和 Canvas 最终绘制之间的桥梁。
