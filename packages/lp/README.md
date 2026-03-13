# packages/lp

> 目录：`packages/lp`

## 定位
底层兼容层命名空间目录，用来容纳与 ProseMirror 模型和状态体系对齐的子包。

## 当前职责
- 把 model、state、transform、commands、history、inputrules、keymap、collab、view-types 组织到统一命名空间下。
- 给上层 core、扩展层和视图层提供稳定的低层基座。
- 作为 Canvas 视图加 ProseMirror 状态模型这一组合方案的兼容层入口。

## 备注
- 这个目录本身不是独立 npm 包，真正可发布的是下面的各个子包。
