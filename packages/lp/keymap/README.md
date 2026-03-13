# lumenpage-keymap

> 目录：`packages/lp/keymap`

## 包定位
底层快捷键映射层，对应 ProseMirror keymap 包。

## 当前职责
- 把按键组合映射成命令。
- 统一不同平台的按键语义。
- 给视图层和扩展层提供快捷键插件能力。

## 入口与结构
- 包名：`lumenpage-keymap`
- 主要入口：`src/index.ts`
- 构建方式：以 workspace 包形式被其他包或应用引用

## 对外导出
- `export { keymap, keydownHandler } from "./keymap";`

## 依赖关系
### Workspace 依赖
- `lumenpage-state`
- `lumenpage-view-types`

### 第三方依赖
- `w3c-keyname`: `^2.2.0`

## 典型用法
```ts
import { keymap } from "lumenpage-keymap";
```

## 适用场景
- 需要在当前 monorepo 中复用这部分能力时直接引用该包。
- 需要做二次封装时，可以把它作为更高层扩展或应用包的基础依赖。
- 如果该包属于扩展层，通常会和 `lumenpage-core` 的 `Editor` 一起使用。

## 备注
- 无额外备注。
