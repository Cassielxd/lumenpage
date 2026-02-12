说明：本项目用于演示分页富文本编辑器的核心架构与实现思路。

# LumenPage

LumenPage 是一个分页式富文本编辑器的最小可用架构原型（MVP）。当前实现采用 headless ProseMirror 作为文档/事务内核，配合 Canvas 分页渲染与自研布局引擎，验证“分页 + 自定义渲染”路径。

## 主要特性
- headless ProseMirror：Schema/State/Transaction/History 作为编辑内核
- Canvas 渲染：分页布局、文字绘制、选区与光标叠加
- 多画布渲染：可见页少量 canvas + 离屏缓存 + LRU
- 节点渲染注册表：每种节点可自定义 layout/render（段落、标题、表格）
- 基础工具栏：段落/标题切换与对齐

## 运行
```bash
npm install
npm run dev
```

## 构建
```bash
npm run build       # 应用构建
npm run build:lib   # 核心库构建（dist-lib）
```

## 目录结构
- `index.html`：应用入口与布局容器
- `styles.css`：UI 样式与层级布局
- `src/main.js`：主入口（状态、输入、布局、渲染、映射）
- `src/editor`：Schema/State/命令/节点渲染器
- `src/layout`：runs 生成、断行、分页布局、节点渲染注册表
- `src/core`：渲染、光标/命中、测量、虚拟化
- `src/render`：选区矩形计算
- `src/input`：输入事件桥接

## 初始数据（JSON）
初始文档从 JSON 加载，编辑 `src/main.js` 中的 `initialDocJson` 即可。

## 说明与限制
- 表格当前为“可编辑文本 + 基础网格渲染”的最小实现
- 排版/分页尚未实现高级规则（孤行/寡行、跨页表格等）
- IME 与复杂脚本输入仍在完善中