<template>
  <aside class="doc-collaboration-panel">
    <div class="doc-collaboration-panel-header">
      <div class="doc-collaboration-panel-heading">
        <span class="doc-collaboration-panel-title">{{ texts.title }}</span>
        <span class="doc-collaboration-panel-summary">{{ summaryLabel }}</span>
      </div>
    </div>

    <div class="doc-collaboration-panel-toolbar">
      <t-tag size="small" variant="light" :theme="props.state.enabled ? 'success' : 'default'">
        {{ props.state.enabled ? texts.enabled : texts.disabled }}
      </t-tag>
      <t-button size="small" variant="outline" @click="settingsOpen = !settingsOpen">
        {{ settingsOpen ? texts.hideSettings : texts.showSettings }}
      </t-button>
    </div>

    <div class="doc-collaboration-panel-summary-card">
      <div class="doc-collaboration-panel-summary-row">
        <span class="doc-collaboration-panel-label">{{ texts.currentDocument }}</span>
        <span class="doc-collaboration-panel-value">
          {{ props.document?.title || props.state.documentName || "-" }}
        </span>
      </div>
      <div class="doc-collaboration-panel-summary-row">
        <span class="doc-collaboration-panel-label">{{ texts.currentUser }}</span>
        <span class="doc-collaboration-panel-value">
          {{ props.backendUser?.displayName || props.state.userName || "-" }}
        </span>
      </div>
      <div class="doc-collaboration-panel-summary-row">
        <span class="doc-collaboration-panel-label">{{ texts.currentRole }}</span>
        <span class="doc-collaboration-panel-value">
          {{ roleLabel(props.access?.role || null) }}
        </span>
      </div>
      <div class="doc-collaboration-panel-summary-row">
        <span class="doc-collaboration-panel-label">{{ texts.currentPermission }}</span>
        <span class="doc-collaboration-panel-value">
          {{ permissionLabel }}
        </span>
      </div>
      <div class="doc-collaboration-panel-mode">
        <t-tag size="small" variant="light" :theme="props.backendManaged ? 'primary' : 'default'">
          {{ props.backendManaged ? texts.managedByBackend : texts.localMode }}
        </t-tag>
      </div>
      <p v-if="authHint" class="doc-collaboration-panel-note">{{ authHint }}</p>
      <p v-if="props.accessError" class="doc-collaboration-panel-error">
        {{ texts.accessError }}: {{ props.accessError }}
      </p>
    </div>

    <div class="doc-collaboration-panel-presence">
      <CollaborationPresence v-if="props.state.enabled" :state="props.state" :locale="currentLocale" />
      <div v-else class="doc-collaboration-panel-empty">
        <p class="doc-collaboration-panel-empty-title">{{ texts.emptyTitle }}</p>
        <p class="doc-collaboration-panel-empty-copy">{{ texts.emptyCopy }}</p>
      </div>
    </div>

    <div v-if="settingsOpen" class="doc-collaboration-panel-settings">
      <div class="doc-collaboration-panel-field">
        <span class="doc-collaboration-panel-label">{{ texts.url }}</span>
        <t-input
          :model-value="draft.url"
          :placeholder="texts.urlPlaceholder"
          @update:model-value="handleFieldChange('url', $event)"
        />
      </div>

      <div class="doc-collaboration-panel-field">
        <span class="doc-collaboration-panel-label">{{ texts.document }}</span>
        <t-input
          :model-value="draft.documentName"
          :placeholder="texts.documentPlaceholder"
          @update:model-value="handleFieldChange('documentName', $event)"
        />
      </div>

      <div class="doc-collaboration-panel-field">
        <span class="doc-collaboration-panel-label">{{ texts.field }}</span>
        <t-input
          :model-value="draft.field"
          :placeholder="texts.fieldPlaceholder"
          @update:model-value="handleFieldChange('field', $event)"
        />
      </div>

      <div class="doc-collaboration-panel-field">
        <span class="doc-collaboration-panel-label">{{ texts.token }}</span>
        <t-input
          :model-value="draft.token"
          :placeholder="texts.tokenPlaceholder"
          @update:model-value="handleFieldChange('token', $event)"
        />
      </div>

      <div class="doc-collaboration-panel-field">
        <span class="doc-collaboration-panel-label">{{ texts.userName }}</span>
        <t-input
          :model-value="draft.userName"
          :placeholder="texts.userNamePlaceholder"
          @update:model-value="handleFieldChange('userName', $event)"
        />
      </div>

      <div class="doc-collaboration-panel-field">
        <span class="doc-collaboration-panel-label">{{ texts.userColor }}</span>
        <div class="doc-collaboration-panel-color-row">
          <span
            class="doc-collaboration-panel-color-preview"
            :style="{ '--collaboration-color-preview': normalizedColor }"
          ></span>
          <t-input
            :model-value="draft.userColor"
            :placeholder="texts.userColorPlaceholder"
            @update:model-value="handleFieldChange('userColor', $event)"
          />
        </div>
      </div>

      <p class="doc-collaboration-panel-note">{{ texts.reloadHint }}</p>
    </div>

    <div class="doc-collaboration-panel-actions">
      <t-button
        size="small"
        theme="primary"
        :loading="props.busy"
        data-collaboration-action="apply"
        @click="handleApply"
      >
        {{ props.state.enabled ? texts.update : texts.enable }}
      </t-button>
      <t-button size="small" variant="outline" :disabled="props.busy" @click="handleReset">
        {{ texts.reset }}
      </t-button>
      <t-button
        v-if="props.state.enabled"
        size="small"
        theme="danger"
        variant="outline"
        :disabled="props.busy"
        data-collaboration-action="disable"
        @click="handleDisable"
      >
        {{ texts.disable }}
      </t-button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";

