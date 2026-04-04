<template>
  <div class="doc-home-shell">
    <header class="doc-home-topbar">
      <div class="doc-home-brand">
        <div class="doc-home-brand-mark">LP</div>
        <div class="doc-home-brand-copy">
          <span class="doc-home-brand-title">{{ i18n.app.brand }}</span>
          <span class="doc-home-brand-subtitle">{{ texts.subtitle }}</span>
        </div>
      </div>
      <div class="doc-home-topbar-actions">
        <t-select
          class="doc-home-locale"
          size="small"
          :model-value="localeKey"
          :options="localeOptions"
          @update:model-value="handleLocaleChange"
        />
        <t-button size="small" variant="outline" @click="refreshWorkspace">
          {{ texts.refresh }}
        </t-button>
        <t-button
          v-if="sessionUser"
          size="small"
          variant="outline"
          @click="accountDialogVisible = true"
        >
          {{ sessionUser.displayName }}
        </t-button>
        <t-button
          v-else
          size="small"
          theme="primary"
          @click="openAccountDialog('login')"
        >
          {{ i18n.shareDialog.login }}
        </t-button>
      </div>
    </header>

    <main class="doc-home-content">
      <section class="doc-home-hero">
        <div class="doc-home-hero-copy">
          <h1 class="doc-home-title">{{ texts.title }}</h1>
          <p class="doc-home-description">{{ texts.description }}</p>
        </div>
        <div class="doc-home-create">
          <label class="doc-home-field">
            <span class="doc-home-label">{{ texts.documentTitle }}</span>
            <t-input
              :model-value="draftTitle"
              :placeholder="texts.documentTitlePlaceholder"
              @update:model-value="(value) => (draftTitle = String(value ?? ''))"
            />
          </label>
          <div class="doc-home-create-actions">
            <t-button
              theme="primary"
              :loading="creatingDocument"
              :disabled="!sessionUser"
              @click="handleCreateDocument"
            >
              {{ texts.createDocument }}
            </t-button>
            <span v-if="!sessionUser" class="doc-home-hint">{{ texts.authHint }}</span>
          </div>
        </div>
      </section>

      <section class="doc-home-section">
        <div class="doc-home-section-header">
          <div class="doc-home-section-heading">
            <h2>{{ texts.documents }}</h2>
            <span>{{ documents.length }}</span>
          </div>
        </div>

        <div v-if="loading" class="doc-home-empty">{{ texts.loading }}</div>
        <div v-else-if="!sessionUser" class="doc-home-empty">{{ texts.authHint }}</div>
        <div v-else-if="documents.length === 0" class="doc-home-empty">{{ texts.empty }}</div>
        <div v-else class="doc-home-grid">
          <article
            v-for="document in documents"
            :key="document.id"
            class="doc-home-card"
          >
            <div class="doc-home-card-copy">
              <span class="doc-home-card-title">{{ document.title }}</span>
              <span class="doc-home-card-meta">{{ document.name }}</span>
              <span class="doc-home-card-meta">{{ formatDate(document.updatedAt) }}</span>
            </div>
            <div class="doc-home-card-actions">
              <t-tag size="small" variant="light">{{ roleLabel(document.role) }}</t-tag>
              <t-button size="small" theme="primary" @click="openDocument(document.id)">
                {{ texts.openDocument }}
              </t-button>
            </div>
          </article>
        </div>
      </section>
    </main>

    <AccountWorkspaceDialog
      v-model:visible="accountDialogVisible"
      :locale="localeKey"
      :collaboration-state="accountCollaborationState"
      :initial-mode="accountDialogMode"
      @session-change="handleAccountDialogSessionChange"
    />
  </div>
</template>

<script setup lang="ts">
import { MessagePlugin } from "tdesign-vue-next/es/message/plugin";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import AccountWorkspaceDialog from "../components/AccountWorkspaceDialog.vue";
import type { BackendUserRole } from "../editor/backendClient";
import { useDocumentsHome } from "../composables/useDocumentsHome";
import { createInitialLumenCollaborationState } from "../editor/collaboration";
import { createPlaygroundDebugFlags } from "../editor/config";
import {
  PLAYGROUND_LOCALE_OPTIONS,
  coercePlaygroundLocale,
  createPlaygroundI18n,
  setPlaygroundLocale,
  type PlaygroundLocale,
} from "../editor/i18n";

const router = useRouter();
const { locale: globalLocale } = useI18n();
const baseFlags = createPlaygroundDebugFlags();
const localeKey = computed<PlaygroundLocale>(() => coercePlaygroundLocale(globalLocale.value));
const i18n = computed(() => createPlaygroundI18n(localeKey.value));
const texts = computed(() => i18n.value.documentCenter);
const localeOptions = PLAYGROUND_LOCALE_OPTIONS;
const accountCollaborationState = createInitialLumenCollaborationState(baseFlags);
const accountDialogVisible = ref(false);
const accountDialogMode = ref<"login" | "register">("login");
const draftTitle = ref("");
const {
  loading,
  creatingDocument,
  sessionUser,
  documents,
  error,
  refreshDocumentsHome,
  createDocument,
  handleAccountSessionChange,
} = useDocumentsHome({
  collaborationUrl: computed(() => baseFlags.collaborationUrl),
  messages: {
    loadFailed: computed(() => texts.value.loadFailed),
    createFailed: computed(() => texts.value.createFailed),
  },
});

