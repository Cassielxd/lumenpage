<template>
  <t-header class="menu-bar">
    <div class="menu-left">
      <t-dropdown :options="fileMenuOptions" trigger="click" @click="handleFileMenuClick">
        <t-button size="small" variant="text" class="menu-trigger">文件</t-button>
      </t-dropdown>
      <t-dropdown :options="toolMenuOptions" trigger="click" @click="handleToolMenuClick">
        <t-button size="small" variant="text" class="menu-trigger">工具</t-button>
      </t-dropdown>
    </div>
  </t-header>
</template>

<script setup lang="ts">
import { toRaw } from "vue";
import type { CanvasEditorView } from "lumenpage-view-canvas";
import { DOMParser as PMDOMParser, DOMSerializer } from "lumenpage-model";
import { closeHistory } from "lumenpage-history";
import { loadMarkdownModule } from "../editor/markdownBridge";

const props = defineProps<{
  editorView: CanvasEditorView | null;
}>();

const fileMenuOptions = [
  { content: "导入 JSON", value: "import-json" },
  { content: "导出 JSON", value: "export-json" },
  { content: "导入 HTML", value: "import-html" },
  { content: "导出 HTML", value: "export-html" },
  { content: "导入 Markdown", value: "import-markdown" },
  { content: "导出 Markdown", value: "export-markdown" },
];

const toolMenuOptions = [{ content: "切分历史分组", value: "history-boundary" }];

const getView = () => (props.editorView ? toRaw(props.editorView) : null);

const copyToClipboard = async (text: string) => {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  return false;
};

const exportJsonDoc = async () => {
  const view = getView();
  if (!view || typeof (view as any).getJSON !== "function") {
    window.alert("当前编辑器不支持导出 JSON");
    return;
  }
  const json = (view as any).getJSON();
  const text = JSON.stringify(json, null, 2);
  const copied = await copyToClipboard(text);
  if (copied) {
    window.alert("文档 JSON 已复制到剪贴板");
    return;
  }
  window.prompt("复制以下 JSON", text);
};

const importJsonDoc = () => {
  const view = getView();
  if (!view || typeof (view as any).setJSON !== "function") {
    window.alert("当前编辑器不支持导入 JSON");
    return;
  }
  const raw = window.prompt("请粘贴文档 JSON", "");
  if (raw == null || raw.trim().length === 0) {
    return;
  }
  try {
    const json = JSON.parse(raw);
    (view as any).setJSON(json);
  } catch (_error) {
    window.alert("JSON 格式无效，导入失败");
  }
};

const exportHtmlDoc = async () => {
  const view = getView();
  const state = view?.state;
  const ownerDocument = view?.dom?.ownerDocument || (typeof document !== "undefined" ? document : null);
  if (!view || !state?.doc || !state?.schema || !ownerDocument) {
    window.alert("当前编辑器不支持导出 HTML");
    return;
  }
  const serializer = DOMSerializer.fromSchema(state.schema);
  const container = ownerDocument.createElement("div");
  container.appendChild(serializer.serializeFragment(state.doc.content));
  const html = container.innerHTML;
  const copied = await copyToClipboard(html);
  if (copied) {
    window.alert("文档 HTML 已复制到剪贴板");
    return;
  }
  window.prompt("复制以下 HTML", html);
};

const importHtmlDoc = () => {
  const view = getView();
  const state = view?.state;
  const ownerDocument = view?.dom?.ownerDocument || (typeof document !== "undefined" ? document : null);
  if (!view || typeof (view as any).setJSON !== "function" || !state?.schema || !ownerDocument) {
    window.alert("当前编辑器不支持导入 HTML");
    return;
  }
  const raw = window.prompt("请粘贴 HTML", "");
  if (raw == null || raw.trim().length === 0) {
    return;
  }
  try {
    const parser = PMDOMParser.fromSchema(state.schema);
    const host = ownerDocument.createElement("div");
    host.innerHTML = raw;
    const docNode = parser.parse(host);
    (view as any).setJSON(docNode.toJSON());
  } catch (_error) {
    window.alert("HTML 解析失败，导入失败");
  }
};

