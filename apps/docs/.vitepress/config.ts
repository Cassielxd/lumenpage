import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Lumenpage",
  description: "Canvas pagination editor documentation",
  lang: "zh-CN",
  srcDir: ".",
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    siteTitle: "Lumenpage",
    nav: [
      { text: "指南", link: "/guide/lumen-entry" },
      { text: "参考", link: "/api/lumen-app" },
      { text: "示例", link: "/demo/basic-editor" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Lumen Guide",
          items: [
            { text: "从 Lumen 入口开始", link: "/guide/lumen-entry" },
            { text: "如何配置编辑器", link: "/guide/lumen-config" },
            { text: "扩展组装方式", link: "/guide/lumen-extensions" },
            { text: "StarterKit 与扩展选择", link: "/guide/starter-kit-and-extensions" },
            { text: "工具栏能力", link: "/guide/toolbar-actions" },
            { text: "插件入口", link: "/guide/plugin-entry" },
            { text: "底层编辑器说明", link: "/guide/editor-usage" },
            { text: "扩展与分页", link: "/guide/extensions-and-pagination" },
            { text: "快速开始", link: "/guide/getting-started" },
          ],
        },
      ],
      "/api/": [
        {
          text: "Lumen API",
          items: [
            { text: "Lumen App 入口", link: "/api/lumen-app" },
            { text: "配置参数", link: "/api/lumen-config" },
            { text: "扩展清单", link: "/api/lumen-extensions" },
            { text: "工具栏 API", link: "/api/toolbar-actions" },
            { text: "插件总览", link: "/api/plugins" },
            { text: "Core", link: "/api/core" },
            { text: "Editor", link: "/api/editor" },
            { text: "Extension", link: "/api/extensions" },
            { text: "Canvas / Layout", link: "/api/rendering" },
          ],
        },
      ],
      "/demo/": [
        {
          text: "Demo",
          items: [
            { text: "Basic Editor", link: "/demo/basic-editor" },
            { text: "Lumen App", link: "/demo/lumen-app" },
            { text: "Slash Command", link: "/demo/slash-command" },
          ],
        },
      ],
    },
    footer: {
      message: "Lumenpage documentation",
      copyright: "Copyright (c) 2026",
    },
  },
});
