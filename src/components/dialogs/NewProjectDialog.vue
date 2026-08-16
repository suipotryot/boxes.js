<script setup lang="ts">
import { reactive } from 'vue';

import type { NewProjectInput } from '@/domain/services/ProjectFactory';

const emit = defineEmits<{
  create: [input: NewProjectInput];
}>();

const form = reactive({
  name: 'Ma boîte',
  dimXValue: 200,
  dimXMode: 'outer' as 'inner' | 'outer',
  dimYValue: 150,
  dimYMode: 'outer' as 'inner' | 'outer',
  outerThickness: 4,
  innerThickness: 3,
  baseWallHeightMm: 40,
  hasBottom: true,
});

function submit(): void {
  emit('create', {
    name: form.name.trim() || 'Boîte sans nom',
    outerThickness: form.outerThickness,
    innerThickness: form.innerThickness,
    baseWallHeightMm: form.baseWallHeightMm,
    dimX: { value: form.dimXValue, mode: form.dimXMode },
    dimY: { value: form.dimYValue, mode: form.dimYMode },
    hasBottom: form.hasBottom,
  });
}
</script>

<template>
  <div class="dialog-overlay">
    <div class="dialog-box">
      <h2>Nouvelle boîte</h2>

      <div class="field-row">
        <label for="np-name">Nom</label>
        <input id="np-name" v-model="form.name" type="text" />
      </div>

      <div class="field-row">
        <label for="np-dimx">Largeur (X)</label>
        <input id="np-dimx" v-model.number="form.dimXValue" type="number" min="1" step="1" />
        <span class="unit">mm</span>
        <select v-model="form.dimXMode">
          <option value="outer">extérieure</option>
          <option value="inner">intérieure</option>
        </select>
      </div>

      <div class="field-row">
        <label for="np-dimy">Hauteur (Y)</label>
        <input id="np-dimy" v-model.number="form.dimYValue" type="number" min="1" step="1" />
        <span class="unit">mm</span>
        <select v-model="form.dimYMode">
          <option value="outer">extérieure</option>
          <option value="inner">intérieure</option>
        </select>
      </div>

      <div class="field-row">
        <label for="np-outer">Épaisseur parois extérieures</label>
        <input id="np-outer" v-model.number="form.outerThickness" type="number" min="0.1" step="0.1" />
        <span class="unit">mm</span>
      </div>

      <div class="field-row">
        <label for="np-inner">Épaisseur cloisons</label>
        <input id="np-inner" v-model.number="form.innerThickness" type="number" min="0.1" step="0.1" />
        <span class="unit">mm</span>
      </div>

      <div class="field-row">
        <label for="np-height">Profondeur de la boîte</label>
        <input id="np-height" v-model.number="form.baseWallHeightMm" type="number" min="1" step="1" />
        <span class="unit">mm</span>
      </div>

      <div class="field-row">
        <label for="np-bottom">Fond plein</label>
        <input id="np-bottom" v-model="form.hasBottom" type="checkbox" />
      </div>

      <div class="dialog-actions">
        <button class="primary" @click="submit">Créer</button>
      </div>
    </div>
  </div>
</template>
