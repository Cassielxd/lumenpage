# 会话接手入口（2026-04-04）

这份文档现在是 Lumen 产品化主线的唯一接手入口。
下次继续前，先读这份，再按这里的顺序恢复上下文，不要再从旧的 pagination handoff 开始。

## 下次先读

1. `docs/session-handoff.md`
2. `docs/lumen-product-requirements.md`
3. 最近 4 个 commit
4. 下面列出的关键文件

推荐直接执行：

```powershell
git log --oneline -4
git status --short
pnpm.cmd typecheck
```

## 当前阶段判断

- `apps/lumen` 已经是产品壳，不再是单纯 playground。
- 当前主线已经从“功能接线”转成“产品壳收口 + 权限/快照/协作主链路稳定化”。
- 默认行为已经调整为：
  - 打开文档先加载真实快照
  - 默认不自动开启实时协作
  - 实时协作需要主动开启
- 当前主矛盾不再是“编辑器能不能挂起来”，而是：
  - 工作区入口虽然已拆到 `useWorkspaceAccessLoader / Dialogs / Lifecycle`，但页面层编排还没完全收口
  - `App.vue` 已拆出 runtime / review / capabilities / shell UI，但页面壳仍然偏重
  - 权限矩阵和分享链路已经能稳定回归，但还没补成完整产品矩阵

## 当前稳定基线

- `pnpm.cmd typecheck` 通过
- `pnpm.cmd -C apps/lumen build` 通过
- `apps/lumen/e2e/lumen-documents-home-workspace.spec.ts` 通过
- `apps/lumen/e2e/lumen-permissions-matrix.spec.ts` 通过

说明：

- 上面两条 E2E 是当前最值得信任的产品壳主链路基线
- `lumen-permissions-matrix.spec.ts` 当前共 9 条用例通过
- 这轮没有重新跑完整套 lumen E2E

## 最近关键提交

1. `85ae767`
   `lumen: split workspace flows and harden access coverage`

2. `2e6f1bb`
   `lumen: unify document entry navigation`

3. `0e094cc`
   `lumen: fix snapshot permissions and post-update sync`

4. `b50efa2`
   `view-canvas: render applied async layouts immediately`

## 这几次真正解决了什么

### 1. 输入内容不立即显示

根因：

- 异步分页 worker 已经 apply 了新 layout
- 但 render 被 pending 状态错误拦住
- 结果是 state/layout 已更新，canvas 没及时刷新

修复：

- `packages/engine/view-canvas/src/view/renderSync.ts`

结果：

- 首输字符、空格、数字不再依赖下一次事件才一起出现

### 2. 打开文档是空白或内容没进来

根因：

- 不是快照没拿到
- 也不是协作扩展没生成 `nextDoc`
- 真正问题是权限插件把协作初始化事务也当成“本地写入”拦掉了

修复：

- `apps/lumen/src/editor/permissionPlugin.ts`

结果：

- `comment / readonly` 模式下，真实快照现在可以正常加载进工作区

### 3. 权限链路里偶发栈溢出

根因：

- `view-canvas` 的 `onChange` 回调发生在 `view.updateState()` 之前
- 之前在这个时机里直接做评论同步、文档变更处理
- 会把副作用重新拉进 dispatch 栈，形成重入

修复：

- `apps/lumen/src/editor/editorMount.ts`

结果：

- 现在改成 post-update microtask flush
- 文档保存触发、评论状态同步、track changes 状态同步不再在更新栈里重入

### 4. 首页进入、分享页进入、工作区进入入口分散

修复：

- 新增 `apps/lumen/src/composables/useDocumentNavigation.ts`
- `DocumentsHomePage.vue`
- `ShareAccessPage.vue`

结果：

- “打开文档 / 回首页 / share token 记忆”已经统一到一套导航入口
- 后面继续收工作区路由加载时，不需要重复改两套页面逻辑

### 5. 工作区壳层和权限回归已经拆出明确边界

修复：

- 新增 `useWorkspaceEditorRuntime.ts`
- 新增 `useWorkspaceReview.ts`
- 新增 `useWorkspaceCapabilities.ts`
- 新增 `useWorkspaceShellUi.ts`
- 新增 `useWorkspaceAccessLoader.ts`
- 新增 `useWorkspaceAccessDialogs.ts`
- 新增 `useWorkspaceAccessLifecycle.ts`

