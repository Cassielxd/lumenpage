<template>
  <t-layout class="app-shell">
    <t-header class="topbar">
      <div class="topbar-left">
        <div class="logo">LP</div>
        <div class="brand">腾讯文档</div>
        <t-input v-model="docTitle" class="title-input" size="small" />
        <t-tag size="small" theme="success" variant="light">已保存</t-tag>
      </div>
      <div class="topbar-right">
        <t-button size="small" theme="primary">分享</t-button>
        <t-button size="small" variant="outline">评论</t-button>
        <t-avatar size="small">U</t-avatar>
      </div>
    </t-header>

    <t-header class="toolbar">
      <div class="toolbar-left">
        <div class="toolbar-group">
          <t-tooltip content="撤销">
            <t-button size="small" variant="text" class="icon-btn" @click="runUndo">
              <Icon name="arrow-left" />
            </t-button>
          </t-tooltip>
          <t-tooltip content="重做">
            <t-button size="small" variant="text" class="icon-btn" @click="runRedo">
              <Icon name="arrow-right" />
            </t-button>
          </t-tooltip>
        </div>

        <t-divider layout="vertical" class="toolbar-divider" />

        <div class="toolbar-group">
          <t-select
            v-model="blockType"
            size="small"
            class="block-select"
            :options="blockTypeOptions"
          />
        </div>

        <t-divider layout="vertical" class="toolbar-divider" />

        <div class="toolbar-group">
          <t-tooltip content="加粗">
            <t-button size="small" variant="text" class="icon-btn" @click="toggleBold">
              <Icon name="textformat-bold" />
            </t-button>
          </t-tooltip>
          <t-tooltip content="斜体">
            <t-button size="small" variant="text" class="icon-btn" @click="toggleItalic">
              <Icon name="textformat-italic" />
            </t-button>
          </t-tooltip>
          <t-tooltip content="下划线">
            <t-button size="small" variant="text" class="icon-btn" @click="toggleUnderline">
              <Icon name="textformat-underline" />
            </t-button>
          </t-tooltip>
          <t-tooltip content="删除线">
            <t-button size="small" variant="text" class="icon-btn" @click="toggleStrike">
              <Icon name="textformat-strikethrough" />
            </t-button>
          </t-tooltip>
          <t-tooltip content="行内代码">
            <t-button size="small" variant="text" class="icon-btn" @click="toggleInlineCode">
              <Icon name="code" />
            </t-button>
          </t-tooltip>
        </div>

        <t-divider layout="vertical" class="toolbar-divider" />

        <div class="toolbar-group">
          <t-tooltip content="链接">
            <t-button size="small" variant="text" class="icon-btn" @click="toggleLink">
              <Icon name="link" />
            </t-button>
          </t-tooltip>
          <t-tooltip content="引用">
            <t-button size="small" variant="text" class="icon-btn" @click="toggleBlockquote">
              <Icon name="quote" />
            </t-button>
          </t-tooltip>
          <t-tooltip content="代码块">
            <t-button size="small" variant="text" class="icon-btn" @click="applyCodeBlock">
              <Icon name="code" />
            </t-button>
          </t-tooltip>
          <t-tooltip content="分割线">
            <t-button size="small" variant="text" class="icon-btn" @click="insertHorizontalRule">
              <Icon name="minus" />
            </t-button>
          </t-tooltip>
        </div>

        <t-divider layout="vertical" class="toolbar-divider" />

        <div class="toolbar-group">
          <t-tooltip content="无序列表">
            <t-button size="small" variant="text" class="icon-btn" @click="applyBulletList">
              <Icon name="list" />
            </t-button>
          </t-tooltip>
          <t-tooltip content="有序列表">
            <t-button size="small" variant="text" class="icon-btn" @click="applyOrderedList">
              <Icon name="list-numbered" />
            </t-button>
          </t-tooltip>
          <t-tooltip content="减少缩进">
            <t-button size="small" variant="text" class="icon-btn" @click="outdent">
              <Icon name="indent-left" />
            </t-button>
          </t-tooltip>
          <t-tooltip content="增加缩进">
            <t-button size="small" variant="text" class="icon-btn" @click="indent">
              <Icon name="indent-right" />
            </t-button>
          </t-tooltip>
        </div>

        <t-divider layout="vertical" class="toolbar-divider" />

        <div class="toolbar-group">
          <t-tooltip content="左对齐">
            <t-button size="small" variant="text" class="icon-btn" @click="setAlign('left')">
              <Icon name="format-vertical-align-left" />
            </t-button>
          </t-tooltip>
          <t-tooltip content="居中">
            <t-button size="small" variant="text" class="icon-btn" @click="setAlign('center')">
              <Icon name="format-vertical-align-center" />
            </t-button>
          </t-tooltip>
          <t-tooltip content="右对齐">
            <t-button size="small" variant="text" class="icon-btn" @click="setAlign('right')">
              <Icon name="format-vertical-align-right" />
            </t-button>
          </t-tooltip>
        </div>

        <t-divider layout="vertical" class="toolbar-divider" />

        <div class="toolbar-group">
          <t-tooltip content="插入图片">
            <t-button size="small" variant="text" class="icon-btn" @click="insertImage">
              <Icon name="image" />
            </t-button>
          </t-tooltip>
          <t-tooltip content="插入视频">
            <t-button size="small" variant="text" class="icon-btn" @click="insertVideo">
              <Icon name="video" />
            </t-button>
          </t-tooltip>
        </div>
      </div>
      <div class="toolbar-right">
        <span ref="statusEl" class="status">0 pages</span>
      </div>
    </t-header>

    <t-content class="editor-area">
      <div ref="editorHost" class="editor-host"></div>
    </t-content>
  </t-layout>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, toRaw, watch } from "vue";
