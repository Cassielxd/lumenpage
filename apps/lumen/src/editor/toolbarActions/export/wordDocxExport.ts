import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  ImageRun,
  LevelFormat,
  LineRuleType,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType,
} from "docx";

export type RenderedWordPage = {
  dataUrl: string;
  widthPx: number;
  heightPx: number;
};

type ExportContext = {
  quoteDepth: number;
  defaultFontFamily: string | null;
  defaultFontSize: number | null;
  defaultLineHeight: number | null;
  blockSpacing: number | null;
  paragraphSpacingBefore: number | null;
  paragraphSpacingAfter: number | null;
};

type ParagraphLayoutDefaults = {
  spacingBefore?: number | null;
  spacingAfter?: number | null;
  lineHeight?: number | null;
};

type WordExportSettings = {
  pageWidthPx?: number | null;
  pageHeightPx?: number | null;
  margin?: {
    top?: number | null;
    right?: number | null;
    bottom?: number | null;
    left?: number | null;
  } | null;
  font?: string | null;
  lineHeight?: number | null;
  blockSpacing?: number | null;
  paragraphSpacingBefore?: number | null;
  paragraphSpacingAfter?: number | null;
};

type WordExportHtmlOptions = {
  pageBreakBeforeRootIndices?: number[];
  settings?: WordExportSettings | null;
};

type InlineStyleState = {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  strike?: boolean;
  subScript?: boolean;
  superScript?: boolean;
  code?: boolean;
  color?: string | null;
  background?: string | null;
  fontSize?: number | null;
  fontFamily?: string | null;
};

type ListContext = {
  kind: "bullet" | "ordered" | "task";
  depth: number;
  checked?: boolean;
};

const PX_TO_TWIP = 15;
const PX_TO_HALF_POINT = 1.5;
const MAX_LIST_DEPTH = 6;
const BULLET_TEXT = "\u2022";

const BLOCK_TAGS = new Set([
  "article",
  "aside",
  "blockquote",
  "div",
  "figure",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "main",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "ul",
]);

const normalizeText = (value: unknown) => String(value ?? "");

const parseFontSpec = (fontSpec: string | null | undefined) => {
  const source = String(fontSpec || "").trim();
  const match = /(\d+(?:\.\d+)?)px\s+(.+)/.exec(source);
  if (!match) {
    return {
      size: 16,
      family: "Arial",
    };
  }
  const size = Number.parseFloat(match[1]);
  return {
    size: Number.isFinite(size) && size > 0 ? Math.round(size) : 16,
    family: String(match[2] || "").trim() || "Arial",
  };
};

const pxToTwip = (value: unknown) => {
  const next = Number(value);
  return Number.isFinite(next) ? Math.max(0, Math.round(next * PX_TO_TWIP)) : undefined;
};

const pxToHalfPoint = (value: unknown) => {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? Math.max(2, Math.round(next * PX_TO_HALF_POINT)) : undefined;
};

const parseCssPixel = (value: string | null | undefined) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }
  const match = raw.match(/^-?\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }
  const next = Number(match[0]);
  return Number.isFinite(next) ? next : null;
};

const normalizeColorHex = (value: string | null | undefined) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }
  const hex = raw.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const normalized = hex[1].length === 3 ? hex[1].split("").map((part) => `${part}${part}`).join("") : hex[1];
    return normalized.toUpperCase();
  }
  const rgb = raw.match(
    /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})(?:\s*[,/ ]\s*[\d.]+\s*)?\)$/i
  );
  if (rgb) {
    return [rgb[1], rgb[2], rgb[3]]
      .map((part) => Math.max(0, Math.min(255, Number(part))).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  }
  return null;
};

const mapAlignment = (value: string | null | undefined) => {
  const align = String(value || "")
    .trim()
    .toLowerCase();
  if (align === "center") return AlignmentType.CENTER;
  if (align === "right" || align === "end") return AlignmentType.RIGHT;
  if (align === "justify" || align === "distributed") return AlignmentType.JUSTIFIED;
  return AlignmentType.LEFT;
};

