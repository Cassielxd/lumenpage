# lumenpage-collab

> 目录：`packages/lp/collab`

## 包定位
底层协作编辑层，对应 ProseMirror collab 包。

## 当前职责
- 管理协作版本号和待发送步骤。
- 处理远端步骤接入和映射。
- 为上层协同能力预留兼容接口。

## 入口与结构
- 包名：`lumenpage-collab`
- 主要入口：`src/index.ts`
- 构建方式：以 workspace 包形式被其他包或应用引用

## 对外导出
- `export * from "./collab"`

## 依赖关系
### Workspace 依赖
- `lumenpage-state`
- `lumenpage-transform`

### 第三方依赖
- 无第三方运行时依赖。

## 典型用法
```ts
import { collab, receiveTransaction, sendableSteps } from "lumenpage-collab";
```

## 适用场景
- 需要在当前 monorepo 中复用这部分能力时直接引用该包。
- 需要做二次封装时，可以把它作为更高层扩展或应用包的基础依赖。
- 如果该包属于扩展层，通常会和 `lumenpage-core` 的 `Editor` 一起使用。

## 备注
- 无额外备注。
