# Temporary Handoff: non-lp typing tightening

Date: 2026-03-25
Scope: non-lp modules only.
Status: command typing refactor is successful; the next core tightening batch for `types.ts` and `ExtensionManager.ts` is also complete.

## User constraints
- Ignore `packages/lp/*` for now.
- Tiptap core reference used:
  - `E:/workespace/2026/nodejs/tiptap/packages/core`

## What is already done

### 1. Core command typing model is in place
Files:
- `packages/core/core/src/types.ts`
- `packages/core/core/src/CommandManager.ts`
- `packages/core/core/src/Editor.ts`
- `packages/core/core/src/ExtensionManager.ts`
- `packages/core/core/src/index.ts`

What changed:
- Added augmentable `Commands<ReturnType>` in `lumenpage-core`.
- Added derived command facade types:
  - `RawCommands`
  - `SingleCommands`
  - `ChainedCommands`
  - `CanCommands`
  - `NormalizeCommandMethod`
  - `NormalizeCommandMethods`
  - `CommandNameInvoker`
- `Editor.commands`, `Editor.can()`, and `Editor.chain()` are now typed.
- `CommandManager` exposes typed facades while preserving the current mixed runtime command shape.
- `addCommands` now returns `CommandMap` instead of `Record<string, any>`.

### 2. Command augmentations are now wired across non-lp command extensions
Files:
- `packages/extensions/extension-editing-commands/src/index.ts`
- `packages/extensions/extension-callout/src/index.ts`
- `packages/extensions/extension-collaboration/src/collaboration.ts`
- `packages/extensions/extension-collaboration-caret/src/collaboration-caret.ts`
- `packages/extensions/extension-comment/src/commentsRuntime.ts`
- `packages/extensions/extension-comment/src/commentAnchor.ts`
- `packages/extensions/extension-audio/src/index.ts`
- `packages/extensions/extension-bookmark/src/index.ts`
- `packages/extensions/extension-columns/src/index.ts`
- `packages/extensions/extension-embed-panel/src/index.ts`
- `packages/extensions/extension-file/src/index.ts`
- `packages/extensions/extension-link/src/index.ts`
- `packages/extensions/extension-math/src/index.ts`
- `packages/extensions/extension-option-box/src/index.ts`
- `packages/extensions/extension-seal/src/index.ts`
- `packages/extensions/extension-signature/src/index.ts`
- `packages/extensions/extension-tag/src/index.ts`
- `packages/extensions/extension-template/src/index.ts`
- `packages/extensions/extension-text-box/src/index.ts`
- `packages/extensions/extension-track-change/src/trackChangeRuntime.ts`
- `packages/extensions/extension-web-page/src/index.ts`

What changed:
- Added `declare module "lumenpage-core" { interface Commands<ReturnType> { ... } }` blocks for every current non-`lp` extension that implements `addCommands()`.
- The structure matches tiptap's pattern: command definitions are grouped per extension in `Commands<ReturnType>`, but the final editor facade stays flattened.
- `extension-editing-commands` still derives its surface from actual command implementations instead of handwriting signatures.
- Several `insertXxx` commands now expose concrete option objects instead of raw `Record<string, unknown>` in their command hints.

### 3. Bubble menu plugin typing was tightened earlier
File:
- `packages/extensions/extension-bubble-menu/src/bubble-menu-plugin.ts`

What changed:
- Removed broad `any` from view / transaction / selection / command access paths.
- Added local structural types for marks, text nodes, transaction meta, and view shape.

### 4. Shared suggestion pipeline is tightened now
Files:
- `packages/core/suggestion/src/suggestion.ts`
- `packages/core/suggestion/src/findSuggestionMatch.ts`
- `packages/extensions/extension-mention/src/mention.ts`
- `packages/extensions/extension-slash-command/src/slash-command.ts`
- `packages/extensions/extension-mention/tsconfig.typecheck.json`
- `packages/extensions/extension-slash-command/tsconfig.typecheck.json`

