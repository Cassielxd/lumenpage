import { createSelectionLogger } from "../../../core/index.js";

export const createDebugLoggers = ({
  debugConfig,
  getText,
  docPosToTextOffset,
  clampOffset,
}: {
  debugConfig: any;
  getText: () => string;
  docPosToTextOffset: (doc: any, pos: number) => number;
  clampOffset: (offset: number) => number;
}) => {
  const logSelection = debugConfig?.selection
    ? createSelectionLogger({ getText, docPosToTextOffset, clampOffset })
    : () => {};
  const logDelete = () => {};
  const debugLog = () => {};

  return {
    logSelection,
    logDelete,
    debugLog,
  };
};
