import { TextSelection } from "lumenpage-state";
import type { PlaygroundLocale } from "../i18n";
import { createPageAppearanceActions } from "./pageAppearanceActions";
import type { GetEditorCommandMap } from "./commandUtils";
import { invokeCommand } from "./commandUtils";
import type { RequestToolbarInputDialog } from "./ui/inputDialog";

type GetView = () => any;
const TOC_PLACEHOLDER = "[[TOC]]";

const TOC_MARKERS = new Set([TOC_PLACEHOLDER, "[TOC]"]);

export type PageSizePreset = {
  value: string;
  label: Record<PlaygroundLocale, string>;
  width: number;
  height: number;
};

export const PAGE_SIZE_PRESETS: PageSizePreset[] = [
  {
    value: "a3",
    label: { "zh-CN": "A3", "en-US": "A3" },
    width: 1123,
    height: 1587,
  },
  {
    value: "a4",
    label: { "zh-CN": "A4", "en-US": "A4" },
    width: 794,
    height: 1123,
  },
  {
    value: "a5",
    label: { "zh-CN": "A5", "en-US": "A5" },
    width: 559,
    height: 794,
  },
  {
    value: "b4",
    label: { "zh-CN": "B4", "en-US": "B4" },
    width: 944,
    height: 1334,
  },
  {
    value: "b5",
    label: { "zh-CN": "B5", "en-US": "B5" },
    width: 665,
    height: 944,
  },
  {
    value: "letter",
    label: { "zh-CN": "Letter", "en-US": "Letter" },
    width: 816,
    height: 1056,
  },
  {
    value: "legal",
    label: { "zh-CN": "Legal", "en-US": "Legal" },
    width: 816,
    height: 1344,
  },
];

const findPageSizePreset = (width: number, height: number) => {
  const shortEdge = Math.min(width, height);
  const longEdge = Math.max(width, height);
  return (
    PAGE_SIZE_PRESETS.find(
      (preset) => preset.width === shortEdge && preset.height === longEdge
    ) || null
  );
};

export const createLayoutActions = ({
  getView,
  getEditorCommands,
  getLocaleKey,
  requestInputDialog,
}: {
  getView: GetView;
  getEditorCommands: GetEditorCommandMap;
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

  const getCurrentPageSizeInfo = () => {
    const view = getView();
    const settings = view?._internals?.settings;
    if (!settings) {
      return null;
    }
    const width = Math.max(1, Math.round(Number(settings.pageWidth) || 794));
    const height = Math.max(1, Math.round(Number(settings.pageHeight) || 1123));
    return {
      width,
      height,
      preset: findPageSizePreset(width, height),
    };
  };

  const setPageSizeDimensions = (width: number, height: number) => {
    const view = getView();
    const settings = view?._internals?.settings;
    const nextWidth = Math.max(1, Math.round(Number(width) || 0));
    const nextHeight = Math.max(1, Math.round(Number(height) || 0));
    if (!settings || !Number.isFinite(nextWidth) || !Number.isFinite(nextHeight)) {
      return false;
    }
    settings.pageWidth = nextWidth;
    settings.pageHeight = nextHeight;
    return refreshLayoutAndRender();
  };

  const applyPageSizePreset = (value: string) => {
    const preset = PAGE_SIZE_PRESETS.find((item) => item.value === value) || null;
    if (!preset) {
      return false;
    }
    const current = getCurrentPageSizeInfo();
    const isLandscape = current ? current.width > current.height : false;
    return setPageSizeDimensions(
      isLandscape ? preset.height : preset.width,
      isLandscape ? preset.width : preset.height
    );
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
      title: getLocaleKey() === "en-US" ? "Line Height" : "行高",
      label: getLocaleKey() === "en-US" ? "Line height (px)" : "行高（px）",
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
      title: getLocaleKey() === "en-US" ? "Paragraph Spacing" : "段间距",
      label: getLocaleKey() === "en-US" ? "Paragraph spacing (px)" : "段间距（px）",
      defaultValue: "8",
    });
    if (!Number.isFinite(next) || next < 0) {
      return false;
    }
    const commands = getEditorCommands();
    const beforeOk = invokeCommand(commands?.setParagraphSpacingBefore, next);
    const afterOk = invokeCommand(commands?.setParagraphSpacingAfter, next);
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
      title: getLocaleKey() === "en-US" ? "Page Margin" : "页边距",
      label: getLocaleKey() === "en-US" ? "Page margin (px)" : "页边距（px）",
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
    const current = getCurrentPageSizeInfo();
    const currentPreset = current?.preset?.value || PAGE_SIZE_PRESETS[1]?.value || "a4";
    const result = await requestInputDialog({
      title: getLocaleKey() === "en-US" ? "Page Size" : "纸张大小",
      fields: [
        {
          key: "value",
          label: getLocaleKey() === "en-US" ? "Paper type" : "纸张类型",
          type: "select",
          options: PAGE_SIZE_PRESETS.map((preset) => ({
            label: preset.label[getLocaleKey()],
            value: preset.value,
          })),
          defaultValue: currentPreset,
          required: true,
        },
      ],
    });
    if (!result) {
      return false;
    }
    return applyPageSizePreset(result.value);
  };

  const togglePageOrientation = () => {
    const current = getCurrentPageSizeInfo();
    if (!current) {
      return false;
    }
    return setPageSizeDimensions(current.height, current.width);
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
    getCurrentPageSizeInfo,
    setPageSizeDimensions,
    applyPageSizePreset,
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
