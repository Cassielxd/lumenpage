import { computed, watch, type ComputedRef } from "vue";
import type { LumenAnnotationStore } from "../annotation/annotationStore";

const ANNOTATION_STORAGE_PREFIX = "lumenpage-lumen-annotation-v1";
const ANNOTATION_AUTHOR_STORAGE_KEY = "lumenpage-lumen-annotation-author-id";

type UseAnnotationSessionOptions = {
  annotationStore: LumenAnnotationStore;
  currentCommentUserName: ComputedRef<string>;
  realtimeCollaborationEnabled: ComputedRef<boolean>;
  collaborationUserColor: ComputedRef<string | null>;
  routeDocumentId: ComputedRef<string>;
  backendDocumentField: ComputedRef<string | null>;
  fallbackDocumentName: string;
  fallbackField: string;
};

const resolveAnnotationAuthorId = () => {
  if (typeof window === "undefined") {
    return "server";
  }
  try {
    const stored = window.localStorage.getItem(ANNOTATION_AUTHOR_STORAGE_KEY);
    const normalized = typeof stored === "string" ? stored.trim() : "";
    if (normalized) {
      return normalized;
    }
    const nextId =
      typeof window.crypto?.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `annotation-author-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    window.localStorage.setItem(ANNOTATION_AUTHOR_STORAGE_KEY, nextId);
    return nextId;
  } catch (_error) {
    return `annotation-author-${Date.now().toString(36)}`;
  }
};

export const useAnnotationSession = ({
  annotationStore,
  currentCommentUserName,
  realtimeCollaborationEnabled,
  collaborationUserColor,
  routeDocumentId,
  backendDocumentField,
  fallbackDocumentName,
  fallbackField,
}: UseAnnotationSessionOptions) => {
  const annotationAuthorId = resolveAnnotationAuthorId();
  const annotationAuthorName = computed(() => currentCommentUserName.value);
  const annotationAuthorColor = computed(() => collaborationUserColor.value || "#2563eb");

  const annotationStorageKey = computed(() =>
    typeof window === "undefined"
      ? `${ANNOTATION_STORAGE_PREFIX}:server`
      : [
          ANNOTATION_STORAGE_PREFIX,
          realtimeCollaborationEnabled.value ? "collab" : "local",
          routeDocumentId.value || fallbackDocumentName,
          backendDocumentField.value || fallbackField,
          window.location.pathname,
        ]
          .map((part) => encodeURIComponent(String(part || "")))
          .join(":")
  );

  const restoreAnnotationSession = () => {
    if (typeof window === "undefined") {
      return;
    }
    if (annotationStore.isCollaborationBacked() || realtimeCollaborationEnabled.value) {
      return;
    }
    try {
      const raw = window.sessionStorage.getItem(annotationStorageKey.value);
      if (!raw) {
        return;
      }
      const restored = annotationStore.hydrate(JSON.parse(raw));
      if (!restored) {
        window.sessionStorage.removeItem(annotationStorageKey.value);
      }
    } catch (_error) {
      try {
        window.sessionStorage.removeItem(annotationStorageKey.value);
      } catch (_nestedError) {
        // Ignore storage cleanup failures.
      }
    }
  };

  const persistAnnotationSession = () => {
    if (typeof window === "undefined") {
      return;
    }
    if (annotationStore.isCollaborationBacked() || realtimeCollaborationEnabled.value) {
      return;
    }
    try {
      const snapshot = annotationStore.snapshot();
      if (snapshot.items.length === 0) {
        window.sessionStorage.removeItem(annotationStorageKey.value);
        return;
      }
      window.sessionStorage.setItem(annotationStorageKey.value, JSON.stringify(snapshot));
    } catch (_error) {
      // Ignore storage failures in restricted environments.
    }
  };

  const syncAnnotationAuthor = () => {
    annotationStore.setCurrentAuthor({
      id: annotationAuthorId,
      name: annotationAuthorName.value,
      color: annotationAuthorColor.value,
    });
  };

  watch(
    () => [annotationAuthorName.value, annotationAuthorColor.value],
    () => {
      syncAnnotationAuthor();
    },
    { immediate: true }
  );

  watch(
    () => ({
      items: annotationStore.state.items,
      tool: annotationStore.state.tool,
      color: annotationStore.state.color,
      lineWidth: annotationStore.state.lineWidth,
    }),
    () => {
      persistAnnotationSession();
    },
    { deep: true }
  );

  return {
    restoreAnnotationSession,
    syncAnnotationAuthor,
  };
};
