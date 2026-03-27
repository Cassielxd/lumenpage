import { DOMParser as PMDOMParser, type Node as PMNode, type Schema } from "lumenpage-model";
import { sanitizeDocJson } from "lumenpage-link";

export type EditorJSONMark = {
  type: string;
  attrs?: Record<string, unknown>;
  [key: string]: unknown;
};

export type EditorJSONContent = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: EditorJSONContent[];
  marks?: EditorJSONMark[];
  text?: string;
  [key: string]: unknown;
};

export type EditorContent = string | PMNode | EditorJSONContent | null;

const isNodeContent = (content: unknown): content is PMNode =>
  !!content &&
  typeof content === "object" &&
  typeof (content as { toJSON?: unknown }).toJSON === "function" &&
  Number.isFinite((content as { nodeSize?: unknown }).nodeSize);

const isJsonContent = (content: unknown): content is EditorJSONContent =>
  !!content &&
  typeof content === "object" &&
  !Array.isArray(content) &&
  !isNodeContent(content);

const createEmptyDocument = (schema: Schema): PMNode => {
  const emptyDoc = schema.topNodeType?.createAndFill?.();

  if (!emptyDoc) {
    throw new Error("Unable to create an empty document for the current schema.");
  }

  return emptyDoc;
};

export const createDocument = ({
  content,
  schema,
}: {
  content?: EditorContent;
  schema: Schema;
}): PMNode => {
  if (!schema) {
    throw new Error("schema is required to create a document.");
  }

  if (content == null || content === "") {
    return createEmptyDocument(schema);
  }

  if (isNodeContent(content)) {
    return content;
  }

  if (typeof content === "string") {
    const domParser = typeof window !== "undefined" ? window.DOMParser : null;

    if (!domParser) {
      throw new Error("String content requires DOMParser in the current runtime.");
    }

    const parsed = new domParser().parseFromString(content, "text/html");
    return PMDOMParser.fromSchema(schema).parse(parsed.body);
  }

  if (isJsonContent(content)) {
    const normalized =
      (sanitizeDocJson(content, {
        source: "core.createDocument",
      }) as EditorJSONContent | null) ?? content;

    return schema.nodeFromJSON(normalized);
  }

  throw new Error("Unsupported editor content. Expected a document node, JSON, or string.");
};
