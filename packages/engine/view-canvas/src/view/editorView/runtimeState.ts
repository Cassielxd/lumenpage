import type { CanvasEditorViewProps, QueryEditorProp } from "./types";

const nullQueryEditorProp = ((() => null) as unknown) as QueryEditorProp;

export const createEditorViewRuntimeState = (initialEditorProps: CanvasEditorViewProps) => {
  let layout: any = null;
  let layoutIndex: any = null;
  let pendingChangeSummary: any = null;
  let pendingSteps: any = null;
  let rafId = 0;
  let caretOffset = 0;
  let caretRect: any = null;
  let preferredX: any = null;
  let pendingPreferredUpdate = true;
  let isComposing = false;
  let editorProps = initialEditorProps ?? ({} as CanvasEditorViewProps);
  let currentQueryEditorProp: QueryEditorProp = nullQueryEditorProp;
  let getDecorationsAccessor: (() => any) | null = null;
  let dragHandlers: any = null;

  const queryEditorProp: QueryEditorProp = ((name: any, ...args: any[]) =>
    currentQueryEditorProp(name, ...args)) as QueryEditorProp;

  return {
    getLayout: () => layout,
    setLayout: (value: any) => {
      layout = value;
    },
    getLayoutIndex: () => layoutIndex,
    setLayoutIndex: (value: any) => {
      layoutIndex = value;
    },
    getPendingChangeSummary: () => pendingChangeSummary,
    setPendingChangeSummary: (value: any) => {
      pendingChangeSummary = value;
    },
    clearPendingChangeSummary: () => {
      pendingChangeSummary = null;
    },
    getPendingSteps: () => pendingSteps,
    setPendingSteps: (value: any) => {
      pendingSteps = value;
    },
    clearPendingSteps: () => {
      pendingSteps = null;
    },
    getRafId: () => rafId,
    setRafId: (value: number) => {
      rafId = Number.isFinite(value) ? Number(value) : 0;
    },
    getCaretOffset: () => caretOffset,
    setCaretOffset: (value: number) => {
      caretOffset = Number.isFinite(value) ? Number(value) : 0;
    },
    getCaretRect: () => caretRect,
    setCaretRect: (value: any) => {
      caretRect = value;
    },
    getPreferredX: () => preferredX,
    setPreferredX: (value: any) => {
      preferredX = value;
    },
    getPendingPreferredUpdate: () => pendingPreferredUpdate,
    setPendingPreferredUpdate: (value: boolean) => {
      pendingPreferredUpdate = value !== false;
    },
    getIsComposing: () => isComposing,
    setIsComposing: (value: boolean) => {
      isComposing = value === true;
    },
    getEditorProps: () => editorProps,
    setEditorProps: (value: CanvasEditorViewProps | null | undefined) => {
      editorProps = (value ?? {}) as CanvasEditorViewProps;
    },
    queryEditorProp,
    setQueryEditorProp: (value: QueryEditorProp | null | undefined) => {
      currentQueryEditorProp = value ?? nullQueryEditorProp;
    },
    getDecorations: () =>
      (typeof getDecorationsAccessor === "function" ? getDecorationsAccessor() : null) ?? null,
    setGetDecorations: (value: (() => any) | null | undefined) => {
      getDecorationsAccessor = typeof value === "function" ? value : null;
    },
    getDragHandlers: () => dragHandlers,
    setDragHandlers: (value: any) => {
      dragHandlers = value ?? null;
    },
  };
};
