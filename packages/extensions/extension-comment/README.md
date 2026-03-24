# lumenpage-extension-comment

> 目录：`packages/extensions/extension-comment`

## 包定位
Canvas 编辑器的评论锚点扩展。

## 当前职责
- 用 mark 保存轻量评论锚点（`threadId`、`anchorId`）。
- 用 runtime plugin 维护活动线程状态与高亮装饰。
- 保持评论正文和线程元数据留在文档外部 store，避免把业务状态塞进 schema。

## 入口与结构
- 包名：`lumenpage-extension-comment`
- 主要入口：`src/index.ts`
- 核心文件：
  - `src/commentAnchor.ts`
  - `src/commentsPlugin.ts`
  - `src/commentsRuntime.ts`
  - `src/types.ts`

## 对外导出
- `export const Comments = Extension.create<CommentsOptions>({`
- `export const CommentAnchor = Mark.create({`
- `export const CommentsRuntime = Extension.create<CommentsOptions>({`
- `export const CommentsPluginKey = new PluginKey<CommentsPluginState>("comments");`
- `export const COMMENT_MUTATION_META = "comment:mutation";`

## 典型用法
```ts
import { Editor } from "lumenpage-core";
import Comments from "lumenpage-extension-comment";

const editor = new Editor({
  element,
  extensions: [
    Comments.configure({
      store: commentStore,
    }),
  ],
});
```

## 备注
- 文档只存锚点，不存完整评论线程数据。
- 评论面板、侧边栏、权限策略建议放在应用层。