const exportMarkdownDoc = async () => {
  const view = getView();
  const state = view?.state;
  if (!state?.doc) {
    window.alert("当前编辑器不支持导出 Markdown");
    return;
  }

  let markdownMod: Awaited<ReturnType<typeof loadMarkdownModule>> | null = null;
  try {
    markdownMod = await loadMarkdownModule();
  } catch (_error) {
    window.alert("Markdown 模块加载失败，请检查 lumenpage-markdown 依赖");
    return;
  }

  let text = "";
  try {
    const { defaultMarkdownSerializer, MarkdownSerializer } = markdownMod;
    try {
      text = defaultMarkdownSerializer.serialize(state.doc);
    } catch (_strictError) {
      const tolerantSerializer = new MarkdownSerializer(
        defaultMarkdownSerializer.nodes,
        defaultMarkdownSerializer.marks,
        { strict: false }
      );
      text = tolerantSerializer.serialize(state.doc);
    }
  } catch (error) {
    console.error("Markdown export failed:", error);
    window.alert("Markdown 导出失败：当前文档包含不兼容节点");
    return;
  }

  const copied = await copyToClipboard(text);
  if (copied) {
    window.alert("文档 Markdown 已复制到剪贴板");
    return;
  }
  window.prompt("复制以下 Markdown", text);
};

const importMarkdownDoc = () => {
  const view = getView();
  if (!view || typeof (view as any).setJSON !== "function") {
    window.alert("当前编辑器不支持导入 Markdown");
    return;
  }
  const raw = window.prompt("请粘贴 Markdown", "");
  if (raw == null || raw.trim().length === 0) {
    return;
  }
  loadMarkdownModule()
    .then(({ defaultMarkdownParser }) => {
      try {
        const doc = defaultMarkdownParser.parse(raw);
        (view as any).setJSON(doc.toJSON());
      } catch (error) {
        console.error("Markdown import failed:", error);
        window.alert("Markdown 导入失败：内容格式不受支持或不合法");
      }
    })
    .catch(() => {
      window.alert("Markdown 模块加载失败，请检查 lumenpage-markdown 依赖");
    });
};

const markHistoryBoundary = () => {
  const view = getView();
  if (!view?.state?.tr) {
    return;
  }
  view.dispatch(closeHistory(view.state.tr));
};

const handleFileMenuClick = (payload: any) => {
  const value = payload?.value ?? payload;
  switch (value) {
    case "import-json":
      importJsonDoc();
      break;
    case "export-json":
      exportJsonDoc();
      break;
    case "import-html":
      importHtmlDoc();
      break;
    case "export-html":
      exportHtmlDoc();
      break;
    case "import-markdown":
      importMarkdownDoc();
      break;
    case "export-markdown":
      exportMarkdownDoc();
      break;
    default:
      break;
  }
};

const handleToolMenuClick = (payload: any) => {
  const value = payload?.value ?? payload;
  if (value === "history-boundary") {
    markHistoryBoundary();
  }
};
</script>

<style scoped>
.menu-bar {
  display: flex;
  align-items: center;
  height: 34px;
  padding: 0 14px;
  background: #ffffff;
  border-bottom: 1px solid #eceef2;
}

.menu-left {
  display: flex;
  align-items: center;
  gap: 4px;
}

.menu-trigger {
  min-width: 52px;
  justify-content: center;
  font-weight: 500;
  color: #1f2329;
  border: 1px solid transparent !important;
  background: transparent !important;
}

.menu-trigger:hover {
  background: #f2f3f5 !important;
}

.menu-trigger:focus,
.menu-trigger:active,
.menu-trigger:focus-visible {
  border-color: transparent !important;
  box-shadow: none !important;
  background: #eef3ff !important;
}
</style>

