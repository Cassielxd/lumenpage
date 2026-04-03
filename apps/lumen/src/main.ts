import { createApp } from "vue";
import { createPinia } from "pinia";
import VueKonva from "vue-konva";
import "tdesign-vue-next/es/style/index.css";
import "./styles.css";
import RootApp from "./RootApp.vue";
import { createLumenI18n, resolvePlaygroundLocale } from "./editor/i18n";
import { installTDesign } from "./installTDesign";
import { router } from "./router";

const app = createApp(RootApp);

app.use(createLumenI18n(resolvePlaygroundLocale()));
app.use(createPinia());
app.use(VueKonva);
app.use(router);

installTDesign(app).mount("#app");
