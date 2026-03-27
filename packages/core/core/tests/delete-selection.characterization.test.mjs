import test from "node:test";
import assert from "node:assert/strict";

import { createSchema, ExtensionManager } from "../src/index.ts";
import { AllSelection, EditorState } from "../../../lp/state/src/index.ts";
import { Document } from "../../../extensions/extension-document/src/index.ts";
import { Paragraph } from "../../../extensions/extension-paragraph/src/index.ts";
import { Text } from "../../../extensions/extension-text/src/index.ts";
import { Table, TableCell, TableHeader, TableRow } from "../../../extensions/extension-table/src/index.ts";

test("Deleting an all-selection falls back to paragraph fillers for block containers", () => {
  const manager = new ExtensionManager([
    Document,
    Text,
    Paragraph,
    Table,
    TableRow,
    TableCell,
    TableHeader,
  ]);
  const schema = createSchema(manager.resolveStructure());

  const defaultDoc = schema.topNodeType.createAndFill();
  const defaultCell = schema.nodes.tableCell.createAndFill();

  assert.ok(defaultDoc);
  assert.ok(defaultCell);
  assert.equal(defaultDoc.firstChild?.type.name, "paragraph");
  assert.equal(defaultCell.firstChild?.type.name, "paragraph");

  const doc = schema.node("doc", null, [
    schema.node("paragraph", null, [schema.text("Hello world")]),
    schema.node("table", null, [
      schema.node("tableRow", null, [
        schema.node("tableCell", null, [schema.node("paragraph", null, [schema.text("Cell")])]),
      ]),
    ]),
  ]);
  const state = EditorState.create({ schema, doc });
  const next = state.apply(state.tr.setSelection(new AllSelection(state.doc)).deleteSelection());

  assert.equal(next.doc.childCount, 1);
  assert.equal(next.doc.firstChild?.type.name, "paragraph");
  assert.equal(next.doc.firstChild?.textContent ?? "", "");
});
