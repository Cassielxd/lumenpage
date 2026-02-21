import { createHtmlParser } from "../htmlParser";

// HTML 解析入口：优先走插件覆写的 clipboardParser/domParser，再回退默认解析器。
export const createParseHtmlToSlice = ({
  resolveCanvasConfig,
  schema,
  PMDOMParser,
  queryEditorProp,
  getDomRoot,
}) => {
  const defaultParseHtmlToSlice =
    resolveCanvasConfig("parseHtmlToSlice") ??
    (schema
      ? createHtmlParser(schema, PMDOMParser)
      : () => {
          throw new Error("HTML parser is not configured.");
        });

  return (html) => {
    if (typeof html !== "string") {
      return defaultParseHtmlToSlice(html);
    }
    const ownerDocument = getDomRoot?.()?.ownerDocument || (typeof document !== "undefined" ? document : null);
    const ownerWindow = ownerDocument?.defaultView || (typeof window !== "undefined" ? window : null);
    if (!ownerWindow?.DOMParser) {
      return defaultParseHtmlToSlice(html);
    }
    const domParser = new ownerWindow.DOMParser();
    const doc = domParser.parseFromString(html, "text/html");
    const clipboardParser = queryEditorProp("clipboardParser");
    if (clipboardParser && typeof clipboardParser.parseSlice === "function") {
      return clipboardParser.parseSlice(doc.body);
    }
    const schemaDomParser = queryEditorProp("domParser");
    if (schemaDomParser && typeof schemaDomParser.parseSlice === "function") {
      return schemaDomParser.parseSlice(doc.body);
    }
    return defaultParseHtmlToSlice(html);
  };
};
