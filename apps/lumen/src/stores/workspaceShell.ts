import { ref } from "vue";
import { defineStore } from "pinia";
import type { BackendAccess, BackendDocument } from "../editor/backendClient";

export const useWorkspaceShellStore = defineStore("lumen-workspace-shell", () => {
  const shareDialogVisible = ref(false);
  const accountDialogVisible = ref(false);
  const accountDialogMode = ref<"login" | "register">("login");
  const accountPopupVisible = ref(false);
  const backendDocument = ref<BackendDocument | null>(null);
  const backendDocumentAccess = ref<BackendAccess | null>(null);
  const backendAccessError = ref<string | null>(null);
  const backendAccessBound = ref(false);
  const workspaceLoading = ref(true);
  const workspaceError = ref<string | null>(null);

  const resetWorkspaceShellState = () => {
    shareDialogVisible.value = false;
    accountDialogVisible.value = false;
    accountDialogMode.value = "login";
    accountPopupVisible.value = false;
    backendDocument.value = null;
    backendDocumentAccess.value = null;
    backendAccessError.value = null;
    backendAccessBound.value = false;
    workspaceLoading.value = true;
    workspaceError.value = null;
  };

  return {
    shareDialogVisible,
    accountDialogVisible,
    accountDialogMode,
    accountPopupVisible,
    backendDocument,
    backendDocumentAccess,
    backendAccessError,
    backendAccessBound,
    workspaceLoading,
    workspaceError,
    resetWorkspaceShellState,
  };
});