What changed:
- Added structural `SuggestionEditorView` and match-position types.
- Removed `any` from suggestion `view/state/transaction/$position` boundaries.
- `mention` and `slash-command` now consume typed editor/view/state surfaces instead of `any`.
- Their typecheck configs resolve source instead of stale dist declarations.

### 5. The next core boundary batch is now done
Files:
- `packages/core/core/src/types.ts`
- `packages/core/core/src/ExtensionManager.ts`
- `packages/core/core/src/Editor.ts`
- `packages/extensions/extension-track-change/src/types.ts`

What changed:
- `types.ts`
  - Added concrete imports for `Schema`, `NodeSpec`, `MarkSpec`, `Slice`, `Transaction`, `EditorState`, `CanvasEditorView`, `NodeViewFactory`, and `ParseRule`.
  - Tightened schema/layout/canvas/editor event surfaces.
  - Added structural shared types such as:
    - `KeyboardShortcutMap`
    - `EditorPlugin`
    - `ExtensionStorage`
    - `ClipboardTextSerializer`
    - `ClipboardTextParser`
    - `ClipboardParserLike`
    - `ClipboardSerializerLike`
    - `StateExtender`
    - `ParseHTMLSource`
    - `MarkStyleStateLike`
  - `addInputRules` is now `InputRule[]`.
  - `NodeConfig.parseHTML` / `MarkConfig.parseHTML` are now `ParseRule[]`.
  - `AttributeConfig.parseHTML` no longer takes raw `unknown`; it now accepts a DOM-like source shape used by real extensions.
- `ExtensionManager.ts`
  - Removed its local `any` usage across runtime fields, structure/state resolution, transform chains, clipboard hooks, and event binding.
  - `editor`, `schema`, `nodeRegistry`, `dispatchTransaction`, clipboard hooks, node view hooks, and state extenders are now typed end-to-end.
  - `applyDirectSchema` now uses node/mark-specific assignment instead of untyped schema blobs.
- `Editor.ts`
  - Tightened plugin/storage/state/transaction fields and the transform/clipboard bridge signatures used when adapting `CanvasEditorViewProps` into extension manager hooks.
- `extension-track-change/src/types.ts`
  - Split normalized `TrackChangeAttrs` from raw `TrackChangeAttrsInput`, so parse/render code can pass raw DOM-derived values without falling back to `any`.

Important note:
- `packages/core/core/src/ExtensionManager.ts` no longer contains `any`.
- Remaining `any` in `packages/core/core/src/types.ts` are mostly intentional compatibility escape hatches for generic defaults and `AnyExtension`-style aliases.

## Validation completed
- `pnpm.cmd typecheck`
- Result: passed for the whole workspace.

This means:
- the command typing refactor is successful
- non-`lp` command augmentations are now broadly wired in tiptap style
- the shared suggestion tightening is successful
- the `types.ts` + `ExtensionManager.ts` follow-up batch is successful