const getHeadingStyle = (level: number, baseFontSize: number, baseFontFamily: string | null) => {
  const normalizedLevel = Math.max(1, Math.min(6, Number(level) || 1));
  const scaleMap = [1.6, 1.35, 1.2, 1.1, 1.0, 0.95];
  const scale = scaleMap[normalizedLevel - 1] || 1;
  const size = Math.max(12, Math.round(baseFontSize * scale));
  return {
    bold: true,
    fontSize: size,
    fontFamily: baseFontFamily || null,
  };
};

const hasBlockChildren = (element: Element) =>
  Array.from(element.childNodes).some(
    (child) => child.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((child as Element).tagName.toLowerCase())
  );

const dataUrlToUint8Array = (dataUrl: string) => {
  const match = String(dataUrl || "").match(/^data:.*?;base64,(.+)$/i);
  if (!match) {
    return null;
  }
  const decoded = atob(match[1]);
  const data = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    data[index] = decoded.charCodeAt(index);
  }
  return data;
};

const inferImageType = (src: string): "jpg" | "png" | "gif" | "bmp" => {
  const normalized = String(src || "").trim().toLowerCase();
  if (normalized.startsWith("data:image/jpeg") || normalized.startsWith("data:image/jpg") || normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) {
    return "jpg";
  }
  if (normalized.startsWith("data:image/gif") || normalized.endsWith(".gif")) {
    return "gif";
  }
  if (normalized.startsWith("data:image/bmp") || normalized.endsWith(".bmp")) {
    return "bmp";
  }
  return "png";
};

const loadImageBytes = async (src: string) => {
  const normalized = String(src || "").trim();
  if (!normalized) {
    return null;
  }
  if (normalized.startsWith("data:")) {
    return dataUrlToUint8Array(normalized);
  }
  try {
    const response = await fetch(normalized);
    if (!response.ok) {
      return null;
    }
    return new Uint8Array(await response.arrayBuffer());
  } catch (_error) {
    return null;
  }
};

const getImageDimensions = (element: Element, fallbackWidth = 320, fallbackHeight = 180) => {
  const width =
    parseCssPixel(element.getAttribute("width")) ??
    parseCssPixel((element as HTMLElement).style?.width) ??
    fallbackWidth;
  const height =
    parseCssPixel(element.getAttribute("height")) ??
    parseCssPixel((element as HTMLElement).style?.height) ??
    fallbackHeight;
  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
};

const mergeInlineStyles = (base: InlineStyleState, next: Partial<InlineStyleState>): InlineStyleState => ({
  ...base,
  ...next,
});

const createTextRun = (text: string, styles: InlineStyleState = {}) =>
  new TextRun({
    text,
    bold: styles.bold === true || undefined,
    italics: styles.italics === true || undefined,
    strike: styles.strike === true || undefined,
    underline: styles.underline ? { type: UnderlineType.SINGLE } : undefined,
    subScript: styles.subScript === true || undefined,
    superScript: styles.superScript === true || undefined,
    color: normalizeColorHex(styles.color) || undefined,
    shading: normalizeColorHex(styles.background)
      ? {
          fill: normalizeColorHex(styles.background) || undefined,
        }
      : undefined,
    size: pxToHalfPoint(styles.fontSize),
    font: styles.code ? "Courier New" : styles.fontFamily || undefined,
  });

const createBreakRun = () => new TextRun({ break: 1 });

