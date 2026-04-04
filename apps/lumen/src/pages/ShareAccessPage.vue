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
          <div class="doc-share-page-actions-row">
            <t-button theme="primary" @click="openSharedDocument">
              {{ texts.openDocument }}
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
import { useRoute, useRouter } from "vue-router";
import AccountWorkspaceDialog from "../components/AccountWorkspaceDialog.vue";
import { useBackendConnection } from "../composables/useBackendConnection";
import {
  getBackendShareLink,
  rememberShareAccessToken,
  type BackendDocument,
  type BackendShareLink,
  type BackendUser,
} from "../editor/backendClient";
import { createInitialLumenCollaborationState } from "../editor/collaboration";
import { createPlaygroundDebugFlags } from "../editor/config";
import { coercePlaygroundLocale, createPlaygroundI18n, type PlaygroundLocale } from "../editor/i18n";

const route = useRoute();
const router = useRouter();
const { locale: globalLocale } = useI18n();
const baseFlags = createPlaygroundDebugFlags();
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
  rememberShareAccessToken(document.value.id, shareLink.value.token);
  void router.push({
    name: "document-workspace",
    params: {
      documentId: document.value.id,
    },
  });
};

const handleAccountSessionChange = async (user: BackendUser | null) => {
  setSessionUser(user);
  await refreshShareLink();
};

const goHome = () => {
  void router.push({ name: "documents-home" });
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
