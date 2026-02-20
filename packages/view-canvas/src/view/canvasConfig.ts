import { Plugin, PluginKey } from "lumenpage-state";
import type { LayoutWorkerConfig } from "./layoutWorkerClient";

export type CanvasConfig = {
  settings?: any;
  elements?: any;
  applyDefaultStyles?: boolean;
  nodeRegistry?: any;
  commands?: any;
  nodeSelectionTypes?: string[];
  layoutWorker?: LayoutWorkerConfig;
  getText?: (doc: any) => string;
  parseHtmlToSlice?: (html: string) => any;
  isInSpecialStructureAtPos?: (state: any, pos: number) => boolean;
  shouldAutoAdvanceAfterEnter?: (args: {
    prevState: any;
    nextState: any;
    prevHead: number;
  }) => boolean;
  statusElement?: HTMLElement;
  debug?: { selection?: boolean; delete?: boolean };
  onChange?: (event: any) => void;
};

export const canvasConfigKey = new PluginKey("lumenpage-canvas-config");

export const createCanvasConfigPlugin = (config: CanvasConfig = {}) =>
  {
    const legacyConfig = config as Record<string, any>;
    if ("collaboration" in legacyConfig || "remoteSelections" in legacyConfig) {
      throw new Error(
        "canvasConfig.collaboration/remoteSelections have been removed. Use createCollaborationPlugin() in plugins."
      );
    }
    return new Plugin({
      key: canvasConfigKey,
      state: {
        init: () => config,
        apply: (_tr, value) => value,
      },
    });
  };

export const getCanvasConfig = (state: any): CanvasConfig | null =>
  canvasConfigKey.getState(state) ?? null;
