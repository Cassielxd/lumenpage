# lumenpage-extension-text-style

> 目录：`packages/extensions/extension-text-style`

## 包定位
文本样式 mark 扩展，承载颜色、字号等行内样式。

## 当前职责
- 注册 mark 语义和对应的 HTML 解析/序列化规则。
- 在 Canvas 渲染层补充 mark 渲染适配或标注信息。
- 为上层命令链提供 mark 开关、设置、清除等操作入口。

## 入口与结构
- 包名：`lumenpage-extension-text-style`
- 主要入口：`src/index.ts`
- 构建方式：以 workspace 包形式被其他包或应用引用

## 对外导出
- `export const TextStyle = Mark.create({`
- `export default TextStyle;`

## 依赖关系
### Workspace 依赖
- `lumenpage-core`
- `lumenpage-render-engine`

### 第三方依赖
- 无第三方运行时依赖。

## 典型用法
```ts
import { Editor } from "lumenpage-core";
import TextStyle from "lumenpage-extension-text-style";

const editor = new Editor({
  element,
  extensions: [TextStyle],
});
```

## 适用场景
- 需要在当前 monorepo 中复用这部分能力时直接引用该包。
- 需要做二次封装时，可以把它作为更高层扩展或应用包的基础依赖。
- 如果该包属于扩展层，通常会和 `lumenpage-core` 的 `Editor` 一起使用。

## 备注
- 无额外备注。

