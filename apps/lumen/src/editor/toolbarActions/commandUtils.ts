export type EditorCommand<TArgs extends unknown[] = unknown[]> = (...args: TArgs) => boolean;

export type EditorCommandMap = Record<string, EditorCommand | undefined>;

export type GetEditorCommandMap = () => EditorCommandMap | null;

export const invokeCommand = <TArgs extends unknown[]>(
  command: EditorCommand<TArgs> | null | undefined,
  ...args: TArgs
) => command?.(...args) ?? false;
