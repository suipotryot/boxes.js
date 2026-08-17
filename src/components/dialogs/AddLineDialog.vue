<script setup lang="ts">
import { computed, reactive } from 'vue';

import type { Axis } from '@/domain/models/types';
import { canAddLine } from '@/domain/services/GridDivider';
import { useProjectStore } from '@/stores/projectStore';
import { useUiStore } from '@/stores/uiStore';

const props = defineProps<{ axis: Axis; positionMm: number }>();

const projectStore = useProjectStore();
const uiStore = useUiStore();

const form = reactive({
  positionMm: props.positionMm,
  colorMode: 'existing' as 'existing' | 'new',
  existingColorId: projectStore.project?.colors[0]?.id ?? '',
  newColorHex: '#4ade80',
});

const isValid = computed(() => {
  if (!projectStore.project || !projectStore.innerRect) return false;
  return canAddLine(projectStore.project.grid.lines, props.axis, form.positionMm, projectStore.innerRect);
});

function close(): void {
  uiStore.closeDialog();
}

function confirm(): void {
  if (!isValid.value) return;
  const colorId = form.colorMode === 'existing' ? form.existingColorId : projectStore.findOrCreateColor(form.newColorHex);
  const ok = projectStore.addLine(props.axis, form.positionMm, colorId);
  if (ok) close();
}
</script>

<template>
  <div class="dialog-overlay" @click.self="close">
    <div class="dialog-box">
      <h2>Ajouter une ligne {{ axis === 'x' ? 'verticale' : 'horizontale' }}</h2>

      <div class="field-row">
        <label for="al-position">Position</label>
        <input id="al-position" v-model.number="form.positionMm" type="number" min="1" step="1" />
      </div>
      <p v-if="!isValid" class="error-text">
        Position trop proche d'un bord de la boîte ou d'une autre ligne du même sens.
      </p>

      <div class="field-row">
        <label>Couleur de la ligne</label>
        <select v-model="form.colorMode">
          <option value="existing">Existante</option>
          <option value="new">Nouvelle</option>
        </select>
      </div>

      <div v-if="form.colorMode === 'existing'" class="field-row">
        <label for="al-existing">Couleur</label>
        <select id="al-existing" v-model="form.existingColorId">
          <option v-for="c in projectStore.project?.colors" :key="c.id" :value="c.id">
            {{ c.label ?? c.color }} ({{ c.heightMm }} mm)
          </option>
        </select>
      </div>
      <div v-else class="field-row">
        <label for="al-new">Couleur</label>
        <input id="al-new" v-model="form.newColorHex" type="color" />
      </div>

      <div class="dialog-actions">
        <button @click="close">Annuler</button>
        <button class="primary" :disabled="!isValid" @click="confirm">Ajouter</button>
      </div>
    </div>
  </div>
</template>
