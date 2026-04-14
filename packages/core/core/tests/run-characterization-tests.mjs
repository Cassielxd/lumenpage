import { register } from "node:module";

register("./ts-loader.mjs", import.meta.url);

await import("./extension-manager.characterization.test.mjs");
await import("./canvas-bridge.characterization.test.mjs");
await import("./decoration-render.characterization.test.mjs");
await import("./overlay-renderer.characterization.test.mjs");
await import("./editor.characterization.test.mjs");
await import("./core-events.characterization.test.mjs");
await import("./command-manager.characterization.test.mjs");
await import("./paste-rule.characterization.test.mjs");
await import("./delete-selection.characterization.test.mjs");
await import("./pagination-reuse.characterization.test.mjs");
await import("./list-item-backspace.characterization.test.mjs");
await import("./keyboard-shortcuts.characterization.test.mjs");