const collectInlineChildren = async (
  nodes: ChildNode[],
  styleState: InlineStyleState = {}
): Promise<any[]> => {
  const children: any[] = [];

  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue ?? "";
      if (text) {
        children.push(createTextRun(text, styleState));
      }
      continue;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      continue;
    }

    const element = node as Element;
    const tagName = element.tagName.toLowerCase();

    if (tagName === "br") {
      children.push(createBreakRun());
      continue;
    }

    if (tagName === "img") {
      const src = element.getAttribute("src") || "";
      const data = await loadImageBytes(src);
      if (data) {
        const { width, height } = getImageDimensions(element, 160, 96);
        children.push(
          new ImageRun({
            type: inferImageType(src),
            data,
            transformation: { width, height },
          })
        );
      } else {
        children.push(createTextRun(element.getAttribute("alt") || "[Image]", styleState));
      }
      continue;
    }

    let nextStyle = styleState;
    if (tagName === "strong" || tagName === "b") {
      nextStyle = mergeInlineStyles(styleState, { bold: true });
    } else if (tagName === "em" || tagName === "i") {
      nextStyle = mergeInlineStyles(styleState, { italics: true });
    } else if (tagName === "u") {
      nextStyle = mergeInlineStyles(styleState, { underline: true });
    } else if (tagName === "s" || tagName === "strike" || tagName === "del") {
      nextStyle = mergeInlineStyles(styleState, { strike: true });
    } else if (tagName === "sub") {
      nextStyle = mergeInlineStyles(styleState, { subScript: true });
    } else if (tagName === "sup") {
      nextStyle = mergeInlineStyles(styleState, { superScript: true });
    } else if (tagName === "code") {
      nextStyle = mergeInlineStyles(styleState, { code: true });
    } else if (tagName === "span") {
      const html = element as HTMLElement;
      nextStyle = mergeInlineStyles(styleState, {
        color: html.style?.color || styleState.color || null,
        background: html.style?.backgroundColor || styleState.background || null,
        fontSize: parseCssPixel(html.style?.fontSize) ?? styleState.fontSize ?? null,
        fontFamily: html.style?.fontFamily || styleState.fontFamily || null,
      });
    }

    const nestedChildren = await collectInlineChildren(Array.from(element.childNodes), nextStyle);
    if (tagName === "a") {
      const href = String(element.getAttribute("href") || "").trim();
      if (href && nestedChildren.length > 0) {
        children.push(
          new ExternalHyperlink({
            link: href,
            children: nestedChildren,
          })
        );
      } else {
        children.push(...nestedChildren);
      }
      continue;
    }

    children.push(...nestedChildren);
  }

  return children;
};

const buildParagraphOptions = (
  element: Element,
  context: ExportContext,
  extra: Record<string, unknown> = {},
  defaults: ParagraphLayoutDefaults = {}
) => {
  const html = element as HTMLElement;
  const spacingBefore = parseCssPixel(html.style?.marginTop);
  const spacingAfter = parseCssPixel(html.style?.marginBottom);
  const firstLineIndent = parseCssPixel(html.style?.textIndent);
  const baseIndent = context.quoteDepth > 0 ? context.quoteDepth * 360 : 0;
  const resolvedSpacingBefore =
    spacingBefore ?? (defaults.spacingBefore ?? context.paragraphSpacingBefore);
  const resolvedSpacingAfter =
    spacingAfter ?? (defaults.spacingAfter ?? context.paragraphSpacingAfter);
  const resolvedLineHeight = defaults.lineHeight ?? context.defaultLineHeight;

  return {
    alignment: mapAlignment(html.style?.textAlign || element.getAttribute("align")),
    spacing:
      resolvedSpacingBefore != null || resolvedSpacingAfter != null || resolvedLineHeight != null
        ? {
            before: pxToTwip(resolvedSpacingBefore ?? 0),
            after: pxToTwip(resolvedSpacingAfter ?? 0),
            line: pxToTwip(resolvedLineHeight ?? 0),
            lineRule: resolvedLineHeight != null ? LineRuleType.EXACT : undefined,
          }
        : undefined,
    indent:
      baseIndent > 0 || firstLineIndent
        ? {
            left: baseIndent || undefined,
            firstLine: pxToTwip(firstLineIndent ?? 0),
          }
        : undefined,
    border:
      context.quoteDepth > 0
        ? {
            left: {
              color: "94A3B8",
              style: BorderStyle.SINGLE,
              size: 8,
              space: 8,
            },
          }
        : undefined,
    ...extra,
  };
};

const createParagraphFromElement = async (
  element: Element,
  context: ExportContext,
  extra: Record<string, unknown> = {},
  baseStyle: InlineStyleState = {},
  defaults: ParagraphLayoutDefaults = {}
) => {
  const mergedBaseStyle = mergeInlineStyles(
    {
      fontSize: context.defaultFontSize,
      fontFamily: context.defaultFontFamily,
    },
    baseStyle
  );
  const children = await collectInlineChildren(Array.from(element.childNodes), mergedBaseStyle);
  return new Paragraph({
    ...buildParagraphOptions(element, context, extra, defaults),
    children: children.length > 0 ? children : [new TextRun("")],
  });
};

