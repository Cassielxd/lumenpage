import { createApp } from "vue";
import "tdesign-vue-next/es/style/index.css";
import "./styles.css";
import App from "./App.vue";
import { installTDesign } from "./installTDesign";

installTDesign(createApp(App)).mount("#app");
