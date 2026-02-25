import type { PlaygroundLocale } from "../i18n";

type RunCommand = (name: string, ...args: unknown[]) => boolean;
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

const TOOLBAR_COLOR_TITLES: Record<PlaygroundLocale, Record<ToolbarColorAction, string>> = {
  "zh-CN": {
    color: "\u6587\u5b57\u989c\u8272",
    "background-color": "\u6587\u5b57\u80cc\u666f\u8272",
    highlight: "\u9ad8\u4eae\u989c\u8272",
    "page-background": "\u9875\u9762\u80cc\u666f\u8272",
    "cells-background": "\u5355\u5143\u683c\u80cc\u666f\u8272",
  },
  "en-US": {
    color: "Text color",
    "background-color": "Text background",
    highlight: "Highlight color",
    "page-background": "Page background",
    "cells-background": "Cell background",
  },
};

const normalizeColor = (value: string | null | undefined) => {
  const next = String(value || "").trim();
  return next || null;
};

export const isToolbarColorAction = (action: string): action is ToolbarColorAction =>
  TOOLBAR_COLOR_ACTION_SET.has(action as ToolbarColorAction);

export const getToolbarColorDefault = (action: ToolbarColorAction) =>
  TOOLBAR_COLOR_DEFAULTS[action];

export const getToolbarColorDialogTitle = (action: ToolbarColorAction, locale: PlaygroundLocale) =>
  TOOLBAR_COLOR_TITLES[locale][action];

export const applyToolbarColorAction = ({
  action,
  color,
  run,
  setPageBackgroundColor,
  setTableCellBackgroundColor,
}: {
  action: ToolbarColorAction;
  color: string | null;
  run: RunCommand;
  setPageBackgroundColor: SetPageBackgroundColor;
  setTableCellBackgroundColor: SetTableCellBackgroundColor;
}) => {
  const nextColor = normalizeColor(color);
  if (action === "color") {
    return nextColor ? run("setTextColor", nextColor) : run("clearTextColor");
  }
  if (action === "background-color" || action === "highlight") {
    return nextColor ? run("setTextBackground", nextColor) : run("clearTextBackground");
  }
  if (action === "page-background") {
    return setPageBackgroundColor(nextColor);
  }
  return setTableCellBackgroundColor(nextColor);
};
