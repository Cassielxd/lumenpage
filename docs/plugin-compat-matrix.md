# 扩展兼容矩阵（草案）

## 范围

- 核心内核：`lumenpage-model` / `lumenpage-state` / `lumenpage-transform`
- 核心门面：`lumenpage-core`
- 视图链路：`lumenpage-view-canvas` / `lumenpage-layout-engine` / `lumenpage-render-engine` / `lumenpage-view-runtime`
- 扩展：`lumenpage-extension-*` / `lumenpage-starter-kit`

## 版本策略

1. 同一仓库发布窗口内：`core`、`view-canvas`、`layout-engine`、`render-engine`、`view-runtime` 应保持同主版本。
2. 扩展包与核心包跨主版本时，不承诺二进制兼容，至少重新执行 `typecheck + build + 手测`。
3. 新增可选 `options` 字段、默认渲染器、非破坏性命令时，可视为次版本兼容。
4. 调整扩展生命周期、命令语义、schema 名称、渲染契约时，必须在 changelog 明确标注迁移说明。

## API 稳定级别

### Stable

- `Editor`
- `Extension` / `Node` / `Mark`
- `StarterKit`
- `Suggestion`
- `BubbleMenu`
- `Mention`
- `Link`

### Internal / Experimental

- `view-canvas` 内部输入处理细节
- `layout-engine` 片段清理与分页恢复策略
- `render-engine` 默认渲染器内部 helper
- `dev-tools` 调试数据结构

## 当前兼容矩阵

| core | view-canvas | extension-* | 状态 | 说明 |
| --- | --- | --- | --- | --- |
| 0.0.x | 0.0.x | 0.0.x | 兼容 | 当前主干组合 |
| 0.1.x | 0.0.x | 0.0.x | 待验证 | 需要重新验证视图契约和扩展注入点 |
| 1.x | 0.x | 0.x | 不兼容 | 不承诺兼容 |

## 升级检查清单

1. `pnpm typecheck`
2. `pnpm build`
3. `pnpm -C apps/lumen build`
4. 手动验证：
   - mention 触发、上下选择、确认插入
   - bubble menu 选区显示与动作执行
   - drag handle 显示与拖拽反馈
   - link、table、image、signature 等扩展基本可用
