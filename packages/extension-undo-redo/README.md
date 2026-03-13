# lumenpage-extension-undo-redo

> 目录：`packages/extension-undo-redo`

## 包定位
撤销和重做扩展。

## 当前职责
- 向编辑器注册插件、快捷键、命令或悬浮 UI 行为。
- 补充编辑交互，而不是直接提供文档节点。
- 通常和其他节点或 mark 扩展一起组合使用。

## 入口与结构
- 包名：`lumenpage-extension-undo-redo`
- 主要入口：`src/index.ts`
- 构建方式：以 workspace 包形式被其他包或应用引用

## 对外导出
- `export const UndoRedo = Extension.create({`
- `export default UndoRedo;`

## 依赖关系
### Workspace 依赖
- `lumenpage-core`
- `lumenpage-history`

### 第三方依赖
- 无第三方运行时依赖。

## 典型用法
```ts
import { Editor } from "lumenpage-core";
import UndoRedo from "lumenpage-extension-undo-redo";

const editor = new Editor({
  element,
  extensions: [UndoRedo],
});
```

## 适用场景
- 需要在当前 monorepo 中复用这部分能力时直接引用该包。
- 需要做二次封装时，可以把它作为更高层扩展或应用包的基础依赖。
- 如果该包属于扩展层，通常会和 `lumenpage-core` 的 `Editor` 一起使用。

## 备注
- 无额外备注。

