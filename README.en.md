# LumenPage

[Chinese](./README.md) | [English](./README.en.md)

Quick links:
[Lumen](./apps/lumen) | [Playground](./apps/playground) | [Backend Server](./apps/backend-server) | [Docs](./apps/docs) | [Core](./packages/core/core) | [View Canvas](./packages/engine/view-canvas) | [Extensions](./packages/extensions)

LumenPage is a monorepo for paginated document editing.  
It is not a thin rich-text shell with UI on top. The repository is building a long-lived online-document foundation: document model, transaction system, pagination layout, Canvas rendering, collaboration, comments, track changes, AI, import/export, and product-level apps are all separated into explicit layers.

## Positioning

LumenPage is moving toward the same problem space as Google Docs, but the benchmark is not UI cloning. The real target is capability coverage and system design.

| Focus | LumenPage target |
| --- | --- |
| Collaboration | Multi-user real-time collaboration, not only single-user editing |
| Document shape | Long-form, paginated, print-friendly documents, not just scrolling DOM editing |
| Product features | Comments, track changes, outline, sharing, AI, and full document workflows |
| Architecture | An extensible document platform, not a monolithic app with hardcoded features |

In other words, the repository is trying to solve more than “build an editor page”.  
It is building a base that can keep moving toward Google Docs-class product capabilities over time.

## Design Principles

### 1. Document-first, not DOM-first

LumenPage is not based on `contenteditable + DOM patching`.  
It starts from the document model, state, transactions, commands, and extensions, and only then maps those capabilities into pagination and a Canvas view.

That gives a few important benefits:

- stable document structure
- clearer feature boundaries
- editing behavior that can be expressed as commands and plugins
- comments, track changes, collaboration, export, and AI all working on the same document state

### 2. Pagination-first, not print-only pagination

Many web editors treat pagination as a print-stage effect.  
LumenPage places pagination on the primary path so it can support:

- true paginated editing
- incremental layout for large documents
- page-level rendering and reuse
- coordination with headers, footers, watermarks, page numbers, and page orientation

### 3. Plugin-first instead of feature pileup

A large part of the system is organized under `packages/extensions/*`, including:

- basic nodes and marks
- comments, track changes, collaboration, drag handles, bubble menus, slash commands
- business nodes such as audio, files, bookmarks, templates, signatures, and embedded web pages
- AI extensions and product-level AI integration

That means new capabilities are expected to enter the system as plugins first, instead of repeatedly modifying the editor core.

### 4. Engine and product shell are intentionally separated

The repository is not structured as “one app plus many components”. It separates the editor engine from the product shell:

- `packages/lp/*`: model, state, transactions, commands, history, input rules, view types
- `packages/core/*`: editor shell, StarterKit, Markdown, Suggestion, Link, and other core capabilities
- `packages/engine/*`: pagination layout, rendering, hit testing, and Canvas runtime
- `packages/extensions/*`: pluggable features and business extensions
- `apps/*`: final product shells, demos, and service integration

That boundary is a better fit for long-term evolution and for multiple product forms.

### 5. Collaboration and server abilities remain replaceable

Collaboration, AI, and runtime service capabilities are not hardcoded into the frontend app.  
They are currently handled by `apps/backend-server`, which provides:

- Hocuspocus / Yjs collaboration
- health checks
- AI request proxying

This keeps the product shell, collaboration protocol, and model providers loosely coupled.

## Tech Stack

| Layer | Choice | Role |
| --- | --- | --- |
| App layer | `Vue 3` + `Vite` + `TypeScript` | Product shell, DX, and type safety |
| UI layer | `TDesign Vue Next` | App-level component system |
| Internationalization | `vue-i18n` | Unified Lumen UI copy and locale switching |
| Editor core | in-house `lumenpage-*` packages | Document model, transactions, commands, extensions, and view abstractions |
| Pagination and rendering | `Canvas` + `layout-engine` + `render-engine` + `view-runtime` | Real paginated editing, layout calculation, and runtime rendering |
| Collaboration | `Yjs` + `@hocuspocus/provider` + `@hocuspocus/server` | Document sync, remote cursors, and collaboration sessions |
| Import / export | `mammoth` + `docx` | Word import and export flows |
| Engineering | `pnpm workspace` + `Prettier` + `Playwright` + custom governance scripts | Build, verification, E2E, and repository governance |

