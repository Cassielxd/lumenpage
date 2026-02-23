export type PlaygroundLocale = "zh-CN" | "en-US";

export type PlaygroundI18n = {
  app: {
    brand: string;
    defaultDocTitle: string;
    editorAriaLabel: string;
    saved: string;
    share: string;
    comment: string;
    permissionReadonly: string;
    permissionComment: string;
    permissionEdit: string;
  };
  menu: {
    file: string;
    tools: string;
    importJson: string;
    exportJson: string;
    importHtml: string;
    exportHtml: string;
    importMarkdown: string;
    exportMarkdown: string;
    historyBoundary: string;
    unsupportedExportJson: string;
    unsupportedImportJson: string;
    copiedJson: string;
    copiedHtml: string;
    copiedMarkdown: string;
    promptCopyJson: string;
    promptCopyHtml: string;
    promptCopyMarkdown: string;
    promptPasteJson: string;
    promptPasteHtml: string;
    promptPasteMarkdown: string;
    invalidJson: string;
    unsupportedExportHtml: string;
    unsupportedImportHtml: string;
    parseHtmlFailed: string;
    unsupportedExportMarkdown: string;
    unsupportedImportMarkdown: string;
    markdownModuleLoadFailed: string;
    markdownExportFailed: string;
    markdownImportFailed: string;
  };
  toolbar: {
    undo: string;
    redo: string;
    historyBoundaryTip: string;
    bold: string;
    italic: string;
    underline: string;
    strike: string;
    inlineCode: string;
    link: string;
    blockquote: string;
    codeBlock: string;
    horizontalRule: string;
    bulletList: string;
    orderedList: string;
    outdent: string;
    indent: string;
    alignLeft: string;
    alignCenter: string;
    alignRight: string;
    insertImage: string;
    insertVideo: string;
    settings: string;
    lineHeight: string;
    blockSpacing: string;
    paragraphBefore: string;
    paragraphAfter: string;
    applyToCurrentParagraph: string;
    clear: string;
    statusZeroPages: string;
    statusTyping: string;
    statusIdle: string;
    statusPageUnit: string;
    blockTypeParagraph: string;
    blockTypeHeading1: string;
    blockTypeHeading2: string;
    blockTypeHeading3: string;
    currentValuePrefix: string;
    alertCannotUndo: string;
    alertCannotRedo: string;
    promptLinkUrl: string;
    alertLinkRequiresSelection: string;
    promptImageUrl: string;
    promptVideoUrl: string;
    tableAddRow: string;
    tableDeleteRow: string;
    tableAddColumn: string;
    tableDeleteColumn: string;
    tableMergeRight: string;
    tableSplitCell: string;
    alertTableCellRequired: string;
    alertMergeRightUnavailable: string;
    alertSplitCellUnavailable: string;
  };
};

