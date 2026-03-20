import type { PlaygroundLocale } from "../i18n";
import type { RequestToolbarInputDialog } from "./ui/inputDialog";
import type { RequestToolbarSignatureDialog } from "./ui/signatureDialog";
import { resolveImageInsertAttrs } from "./mediaDimensions";

type GetView = () => any;
type RunCommand = (name: string, ...args: unknown[]) => boolean;

type ChineseCaseMode = "lower" | "upper";

type ToolsTexts = {
  promptQrCodeContent: string;
  promptBarcodeContent: string;
  promptSignatureName: string;
  promptDiagramsCode: string;
  promptEchartsCode: string;
  promptMermaidCode: string;
  promptMindMapCode: string;
  promptChineseCaseInput: string;
  promptChineseCaseMode: string;
  alertChineseCaseInvalidNumber: string;
  labelSignature: string;
  defaultQrCodeContent: string;
  defaultBarcodeContent: string;
  defaultSignatureName: string;
  defaultDiagramCode: string;
  defaultEchartsCode: string;
  defaultMermaidCode: string;
  defaultMindMapCode: string;
};

const resolveTexts = (locale: PlaygroundLocale): ToolsTexts =>
  locale === "en-US"
    ? {
        promptQrCodeContent: "QR code content",
        promptBarcodeContent: "Barcode content",
        promptSignatureName: "Signer name",
        promptDiagramsCode: "Diagram source code",
        promptEchartsCode: "ECharts option JSON",
        promptMermaidCode: "Mermaid source code",
        promptMindMapCode: "Mind map source code",
        promptChineseCaseInput: "Input number to convert into Chinese case",
        promptChineseCaseMode: "Case mode",
        alertChineseCaseInvalidNumber: "Input must be a valid number",
        labelSignature: "Signature",
        defaultQrCodeContent: "https://example.com",
        defaultBarcodeContent: "1234567890",
        defaultSignatureName: "Signer",
        defaultDiagramCode: "flowchart LR\nA[Start] --> B[Done]",
        defaultEchartsCode:
          "{\n  \"xAxis\": {\"type\": \"category\", \"data\": [\"Mon\", \"Tue\", \"Wed\"]},\n  \"yAxis\": {\"type\": \"value\"},\n  \"series\": [{\"type\": \"bar\", \"data\": [120, 200, 150]}]\n}",
        defaultMermaidCode: "graph TD\nA[Start] --> B[End]",
        defaultMindMapCode: "mindmap\n  root((Root))\n    Branch A\n    Branch B",
      }
    : {
        promptQrCodeContent: "\u4e8c\u7ef4\u7801\u5185\u5bb9",
        promptBarcodeContent: "\u6761\u5f62\u7801\u5185\u5bb9",
        promptSignatureName: "\u7b7e\u540d\u4eba\u59d3\u540d",
        promptDiagramsCode: "\u56fe\u8868\u6e90\u7801",
        promptEchartsCode: "ECharts \u914d\u7f6e JSON",
        promptMermaidCode: "Mermaid \u6e90\u7801",
        promptMindMapCode: "\u601d\u7ef4\u5bfc\u56fe\u6e90\u7801",
        promptChineseCaseInput: "\u8f93\u5165\u9700\u8981\u8f6c\u6362\u7684\u6570\u5b57",
        promptChineseCaseMode: "\u5927\u5c0f\u5199\u6a21\u5f0f",
        alertChineseCaseInvalidNumber: "\u8f93\u5165\u5185\u5bb9\u5fc5\u987b\u662f\u6709\u6548\u6570\u5b57",
        labelSignature: "\u7b7e\u540d",
        defaultQrCodeContent: "https://example.com",
        defaultBarcodeContent: "1234567890",
        defaultSignatureName: "\u7b7e\u7f72\u4eba",
        defaultDiagramCode:
          "flowchart LR\nA[\u5f00\u59cb] --> B[\u5b8c\u6210]",
        defaultEchartsCode:
          "{\n  \"xAxis\": {\"type\": \"category\", \"data\": [\"\u5468\u4e00\", \"\u5468\u4e8c\", \"\u5468\u4e09\"]},\n  \"yAxis\": {\"type\": \"value\"},\n  \"series\": [{\"type\": \"bar\", \"data\": [120, 200, 150]}]\n}",
        defaultMermaidCode: "graph TD\nA[\u5f00\u59cb] --> B[\u7ed3\u675f]",
        defaultMindMapCode:
          "mindmap\n  root((\u4e3b\u9898))\n    \u5206\u652f A\n    \u5206\u652f B",
      };

