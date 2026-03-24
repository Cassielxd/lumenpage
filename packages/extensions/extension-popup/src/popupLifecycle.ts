export type PopupRenderLifecycle<TProps> = {
  onStart?: (props: TProps) => void;
  onUpdate?: (props: TProps) => void;
  onExit?: (props: TProps) => void;
  onKeyDown?: (props: TProps & { event: KeyboardEvent }) => boolean;
  isEventInside?: (event: Event) => boolean;
};

export type PopupRenderRuntime<TProps> = {
  update: (props: TProps) => void;
  clear: () => void;
  destroy: () => void;
  isStarted: () => boolean;
  getCurrentProps: () => TProps | null;
  handleKeyDown: (event: KeyboardEvent) => boolean;
  isEventInside: (event: Event) => boolean;
};

export const createPopupRenderRuntime = <TProps>(
  renderer: PopupRenderLifecycle<TProps>,
  onFallbackExit: () => void
): PopupRenderRuntime<TProps> => {
  let started = false;
  let currentProps: TProps | null = null;

  const clear = () => {
    if (started && currentProps) {
      renderer.onExit?.(currentProps);
    } else {
      onFallbackExit();
    }
    started = false;
    currentProps = null;
  };

  const update = (props: TProps) => {
    if (!started) {
      if (typeof renderer.onStart === "function") {
        renderer.onStart(props);
      } else {
        renderer.onUpdate?.(props);
      }
      started = true;
    } else {
      renderer.onUpdate?.(props);
    }
    currentProps = props;
  };

  return {
    update,
    clear,
    destroy: clear,
    isStarted: () => started,
    getCurrentProps: () => currentProps,
    handleKeyDown: (event: KeyboardEvent) => {
      if (!started || !currentProps || typeof renderer.onKeyDown !== "function") {
        return false;
      }
      return renderer.onKeyDown({ ...(currentProps as any), event }) === true;
    },
    isEventInside: (event: Event) => renderer.isEventInside?.(event) === true,
  };
};

