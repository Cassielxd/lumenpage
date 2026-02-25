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
