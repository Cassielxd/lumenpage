import { MessagePlugin } from "tdesign-vue-next";

export type ToolbarMessageTheme = "info" | "success" | "warning" | "error";

export const showToolbarMessage = (
  content: string,
  theme: ToolbarMessageTheme = "warning"
) => {
  const text = String(content || "").trim();
  if (!text) {
    return false;
  }
  if (theme === "success") {
    MessagePlugin.success(text);
    return true;
  }
  if (theme === "info") {
    MessagePlugin.info(text);
    return true;
  }
  if (theme === "error") {
    MessagePlugin.error(text);
    return true;
  }
  MessagePlugin.warning(text);
  return true;
};
