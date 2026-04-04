<template>
  <t-dialog
    :visible="props.visible"
    :header="texts.accountTitle"
    width="520px"
    :footer="false"
    @update:visible="handleVisibleChange"
    @close="handleClose"
  >
    <div class="doc-account-dialog">
      <div class="doc-account-section">
        <div class="doc-account-section-header">
          <span class="doc-account-section-title">{{ texts.backendUrl }}</span>
        </div>
        <div class="doc-account-inline-row">
          <t-input
            :model-value="backendUrlDraft"
            :placeholder="texts.backendUrlPlaceholder"
            @update:model-value="handleBackendUrlChange"
          />
          <t-button size="small" variant="outline" @click="handleSaveBackendUrl">
            {{ texts.saveBackendUrl }}
          </t-button>
        </div>
      </div>

      <div class="doc-account-section">
        <div class="doc-account-section-header">
          <span class="doc-account-section-title">
            {{ sessionUser ? texts.signedInAs : texts.loggedOut }}
          </span>
        </div>

        <template v-if="sessionUser">
          <div class="doc-account-summary">
            <div class="doc-account-summary-name">{{ sessionUser.displayName }}</div>
            <div class="doc-account-summary-email">{{ sessionUser.email }}</div>
          </div>
          <div class="doc-account-inline-row">
            <t-button size="small" variant="outline" @click="handleLogout">
              {{ texts.logout }}
            </t-button>
          </div>
        </template>

        <template v-else>
          <div class="doc-account-auth-tabs">
            <button
              type="button"
              class="doc-account-auth-tab"
              :class="{ 'is-active': authMode === 'login' }"
              @click="authMode = 'login'"
            >
              {{ texts.login }}
            </button>
            <button
              type="button"
              class="doc-account-auth-tab"
              :class="{ 'is-active': authMode === 'register' }"
              @click="authMode = 'register'"
            >
              {{ texts.register }}
            </button>
          </div>
          <div class="doc-account-auth-grid">
            <div class="doc-account-field">
              <span class="doc-account-label">{{ texts.email }}</span>
              <t-input
                :model-value="authDraft.email"
                :placeholder="texts.emailPlaceholder"
                @update:model-value="(value) => handleAuthFieldChange('email', value)"
              />
            </div>
            <div class="doc-account-field">
              <span class="doc-account-label">{{ texts.password }}</span>
              <t-input
                type="password"
                :model-value="authDraft.password"
                :placeholder="texts.passwordPlaceholder"
                @update:model-value="(value) => handleAuthFieldChange('password', value)"
              />
            </div>
            <div v-if="authMode === 'register'" class="doc-account-field doc-account-field-full">
              <span class="doc-account-label">{{ texts.displayName }}</span>
              <t-input
                :model-value="authDraft.displayName"
                :placeholder="texts.displayNamePlaceholder"
                @update:model-value="(value) => handleAuthFieldChange('displayName', value)"
              />
            </div>
          </div>
          <div class="doc-account-inline-row">
            <t-button :loading="authLoading" theme="primary" @click="handleAuthenticate">
              {{ authLoading ? texts.authenticating : texts.authenticate }}
            </t-button>
          </div>
        </template>
      </div>
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import { MessagePlugin } from "tdesign-vue-next/es/message/plugin";
import { computed, reactive, ref, watch } from "vue";
import {
  loginBackendUser,
  logoutBackendUser,
  registerBackendUser,
  type BackendUser,
} from "../editor/backendClient";
import { useBackendConnection } from "../composables/useBackendConnection";
import type { LumenCollaborationState } from "../editor/collaboration";
import { coercePlaygroundLocale, createPlaygroundI18n, type PlaygroundLocale } from "../editor/i18n";

const props = defineProps<{
  visible: boolean;
  locale?: PlaygroundLocale | string;
  collaborationState: LumenCollaborationState;
  initialMode?: "login" | "register";
}>();

const emit = defineEmits<{
  (event: "update:visible", value: boolean): void;
  (event: "session-change", value: BackendUser | null): void;
}>();

const currentLocale = computed<PlaygroundLocale>(() => coercePlaygroundLocale(props.locale));
const texts = computed(() => createPlaygroundI18n(currentLocale.value).shareDialog);
const { backendUrl, sessionUser, saveBackendUrl, setSessionUser, refreshSession } = useBackendConnection({
  fallbackUrl: computed(() => props.collaborationState.url),
});

