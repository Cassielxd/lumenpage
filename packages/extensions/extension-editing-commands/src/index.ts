import { Extension } from "lumenpage-core";
import { basicCommands, createViewCommands } from "./commands";

export const EditingCommands = Extension.create({
  name: "editingCommands",
  priority: 850,
  addCommands() {
    return {
      ...basicCommands,
      ...createViewCommands(),
    };
  },
});

export const EditingCommandsExtension = EditingCommands;

export * from "./commands";

export default EditingCommands;