const createCodeParagraph = (element: Element, context: ExportContext) => {
  const text = normalizeText(element.textContent);
  const lines = text.split(/\r?\n/);
  const children: any[] = [];
  lines.forEach((line, index) => {
    if (index > 0) {
      children.push(createBreakRun());
    }
    children.push(
      createTextRun(line, {
        code: true,
        background: "#F3F4F6",
        fontSize: context.defaultFontSize,
      })
    );
  });
  if (children.length === 0) {
    children.push(createTextRun("", { code: true }));
  }
  return new Paragraph({
    ...buildParagraphOptions(element, context, {}, {
      spacingBefore: context.blockSpacing,
      spacingAfter: context.blockSpacing,
    }),
    shading: { fill: "F3F4F6" },
    children,
  });
};

const createRuleParagraph = () =>
  new Paragraph({
    border: {
      bottom: {
        color: "CBD5E1",
        style: BorderStyle.SINGLE,
        size: 8,
        space: 2,
      },
    },
    children: [new TextRun("")],
  });

const createImageParagraph = async (element: Element, context: ExportContext) => {
  const src =
    element.getAttribute("src") ||
    element.getAttribute("data-signature-src") ||
    element.getAttribute("data-file-src") ||
    "";
  const data = await loadImageBytes(src);
  if (!data) {
    const text =
      element.getAttribute("alt") ||
      element.getAttribute("data-signature-signer") ||
      normalizeText(element.textContent) ||
      "[Image]";
    return new Paragraph({
      ...buildParagraphOptions(element, context, {}, {
        spacingBefore: context.blockSpacing,
        spacingAfter: context.blockSpacing,
      }),
      children: [
        createTextRun(text, {
          fontSize: context.defaultFontSize,
          fontFamily: context.defaultFontFamily,
        }),
      ],
    });
  }
  const { width, height } = getImageDimensions(element);
  return new Paragraph({
    ...buildParagraphOptions(
      element,
      context,
      { alignment: AlignmentType.CENTER },
      {
        spacingBefore: context.blockSpacing,
        spacingAfter: context.blockSpacing,
      }
    ),
    children: [
      new ImageRun({
        type: inferImageType(src),
        data,
        transformation: { width, height },
      }),
    ],
  });
};

const createGenericParagraph = async (element: Element, context: ExportContext) => {
  const children = await collectInlineChildren(Array.from(element.childNodes), {
    fontSize: context.defaultFontSize,
    fontFamily: context.defaultFontFamily,
  });
  const fallbackText = normalizeText(element.textContent);
  return new Paragraph({
    ...buildParagraphOptions(element, context, {}, {
      spacingBefore: 0,
      spacingAfter: 0,
    }),
    children: children.length > 0 ? children : [new TextRun(fallbackText)],
  });
};

const createListParagraphFromItem = async (
  itemElement: Element,
  context: ExportContext,
  listContext: ListContext
) => {
  const contentNodes = Array.from(itemElement.childNodes).filter((child) => {
    return !(
      child.nodeType === Node.ELEMENT_NODE &&
      ["ul", "ol"].includes((child as Element).tagName.toLowerCase())
    );
  });

  const inlineChildren = await collectInlineChildren(contentNodes, {
    fontSize: context.defaultFontSize,
    fontFamily: context.defaultFontFamily,
  });
  const normalizedChildren =
    inlineChildren.length > 0
      ? inlineChildren
      : [
          createTextRun("", {
            fontSize: context.defaultFontSize,
            fontFamily: context.defaultFontFamily,
          }),
        ];
  const prefixChildren =
    listContext.kind === "task"
      ? [
          createTextRun(listContext.checked === true ? "[x] " : "[ ] ", {
            fontSize: context.defaultFontSize,
            fontFamily: context.defaultFontFamily,
          }),
        ]
      : [];

  return new Paragraph({
    ...buildParagraphOptions(
      itemElement,
      context,
      {
        indent:
          listContext.kind === "task"
            ? {
                left: (Math.min(listContext.depth, MAX_LIST_DEPTH) + 1) * 360,
              }
            : undefined,
        numbering:
          listContext.kind === "bullet"
            ? {
                reference: "lumen-bullet",
                level: Math.min(listContext.depth, MAX_LIST_DEPTH),
              }
            : listContext.kind === "ordered"
              ? {
                  reference: "lumen-ordered",
                  level: Math.min(listContext.depth, MAX_LIST_DEPTH),
                }
              : undefined,
      },
      {
        spacingBefore: 0,
        spacingAfter: 0,
      }
    ),
    children:
      prefixChildren.length > 0 || normalizedChildren.length > 0
        ? [...prefixChildren, ...normalizedChildren]
        : [
            ...prefixChildren,
            createTextRun("", {
              fontSize: context.defaultFontSize,
              fontFamily: context.defaultFontFamily,
            }),
          ],
  });
};

