# LumenPage

LumenPage 是一个面向长文档场景的 Canvas 分页富文本编辑器 monorepo。

它的核心思路不是“先用 DOM 编辑，最后再导出分页”，而是从编辑阶段就进入真实分页模型，同时保留 ProseMirror 风格的数据模型、状态管理、事务系统和插件边界，并在上层开发体验上尽量向 tiptap 对齐。

## 这个项目解决什么问题

传统 Web 富文本编辑器在下面这些场景里通常会变得很难用：

- 文档很长，编辑时就需要看到真实分页
- 页面布局、页边距、段前段后距、分页符都需要稳定控制
- 复杂节点跨页后，DOM 结构、选区、命中测试容易失真
- 业务想做文档工具化，但又不希望失去可扩展的数据模型

LumenPage 的目标就是解决这一类问题：

- 编辑阶段即分页
- 视图层用 Canvas 保持稳定渲染
- 模型层继续保持可扩展、可组合、可编程

## 项目优势

### 1. 编辑时就是真实分页

分页不是导出时的附加功能，而是编辑器运行时的一部分。

这意味着：

- 页数、分页符、页边距、页面尺寸在编辑时就可见
- 长文档不会因为最终导出才分页而前后不一致
- 页级缓存、分页复用、增量重排可以直接服务编辑体验

### 2. 保留 ProseMirror 风格的可靠模型

LumenPage 没有放弃成熟的文档模型和事务系统，而是保留了这套基础能力：

- `Schema`
- `Node / Mark`
- `EditorState`
- `Transaction`
- `Command`
- `Plugin`
- `History / InputRules / Keymap`

因此它不是“只有画布，没有模型”的方案，而是“强模型 + Canvas 视图”的方案。

### 3. 上层 API 尽量向 tiptap 对齐

当前项目的目标之一，就是让熟悉 tiptap 的开发者尽量低成本上手。

项目里已经明确沿着这个方向演进：

- `Editor / Extension / Node / Mark` 组织方式对齐 tiptap
- `StarterKit` 作为默认扩展聚合入口
- 扩展尽量拆成 `extension-*`
- 命令链、事件系统、扩展生命周期都尽量保持类似认知

也就是说，LumenPage 不是要重新发明一整套陌生概念，而是尽量复用已有编辑器生态里的开发心智。

### 4. Canvas 视图更适合做稳定分页

DOM 编辑器在长文档分页场景里常见的问题是：

- 跨页切片后 DOM 容易复杂化
- 命中测试和选区边界容易漂
- 布局结果受浏览器默认排版影响较大

LumenPage 的做法是：

- 模型和命令层继续稳定
- 布局和渲染层独立抽象
- 最终在 Canvas 中完成分页视图绘制

这样更容易把“页面”作为一等公民来处理。

### 5. 扩展边界清晰

项目不是把所有能力都塞进一个大包里，而是按职责拆层：

- 底层模型与状态
- 分页布局
- Canvas 渲染
- Editor API
- 节点 / mark / 交互扩展
- 应用层工具

这样做的直接好处是：

- 更容易定位问题
- 更容易做二次定制
- 更容易控制核心层和业务层的边界

## 易用性设计

LumenPage 的易用性不是靠“隐藏能力”，而是靠“把复杂能力分层、默认化、可覆盖”。

### 对普通开发者友好

如果只是想快速接入一个分页编辑器，通常只需要：

- `Editor`
- `StarterKit`
- 若干业务扩展

不用一开始就理解分页引擎内部细节。

### 对 tiptap 用户友好

如果你熟悉 tiptap，迁移认知成本会更低：

- 扩展写法接近
- 组合方式接近
- 命令和事件的理解方式接近
- 区别主要在 Canvas 和分页配置，而不是整套开发模型全部改变

### 对高级定制友好

如果你需要做：

- 自定义节点
- 自定义 mark
- 自定义 Canvas 渲染
- 自定义分页行为
- 自定义悬浮菜单、建议菜单、工具条

项目也已经把对应的扩展点留出来了。

## 架构思路

整个项目分成 4 层。

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

### 1. `packages/lp/*`

这一层是底层基础设施，对齐 ProseMirror 风格能力：

- `model`
- `state`
- `transform`
- `commands`
- `history`
- `inputrules`
- `keymap`
- `collab`
- `view-types`

职责很明确：

- 只处理文档模型、状态、事务和命令
- 不关心 Canvas
- 不关心具体业务 UI

