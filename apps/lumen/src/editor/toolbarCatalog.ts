import type { PlaygroundLocale } from "./i18n";

export type ToolbarMenuKey = "base" | "insert" | "table" | "tools" | "page" | "export";

type LocaleText = Record<PlaygroundLocale, string>;

export type ToolbarMenuTab = {
  value: ToolbarMenuKey;
  label: LocaleText;
};

export type ToolbarItemConfig = {
  id: string;
  icon: string;
  label: LocaleText;
  action: string;
  implemented: boolean;
  command?: string;
};

export type ToolbarGroupConfig = {
  id: string;
  items: ToolbarItemConfig[];
};

export const TOOLBAR_EXPORT_STRATEGY = {
  showExportTab: false,
  mergeExportIntoBase: true,
  onlyShowImplementedInBase: true,
} as const;

const text = (zh: string, en: string): LocaleText => ({ "zh-CN": zh, "en-US": en });

const item = (
  id: string,
  icon: string,
  zh: string,
  en: string,
  action = id,
  implemented = false,
  command?: string
): ToolbarItemConfig => ({ id, icon, label: text(zh, en), action, implemented, command });

export const TOOLBAR_MENU_TABS: ToolbarMenuTab[] = [
  { value: "base", label: text("开始", "Home") },
  { value: "insert", label: text("插入", "Insert") },
  { value: "table", label: text("表格", "Table") },
  { value: "tools", label: text("工具", "Tools") },
  { value: "page", label: text("页面", "Page") },
  { value: "export", label: text("导出", "Export") },
];

export const getVisibleToolbarMenuTabs = () =>
  TOOLBAR_MENU_TABS.filter((item) =>
    TOOLBAR_EXPORT_STRATEGY.showExportTab ? true : item.value !== "export"
  );

