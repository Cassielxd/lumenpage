import { Mark } from "lumenpage-core";

const normalizeStyleColor = (value) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
};

const normalizeStyleFontFamily = (value) => {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    return null;
  }
  return text.replace(/[{};]/g, "").trim() || null;
};

const normalizeStyleFontSize = (value) => {
  const raw = typeof value === "string" ? value.trim() : "";
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.round(parsed);
};

const normalizeTextStyleAttrs = (attrs) => {
  const color = normalizeStyleColor(attrs.color);
  const background = normalizeStyleColor(attrs.background);
  const fontFamily = normalizeStyleFontFamily(attrs.fontFamily);
  const fontSize = Number.isFinite(attrs.fontSize) ? Math.round(Number(attrs.fontSize)) : null;
  if (!color && !background && !fontFamily && !fontSize) {
    return null;
  }
  return {
    color,
    background,
    fontSize: fontSize && fontSize > 0 ? fontSize : null,
    fontFamily,
  };
};

export const TextStyle = Mark.create({
  name: "textStyle",
  priority: 100,
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => normalizeStyleColor(element?.style?.color),
        renderHTML: (attrs) => (attrs.color ? { style: `color:${attrs.color}` } : {}),
      },
      background: {
        default: null,
        parseHTML: (element) => normalizeStyleColor(element?.style?.backgroundColor),
        renderHTML: (attrs) =>
          attrs.background ? { style: `background-color:${attrs.background}` } : {},
      },
      fontSize: {
        default: null,
        parseHTML: (element) => normalizeStyleFontSize(element?.style?.fontSize),
        renderHTML: (attrs) =>
          Number.isFinite(attrs.fontSize) ? { style: `font-size:${attrs.fontSize}px` } : {},
      },
      fontFamily: {
        default: null,
        parseHTML: (element) => normalizeStyleFontFamily(element?.style?.fontFamily),
        renderHTML: (attrs) =>
          attrs.fontFamily ? { style: `font-family:${attrs.fontFamily}` } : {},
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "span",
        getAttrs: (element) => {
          const attrs = normalizeTextStyleAttrs({
            color: element?.style?.color,
            background: element?.style?.backgroundColor,
            fontSize: normalizeStyleFontSize(element?.style?.fontSize),
            fontFamily: element?.style?.fontFamily,
          });
          return attrs ? {} : false;
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", HTMLAttributes, 0];
  },
});

export default TextStyle;