### 2. `layout-engine`

这一层负责把文档排成真正的页面。

重点能力包括：

- 块布局
- 行切分
- 分页
- 跨页续排
- 增量复用
- 缓存和重排

这层是“为什么 LumenPage 能做长文档编辑”的关键。

### 3. `render-engine` + `view-canvas`

这两层共同组成视图能力：

- `render-engine` 负责 node / mark 到 Canvas 渲染结构的映射
- `view-canvas` 负责输入、选区、滚动、命中测试、重绘、视图生命周期

设计原则是：

- 模型和渲染解耦
- 渲染和交互解耦
- 默认实现放在引擎层
- 扩展可以覆盖默认实现

### 4. `core` + `starter-kit` + `extension-*`

这一层是开发者最常接触的 API 层。

- `core`：`Editor / Extension / Node / Mark / commands / events`
- `starter-kit`：默认扩展聚合
- `extension-*`：节点、mark、交互和工具能力

这层的设计目标是：

- 上手路径像 tiptap
- 扩展边界清晰
- 业务代码尽量不要直接碰底层分页细节

## 当前开发体验

现在这个仓库已经具备下面这些比较完整的能力：

- 分页 Canvas 编辑视图
- StarterKit 扩展聚合
- 常见节点和 mark 扩展
- 表格、图片、视频、文件、书签、签名等业务节点
- mention、slash command、bubble menu、drag handle
- Markdown 导入导出
- 示例应用 `apps/lumen`
- 联调应用 `apps/playground`
- DevTools 调试面板

## 推荐接入方式

### 快速体验

```bash
pnpm install
pnpm dev:lumen
```

或者：

```bash
pnpm dev
```

### 常用命令

```bash
pnpm install
pnpm dev
pnpm dev:lumen
pnpm build
pnpm typecheck
pnpm format
```

## 适合什么团队

LumenPage 特别适合这些场景：

- 在线文档 / 在线报告 / 在线合同
- 需要真实分页编辑体验的 SaaS
- 需要做文档模板、签名、批注、导出能力的系统
- 已经熟悉 tiptap / ProseMirror，但需要分页 Canvas 方案的团队

## 不打算怎么做

这个项目的方向不是：

- 单纯复刻一个 DOM 富文本编辑器
- 为了兼容而引入大量历史包袱
- 把所有业务工具都放进核心库

当前更强调的是：

- 核心层稳定
- API 层清晰
- 扩展层可组合
- 视图层适合长文档分页

## 包索引

核心包：

- [packages/core](packages/core/README.md)
- [packages/starter-kit](packages/starter-kit/README.md)
- [packages/layout-engine](packages/layout-engine/README.md)
- [packages/render-engine](packages/render-engine/README.md)
- [packages/view-canvas](packages/view-canvas/README.md)

底层模型层：

- [packages/lp/model](packages/lp/model/README.md)
- [packages/lp/state](packages/lp/state/README.md)
- [packages/lp/transform](packages/lp/transform/README.md)
- [packages/lp/commands](packages/lp/commands/README.md)
- [packages/lp/history](packages/lp/history/README.md)
- [packages/lp/inputrules](packages/lp/inputrules/README.md)
- [packages/lp/keymap](packages/lp/keymap/README.md)

常用扩展：

- [packages/extension-heading](packages/extension-heading/README.md)
- [packages/extension-paragraph](packages/extension-paragraph/README.md)
- [packages/extension-image](packages/extension-image/README.md)
- [packages/extension-table](packages/extension-table/README.md)
- [packages/extension-mention](packages/extension-mention/README.md)
- [packages/extension-bubble-menu](packages/extension-bubble-menu/README.md)
- [packages/extension-drag-handle](packages/extension-drag-handle/README.md)

## 相关文档

- [docs/project-onboarding-handbook.md](docs/project-onboarding-handbook.md)
- [docs/pagination-layout.md](docs/pagination-layout.md)
- [docs/pos-offset-mapping.md](docs/pos-offset-mapping.md)
- [docs/editor-gap-roadmap.md](docs/editor-gap-roadmap.md)
- [docs/package-governance-inventory.md](docs/package-governance-inventory.md)

## 一句话总结

LumenPage 的核心价值不是“把富文本画到 Canvas 上”，而是：

在保留成熟文档模型和扩展能力的前提下，把分页、布局、渲染和编辑体验真正统一起来。
