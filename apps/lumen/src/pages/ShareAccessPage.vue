<template>
  <div class="doc-share-page">
    <header class="doc-share-page-topbar">
      <button type="button" class="doc-share-page-back" @click="goHome">
        {{ texts.backHome }}
      </button>
      <div class="doc-share-page-actions">
        <t-button size="small" variant="outline" @click="accountDialogVisible = true">
          {{ sessionUser ? sessionUser.displayName : i18n.shareDialog.login }}
        </t-button>
      </div>
    </header>

    <main class="doc-share-page-body">
      <section class="doc-share-page-card">
        <div v-if="loading" class="doc-share-page-empty">{{ texts.loading }}</div>
        <div v-else-if="errorMessage" class="doc-share-page-empty is-error">{{ errorMessage }}</div>
        <template v-else-if="document">
          <div class="doc-share-page-copy">
            <span class="doc-share-page-kicker">{{ texts.kicker }}</span>
            <h1 class="doc-share-page-title">{{ document.title }}</h1>
            <p class="doc-share-page-description">{{ texts.description }}</p>
          </div>
          <div class="doc-share-page-meta">
            <div class="doc-share-page-meta-item">
              <span class="doc-share-page-meta-label">{{ texts.documentName }}</span>
              <span>{{ document.name }}</span>
            </div>
            <div class="doc-share-page-meta-item">
              <span class="doc-share-page-meta-label">{{ texts.permission }}</span>
              <t-tag size="small" theme="primary" variant="light">
                {{ permissionLabel }}
              </t-tag>
            </div>
            <div class="doc-share-page-meta-item">
              <span class="doc-share-page-meta-label">{{ texts.accessMode }}</span>
              <span>
                {{ shareLink?.allowAnonymous ? texts.anonymousAccess : texts.loggedInAccess }}
              </span>
            </div>
          </div>
          <div v-if="requiresAuthToOpen" class="doc-share-page-note">
            <p class="doc-share-page-note-title">{{ texts.authRequired }}</p>
            <p class="doc-share-page-note-copy">{{ texts.authRequiredHint }}</p>
          </div>
          <div class="doc-share-page-actions-row">
            <t-button theme="primary" @click="handlePrimaryAction">
              {{ primaryActionLabel }}
            </t-button>
            <t-button variant="outline" @click="refreshShareLink">
              {{ texts.refresh }}
            </t-button>
          </div>
        </template>
      </section>
    </main>

    <AccountWorkspaceDialog
      v-model:visible="accountDialogVisible"
      :locale="localeKey"
      :collaboration-state="accountCollaborationState"
      initial-mode="login"
      @session-change="handleAccountSessionChange"
    />
  </div>
</template>

<script setup lang="ts">
import { MessagePlugin } from "tdesign-vue-next/es/message/plugin";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import AccountWorkspaceDialog from "../components/AccountWorkspaceDialog.vue";
import { useBackendConnection } from "../composables/useBackendConnection";
import { useDocumentNavigation } from "../composables/useDocumentNavigation";
import {
  getBackendShareLink,
  type BackendDocument,
  type BackendShareLink,
  type BackendUser,
} from "../editor/backendClient";
import { createInitialLumenCollaborationState } from "../editor/collaboration";
import { createPlaygroundDebugFlags } from "../editor/config";
import { coercePlaygroundLocale, createPlaygroundI18n, type PlaygroundLocale } from "../editor/i18n";

const route = useRoute();
const { locale: globalLocale } = useI18n();
const baseFlags = createPlaygroundDebugFlags();
const { goToDocumentsHome, openWorkspaceDocument } = useDocumentNavigation();
const localeKey = computed<PlaygroundLocale>(() => coercePlaygroundLocale(globalLocale.value));
const i18n = computed(() => createPlaygroundI18n(localeKey.value));
const texts = computed(() => i18n.value.shareLanding);
const shareToken = computed(() => String(route.params.token || "").trim());
const accountCollaborationState = createInitialLumenCollaborationState(baseFlags);
const { backendUrl, sessionUser, setSessionUser, refreshSession } = useBackendConnection({
  fallbackUrl: computed(() => baseFlags.collaborationUrl),
});

const loading = ref(false);
const errorMessage = ref("");
const document = ref<BackendDocument | null>(null);
const shareLink = ref<BackendShareLink | null>(null);
const permissionMode = ref<"full" | "comment" | "readonly">("readonly");
const accountDialogVisible = ref(false);
const pendingOpenAfterAuth = ref(false);