import { Icon } from "tdesign-icons-vue-next";
import {
  basicCommands,
  changeParagraphIndent,
  createDefaultNodeRendererRegistry,
  createDocFromText,
  runCommand,
  schema,
  setBlockAlign,
  setHeadingLevel,
  setParagraph,
} from "lumenpage-kit-basic";
import { baseKeymap, setBlockType, toggleMark, wrapIn } from "lumenpage-commands";
import { liftTarget } from "lumenpage-transform";
import { keymap } from "lumenpage-keymap";
import { CanvasEditorView, createCanvasState } from "lumenpage-view-canvas";
import { history } from "lumenpage-history";

const docTitle = ref("项目周报");
const editorHost = ref<HTMLElement | null>(null);
const statusEl = ref<HTMLElement | null>(null);
const view = shallowRef<CanvasEditorView | null>(null);
let destroyDevTools: (() => void) | null = null;

const blockType = ref("paragraph");
const blockTypeOptions = [
  { label: "正文", value: "paragraph" },
  { label: "标题 1", value: "heading-1" },
  { label: "标题 2", value: "heading-2" },
  { label: "标题 3", value: "heading-3" },
];

const settings = {
  pageWidth: 816,
  pageHeight: 720,
  pageGap: 24,
  margin: {
    top: 72,
    right: 72,
    bottom: 72,
    left: 72,
  },
  lineHeight: 22,
  font: "16px Arial",
  wrapTolerance: 2,
  pageBuffer: 1,
  maxPageCache: 16,
};

const initialDocJson = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "项目周报（示例）" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text:
            "本周完成了核心编辑器、分页布局与协同选区渲染，整体稳定性明显提升。",
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "进展摘要" }],
    },
    {
      type: "bullet_list",
      content: [
        {
          type: "list_item",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "完成增量分页与页级缓存复用。" }],
            },
          ],
        },
        {
          type: "list_item",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "补齐 keymap 插件，快捷键体验一致。" }],
            },
          ],
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "下周计划" }],
    },
    {
      type: "ordered_list",
      attrs: { order: 1 },
      content: [
        {
          type: "list_item",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "完善输入法组合态显示。" }],
            },
          ],
        },
        {
          type: "list_item",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "优化大文档滚动性能。" }],
            },
          ],
        },
      ],
    },
  ],
};

const nodeRegistry = createDefaultNodeRendererRegistry();

const withView = (handler: (rawView: CanvasEditorView) => boolean) => {
  const rawView = view.value ? toRaw(view.value) : null;
  if (!rawView) {
    return false;
  }
  return handler(rawView);
};

