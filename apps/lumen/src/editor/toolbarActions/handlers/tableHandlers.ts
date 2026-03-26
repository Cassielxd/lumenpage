import type { ToolbarActionContext, ToolbarHandlerRecord } from "./types";
import { showToolbarMessage } from "../ui/message";
import { invokeCommand } from "../commandUtils";

export const createTableActionHandlers = ({
  getEditorCommands,
  notifyCommandFailure,
  getToolbarTexts,
  layoutActions,
  tableActions,
}: ToolbarActionContext): ToolbarHandlerRecord => {
  const withTableCellNotice = (ok: boolean) =>
    notifyCommandFailure(ok, getToolbarTexts().alertTableCellRequired);

  return {
    "table-fix": () => {
      layoutActions.refreshLayoutAndRender();
    },
    "cells-align": () => {
      tableActions.applyCellAlignmentSetting();
    },
    "add-row-after": () => {
      withTableCellNotice(invokeCommand(getEditorCommands()?.addTableRowAfter));
    },
    "add-row-before": () => {
      withTableCellNotice(invokeCommand(getEditorCommands()?.addTableRowBefore));
    },
    "add-column-after": () => {
      withTableCellNotice(invokeCommand(getEditorCommands()?.addTableColumnAfter));
    },
    "add-column-before": () => {
      withTableCellNotice(invokeCommand(getEditorCommands()?.addTableColumnBefore));
    },
    "delete-row": () => {
      withTableCellNotice(invokeCommand(getEditorCommands()?.deleteTableRow));
    },
    "delete-column": () => {
      withTableCellNotice(invokeCommand(getEditorCommands()?.deleteTableColumn));
    },
    "merge-cells": () => {
      notifyCommandFailure(
        invokeCommand(getEditorCommands()?.mergeTableCellRight),
        getToolbarTexts().alertMergeRightUnavailable
      );
    },
    "split-cell": () => {
      notifyCommandFailure(
        invokeCommand(getEditorCommands()?.splitTableCell),
        getToolbarTexts().alertSplitCellUnavailable
      );
    },
    "next-cell": () => {
      withTableCellNotice(invokeCommand(getEditorCommands()?.goToNextTableCell));
    },
    "previous-cell": () => {
      withTableCellNotice(invokeCommand(getEditorCommands()?.goToPreviousTableCell));
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
