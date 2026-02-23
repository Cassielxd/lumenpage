import { createEditorState } from "../core";
import { sanitizeDocJson } from "lumenpage-link";

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
  const normalizedStateOptions =
    stateOptions?.json != null
      ? {
          ...stateOptions,
          json:
            sanitizeDocJson(stateOptions.json, {
              source: "createCanvasState",
            }) ?? stateOptions.json,
        }
      : stateOptions;

  return createEditorState({
    ...normalizedStateOptions,
    plugins,
  });
};
