<template>
  <div v-if="metrics" ref="rootRef" class="doc-ruler">
    <div class="doc-ruler-track">
      <svg class="doc-ruler-svg" :viewBox="`0 0 ${metrics.viewportWidth} ${RULER_HEIGHT}`" preserveAspectRatio="none">
        <rect class="doc-ruler-band" :x="metrics.pageX" y="0" :width="metrics.pageWidth" :height="RULER_HEIGHT" />
        <rect
          class="doc-ruler-margin"
          :x="metrics.pageX"
          y="0"
          :width="metrics.margin.left"
          :height="RULER_HEIGHT"
        />
        <rect
          class="doc-ruler-margin"
          :x="metrics.contentRightX"
          y="0"
          :width="metrics.margin.right"
          :height="RULER_HEIGHT"
        />
        <line
          v-for="tick in tickItems"
          :key="`tick-${tick.offset}`"
          class="doc-ruler-tick"
          :class="`is-${tick.kind}`"
          :x1="tick.x"
          :x2="tick.x"
          y1="0"
          :y2="resolveTickHeight(tick.kind)"
        />
        <text
          v-for="tick in labelTicks"
          :key="`label-${tick.offset}`"
          class="doc-ruler-label"
          :x="tick.x + 3"
          y="12"
        >
          {{ tick.label }}
        </text>
        <line class="doc-ruler-guide" :x1="metrics.contentLeftX" :x2="metrics.contentLeftX" y1="0" :y2="RULER_HEIGHT" />
        <line
          class="doc-ruler-guide"
          :x1="metrics.contentRightX"
          :x2="metrics.contentRightX"
          y1="0"
          :y2="RULER_HEIGHT"
        />
      </svg>

      <button
        type="button"
        class="doc-ruler-handle is-left"
        :class="{ 'is-dragging': dragState?.side === 'left' }"
        :style="{ left: `${metrics.contentLeftX}px` }"
        :aria-label="leftHandleLabel"
        :title="leftHandleLabel"
        @pointerdown="handleHandlePointerDown('left', $event)"
      >
        <span class="doc-ruler-handle-value">{{ Math.round(metrics.margin.left) }}</span>
      </button>

      <button
        type="button"
        class="doc-ruler-handle is-right"
        :class="{ 'is-dragging': dragState?.side === 'right' }"
        :style="{ left: `${metrics.contentRightX}px` }"
        :aria-label="rightHandleLabel"
        :title="rightHandleLabel"
        @pointerdown="handleHandlePointerDown('right', $event)"
      >
        <span class="doc-ruler-handle-value">{{ Math.round(metrics.margin.right) }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { CanvasEditorView } from "lumenpage-view-canvas";

import {
  buildHorizontalRulerTicks,
  clampHorizontalMarginValue,
  computeHorizontalRulerMetrics,
  normalizeRulerMargin,
  type HorizontalRulerMetrics,
  type RulerMargin,
} from "../editor/rulerMath";
import type { PlaygroundLocale } from "../editor/i18n";
import { coercePlaygroundLocale, createPlaygroundI18n } from "../editor/i18n";

const RULER_HEIGHT = 28;
const REFRESH_INTERVAL_MS = 180;

type RulerSnapshot = {
  viewportWidth: number;
  pageWidth: number;
  margin: RulerMargin;
};

const props = defineProps<{
  editorView: CanvasEditorView | null;
  locale?: PlaygroundLocale | string;
}>();

const rootRef = ref<HTMLElement | null>(null);
const snapshot = ref<RulerSnapshot | null>(null);
const previewMargin = ref<RulerMargin | null>(null);
const dragState = ref<{ side: "left" | "right" } | null>(null);

let resizeObserver: ResizeObserver | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let refreshFrameId = 0;
let marginFrameId = 0;
let pendingMargin: RulerMargin | null = null;

const currentLocale = computed(() => coercePlaygroundLocale(props.locale));
const texts = computed(() => createPlaygroundI18n(currentLocale.value).ruler);

const metrics = computed<HorizontalRulerMetrics | null>(() => {
  if (!snapshot.value) {
    return null;
  }
  const nextMargin = previewMargin.value || snapshot.value.margin;
  return computeHorizontalRulerMetrics({
    viewportWidth: snapshot.value.viewportWidth,
    pageWidth: snapshot.value.pageWidth,
    margin: nextMargin,
  });
});

const tickItems = computed(() => {
  if (!metrics.value) {
    return [];
  }
  return buildHorizontalRulerTicks({
    pageWidth: metrics.value.pageWidth,
    pageX: metrics.value.pageX,
  });
});

const labelTicks = computed(() => tickItems.value.filter((tick) => tick.label));

const leftHandleLabel = computed(() => {
  if (!metrics.value) {
    return texts.value.leftMargin;
  }
  return `${texts.value.leftMargin}: ${Math.round(metrics.value.margin.left)}`;
});

const rightHandleLabel = computed(() => {
  if (!metrics.value) {
    return texts.value.rightMargin;
  }
  return `${texts.value.rightMargin}: ${Math.round(metrics.value.margin.right)}`;
});

const resolveTickHeight = (kind: "minor" | "mid" | "major") => {
  if (kind === "major") {
    return 18;
  }
  if (kind === "mid") {
    return 12;
  }
  return 8;
};

const getScrollArea = () => props.editorView?._internals?.dom?.scrollArea ?? null;

const applyMarginPatch = (margin: RulerMargin) => {
  const currentView = props.editorView;
  if (!currentView) {
    return false;
  }
  const settings = currentView?._internals?.settings;
  if (!settings) {
    return false;
  }
  const currentMargin = normalizeRulerMargin(
    currentView.getPaginationInfo?.()?.margin ?? settings.margin
  );
  const nextMargin = {
    ...currentMargin,
    ...margin,
  };
  settings.margin = nextMargin;
  if (typeof currentView.forceLayout === "function") {
    currentView.forceLayout({
      clearLayoutCache: true,
      clearPageCache: true,
      immediate: true,
    });
    currentView?._internals?.updateCaret?.(true);
  } else {
    currentView?._internals?.layoutPipeline?.clearCache?.();
    currentView?._internals?.renderer?.pageCache?.clear?.();
    currentView?._internals?.updateLayout?.();
    currentView?._internals?.updateCaret?.(true);
    currentView?._internals?.scheduleRender?.();
  }
  if (snapshot.value) {
    snapshot.value = {
      ...snapshot.value,
      margin: nextMargin,
    };
  }
  return true;
};

const flushPendingMargin = () => {
  if (!pendingMargin) {
    return;
  }
  const nextMargin = pendingMargin;
  pendingMargin = null;
  applyMarginPatch(nextMargin);
};

const scheduleMarginPatch = (margin: RulerMargin) => {
  pendingMargin = margin;
  if (marginFrameId && typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(marginFrameId);
  }
  marginFrameId = requestAnimationFrame(() => {
    marginFrameId = 0;
    flushPendingMargin();
  });
};

const readSnapshot = (): RulerSnapshot | null => {
  const currentView = props.editorView;
  const scrollArea = getScrollArea();
  const pagination = currentView?.getPaginationInfo?.();
  if (!scrollArea || !pagination) {
    return null;
  }
  const viewportWidth = Math.max(0, Number(scrollArea.clientWidth) || 0);
  const pageWidth = Math.max(0, Number(pagination.pageWidth) || 0);
  if (viewportWidth <= 0 || pageWidth <= 0) {
    return null;
  }
  return {
    viewportWidth,
    pageWidth,
    margin: normalizeRulerMargin(pagination.margin),
  };
};

const refreshSnapshot = () => {
  snapshot.value = readSnapshot();
  if (!dragState.value) {
    previewMargin.value = null;
  }
};

const scheduleRefresh = () => {
  if (refreshFrameId && typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(refreshFrameId);
  }
  refreshFrameId = requestAnimationFrame(() => {
    refreshFrameId = 0;
    refreshSnapshot();
  });
};

const bindViewListeners = () => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (refreshTimer != null) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  window.removeEventListener("resize", scheduleRefresh);
  const scrollArea = getScrollArea();
  if (!scrollArea) {
    refreshSnapshot();
    return;
  }
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => {
      scheduleRefresh();
    });
    resizeObserver.observe(scrollArea);
    if (rootRef.value) {
      resizeObserver.observe(rootRef.value);
    }
  }
  window.addEventListener("resize", scheduleRefresh, { passive: true });
  refreshTimer = setInterval(() => {
    refreshSnapshot();
  }, REFRESH_INTERVAL_MS);
  refreshSnapshot();
};

