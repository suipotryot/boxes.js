<script setup lang="ts">
import { onBeforeUnmount, reactive } from 'vue';

const props = withDefaults(
  defineProps<{
    title: string;
    initialWidth?: number;
    initialHeight?: number;
    minWidth?: number;
    minHeight?: number;
  }>(),
  { initialWidth: 420, initialHeight: 320, minWidth: 240, minHeight: 180 },
);

const emit = defineEmits<{ close: [] }>();

const box = reactive({
  x: 24,
  y: 24,
  width: props.initialWidth,
  height: props.initialHeight,
});

type DragMode = { kind: 'move'; startX: number; startY: number; boxX: number; boxY: number } | { kind: 'resize'; startX: number; startY: number; boxW: number; boxH: number } | null;
let mode: DragMode = null;

function onHeaderMouseDown(event: MouseEvent): void {
  mode = { kind: 'move', startX: event.clientX, startY: event.clientY, boxX: box.x, boxY: box.y };
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function onResizeMouseDown(event: MouseEvent): void {
  event.stopPropagation();
  mode = { kind: 'resize', startX: event.clientX, startY: event.clientY, boxW: box.width, boxH: box.height };
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function onMouseMove(event: MouseEvent): void {
  if (!mode) return;
  const dx = event.clientX - mode.startX;
  const dy = event.clientY - mode.startY;
  if (mode.kind === 'move') {
    box.x = mode.boxX + dx;
    box.y = mode.boxY + dy;
  } else {
    box.width = Math.max(props.minWidth, mode.boxW + dx);
    box.height = Math.max(props.minHeight, mode.boxH + dy);
  }
}

function onMouseUp(): void {
  mode = null;
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
}

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
});

defineExpose({ width: () => box.width, height: () => box.height });
</script>

<template>
  <div class="floating-panel" :style="{ left: `${box.x}px`, top: `${box.y}px`, width: `${box.width}px`, height: `${box.height}px` }">
    <div class="floating-header" @mousedown="onHeaderMouseDown">
      <span>{{ title }}</span>
      <button class="floating-close" @click="emit('close')">✕</button>
    </div>
    <div class="floating-body">
      <slot :width="box.width" :height="box.height - 32" />
    </div>
    <div class="floating-resize-handle" @mousedown="onResizeMouseDown"></div>
  </div>
</template>

<style scoped>
.floating-panel {
  position: fixed;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: var(--shadow-elevated);
  z-index: 50;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.floating-header {
  height: 32px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
  cursor: move;
  font-size: 13px;
  user-select: none;
}
.floating-close {
  border: none;
  background: none;
  padding: 2px 6px;
  cursor: pointer;
}
.floating-body {
  flex: 1;
  min-height: 0;
  position: relative;
}
.floating-resize-handle {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 14px;
  height: 14px;
  cursor: nwse-resize;
}
.floating-resize-handle::after {
  content: '';
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 8px;
  height: 8px;
  border-right: 2px solid var(--color-fg-muted);
  border-bottom: 2px solid var(--color-fg-muted);
}
</style>
