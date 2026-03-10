import { LumenEditor } from "lumenpage-core";
import {
  createDocFromText,
  docToText,
  getTableTextLength,
  serializeTableToText,
} from "lumenpage-schema-basic";

import { LumenStarterKit } from "./lumenExtensions";

const editor = new LumenEditor({
  extensions: LumenStarterKit,
});

export const schema = editor.schema!;

export { createDocFromText, docToText, serializeTableToText, getTableTextLength };
