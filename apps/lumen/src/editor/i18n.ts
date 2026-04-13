import { createI18n } from "vue-i18n";

export type PlaygroundLocale = "zh-CN" | "en-US";

export type LocaleText = Record<PlaygroundLocale, string>;

export const defineLocaleText = (zhCN: string, enUS: string): LocaleText => ({
  "zh-CN": zhCN,
  "en-US": enUS,
});

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
    ariaLabel: string;
    scrollLeft: string;
    scrollRight: string;
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
    confirm: string;
    cancel: string;
    requiredFields: string;
    clearedValue: string;
    clearFontFamily: string;
    clearFontSize: string;
    fontFamily: string;
    fontSize: string;
    alertCannotUndo: string;
    alertCannotRedo: string;
    alertApplyFontFamilyFailed: string;
    alertApplyFontSizeFailed: string;
    alertInvalidFontSize: string;
    promptLinkUrl: string;
    alertLinkRequiresSelection: string;
    promptImageUrl: string;
    promptVideoUrl: string;
    alertSetPageSizeFailed: string;
    customPageSize: string;
    tableInsertPreview: string;
    tableAddRow: string;
    tableDeleteRow: string;
    tableAddColumn: string;
    tableDeleteColumn: string;
    tableMergeRight: string;
    tableSplitCell: string;
    alertTableCellRequired: string;
    alertMergeRightUnavailable: string;
    alertSplitCellUnavailable: string;
    inDevelopment: string;
  };
  shell: {
    toolbarCategories: string;
    language: string;
    simplifiedChinese: string;
    english: string;
    outline: string;
    documentLocks: string;
    outlineShow: string;
    outlineHide: string;
    outlineEmpty: string;
    assistant: string;
    addComment: string;
    trackChanges: string;
    trackChangesCount: string;
    trackChangesEnable: string;
    trackChangesDisable: string;
    trackChangesEnabled: string;
    trackChangesDisabled: string;
    trackChangesActive: string;
    currentPage: string;
    totalPages: string;
    words: string;
    selectedWords: string;
    block: string;
    nodes: string;
    plugins: string;
    contact: string;
    you: string;
    blockTypeParagraph: string;
    blockTypeHeading: string;
    blockTypeBlockquote: string;
    blockTypeCodeBlock: string;
    blockTypeBulletList: string;
    blockTypeOrderedList: string;
    blockTypeTaskList: string;
    blockTypeTable: string;
    blockTypeUnknown: string;
    untitledHeading: string;
  };
  commentActions: {
    disabled: string;
    requiresSelection: string;
    failed: string;
    created: string;
    replyFailed: string;
    editFailed: string;
    edited: string;
    deleteMessageFailed: string;
    messageRemoved: string;
    missingAnchor: string;
    removed: string;
  };
  trackChangeActions: {
    disabled: string;
    enableFailed: string;
    enabled: string;
    disabledDone: string;
    focusFailed: string;
    acceptFailed: string;
    rejectFailed: string;
    accepted: string;
    rejected: string;
    acceptAllFailed: string;
    rejectAllFailed: string;
    acceptedAll: string;
    rejectedAll: string;
  };
  commentsPanel: {
    title: string;
    threadSingle: string;
    threadPlural: string;
    summaryVisible: string;
    empty: string;
    filteredEmpty: string;
    searchPlaceholder: string;
    all: string;
    open: string;
    resolved: string;
    emptyQuote: string;
    jump: string;
    resolve: string;
    reopen: string;
    delete: string;
    edit: string;
    save: string;
    cancel: string;
    edited: string;
    emptyReplies: string;
    reply: string;
    replyPlaceholder: string;
    replyPlaceholderResolved: string;
    replyPlaceholderReadonly: string;
    replyHint: string;
    editHint: string;
    noMessages: string;
    oneMessage: string;
    messageCount: string;
  };
  trackChangesPanel: {
    title: string;
    changeSingle: string;
    changePlural: string;
    summaryVisible: string;
    enabled: string;
    disabled: string;
    emptyEnabled: string;
    emptyDisabled: string;
    filteredEmpty: string;
    searchPlaceholder: string;
    all: string;
    acceptAll: string;
    rejectAll: string;
    accept: string;
    reject: string;
    jump: string;
    deletedPrefix: string;
    insertedPrefix: string;
    deletedLabel: string;
    insertedLabel: string;
    replace: string;
    insert: string;
    delete: string;
    unknownAuthor: string;
    emptyExcerpt: string;
  };
  collaboration: {
    fallbackUser: string;
    statusAuthFailed: string;
    statusSynced: string;
    statusSyncing: string;
    statusConnecting: string;
    statusDisconnected: string;
    onlineCount: string;
    currentUser: string;
  };
  collaborationPanel: {
    title: string;
    enabled: string;
    disabled: string;
    synced: string;
    connecting: string;
    currentUser: string;
    currentDocument: string;
    currentRole: string;
    currentPermission: string;
    managedByBackend: string;
    localMode: string;
    authHint: string;
    accessError: string;
    showSettings: string;
    hideSettings: string;
    emptyTitle: string;
    emptyCopy: string;
    url: string;
    urlPlaceholder: string;
    document: string;
    documentPlaceholder: string;
    field: string;
    fieldPlaceholder: string;
    token: string;
    tokenPlaceholder: string;
    userName: string;
    userNamePlaceholder: string;
    userColor: string;
    userColorPlaceholder: string;
    reloadHint: string;
    update: string;
    reconnect: string;
    retry: string;
    enable: string;
    disable: string;
    reset: string;
  };
  shareDialog: {
    title: string;
    accountTitle: string;
    manageAccount: string;
    openAccount: string;
    backendUrl: string;
    backendUrlPlaceholder: string;
    signedInAs: string;
    loggedOut: string;
    login: string;
    register: string;
    logout: string;
    email: string;
    emailPlaceholder: string;
    password: string;
    passwordPlaceholder: string;
    displayName: string;
    displayNamePlaceholder: string;
    authenticate: string;
    authenticating: string;
    authRequired: string;
    authRequiredHint: string;
    collaborationRequired: string;
    collaborationRequiredHint: string;
    currentDocument: string;
    currentRole: string;
    members: string;
    noMembers: string;
    inviteMember: string;
    inviteRole: string;
    inviteAction: string;
    shareLinks: string;
    noShareLinks: string;
    shareRole: string;
    anonymousAccess: string;
    createShareLink: string;
    createAnonymous: string;
    createRestricted: string;
    copyLink: string;
    revokeLink: string;
    roleOwner: string;
    roleEditor: string;
    roleCommenter: string;
    roleViewer: string;
    roleUnknown: string;
    notOwnerHint: string;
    authFailed: string;
    authSuccess: string;
    logoutSuccess: string;
    loadFailed: string;
    ensureFailed: string;
    inviteFailed: string;
    inviteSuccess: string;
    createLinkFailed: string;
    createLinkSuccess: string;
    revokeLinkFailed: string;
    revokeLinkSuccess: string;
    copyLinkSuccess: string;
    copyLinkFailed: string;
    saveBackendUrl: string;
  };
  documentCenter: {
    title: string;
    subtitle: string;
    description: string;
    documentTitle: string;
    documentTitlePlaceholder: string;
    createDocument: string;
    openDocument: string;
    refresh: string;
    documents: string;
    loading: string;
    empty: string;
    authHint: string;
    loadFailed: string;
    createFailed: string;
  };
  shareLanding: {
    backHome: string;
    loading: string;
    loadFailed: string;
    invalidLink: string;
    kicker: string;
    description: string;
    documentName: string;
    permission: string;
    accessMode: string;
    anonymousAccess: string;
    loggedInAccess: string;
    authRequired: string;
    authRequiredHint: string;
    signInToOpen: string;
    openDocument: string;
    refresh: string;
  };
  ruler: {
    leftMargin: string;
    rightMargin: string;
    topMargin: string;
    bottomMargin: string;
  };
  aiPanel: {
    title: string;
    ready: string;
    readonly: string;
    showSettings: string;
    hideSettings: string;
    provider: string;
    model: string;
    serverUrl: string;
    systemPrompt: string;
    modelPlaceholder: string;
    serverUrlPlaceholder: string;
    systemPromptPlaceholder: string;
    providerTip: string;
    rewrite: string;
    summarize: string;
    continueWriting: string;
    placeholder: string;
    sendHint: string;
    send: string;
    stop: string;
    assistantName: string;
    userName: string;
    requestLabel: string;
    sourceLabel: string;
    sentContextLabel: string;
    welcome: string;
    missingEditor: string;
    missingPlugin: string;
    missingProviderConfig: string;
    emptyContext: string;
    cancelled: string;
    generating: string;
    turns: string;
    composerHint: string;
    selectionReady: string;
    selectionFallback: string;
    contextPreviewTitle: string;
    contextPreviewSelection: string;
    contextPreviewEmpty: string;
    latestSelectionActions: string;
    latestFallbackActions: string;
    demoProvider: string;
    deepSeekOfficialProvider: string;
    replaceSelection: string;
    insertAfter: string;
    copyResult: string;
    applyFailed: string;
    replaceApplied: string;
    insertApplied: string;
    copySucceeded: string;
    copyFailed: string;
    sourceSelection: string;
    sourceBlock: string;
    sourceDocument: string;
    sourceAuto: string;
  };
  annotationPanel: {
    title: string;
    open: string;
    close: string;
    page: string;
    hint: string;
    select: string;
    tool: string;
    pen: string;
    highlighter: string;
    line: string;
    rect: string;
    eraser: string;
    color: string;
    size: string;
    author: string;
    authors: string;
    selected: string;
    noSelection: string;
    viewAll: string;
    viewMine: string;
    deleteSelected: string;
    clearMine: string;
    unknownAuthor: string;
    undo: string;
    clearPage: string;
    clearAll: string;
  };
  documentLockPanel: {
    title: string;
    enabled: string;
    disabled: string;
    markers: string;
    markersVisible: string;
    markersHidden: string;
    protection: string;
    rangeCount: string;
    hint: string;
    readonlyHint: string;
    lockSelection: string;
    unlockSelection: string;
    clearAll: string;
    enable: string;
    disable: string;
    showMarkers: string;
    hideMarkers: string;
  };
  layoutActions: {
    lineHeightTitle: string;
    lineHeightLabel: string;
    paragraphSpacingTitle: string;
    paragraphSpacingLabel: string;
    pageMarginTitle: string;
    pageMarginLabel: string;
    pageSizeTitle: string;
    pageSizePaperType: string;
  };
  textStyleActions: {
    titleFontFamily: string;
    titleFontSize: string;
    titleTextColor: string;
    titleTextBackground: string;
    promptFontFamily: string;
    promptFontSize: string;
    promptTextColor: string;
    promptTextBackground: string;
    clearFontFamily: string;
    clearFontSize: string;
    alertInvalidColor: string;
    alertInvalidFontSize: string;
  };
  searchReplaceActions: {
    title: string;
    promptSearch: string;
    promptReplace: string;
    alertEmptySearch: string;
    alertNoMatch: string;
    alertReplaced: string;
  };
  pageAppearanceActions: {
    titlePageBackground: string;
    titlePageWatermark: string;
    titlePageHeader: string;
    titlePageFooter: string;
    promptBackground: string;
    promptWatermark: string;
    promptHeader: string;
    promptFooter: string;
    alertInvalidColor: string;
    alertWatermarkTooLong: string;
  };
  tableActions: {
    titleInsertTable: string;
    labelTableSize: string;
    titleCellAlignment: string;
    labelCellAlignment: string;
    alertCellRequired: string;
    alertInvalidCellAlign: string;
    alignLeft: string;
    alignCenter: string;
    alignRight: string;
    alignJustify: string;
  };
  insertAdvancedActions: {
    titleInsertAudio: string;
    titleInsertFile: string;
    titleInsertTag: string;
    titleInsertCallout: string;
    titleInsertBookmark: string;
    titleInsertOptionBox: string;
    titleInsertWebPage: string;
    titleInsertTemplate: string;
    promptAudioUrl: string;
    promptAudioTitle: string;
    promptFileUrl: string;
    promptFileName: string;
    promptColumnsCount: string;
    promptTagText: string;
    promptCalloutText: string;
    promptBookmarkUrl: string;
    promptBookmarkTitle: string;
    promptOptionText: string;
    promptWebPageUrl: string;
    promptWebPageTitle: string;
    promptTemplateTitle: string;
    promptTemplateSummary: string;
    promptTemplateItems: string;
    insertBookmarkPrefix: string;
    insertWebPagePrefix: string;
    insertAudioPrefix: string;
    insertFilePrefix: string;
    insertCalloutPrefix: string;
    insertTemplatePrefix: string;
    defaultCallout: string;
    defaultBookmarkTitle: string;
    defaultWebPageTitle: string;
    defaultAudioTitle: string;
    defaultFileName: string;
    defaultTag: string;
    defaultOptionText: string;
    defaultColumnsCount: string;
    defaultTemplateTitle: string;
    defaultTemplateSummary: string;
    defaultTemplateItems: string;
    labelColumn: string;
    optionBoxTitle: string;
  };
  quickInsertActions: {
    titleInsertSymbol: string;
    titleInsertEmoji: string;
    promptSymbol: string;
    promptEmoji: string;
  };
  importActions: {
    alertNoFile: string;
    alertReadFailed: string;
    alertParseFailed: string;
    alertWordUnsupported: string;
  };
  markdownActions: {
    titleMarkdown: string;
    labelMode: string;
    optionExport: string;
    optionImport: string;
  };
  textFormatActions: {
    alertPainterArmed: string;
    alertPainterApplied: string;
  };
  toolsActions: {
    titleInsertQrCode: string;
    titleInsertBarcode: string;
    titleInsertDiagram: string;
    titleInsertEcharts: string;
    titleInsertMermaid: string;
    titleInsertMindMap: string;
    titleChineseCase: string;
    promptQrCodeContent: string;
    promptBarcodeContent: string;
    promptDiagramsCode: string;
    promptEchartsCode: string;
    promptMermaidCode: string;
    promptMindMapCode: string;
    promptChineseCaseInput: string;
    promptChineseCaseMode: string;
    alertChineseCaseInvalidNumber: string;
    labelSignature: string;
    defaultQrCodeContent: string;
    defaultBarcodeContent: string;
    defaultSignatureName: string;
    defaultDiagramCode: string;
    defaultEchartsCode: string;
    defaultMermaidCode: string;
    defaultMindMapCode: string;
    optionChineseCaseUpper: string;
    optionChineseCaseLower: string;
    embedPanelTitleDiagram: string;
    embedPanelTitleEcharts: string;
    embedPanelTitleMermaid: string;
    embedPanelTitleMindMap: string;
  };
  exportActions: {
    printPreviewTitle: string;
    close: string;
    cancel: string;
    print: string;
    copyShareLink: string;
    copyEmbedCode: string;
    copiedToClipboard: string;
    clipboardUnavailableManualCopy: string;
  };
  colorPickerActions: {
    color: string;
    backgroundColor: string;
    highlight: string;
    pageBackground: string;
    cellsBackground: string;
  };
  toolbarCatalog: Record<string, string>;
  aiProviderMessages: {
    modelRequired: string;
    requestFailed: string;
    emptyResult: string;
    cancelled: string;
  };
  slashCommands: {
    emptyLabel: string;
    paragraphTitle: string;
    paragraphDescription: string;
    heading1Title: string;
    heading1Description: string;
    heading2Title: string;
    heading2Description: string;
    heading3Title: string;
    heading3Description: string;
    bulletListTitle: string;
    bulletListDescription: string;
    orderedListTitle: string;
    orderedListDescription: string;
    taskListTitle: string;
    taskListDescription: string;
    blockquoteTitle: string;
    blockquoteDescription: string;
    codeBlockTitle: string;
    codeBlockDescription: string;
  };
};

