import { Node } from "lumenpage-core";
import { listNodeSpecs, taskListRenderer } from "lumenpage-extension-list-item";

export const taskListNodeSpec = listNodeSpecs.taskList;
export { taskListRenderer };

export const TaskList = Node.create({
  name: "taskList",
  priority: 100,
  schema: taskListNodeSpec,
  layout() {
    return {
      renderer: taskListRenderer,
      pagination: taskListRenderer?.pagination,
    };
  },
});

export default TaskList;
