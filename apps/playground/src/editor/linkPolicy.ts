import type { PlaygroundPermissionMode } from "./permissionPlugin";

export const shouldOpenLinkOnClick = (
  mode: PlaygroundPermissionMode,
  event: Pick<MouseEvent, "metaKey" | "ctrlKey">
) => {
  if (mode === "readonly" || mode === "comment") {
    return true;
  }
  return !!event?.metaKey || !!event?.ctrlKey;
};

