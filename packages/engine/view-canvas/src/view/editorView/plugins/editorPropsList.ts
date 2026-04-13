import type {
  CanvasEditorViewProps,
  DispatchEditorProp,
  HookReturn,
  QueryEditorProp,
} from "../types.js";

export const createEditorPropsRuntime = ({
  view,
  editorProps,
  getEditorProps,
  getState,
}: {
  view: any;
  editorProps: CanvasEditorViewProps;
  getEditorProps: () => CanvasEditorViewProps;
  getState: () => any;
}) => {
  const getEditorPropsList = (state = getState?.()) => {
    const list: Array<Record<string, any>> = [];
    const currentEditorProps =
      typeof getEditorProps === "function" ? getEditorProps() : editorProps;
    if (currentEditorProps) {
      list.push(currentEditorProps);
    }
    const plugins = state?.plugins ?? [];
    for (const plugin of plugins) {
      if (plugin?.props) {
        list.push(plugin.props);
      }
    }
    return list;
  };

  const dispatchEditorProp: DispatchEditorProp = (name, ...args) => {
    const propsList = getEditorPropsList();
    for (let i = 0; i < propsList.length; i += 1) {
      const props = propsList[i];
      const handler = props?.[name];
      if (typeof handler === "function" && handler(view, ...args)) {
        return true;
      }
    }
    return false;
  };

  const queryEditorProp: QueryEditorProp = (name, ...args) => {
    const propsList = getEditorPropsList();
    for (let i = 0; i < propsList.length; i += 1) {
      const props = propsList[i];
      const valueOrHandler = props?.[name];
      const value =
        typeof valueOrHandler === "function" ? valueOrHandler(view, ...args) : valueOrHandler;
      if (value != null) {
        return value as HookReturn<CanvasEditorViewProps[typeof name]>;
      }
    }
    return null;
  };

  return {
    getEditorPropsList,
    dispatchEditorProp,
    queryEditorProp,
  };
};
