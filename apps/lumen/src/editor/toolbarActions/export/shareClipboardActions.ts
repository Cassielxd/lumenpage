import type { PlaygroundLocale } from "../../i18n";
import { resolveExportLocaleTexts } from "./localeTexts";

export const createShareClipboardActions = ({
  getLocaleKey,
}: {
  getLocaleKey: () => PlaygroundLocale;
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
  ): Promise<"clipboard" | "prompt" | null> => {
    if (!text) {
      return null;
    }
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return "clipboard";
      }
    } catch (_error) {
      // fall through to prompt copy fallback
    }
    const confirmed = window.prompt(promptTitle, text);
    return confirmed == null ? null : "prompt";
  };

  const copyShareLink = async () => {
    const url = resolveCurrentUrl();
    if (!url) {
      return false;
    }
    const texts = resolveExportLocaleTexts(getLocaleKey());
    const mode = await copyTextWithFallback(url, texts.copyShareLink);
    if (mode === "clipboard") {
      window.alert(texts.copiedToClipboard);
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
      window.alert(texts.copiedToClipboard);
    }
    return mode != null;
  };

  return {
    copyShareLink,
    copyEmbedCode,
  };
};
