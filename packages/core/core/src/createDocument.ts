import { DOMParser as PMDOMParser } from "lumenpage-model";
import { sanitizeDocJson } from "lumenpage-link";

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
}: {
  content?: any;
  schema: any;
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
    const domParser = typeof window !== "undefined" ? window.DOMParser : null;
    if (!domParser) {
      throw new Error("String content requires DOMParser in the current runtime.");
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

  throw new Error("Unsupported editor content. Expected a document node, JSON, or string.");
};
