import { createPlaygroundI18n, type PlaygroundLocale } from "../i18n";
import type { RequestToolbarInputDialog } from "./ui/inputDialog";

type GetView = () => any;

export const createQuickInsertActions = ({
  getView,
  getLocaleKey,
  requestInputDialog,
}: {
  getView: GetView;
  getLocaleKey: () => PlaygroundLocale;
  requestInputDialog: RequestToolbarInputDialog;
}) => {
  const getTexts = () => createPlaygroundI18n(getLocaleKey()).quickInsertActions;

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
    const texts = getTexts();
    const result = await requestInputDialog({
      title: texts.titleInsertSymbol,
      fields: [{ key: "value", label: texts.promptSymbol, defaultValue: "\u00a7", required: true }],
    });
    if (!result) {
      return false;
    }
    return insertText(String(result.value || ""));
  };

  const insertEmoji = async () => {
    const texts = getTexts();
    const result = await requestInputDialog({
      title: texts.titleInsertEmoji,
      fields: [{ key: "value", label: texts.promptEmoji, defaultValue: "\ud83d\ude0a", required: true }],
    });
    if (!result) {
      return false;
    }
    return insertText(String(result.value || ""));
  };

  const insertChineseDate = () => {
    const value = new Intl.DateTimeFormat(getLocaleKey(), {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date());
    return insertText(value);
  };

  return {
    insertSymbol,
    insertEmoji,
    insertChineseDate,
  };
};