const convertListElement = async (
  element: Element,
  context: ExportContext,
  depth = 0
): Promise<any[]> => {
  const tagName = element.tagName.toLowerCase();
  const isTask = element.hasAttribute("data-task-list") || element.getAttribute("data-type") === "taskList";
  const kind: ListContext["kind"] = isTask ? "task" : tagName === "ol" ? "ordered" : "bullet";
  const blocks: any[] = [];

  const items = Array.from(element.children).filter((child) => child.tagName.toLowerCase() === "li");
  for (const itemElement of items) {
    blocks.push(
      await createListParagraphFromItem(itemElement, context, {
        kind,
        depth,
        checked: itemElement.getAttribute("data-checked") === "true",
      })
    );

    for (const child of Array.from(itemElement.children)) {
      const nestedTag = child.tagName.toLowerCase();
      if (nestedTag === "ul" || nestedTag === "ol") {
        blocks.push(...(await convertListElement(child, context, depth + 1)));
      }
    }
  }

  return blocks;
};

const convertTableElement = async (element: Element, context: ExportContext) => {
  const rowElements = Array.from(element.querySelectorAll(":scope > tbody > tr, :scope > tr"));
  const rows: TableRow[] = [];

  for (const rowElement of rowElements) {
    const cellElements = Array.from(rowElement.children).filter((child) => {
      const tag = child.tagName.toLowerCase();
      return tag === "td" || tag === "th";
    });
    const cells: TableCell[] = [];

    for (const cellElement of cellElements) {
      const paragraphs = await convertContainerChildren(cellElement, context);
      const background = normalizeColorHex((cellElement as HTMLElement).style?.backgroundColor);
      cells.push(
        new TableCell({
          children: paragraphs.length > 0 ? paragraphs : [new Paragraph("")],
          columnSpan: Math.max(1, Number(cellElement.getAttribute("colspan")) || 1),
          shading: background ? { fill: background } : undefined,
        })
      );
    }

    rows.push(new TableRow({ children: cells }));
  }

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
  });
};

const convertBlockNode = async (node: ChildNode, context: ExportContext): Promise<any[]> => {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = normalizeText(node.nodeValue).trim();
    return text ? [new Paragraph({ children: [new TextRun(text)] })] : [];
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return [];
  }

  const element = node as Element;
  const tagName = element.tagName.toLowerCase();

  if (element.getAttribute("data-word-page-break") === "true") {
    return [
      new Paragraph({
        pageBreakBefore: true,
        children: [new TextRun("")],
      }),
    ];
  }

  if (tagName === "p") {
    return [await createParagraphFromElement(element, context)];
  }

  if (/^h[1-6]$/.test(tagName)) {
    const level = Math.max(1, Math.min(6, Number(tagName.slice(1)) || 1));
    const headingStyle = getHeadingStyle(
      level,
      context.defaultFontSize || 16,
      context.defaultFontFamily
    );
    return [
      await createParagraphFromElement(element, context, {}, headingStyle),
    ];
  }

  if (tagName === "blockquote") {
    return convertContainerChildren(element, { ...context, quoteDepth: context.quoteDepth + 1 });
  }

  if (tagName === "pre") {
    return [createCodeParagraph(element, context)];
  }

  if (tagName === "hr") {
    return [createRuleParagraph()];
  }

  if (tagName === "ul" || tagName === "ol") {
    return convertListElement(element, context);
  }

  if (tagName === "table") {
    return [await convertTableElement(element, context)];
  }

  if (tagName === "img") {
    return [await createImageParagraph(element, context)];
  }

  if (tagName === "div" && element.getAttribute("data-type") === "signature") {
    return [await createImageParagraph(element, context)];
  }

  if (hasBlockChildren(element)) {
    return convertContainerChildren(element, context);
  }

  return [await createGenericParagraph(element, context)];
};

