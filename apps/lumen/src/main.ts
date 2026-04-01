import { createApp } from "vue";
import "tdesign-vue-next/es/style/index.css";
import "./styles.css";
import App from "./App.vue";
import { createLumenI18n, resolvePlaygroundLocale } from "./editor/i18n";
import { installTDesign } from "./installTDesign";

const app = createApp(App);

app.use(createLumenI18n(resolvePlaygroundLocale()));

installTDesign(app).mount("#app");
