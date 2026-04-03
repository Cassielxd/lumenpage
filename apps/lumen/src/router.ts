import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import DocumentsHomePage from "./pages/DocumentsHomePage.vue";
import ShareAccessPage from "./pages/ShareAccessPage.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "documents-home",
      component: DocumentsHomePage,
    },
    {
      path: "/docs/:documentId",
      name: "document-workspace",
      component: App,
    },
    {
      path: "/share/:token",
      name: "share-access",
      component: ShareAccessPage,
    },
  ],
});
