<script setup lang="ts">
import { useProjectStore } from '@/stores/projectStore';

const projectStore = useProjectStore();

function onHeightInput(colorId: string, event: Event): void {
  const value = Number((event.target as HTMLInputElement).value);
  if (!Number.isFinite(value) || value <= 0) return;
  const ok = projectStore.updateColorHeight(colorId, value);
  if (!ok) {
    (event.target as HTMLInputElement).value = String(projectStore.project?.colors.find((c) => c.id === colorId)?.heightMm ?? '');
  }
}

function onColorInput(colorId: string, event: Event): void {
  projectStore.updateColorHex(colorId, (event.target as HTMLInputElement).value);
}
</script>

<template>
  <div class="color-legend">
    <h3>Couleurs</h3>
    <div v-for="c in projectStore.project?.colors ?? []" :key="c.id" class="legend-row">
      <input type="color" :value="c.color" @input="onColorInput(c.id, $event)" />
      <span class="legend-label">{{ c.label ?? '' }}</span>
      <input
        type="number"
        min="1"
        step="1"
        :value="c.heightMm"
        style="width: 70px"
        @change="onHeightInput(c.id, $event)"
      />
      <span>mm</span>
    </div>
  </div>
</template>

<style scoped>
.color-legend h3 {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--color-fg-muted);
}
.legend-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.legend-label {
  flex: 1;
  font-size: 12px;
  color: var(--color-fg-muted);
}
</style>
