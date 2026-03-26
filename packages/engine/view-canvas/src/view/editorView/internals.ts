// 缁熶竴缁勮 _internals锛岄伩鍏嶆瀯閫犲嚱鏁版湯灏惧璞″瓧闈㈤噺杩囬暱涓旈毦缁存姢銆?
export const createEditorInternals = ({
  core,
  stateAccessors,
  interactionRuntime,
  viewSync,
  domEvents,
}: {
  core: Record<string, any>;
  stateAccessors: Record<string, any>;
  interactionRuntime: Record<string, any>;
  viewSync: Record<string, any>;
  domEvents: Record<string, any>;
}) => {
  return {
    ...core,
    ...stateAccessors,
    ...interactionRuntime,
    ...viewSync,
    ...domEvents,
  };
};
