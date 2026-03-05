# Lumen Menu Feature Checklist (Auto Synced)

- Source: `apps/lumen/src/editor/toolbarCatalog.ts`
- Rule: `implemented=true` means checked.
- Stats: total `103`, done `99`, pending `4`.
- Product completeness baseline: see `docs/lumen-product-completion-plan.md` (该文档为产品态口径，不等于 `implemented=true`)。
- Updated: 2026-02-27

## base (36/36)

- [x] `undo` (Undo), action: `undo`, command: `undo`
- [x] `redo` (Redo), action: `redo`, command: `redo`
- [x] `format-painter` (Format Painter), action: `format-painter`
- [x] `clear-format` (Clear Format), action: `clear-format`
- [x] `heading` (Heading), action: `heading`
- [x] `font-family` (Font Family), action: `font-family`
- [x] `font-size` (Font Size), action: `font-size`
- [x] `bold` (Bold), action: `bold`
- [x] `italic` (Italic), action: `italic`
- [x] `underline` (Underline), action: `underline`
- [x] `strike` (Strikethrough), action: `strike`
- [x] `subscript` (Subscript), action: `subscript`
- [x] `superscript` (Superscript), action: `superscript`
- [x] `color` (Text Color), action: `color`
- [x] `background-color` (Background Color), action: `background-color`
- [x] `highlight` (Highlight), action: `highlight`
- [x] `ordered-list` (Ordered List), action: `ordered-list`
- [x] `bullet-list` (Bullet List), action: `bullet-list`
- [x] `task-list` (Task List), action: `task-list`
- [x] `indent` (Indent), action: `indent`
- [x] `outdent` (Outdent), action: `outdent`
- [x] `line-height` (Line Height), action: `line-height`
- [x] `margin` (Paragraph Spacing), action: `margin`
- [x] `align-left` (Align Left), action: `align-left`
- [x] `align-center` (Align Center), action: `align-center`
- [x] `align-right` (Align Right), action: `align-right`
- [x] `align-justify` (Align Justify), action: `align-justify`
- [x] `align-distributed` (Align Distributed), action: `align-distributed`
- [x] `quote` (Quote), action: `quote`
- [x] `inline-code` (Inline Code), action: `inline-code`
- [x] `select-all` (Select All), action: `select-all`
- [x] `import-word` (Import Word), action: `import-word`
- [x] `markdown` (Markdown), action: `markdown`
- [x] `search-replace` (Search & Replace), action: `search-replace`
- [x] `viewer` (Viewer), action: `viewer`
- [x] `print` (Print), action: `print`

## insert (22/22)

- [x] `link` (Link), action: `link`
- [x] `image` (Image), action: `image`
- [x] `video` (Video), action: `video`
- [x] `audio` (Audio), action: `audio`
- [x] `file` (File), action: `file`
- [x] `code-block` (Code Block), action: `code-block`
- [x] `symbol` (Symbol), action: `symbol`
- [x] `chinese-date` (Chinese Date), action: `chinese-date`
- [x] `emoji` (Emoji), action: `emoji`
- [x] `math` (Math), action: `math`
- [x] `columns` (Columns), action: `columns`
- [x] `tag` (Tag), action: `tag`
- [x] `callout` (Callout), action: `callout`
- [x] `mention` (Mention), action: `mention`
- [x] `bookmark` (Bookmark), action: `bookmark`
- [x] `option-box` (Option Box), action: `option-box`
- [x] `hard-break` (Hard Break), action: `hard-break`
- [x] `hr` (Horizontal Rule), action: `hr`
- [x] `toc` (Table of Contents), action: `toc`
- [x] `text-box` (Text Box), action: `text-box`
- [x] `template` (Template), action: `template`
- [x] `web-page` (Web Page), action: `web-page`

## table (18/18)

- [x] `table-insert` (Insert Table), action: `table-insert`
- [x] `table-fix` (Fix Table), action: `table-fix`
- [x] `cells-align` (Cell Alignment), action: `cells-align`
- [x] `cells-background` (Cell Background), action: `cells-background`
- [x] `add-row-before` (Add Row Before), action: `add-row-before`, command: `addTableRowBefore`
- [x] `add-row-after` (Add Row After), action: `add-row-after`, command: `addTableRowAfter`
- [x] `add-column-before` (Add Column Before), action: `add-column-before`, command: `addTableColumnBefore`
- [x] `add-column-after` (Add Column After), action: `add-column-after`, command: `addTableColumnAfter`
- [x] `delete-row` (Delete Row), action: `delete-row`, command: `deleteTableRow`
- [x] `delete-column` (Delete Column), action: `delete-column`, command: `deleteTableColumn`
- [x] `merge-cells` (Merge Cells), action: `merge-cells`, command: `mergeTableCellRight`
- [x] `split-cell` (Split Cell), action: `split-cell`, command: `splitTableCell`
- [x] `toggle-header-row` (Toggle Header Row), action: `toggle-header-row`
- [x] `toggle-header-column` (Toggle Header Column), action: `toggle-header-column`
- [x] `toggle-header-cell` (Toggle Header Cell), action: `toggle-header-cell`
- [x] `next-cell` (Next Cell), action: `next-cell`, command: `goToNextTableCell`
- [x] `previous-cell` (Previous Cell), action: `previous-cell`, command: `goToPreviousTableCell`
- [x] `delete-table` (Delete Table), action: `delete-table`

## tools (5/9)

- [x] `qrcode` (QR Code), action: `qrcode`
- [x] `barcode` (Barcode), action: `barcode`
- [x] `signature` (Signature), action: `signature`
- [x] `seal` (Seal), action: `seal`
- [ ] `diagrams` (Diagrams), action: `diagrams`
- [ ] `echarts` (ECharts), action: `echarts`
- [ ] `mermaid` (Mermaid), action: `mermaid`
- [ ] `mind-map` (Mind Map), action: `mind-map`
- [x] `chinese-case` (Chinese Case), action: `chinese-case`

## page (11/11)

- [x] `toggle-toc` (TOC), action: `toggle-toc`
- [x] `page-margin` (Page Margin), action: `page-margin`
- [x] `page-size` (Page Size), action: `page-size`
- [x] `page-orientation` (Page Orientation), action: `page-orientation`
- [x] `page-break` (Page Break), action: `page-break`
- [x] `page-line-number` (Line Number), action: `page-line-number`
- [x] `page-watermark` (Watermark), action: `page-watermark`
- [x] `page-background` (Page Background), action: `page-background`
- [x] `page-preview` (Preview), action: `page-preview`
- [x] `page-header` (Header), action: `page-header`
- [x] `page-footer` (Footer), action: `page-footer`

## export (7/7)

- [x] `export-image` (Export Image), action: `export-image`
- [x] `export-pdf` (Export PDF), action: `export-pdf`
- [x] `export-text` (Export Text), action: `export-text`
- [x] `export-html` (Export HTML), action: `export-html`
- [x] `export-word` (Export Word), action: `export-word`
- [x] `share` (Share), action: `share`
- [x] `embed` (Embed), action: `embed`
