export const createDragRuntimeState = () => {
  let dragState: any = null;
  let dropDecoration: any = null;
  let dropPos: number | null = null;
  let internalDragging = false;

  return {
    getDragState: () => dragState,
    setDragState: (value: any) => {
      dragState = value ?? null;
    },
    clearDragState: () => {
      dragState = null;
    },
    getDropDecoration: () => dropDecoration,
    setDropDecorationValue: (value: any) => {
      dropDecoration = value ?? null;
    },
    clearDropDecorationValue: () => {
      dropDecoration = null;
    },
    getDropPos: () => dropPos,
    setDropPos: (value: number | null) => {
      dropPos = Number.isFinite(value) ? Number(value) : null;
    },
    clearDropPos: () => {
      dropPos = null;
    },
    isInternalDragging: () => internalDragging,
    setInternalDragging: (value: boolean) => {
      internalDragging = value === true;
    },
  };
};
