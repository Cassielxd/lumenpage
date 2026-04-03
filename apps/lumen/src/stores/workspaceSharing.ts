import { ref } from "vue";
import { defineStore } from "pinia";
import type {
  BackendAccess,
  BackendDocument,
  BackendMember,
  BackendShareLink,
} from "../editor/backendClient";

export const useWorkspaceSharingStore = defineStore("lumen-workspace-sharing", () => {
  const workspaceLoading = ref(false);
  const workspaceError = ref<string | null>(null);
  const currentDocument = ref<BackendDocument | null>(null);
  const documentAccess = ref<BackendAccess | null>(null);
  const members = ref<BackendMember[]>([]);
  const shareLinks = ref<BackendShareLink[]>([]);

  const resetWorkspaceSharingState = () => {
    workspaceLoading.value = false;
    workspaceError.value = null;
    currentDocument.value = null;
    documentAccess.value = null;
    members.value = [];
    shareLinks.value = [];
  };

  return {
    workspaceLoading,
    workspaceError,
    currentDocument,
    documentAccess,
    members,
    shareLinks,
    resetWorkspaceSharingState,
  };
});
