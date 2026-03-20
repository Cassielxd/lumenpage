import type { ToolbarActionContext, ToolbarHandlerRecord } from "./types";
import { showToolbarMessage } from "../ui/message";

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
    "cells-align": () => {
      tableActions.applyCellAlignmentSetting();
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
        showToolbarMessage(getToolbarTexts().alertTableCellRequired, "warning");
      }
    },
    "toggle-header-column": () => {
      if (!tableActions.toggleHeaderColumn()) {
        showToolbarMessage(getToolbarTexts().alertTableCellRequired, "warning");
      }
    },
    "toggle-header-cell": () => {
      if (!tableActions.toggleHeaderCell()) {
        showToolbarMessage(getToolbarTexts().alertTableCellRequired, "warning");
      }
    },
    "delete-table": () => {
      if (!tableActions.deleteCurrentTable()) {
        showToolbarMessage(getToolbarTexts().alertTableCellRequired, "warning");
      }
    },
  };
};