import type { BackendAccess, BackendDocument, BackendUser, BackendUserRole } from "../editor/backendClient";
import type { PlaygroundLocale } from "../editor/i18n";
import { coercePlaygroundLocale, createPlaygroundI18n } from "../editor/i18n";
import type { LumenCollaborationState } from "../editor/collaboration";
import CollaborationPresence from "./CollaborationPresence.vue";

const DEFAULT_COLLAB_URL = "ws://localhost:1234";
const DEFAULT_COLLAB_DOC = "lumen-demo";
const DEFAULT_COLLAB_FIELD = "default";
const DEFAULT_COLLAB_COLOR = "#2563eb";

const props = defineProps<{
  locale?: PlaygroundLocale | string;
  state: LumenCollaborationState;
  backendUser?: BackendUser | null;
  document?: BackendDocument | null;
  access?: BackendAccess | null;
  effectivePermissionMode?: "full" | "comment" | "readonly";
  backendManaged?: boolean;
  accessError?: string | null;
  collaborationToken?: string;
  busy?: boolean;
}>();

const emit = defineEmits<{
  (event: "apply", value: {
    enabled: boolean;
    collaborationUrl: string;
    collaborationDocument: string;
    collaborationField: string;
    collaborationToken: string;
    collaborationUserName: string;
    collaborationUserColor: string;
  }): void;
}>();

const currentLocale = computed<PlaygroundLocale>(() => coercePlaygroundLocale(props.locale));
const texts = computed(() => createPlaygroundI18n(currentLocale.value).collaborationPanel);
const roleTexts = computed(() => createPlaygroundI18n(currentLocale.value).shareDialog);
const appTexts = computed(() => createPlaygroundI18n(currentLocale.value).app);
const settingsOpen = ref(false);
const draft = reactive({
  url: DEFAULT_COLLAB_URL,
  documentName: DEFAULT_COLLAB_DOC,
  field: DEFAULT_COLLAB_FIELD,
  token: "",
  userName: "",
  userColor: DEFAULT_COLLAB_COLOR,
});

const normalizedColor = computed(() => {
  const value = String(draft.userColor || "").trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value : DEFAULT_COLLAB_COLOR;
});

const summaryLabel = computed(() => {
  if (!props.state.enabled) {
    return texts.value.disabled;
  }
  if (props.state.synced) {
    return texts.value.synced;
  }
  return texts.value.connecting;
});

const roleLabel = (role: BackendUserRole | null) => {
  if (role === "owner") return roleTexts.value.roleOwner;
  if (role === "editor") return roleTexts.value.roleEditor;
  if (role === "commenter") return roleTexts.value.roleCommenter;
  if (role === "viewer") return roleTexts.value.roleViewer;
  return roleTexts.value.roleUnknown;
};

const permissionLabel = computed(() => {
  const mode = props.effectivePermissionMode || "readonly";
  if (mode === "full") {
    return appTexts.value.permissionEdit;
  }
  if (mode === "comment") {
    return appTexts.value.permissionComment;
  }
  return appTexts.value.permissionReadonly;
});

const authHint = computed(() => {
  if (!props.state.enabled) {
    return "";
  }
  if (props.backendManaged && props.backendUser) {
    return "";
  }
  return texts.value.authHint;
});

