<template>
  <div class="workspace-right-panel-root" :class="{ 'is-high-contrast': highContrast }">
    <WorkspaceSidePanel
      :active-tab="activeTab"
      :width="width"
      :resizing="resizing"
      :high-contrast="highContrast"
      @resize-start="onResizeStart"
    >
      <template #outline>
        <div class="doc-side-tab-panel doc-side-tab-panel-outline">
          <div class="doc-side-tab-header">
            <div class="doc-side-tab-heading">
              <span class="doc-side-tab-title">{{ outlineTitle }}</span>
              <span class="doc-side-tab-summary">{{ tocItems.length }}</span>
            </div>
          </div>
          <div v-if="tocItems.length === 0" class="doc-side-tab-empty">
            {{ outlineEmptyLabel }}
          </div>
          <div v-else class="doc-outline-list">
            <button
              v-for="item in tocItems"
              :key="item.id"
              type="button"
              class="doc-outline-item"
              :class="{ 'is-active': item.id === activeTocId }"
              :style="{ '--toc-level': String(item.level) }"
              @click="onTocItemClick(item)"
            >
              <span class="doc-outline-item-text">{{ item.text }}</span>
            </button>
          </div>
        </div>
      </template>

      <template #comments>
        <div class="doc-side-tab-panel">
          <div class="doc-side-tab-actions">
            <t-button
              size="small"
              variant="outline"
              :disabled="commentButtonDisabled"
              @mousedown.prevent
              @click="onCommentClick"
            >
              {{ commentActionLabel }}
            </t-button>
          </div>
          <CommentsPanel
            :locale="locale"
            :threads="commentThreads"
            :active-thread-id="activeCommentThreadId"
            :can-manage="canMutateComments"
            :current-user-name="currentCommentUserName"
            @close="onCloseCommentsPanel"
            @select="onCommentThreadSelect"
            @toggle-resolved="onCommentThreadResolved"
            @reply="onCommentThreadReply"
            @edit-message="onCommentMessageEdit"
            @delete-message="onCommentMessageDelete"
            @delete="onCommentThreadDelete"
          />
        </div>
      </template>

      <template #collaboration>
        <div class="doc-side-tab-panel">
          <CollaborationPanel
            :locale="locale"
            :state="collaborationState"
            :backend-user="backendSessionUser"
            :document="backendDocument"
            :access="backendDocumentAccess"
            :effective-permission-mode="effectivePermissionMode"
            :backend-managed="backendAccessBound"
            :access-error="backendAccessError"
            :collaboration-token="collaborationToken"
            :busy="collaborationSwitching"
            @apply="onCollaborationApply"
          />
        </div>
      </template>

      <template #locks>
        <div class="doc-side-tab-panel">
          <DocumentLockPanel
            :locale="locale"
            :enabled="documentLockingEnabled"
            :show-markers="documentLockMarkersVisible"
            :locked-range-count="documentLockRangeCount"
            :selection-locked-count="documentLockSelectionLockedCount"
            :ranges="documentLockRanges"
            :can-manage="canManageDocumentLocks"
            @close="onCloseDocumentLocksPanel"
            @lock-selection="onDocumentLockSelection"
            @unlock-selection="onDocumentUnlockSelection"
            @focus-lock="onDocumentLockFocus"
            @unlock-lock="onDocumentLockRangeUnlock"
            @clear-all="onDocumentLocksClearAll"
            @set-enabled="onDocumentLockingEnabledChange"
            @set-markers-visible="onDocumentLockMarkersVisibleChange"
          />
        </div>
      </template>

      <template #assistant>
        <div class="doc-side-tab-panel">
          <AiAssistantPanel
            :locale="locale"
            :editor="editor"
            :can-manage="canManageAssistant"
            @close="onCloseAssistantPanel"
          />
        </div>
      </template>

      <template #changes>
        <div class="doc-side-tab-panel">
          <div class="doc-side-tab-actions">
            <t-button
              size="small"
              variant="outline"
              :theme="trackChangesEnabled ? 'success' : 'default'"
              :disabled="!canMutateTrackChanges"
              @mousedown.prevent
              @click="onTrackChangesToggle"
            >
              {{ trackChangesActionLabel }}
            </t-button>
            <t-tag
              size="small"
              variant="light"
              :theme="trackChangesEnabled ? 'success' : 'default'"
            >
              {{ trackChangesStatusLabel }}
            </t-tag>
          </div>
          <TrackChangesPanel
            :locale="locale"
            :changes="trackChangeRecords"
            :active-change-id="activeTrackChangeId"
            :enabled="trackChangesEnabled"
            :can-manage="canMutateTrackChanges"
            @close="onCloseTrackChangesPanel"
            @select="onTrackChangeSelect"
            @accept="onTrackChangeAccept"
            @reject="onTrackChangeReject"
            @accept-all="onTrackChangesAcceptAll"
            @reject-all="onTrackChangesRejectAll"
          />
        </div>
      </template>

      <template #annotation>
        <div class="doc-side-tab-panel">
          <AnnotationToolbar :locale="locale" :store="annotationStore" />
        </div>
      </template>
    </WorkspaceSidePanel>
  </div>
