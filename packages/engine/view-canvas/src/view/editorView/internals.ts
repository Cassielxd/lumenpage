type EditorInternalsSection = Record<string, any>;

type CreateEditorInternalsArgs = {
  core: EditorInternalsSection;
  stateAccessors: EditorInternalsSection;
  interactionRuntime: EditorInternalsSection;
  viewSync: EditorInternalsSection;
  domEvents: EditorInternalsSection;
};

const createLegacyCompatInternals = ({
  core,
  stateAccessors,
  interactionRuntime,
  viewSync,
  domEvents,
}: CreateEditorInternalsArgs) => ({
  ...core,
  ...stateAccessors,
  ...interactionRuntime,
  ...viewSync,
  ...domEvents,
});

export const createEditorInternals = ({
  core,
  stateAccessors,
  interactionRuntime,
  viewSync,
  domEvents,
}: CreateEditorInternalsArgs) => {
  return {
    core,
    stateAccessors,
    interactionRuntime,
    viewSync,
    domEvents,
    ...createLegacyCompatInternals({
      core,
      stateAccessors,
      interactionRuntime,
      viewSync,
      domEvents,
    }),
  };
};

export const getEditorInternalsSections = (view: any) => {
  const internals = view?._internals ?? null;
  const fallback = internals ?? null;
  return {
    internals,
    core: internals?.core ?? fallback,
    stateAccessors: internals?.stateAccessors ?? fallback,
    interactionRuntime: internals?.interactionRuntime ?? fallback,
    viewSync: internals?.viewSync ?? fallback,
    domEvents: internals?.domEvents ?? fallback,
  };
};
