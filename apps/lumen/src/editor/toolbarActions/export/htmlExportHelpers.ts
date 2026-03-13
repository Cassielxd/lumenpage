import { DOMSerializer } from "lumenpage-model";

const PRINT_DOCUMENT_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #111827; }
  body { font: 12pt/1.65 "Times New Roman", "Noto Serif", serif; }
  .print-root { max-width: 210mm; margin: 0 auto; padding: 12mm; }
  img, canvas { max-width: 100%; height: auto; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #d1d5db; padding: 4px 6px; }
  pre, code { white-space: pre-wrap; word-break: break-word; }
  @page { margin: 12mm; size: auto; }
`;

export const serializeViewDocToHtml = (view: any) => {
  const state = view?.state;
  if (!state?.doc || !state?.schema) {
    return null;
  }
  const ownerDocument =
    view?._internals?.dom?.root?.ownerDocument ??
    (typeof document !== "undefined" ? document : null);
  if (!ownerDocument) {
    return null;
  }
  try {
    const serializer = DOMSerializer.fromSchema(state.schema);
    const container = ownerDocument.createElement("div");
    container.appendChild(
      serializer.serializeFragment(state.doc.content, {
        document: ownerDocument,
      })
    );
    return container.innerHTML;
  } catch (_error) {
    return null;
  }
};

const collectWordLineBreakOffsetsByRootIndex = (view: any) => {
  const layout = view?._internals?.getLayout?.();
  const doc = view?.state?.doc;
  const pages = Array.isArray(layout?.pages) ? layout.pages : [];
  if (!doc || pages.length === 0) {
    return new Map<number, number[]>();
  }

  const breaks = new Map<number, Set<number>>();

  for (const page of pages) {
    const lines = Array.isArray(page?.lines) ? page.lines : [];
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const rootIndex = Number(line?.rootIndex);
      const blockStart = Number(line?.blockStart);
      const end = Number(line?.end);
      if (!Number.isFinite(rootIndex) || !Number.isFinite(blockStart) || !Number.isFinite(end)) {
        continue;
      }
      const node = doc.child(rootIndex);
      const typeName = node?.type?.name;
      if (typeName !== "paragraph" && typeName !== "heading") {
        continue;
      }

      const nextLine = lines[index + 1];
      const sameBlock =
        Number(nextLine?.rootIndex) === rootIndex && Number(nextLine?.blockStart) === blockStart;
      if (!sameBlock) {
        continue;
      }

      const localOffset = Math.max(0, end - blockStart);
      if (!breaks.has(rootIndex)) {
        breaks.set(rootIndex, new Set<number>());
      }
      breaks.get(rootIndex)?.add(localOffset);
    }
  }

  return new Map<number, number[]>(
    Array.from(breaks.entries()).map(([rootIndex, offsets]) => [
      rootIndex,
      Array.from(offsets).sort((a, b) => a - b),
    ])
  );
};

const insertSoftBreaksIntoBlock = (element: Element, offsets: number[]) => {
  if (!Array.isArray(offsets) || offsets.length === 0) {
    return;
  }

  const ownerDocument = element.ownerDocument;
  let cursor = 0;
  let targetIndex = 0;
  let targetOffset = offsets[targetIndex];

  const maybeAdvanceTarget = () => {
    while (targetIndex < offsets.length && offsets[targetIndex] <= cursor) {
      targetIndex += 1;
    }
    targetOffset = offsets[targetIndex];
  };

  const insertBreakBefore = (referenceNode: Node | null) => {
    const previous = referenceNode?.previousSibling;
    if ((referenceNode as Element | null)?.nodeType === Node.ELEMENT_NODE) {
      const referenceElement = referenceNode as Element;
      if (referenceElement.tagName.toLowerCase() === "br") {
        return;
      }
    }
    if (previous?.nodeType === Node.ELEMENT_NODE) {
      const previousElement = previous as Element;
      if (previousElement.tagName.toLowerCase() === "br") {
        return;
      }
    }
    element.insertBefore(ownerDocument.createElement("br"), referenceNode);
  };

  const walk = (node: Node): boolean => {
    if (targetIndex >= offsets.length) {
      return true;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      let text = node.nodeValue || "";
      while (targetIndex < offsets.length && targetOffset >= cursor && targetOffset <= cursor + text.length) {
        const splitIndex = targetOffset - cursor;
        if (splitIndex <= 0) {
          insertBreakBefore(node);
          maybeAdvanceTarget();
          continue;
        }
        if (splitIndex >= text.length) {
          cursor += text.length;
          insertBreakBefore(node.nextSibling);
          maybeAdvanceTarget();
          text = "";
          break;
        }
        const tail = node.splitText(splitIndex);
        cursor += splitIndex;
        insertBreakBefore(tail);
        maybeAdvanceTarget();
        text = tail.nodeValue || "";
        node = tail;
      }
      if (text.length > 0) {
        cursor += text.length;
      }
      return targetIndex >= offsets.length;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const elementNode = node as Element;
      if (elementNode.tagName.toLowerCase() === "br") {
        cursor += 1;
        maybeAdvanceTarget();
        return targetIndex >= offsets.length;
      }
      const children = Array.from(node.childNodes);
      for (const child of children) {
        if (walk(child)) {
          return true;
        }
      }
    }

    return targetIndex >= offsets.length;
  };

  for (const child of Array.from(element.childNodes)) {
    if (walk(child)) {
      break;
    }
  }
};

export const serializeViewDocToHtmlForWord = (view: any) => {
  const rawHtml = serializeViewDocToHtml(view);
  if (typeof rawHtml !== "string") {
    return null;
  }

  if (typeof DOMParser === "undefined") {
    return rawHtml;
  }

  const parser = new DOMParser();
  const parsed = parser.parseFromString(`<div>${rawHtml}</div>`, "text/html");
  const container = parsed.body.firstElementChild;
  if (!container) {
    return rawHtml;
  }

  const lineBreaks = collectWordLineBreakOffsetsByRootIndex(view);
  for (const [rootIndex, offsets] of lineBreaks.entries()) {
    const element = container.children.item(rootIndex);
    if (!element) {
      continue;
    }
    insertSoftBreaksIntoBlock(element, offsets);
  }

  return container.innerHTML;
};

export const buildHtmlPreviewDocument = (html: string) => {
  const previewCss = `
      ${PRINT_DOCUMENT_CSS}
      @media screen {
        html, body { background: #eef1f5; }
        .print-root {
          margin: 24px auto;
          box-shadow: 0 8px 28px rgba(15, 23, 42, 0.16);
          background: #fff;
        }
      }
      @media print {
        .print-root { box-shadow: none; }
      }
    `;
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Lumen Document PDF</title>
    <style>${previewCss}</style>
  </head>
  <body>
    <main class="print-root">${html}</main>
  </body>
</html>`;
};