const convertContainerChildren = async (container: Element, context: ExportContext) => {
  const blocks: any[] = [];
  let inlineBuffer: ChildNode[] = [];

  const flushInlineBuffer = async () => {
    if (inlineBuffer.length === 0) {
      return;
    }
    const inlineChildren = await collectInlineChildren(inlineBuffer);
    const hasVisibleText = inlineBuffer.some((node) => normalizeText(node.textContent).trim().length > 0);
    if (inlineChildren.length > 0 || hasVisibleText) {
      blocks.push(
        new Paragraph({
          ...buildParagraphOptions(container, context, {}, {
            spacingBefore: 0,
            spacingAfter: 0,
          }),
          children:
            inlineChildren.length > 0
              ? inlineChildren
              : [
                  createTextRun(normalizeText(container.textContent), {
                    fontSize: context.defaultFontSize,
                    fontFamily: context.defaultFontFamily,
                  }),
                ],
        })
      );
    }
    inlineBuffer = [];
  };

  for (const child of Array.from(container.childNodes)) {
    const isBlockElement =
      child.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((child as Element).tagName.toLowerCase());
    if (isBlockElement) {
      await flushInlineBuffer();
      blocks.push(...(await convertBlockNode(child, context)));
      continue;
    }
    inlineBuffer.push(child);
  }

  await flushInlineBuffer();
  return blocks;
};

const createNumberingConfig = () => {
  const levels = Array.from({ length: MAX_LIST_DEPTH + 1 }, (_, level) => ({
    level,
    format: LevelFormat.DECIMAL,
    text: `%${level + 1}.`,
    alignment: AlignmentType.LEFT,
    style: {
      paragraph: {
        indent: {
          left: 720 + level * 360,
          hanging: 360,
        },
      },
    },
  }));

  const bulletLevels = Array.from({ length: MAX_LIST_DEPTH + 1 }, (_, level) => ({
    level,
    format: LevelFormat.BULLET,
    text: BULLET_TEXT,
    alignment: AlignmentType.LEFT,
    style: {
      paragraph: {
        indent: {
          left: 720 + level * 360,
          hanging: 360,
        },
      },
    },
  }));

  return [
    { reference: "lumen-ordered", levels },
    { reference: "lumen-bullet", levels: bulletLevels },
  ];
};

const injectPageBreakMarkers = (container: Element, pageBreakBeforeRootIndices: number[]) => {
  if (!Array.isArray(pageBreakBeforeRootIndices) || pageBreakBeforeRootIndices.length === 0) {
    return;
  }

  const targets = Array.from(
    new Set(
      pageBreakBeforeRootIndices
        .map((value) => Math.floor(Number(value)))
        .filter((value) => Number.isFinite(value) && value > 0)
    )
  ).sort((a, b) => b - a);

  for (const index of targets) {
    const child = container.children.item(index);
    if (!child || child.previousElementSibling?.getAttribute("data-word-page-break") === "true") {
      continue;
    }
    const marker = container.ownerDocument.createElement("div");
    marker.setAttribute("data-word-page-break", "true");
    container.insertBefore(marker, child);
  }
};

