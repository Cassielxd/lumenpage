import { Node } from "lumenpage-core";
import { listNodeSpecs, orderedListRenderer } from "lumenpage-extension-list-item";

export const orderedListNodeSpec = listNodeSpecs.orderedList;
export { orderedListRenderer };

export const OrderedList = Node.create({
  name: "orderedList",
  priority: 100,
  schema: orderedListNodeSpec,
  addLayout() {
    return {
      renderer: orderedListRenderer,
      pagination: orderedListRenderer?.pagination,
    };
  },
});

export default OrderedList;
