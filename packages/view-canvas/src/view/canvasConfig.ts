import { Plugin, PluginKey } from "lumenpage-state";

export type CanvasConfig = {
  settings?: any;
  elements?: any;
  applyDefaultStyles?: boolean;
  nodeRegistry?: any;
  commands?: any;
  getText?: (doc: any) => string;
  parseHtmlToSlice?: (html: string) => any;
  statusElement?: HTMLElement;
  collaboration?: any;
  remoteSelections?: any;
  debug?: { selection?: boolean; delete?: boolean };
  onChange?: (event: any) => void;
};

export const canvasConfigKey = new PluginKey("lumenpage-canvas-config");

export const createCanvasConfigPlugin = (config: CanvasConfig = {}) =>
  new Plugin({
    key: canvasConfigKey,
    state: {
      init: () => config,
      apply: (_tr, value) => value,
    },
  });

export const getCanvasConfig = (state: any): CanvasConfig | null =>
  canvasConfigKey.getState(state) ?? null;
