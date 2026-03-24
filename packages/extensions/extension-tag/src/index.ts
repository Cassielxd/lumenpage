import { Mark } from "lumenpage-core";

const DEFAULT_TAG_BACKGROUND = "#e0f2fe";
const DEFAULT_TAG_COLOR = "#0f4c81";
const DEFAULT_TAG_PREFIX = "#";

const normalizeString = (value: unknown) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
};

const normalizeColor = (value: unknown, fallback: string) => normalizeString(value) || fallback;

const normalizeTagLabel = (value: unknown) => {
  const text = normalizeString(value);
  if (!text) {
    return null;
  }
  const withoutHashes = text.replace(/^#+/, "").trim();
  return withoutHashes || null;
};

const buildTagText = (label: string, prefix: string | null) => {
  const resolvedPrefix = prefix == null ? DEFAULT_TAG_PREFIX : String(prefix);
  return `${resolvedPrefix}${label}`;
};

const createTagAttrs = (attrs: Record<string, unknown> | null | undefined) => {
  const label = normalizeTagLabel(attrs?.label);
  if (!label) {
    return null;
  }
  return {
    label,
    backgroundColor: normalizeColor(attrs?.backgroundColor, DEFAULT_TAG_BACKGROUND),
    textColor: normalizeColor(attrs?.textColor, DEFAULT_TAG_COLOR),
  };
};

const insertTagCommand =
  (attrs: Record<string, unknown> | null | undefined = {}) =>
  (state: any, dispatch?: (tr: any) => void) => {
    const type = state?.schema?.marks?.tag;
    if (!type) {
      return false;
    }

    const tagAttrs = createTagAttrs(attrs);
    if (!tagAttrs) {
      return false;
    }

    const prefix = normalizeString(attrs?.prefix) ?? DEFAULT_TAG_PREFIX;
    const text = buildTagText(tagAttrs.label, prefix);
    const from = state.selection?.from;
    const to = state.selection?.to;
    if (!Number.isFinite(from) || !Number.isFinite(to)) {
      return false;
    }

    if (!dispatch) {
      return true;
    }

    let tr = state.tr.insertText(text, from, to);
    tr = tr.addMark(from, from + text.length, type.create(tagAttrs));
    dispatch(tr.scrollIntoView());
    return true;
  };

export const Tag = Mark.create({
  name: "tag",
  priority: 110,
  inclusive: false,
  excludes: "tag",
  addCommands() {
    return {
      insertTag: (attrs?: Record<string, unknown>) => insertTagCommand(attrs),
    };
  },
  addMarkAdapter() {
    return (state, mark) => {
      const backgroundColor = normalizeColor(mark?.attrs?.backgroundColor, DEFAULT_TAG_BACKGROUND);
      const textColor = normalizeColor(mark?.attrs?.textColor, DEFAULT_TAG_COLOR);
      state.textBackground = backgroundColor;
      state.textColor = textColor;
      state.backgroundRadius = Math.max(state.backgroundRadius, 999);
      state.backgroundPaddingX = Math.max(state.backgroundPaddingX, 6);
    };
  },
  addMarkAnnotation() {
    return (mark) => {
      const attrs = createTagAttrs(mark?.attrs);
      if (!attrs) {
        return null;
      }
      return {
        name: "tag",
        key: `tag:${attrs.label}:${attrs.backgroundColor}:${attrs.textColor}`,
        group: "tag",
        inclusive: false,
        attrs,
        data: attrs,
      };
    };
  },
  addAttributes() {
    return {
      label: {
        default: null,
        parseHTML: (element) =>
          normalizeTagLabel(
            element?.getAttribute?.("data-tag-label") ||
              element?.getAttribute?.("data-label") ||
              element?.textContent
          ),
        renderHTML: (attrs) =>
          attrs.label ? { "data-tag-label": normalizeTagLabel(attrs.label) } : {},
      },
      backgroundColor: {
        default: DEFAULT_TAG_BACKGROUND,
        parseHTML: (element) =>
          normalizeColor(
            element?.getAttribute?.("data-tag-background") || element?.style?.backgroundColor,
            DEFAULT_TAG_BACKGROUND
          ),
        renderHTML: (attrs) => ({
          "data-tag-background": normalizeColor(attrs.backgroundColor, DEFAULT_TAG_BACKGROUND),
          style: `background-color:${normalizeColor(attrs.backgroundColor, DEFAULT_TAG_BACKGROUND)}`,
        }),
      },
      textColor: {
        default: DEFAULT_TAG_COLOR,
        parseHTML: (element) =>
          normalizeColor(
            element?.getAttribute?.("data-tag-color") || element?.style?.color,
            DEFAULT_TAG_COLOR
          ),
        renderHTML: (attrs) => ({
          "data-tag-color": normalizeColor(attrs.textColor, DEFAULT_TAG_COLOR),
          style: `color:${normalizeColor(attrs.textColor, DEFAULT_TAG_COLOR)}`,
        }),
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "span[data-type=tag]",
        getAttrs: (element) => (normalizeTagLabel(element?.textContent) ? {} : false),
      },
      {
        tag: "span[data-tag-label]",
        getAttrs: (element) =>
          normalizeTagLabel(element?.getAttribute?.("data-tag-label") || element?.textContent)
            ? {}
            : false,
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      {
        ...HTMLAttributes,
        "data-type": "tag",
      },
      0,
    ];
  },
});

export default Tag;
