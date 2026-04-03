import { ref } from "vue";
import { defineStore } from "pinia";
import type { BackendUser } from "../editor/backendClient";

export const useAccountSessionStore = defineStore("lumen-account-session", () => {
  const sessionUser = ref<BackendUser | null>(null);

  const setSessionUser = (user: BackendUser | null) => {
    sessionUser.value = user;
  };

  const clearSessionUser = () => {
    sessionUser.value = null;
  };

  return {
    sessionUser,
    setSessionUser,
    clearSessionUser,
  };
});
