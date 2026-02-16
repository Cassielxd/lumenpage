import { createEditorState } from "../core";
import { canvasConfigKey, createCanvasConfigPlugin, type CanvasConfig } from "./canvasConfig";

type CanvasStateOptions = {
  schema?: any;
  createDocFromText?: (text: string) => any;
  text?: string;
  doc?: any;
  json?: any;
  plugins?: any[];
  historyPlugin?: any;
  ensureBlockIds?: boolean;
  canvasConfig?: CanvasConfig;
};

const hasCanvasConfigPlugin = (plugins: any[] = []) =>
  plugins.some((plugin) => plugin?.spec?.key === canvasConfigKey);

export const createCanvasState = (options: CanvasStateOptions = {}) => {
  const { plugins = [], canvasConfig, ...stateOptions } = options;
  const nextPlugins = plugins.slice();

  if (!hasCanvasConfigPlugin(nextPlugins)) {
    nextPlugins.push(createCanvasConfigPlugin(canvasConfig || {}));
  }

  return createEditorState({
    ...stateOptions,
    plugins: nextPlugins,
  });
};
