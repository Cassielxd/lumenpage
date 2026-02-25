import type { ToolbarActionContext, ToolbarHandlerRecord } from "./types";

export const createSessionActionHandlers = ({
  toggleSessionMode,
}: ToolbarActionContext): ToolbarHandlerRecord => ({
  viewer: () => {
    toggleSessionMode();
  },
});