## Architecture Overview

```txt
apps/lumen                apps/playground                apps/docs
      \                         |                           /
       \                        |                          /
        +---- packages/core/core + starter-kit + extensions/* ----+
                                  |                                |
                                  v                                |
                        packages/engine/view-canvas                |
                                  |                                |
                 +----------------+----------------+               |
                 |                                 |               |
                 v                                 v               |
  packages/engine/layout-engine      packages/engine/render-engine |
                 |                                 |               |
                 +----------- packages/engine/view-runtime --------+
                                  |
                                  v
                             packages/lp/*

apps/backend-server
  |- ws://...   collaboration sync
  |- /health    health checks
  |- /ai/*      AI proxy
```

You can read that as five layers:

1. `packages/lp/*`
Low-level capabilities: model, state, transactions, commands, history, input rules, and view types.

2. `packages/core/*`
Editor core: editor shell, StarterKit, Markdown, Suggestion, Link, and related capabilities.

3. `packages/extensions/*`
Extension layer: nodes, marks, behaviors, collaboration features, and business features.

4. `packages/engine/*`
Pagination and view engine: layout, rendering, hit testing, coordinate mapping, and Canvas runtime behavior.

5. `apps/*`
Product and demo layer: interaction, product UX, internationalization, and service integration.

## Plugin and Extension Model

Extensibility is one of the most important design points in this repository.  
When a new feature is added, the first question is which layer it belongs to.

| Extension type | Typical location | What it covers |
| --- | --- | --- |
| Node / mark extensions | `packages/extensions/extension-*` | Tables, images, comment marks, track-change marks, templates, and similar content primitives |
| Behavior extensions | `packages/extensions/extension-*` | Drag handles, bubble menus, slash commands, collaboration carets, and editing behaviors |
| Business extensions | `packages/extensions/extension-*` | Audio, files, seals, embedded web pages, AI, and other product-facing document capabilities |
| Composition entry | `packages/core/starter-kit`, `apps/lumen/src/editor/documentExtensions.ts` | Which extensions a concrete app assembles |
| Product adapters | `apps/lumen`, `apps/playground` | Panels, menus, toolbars, dialogs, and service calls |

The AI flow is a good concrete example:

1. `packages/extensions/extension-ai`
Provides editor-side capability, context extraction, and result application.

2. `apps/lumen`
Provides the AI panel, provider configuration, i18n, and product interaction.

3. `apps/backend-server`
Provides auth, sharing, collaboration tickets, and request proxying so API keys do not have to live in the frontend.

This is the intended pattern: product features can be complex, while the editor core stays independent from a specific provider or UI widget.

## Current Extension Catalog

The list below mirrors the current directories under [packages/extensions](./packages/extensions). When a new extension is added there, this section should be updated as well.

### Foundational document and text

- [extension-document](./packages/extensions/extension-document)
- [extension-paragraph](./packages/extensions/extension-paragraph)
- [extension-text](./packages/extensions/extension-text)
- [extension-heading](./packages/extensions/extension-heading)
- [extension-blockquote](./packages/extensions/extension-blockquote)
- [extension-bullet-list](./packages/extensions/extension-bullet-list)
- [extension-ordered-list](./packages/extensions/extension-ordered-list)
- [extension-list-item](./packages/extensions/extension-list-item)
- [extension-task-list](./packages/extensions/extension-task-list)
- [extension-task-item](./packages/extensions/extension-task-item)
- [extension-code](./packages/extensions/extension-code)
- [extension-code-block](./packages/extensions/extension-code-block)
- [extension-hard-break](./packages/extensions/extension-hard-break)
- [extension-horizontal-rule](./packages/extensions/extension-horizontal-rule)
- [extension-bold](./packages/extensions/extension-bold)
- [extension-italic](./packages/extensions/extension-italic)
- [extension-strike](./packages/extensions/extension-strike)
- [extension-underline](./packages/extensions/extension-underline)
- [extension-subscript](./packages/extensions/extension-subscript)
- [extension-superscript](./packages/extensions/extension-superscript)
- [extension-text-style](./packages/extensions/extension-text-style)
- [extension-smart-input-rules](./packages/extensions/extension-smart-input-rules)
- [extension-undo-redo](./packages/extensions/extension-undo-redo)

