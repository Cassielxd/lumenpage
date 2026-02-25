# Lumen 菜单功能清单（对齐状态）

来源：

- `apps/lumen/src/editor/toolbarCatalog.ts`
- `apps/lumen/src/components/EditorToolbar.vue`

判定规则：

- `已实现`：`toolbarCatalog` 中 `implemented=true`，且 `EditorToolbar` 有实际执行逻辑。
- `未实现`：仅有菜单项/图标，占位未接业务动作。

## 总览

- 菜单页签：`base / insert / table / tools / page / export`
- 菜单项总数：`104`
- 已实现：`27`
- 未实现：`77`

## 状态差异（2026-02-25）

- Lumen 顶部菜单当前已隐藏 `export` Tab（`EditorMenuBar` 过滤），但 `export` 分组定义仍保留在 `toolbarCatalog`。
- 开始区会复用导出相关动作项（即“导出能力保留，但不单独占用顶栏 Tab”）。
- 新增接线项（已从占位转为可执行）：
  - `add-row-before`
  - `add-column-before`
  - `next-cell`
  - `previous-cell`
  - `page-break-marks`
  - `line-height`
  - `margin`
  - `select-all`
  - `print`
  - `table-insert`
  - `table-fix`
  - `toggle-header-row`
  - `toggle-header-column`
  - `toggle-header-cell`
  - `delete-table`
  - `page-break`
  - `page-margin`
  - `page-size`
  - `page-orientation`
  - `page-preview`
  - `markdown`
  - `export-text`
  - `clear-format`
  - `format-painter`
  - `import-word`
  - `font-family`
  - `font-size`
  - `subscript`
  - `superscript`
  - `color`
  - `background-color`
  - `highlight`
  - `align-justify`
  - `align-distributed`
  - `search-replace`
  - `viewer`
  - `hard-break`
  - `symbol`
  - `emoji`
  - `chinese-date`
  - `export-image`
  - `export-pdf`
  - `export-html`
  - `export-word`
  - `share`
  - `embed`
  - `page-line-number`
  - `page-watermark`
  - `page-background`
  - `page-header`
  - `page-footer`
- 本文“总览统计”尚未按上述增量重算，后续可改为脚本自动生成，避免手工统计漂移。
- 下方“已实现/未实现明细”尚未回写上述增量项，请以本节为准。

## 已实现功能（27）

### 开始（base）

- [x] `undo` 撤销
- [x] `redo` 重做
- [x] `heading` 标题/段落切换（含 H1-H6）
- [x] `bold` 加粗
- [x] `italic` 斜体
- [x] `underline` 下划线
- [x] `strike` 删除线
- [x] `ordered-list` 有序列表
- [x] `bullet-list` 无序列表
- [x] `indent` 增加缩进
- [x] `outdent` 减少缩进
- [x] `align-left` 左对齐
- [x] `align-center` 居中
- [x] `align-right` 右对齐
- [x] `quote` 引用
- [x] `inline-code` 行内代码

### 插入（insert）

- [x] `link` 插入/切换链接
- [x] `image` 插入图片
- [x] `video` 插入视频
- [x] `code-block` 代码块
- [x] `hr` 分割线

### 表格（table）

- [x] `add-row-after` 下方加行
- [x] `add-column-after` 右侧加列
- [x] `delete-row` 删除行
- [x] `delete-column` 删除列
- [x] `merge-cells` 合并单元格（向右）
- [x] `split-cell` 拆分单元格

## 未实现（占位）清单（77）

### 开始（base）

- [ ] `format-painter` 格式刷
- [ ] `clear-format` 清除格式
- [ ] `font-family` 字体
- [ ] `font-size` 字号
- [ ] `subscript` 下标
- [ ] `superscript` 上标
- [ ] `color` 文字颜色
- [ ] `background-color` 背景色
- [ ] `highlight` 高亮
- [ ] `task-list` 任务列表
- [ ] `line-height` 行高
- [ ] `margin` 段间距
- [ ] `align-justify` 两端对齐
- [ ] `align-distributed` 分散对齐
- [ ] `select-all` 全选
- [ ] `import-word` 导入 Word
- [ ] `markdown` Markdown
- [ ] `search-replace` 查找替换
- [ ] `viewer` 阅读模式
- [ ] `print` 打印

### 插入（insert）

- [ ] `audio` 音频
- [ ] `file` 文件
- [ ] `symbol` 符号
- [ ] `chinese-date` 中文日期
- [ ] `emoji` 表情
- [ ] `math` 公式
- [ ] `columns` 分栏
- [ ] `tag` 标签
- [ ] `callout` 提示块
- [ ] `mention` 提及
- [ ] `bookmark` 书签
- [ ] `option-box` 选项框
- [ ] `hard-break` 硬换行
- [ ] `toc` 目录
- [ ] `text-box` 文本框
- [ ] `template` 模板
- [ ] `web-page` 网页嵌入

### 表格（table）

- [ ] `table-insert` 插入表格
- [ ] `table-fix` 修复表格
- [ ] `cells-align` 单元格对齐
- [ ] `cells-background` 单元格背景
- [ ] `add-row-before` 上方加行
- [ ] `add-column-before` 左侧加列
- [ ] `toggle-header-row` 切换标题行
- [ ] `toggle-header-column` 切换标题列
- [ ] `toggle-header-cell` 切换标题单元格
- [ ] `next-cell` 下一个单元格
- [ ] `previous-cell` 上一个单元格
- [ ] `delete-table` 删除表格

### 工具（tools）

- [ ] `qrcode` 二维码
- [ ] `barcode` 条形码
- [ ] `signature` 签名
- [ ] `seal` 印章
- [ ] `diagrams` 流程图
- [ ] `echarts` 图表
- [ ] `mermaid` Mermaid
- [ ] `mind-map` 思维导图
- [ ] `chinese-case` 中文大小写

### 页面（page）

- [ ] `toggle-toc` 目录
- [ ] `page-margin` 页边距
- [ ] `page-size` 纸张大小
- [ ] `page-orientation` 纸张方向
- [ ] `page-break` 分页符
- [ ] `page-break-marks` 分页标记
- [ ] `page-line-number` 行号
- [ ] `page-watermark` 水印
- [ ] `page-background` 页面背景
- [ ] `page-preview` 预览
- [ ] `page-header` 页眉
- [ ] `page-footer` 页脚

### 导出（export）

- [ ] `export-image` 导出图片
- [ ] `export-pdf` 导出 PDF
- [ ] `export-text` 导出文本
- [ ] `export-html` 导出 HTML
- [ ] `export-word` 导出 Word
- [ ] `share` 分享
- [ ] `embed` 嵌入
