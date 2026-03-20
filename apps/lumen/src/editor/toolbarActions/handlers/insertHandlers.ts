import type { ToolbarActionContext, ToolbarHandlerRecord } from "./types";

export const createInsertActionHandlers = ({
  insertAdvancedActions,
  toggleTocPanel,
}: ToolbarActionContext): ToolbarHandlerRecord => ({
  audio: () => {
    insertAdvancedActions.insertAudio();
  },
  file: () => {
    insertAdvancedActions.insertFile();
  },
  math: () => {
    insertAdvancedActions.insertMath();
  },
  tag: () => {
    insertAdvancedActions.insertTag();
  },
  callout: () => {
    insertAdvancedActions.insertCallout();
  },
  mention: () => {
    insertAdvancedActions.insertMention();
  },
  bookmark: () => {
    insertAdvancedActions.insertBookmark();
  },
  "option-box": () => {
    insertAdvancedActions.insertOptionBox();
  },
  toc: () => {
    toggleTocPanel();
  },
  template: () => {
    insertAdvancedActions.insertTemplate();
  },
  "text-box": () => {
    insertAdvancedActions.insertTextBox();
  },
  "web-page": () => {
    insertAdvancedActions.insertWebPage();
  },
});
