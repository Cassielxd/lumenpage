import { defineConfig } from "vitepress";

export default defineConfig({
  title: "LumenPage",
  titleTemplate: "LumenPage",
  description: "面向分页文档场景的 Canvas 编辑器文档站",
  lang: "zh-CN",
  srcDir: ".",
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/lumenpage-mark.svg" }],
  ],
  themeConfig: {
    siteTitle: "LumenPage",
    logo: "/lumenpage-mark.svg",
    nav: [
      { text: "指南", link: "/guide/lumen-entry" },
      { text: "API", link: "/api/lumen-app" },
      { text: "示例", link: "/demo/lumen-app" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "项目指南",
          items: [
            { text: "从 Lumen 入口开始", link: "/guide/lumen-entry" },
            { text: "快速开始", link: "/guide/getting-started" },
            { text: "Lumen 运行时配置", link: "/guide/lumen-config" },
            { text: "Lumen 扩展装配", link: "/guide/lumen-extensions" },
            { text: "扩展与分页能力", link: "/guide/extensions-and-pagination" },
            { text: "工具栏动作", link: "/guide/toolbar-actions" },
            { text: "StarterKit 与扩展选择", link: "/guide/starter-kit-and-extensions" },
            { text: "插件入口", link: "/guide/plugin-entry" },
            { text: "底层编辑器用法", link: "/guide/editor-usage" },
          ],
        },
      ],
      "/api/": [
        {
          text: "应用与引擎 API",
          items: [
            { text: "Lumen App 入口", link: "/api/lumen-app" },
            { text: "Lumen 配置", link: "/api/lumen-config" },
            { text: "扩展清单与用法", link: "/api/lumen-extensions" },
            { text: "Toolbar Actions", link: "/api/toolbar-actions" },
            { text: "插件总览", link: "/api/plugins" },
            { text: "Core", link: "/api/core" },
            { text: "Editor", link: "/api/editor" },
            { text: "Extensions", link: "/api/extensions" },
            { text: "Canvas / Layout", link: "/api/rendering" },
          ],
        },
      ],
      "/demo/": [
        {
          text: "示例",
          items: [
            { text: "Basic Editor", link: "/demo/basic-editor" },
            { text: "Lumen App", link: "/demo/lumen-app" },
            { text: "Slash Command", link: "/demo/slash-command" },
          ],
        },
      ],
    },
    footer: {
      message: "LumenPage documentation",
      copyright: "Copyright (c) 2026",
    },
  },
});
