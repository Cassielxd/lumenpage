# LumenPage (workspace)

This repo is a pnpm workspace with a headless core, a canvas view layer, and node/kit packages.

## Packages
- `packages/core` (`lumenpage-core`): headless editor core (state/commands/layout/mapping)
- `packages/view-canvas` (`lumenpage-view-canvas`): canvas renderer + input/selection handling
- `packages/node-*` (`lumenpage-node-paragraph|heading|table`): node layout/render adapters
- `packages/kit-basic` (`lumenpage-kit-basic`): builds the default schema and aggregates node renderers
- `apps/playground`: Vite demo app

## Setup
```bash
pnpm install
pnpm dev
```

## Build / Typecheck
```bash
pnpm -r build
pnpm -r typecheck
```

## Playground entry
The demo entry is `apps/playground/src/main.ts` and `apps/playground/index.html`.

## Notes
- `packages/core` does not depend on DOM APIs.
- `packages/kit-basic` creates the default schema and a default node renderer registry.
- `packages/view-canvas` provides DOM/canvas implementations and exports `Renderer`, selection helpers, and input handlers.
