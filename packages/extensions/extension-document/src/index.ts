import { Node } from "lumenpage-core";

export const Document = Node.create({
  name: "doc",
  priority: 1000,
  topNode: true,
  content: "block+",
});

export default Document;
