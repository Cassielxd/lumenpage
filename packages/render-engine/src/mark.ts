export type MarkStyleValue =
  | string
  | number
  | boolean
  | null
  | MarkStyleValue[]
  | { [key: string]: MarkStyleValue };

export type MarkAnnotation = {
  name: string;
  attrs: Record<string, any> | null;
  key: string;
  rank: number;
  sourceIndex: number;
  group: string | null;
  inclusive: boolean | null;
  excludes: string | null;
  spanning: boolean | null;
  data: MarkStyleValue | null;
};

export type MarkAnnotationResolver = (
  mark: any,
  ctx: MarkAdapterContext
) => MarkAnnotation | Partial<MarkAnnotation> | null | undefined;

export type MarkDrawPhase = "beforeBackground" | "afterBackground" | "beforeText" | "afterText";

export type MarkDrawInstruction = {
  key: string;
  phase?: MarkDrawPhase;
  data?: MarkStyleValue;
  draw: (ctx: MarkDrawContext) => void;
};

export type MarkStyleState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  underlineStyle: "solid" | "wavy";
  underlineColor: string | null;
  strike: boolean;
  strikeColor: string | null;
  code: boolean;
  isLink: boolean;
  linkHref: string | null;
  subscript: boolean;
  superscript: boolean;
  textColor: string | null;
  textBackground: string | null;
  textFontSize: number | null;
  textFontFamily: string | null;
  backgroundRadius: number;
  backgroundPaddingX: number;
  extras: Record<string, MarkStyleValue>;
  drawInstructions: MarkDrawInstruction[];
};

export type MarkAdapterContext = {
  baseFont: string;
  settings: any;
  marks: any[];
  markIndex: number;
  annotation?: MarkAnnotation | null;
  annotations?: MarkAnnotation[];
};

export type MarkDrawContext = {
  ctx: CanvasRenderingContext2D;
  run: any;
  line: any;
  pageX: number;
  pageTop: number;
  layout: any;
  x: number;
  y: number;
  width: number;
  lineHeight: number;
  textY: number;
  font: string;
  fontSize: number;
  color: string;
  phase: MarkDrawPhase;
  data: MarkStyleValue | undefined;
};

export type MarkRenderAdapter = (state: MarkStyleState, mark: any, ctx: MarkAdapterContext) => void;

const DEFAULT_CODE_FONT =
  '13px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

const parseBaseFontSpec = (fontSpec: string) => {
  const value = String(fontSpec || "").trim();
  const match = /(\d+(?:\.\d+)?)px\s+(.+)/.exec(value);
  if (!match) {
    return { size: 16, family: "Arial" };
  }
  const size = Number.parseFloat(match[1]);
  const family = String(match[2] || "").trim();
  return {
    size: Number.isFinite(size) && size > 0 ? size : 16,
    family: family || "Arial",
  };
};

const normalizeCssColor = (value: unknown) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
};

const normalizeFontFamily = (value: unknown) => {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    return null;
  }
  return text.replace(/[{};]/g, "").trim() || null;
};

const normalizeFontSize = (value: unknown) => {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) {
    return null;
  }
  return Math.round(size);
};

const normalizeMarkDrawPhase = (phase: unknown): MarkDrawPhase => {
  switch (phase) {
    case "beforeBackground":
    case "afterBackground":
    case "beforeText":
    case "afterText":
      return phase;
    default:
      return "afterText";
  }
};

const normalizeMarkAttrs = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return { ...(value as Record<string, any>) };
};

const normalizeMarkAnnotationString = (value: unknown) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
};

