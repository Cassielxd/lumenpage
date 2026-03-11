import { Node } from "lumenpage-core";
import { bulletListRenderer, listNodeSpecs } from "lumenpage-extension-list-item";

export const bulletListNodeSpec = listNodeSpecs.bulletList;
export { bulletListRenderer };

export const BulletList = Node.create({
  name: "bulletList",
  priority: 100,
  schema: bulletListNodeSpec,
  addLayout() {
    return {
      renderer: bulletListRenderer,
      pagination: bulletListRenderer?.pagination,
    };
  },
});

export default BulletList;
