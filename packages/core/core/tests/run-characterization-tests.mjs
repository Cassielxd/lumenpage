import { register } from "node:module";

register("./ts-loader.mjs", import.meta.url);

await import("./extension-manager.characterization.test.mjs");
await import("./canvas-bridge.characterization.test.mjs");
await import("./editor.characterization.test.mjs");
await import("./core-events.characterization.test.mjs");
await import("./command-manager.characterization.test.mjs");
await import("./paste-rule.characterization.test.mjs");
