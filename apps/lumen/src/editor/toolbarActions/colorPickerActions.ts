import { createPlaygroundI18n, type PlaygroundLocale } from "../i18n";
import type { GetEditorCommandMap } from "./commandUtils";
import { invokeCommand } from "./commandUtils";

type SetPageBackgroundColor = (color: string | null) => boolean;
type SetTableCellBackgroundColor = (color: string | null) => boolean;

export type ToolbarColorAction =
  | "color"
  | "background-color"
  | "highlight"
  | "page-background"
  | "cells-background";

const TOOLBAR_COLOR_ACTION_SET = new Set<ToolbarColorAction>([
  "color",
  "background-color",
  "highlight",
  "page-background",
  "cells-background",
]);

const TOOLBAR_COLOR_DEFAULTS: Record<ToolbarColorAction, string> = {
  color: "#111827",
  "background-color": "#fff59d",
  highlight: "#fff59d",
  "page-background": "#ffffff",
  "cells-background": "#ffffff",
};

const normalizeColor = (value: string | null | undefined) => {
  const next = String(value || "").trim();
  return next || null;
};

export const isToolbarColorAction = (action: string): action is ToolbarColorAction =>
  TOOLBAR_COLOR_ACTION_SET.has(action as ToolbarColorAction);

export const getToolbarColorDefault = (action: ToolbarColorAction) =>
  TOOLBAR_COLOR_DEFAULTS[action];

export const getToolbarColorDialogTitle = (action: ToolbarColorAction, locale: PlaygroundLocale) => {
  const texts = createPlaygroundI18n(locale).colorPickerActions;
  if (action === "color") {
    return texts.color;
  }
  if (action === "background-color") {
    return texts.backgroundColor;
  }
  if (action === "highlight") {
    return texts.highlight;
  }
  if (action === "page-background") {
    return texts.pageBackground;
  }
  return texts.cellsBackground;
};

export const applyToolbarColorAction = ({
  action,
  color,
  getEditorCommands,
  setPageBackgroundColor,
  setTableCellBackgroundColor,
}: {
  action: ToolbarColorAction;
  color: string | null;
  getEditorCommands: GetEditorCommandMap;
  setPageBackgroundColor: SetPageBackgroundColor;
  setTableCellBackgroundColor: SetTableCellBackgroundColor;
}) => {
  const nextColor = normalizeColor(color);
  const commands = getEditorCommands();
  if (action === "color") {
    return nextColor
      ? invokeCommand(commands?.setTextColor, nextColor)
      : invokeCommand(commands?.clearTextColor);
  }
  if (action === "background-color" || action === "highlight") {
    return nextColor
      ? invokeCommand(commands?.setTextBackground, nextColor)
      : invokeCommand(commands?.clearTextBackground);
  }
  if (action === "page-background") {
    return setPageBackgroundColor(nextColor);
  }
  return setTableCellBackgroundColor(nextColor);
};