const getViewState = (getView: GetView) => {
  const view = getView();
  const state = view?.state;
  if (!view || !state?.tr) {
    return null;
  }
  return { view, state };
};

const insertText = (getView: GetView, value: string) => {
  const payload = getViewState(getView);
  const text = String(value || "");
  if (!payload || !text) {
    return false;
  }
  const { view, state } = payload;
  const tr = state.tr.insertText(text, state.selection.from, state.selection.to);
  view.dispatch(tr.scrollIntoView());
  return true;
};

const replaceSelectionText = (getView: GetView, value: string) => {
  const payload = getViewState(getView);
  if (!payload) {
    return false;
  }
  const { view, state } = payload;
  const tr = state.tr.insertText(String(value || ""), state.selection.from, state.selection.to);
  view.dispatch(tr.scrollIntoView());
  return true;
};

const getSelectionText = (getView: GetView) => {
  const payload = getViewState(getView);
  if (!payload) {
    return "";
  }
  const { state } = payload;
  const { from, to } = state.selection;
  if (to <= from) {
    return "";
  }
  return state.doc.textBetween(from, to, "\n");
};

const replaceSelectionWithNode = (getView: GetView, node: any) => {
  const payload = getViewState(getView);
  if (!payload || !node) {
    return false;
  }
  const { view, state } = payload;
  const tr = state.tr.replaceSelectionWith(node);
  view.dispatch(tr.scrollIntoView());
  return true;
};

const createCodeBlockNode = (schema: any, source: string) => {
  const codeBlockType = schema?.nodes?.codeBlock;
  if (!codeBlockType) {
    return null;
  }
  const content = source ? [schema.text(source)] : undefined;
  return codeBlockType.createAndFill?.(null, content) ?? codeBlockType.create?.(null, content) ?? null;
};

const insertCodeBlock = (getView: GetView, source: string) => {
  const payload = getViewState(getView);
  if (!payload) {
    return false;
  }
  const node = createCodeBlockNode(payload.state.schema, source);
  if (!node) {
    return false;
  }
  return replaceSelectionWithNode(getView, node);
};

const normalizeChineseCaseMode = (value: string): ChineseCaseMode => {
  const text = String(value || "")
    .trim()
    .toLowerCase();
  if (text === "lower" || text === "l" || text === "0") {
    return "lower";
  }
  return "upper";
};

const normalizeNumberInput = (value: string) => {
  const text = String(value || "")
    .replace(/,/g, "")
    .trim();
  if (!text || !/^[+-]?\d+(\.\d+)?$/.test(text)) {
    return null;
  }
  const negative = text.startsWith("-");
  const unsigned = text.replace(/^[+-]/, "");
  const parts = unsigned.split(".");
  const integerPartRaw = parts[0] || "0";
  const decimalPartRaw = parts[1] || "";
  const integerPart = integerPartRaw.replace(/^0+(?=\d)/, "");
  return {
    negative,
    integerPart: integerPart || "0",
    decimalPart: decimalPartRaw,
  };
};

const CHINESE_NUMBER_MAP = {
  lower: {
    digits: ["\u96f6", "\u4e00", "\u4e8c", "\u4e09", "\u56db", "\u4e94", "\u516d", "\u4e03", "\u516b", "\u4e5d"],
    units: ["", "\u5341", "\u767e", "\u5343"],
  },
  upper: {
    digits: ["\u96f6", "\u58f9", "\u8d30", "\u53c1", "\u8086", "\u4f0d", "\u9646", "\u67d2", "\u634c", "\u7396"],
    units: ["", "\u62fe", "\u4f70", "\u4edf"],
  },
  bigUnits: ["", "\u4e07", "\u4ebf", "\u5146"],
  negative: "\u8d1f",
  point: "\u70b9",
};

const convertFourDigits = (group: string, mode: ChineseCaseMode) => {
  const digitMap = CHINESE_NUMBER_MAP[mode].digits;
  const unitMap = CHINESE_NUMBER_MAP[mode].units;
  let result = "";
  let zeroPending = false;
  for (let index = 0; index < group.length; index += 1) {
    const digit = Number(group[index]);
    const unit = unitMap[group.length - index - 1] || "";
    if (!Number.isFinite(digit)) {
      continue;
    }
    if (digit === 0) {
      if (result) {
        zeroPending = true;
      }
      continue;
    }
    if (zeroPending) {
      result += digitMap[0];
      zeroPending = false;
    }
    result += `${digitMap[digit]}${unit}`;
  }
  return result;
};

