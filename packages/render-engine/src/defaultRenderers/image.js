const resolvePositiveDimension = (value) => {
    if (value == null) {
        return null;
    }
    if (typeof value === "string" && value.trim() === "") {
        return null;
    }
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : null;
};
export const imageRenderer = {
    allowSplit: false,
    layoutBlock({ node, settings }) {
        const attrs = node.attrs || {};
        const maxWidth = settings.pageWidth - settings.margin.left - settings.margin.right;
        const desiredWidth = resolvePositiveDimension(attrs.width) ?? Math.min(320, maxWidth);
        const width = Math.max(1, Math.min(maxWidth, desiredWidth));
        const desiredHeight = resolvePositiveDimension(attrs.height) ?? Math.round(width * 0.75);
        const height = Math.max(1, desiredHeight);
        const line = {
            text: "",
            start: 0,
            end: 1,
            width,
            lineHeight: height,
            runs: [],
            x: settings.margin.left,
            blockType: "image",
            blockAttrs: { lineHeight: height, width, height },
            imageMeta: { src: String(attrs.src || ""), alt: attrs.alt || "", width, height },
        };
        return {
            lines: [line],
            length: 1,
            height,
            blockLineHeight: height,
            blockType: "image",
            blockAttrs: { width, height, lineHeight: height },
        };
    },
    renderLine({ ctx, line, pageX, pageTop, layout }) {
        const meta = line.imageMeta;
        if (!meta)
            return;
        const x = pageX + line.x;
        const y = pageTop + line.y;
        const width = meta.width;
        const height = meta.height;
        if (ctx.fillRect) {
            ctx.fillStyle = "#f3f4f6";
            ctx.fillRect(x, y, width, height);
        }
        if (ctx.strokeRect) {
            ctx.strokeStyle = "#9ca3af";
            ctx.strokeRect(x, y, width, height);
        }
        if (ctx.fillText) {
            const match = /(\d+(?:\.\d+)?)px/.exec(layout.font || "");
            const fontSize = match ? Number.parseFloat(match[1]) : 16;
            const lineHeight = Number.isFinite(line.lineHeight) ? line.lineHeight : layout.lineHeight;
            const baselineOffset = Math.max(0, (lineHeight - fontSize) / 2);
            const label = meta.alt || "Image";
            ctx.fillStyle = "#6b7280";
            ctx.font = layout.font;
            ctx.fillText(label, x + 12, y + baselineOffset + 12);
        }
    },
};
