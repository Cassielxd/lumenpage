# LumenPage

[Chinese](./README.md) | [English](./README.en.md)

Quick links:
[Lumen](./apps/lumen) | [Playground](./apps/playground) | [Collab Server](./apps/collab-server) | [Docs](./apps/docs) | [Core](./packages/core/core) | [View Canvas](./packages/engine/view-canvas) | [Extensions](./packages/extensions)

LumenPage is a `Canvas` editor monorepo focused on paginated document editing.

It is not a thin wrapper around a traditional DOM rich-text editor. Instead, it splits the document model, extension system, pagination layout, rendering engine, and view runtime into separate layers, with the goal of supporting:

- true paginated editing
- large-document rendering with incremental pagination
- a TipTap-style extension organization model
- collaboration based on `Yjs + Hocuspocus`
- custom business nodes, renderers, and side capabilities

## Project Scope

The repository can be understood as three major layers:

1. `packages/lp/*`
   Provides ProseMirror-style fundamentals for the data model, state, transforms, history, input rules, and view types.
2. `packages/core/*` + `packages/extensions/*`
   Provides the editor core, StarterKit, suggestion utilities, and a large set of business and text extensions.
3. `packages/engine/*`
   Provides pagination layout, rendering, view runtime capabilities, and the final `Canvas EditorView`.

The main apps currently are:

- `apps/playground`
  A lightweight demo entry for validating core editing capabilities and collaboration wiring.
- `apps/lumen`
  The main application shell, integrating pagination editing, comments, track changes, outline, collaboration state, and other product-level features.

Other apps:

- `apps/collab-server`
  Collaboration server based on `@hocuspocus/server`.
- `apps/docs`
  Documentation site.

## Current Capabilities

- canvas-based paginated editing view
- layered pagination engine: `layout-engine` / `render-engine` / `view-runtime` / `view-canvas`
- TipTap-style extension registration and composition
- common text features: headings, lists, tables, images, links, inline styles, task lists
- business extensions: audio, bookmark, file, embed panel, math, signature, template, text box, web page card, and more
- comments and track changes
- Yjs document synchronization
- Hocuspocus provider / server integration
- online collaboration presence
- collaborative comment thread sync in `lumen`
- collaborative comment smoke coverage across two clients

## Repository Layout

```txt
apps/
  collab-server/   Hocuspocus collaboration service
  docs/            documentation site
  lumen/           main application
  playground/      demo application

governance/        governance baselines and budget snapshots
scripts/           repository and governance scripts

packages/
  core/
    core/          editor core
    dev-tools/     development and debugging utilities
    link/          link-related capabilities
    markdown/      Markdown import/export
    starter-kit/   default extension bundle
    suggestion/    suggestion and trigger matching
  engine/
    layout-engine/ pagination layout engine
    render-engine/ rendering engine
    view-runtime/  view runtime
    view-canvas/   Canvas EditorView
  extensions/
    extension-*/   node, mark, and behavior extensions
  lp/
    collab/
    commands/
    history/
    inputrules/
    keymap/
    model/
    state/
    transform/
    view-types/
```

`pnpm-workspace.yaml` is organized around these layers:

```yaml
packages:
  - "apps/*"
  - "packages/core/*"
  - "packages/engine/*"
  - "packages/extensions/*"
  - "packages/lp/*"
```

## Architecture

```txt
apps/lumen, apps/playground
        |
        v
packages/core/core + packages/core/starter-kit + packages/extensions/*
        |
        v
packages/engine/view-canvas
        |
        +--> packages/engine/layout-engine
        +--> packages/engine/render-engine
        +--> packages/engine/view-runtime
        +--> packages/lp/*
```

In simplified terms:

- `lp/*` is the foundational model and state layer.
- `core/core` is the editor shell and extension assembly layer.
- `extensions/*` is the feature increment layer.
- `engine/*` is the pagination and Canvas view layer.
- `apps/*` is the final product layer.

## Collaboration

The current collaboration implementation goes beyond plain document content sync and includes:

- document collaboration: `packages/extensions/extension-collaboration`
- remote cursor and awareness: `packages/extensions/extension-collaboration-caret`
- collaboration service: `apps/collab-server`
- collaboration integration in `playground`
- collaboration integration in `lumen`
- collaborative comment thread sync in `lumen`

Stack:

- `Yjs`
- `@hocuspocus/provider`
- `@hocuspocus/server`

### Start the collaboration server

```bash
pnpm dev:collab
```

Default endpoints:

- WebSocket: `ws://127.0.0.1:1234`
- Health: `http://127.0.0.1:1234/health`

### Start the frontend apps

Playground:

```bash
pnpm dev
```

Lumen:

```bash
pnpm dev:lumen
```

### Collaboration examples

Playground:

```txt
http://localhost:5173/?collab=1&collabDoc=demo&collabUser=Alice&locale=en-US
http://localhost:5173/?collab=1&collabDoc=demo&collabUser=Bob&locale=en-US
```

