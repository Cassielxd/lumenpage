# Editor API

`Editor` 是应用层最直接使用的对象。

## 初始化参数

```ts
type EditorOptions = {
  element?: HTMLElement | null;
  extensions?: Extensions;
  content?: string | Record<string, unknown>;
  editorProps?: Record<string, unknown>;
  editable?: boolean;
};
```

> 具体类型以 `lumenpage-core` 当前源码导出为准，本页给的是常用接入面。

## 常用实例方法

- `getHTML()`
- `getJSON()`
- `getText()`
- `isEditable`
- `setEditable(editable)`
- `destroy()`
- `on(event, handler)`
- `off(event, handler)`

## 常用属性

- `state`
- `view`
- `commands`
- `chain()`
- `schema`
- `extensionManager`

## 事务流

Lumenpage 的事务流仍然遵循 ProseMirror 模型：

1. 触发 command
2. 生成 transaction
3. 更新 state
4. 触发 Editor 事件
5. 同步到 CanvasEditorView

## 示例

```ts
editor.chain().focus().toggleBold().run();

editor.on("selectionUpdate", ({ editor }) => {
  console.log(editor.state.selection.from, editor.state.selection.to);
});
```
