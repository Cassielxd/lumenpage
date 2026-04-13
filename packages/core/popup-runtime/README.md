# lumenpage-popup-runtime

> 目录：`packages/core/popup-runtime`

## 包定位
通用弹层运行时基础设施。

## 当前职责
- 提供统一的 popup controller、坐标换算和渲染生命周期运行时。
- 负责弹层定位、显示隐藏和宿主 DOM 绑定。
- 不直接注册编辑器扩展，也不提供文档节点。

## 入口与结构
- 包名：`lumenpage-popup-runtime`
- 主要入口：`src/index.ts`
- 构建方式：以 workspace 基础包形式被其他扩展或应用引用

## 对外导出
- `createPopupController`
- `createPopupRenderRuntime`
- `toPopupRect`
- `toViewportPopupRect`

## 依赖关系
### Workspace 依赖
- 无 workspace 依赖。

### 第三方依赖
- `@floating-ui/dom`: `1.7.4`

## 典型用法
```ts
import {
  createPopupController,
  createPopupRenderRuntime,
} from "lumenpage-popup-runtime";

const popup = createPopupController(document, {
  placement: "bottom-start",
});

const runtime = createPopupRenderRuntime(renderer, () => popup.hide());
```

## 适用场景
- mention、slash command、bubble menu 这类交互扩展的统一弹层基础设施。
- 需要在应用层或扩展层复用弹层定位和渲染生命周期时直接引用。

## 备注
- 这是 runtime 包，不是编辑器扩展包。
