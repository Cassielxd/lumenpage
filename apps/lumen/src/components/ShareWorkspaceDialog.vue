<template>
  <t-dialog
    :visible="props.visible"
    :header="texts.title"
    width="760px"
    :footer="false"
    @update:visible="handleVisibleChange"
    @close="handleClose"
  >
    <div class="doc-share-dialog">
      <div class="doc-share-section">
        <div class="doc-share-section-header">
          <span class="doc-share-section-title">
            {{ props.sessionUser ? texts.signedInAs : texts.loggedOut }}
          </span>
          <t-button size="small" variant="outline" @click="emit('request-auth')">
            {{ props.sessionUser ? texts.manageAccount : texts.openAccount }}
          </t-button>
        </div>
        <div v-if="props.sessionUser" class="doc-share-account-summary">
          <div class="doc-share-account-name">{{ props.sessionUser.displayName }}</div>
          <div class="doc-share-account-email">{{ props.sessionUser.email }}</div>
        </div>
      </div>

      <div v-if="!props.collaborationEnabled" class="doc-share-empty">
        <p class="doc-share-empty-title">{{ texts.collaborationRequired }}</p>
        <p class="doc-share-empty-copy">{{ texts.collaborationRequiredHint }}</p>
      </div>

      <div v-else-if="!props.sessionUser" class="doc-share-empty">
        <p class="doc-share-empty-title">{{ texts.authRequired }}</p>
        <p class="doc-share-empty-copy">{{ texts.authRequiredHint }}</p>
        <div class="doc-share-inline-row">
          <t-button size="small" theme="primary" @click="emit('request-auth')">
            {{ texts.openAccount }}
          </t-button>
        </div>
      </div>

      <template v-else>
        <div class="doc-share-section">
          <div class="doc-share-section-header">
            <span class="doc-share-section-title">{{ texts.currentDocument }}</span>
            <t-tag v-if="documentAccess" size="small" theme="primary" variant="light">
              {{ roleLabel(documentAccess.role) }}
            </t-tag>
          </div>
          <div v-if="workspaceLoading" class="doc-share-loading">{{ texts.authenticating }}...</div>
          <div v-else-if="currentDocument" class="doc-share-current-document">
            <div class="doc-share-current-title">{{ currentDocument.title }}</div>
            <div class="doc-share-current-meta">
              <span>{{ currentDocument.name }}</span>
              <span>/</span>
              <span>{{ currentDocument.field }}</span>
            </div>
          </div>
        </div>

        <template v-if="currentDocument && documentAccess?.capabilities.canManage">
          <div class="doc-share-grid">
            <section class="doc-share-section">
              <div class="doc-share-section-header">
                <span class="doc-share-section-title">{{ texts.inviteMember }}</span>
              </div>
              <div class="doc-share-form-grid">
                <div class="doc-share-field doc-share-field-full">
                  <span class="doc-share-label">{{ texts.email }}</span>
                  <t-input
                    :model-value="inviteDraft.email"
                    :placeholder="texts.emailPlaceholder"
                    @update:model-value="(value) => (inviteDraft.email = String(value ?? ''))"
                  />
                </div>
                <div class="doc-share-field">
                  <span class="doc-share-label">{{ texts.inviteRole }}</span>
                  <t-select
                    :model-value="inviteDraft.role"
                    :options="roleOptions"
                    @update:model-value="(value) => (inviteDraft.role = coerceMemberRole(value))"
                  />
                </div>
              </div>
              <div class="doc-share-inline-row">
                <t-button size="small" theme="primary" @click="handleInviteMember">
                  {{ texts.inviteAction }}
                </t-button>
              </div>
              <div class="doc-share-list">
                <div v-if="members.length === 0" class="doc-share-list-empty">{{ texts.noMembers }}</div>
                <div v-for="member in members" :key="member.user.id" class="doc-share-list-item">
                  <div class="doc-share-list-copy">
                    <span class="doc-share-list-title">{{ member.user.displayName }}</span>
                    <span class="doc-share-list-meta">{{ member.user.email }}</span>
                  </div>
                  <t-tag size="small" variant="light">{{ roleLabel(member.role) }}</t-tag>
                </div>
              </div>
            </section>

            <section class="doc-share-section">
              <div class="doc-share-section-header">
                <span class="doc-share-section-title">{{ texts.shareLinks }}</span>
              </div>
              <div class="doc-share-form-grid">
                <div class="doc-share-field">
                  <span class="doc-share-label">{{ texts.shareRole }}</span>
                  <t-select
                    :model-value="shareDraft.role"
                    :options="roleOptions"
                    @update:model-value="(value) => (shareDraft.role = coerceMemberRole(value))"
                  />
                </div>
                <div class="doc-share-field">
                  <span class="doc-share-label">{{ texts.anonymousAccess }}</span>
                  <t-select
                    :model-value="shareDraft.allowAnonymous ? 'anonymous' : 'restricted'"
                    :options="anonymousOptions"
                    @update:model-value="(value) => (shareDraft.allowAnonymous = value === 'anonymous')"
                  />
                </div>
              </div>
              <div class="doc-share-inline-row">
                <t-button size="small" theme="primary" @click="handleCreateShareLink">
                  {{ texts.createShareLink }}
                </t-button>
              </div>
              <div class="doc-share-list">
                <div v-if="shareLinks.length === 0" class="doc-share-list-empty">
                  {{ texts.noShareLinks }}
                </div>
                <div v-for="shareLink in shareLinks" :key="shareLink.id" class="doc-share-list-item">
                  <div class="doc-share-list-copy">
                    <span class="doc-share-list-title">
                      {{ roleLabel(shareLink.role) }}
                      <span v-if="shareLink.allowAnonymous">/ {{ texts.createAnonymous }}</span>
                    </span>
                    <span class="doc-share-list-url">{{ shareLink.url || shareLink.token }}</span>
                  </div>
                  <div class="doc-share-list-actions">
                    <t-button size="small" variant="outline" @click="handleCopyShareLink(shareLink)">
                      {{ texts.copyLink }}
                    </t-button>
                    <t-button size="small" theme="danger" variant="outline" @click="handleRevokeShareLink(shareLink)">
                      {{ texts.revokeLink }}
                    </t-button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </template>

        <div v-else-if="currentDocument" class="doc-share-note">
          {{ texts.notOwnerHint }}
        </div>
      </template>
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import { MessagePlugin } from "tdesign-vue-next/es/message/plugin";
import { computed, reactive, ref, watch } from "vue";
import type { LumenCollaborationState } from "../editor/collaboration";
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
import { coercePlaygroundLocale, createPlaygroundI18n, type PlaygroundLocale } from "../editor/i18n";

