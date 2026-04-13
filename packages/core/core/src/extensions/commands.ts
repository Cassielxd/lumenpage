import * as commands from "../commands/index.js";
import { Extension } from "../Extension.js";

const {
  createParagraphNear,
  deleteSelection,
  enter,
  joinBackward,
  joinForward,
  liftEmptyBlock,
  newlineInCode,
  selectAll,
  selectNodeBackward,
  selectNodeForward,
  splitBlock,
} = commands;

export const basicCommands = {
  deleteSelection,
  joinBackward,
  selectNodeBackward,
  joinForward,
  selectNodeForward,
  splitBlock,
  newlineInCode,
  createParagraphNear,
  liftEmptyBlock,
  enter,
  selectAll,
};

export const Commands = Extension.create({
  name: "commands",
  priority: 900,
  addCommands() {
    return {
      ...commands,
    };
  },
});

export default Commands;