const runCommandWithView = (command: any) =>
  withView((rawView) => {
    rawView.focus?.();
    return runCommand(command, rawView.state, rawView.dispatch.bind(rawView));
  });

const applyParagraph = () => runCommandWithView(setParagraph());
const applyHeading = (level: number) => runCommandWithView(setHeadingLevel(level));
const setAlign = (align: "left" | "center" | "right") =>
  runCommandWithView(setBlockAlign(align));
const runUndo = () => runCommandWithView(basicCommands.undo);
const runRedo = () => runCommandWithView(basicCommands.redo);

const handleBlockTypeChange = (value: string) => {
  if (value === "paragraph") {
    applyParagraph();
    return;
  }
  if (value.startsWith("heading-")) {
    const level = Number.parseInt(value.replace("heading-", ""), 10);
    if (Number.isFinite(level)) {
      applyHeading(level);
    }
  }
};

watch(blockType, (value) => {
  handleBlockTypeChange(value);
});

const toggleMarkByName = (name: string, attrs: Record<string, unknown> | null = null) =>
  withView((rawView) => {
    const markType = rawView.state.schema.marks[name];
    if (!markType) {
      return false;
    }
    rawView.focus?.();
    return runCommand(toggleMark(markType, attrs), rawView.state, rawView.dispatch.bind(rawView));
  });

const toggleBold = () => toggleMarkByName("strong");
const toggleItalic = () => toggleMarkByName("em");
const toggleUnderline = () => toggleMarkByName("underline");
const toggleStrike = () => toggleMarkByName("strike");
const toggleInlineCode = () => toggleMarkByName("code");

const toggleLink = () =>
  withView((rawView) => {
    const markType = rawView.state.schema.marks.link;
    if (!markType) {
      return false;
    }
    const { from, to, empty, $cursor } = rawView.state.selection as any;
    const hasLink = empty
      ? !!markType.isInSet(rawView.state.storedMarks || $cursor?.marks() || [])
      : rawView.state.doc.rangeHasMark(from, to, markType);
    const defaultValue = hasLink ? "" : "https://";
    const url = window.prompt("请输入链接地址", defaultValue);
    if (url === null) {
      return false;
    }
    rawView.focus?.();
    if (!url.trim()) {
      return runCommand(toggleMark(markType), rawView.state, rawView.dispatch.bind(rawView));
    }
    return runCommand(
      toggleMark(markType, { href: url.trim(), title: url.trim() }),
      rawView.state,
      rawView.dispatch.bind(rawView)
    );
  });

const toggleBlockquote = () =>
  withView((rawView) => {
    const type = rawView.state.schema.nodes.blockquote;
    if (!type) {
      return false;
    }
    rawView.focus?.();
    return runCommand(wrapIn(type), rawView.state, rawView.dispatch.bind(rawView));
  });

const applyCodeBlock = () =>
  withView((rawView) => {
    const type = rawView.state.schema.nodes.code_block;
    if (!type) {
      return false;
    }
    rawView.focus?.();
    const { $from, $to } = rawView.state.selection as any;
    if ($from?.parent?.type === type) {
      return runCommand(setParagraph(), rawView.state, rawView.dispatch.bind(rawView));
    }

    const command = setBlockType(type);
    if (runCommand(command, rawView.state, rawView.dispatch.bind(rawView))) {
      return true;
    }

    const range = $from?.blockRange?.($to);
    if (!range) {
      return false;
    }
    const target = liftTarget(range);
    if (target == null) {
      return false;
    }
    const tr = rawView.state.tr.lift(range, target);
    rawView.dispatch(tr.scrollIntoView());
    return runCommand(command, rawView.state, rawView.dispatch.bind(rawView));
  });

const insertHorizontalRule = () =>
  withView((rawView) => {
    const type = rawView.state.schema.nodes.horizontal_rule;
    if (!type) {
      return false;
    }
    const tr = rawView.state.tr.replaceSelectionWith(type.create());
    rawView.dispatch(tr.scrollIntoView());
    rawView.focus?.();
    return true;
  });