const PLAYGROUND_I18N: Record<PlaygroundLocale, PlaygroundI18n> = {
  "zh-CN": {
    app: {
      brand: "腾讯文档",
      defaultDocTitle: "项目周报",
      editorAriaLabel: "LumenPage 编辑器",
      saved: "已保存",
      share: "分享",
      comment: "评论",
      permissionReadonly: "只读态",
      permissionComment: "评论态",
      permissionEdit: "编辑态",
    },
    menu: {
      file: "文件",
      tools: "工具",
      importJson: "导入 JSON",
      exportJson: "导出 JSON",
      importHtml: "导入 HTML",
      exportHtml: "导出 HTML",
      importMarkdown: "导入 Markdown",
      exportMarkdown: "导出 Markdown",
      historyBoundary: "切分历史分组",
      unsupportedExportJson: "当前编辑器不支持导出 JSON",
      unsupportedImportJson: "当前编辑器不支持导入 JSON",
      copiedJson: "文档 JSON 已复制到剪贴板",
      copiedHtml: "文档 HTML 已复制到剪贴板",
      copiedMarkdown: "文档 Markdown 已复制到剪贴板",
      promptCopyJson: "复制以下 JSON",
      promptCopyHtml: "复制以下 HTML",
      promptCopyMarkdown: "复制以下 Markdown",
      promptPasteJson: "请粘贴文档 JSON",
      promptPasteHtml: "请粘贴 HTML",
      promptPasteMarkdown: "请粘贴 Markdown",
      invalidJson: "JSON 格式无效，导入失败",
      unsupportedExportHtml: "当前编辑器不支持导出 HTML",
      unsupportedImportHtml: "当前编辑器不支持导入 HTML",
      parseHtmlFailed: "HTML 解析失败，导入失败",
      unsupportedExportMarkdown: "当前编辑器不支持导出 Markdown",
      unsupportedImportMarkdown: "当前编辑器不支持导入 Markdown",
      markdownModuleLoadFailed: "Markdown 模块加载失败，请检查 lumenpage-markdown 依赖",
      markdownExportFailed: "Markdown 导出失败：当前文档包含不兼容节点",
      markdownImportFailed: "Markdown 导入失败：内容格式不受支持或不合法",
    },
    toolbar: {
      undo: "撤销",
      redo: "重做",
      historyBoundaryTip: "切分历史分组（下一次编辑独立撤销）",
      bold: "加粗",
      italic: "斜体",
      underline: "下划线",
      strike: "删除线",
      inlineCode: "行内代码",
      link: "链接",
      blockquote: "引用",
      codeBlock: "代码块",
      horizontalRule: "分割线",
      bulletList: "无序列表",
      orderedList: "有序列表",
      outdent: "减少缩进",
      indent: "增加缩进",
      alignLeft: "左对齐",
      alignCenter: "居中",
      alignRight: "右对齐",
      insertImage: "插入图片",
      insertVideo: "插入视频",
      settings: "设置",
      lineHeight: "行高",
      blockSpacing: "段间距",
      paragraphBefore: "段前",
      paragraphAfter: "段后",
      applyToCurrentParagraph: "作用当前段",
      clear: "清除",
      statusZeroPages: "0 页",
      statusTyping: "输入中",
      statusIdle: "空闲",
      statusPageUnit: "页",
      blockTypeParagraph: "正文",
      blockTypeHeading1: "标题 1",
      blockTypeHeading2: "标题 2",
      blockTypeHeading3: "标题 3",
      currentValuePrefix: "当前 ",
      alertCannotUndo: "当前没有可撤销的操作",
      alertCannotRedo: "当前没有可重做的操作",
      promptLinkUrl: "请输入链接地址",
      alertLinkRequiresSelection: "请先选中文本，或将光标放在文本中后再添加链接",
      promptImageUrl: "请输入图片地址",
      promptVideoUrl: "请输入视频地址",
      tableAddRow: "表格加行",
      tableDeleteRow: "表格删行",
      tableAddColumn: "表格加列",
      tableDeleteColumn: "表格删列",
      tableMergeRight: "合并右侧单元格",
      tableSplitCell: "拆分单元格",
      alertTableCellRequired: "请先将光标放在表格单元格内",
      alertMergeRightUnavailable: "当前单元格无法向右合并",
      alertSplitCellUnavailable: "当前单元格无法拆分",
    },
  },
  "en-US": {
    app: {
      brand: "Tencent Docs",
      defaultDocTitle: "Project Weekly Report",
      editorAriaLabel: "LumenPage editor",
      saved: "Saved",
      share: "Share",
      comment: "Comment",
      permissionReadonly: "Read-only",
      permissionComment: "Comment-only",
      permissionEdit: "Editable",
    },
    menu: {
      file: "File",
      tools: "Tools",
      importJson: "Import JSON",
      exportJson: "Export JSON",
      importHtml: "Import HTML",
      exportHtml: "Export HTML",
      importMarkdown: "Import Markdown",
      exportMarkdown: "Export Markdown",
      historyBoundary: "Split History Group",
      unsupportedExportJson: "Current editor does not support JSON export",
      unsupportedImportJson: "Current editor does not support JSON import",
      copiedJson: "Document JSON copied to clipboard",
      copiedHtml: "Document HTML copied to clipboard",
      copiedMarkdown: "Document Markdown copied to clipboard",
      promptCopyJson: "Copy JSON below",
      promptCopyHtml: "Copy HTML below",
      promptCopyMarkdown: "Copy Markdown below",
      promptPasteJson: "Paste document JSON",
      promptPasteHtml: "Paste HTML",
      promptPasteMarkdown: "Paste Markdown",
      invalidJson: "Invalid JSON format, import failed",
      unsupportedExportHtml: "Current editor does not support HTML export",
      unsupportedImportHtml: "Current editor does not support HTML import",
      parseHtmlFailed: "HTML parse failed, import failed",
      unsupportedExportMarkdown: "Current editor does not support Markdown export",
      unsupportedImportMarkdown: "Current editor does not support Markdown import",
      markdownModuleLoadFailed:
        "Failed to load Markdown module, please check lumenpage-markdown dependency",
      markdownExportFailed:
        "Markdown export failed: current document contains incompatible nodes",
      markdownImportFailed:
        "Markdown import failed: content format is unsupported or invalid",
    },
    toolbar: {
      undo: "Undo",
      redo: "Redo",
      historyBoundaryTip: "Split history group (next edit will be isolated)",
      bold: "Bold",
      italic: "Italic",
      underline: "Underline",
      strike: "Strikethrough",
      inlineCode: "Inline Code",
      link: "Link",
      blockquote: "Blockquote",
      codeBlock: "Code Block",
      horizontalRule: "Horizontal Rule",
      bulletList: "Bullet List",
      orderedList: "Ordered List",
      outdent: "Outdent",
      indent: "Indent",
      alignLeft: "Align Left",
      alignCenter: "Align Center",
      alignRight: "Align Right",
      insertImage: "Insert Image",
      insertVideo: "Insert Video",
      settings: "Settings",
      lineHeight: "Line Height",
      blockSpacing: "Paragraph Spacing",
      paragraphBefore: "Before",
      paragraphAfter: "After",
      applyToCurrentParagraph: "Apply to Current",
      clear: "Clear",
      statusZeroPages: "0 pages",
      statusTyping: "typing",
      statusIdle: "idle",
      statusPageUnit: "pages",
      blockTypeParagraph: "Paragraph",
      blockTypeHeading1: "Heading 1",
      blockTypeHeading2: "Heading 2",
      blockTypeHeading3: "Heading 3",
      currentValuePrefix: "Current ",
      alertCannotUndo: "No operation to undo",
      alertCannotRedo: "No operation to redo",
      promptLinkUrl: "Enter link URL",
      alertLinkRequiresSelection:
        "Select text first, or place the caret in text before adding a link",
      promptImageUrl: "Enter image URL",
      promptVideoUrl: "Enter video URL",
      tableAddRow: "Add Row",
      tableDeleteRow: "Delete Row",
      tableAddColumn: "Add Column",
      tableDeleteColumn: "Delete Column",
      tableMergeRight: "Merge Right Cell",
      tableSplitCell: "Split Cell",
      alertTableCellRequired: "Place the caret inside a table cell first",
      alertMergeRightUnavailable: "Current cell cannot merge to the right",
      alertSplitCellUnavailable: "Current cell cannot be split",
    },
  },
};

const LOCALE_ALIAS: Record<string, PlaygroundLocale> = {
  zh: "zh-CN",
  "zh-cn": "zh-CN",
  "zh-hans": "zh-CN",
  en: "en-US",
  "en-us": "en-US",
};

const normalizeLocale = (value: unknown): PlaygroundLocale | null => {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!raw) {
    return null;
  }
  return LOCALE_ALIAS[raw] || null;
};

export const resolvePlaygroundLocale = (fallback: PlaygroundLocale = "zh-CN"): PlaygroundLocale => {
  if (typeof window === "undefined") {
    return fallback;
  }
  const params = new URLSearchParams(window.location.search);
  const locale = normalizeLocale(params.get("locale"));
  if (locale) {
    return locale;
  }
  const lang = normalizeLocale(params.get("lang"));
  if (lang) {
    return lang;
  }
  return fallback;
};

export const createPlaygroundI18n = (locale: PlaygroundLocale = "zh-CN"): PlaygroundI18n =>
  PLAYGROUND_I18N[locale] || PLAYGROUND_I18N["zh-CN"];
