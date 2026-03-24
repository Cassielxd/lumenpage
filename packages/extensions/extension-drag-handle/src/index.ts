import { Extension } from "lumenpage-core";

import { createDragHandlePlugin } from "./dragHandle";

export type DragHandleOptions = {
  schema?: any;
  nodeRegistry?: any;
  includeTypes?: string[];
  excludeTypes?: string[];
  onlyTopLevel?: boolean;
  size?: number;
  insetTop?: number;
  insetLeft?: number;
  dropCursor?: any;
};

export const DragHandleExtension = Extension.create<DragHandleOptions>({
  name: "drag-handle",
  priority: 50,
  addOptions() {
    return {};
  },
  addPlugins() {
    const editor = this.editor as { schema?: any; nodeRegistry?: any } | null;
    const schema = this.options.schema || this.schema || editor?.schema;
    const nodeRegistry = this.options.nodeRegistry || this.nodeRegistry || editor?.nodeRegistry;

    if (!schema) {
      throw new Error("drag-handle extension requires a resolved schema.");
    }
    if (!nodeRegistry) {
      throw new Error("drag-handle extension requires a resolved nodeRegistry.");
    }

    return [
      createDragHandlePlugin({
        ...this.options,
        schema,
        nodeRegistry,
      }),
    ];
  },
});

export const createDragHandleExtension = (options: DragHandleOptions) =>
  DragHandleExtension.configure(options);

export const DragHandle = DragHandleExtension;

export { createBlockDragHandleNodeViews, createDragHandlePlugin } from "./dragHandle";
