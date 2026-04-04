import { useRouter } from "vue-router";
import { rememberShareAccessToken } from "../editor/backendClient";

type OpenWorkspaceDocumentOptions = {
  shareToken?: string | null;
  replace?: boolean;
};

export const useDocumentNavigation = () => {
  const router = useRouter();

  const openWorkspaceDocument = async (
    documentId: string,
    options: OpenWorkspaceDocumentOptions = {},
  ) => {
    const normalizedDocumentId = String(documentId || "").trim();
    if (!normalizedDocumentId) {
      return false;
    }

    const normalizedShareToken = String(options.shareToken || "").trim();
    if (normalizedShareToken) {
      rememberShareAccessToken(normalizedDocumentId, normalizedShareToken);
    }

    const navigation = {
      name: "document-workspace",
      params: {
        documentId: normalizedDocumentId,
      },
    } as const;

    if (options.replace) {
      await router.replace(navigation);
      return true;
    }

    await router.push(navigation);
    return true;
  };

  const goToDocumentsHome = async (options: { replace?: boolean } = {}) => {
    if (options.replace) {
      await router.replace({ name: "documents-home" });
      return true;
    }

    await router.push({ name: "documents-home" });
    return true;
  };

  return {
    openWorkspaceDocument,
    goToDocumentsHome,
  };
};
