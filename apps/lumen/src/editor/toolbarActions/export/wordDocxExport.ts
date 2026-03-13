import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  LevelFormat,
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

type ExportContext = {
  quoteDepth: number;
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

const mapHeadingLevel = (level: number) => {
  if (level <= 1) return HeadingLevel.HEADING_1;
  if (level === 2) return HeadingLevel.HEADING_2;
  if (level === 3) return HeadingLevel.HEADING_3;
  if (level === 4) return HeadingLevel.HEADING_4;
  if (level === 5) return HeadingLevel.HEADING_5;
  return HeadingLevel.HEADING_6;
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

const buildParagraphOptions = (element: Element, context: ExportContext, extra: Record<string, unknown> = {}) => {
  const html = element as HTMLElement;
  const spacingBefore = parseCssPixel(html.style?.marginTop);
  const spacingAfter = parseCssPixel(html.style?.marginBottom);
  const firstLineIndent = parseCssPixel(html.style?.textIndent);
  const baseIndent = context.quoteDepth > 0 ? context.quoteDepth * 360 : 0;

  return {
    alignment: mapAlignment(html.style?.textAlign || element.getAttribute("align")),
    spacing:
      spacingBefore != null || spacingAfter != null
        ? {
            before: pxToTwip(spacingBefore ?? 0),
            after: pxToTwip(spacingAfter ?? 0),
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
  extra: Record<string, unknown> = {}
) => {
  const children = await collectInlineChildren(Array.from(element.childNodes));
  return new Paragraph({
    ...buildParagraphOptions(element, context, extra),
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
      })
    );
  });
  if (children.length === 0) {
    children.push(createTextRun("", { code: true }));
  }
  return new Paragraph({
    ...buildParagraphOptions(element, context),
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
      ...buildParagraphOptions(element, context),
      children: [new TextRun(text)],
    });
  }
  const { width, height } = getImageDimensions(element);
  return new Paragraph({
    ...buildParagraphOptions(element, context, { alignment: AlignmentType.CENTER }),
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
  const children = await collectInlineChildren(Array.from(element.childNodes));
  const fallbackText = normalizeText(element.textContent);
  return new Paragraph({
    ...buildParagraphOptions(element, context),
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

  const inlineChildren = await collectInlineChildren(contentNodes);
  const prefixChildren =
    listContext.kind === "task"
      ? [new TextRun(listContext.checked === true ? "[x] " : "[ ] ")]
      : [];

  return new Paragraph({
    ...buildParagraphOptions(itemElement, context, {
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
    }),
    children:
      prefixChildren.length > 0 || inlineChildren.length > 0
        ? [...prefixChildren, ...inlineChildren]
        : [...prefixChildren, new TextRun("")],
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

  if (tagName === "p") {
    return [await createParagraphFromElement(element, context)];
  }

  if (/^h[1-6]$/.test(tagName)) {
    const level = Math.max(1, Math.min(6, Number(tagName.slice(1)) || 1));
    return [
      await createParagraphFromElement(element, context, {
        heading: mapHeadingLevel(level),
      }),
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
          children: inlineChildren.length > 0 ? inlineChildren : [new TextRun(normalizeText(container.textContent))],
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

export const buildWordDocxBlobFromHtml = async (html: string) => {
  if (!html || typeof DOMParser === "undefined") {
    return null;
  }

  const parsed = new DOMParser().parseFromString(`<main>${html}</main>`, "text/html");
  const container = parsed.body.firstElementChild;
  if (!container) {
    return null;
  }

  const children = await convertContainerChildren(container, { quoteDepth: 0 });
  const doc = new Document({
    numbering: {
      config: createNumberingConfig(),
    },
    sections: [
      {
        children: children.length > 0 ? children : [new Paragraph("")],
      },
    ],
  });

  return Packer.toBlob(doc);
};
