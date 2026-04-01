export type AnnotationTool = "pen" | "highlighter" | "line" | "rect" | "eraser";

export type AnnotationStrokeTool = Extract<AnnotationTool, "pen" | "highlighter">;

export type AnnotationNormalizedPoint = {
  x: number;
  y: number;
};

type AnnotationBase = {
  id: string;
  pageIndex: number;
  color: string;
  width: number;
  opacity: number;
  authorId: string | null;
  authorName: string | null;
  authorColor: string | null;
};

export type AnnotationStroke = AnnotationBase & {
  kind: "stroke";
  tool: AnnotationStrokeTool;
  points: AnnotationNormalizedPoint[];
};

export type AnnotationLine = AnnotationBase & {
  kind: "line";
  start: AnnotationNormalizedPoint;
  end: AnnotationNormalizedPoint;
};

export type AnnotationRect = AnnotationBase & {
  kind: "rect";
  start: AnnotationNormalizedPoint;
  end: AnnotationNormalizedPoint;
};

export type AnnotationItem = AnnotationStroke | AnnotationLine | AnnotationRect;
