import { ref } from "vue";
import { defineStore } from "pinia";
import type { BackendDocument } from "../editor/backendClient";

export const useDocumentsHomeStore = defineStore("lumen-documents-home", () => {
  const loading = ref(false);
  const creatingDocument = ref(false);
  const documents = ref<BackendDocument[]>([]);
  const error = ref<string | null>(null);

  const resetDocumentsHomeState = () => {
    loading.value = false;
    creatingDocument.value = false;
    documents.value = [];
    error.value = null;
  };

  return {
    loading,
    creatingDocument,
    documents,
    error,
    resetDocumentsHomeState,
  };
});
