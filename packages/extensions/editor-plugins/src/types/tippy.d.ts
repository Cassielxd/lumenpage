declare module "tippy.js" {
  export type TippyInstanceLike = {
    setContent: (content: HTMLElement | string) => void;
    show: () => void;
    hide: () => void;
    destroy: () => void;
  };

  export type TippyFactoryLike = (
    target: any,
    options?: Record<string, any>
  ) => TippyInstanceLike | TippyInstanceLike[];

  const tippy: TippyFactoryLike;
  export default tippy;
}
