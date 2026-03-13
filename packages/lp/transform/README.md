# lumenpage-transform

> 目录：`packages/lp/transform`

## 包定位
底层变换层，对应 ProseMirror transform 包。

## 当前职责
- 实现 Step、Mapping、ReplaceStep、MarkStep 等变换原语。
- 支持文档位置映射和事务中的结构变更。
- 给命令、协作和历史回放提供底层支持。

## 入口与结构
- 包名：`lumenpage-transform`
- 主要入口：`src/index.ts`
- 构建方式：以 workspace 包形式被其他包或应用引用

## 对外导出
- `export {Transform} from "./transform"`
- `export {TransformError} from "./transform"`
- `export {Step, StepResult} from "./step"`
- `export {joinPoint, canJoin, canSplit, insertPoint, dropPoint, liftTarget, findWrapping} from "./structure"`
- `export {StepMap, MapResult, Mapping} from "./map"`
- `export type {Mappable} from "./map"`
- `export {AddMarkStep, RemoveMarkStep, AddNodeMarkStep, RemoveNodeMarkStep} from "./mark_step"`
- `export {ReplaceStep, ReplaceAroundStep} from "./replace_step"`
- `export {AttrStep, DocAttrStep} from "./attr_step"`
- `export {replaceStep} from "./replace"`

## 依赖关系
### Workspace 依赖
- `lumenpage-model`

### 第三方依赖
- 无第三方运行时依赖。

## 典型用法
```ts
import { Transform, Mapping } from "lumenpage-transform";
```

## 适用场景
- 需要在当前 monorepo 中复用这部分能力时直接引用该包。
- 需要做二次封装时，可以把它作为更高层扩展或应用包的基础依赖。
- 如果该包属于扩展层，通常会和 `lumenpage-core` 的 `Editor` 一起使用。

## 备注
- 无额外备注。
