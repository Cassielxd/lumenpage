import { createPlaygroundI18n, type PlaygroundLocale } from "./i18n";

export type ToolbarMenuKey = "base" | "insert" | "table" | "tools" | "page" | "export";
export type ToolbarCatalogLabelKey = string;

export const EMPTY_TOOLBAR_LABEL_KEY = "__empty__";

export type ToolbarMenuTab = {
  value: ToolbarMenuKey;
  labelKey: ToolbarCatalogLabelKey;
};

export type ToolbarItemConfig = {
  id: string;
  icon: string;
  labelKey: ToolbarCatalogLabelKey;
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

const tab = (value: ToolbarMenuKey, labelKey: ToolbarCatalogLabelKey): ToolbarMenuTab => ({
  value,
  labelKey,
});

const item = (
  id: string,
  icon: string,
  labelKey: ToolbarCatalogLabelKey = id,
  action = id,
  implemented = false,
  command?: string
): ToolbarItemConfig => ({ id, icon, labelKey, action, implemented, command });

export const resolveToolbarCatalogLabel = (
  locale: PlaygroundLocale,
  labelKey: ToolbarCatalogLabelKey
) => createPlaygroundI18n(locale).toolbarCatalog[labelKey] || "";

export const TOOLBAR_MENU_TABS: ToolbarMenuTab[] = [
  tab("base", "tab.base"),
  tab("insert", "tab.insert"),
  tab("table", "tab.table"),
  tab("tools", "tab.tools"),
  tab("page", "tab.page"),
  tab("export", "tab.export"),
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
        item("undo", "undo", "undo", "undo", true, "undo"),
        item("redo", "redo", "redo", "redo", true, "redo"),
        item("format-painter", "format-painter", "format-painter", "format-painter", true),
        item("clear-format", "clear-format", "clear-format", "clear-format", true),
      ],
    },
    {
      id: "font",
      items: [
        item("heading", "heading", "heading", "heading", true),
        item("font-family", "font-family", "font-family", "font-family", true),
        item("font-size", "font-size", "font-size", "font-size", true),
        item("bold", "bold", "bold", "bold", true),
        item("italic", "italic", "italic", "italic", true),
        item("underline", "underline", "underline", "underline", true),
        item("strike", "strike", "strike", "strike", true),
        item("subscript", "subscript", "subscript", "subscript", true),
        item("superscript", "superscript", "superscript", "superscript", true),
        item("color", "color", "color", "color", true),
        item(
          "background-color",
          "background-color",
          "background-color",
          "background-color",
          true
        ),
        item("highlight", "highlight", "highlight", "highlight", true),
      ],
    },
    {
      id: "paragraph",
      items: [
        item("ordered-list", "ordered-list", "ordered-list", "ordered-list", true),
        item("bullet-list", "bullet-list", "bullet-list", "bullet-list", true),
        item("task-list", "task-list", "task-list", "task-list", true),
        item("indent", "indent", "indent", "indent", true),
        item("outdent", "outdent", "outdent", "outdent", true),
        item("line-height", "line-height", "line-height", "line-height", true),
        item("margin", "margin", "margin", "margin", true),
        item("align-left", "align-left", "align-left", "align-left", true),
        item("align-center", "align-center", "align-center", "align-center", true),
        item("align-right", "align-right", "align-right", "align-right", true),
        item("align-justify", "align-justify", "align-justify", "align-justify", true),
        item(
          "align-distributed",
          "align-distributed",
          "align-distributed",
          "align-distributed",
          true
        ),
        item("quote", "quote", "quote", "quote", true),
        item("inline-code", "code", "inline-code", "inline-code", true),
        item("select-all", "select-all", "select-all", "select-all", true),
      ],
    },
    {
      id: "document",
      items: [
        item("import-word", "word", "import-word", "import-word", true),
        item("markdown", "markdown", "markdown", "markdown", true),
        item("search-replace", "search-replace", "search-replace", "search-replace", true),
      ],
    },
    {
      id: "view",
      items: [
        item("viewer", "viewer", "viewer", "viewer", true),
        item("print", "print", "print", "print", true),
      ],
    },
  ],
  insert: [
    {
      id: "insert-media",
      items: [
        item("link", "link", "link", "link", true),
        item("image", "image", "image", "image", true),
        item("video", "video", "video", "video", true),
        item("audio", "audio", "audio", "audio", true),
        item("file", "file", "file", "file", true),
        item("code-block", "code-block", "code-block", "code-block", true),
        item("symbol", "symbol", "symbol", "symbol", true),
        item("chinese-date", "date", "chinese-date", "chinese-date", true),
        item("emoji", "emoji", "emoji", "emoji", true),
      ],
    },
    {
      id: "insert-advanced",
      items: [
        item("tag", "tag", "tag", "tag", true),
        item("callout", "callout", "callout", "callout", true),
        item("mention", "mention", "mention", "mention", true),
        item("bookmark", "bookmark", "bookmark", "bookmark", true),
        item("option-box", "option-box", "option-box", "option-box", true),
      ],
    },
    {
      id: "insert-layout",
      items: [
        item("hard-break", "hard-break", "hard-break", "hard-break", true),
        item("hr", "hr", "hr", "hr", true),
        item("toc", "toc", "toc", "toc", true),
      ],
    },
    {
      id: "insert-template",
      items: [
        item("template", "template", "template", "template", true),
        item("web-page", "web-page", "web-page", "web-page", true),
      ],
    },
  ],
  table: [
    {
      id: "table-main",
      items: [
        item("table-insert", "table", "table-insert", "table-insert", true),
        item("table-fix", "table-fix", "table-fix", "table-fix", true),
      ],
    },
    {
      id: "table-style",
      items: [
        item("cells-align", "table-cells-align", "cells-align", "cells-align", true),
        item("cells-background", "table-cells-background", "cells-background", "cells-background", true),
      ],
    },
    {
      id: "table-add",
      items: [
        item("add-row-before", "table-add-row-before", "add-row-before", "add-row-before", true, "addTableRowBefore"),
        item("add-row-after", "table-add-row-after", "add-row-after", "add-row-after", true, "addTableRowAfter"),
        item(
          "add-column-before",
          "table-add-column-before",
          "add-column-before",
          "add-column-before",
          true,
          "addTableColumnBefore"
        ),
        item(
          "add-column-after",
          "table-add-column-after",
          "add-column-after",
          "add-column-after",
          true,
          "addTableColumnAfter"
        ),
      ],
    },
    {
      id: "table-delete",
      items: [
        item("delete-row", "table-delete-row", "delete-row", "delete-row", true, "deleteTableRow"),
        item(
          "delete-column",
          "table-delete-column",
          "delete-column",
          "delete-column",
          true,
          "deleteTableColumn"
        ),
      ],
    },
    {
      id: "table-merge",
      items: [
        item("merge-cells", "table-merge-cell", "merge-cells", "merge-cells", true, "mergeTableCellRight"),
        item("split-cell", "table-split-cell", "split-cell", "split-cell", true, "splitTableCell"),
      ],
    },
    {
      id: "table-header",
      items: [
        item("toggle-header-row", "table-header-row", "toggle-header-row", "toggle-header-row", true),
        item(
          "toggle-header-column",
          "table-header-column",
          "toggle-header-column",
          "toggle-header-column",
          true
        ),
        item("toggle-header-cell", "table-header-cell", "toggle-header-cell", "toggle-header-cell", true),
      ],
    },
    {
      id: "table-nav",
      items: [
        item("next-cell", "table-next-cell", "next-cell", "next-cell", true, "goToNextTableCell"),
        item(
          "previous-cell",
          "table-previous-cell",
          "previous-cell",
          "previous-cell",
          true,
          "goToPreviousTableCell"
        ),
      ],
    },
    {
      id: "table-remove",
      items: [item("delete-table", "table-delete", "delete-table", "delete-table", true)],
    },
  ],
  tools: [
    {
      id: "tools-code",
      items: [
        item("qrcode", "qrcode", "qrcode", "qrcode", true),
        item("barcode", "barcode", "barcode", "barcode", true),
      ],
    },
    {
      id: "tools-sign",
      items: [item("signature", "signature", "signature", "signature", true)],
    },
    {
      id: "tools-chart",
      items: [
        item("diagrams", "diagrams", "diagrams", "diagrams", true),
        item("echarts", "echarts", "echarts", "echarts", true),
        item("mermaid", "mermaid", "mermaid", "mermaid", true),
        item("mind-map", "mind-map", "mind-map", "mind-map", true),
      ],
    },
    {
      id: "tools-text",
      items: [item("chinese-case", "chinese-case", "chinese-case", "chinese-case", true)],
    },
  ],
  page: [
    {
      id: "page-toc",
      items: [item("toggle-toc", "toc", "toggle-toc", "toggle-toc", true)],
    },
    {
      id: "page-layout",
      items: [
        item("page-margin", "margin", "page-margin", "page-margin", true),
        item("page-size", "size", "page-size", "page-size", true),
        item("page-orientation", "orientation", "page-orientation", "page-orientation", true),
      ],
    },
    {
      id: "page-mark",
      items: [
        item("page-break", "page-break", "page-break", "page-break", true),
        item("page-line-number", "line-number", "page-line-number", "page-line-number", true),
        item("page-watermark", "watermark", "page-watermark", "page-watermark", true),
        item("page-background", "background", "page-background", "page-background", true),
      ],
    },
    {
      id: "page-view",
      items: [
        item("page-preview", "preview", "page-preview", "page-preview", true),
        item("page-header", "header", "page-header", "page-header", true),
        item("page-footer", "footer", "page-footer", "page-footer", true),
      ],
    },
  ],
  export: [
    {
      id: "export-file",
      items: [
        item("export-image", "image", "export-image", "export-image", true),
        item("export-pdf", "pdf", "export-pdf", "export-pdf", true),
        item("export-text", "text", "export-text", "export-text", true),
        item("export-html", "html5", "export-html", "export-html", true),
        item("export-word", "word", "export-word", "export-word", true),
      ],
    },
    {
      id: "export-share",
      items: [
        item("share", "share", "share", "share", true),
        item("embed", "embed", "embed", "embed", true),
      ],
    },
  ],
};