const resolvePointerX = (event: PointerEvent) => {
  const rect = rootRef.value?.getBoundingClientRect();
  if (!rect) {
    return null;
  }
  return event.clientX - rect.left;
};

const buildDraggedMargin = (side: "left" | "right", pointerX: number) => {
  const currentMetrics = metrics.value;
  if (!currentMetrics) {
    return null;
  }
  const currentMargin = previewMargin.value || currentMetrics.margin;
  if (side === "left") {
    const nextLeft = clampHorizontalMarginValue({
      side: "left",
      pageWidth: currentMetrics.pageWidth,
      margin: currentMargin,
      value: pointerX - currentMetrics.pageX,
    });
    return {
      ...currentMargin,
      left: nextLeft,
    };
  }
  const nextRight = clampHorizontalMarginValue({
    side: "right",
    pageWidth: currentMetrics.pageWidth,
    margin: currentMargin,
    value: currentMetrics.pageWidth - (pointerX - currentMetrics.pageX),
  });
  return {
    ...currentMargin,
    right: nextRight,
  };
};

const handleHandlePointerDown = (side: "left" | "right", event: PointerEvent) => {
  if (!metrics.value) {
    return;
  }
  dragState.value = { side };
  previewMargin.value = metrics.value.margin;
  event.preventDefault();
};

