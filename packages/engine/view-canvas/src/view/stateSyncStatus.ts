type CreateStateSyncStatusArgs = {
  getLayout: () => any;
  inputEl: any;
  status: { textContent: string };
  queryEditorProp?: (name: string, args?: any) => any;
};

export const createStateSyncStatus = ({
  getLayout,
  inputEl,
  status,
  queryEditorProp,
}: CreateStateSyncStatusArgs) => {
  const getActiveElement = () => {
    const ownerDocument = inputEl?.ownerDocument || (typeof document !== "undefined" ? document : null);
    return ownerDocument?.activeElement ?? null;
  };

  const updateStatus = () => {
    const layout = getLayout();
    const pageCount = layout ? layout.pages.length : 0;
    const inputFocused = getActiveElement() === inputEl;
    const focused: "typing" | "idle" = inputFocused ? "typing" : "idle";
    const fromProps =
      typeof queryEditorProp === "function"
        ? queryEditorProp("formatStatusText", { pageCount, focused, inputFocused })
        : null;
    status.textContent =
      typeof fromProps === "string" && fromProps.trim().length > 0
        ? fromProps
        : `${pageCount} pages | ${focused}`;
  };

  return {
    updateStatus,
  };
};
