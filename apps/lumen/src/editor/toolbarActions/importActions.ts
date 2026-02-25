import { createDocFromText } from "lumenpage-kit-basic";
import { DOMParser as PMDOMParser } from "lumenpage-model";
import type { PlaygroundLocale } from "../i18n";

type GetView = () => any;

type ImportTexts = {
  alertNoFile: string;
  alertReadFailed: string;
  alertParseFailed: string;
  alertDocxUnsupported: string;
};

const resolveTexts = (locale: PlaygroundLocale): ImportTexts =>
  locale === "en-US"
    ? {
        alertNoFile: "No file selected",
        alertReadFailed: "Failed to read file",
        alertParseFailed: "Failed to parse file content",
        alertDocxUnsupported:
          "Current version does not parse .docx directly. Please export as HTML or TXT first.",
      }
    : {
        alertNoFile: "未选择文件",
        alertReadFailed: "读取文件失败",
        alertParseFailed: "解析文件内容失败",
        alertDocxUnsupported: "当前版本暂不直接解析 .docx，请先另存为 HTML 或 TXT 后导入。",
      };

const getFileExtension = (name: string) => {
  const text = String(name || "").trim().toLowerCase();
  const index = text.lastIndexOf(".");
  return index >= 0 ? text.slice(index + 1) : "";
};

const readFileAsText = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read-failed"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsText(file);
  });

const parseHtmlToDoc = (schema: any, html: string) => {
  if (!schema || !html || typeof DOMParser === "undefined") {
    return null;
  }
  try {
    const dom = new DOMParser().parseFromString(html, "text/html");
    const parser = PMDOMParser.fromSchema(schema);
    const parsed = parser.parse(dom.body || dom);
    return parsed?.type?.name === "doc" ? parsed : null;
  } catch (_error) {
    return null;
  }
};

const parseTextToDoc = (text: string) => {
  try {
    return createDocFromText(String(text || ""));
  } catch (_error) {
    return null;
  }
};

const buildImportInput = () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".doc,.docx,.htm,.html,.txt";
  input.style.display = "none";
  return input;
};

export const createImportActions = ({
  getView,
  getLocaleKey,
}: {
  getView: GetView;
  getLocaleKey: () => PlaygroundLocale;
}) => {
  const importWordDocument = async () => {
    const view = getView();
    const state = view?.state;
    if (!view || !state?.schema || typeof document === "undefined") {
      return false;
    }
    const texts = resolveTexts(getLocaleKey());
    const input = buildImportInput();
    document.body.appendChild(input);

    const cleanup = () => {
      input.value = "";
      input.remove();
    };

    try {
      const file = await new Promise<File | null>((resolve) => {
        input.onchange = () => resolve(input.files?.[0] ?? null);
        input.click();
      });

      if (!file) {
        window.alert(texts.alertNoFile);
        return false;
      }

      const ext = getFileExtension(file.name);
      if (ext === "docx") {
        window.alert(texts.alertDocxUnsupported);
        return false;
      }

      let text = "";
      try {
        text = await readFileAsText(file);
      } catch (_error) {
        window.alert(texts.alertReadFailed);
        return false;
      }

      const nextDoc =
        ext === "txt"
          ? parseTextToDoc(text)
          : parseHtmlToDoc(state.schema, text) || parseTextToDoc(text);

      if (!nextDoc) {
        window.alert(texts.alertParseFailed);
        return false;
      }

      return view.setJSON(nextDoc.toJSON());
    } finally {
      cleanup();
    }
  };

  return {
    importWordDocument,
  };
};
