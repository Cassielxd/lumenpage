# Lumen 菜单产品完成收口方案（104 项）

- 更新时间：2026-02-26
- 统计来源：`apps/lumen/src/editor/toolbarCatalog.ts` + `apps/lumen/src/editor/toolbarActions/*` 实现复核

## 1. 口径定义

`implemented=true` 只代表“已接线”，不代表“产品完成”。

产品完成（Product Complete）按以下标准判定：

1. 有稳定交互（非 `window.prompt/alert` 主流程）。
2. 非占位实现（不以纯文本 fallback 代替真实能力）。
3. 与当前编辑器状态、权限、国际化流程一致。
4. 有可回归路径（至少可被 smoke 或明确脚本验证）。

## 2. 当前基线

- 总项数：`104`
- 产品完成：`65`
- 未完成：`39`

模块分布：

- `base`：未完成 `7`
- `insert`：未完成 `16`
- `table`：未完成 `2`
- `tools`：未完成 `9`
- `page`：未完成 `5`
- `export`：未完成 `0`

## 3. 未完成清单（39 项）

### base（7）

- [ ] `font-family`
- [ ] `font-size`
- [ ] `line-height`
- [ ] `margin`
- [ ] `import-word`
- [ ] `markdown`
- [ ] `search-replace`

### insert（16）

- [ ] `link`
- [ ] `image`
- [ ] `video`
- [ ] `audio`
- [ ] `file`
- [ ] `symbol`
- [ ] `emoji`
- [ ] `math`
- [ ] `columns`
- [ ] `tag`
- [ ] `callout`
- [ ] `bookmark`
- [ ] `option-box`
- [ ] `text-box`
- [ ] `template`
- [ ] `web-page`

### table（2）

- [ ] `table-insert`
- [ ] `cells-align`

### tools（9）

- [ ] `qrcode`
- [ ] `barcode`
- [ ] `signature`
- [ ] `seal`
- [ ] `diagrams`
- [ ] `echarts`
- [ ] `mermaid`
- [ ] `mind-map`
- [ ] `chinese-case`

### page（5）

- [ ] `page-margin`
- [ ] `page-size`
- [ ] `page-watermark`
- [ ] `page-header`
- [ ] `page-footer`

## 4. 完整实施方案（按分包与功能域）

### 阶段 A：统一交互壳层（先做）

目标：清理 `prompt/alert` 主流程，建立统一可复用交互。

1. 在 `apps/lumen/src/editor` 新增 `toolbarPanels/*`（或等价目录）承载表单弹层。
2. `toolbarActions/*` 只保留业务命令，不直接弹原生对话框。
3. 复用现有 `t-dialog` / `t-color-picker` 模式，形成 hook 化调用。
4. 明确约束：不允许“数据兜底文本”替代真实节点能力。

### 阶段 B：核心编辑能力收口（base/insert/table/page）

目标：把 30 项高频编辑功能提升到产品态。

1. `base`：字体/段落/查找替换/导入/Markdown 改为面板交互。
2. `insert`：媒体与高级块改为结构化表单，直接落真实节点。
3. `table`：插入尺寸与对齐配置改为表单，不走 prompt。
4. `page`：页边距/纸张/页眉页脚/水印改为统一页面设置面板。

### 阶段 C：工具域能力收口（tools）

目标：9 项工具能力去占位化。

1. 二维码/条码：明确在线服务依赖与本地降级策略。
2. 签名/印章：提供结构化配置与节点渲染，不插占位文本。
3. diagrams/echarts/mermaid/mind-map：落到可编辑源码块 + 渲染容器。
4. `chinese-case`：输入与模式切换进入统一面板，支持选区回填。

### 阶段 D：验收与同步机制

1. 给 39 项补最小回归（smoke 或脚本化断言）。
2. 文档双指标并行维护：
   - 接线完成度：`implemented=true`
   - 产品完成度：本文件 checklist
3. 每完成一项，更新本文件勾选状态与统计数字。

## 5. 完成定义（DoD）

单项功能“完成”必须同时满足：

- [ ] 无 `window.prompt/alert` 主流程依赖
- [ ] 无占位 fallback 文本实现
- [ ] 权限与只读模式行为正确
- [ ] 中英文文案齐全
- [ ] 有可重复验证路径（smoke/脚本/明确手工用例）