const handleWindowPointerMove = (event: PointerEvent) => {
  if (!dragState.value) {
    return;
  }
  const pointerX = resolvePointerX(event);
  if (pointerX == null) {
    return;
  }
  const nextMargin = buildDraggedMargin(dragState.value.side, pointerX);
  if (!nextMargin) {
    return;
  }
  previewMargin.value = nextMargin;
  scheduleMarginPatch(nextMargin);
  event.preventDefault();
};

const handleWindowPointerUp = () => {
  if (!dragState.value) {
    return;
  }
  flushPendingMargin();
  if (previewMargin.value) {
    applyMarginPatch(previewMargin.value);
  }
  dragState.value = null;
  previewMargin.value = null;
};

watch(
  () => props.editorView,
  () => {
    window.removeEventListener("resize", scheduleRefresh);
    bindViewListeners();
  },
  { immediate: true }
);

onMounted(() => {
  bindViewListeners();
  window.addEventListener("pointermove", handleWindowPointerMove, { passive: false });
  window.addEventListener("pointerup", handleWindowPointerUp, { passive: true });
  window.addEventListener("pointercancel", handleWindowPointerUp, { passive: true });
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  window.removeEventListener("resize", scheduleRefresh);
  window.removeEventListener("pointermove", handleWindowPointerMove);
  window.removeEventListener("pointerup", handleWindowPointerUp);
  window.removeEventListener("pointercancel", handleWindowPointerUp);
  if (refreshTimer != null) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  if (refreshFrameId && typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(refreshFrameId);
  }
  if (marginFrameId && typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(marginFrameId);
  }
  pendingMargin = null;
});
</script>

<style scoped>
.doc-ruler {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  height: 28px;
  border-bottom: 1px solid rgba(203, 213, 225, 0.8);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.98) 100%);
  user-select: none;
}

.doc-ruler-track {
  position: relative;
  width: 100%;
  height: 100%;
}

.doc-ruler-svg {
  display: block;
  width: 100%;
  height: 100%;
}

.doc-ruler-band {
  fill: rgba(255, 255, 255, 0.96);
}

.doc-ruler-margin {
  fill: rgba(191, 219, 254, 0.42);
}

.doc-ruler-tick {
  stroke: rgba(71, 85, 105, 0.58);
  stroke-width: 1;
}

.doc-ruler-tick.is-major {
  stroke: rgba(15, 23, 42, 0.68);
}

.doc-ruler-label {
  fill: #64748b;
  font-size: 10px;
  line-height: 1;
}

.doc-ruler-guide {
  stroke: rgba(37, 99, 235, 0.45);
  stroke-width: 1;
}

.doc-ruler-handle {
  position: absolute;
  top: calc(100% - 1px);
  width: 10px;
  height: 16px;
  padding: 0;
  border: 0;
  background: transparent;
  transform: translate(-50%, -50%);
  cursor: ew-resize;
}

.doc-ruler-handle::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 1px;
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 7px solid #2563eb;
  transform: translateX(-50%);
  filter: drop-shadow(0 1px 2px rgba(15, 23, 42, 0.18));
}

.doc-ruler-handle-value {
  position: absolute;
  top: -22px;
  left: 50%;
  min-width: 28px;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.76);
  color: #ffffff;
  font-size: 10px;
  line-height: 1.2;
  text-align: center;
  transform: translateX(-50%);
  opacity: 0;
  transition: opacity 0.16s ease;
  pointer-events: none;
}

.doc-ruler-handle:hover .doc-ruler-handle-value,
.doc-ruler-handle.is-dragging .doc-ruler-handle-value {
  opacity: 1;
}

:global(.doc-shell.is-high-contrast) .doc-ruler {
  border-color: rgba(255, 255, 255, 0.36);
  background: #000000;
}

:global(.doc-shell.is-high-contrast) .doc-ruler-band {
  fill: rgba(17, 24, 39, 0.96);
}

:global(.doc-shell.is-high-contrast) .doc-ruler-margin {
  fill: rgba(59, 130, 246, 0.28);
}

:global(.doc-shell.is-high-contrast) .doc-ruler-tick {
  stroke: rgba(255, 255, 255, 0.52);
}

:global(.doc-shell.is-high-contrast) .doc-ruler-tick.is-major {
  stroke: rgba(255, 255, 255, 0.88);
}

:global(.doc-shell.is-high-contrast) .doc-ruler-label {
  fill: rgba(255, 255, 255, 0.74);
}

:global(.doc-shell.is-high-contrast) .doc-ruler-guide {
  stroke: rgba(147, 197, 253, 0.7);
}

@media (max-width: 768px) {
  .doc-ruler {
    display: none;
  }
}
</style>
