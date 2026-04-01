import type { PlaygroundLocale } from "../../i18n";
import type { RequestToolbarInputDialog } from "../ui/inputDialog";
import { showToolbarMessage } from "../ui/message";
import { resolveExportLocaleTexts } from "./localeTexts";

export const createShareClipboardActions = ({
  getLocaleKey,
  requestInputDialog,
}: {
  getLocaleKey: () => PlaygroundLocale;
  requestInputDialog: RequestToolbarInputDialog;
}) => {
  const resolveCurrentUrl = () => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.location.href || "";
  };

  const copyTextWithFallback = async (
    text: string,
    promptTitle: string
  ): Promise<"clipboard" | "manual" | null> => {
    if (!text) {
      return null;
    }
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return "clipboard";
      }
    } catch (_error) {
      // fall through to manual copy dialog fallback
    }

    const texts = resolveExportLocaleTexts(getLocaleKey());
    const result = await requestInputDialog({
      title: promptTitle,
      width: 620,
      confirmText: texts.close,
      cancelText: texts.cancel,
      fields: [
        {
          key: "value",
          label: texts.clipboardUnavailableManualCopy,
          type: "textarea",
          defaultValue: text,
          required: true,
        },
      ],
    });
    return result == null ? null : "manual";
  };

  const copyShareLink = async () => {
    const url = resolveCurrentUrl();
    if (!url) {
      return false;
    }
    const texts = resolveExportLocaleTexts(getLocaleKey());
    const mode = await copyTextWithFallback(url, texts.copyShareLink);
    if (mode === "clipboard") {
      showToolbarMessage(texts.copiedToClipboard, "success");
    }
    return mode != null;
  };

  const copyEmbedCode = async () => {
    const url = resolveCurrentUrl();
    if (!url) {
      return false;
    }
    const escapedUrl = url.replace(/"/g, "&quot;");
    const snippet = `<iframe src="${escapedUrl}" width="100%" height="720" frameborder="0"></iframe>`;
    const texts = resolveExportLocaleTexts(getLocaleKey());
    const mode = await copyTextWithFallback(snippet, texts.copyEmbedCode);
    if (mode === "clipboard") {
      showToolbarMessage(texts.copiedToClipboard, "success");
    }
    return mode != null;
  };

  return {
    copyShareLink,
    copyEmbedCode,
  };
};
