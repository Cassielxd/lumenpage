import { Node } from "lumenpage-core";
import { columnsRenderer } from "./renderer";
import { columnsNodeSpec } from "./columns";

export { columnsNodeSpec, serializeColumnsToText } from "./columns";
export { columnsRenderer } from "./renderer";

type InsertColumnsOptions = {
  count?: number;
  labels?: string | string[];
};

type ColumnsCommandMethods<ReturnType> = {
  insertColumns: (attrs?: InsertColumnsOptions) => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    columns: ColumnsCommandMethods<ReturnType>;
  }
}

const insertColumnsCommand =
  (attrs: InsertColumnsOptions = {}) =>
  (state: any, dispatch?: (tr: any) => void) => {
    const type = state?.schema?.nodes?.columns;
    if (!type) {
      return false;
    }
    const count = Number(attrs?.count);
    const safeCount = Number.isFinite(count) ? Math.max(2, Math.min(4, Math.round(count))) : 2;
    const labels = Array.isArray(attrs?.labels)
      ? attrs.labels.map((value) => String(value || "").trim()).filter(Boolean).join("\n")
      : String(attrs?.labels || "").trim();
    const node = type.create({ count: safeCount, labels });
    if (!dispatch) {
      return true;
    }
    dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
    return true;
  };

export const Columns = Node.create({
  name: "columns",
  priority: 100,
  schema: columnsNodeSpec,
  layout() {
    return {
      renderer: columnsRenderer,
    };
  },
  addCommands() {
    return {
      insertColumns: (attrs?: InsertColumnsOptions) => insertColumnsCommand(attrs),
    };
  },
  canvas() {
    return {
      nodeSelectionTypes: ["columns"],
    };
  },
});

export default Columns;
