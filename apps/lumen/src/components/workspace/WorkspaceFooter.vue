<template>
  <t-footer class="doc-footer" :class="{ 'is-high-contrast': highContrast }">
    <div class="doc-footer-stats">
      <template v-for="(item, index) in footerStatItems" :key="`footer-${index}-${item}`">
        <span v-if="index > 0" class="doc-footer-divider">|</span>
        <span class="doc-footer-stat">{{ item }}</span>
      </template>
    </div>
    <div class="doc-footer-right">
      <CollaborationPresence
        v-if="collaborationEnabled"
        :state="collaborationState"
        :locale="locale"
        compact
      />
      <a
        class="doc-footer-link"
        href="https://github.com/Cassielxd/lumenpage"
        target="_blank"
        rel="noreferrer noopener"
      >
        GitHub
      </a>
      <a class="doc-footer-link" href="mailto:348040933@qq.com">348040933@qq.com</a>
    </div>
  </t-footer>
</template>

<script setup lang="ts">
import type { LumenCollaborationState } from "../../editor/collaboration";
import type { PlaygroundLocale } from "../../editor/i18n";
import CollaborationPresence from "../CollaborationPresence.vue";

defineProps<{
  footerStatItems: string[];
  collaborationEnabled: boolean;
  collaborationState: LumenCollaborationState;
  locale: PlaygroundLocale;
  highContrast?: boolean;
}>();
</script>

<style scoped>
.doc-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 32px;
  padding: 0 16px;
  border-top: 1px solid #e5e7eb;
  background: #ffffff;
}

.doc-footer-stats,
.doc-footer-right {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.doc-footer-stats {
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  line-height: 1;
  color: #6b7280;
}

.doc-footer-stat {
  white-space: nowrap;
}

.doc-footer-divider {
  color: #c0c4cc;
}

.doc-footer-link {
  color: #2563eb;
  text-decoration: none;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
}

.doc-footer-link:hover {
  color: #1d4ed8;
  text-decoration: underline;
}

.doc-footer.is-high-contrast {
  background: #000;
  border-color: #fff;
}

.doc-footer.is-high-contrast .doc-footer-stats,
.doc-footer.is-high-contrast .doc-footer-divider,
.doc-footer.is-high-contrast .doc-footer-link {
  color: #fff;
}

@media (max-width: 768px) {
  .doc-footer {
    padding: 0 10px;
  }

  .doc-footer-right {
    gap: 8px;
  }
}
</style>
