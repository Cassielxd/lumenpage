<template>
  <div
    class="doc-annotation-layer"
    :class="{ 'is-active': store.state.active }"
    :style="{ cursor: layerCursor }"
    @wheel="handleWheel"
  >
    <v-stage
      v-if="viewport.width > 0 && viewport.height > 0"
      ref="stageRef"
      :config="stageConfig"
      @mousedown="handlePointerDown"
      @mousemove="handlePointerMove"
      @mouseup="handlePointerUp"
      @mouseleave="handlePointerUp"
    >
      <v-layer>
        <v-line v-for="shape in lineShapes" :key="shape.id" :config="shape.config" />
        <v-rect v-for="shape in rectShapes" :key="shape.id" :config="shape.config" />
        <v-rect v-if="selectionBoundsShape" :config="selectionBoundsShape.config" />
        <v-rect v-for="shape in selectionHandleShapes" :key="shape.id" :config="shape.config" />
        <v-line v-if="draftLineShape" :config="draftLineShape.config" />
        <v-rect v-if="draftRectShape" :config="draftRectShape.config" />
      </v-layer>
    </v-stage>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { CanvasEditorView } from "lumenpage-view-canvas";

import type { LumenAnnotationStore } from "../annotation/annotationStore";
import type {
  AnnotationItem,
  AnnotationNormalizedPoint,
  AnnotationRect,
  AnnotationStroke,
  AnnotationTool,
} from "../annotation/annotationTypes";

type AnnotationPageRect = {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type AnnotationPointer = {
  x: number;
  y: number;
};

type AnnotationStrokeDraft = {
  kind: "stroke";
  tool: Extract<AnnotationTool, "pen" | "highlighter">;
  pageIndex: number;
  points: AnnotationNormalizedPoint[];
  color: string;
  width: number;
  opacity: number;
};

type AnnotationShapeDraft = {
  kind: "line" | "rect";
  pageIndex: number;
  start: AnnotationNormalizedPoint;
  end: AnnotationNormalizedPoint;
  color: string;
  width: number;
  opacity: number;
};

type AnnotationDraft = AnnotationStrokeDraft | AnnotationShapeDraft;

type AnnotationMoveState = {
  itemId: string;
  pageIndex: number;
  startPoint: AnnotationNormalizedPoint;
  originalItem: AnnotationItem;
  previewItem: AnnotationItem;
  moved: boolean;
};

type AnnotationResizeHandle = "nw" | "ne" | "sw" | "se";

type AnnotationResizeState = {
  itemId: string;
  pageIndex: number;
  handle: AnnotationResizeHandle;
  originalItem: AnnotationRect;
  previewItem: AnnotationRect;
  moved: boolean;
};

type RenderedShape = {
  id: string;
  config: Record<string, unknown>;
};

const props = defineProps<{
  editorView: CanvasEditorView | null;
  host: HTMLElement | null;
  store: LumenAnnotationStore;
}>();

const stageRef = ref<any>(null);
const viewport = ref({ width: 0, height: 0 });
const pageRects = ref<AnnotationPageRect[]>([]);
const draft = ref<AnnotationDraft | null>(null);
const moveState = ref<AnnotationMoveState | null>(null);
const resizeState = ref<AnnotationResizeState | null>(null);
let scrollAreaCleanup: (() => void) | null = null;
let resizeObserver: ResizeObserver | null = null;
let refreshFrameId = 0;

const getScrollArea = () => props.editorView?._internals?.dom?.scrollArea ?? null;
const getSpacer = () => props.editorView?._internals?.dom?.spacer ?? null;

const scheduleRefresh = () => {
  if (refreshFrameId && typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(refreshFrameId);
  }
  refreshFrameId = requestAnimationFrame(() => {
    refreshFrameId = 0;
    refreshViewport();
  });
};

const refreshViewport = () => {
  const host = props.host;
  const view = props.editorView;
  const scrollArea = getScrollArea();
  const pagination = typeof view?.getPaginationInfo === "function" ? view.getPaginationInfo() : null;
  if (!host || !scrollArea || !pagination) {
    viewport.value = { width: 0, height: 0 };
    pageRects.value = [];
    props.store.setCurrentPageIndex(null);
    return;
  }

  const width = Math.max(0, Number(host.clientWidth) || Number(scrollArea.clientWidth) || 0);
  const height = Math.max(0, Number(host.clientHeight) || Number(scrollArea.clientHeight) || 0);
  const pageWidth = Math.max(0, Number(pagination.pageWidth) || 0);
  const pageHeight = Math.max(0, Number(pagination.pageHeight) || 0);
  const pageGap = Math.max(0, Number(pagination.pageGap) || 0);
  const scrollTop = Math.max(0, Number(pagination.scrollTop) || 0);
  const pageX = Math.max(0, (Number(scrollArea.clientWidth) - pageWidth) / 2);
  const nextPageRects = (Array.isArray(pagination.pages) ? pagination.pages : []).map((page: any) => ({
    pageIndex: Number(page?.index) || 0,
    x: pageX,
    y: (Number(page?.fromY) || 0) - scrollTop,
    width: pageWidth,
    height: pageHeight,
  }));

  viewport.value = { width, height };
  pageRects.value = nextPageRects;

  if (pageHeight <= 0) {
    props.store.setCurrentPageIndex(null);
    return;
  }

  const pageSpan = Math.max(1, pageHeight + pageGap);
  const centerY = scrollTop + Math.max(0, Number(scrollArea.clientHeight) / 2);
  const pageCount = Math.max(0, Number(pagination.pageCount) || nextPageRects.length);
  const nextPageIndex =
    pageCount > 0
      ? Math.max(0, Math.min(pageCount - 1, Math.floor(centerY / pageSpan)))
      : null;
  props.store.setCurrentPageIndex(nextPageIndex);
};

const bindViewListeners = () => {
  scrollAreaCleanup?.();
  scrollAreaCleanup = null;
  resizeObserver?.disconnect();
  resizeObserver = null;

  const scrollArea = getScrollArea();
  const spacer = getSpacer();
  if (!scrollArea) {
    refreshViewport();
    return;
  }

  const handleScroll = () => {
    scheduleRefresh();
  };

  scrollArea.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("resize", scheduleRefresh, { passive: true });

  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => {
      scheduleRefresh();
    });
    if (props.host) {
      resizeObserver.observe(props.host);
    }
    resizeObserver.observe(scrollArea);
    if (spacer instanceof HTMLElement) {
      resizeObserver.observe(spacer);
    }
  }

  scrollAreaCleanup = () => {
    scrollArea.removeEventListener("scroll", handleScroll);
    window.removeEventListener("resize", scheduleRefresh);
  };

  refreshViewport();
};

