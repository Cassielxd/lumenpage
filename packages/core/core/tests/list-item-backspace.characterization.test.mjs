import test from "node:test";
import assert from "node:assert/strict";

import { Editor } from "../src/index.ts";
import { BulletList } from "../../../extensions/extension-bullet-list/src/index.ts";
import { Document } from "../../../extensions/extension-document/src/index.ts";
import { ListItem } from "../../../extensions/extension-list-item/src/index.ts";
import { Paragraph } from "../../../extensions/extension-paragraph/src/index.ts";
import { Text } from "../../../extensions/extension-text/src/index.ts";
import { TextSelection } from "../../../lp/state/src/index.ts";

const createListEditor = (content) =>
  new Editor({
    extensions: [Document, Text, Paragraph, ListItem, BulletList],
    content,
  });

const findParagraphStart = (doc, text) => {
  let pos = null;

  doc.descendants((node, nodePos) => {
    if (pos != null) {
      return false;
    }
    if (node.type?.name === "paragraph" && node.textContent === text) {
      pos = nodePos + 1;
      return false;
    }
    return true;
  });

  assert.notEqual(pos, null);
  return pos;
};

test("list-item backspace at start joins into previous item instead of deleting the item shell", () => {
  const editor = createListEditor({
    type: "doc",
    content: [
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [{ type: "paragraph", content: [{ type: "text", text: "alpha" }] }],
          },
          {
            type: "listItem",
            content: [{ type: "paragraph", content: [{ type: "text", text: "beta" }] }],
          },
        ],
      },
    ],
  });

  const startPos = findParagraphStart(editor.state.doc, "beta");
  editor.state = editor.state.apply(
    editor.state.tr.setSelection(TextSelection.create(editor.state.doc, startPos))
  );

  const handled = editor.commands.joinListItemBackward();
  const json = editor.state.doc.toJSON();

  assert.equal(handled, true);
  assert.equal(json.content?.length, 1);
  assert.equal(json.content?.[0]?.type, "bulletList");
  assert.equal(json.content?.[0]?.content?.length, 1);
  assert.equal(json.content?.[0]?.content?.[0]?.type, "listItem");
  assert.equal(json.content?.[0]?.content?.[0]?.content?.length, 1);
  assert.equal(json.content?.[0]?.content?.[0]?.content?.[0]?.type, "paragraph");
  assert.equal(
    json.content?.[0]?.content?.[0]?.content?.[0]?.content?.[0]?.text,
    "alphabeta"
  );
});
