# 扩展与分页能力

LumenPage 的一个核心特点是：扩展能力和分页能力不是彼此独立的两套系统。

它们的关系是：

- 扩展决定文档支持什么节点和行为
- layout engine 决定这些节点如何分页和排版
- view-canvas 决定分页结果如何映射到可编辑视图
- Lumen 产品壳再把标尺、标注、右侧工作区叠加上去

## 为什么分页不能只当导出阶段能力

在 LumenPage 里，分页不是“最后导出 PDF 时再算”。

当前项目把分页放在编辑主链路里，因此这些能力才能一起成立：

- 编辑时直接看到分页结果
- 页面尺寸、边距、页眉页脚对布局立即生效
- 标尺拖拽边距后页面立即重排
- 页面级 chrome 和工作区交互保持一致

## 扩展对分页有什么要求

只要一个扩展进入文档，就必须接受分页约束。

典型影响包括：

- 表格跨页
- 图片、视频、附件块的占位与分页
- 模板、提示块、文本框的块级布局
- 评论、修订、协作光标的视图映射

所以扩展不是“先有 DOM，后面再渲染一下”，而是要和 layout / render / view-runtime 一起工作。

## 当前项目里的几层分工

### 文档扩展层

位置：

- `packages/extensions/*`
- `apps/lumen/src/editor/documentExtensions.ts`

职责：

- 定义节点、mark、行为
- 决定命令和 schema
- 为产品层暴露可用能力

### 分页布局层

位置：

- `packages/engine/layout-engine`
- `packages/engine/view-canvas`

职责：

- 断行
- 分页
- 页面复用
- worker 路径
- 布局结果到视图坐标的映射

### 产品壳层

位置：

- `apps/lumen/src/App.vue`
- `apps/lumen/src/components/*`

职责：

- 标尺
- 标注
- 右侧工作区
- 浮动侧边动作
- 评论、AI、修订面板

## 标尺和分页的关系

标尺不是单独的装饰层。

当前 Lumen 的标尺会：

- 读取 `CanvasEditorView.getPaginationInfo()`
- 直接调整 `settings.margin`
- 触发立即布局重算

所以标尺是分页系统的产品壳入口，而不是单纯的视觉组件。

## 标注和分页的关系

标注不会写进文档模型。

它属于页面覆盖层，按分页视图同步：

- 跟随页面和滚动位置
- 支持本地临时态和协作态
- 不进入正文 schema

这条边界很重要，因为它把“文档内容”和“页面讲解/评审痕迹”分开了。

## 看这条链路时建议先读哪些文件

1. `apps/lumen/src/editor/documentExtensions.ts`
2. `apps/lumen/src/editor/editorMount.ts`
3. `apps/lumen/src/editor/config.ts`
4. `packages/engine/view-canvas`
5. `packages/engine/layout-engine`
