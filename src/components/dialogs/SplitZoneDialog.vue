<script setup lang="ts">
import { computed, reactive } from 'vue';

import { canSplitZone, computeZoneRects } from '@/domain/services/ZoneTree';
import type { Axis } from '@/domain/models/types';
import { useProjectStore } from '@/stores/projectStore';
import { useUiStore } from '@/stores/uiStore';

const props = defineProps<{ zoneId: string }>();

const projectStore = useProjectStore();
const uiStore = useUiStore();

const zoneRect = computed(() => {
  if (!projectStore.project || !projectStore.innerRect) return null;
  const rects = computeZoneRects(projectStore.project.zoneTree, projectStore.innerRect, projectStore.project.config.innerThickness);
  return rects.get(props.zoneId) ?? null;
});

const form = reactive({
  axis: 'x' as Axis,
  firstSize: 0,
  colorMode: 'existing' as 'existing' | 'new',
  existingColorId: projectStore.project?.colors[0]?.id ?? '',
  newColorHex: '#4ade80',
});

if (zoneRect.value) {
  form.firstSize = Math.round((form.axis === 'x' ? zoneRect.value.width : zoneRect.value.height) / 2);
}

const innerThickness = computed(() => projectStore.project?.config.innerThickness ?? 0);

const isValid = computed(() => {
  if (!zoneRect.value) return false;
  return canSplitZone(zoneRect.value, form.axis, form.firstSize, innerThickness.value);
});

function close(): void {
  uiStore.closeDialog();
}

function confirm(): void {
  if (!zoneRect.value || !isValid.value) return;
  const colorId = form.colorMode === 'existing' ? form.existingColorId : projectStore.findOrCreateColor(form.newColorHex);
  const ok = projectStore.splitZone(props.zoneId, form.axis, form.firstSize, colorId);
  if (ok) close();
}
</script>

<template>
  <div class="dialog-overlay" @click.self="close">
    <div class="dialog-box">
      <h2>Diviser la zone</h2>
      <p v-if="zoneRect" style="color: var(--color-fg-muted)">
        {{ zoneRect.width.toFixed(1) }} x {{ zoneRect.height.toFixed(1) }} mm
      </p>

      <div class="field-row">
        <label>Sens de coupe</label>
        <select v-model="form.axis">
          <option value="x">Verticale (gauche / droite)</option>
          <option value="y">Horizontale (haut / bas)</option>
        </select>
      </div>

      <div class="field-row">
        <label for="sz-first">Taille du 1er côté</label>
        <input id="sz-first" v-model.number="form.firstSize" type="number" min="1" step="1" />
      </div>
      <p v-if="!isValid" class="error-text">
        Ne laisse pas assez de place pour la cloison (épaisseur {{ innerThickness }} mm) et les deux zones.
      </p>

      <div class="field-row">
        <label>Couleur de la cloison</label>
        <select v-model="form.colorMode">
          <option value="existing">Existante</option>
          <option value="new">Nouvelle</option>
        </select>
      </div>

      <div v-if="form.colorMode === 'existing'" class="field-row">
        <label for="sz-existing">Couleur</label>
        <select id="sz-existing" v-model="form.existingColorId">
          <option v-for="c in projectStore.project?.colors" :key="c.id" :value="c.id">
            {{ c.label ?? c.color }} ({{ c.heightMm }} mm)
          </option>
        </select>
      </div>
      <div v-else class="field-row">
        <label for="sz-new">Couleur</label>
        <input id="sz-new" v-model="form.newColorHex" type="color" />
      </div>

      <div class="dialog-actions">
        <button @click="close">Annuler</button>
        <button class="primary" :disabled="!isValid" @click="confirm">Diviser</button>
      </div>
    </div>
  </div>
</template>
