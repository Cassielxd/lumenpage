# Repository Guidelines

## Project Structure & Module Organization
- `apps/playground`: Vite demo app; entry `src/main.ts`, `index.html`, styles `styles.css`.
- `packages/view-canvas`: canvas renderer and input/selection handling, plus embedded core/layout modules (`src/core`, `src/layout-pagination`).
- `packages/kit-basic`: default schema and node renderer registry.
- `packages/node-*`: node layout/render adapters (paragraph, heading, table, image, list).
- `docs/`: documentation and notes.
- Root configs: `tsconfig.base.json`, `tsconfig.json`, Prettier config.
- No dedicated test or asset folders yet; add new assets under the app (e.g., `apps/playground`).

## Build, Test, and Development Commands
- `pnpm install`: install workspace dependencies (pnpm is the supported package manager).
- `pnpm dev`: run the playground dev server (Vite).
- `pnpm build`: build all packages via `tsc -b`.
- `pnpm build:app`: build the playground app only.
- `pnpm typecheck`: run TypeScript type checks across packages.
- `pnpm format` / `pnpm format:check`: format or verify formatting with Prettier.

## Coding Style & Naming Conventions
- Formatting is enforced by Prettier (`printWidth` 100, 2 spaces, semicolons, double quotes, trailing commas).
- Keep TypeScript ESM modules (`"type": "module"` in packages).
- New node packages should follow `packages/node-<name>` and publish as `lumenpage-node-<name>`.

## Testing Guidelines
- No first-party test runner or tests are present under `apps/` or `packages/` right now.
- If you add tests, use `.test.ts` or `.spec.ts` naming and add a root script (e.g., `pnpm test`) that documents how to run them.

## Commit & Pull Request Guidelines
- Recent commits use short placeholder messages like `...` or other non-descriptive strings, so no formal convention is enforced.
- Please use clear, imperative summaries and consider a scope prefix such as `core:` or `view-canvas:`.
- PRs should describe the change, link related issues, and include screenshots or GIFs for visual/canvas updates.

## Dependency & Config Notes
- Keep `pnpm-lock.yaml` up to date; avoid modifying `package-lock.json` unless you intentionally use npm.
- Shared TypeScript settings live in `tsconfig.base.json`; prefer updating shared options there.
