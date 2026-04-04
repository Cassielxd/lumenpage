import { ref, watch, type Ref } from "vue";
import type { BackendUser } from "../editor/backendClient";
import type { SyncWorkspaceAccessOptions } from "./useWorkspaceAccessLoader";

type AccountDialogMode = "login" | "register";

type UseWorkspaceAccessDialogsOptions = {
  backendSessionUser: Ref<BackendUser | null>;
  shareDialogVisible: Ref<boolean>;
  accountDialogVisible: Ref<boolean>;
  accountDialogMode: Ref<AccountDialogMode>;
  accountPopupVisible: Ref<boolean>;
  setBackendSessionUser: (user: BackendUser | null) => void;
  loadWorkspace: (options?: SyncWorkspaceAccessOptions) => Promise<unknown>;
};

export const useWorkspaceAccessDialogs = ({
  backendSessionUser,
  shareDialogVisible,
  accountDialogVisible,
  accountDialogMode,
  accountPopupVisible,
  setBackendSessionUser,
  loadWorkspace,
}: UseWorkspaceAccessDialogsOptions) => {
  const pendingAccountReturnTarget = ref<"share" | null>(null);
  const accountSessionSyncing = ref(false);

  const handleAccountSessionChange = async (user: BackendUser | null) => {
    accountSessionSyncing.value = true;
    setBackendSessionUser(user);
    accountPopupVisible.value = false;
    try {
      await loadWorkspace({
        withCollabTicket: true,
        preferredSessionUser: user,
        skipSessionRefresh: true,
      });
      if (pendingAccountReturnTarget.value === "share" && user) {
        shareDialogVisible.value = true;
      }
    } finally {
      pendingAccountReturnTarget.value = null;
      accountSessionSyncing.value = false;
    }
  };

  const openShareDialog = () => {
    pendingAccountReturnTarget.value = null;
    shareDialogVisible.value = true;
  };

  const openAccountDialog = (mode: AccountDialogMode = "login") => {
    accountDialogMode.value = mode;
    accountPopupVisible.value = false;
    accountDialogVisible.value = true;
  };

  const handleShareAuthRequest = () => {
    pendingAccountReturnTarget.value = "share";
    shareDialogVisible.value = false;
    openAccountDialog("login");
  };

  const resetWorkspaceAccessDialogsState = () => {
    pendingAccountReturnTarget.value = null;
    accountSessionSyncing.value = false;
  };

  watch(
    () => accountDialogVisible.value,
    (visible) => {
      if (visible || pendingAccountReturnTarget.value !== "share" || accountSessionSyncing.value) {
        return;
      }
      if (backendSessionUser.value) {
        shareDialogVisible.value = true;
      }
      pendingAccountReturnTarget.value = null;
    },
  );

  return {
    handleAccountSessionChange,
    openShareDialog,
    openAccountDialog,
    handleShareAuthRequest,
    resetWorkspaceAccessDialogsState,
  };
};
