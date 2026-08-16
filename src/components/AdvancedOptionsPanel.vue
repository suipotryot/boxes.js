<script setup lang="ts">
import { reactive, watch } from 'vue';

import { useProjectStore } from '@/stores/projectStore';
import { useUiStore } from '@/stores/uiStore';

const projectStore = useProjectStore();
const uiStore = useUiStore();

const form = reactive({
  laserBedX: 0,
  laserBedY: 0,
  burnMm: 0,
  innerCornerStyle: 'corner' as 'loop' | 'corner' | 'backarc',
  partSpacingMm: 0,
  fingerMm: 0,
  spaceMm: 0,
  edgeWidthMm: 0,
  playMm: 0,
  extraLengthMm: 0,
  surroundingSpaces: 0,
});

function syncFromStore(): void {
  const adv = projectStore.project?.config.advanced;
  if (!adv) return;
  form.laserBedX = adv.laserBedX;
  form.laserBedY = adv.laserBedY;
  form.burnMm = adv.burnMm;
  form.innerCornerStyle = adv.innerCornerStyle;
  form.partSpacingMm = adv.partSpacingMm;
  form.fingerMm = adv.fingerJoint.fingerMm;
  form.spaceMm = adv.fingerJoint.spaceMm;
  form.edgeWidthMm = adv.fingerJoint.edgeWidthMm;
  form.playMm = adv.fingerJoint.playMm;
  form.extraLengthMm = adv.fingerJoint.extraLengthMm;
  form.surroundingSpaces = adv.fingerJoint.surroundingSpaces;
}
syncFromStore();
watch(() => uiStore.activeDialog, (d) => { if (d?.kind === 'advancedOptions') syncFromStore(); });

function apply(): void {
  const current = projectStore.project?.config.advanced;
  if (!current) return;
  projectStore.updateConfig({
    advanced: {
      ...current,
      laserBedX: form.laserBedX,
      laserBedY: form.laserBedY,
      burnMm: form.burnMm,
      innerCornerStyle: form.innerCornerStyle,
      partSpacingMm: form.partSpacingMm,
      fingerJoint: {
        ...current.fingerJoint,
        fingerMm: form.fingerMm,
        spaceMm: form.spaceMm,
        edgeWidthMm: form.edgeWidthMm,
        playMm: form.playMm,
        extraLengthMm: form.extraLengthMm,
        surroundingSpaces: form.surroundingSpaces,
      },
    },
  });
  uiStore.closeDialog();
}
</script>

<template>
  <div class="dialog-overlay" @click.self="uiStore.closeDialog()">
    <div class="dialog-box">
      <h2>Options avancées</h2>

      <h3>Plateau laser</h3>
      <div class="field-row">
        <label>Largeur</label>
        <input v-model.number="form.laserBedX" type="number" min="1" />
      </div>
      <div class="field-row">
        <label>Hauteur</label>
        <input v-model.number="form.laserBedY" type="number" min="1" />
      </div>

      <h3>Découpe</h3>
      <div class="field-row">
        <label>Correction burn</label>
        <input v-model.number="form.burnMm" type="number" min="0" step="0.01" />
      </div>
      <div class="field-row">
        <label>Style coin intérieur</label>
        <select v-model="form.innerCornerStyle">
          <option value="corner">Angle net</option>
          <option value="backarc">Arc de dégagement</option>
          <option value="loop">Boucle de dégagement</option>
        </select>
      </div>
      <div class="field-row">
        <label>Espacement des pièces</label>
        <input v-model.number="form.partSpacingMm" type="number" min="0" step="0.5" />
      </div>

      <h3>Assemblage à doigts</h3>
      <div class="field-row">
        <label>Largeur doigt</label>
        <input v-model.number="form.fingerMm" type="number" min="0.5" step="0.5" />
      </div>
      <div class="field-row">
        <label>Largeur espace</label>
        <input v-model.number="form.spaceMm" type="number" min="0.5" step="0.5" />
      </div>
      <div class="field-row">
        <label>Marge de bord</label>
        <input v-model.number="form.edgeWidthMm" type="number" min="0" step="0.5" />
      </div>
      <div class="field-row">
        <label>Jeu</label>
        <input v-model.number="form.playMm" type="number" min="0" step="0.01" />
      </div>
      <div class="field-row">
        <label>Longueur supplémentaire</label>
        <input v-model.number="form.extraLengthMm" type="number" min="0" step="0.1" />
      </div>
      <div class="field-row">
        <label>Espaces environnants</label>
        <input v-model.number="form.surroundingSpaces" type="number" min="0" step="1" />
      </div>

      <div class="dialog-actions">
        <button @click="uiStore.closeDialog()">Annuler</button>
        <button class="primary" @click="apply">Appliquer</button>
      </div>
    </div>
  </div>
</template>
