import { storeToRefs } from "pinia";
import { computed, type ComputedRef } from "vue";
import {
  createBackendDocument,
  listBackendDocuments,
  type BackendDocument,
  type BackendUser,
} from "../editor/backendClient";
import { useBackendConnection } from "./useBackendConnection";
import { useDocumentsHomeStore } from "../stores/documentsHome";

type DocumentsHomeMessages = {
  loadFailed: ComputedRef<string>;
  createFailed: ComputedRef<string>;
};

type UseDocumentsHomeOptions = {
  collaborationUrl: ComputedRef<string>;
  messages: DocumentsHomeMessages;
};

export const useDocumentsHome = ({ collaborationUrl, messages }: UseDocumentsHomeOptions) => {
  const documentsHomeStore = useDocumentsHomeStore();
  const { loading, creatingDocument, documents, error } = storeToRefs(documentsHomeStore);
  const { backendUrl, sessionUser, setSessionUser, refreshSession } = useBackendConnection({
    fallbackUrl: collaborationUrl,
  });

  const refreshDocumentsHome = async (preferredSessionUser?: BackendUser | null) => {
    loading.value = true;
    error.value = null;
    try {
      if (preferredSessionUser !== undefined) {
        setSessionUser(preferredSessionUser);
      } else {
        await refreshSession();
      }

      if (!sessionUser.value) {
        documents.value = [];
        return;
      }

      const result = await listBackendDocuments(backendUrl.value);
      documents.value = result.documents;
    } catch (errorValue) {
      setSessionUser(null);
      documents.value = [];
      error.value =
        errorValue instanceof Error
          ? errorValue.message || messages.loadFailed.value
          : messages.loadFailed.value;
    } finally {
      loading.value = false;
    }
  };

  const createDocument = async (title?: string) => {
    if (!sessionUser.value) {
      return null;
    }

    creatingDocument.value = true;
    error.value = null;
    try {
      const result = await createBackendDocument(backendUrl.value, {
        title: String(title || "").trim() || undefined,
      });
      documents.value = [result.document, ...documents.value.filter((item) => item.id !== result.document.id)];
      return result.document as BackendDocument;
    } catch (errorValue) {
      error.value =
        errorValue instanceof Error
          ? errorValue.message || messages.createFailed.value
          : messages.createFailed.value;
      return null;
    } finally {
      creatingDocument.value = false;
    }
  };

  const handleAccountSessionChange = async (user: BackendUser | null) => {
    await refreshDocumentsHome(user);
  };

  return {
    loading,
    creatingDocument,
    sessionUser,
    documents,
    error,
    refreshDocumentsHome,
    createDocument,
    handleAccountSessionChange,
  };
};