export const PLAYGROUND_I18N = {
  "zh-CN": {
    app: {
      brand: "Lumen 文档",
      defaultDocTitle: "项目周报",
      editorAriaLabel: "LumenPage 编辑器",
      saved: "已保存",
      share: "分享",
      comment: "评论",
      permissionReadonly: "只读",
      permissionComment: "可评论",
      permissionEdit: "可编辑",
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
      historyBoundary: "分割历史分组",
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
      ariaLabel: "编辑器格式工具栏",
      scrollLeft: "向左滚动工具栏",
      scrollRight: "向右滚动工具栏",
      undo: "撤销",
      redo: "重做",
      historyBoundaryTip: "分割历史分组（下一次编辑将独立撤销）",
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
      confirm: "确定",
      cancel: "取消",
      requiredFields: "请完成必填项",
      clearedValue: "已清除，点击确定后恢复默认样式。",
      clearFontFamily: "清除字体",
      clearFontSize: "清除字号",
      fontFamily: "字体",
      fontSize: "字号",
      alertCannotUndo: "当前没有可撤销的操作",
      alertCannotRedo: "当前没有可重做的操作",
      alertApplyFontFamilyFailed: "无法应用字体",
      alertApplyFontSizeFailed: "无法应用字号",
      alertInvalidFontSize: "字号无效",
      promptLinkUrl: "请输入链接地址",
      alertLinkRequiresSelection: "请先选中文本，或将光标放在文本中后再添加链接",
      promptImageUrl: "请输入图片地址",
      promptVideoUrl: "请输入视频地址",
      alertSetPageSizeFailed: "无法设置纸张大小",
      customPageSize: "自定义 ({width} x {height})",
      tableInsertPreview: "插入 {rows} x {cols} 表格",
      tableAddRow: "表格加行",
      tableDeleteRow: "表格删行",
      tableAddColumn: "表格加列",
      tableDeleteColumn: "表格删列",
      tableMergeRight: "合并右侧单元格",
      tableSplitCell: "拆分单元格",
      alertTableCellRequired: "请先将光标放在表格单元格内",
      alertMergeRightUnavailable: "当前单元格无法向右合并",
      alertSplitCellUnavailable: "当前单元格无法拆分",
      inDevelopment: "开发中",
    },
    shell: {
      toolbarCategories: "工具栏分类",
      language: "语言",
      simplifiedChinese: "简体中文",
      english: "英文",
      outline: "目录",
      outlineShow: "显示目录",
      outlineHide: "隐藏目录",
      outlineEmpty: "暂无目录项",
      assistant: "AI 助手",
      addComment: "添加评论",
      trackChanges: "修订",
      trackChangesCount: "修订 ({count})",
      trackChangesEnable: "开启修订",
      trackChangesDisable: "关闭修订",
      trackChangesEnabled: "已开启",
      trackChangesDisabled: "未开启",
      trackChangesActive: "修订中",
      currentPage: "当前页 {count}",
      totalPages: "页数 {count}",
      words: "字数 {count}",
      selectedWords: "选中 {count}",
      block: "块 {type}",
      nodes: "节点数 {count}",
      plugins: "插件数 {count}",
      contact: "联系方式",
      you: "你",
      blockTypeParagraph: "正文",
      blockTypeHeading: "标题",
      blockTypeBlockquote: "引用",
      blockTypeCodeBlock: "代码块",
      blockTypeBulletList: "无序列表",
      blockTypeOrderedList: "有序列表",
        blockTypeTaskList: "任务列表",
        blockTypeTable: "表格",
        blockTypeUnknown: "未知",
        untitledHeading: "无标题",
      },
    commentActions: {
      disabled: "查看模式下无法评论。",
      requiresSelection: "请先选中文本再创建评论。",
      failed: "创建评论锚点失败。",
      created: "已创建评论锚点。",
      replyFailed: "添加评论回复失败。",
      editFailed: "更新评论消息失败。",
      edited: "已更新评论消息。",
      deleteMessageFailed: "删除评论消息失败。",
      messageRemoved: "已删除评论消息。",
      missingAnchor: "评论锚点已不存在于文档中。",
      removed: "已删除评论线程。",
    },
    trackChangeActions: {
      disabled: "查看模式下无法开启修订。",
      enableFailed: "修订模式切换失败。",
      enabled: "已开启修订模式。",
      disabledDone: "已关闭修订模式。",
      focusFailed: "对应修订已不存在。",
      acceptFailed: "接受修订失败。",
      rejectFailed: "拒绝修订失败。",
      accepted: "已接受修订。",
      rejected: "已拒绝修订。",
      acceptAllFailed: "全部接受失败。",
      rejectAllFailed: "全部拒绝失败。",
      acceptedAll: "已接受全部修订。",
      rejectedAll: "已拒绝全部修订。",
    },
    commentsPanel: {
      title: "评论",
      threadSingle: "{count} 条线程",
      threadPlural: "{count} 条线程",
      summaryVisible: "显示 {visible} / {total} 条线程",
      empty: "暂无评论线程",
      filteredEmpty: "当前筛选条件下没有匹配的线程",
      searchPlaceholder: "搜索评论",
      all: "全部",
      open: "进行中",
      resolved: "已解决",
      emptyQuote: "无引用文本",
      jump: "定位",
      resolve: "解决",
      reopen: "重新打开",
      delete: "删除",
      edit: "编辑",
      save: "保存",
      cancel: "取消",
      edited: "已编辑",
      emptyReplies: "暂无回复",
      reply: "回复",
      replyPlaceholder: "输入回复",
      replyPlaceholderResolved: "先重新打开线程再回复",
      replyPlaceholderReadonly: "查看模式下无法评论",
      replyHint: "Ctrl+Enter 发送",
      editHint: "Ctrl+Enter 保存",
      noMessages: "暂无消息",
      oneMessage: "1 条消息",
      messageCount: "{count} 条消息",
    },
    trackChangesPanel: {
      title: "修订",
      changeSingle: "{count} 条修订",
      changePlural: "{count} 条修订",
      summaryVisible: "显示 {visible} / {total} 条修订",
      enabled: "修订中",
      disabled: "修订关闭",
      emptyEnabled: "已开启修订，新的编辑会显示在这里。",
      emptyDisabled: "暂无修订记录。",
      filteredEmpty: "当前筛选条件下没有匹配的修订。",
      searchPlaceholder: "搜索修订",
      all: "全部",
      acceptAll: "全部接受",
      rejectAll: "全部拒绝",
      accept: "接受",
      reject: "拒绝",
      jump: "定位",
      deletedPrefix: "删除：",
      insertedPrefix: "新增：",
      deletedLabel: "删除内容",
      insertedLabel: "新增内容",
      replace: "替换",
      insert: "新增",
      delete: "删除",
      unknownAuthor: "未知用户",
      emptyExcerpt: "（空）",
    },
    collaboration: {
      fallbackUser: "用户",
      statusAuthFailed: "鉴权失败",
      statusSynced: "已同步",
      statusSyncing: "同步中",
      statusConnecting: "连接中",
      statusDisconnected: "已断开",
      onlineCount: "{count} 人在线",
      currentUser: "我 · {name}",
    },
    aiPanel: {
      title: "AI 助手",
      ready: "可用",
      readonly: "只读",
      showSettings: "显示设置",
      hideSettings: "隐藏设置",
      provider: "供应商",
      model: "模型",
      serverUrl: "AI 服务",
      systemPrompt: "系统提示词",
      modelPlaceholder: "例如 deepseek-chat 或你的部署模型 ID",
      serverUrlPlaceholder: "http://localhost:1234",
      systemPromptPlaceholder: "可选，不填则使用内置写作提示词。",
      providerTip: "浏览器先请求本地 backend-server，再由服务端调用官方 DeepSeek Chat Completions API。",
      rewrite: "改写",
      summarize: "总结",
      continueWriting: "续写",
      placeholder: "描述你希望 AI 如何处理当前内容",
      sendHint: "Ctrl/Cmd + Enter 发送",
      send: "发送",
      stop: "停止",
      assistantName: "Lumen AI",
      userName: "你",
      requestLabel: "请求",
      sourceLabel: "来源",
      sentContextLabel: "发送内容",
      welcome: "先在编辑器中选中内容，再让 AI 改写、总结或续写。生成结果会先留在面板里，由你决定如何插入文档。",
      missingEditor: "编辑器尚未就绪。",
      missingPlugin: "当前编辑器实例未挂载 AI 扩展。",
      missingProviderConfig: "当前 AI 供应商配置还不完整。",
      emptyContext: "当前没有可供 AI 处理的内容。请先选中一段文字，或将光标放入一个段落。",
      cancelled: "当前 AI 任务已取消。",
      generating: "生成中",
      turns: "轮",
      composerHint: "发送时会优先使用已捕获的选区；如果没有选区，再回退到当前块。",
      selectionReady: "已捕获最近一次有效选区。",
      selectionFallback: "当前没有已捕获选区，必要时会回退到当前块。",
      contextPreviewTitle: "当前上下文",
      contextPreviewSelection: "已选内容",
      contextPreviewEmpty: "暂未捕获选区。先在编辑器里选中一段内容，这里会立即显示。",
      latestSelectionActions: "结果已生成。你可以替换已捕获选区、插入到其后，或先复制。",
      latestFallbackActions: "结果已生成。你可以插入到文档，或先复制。",
      demoProvider: "本地演示",
      deepSeekOfficialProvider: "官方 DeepSeek",
      replaceSelection: "替换选区",
      insertAfter: "插入其后",
      copyResult: "复制",
      applyFailed: "生成结果未能写入文档。",
      replaceApplied: "已用生成结果替换选区。",
      insertApplied: "已将生成结果插入文档。",
      copySucceeded: "已复制生成结果。",
      copyFailed: "复制失败，请手动复制。",
      sourceSelection: "选区",
      sourceBlock: "当前块",
      sourceDocument: "整篇文档",
      sourceAuto: "自动",
    },
    layoutActions: {
      lineHeightTitle: "行高",
      lineHeightLabel: "行高（px）",
      paragraphSpacingTitle: "段间距",
      paragraphSpacingLabel: "段间距（px）",
      pageMarginTitle: "页边距",
      pageMarginLabel: "页边距（px）",
      pageSizeTitle: "纸张大小",
      pageSizePaperType: "纸张类型",
    },
    textStyleActions: {
      titleFontFamily: "字体",
      titleFontSize: "字号",
      titleTextColor: "文字颜色",
      titleTextBackground: "文字背景",
      promptFontFamily: "字体",
      promptFontSize: "字号（px）",
      promptTextColor: "文字颜色（CSS 颜色值，留空清除）",
      promptTextBackground: "文字背景色（CSS 颜色值，留空清除）",
      clearFontFamily: "清除字体",
      clearFontSize: "清除字号",
      alertInvalidColor: "颜色值无效",
      alertInvalidFontSize: "字号无效",
    },
    searchReplaceActions: {
      title: "查找替换",
      promptSearch: "查找内容",
      promptReplace: "替换为（可为空）",
      alertEmptySearch: "查找内容不能为空",
      alertNoMatch: "未找到匹配项",
      alertReplaced: "已替换 {count} 处",
    },
    pageAppearanceActions: {
      titlePageBackground: "页面背景",
      titlePageWatermark: "水印",
      titlePageHeader: "页眉",
      titlePageFooter: "页脚",
      promptBackground: "请输入页面背景色（CSS 颜色值，留空恢复默认背景）",
      promptWatermark: "请输入水印文本（留空移除水印，最多 48 个字符）",
      promptHeader: "请输入页眉文本（留空移除，可使用 {page} 占位符）",
      promptFooter: "请输入页脚文本（留空移除，可使用 {page} 占位符）",
      alertInvalidColor: "颜色值无效",
      alertWatermarkTooLong: "水印文本不能超过 {max} 个字符",
    },
    tableActions: {
      titleInsertTable: "插入表格",
      labelTableSize: "表格尺寸（行x列）",
      titleCellAlignment: "单元格对齐",
      labelCellAlignment: "单元格对齐方式：left / center / right / justify",
      alertCellRequired: "请先将光标放在表格单元格内",
      alertInvalidCellAlign: "单元格对齐值无效",
      alignLeft: "左对齐",
      alignCenter: "居中",
      alignRight: "右对齐",
      alignJustify: "两端对齐",
    },
    insertAdvancedActions: {
      titleInsertAudio: "插入音频",
      titleInsertFile: "插入附件",
      titleInsertTag: "插入标签",
      titleInsertCallout: "插入提示块",
      titleInsertBookmark: "插入书签",
      titleInsertOptionBox: "插入多选框",
      titleInsertWebPage: "插入网页",
      titleInsertTemplate: "插入模板",
      promptAudioUrl: "音频地址",
      promptAudioTitle: "音频标题",
      promptFileUrl: "文件地址",
      promptFileName: "文件名",
      promptColumnsCount: "列数（2-4）",
      promptTagText: "标签文本",
      promptCalloutText: "提示文本",
      promptBookmarkUrl: "书签地址",
      promptBookmarkTitle: "书签标题",
      promptOptionText: "选项列表（逗号或换行分隔）",
      promptWebPageUrl: "网页地址",
      promptWebPageTitle: "网页标题",
      promptTemplateTitle: "模板标题",
      promptTemplateSummary: "模板摘要",
      promptTemplateItems: "模板条目（逗号分隔）",
      insertBookmarkPrefix: "书签",
      insertWebPagePrefix: "网页",
      insertAudioPrefix: "音频",
      insertFilePrefix: "文件",
      insertCalloutPrefix: "提示",
      insertTemplatePrefix: "模板",
      defaultCallout: "重要提示",
      defaultBookmarkTitle: "参考资料",
      defaultWebPageTitle: "嵌入页面",
      defaultAudioTitle: "音频片段",
      defaultFileName: "附件",
      defaultTag: "标签",
      defaultOptionText: "选项 A,选项 B",
      defaultColumnsCount: "2",
      defaultTemplateTitle: "项目计划",
      defaultTemplateSummary: "范围、里程碑和负责人。",
      defaultTemplateItems: "里程碑,负责人,风险",
      labelColumn: "列",
      optionBoxTitle: "选项",
    },
    quickInsertActions: {
      titleInsertSymbol: "插入符号",
      titleInsertEmoji: "插入表情",
      promptSymbol: "输入符号",
      promptEmoji: "输入表情",
    },
    importActions: {
      alertNoFile: "未选择文件",
      alertReadFailed: "读取文件失败",
      alertParseFailed: "解析文件内容失败",
      alertWordUnsupported: "暂不支持旧版 .doc 文件，请使用 .docx、HTML 或 TXT。",
    },
    markdownActions: {
      titleMarkdown: "Markdown",
      labelMode: "操作：导出 / 导入",
      optionExport: "导出",
      optionImport: "导入",
    },
    textFormatActions: {
      alertPainterArmed: "已复制格式。请选择目标内容后再次点击格式刷。",
      alertPainterApplied: "格式已应用",
    },
    toolsActions: {
      titleInsertQrCode: "插入二维码",
      titleInsertBarcode: "插入条形码",
      titleInsertDiagram: "插入图表",
      titleInsertEcharts: "插入 ECharts",
      titleInsertMermaid: "插入 Mermaid",
      titleInsertMindMap: "插入思维导图",
      titleChineseCase: "中文数字大小写",
      promptQrCodeContent: "二维码内容",
      promptBarcodeContent: "条形码内容",
      promptDiagramsCode: "图表源码",
      promptEchartsCode: "ECharts 配置 JSON",
      promptMermaidCode: "Mermaid 源码",
      promptMindMapCode: "思维导图源码",
      promptChineseCaseInput: "输入需要转换的数字",
      promptChineseCaseMode: "大小写模式",
      alertChineseCaseInvalidNumber: "输入内容必须是有效数字",
      labelSignature: "签名",
      defaultQrCodeContent: "https://example.com",
      defaultBarcodeContent: "1234567890",
      defaultSignatureName: "签署人",
      defaultDiagramCode: "flowchart LR\nA[开始] --> B[完成]",
      defaultEchartsCode:
        "{\n  \"xAxis\": {\"type\": \"category\", \"data\": [\"周一\", \"周二\", \"周三\"]},\n  \"yAxis\": {\"type\": \"value\"},\n  \"series\": [{\"type\": \"bar\", \"data\": [120, 200, 150]}]\n}",
      defaultMermaidCode: "graph TD\nA[开始] --> B[结束]",
      defaultMindMapCode: "mindmap\n  root((主题))\n    分支 A\n    分支 B",
      optionChineseCaseUpper: "大写",
      optionChineseCaseLower: "小写",
      embedPanelTitleDiagram: "Diagram",
      embedPanelTitleEcharts: "ECharts",
      embedPanelTitleMermaid: "Mermaid",
      embedPanelTitleMindMap: "Mind Map",
    },
    exportActions: {
      printPreviewTitle: "打印预览",
      close: "关闭",
      cancel: "取消",
      print: "打印",
      copyShareLink: "复制分享链接",
      copyEmbedCode: "复制嵌入代码",
      copiedToClipboard: "已复制到剪贴板",
      clipboardUnavailableManualCopy: "剪贴板不可用，请手动复制文本：",
    },
    colorPickerActions: {
      color: "文字颜色",
      backgroundColor: "文字背景色",
      highlight: "高亮颜色",
      pageBackground: "页面背景色",
      cellsBackground: "单元格背景色",
    },
    toolbarCatalog: {
      "__empty__": "",
      "tab.base": "首页",
      "tab.insert": "插入",
      "tab.table": "表格",
      "tab.tools": "工具",
      "tab.page": "页面",
      "tab.export": "导出",
      undo: "撤销",
      redo: "重做",
      "format-painter": "格式刷",
      "clear-format": "清除格式",
      heading: "标题",
      "font-family": "字体",
      "font-size": "字号",
      bold: "加粗",
      italic: "斜体",
      underline: "下划线",
      strike: "删除线",
      subscript: "下标",
      superscript: "上标",
      color: "文字颜色",
      "background-color": "背景颜色",
      highlight: "高亮",
      "ordered-list": "有序列表",
      "bullet-list": "无序列表",
      "task-list": "任务列表",
      indent: "增加缩进",
      outdent: "减少缩进",
      "line-height": "行高",
      margin: "段落间距",
      "align-left": "左对齐",
      "align-center": "居中对齐",
      "align-right": "右对齐",
      "align-justify": "两端对齐",
      "align-distributed": "分散对齐",
      quote: "引用",
      "inline-code": "行内代码",
      "select-all": "全选",
      "import-word": "导入 Word",
      markdown: "Markdown",
      "search-replace": "查找替换",
      viewer: "阅读模式",
      print: "打印",
      link: "链接",
      image: "图片",
      video: "视频",
      audio: "音频",
      file: "文件",
      "code-block": "代码块",
      symbol: "符号",
      "chinese-date": "中文日期",
      emoji: "表情",
      tag: "标签",
      callout: "提示块",
      mention: "提及",
      bookmark: "书签",
      "option-box": "选项框",
      "hard-break": "硬换行",
      hr: "分隔线",
      toc: "目录",
      template: "模板",
      "web-page": "网页嵌入",
      "table-insert": "插入表格",
      "table-fix": "修复表格",
      "cells-align": "单元格对齐",
      "cells-background": "单元格背景",
      "add-row-before": "上方加行",
      "add-row-after": "下方加行",
      "add-column-before": "左侧加列",
      "add-column-after": "右侧加列",
      "delete-row": "删除行",
      "delete-column": "删除列",
      "merge-cells": "合并单元格",
      "split-cell": "拆分单元格",
      "toggle-header-row": "切换标题行",
      "toggle-header-column": "切换标题列",
      "toggle-header-cell": "切换标题单元格",
      "next-cell": "下一单元格",
      "previous-cell": "上一单元格",
      "delete-table": "删除表格",
      qrcode: "二维码",
      barcode: "条形码",
      signature: "签名",
      diagrams: "流程图",
      echarts: "ECharts",
      mermaid: "Mermaid",
      "mind-map": "思维导图",
      "chinese-case": "中文数字大小写",
      "toggle-toc": "目录",
      "page-margin": "页面边距",
      "page-size": "页面大小",
      "page-orientation": "页面方向",
      "page-break": "分页符",
      "page-line-number": "行号",
      "page-watermark": "水印",
      "page-background": "页面背景",
      "page-preview": "预览",
      "page-header": "页眉",
      "page-footer": "页脚",
      "export-image": "导出图片",
      "export-pdf": "导出 PDF",
      "export-text": "导出文本",
      "export-html": "导出 HTML",
      "export-word": "导出 Word",
      share: "分享",
      embed: "嵌入",
    },
    aiProviderMessages: {
      modelRequired: "必须填写模型。",
      requestFailed: "DeepSeek 请求失败。",
      emptyResult: "DeepSeek 返回了空结果。",
      cancelled: "AI 请求已取消。",
    },
    slashCommands: {
      emptyLabel: "没有匹配的块",
      paragraphTitle: "正文",
      paragraphDescription: "保留为普通段落",
      heading1Title: "标题 1",
      heading1Description: "替换为一级标题",
      heading2Title: "标题 2",
      heading2Description: "替换为二级标题",
      heading3Title: "标题 3",
      heading3Description: "替换为三级标题",
      bulletListTitle: "无序列表",
      bulletListDescription: "替换为项目符号列表",
      orderedListTitle: "有序列表",
      orderedListDescription: "替换为编号列表",
      taskListTitle: "任务列表",
      taskListDescription: "替换为可勾选任务列表",
      blockquoteTitle: "引用",
      blockquoteDescription: "替换为引用块",
      codeBlockTitle: "代码块",
      codeBlockDescription: "替换为代码块",
    },
  },
  "en-US": {
    app: {
      brand: "Lumen Docs",
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
      ariaLabel: "Editor formatting toolbar",
      scrollLeft: "Scroll toolbar left",
      scrollRight: "Scroll toolbar right",
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
      confirm: "Apply",
      cancel: "Cancel",
      requiredFields: "Please complete required fields",
      clearedValue: "Cleared. Apply to restore default style.",
      clearFontFamily: "Clear font family",
      clearFontSize: "Clear font size",
      fontFamily: "Font Family",
      fontSize: "Font Size",
      alertCannotUndo: "No operation to undo",
      alertCannotRedo: "No operation to redo",
      alertApplyFontFamilyFailed: "Unable to apply font family",
      alertApplyFontSizeFailed: "Unable to apply font size",
      alertInvalidFontSize: "Invalid font size",
      promptLinkUrl: "Enter link URL",
      alertLinkRequiresSelection:
        "Select text first, or place the caret in text before adding a link",
      promptImageUrl: "Enter image URL",
      promptVideoUrl: "Enter video URL",
      alertSetPageSizeFailed: "Unable to set page size",
      customPageSize: "Custom ({width} x {height})",
      tableInsertPreview: "Insert {rows} x {cols} table",
      tableAddRow: "Add Row",
      tableDeleteRow: "Delete Row",
      tableAddColumn: "Add Column",
      tableDeleteColumn: "Delete Column",
      tableMergeRight: "Merge Right Cell",
      tableSplitCell: "Split Cell",
      alertTableCellRequired: "Place the caret inside a table cell first",
      alertMergeRightUnavailable: "Current cell cannot merge to the right",
      alertSplitCellUnavailable: "Current cell cannot be split",
      inDevelopment: "In development",
    },
    shell: {
      toolbarCategories: "Toolbar categories",
      language: "Language",
      simplifiedChinese: "Simplified Chinese",
      english: "English",
      outline: "Outline",
      outlineShow: "Show Outline",
      outlineHide: "Hide Outline",
      outlineEmpty: "No headings yet.",
      assistant: "AI",
      addComment: "Add Comment",
      trackChanges: "Changes",
      trackChangesCount: "Changes ({count})",
      trackChangesEnable: "Enable Tracking",
      trackChangesDisable: "Disable Tracking",
      trackChangesEnabled: "On",
      trackChangesDisabled: "Off",
      trackChangesActive: "Tracking On",
      currentPage: "Page {count}",
      totalPages: "Pages {count}",
      words: "Words {count}",
      selectedWords: "Selected {count}",
      block: "Block {type}",
      nodes: "Nodes {count}",
      plugins: "Plugins {count}",
      contact: "Contact",
      you: "You",
      blockTypeParagraph: "Paragraph",
      blockTypeHeading: "Heading",
      blockTypeBlockquote: "Blockquote",
      blockTypeCodeBlock: "Code Block",
      blockTypeBulletList: "Bullet List",
      blockTypeOrderedList: "Ordered List",
        blockTypeTaskList: "Task List",
        blockTypeTable: "Table",
        blockTypeUnknown: "Unknown",
        untitledHeading: "Untitled Heading",
      },
    commentActions: {
      disabled: "Comments are unavailable in viewer mode.",
      requiresSelection: "Select text first to create a comment.",
      failed: "Failed to create comment anchor.",
      created: "Comment anchor created.",
      replyFailed: "Failed to add comment reply.",
      editFailed: "Failed to update comment message.",
      edited: "Comment message updated.",
      deleteMessageFailed: "Failed to delete comment message.",
      messageRemoved: "Comment message removed.",
      missingAnchor: "Comment anchor no longer exists in the document.",
      removed: "Comment thread removed.",
    },
    trackChangeActions: {
      disabled: "Track changes is unavailable in viewer mode.",
      enableFailed: "Failed to update track changes mode.",
      enabled: "Track changes enabled.",
      disabledDone: "Track changes disabled.",
      focusFailed: "Tracked change range no longer exists.",
      acceptFailed: "Failed to accept tracked change.",
      rejectFailed: "Failed to reject tracked change.",
      accepted: "Tracked change accepted.",
      rejected: "Tracked change rejected.",
      acceptAllFailed: "Failed to accept all tracked changes.",
      rejectAllFailed: "Failed to reject all tracked changes.",
      acceptedAll: "All tracked changes accepted.",
      rejectedAll: "All tracked changes rejected.",
    },
    commentsPanel: {
      title: "Comments",
      threadSingle: "{count} thread",
      threadPlural: "{count} threads",
      summaryVisible: "{visible} of {total} threads",
      empty: "No comment threads yet.",
      filteredEmpty: "No threads match the current filter.",
      searchPlaceholder: "Search comments",
      all: "All",
      open: "Open",
      resolved: "Resolved",
      emptyQuote: "No quoted text",
      jump: "Jump",
      resolve: "Resolve",
      reopen: "Reopen",
      delete: "Delete",
      edit: "Edit",
      save: "Save",
      cancel: "Cancel",
      edited: "Edited",
      emptyReplies: "No replies yet.",
      reply: "Reply",
      replyPlaceholder: "Write a reply",
      replyPlaceholderResolved: "Reopen the thread to reply.",
      replyPlaceholderReadonly: "Comments are unavailable in viewer mode.",
      replyHint: "Ctrl+Enter to reply",
      editHint: "Ctrl+Enter to save",
      noMessages: "No messages",
      oneMessage: "1 message",
      messageCount: "{count} messages",
    },
    trackChangesPanel: {
      title: "Changes",
      changeSingle: "{count} change",
      changePlural: "{count} changes",
      summaryVisible: "{visible} of {total} changes",
      enabled: "Tracking On",
      disabled: "Tracking Off",
      emptyEnabled: "Track changes is on. New edits will appear here.",
      emptyDisabled: "No tracked changes yet.",
      filteredEmpty: "No changes match the current filter.",
      searchPlaceholder: "Search changes",
      all: "All",
      acceptAll: "Accept All",
      rejectAll: "Reject All",
      accept: "Accept",
      reject: "Reject",
      jump: "Jump",
      deletedPrefix: "Delete:",
      insertedPrefix: "Insert:",
      deletedLabel: "Deleted",
      insertedLabel: "Inserted",
      replace: "Replace",
      insert: "Insert",
      delete: "Delete",
      unknownAuthor: "Unknown",
      emptyExcerpt: "(empty)",
    },
    collaboration: {
      fallbackUser: "User",
      statusAuthFailed: "Auth failed",
      statusSynced: "Synced",
      statusSyncing: "Syncing",
      statusConnecting: "Connecting",
      statusDisconnected: "Disconnected",
      onlineCount: "{count} online",
      currentUser: "You · {name}",
    },
    aiPanel: {
      title: "AI Assistant",
      ready: "Ready",
      readonly: "Read-only",
      showSettings: "Show Settings",
      hideSettings: "Hide Settings",
      provider: "Provider",
      model: "Model",
      serverUrl: "AI Server",
      systemPrompt: "System Prompt",
      modelPlaceholder: "Use deepseek-chat or your deployed model id",
      serverUrlPlaceholder: "http://localhost:1234",
      systemPromptPlaceholder: "Optional. Leave empty to use the built-in writing prompt.",
      providerTip: "The browser calls your local backend-server, and the server calls the official DeepSeek Chat Completions API.",
      rewrite: "Rewrite",
      summarize: "Summarize",
      continueWriting: "Continue",
      placeholder: "Describe what you want AI to do with the current content",
      sendHint: "Ctrl/Cmd + Enter to send",
      send: "Send",
      stop: "Stop",
      assistantName: "Lumen AI",
      userName: "You",
      requestLabel: "Request",
      sourceLabel: "Source",
      sentContextLabel: "Sent Content",
      welcome: "Select text in the editor, then ask me to rewrite, summarize, or continue writing. The result will stay in this panel until you choose how to apply it.",
      missingEditor: "Editor is not ready yet.",
      missingPlugin: "AI extension is not available in the current editor instance.",
      missingProviderConfig: "The current AI provider is not fully configured yet.",
      emptyContext: "No content is available for AI processing yet. Select some text first, or place the caret inside a paragraph.",
      cancelled: "The current AI task was cancelled.",
      generating: "Generating",
      turns: "turns",
      composerHint: "The assistant uses the last captured selection first, then falls back to the current block when needed.",
      selectionReady: "The latest valid selection has been captured.",
      selectionFallback: "No captured selection yet. The assistant will fall back to the current block when needed.",
      contextPreviewTitle: "Current Context",
      contextPreviewSelection: "Selected Content",
      contextPreviewEmpty: "No selection has been captured yet. Select some text in the editor and it will appear here immediately.",
      latestSelectionActions: "The result is ready. You can replace the captured selection, insert after it, or copy it first.",
      latestFallbackActions: "The result is ready. You can insert it into the document, or copy it first.",
      demoProvider: "Local Demo",
      deepSeekOfficialProvider: "Official DeepSeek",
      replaceSelection: "Replace Selection",
      insertAfter: "Insert After",
      copyResult: "Copy",
      applyFailed: "The generated result could not be applied to the document.",
      replaceApplied: "The generated result replaced the selection.",
      insertApplied: "The generated result was inserted into the document.",
      copySucceeded: "The generated result was copied to the clipboard.",
      copyFailed: "Copy failed. Please copy the result manually.",
      sourceSelection: "Selection",
      sourceBlock: "Current Block",
      sourceDocument: "Whole Document",
      sourceAuto: "Auto",
    },
    layoutActions: {
      lineHeightTitle: "Line Height",
      lineHeightLabel: "Line height (px)",
      paragraphSpacingTitle: "Paragraph Spacing",
      paragraphSpacingLabel: "Paragraph spacing (px)",
      pageMarginTitle: "Page Margin",
      pageMarginLabel: "Page margin (px)",
      pageSizeTitle: "Page Size",
      pageSizePaperType: "Paper type",
    },
    textStyleActions: {
      titleFontFamily: "Font Family",
      titleFontSize: "Font Size",
      titleTextColor: "Text Color",
      titleTextBackground: "Text Background",
      promptFontFamily: "Font family",
      promptFontSize: "Font size (px)",
      promptTextColor: "Text color (CSS color, empty to clear)",
      promptTextBackground: "Text background color (CSS color, empty to clear)",
      clearFontFamily: "Clear font family",
      clearFontSize: "Clear font size",
      alertInvalidColor: "Invalid color value",
      alertInvalidFontSize: "Invalid font size",
    },
    searchReplaceActions: {
      title: "Search & Replace",
      promptSearch: "Find text",
      promptReplace: "Replace with (can be empty)",
      alertEmptySearch: "Find text cannot be empty",
      alertNoMatch: "No matches found",
      alertReplaced: "Replaced {count} matches",
    },
    pageAppearanceActions: {
      titlePageBackground: "Page Background",
      titlePageWatermark: "Page Watermark",
      titlePageHeader: "Page Header",
      titlePageFooter: "Page Footer",
      promptBackground:
        "Page background color (CSS color, empty means restore default background)",
      promptWatermark: "Watermark text (empty means remove watermark, max 48 chars)",
      promptHeader: "Header text (empty means remove; supports {page} placeholder)",
      promptFooter: "Footer text (empty means remove; supports {page} placeholder)",
      alertInvalidColor: "Invalid color value",
      alertWatermarkTooLong: "Watermark text cannot exceed {max} chars",
    },
    tableActions: {
      titleInsertTable: "Insert Table",
      labelTableSize: "Table size (rows x columns)",
      titleCellAlignment: "Cell Alignment",
      labelCellAlignment: "Cell alignment: left / center / right / justify",
      alertCellRequired: "Place the caret inside a table cell first",
      alertInvalidCellAlign: "Invalid cell alignment value",
      alignLeft: "Left",
      alignCenter: "Center",
      alignRight: "Right",
      alignJustify: "Justify",
    },
    insertAdvancedActions: {
      titleInsertAudio: "Insert Audio",
      titleInsertFile: "Insert File",
      titleInsertTag: "Insert Tag",
      titleInsertCallout: "Insert Callout",
      titleInsertBookmark: "Insert Bookmark",
      titleInsertOptionBox: "Insert Option Box",
      titleInsertWebPage: "Insert Web Page",
      titleInsertTemplate: "Insert Template",
      promptAudioUrl: "Audio URL",
      promptAudioTitle: "Audio title",
      promptFileUrl: "File URL",
      promptFileName: "File name",
      promptColumnsCount: "Column count (2-4)",
      promptTagText: "Tag text",
      promptCalloutText: "Callout text",
      promptBookmarkUrl: "Bookmark URL",
      promptBookmarkTitle: "Bookmark title",
      promptOptionText: "Option items (comma/new line separated)",
      promptWebPageUrl: "Web page URL",
      promptWebPageTitle: "Web page title",
      promptTemplateTitle: "Template title",
      promptTemplateSummary: "Template summary",
      promptTemplateItems: "Template bullet items (comma separated)",
      insertBookmarkPrefix: "Bookmark",
      insertWebPagePrefix: "WebPage",
      insertAudioPrefix: "Audio",
      insertFilePrefix: "File",
      insertCalloutPrefix: "Callout",
      insertTemplatePrefix: "Template",
      defaultCallout: "Important note",
      defaultBookmarkTitle: "Reference",
      defaultWebPageTitle: "Embedded page",
      defaultAudioTitle: "Audio clip",
      defaultFileName: "Attachment",
      defaultTag: "tag",
      defaultOptionText: "Option A,Option B",
      defaultColumnsCount: "2",
      defaultTemplateTitle: "Project Plan",
      defaultTemplateSummary: "Scope, milestones, and owners.",
      defaultTemplateItems: "Milestone,Owner,Risk",
      labelColumn: "Column",
      optionBoxTitle: "Options",
    },
    quickInsertActions: {
      titleInsertSymbol: "Insert Symbol",
      titleInsertEmoji: "Insert Emoji",
      promptSymbol: "Input symbol text",
      promptEmoji: "Input emoji",
    },
    importActions: {
      alertNoFile: "No file selected",
      alertReadFailed: "Failed to read file",
      alertParseFailed: "Failed to parse file content",
      alertWordUnsupported: "Legacy .doc files are not supported yet. Please use .docx, HTML, or TXT.",
    },
    markdownActions: {
      titleMarkdown: "Markdown",
      labelMode: "Action: export / import",
      optionExport: "Export",
      optionImport: "Import",
    },
    textFormatActions: {
      alertPainterArmed: "Format copied. Select target content and click format painter again.",
      alertPainterApplied: "Format applied",
    },
    toolsActions: {
      titleInsertQrCode: "Insert QR Code",
      titleInsertBarcode: "Insert Barcode",
      titleInsertDiagram: "Insert Diagram",
      titleInsertEcharts: "Insert ECharts",
      titleInsertMermaid: "Insert Mermaid",
      titleInsertMindMap: "Insert Mind Map",
      titleChineseCase: "Chinese Case",
      promptQrCodeContent: "QR code content",
      promptBarcodeContent: "Barcode content",
      promptDiagramsCode: "Diagram source code",
      promptEchartsCode: "ECharts option JSON",
      promptMermaidCode: "Mermaid source code",
      promptMindMapCode: "Mind map source code",
      promptChineseCaseInput: "Input number to convert into Chinese case",
      promptChineseCaseMode: "Case mode",
      alertChineseCaseInvalidNumber: "Input must be a valid number",
      labelSignature: "Signature",
      defaultQrCodeContent: "https://example.com",
      defaultBarcodeContent: "1234567890",
      defaultSignatureName: "Signer",
      defaultDiagramCode: "flowchart LR\nA[Start] --> B[Done]",
      defaultEchartsCode:
        "{\n  \"xAxis\": {\"type\": \"category\", \"data\": [\"Mon\", \"Tue\", \"Wed\"]},\n  \"yAxis\": {\"type\": \"value\"},\n  \"series\": [{\"type\": \"bar\", \"data\": [120, 200, 150]}]\n}",
      defaultMermaidCode: "graph TD\nA[Start] --> B[End]",
      defaultMindMapCode: "mindmap\n  root((Root))\n    Branch A\n    Branch B",
      optionChineseCaseUpper: "Upper",
      optionChineseCaseLower: "Lower",
      embedPanelTitleDiagram: "Diagram",
      embedPanelTitleEcharts: "ECharts",
      embedPanelTitleMermaid: "Mermaid",
      embedPanelTitleMindMap: "Mind Map",
    },
    exportActions: {
      printPreviewTitle: "Print Preview",
      close: "Close",
      cancel: "Cancel",
      print: "Print",
      copyShareLink: "Copy share link",
      copyEmbedCode: "Copy embed code",
      copiedToClipboard: "Copied to clipboard",
      clipboardUnavailableManualCopy: "Clipboard is unavailable. Copy text manually:",
    },
    colorPickerActions: {
      color: "Text color",
      backgroundColor: "Text background",
      highlight: "Highlight color",
      pageBackground: "Page background",
      cellsBackground: "Cell background",
    },
    toolbarCatalog: {
      "__empty__": "",
      "tab.base": "Home",
      "tab.insert": "Insert",
      "tab.table": "Table",
      "tab.tools": "Tools",
      "tab.page": "Page",
      "tab.export": "Export",
      undo: "Undo",
      redo: "Redo",
      "format-painter": "Format Painter",
      "clear-format": "Clear Format",
      heading: "Heading",
      "font-family": "Font Family",
      "font-size": "Font Size",
      bold: "Bold",
      italic: "Italic",
      underline: "Underline",
      strike: "Strikethrough",
      subscript: "Subscript",
      superscript: "Superscript",
      color: "Text Color",
      "background-color": "Background Color",
      highlight: "Highlight",
      "ordered-list": "Ordered List",
      "bullet-list": "Bullet List",
      "task-list": "Task List",
      indent: "Indent",
      outdent: "Outdent",
      "line-height": "Line Height",
      margin: "Paragraph Spacing",
      "align-left": "Align Left",
      "align-center": "Align Center",
      "align-right": "Align Right",
      "align-justify": "Align Justify",
      "align-distributed": "Align Distributed",
      quote: "Quote",
      "inline-code": "Inline Code",
      "select-all": "Select All",
      "import-word": "Import Word",
      markdown: "Markdown",
      "search-replace": "Search & Replace",
      viewer: "Viewer",
      print: "Print",
      link: "Link",
      image: "Image",
      video: "Video",
      audio: "Audio",
      file: "File",
      "code-block": "Code Block",
      symbol: "Symbol",
      "chinese-date": "Chinese Date",
      emoji: "Emoji",
      tag: "Tag",
      callout: "Callout",
      mention: "Mention",
      bookmark: "Bookmark",
      "option-box": "Option Box",
      "hard-break": "Hard Break",
      hr: "Horizontal Rule",
      toc: "Table of Contents",
      template: "Template",
      "web-page": "Web Page",
      "table-insert": "Insert Table",
      "table-fix": "Fix Table",
      "cells-align": "Cell Alignment",
      "cells-background": "Cell Background",
      "add-row-before": "Add Row Before",
      "add-row-after": "Add Row After",
      "add-column-before": "Add Column Before",
      "add-column-after": "Add Column After",
      "delete-row": "Delete Row",
      "delete-column": "Delete Column",
      "merge-cells": "Merge Cells",
      "split-cell": "Split Cell",
      "toggle-header-row": "Toggle Header Row",
      "toggle-header-column": "Toggle Header Column",
      "toggle-header-cell": "Toggle Header Cell",
      "next-cell": "Next Cell",
      "previous-cell": "Previous Cell",
      "delete-table": "Delete Table",
      qrcode: "QR Code",
      barcode: "Barcode",
      signature: "Signature",
      diagrams: "Diagrams",
      echarts: "ECharts",
      mermaid: "Mermaid",
      "mind-map": "Mind Map",
      "chinese-case": "Chinese Case",
      "toggle-toc": "TOC",
      "page-margin": "Page Margin",
      "page-size": "Page Size",
      "page-orientation": "Page Orientation",
      "page-break": "Page Break",
      "page-line-number": "Line Number",
      "page-watermark": "Watermark",
      "page-background": "Page Background",
      "page-preview": "Preview",
      "page-header": "Header",
      "page-footer": "Footer",
      "export-image": "Export Image",
      "export-pdf": "Export PDF",
      "export-text": "Export Text",
      "export-html": "Export HTML",
      "export-word": "Export Word",
      share: "Share",
      embed: "Embed",
    },
    aiProviderMessages: {
      modelRequired: "Model is required.",
      requestFailed: "The DeepSeek request failed.",
      emptyResult: "The DeepSeek API returned an empty result.",
      cancelled: "AI request was cancelled.",
    },
    slashCommands: {
      emptyLabel: "No matching blocks",
      paragraphTitle: "Paragraph",
      paragraphDescription: "Keep as a normal paragraph",
      heading1Title: "Heading 1",
      heading1Description: "Replace with a level 1 heading",
      heading2Title: "Heading 2",
      heading2Description: "Replace with a level 2 heading",
      heading3Title: "Heading 3",
      heading3Description: "Replace with a level 3 heading",
      bulletListTitle: "Bullet List",
      bulletListDescription: "Replace with a bullet list",
      orderedListTitle: "Ordered List",
      orderedListDescription: "Replace with a numbered list",
      taskListTitle: "Task List",
      taskListDescription: "Replace with a checklist",
      blockquoteTitle: "Blockquote",
      blockquoteDescription: "Replace with a blockquote",
      codeBlockTitle: "Code Block",
      codeBlockDescription: "Replace with a code block",
    },
  },
} as unknown as Record<PlaygroundLocale, PlaygroundI18n>;

