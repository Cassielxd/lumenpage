import { Plugin, PluginKey } from "lumenpage-state";

export type LegacyPolicy = {
  // strict=true 时，legacy canvasConfig 策略入口会直接抛错，便于迁移期收敛。
  strict?: boolean;
};

export type CanvasViewConfig = {
  settings?: any;
  elements?: any;
  applyDefaultStyles?: boolean;
  nodeRegistry?: any;
  statusElement?: HTMLElement;
  debug?: {
    selection?: boolean;
    delete?: boolean;
    layout?: boolean;
    timing?: boolean;
    eventTiming?: boolean;
    paginationTiming?: boolean;
    renderTiming?: boolean;
  };
  tablePaginationPanelEl?: HTMLElement | null;
  paginationDebugBuilder?: any;
  tablePaginationDebugBuilder?: any;
  legacyPolicy?: LegacyPolicy;
};

export type CanvasConfig = CanvasViewConfig & {
  nodeSelectionTypes?: string[];
  getText?: (doc: any) => string;
  parseHtmlToSlice?: (html: string) => any;
  isInSpecialStructureAtPos?: (state: any, pos: number) => boolean;
  shouldAutoAdvanceAfterEnter?: (args: {
    prevState: any;
    nextState: any;
    prevHead: number;
  }) => boolean;
  onChange?: (event: any) => void;
};

export const canvasConfigKey = new PluginKey("lumenpage-canvas-config");

const LEGACY_STRATEGY_KEYS = [
  "getText",
  "parseHtmlToSlice",
  "isInSpecialStructureAtPos",
  "shouldAutoAdvanceAfterEnter",
  "onChange",
  "nodeSelectionTypes",
] as const;

export const createCanvasConfigPlugin = (config: CanvasConfig = {}) => {
  const legacyConfig = config as Record<string, any>;
  if ("collaboration" in legacyConfig || "remoteSelections" in legacyConfig) {
    throw new Error(
      "canvasConfig.collaboration/remoteSelections have been removed. Use a dedicated collaboration plugin package."
    );
  }
  if (legacyConfig?.legacyPolicy?.strict === true) {
    for (const key of LEGACY_STRATEGY_KEYS) {
      if (Object.prototype.hasOwnProperty.call(legacyConfig, key)) {
        throw new Error(
          `[canvas-config] "${key}" is not allowed in canvasConfig plugin when legacyPolicy.strict=true. Use EditorProps or plugin props instead.`
        );
      }
    }
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
