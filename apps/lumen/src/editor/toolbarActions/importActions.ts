import { createDocument } from "lumenpage-core";
import { DOMParser as PMDOMParser } from "lumenpage-model";
import type { PlaygroundLocale } from "../i18n";
import { showToolbarMessage } from "./ui/message";

type GetView = () => any;

type ImportTexts = {
  alertNoFile: string;
  alertReadFailed: string;
  alertParseFailed: string;
  alertWordUnsupported: string;
};

const resolveTexts = (locale: PlaygroundLocale): ImportTexts =>
  locale === "en-US"
    ? {
        alertNoFile: "No file selected",
        alertReadFailed: "Failed to read file",
        alertParseFailed: "Failed to parse file content",
        alertWordUnsupported: "Legacy .doc files are not supported yet. Please use .docx, HTML, or TXT.",
      }
    : {
        alertNoFile: "未选择文件",
        alertReadFailed: "读取文件失败",
        alertParseFailed: "解析文件内容失败",
        alertWordUnsupported: "暂不支持旧版 .doc 文件，请使用 .docx、HTML 或 TXT。",
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

const readFileAsArrayBuffer = (file: File) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read-failed"));
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }
      reject(new Error("read-failed"));
    };
    reader.readAsArrayBuffer(file);
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

const parseTextToDoc = (schema: any, text: string) => {
  try {
    const lines = String(text || "").split(/\r?\n/);
    return createDocument({
      schema,
      content: {
        type: "doc",
        content: (lines.length > 0 ? lines : [""]).map((line) => ({
          type: "paragraph",
          ...(line ? { content: [{ type: "text", text: line }] } : {}),
        })),
      },
    });
  } catch (_error) {
    return null;
  }
};

const parseDocxToDoc = async (schema: any, file: File) => {
  const [mammothModule, arrayBuffer] = await Promise.all([import("mammoth"), readFileAsArrayBuffer(file)]);
  const convertToHtml =
    mammothModule.convertToHtml ||
    (typeof mammothModule.default === "object" ? mammothModule.default.convertToHtml : null);
  if (typeof convertToHtml !== "function") {
    throw new Error("mammoth-convert-missing");
  }
  const result = await convertToHtml({ arrayBuffer });
  const html = String(result?.value || "").trim();
  return parseHtmlToDoc(schema, html) || parseTextToDoc(schema, html);
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
        showToolbarMessage(texts.alertNoFile, "warning");
        return false;
      }

      const ext = getFileExtension(file.name);
      if (ext === "doc") {
        showToolbarMessage(texts.alertWordUnsupported, "warning");
        return false;
      }

      let nextDoc = null;
      try {
        if (ext === "docx") {
          nextDoc = await parseDocxToDoc(state.schema, file);
        } else {
          const text = await readFileAsText(file);
          nextDoc =
            ext === "txt"
              ? parseTextToDoc(state.schema, text)
              : parseHtmlToDoc(state.schema, text) || parseTextToDoc(state.schema, text);
        }
      } catch (_error) {
        showToolbarMessage(texts.alertReadFailed, "error");
        return false;
      }

      if (!nextDoc) {
        showToolbarMessage(texts.alertParseFailed, "error");
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