PLAYGROUND_I18N["zh-CN"].annotationPanel = {
  title: "\u6587\u6863\u6807\u6ce8",
  open: "\u6253\u5f00\u6807\u6ce8",
  close: "\u9000\u51fa\u6807\u6ce8",
  page: "\u9875\u9762",
  hint: "\u4ec5\u4fdd\u5b58\u5f53\u524d\u4f1a\u8bdd\u4e34\u65f6\u6807\u8bb0",
  select: "\u9009\u62e9",
  tool: "\u5de5\u5177",
  pen: "\u753b\u7b14",
  highlighter: "\u8367\u5149\u7b14",
  line: "\u76f4\u7ebf",
  rect: "\u6846\u9009",
  eraser: "\u64e6\u9664",
  color: "\u989c\u8272",
  size: "\u7c97\u7ec6",
  author: "\u5f53\u524d\u6807\u6ce8\u4eba",
  authors: "\u6807\u6ce8\u6210\u5458",
  selected: "\u5df2\u9009\u4e2d",
  noSelection: "\u672a\u9009\u4e2d",
  viewAll: "\u5168\u90e8",
  viewMine: "\u53ea\u770b\u6211\u7684",
  deleteSelected: "\u5220\u9664\u9009\u4e2d",
  clearMine: "\u6e05\u9664\u6211\u7684",
  unknownAuthor: "\u672a\u77e5",
  undo: "\u64a4\u9500",
  clearPage: "\u6e05\u9664\u5f53\u9875",
  clearAll: "\u6e05\u7a7a\u5168\u90e8",
};

