<template>
  <t-dialog
    size="small"
    :visible="visible"
    header="Signature"
    confirm-btn="Insert"
    cancel-btn="Cancel"
    :close-on-overlay-click="false"
    :close-on-esc-keydown="true"
    @confirm="handleConfirm"
    @cancel="handleCancel"
    @close="handleCancel"
  >
    <div class="signature-dialog">
      <div class="signature-dialog-canvas">
        <canvas
          ref="canvasRef"
          class="signature-dialog-pad"
          :width="canvasWidth"
          :height="canvasHeight"
          @pointerdown="handlePointerDown"
          @pointermove="handlePointerMove"
          @pointerup="handlePointerUp"
          @pointerleave="handlePointerUp"
        ></canvas>
      </div>
      <div class="signature-dialog-inputs">
        <t-input
          v-model="signer"
          placeholder="Signer name"
          :disabled="!visible"
          @focus="clearError"
        />
        <span v-if="error" class="signature-dialog-error">{{ error }}</span>
        <div class="signature-dialog-actions">
          <t-button size="small" variant="outline" @click="clearCanvas">Clear</t-button>
        </div>
      </div>
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { SignatureDialogResult } from "../editor/toolbarActions/ui/signatureDialog";

const props = defineProps({
  visible: Boolean,
  defaultSigner: { type: String, default: "" },
  canvasWidth: { type: Number, default: 320 },
  canvasHeight: { type: Number, default: 120 },
});
const emit = defineEmits<{
  confirm: (result: SignatureDialogResult) => void;
  cancel: () => void;
  "update:visible": (value: boolean) => void;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const signer = ref(props.defaultSigner || "");
const error = ref("");
const hasDrawing = ref(false);
let ctx: CanvasRenderingContext2D | null = null;
let drawing = false;
let lastPoint = { x: 0, y: 0 };

const deviceRatio = computed(() => window.devicePixelRatio || 1);

const resetCanvas = () => {
  const canvas = canvasRef.value;
  if (!canvas) {
    return;
  }
  const width = props.canvasWidth;
  const height = props.canvasHeight;
  const ratio = deviceRatio.value;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const context = canvas.getContext("2d");
  if (!context) {
    ctx = null;
    return;
  }
  context.scale(ratio, ratio);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 2;
  context.strokeStyle = "#0f172a";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  ctx = context;
  hasDrawing.value = false;
  error.value = "";
};

const drawSegment = (from: { x: number; y: number }, to: { x: number; y: number }) => {
  if (!ctx) {
    return;
  }
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
};

const readPointer = (event: PointerEvent) => {
  const canvas = canvasRef.value;
  if (!canvas) {
    return { x: 0, y: 0 };
  }
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(props.canvasWidth, event.clientX - rect.left)),
    y: Math.max(0, Math.min(props.canvasHeight, event.clientY - rect.top)),
  };
};

const handlePointerDown = (event: PointerEvent) => {
  drawing = true;
  const point = readPointer(event);
  lastPoint = point;
  hasDrawing.value = true;
};

const handlePointerMove = (event: PointerEvent) => {
  if (!drawing) {
    return;
  }
  const point = readPointer(event);
  drawSegment(lastPoint, point);
  lastPoint = point;
};

const handlePointerUp = () => {
  drawing = false;
};

const clearCanvas = () => {
  resetCanvas();
};

const closeDialog = (result: boolean = false) => {
  emit("update:visible", false);
  if (result) {
    emit("confirm", {
      src: ((canvasRef.value as HTMLCanvasElement) || { toDataURL: () => "" }).toDataURL("image/png"),
      signer: signer.value.trim() || "Signer",
      signedAt: new Date().toISOString().slice(0, 10),
      width: props.canvasWidth,
      height: props.canvasHeight,
    });
  } else {
    emit("cancel");
  }
};

const handleConfirm = () => {
  if (!hasDrawing.value) {
    error.value = "Please draw a signature.";
    return;
  }
  closeDialog(true);
};

const handleCancel = () => {
  closeDialog(false);
};

const clearError = () => {
  if (error.value) {
    error.value = "";
  }
};

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      signer.value = props.defaultSigner || "";
      nextTick(() => {
        resetCanvas();
      });
    }
  }
);
</script>

<style scoped>
.signature-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.signature-dialog-canvas {
  border: 1px solid #cbd5f5;
  border-radius: 6px;
  background: #ffffff;
  padding: 8px;
}
.signature-dialog-pad {
  display: block;
  width: 320px;
  height: 120px;
  touch-action: none;
  cursor: crosshair;
  border-radius: 4px;
}
.signature-dialog-inputs {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.signature-dialog-actions {
  display: flex;
  justify-content: flex-end;
}
.signature-dialog-error {
  color: #dc2626;
  font-size: 0.875rem;
}
</style>



