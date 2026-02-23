<template>
  <t-header class="menu-bar">
    <div class="menu-left">
      <t-dropdown :options="fileMenuOptions" trigger="click" @click="handleFileMenuClick">
        <t-button size="small" variant="text" class="menu-trigger">{{ i18n.menu.file }}</t-button>
      </t-dropdown>
      <t-dropdown :options="toolMenuOptions" trigger="click" @click="handleToolMenuClick">
        <t-button size="small" variant="text" class="menu-trigger">{{ i18n.menu.tools }}</t-button>
      </t-dropdown>
    </div>
  </t-header>
</template>

<script setup lang="ts">
import { computed, toRaw } from "vue";
import type { CanvasEditorView } from "lumenpage-view-canvas";
import { DOMParser as PMDOMParser, DOMSerializer } from "lumenpage-model";
import { closeHistory } from "lumenpage-history";
import { loadMarkdownModule } from "../editor/markdownBridge";
import { createPlaygroundI18n, type PlaygroundLocale } from "../editor/i18n";

const props = defineProps<{
  editorView: CanvasEditorView | null;
  locale?: PlaygroundLocale;
}>();

const i18n = computed(() => createPlaygroundI18n(props.locale));

const fileMenuOptions = computed(() => [
  { content: i18n.value.menu.importJson, value: "import-json" },
  { content: i18n.value.menu.exportJson, value: "export-json" },
  { content: i18n.value.menu.importHtml, value: "import-html" },
  { content: i18n.value.menu.exportHtml, value: "export-html" },
  { content: i18n.value.menu.importMarkdown, value: "import-markdown" },
  { content: i18n.value.menu.exportMarkdown, value: "export-markdown" },
]);

const toolMenuOptions = computed(() => [
  { content: i18n.value.menu.historyBoundary, value: "history-boundary" },
]);

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
    window.alert(i18n.value.menu.unsupportedExportJson);
    return;
  }
  const json = (view as any).getJSON();
  const text = JSON.stringify(json, null, 2);
  const copied = await copyToClipboard(text);
  if (copied) {
    window.alert(i18n.value.menu.copiedJson);
    return;
  }
  window.prompt(i18n.value.menu.promptCopyJson, text);
};

const importJsonDoc = () => {
  const view = getView();
  if (!view || typeof (view as any).setJSON !== "function") {
    window.alert(i18n.value.menu.unsupportedImportJson);
    return;
  }
  const raw = window.prompt(i18n.value.menu.promptPasteJson, "");
  if (raw == null || raw.trim().length === 0) {
    return;
  }
  try {
    const json = JSON.parse(raw);
    (view as any).setJSON(json);
  } catch (_error) {
    window.alert(i18n.value.menu.invalidJson);
  }
};

const exportHtmlDoc = async () => {
  const view = getView();
  const state = view?.state;
  const ownerDocument = view?.dom?.ownerDocument || (typeof document !== "undefined" ? document : null);
  if (!view || !state?.doc || !state?.schema || !ownerDocument) {
    window.alert(i18n.value.menu.unsupportedExportHtml);
    return;
  }
  const serializer = DOMSerializer.fromSchema(state.schema);
  const container = ownerDocument.createElement("div");
  container.appendChild(serializer.serializeFragment(state.doc.content));
  const html = container.innerHTML;
  const copied = await copyToClipboard(html);
  if (copied) {
    window.alert(i18n.value.menu.copiedHtml);
    return;
  }
  window.prompt(i18n.value.menu.promptCopyHtml, html);
};

const importHtmlDoc = () => {
  const view = getView();
  const state = view?.state;
  const ownerDocument = view?.dom?.ownerDocument || (typeof document !== "undefined" ? document : null);
  if (!view || typeof (view as any).setJSON !== "function" || !state?.schema || !ownerDocument) {
    window.alert(i18n.value.menu.unsupportedImportHtml);
    return;
  }
  const raw = window.prompt(i18n.value.menu.promptPasteHtml, "");
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
    window.alert(i18n.value.menu.parseHtmlFailed);
  }
};

const exportMarkdownDoc = async () => {
  const view = getView();
  const state = view?.state;
  if (!state?.doc) {
    window.alert(i18n.value.menu.unsupportedExportMarkdown);
    return;
  }

  let markdownMod: Awaited<ReturnType<typeof loadMarkdownModule>> | null = null;
  try {
    markdownMod = await loadMarkdownModule();
  } catch (_error) {
    window.alert(i18n.value.menu.markdownModuleLoadFailed);
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
    window.alert(i18n.value.menu.markdownExportFailed);
    return;
  }

  const copied = await copyToClipboard(text);
  if (copied) {
    window.alert(i18n.value.menu.copiedMarkdown);
    return;
  }
  window.prompt(i18n.value.menu.promptCopyMarkdown, text);
};

const importMarkdownDoc = () => {
  const view = getView();
  if (!view || typeof (view as any).setJSON !== "function") {
    window.alert(i18n.value.menu.unsupportedImportMarkdown);
    return;
  }
  const raw = window.prompt(i18n.value.menu.promptPasteMarkdown, "");
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
        window.alert(i18n.value.menu.markdownImportFailed);
      }
    })
    .catch(() => {
      window.alert(i18n.value.menu.markdownModuleLoadFailed);
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

