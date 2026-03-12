import { Node } from "lumenpage-core";
import { listNodeSpecs } from "lumenpage-extension-list-item";

export const bulletListNodeSpec = listNodeSpecs.bulletList;
export { defaultBulletListRenderer as bulletListRenderer } from "lumenpage-render-engine";

export const BulletList = Node.create({
  name: "bulletList",
  priority: 100,
  schema: bulletListNodeSpec,
});

export default BulletList;
