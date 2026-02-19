# Pos / Offset / Layout Mapping

This document describes how LumenPage maps ProseMirror `pos` (tree position),
linear text `offset`, and visual layout coordinates.

```mermaid
flowchart TD
  subgraph Doc["ProseMirror Document (Tree)"]
    P1["Node A (block)"]
    P2["Node B (block)"]
  end

  subgraph Pos["Model Position (pos)"]
    POS["pos (PM ResolvedPos)"]
  end

  subgraph Offset["Linear Text Offset"]
    OFF["offset (flattened text index)"]
  end

  subgraph Layout["Layout & Rendering"]
    LINES["Layout lines (page / line / x / y)"]
    COORDS["Canvas coords (x, y)"]
  end

  Doc -->|selection / transaction uses| POS
  POS -->|docPosToTextOffset| OFF
  OFF -->|textOffsetToDocPos| POS
  OFF -->|layout index lookup| LINES
  LINES -->|coordsAtPos / posAtCoords| COORDS
```

## Core Conversions
- `pos -> offset`: `docPosToTextOffset(doc, pos)`
- `offset -> pos`: `textOffsetToDocPos(doc, offset)`
- `offset -> line`: `getLineAtOffset(layoutIndex, offset)`
- `offset -> coords`: `coordsAtPos(layout, offset, scrollTop, viewportWidth, textLength)`

## Why This Matters
- **Transactions** use `pos`, not `offset`.
- **Canvas rendering** uses `offset` and layout lines.
- **Cursor / selection** must stay consistent across `pos` and `offset` or
  you'll see jumpy caret, wrong selection, or phantom deletes.

## Typical Flow
1. User input (keyboard / pointer) yields a `pos`.
2. `pos` is converted to `offset` for layout lookup.
3. Layout produces `line` and `coords`.
4. Rendering draws at `coords`, while editing commands mutate by `pos`.

