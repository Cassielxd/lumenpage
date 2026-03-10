import { LumenExtension } from "lumenpage-core";
import { createBlockIdPlugin, createBlockIdTransaction } from "lumenpage-view-canvas";

export const createLumenBlockIdExtension = () =>
  LumenExtension.create({
    name: "block-id",
    priority: 950,
    addPlugins: () => [createBlockIdPlugin()],
    addStateTransforms: () => [
      (state: any) => {
        const tr = createBlockIdTransaction(state);
        return tr ? state.apply(tr) : state;
      },
    ],
  });
