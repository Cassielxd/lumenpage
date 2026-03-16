# LumenPage 包治理清单（2026-03-16）

## 目标

在不破坏现有编辑能力的前提下，收敛包边界、降低依赖复杂度、保持 API 与目录结构可理解，并尽量向 tiptap 的扩展组织方式对齐。

## 当前进度

- [x] 完成目录平铺迁移：`packages/*` 直接平铺，`packages/lp/*` 保留底层内核分组
- [x] 同步 workspace、`tsconfig`、Vite alias 到当前目录结构
- [x] 完成 `layout-engine`、`render-engine`、`view-runtime` 的引擎分层
- [x] 完成 `view-canvas` 到上述引擎层的接线
- [x] 完成 `starter-kit` 重构，使其只负责聚合装配
- [x] 完成交互扩展拆分：`bubble-menu`、`mention`、`drag-handle`、`popup` 等改为独立 `extension-*`
- [x] 完成历史兼容目录清理：`mark-engine`、`extension-schema-basic`、`extension-selection-bubble`
- [x] 为现有库目录补齐 `README.md`
- [x] 输出并更新包治理清单：`docs/package-governance-inventory.md`
- [x] 把 node registry 的真实装配下沉到 `layout-engine`
- [x] 把 selection geometry 聚合收回 `core`
- [x] 把 pagination worker 的 bootstrap 与 client 协议收敛到 `core`
- [x] 补齐当前主链缺失的 workspace 依赖、catalog 条目与 TypeScript project references

## 当前分层

- `packages/lp/*`
  - ProseMirror 风格底层内核：model、state、transform、commands、history、keymap、inputrules、collab
- `packages/core`
  - `Editor`、扩展系统、schema 装配、命令与事件门面
- `packages/layout-engine`
  - 布局、断行、分页、片段清理
- `packages/render-engine`
  - Node/Mark 默认渲染与适配器注册
- `packages/view-runtime`
  - 光标、命中测试、定位、虚拟化、选区移动
- `packages/view-canvas`
  - Canvas 视图装配、输入事件、绘制与 overlay 驱动
- `packages/extension-*`
  - 功能扩展
- `packages/starter-kit`
  - 默认扩展集合
- `apps/*`
  - 产品壳与示例应用

## 当前可验证状态

- 包结构已与当前目录一致，不再依赖旧的 `node-*` / `editor-plugins` / `schema-basic`
- `starter-kit` 已作为唯一默认装配入口
- `render-engine` 已承接默认 Node/Mark 渲染实现
- `dev-tools` 已切为 Vue 3 实现并接入 `playground`
- `pnpm typecheck` 通过
- `pnpm governance:check:layers` 通过

## 当前已知剩余工作

- 清理历史文档中残留的旧路径与旧包名
- 清理构建产物误入源码目录的问题：`src/*.js`、`src/*.d.ts`、`tsconfig.tsbuildinfo`
- 继续降低 `view-canvas` 中剩余的总装复杂度
- 推进分页引擎第二阶段的 `fragmentIdentity / carryState`
- 为关键包补内部 `src/README.md` 时序说明（如后续需要）

## 下一阶段

1. 继续清理历史治理文档与 handoff 文档中的旧路径引用
2. 规范生成产物输出路径，避免污染源码目录
3. 继续压缩 `view-canvas` 与 app 侧耦合，优先处理 `renderSync` / `renderer`
4. 在 continuation 节点上补 fragment 级稳定标识，为增量分页做准备
5. 补充架构图与包依赖图，统一项目认知
