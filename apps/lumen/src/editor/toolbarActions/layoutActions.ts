import { TextSelection } from "lumenpage-state";
import type { PlaygroundLocale } from "../i18n";
import { createPageAppearanceActions } from "./pageAppearanceActions";

type GetView = () => any;
type RunCommand = (name: string, ...args: unknown[]) => boolean;

const parsePaperSize = (raw: string | null) => {
  const text = String(raw || "")
    .trim()
    .toLowerCase();
  if (!text) {
    return null;
  }
  if (text === "a4") {
    return { width: 794, height: 1123 };
  }
  if (text === "letter") {
    return { width: 816, height: 1056 };
  }
  if (text === "legal") {
    return { width: 816, height: 1344 };
  }
  const match = text.match(/^(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)$/);
  if (!match) {
    return null;
  }
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return { width: Math.round(width), height: Math.round(height) };
};

export const createLayoutActions = ({
  getView,
  run,
  getLocaleKey,
}: {
  getView: GetView;
  run: RunCommand;
  getLocaleKey: () => PlaygroundLocale;
}) => {
  const pageAppearanceActions = createPageAppearanceActions({
    getView,
    getLocaleKey,
  });

  const refreshLayoutAndRender = () => {
    const view = getView();
    if (!view?._internals) {
      return false;
    }
    view._internals.layoutPipeline?.clearCache?.();
    view._internals.renderer?.pageCache?.clear?.();
    view._internals.updateLayout?.();
    view._internals.updateCaret?.(true);
    view._internals.scheduleRender?.();
    return true;
  };

  const applyLineHeightSetting = () => {
    const view = getView();
    const settings = view?._internals?.settings;
    if (!settings) {
      return false;
    }
    const current = Number(settings.lineHeight) || 26;
    const promptText = getLocaleKey() === "en-US" ? "Line height (px)" : "请输入行高（像素）";
    const raw = window.prompt(promptText, String(current));
    if (raw === null) {
      return false;
    }
    const next = Number(raw);
    if (!Number.isFinite(next) || next <= 0) {
      return false;
    }
    settings.lineHeight = Math.max(1, Math.round(next));
    return refreshLayoutAndRender();
  };

  const applyParagraphSpacingSetting = () => {
    const promptText =
      getLocaleKey() === "en-US" ? "Paragraph spacing (px)" : "请输入段间距（像素）";
    const raw = window.prompt(promptText, "8");
    if (raw === null) {
      return false;
    }
    const next = Number(raw);
    if (!Number.isFinite(next) || next < 0) {
      return false;
    }
    const beforeOk = run("setParagraphSpacingBefore", next);
    const afterOk = run("setParagraphSpacingAfter", next);
    return beforeOk || afterOk;
  };

  const selectAllContent = () => {
    const view = getView();
    if (!view?.state?.doc || !view?.state?.tr) {
      return false;
    }
    try {
      const selection = TextSelection.create(view.state.doc, 0, view.state.doc.content.size);
      view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
      return true;
    } catch (_error) {
      return false;
    }
  };

  const applyPageMarginSetting = () => {
    const view = getView();
    const settings = view?._internals?.settings;
    if (!settings?.margin) {
      return false;
    }
    const current = Number(settings.margin.left) || 72;
    const promptText = getLocaleKey() === "en-US" ? "Page margin (px)" : "请输入页边距（像素）";
    const raw = window.prompt(promptText, String(current));
    if (raw === null) {
      return false;
    }
    const next = Number(raw);
    if (!Number.isFinite(next) || next < 0) {
      return false;
    }
    const value = Math.round(next);
    settings.margin = { left: value, right: value, top: value, bottom: value };
    return refreshLayoutAndRender();
  };

  const applyPageSizeSetting = () => {
    const view = getView();
    const settings = view?._internals?.settings;
    if (!settings) {
      return false;
    }
    const current = `${Number(settings.pageWidth) || 794}x${Number(settings.pageHeight) || 1123}`;
    const promptText =
      getLocaleKey() === "en-US"
        ? "Paper size: A4 / Letter / Legal / widthxheight"
        : "纸张大小：A4 / Letter / Legal / 宽x高";
    const nextSize = parsePaperSize(window.prompt(promptText, current));
    if (!nextSize) {
      return false;
    }
    settings.pageWidth = nextSize.width;
    settings.pageHeight = nextSize.height;
    return refreshLayoutAndRender();
  };

  const togglePageOrientation = () => {
    const view = getView();
    const settings = view?._internals?.settings;
    if (!settings) {
      return false;
    }
    const width = Number(settings.pageWidth) || 794;
    const height = Number(settings.pageHeight) || 1123;
    settings.pageWidth = height;
    settings.pageHeight = width;
    return refreshLayoutAndRender();
  };

  const togglePageBreakMarks = () => {
    const view = getView();
    const settings = view?._internals?.settings;
    if (!settings) {
      return false;
    }
    settings.showPageCropMarks = settings.showPageCropMarks === false;
    view?._internals?.renderer?.pageCache?.clear?.();
    view?._internals?.scheduleRender?.();
    return true;
  };

  return {
    refreshLayoutAndRender,
    applyLineHeightSetting,
    applyParagraphSpacingSetting,
    selectAllContent,
    applyPageMarginSetting,
    applyPageSizeSetting,
    togglePageOrientation,
    togglePageBreakMarks,
    togglePageLineNumbers: pageAppearanceActions.togglePageLineNumbers,
    getPageBackgroundColor: pageAppearanceActions.getPageBackgroundColor,
    setPageBackgroundColor: pageAppearanceActions.setPageBackgroundColor,
    applyPageBackgroundSetting: pageAppearanceActions.applyPageBackgroundSetting,
    applyPageWatermarkSetting: pageAppearanceActions.applyPageWatermarkSetting,
    applyPageHeaderSetting: pageAppearanceActions.applyPageHeaderSetting,
    applyPageFooterSetting: pageAppearanceActions.applyPageFooterSetting,
  };
};
