// Runtime shim for prosemirror-dev-tools source usage without Compiled Babel transform.
// It intentionally no-ops styles so dev-tools can run in this playground.
export const css = (_styles?: unknown): string => "";

const compiled = { css };

export default compiled;
