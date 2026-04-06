<template>
  <div class="collab-presence" :class="[`is-${statusTone}`, { 'is-compact': compact }]">
    <div class="collab-presence-main">
      <div class="collab-status">
        <span class="collab-status-dot"></span>
        <div class="collab-status-copy">
          <div class="collab-status-label">{{ statusLabel }}</div>
          <div class="collab-status-meta">{{ userCountLabel }}</div>
        </div>
      </div>
      <t-tag size="small" theme="primary" variant="light" class="collab-self-tag">
        {{ currentUserLabel }}
      </t-tag>
    </div>

    <t-avatar-group class="collab-avatar-group" size="32px" :max="4" cascading="right-up">
      <t-avatar
        v-for="user in visibleUsers"
        :key="user.key"
        :style="createAvatarStyle(user.color)"
      >
        {{ user.initials }}
      </t-avatar>
    </t-avatar-group>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import type { LumenCollaborationState } from "../editor/collaboration";
import { coercePlaygroundLocale, createPlaygroundI18n, type PlaygroundLocale } from "../editor/i18n";

type CollaborationUserView = {
  key: string;
  name: string;
  color: string;
  initials: string;
};

const props = defineProps<{
  state: LumenCollaborationState;
  locale: PlaygroundLocale;
  compact?: boolean;
}>();

const { t } = useI18n();
const compact = computed(() => props.compact === true);
const currentLocale = computed<PlaygroundLocale>(() => coercePlaygroundLocale(props.locale));
const i18n = computed(() => createPlaygroundI18n(currentLocale.value));

const createInitials = (name: string) => {
  const normalized = String(name || "").trim();
  if (!normalized) {
    return "U";
  }
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }
  return normalized.slice(0, 2).toUpperCase();
};

const normalizeUser = (user: Record<string, any>, fallbackKey: string): CollaborationUserView => {
  const name = String(user?.name || "").trim() || i18n.value.collaboration.fallbackUser;
  const color = String(user?.color || "").trim() || "#2563eb";
  return {
    key: String(user?.clientId ?? fallbackKey),
    name,
    color,
    initials: createInitials(name),
  };
};

const visibleUsers = computed(() => {
  const mapped = Array.isArray(props.state.users)
    ? props.state.users.map((user, index) => normalizeUser(user, `remote-${index}`))
    : [];

  const hasCurrentUser = mapped.some(
    (user) => user.name === props.state.userName && user.color === props.state.userColor
  );

  if (!hasCurrentUser) {
    mapped.unshift(
      normalizeUser(
        {
          clientId: "local",
          name: props.state.userName,
          color: props.state.userColor,
        },
        "local"
      )
    );
  }

  const deduped: CollaborationUserView[] = [];
  const seen = new Set<string>();
  for (const user of mapped) {
    const key = `${user.key}:${user.name}:${user.color}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(user);
  }
  return deduped;
});

const statusTone = computed(() => {
  if (props.state.error || props.state.status === "disconnected") {
    return "danger";
  }
  if (props.state.synced) {
    return "success";
  }
  return "warning";
});

const statusLabel = computed(() => {
  if (props.state.error) {
    return i18n.value.collaboration.statusAuthFailed;
  }
  if (props.state.synced) {
    return i18n.value.collaboration.statusSynced;
  }
  if (props.state.status === "connected") {
    return i18n.value.collaboration.statusSyncing;
  }
  if (props.state.status === "connecting") {
    return i18n.value.collaboration.statusConnecting;
  }
  return i18n.value.collaboration.statusDisconnected;
});

const userCountLabel = computed(() => {
  if (props.state.error) {
    return props.state.error;
  }
  if (props.state.status === "disconnected") {
    return i18n.value.collaboration.statusDisconnected;
  }
  const count = visibleUsers.value.length;
  return t("collaboration.onlineCount", { count });
});

const currentUserLabel = computed(() => {
  const name = String(props.state.userName || "").trim() || i18n.value.collaboration.fallbackUser;
  return t("collaboration.currentUser", { name });
});

const createAvatarStyle = (color: string) => ({
  background: color,
  color: "#ffffff",
  border: "2px solid rgba(255, 255, 255, 0.92)",
  boxShadow: "0 8px 18px rgba(15, 23, 42, 0.12)",
});
</script>

<style scoped>
.collab-presence {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.96) 0%, rgba(241, 245, 249, 0.98) 100%);
  border: 1px solid rgba(148, 163, 184, 0.22);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
}

.collab-presence.is-compact {
  gap: 10px;
  padding: 4px 8px;
  background: rgba(248, 250, 252, 0.88);
  box-shadow: none;
  border-color: rgba(148, 163, 184, 0.18);
}

.collab-presence-main {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.collab-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.collab-status-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  flex: 0 0 auto;
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.92);
}

.collab-status-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.collab-status-label {
  font-size: 12px;
  line-height: 1.1;
  font-weight: 700;
  color: #111827;
}

.collab-status-meta {
  font-size: 11px;
  line-height: 1.1;
  color: #64748b;
}

.collab-self-tag {
  flex: 0 0 auto;
}

.collab-avatar-group {
  flex: 0 0 auto;
}

.collab-presence.is-compact .collab-status-label {
  font-size: 11px;
}

.collab-presence.is-compact .collab-status-meta {
  font-size: 10px;
}

.collab-presence.is-compact :deep(.t-avatar) {
  width: 28px !important;
  height: 28px !important;
  font-size: 11px;
}

.collab-presence.is-success .collab-status-dot {
  background: #16a34a;
}

.collab-presence.is-warning .collab-status-dot {
  background: #d97706;
}

.collab-presence.is-danger .collab-status-dot {
  background: #dc2626;
}

@media (max-width: 960px) {
  .collab-self-tag {
    display: none;
  }
}

@media (max-width: 768px) {
  .collab-presence {
    padding: 5px 8px;
  }

  .collab-status-copy {
    display: none;
  }
}
</style>