### Structure, layout, and page capability

- [extension-columns](./packages/extensions/extension-columns)
- [extension-table](./packages/extensions/extension-table)
- [extension-page-break](./packages/extensions/extension-page-break)
- [extension-option-box](./packages/extensions/extension-option-box)
- [extension-callout](./packages/extensions/extension-callout)

### Collaboration, review, and editing interaction

- [extension-active-block](./packages/extensions/extension-active-block)
- [extension-ai](./packages/extensions/extension-ai)
- [extension-bubble-menu](./packages/extensions/extension-bubble-menu)
- [extension-changeset](./packages/extensions/extension-changeset)
- [extension-collaboration](./packages/extensions/extension-collaboration)
- [extension-collaboration-caret](./packages/extensions/extension-collaboration-caret)
- [extension-comment](./packages/extensions/extension-comment)
- [extension-drag-handle](./packages/extensions/extension-drag-handle)
- [extension-mention](./packages/extensions/extension-mention)
- [extension-popup](./packages/extensions/extension-popup)
- [extension-slash-command](./packages/extensions/extension-slash-command)
- [extension-tag](./packages/extensions/extension-tag)
- [extension-track-change](./packages/extensions/extension-track-change)

### Business nodes and rich media

- [extension-audio](./packages/extensions/extension-audio)
- [extension-bookmark](./packages/extensions/extension-bookmark)
- [extension-embed-panel](./packages/extensions/extension-embed-panel)
- [extension-file](./packages/extensions/extension-file)
- [extension-image](./packages/extensions/extension-image)
- [extension-link](./packages/extensions/extension-link)
- [extension-math](./packages/extensions/extension-math)
- [extension-seal](./packages/extensions/extension-seal)
- [extension-signature](./packages/extensions/extension-signature)
- [extension-template](./packages/extensions/extension-template)
- [extension-text-box](./packages/extensions/extension-text-box)
- [extension-video](./packages/extensions/extension-video)
- [extension-web-page](./packages/extensions/extension-web-page)

### Infrastructure and internal support

- [extension-block-id](./packages/extensions/extension-block-id)

## Core Capabilities

The repository already covers a substantial set of features:

- paginated Canvas editing
- document model, transactions, commands, history, input rules, and keymaps
- headings, lists, tables, images, video, links, underline, subscript, superscript, and text styles
- comments and synchronized comment threads
- track changes
- Yjs collaboration and remote cursors
- outline, page settings, headers, footers, watermarks, and page backgrounds
- business nodes such as audio, file attachments, bookmarks, templates, signatures, web-page embeds, math, and callouts
- AI assistant extension with local proxy integration
- Markdown / Word / HTML / text import and export flows

## Repository Layout

```txt
apps/
  backend-server/  unified backend for auth, sharing, collaboration, and AI proxy
  docs/            documentation site
  lumen/           main app, closest to a real product shell
  playground/      lightweight demo entry
  shared/          shared app-layer code

packages/
  core/
    core/          editor core
    dev-tools/     debugging utilities
    link/          link capability
    markdown/      Markdown import/export
    starter-kit/   default extension bundle
    suggestion/    suggestion and trigger capability
  engine/
    layout-engine/ pagination layout engine
    render-engine/ rendering engine
    view-runtime/  view runtime
    view-canvas/   Canvas EditorView
  extensions/
    extension-*/   node, mark, behavior, collaboration, and business extensions
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

governance/        governance rules and budget baselines
scripts/           repository scripts
```

## App Layer Overview

### `apps/lumen`

This is the current main app and the closest thing to a real online-document product shell.  
It integrates:

