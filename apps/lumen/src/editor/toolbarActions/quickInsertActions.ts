import type { PlaygroundLocale } from "../i18n";

type GetView = () => any;

type QuickInsertTexts = {
  promptSymbol: string;
  promptEmoji: string;
};

const resolveTexts = (locale: PlaygroundLocale): QuickInsertTexts =>
  locale === "en-US"
    ? {
        promptSymbol: "Input symbol text",
        promptEmoji: "Input emoji",
      }
    : {
        promptSymbol: "请输入要插入的符号",
        promptEmoji: "请输入要插入的表情",
      };

const formatChineseDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  return `${year}年${month}月${day}日`;
};

const formatIsoDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const createQuickInsertActions = ({
  getView,
  getLocaleKey,
}: {
  getView: GetView;
  getLocaleKey: () => PlaygroundLocale;
}) => {
  const insertText = (value: string) => {
    const view = getView();
    const state = view?.state;
    if (!view || !state?.tr || typeof value !== "string") {
      return false;
    }
    const text = value;
    if (!text) {
      return false;
    }
    const tr = state.tr.insertText(text, state.selection.from, state.selection.to);
    view.dispatch(tr.scrollIntoView());
    return true;
  };

  const insertSymbol = () => {
    const texts = resolveTexts(getLocaleKey());
    const raw = window.prompt(texts.promptSymbol, "§");
    if (raw == null) {
      return false;
    }
    return insertText(String(raw));
  };

  const insertEmoji = () => {
    const texts = resolveTexts(getLocaleKey());
    const raw = window.prompt(texts.promptEmoji, "😊");
    if (raw == null) {
      return false;
    }
    return insertText(String(raw));
  };

  const insertChineseDate = () => {
    const value = getLocaleKey() === "en-US" ? formatIsoDate() : formatChineseDate();
    return insertText(value);
  };

  return {
    insertSymbol,
    insertEmoji,
    insertChineseDate,
  };
};
