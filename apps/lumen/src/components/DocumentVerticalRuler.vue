<template>
  <div v-if="snapshot" ref="rootRef" class="doc-ruler-vertical">
    <div class="doc-ruler-vertical-track">
      <svg
        class="doc-ruler-vertical-svg"
        :viewBox="`0 0 ${RULER_WIDTH} ${snapshot.viewportHeight}`"
        preserveAspectRatio="none"
      >
        <template v-for="page in visiblePages" :key="`page-${page.index}`">
          <rect class="doc-ruler-band" x="0" :y="page.pageTopY" :width="RULER_WIDTH" :height="page.pageHeight" />
          <rect class="doc-ruler-margin" x="0" :y="page.pageTopY" :width="RULER_WIDTH" :height="page.margin.top" />
          <rect
            class="doc-ruler-margin"
            x="0"
            :y="page.contentBottomY"
            :width="RULER_WIDTH"
            :height="page.margin.bottom"
          />
          <line
            v-for="tick in page.tickItems"
            :key="`tick-${page.index}-${tick.offset}`"
            class="doc-ruler-tick"
            :class="`is-${tick.kind}`"
            :x1="RULER_WIDTH - resolveTickWidth(tick.kind)"
            :x2="RULER_WIDTH"
            :y1="tick.y"
            :y2="tick.y"
          />
          <text
            v-for="tick in page.labelTicks"
            :key="`label-${page.index}-${tick.offset}`"
            class="doc-ruler-label"
            x="2"
            :y="tick.y + 8"
          >
            {{ tick.label }}
          </text>
          <line class="doc-ruler-guide" x1="0" :x2="RULER_WIDTH" :y1="page.contentTopY" :y2="page.contentTopY" />
          <line
            class="doc-ruler-guide"
            x1="0"
            :x2="RULER_WIDTH"
            :y1="page.contentBottomY"
            :y2="page.contentBottomY"
          />
        </template>
      </svg>

      <button
        v-if="activePage"
        type="button"
        class="doc-ruler-vertical-handle is-top"
        :class="{ 'is-dragging': dragState?.side === 'top' }"
        :style="{ top: `${activePage.contentTopY}px` }"
        :aria-label="topHandleLabel"
        :title="topHandleLabel"
        @pointerdown="handleHandlePointerDown('top', $event)"
      >
        <span class="doc-ruler-vertical-handle-value">{{ Math.round(activePage.margin.top) }}</span>
      </button>

      <button
        v-if="activePage"
        type="button"
        class="doc-ruler-vertical-handle is-bottom"
        :class="{ 'is-dragging': dragState?.side === 'bottom' }"
        :style="{ top: `${activePage.contentBottomY}px` }"
        :aria-label="bottomHandleLabel"
        :title="bottomHandleLabel"
        @pointerdown="handleHandlePointerDown('bottom', $event)"
      >
        <span class="doc-ruler-vertical-handle-value">{{ Math.round(activePage.margin.bottom) }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { CanvasEditorView } from "lumenpage-view-canvas";

import {
  buildVerticalRulerTicks,
  clampVerticalMarginValue,
  normalizeRulerMargin,
  type RulerMargin,
  type VerticalRulerTick,
} from "../editor/rulerMath";
import type { PlaygroundLocale } from "../editor/i18n";
import { coercePlaygroundLocale, createPlaygroundI18n } from "../editor/i18n";

const RULER_WIDTH = 28;
const REFRESH_INTERVAL_MS = 180;

type VisibleVerticalPage = {
  index: number;
  pageTopY: number;
  pageHeight: number;
  margin: RulerMargin;
  contentTopY: number;
  contentBottomY: number;
  tickItems: VerticalRulerTick[];
  labelTicks: VerticalRulerTick[];
};

type VerticalRulerSnapshot = {
  viewportHeight: number;
  pageHeight: number;
  pageGap: number;
  margin: RulerMargin;
  visibleStartIndex: number;
  visiblePages: VisibleVerticalPage[];
};

const props = defineProps<{
  editorView: CanvasEditorView | null;
  locale?: PlaygroundLocale | string;
}>();

const rootRef = ref<HTMLElement | null>(null);
const snapshot = ref<VerticalRulerSnapshot | null>(null);
const previewMargin = ref<RulerMargin | null>(null);
const dragState = ref<{ side: "top" | "bottom" } | null>(null);

let resizeObserver: ResizeObserver | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let refreshFrameId = 0;
let marginFrameId = 0;
let pendingMargin: RulerMargin | null = null;
let boundScrollArea: HTMLElement | null = null;

const currentLocale = computed(() => coercePlaygroundLocale(props.locale));
const texts = computed(() => createPlaygroundI18n(currentLocale.value).ruler);

const visiblePages = computed(() => {
  if (!snapshot.value) {
    return [];
  }
  const margin = previewMargin.value || snapshot.value.margin;
  return snapshot.value.visiblePages.map((page) => {
    const nextPage = {
      ...page,
      margin,
      contentTopY: page.pageTopY + margin.top,
      contentBottomY: page.pageTopY + page.pageHeight - margin.bottom,
      tickItems: buildVerticalRulerTicks({
        pageHeight: page.pageHeight,
        pageTopY: page.pageTopY,
      }),
    };
    return {
      ...nextPage,
      labelTicks: nextPage.tickItems.filter((tick) => tick.label),
    };
  });
});

const activePage = computed(() => visiblePages.value[0] || null);

const topHandleLabel = computed(() => {
  if (!activePage.value) {
    return texts.value.topMargin;
  }
  return `${texts.value.topMargin}: ${Math.round(activePage.value.margin.top)}`;
});

const bottomHandleLabel = computed(() => {
  if (!activePage.value) {
    return texts.value.bottomMargin;
  }
  return `${texts.value.bottomMargin}: ${Math.round(activePage.value.margin.bottom)}`;
});

const resolveTickWidth = (kind: "minor" | "mid" | "major") => {
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

const readSnapshot = (): VerticalRulerSnapshot | null => {
  const currentView = props.editorView;
  const scrollArea = getScrollArea();
  const pagination = currentView?.getPaginationInfo?.();
  if (!scrollArea || !pagination) {
    return null;
  }
  const viewportHeight = Math.max(0, Number(scrollArea.clientHeight) || 0);
  const pageHeight = Math.max(0, Number(pagination.pageHeight) || 0);
  if (viewportHeight <= 0 || pageHeight <= 0) {
    return null;
  }
  const margin = normalizeRulerMargin(pagination.margin);
  const visiblePageItems = Array.isArray(pagination.pages)
    ? pagination.pages.filter(
        (page: { fromY?: number; toY?: number }) =>
          Number(page?.toY) > Number(pagination.scrollTop) &&
          Number(page?.fromY) < Number(pagination.scrollTop) + viewportHeight
      )
    : [];

  const visiblePages = visiblePageItems.map((page: { index?: number; fromY?: number }) => {
    const pageTopY = Number(page?.fromY) - Number(pagination.scrollTop || 0);
    const tickItems = buildVerticalRulerTicks({
      pageHeight,
      pageTopY,
    });
    return {
      index: Number(page?.index) || 0,
      pageTopY,
      pageHeight,
      margin,
      contentTopY: pageTopY + margin.top,
      contentBottomY: pageTopY + pageHeight - margin.bottom,
      tickItems,
      labelTicks: tickItems.filter((tick) => tick.label),
    };
  });

  return {
    viewportHeight,
    pageHeight,
    pageGap: Math.max(0, Number(pagination.pageGap) || 0),
    margin,
    visibleStartIndex: Math.max(0, Number(pagination.visibleRange?.startIndex) || 0),
    visiblePages,
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
  boundScrollArea?.removeEventListener("scroll", scheduleRefresh);
  boundScrollArea = null;
  window.removeEventListener("resize", scheduleRefresh);
  const scrollArea = getScrollArea();
  if (!scrollArea) {
    refreshSnapshot();
    return;
  }
  boundScrollArea = scrollArea;
  boundScrollArea.addEventListener("scroll", scheduleRefresh, { passive: true });
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

const resolvePointerY = (event: PointerEvent) => {
  const rect = rootRef.value?.getBoundingClientRect();
  if (!rect) {
    return null;
  }
  return event.clientY - rect.top;
};

const buildDraggedMargin = (side: "top" | "bottom", pointerY: number) => {
  const currentPage = activePage.value;
  if (!currentPage) {
    return null;
  }
  const currentMargin = previewMargin.value || currentPage.margin;
  if (side === "top") {
    const nextTop = clampVerticalMarginValue({
      side: "top",
      pageHeight: currentPage.pageHeight,
      margin: currentMargin,
      value: pointerY - currentPage.pageTopY,
    });
    return {
      ...currentMargin,
      top: nextTop,
    };
  }
  const nextBottom = clampVerticalMarginValue({
    side: "bottom",
    pageHeight: currentPage.pageHeight,
    margin: currentMargin,
    value: currentPage.pageHeight - (pointerY - currentPage.pageTopY),
  });
  return {
    ...currentMargin,
    bottom: nextBottom,
  };
};

const handleHandlePointerDown = (side: "top" | "bottom", event: PointerEvent) => {
  if (!activePage.value) {
    return;
  }
  dragState.value = { side };
  previewMargin.value = activePage.value.margin;
  event.preventDefault();
};

const handleWindowPointerMove = (event: PointerEvent) => {
  if (!dragState.value) {
    return;
  }
  const pointerY = resolvePointerY(event);
  if (pointerY == null) {
    return;
  }
  const nextMargin = buildDraggedMargin(dragState.value.side, pointerY);
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
  boundScrollArea?.removeEventListener("scroll", scheduleRefresh);
  boundScrollArea = null;
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
.doc-ruler-vertical {
  position: relative;
  flex: 0 0 28px;
  width: 28px;
  height: 100%;
  border-right: 1px solid rgba(203, 213, 225, 0.8);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.98) 100%);
  user-select: none;
}

.doc-ruler-vertical-track {
  position: relative;
  width: 100%;
  height: 100%;
}

.doc-ruler-vertical-svg {
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

.doc-ruler-vertical-handle {
  position: absolute;
  left: calc(100% - 1px);
  width: 16px;
  height: 10px;
  padding: 0;
  border: 0;
  background: transparent;
  transform: translate(-50%, -50%);
  cursor: ns-resize;
}

.doc-ruler-vertical-handle::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 1px;
  width: 0;
  height: 0;
  border-top: 5px solid transparent;
  border-bottom: 5px solid transparent;
  border-left: 7px solid #2563eb;
  transform: translateY(-50%);
  filter: drop-shadow(0 1px 2px rgba(15, 23, 42, 0.18));
}

.doc-ruler-vertical-handle-value {
  position: absolute;
  left: 16px;
  top: 50%;
  min-width: 28px;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.76);
  color: #ffffff;
  font-size: 10px;
  line-height: 1.2;
  text-align: center;
  transform: translateY(-50%);
  opacity: 0;
  transition: opacity 0.16s ease;
  pointer-events: none;
}

.doc-ruler-vertical-handle:hover .doc-ruler-vertical-handle-value,
.doc-ruler-vertical-handle.is-dragging .doc-ruler-vertical-handle-value {
  opacity: 1;
}

:global(.doc-shell.is-high-contrast) .doc-ruler-vertical {
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
  .doc-ruler-vertical {
    display: none;
  }
}
</style>
