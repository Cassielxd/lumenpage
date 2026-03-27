export const sortExtensions = <T extends { priority: number }>(items: ReadonlyArray<T>) =>
  [...items].sort((a, b) => b.priority - a.priority);
