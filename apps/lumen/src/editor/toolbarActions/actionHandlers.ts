import type { ToolbarItemConfig } from "../toolbarCatalog";
import { createInsertActionHandlers } from "./handlers/insertHandlers";
import { createPageExportActionHandlers } from "./handlers/pageExportHandlers";
import { createSessionActionHandlers } from "./handlers/sessionHandlers";
import { createTableActionHandlers } from "./handlers/tableHandlers";
import { createTextActionHandlers } from "./handlers/textHandlers";
import { createToolsActionHandlers } from "./handlers/toolsHandlers";
import type {
  ToolbarActionContext,
  ToolbarHandlerRecord,
  ToolbarItemActionHandler,
} from "./handlers/types";

export const createToolbarActionHandlers = (context: ToolbarActionContext) => {
  const handlers: ToolbarHandlerRecord = {
    ...createTextActionHandlers(context),
    ...createInsertActionHandlers(context),
    ...createTableActionHandlers(context),
    ...createToolsActionHandlers(context),
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
