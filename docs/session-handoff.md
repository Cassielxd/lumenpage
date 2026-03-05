# 会话接手入口（2026-02-27）

## 先读这个

1. `docs/project-onboarding-handbook.md`（总入口：架构、链路、包职责、调试方式）
2. `docs/core-hook-boundary-analysis.md`（Hook 边界与插件/渲染职责）
3. `docs/lumen-menu-feature-checklist.md`（菜单接线实时清单）
4. `docs/lumen-product-completion-plan.md`（产品完成口径与收口优先级）
5. `docs/fix-log-2026-02-24.md`（历史问题与修复轨迹）

## 当前快照

- 分层治理已落地：`core -> engine -> extensions -> apps`
- Lumen 菜单接线基线：`103` 项中 `99` 项已接线，`4` 项未接线
- `export` Tab 默认隐藏，但导出动作仍在“开始”区可达
- 目录能力为插件采集标题，面板展示在 `App.vue` 左侧

## 开发时先执行

- `pnpm dev:lumen`
- `pnpm -C apps/lumen typecheck`
- `pnpm governance:check`

## 备注

- 旧会话中的“未提交代码清单”已失效，不再在本文件维护。
- 本文件只保留入口与当下结论，细节统一收敛到 `project-onboarding-handbook.md`。
