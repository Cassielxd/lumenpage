# lumenpage-commands

> 目录：`packages/lp/commands`

## 包定位
底层命令层，对应 ProseMirror commands 包。

## 当前职责
- 提供常见结构编辑命令。
- 封装事务构造和命令组合。
- 作为高层扩展命令的低层基础。

## 入口与结构
- 包名：`lumenpage-commands`
- 主要入口：`src/index.ts`
- 构建方式：以 workspace 包形式被其他包或应用引用

## 对外导出
- `export * from "./commands";`

## 依赖关系
### Workspace 依赖
- `lumenpage-model`
- `lumenpage-transform`
- `lumenpage-state`
- `lumenpage-view-types`

### 第三方依赖
- 无第三方运行时依赖。

## 典型用法
```ts
import { chainCommands, splitBlock, toggleMark } from "lumenpage-commands";
```

## 适用场景
- 需要在当前 monorepo 中复用这部分能力时直接引用该包。
- 需要做二次封装时，可以把它作为更高层扩展或应用包的基础依赖。
- 如果该包属于扩展层，通常会和 `lumenpage-core` 的 `Editor` 一起使用。

## 备注
- 无额外备注。
