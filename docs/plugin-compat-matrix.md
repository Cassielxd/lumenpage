# 插件兼容矩阵（草案）

## 范围

- 核心：`lumenpage-model` / `lumenpage-state` / `lumenpage-transform`
- 视图：`lumenpage-view-canvas`
- 插件聚合：`lumenpage-editor-plugins`
- 节点扩展：`lumenpage-node-*` / `lumenpage-kit-basic`

## 版本策略

1. **同一仓库发布窗口内**：`editor-plugins` 与 `view-canvas` 必须同主版本。
2. **跨主版本**：不承诺二进制兼容，要求插件重新 typecheck + build。
3. **跨次版本**：若仅新增可选字段（options 扩展），视为兼容。
4. **破坏性行为变更**：必须在 changelog 明确标注迁移路径。

## API 稳定级别

- `Stable`：可作为外部插件长期依赖
  - `createMentionPlugin`
  - `createSelectionBubblePlugin`
  - `createTippyPopupController`
  - `createPopupRenderRuntime`
- `Experimental`：可能在小版本内调整
  - 与 `_internals` 直接耦合的运行时细节（仅限包内实现使用）

## 兼容矩阵（当前）

| view-canvas | editor-plugins | 状态 | 说明 |
| --- | --- | --- | --- |
| 0.0.x | 0.0.x | ✅ | 当前主干组合 |
| 0.1.x | 0.0.x | ⚠️ | 需重新验证生命周期与定位 API |
| 1.x | 0.x | ❌ | 不保证兼容 |

## 升级检查清单

1. `pnpm -C packages/extensions/editor-plugins typecheck`
2. `pnpm -C apps/lumen typecheck`
3. `pnpm -C apps/lumen build`
4. 手动验证：
   - mention 触发/键盘上下选择/确认插入
   - selection bubble 选区显示/格式按钮交互
   - 只读模式下弹层显示策略

