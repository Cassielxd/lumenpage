import { Node } from "lumenpage-core";
import { listNodeSpecs } from "lumenpage-extension-list-item";

export const orderedListNodeSpec = listNodeSpecs.orderedList;
export { defaultOrderedListRenderer as orderedListRenderer } from "lumenpage-render-engine";

export const OrderedList = Node.create({
  name: "orderedList",
  priority: 100,
  schema: orderedListNodeSpec,
});

export default OrderedList;
