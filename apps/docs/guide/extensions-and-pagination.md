# 扩展与分页

Lumenpage 的一个核心差异点是：扩展、布局、渲染是分层的。

## 扩展层

扩展负责：

- schema
- command
- keyboard shortcut
- plugin
- 业务块 renderer / node view

典型包：

- `lumenpage-extension-image`
- `lumenpage-extension-table`
- `lumenpage-extension-mention`
- `lumenpage-extension-slash-command`

## 分页层

`lumenpage-layout-engine` 负责：

- 断行
- 块布局
- 分页
- 页面范围和复用

## 渲染层

`lumenpage-render-engine` 只保留基础通用默认实现，例如：

- paragraph
- heading
- image
- table
- video
- list

业务块如 `signature`、`embedPanel`、`callout` 在扩展包中自有实现。

## 设计原则

1. 基础能力进核心层
2. 业务能力留在扩展层
3. 扩展可覆盖默认 renderer / mark adapter
