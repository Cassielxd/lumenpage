import type { ToolbarActionContext, ToolbarHandlerRecord } from "./types";

export const createTableActionHandlers = ({
  runWithNotice,
  getToolbarTexts,
  layoutActions,
  tableActions,
}: ToolbarActionContext): ToolbarHandlerRecord => {
  const withTableCellNotice = (name: string) =>
    runWithNotice(name, getToolbarTexts().alertTableCellRequired);

  return {
    "table-fix": () => {
      layoutActions.refreshLayoutAndRender();
    },
    "add-row-after": () => {
      withTableCellNotice("addTableRowAfter");
    },
    "add-row-before": () => {
      withTableCellNotice("addTableRowBefore");
    },
    "add-column-after": () => {
      withTableCellNotice("addTableColumnAfter");
    },
    "add-column-before": () => {
      withTableCellNotice("addTableColumnBefore");
    },
    "delete-row": () => {
      withTableCellNotice("deleteTableRow");
    },
    "delete-column": () => {
      withTableCellNotice("deleteTableColumn");
    },
    "merge-cells": () => {
      runWithNotice("mergeTableCellRight", getToolbarTexts().alertMergeRightUnavailable);
    },
    "split-cell": () => {
      runWithNotice("splitTableCell", getToolbarTexts().alertSplitCellUnavailable);
    },
    "next-cell": () => {
      withTableCellNotice("goToNextTableCell");
    },
    "previous-cell": () => {
      withTableCellNotice("goToPreviousTableCell");
    },
    "toggle-header-row": () => {
      if (!tableActions.toggleHeaderRow()) {
        window.alert(getToolbarTexts().alertTableCellRequired);
      }
    },
    "toggle-header-column": () => {
      if (!tableActions.toggleHeaderColumn()) {
        window.alert(getToolbarTexts().alertTableCellRequired);
      }
    },
    "toggle-header-cell": () => {
      if (!tableActions.toggleHeaderCell()) {
        window.alert(getToolbarTexts().alertTableCellRequired);
      }
    },
    "delete-table": () => {
      if (!tableActions.deleteCurrentTable()) {
        window.alert(getToolbarTexts().alertTableCellRequired);
      }
    },
  };
};
