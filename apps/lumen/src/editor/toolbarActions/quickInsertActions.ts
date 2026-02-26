import type { PlaygroundLocale } from "../i18n";
import type { RequestToolbarInputDialog } from "./ui/inputDialog";

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
        promptSymbol: "\u8f93\u5165\u7b26\u53f7",
        promptEmoji: "\u8f93\u5165\u8868\u60c5",
      };

const formatChineseDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  return `${year}\u5e74${month}\u6708${day}\u65e5`;
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
  requestInputDialog,
}: {
  getView: GetView;
  getLocaleKey: () => PlaygroundLocale;
  requestInputDialog: RequestToolbarInputDialog;
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

  const insertSymbol = async () => {
    const texts = resolveTexts(getLocaleKey());
    const result = await requestInputDialog({
      title: getLocaleKey() === "en-US" ? "Insert Symbol" : "\u63d2\u5165\u7b26\u53f7",
      fields: [{ key: "value", label: texts.promptSymbol, defaultValue: "\u00a7", required: true }],
    });
    if (!result) {
      return false;
    }
    return insertText(String(result.value || ""));
  };

  const insertEmoji = async () => {
    const texts = resolveTexts(getLocaleKey());
    const result = await requestInputDialog({
      title: getLocaleKey() === "en-US" ? "Insert Emoji" : "\u63d2\u5165\u8868\u60c5",
      fields: [{ key: "value", label: texts.promptEmoji, defaultValue: "\ud83d\ude0a", required: true }],
    });
    if (!result) {
      return false;
    }
    return insertText(String(result.value || ""));
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