PLAYGROUND_I18N["en-US"].annotationPanel = {
  title: "Annotations",
  open: "Open Annotation",
  close: "Exit Annotation",
  page: "Page",
  hint: "Temporary marks for the current session",
  select: "Select",
  tool: "Tool",
  pen: "Pen",
  highlighter: "Highlighter",
  line: "Line",
  rect: "Rect",
  eraser: "Eraser",
  color: "Color",
  size: "Size",
  author: "Current Author",
  authors: "Authors",
  selected: "Selected",
  noSelection: "None",
  viewAll: "All",
  viewMine: "Mine",
  deleteSelected: "Delete Selected",
  clearMine: "Clear Mine",
  unknownAuthor: "Unknown",
  undo: "Undo",
  clearPage: "Clear Page",
  clearAll: "Clear All",
};

PLAYGROUND_I18N["zh-CN"].shell.documentLocks = "\u9501\u5b9a";
PLAYGROUND_I18N["en-US"].shell.documentLocks = "Locks";

PLAYGROUND_I18N["zh-CN"].documentLockPanel = {
  title: "\u6587\u6863\u9501\u5b9a",
  enabled: "\u5df2\u5f00\u542f",
  disabled: "\u5df2\u5173\u95ed",
  markers: "\u9501\u5b9a\u6807\u8bb0",
  markersVisible: "\u6807\u8bb0\u53ef\u89c1",
  markersHidden: "\u6807\u8bb0\u9690\u85cf",
  protection: "\u7f16\u8f91\u62e6\u622a",
  rangeCount: "\u5df2\u9501\u5b9a {count} \u6bb5",
  hint:
    "\u88ab\u9501\u5b9a\u7684\u5185\u5bb9\u4f1a\u663e\u793a\u7070\u5e95\uff0c\u5149\u6807\u53ef\u4ee5\u505c\u5728\u9501\u5b9a\u533a\u57df\u5185\uff0c\u4f46\u65e0\u6cd5\u8f93\u5165\u6216\u5220\u9664\u5185\u5bb9\u3002",
  readonlyHint: "\u5f53\u524d\u6743\u9650\u4e0d\u5141\u8bb8\u7ba1\u7406\u6587\u6863\u9501\u5b9a\u3002",
  lockSelection: "\ud83d\udd12 \u9501\u5b9a\u9009\u533a",
  unlockSelection: "\u89e3\u9501\u5f53\u524d",
  clearAll: "\u6e05\u9664\u5168\u90e8\u9501\u5b9a",
  enable: "\u5f00\u542f",
  disable: "\u5173\u95ed",
  showMarkers: "\u663e\u793a",
  hideMarkers: "\u9690\u85cf",
};