const normalizeMarkAnnotation = (
  mark: any,
  ctx: MarkAdapterContext,
  annotation: MarkAnnotation | Partial<MarkAnnotation> | null | undefined
): MarkAnnotation | null => {
  const name = String(annotation?.name || mark?.type?.name || "").trim();
  if (!name) {
    return null;
  }
  const sourceIndex = Number.isFinite(annotation?.sourceIndex)
    ? Number(annotation?.sourceIndex)
    : ctx.markIndex;
  const attrs = normalizeMarkAttrs(annotation?.attrs ?? mark?.attrs);
  const typeSpec = mark?.type?.spec;
  const data = (annotation?.data ?? null) as MarkStyleValue | null;
  const key =
    normalizeMarkAnnotationString(annotation?.key) ||
    `${name}:${serializeMarkStyleValue({
      attrs: (attrs || null) as unknown as MarkStyleValue,
      data,
    })}`;

  return {
    name,
    attrs,
    key,
    rank: Number.isFinite(annotation?.rank) ? Number(annotation?.rank) : sourceIndex,
    sourceIndex,
    group:
      normalizeMarkAnnotationString(annotation?.group) ||
      normalizeMarkAnnotationString(typeSpec?.group),
    inclusive:
      typeof annotation?.inclusive === "boolean"
        ? annotation.inclusive
        : typeof typeSpec?.inclusive === "boolean"
        ? typeSpec.inclusive
        : null,
    excludes:
      normalizeMarkAnnotationString(annotation?.excludes) ||
      normalizeMarkAnnotationString(typeSpec?.excludes),
    spanning:
      typeof annotation?.spanning === "boolean"
        ? annotation.spanning
        : typeof typeSpec?.spanning === "boolean"
        ? typeSpec.spanning
        : null,
    data,
  };
};

