import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { storeToRefs } from "pinia";
import {
  getBackendSession,
  normalizeBackendUrl,
  persistBackendUrl,
  resolveBackendUrl,
  type BackendUser,
} from "../editor/backendClient";
import { useAccountSessionStore } from "../stores/accountSession";

type UseBackendConnectionOptions = {
  fallbackUrl?: MaybeRefOrGetter<string | null | undefined>;
};

type RefreshSessionOptions = {
  suppressError?: boolean;
};

export const useBackendConnection = (options: UseBackendConnectionOptions = {}) => {
  const accountSessionStore = useAccountSessionStore();
  const { backendUrlOverride, sessionUser } = storeToRefs(accountSessionStore);

  const backendUrl = computed(() => {
    const override = String(backendUrlOverride.value || "").trim();
    if (override) {
      return override;
    }
    return resolveBackendUrl(toValue(options.fallbackUrl) || null);
  });

  const saveBackendUrl = (value: string) => {
    const normalized = normalizeBackendUrl(value);
    accountSessionStore.setBackendUrlOverride(normalized);
    persistBackendUrl(normalized);
    return normalized;
  };

  const setSessionUser = (user: BackendUser | null) => {
    accountSessionStore.setSessionUser(user);
  };

  const clearSessionUser = () => {
    accountSessionStore.clearSessionUser();
  };

  const refreshSession = async (options: RefreshSessionOptions = {}) => {
    try {
      const session = await getBackendSession(backendUrl.value);
      setSessionUser(session.user);
      return session.user;
    } catch (error) {
      clearSessionUser();
      if (options.suppressError) {
        return null;
      }
      throw error;
    }
  };

  return {
    backendUrlOverride,
    backendUrl,
    sessionUser,
    saveBackendUrl,
    setSessionUser,
    clearSessionUser,
    refreshSession,
  };
};
