# lumenpage-history

> 目录：`packages/lp/history`

## 包定位
底层撤销重做层，对应 ProseMirror history 包。

## 当前职责
- 维护撤销/重做栈。
- 处理事务分组、映射和历史回放。
- 为上层 undo/redo 扩展提供能力。

## 入口与结构
- 包名：`lumenpage-history`
- 主要入口：`src/index.ts`
- 构建方式：以 workspace 包形式被其他包或应用引用

## 对外导出
- `export * from "./history";`

## 依赖关系
### Workspace 依赖
- `lumenpage-state`
- `lumenpage-transform`

### 第三方依赖
- `prosemirror-view`: `^1.31.0`
- `rope-sequence`: `^1.3.0`

## 典型用法
```ts
import { history, undo, redo } from "lumenpage-history";
```

## 适用场景
- 需要在当前 monorepo 中复用这部分能力时直接引用该包。
- 需要做二次封装时，可以把它作为更高层扩展或应用包的基础依赖。
- 如果该包属于扩展层，通常会和 `lumenpage-core` 的 `Editor` 一起使用。

## 备注
- 无额外备注。
