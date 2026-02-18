<template>
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
          :options="resolvedBlockTypeOptions"
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
          <t-button size="small" variant="text" class="icon-btn" @click="toggleCodeBlock">
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
          <t-button size="small" variant="text" class="icon-btn" @click="toggleBulletList">
            <Icon name="list" />
          </t-button>
        </t-tooltip>
        <t-tooltip content="有序列表">
          <t-button size="small" variant="text" class="icon-btn" @click="toggleOrderedList">
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
          <t-button size="small" variant="text" class="icon-btn" @click="alignLeft">
            <Icon name="format-vertical-align-left" />
          </t-button>
        </t-tooltip>
        <t-tooltip content="居中">
          <t-button size="small" variant="text" class="icon-btn" @click="alignCenter">
            <Icon name="format-vertical-align-center" />
          </t-button>
        </t-tooltip>
        <t-tooltip content="右对齐">
          <t-button size="small" variant="text" class="icon-btn" @click="alignRight">
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
</template>

<script setup lang="ts">
import { computed, ref, toRaw, watch } from "vue";
import { Icon } from "tdesign-icons-vue-next";
import type { CanvasEditorView } from "lumenpage-view-canvas";

const props = defineProps<{
  editorView: CanvasEditorView | null;
  blockTypeOptions?: Array<{ label: string; value: string }>;
}>();

const defaultBlockTypeOptions = [
  { label: "正文", value: "paragraph" },
  { label: "标题 1", value: "heading-1" },
  { label: "标题 2", value: "heading-2" },
  { label: "标题 3", value: "heading-3" },
];

const resolvedBlockTypeOptions = computed(
  () => props.blockTypeOptions || defaultBlockTypeOptions
);

const blockType = ref("paragraph");

const getCommands = () => props.editorView?.commands || null;
const run = (name: string, ...args: unknown[]) => {
  const commands = getCommands();
  const command = commands?.[name];
  if (typeof command !== "function") {
    return false;
  }
  return command(...args);
};

const runUndo = () => run("undo");
const runRedo = () => run("redo");
const toggleBold = () => run("toggleBold");
const toggleItalic = () => run("toggleItalic");
const toggleUnderline = () => run("toggleUnderline");
const toggleStrike = () => run("toggleStrike");
const toggleInlineCode = () => run("toggleInlineCode");
const toggleBlockquote = () => run("toggleBlockquote");
const toggleCodeBlock = () => run("toggleCodeBlock");
const insertHorizontalRule = () => run("insertHorizontalRule");
const toggleBulletList = () => run("toggleBulletList");
const toggleOrderedList = () => run("toggleOrderedList");
const indent = () => run("indent");
const outdent = () => run("outdent");
const alignLeft = () => run("alignLeft");
const alignCenter = () => run("alignCenter");
const alignRight = () => run("alignRight");

const toggleLink = () => {
  const view = props.editorView ? toRaw(props.editorView) : null;
  if (!view) {
    return false;
  }
  const markType = view.state.schema.marks.link;
  if (!markType) {
    return false;
  }
  const { from, to, empty, $cursor } = view.state.selection as any;
  const hasLink = empty
    ? !!markType.isInSet(view.state.storedMarks || $cursor?.marks() || [])
    : view.state.doc.rangeHasMark(from, to, markType);
  const defaultValue = hasLink ? "" : "https://";
  const url = window.prompt("请输入链接地址", defaultValue);
  if (url === null) {
    return false;
  }
  if (!url.trim()) {
    return run("toggleLink");
  }
  return run("toggleLink", { href: url.trim(), title: url.trim() });
};

const insertImage = () => {
  const src = window.prompt("请输入图片地址", "");
  if (!src) {
    return false;
  }
  return run("insertImage", { src });
};

const insertVideo = () => {
  const src = window.prompt("请输入视频地址", "");
  if (!src) {
    return false;
  }
  return run("insertVideo", { src, embed: false });
};

const handleBlockTypeChange = (value: string) => {
  if (value === "paragraph") {
    run("setBlockType", "paragraph");
    return;
  }
  if (value.startsWith("heading-")) {
    const level = Number.parseInt(value.replace("heading-", ""), 10);
    if (Number.isFinite(level)) {
      run("setBlockType", "heading", level);
    }
  }
};

watch(blockType, (value) => {
  handleBlockTypeChange(value);
});

const statusEl = ref<HTMLElement | null>(null);

defineExpose({ statusEl });
</script>

<style scoped>
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
</style>