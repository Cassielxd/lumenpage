# lumenpage-dev-tools

> 目录：`packages/dev-tools`

## 包定位
编辑器调试工具面板，用于观察文档、历史、插件、分页和结构状态。

## 当前职责
- 展示 State、History、Plugins、Schema、Structure、Pages、Snapshots。
- 支持调试 JSON 状态、历史回滚和分页信息排查。
- 为开发阶段排查布局、渲染、命令链和插件状态提供辅助。

## 入口与结构
- 包名：`lumenpage-dev-tools`
- 主要入口：`src/index.ts`
- 构建方式：以 workspace 包形式被其他包或应用引用

## 对外导出
- `export function applyDevTools(`
- `export function applyLumenDevTools(`
- `export default applyDevTools;`

## 依赖关系
### Workspace 依赖
- `lumenpage-model`
- `lumenpage-state`
- `lumenpage-view-types`

### 第三方依赖
- `html`: `^1.0.0`
- `jsondiffpatch`: `^0.7.3`
- `nanoid`: `^5.1.6`
- `vue`: `^3.5.0`
- `vue-json-pretty`: `^2.6.0`

## 典型用法
```ts
import { applyLumenDevTools } from "lumenpage-dev-tools";

const dispose = applyLumenDevTools(editor.view);
```

## 适用场景
- 需要在当前 monorepo 中复用这部分能力时直接引用该包。
- 需要做二次封装时，可以把它作为更高层扩展或应用包的基础依赖。
- 如果该包属于扩展层，通常会和 `lumenpage-core` 的 `Editor` 一起使用。

## 备注
- 无额外备注。
