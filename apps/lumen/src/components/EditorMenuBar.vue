<template>
  <t-header class="menu-bar" role="menubar" @keydown="handleMenuBarKeyDown">
    <div class="menu-left">
      <div class="menu-tabs" role="tablist" :aria-label="menuTabAriaLabel">
        <t-button
          v-for="item in toolbarMenuItems"
          :key="item.value"
          size="small"
          variant="text"
          class="menu-trigger menu-tab-trigger"
          :data-toolbar-menu="item.value"
          :class="{ 'is-active': item.value === resolvedActiveMenu }"
          role="tab"
          :aria-selected="item.value === resolvedActiveMenu"
          @click="selectToolbarMenu(item.value)"
        >
          {{ item.label }}
        </t-button>
      </div>
    </div>
  </t-header>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { PlaygroundLocale } from "../editor/i18n";
import { getVisibleToolbarMenuTabs, type ToolbarMenuKey } from "../editor/toolbarCatalog";

const props = defineProps<{
  locale?: PlaygroundLocale;
  activeMenu?: ToolbarMenuKey;
}>();

const emit = defineEmits<{
  (e: "update:activeMenu", value: ToolbarMenuKey): void;
}>();

const resolvedActiveMenu = computed<ToolbarMenuKey>(() => props.activeMenu || "base");
const menuTabAriaLabel = computed(() =>
  props.locale === "en-US" ? "Toolbar categories" : "工具栏分类"
);

const toolbarMenuItems = computed<Array<{ value: ToolbarMenuKey; label: string }>>(() =>
  getVisibleToolbarMenuTabs().map((item) => ({
    value: item.value,
    label: item.label[props.locale === "en-US" ? "en-US" : "zh-CN"],
  }))
);

const selectToolbarMenu = (value: ToolbarMenuKey) => {
  if (value !== resolvedActiveMenu.value) {
    emit("update:activeMenu", value);
  }
};

const getMenuTriggers = (scope: HTMLElement | null) => {
  if (!scope) {
    return [] as HTMLElement[];
  }
  const triggers = Array.from(scope.querySelectorAll<HTMLElement>(".menu-trigger"));
  return triggers.filter((trigger) => {
    const htmlButton = trigger as HTMLButtonElement;
    if (htmlButton.disabled || trigger.getAttribute("aria-disabled") === "true") {
      return false;
    }
    return trigger.offsetParent !== null;
  });
};

const handleMenuBarKeyDown = (event: KeyboardEvent) => {
  if (
    event.key !== "ArrowLeft" &&
    event.key !== "ArrowRight" &&
    event.key !== "Home" &&
    event.key !== "End"
  ) {
    return;
  }
  const scope = event.currentTarget as HTMLElement | null;
  const triggers = getMenuTriggers(scope);
  if (triggers.length === 0) {
    return;
  }
  const target = event.target as HTMLElement | null;
  const activeTrigger = target?.closest?.(".menu-trigger") as HTMLElement | null;
  const currentIndex = activeTrigger ? triggers.indexOf(activeTrigger) : -1;
  if (currentIndex < 0) {
    return;
  }
  let nextIndex = currentIndex;
  if (event.key === "ArrowRight") {
    nextIndex = (currentIndex + 1) % triggers.length;
  } else if (event.key === "ArrowLeft") {
    nextIndex = (currentIndex - 1 + triggers.length) % triggers.length;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = triggers.length - 1;
  }
  const nextTrigger = triggers[nextIndex];
  if (!nextTrigger || nextTrigger === activeTrigger) {
    return;
  }
  event.preventDefault();
  nextTrigger.focus();
};
</script>

<style scoped>
.menu-bar {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  height: 34px;
  padding: 0 12px;
  background: #ffffff;
  border-bottom: 1px solid #eceff1;
}

.menu-left {
  display: flex;
  align-items: center;
  min-width: 0;
}

.menu-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
}

.menu-trigger {
  height: 28px;
  border-radius: 6px !important;
  justify-content: center;
  font-size: 13px;
  font-weight: 500;
  color: #202124;
  border: 1px solid transparent !important;
  background: transparent !important;
}

.menu-tab-trigger {
  min-width: 56px;
}

.menu-trigger:hover {
  background: #f1f3f4 !important;
}

.menu-tab-trigger.is-active {
  background: #e8f0fe !important;
  color: #1a73e8 !important;
}

.menu-trigger:focus,
.menu-trigger:active,
.menu-trigger:focus-visible {
  border-color: transparent !important;
  box-shadow: none !important;
  background: #e8f0fe !important;
}

@media (max-width: 960px) {
  .menu-tab-trigger {
    min-width: 50px;
    padding: 0 8px;
  }
}
</style>