- paginated editing
- comments and comment threads
- track-changes panels
- collaboration presence
- AI assistant
- page settings
- internationalization

If you want to understand the product direction of the repository, start here.

### `apps/playground`

This is the lighter demo entry, useful for validating:

- core editor capability
- extension assembly
- collaboration wiring
- engine-layer behavior

If you want the smallest runnable path, start here.

### `apps/backend-server`

This service currently handles:

- Hocuspocus / Yjs document collaboration
- health checks
- AI request proxying

Default endpoints:

- WebSocket: `ws://127.0.0.1:1234`
- Health: `http://127.0.0.1:1234/health`

## Quick Start

### Install dependencies

```bash
pnpm install
```

### Start the collaboration server

```bash
pnpm dev:backend
```

### Start the main app

```bash
pnpm dev:lumen
```

### Start Playground

```bash
pnpm dev
```

### Start the docs site

```bash
pnpm docs:dev
```

## Common Commands

```bash
pnpm dev                     # start playground
pnpm dev:lumen              # start lumen
pnpm dev:backend            # start backend-server
pnpm docs:dev               # start docs

pnpm build                  # build the workspace
pnpm build:lumen            # build lumen
pnpm build:backend          # check backend-server

pnpm typecheck              # workspace typecheck
pnpm format                 # format the workspace
pnpm format:check           # check formatting

pnpm affected:list          # list affected packages
pnpm typecheck:affected     # typecheck affected packages only
pnpm build:affected         # build affected packages only
pnpm governance:check       # run governance checks

pnpm test:lumen:e2e         # run lumen E2E
pnpm -C apps/lumen test:e2e:collab
```

## Collaboration Debug Examples

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

Common query parameters:

- `collab=1`
- `collabUrl=ws://127.0.0.1:1234`
- `collabDoc=<document-name>`
- `collabField=default`
- `collabToken=<token>`
- `collabUser=<display-name>`
- `collabColor=<hex-color>`
- `locale=en-US|zh-CN`

## Why This Architecture Fits the Google Docs Direction

If the goal were only a simple editor, many features could be stacked directly into the app layer.  
If the goal is to keep moving toward Google Docs-like product depth, several structural requirements show up immediately:

- the document model must be independent from the UI
- pagination and rendering must be independent from business features
- collaboration must be independent from the product shell
- comments, track changes, AI, and import/export must work on the same document state
- business nodes and product capabilities must keep entering the system as plugins

The current LumenPage layering is designed for exactly that.  
It does not mean the repository already matches Google Docs in product depth, but it does mean the system can keep moving in that direction without first throwing away the foundation.

## Current Status

Major foundation pieces already in place:

- monorepo layering is established
- both `playground` and `lumen` are runnable
- the paginated Canvas editing path is working
- Yjs + Hocuspocus collaboration is integrated
- comments and track changes are already present at the product layer
- the AI plugin is integrated into `lumen`
- `lumen` internationalization is unified on `vue-i18n`

Still worth pushing further:

- stronger pagination performance and large-document optimization
- fuller permissions, session handling, and server-side storage
- more mature import/export compatibility
- finer-grained collaboration recovery and conflict handling
- more complete product-level AI workflows

## Suggested Reading Order

If you are entering the repository for the first time, this is a good order:

1. [apps/lumen](./apps/lumen)
2. [apps/playground](./apps/playground)
3. [packages/core/core](./packages/core/core)
4. [packages/core/starter-kit](./packages/core/starter-kit)
5. [packages/extensions](./packages/extensions)
6. [packages/engine/view-canvas](./packages/engine/view-canvas)
7. [packages/engine/layout-engine](./packages/engine/layout-engine)
8. [packages/lp](./packages/lp)

## Related Entry Points

- [apps/lumen](./apps/lumen)
- [apps/playground](./apps/playground)
- [apps/backend-server](./apps/backend-server)
- [apps/docs](./apps/docs)
- [packages/core/core](./packages/core/core)
- [packages/engine/view-canvas](./packages/engine/view-canvas)
- [packages/extensions](./packages/extensions)

## Contact

- Email: 348040933@qq.com
