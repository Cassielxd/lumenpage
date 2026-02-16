export type EditorView = {
  state?: unknown;
  dispatch?: (tr: unknown) => void;
  endOfTextblock?: (dir: "forward" | "backward" | string, state?: unknown) => boolean;
  [key: string]: any;
};

export type DOMEventHandler = (view: EditorView, event: Event) => boolean;

export type EditorProps<T = any> = {
  decorations?: any;
  handleDOMEvents?: Record<string, DOMEventHandler>;
  handleKeyDown?: (view: EditorView, event: KeyboardEvent) => boolean;
  handleKeyPress?: (view: EditorView, event: KeyboardEvent) => boolean;
  handleTextInput?: (view: EditorView, from: number, to: number, text: string) => boolean;
  handleClick?: (view: EditorView, pos: number, event: MouseEvent) => boolean;
  handleDoubleClick?: (view: EditorView, pos: number, event: MouseEvent) => boolean;
  [key: string]: any;
};
