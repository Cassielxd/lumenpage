# lumenpage-extension-bullet-list

> 目录：`packages/extension-bullet-list`

## 包定位
无序列表节点扩展。

## 当前职责
- 注册节点 spec、属性、解析规则和 HTML 序列化规则。
- 对接 lumenpage-render-engine 的默认或自定义节点渲染器。
- 在需要时补充节点命令、输入规则或布局辅助逻辑。

## 入口与结构
- 包名：`lumenpage-extension-bullet-list`
- 主要入口：`src/index.ts`
- 构建方式：以 workspace 包形式被其他包或应用引用

## 对外导出
- `export const bulletListNodeSpec = listNodeSpecs.bulletList;`
- `export { defaultBulletListRenderer as bulletListRenderer } from "lumenpage-render-engine";`
- `export const BulletList = Node.create({`
- `export default BulletList;`

## 依赖关系
### Workspace 依赖
- `lumenpage-core`
- `lumenpage-extension-list-item`
- `lumenpage-render-engine`

### 第三方依赖
- 无第三方运行时依赖。

## 典型用法
```ts
import { Editor } from "lumenpage-core";
import BulletList from "lumenpage-extension-bullet-list";

const editor = new Editor({
  element,
  extensions: [BulletList],
});
```

## 适用场景
- 需要在当前 monorepo 中复用这部分能力时直接引用该包。
- 需要做二次封装时，可以把它作为更高层扩展或应用包的基础依赖。
- 如果该包属于扩展层，通常会和 `lumenpage-core` 的 `Editor` 一起使用。

## 备注
- 无额外备注。

