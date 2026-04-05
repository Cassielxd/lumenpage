<template>
  <t-header class="topbar" :class="{ 'is-high-contrast': highContrast }">
    <div class="topbar-left">
      <RouterLink class="brand" aria-label="LumenPage" to="/">
        <svg class="brand-logo" viewBox="0 0 164 48" role="img" aria-hidden="true">
          <defs>
            <linearGradient id="lumenBrandFrame" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#e7f0ff" />
              <stop offset="100%" stop-color="#bed6ff" />
            </linearGradient>
            <linearGradient id="lumenBrandPanel" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="rgba(255,255,255,0.68)" />
              <stop offset="100%" stop-color="rgba(255,255,255,0.42)" />
            </linearGradient>
            <linearGradient id="lumenBrandFold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#dbeafe" />
              <stop offset="100%" stop-color="#93c5fd" />
            </linearGradient>
            <linearGradient id="lumenBrandSurface" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#ffffff" />
              <stop offset="100%" stop-color="#eff6ff" />
            </linearGradient>
            <linearGradient id="lumenBrandGlow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="0.46" />
              <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
            </linearGradient>
          </defs>
          <g class="brand-logo-mark">
            <rect class="brand-logo-frame" x="4" y="6" width="156" height="36" rx="13" />
            <path class="brand-logo-glow" d="M17 10h115c13.8 0 23.5 4.5 28 11.5V18c0-6.6-5.4-12-12-12H17Z" />
            <rect class="brand-logo-panel" x="12" y="10" width="140" height="28" rx="10" />
            <rect class="brand-logo-spine" x="12" y="10" width="24" height="28" rx="10" />
            <path class="brand-logo-page" d="M18 14.2A3.2 3.2 0 0 1 21.2 11H30a3.2 3.2 0 0 1 2.26.94l2.8 2.8A3.2 3.2 0 0 1 36 17V31a3.2 3.2 0 0 1-3.2 3.2H21.2A3.2 3.2 0 0 1 18 31Z" />
            <path class="brand-logo-fold" d="M29.8 11.8v4.1a1.5 1.5 0 0 0 1.5 1.5h4.1Z" />
            <path class="brand-logo-rule" d="M22.4 20.2H29" />
            <path class="brand-logo-rule" d="M22.4 24.5h7.4" />
            <path class="brand-logo-rule" d="M22.4 28.8h5.1" />
            <text class="brand-logo-wordmark" x="46" y="28">LumenPage</text>
          </g>
        </svg>
      </RouterLink>
      <t-tag size="small" variant="light">{{ permissionLabel }}</t-tag>
      <t-tag
        v-if="collaborationEnabled && collaborationDocumentName"
        size="small"
        theme="primary"
        variant="light"
      >
        {{ collaborationDocumentName }}
      </t-tag>
    </div>
    <div class="topbar-right">
      <t-select
        class="topbar-locale"
        size="small"
        :model-value="localeKey"
        :options="localeOptions"
        @update:model-value="emit('locale-change', String($event ?? ''))"
      />
      <t-button size="small" theme="primary" @click="emit('open-share')">
        {{ shareLabel }}
      </t-button>
      <t-popup
        :visible="accountPopupVisible"
        trigger="click"
        placement="bottom-right"
        overlay-inner-class-name="topbar-account-popup"
        @visible-change="emit('account-popup-visible-change', $event === true)"
      >
        <template #content>
          <div class="topbar-account-menu">
            <template v-if="backendSessionUser">
              <div class="topbar-account-menu-summary">
                <span class="topbar-account-menu-name">{{ backendSessionUser.displayName }}</span>
                <span class="topbar-account-menu-email">{{ backendSessionUser.email }}</span>
              </div>
              <t-button size="small" variant="outline" @click="emit('open-account', 'login')">
                {{ manageAccountLabel }}
              </t-button>
            </template>
            <template v-else>
              <t-button size="small" theme="primary" @click="emit('open-account', 'login')">
                {{ loginLabel }}
              </t-button>
              <t-button size="small" variant="outline" @click="emit('open-account', 'register')">
                {{ registerLabel }}
              </t-button>
            </template>
          </div>
        </template>
        <button type="button" class="topbar-avatar-trigger">
          <t-avatar size="small">{{ avatarText }}</t-avatar>
        </button>
      </t-popup>
    </div>
  </t-header>
