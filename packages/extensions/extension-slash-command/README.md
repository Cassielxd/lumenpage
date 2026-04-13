# lumenpage-extension-slash-command

> 目录：`packages/extensions/extension-slash-command`

## 包定位
斜杠命令扩展。

## 当前职责
- 在段落开头输入 `/` 时弹出块命令菜单。
- 复用现有 `Suggestion + popup` 体系。
- 选择命令后删除当前 `/query`，并替换当前块。

## 入口与结构
- 包名：`lumenpage-extension-slash-command`
- 主要入口：`src/index.ts`

## 对外导出
- `SlashCommandExtension`
- `createSlashCommandPlugin`
- `openSlashCommandPicker`

## 依赖关系
### Workspace 依赖
- `lumenpage-core`
- `lumenpage-popup-runtime`
- `lumenpage-state`
- `lumenpage-suggestion`

## 典型用法
```ts
import { SlashCommandExtension } from "lumenpage-extension-slash-command";

const editor = new Editor({
  element,
  extensions: [
    SlashCommandExtension.configure({
      items: [],
    }),
  ],
});
```
