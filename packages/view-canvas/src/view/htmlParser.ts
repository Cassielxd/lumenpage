export const createHtmlParser = (schema, PMDOMParser) => {
  return (html) => {
    const parser = new window.DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    return PMDOMParser.fromSchema(schema).parseSlice(doc.body);
  };
};
