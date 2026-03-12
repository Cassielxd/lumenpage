import { textblockToRuns } from "../textRuns";

const readIdAttr = (dom: Element | null) => dom?.getAttribute?.("data-node-id") || null;

export const headingNodeSpec: any = {
  content: "inline*",
  group: "block",
  attrs: {
    id: { default: null },
    level: { default: 1 },
    align: { default: "left" },
    spacingBefore: { default: null },
    spacingAfter: { default: null },
  },
  parseDOM: [
    {
      tag: "h1",
      getAttrs: (dom: HTMLElement) => ({
        id: readIdAttr(dom),
        level: 1,
        align: dom.style.textAlign || "left",
        spacingBefore: Number.parseFloat(dom.style.marginTop || "") || null,
        spacingAfter: Number.parseFloat(dom.style.marginBottom || "") || null,
      }),
    },
    {
      tag: "h2",
      getAttrs: (dom: HTMLElement) => ({
        id: readIdAttr(dom),
        level: 2,
        align: dom.style.textAlign || "left",
        spacingBefore: Number.parseFloat(dom.style.marginTop || "") || null,
        spacingAfter: Number.parseFloat(dom.style.marginBottom || "") || null,
      }),
    },
    {
      tag: "h3",
      getAttrs: (dom: HTMLElement) => ({
        id: readIdAttr(dom),
        level: 3,
        align: dom.style.textAlign || "left",
        spacingBefore: Number.parseFloat(dom.style.marginTop || "") || null,
        spacingAfter: Number.parseFloat(dom.style.marginBottom || "") || null,
      }),
    },
  ],
  toDOM(node) {
    const level = Math.max(1, Math.min(3, Number(node.attrs?.level) || 1));
    const styles: string[] = [];
    if (node.attrs?.align && node.attrs.align !== "left") {
      styles.push(`text-align:${node.attrs.align}`);
    }
    if (Number.isFinite(node.attrs?.spacingBefore)) {
      styles.push(`margin-top:${node.attrs.spacingBefore}px`);
    }
    if (Number.isFinite(node.attrs?.spacingAfter)) {
      styles.push(`margin-bottom:${node.attrs.spacingAfter}px`);
    }
    const attrs: Record<string, unknown> = styles.length > 0 ? { style: styles.join(";") } : {};
    if (node.attrs?.id) {
      attrs["data-node-id"] = node.attrs.id;
    }
    return [`h${level}`, attrs, 0];
  },
};

const getHeadingStyle = (level: number, baseFont: string) => {
  const match = /(\d+(?:\.\d+)?)px\s+(.*)/.exec(baseFont);
  const baseSize = match ? Number.parseFloat(match[1]) : 16;
  const family = match ? match[2] : "Arial";
  const scale = level === 1 ? 1.6 : level === 2 ? 1.35 : 1.2;
  const size = Math.max(12, Math.round(baseSize * scale));
  return {
    font: `bold ${size}px ${family}`,
    lineHeight: Math.max(size + 8, size * 1.2),
  };
};

export const headingRenderer = {
  allowSplit: true,
  toRuns(node: any, settings: any, registry: any) {
    const level = Math.max(1, Math.min(3, Number(node.attrs?.level) || 1));
    const { font, lineHeight } = getHeadingStyle(level, settings.font);
    const runs = textblockToRuns(
      node,
      { ...settings, font },
      node.type.name,
      node.attrs?.id ?? null,
      node.attrs,
      0,
      registry
    );
    return { ...runs, blockAttrs: { ...node.attrs, lineHeight } };
  },
  renderLine({ defaultRender, line, pageX, pageTop, layout }: any) {
    defaultRender(line, pageX, pageTop, layout);
  },
};
