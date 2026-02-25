# 包治理清单（保留 / 合并 / 拆分）

## 说明

- 数据来源：`governance/package-catalog.json`
- 判断标准：体量、复用范围、生命周期独立性、独立版本价值

## 保留（Keep）

| 包名 | 层级 | 说明 |
|---|---|---|
| `lumenpage-model` | core | 文档模型底座 |
| `lumenpage-state` | core | 状态与事务核心 |
| `lumenpage-transform` | core | 变换核心 |
| `lumenpage-view-types` | core | 类型公共层 |
| `lumenpage-commands` | core | 命令基础设施 |
| `lumenpage-keymap` | core | 键盘映射基础设施 |
| `lumenpage-history` | core | 历史栈能力 |
| `lumenpage-inputrules` | core | 输入规则能力 |
| `lumenpage-link` | core | 链接与 URL 策略 |
| `lumenpage-collab` | core | 协作能力（internal） |
| `lumenpage-view-canvas` | engine | 当前视图运行时总入口（待拆分） |
| `lumenpage-layout-engine` | engine | 新增：分页/映射纯引擎骨架 |
| `lumenpage-view-runtime` | engine | 新增：视图输入/渲染/事件运行时骨架 |
| `lumenpage-schema-basic` | extensions | 基础 schema |
| `lumenpage-kit-basic` | extensions | 默认能力装配入口 |
| `lumenpage-editor-plugins` | extensions | 交互插件聚合入口（迁移过渡层） |
| `lumenpage-node-basic` | extensions | 基础文本节点聚合入口 |
| `lumenpage-node-media` | extensions | 媒体节点聚合入口 |
| `lumenpage-node-list` | extensions | 列表行为复杂，暂独立 |
| `lumenpage-node-table` | extensions | 表格复杂度高，暂独立 |
| `lumenpage-markdown` | extensions | 导入导出能力，先 internal |
| `lumenpage-dev-tools` | tooling | 开发调试能力（app-only） |

## 合并（Merge）

| 当前包 | 目标聚合 | 原因 |
|---|---|---|
| `lumenpage-drag-handle` | `editor-plugins` | 交互插件强耦合，合并可降依赖跳转 |
| `lumenpage-gapcursor` | `editor-plugins` | 同类插件，维护节奏一致 |
| `lumenpage-plugin-active-block` | `editor-plugins` | 同类插件，聚合更清晰 |
| `lumenpage-node-paragraph` | `node-basic` | 体量小，独立版本价值低 |
| `lumenpage-node-heading` | `node-basic` | 体量小，独立版本价值低 |
| `lumenpage-node-blockquote` | `node-basic` | 体量小，独立版本价值低 |
| `lumenpage-node-code-block` | `node-basic` | 可与基础文本节点统一模板 |
| `lumenpage-node-hard-break` | `node-basic` | 体量极小 |
| `lumenpage-node-horizontal-rule` | `node-basic` | 体量小 |
| `lumenpage-node-image` | `node-media` | 与视频同类，接口可统一 |
| `lumenpage-node-video` | `node-media` | 与图片同类，接口可统一 |

已完成（2026-02-24）：`drag-handle` / `gapcursor` / `plugin-active-block` 实现迁入 `editor-plugins`，旧包仅保留兼容转发。
已完成（2026-02-24）：`node-paragraph` / `node-heading` / `node-blockquote` / `node-code-block` / `node-hard-break` / `node-horizontal-rule` 实现迁入 `node-basic`，旧包仅保留兼容转发。
已完成（2026-02-24）：`node-image` / `node-video` 实现迁入 `node-media`，旧包仅保留兼容转发。
已完成（2026-02-25）：上述兼容转发包已删除，不再保留兼容层。

## 拆分（Split）

| 当前包 | 拆分目标 | 原因 |
|---|---|---|
| `lumenpage-view-canvas` | `layout-engine` + `view-runtime` | 责任过载，影响维护与性能定位 |
