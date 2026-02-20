import { Selection, SelectionRange } from "lumenpage-state";

const findNearestCellPos = (doc, pos, dir = 1) => {
  let forward = null;
  let backward = null;
  doc.descendants((node, nodePos) => {
    if (node?.type?.name !== "table_cell") {
      return true;
    }
    if (nodePos >= pos && (forward == null || nodePos < forward)) {
      forward = nodePos;
    }
    if (nodePos <= pos && (backward == null || nodePos > backward)) {
      backward = nodePos;
    }
    return true;
  });
  if (dir >= 0) {
    return forward ?? backward;
  }
  return backward ?? forward;
};

const resolveCellBoundary = (doc, pos, dir = 1) => {
  const nearest = findNearestCellPos(doc, pos, dir);
  if (!Number.isFinite(nearest)) {
    return null;
  }
  const $pos = doc.resolve(nearest);
  if ($pos.nodeAfter?.type?.name !== "table_cell") {
    return null;
  }
  return $pos;
};

const resolveCellNodeAt = ($pos) => $pos?.nodeAfter?.type?.name === "table_cell" ? $pos.nodeAfter : null;

export class CellSelection extends Selection {
  constructor($anchorCell, $headCell = $anchorCell) {
    const anchorCell = resolveCellNodeAt($anchorCell);
    const headCell = resolveCellNodeAt($headCell);
    if (!anchorCell || !headCell) {
      throw new RangeError("CellSelection endpoints must point at table_cell boundaries.");
    }
    const doc = $anchorCell.doc;
    const fromPos = Math.min($anchorCell.pos, $headCell.pos);
    const toPos =
      Math.max($anchorCell.pos + anchorCell.nodeSize, $headCell.pos + headCell.nodeSize);
    const ranges = [new SelectionRange(doc.resolve(fromPos), doc.resolve(toPos))];
    super($anchorCell, $headCell, ranges);
  }

  map(doc, mapping) {
    const mappedAnchor = resolveCellBoundary(doc, mapping.map(this.anchor), -1);
    const mappedHead = resolveCellBoundary(doc, mapping.map(this.head), 1);
    if (!mappedAnchor || !mappedHead) {
      return Selection.near(doc.resolve(mapping.map(this.head)));
    }
    return new CellSelection(mappedAnchor, mappedHead);
  }

  eq(other) {
    return other instanceof CellSelection && other.anchor === this.anchor && other.head === this.head;
  }

  toJSON() {
    return { type: "table_cell", anchor: this.anchor, head: this.head };
  }

  getBookmark() {
    return new CellBookmark(this.anchor, this.head);
  }

  static create(doc, anchor, head = anchor) {
    const $anchor = resolveCellBoundary(doc, anchor, -1);
    const $head = resolveCellBoundary(doc, head, 1);
    if (!$anchor || !$head) {
      throw new RangeError("Could not resolve CellSelection endpoints.");
    }
    return new CellSelection($anchor, $head);
  }

  static fromJSON(doc, json) {
    if (!json || typeof json.anchor !== "number" || typeof json.head !== "number") {
      throw new RangeError("Invalid input for CellSelection.fromJSON");
    }
    return CellSelection.create(doc, json.anchor, json.head);
  }
}

try {
  Selection.jsonID("table_cell", CellSelection);
} catch (_error) {
  // Ignore duplicate registration in hot-reload/dev re-evaluation scenarios.
}

class CellBookmark {
  constructor(readonly anchor: number, readonly head: number) {}

  map(mapping) {
    return new CellBookmark(mapping.map(this.anchor), mapping.map(this.head));
  }

  resolve(doc) {
    try {
      return CellSelection.create(doc, this.anchor, this.head);
    } catch (_error) {
      return Selection.near(doc.resolve(this.head));
    }
  }
}
