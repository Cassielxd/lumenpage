import type { App } from "vue";
import { Avatar } from "tdesign-vue-next/es/avatar";
import { Button } from "tdesign-vue-next/es/button";
import { ColorPicker } from "tdesign-vue-next/es/color-picker";
import { Dialog } from "tdesign-vue-next/es/dialog";
import { Divider } from "tdesign-vue-next/es/divider";
import { Dropdown } from "tdesign-vue-next/es/dropdown";
import { Input } from "tdesign-vue-next/es/input";
import { Content, Footer, Header, Layout } from "tdesign-vue-next/es/layout";
import { MessagePlugin } from "tdesign-vue-next/es/message/plugin";
import { Popup } from "tdesign-vue-next/es/popup";
import { Select } from "tdesign-vue-next/es/select";
import { Tag } from "tdesign-vue-next/es/tag";
import { Textarea } from "tdesign-vue-next/es/textarea";
import { Tooltip } from "tdesign-vue-next/es/tooltip";

const tdesignPlugins = [
  Avatar,
  Button,
  ColorPicker,
  Dialog,
  Divider,
  Dropdown,
  Input,
  Layout,
  Header,
  Content,
  Footer,
  MessagePlugin,
  Popup,
  Select,
  Tag,
  Textarea,
  Tooltip,
];

export const installTDesign = (app: App) => {
  for (const plugin of tdesignPlugins) {
    app.use(plugin);
  }

  return app;
};
