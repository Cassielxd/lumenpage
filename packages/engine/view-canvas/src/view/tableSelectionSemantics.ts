export type TableSelectionSemantics = {
  cellSelectionJsonTypes?: string[];
  tableNodeTypes?: string[];
  tableRowNodeTypes?: string[];
  tableCellNodeTypes?: string[];
};

export const DEFAULT_TABLE_SELECTION_SEMANTICS: Required<TableSelectionSemantics> = {
  cellSelectionJsonTypes: ["tableCell"],
  tableNodeTypes: ["table"],
  tableRowNodeTypes: ["tableRow"],
  tableCellNodeTypes: ["tableCell", "tableHeader"],
};

export const normalizeTableSelectionSemantics = (
  semantics?: TableSelectionSemantics | null
): Required<TableSelectionSemantics> => ({
  cellSelectionJsonTypes:
    Array.isArray(semantics?.cellSelectionJsonTypes) &&
    semantics.cellSelectionJsonTypes.length > 0
      ? semantics.cellSelectionJsonTypes
      : DEFAULT_TABLE_SELECTION_SEMANTICS.cellSelectionJsonTypes,
  tableNodeTypes:
    Array.isArray(semantics?.tableNodeTypes) && semantics.tableNodeTypes.length > 0
      ? semantics.tableNodeTypes
      : DEFAULT_TABLE_SELECTION_SEMANTICS.tableNodeTypes,
  tableRowNodeTypes:
    Array.isArray(semantics?.tableRowNodeTypes) && semantics.tableRowNodeTypes.length > 0
      ? semantics.tableRowNodeTypes
      : DEFAULT_TABLE_SELECTION_SEMANTICS.tableRowNodeTypes,
  tableCellNodeTypes:
    Array.isArray(semantics?.tableCellNodeTypes) && semantics.tableCellNodeTypes.length > 0
      ? semantics.tableCellNodeTypes
      : DEFAULT_TABLE_SELECTION_SEMANTICS.tableCellNodeTypes,
});

export const matchesTableSelectionNodeType = (typeName: unknown, candidates: string[]) =>
  typeof typeName === "string" && candidates.includes(typeName);
