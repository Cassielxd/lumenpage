import { DOMParser as PMDOMParser } from "lumenpage-model";
import { sanitizeDocJson } from "lumenpage-link";

export type ContentParser = (content: string, schema: any) => any;

const isNodeContent = (content: any) =>
  !!content &&
  typeof content === "object" &&
  typeof content.toJSON === "function" &&
  Number.isFinite(content.nodeSize);

const isJsonContent = (content: any) =>
  !!content &&
  typeof content === "object" &&
  !Array.isArray(content) &&
  !isNodeContent(content);

const createEmptyDocument = (schema: any) => {
  const emptyDoc = schema?.topNodeType?.createAndFill?.();
  if (!emptyDoc) {
    throw new Error("Unable to create an empty document for the current schema.");
  }
  return emptyDoc;
};

export const createDocument = ({
  content,
  schema,
  parseContent,
}: {
  content?: any;
  schema: any;
  parseContent?: ContentParser | null;
}) => {
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
    if (parseContent) {
      return parseContent(content, schema);
    }
    const domParser = typeof window !== "undefined" ? window.DOMParser : null;
    if (!domParser) {
      throw new Error("String content requires DOMParser or editor.parseContent(content, schema).");
    }
    const parsed = new domParser().parseFromString(content, "text/html");
    return PMDOMParser.fromSchema(schema).parse(parsed.body);
  }

  if (isJsonContent(content)) {
    const normalized =
      sanitizeDocJson(content, {
        source: "core.createDocument",
      }) ?? content;
    return schema.nodeFromJSON(normalized);
  }

  throw new Error("Unsupported editor content. Expected a ProseMirror node, JSON, or string.");
};