const props = defineProps<{
  visible: boolean;
  locale?: PlaygroundLocale | string;
  collaborationEnabled: boolean;
  collaborationState: LumenCollaborationState;
  sessionUser?: BackendUser | null;
}>();

const emit = defineEmits<{
  (event: "update:visible", value: boolean): void;
  (event: "request-auth"): void;
}>();

const currentLocale = computed<PlaygroundLocale>(() => coercePlaygroundLocale(props.locale));
const texts = computed(() => createPlaygroundI18n(currentLocale.value).shareDialog);
const backendUrl = computed(() => resolveBackendUrl(props.collaborationState.url));
const workspaceLoading = ref(false);
const currentDocument = ref<BackendDocument | null>(null);
const documentAccess = ref<BackendAccess | null>(null);
const members = ref<BackendMember[]>([]);
const shareLinks = ref<BackendShareLink[]>([]);

const inviteDraft = reactive<{
  email: string;
  role: Exclude<BackendUserRole, "owner">;
}>({
  email: "",
  role: "viewer",
});

const shareDraft = reactive<{
  role: Exclude<BackendUserRole, "owner">;
  allowAnonymous: boolean;
}>({
  role: "viewer",
  allowAnonymous: true,
});

const roleLabel = (role: BackendUserRole | null) => {
  if (role === "owner") return texts.value.roleOwner;
  if (role === "editor") return texts.value.roleEditor;
  if (role === "commenter") return texts.value.roleCommenter;
  if (role === "viewer") return texts.value.roleViewer;
  return texts.value.roleUnknown;
};

const coerceMemberRole = (value: unknown): Exclude<BackendUserRole, "owner"> => {
  const normalized = String(value || "").trim();
  if (normalized === "editor" || normalized === "commenter") {
    return normalized;
  }
  return "viewer";
};

const roleOptions = computed(() => [
  { value: "viewer", label: texts.value.roleViewer },
  { value: "commenter", label: texts.value.roleCommenter },
  { value: "editor", label: texts.value.roleEditor },
]);

const anonymousOptions = computed(() => [
  { value: "anonymous", label: texts.value.createAnonymous },
  { value: "restricted", label: texts.value.createRestricted },
]);

const resetWorkspaceState = () => {
  currentDocument.value = null;
  documentAccess.value = null;
  members.value = [];
  shareLinks.value = [];
};

const refreshWorkspace = async () => {
  resetWorkspaceState();
  if (!props.collaborationEnabled || !props.sessionUser) {
    return;
  }

  workspaceLoading.value = true;
  try {
    const ensured = await ensureCollaborationDocument(backendUrl.value, {
      name: props.collaborationState.documentName,
      title: props.collaborationState.documentName,
      field: props.collaborationState.field,
    });
    currentDocument.value = ensured.document;
    documentAccess.value = ensured.access;

    if (ensured.access.capabilities.canManage) {
      const [memberResult, shareResult] = await Promise.all([
        listDocumentMembers(backendUrl.value, ensured.document.id),
        listDocumentShareLinks(backendUrl.value, ensured.document.id),
      ]);
      members.value = memberResult.members;
      shareLinks.value = shareResult.shareLinks;
    }
  } catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message || texts.value.ensureFailed : texts.value.ensureFailed);
  } finally {
    workspaceLoading.value = false;
  }
};