PLAYGROUND_I18N["en-US"].documentLockPanel = {
  title: "Document Locks",
  enabled: "Enabled",
  disabled: "Disabled",
  markers: "Lock Markers",
  markersVisible: "Markers Visible",
  markersHidden: "Markers Hidden",
  protection: "Edit Blocking",
  rangeCount: "{count} locked ranges",
  hint:
    "Locked content uses a gray background. The caret can stay inside the locked region, but typing and deleting there are blocked until the region is unlocked.",
  readonlyHint: "Your current permission does not allow managing document locks.",
  lockSelection: "🔒 Lock Selection",
  unlockSelection: "Unlock Current",
  clearAll: "Clear All Locks",
  enable: "Enable",
  disable: "Disable",
  showMarkers: "Show",
  hideMarkers: "Hide",
};

PLAYGROUND_I18N["zh-CN"].collaborationPanel = {
  title: "\u534f\u4f5c",
  enabled: "\u5df2\u5f00\u542f",
  disabled: "\u672a\u5f00\u542f",
  synced: "\u5df2\u540c\u6b65",
  connecting: "\u8fde\u63a5\u4e2d",
  currentUser: "\u5f53\u524d\u8d26\u53f7",
  currentDocument: "\u5f53\u524d\u6587\u6863",
  currentRole: "\u5f53\u524d\u89d2\u8272",
  currentPermission: "\u5b9e\u9645\u6743\u9650",
  managedByBackend: "\u540e\u7aef\u63a7\u5236",
  localMode: "\u672c\u5730\u6a21\u5f0f",
  authHint: "\u672a\u8fde\u63a5 backend-server \u8d26\u53f7\uff0c\u5f53\u524d\u4ecd\u4f7f\u7528\u672c\u5730\u534f\u4f5c\u8c03\u8bd5\u53c2\u6570\u3002",
  accessError: "\u8bbf\u95ee\u72b6\u6001",
  showSettings: "\u663e\u793a\u8bbe\u7f6e",
  hideSettings: "\u6536\u8d77\u8bbe\u7f6e",
  emptyTitle: "\u5f53\u524d\u672a\u5f00\u542f\u534f\u4f5c",
  emptyCopy:
    "\u5f53\u524d\u5148\u4ee5\u672c\u5730\u5feb\u7167\u4f1a\u8bdd\u6253\u5f00\u6587\u6863\uff0c\u53ef\u4ee5\u5148\u7ee7\u7eed\u7f16\u8f91\u6216\u8bc4\u8bba\u3002\u5728\u8fd9\u91cc\u4e3b\u52a8\u5f00\u542f\u534f\u4f5c\u540e\uff0c\u5de5\u4f5c\u533a\u4f1a\u76f4\u63a5\u5207\u6362\u5230\u5b9e\u65f6\u4f1a\u8bdd\u3002",
  url: "\u534f\u4f5c\u5730\u5740",
  urlPlaceholder: "ws://localhost:1234",
  document: "\u6587\u6863\u540d",
  documentPlaceholder: "\u4f8b\u5982\uff1alumen-demo",
  field: "\u5b57\u6bb5",
  fieldPlaceholder: "\u4f8b\u5982\uff1adefault",
  token: "Token",
  tokenPlaceholder: "\u53ef\u9009",
  userName: "\u7528\u6237\u540d",
  userNamePlaceholder: "\u4f8b\u5982\uff1aAlice",
  userColor: "\u7528\u6237\u989c\u8272",
  userColorPlaceholder: "#2563eb",
  reloadHint:
    "\u5e94\u7528\u540e\u5de5\u4f5c\u533a\u4f1a\u6309\u5f53\u524d\u53c2\u6570\u91cd\u65b0\u5efa\u7acb\u534f\u4f5c\u8fde\u63a5\uff0c\u4e0d\u518d\u6574\u9875\u5237\u65b0\u3002",
  update: "\u66f4\u65b0\u534f\u4f5c",
  reconnect: "\u91cd\u8fde\u534f\u4f5c",
  retry: "\u91cd\u8bd5\u534f\u4f5c",
  enable: "\u5f00\u542f\u534f\u4f5c",
  disable: "\u5173\u95ed\u534f\u4f5c",
  reset: "\u91cd\u7f6e",
};