</template>

<script setup lang="ts">
import type { Editor as LumenEditor } from "lumenpage-core";
import type { TrackChangeRecord } from "lumenpage-extension-track-change";
import type { LumenAnnotationStore } from "../../annotation/annotationStore";
import type {
  BackendAccess,
  BackendDocument,
  BackendUser,
} from "../../editor/backendClient";
import type { LumenCommentThread } from "../../editor/commentsStore";
import type { LumenCollaborationState } from "../../editor/collaboration";
import type { PlaygroundLocale } from "../../editor/i18n";
import type { TocOutlineItem } from "../../editor/tocOutlinePlugin";
import type { SideTabKey } from "../../composables/useWorkspaceSidePanel";
import AiAssistantPanel from "../AiAssistantPanel.vue";
import AnnotationToolbar from "../AnnotationToolbar.vue";
import CommentsPanel from "../CommentsPanel.vue";
import CollaborationPanel from "../CollaborationPanel.vue";
import DocumentLockPanel from "../DocumentLockPanel.vue";
import TrackChangesPanel from "../TrackChangesPanel.vue";
import WorkspaceSidePanel from "./WorkspaceSidePanel.vue";

type DocumentLockRangeItem = {
  key: string;
  from: number;
  to: number;
  kind: "mark" | "node";
  nodeType: string | null;
  summary: string;
  active: boolean;
};

