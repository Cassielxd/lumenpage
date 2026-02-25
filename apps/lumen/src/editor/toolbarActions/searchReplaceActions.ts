import type { PlaygroundLocale } from "../i18n";

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
        promptSearch: "请输入要查找的文本",
        promptReplace: "请输入替换文本（可为空）",
        alertEmptySearch: "查找内容不能为空",
        alertNoMatch: "未找到匹配内容",
        alertReplaced: (count) => `已替换 ${count} 处`,
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
}: {
  getView: GetView;
  getLocaleKey: () => PlaygroundLocale;
}) => {
  const searchAndReplace = () => {
    const view = getView();
    const state = view?.state;
    if (!view || !state?.doc || !state?.tr) {
      return false;
    }

    const texts = resolveTexts(getLocaleKey());
    const rawSearch = window.prompt(texts.promptSearch, "");
    if (rawSearch == null) {
      return false;
    }
    const searchKeyword = rawSearch;
    if (!searchKeyword) {
      window.alert(texts.alertEmptySearch);
      return false;
    }

    const replacement = window.prompt(texts.promptReplace, "");
    if (replacement == null) {
      return false;
    }

    const ranges = collectReplaceRanges(state.doc, searchKeyword);
    if (ranges.length === 0) {
      window.alert(texts.alertNoMatch);
      return false;
    }

    let tr = state.tr;
    for (let index = ranges.length - 1; index >= 0; index -= 1) {
      const range = ranges[index];
      tr = tr.insertText(replacement, range.from, range.to);
    }
    view.dispatch(tr.scrollIntoView());
    window.alert(texts.alertReplaced(ranges.length));
    return true;
  };

  return {
    searchAndReplace,
  };
};
