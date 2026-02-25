import type { ToolbarItemConfig } from "../toolbarCatalog";
import { createPageExportActionHandlers } from "./handlers/pageExportHandlers";
import { createSessionActionHandlers } from "./handlers/sessionHandlers";
import { createTableActionHandlers } from "./handlers/tableHandlers";
import { createTextActionHandlers } from "./handlers/textHandlers";
import type {
  ToolbarActionContext,
  ToolbarHandlerRecord,
  ToolbarItemActionHandler,
} from "./handlers/types";

export const createToolbarActionHandlers = (context: ToolbarActionContext) => {
  const handlers: ToolbarHandlerRecord = {
    ...createTextActionHandlers(context),
    ...createTableActionHandlers(context),
    ...createPageExportActionHandlers(context),
    ...createSessionActionHandlers(context),
  };

  const handleItemAction: ToolbarItemActionHandler = (item: ToolbarItemConfig) => {
    const handler = handlers[item.action];
    if (handler) {
      void handler();
      return;
    }
    if (item.command) {
      context.run(item.command);
    }
  };

  return {
    handleItemAction,
  };
};