</template>

<script setup lang="ts">
import { RouterLink } from "vue-router";
import type { BackendUser } from "../../editor/backendClient";
import type { PlaygroundLocale } from "../../editor/i18n";

defineProps<{
  collaborationEnabled: boolean;
  collaborationDocumentName: string;
  permissionLabel: string;
  localeKey: PlaygroundLocale;
  localeOptions: Array<{ value: PlaygroundLocale; label: string }>;
  highContrast?: boolean;
  shareLabel: string;
  backendSessionUser: BackendUser | null;
  manageAccountLabel: string;
  loginLabel: string;
  registerLabel: string;
  avatarText: string;
  accountPopupVisible: boolean;
}>();

const emit = defineEmits<{
  (event: "locale-change", value: string): void;
  (event: "open-share"): void;
  (event: "open-account", mode: "login" | "register"): void;
  (event: "account-popup-visible-change", visible: boolean): void;
}>();
</script>

<style scoped>
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 52px;
  padding: 0 16px;
  background: #ffffff;
  border-bottom: 1px solid #dfe1e5;
}

.topbar-left,
.topbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.topbar-right {
  justify-content: flex-end;
}

.brand {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  flex-shrink: 0;
  text-decoration: none;
}

.brand-logo {
  width: 164px;
  height: 48px;
  display: block;
  overflow: visible;
}

.brand-logo-mark {
  filter: drop-shadow(0 10px 20px rgba(148, 184, 255, 0.16));
}

.brand-logo-frame {
  fill: url(#lumenBrandFrame);
  stroke: rgba(99, 136, 213, 0.28);
  stroke-width: 1;
}

.brand-logo-panel {
  fill: url(#lumenBrandPanel);
}

.brand-logo-glow {
  fill: url(#lumenBrandGlow);
}

.brand-logo-spine {
  fill: rgba(79, 143, 247, 0.16);
}

.brand-logo-page {
  fill: url(#lumenBrandSurface);
}

.brand-logo-fold {
  fill: url(#lumenBrandFold);
}

.brand-logo-rule {
  fill: none;
  stroke: rgba(59, 130, 246, 0.84);
  stroke-width: 1.6;
  stroke-linecap: round;
}

.brand-logo-wordmark {
  font-size: 15.5px;
  font-weight: 700;
  letter-spacing: 0.01em;
  fill: #1647a5;
}

.topbar-locale {
  width: 172px;
  min-width: 172px;
}

.topbar-account-menu {
  min-width: 220px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.topbar-account-menu-summary {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.topbar-account-menu-name {
  font-size: 13px;
  line-height: 1.2;
  font-weight: 700;
  color: #0f172a;
}

.topbar-account-menu-email {
  font-size: 12px;
  line-height: 1.4;
  color: #475569;
}

.topbar-avatar-trigger {
  border: none;
  background: transparent;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.topbar.is-high-contrast {
  background: #000;
  border-color: #fff;
}

.topbar.is-high-contrast .brand-logo-mark {
  filter: none;
}

.topbar.is-high-contrast .brand-logo-frame {
  fill: #fff;
}

.topbar.is-high-contrast .brand-logo-panel,
.topbar.is-high-contrast .brand-logo-spine {
  fill: rgba(0, 0, 0, 0.12);
}

.topbar.is-high-contrast .brand-logo-page {
  fill: #000;
}

.topbar.is-high-contrast .brand-logo-fold {
  fill: rgba(0, 0, 0, 0.28);
}

.topbar.is-high-contrast .brand-logo-rule {
  stroke: rgba(0, 0, 0, 0.76);
}

.topbar.is-high-contrast .brand-logo-wordmark {
  fill: #000;
}

.topbar.is-high-contrast .topbar-account-menu-name {
  color: #ffffff;
}

.topbar.is-high-contrast .topbar-account-menu-email {
  color: rgba(255, 255, 255, 0.72);
}

@media (max-width: 720px) {
  .topbar {
    padding: 0 12px;
    gap: 8px;
  }

  .brand-logo {
    width: 132px;
    height: 40px;
  }

  .topbar-locale {
    width: 148px;
    min-width: 148px;
  }
}
</style>
