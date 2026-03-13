# lumenpage-inputrules

> 目录：`packages/lp/inputrules`

## 包定位
底层输入规则层，对应 ProseMirror inputrules 包。

## 当前职责
- 监听输入文本并匹配规则。
- 把文本模式转换成节点、mark 或结构变换。
- 为上层智能输入扩展提供基础。

## 入口与结构
- 包名：`lumenpage-inputrules`
- 主要入口：`src/index.ts`
- 构建方式：以 workspace 包形式被其他包或应用引用

## 对外导出
- `export {InputRule, inputRules, undoInputRule} from "./inputrules"`
- `export {emDash, ellipsis, openDoubleQuote, closeDoubleQuote, openSingleQuote, closeSingleQuote,`
- `export {wrappingInputRule, textblockTypeInputRule} from "./rulebuilders"`

## 依赖关系
### Workspace 依赖
- `lumenpage-state`
- `lumenpage-transform`
- `lumenpage-view-types`
- `lumenpage-model`

### 第三方依赖
- 无第三方运行时依赖。

## 典型用法
```ts
import { inputRules, textblockTypeInputRule } from "lumenpage-inputrules";
```

## 适用场景
- 需要在当前 monorepo 中复用这部分能力时直接引用该包。
- 需要做二次封装时，可以把它作为更高层扩展或应用包的基础依赖。
- 如果该包属于扩展层，通常会和 `lumenpage-core` 的 `Editor` 一起使用。

## 备注
- 无额外备注。
