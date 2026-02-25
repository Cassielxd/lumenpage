import type { PlaygroundLocale } from "../../i18n";

export const resolveExportLocaleTexts = (locale: PlaygroundLocale) => {
  const isEnglish = locale === "en-US";
  return {
    printPreviewTitle: isEnglish ? "Print Preview" : "\u6253\u5370\u9884\u89c8",
    close: isEnglish ? "Close" : "\u5173\u95ed",
    print: isEnglish ? "Print" : "\u6253\u5370",
    copyShareLink: isEnglish ? "Copy share link" : "\u590d\u5236\u5206\u4eab\u94fe\u63a5",
    copyEmbedCode: isEnglish ? "Copy embed code" : "\u590d\u5236\u5d4c\u5165\u4ee3\u7801",
    copiedToClipboard: isEnglish
      ? "Copied to clipboard"
      : "\u5df2\u590d\u5236\u5230\u526a\u8d34\u677f",
  };
};
