<template>
  <template v-for="item in displayItems" :key="item.id">
    <Submenu
      v-if="item.children?.length"
      :value="item.id"
      :disabled="item.disabled"
      :class="entryClassName(item)"
      :popup-props="submenuPopupProps"
    >
      <template #title>
        <span class="context-menu-label">
          <span class="context-menu-label__main">
            <LumenIcon
              v-if="item.icon"
              :name="item.icon"
              :size="14"
              class="context-menu-label__icon"
            />
            <span class="context-menu-label__text">{{ item.label }}</span>
          </span>
          <span v-if="item.shortcut" class="context-menu-label__shortcut">{{ item.shortcut }}</span>
        </span>
      </template>

      <ContextMenuPanelList
        :items="item.children"
        :on-run-action="onRunAction"
        :attach="attach"
      />
    </Submenu>

    <MenuItem
      v-else
      :value="item.id"
      :disabled="item.disabled"
      :class="entryClassName(item)"
    >
      <button
        type="button"
        class="context-menu-action-hitbox"
        :disabled="item.disabled"
        @mousedown.prevent
        @click.stop.prevent="handleLeafClick(item.id)"
        @keydown.enter.stop.prevent="handleLeafClick(item.id)"
        @keydown.space.stop.prevent="handleLeafClick(item.id)"
      >
        <span class="context-menu-label">
          <span class="context-menu-label__main">
            <LumenIcon
              v-if="item.icon"
              :name="item.icon"
              :size="14"
              class="context-menu-label__icon"
            />
            <span class="context-menu-label__text">{{ item.label }}</span>
          </span>
          <span v-if="item.shortcut" class="context-menu-label__shortcut">{{ item.shortcut }}</span>
        </span>
      </button>
    </MenuItem>
  </template>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { MenuItem, Submenu } from "tdesign-vue-next/es/menu";

import LumenIcon from "./LumenIcon.vue";

defineOptions({
  name: "ContextMenuPanelList",
});

type ContextMenuPanelItem =
  | {
      type: "separator";
      id: string;
    }
  | {
      type: "item";
      id: string;
      label: string;
      icon?: string;
      shortcut?: string;
      danger: boolean;
      disabled: boolean;
      children?: ContextMenuPanelItem[];
    };

type DisplayContextMenuItem = Extract<ContextMenuPanelItem, { type: "item" }> & {
  groupStart: boolean;
  children?: DisplayContextMenuItem[];
};

const props = defineProps<{
  items: ContextMenuPanelItem[];
  onRunAction: (id: string) => void;
  attach?: (() => HTMLElement | null) | null;
}>();

const normalizeItems = (items: ContextMenuPanelItem[]): DisplayContextMenuItem[] => {
  const normalized: DisplayContextMenuItem[] = [];
  let nextGroupStart = false;

  for (const item of items) {
    if (item.type === "separator") {
      if (normalized.length > 0) {
        nextGroupStart = true;
      }
      continue;
    }

    normalized.push({
      ...item,
      groupStart: nextGroupStart,
      children: Array.isArray(item.children) ? normalizeItems(item.children) : undefined,
    });
    nextGroupStart = false;
  }

  return normalized;
};

const displayItems = computed(() => normalizeItems(props.items));

const submenuPopupProps = computed(() => ({
  attach: props.attach || undefined,
  trigger: "hover" as const,
  destroyOnClose: false,
  showArrow: false,
  overlayClassName: "context-menu-submenu-shell",
  overlayInnerClassName: "context-menu-submenu-popup",
}));

const handleLeafClick = (itemId: string) => {
  const nextId = String(itemId || "").trim();
  if (!nextId) {
    return;
  }
  props.onRunAction(nextId);
};

const entryClassName = (item: DisplayContextMenuItem) => ({
  "context-menu-node": true,
  "context-menu-node--danger": item.danger,
  "context-menu-node--disabled": item.disabled,
  "context-menu-node--group-start": item.groupStart,
});
</script>
