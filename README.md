# LumenPage

LumenPage 是一个面向长文档场景的 Canvas 分页富文本编辑器 monorepo。

它的核心思路不是“先用 DOM 编辑，最后再导出分页”，而是从编辑阶段就进入真实分页模型，同时保留 ProseMirror 风格的数据模型、状态管理、事务系统和插件边界，并在上层开发体验上尽量向 tiptap 对齐。

## 项目优势
- 编辑阶段即分页，页数、页边距、分页符在编辑时就可见。
- 保留成熟的文档模型与事务系统，不是只有画布没有模型的方案。
- 上层 API 和扩展组织方式尽量贴近 tiptap，迁移成本更低。
- 通过 `layout-engine`、`render-engine`、`view-runtime`、`view-canvas` 分层，把分页、渲染、视图交互拆开。
- 业务扩展不再混入核心渲染层，核心与业务边界更清晰。

## 当前架构边界
```txt
apps/lumen, apps/playground
        |
        v
packages/core + packages/starter-kit + packages/extension-*
        |
        v
packages/view-canvas
        |
        +--> packages/layout-engine
        +--> packages/render-engine
        +--> packages/view-runtime
        +--> packages/lp/*
```

### 核心层
- `packages/lp/*`：模型、状态、事务、命令等底层能力。
- `packages/layout-engine`：布局、换行、分页、跨页续排、增量复用。
- `packages/render-engine`：基础文档块与 mark 的通用默认渲染。
- `packages/view-runtime`：坐标、位置索引、选择移动、虚拟化等视图辅助能力。
- `packages/view-canvas`：Canvas EditorView、输入桥接、绘制调度。

### 扩展层
- `packages/starter-kit`：只做基础扩展聚合，不混入业务块。
- `packages/extension-*`：节点、mark、交互和工具扩展。

### 业务边界
以下能力现在默认保留在各自扩展包，而不是放在核心渲染层：
- `audio`
- `bookmark`
- `file`
- `webPage`
- `callout`
- `columns`
- `embedPanel`
- `math`
- `optionBox`
- `signature`
- `template`
- `textBox`
- `seal`

这意味着：
- `render-engine` 只负责通用基础渲染。
- 业务块自己的默认 renderer / node view 由扩展包维护。
- 应用可以更容易替换或裁剪业务能力，而不需要碰核心层。

## 易用性思路
- 普通开发者：用 `Editor + StarterKit + 若干扩展` 就能接入。
- tiptap 用户：扩展、命令、组织方式更接近已知心智。
- 高级定制：可以直接覆写 renderer、node view、popup、toolbar、命令链。

## 推荐入口
- 核心包：
  - [packages/core](packages/core/README.md)
  - [packages/starter-kit](packages/starter-kit/README.md)
  - [packages/layout-engine](packages/layout-engine/README.md)
  - [packages/render-engine](packages/render-engine/README.md)
  - [packages/view-canvas](packages/view-canvas/README.md)
- 应用示例：
  - `apps/lumen`
  - `apps/playground`