const serializeMarkStyleValue = (
  value: MarkStyleValue | undefined,
  seen: WeakSet<object> = new WeakSet()
): string => {
  if (value == null) {
    return "null";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => serializeMarkStyleValue(entry, seen)).join(",")}]`;
  }
  if (typeof value === "object") {
    if (seen.has(value)) {
      return '"[Circular]"';
    }
    seen.add(value);
    const keys = Object.keys(value).sort();
    const serialized = `{${keys
      .map((key) => `${JSON.stringify(key)}:${serializeMarkStyleValue(value[key], seen)}`)
      .join(",")}}`;
    seen.delete(value);
    return serialized;
  }
  return "null";
};

const getMarkDrawInstructionsKey = (instructions: MarkDrawInstruction[] | null | undefined) =>
  serializeMarkStyleValue(
    Array.isArray(instructions)
      ? instructions.map((instruction) => ({
          key: String(instruction?.key || "").trim(),
          phase: normalizeMarkDrawPhase(instruction?.phase),
          data: (instruction?.data ?? null) as MarkStyleValue,
        }))
      : null
  );

export const getMarkAnnotationsKey = (annotations: MarkAnnotation[] | null | undefined) =>
  serializeMarkStyleValue(
    Array.isArray(annotations)
      ? annotations.map((annotation) => ({
          name: String(annotation?.name || "").trim(),
          key: String(annotation?.key || "").trim(),
          rank: Number.isFinite(annotation?.rank) ? Number(annotation.rank) : 0,
          sourceIndex: Number.isFinite(annotation?.sourceIndex) ? Number(annotation.sourceIndex) : 0,
          group: annotation?.group || null,
          inclusive: typeof annotation?.inclusive === "boolean" ? annotation.inclusive : null,
          excludes: annotation?.excludes || null,
          spanning: typeof annotation?.spanning === "boolean" ? annotation.spanning : null,
          attrs: (annotation?.attrs || null) as unknown as MarkStyleValue,
          data: (annotation?.data ?? null) as MarkStyleValue,
        }))
      : null
  );

const parseTextDecoration = (state: MarkStyleState, attrs: Record<string, any>) => {
  const value = `${attrs.textDecoration || ""} ${attrs.textDecorationLine || ""}`
    .trim()
    .toLowerCase();
  if (!value) {
    return;
  }
  const tokens = value.split(/\s+/).filter(Boolean);
  if (tokens.includes("underline")) {
    state.underline = true;
  }
  if (tokens.includes("line-through")) {
    state.strike = true;
  }
  const style = String(attrs.textDecorationStyle || attrs.underlineStyle || "")
    .trim()
    .toLowerCase();
  if (style === "wavy") {
    state.underlineStyle = "wavy";
  }
  const decorationColor = normalizeCssColor(
    attrs.textDecorationColor || attrs.underlineColor || attrs.strikeColor
  );
  if (decorationColor) {
    if (state.underline) {
      state.underlineColor = decorationColor;
    }
    if (state.strike) {
      state.strikeColor = decorationColor;
    }
  }
};

const boldAdapter: MarkRenderAdapter = (state) => {
  state.bold = true;
};

const italicAdapter: MarkRenderAdapter = (state) => {
  state.italic = true;
};

const underlineAdapter: MarkRenderAdapter = (state, mark) => {
  state.underline = true;
  const style = String(mark?.attrs?.style || mark?.attrs?.underlineStyle || "")
    .trim()
    .toLowerCase();
  if (style === "wavy") {
    state.underlineStyle = "wavy";
  }
  state.underlineColor =
    normalizeCssColor(mark?.attrs?.color || mark?.attrs?.underlineColor) ?? state.underlineColor;
};

const strikeAdapter: MarkRenderAdapter = (state, mark) => {
  state.strike = true;
  state.strikeColor =
    normalizeCssColor(mark?.attrs?.color || mark?.attrs?.strikeColor) ?? state.strikeColor;
};

const codeAdapter: MarkRenderAdapter = (state, _mark, ctx) => {
  state.code = true;
  const radius = Number(ctx.settings?.codeMarkRadius);
  if (Number.isFinite(radius) && radius >= 0) {
    state.backgroundRadius = radius;
  } else {
    state.backgroundRadius = Math.max(state.backgroundRadius, 4);
  }
  const paddingX = Number(ctx.settings?.codeMarkPaddingX);
  if (Number.isFinite(paddingX) && paddingX >= 0) {
    state.backgroundPaddingX = paddingX;
  } else {
    state.backgroundPaddingX = Math.max(state.backgroundPaddingX, 2);
  }
};

const subscriptAdapter: MarkRenderAdapter = (state) => {
  state.subscript = true;
  state.superscript = false;
};

const superscriptAdapter: MarkRenderAdapter = (state) => {
  state.superscript = true;
  state.subscript = false;
};

const linkAdapter: MarkRenderAdapter = (state, mark, ctx) => {
  state.isLink = true;
  state.linkHref =
    (typeof mark?.attrs?.href === "string" && mark.attrs.href.trim()) || state.linkHref || null;
  state.underline = true;
  const underlineStyle = String(ctx.settings?.linkUnderlineStyle || "")
    .trim()
    .toLowerCase();
  if (underlineStyle === "wavy") {
    state.underlineStyle = "wavy";
  }
  state.underlineColor =
    normalizeCssColor(mark?.attrs?.color || ctx.settings?.linkUnderlineColor) ?? state.underlineColor;
};

const textStyleAdapter: MarkRenderAdapter = (state, mark) => {
  const attrs = mark?.attrs;
  if (!attrs || typeof attrs !== "object") {
    return;
  }

  state.textColor = normalizeCssColor(attrs.color) ?? state.textColor;
  state.textBackground =
    normalizeCssColor(attrs.background || attrs.backgroundColor) ?? state.textBackground;
  state.textFontSize =
    normalizeFontSize(attrs.fontSize || attrs.size || attrs.textSize) ?? state.textFontSize;
  state.textFontFamily =
    normalizeFontFamily(attrs.fontFamily || attrs.family) ?? state.textFontFamily;

  const fontWeight = String(attrs.fontWeight || "").trim().toLowerCase();
  if (fontWeight === "bold" || Number(fontWeight) >= 600) {
    state.bold = true;
  }

  const fontStyle = String(attrs.fontStyle || "").trim().toLowerCase();
  if (fontStyle === "italic" || fontStyle === "oblique") {
    state.italic = true;
  }

  const verticalAlign = String(attrs.verticalAlign || "").trim().toLowerCase();
  if (verticalAlign === "sub") {
    state.subscript = true;
    state.superscript = false;
  } else if (verticalAlign === "super") {
    state.superscript = true;
    state.subscript = false;
  }

  parseTextDecoration(state, attrs);
};

const highlightAdapter: MarkRenderAdapter = (state, mark, ctx) => {
  state.textBackground =
    normalizeCssColor(mark?.attrs?.color || mark?.attrs?.background) ||
    state.textBackground ||
    ctx.settings?.highlightColor ||
    "#fef08a";
};

const defaultMarkAdapters = new Map<string, MarkRenderAdapter>([
  ["bold", boldAdapter],
  ["strong", boldAdapter],
  ["italic", italicAdapter],
  ["em", italicAdapter],
  ["underline", underlineAdapter],
  ["u", underlineAdapter],
  ["strike", strikeAdapter],
  ["s", strikeAdapter],
  ["del", strikeAdapter],
  ["code", codeAdapter],
  ["subscript", subscriptAdapter],
  ["sub", subscriptAdapter],
  ["superscript", superscriptAdapter],
  ["sup", superscriptAdapter],
  ["link", linkAdapter],
  ["textStyle", textStyleAdapter],
  ["highlight", highlightAdapter],
  ["mark", highlightAdapter],
]);

const createBaseState = (): MarkStyleState => ({
  bold: false,
  italic: false,
  underline: false,
  underlineStyle: "solid",
  underlineColor: null,
  strike: false,
  strikeColor: null,
  code: false,
  isLink: false,
  linkHref: null,
  subscript: false,
  superscript: false,
  textColor: null,
  textBackground: null,
  textFontSize: null,
  textFontFamily: null,
  backgroundRadius: 0,
  backgroundPaddingX: 2,
  extras: {},
  drawInstructions: [],
});

export const getDefaultMarkRenderAdapter = (name: string) =>
  defaultMarkAdapters.get(name) || null;

export const composeMarkRenderAdapters =
  (...adapters: Array<MarkRenderAdapter | null | undefined>): MarkRenderAdapter =>
  (state, mark, ctx) => {
    for (const adapter of adapters) {
      if (typeof adapter === "function") {
        adapter(state, mark, ctx);
      }
    }
  };

export const setMarkStyleExtra = (
  state: MarkStyleState,
  key: string,
  value: MarkStyleValue | undefined
) => {
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) {
    return;
  }
  if (value === undefined) {
    delete state.extras[normalizedKey];
    return;
  }
  state.extras[normalizedKey] = value;
};

export const addMarkDrawInstruction = (
  state: MarkStyleState,
  instruction: MarkDrawInstruction | null | undefined
) => {
  if (!instruction || typeof instruction.draw !== "function") {
    return;
  }
  const key = String(instruction.key || "").trim();
  if (!key) {
    return;
  }
  const phase = normalizeMarkDrawPhase(instruction.phase);
  const nextInstruction: MarkDrawInstruction = {
    ...instruction,
    key,
    phase,
  };
  const existingIndex = state.drawInstructions.findIndex(
    (entry) => entry.key === key && normalizeMarkDrawPhase(entry.phase) === phase
  );
  if (existingIndex >= 0) {
    state.drawInstructions[existingIndex] = nextInstruction;
    return;
  }
  state.drawInstructions.push(nextInstruction);
};

export const getMarkRenderAdapter = (
  name: string,
  resolveCustomAdapter?: ((name: string) => MarkRenderAdapter | undefined | null) | null
) => resolveCustomAdapter?.(name) || getDefaultMarkRenderAdapter(name);

export const resolveMarkAnnotations = (
  baseFont: string,
  marks: any[],
  settings: any = null,
  resolveCustomAnnotation:
    | ((name: string) => MarkAnnotationResolver | undefined | null)
    | null = null
) => {
  if (!marks?.length) {
    return [];
  }

  const annotations: MarkAnnotation[] = [];

  for (let index = 0; index < marks.length; index += 1) {
    const mark = marks[index];
    const name = String(mark?.type?.name || "").trim();
    if (!name) {
      continue;
    }

    const ctx: MarkAdapterContext = {
      baseFont,
      settings,
      marks,
      markIndex: index,
      annotation: null,
      annotations,
    };
    const customResolver = resolveCustomAnnotation?.(name) || null;
    const resolved =
      customResolver != null ? customResolver(mark, ctx) : ({ name } as Partial<MarkAnnotation>);
    const annotation = normalizeMarkAnnotation(
      mark,
      ctx,
      resolved === undefined ? ({ name } as Partial<MarkAnnotation>) : resolved
    );
    if (annotation) {
      annotations.push(annotation);
    }
  }

  annotations.sort((left, right) => {
    const rankDiff = left.rank - right.rank;
    if (rankDiff !== 0) {
      return rankDiff;
    }
    return left.sourceIndex - right.sourceIndex;
  });

  return annotations;
};

export const getTextStyleKey = (style: any) =>
  [
    style.font || "",
    style.color || "",
    style.underline ? 1 : 0,
    style.underlineStyle || "",
    style.underlineColor || "",
    style.strike ? 1 : 0,
    style.strikeColor || "",
    style.background || "",
    Number.isFinite(style.backgroundRadius) ? style.backgroundRadius : 0,
    Number.isFinite(style.backgroundPaddingX) ? style.backgroundPaddingX : 0,
    Number.isFinite(style.shiftY) ? style.shiftY : 0,
    style.linkHref || "",
    style.annotationKey || getMarkAnnotationsKey(style.annotations),
    serializeMarkStyleValue((style.extras || null) as MarkStyleValue),
    getMarkDrawInstructionsKey(style.drawInstructions),
  ].join("|");

export const resolveTextStyle = (
  baseFont: string,
  marks: any[],
  settings: any = null,
  resolveCustomAdapter: ((name: string) => MarkRenderAdapter | undefined | null) | null = null,
  resolveCustomAnnotation:
    | ((name: string) => MarkAnnotationResolver | undefined | null)
    | null = null
) => {
  const state = createBaseState();
  const annotations = resolveMarkAnnotations(baseFont, marks, settings, resolveCustomAnnotation);
  const annotationsBySourceIndex = new Map(
    annotations.map((annotation) => [annotation.sourceIndex, annotation] as const)
  );

  if (marks && marks.length) {
    for (let index = 0; index < marks.length; index += 1) {
      const mark = marks[index];
      const name = String(mark?.type?.name || "").trim();
      if (!name) {
        continue;
      }
      const adapter = getMarkRenderAdapter(name, resolveCustomAdapter);
      if (adapter) {
        adapter(state, mark, {
          baseFont,
          settings,
          marks,
          markIndex: index,
          annotation: annotationsBySourceIndex.get(index) || null,
          annotations,
        });
      }
    }
  }

  const resolvedBaseFont = state.code ? settings?.codeFont || DEFAULT_CODE_FONT : baseFont;
  const parsedBaseFont = parseBaseFontSpec(resolvedBaseFont);
  const prefix = `${state.italic ? "italic " : ""}${state.bold ? "bold " : ""}`;
  const scriptScale = state.subscript || state.superscript ? 0.72 : 1;
  const fontSize = Math.max(
    1,
    Math.round((state.textFontSize || parsedBaseFont.size) * scriptScale)
  );
  const fontFamily = state.textFontFamily || parsedBaseFont.family;
  const font = `${prefix}${fontSize}px ${fontFamily}`.trim();

  const shiftY = state.superscript
    ? -Math.round(fontSize * 0.35)
    : state.subscript
    ? Math.round(fontSize * 0.2)
    : 0;

  const color = state.textColor || (state.isLink ? settings?.linkColor || "#2563eb" : "#111827");
  const background =
    state.textBackground || (state.code ? settings?.codeBackground || "#f3f4f6" : null);
  const underlineColor = state.underline
    ? state.underlineColor || (state.isLink ? settings?.linkUnderlineColor || color : color)
    : null;
  const strikeColor = state.strike ? state.strikeColor || color : null;
  const annotationKey = annotations.length > 0 ? getMarkAnnotationsKey(annotations) : null;
  const extras = Object.keys(state.extras).length > 0 ? { ...state.extras } : null;
  const drawInstructions =
    state.drawInstructions.length > 0 ? state.drawInstructions.slice() : null;

  return {
    font,
    color,
    underline: state.underline,
    underlineStyle: state.underline ? state.underlineStyle : "solid",
    underlineColor,
    strike: state.strike,
    strikeColor,
    background,
    backgroundRadius: background ? state.backgroundRadius : 0,
    backgroundPaddingX: background ? state.backgroundPaddingX : 0,
    shiftY,
    linkHref: state.linkHref,
    annotationKey,
    annotations: annotations.length > 0 ? annotations.slice() : null,
    extras,
    drawInstructions,
  };
};

const drawRoundedRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  const clampedRadius = Math.min(Math.max(radius, 0), width / 2, height / 2);
  if (clampedRadius > 0 && typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, clampedRadius);
    return;
  }

  if (clampedRadius > 0) {
    ctx.beginPath();
    ctx.moveTo(x + clampedRadius, y);
    ctx.arcTo(x + width, y, x + width, y + height, clampedRadius);
    ctx.arcTo(x + width, y + height, x, y + height, clampedRadius);
    ctx.arcTo(x, y + height, x, y, clampedRadius);
    ctx.arcTo(x, y, x + width, y, clampedRadius);
    ctx.closePath();
    return;
  }

  ctx.beginPath();
  ctx.rect(x, y, width, height);
};

export const drawWavyLine = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number
) => {
  if (!Number.isFinite(width) || width <= 0) {
    return;
  }
  const amplitude = 1.5;
  const wavelength = 4;
  const endX = x + width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let px = x; px <= endX; px += 1) {
    const phase = ((px - x) / wavelength) * Math.PI * 2;
    ctx.lineTo(px, y + Math.sin(phase) * amplitude);
  }
  ctx.stroke();
};

export const drawRunBackground = (
  ctx: CanvasRenderingContext2D,
  run: any,
  x: number,
  y: number,
  width: number,
  lineHeight: number
) => {
  const background = run?.background;
  if (!background) {
    return;
  }

  const paddingX = Number.isFinite(run?.backgroundPaddingX) ? Number(run.backgroundPaddingX) : 2;
  const radius = Number.isFinite(run?.backgroundRadius) ? Number(run.backgroundRadius) : 0;
  ctx.fillStyle = background;
  if (radius > 0) {
    drawRoundedRectPath(ctx, x - paddingX, y, width + paddingX * 2, lineHeight, radius);
    ctx.fill();
    return;
  }
  ctx.fillRect(x - paddingX, y, width + paddingX * 2, lineHeight);
};

export const drawRunUnderline = (
  ctx: CanvasRenderingContext2D,
  run: any,
  x: number,
  textY: number,
  width: number,
  fontSize: number
) => {
  if (!run?.underline || !run?.text || width <= 0) {
    return;
  }
  const underlineY = textY + fontSize - 2;
  ctx.strokeStyle = run.underlineColor || run.color || "#111827";
  ctx.lineWidth = 1;

  if (run.underlineStyle === "wavy") {
    drawWavyLine(ctx, x, underlineY, width);
    return;
  }

  ctx.beginPath();
  ctx.moveTo(x, underlineY);
  ctx.lineTo(x + width, underlineY);
  ctx.stroke();
};

export const drawRunStrike = (
  ctx: CanvasRenderingContext2D,
  run: any,
  x: number,
  textY: number,
  width: number,
  fontSize: number
) => {
  if (!run?.strike || !run?.text || width <= 0) {
    return;
  }
  const strikeY = textY + fontSize * 0.6;
  ctx.strokeStyle = run.strikeColor || run.color || "#111827";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, strikeY);
  ctx.lineTo(x + width, strikeY);
  ctx.stroke();
};

export const drawRunMarkInstructions = (
  run: any,
  phase: MarkDrawPhase,
  drawContext: Omit<MarkDrawContext, "phase" | "data">
) => {
  const instructions = Array.isArray(run?.drawInstructions) ? run.drawInstructions : null;
  if (!instructions?.length) {
    return;
  }
  const normalizedPhase = normalizeMarkDrawPhase(phase);
  for (const instruction of instructions) {
    if (!instruction || typeof instruction.draw !== "function") {
      continue;
    }
    if (normalizeMarkDrawPhase(instruction.phase) !== normalizedPhase) {
      continue;
    }
    instruction.draw({
      ...drawContext,
      phase: normalizedPhase,
      data: instruction.data,
    });
  }
};
