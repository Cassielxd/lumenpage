export type ToolbarInputDialogOption = {
  label: string;
  value: string;
};

export type ToolbarInputDialogField = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "number" | "select";
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  options?: ToolbarInputDialogOption[];
};

export type ToolbarInputDialogRequest = {
  title: string;
  description?: string;
  fields: ToolbarInputDialogField[];
  confirmText?: string;
  cancelText?: string;
  width?: number | string;
};

export type ToolbarInputDialogResult = Record<string, string>;

export type RequestToolbarInputDialog = (
  request: ToolbarInputDialogRequest
) => Promise<ToolbarInputDialogResult | null>;
