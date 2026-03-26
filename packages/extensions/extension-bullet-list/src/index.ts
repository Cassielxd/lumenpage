import { Node } from "lumenpage-core";
import { createToggleListCommand, listNodeSpecs } from "lumenpage-extension-list-item";

type BulletListCommands<ReturnType> = {
  toggleBulletList: () => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    bulletList: BulletListCommands<ReturnType>;
  }
}

export const bulletListNodeSpec = listNodeSpecs.bulletList;
export { defaultBulletListRenderer as bulletListRenderer } from "lumenpage-render-engine";

export const BulletList = Node.create({
  name: "bulletList",
  priority: 100,
  schema: bulletListNodeSpec,
  addCommands() {
    return {
      toggleBulletList: () => createToggleListCommand(this.name),
    };
  },
});

export default BulletList;