PLAYGROUND_I18N["en-US"].collaborationPanel = {
  title: "Collab",
  enabled: "Enabled",
  disabled: "Disabled",
  synced: "Synced",
  connecting: "Connecting",
  currentUser: "Current User",
  currentDocument: "Current Document",
  currentRole: "Current Role",
  currentPermission: "Effective Permission",
  managedByBackend: "Managed by Backend",
  localMode: "Local Mode",
  authHint: "No backend-server account is connected yet, so the editor is still using local collaboration debug settings.",
  accessError: "Access State",
  showSettings: "Show Settings",
  hideSettings: "Hide Settings",
  emptyTitle: "Collaboration is currently off",
  emptyCopy:
    "The document is currently open from a local snapshot session. You can keep editing or commenting here, then enable collaboration to switch the workspace into the live session.",
  url: "Server URL",
  urlPlaceholder: "ws://localhost:1234",
  document: "Document",
  documentPlaceholder: "For example: lumen-demo",
  field: "Field",
  fieldPlaceholder: "For example: default",
  token: "Token",
  tokenPlaceholder: "Optional",
  userName: "User Name",
  userNamePlaceholder: "For example: Alice",
  userColor: "User Color",
  userColorPlaceholder: "#2563eb",
  reloadHint:
    "Applying the settings reconnects the workspace with the current parameters without a full page reload.",
  update: "Update",
  reconnect: "Reconnect",
  retry: "Retry",
  enable: "Enable",
  disable: "Disable",
  reset: "Reset",
};