const handleVisibleChange = (nextVisible: boolean) => {
  emit("update:visible", nextVisible);
};

const handleClose = () => {
  emit("update:visible", false);
};

const handleInviteMember = async () => {
  if (!currentDocument.value) {
    return;
  }
  try {
    await addDocumentMemberByEmail(backendUrl.value, currentDocument.value.id, {
      email: inviteDraft.email.trim(),
      role: inviteDraft.role,
    });
    inviteDraft.email = "";
    const memberResult = await listDocumentMembers(backendUrl.value, currentDocument.value.id);
    members.value = memberResult.members;
    MessagePlugin.success(texts.value.inviteSuccess);
  } catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message || texts.value.inviteFailed : texts.value.inviteFailed);
  }
};

const handleCreateShareLink = async () => {
  if (!currentDocument.value) {
    return;
  }
  try {
    await createDocumentShareLink(backendUrl.value, currentDocument.value.id, {
      role: shareDraft.role,
      allowAnonymous: shareDraft.allowAnonymous,
    });
    const shareResult = await listDocumentShareLinks(backendUrl.value, currentDocument.value.id);
    shareLinks.value = shareResult.shareLinks;
    MessagePlugin.success(texts.value.createLinkSuccess);
  } catch (error) {
    MessagePlugin.error(
      error instanceof Error ? error.message || texts.value.createLinkFailed : texts.value.createLinkFailed,
    );
  }
};

const handleCopyShareLink = async (shareLink: BackendShareLink) => {
  const value = String(shareLink.url || "").trim();
  if (!value) {
    MessagePlugin.warning(texts.value.copyLinkFailed);
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
    MessagePlugin.success(texts.value.copyLinkSuccess);
  } catch (_error) {
    MessagePlugin.error(texts.value.copyLinkFailed);
  }
};

const handleRevokeShareLink = async (shareLink: BackendShareLink) => {
  try {
    await revokeDocumentShareLink(backendUrl.value, shareLink.id);
    if (currentDocument.value) {
      const shareResult = await listDocumentShareLinks(backendUrl.value, currentDocument.value.id);
      shareLinks.value = shareResult.shareLinks;
    }
    MessagePlugin.success(texts.value.revokeLinkSuccess);
  } catch (error) {
    MessagePlugin.error(
      error instanceof Error ? error.message || texts.value.revokeLinkFailed : texts.value.revokeLinkFailed,
    );
  }
};

watch(
  () => [props.visible, props.sessionUser?.id || "", props.collaborationState.documentName, props.collaborationState.field],
  async ([visible]) => {
    if (!visible) {
      return;
    }
    await refreshWorkspace();
  },
  { immediate: true }
);
</script>

<style scoped>
.doc-share-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.doc-share-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.doc-share-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.doc-share-section-title {
  font-size: 13px;
  line-height: 1.2;
  font-weight: 700;
  color: #0f172a;
}

.doc-share-inline-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.doc-share-account-summary {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.doc-share-account-name {
  font-size: 14px;
  line-height: 1.3;
  font-weight: 700;
  color: #0f172a;
}

.doc-share-account-email {
  font-size: 12px;
  line-height: 1.5;
  color: #475569;
}

.doc-share-grid,
.doc-share-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.doc-share-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.doc-share-field-full {
  grid-column: 1 / -1;
}

.doc-share-label {
  font-size: 11px;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #475569;
}

.doc-share-empty,
.doc-share-note {
  padding: 14px;
  border-radius: 14px;
  background: #eff6ff;
  color: #1e3a8a;
  border: 1px solid rgba(59, 130, 246, 0.18);
}

.doc-share-empty-title {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  font-weight: 700;
}

.doc-share-empty-copy {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.6;
}

.doc-share-current-document {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.doc-share-current-title {
  font-size: 15px;
  line-height: 1.3;
  font-weight: 700;
  color: #0f172a;
}

.doc-share-current-meta,
.doc-share-loading {
  font-size: 12px;
  line-height: 1.6;
  color: #64748b;
}

.doc-share-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.doc-share-list-empty {
  font-size: 12px;
  line-height: 1.6;
  color: #64748b;
}

.doc-share-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.doc-share-list-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.doc-share-list-title {
  font-size: 12px;
  line-height: 1.4;
  font-weight: 700;
  color: #0f172a;
}

.doc-share-list-meta,
.doc-share-list-url {
  font-size: 12px;
  line-height: 1.5;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.doc-share-list-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 768px) {
  .doc-share-inline-row,
  .doc-share-list-item {
    flex-direction: column;
    align-items: stretch;
  }

  .doc-share-grid,
  .doc-share-form-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