const syncDraftFromState = () => {
  draft.url = String(props.state.url || DEFAULT_COLLAB_URL).trim() || DEFAULT_COLLAB_URL;
  draft.documentName =
    String(props.state.documentName || DEFAULT_COLLAB_DOC).trim() || DEFAULT_COLLAB_DOC;
  draft.field = String(props.state.field || DEFAULT_COLLAB_FIELD).trim() || DEFAULT_COLLAB_FIELD;
  draft.token = String(props.collaborationToken || "").trim();
  draft.userName = String(props.state.userName || "").trim();
  draft.userColor = String(props.state.userColor || DEFAULT_COLLAB_COLOR).trim() || DEFAULT_COLLAB_COLOR;
};

const handleFieldChange = (
  field: "url" | "documentName" | "field" | "token" | "userName" | "userColor",
  value: string | number
) => {
  draft[field] = String(value ?? "");
};

const buildPayload = (enabled: boolean) => {
  return {
    enabled,
    collaborationUrl: draft.url.trim() || DEFAULT_COLLAB_URL,
    collaborationDocument: draft.documentName.trim() || DEFAULT_COLLAB_DOC,
    collaborationField: draft.field.trim() || DEFAULT_COLLAB_FIELD,
    collaborationToken: draft.token.trim(),
    collaborationUserName: draft.userName.trim() || props.state.userName || "",
    collaborationUserColor: normalizedColor.value,
  };
};

const handleApply = () => {
  emit("apply", buildPayload(true));
};

const handleDisable = () => {
  emit("apply", buildPayload(false));
};

const handleReset = () => {
  syncDraftFromState();
};

watch(
  () => props.state,
  () => {
    syncDraftFromState();
  },
  { immediate: true, deep: true }
);
</script>

<style scoped>
.doc-collaboration-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  padding: 14px;
  background: #ffffff;
}

.doc-collaboration-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.doc-collaboration-panel-heading {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.doc-collaboration-panel-title {
  font-size: 14px;
  line-height: 1.2;
  font-weight: 700;
  color: #0f172a;
}

.doc-collaboration-panel-summary {
  font-size: 12px;
  line-height: 1.4;
  color: #64748b;
}

.doc-collaboration-panel-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.doc-collaboration-panel-presence {
  min-height: 0;
}

.doc-collaboration-panel-summary-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(241, 245, 249, 0.96), rgba(248, 250, 252, 0.88));
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.doc-collaboration-panel-summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.doc-collaboration-panel-value {
  font-size: 12px;
  line-height: 1.5;
  font-weight: 600;
  color: #0f172a;
  text-align: right;
  word-break: break-word;
}

.doc-collaboration-panel-mode {
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.doc-collaboration-panel-error {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: #b91c1c;
}

.doc-collaboration-panel-empty {
  padding: 14px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px dashed rgba(148, 163, 184, 0.35);
}

.doc-collaboration-panel-empty-title {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  font-weight: 700;
  color: #0f172a;
}

.doc-collaboration-panel-empty-copy {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: #64748b;
}

.doc-collaboration-panel-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.doc-collaboration-panel-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.doc-collaboration-panel-label {
  font-size: 11px;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #475569;
}

.doc-collaboration-panel-color-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.doc-collaboration-panel-color-preview {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  flex: 0 0 auto;
  background: var(--collaboration-color-preview);
  border: 2px solid rgba(255, 255, 255, 0.92);
  box-shadow:
    0 0 0 1px rgba(148, 163, 184, 0.35),
    0 6px 12px rgba(15, 23, 42, 0.08);
}

.doc-collaboration-panel-note {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: #64748b;
}

.doc-collaboration-panel-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

:global(.doc-shell.is-high-contrast) .doc-collaboration-panel {
  background: #000000;
}

:global(.doc-shell.is-high-contrast) .doc-collaboration-panel-title,
:global(.doc-shell.is-high-contrast) .doc-collaboration-panel-empty-title,
:global(.doc-shell.is-high-contrast) .doc-collaboration-panel-value {
  color: #ffffff;
}

:global(.doc-shell.is-high-contrast) .doc-collaboration-panel-summary,
:global(.doc-shell.is-high-contrast) .doc-collaboration-panel-empty-copy,
:global(.doc-shell.is-high-contrast) .doc-collaboration-panel-note,
:global(.doc-shell.is-high-contrast) .doc-collaboration-panel-label {
  color: rgba(255, 255, 255, 0.72);
}

:global(.doc-shell.is-high-contrast) .doc-collaboration-panel-empty {
  background: #0f172a;
  border-color: rgba(255, 255, 255, 0.24);
}

:global(.doc-shell.is-high-contrast) .doc-collaboration-panel-summary-card {
  background: #0f172a;
  border-color: rgba(255, 255, 255, 0.18);
}

:global(.doc-shell.is-high-contrast) .doc-collaboration-panel-error {
  color: #fca5a5;
}
</style>
