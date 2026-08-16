<script setup lang="ts">
import { computed, ref } from 'vue';

import ColorLegend from '@/components/ColorLegend.vue';
import { tallestDividerHeightMm } from '@/domain/services/HeightConstraints';
import { useProjectStore } from '@/stores/projectStore';
import { useUiStore } from '@/stores/uiStore';

const projectStore = useProjectStore();
const uiStore = useUiStore();

const hasBottom = computed({
  get: () => projectStore.project?.config.hasBottom ?? false,
  set: (value: boolean) => projectStore.updateConfig({ hasBottom: value }),
});

const shelfError = ref<string | null>(null);

function onShelfToggle(event: Event): void {
  const checkbox = event.target as HTMLInputElement;
  shelfError.value = null;
  if (!checkbox.checked) {
    projectStore.setShelf(null);
    return;
  }
  const project = projectStore.project;
  if (!project) return;
  // Default to the tallest existing divider (the minimum valid height)
  // rather than an arbitrary constant, so enabling the shelf doesn't
  // immediately collide with the height constraint in the common case.
  const heightMm = Math.max(tallestDividerHeightMm(project.zoneTree, project.colors), 1);
  const ok = projectStore.setShelf({ heightMm, mode: 'fixed' });
  if (!ok) {
    // Force the native checkbox back -- Vue won't re-sync it on its own
    // since the underlying state never actually changed.
    checkbox.checked = false;
    shelfError.value = "Impossible d'activer le plateau : hauteur en conflit avec une cloison existante.";
  }
}

function onShelfHeightChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const project = projectStore.project;
  if (!project?.config.shelf) return;
  const heightMm = Number(input.value);
  shelfError.value = null;
  const ok = projectStore.setShelf({ heightMm, mode: project.config.shelf.mode });
  if (!ok) {
    input.value = String(project.config.shelf.heightMm);
    shelfError.value = 'Hauteur refusée : une cloison existante est plus haute.';
  }
}

function onShelfModeChange(event: Event): void {
  const project = projectStore.project;
  if (!project?.config.shelf) return;
  projectStore.setShelf({ heightMm: project.config.shelf.heightMm, mode: (event.target as HTMLSelectElement).value as 'fixed' | 'removable' });
}
</script>

<template>
  <aside class="sidebar">
    <ColorLegend />

    <h3>Options</h3>
    <label class="option-row">
      <input v-model="hasBottom" type="checkbox" />
      Fond plein
    </label>
    <label class="option-row">
      <input :checked="projectStore.project?.config.shelf != null" type="checkbox" @change="onShelfToggle" />
      Plateau intermédiaire
    </label>
    <p v-if="shelfError" class="error-text">{{ shelfError }}</p>
    <template v-if="projectStore.project?.config.shelf">
      <div class="option-row">
        <label>Hauteur</label>
        <input
          type="number"
          min="1"
          :value="projectStore.project.config.shelf.heightMm"
          style="width: 70px"
          @change="onShelfHeightChange"
        />
      </div>
      <div class="option-row">
        <label>Mode</label>
        <select :value="projectStore.project.config.shelf.mode" @change="onShelfModeChange">
          <option value="fixed">Fixe</option>
          <option value="removable">Amovible</option>
        </select>
      </div>
    </template>

    <label class="option-row">
      <input v-model="uiStore.showDimensions" type="checkbox" />
      Cotes
    </label>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 220px;
  padding: 12px;
  border-right: 1px solid var(--color-border);
  overflow-y: auto;
}
.sidebar h3 {
  margin: 16px 0 8px;
  font-size: 13px;
  color: var(--color-fg-muted);
}
.option-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
}
.error-text {
  color: var(--color-danger);
  font-size: 12px;
  margin: -4px 0 8px;
}
</style>
