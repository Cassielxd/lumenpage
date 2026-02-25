import type { PlaygroundLocale } from "../../i18n";
import { resolveExportLocaleTexts } from "./localeTexts";

const PRINT_PREVIEW_OVERLAY_ID = "lumen-print-preview-overlay";

export const openPrintPreviewDialog = (previewHtml: string, locale: PlaygroundLocale) => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const texts = resolveExportLocaleTexts(locale);
  document.getElementById(PRINT_PREVIEW_OVERLAY_ID)?.remove();
  const overlay = document.createElement("div");
  overlay.id = PRINT_PREVIEW_OVERLAY_ID;
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "9999",
    background: "rgba(15, 23, 42, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
  });

  const panel = document.createElement("div");
  Object.assign(panel.style, {
    width: "min(1200px, 100%)",
    height: "min(90vh, 100%)",
    background: "#ffffff",
    borderRadius: "12px",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 16px 44px rgba(15, 23, 42, 0.32)",
  });

  const header = document.createElement("div");
  Object.assign(header.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px",
    borderBottom: "1px solid #e5e7eb",
    flexShrink: "0",
  });

  const title = document.createElement("strong");
  title.textContent = texts.printPreviewTitle;
  title.style.fontSize = "14px";

  const actions = document.createElement("div");
  Object.assign(actions.style, {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  });

  const createActionButton = (label: string, primary = false) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    Object.assign(button.style, {
      height: "32px",
      minWidth: "72px",
      padding: "0 12px",
      borderRadius: "6px",
      border: primary ? "1px solid #2563eb" : "1px solid #d1d5db",
      background: primary ? "#2563eb" : "#ffffff",
      color: primary ? "#ffffff" : "#111827",
      cursor: "pointer",
    });
    return button;
  };

  const closeButton = createActionButton(texts.close, false);
  const printButton = createActionButton(texts.print, true);

  const frame = document.createElement("iframe");
  Object.assign(frame.style, {
    width: "100%",
    height: "100%",
    border: "0",
    background: "#f3f4f6",
  });
  frame.srcdoc = previewHtml;

  const previousOverflow = document.body.style.overflow;
  const cleanup = () => {
    document.body.style.overflow = previousOverflow;
    document.removeEventListener("keydown", onKeyDown);
    overlay.remove();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      cleanup();
    }
  };

  closeButton.addEventListener("click", cleanup);
  printButton.addEventListener("click", () => {
    const previewWindow = frame.contentWindow;
    if (!previewWindow) {
      return;
    }
    try {
      previewWindow.focus();
      previewWindow.print();
    } catch (_error) {
      // ignore print invocation failures
    }
  });
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      cleanup();
    }
  });
  document.addEventListener("keydown", onKeyDown);

  actions.appendChild(closeButton);
  actions.appendChild(printButton);
  header.appendChild(title);
  header.appendChild(actions);
  panel.appendChild(header);
  panel.appendChild(frame);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";
  return true;
};
