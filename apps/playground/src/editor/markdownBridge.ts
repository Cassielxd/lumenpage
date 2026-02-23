export type MarkdownModule = {
  defaultMarkdownParser: { parse: (text: string) => any };
  defaultMarkdownSerializer: {
    serialize: (doc: any, options?: Record<string, unknown>) => string;
    nodes: Record<string, any>;
    marks: Record<string, any>;
  };
  MarkdownSerializer: new (
    nodes: Record<string, any>,
    marks: Record<string, any>,
    options?: Record<string, unknown>
  ) => { serialize: (doc: any, options?: Record<string, unknown>) => string };
};

let markdownModulePromise: Promise<MarkdownModule> | null = null;

export const loadMarkdownModule = async (): Promise<MarkdownModule> => {
  if (!markdownModulePromise) {
    markdownModulePromise = import("lumenpage-markdown") as Promise<MarkdownModule>;
  }
  return markdownModulePromise;
};