const applyBulletList = () =>
  withView((rawView) => {
    const type = rawView.state.schema.nodes.bullet_list;
    if (!type) {
      return false;
    }
    rawView.focus?.();
    return runCommand(wrapIn(type), rawView.state, rawView.dispatch.bind(rawView));
  });

const applyOrderedList = () =>
  withView((rawView) => {
    const type = rawView.state.schema.nodes.ordered_list;
    if (!type) {
      return false;
    }
    rawView.focus?.();
    return runCommand(wrapIn(type), rawView.state, rawView.dispatch.bind(rawView));
  });

const indent = () => runCommandWithView(changeParagraphIndent(1));
const outdent = () => runCommandWithView(changeParagraphIndent(-1));

const insertImage = () =>
  withView((rawView) => {
    const type = rawView.state.schema.nodes.image;
    if (!type) {
      return false;
    }
    const src = window.prompt("请输入图片地址", "");
    if (!src) {
      return false;
    }
    const node = type.create({ src });
    const tr = rawView.state.tr.replaceSelectionWith(node);
    rawView.dispatch(tr.scrollIntoView());
    rawView.focus?.();
    return true;
  });

const insertVideo = () =>
  withView((rawView) => {
    const type = rawView.state.schema.nodes.video;
    if (!type) {
      return false;
    }
    const src = window.prompt("请输入视频地址", "");
    if (!src) {
      return false;
    }
    const node = type.create({ src, embed: false });
    const tr = rawView.state.tr.replaceSelectionWith(node);
    rawView.dispatch(tr.scrollIntoView());
    rawView.focus?.();
    return true;
  });

onMounted(() => {
  if (!editorHost.value) {
    return;
  }
  const editorState = createCanvasState({
    schema,
    createDocFromText,
    json: initialDocJson,
    plugins: [history(), keymap(baseKeymap)],
    canvasConfig: {
      settings,
      nodeRegistry,
      debug: { layout: true },
      commands: {
        basicCommands,
        runCommand,
        setBlockAlign,
      },
      statusElement: statusEl.value || undefined,
    },
  });
  view.value = new CanvasEditorView(editorHost.value, { state: editorState });
  if (import.meta.env.DEV) {
    import("prosemirror-dev-tools").then((mod) => {
      const applyDevTools = mod.default || mod.applyDevTools;
      const rawView = view.value ? toRaw(view.value) : null;
      if (!applyDevTools || !rawView) {
        return;
      }
      destroyDevTools = applyDevTools(rawView as any);
    });
  }
});

onBeforeUnmount(() => {
  if (destroyDevTools) {
    destroyDevTools();
    destroyDevTools = null;
  }
  view.value?.destroy();
  view.value = null;
});
</script>

<style scoped>
.app-shell {
  height: 100vh;
  width: 100%;
  background: #f5f6f8;
  color: #1f2329;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #ffffff;
  border-bottom: 1px solid #e5e6eb;
  padding: 0 20px;
  height: 52px;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand {
  font-weight: 600;
  font-size: 14px;
}

.logo {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: #3370ff;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.title-input {
  width: 200px;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: 6px 10px;
  padding: 10px 16px;
  height: auto;
  min-height: 0;
  background: #ffffff;
  border-bottom: 1px solid #e5e6eb;
}

.toolbar-left {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  align-items: center;
  gap: 6px 10px;
  flex-wrap: wrap;
}

.toolbar-right {
  display: flex;
  align-items: center;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.toolbar-divider {
  height: 24px;
}

.block-select {
  width: 120px;
}

.icon-btn {
  width: 28px;
  height: 28px;
  padding: 0;
}

.icon-btn :deep(.t-icon) {
  font-size: 16px;
}

.status {
  font-size: 12px;
  color: #8f959e;
}

.editor-area {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding: 0;
  background: #f5f6f8;
  overflow: hidden;
}

.editor-host {
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  position: relative;
}

.editor-host .lumenpage-editor {
  position: relative;
  width: 100%;
  height: 100%;
  margin: 0 auto;
}

.editor-host .lumenpage-viewport {
  width: 100%;
  height: 100%;
}
</style>
