PLAYGROUND_I18N["zh-CN"].shareDialog = {
  title: "分享",
  accountTitle: "账号",
  manageAccount: "管理账号",
  openAccount: "前往账号",
  backendUrl: "后端地址",
  backendUrlPlaceholder: "http://localhost:1234",
  signedInAs: "当前账号",
  loggedOut: "未登录",
  login: "登录",
  register: "注册",
  logout: "退出登录",
  email: "邮箱",
  emailPlaceholder: "例如：owner@example.com",
  password: "密码",
  passwordPlaceholder: "至少 8 位",
  displayName: "显示名称",
  displayNamePlaceholder: "例如：Alice",
  authenticate: "提交",
  authenticating: "处理中",
  authRequired: "登录后才能管理分享",
  authRequiredHint: "分享链接、成员邀请和文档角色都依赖 backend-server 账号。",
  collaborationRequired: "当前文档还未开启协作",
  collaborationRequiredHint: "分享和成员权限依赖协作文档，请先在协作面板开启协作。",
  currentDocument: "当前文档",
  currentRole: "当前权限",
  members: "成员",
  noMembers: "暂无成员",
  inviteMember: "邀请成员",
  inviteRole: "邀请权限",
  inviteAction: "添加成员",
  shareLinks: "分享链接",
  noShareLinks: "暂无分享链接",
  shareRole: "链接权限",
  anonymousAccess: "匿名访问",
  createShareLink: "创建分享链接",
  createAnonymous: "允许匿名",
  createRestricted: "仅登录用户",
  copyLink: "复制链接",
  revokeLink: "撤销",
  roleOwner: "所有者",
  roleEditor: "可编辑",
  roleCommenter: "可评论",
  roleViewer: "只读",
  roleUnknown: "未知",
  notOwnerHint: "只有文档所有者可以管理成员和分享链接。",
  authFailed: "登录或注册失败",
  authSuccess: "账号已连接到 backend-server",
  logoutSuccess: "已退出登录",
  loadFailed: "读取分享信息失败",
  ensureFailed: "绑定当前协作文档失败",
  inviteFailed: "添加成员失败",
  inviteSuccess: "成员已添加",
  createLinkFailed: "创建分享链接失败",
  createLinkSuccess: "分享链接已创建",
  revokeLinkFailed: "撤销分享链接失败",
  revokeLinkSuccess: "分享链接已撤销",
  copyLinkSuccess: "分享链接已复制",
  copyLinkFailed: "复制分享链接失败",
  saveBackendUrl: "保存后端地址",
};