Lumen:

```txt
<lumen-dev-url>/?collab=1&collabDoc=lumen-demo&collabUser=Alice&locale=en-US
<lumen-dev-url>/?collab=1&collabDoc=lumen-demo&collabUser=Bob&locale=en-US
```

Use the actual Vite URL printed by `pnpm dev:lumen` for `<lumen-dev-url>`.

Common query parameters:

- `collab=1`
- `collabUrl=ws://127.0.0.1:1234`
- `collabDoc=<document-name>`
- `collabField=default`
- `collabToken=<token>`
- `collabUser=<display-name>`
- `collabColor=<hex-color>`
- `locale=en-US|zh-CN`

## Development Commands

Install dependencies:

```bash
pnpm install
```

Common commands:

```bash
pnpm dev              # start playground
pnpm dev:lumen        # start lumen
pnpm dev:collab       # start collaboration server
pnpm docs:dev         # start documentation site

pnpm build            # build the whole workspace
pnpm build:lumen      # build lumen
pnpm build:collab     # build/check the collaboration server app

pnpm typecheck        # run workspace type checks
pnpm format           # format the workspace
pnpm format:check     # check formatting
```

Governance and incremental checks:

```bash
pnpm affected:list        # list affected packages
pnpm typecheck:affected   # typecheck only affected packages
pnpm build:affected       # build only affected packages
pnpm governance:check     # run layer, budget, sync, and smoke governance checks
pnpm docs:check:lumen-menu
```

Validation commands for `lumen`:

```bash
pnpm -C apps/lumen test:e2e
pnpm -C apps/lumen test:e2e:collab
```

## Key Packages

### `packages/core/*`

- `core`
  Editor core, extension mechanism, command wiring, and schema generation.
- `starter-kit`
  Default text extension bundle.
- `markdown`
  Markdown import/export bridge.
- `suggestion`
  Shared suggestion capability for features such as mentions and slash commands.
- `link`
  Link parsing and navigation behavior.
- `dev-tools`
  Development and debugging tools.

### `packages/engine/*`

- `layout-engine`
  Pagination, page breaking, continuation pages, page reuse, and incremental layout.
- `render-engine`
  Rendering from nodes and marks into layout fragments and draw plans.
- `view-runtime`
  View runtime capabilities such as selection, hit-testing, coordinates, and virtualization.
- `view-canvas`
  The final Canvas editing view and input event wiring.

### `packages/extensions/*`

Extensions mainly fall into these groups:

- basic text extensions
  such as `paragraph`, `heading`, `bold`, `italic`, `link`, and `table`
- behavior extensions
  such as `bubble-menu`, `drag-handle`, `slash-command`, `mention`, and `undo-redo`
- collaboration extensions
  `extension-collaboration`, `extension-collaboration-caret`, and `extension-comment`
- business node extensions
  including `audio`, `bookmark`, `embed-panel`, `file`, `math`, `signature`, `template`, and `web-page`

### `packages/lp/*`

This is the low-level capability set for the editor stack, covering the model, state, transactions, commands, history, input rules, and view types.

## Engineering Governance

In addition to the editor implementation itself, the repository now includes several ongoing governance checks:

- layer-boundary checks to keep `core / engine / extensions / lp` from collapsing back into a flat structure
- runtime sync checks to keep `view-runtime` aligned with upper-layer integrations
- build budget and smoke gates to keep bundle size and critical paths under control
- documentation menu sync checks so `apps/docs` stays aligned with the `lumen` feature set

These baselines live under `governance/`, while the execution entry points are the `governance:*` scripts in the root `package.json`.

## Recommended Reading Order

If you are new to the repository, this order is a good starting point:

1. `apps/lumen`
2. `apps/playground`
3. `packages/core/core`
4. `packages/core/starter-kit`
5. `packages/extensions/extension-*`
6. `packages/engine/view-canvas`
7. `packages/engine/layout-engine`
8. `packages/lp/*`

## Current Status

The repository has already completed these major refactors and integrations:

- `packages/` was regrouped from a flat layout into `core / engine / extensions / lp`
- both `playground` and `lumen` now integrate Hocuspocus collaboration
- `lumen` collaboration presence is already integrated into the UI
- `lumen` comment threads are already in the collaboration pipeline
- orphan comment threads are cleaned up automatically
- a collaborative comment smoke test already covers basic two-client sync

Still worth improving:

- message-level edit/delete for comments
- more complete auth and session management
- external storage and multi-instance scaling on the server side
- deeper collaboration recovery testing
- further chunk splitting for large bundles

## Related Entry Points

- [apps/lumen](./apps/lumen)
- [apps/playground](./apps/playground)
- [apps/collab-server](./apps/collab-server)
- [apps/docs](./apps/docs)
- [packages/core/core](./packages/core/core)
- [packages/engine/view-canvas](./packages/engine/view-canvas)
- [packages/extensions](./packages/extensions)
