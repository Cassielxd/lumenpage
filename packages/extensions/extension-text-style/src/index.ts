import { Mark } from "lumenpage-core";
import { getDefaultMarkRenderAdapter } from "lumenpage-render-engine";

type TextStyleCommands<ReturnType> = {
  setTextColor: (color?: string | null) => ReturnType;
  setTextBackground: (background?: string | null) => ReturnType;
  setTextFontSize: (fontSize?: number | null) => ReturnType;
  setTextFontFamily: (fontFamily?: string | null) => ReturnType;
  clearTextColor: () => ReturnType;
  clearTextBackground: () => ReturnType;
  clearTextFontSize: () => ReturnType;
  clearTextFontFamily: () => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    textStyle: TextStyleCommands<ReturnType>;
  }
}

type TextStyleAttrs = {
  color?: string | null;
  background?: string | null;
  fontSize?: number | null;
  fontFamily?: string | null;
};

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
  const raw = typeof value === "string" ? value.trim() : value;
  const parsed = Number.parseFloat(String(raw ?? ""));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.round(parsed);
};

const normalizeTextStyleAttrs = (attrs: TextStyleAttrs) => {
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

const getTextStyleAttrsFromMarks = (marks, type): TextStyleAttrs | null => {
  if (!Array.isArray(marks) || !type) {
    return null;
  }
  const target = marks.find((mark) => mark?.type === type);
  return target?.attrs || null;
};

const clearTextStyleAttr = (key: keyof TextStyleAttrs, markName: string) => (state, dispatch) => {
  const type = state.schema.marks[markName];
  if (!type) {
    return false;
  }

  const { from, to, empty, $from } = state.selection;

  if (!dispatch) {
    return true;
  }

  if (empty) {
    const marks = state.storedMarks || $from.marks();
    const existing = { ...(getTextStyleAttrsFromMarks(marks, type) || {}) };
    delete existing[key];
    const merged = normalizeTextStyleAttrs(existing);
    let tr = state.tr.removeStoredMark(type);
    if (merged) {
      tr = tr.addStoredMark(type.create(merged));
    }
    dispatch(tr);
    return true;
  }

  const marksAtFrom = state.doc.resolve(from).marks();
  const existing = { ...(getTextStyleAttrsFromMarks(marksAtFrom, type) || {}) };
  delete existing[key];
  const merged = normalizeTextStyleAttrs(existing);
  let tr = state.tr.removeMark(from, to, type);
  if (merged) {
    tr = tr.addMark(from, to, type.create(merged));
  }
  dispatch(tr.scrollIntoView());
  return true;
};

export const TextStyle = Mark.create({
  name: "textStyle",
  priority: 100,
  addCommands() {
    return {
      setTextColor: (color) => {
        const normalized = normalizeStyleColor(color);
        return normalized
          ? ({ commands }) => commands.setMark(this.name, { color: normalized })
          : clearTextStyleAttr("color", this.name);
      },
      setTextBackground: (background) => {
        const normalized = normalizeStyleColor(background);
        return normalized
          ? ({ commands }) => commands.setMark(this.name, { background: normalized })
          : clearTextStyleAttr("background", this.name);
      },
      setTextFontSize: (fontSize) => {
        const normalized = normalizeStyleFontSize(fontSize);
        return normalized
          ? ({ commands }) => commands.setMark(this.name, { fontSize: normalized })
          : clearTextStyleAttr("fontSize", this.name);
      },
      setTextFontFamily: (fontFamily) => {
        const normalized = normalizeStyleFontFamily(fontFamily);
        return normalized
          ? ({ commands }) => commands.setMark(this.name, { fontFamily: normalized })
          : clearTextStyleAttr("fontFamily", this.name);
      },
      clearTextColor: () => clearTextStyleAttr("color", this.name),
      clearTextBackground: () => clearTextStyleAttr("background", this.name),
      clearTextFontSize: () => clearTextStyleAttr("fontSize", this.name),
      clearTextFontFamily: () => clearTextStyleAttr("fontFamily", this.name),
    };
  },
  addMarkAdapter() {
    return getDefaultMarkRenderAdapter("textStyle");
  },
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