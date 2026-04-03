<template>
  <t-footer class="doc-footer">
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
}>();
</script>

<style scoped>
.doc-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 40px;
  padding: 0 16px;
  border-top: 1px solid #dfe1e5;
  background: rgba(255, 255, 255, 0.92);
}

.doc-footer-stats,
.doc-footer-right {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.doc-footer-stats {
  flex: 1 1 auto;
  flex-wrap: wrap;
  font-size: 12px;
  color: #475569;
}

.doc-footer-divider {
  color: #cbd5e1;
}

.doc-footer-link {
  color: #475569;
  text-decoration: none;
  font-size: 12px;
}

.doc-footer-link:hover {
  color: #1d4ed8;
}

@media (max-width: 960px) {
  .doc-footer {
    flex-direction: column;
    align-items: flex-start;
    padding: 10px 16px;
  }
}
</style>