export const TOOLBAR_MENU_GROUPS: Record<ToolbarMenuKey, ToolbarGroupConfig[]> = {
  base: [
    {
      id: "history",
      items: [
        item("undo", "undo", "撤销", "Undo", "undo", true, "undo"),
        item("redo", "redo", "重做", "Redo", "redo", true, "redo"),
        item(
          "format-painter",
          "format-painter",
          "格式刷",
          "Format Painter",
          "format-painter",
          true
        ),
        item("clear-format", "clear-format", "清除格式", "Clear Format", "clear-format", true),
      ],
    },
    {
      id: "font",
      items: [
        item("heading", "heading", "标题", "Heading", "heading", true),
        item("font-family", "font-family", "字体", "Font Family", "font-family", true),
        item("font-size", "font-size", "字号", "Font Size", "font-size", true),
        item("bold", "bold", "加粗", "Bold", "bold", true),
        item("italic", "italic", "斜体", "Italic", "italic", true),
        item("underline", "underline", "下划线", "Underline", "underline", true),
        item("strike", "strike", "删除线", "Strikethrough", "strike", true),
        item("subscript", "subscript", "下标", "Subscript", "subscript", true),
        item("superscript", "superscript", "上标", "Superscript", "superscript", true),
        item("color", "color", "文字颜色", "Text Color", "color", true),
        item(
          "background-color",
          "background-color",
          "背景色",
          "Background Color",
          "background-color",
          true
        ),
        item("highlight", "highlight", "高亮", "Highlight", "highlight", true),
      ],
    },
    {
      id: "paragraph",
      items: [
        item("ordered-list", "ordered-list", "有序列表", "Ordered List", "ordered-list", true),
        item("bullet-list", "bullet-list", "无序列表", "Bullet List", "bullet-list", true),
        item("task-list", "task-list", "任务列表", "Task List", "task-list", true),
        item("indent", "indent", "增加缩进", "Indent", "indent", true),
        item("outdent", "outdent", "减少缩进", "Outdent", "outdent", true),
        item("line-height", "line-height", "行高", "Line Height", "line-height", true),
        item("margin", "margin", "段间距", "Paragraph Spacing", "margin", true),
        item("align-left", "align-left", "左对齐", "Align Left", "align-left", true),
        item("align-center", "align-center", "居中", "Align Center", "align-center", true),
        item("align-right", "align-right", "右对齐", "Align Right", "align-right", true),
        item("align-justify", "align-justify", "两端对齐", "Align Justify", "align-justify", true),
        item(
          "align-distributed",
          "align-distributed",
          "分散对齐",
          "Align Distributed",
          "align-distributed",
          true
        ),
        item("quote", "quote", "引用", "Quote", "quote", true),
        item("inline-code", "code", "行内代码", "Inline Code", "inline-code", true),
        item("select-all", "select-all", "全选", "Select All", "select-all", true),
      ],
    },
    {
      id: "document",
      items: [
        item("import-word", "word", "导入 Word", "Import Word", "import-word", true),
        item("markdown", "markdown", "Markdown", "Markdown", "markdown", true),
        item(
          "search-replace",
          "search-replace",
          "查找替换",
          "Search & Replace",
          "search-replace",
          true
        ),
      ],
    },
    {
      id: "view",
      items: [
        item("viewer", "viewer", "阅读模式", "Viewer", "viewer", true),
        item("print", "print", "打印", "Print", "print", true),
      ],
    },
  ],
  insert: [
    {
      id: "insert-media",
      items: [
        item("link", "link", "链接", "Link", "link", true),
        item("image", "image", "图片", "Image", "image", true),
        item("video", "video", "视频", "Video", "video", true),
        item("audio", "audio", "音频", "Audio", "audio", true),
        item("file", "file", "文件", "File", "file", true),
        item("code-block", "code-block", "代码块", "Code Block", "code-block", true),
        item("symbol", "symbol", "符号", "Symbol", "symbol", true),
        item("chinese-date", "date", "中文日期", "Chinese Date", "chinese-date", true),
        item("emoji", "emoji", "表情", "Emoji", "emoji", true),
        item("math", "math", "公式", "Math", "math", true),
      ],
    },
    {
      id: "insert-advanced",
      items: [
        item("columns", "columns", "分栏", "Columns", "columns", true),
        item("tag", "tag", "标签", "Tag", "tag", true),
        item("callout", "callout", "提示块", "Callout", "callout", true),
        item("mention", "mention", "提及", "Mention", "mention", true),
        item("bookmark", "bookmark", "书签", "Bookmark", "bookmark", true),
        item("option-box", "option-box", "选项框", "Option Box", "option-box", true),
      ],
    },
    {
      id: "insert-layout",
      items: [
        item("hard-break", "hard-break", "硬换行", "Hard Break", "hard-break", true),
        item("hr", "hr", "分割线", "Horizontal Rule", "hr", true),
        item("toc", "toc", "目录", "Table of Contents", "toc", true),
        item("text-box", "text-box", "文本框", "Text Box", "text-box", true),
      ],
    },
    {
      id: "insert-template",
      items: [
        item("template", "template", "模板", "Template", "template", true),
        item("web-page", "web-page", "网页嵌入", "Web Page", "web-page", true),
      ],
    },
  ],
  table: [
    {
      id: "table-main",
      items: [
        item("table-insert", "table", "插入表格", "Insert Table", "table-insert", true),
        item("table-fix", "table-fix", "修复表格", "Fix Table", "table-fix", true),
      ],
    },
    {
      id: "table-style",
      items: [
        item("cells-align", "table-cells-align", "单元格对齐", "Cell Alignment", "cells-align", true),
        item(
          "cells-background",
          "table-cells-background",
          "单元格背景",
          "Cell Background",
          "cells-background",
          true
        ),
      ],
    },
    {
      id: "table-add",
      items: [
        item(
          "add-row-before",
          "table-add-row-before",
          "上方加行",
          "Add Row Before",
          "add-row-before",
          true,
          "addTableRowBefore"
        ),
        item(
          "add-row-after",
          "table-add-row-after",
          "下方加行",
          "Add Row After",
          "add-row-after",
          true,
          "addTableRowAfter"
        ),
        item(
          "add-column-before",
          "table-add-column-before",
          "左侧加列",
          "Add Column Before",
          "add-column-before",
          true,
          "addTableColumnBefore"
        ),
        item(
          "add-column-after",
          "table-add-column-after",
          "右侧加列",
          "Add Column After",
          "add-column-after",
          true,
          "addTableColumnAfter"
        ),
      ],
    },
    {
      id: "table-delete",
      items: [
        item(
          "delete-row",
          "table-delete-row",
          "删除行",
          "Delete Row",
          "delete-row",
          true,
          "deleteTableRow"
        ),
        item(
          "delete-column",
          "table-delete-column",
          "删除列",
          "Delete Column",
          "delete-column",
          true,
          "deleteTableColumn"
        ),
      ],
    },
    {
      id: "table-merge",
      items: [
        item(
          "merge-cells",
          "table-merge-cell",
          "合并单元格",
          "Merge Cells",
          "merge-cells",
          true,
          "mergeTableCellRight"
        ),
        item(
          "split-cell",
          "table-split-cell",
          "拆分单元格",
          "Split Cell",
          "split-cell",
          true,
          "splitTableCell"
        ),
      ],
    },
    {
      id: "table-header",
      items: [
        item(
          "toggle-header-row",
          "table-header-row",
          "切换标题行",
          "Toggle Header Row",
          "toggle-header-row",
          true
        ),
        item(
          "toggle-header-column",
          "table-header-column",
          "切换标题列",
          "Toggle Header Column",
          "toggle-header-column",
          true
        ),
        item(
          "toggle-header-cell",
          "table-header-cell",
          "切换标题单元格",
          "Toggle Header Cell",
          "toggle-header-cell",
          true
        ),
      ],
    },
    {
      id: "table-nav",
      items: [
        item(
          "next-cell",
          "table-next-cell",
          "下一个单元格",
          "Next Cell",
          "next-cell",
          true,
          "goToNextTableCell"
        ),
        item(
          "previous-cell",
          "table-previous-cell",
          "上一个单元格",
          "Previous Cell",
          "previous-cell",
          true,
          "goToPreviousTableCell"
        ),
      ],
    },
    {
      id: "table-remove",
      items: [
        item("delete-table", "table-delete", "删除表格", "Delete Table", "delete-table", true),
      ],
    },
  ],
  tools: [
    {
      id: "tools-code",
      items: [
        item("qrcode", "qrcode", "二维码", "QR Code", "qrcode", true),
        item("barcode", "barcode", "条形码", "Barcode", "barcode", true),
      ],
    },
    {
      id: "tools-sign",
      items: [
        item("signature", "signature", "签名", "Signature", "signature", true),
        item("seal", "seal", "印章", "Seal", "seal", true),
      ],
    },
    {
      id: "tools-chart",
      items: [
        item("diagrams", "diagrams", "流程图", "Diagrams", "diagrams", true),
        item("echarts", "echarts", "图表", "ECharts", "echarts", true),
        item("mermaid", "mermaid", "Mermaid", "Mermaid", "mermaid", true),
        item("mind-map", "mind-map", "思维导图", "Mind Map", "mind-map", true),
      ],
    },
    {
      id: "tools-text",
      items: [item("chinese-case", "chinese-case", "中文大小写", "Chinese Case", "chinese-case", true)],
    },
  ],
  page: [
    {
      id: "page-toc",
      items: [item("toggle-toc", "toc", "目录", "TOC", "toggle-toc", true)],
    },
    {
      id: "page-layout",
      items: [
        item("page-margin", "margin", "页边距", "Page Margin", "page-margin", true),
        item("page-size", "size", "纸张大小", "Page Size", "page-size", true),
        item(
          "page-orientation",
          "orientation",
          "纸张方向",
          "Page Orientation",
          "page-orientation",
          true
        ),
      ],
    },
    {
      id: "page-mark",
      items: [
        item("page-break", "page-break", "分页符", "Page Break", "page-break", true),
        item("page-line-number", "line-number", "行号", "Line Number", "page-line-number", true),
        item("page-watermark", "watermark", "水印", "Watermark", "page-watermark", true),
        item(
          "page-background",
          "background",
          "页面背景",
          "Page Background",
          "page-background",
          true
        ),
      ],
    },
    {
      id: "page-view",
      items: [
        item("page-preview", "preview", "预览", "Preview", "page-preview", true),
        item("page-header", "header", "页眉", "Header", "page-header", true),
        item("page-footer", "footer", "页脚", "Footer", "page-footer", true),
      ],
    },
  ],
  export: [
    {
      id: "export-file",
      items: [
        item("export-image", "image", "导出图片", "Export Image", "export-image", true),
        item("export-pdf", "pdf", "导出 PDF", "Export PDF", "export-pdf", true),
        item("export-text", "text", "导出文本", "Export Text", "export-text", true),
        item("export-html", "html5", "导出 HTML", "Export HTML", "export-html", true),
        item("export-word", "word", "导出 Word", "Export Word", "export-word", true),
      ],
    },
    {
      id: "export-share",
      items: [
        item("share", "share", "分享", "Share", "share", true),
        item("embed", "embed", "嵌入", "Embed", "embed", true),
      ],
    },
  ],
};