defineProps<{
  activeTab: SideTabKey | null;
  width: number;
  resizing: boolean;
  highContrast: boolean;
  locale: PlaygroundLocale;
  editor: LumenEditor | null;
  annotationStore: LumenAnnotationStore;
  tocItems: TocOutlineItem[];
  activeTocId: string | null;
  outlineTitle: string;
  outlineEmptyLabel: string;
  commentActionLabel: string;
  commentButtonDisabled: boolean;
  commentThreads: LumenCommentThread[];
  activeCommentThreadId: string | null;
  canMutateComments: boolean;
  currentCommentUserName: string;
  collaborationState: LumenCollaborationState;
  backendSessionUser: BackendUser | null;
  backendDocument: BackendDocument | null;
  backendDocumentAccess: BackendAccess | null;
  effectivePermissionMode: "full" | "comment" | "readonly";
  backendAccessBound: boolean;
  backendAccessError: string | null;
  collaborationToken: string;
  collaborationSwitching: boolean;
  canManageAssistant: boolean;
  documentLockingEnabled: boolean;
  documentLockMarkersVisible: boolean;
  documentLockRangeCount: number;
  documentLockSelectionLockedCount: number;
  documentLockRanges: DocumentLockRangeItem[];
  canManageDocumentLocks: boolean;
  trackChangesEnabled: boolean;
  trackChangesActionLabel: string;
  trackChangesStatusLabel: string;
  trackChangeRecords: TrackChangeRecord[];
  activeTrackChangeId: string | null;
  canMutateTrackChanges: boolean;
  onResizeStart: (event: PointerEvent) => void;
  onTocItemClick: (item: TocOutlineItem) => void;
  onCommentClick: () => void;
  onCloseCommentsPanel: () => void;
  onCommentThreadSelect: (threadId: string) => void;
  onCommentThreadResolved: (payload: { threadId: string; resolved: boolean }) => void;
  onCommentThreadReply: (payload: { threadId: string; body: string }) => void;
  onCommentMessageEdit: (payload: { threadId: string; messageId: string; body: string }) => void;
  onCommentMessageDelete: (payload: { threadId: string; messageId: string }) => void;
  onCommentThreadDelete: (threadId: string) => void;
  onCollaborationApply: (value: {
    enabled: boolean;
    collaborationUrl: string;
    collaborationDocument: string;
    collaborationField: string;
    collaborationToken: string;
    collaborationUserName: string;
    collaborationUserColor: string;
  }) => void;
  onCloseDocumentLocksPanel: () => void;
  onDocumentLockSelection: () => void;
  onDocumentUnlockSelection: () => void;
  onDocumentLockFocus: (range: { from: number; to: number; kind?: "mark" | "node" }) => void;
  onDocumentLockRangeUnlock: (range: { from: number; to: number }) => void;
  onDocumentLocksClearAll: () => void;
  onDocumentLockingEnabledChange: (enabled: boolean) => void;
  onDocumentLockMarkersVisibleChange: (visible: boolean) => void;
  onCloseAssistantPanel: () => void;
  onTrackChangesToggle: () => void;
  onCloseTrackChangesPanel: () => void;
  onTrackChangeSelect: (changeId: string) => void;
  onTrackChangeAccept: (changeId: string) => void;
  onTrackChangeReject: (changeId: string) => void;
  onTrackChangesAcceptAll: () => void;
  onTrackChangesRejectAll: () => void;
}>();
</script>

<style scoped>
.workspace-right-panel-root {
  display: contents;
}

.doc-side-tab-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  background: #ffffff;
}

.doc-side-tab-panel-outline {
  padding: 14px 12px 12px;
}

.doc-side-tab-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 10px;
}

.doc-side-tab-heading {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
  color: #4b5563;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.doc-side-tab-title {
  color: #111827;
}

.doc-side-tab-summary {
  color: #64748b;
  font-weight: 600;
}

.doc-side-tab-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 12px 0;
  flex-wrap: wrap;
}

.doc-side-tab-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 0;
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.6;
  text-align: center;
  padding: 24px 12px;
}

.doc-outline-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-right: 4px;
}

.doc-outline-item {
  width: 100%;
  border: 0;
  background: transparent;
  color: #1f2937;
  text-align: left;
  display: block;
  padding: 6px 8px;
  padding-left: calc(8px + (var(--toc-level, 1) - 1) * 14px);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  line-height: 1.35;
}

.doc-outline-item:hover {
  background: #eff6ff;
}

.doc-outline-item.is-active {
  background: #dbeafe;
  color: #1d4ed8;
  font-weight: 600;
}

.doc-outline-item-text {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.doc-side-tab-panel :deep(.doc-comments),
.doc-side-tab-panel :deep(.doc-annotation-toolbar),
.doc-side-tab-panel :deep(.doc-collaboration-panel),
.doc-side-tab-panel :deep(.doc-document-lock),
.doc-side-tab-panel :deep(.doc-ai-assistant),
.doc-side-tab-panel :deep(.doc-track-changes) {
  flex: 1;
  min-height: 0;
}

.workspace-right-panel-root.is-high-contrast .doc-side-tab-panel,
.workspace-right-panel-root.is-high-contrast .doc-side-tab-title,
.workspace-right-panel-root.is-high-contrast .doc-outline-item {
  color: #fff;
}

.workspace-right-panel-root.is-high-contrast .doc-outline-item:hover,
.workspace-right-panel-root.is-high-contrast .doc-outline-item.is-active {
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
}
</style>
