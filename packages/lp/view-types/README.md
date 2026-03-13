# lumenpage-view-types

> 目录：`packages/lp/view-types`

## 包定位
视图抽象类型层，给底层状态、命令、扩展定义公共视图接口。

## 当前职责
- 抽出编辑视图相关类型和最小接口。
- 避免底层库直接依赖具体 DOM/Canvas 实现。
- 让 lp 层在 Canvas 视图里仍可复用。

## 入口与结构
- 包名：`lumenpage-view-types`
- 主要入口：`src/index.ts`
- 构建方式：以 workspace 包形式被其他包或应用引用

## 对外导出
- `export type EditorView = {`
- `export type DOMEventHandler = (view: EditorView, event: Event) => boolean;`
- `export type NodeSelectionHit = {`
- `export type EditorProps<T = any> = {`

## 依赖关系
### Workspace 依赖
- 无 workspace 依赖。

### 第三方依赖
- 无第三方运行时依赖。

## 典型用法
```ts
import type { EditorView } from "lumenpage-view-types";
```

## 适用场景
- 需要在当前 monorepo 中复用这部分能力时直接引用该包。
- 需要做二次封装时，可以把它作为更高层扩展或应用包的基础依赖。
- 如果该包属于扩展层，通常会和 `lumenpage-core` 的 `Editor` 一起使用。

## 备注
- 无额外备注。
