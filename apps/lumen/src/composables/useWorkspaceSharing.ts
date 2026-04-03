import { computed, watch, type ComputedRef } from "vue";
import { storeToRefs } from "pinia";
import {
  addDocumentMemberByEmail,
  createDocumentShareLink,
  ensureCollaborationDocument,
  listDocumentMembers,
  listDocumentShareLinks,
  resolveBackendUrl,
  revokeDocumentShareLink,
  type BackendAccess,
  type BackendDocument,
  type BackendMember,
  type BackendShareLink,
  type BackendUser,
  type BackendUserRole,
} from "../editor/backendClient";
import { useWorkspaceSharingStore } from "../stores/workspaceSharing";

type WorkspaceSharingMessages = {
  ensureFailed: ComputedRef<string>;
};

type UseWorkspaceSharingOptions = {
  visible: ComputedRef<boolean>;
  workspaceEnabled: ComputedRef<boolean>;
  collaborationUrl: ComputedRef<string>;
  collaborationDocumentName: ComputedRef<string>;
  collaborationField: ComputedRef<string>;
  sessionUser: ComputedRef<BackendUser | null | undefined>;
  document: ComputedRef<BackendDocument | null | undefined>;
  documentAccess: ComputedRef<BackendAccess | null | undefined>;
  messages: WorkspaceSharingMessages;
};

export const useWorkspaceSharing = ({
  visible,
  workspaceEnabled,
  collaborationUrl,
  collaborationDocumentName,
  collaborationField,
  sessionUser,
  document,
  documentAccess,
  messages,
}: UseWorkspaceSharingOptions) => {
  const workspaceSharingStore = useWorkspaceSharingStore();
  const {
    workspaceLoading,
    workspaceError,
    currentDocument,
    documentAccess: currentDocumentAccess,
    members,
    shareLinks,
  } = storeToRefs(workspaceSharingStore);

  const backendUrl = computed(() => resolveBackendUrl(collaborationUrl.value));
  const canManageSharing = computed(
    () => currentDocumentAccess.value?.capabilities.canManage === true && !!currentDocument.value
  );

  const resolveWorkspaceDocument = async () => {
    if (document.value) {
      currentDocument.value = document.value;
      currentDocumentAccess.value = documentAccess.value || null;
      return currentDocument.value;
    }

    const ensured = await ensureCollaborationDocument(backendUrl.value, {
      name: collaborationDocumentName.value,
      title: collaborationDocumentName.value,
      field: collaborationField.value,
    });
    currentDocument.value = ensured.document;
    currentDocumentAccess.value = ensured.access;
    return currentDocument.value;
  };

  const refreshWorkspaceSharing = async () => {
    workspaceSharingStore.resetWorkspaceSharingState();

    if (!visible.value || !workspaceEnabled.value || !sessionUser.value) {
      return;
    }

    workspaceLoading.value = true;
    try {
      await resolveWorkspaceDocument();
      if (!canManageSharing.value || !currentDocument.value) {
        return;
      }

      const [memberResult, shareResult] = await Promise.all([
        listDocumentMembers(backendUrl.value, currentDocument.value.id),
        listDocumentShareLinks(backendUrl.value, currentDocument.value.id),
      ]);
      members.value = memberResult.members;
      shareLinks.value = shareResult.shareLinks;
    } catch (error) {
      workspaceError.value =
        error instanceof Error ? error.message || String(error) : messages.ensureFailed.value;
    } finally {
      workspaceLoading.value = false;
    }
  };

  const refreshMembers = async () => {
    if (!currentDocument.value || !canManageSharing.value) {
      members.value = [];
      return [] as BackendMember[];
    }
    const memberResult = await listDocumentMembers(backendUrl.value, currentDocument.value.id);
    members.value = memberResult.members;
    return memberResult.members;
  };

  const refreshShareLinks = async () => {
    if (!currentDocument.value || !canManageSharing.value) {
      shareLinks.value = [];
      return [] as BackendShareLink[];
    }
    const shareResult = await listDocumentShareLinks(backendUrl.value, currentDocument.value.id);
    shareLinks.value = shareResult.shareLinks;
    return shareResult.shareLinks;
  };

  const inviteMember = async (payload: {
    email: string;
    role: Exclude<BackendUserRole, "owner">;
  }) => {
    if (!currentDocument.value || !canManageSharing.value) {
      return null;
    }
    const result = await addDocumentMemberByEmail(backendUrl.value, currentDocument.value.id, payload);
    await refreshMembers();
    return result.member;
  };

  const createShareLink = async (payload: {
    role: Exclude<BackendUserRole, "owner">;
    allowAnonymous: boolean;
  }) => {
    if (!currentDocument.value || !canManageSharing.value) {
      return null;
    }
    const result = await createDocumentShareLink(backendUrl.value, currentDocument.value.id, payload);
    await refreshShareLinks();
    return result.shareLink;
  };

  const revokeShareLink = async (shareId: string) => {
    if (!currentDocument.value || !canManageSharing.value) {
      return null;
    }
    const result = await revokeDocumentShareLink(backendUrl.value, shareId);
    await refreshShareLinks();
    return result.shareLink;
  };

  watch(
    () => [
      visible.value,
      workspaceEnabled.value,
      backendUrl.value,
      sessionUser.value?.id || "",
      document.value?.id || "",
      documentAccess.value?.role || "",
      documentAccess.value?.permissionMode || "",
      documentAccess.value?.capabilities.canManage === true ? "manage" : "readonly",
      collaborationDocumentName.value,
      collaborationField.value,
    ],
    async ([nextVisible]) => {
      if (!nextVisible) {
        workspaceSharingStore.resetWorkspaceSharingState();
        return;
      }
      await refreshWorkspaceSharing();
    },
    { immediate: true }
  );

  return {
    workspaceLoading,
    workspaceError,
    currentDocument,
    documentAccess: currentDocumentAccess,
    members,
    shareLinks,
    refreshWorkspaceSharing,
    inviteMember,
    createShareLink,
    revokeShareLink,
  };
};