const clampNormalized = (value: number) => Math.max(0, Math.min(1, value));

const findPageRectAtPoint = (pointer: AnnotationPointer) =>
  pageRects.value.find(
    (rect) =>
      pointer.x >= rect.x &&
      pointer.x <= rect.x + rect.width &&
      pointer.y >= rect.y &&
      pointer.y <= rect.y + rect.height
  );

const findPageRectByIndex = (pageIndex: number) =>
  pageRects.value.find((rect) => rect.pageIndex === pageIndex) || null;

const pointerToNormalizedPoint = (
  pageRect: AnnotationPageRect,
  pointer: AnnotationPointer,
  options: { clamp?: boolean } = {}
): AnnotationNormalizedPoint => {
  const clamp = options.clamp !== false;
  const rawX = (pointer.x - pageRect.x) / Math.max(1, pageRect.width);
  const rawY = (pointer.y - pageRect.y) / Math.max(1, pageRect.height);
  return {
    x: clamp ? clampNormalized(rawX) : rawX,
    y: clamp ? clampNormalized(rawY) : rawY,
  };
};

const getPointerFromEvent = (event: any): AnnotationPointer | null => {
  const stage = stageRef.value?.getNode?.() || event?.target?.getStage?.();
  const pointer = stage?.getPointerPosition?.();
  if (!pointer) {
    return null;
  }
  return { x: Number(pointer.x) || 0, y: Number(pointer.y) || 0 };
};

const getToolOpacity = (tool: AnnotationTool) => (tool === "highlighter" ? 0.34 : 0.96);

