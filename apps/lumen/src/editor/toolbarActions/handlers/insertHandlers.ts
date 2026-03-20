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
  "web-page": () => {
    insertAdvancedActions.insertWebPage();
  },
});
