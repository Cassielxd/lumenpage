import { ref } from "vue";
import { defineStore } from "pinia";
import type { BackendUser } from "../editor/backendClient";

export const useAccountSessionStore = defineStore("lumen-account-session", () => {
  const backendUrlOverride = ref("");
  const sessionUser = ref<BackendUser | null>(null);

  const setBackendUrlOverride = (backendUrl: string) => {
    backendUrlOverride.value = String(backendUrl || "").trim();
  };

  const clearBackendUrlOverride = () => {
    backendUrlOverride.value = "";
  };

  const setSessionUser = (user: BackendUser | null) => {
    sessionUser.value = user;
  };

  const clearSessionUser = () => {
    sessionUser.value = null;
  };

  return {
    backendUrlOverride,
    setBackendUrlOverride,
    clearBackendUrlOverride,
    sessionUser,
    setSessionUser,
    clearSessionUser,
  };
});