PLAYGROUND_I18N["en-US"].shareDialog = {
  title: "Share",
  accountTitle: "Account",
  manageAccount: "Manage Account",
  openAccount: "Open Account",
  backendUrl: "Backend URL",
  backendUrlPlaceholder: "http://localhost:1234",
  signedInAs: "Signed in as",
  loggedOut: "Signed out",
  login: "Login",
  register: "Register",
  logout: "Log out",
  email: "Email",
  emailPlaceholder: "For example: owner@example.com",
  password: "Password",
  passwordPlaceholder: "At least 8 characters",
  displayName: "Display Name",
  displayNamePlaceholder: "For example: Alice",
  authenticate: "Submit",
  authenticating: "Working",
  authRequired: "Sign in to manage sharing",
  authRequiredHint: "Share links, member invites, and document roles all depend on a backend-server account.",
  collaborationRequired: "Collaboration is not enabled for this document",
  collaborationRequiredHint:
    "Sharing and member permissions depend on a collaboration document. Enable collaboration first.",
  currentDocument: "Current Document",
  currentRole: "Current Role",
  members: "Members",
  noMembers: "No members yet",
  inviteMember: "Invite Member",
  inviteRole: "Invite Role",
  inviteAction: "Add Member",
  shareLinks: "Share Links",
  noShareLinks: "No share links yet",
  shareRole: "Link Role",
  anonymousAccess: "Anonymous Access",
  createShareLink: "Create Share Link",
  createAnonymous: "Allow anonymous",
  createRestricted: "Signed-in only",
  copyLink: "Copy Link",
  revokeLink: "Revoke",
  roleOwner: "Owner",
  roleEditor: "Editor",
  roleCommenter: "Commenter",
  roleViewer: "Viewer",
  roleUnknown: "Unknown",
  notOwnerHint: "Only the document owner can manage members and share links.",
  authFailed: "Authentication failed",
  authSuccess: "Account connected to backend-server",
  logoutSuccess: "Signed out",
  loadFailed: "Failed to load sharing data",
  ensureFailed: "Failed to bind the current collaboration document",
  inviteFailed: "Failed to add member",
  inviteSuccess: "Member added",
  createLinkFailed: "Failed to create share link",
  createLinkSuccess: "Share link created",
  revokeLinkFailed: "Failed to revoke share link",
  revokeLinkSuccess: "Share link revoked",
  copyLinkSuccess: "Share link copied",
  copyLinkFailed: "Failed to copy share link",
  saveBackendUrl: "Save backend URL",
};

PLAYGROUND_I18N["zh-CN"].documentCenter = {
  title: "文档中心",
  subtitle: "LumenPage Workspace",
  description: "从这里创建、打开和管理你的协作文档。后端权限、分享和实时协作都会围绕同一个文档入口组织。",
  documentTitle: "文档标题",
  documentTitlePlaceholder: "例如：产品规划、会议纪要、设计评审",
  createDocument: "新建文档",
  openDocument: "打开",
  refresh: "刷新",
  documents: "我的文档",
  loading: "正在加载文档列表…",
  empty: "还没有文档，先创建一篇。",
  authHint: "登录 backend-server 账号后才能查看和创建文档。",
  loadFailed: "加载文档列表失败",
  createFailed: "创建文档失败",
};

PLAYGROUND_I18N["en-US"].documentCenter = {
  title: "Document Center",
  subtitle: "LumenPage Workspace",
  description:
    "Create, open, and manage your collaborative documents here. Backend permissions, sharing, and realtime collaboration all hang off the same document entry.",
  documentTitle: "Document Title",
  documentTitlePlaceholder: "For example: Product Plan, Meeting Notes, Design Review",
  createDocument: "Create Document",
  openDocument: "Open",
  refresh: "Refresh",
  documents: "My Documents",
  loading: "Loading documents...",
  empty: "No documents yet. Create your first one.",
  authHint: "Sign in to backend-server before browsing or creating documents.",
  loadFailed: "Failed to load documents",
  createFailed: "Failed to create document",
};

PLAYGROUND_I18N["zh-CN"].shareLanding = {
  backHome: "返回文档中心",
  loading: "正在读取分享信息…",
  loadFailed: "读取分享信息失败",
  invalidLink: "分享链接无效。",
  kicker: "共享文档",
  description: "这个页面用于确认分享权限和访问方式。进入文档后，协作连接会自动按当前分享身份建立。",
  documentName: "文档标识",
  permission: "分享权限",
  accessMode: "访问方式",
  anonymousAccess: "允许匿名访问",
  loggedInAccess: "需要登录访问",
  authRequired: "登录后才能打开共享文档",
  authRequiredHint: "这个分享链接不允许匿名访问，请先登录再继续进入文档工作区。",
  signInToOpen: "登录后打开",
  openDocument: "打开文档",
  refresh: "重新检查",
};

PLAYGROUND_I18N["en-US"].shareLanding = {
  backHome: "Back to Document Center",
  loading: "Loading share access...",
  loadFailed: "Failed to load share access",
  invalidLink: "The share link is invalid.",
  kicker: "Shared Document",
  description:
    "Use this page to confirm the granted permission and access mode before entering the document workspace.",
  documentName: "Document Key",
  permission: "Permission",
  accessMode: "Access Mode",
  anonymousAccess: "Anonymous access allowed",
  loggedInAccess: "Signed-in access only",
  authRequired: "Sign in before opening this shared document",
  authRequiredHint:
    "This share link does not allow anonymous access, so you need to sign in before continuing into the workspace.",
  signInToOpen: "Sign In to Open",
  openDocument: "Open Document",
  refresh: "Refresh",
};

PLAYGROUND_I18N["zh-CN"].ruler = {
  leftMargin: "\u5de6\u8fb9\u8ddd",
  rightMargin: "\u53f3\u8fb9\u8ddd",
  topMargin: "\u4e0a\u8fb9\u8ddd",
  bottomMargin: "\u4e0b\u8fb9\u8ddd",
};

PLAYGROUND_I18N["en-US"].ruler = {
  leftMargin: "Left Margin",
  rightMargin: "Right Margin",
  topMargin: "Top Margin",
  bottomMargin: "Bottom Margin",
};

export const PLAYGROUND_LOCALE_STORAGE_KEY = "lumenpage-lumen-locale";

export const PLAYGROUND_LOCALE_OPTIONS: Array<{ value: PlaygroundLocale; label: LocaleText }> = [
  {
    value: "zh-CN",
    label: defineLocaleText("简体中文", "Simplified Chinese"),
  },
  {
    value: "en-US",
    label: defineLocaleText("英文", "English"),
  },
];

const LOCALE_ALIAS: Record<string, PlaygroundLocale> = {
  zh: "zh-CN",
  "zh-cn": "zh-CN",
  "zh-hans": "zh-CN",
  en: "en-US",
  "en-us": "en-US",
};

export const normalizePlaygroundLocale = (value: unknown): PlaygroundLocale | null => {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!raw) {
    return null;
  }
  return LOCALE_ALIAS[raw] || null;
};

export const coercePlaygroundLocale = (
  value: unknown,
  fallback: PlaygroundLocale = "zh-CN"
): PlaygroundLocale => normalizePlaygroundLocale(value) || fallback;

const readStoredPlaygroundLocale = () => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return normalizePlaygroundLocale(window.localStorage.getItem(PLAYGROUND_LOCALE_STORAGE_KEY));
  } catch (_error) {
    return null;
  }
};

export const persistPlaygroundLocale = (locale: PlaygroundLocale) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(PLAYGROUND_LOCALE_STORAGE_KEY, locale);
  } catch (_error) {
    // Ignore storage failures in private mode or restricted environments.
  }
};

const syncPlaygroundLocaleToUrl = (locale: PlaygroundLocale) => {
  if (typeof window === "undefined") {
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set("locale", locale);
  window.history.replaceState(window.history.state, "", url.toString());
};

export const setPlaygroundLocale = (
  locale: PlaygroundLocale,
  options: { reload?: boolean } = {}
) => {
  persistPlaygroundLocale(locale);
  syncPlaygroundLocaleToUrl(locale);
  if (options.reload !== false && typeof window !== "undefined") {
    window.location.reload();
  }
};

export const resolvePlaygroundLocale = (fallback: PlaygroundLocale = "zh-CN"): PlaygroundLocale => {
  if (typeof window === "undefined") {
    return fallback;
  }
  const params = new URLSearchParams(window.location.search);
  const locale = normalizePlaygroundLocale(params.get("locale"));
  if (locale) {
    return locale;
  }
  const lang = normalizePlaygroundLocale(params.get("lang"));
  if (lang) {
    return lang;
  }
  return readStoredPlaygroundLocale() || fallback;
};

export const createPlaygroundI18n = (locale: PlaygroundLocale = "zh-CN"): PlaygroundI18n =>
  PLAYGROUND_I18N[locale] || PLAYGROUND_I18N["zh-CN"];

export const createLumenI18n = (locale: PlaygroundLocale = resolvePlaygroundLocale()) =>
  createI18n({
    legacy: false,
    locale,
    fallbackLocale: "zh-CN",
    messages: PLAYGROUND_I18N,
  });
