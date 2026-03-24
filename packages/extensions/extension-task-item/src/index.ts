import { Node } from "lumenpage-core";
import { listNodeSpecs, toggleTaskItemChecked } from "lumenpage-extension-list-item";

export const taskItemNodeSpec = listNodeSpecs.taskItem;

export const TaskItem = Node.create({
  name: "taskItem",
  priority: 100,
  schema: taskItemNodeSpec,
});

export { toggleTaskItemChecked };
export default TaskItem;