const requiresAuthToOpen = computed(
  () => shareLink.value?.allowAnonymous === false && !sessionUser.value,
);
const primaryActionLabel = computed(() =>
  requiresAuthToOpen.value ? texts.value.signInToOpen : texts.value.openDocument,
);

const permissionLabel = computed(() => {
  if (permissionMode.value === "full") {
    return i18n.value.app.permissionEdit;
  }
  if (permissionMode.value === "comment") {
    return i18n.value.app.permissionComment;
  }
  return i18n.value.app.permissionReadonly;
});

const refreshShareLink = async () => {
  loading.value = true;
  errorMessage.value = "";
  try {
    const [nextSessionUser, result] = await Promise.all([
      refreshSession({ suppressError: true }),
      getBackendShareLink(backendUrl.value, shareToken.value),
    ]);
    setSessionUser(nextSessionUser);
    document.value = result.document;
    shareLink.value = result.shareLink;
    permissionMode.value = result.permissionMode;
  } catch (error) {
    document.value = null;
    shareLink.value = null;
    errorMessage.value =
      error instanceof Error ? error.message || texts.value.loadFailed : texts.value.loadFailed;
  } finally {
    loading.value = false;
  }
};

const openSharedDocument = () => {
  if (!document.value || !shareLink.value) {
    return;
  }
  void openWorkspaceDocument(document.value.id, {
    shareToken: shareLink.value.token,
    locale: localeKey.value,
  });
};

const handlePrimaryAction = () => {
  if (requiresAuthToOpen.value) {
    pendingOpenAfterAuth.value = true;
    accountDialogVisible.value = true;
    return;
  }
  pendingOpenAfterAuth.value = false;
  openSharedDocument();
};

const handleAccountSessionChange = async (user: BackendUser | null) => {
  setSessionUser(user);
  await refreshShareLink();
  if (pendingOpenAfterAuth.value && user && document.value && shareLink.value) {
    pendingOpenAfterAuth.value = false;
    openSharedDocument();
    return;
  }
  if (!user) {
    pendingOpenAfterAuth.value = false;
  }
};

const goHome = () => {
  void goToDocumentsHome({ locale: localeKey.value });
};

onMounted(async () => {
  if (!shareToken.value) {
    errorMessage.value = texts.value.invalidLink;
    return;
  }
  await refreshShareLink();
});
</script>

<style scoped>
.doc-share-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.16), transparent 32%),
    linear-gradient(180deg, #f8fafc, #ffffff);
  color: #0f172a;
}

.doc-share-page-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 24px;
}

.doc-share-page-back {
  border: none;
  background: transparent;
  color: #1d4ed8;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.doc-share-page-body {
  min-height: calc(100vh - 72px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.doc-share-page-card {
  width: min(720px, 100%);
  padding: 30px;
  border-radius: 28px;
  border: 1px solid rgba(191, 219, 254, 0.8);
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 32px 80px rgba(15, 23, 42, 0.12);
}

.doc-share-page-copy {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.doc-share-page-kicker {
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 700;
  color: #2563eb;
}

.doc-share-page-title {
  margin: 0;
  font-size: 34px;
  line-height: 1.08;
  font-weight: 800;
}

.doc-share-page-description {
  margin: 0;
  font-size: 14px;
  line-height: 1.8;
  color: #475569;
}

.doc-share-page-meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 22px;
}

.doc-share-page-meta-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border-radius: 18px;
  background: #f8fafc;
  border: 1px solid rgba(226, 232, 240, 0.92);
  font-size: 13px;
  line-height: 1.6;
}

.doc-share-page-meta-label {
  font-size: 11px;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #64748b;
}

.doc-share-page-actions-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 24px;
}

.doc-share-page-note {
  margin-top: 18px;
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid rgba(37, 99, 235, 0.12);
  background: rgba(239, 246, 255, 0.9);
  color: #1e3a8a;
}

.doc-share-page-note-title {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  font-weight: 700;
}

.doc-share-page-note-copy {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.7;
}

.doc-share-page-empty {
  padding: 40px 16px;
  text-align: center;
  font-size: 14px;
  color: #64748b;
}

.doc-share-page-empty.is-error {
  color: #b91c1c;
}

@media (max-width: 720px) {
  .doc-share-page-topbar,
  .doc-share-page-body {
    padding-left: 16px;
    padding-right: 16px;
  }

  .doc-share-page-card {
    padding: 22px;
  }

  .doc-share-page-meta {
    grid-template-columns: 1fr;
  }
}
</style>
