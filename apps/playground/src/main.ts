import { createApp } from "vue";
import "./styles.css";
import App from "./App.vue";
import { installTDesign } from "./installTDesign";

installTDesign(createApp(App)).mount("#app");
