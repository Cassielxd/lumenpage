import { LumenExtension } from "lumenpage-core";

import { createDragHandlePlugin } from "./dragHandle";

type LumenDragHandleExtensionOptions = {
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

export const createLumenDragHandleExtension = (options: LumenDragHandleExtensionOptions) =>
  LumenExtension.create({
    name: "drag-handle",
    priority: 50,
    addPlugins: (ctx) => {
      const editor = ctx.editor as { schema?: any; nodeRegistry?: any } | null;
      const schema = options.schema || editor?.schema;
      const nodeRegistry = options.nodeRegistry || editor?.nodeRegistry;

      if (!schema) {
        throw new Error("drag-handle extension requires editor.schema or options.schema.");
      }
      if (!nodeRegistry) {
        throw new Error("drag-handle extension requires editor.nodeRegistry or options.nodeRegistry.");
      }

      return [
        createDragHandlePlugin({
          ...options,
          schema,
          nodeRegistry,
        }),
      ];
    },
  });