## Current modified files in worktree
- `packages/core/core/src/CommandManager.ts`
- `packages/core/core/src/Editor.ts`
- `packages/core/core/src/ExtensionManager.ts`
- `packages/core/core/src/index.ts`
- `packages/core/core/src/types.ts`
- `packages/core/suggestion/src/findSuggestionMatch.ts`
- `packages/core/suggestion/src/suggestion.ts`
- `packages/extensions/extension-bubble-menu/src/bubble-menu-plugin.ts`
- `packages/extensions/extension-callout/src/index.ts`
- `packages/extensions/extension-collaboration-caret/src/collaboration-caret.ts`
- `packages/extensions/extension-collaboration/src/collaboration.ts`
- `packages/extensions/extension-comment/src/commentAnchor.ts`
- `packages/extensions/extension-comment/src/commentsRuntime.ts`
- `packages/extensions/extension-audio/src/index.ts`
- `packages/extensions/extension-bookmark/src/index.ts`
- `packages/extensions/extension-columns/src/index.ts`
- `packages/extensions/extension-embed-panel/src/index.ts`
- `packages/extensions/extension-file/src/index.ts`
- `packages/extensions/extension-link/src/index.ts`
- `packages/extensions/extension-math/src/index.ts`
- `packages/extensions/extension-option-box/src/index.ts`
- `packages/extensions/extension-seal/src/index.ts`
- `packages/extensions/extension-signature/src/index.ts`
- `packages/extensions/extension-tag/src/index.ts`
- `packages/extensions/extension-template/src/index.ts`
- `packages/extensions/extension-text-box/src/index.ts`
- `packages/extensions/extension-track-change/src/trackChangeRuntime.ts`
- `packages/extensions/extension-web-page/src/index.ts`
- `packages/extensions/extension-editing-commands/src/index.ts`
- `packages/extensions/extension-editing-commands/tsconfig.typecheck.json`
- `packages/extensions/extension-mention/src/mention.ts`
- `packages/extensions/extension-mention/tsconfig.typecheck.json`
- `packages/extensions/extension-slash-command/src/slash-command.ts`
- `packages/extensions/extension-slash-command/tsconfig.typecheck.json`
- `packages/extensions/extension-track-change/src/types.ts`
- `tmp-command-typing-handoff.md`

## Refreshed hotspot snapshot
Quick `rg` count snapshot excluding `packages/lp/*` and `*.d.ts`:
- `apps/playground/src/editor/smokeTests.ts` -> 140
- `packages/engine/view-canvas/src/view/editorView/types.ts` -> 60
- `packages/extensions/extension-collaboration/src/yjsDocument.ts` -> 55
- `packages/engine/view-canvas/src/view/editorView/nodeViews/overlay.ts` -> 49
- `packages/engine/view-runtime/src/layoutIndex.ts` -> 42
- `packages/engine/view-canvas/src/view/render/geometry.ts` -> 26
- `packages/engine/view-canvas/src/view/editorView/nodeViews/selection.ts` -> 25
- `packages/core/core/src/schemaFields.ts` -> 25
- `packages/engine/view-canvas/src/view/editorView/inputPipeline/editorHandlers.ts` -> 23
- `packages/core/dev-tools/src/app.ts` -> 23
- `packages/engine/view-canvas/src/view/editorView/interactions.ts` -> 22
- `packages/engine/view-canvas/src/view/editorView/inputPipeline/bridge.ts` -> 22

## Highest-value remaining hotspots
1. `packages/core/core/src/schemaFields.ts`
- Now the most valuable remaining core boundary file.
- It still uses broad `any` in parseDOM/renderHTML/schema merging.
- Tightening it should let `EditorOptions.content` and more schema-facing surfaces move off `any` cleanly.

2. `packages/core/core/src/createDocument.ts`
- Still completely untyped around `content` and `schema`.
- This is the real reason `EditorOptions.content` is still `any`.
- Recommended to tackle together with `schemaFields.ts`.

3. `packages/engine/view-canvas/src/view/editorView/types.ts`
- Highest shared runtime hotspot in the editor/view boundary.
- Tightening it will remove a lot of duplicate structural typing now living in core/editor glue.

4. `packages/extensions/extension-collaboration/src/yjsDocument.ts`
- Still a large collaboration-specific `any` sink.
- Better handled after the core/view boundaries are tighter.

## Practical resume plan
When resuming next time:
1. Start with `packages/core/core/src/schemaFields.ts`.
2. In the same batch, tighten `packages/core/core/src/createDocument.ts` and then move `EditorOptions.content` off `any`.
3. Re-run `pnpm.cmd typecheck`.
4. After core schema/content boundaries are stable, move to `packages/engine/view-canvas/src/view/editorView/types.ts`.
5. Leave `packages/extensions/extension-collaboration/src/yjsDocument.ts` for a dedicated pass after the shared view types improve.

## Unrelated temp file still present
- `tmp-write-test.txt` (untracked, not touched)
