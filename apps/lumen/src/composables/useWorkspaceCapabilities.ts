import { computed, ref, type ComputedRef, type Ref } from "vue";
import type { BackendAccess, BackendCapabilities, BackendUser } from "../editor/backendClient";
import type { LumenCollaborationState } from "../editor/collaboration";
import {
  setPlaygroundCollaborationSettings,
  type PlaygroundCollaborationSettings,
  type PlaygroundDebugFlags,
} from "../editor/config";
import type { PlaygroundI18n } from "../editor/i18n";
import type { EditorSessionMode } from "../editor/sessionMode";

type UseWorkspaceCapabilitiesOptions = {
  debugFlags: PlaygroundDebugFlags;
  i18n: ComputedRef<PlaygroundI18n>;
  translate: (key: string, params?: Record<string, unknown>) => string;
  routeDocumentId: ComputedRef<string>;
  workspaceAccessEnabled: ComputedRef<boolean>;
  realtimeCollaborationEnabled: ComputedRef<boolean>;
  backendSessionUser: Ref<BackendUser | null>;
  backendDocumentAccess: Ref<BackendAccess | null>;
  backendAccessBound: Ref<boolean>;
  collaborationState: Ref<LumenCollaborationState>;
  flushPendingSnapshotSave: () => Promise<unknown> | void;
  loadWorkspace: (options?: { withCollabTicket?: boolean }) => Promise<unknown>;
};

const buildPermissionCapabilities = (
  permissionMode: "full" | "comment" | "readonly",
): BackendCapabilities => ({
  canView: true,
  canComment: permissionMode === "full" || permissionMode === "comment",
  canEdit: permissionMode === "full",
  canManage: permissionMode === "full",
  permissionMode,
});

export const useWorkspaceCapabilities = ({
  debugFlags,
  i18n,
  translate,
  routeDocumentId,
  workspaceAccessEnabled,
  realtimeCollaborationEnabled,
  backendSessionUser,
  backendDocumentAccess,
  backendAccessBound,
  collaborationState,
  flushPendingSnapshotSave,
  loadWorkspace,
}: UseWorkspaceCapabilitiesOptions) => {
  const sessionMode = ref<EditorSessionMode>(
    debugFlags.permissionMode === "readonly" ? "viewer" : "edit",
  );
  const collaborationSwitching = ref(false);

  const effectiveCapabilities = computed(() => {
    if (backendDocumentAccess.value?.capabilities) {
      return backendDocumentAccess.value.capabilities;
    }
    if (routeDocumentId.value.length > 0 && !realtimeCollaborationEnabled.value) {
      return buildPermissionCapabilities("readonly");
    }
    if (workspaceAccessEnabled.value && (backendAccessBound.value || backendSessionUser.value)) {
      return buildPermissionCapabilities("readonly");
    }
    return buildPermissionCapabilities(debugFlags.permissionMode);
  });

  const effectivePermissionMode = computed(() => effectiveCapabilities.value.permissionMode);
  const canWriteLocalSnapshot = computed(
    () => effectiveCapabilities.value.canEdit || effectiveCapabilities.value.canComment,
  );
  const permissionLabel = computed(() => {
    if (effectivePermissionMode.value === "readonly" || sessionMode.value === "viewer") {
      return i18n.value.app.permissionReadonly;
    }
    if (effectivePermissionMode.value === "comment") {
      return i18n.value.app.permissionComment;
    }
    return i18n.value.app.permissionEdit;
  });
  const canMutateComments = computed(
    () => effectiveCapabilities.value.canComment && sessionMode.value !== "viewer",
  );
  const currentCommentUserName = computed(
    () =>
      String(backendSessionUser.value?.displayName || "").trim() ||
      (realtimeCollaborationEnabled.value ? collaborationState.value.userName : "") ||
      i18n.value.shell.you,
  );
  const canManageAssistant = computed(
    () => effectiveCapabilities.value.canEdit && sessionMode.value !== "viewer",
  );
  const canMutateTrackChanges = computed(
    () => effectiveCapabilities.value.canEdit && sessionMode.value !== "viewer",
  );
  const topbarAvatarText = computed(() => {
    const seed =
      String(backendSessionUser.value?.displayName || "").trim() ||
      (realtimeCollaborationEnabled.value
        ? String(collaborationState.value.userName || "").trim()
        : "") ||
      i18n.value.shell.you;
    return seed.slice(0, 1).toUpperCase() || "U";
  });

  const handleCollaborationApply = async (settings: {
    enabled: boolean;
    collaborationUrl: string;
    collaborationDocument: string;
    collaborationField: string;
    collaborationToken: string;
    collaborationUserName: string;
    collaborationUserColor: string;
  }) => {
    if (collaborationSwitching.value) {
      return;
    }
    collaborationSwitching.value = true;
    await flushPendingSnapshotSave();
    const nextSettings = setPlaygroundCollaborationSettings({
      collaborationEnabled: settings.enabled,
      collaborationUrl: settings.collaborationUrl,
      collaborationDocument: settings.collaborationDocument,
      collaborationField: settings.collaborationField,
      collaborationToken: settings.collaborationToken,
      collaborationUserName: settings.collaborationUserName,
      collaborationUserColor: settings.collaborationUserColor,
    } satisfies PlaygroundCollaborationSettings);
    Object.assign(debugFlags, nextSettings);
    try {
      await loadWorkspace({ withCollabTicket: true });
    } finally {
      collaborationSwitching.value = false;
    }
  };

  const handleSessionModeUpdate = (nextMode: EditorSessionMode) => {
    if (effectivePermissionMode.value === "readonly" && nextMode !== "viewer") {
      return;
    }
    sessionMode.value = nextMode;
  };

  return {
    sessionMode,
    collaborationSwitching,
    effectiveCapabilities,
    effectivePermissionMode,
    canWriteLocalSnapshot,
    permissionLabel,
    canMutateComments,
    currentCommentUserName,
    canManageAssistant,
    canMutateTrackChanges,
    topbarAvatarText,
    trackChangesCountLabel: (count: number) =>
      count > 0 ? translate("shell.trackChangesCount", { count }) : i18n.value.shell.trackChanges,
    handleCollaborationApply,
    handleSessionModeUpdate,
  };
};
