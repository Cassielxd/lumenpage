// Playground 粘贴策略：用于演示可配置的粘贴清洗能力（不耦合核心）。

const BLOCKED_TAGS = ["script", "style", "iframe", "object", "embed", "link", "meta"];

const isDangerousUrl = (value: string) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized.startsWith("javascript:");
};

export const normalizePastedText = (text: string) => {
  if (typeof text !== "string") {
    return "";
  }
  return text.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ");
};

export const sanitizePastedHtml = (html: string) => {
  if (typeof html !== "string" || html.length === 0) {
    return "";
  }
  if (typeof DOMParser === "undefined") {
    return html;
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  for (const tag of BLOCKED_TAGS) {
    doc.querySelectorAll(tag).forEach((node) => node.remove());
  }

  doc.body.querySelectorAll("*").forEach((el) => {
    const attrs = Array.from(el.attributes || []);
    for (const attr of attrs) {
      const name = String(attr.name || "").toLowerCase();
      const value = String(attr.value || "");
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
        continue;
      }
      if ((name === "href" || name === "src") && isDangerousUrl(value)) {
        el.removeAttribute(attr.name);
      }
    }
  });

  return doc.body.innerHTML;
};