export const buildWordDocxBlobFromHtml = async (
  html: string,
  options: WordExportHtmlOptions = {}
) => {
  if (!html || typeof DOMParser === "undefined") {
    return null;
  }

  const parsed = new DOMParser().parseFromString(`<main>${html}</main>`, "text/html");
  const container = parsed.body.firstElementChild;
  if (!container) {
    return null;
  }

  const fontSpec = parseFontSpec(options.settings?.font);
  injectPageBreakMarkers(container, options.pageBreakBeforeRootIndices || []);

  const context: ExportContext = {
    quoteDepth: 0,
    defaultFontFamily: fontSpec.family || null,
    defaultFontSize: fontSpec.size || null,
    defaultLineHeight: Number.isFinite(options.settings?.lineHeight)
      ? Math.round(Number(options.settings?.lineHeight))
      : null,
    blockSpacing: Number.isFinite(options.settings?.blockSpacing)
      ? Math.round(Number(options.settings?.blockSpacing))
      : 8,
    paragraphSpacingBefore: Number.isFinite(options.settings?.paragraphSpacingBefore)
      ? Math.round(Number(options.settings?.paragraphSpacingBefore))
      : 0,
    paragraphSpacingAfter: Number.isFinite(options.settings?.paragraphSpacingAfter)
      ? Math.round(Number(options.settings?.paragraphSpacingAfter))
      : 8,
  };

  const children = await convertContainerChildren(container, context);
  const margin = options.settings?.margin || null;
  const pageWidthPx = Number(options.settings?.pageWidthPx);
  const pageHeightPx = Number(options.settings?.pageHeightPx);
  const page = {
    size:
      Number.isFinite(pageWidthPx) && pageWidthPx > 0 && Number.isFinite(pageHeightPx) && pageHeightPx > 0
        ? {
            width: pxToTwip(pageWidthPx),
            height: pxToTwip(pageHeightPx),
          }
        : undefined,
    margin: margin
      ? {
          top: pxToTwip(margin?.top ?? 0),
          right: pxToTwip(margin?.right ?? 0),
          bottom: pxToTwip(margin?.bottom ?? 0),
          left: pxToTwip(margin?.left ?? 0),
        }
      : undefined,
  };
  const doc = new Document({
    numbering: {
      config: createNumberingConfig(),
    },
    sections: [
      {
        properties: {
          page:
            page.size || page.margin
              ? {
                  size: page.size,
                  margin: page.margin,
                }
              : undefined,
        },
        children: children.length > 0 ? children : [new Paragraph("")],
      },
    ],
  });

  return Packer.toBlob(doc);
};

export const buildWordDocxBlobFromRenderedPages = async (
  pages: RenderedWordPage[],
  options: {
    pageWidthPx?: number;
    pageHeightPx?: number;
  } = {}
) => {
  if (!Array.isArray(pages) || pages.length === 0) {
    return null;
  }

  const normalizedPages = pages
    .map((page) => {
      const widthPx = Math.max(1, Math.round(Number(page?.widthPx) || 0));
      const heightPx = Math.max(1, Math.round(Number(page?.heightPx) || 0));
      const data = dataUrlToUint8Array(String(page?.dataUrl || ""));
      if (!data || widthPx <= 0 || heightPx <= 0) {
        return null;
      }
      return {
        data,
        widthPx,
        heightPx,
      };
    })
    .filter(Boolean) as Array<{
    data: Uint8Array;
    widthPx: number;
    heightPx: number;
  }>;

  if (normalizedPages.length === 0) {
    return null;
  }

  const pageWidthPx = Math.max(
    1,
    Math.round(Number(options.pageWidthPx) || normalizedPages[0].widthPx)
  );
  const pageHeightPx = Math.max(
    1,
    Math.round(Number(options.pageHeightPx) || normalizedPages[0].heightPx)
  );

  const doc = new Document({
    sections: normalizedPages.map((page) => ({
      properties: {
        page: {
          size: {
            width: pxToTwip(pageWidthPx),
            height: pxToTwip(pageHeightPx),
          },
          margin: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
          },
        },
      },
      children: [
        new Paragraph({
          spacing: {
            before: 0,
            after: 0,
          },
          children: [
            new ImageRun({
              type: "png",
              data: page.data,
              transformation: {
                width: page.widthPx,
                height: page.heightPx,
              },
            }),
          ],
        }),
      ],
    })),
  });

  return Packer.toBlob(doc);
};
