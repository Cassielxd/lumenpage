# 斜杠命令 Demo

斜杠命令用于在新段落开头输入 `/` 后弹出块插入菜单。

## 触发方式

1. 新建空段落
2. 在段落开头输入 `/`
3. 选择目标块
4. 当前段落会被替换成对应块

## 运行入口

斜杠命令已经接在 `apps/lumen` 中：

```bash
pnpm dev:lumen
```

然后在应用中创建新段落，输入 `/` 即可触发。

## 接线示例

```ts
import { SlashCommandExtension } from "lumenpage-extension-slash-command";

const editor = new Editor({
  extensions: [
    StarterKit,
    SlashCommandExtension.configure({
      items: [
        { title: "标题 1", command: "heading1" },
        { title: "无序列表", command: "bulletList" },
      ],
    }),
  ],
});
```

## 相关源码

- `packages/extension-slash-command/src/`
- `apps/lumen/src/editor/slashCommandCase.ts`
