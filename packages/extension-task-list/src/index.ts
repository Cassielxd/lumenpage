import { Node } from "lumenpage-core";
import { listNodeSpecs } from "lumenpage-extension-list-item";

export const taskListNodeSpec = listNodeSpecs.taskList;
export { defaultTaskListRenderer as taskListRenderer } from "lumenpage-view-canvas";

export const TaskList = Node.create({
  name: "taskList",
  priority: 100,
  schema: taskListNodeSpec,
});

export default TaskList;
