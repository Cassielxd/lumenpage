# 工具栏 API

这一页说明 `apps/lumen` 工具栏动作层的职责、入口和扩展方式。

## 主入口

核心目录：

- `apps/lumen/src/editor/toolbarActions/`

核心文件：

- `actionHandlers.ts`
- `handlers/textHandlers.ts`
- `handlers/tableHandlers.ts`
- `handlers/toolsHandlers.ts`
- `handlers/pageExportHandlers.ts`

## 动作分组

### 文本类

- `textFormatActions.ts`
- `textStyleActions.ts`
- `headingInlineActions.ts`

负责：

- 标题切换
- 加粗、斜体、删除线
- 行内样式
- 列表和引用等基础格式

### 表格类

- `tableActions.ts`

负责：

- 插入表格
- 增删行列
- 合并拆分单元格

### 工具类

- `toolsActions.ts`

负责：

- 签名
- 标签
- 书签
- 嵌入面板
- 其它业务块插入

### 页面与导出

- `layoutActions.ts`
- `pageAppearanceActions.ts`
- `exportActions.ts`
- `importActions.ts`

负责：

- 页面设置
- 打印
- PDF 导出
- Word 导入导出

## 按钮到动作文件的映射

| 按钮或菜单类目 | Handler 入口 | 实现文件 |
| --- | --- | --- |
| 文本格式 | `handlers/textHandlers.ts` | `textFormatActions.ts` / `textStyleActions.ts` |
| 标题和行内切换 | `handlers/textHandlers.ts` | `headingInlineActions.ts` |
| 表格操作 | `handlers/tableHandlers.ts` | `tableActions.ts` |
| 工具块插入 | `handlers/toolsHandlers.ts` | `toolsActions.ts` |
| 页面导入导出 | `handlers/pageExportHandlers.ts` | `importActions.ts` / `exportActions.ts` |
| 会话与模式切换 | `handlers/sessionHandlers.ts` | 会话相关 handler 内实现 |

## 典型调用方式

工具栏最终一般会落到两种调用：

### 调用命令

```ts
editor.commands.toggleBold();
editor.chain().focus().toggleHeading({ level: 1 }).run();
```

### 直接 dispatch transaction

```ts
view.dispatch(view.state.tr);
```

## 增加一个新动作的最小步骤

1. 在对应 `*Actions.ts` 写实现
2. 在 `handlers/*` 中注册
3. 在 `toolbarCatalog.ts` 中加按钮或菜单项
4. 如果需要弹窗，放到 `toolbarActions/ui/`

## 例子

### 新增签名类工具按钮

现有链路：

- `toolsHandlers.ts`
- `toolsActions.ts`
- `ui/signatureDialog.ts`

### 新增导出按钮

现有链路：

- `handlers/pageExportHandlers.ts`
- `exportActions.ts`
- `export/*`
