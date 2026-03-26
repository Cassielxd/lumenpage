import { Node } from "lumenpage-core";
import { listNodeSpecs, toggleTaskItemChecked } from "lumenpage-extension-list-item";

type TaskItemCommands<ReturnType> = {
  toggleTaskItemChecked: (
    pos?: number,
    options?: { onlyWhenNearStart?: boolean }
  ) => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    taskItem: TaskItemCommands<ReturnType>;
  }
}

export const taskItemNodeSpec = listNodeSpecs.taskItem;

export const TaskItem = Node.create({
  name: "taskItem",
  priority: 100,
  schema: taskItemNodeSpec,
  addCommands() {
    return {
      toggleTaskItemChecked: (pos, options) => toggleTaskItemChecked(pos, options),
    };
  },
});

export { toggleTaskItemChecked };
export default TaskItem;