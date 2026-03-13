# Lumen 应用 Demo

`apps/lumen` 是当前仓库里最完整的业务应用示例。

## 运行方式

```bash
pnpm dev:lumen
```

## 本地入口

- Lumen App: `http://localhost:5174/`

如果你的本地端口被占用，Vite 会自动顺延到下一个可用端口。

## 可以直接验证的功能

- 分页编辑
- 工具栏
- mention
- slash command
- bubble menu
- drag handle
- 表格、图片、视频、附件、签名等业务块

## 推荐阅读源码

- `apps/lumen/src/editor/documentExtensions.ts`
- `apps/lumen/src/editor/editorMount.ts`
- `apps/lumen/src/editor/toolbarActions/`

这些文件基本覆盖了应用层如何组装 extension、view 和工具栏。
