import { createEditorState } from "../core";

type CanvasStateOptions = {
  schema?: any;
  createDocFromText?: (text: string) => any;
  text?: string;
  doc?: any;
  json?: any;
  plugins?: any[];
};

export const createCanvasState = (options: CanvasStateOptions = {}) => {
  const legacyOptions = options as Record<string, any>;
  if ("canvasConfig" in legacyOptions) {
    throw new Error(
      "canvasConfig option has been removed. Pass createCanvasConfigPlugin(canvasConfig) in plugins."
    );
  }
  if ("historyPlugin" in legacyOptions || "ensureBlockIds" in legacyOptions) {
    throw new Error(
      "historyPlugin/ensureBlockIds options have been removed. Pass explicit plugins instead."
    );
  }

  const { plugins = [], ...stateOptions } = options;

  return createEditorState({
    ...stateOptions,
    plugins,
  });
};
