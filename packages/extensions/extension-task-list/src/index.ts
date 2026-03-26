import { Node } from "lumenpage-core";
import { createToggleListCommand, listNodeSpecs } from "lumenpage-extension-list-item";

type TaskListCommands<ReturnType> = {
  toggleTaskList: () => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    taskList: TaskListCommands<ReturnType>;
  }
}

export const taskListNodeSpec = listNodeSpecs.taskList;
export { defaultTaskListRenderer as taskListRenderer } from "lumenpage-render-engine";

export const TaskList = Node.create({
  name: "taskList",
  priority: 100,
  schema: taskListNodeSpec,
  addCommands() {
    return {
      toggleTaskList: () => createToggleListCommand(this.name),
    };
  },
});

export default TaskList;