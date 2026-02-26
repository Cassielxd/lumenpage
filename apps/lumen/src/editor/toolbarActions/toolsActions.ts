import type { PlaygroundLocale } from "../i18n";
import type { RequestToolbarInputDialog } from "./ui/inputDialog";

type GetView = () => any;
type RunCommand = (name: string, ...args: unknown[]) => boolean;

type ChineseCaseMode = "lower" | "upper";

type ToolsTexts = {
  promptQrCodeContent: string;
  promptBarcodeContent: string;
  promptSignatureName: string;
  promptSealText: string;
  promptDiagramsCode: string;
  promptEchartsCode: string;
  promptMermaidCode: string;
  promptMindMapCode: string;
  promptChineseCaseInput: string;
  promptChineseCaseMode: string;
  alertChineseCaseInvalidNumber: string;
  labelSeal: string;
  labelSignature: string;
  defaultQrCodeContent: string;
  defaultBarcodeContent: string;
  defaultSignatureName: string;
  defaultSealText: string;
  defaultDiagramCode: string;
  defaultEchartsCode: string;
  defaultMermaidCode: string;
  defaultMindMapCode: string;
};

const resolveTexts = (_locale: PlaygroundLocale): ToolsTexts => ({
  promptQrCodeContent: "QR code content",
  promptBarcodeContent: "Barcode content",
  promptSignatureName: "Signer name",
  promptSealText: "Seal text",
  promptDiagramsCode: "Diagram source code",
  promptEchartsCode: "ECharts option JSON",
  promptMermaidCode: "Mermaid source code",
  promptMindMapCode: "Mind map source code",
  promptChineseCaseInput: "Input number to convert into Chinese case",
  promptChineseCaseMode: "Case mode: upper / lower",
  alertChineseCaseInvalidNumber: "Input must be a valid number",
  labelSeal: "Seal",
  labelSignature: "Signature",
  defaultQrCodeContent: "https://example.com",
  defaultBarcodeContent: "1234567890",
  defaultSignatureName: "Signer",
  defaultSealText: "APPROVED",
  defaultDiagramCode: "flowchart LR\nA[Start] --> B[Done]",
  defaultEchartsCode:
    "{\n  \"xAxis\": {\"type\": \"category\", \"data\": [\"Mon\", \"Tue\", \"Wed\"]},\n  \"yAxis\": {\"type\": \"value\"},\n  \"series\": [{\"type\": \"bar\", \"data\": [120, 200, 150]}]\n}",
  defaultMermaidCode: "graph TD\nA[Start] --> B[End]",
  defaultMindMapCode: "mindmap\n  root((Root))\n    Branch A\n    Branch B",
});

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
  const codeBlockType = schema?.nodes?.code_block;
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
}: {
  getView: GetView;
  run: RunCommand;
  getLocaleKey: () => PlaygroundLocale;
  requestInputDialog: RequestToolbarInputDialog;
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
      title: dialogTitle("Insert QR Code", "插入二维码"),
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
    const inserted = run("insertImage", { src, alt: `QR: ${content.slice(0, 32)}` });
    if (inserted) {
      return true;
    }
    return false;
  };

  const insertBarcode = async () => {
    const texts = resolveTexts(getLocaleKey());
    const content = await readInput({
      title: dialogTitle("Insert Barcode", "插入条形码"),
      label: texts.promptBarcodeContent,
      defaultValue: texts.defaultBarcodeContent,
      required: true,
    });
    if (!content) {
      return false;
    }
    const src = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(content)}`;
    const inserted = run("insertImage", { src, alt: `BARCODE: ${content.slice(0, 32)}` });
    if (inserted) {
      return true;
    }
    return false;
  };

  const insertSignature = async () => {
    const texts = resolveTexts(getLocaleKey());
    const name = await readInput({
      title: dialogTitle("Insert Signature", "插入签名"),
      label: texts.promptSignatureName,
      defaultValue: texts.defaultSignatureName,
      required: true,
    });
    if (!name) {
      return false;
    }
    const signedAt = new Date().toISOString().slice(0, 10);
    return insertText(getView, `[${texts.labelSignature}] ${name} (${signedAt})`);
  };

  const insertSeal = async () => {
    const texts = resolveTexts(getLocaleKey());
    const raw = await readInput({
      title: dialogTitle("Insert Seal", "插入印章"),
      label: texts.promptSealText,
      defaultValue: texts.defaultSealText,
      required: true,
    });
    if (!raw) {
      return false;
    }
    return insertText(getView, `\u3010${texts.labelSeal}\u3011 ${raw}`);
  };

  const insertDiagrams = async () => {
    const texts = resolveTexts(getLocaleKey());
    const source = await readInput({
      title: dialogTitle("Insert Diagram", "插入流程图"),
      label: texts.promptDiagramsCode,
      defaultValue: texts.defaultDiagramCode,
      type: "textarea",
      required: true,
    });
    if (!source) {
      return false;
    }
    return insertCodeBlock(getView, source);
  };

  const insertEcharts = async () => {
    const texts = resolveTexts(getLocaleKey());
    const source = await readInput({
      title: dialogTitle("Insert ECharts", "插入图表"),
      label: texts.promptEchartsCode,
      defaultValue: texts.defaultEchartsCode,
      type: "textarea",
      required: true,
    });
    if (!source) {
      return false;
    }
    return insertCodeBlock(getView, source);
  };

  const insertMermaid = async () => {
    const texts = resolveTexts(getLocaleKey());
    const source = await readInput({
      title: dialogTitle("Insert Mermaid", "插入 Mermaid"),
      label: texts.promptMermaidCode,
      defaultValue: texts.defaultMermaidCode,
      type: "textarea",
      required: true,
    });
    if (!source) {
      return false;
    }
    return insertCodeBlock(getView, source);
  };

  const insertMindMap = async () => {
    const texts = resolveTexts(getLocaleKey());
    const source = await readInput({
      title: dialogTitle("Insert Mind Map", "插入思维导图"),
      label: texts.promptMindMapCode,
      defaultValue: texts.defaultMindMapCode,
      type: "textarea",
      required: true,
    });
    if (!source) {
      return false;
    }
    return insertCodeBlock(getView, source);
  };

  const convertChineseCase = async () => {
    const texts = resolveTexts(getLocaleKey());
    const selected = getSelectionText(getView).trim();
    const result = await requestInputDialog({
      title: dialogTitle("Chinese Case", "中文大小写转换"),
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
    insertSeal,
    insertDiagrams,
    insertEcharts,
    insertMermaid,
    insertMindMap,
    convertChineseCase,
  };
};