结果：

- `App.vue` 现在主要做页面接线，不再直接塞满 runtime / review / capability 细节
- `useWorkspaceAccess.ts` 现在主要做组合接线，后端加载、弹窗返回流、路由生命周期已经分层
- 首页和分享页进入工作区时会保留 `?locale=...`
- 权限矩阵已经补到“成员权限优先于 share link，不因更强 share role 被抬权”

## 当前关键文件

下次继续时，优先看这些文件：

1. `apps/lumen/src/App.vue`
2. `apps/lumen/src/composables/useWorkspaceAccess.ts`
3. `apps/lumen/src/composables/useWorkspaceAccessLoader.ts`
4. `apps/lumen/src/composables/useWorkspaceAccessDialogs.ts`
5. `apps/lumen/src/composables/useWorkspaceAccessLifecycle.ts`
6. `apps/lumen/src/editor/editorMount.ts`
7. `apps/lumen/src/editor/permissionPlugin.ts`
8. `apps/lumen/src/composables/useDocumentNavigation.ts`
9. `apps/lumen/e2e/lumen-documents-home-workspace.spec.ts`
10. `apps/lumen/e2e/lumen-permissions-matrix.spec.ts`

## 当前还没收口的功能

### 1. 工作区路由加载编排

- 首页进入文档、分享页进入文档、工作区内切文档虽然已统一入口
- `useWorkspaceAccess.ts` 已拆成 loader / dialogs / lifecycle，但 share/auth 返回流和页面层接线还没有完全收成最终边界
- 下一步应该继续把“文档入口 -> 工作区加载”做成更稳定的组合层

### 2. `App.vue` 仍然过重

- 顶层页面编排
- 文档工作区壳层接线
- 顶部栏 / 页面动作 / 侧边浮层之间的组合关系

这些职责虽然比之前薄很多，但还没有完全拆开

### 3. 权限矩阵覆盖还不够全

当前已覆盖：

- owner 本地可编辑
- editor 成员直接进入工作区可编辑
- editor 成员经 readonly share 入口仍保持可编辑
- commenter 直接进入、经 readonly share、经 signed-in-only commenter share 都保持 comment-only
- viewer 直接进入、匿名 readonly share、开启 realtime 后都保持只读
- 更强的 `editor` share link 不会抬升已有 commenter / viewer 成员权限

还没系统补齐：

- owner / editor / commenter / viewer 更完整的 share role 交叉矩阵
- signed-in / anonymous share 的更完整排列组合
- realtime collaboration 打开后的更完整矩阵

### 4. 手动协作开启链路还需要继续回归

- 当前主链路是默认本地快照 + 手动开启协作
- 这个方向已经定了
- 但协作开启后的更多交互回归还没补全

## 下次恢复时怎么读

如果下次继续，我会按这个顺序恢复：

1. 先看 `docs/session-handoff.md`
   - 确认当前主线、最近修复、剩余任务

2. 再看 `docs/lumen-product-requirements.md`
   - 确认产品口径，不把“功能已接线”误判成“产品已完成”

3. 再看最近 commit
   - 重点看 `85ae767`、`2e6f1bb`、`0e094cc`

4. 然后打开关键文件
   - `App.vue`
   - `useWorkspaceAccess.ts`
   - `useWorkspaceAccessLoader.ts`
   - `editorMount.ts`
   - `permissionPlugin.ts`

5. 最后先跑基线
   - `pnpm.cmd typecheck`
   - `pnpm.cmd -C apps/lumen build`
   - `pnpm.cmd -C apps/lumen exec playwright test e2e/lumen-documents-home-workspace.spec.ts e2e/lumen-permissions-matrix.spec.ts`

## 下次建议直接从这里开始

优先级顺序：

1. 继续拆 `App.vue` 的工作区路由加载和 runtime 编排
2. 把“文档入口 -> 工作区加载”收成更清晰的 composable / store 边界
3. 扩权限矩阵回归，补登录分享、匿名分享、实时协作后的权限行为
4. 再继续收手动协作开启后的主链路回归

## 文档约定

- `docs/session-handoff.md`
  唯一接手入口，下次先读这份

- `docs/lumen-product-requirements.md`
  产品需求基线，判断“是不是产品完成”以这份为准

- 新的临时 handoff
  尽量不再新建
  除非是明确的专项方案文档
