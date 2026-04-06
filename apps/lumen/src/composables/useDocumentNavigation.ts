import { useRouter } from "vue-router";
import { rememberShareAccessToken } from "../editor/backendClient";
import {
  coercePlaygroundLocale,
  resolvePlaygroundLocale,
  type PlaygroundLocale,
} from "../editor/i18n";

type OpenWorkspaceDocumentOptions = {
  shareToken?: string | null;
  replace?: boolean;
  locale?: PlaygroundLocale | string | null;
};

type DocumentsHomeNavigationOptions = {
  replace?: boolean;
  locale?: PlaygroundLocale | string | null;
};

type ShareAccessNavigationOptions = {
  replace?: boolean;
  locale?: PlaygroundLocale | string | null;
};

export const useDocumentNavigation = () => {
  const router = useRouter();
  const resolveNavigationLocale = (
    value?: PlaygroundLocale | string | null,
  ): PlaygroundLocale => {
    const normalized = String(value || "").trim();
    if (normalized) {
      return coercePlaygroundLocale(normalized);
    }
    return resolvePlaygroundLocale();
  };

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
      query: {
        locale: resolveNavigationLocale(options.locale),
      },
    } as const;

    if (options.replace) {
      await router.replace(navigation);
      return true;
    }

    await router.push(navigation);
    return true;
  };

  const openShareAccess = async (
    shareToken: string,
    options: ShareAccessNavigationOptions = {},
  ) => {
    const normalizedShareToken = String(shareToken || "").trim();
    if (!normalizedShareToken) {
      return false;
    }

    const navigation = {
      name: "share-access",
      params: {
        token: normalizedShareToken,
      },
      query: {
        locale: resolveNavigationLocale(options.locale),
      },
    } as const;

    if (options.replace) {
      await router.replace(navigation);
      return true;
    }

    await router.push(navigation);
    return true;
  };

  const goToDocumentsHome = async (options: DocumentsHomeNavigationOptions = {}) => {
    const navigation = {
      name: "documents-home",
      query: {
        locale: resolveNavigationLocale(options.locale),
      },
    } as const;

    if (options.replace) {
      await router.replace(navigation);
      return true;
    }

    await router.push(navigation);
    return true;
  };

  return {
    openWorkspaceDocument,
    openShareAccess,
    goToDocumentsHome,
  };
};
