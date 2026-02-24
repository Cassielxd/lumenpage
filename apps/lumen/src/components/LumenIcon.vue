<template>
  <span class="lumen-icon" :style="iconStyle" aria-hidden="true">
    <img v-if="resolvedSrc" :src="resolvedSrc" :alt="name" />
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    name: string;
    size?: string | number;
  }>(),
  {
    size: 16,
  }
);

const iconMap = import.meta.glob("../assets/editor-icons/*.svg", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const iconAlias: Record<string, string> = {
  background: "page-background",
  delete: "remove",
  "font-family": "format",
  "font-size": "font-size-increase",
  footer: "page-footer",
  header: "page-header",
  next: "table-next-cell",
  "option-box": "checkbox",
  orientation: "page-orientation",
  previous: "table-previous-cell",
  size: "page-size",
  "table-add": "table-add-row-after",
  "table-split": "table-split-cell",
};

const resolveSize = (value: string | number) => (typeof value === "number" ? `${value}px` : value);

const resolvedSrc = computed(() => {
  const direct = iconMap[`../assets/editor-icons/${props.name}.svg`];
  if (direct) {
    return direct;
  }
  const alias = iconAlias[props.name];
  if (alias) {
    const aliased = iconMap[`../assets/editor-icons/${alias}.svg`];
    if (aliased) {
      return aliased;
    }
  }
  return iconMap["../assets/editor-icons/menu.svg"] || "";
});

const iconStyle = computed(() => ({
  width: resolveSize(props.size),
  height: resolveSize(props.size),
}));
</script>

<style scoped>
.lumen-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  flex: 0 0 auto;
}

.lumen-icon img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
}
</style>