const backendUrlDraft = ref(backendUrl.value);
const authMode = ref<"login" | "register">(props.initialMode || "login");
const authLoading = ref(false);
const authDraft = reactive({
  email: "",
  password: "",
  displayName: "",
});

const refreshAccountSession = async (emitChange = true) => {
  const user = await refreshSession();
  if (emitChange) {
    emit("session-change", user);
  }
};

const initializeDialog = async () => {
  backendUrlDraft.value = backendUrl.value;
  authMode.value = props.initialMode || "login";
  try {
    await refreshAccountSession(false);
  } catch (error) {
    setSessionUser(null);
    MessagePlugin.warning(error instanceof Error ? error.message || texts.value.loadFailed : texts.value.loadFailed);
  }
};

const handleVisibleChange = (nextVisible: boolean) => {
  emit("update:visible", nextVisible);
};

const handleClose = () => {
  emit("update:visible", false);
};

const handleBackendUrlChange = (value: string | number) => {
  backendUrlDraft.value = String(value ?? "");
};

const handleSaveBackendUrl = async () => {
  backendUrlDraft.value = saveBackendUrl(backendUrlDraft.value);
  await initializeDialog();
  MessagePlugin.success(texts.value.saveBackendUrl);
};

const handleAuthFieldChange = (field: "email" | "password" | "displayName", value: string | number) => {
  authDraft[field] = String(value ?? "");
};

const handleAuthenticate = async () => {
  authLoading.value = true;
  try {
    backendUrlDraft.value = saveBackendUrl(backendUrlDraft.value);
    let authenticatedUser: BackendUser;
    if (authMode.value === "register") {
      const result = await registerBackendUser(backendUrl.value, {
        email: authDraft.email.trim(),
        password: authDraft.password,
        displayName: authDraft.displayName.trim() || authDraft.email.trim(),
      });
      authenticatedUser = result.user;
    } else {
      const result = await loginBackendUser(backendUrl.value, {
        email: authDraft.email.trim(),
        password: authDraft.password,
      });
      authenticatedUser = result.user;
    }

    setSessionUser(authenticatedUser);
    authDraft.password = "";
    MessagePlugin.success(texts.value.authSuccess);
    emit("session-change", authenticatedUser);
    emit("update:visible", false);
  } catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message || texts.value.authFailed : texts.value.authFailed);
  } finally {
    authLoading.value = false;
  }
};

const handleLogout = async () => {
  try {
    backendUrlDraft.value = saveBackendUrl(backendUrlDraft.value);
    await logoutBackendUser(backendUrl.value);
    setSessionUser(null);
    emit("session-change", null);
    MessagePlugin.success(texts.value.logoutSuccess);
    emit("update:visible", false);
  } catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message || texts.value.authFailed : texts.value.authFailed);
  }
};

watch(
  () => props.visible,
  async (visible) => {
    if (!visible) {
      return;
    }
    await initializeDialog();
  },
  { immediate: true }
);

watch(
  () => props.initialMode,
  (mode) => {
    if (mode === "login" || mode === "register") {
      authMode.value = mode;
    }
  }
);
</script>

<style scoped>
.doc-account-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.doc-account-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.96), rgba(255, 255, 255, 0.98));
}

.doc-account-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.doc-account-section-title {
  font-size: 13px;
  line-height: 1.3;
  font-weight: 700;
  color: #0f172a;
}

.doc-account-inline-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.doc-account-inline-row > :deep(*) {
  min-width: 0;
}

.doc-account-inline-row > :deep(.t-input) {
  flex: 1 1 auto;
}

.doc-account-auth-tabs {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px;
  border-radius: 12px;
  background: #f1f5f9;
  width: fit-content;
}

.doc-account-auth-tab {
  border: none;
  background: transparent;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  padding: 8px 12px;
  border-radius: 10px;
  cursor: pointer;
}

.doc-account-auth-tab.is-active {
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
}

.doc-account-auth-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.doc-account-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.doc-account-field-full {
  grid-column: 1 / -1;
}

.doc-account-label {
  font-size: 11px;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #475569;
}

.doc-account-summary {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.doc-account-summary-name {
  font-size: 14px;
  line-height: 1.3;
  font-weight: 700;
  color: #0f172a;
}

.doc-account-summary-email {
  font-size: 12px;
  line-height: 1.5;
  color: #475569;
}

@media (max-width: 720px) {
  .doc-account-auth-grid {
    grid-template-columns: 1fr;
  }

  .doc-account-inline-row {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
