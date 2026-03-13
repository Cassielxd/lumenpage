# lumenpage-suggestion

> 目录：`packages/suggestion`

## 包定位
建议列表基础设施，给 mention、slash 命令等补全类扩展复用。

## 当前职责
- 处理触发字符、查询文本、范围追踪。
- 管理悬浮面板定位和候选项生命周期。
- 为具体扩展输出 suggestion 状态与回调接口。

## 入口与结构
- 包名：`lumenpage-suggestion`
- 主要入口：`src/index.ts`
- 构建方式：以 workspace 包形式被其他包或应用引用

## 对外导出
- `export * from "./findSuggestionMatch";`
- `export * from "./suggestion";`
- `export { Suggestion };`
- `export default Suggestion;`

## 依赖关系
### Workspace 依赖
- `lumenpage-core`
- `lumenpage-state`
- `lumenpage-view-canvas`

### 第三方依赖
- 无第三方运行时依赖。

## 典型用法
```ts
import { createSuggestion } from "lumenpage-suggestion";
```

## 适用场景
- 需要在当前 monorepo 中复用这部分能力时直接引用该包。
- 需要做二次封装时，可以把它作为更高层扩展或应用包的基础依赖。
- 如果该包属于扩展层，通常会和 `lumenpage-core` 的 `Editor` 一起使用。

## 备注
- 无额外备注。
