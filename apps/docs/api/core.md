# Core API

`lumenpage-core` 是上层编辑器 API 入口。

## 主要导出

### 类

- `Editor`
- `CommandManager`
- `Extension`
- `Node`
- `Mark`
- `ExtensionManager`
- `EventEmitter`

### 方法与工厂

- `createChainableState`
- `createDocument`
- `createSchema`
- `markPasteRule`
- `nodePasteRule`
- `textPasteRule`
- `pasteRulesPlugin`

### 类型

- `EditorOptions`
- `EditorEvents`
- `DispatchTransactionProps`
- `SchemaSpec`
- `NodeConfig`
- `MarkConfig`
- `CanvasHooks`
- `LayoutHooks`

## 最常用入口

```ts
import { Editor, Extension, Node, Mark } from "lumenpage-core";
```

## 适用范围

- 应用层封装
- 自定义扩展
- 命令和事件订阅
- schema 组装

## 不负责的事情

- 分页布局计算
- Canvas 绘制
- 业务块具体实现
