import { createPlaygroundI18n, type PlaygroundLocale } from "../i18n";
import { loadMarkdownModule } from "../markdownBridge";
import type { RequestToolbarInputDialog } from "./ui/inputDialog";
import { showToolbarMessage } from "./ui/message";

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
  requestInputDialog,
}: {
  getView: GetView;
  getLocaleKey: () => PlaygroundLocale;
  getMenuTexts: () => MenuTexts;
  downloadTextAsFile: DownloadTextAsFile;
  requestInputDialog: RequestToolbarInputDialog;
}) => {
  const getTexts = () => createPlaygroundI18n(getLocaleKey()).markdownActions;

  const handleMarkdownAction = async () => {
    const view = getView();
    if (!view?.state?.doc) {
      return false;
    }

    const menuTexts = getMenuTexts();
    const texts = getTexts();
    const dialogResult = await requestInputDialog({
      title: texts.titleMarkdown,
      width: 560,
      fields: [
        {
          key: "mode",
          label: texts.labelMode,
          type: "select",
          options: [
            { label: texts.optionExport, value: "export" },
            { label: texts.optionImport, value: "import" },
          ],
          defaultValue: "export",
          required: true,
        },
        {
          key: "source",
          label: menuTexts.promptPasteMarkdown,
          type: "textarea",
          defaultValue: "",
        },
      ],
    });
    if (!dialogResult) {
      return false;
    }

    const mode = String(dialogResult.mode || "")
      .trim()
      .toLowerCase();
    if (!mode) {
      return false;
    }

    let markdownModule: Awaited<ReturnType<typeof loadMarkdownModule>> | null = null;
    try {
      markdownModule = await loadMarkdownModule();
    } catch (_error) {
      showToolbarMessage(menuTexts.markdownModuleLoadFailed, "error");
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
        showToolbarMessage(menuTexts.markdownExportFailed, "error");
        return false;
      }
    }

    if (mode === "import") {
      const source = String(dialogResult.source || "");
      if (!source.trim()) {
        return false;
      }
      try {
        const nextDoc = markdownModule.defaultMarkdownParser.parse(source);
        return view.setJSON(nextDoc?.toJSON?.() ?? null);
      } catch (_error) {
        showToolbarMessage(menuTexts.markdownImportFailed, "error");
        return false;
      }
    }

    return false;
  };

  return {
    handleMarkdownAction,
  };
};
