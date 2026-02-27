import { TextSelection } from "lumenpage-state";
import type { PlaygroundLocale } from "../i18n";
import { createPageAppearanceActions } from "./pageAppearanceActions";
import type { RequestToolbarInputDialog } from "./ui/inputDialog";

type GetView = () => any;
type RunCommand = (name: string, ...args: unknown[]) => boolean;
const TOC_PLACEHOLDER = "[[TOC]]";

const TOC_MARKERS = new Set([TOC_PLACEHOLDER, "[TOC]"]);

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
  requestInputDialog,
}: {
  getView: GetView;
  run: RunCommand;
  getLocaleKey: () => PlaygroundLocale;
  requestInputDialog: RequestToolbarInputDialog;
}) => {
  const pageAppearanceActions = createPageAppearanceActions({
    getView,
    getLocaleKey,
    requestInputDialog,
  });

  const refreshLayoutAndRender = () => {
    const view = getView();
    if (!view) {
      return false;
    }
    if (typeof view.forceLayout === "function") {
      const refreshed = view.forceLayout({
        clearLayoutCache: true,
        clearPageCache: true,
        immediate: true,
      });
      view?._internals?.updateCaret?.(true);
      return refreshed;
    }
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

  const requestNumber = async ({
    title,
    label,
    defaultValue,
  }: {
    title: string;
    label: string;
    defaultValue: string;
  }) => {
    const result = await requestInputDialog({
      title,
      fields: [
        {
          key: "value",
          label,
          type: "number",
          defaultValue,
          required: true,
        },
      ],
    });
    if (!result) {
      return null;
    }
    return Number(result.value);
  };

  const applyLineHeightSetting = async () => {
    const view = getView();
    const settings = view?._internals?.settings;
    if (!settings) {
      return false;
    }
    const current = Number(settings.lineHeight) || 26;
    const next = await requestNumber({
      title: getLocaleKey() === "en-US" ? "Line Height" : "\u884c\u9ad8",
      label: getLocaleKey() === "en-US" ? "Line height (px)" : "\u884c\u9ad8\uff08px\uff09",
      defaultValue: String(current),
    });
    if (!Number.isFinite(next) || next <= 0) {
      return false;
    }
    settings.lineHeight = Math.max(1, Math.round(next));
    return refreshLayoutAndRender();
  };

  const applyParagraphSpacingSetting = async () => {
    const next = await requestNumber({
      title: getLocaleKey() === "en-US" ? "Paragraph Spacing" : "\u6bb5\u95f4\u8ddd",
      label: getLocaleKey() === "en-US" ? "Paragraph spacing (px)" : "\u6bb5\u95f4\u8ddd\uff08px\uff09",
      defaultValue: "8",
    });
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

  const applyPageMarginSetting = async () => {
    const view = getView();
    const settings = view?._internals?.settings;
    if (!settings?.margin) {
      return false;
    }
    const current = Number(settings.margin.left) || 72;
    const next = await requestNumber({
      title: getLocaleKey() === "en-US" ? "Page Margin" : "\u9875\u8fb9\u8ddd",
      label: getLocaleKey() === "en-US" ? "Page margin (px)" : "\u9875\u8fb9\u8ddd\uff08px\uff09",
      defaultValue: String(current),
    });
    if (!Number.isFinite(next) || next < 0) {
      return false;
    }
    const value = Math.round(next);
    settings.margin = { left: value, right: value, top: value, bottom: value };
    return refreshLayoutAndRender();
  };

  const applyPageSizeSetting = async () => {
    const view = getView();
    const settings = view?._internals?.settings;
    if (!settings) {
      return false;
    }
    const current = `${Number(settings.pageWidth) || 794}x${Number(settings.pageHeight) || 1123}`;
    const result = await requestInputDialog({
      title: getLocaleKey() === "en-US" ? "Page Size" : "\u7eb8\u5f20\u5927\u5c0f",
      fields: [
        {
          key: "value",
          label:
            getLocaleKey() === "en-US"
              ? "Paper size: A4 / Letter / Legal / widthxheight"
              : "\u7eb8\u5f20\u5927\u5c0f\uff1aA4 / Letter / Legal / \u5bbdx\u9ad8",
          defaultValue: current,
          required: true,
        },
      ],
    });
    if (!result) {
      return false;
    }
    const nextSize = parsePaperSize(result.value);
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

  const toggleTocPlaceholder = () => {
    const view = getView();
    const state = view?.state;
    if (!view || !state?.doc || !state?.tr || !state?.schema) {
      return false;
    }
    let found: { pos: number; size: number } | null = null;
    state.doc.descendants((node: any, pos: number) => {
      if (node.type?.name !== "paragraph") {
        return true;
      }
      const text = String(node.textContent || "").trim();
      if (!TOC_MARKERS.has(text)) {
        return true;
      }
      found = { pos, size: node.nodeSize };
      return false;
    });

    if (found) {
      const tr = state.tr.delete(found.pos, found.pos + found.size);
      view.dispatch(tr.scrollIntoView());
      return true;
    }

    const paragraphType = state.schema.nodes.paragraph;
    if (!paragraphType) {
      return false;
    }
    const paragraph =
      paragraphType.createAndFill?.(null, [state.schema.text(TOC_PLACEHOLDER)]) ??
      paragraphType.create?.(null, [state.schema.text(TOC_PLACEHOLDER)]) ??
      null;
    if (!paragraph) {
      return false;
    }
    const tr = state.tr.insert(0, paragraph);
    view.dispatch(tr.scrollIntoView());
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
    toggleTocPlaceholder,
    togglePageLineNumbers: pageAppearanceActions.togglePageLineNumbers,
    getPageBackgroundColor: pageAppearanceActions.getPageBackgroundColor,
    setPageBackgroundColor: pageAppearanceActions.setPageBackgroundColor,
    applyPageBackgroundSetting: pageAppearanceActions.applyPageBackgroundSetting,
    applyPageWatermarkSetting: pageAppearanceActions.applyPageWatermarkSetting,
    applyPageHeaderSetting: pageAppearanceActions.applyPageHeaderSetting,
    applyPageFooterSetting: pageAppearanceActions.applyPageFooterSetting,
  };
};
