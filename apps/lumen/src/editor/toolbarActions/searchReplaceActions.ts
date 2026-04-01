import { createPlaygroundI18n, type PlaygroundLocale } from "../i18n";
import type { RequestToolbarInputDialog } from "./ui/inputDialog";
import { showToolbarMessage } from "./ui/message";

type GetView = () => any;

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
  const getTexts = () => createPlaygroundI18n(getLocaleKey()).searchReplaceActions;
  const searchAndReplace = async () => {
    const view = getView();
    const state = view?.state;
    if (!view || !state?.doc || !state?.tr) {
      return false;
    }

    const texts = getTexts();
    const result = await requestInputDialog({
      title: texts.title,
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
    showToolbarMessage(
      createPlaygroundI18n(getLocaleKey()).searchReplaceActions.alertReplaced.replace(
        "{count}",
        String(ranges.length)
      ),
      "success"
    );
    return true;
  };

  return {
    searchAndReplace,
  };
};
