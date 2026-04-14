<template>
  <div ref="panelRef" class="context-menu-panel" role="menu" aria-label="Context menu">
    <Menu
      class="context-menu-root"
      theme="light"
      expand-type="popup"
      width="184px"
    >
      <ContextMenuPanelList
        :items="items"
        :on-run-action="onRunAction"
        :attach="resolveAttach"
      />
    </Menu>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { Menu } from "tdesign-vue-next/es/menu";

import ContextMenuPanelList from "./ContextMenuPanelList.vue";

defineOptions({
  name: "ContextMenuPanel",
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

const props = defineProps<{
  items: ContextMenuPanelItem[];
  onRunAction: (id: string) => void;
}>();

const panelRef = ref<HTMLElement | null>(null);

const resolveAttach = () => panelRef.value;
</script>

<style scoped>
.context-menu-panel {
  display: block;
  min-width: 184px;
  padding: 3px;
  border: 1px solid rgba(15, 23, 42, 0.14);
  border-radius: 14px;
  background: #ffffff;
  box-shadow:
    0 0 0 1px rgba(15, 23, 42, 0.03),
    0 18px 42px rgba(15, 23, 42, 0.16),
    0 8px 24px rgba(15, 23, 42, 0.08);
}

.context-menu-panel :deep(.context-menu-root.t-menu) {
  min-width: 184px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: transparent;
  box-shadow: none;
}

.context-menu-panel :deep(.context-menu-root.t-menu--light),
.context-menu-panel :deep(.context-menu-submenu-popup) {
  background: #ffffff;
}

.context-menu-panel :deep(.context-menu-root .t-menu__item-link) {
  width: 100%;
}

.context-menu-panel :deep(.context-menu-submenu-popup .t-menu__item-link) {
  width: 100%;
}

.context-menu-panel :deep(.context-menu-action-hitbox) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 7px;
  width: 100%;
  min-height: 32px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.context-menu-panel :deep(.context-menu-action-hitbox:disabled) {
  cursor: not-allowed;
}

.context-menu-panel :deep(.t-menu__item),
.context-menu-panel :deep(.t-submenu > .t-menu__item) {
  position: relative;
  min-height: 32px;
  margin: 0;
  padding: 0 7px;
  border-radius: 10px;
  color: #0f172a;
  transition:
    background-color 140ms ease,
    color 140ms ease,
    box-shadow 140ms ease;
}

.context-menu-panel :deep(.t-menu__item:hover),
.context-menu-panel :deep(.t-submenu.t-is-opened > .t-menu__item) {
  background: rgba(37, 99, 235, 0.08);
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.1);
}

.context-menu-panel :deep(.context-menu-node--danger > .t-menu__item) {
  color: #b91c1c;
}

.context-menu-panel :deep(.context-menu-node--danger > .t-menu__item:hover),
.context-menu-panel :deep(.context-menu-node--danger.t-is-opened > .t-menu__item) {
  background: rgba(220, 38, 38, 0.08);
  box-shadow: inset 0 0 0 1px rgba(220, 38, 38, 0.12);
}

.context-menu-panel :deep(.context-menu-node--disabled > .t-menu__item) {
  opacity: 0.45;
}

.context-menu-panel :deep(.context-menu-node--group-start::before) {
  content: "";
  position: absolute;
  left: 7px;
  right: 7px;
  top: -2px;
  height: 1px;
  background: rgba(15, 23, 42, 0.08);
  pointer-events: none;
}

.context-menu-panel :deep(.t-menu__content) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 7px;
  width: 100%;
}

.context-menu-panel :deep(.context-menu-label) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 7px;
  width: 100%;
}

.context-menu-panel :deep(.context-menu-label__main) {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  flex: 1 1 auto;
}

.context-menu-panel :deep(.context-menu-label__icon) {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
  opacity: 0.86;
}

.context-menu-panel :deep(.context-menu-label__text) {
  flex: 1 1 auto;
  font-size: 12px;
  line-height: 1.25;
  font-weight: 500;
  letter-spacing: 0.01em;
}

.context-menu-panel :deep(.context-menu-label__shortcut) {
  flex: 0 0 auto;
  color: #1d4ed8;
  font-size: 10px;
  line-height: 1.2;
  padding: 1px 4px;
  border-radius: 999px;
  border: 1px solid rgba(37, 99, 235, 0.14);
  background: rgba(255, 255, 255, 0.96);
}

.context-menu-panel :deep(.context-menu-submenu-shell) {
  z-index: 2;
}

.context-menu-panel :deep(.context-menu-submenu-popup) {
  min-width: 184px;
  padding: 3px;
  border: 1px solid rgba(15, 23, 42, 0.14);
  border-radius: 14px;
  box-shadow:
    0 0 0 1px rgba(15, 23, 42, 0.03),
    0 18px 42px rgba(15, 23, 42, 0.16),
    0 8px 24px rgba(15, 23, 42, 0.08);
}

.context-menu-panel :deep(.context-menu-submenu-popup .t-menu__popup-wrapper) {
  margin: 0;
  padding: 0;
}

.context-menu-panel :deep(.t-fake-arrow) {
  color: #64748b;
  opacity: 0.86;
}

.context-menu-panel :deep(.t-submenu.t-is-opened > .t-menu__item .t-fake-arrow) {
  color: #1e293b;
}

.context-menu-panel :deep(.t-menu__operations) {
  display: none;
}
</style>