const convertIntegerToChinese = (integerPart: string, mode: ChineseCaseMode) => {
  const digitMap = CHINESE_NUMBER_MAP[mode].digits;
  if (!integerPart || /^0+$/.test(integerPart)) {
    return digitMap[0];
  }
  const groups: string[] = [];
  for (let end = integerPart.length; end > 0; end -= 4) {
    const start = Math.max(0, end - 4);
    groups.unshift(integerPart.slice(start, end));
  }

  let result = "";
  let groupHasGapZero = false;
  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    const groupValue = Number.parseInt(group, 10);
    const bigUnit = CHINESE_NUMBER_MAP.bigUnits[groups.length - index - 1] || "";

    if (!Number.isFinite(groupValue) || groupValue === 0) {
      groupHasGapZero = result.length > 0;
      continue;
    }

    const groupText = convertFourDigits(group, mode);
    if (groupHasGapZero && groupText) {
      result += digitMap[0];
    }
    result += `${groupText}${bigUnit}`;
    groupHasGapZero = Number(group[group.length - 1]) === 0;
  }

  return result || digitMap[0];
};

const convertDecimalToChinese = (decimalPart: string, mode: ChineseCaseMode) => {
  if (!decimalPart) {
    return "";
  }
  const digitMap = CHINESE_NUMBER_MAP[mode].digits;
  const converted = decimalPart
    .split("")
    .map((digit) => {
      const value = Number(digit);
      return Number.isFinite(value) ? digitMap[value] : "";
    })
    .join("");
  return converted ? `${CHINESE_NUMBER_MAP.point}${converted}` : "";
};

const convertNumberToChineseCase = (value: string, mode: ChineseCaseMode) => {
  const parsed = normalizeNumberInput(value);
  if (!parsed) {
    return null;
  }
  const integerText = convertIntegerToChinese(parsed.integerPart, mode);
  const decimalText = convertDecimalToChinese(parsed.decimalPart, mode);
  const sign = parsed.negative ? CHINESE_NUMBER_MAP.negative : "";
  return `${sign}${integerText}${decimalText}`;
};

