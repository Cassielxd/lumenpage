import type { PlaygroundLocale } from "../i18n";
import type { RequestToolbarInputDialog } from "./ui/inputDialog";
import { showToolbarMessage } from "./ui/message";

type GetView = () => any;

type Texts = {
  promptSearch: string;
  promptReplace: string;
  alertEmptySearch: string;
  alertNoMatch: string;
  alertReplaced: (count: number) => string;
};

const resolveTexts = (locale: PlaygroundLocale): Texts =>
  locale === "en-US"
    ? {
        promptSearch: "Find text",
        promptReplace: "Replace with (can be empty)",
        alertEmptySearch: "Find text cannot be empty",
        alertNoMatch: "No matches found",
        alertReplaced: (count) => `Replaced ${count} matches`,
      }
    : {
        promptSearch: "\u67e5\u627e\u5185\u5bb9",
        promptReplace: "\u66ff\u6362\u4e3a\uff08\u53ef\u4e3a\u7a7a\uff09",
        alertEmptySearch: "\u67e5\u627e\u5185\u5bb9\u4e0d\u80fd\u4e3a\u7a7a",
        alertNoMatch: "\u672a\u627e\u5230\u5339\u914d\u9879",
        alertReplaced: (count) => `\u5df2\u66ff\u6362 ${count} \u5904`,
      };

type ReplaceRange = {
  from: number;
  to: number;
};

const collectReplaceRanges = (doc: any, keyword: string): ReplaceRange[] => {
  const ranges: ReplaceRange[] = [];
  if (!doc || !keyword) {
    return ranges;
  }
  doc.descendants((node: any, pos: number) => {
    const text = typeof node?.text === "string" ? node.text : "";
    if (!text) {
      return;
    }
    let startIndex = 0;
    while (startIndex < text.length) {
      const foundIndex = text.indexOf(keyword, startIndex);
      if (foundIndex < 0) {
        break;
      }
      ranges.push({
        from: pos + foundIndex,
        to: pos + foundIndex + keyword.length,
      });
      startIndex = foundIndex + Math.max(keyword.length, 1);
    }
  });
  return ranges;
};

export const createSearchReplaceActions = ({
  getView,
  getLocaleKey,
  requestInputDialog,
}: {
  getView: GetView;
  getLocaleKey: () => PlaygroundLocale;
  requestInputDialog: RequestToolbarInputDialog;
}) => {
  const searchAndReplace = async () => {
    const view = getView();
    const state = view?.state;
    if (!view || !state?.doc || !state?.tr) {
      return false;
    }

    const texts = resolveTexts(getLocaleKey());
    const result = await requestInputDialog({
      title: getLocaleKey() === "en-US" ? "Search & Replace" : "\u67e5\u627e\u66ff\u6362",
      width: 520,
      fields: [
        {
          key: "search",
          label: texts.promptSearch,
          required: true,
        },
        {
          key: "replace",
          label: texts.promptReplace,
        },
      ],
    });
    if (!result) {
      return false;
    }

    const searchKeyword = String(result.search || "");
    if (!searchKeyword) {
      showToolbarMessage(texts.alertEmptySearch, "warning");
      return false;
    }
    const replacement = String(result.replace || "");

    const ranges = collectReplaceRanges(state.doc, searchKeyword);
    if (ranges.length === 0) {
      showToolbarMessage(texts.alertNoMatch, "info");
      return false;
    }

    let tr = state.tr;
    for (let index = ranges.length - 1; index >= 0; index -= 1) {
      const range = ranges[index];
      tr = tr.insertText(replacement, range.from, range.to);
    }
    view.dispatch(tr.scrollIntoView());
    showToolbarMessage(texts.alertReplaced(ranges.length), "success");
    return true;
  };

  return {
    searchAndReplace,
  };
};