const createItemId = () =>
  `annotation-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const cloneAnnotationItem = <T extends AnnotationItem>(item: T): T => {
  if (item.kind === "stroke") {
    return {
      ...item,
      points: item.points.map((point) => ({ x: point.x, y: point.y })),
    } as T;
  }
  return {
    ...item,
    start: { x: item.start.x, y: item.start.y },
    end: { x: item.end.x, y: item.end.y },
  } as T;
};

const getDraftStart = () => ({
  color: props.store.state.color,
  width: props.store.state.lineWidth,
});

const pushStrokePoint = (draftState: AnnotationStrokeDraft, point: AnnotationNormalizedPoint) => {
  const lastPoint = draftState.points[draftState.points.length - 1];
  if (!lastPoint) {
    draftState.points.push(point);
    return;
  }
  const deltaX = Math.abs(lastPoint.x - point.x);
  const deltaY = Math.abs(lastPoint.y - point.y);
  if (deltaX < 0.0012 && deltaY < 0.0012) {
    draftState.points[draftState.points.length - 1] = point;
    return;
  }
  draftState.points.push(point);
};

const finalizeDraft = () => {
  const currentDraft = draft.value;
  draft.value = null;
  if (!currentDraft) {
    return;
  }

  if (currentDraft.kind === "stroke") {
    const points = currentDraft.points.length > 1 ? currentDraft.points : [...currentDraft.points];
    if (points.length === 1) {
      points.push({ ...points[0] });
    }
    props.store.addItem({
      id: createItemId(),
      kind: "stroke",
      tool: currentDraft.tool,
      pageIndex: currentDraft.pageIndex,
      points,
      color: currentDraft.color,
      width: currentDraft.width,
      opacity: currentDraft.opacity,
    });
    return;
  }

  const deltaX = Math.abs(currentDraft.start.x - currentDraft.end.x);
  const deltaY = Math.abs(currentDraft.start.y - currentDraft.end.y);
  if (deltaX < 0.001 && deltaY < 0.001) {
    return;
  }
  props.store.addItem({
    id: createItemId(),
    kind: currentDraft.kind,
    pageIndex: currentDraft.pageIndex,
    start: currentDraft.start,
    end: currentDraft.end,
    color: currentDraft.color,
    width: currentDraft.width,
    opacity: currentDraft.opacity,
  });
};

const getItemBounds = (item: AnnotationItem) => {
  if (item.kind === "stroke") {
    const xs = item.points.map((point) => point.x);
    const ys = item.points.map((point) => point.y);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
  }
  return {
    minX: Math.min(item.start.x, item.end.x),
    maxX: Math.max(item.start.x, item.end.x),
    minY: Math.min(item.start.y, item.end.y),
    maxY: Math.max(item.start.y, item.end.y),
  };
};

const translateAnnotationItem = (item: AnnotationItem, deltaX: number, deltaY: number) => {
  const bounds = getItemBounds(item);
  const clampedDeltaX = Math.max(-bounds.minX, Math.min(1 - bounds.maxX, deltaX));
  const clampedDeltaY = Math.max(-bounds.minY, Math.min(1 - bounds.maxY, deltaY));
  const clampPoint = (point: AnnotationNormalizedPoint) => ({
    x: clampNormalized(point.x + clampedDeltaX),
    y: clampNormalized(point.y + clampedDeltaY),
  });

  if (item.kind === "stroke") {
    return {
      ...item,
      points: item.points.map(clampPoint),
    };
  }

  return {
    ...item,
    start: clampPoint(item.start),
    end: clampPoint(item.end),
  };
};

const getResizeCursor = (handle: AnnotationResizeHandle) =>
  handle === "nw" || handle === "se" ? "nwse-resize" : "nesw-resize";

const getRectResizeHandleCenters = (item: AnnotationRect, pageRect: AnnotationPageRect) => {
  const bounds = getItemBounds(item);
  const left = pageRect.x + bounds.minX * pageRect.width;
  const right = pageRect.x + bounds.maxX * pageRect.width;
  const top = pageRect.y + bounds.minY * pageRect.height;
  const bottom = pageRect.y + bounds.maxY * pageRect.height;
  return [
    { handle: "nw" as const, x: left, y: top },
    { handle: "ne" as const, x: right, y: top },
    { handle: "sw" as const, x: left, y: bottom },
    { handle: "se" as const, x: right, y: bottom },
  ];
};

const hitTestResizeHandle = (
  item: AnnotationRect,
  pageRect: AnnotationPageRect,
  pointer: AnnotationPointer
): AnnotationResizeHandle | null => {
  const handleRadius = 9;
  for (const handleCenter of getRectResizeHandleCenters(item, pageRect)) {
    if (Math.hypot(pointer.x - handleCenter.x, pointer.y - handleCenter.y) <= handleRadius) {
      return handleCenter.handle;
    }
  }
  return null;
};

const resizeRectByHandle = (
  item: AnnotationRect,
  handle: AnnotationResizeHandle,
  point: AnnotationNormalizedPoint,
  pageRect: AnnotationPageRect
): AnnotationRect => {
  const bounds = getItemBounds(item);
  const minWidth = Math.max(0.004, 12 / Math.max(1, pageRect.width));
  const minHeight = Math.max(0.004, 12 / Math.max(1, pageRect.height));
  let left = bounds.minX;
  let right = bounds.maxX;
  let top = bounds.minY;
  let bottom = bounds.maxY;

  if (handle === "nw" || handle === "sw") {
    left = Math.min(point.x, right - minWidth);
  } else {
    right = Math.max(point.x, left + minWidth);
  }

  if (handle === "nw" || handle === "ne") {
    top = Math.min(point.y, bottom - minHeight);
  } else {
    bottom = Math.max(point.y, top + minHeight);
  }

  return {
    ...item,
    start: { x: clampNormalized(left), y: clampNormalized(top) },
    end: { x: clampNormalized(right), y: clampNormalized(bottom) },
  };
};

const distanceToSegment = (
  point: AnnotationPointer,
  start: AnnotationPointer,
  end: AnnotationPointer
) => {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  if (Math.abs(deltaX) < 0.001 && Math.abs(deltaY) < 0.001) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / (deltaX ** 2 + deltaY ** 2))
  );
  const closestX = start.x + deltaX * t;
  const closestY = start.y + deltaY * t;
  return Math.hypot(point.x - closestX, point.y - closestY);
};

const toViewportPoint = (pageRect: AnnotationPageRect, point: AnnotationNormalizedPoint): AnnotationPointer => ({
  x: pageRect.x + point.x * pageRect.width,
  y: pageRect.y + point.y * pageRect.height,
});

const hitTestStroke = (
  item: AnnotationStroke,
  pageRect: AnnotationPageRect,
  pointer: AnnotationPointer,
  tolerance: number
) => {
  if (!Array.isArray(item.points) || item.points.length === 0) {
    return false;
  }
  for (let index = 1; index < item.points.length; index += 1) {
    const start = toViewportPoint(pageRect, item.points[index - 1]);
    const end = toViewportPoint(pageRect, item.points[index]);
    const hitTolerance = tolerance + item.width / 2;
    if (distanceToSegment(pointer, start, end) <= hitTolerance) {
      return true;
    }
  }
  const firstPoint = toViewportPoint(pageRect, item.points[0]);
  return Math.hypot(pointer.x - firstPoint.x, pointer.y - firstPoint.y) <= tolerance + item.width / 2;
};

const hitTestLine = (
  item: Extract<AnnotationItem, { kind: "line" }>,
  pageRect: AnnotationPageRect,
  pointer: AnnotationPointer,
  tolerance: number
) =>
  distanceToSegment(pointer, toViewportPoint(pageRect, item.start), toViewportPoint(pageRect, item.end)) <=
  tolerance + item.width / 2;

const hitTestRect = (
  item: AnnotationRect,
  pageRect: AnnotationPageRect,
  pointer: AnnotationPointer,
  tolerance: number
) => {
  const start = toViewportPoint(pageRect, item.start);
  const end = toViewportPoint(pageRect, item.end);
  const left = Math.min(start.x, end.x) - tolerance;
  const right = Math.max(start.x, end.x) + tolerance;
  const top = Math.min(start.y, end.y) - tolerance;
  const bottom = Math.max(start.y, end.y) + tolerance;
  if (pointer.x < left || pointer.x > right || pointer.y < top || pointer.y > bottom) {
    return false;
  }
  const innerLeft = left + tolerance * 1.5;
  const innerRight = right - tolerance * 1.5;
  const innerTop = top + tolerance * 1.5;
  const innerBottom = bottom - tolerance * 1.5;
  const isInsideInner =
    pointer.x > innerLeft &&
    pointer.x < innerRight &&
    pointer.y > innerTop &&
    pointer.y < innerBottom;
  return !isInsideInner;
};

const hitTestRectSelection = (
  item: AnnotationRect,
  pageRect: AnnotationPageRect,
  pointer: AnnotationPointer,
  tolerance: number
) => {
  const start = toViewportPoint(pageRect, item.start);
  const end = toViewportPoint(pageRect, item.end);
  const left = Math.min(start.x, end.x) - tolerance;
  const right = Math.max(start.x, end.x) + tolerance;
  const top = Math.min(start.y, end.y) - tolerance;
  const bottom = Math.max(start.y, end.y) + tolerance;
  return pointer.x >= left && pointer.x <= right && pointer.y >= top && pointer.y <= bottom;
};

const hitTestItemForSelection = (
  item: AnnotationItem,
  pageRect: AnnotationPageRect,
  pointer: AnnotationPointer,
  tolerance: number
) => {
  if (item.kind === "stroke") {
    return hitTestStroke(item, pageRect, pointer, tolerance);
  }
  if (item.kind === "line") {
    return hitTestLine(item, pageRect, pointer, tolerance);
  }
  return hitTestRectSelection(item, pageRect, pointer, tolerance);
};

const findTopmostItemAtPointer = (
  pointer: AnnotationPointer,
  pageRect: AnnotationPageRect,
  options: { editableOnly?: boolean } = {}
) => {
  const tolerance = Math.max(10, props.store.state.lineWidth * 1.5);
  const items = props.store.getVisibleItems();
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item.pageIndex !== pageRect.pageIndex) {
      continue;
    }
    if (options.editableOnly && !props.store.canEditItem(item)) {
      continue;
    }
    if (hitTestItemForSelection(item, pageRect, pointer, tolerance)) {
      return item;
    }
  }
  return null;
};

const eraseAtPointer = (pointer: AnnotationPointer, pageRect: AnnotationPageRect) => {
  const tolerance = Math.max(12, props.store.state.lineWidth * 2);
  props.store.removeTopmost((item) => {
    if (item.pageIndex !== pageRect.pageIndex) {
      return false;
    }
    if (item.kind === "stroke") {
      return hitTestStroke(item, pageRect, pointer, tolerance);
    }
    if (item.kind === "line") {
      return hitTestLine(item, pageRect, pointer, tolerance);
    }
    return hitTestRect(item, pageRect, pointer, tolerance);
  });
};

const handlePointerDown = (event: any) => {
  if (!props.store.state.active) {
    return;
  }
  const pointer = getPointerFromEvent(event);
  if (!pointer) {
    return;
  }
  const pageRect = findPageRectAtPoint(pointer);
  if (!pageRect) {
    return;
  }
  if (props.store.state.tool === "eraser") {
    eraseAtPointer(pointer, pageRect);
    event?.evt?.preventDefault?.();
    return;
  }
  if (props.store.state.tool === "select") {
    const selectedItem = props.store.getSelectedItem();
    if (
      selectedItem?.kind === "rect" &&
      selectedItem.pageIndex === pageRect.pageIndex &&
      props.store.canEditItem(selectedItem)
    ) {
      const resizeHandle = hitTestResizeHandle(selectedItem, pageRect, pointer);
      if (resizeHandle) {
        props.store.setSelectedItemId(selectedItem.id);
        resizeState.value = {
          itemId: selectedItem.id,
          pageIndex: selectedItem.pageIndex,
          handle: resizeHandle,
          originalItem: cloneAnnotationItem(selectedItem),
          previewItem: cloneAnnotationItem(selectedItem),
          moved: false,
        };
        moveState.value = null;
        event?.evt?.preventDefault?.();
        return;
      }
    }
    const hitItem = findTopmostItemAtPointer(pointer, pageRect);
    if (!hitItem) {
      props.store.clearSelection();
      moveState.value = null;
      resizeState.value = null;
      event?.evt?.preventDefault?.();
      return;
    }
    props.store.setSelectedItemId(hitItem.id);
    if (props.store.canEditItem(hitItem)) {
      moveState.value = {
        itemId: hitItem.id,
        pageIndex: hitItem.pageIndex,
        startPoint: pointerToNormalizedPoint(pageRect, pointer, { clamp: true }),
        originalItem: cloneAnnotationItem(hitItem),
        previewItem: cloneAnnotationItem(hitItem),
        moved: false,
      };
      resizeState.value = null;
    } else {
      moveState.value = null;
      resizeState.value = null;
    }
    event?.evt?.preventDefault?.();
    return;
  }

  const point = pointerToNormalizedPoint(pageRect, pointer);
  const draftBase = {
    pageIndex: pageRect.pageIndex,
    ...getDraftStart(),
    opacity: getToolOpacity(props.store.state.tool),
  };

  if (props.store.state.tool === "pen" || props.store.state.tool === "highlighter") {
    draft.value = {
      kind: "stroke",
      tool: props.store.state.tool,
      points: [point, point],
      ...draftBase,
    };
  } else {
    draft.value = {
      kind: props.store.state.tool,
      start: point,
      end: point,
      ...draftBase,
    };
  }

  event?.evt?.preventDefault?.();
};

const handlePointerMove = (event: any) => {
  const currentResizeState = resizeState.value;
  if (currentResizeState && props.store.state.active && props.store.state.tool === "select") {
    const pointer = getPointerFromEvent(event);
    if (!pointer) {
      return;
    }
    const pageRect = findPageRectByIndex(currentResizeState.pageIndex);
    if (!pageRect) {
      return;
    }
    const point = pointerToNormalizedPoint(pageRect, pointer, { clamp: true });
    currentResizeState.previewItem = resizeRectByHandle(
      currentResizeState.originalItem,
      currentResizeState.handle,
      point,
      pageRect
    );
    currentResizeState.moved =
      Math.abs(currentResizeState.previewItem.start.x - currentResizeState.originalItem.start.x) >
        0.001 ||
      Math.abs(currentResizeState.previewItem.start.y - currentResizeState.originalItem.start.y) >
        0.001 ||
      Math.abs(currentResizeState.previewItem.end.x - currentResizeState.originalItem.end.x) >
        0.001 ||
      Math.abs(currentResizeState.previewItem.end.y - currentResizeState.originalItem.end.y) >
        0.001;
    event?.evt?.preventDefault?.();
    return;
  }

  const currentMoveState = moveState.value;
  if (currentMoveState && props.store.state.active && props.store.state.tool === "select") {
    const pointer = getPointerFromEvent(event);
    if (!pointer) {
      return;
    }
    const pageRect = findPageRectByIndex(currentMoveState.pageIndex);
    if (!pageRect) {
      return;
    }
    const point = pointerToNormalizedPoint(pageRect, pointer, { clamp: true });
    const deltaX = point.x - currentMoveState.startPoint.x;
    const deltaY = point.y - currentMoveState.startPoint.y;
    currentMoveState.previewItem = translateAnnotationItem(currentMoveState.originalItem, deltaX, deltaY);
    currentMoveState.moved = Math.abs(deltaX) > 0.001 || Math.abs(deltaY) > 0.001;
    event?.evt?.preventDefault?.();
    return;
  }

  const currentDraft = draft.value;
  if (!currentDraft || !props.store.state.active) {
    return;
  }
  const pointer = getPointerFromEvent(event);
  if (!pointer) {
    return;
  }
  const pageRect = findPageRectByIndex(currentDraft.pageIndex);
  if (!pageRect) {
    return;
  }
  const point = pointerToNormalizedPoint(pageRect, pointer, { clamp: true });
  if (currentDraft.kind === "stroke") {
    pushStrokePoint(currentDraft, point);
  } else {
    currentDraft.end = point;
  }
  event?.evt?.preventDefault?.();
};

const handlePointerUp = () => {
  if (resizeState.value) {
    const currentResizeState = resizeState.value;
    resizeState.value = null;
    if (currentResizeState.moved) {
      props.store.replaceItem(currentResizeState.itemId, currentResizeState.previewItem);
    }
    return;
  }
  if (moveState.value) {
    const currentMoveState = moveState.value;
    moveState.value = null;
    if (currentMoveState.moved) {
      props.store.replaceItem(currentMoveState.itemId, currentMoveState.previewItem);
    }
    return;
  }
  if (!draft.value) {
    return;
  }
  finalizeDraft();
};

const handleWheel = (event: WheelEvent) => {
  if (!props.store.state.active) {
    return;
  }
  const scrollArea = getScrollArea();
  if (!(scrollArea instanceof HTMLElement)) {
    return;
  }
  scrollArea.scrollTop += event.deltaY;
  scrollArea.scrollLeft += event.deltaX;
  event.preventDefault();
};

const handleKeyDown = (event: KeyboardEvent) => {
  if (!props.store.state.active || props.store.state.tool !== "select") {
    return;
  }
  const target = event.target as HTMLElement | null;
  if (
    target?.closest?.("input, textarea, [contenteditable='true'], [role='textbox'], .t-textarea, .t-input")
  ) {
    return;
  }
  if (event.key === "Escape") {
    resizeState.value = null;
    moveState.value = null;
    props.store.clearSelection();
    event.preventDefault();
    return;
  }
  if (event.key !== "Delete" && event.key !== "Backspace") {
    return;
  }
  if (props.store.deleteSelectedItem()) {
    event.preventDefault();
  }
};

const buildLineConfig = (
  item:
    | Pick<AnnotationStroke, "points" | "color" | "width" | "opacity">
    | Pick<AnnotationShapeDraft, "start" | "end" | "color" | "width" | "opacity">,
  pageRect: AnnotationPageRect
) => {
  const points =
    "points" in item
      ? item.points.flatMap((point) => [
          pageRect.x + point.x * pageRect.width,
          pageRect.y + point.y * pageRect.height,
        ])
      : [
          pageRect.x + item.start.x * pageRect.width,
          pageRect.y + item.start.y * pageRect.height,
          pageRect.x + item.end.x * pageRect.width,
          pageRect.y + item.end.y * pageRect.height,
        ];
  return {
    points,
    stroke: item.color,
    strokeWidth: item.width,
    opacity: item.opacity,
    lineCap: "round",
    lineJoin: "round",
    perfectDrawEnabled: false,
    listening: false,
  };
};

const buildRectConfig = (
  item: Pick<AnnotationRect, "start" | "end" | "color" | "width" | "opacity">,
  pageRect: AnnotationPageRect
) => {
  const start = toViewportPoint(pageRect, item.start);
  const end = toViewportPoint(pageRect, item.end);
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
    stroke: item.color,
    strokeWidth: item.width,
    opacity: item.opacity,
    cornerRadius: 4,
    listening: false,
  };
};

const interactivePreviewItem = computed<AnnotationItem | null>(
  () => resizeState.value?.previewItem || moveState.value?.previewItem || null
);

const renderedItems = computed<AnnotationItem[]>(() => {
  const previewItem = interactivePreviewItem.value;
  return props.store.getVisibleItems().map((item) =>
    previewItem && item.id === previewItem.id ? cloneAnnotationItem(previewItem) : item
  );
});

const lineShapes = computed<RenderedShape[]>(() => {
  const shapes: RenderedShape[] = [];
  for (const item of renderedItems.value) {
    const pageRect = findPageRectByIndex(item.pageIndex);
    if (!pageRect) {
      continue;
    }
    if (item.kind === "stroke" || item.kind === "line") {
      shapes.push({
        id: item.id,
        config: buildLineConfig(item, pageRect),
      });
    }
  }
  return shapes;
});

const rectShapes = computed<RenderedShape[]>(() => {
  const shapes: RenderedShape[] = [];
  for (const item of renderedItems.value) {
    const pageRect = findPageRectByIndex(item.pageIndex);
    if (!pageRect || item.kind !== "rect") {
      continue;
    }
    shapes.push({
      id: item.id,
      config: buildRectConfig(item, pageRect),
    });
  }
  return shapes;
});

const draftLineShape = computed<RenderedShape | null>(() => {
  const currentDraft = draft.value;
  if (!currentDraft || currentDraft.kind === "rect") {
    return null;
  }
  const pageRect = findPageRectByIndex(currentDraft.pageIndex);
  if (!pageRect) {
    return null;
  }
  return {
    id: "annotation-draft-line",
    config: buildLineConfig(currentDraft, pageRect),
  };
});

const selectionBoundsShape = computed<RenderedShape | null>(() => {
  const selectedItem = interactivePreviewItem.value || props.store.getSelectedItem();
  if (!selectedItem) {
    return null;
  }
  const pageRect = findPageRectByIndex(selectedItem.pageIndex);
  if (!pageRect) {
    return null;
  }
  const bounds = getItemBounds(selectedItem);
  const padding = 8;
  const minSize = 14;
  const left = pageRect.x + bounds.minX * pageRect.width;
  const top = pageRect.y + bounds.minY * pageRect.height;
  const width = Math.max(minSize, (bounds.maxX - bounds.minX) * pageRect.width);
  const height = Math.max(minSize, (bounds.maxY - bounds.minY) * pageRect.height);
  return {
    id: `annotation-selection-${selectedItem.id}`,
    config: {
      x: left - padding,
      y: top - padding,
      width: width + padding * 2,
      height: height + padding * 2,
      stroke: props.store.canEditItem(selectedItem) ? "#2563eb" : "#94a3b8",
      strokeWidth: 1.5,
      dash: [6, 4],
      cornerRadius: 8,
      listening: false,
    },
  };
});

const selectionHandleShapes = computed<RenderedShape[]>(() => {
  if (!props.store.state.active || props.store.state.tool !== "select") {
    return [];
  }
  const selectedItem = interactivePreviewItem.value || props.store.getSelectedItem();
  if (!selectedItem || selectedItem.kind !== "rect" || !props.store.canEditItem(selectedItem)) {
    return [];
  }
  const pageRect = findPageRectByIndex(selectedItem.pageIndex);
  if (!pageRect) {
    return [];
  }
  const handleSize = 10;
  return getRectResizeHandleCenters(selectedItem, pageRect).map((handleCenter) => ({
    id: `annotation-selection-handle-${selectedItem.id}-${handleCenter.handle}`,
    config: {
      x: handleCenter.x - handleSize / 2,
      y: handleCenter.y - handleSize / 2,
      width: handleSize,
      height: handleSize,
      fill: "#ffffff",
      stroke: "#2563eb",
      strokeWidth: 1.5,
      cornerRadius: 3,
      shadowColor: "rgba(37, 99, 235, 0.2)",
      shadowBlur: 6,
      shadowOffsetX: 0,
      shadowOffsetY: 1,
      listening: false,
    },
  }));
});

const draftRectShape = computed<RenderedShape | null>(() => {
  const currentDraft = draft.value;
  if (!currentDraft || currentDraft.kind !== "rect") {
    return null;
  }
  const pageRect = findPageRectByIndex(currentDraft.pageIndex);
  if (!pageRect) {
    return null;
  }
  return {
    id: "annotation-draft-rect",
    config: buildRectConfig(currentDraft, pageRect),
  };
});

const stageConfig = computed(() => ({
  width: viewport.value.width,
  height: viewport.value.height,
}));

const layerCursor = computed(() => {
  if (!props.store.state.active) {
    return "default";
  }
  if (resizeState.value) {
    return getResizeCursor(resizeState.value.handle);
  }
  if (moveState.value) {
    return "grabbing";
  }
  if (props.store.state.tool === "select") {
    const selectedItem = props.store.getSelectedItem();
    return selectedItem && props.store.canEditItem(selectedItem) ? "grab" : "default";
  }
  if (props.store.state.tool === "eraser") {
    return "cell";
  }
  return "crosshair";
});

watch(
  () => props.editorView,
  () => {
    bindViewListeners();
  },
  { immediate: true }
);

watch(
  () => props.host,
  () => {
    bindViewListeners();
  }
);

watch(
  () => props.store.state.active,
  (active) => {
    if (!active && draft.value) {
      draft.value = null;
    }
    if (!active) {
      resizeState.value = null;
      moveState.value = null;
    }
    scheduleRefresh();
  }
);

watch(
  () => props.store.state.tool,
  (tool) => {
    if (tool !== "select") {
      resizeState.value = null;
      moveState.value = null;
    }
  }
);

onMounted(() => {
  window.addEventListener("mouseup", handlePointerUp, { passive: true });
  window.addEventListener("keydown", handleKeyDown);
  bindViewListeners();
});

onBeforeUnmount(() => {
  scrollAreaCleanup?.();
  scrollAreaCleanup = null;
  resizeObserver?.disconnect();
  resizeObserver = null;
  window.removeEventListener("mouseup", handlePointerUp);
  window.removeEventListener("keydown", handleKeyDown);
  if (refreshFrameId && typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(refreshFrameId);
  }
});
</script>

<style scoped>
.doc-annotation-layer {
  position: absolute;
  inset: 0;
  z-index: 8;
  pointer-events: none;
}

.doc-annotation-layer.is-active {
  pointer-events: auto;
}

.doc-annotation-layer :deep(canvas) {
  outline: none;
}
</style>