export const createToolsActions = ({
  getView,
  run,
  getLocaleKey,
  requestInputDialog,
  requestSignatureDialog,
}: {
  getView: GetView;
  run: RunCommand;
  getLocaleKey: () => PlaygroundLocale;
  requestInputDialog: RequestToolbarInputDialog;
  requestSignatureDialog: RequestToolbarSignatureDialog;
}) => {
  const dialogTitle = (en: string, zh: string) => (getLocaleKey() === "en-US" ? en : zh);

  const readInput = async ({
    title,
    label,
    defaultValue = "",
    required = false,
    type = "text",
  }: {
    title: string;
    label: string;
    defaultValue?: string;
    required?: boolean;
    type?: "text" | "textarea" | "number";
  }) => {
    const result = await requestInputDialog({
      title,
      fields: [
        {
          key: "value",
          label,
          type,
          defaultValue,
          required,
        },
      ],
    });
    if (!result) {
      return null;
    }
    return String(result.value || "").trim();
  };

  const insertQrCode = async () => {
    const texts = resolveTexts(getLocaleKey());
    const content = await readInput({
      title: dialogTitle("Insert QR Code", "\u63d2\u5165\u4e8c\u7ef4\u7801"),
      label: texts.promptQrCodeContent,
      defaultValue: texts.defaultQrCodeContent,
      required: true,
    });
    if (!content) {
      return false;
    }
    const src = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(
      content
    )}`;
            const inserted = run("insertImage", {
      src,
      alt: `QR: ${content.slice(0, 32)}`,
      width: 256,
      height: 256,
    });
    if (inserted) {
      return true;
    }
    return false;
  };

  const insertBarcode = async () => {
    const texts = resolveTexts(getLocaleKey());
    const content = await readInput({
      title: dialogTitle("Insert Barcode", "\u63d2\u5165\u6761\u5f62\u7801"),
      label: texts.promptBarcodeContent,
      defaultValue: texts.defaultBarcodeContent,
      required: true,
    });
    if (!content) {
      return false;
    }
    const src = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(content)}`;
            const inserted = run("insertImage", {
      src,
      alt: `BARCODE: ${content.slice(0, 32)}`,
      width: 360,
      height: 180,
    });
    if (inserted) {
      return true;
    }
    return false;
  };

  const insertSignature = async () => {
    const texts = resolveTexts(getLocaleKey());
    const result = await requestSignatureDialog({
      defaultSigner: texts.defaultSignatureName,
    });
    if (!result) {
      return false;
    }
    if (run("insertSignature", result)) {
      return true;
    }
    return insertText(getView, `[${texts.labelSignature}] ${result.signer} (${result.signedAt})`);
  };

  const insertDiagrams = async () => {
    const texts = resolveTexts(getLocaleKey());
    const source = await readInput({
      title: dialogTitle("Insert Diagram", "\u63d2\u5165\u56fe\u8868"),
      label: texts.promptDiagramsCode,
      defaultValue: texts.defaultDiagramCode,
      type: "textarea",
      required: true,
    });
    if (!source) {
      return false;
    }
    if (run("insertEmbedPanel", { kind: "diagram", title: "Diagram", source })) {
      return true;
    }
    return insertCodeBlock(getView, source);
  };

  const insertEcharts = async () => {
    const texts = resolveTexts(getLocaleKey());
    const source = await readInput({
      title: dialogTitle("Insert ECharts", "\u63d2\u5165 ECharts"),
      label: texts.promptEchartsCode,
      defaultValue: texts.defaultEchartsCode,
      type: "textarea",
      required: true,
    });
    if (!source) {
      return false;
    }
    if (run("insertEmbedPanel", { kind: "echarts", title: "ECharts", source })) {
      return true;
    }
    return insertCodeBlock(getView, source);
  };

  const insertMermaid = async () => {
    const texts = resolveTexts(getLocaleKey());
    const source = await readInput({
      title: dialogTitle("Insert Mermaid", "\u63d2\u5165 Mermaid"),
      label: texts.promptMermaidCode,
      defaultValue: texts.defaultMermaidCode,
      type: "textarea",
      required: true,
    });
    if (!source) {
      return false;
    }
    if (run("insertEmbedPanel", { kind: "mermaid", title: "Mermaid", source })) {
      return true;
    }
    return insertCodeBlock(getView, source);
  };

  const insertMindMap = async () => {
    const texts = resolveTexts(getLocaleKey());
    const source = await readInput({
      title: dialogTitle("Insert Mind Map", "\u63d2\u5165\u601d\u7ef4\u5bfc\u56fe"),
      label: texts.promptMindMapCode,
      defaultValue: texts.defaultMindMapCode,
      type: "textarea",
      required: true,
    });
    if (!source) {
      return false;
    }
    if (run("insertEmbedPanel", { kind: "mindMap", title: "Mind Map", source })) {
      return true;
    }
    return insertCodeBlock(getView, source);
  };

  const convertChineseCase = async () => {
    const texts = resolveTexts(getLocaleKey());
    const selected = getSelectionText(getView).trim();
    const result = await requestInputDialog({
      title: dialogTitle("Chinese Case", "\u4e2d\u6587\u6570\u5b57\u5927\u5c0f\u5199"),
      width: 560,
      fields: [
        {
          key: "source",
          label: texts.promptChineseCaseInput,
          defaultValue: selected,
          required: true,
        },
        {
          key: "mode",
          label: texts.promptChineseCaseMode,
          type: "select",
          options:
            getLocaleKey() === "en-US"
              ? [
                  { label: "Upper", value: "upper" },
                  { label: "Lower", value: "lower" },
                ]
              : [
                  { label: "大写", value: "upper" },
                  { label: "小写", value: "lower" },
                ],
          defaultValue: "upper",
          required: true,
        },
      ],
    });
    if (!result) {
      return false;
    }
    const source = String(result.source || "").trim();
    if (!source) {
      return false;
    }
    const mode = normalizeChineseCaseMode(String(result.mode || "upper"));
    const converted = convertNumberToChineseCase(source, mode);
    if (!converted) {
      window.alert(texts.alertChineseCaseInvalidNumber);
      return false;
    }
    return replaceSelectionText(getView, converted);
  };

  return {
    insertQrCode,
    insertBarcode,
    insertSignature,
    insertDiagrams,
    insertEcharts,
    insertMermaid,
    insertMindMap,
    convertChineseCase,
  };
};





