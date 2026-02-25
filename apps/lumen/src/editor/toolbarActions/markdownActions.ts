import type { PlaygroundLocale } from "../i18n";
import { loadMarkdownModule } from "../markdownBridge";

type GetView = () => any;
type DownloadTextAsFile = (filename: string, content: string, mimeType?: string) => boolean;

type MenuTexts = {
  markdownModuleLoadFailed: string;
  markdownExportFailed: string;
  markdownImportFailed: string;
  promptPasteMarkdown: string;
};

export const createMarkdownActions = ({
  getView,
  getLocaleKey,
  getMenuTexts,
  downloadTextAsFile,
}: {
  getView: GetView;
  getLocaleKey: () => PlaygroundLocale;
  getMenuTexts: () => MenuTexts;
  downloadTextAsFile: DownloadTextAsFile;
}) => {
  const handleMarkdownAction = async () => {
    const view = getView();
    if (!view?.state?.doc) {
      return false;
    }

    const promptText =
      getLocaleKey() === "en-US"
        ? "Markdown action: export / import"
        : "Markdown 操作：输入 export 或 import";
    const mode = String(window.prompt(promptText, "export") || "")
      .trim()
      .toLowerCase();
    if (!mode) {
      return false;
    }

    const menuTexts = getMenuTexts();
    let markdownModule: Awaited<ReturnType<typeof loadMarkdownModule>> | null = null;
    try {
      markdownModule = await loadMarkdownModule();
    } catch (_error) {
      window.alert(menuTexts.markdownModuleLoadFailed);
      return false;
    }
    if (!markdownModule) {
      return false;
    }

    if (mode === "export") {
      try {
        const text = markdownModule.defaultMarkdownSerializer.serialize(view.state.doc);
        return downloadTextAsFile("lumen-document.md", text);
      } catch (_error) {
        window.alert(menuTexts.markdownExportFailed);
        return false;
      }
    }

    if (mode === "import") {
      const source = window.prompt(menuTexts.promptPasteMarkdown, "");
      if (source == null) {
        return false;
      }
      try {
        const nextDoc = markdownModule.defaultMarkdownParser.parse(source);
        return view.setJSON(nextDoc?.toJSON?.() ?? null);
      } catch (_error) {
        window.alert(menuTexts.markdownImportFailed);
        return false;
      }
    }

    return false;
  };

  return {
    handleMarkdownAction,
  };
};
