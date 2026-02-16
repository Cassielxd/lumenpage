import { Mapping } from "lumenpage-transform";

export type DecorationUnderline = {
  color: string;
  style?: "solid" | "wavy";
};

export type DecorationSpec = {
  backgroundColor?: string;
  textColor?: string;
  underline?: DecorationUnderline;
  borderColor?: string;
  borderWidth?: number;
  render?: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
  side?: -1 | 1;
};

export type CanvasDecoration = {
  type: "inline" | "node" | "widget";
  from: number;
  to: number;
  spec: DecorationSpec;
};

export class Decoration {
  static inline(from: number, to: number, spec: DecorationSpec = {}): CanvasDecoration {
    return { type: "inline", from, to, spec };
  }

  static node(from: number, to: number, spec: DecorationSpec = {}): CanvasDecoration {
    return { type: "node", from, to, spec };
  }

  static widget(
    pos: number,
    render: (ctx: CanvasRenderingContext2D, x: number, y: number) => void,
    spec: DecorationSpec = {}
  ): CanvasDecoration {
    return {
      type: "widget",
      from: pos,
      to: pos,
      spec: { ...spec, render },
    };
  }
}

const mapDecoration = (decoration: CanvasDecoration, mapping: Mapping) => {
  if (!mapping) {
    return decoration;
  }

  if (decoration.type === "widget") {
    const assoc = decoration.spec?.side ?? 1;
    const mapped = mapping.mapResult(decoration.from, assoc);
    if (mapped.deleted) {
      return null;
    }
    return { ...decoration, from: mapped.pos, to: mapped.pos };
  }

  const mappedFrom = mapping.mapResult(decoration.from, 1);
  const mappedTo = mapping.mapResult(decoration.to, -1);

  if (mappedFrom.deleted && mappedTo.deleted) {
    return null;
  }

  const from = mappedFrom.pos;
  const to = Math.max(from, mappedTo.pos);

  return { ...decoration, from, to };
};

export class DecorationSet {
  decorations: CanvasDecoration[];

  constructor(decorations: CanvasDecoration[] = []) {
    this.decorations = decorations;
  }

  static create(_doc: unknown, decorations: CanvasDecoration[] = []) {
    return new DecorationSet(decorations);
  }

  map(mapping: Mapping) {
    if (!mapping) {
      return new DecorationSet(this.decorations);
    }

    const mapped = this.decorations
      .map((decoration) => mapDecoration(decoration, mapping))
      .filter(Boolean) as CanvasDecoration[];

    return new DecorationSet(mapped);
  }

  find(from?: number, to?: number) {
    const lower = from ?? -Infinity;
    const upper = to ?? Infinity;

    return this.decorations.filter((decoration) => decoration.from <= upper && decoration.to >= lower);
  }
}

export const normalizeDecorations = (
  decorations?: DecorationSet | CanvasDecoration[] | null
): CanvasDecoration[] => {
  if (!decorations) {
    return [];
  }
  if (decorations instanceof DecorationSet) {
    return decorations.decorations;
  }
  return Array.isArray(decorations) ? decorations : [];
};