const handleLocaleChange = (value: string | number) => {
  const nextLocale = coercePlaygroundLocale(value);
  globalLocale.value = nextLocale;
  setPlaygroundLocale(nextLocale);
};

const roleLabel = (role: BackendUserRole | null) => {
  if (role === "owner") return i18n.value.shareDialog.roleOwner;
  if (role === "editor") return i18n.value.shareDialog.roleEditor;
  if (role === "commenter") return i18n.value.shareDialog.roleCommenter;
  if (role === "viewer") return i18n.value.shareDialog.roleViewer;
  return i18n.value.shareDialog.roleUnknown;
};

const formatDate = (value: string) => {
  try {
    return new Intl.DateTimeFormat(localeKey.value, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch (_error) {
    return value;
  }
};

const openAccountDialog = (mode: "login" | "register") => {
  accountDialogMode.value = mode;
  accountDialogVisible.value = true;
};

const refreshWorkspace = async () => {
  await refreshDocumentsHome();
  if (error.value) {
    MessagePlugin.error(error.value);
  }
};

const handleAccountDialogSessionChange = async (user: Parameters<typeof handleAccountSessionChange>[0]) => {
  await handleAccountSessionChange(user);
  if (error.value) {
    MessagePlugin.error(error.value);
  }
};

const openDocument = (documentId: string) => {
  void router.push({
    name: "document-workspace",
    params: { documentId },
  });
};

const handleCreateDocument = async () => {
  if (!sessionUser.value) {
    openAccountDialog("login");
    return;
  }

  const document = await createDocument(draftTitle.value);
  if (!document) {
    MessagePlugin.error(
      error.value || texts.value.createFailed,
    );
    return;
  }
  draftTitle.value = "";
  openDocument(document.id);
};

onMounted(async () => {
  await refreshDocumentsHome();
  if (error.value) {
    MessagePlugin.error(error.value);
  }
});
</script>

<style scoped>
.doc-home-shell {
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(59, 130, 246, 0.14), transparent 32%),
    linear-gradient(180deg, #f8fafc, #eef2ff 52%, #ffffff);
  color: #0f172a;
}

.doc-home-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 24px;
}

.doc-home-brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.doc-home-brand-mark {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #2563eb, #60a5fa);
  color: #ffffff;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.doc-home-brand-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.doc-home-brand-title {
  font-size: 16px;
  font-weight: 700;
}

.doc-home-brand-subtitle {
  font-size: 12px;
  color: #64748b;
}

.doc-home-topbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.doc-home-locale {
  width: 128px;
}

.doc-home-content {
  max-width: 1160px;
  margin: 0 auto;
  padding: 8px 24px 40px;
}

.doc-home-hero,
.doc-home-section {
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(14px);
  border-radius: 24px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.08);
}

.doc-home-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(320px, 1fr);
  gap: 24px;
  padding: 28px;
}

.doc-home-title {
  margin: 0;
  font-size: 34px;
  line-height: 1.08;
  font-weight: 800;
}

.doc-home-description {
  margin: 14px 0 0;
  max-width: 680px;
  font-size: 14px;
  line-height: 1.75;
  color: #475569;
}

.doc-home-create {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.88), rgba(255, 255, 255, 0.96));
  border: 1px solid rgba(147, 197, 253, 0.4);
}

.doc-home-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.doc-home-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #475569;
}

.doc-home-create-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.doc-home-hint {
  font-size: 12px;
  color: #64748b;
}

.doc-home-section {
  margin-top: 24px;
  padding: 24px;
}

.doc-home-section-header,
.doc-home-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.doc-home-section-heading h2 {
  margin: 0;
  font-size: 18px;
}

.doc-home-section-heading span {
  font-size: 12px;
  color: #64748b;
}

.doc-home-empty {
  padding: 36px 14px;
  text-align: center;
  font-size: 13px;
  color: #64748b;
}

.doc-home-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
  margin-top: 18px;
}

.doc-home-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.96));
  border: 1px solid rgba(226, 232, 240, 0.92);
}

.doc-home-card-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.doc-home-card-title {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.doc-home-card-meta {
  font-size: 12px;
  color: #64748b;
}

.doc-home-card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

@media (max-width: 860px) {
  .doc-home-topbar,
  .doc-home-content {
    padding-left: 16px;
    padding-right: 16px;
  }

  .doc-home-hero {
    grid-template-columns: 1fr;
    padding: 22px;
  }

  .doc-home-topbar {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
