<script setup lang="ts">
import { computed, reactive } from 'vue';

import type { NotchEdgeSide, NotchShape } from '@/domain/models/Notch';
import { createId } from '@/domain/services/GeometryUtils';
import { canMoveLineTo, neighborRefEqual, parseDividerWallId } from '@/domain/services/GridDivider';
import { useProjectStore } from '@/stores/projectStore';
import { useUiStore } from '@/stores/uiStore';

const props = defineProps<{ wallId: string }>();

const projectStore = useProjectStore();
const uiStore = useUiStore();

const wall = computed(() => projectStore.generatedWalls.find((w) => w.id === props.wallId) ?? null);
const wallLength = computed(() => {
  if (!wall.value) return 0;
  return Math.hypot(wall.value.b.x - wall.value.a.x, wall.value.b.y - wall.value.a.y);
});
const colorEntry = computed(() => projectStore.project?.colors.find((c) => c.id === wall.value?.colorId) ?? null);

// Divider wall ids encode both the carrying line's id and the exact
// segment's neighbour-pair identity (see GridDivider.segmentWallId) -- so
// both the line and the specific clicked segment are recovered directly.
const parsed = computed(() => (wall.value && !wall.value.isOuter ? parseDividerWallId(wall.value.id) : null));
const line = computed(() => {
  if (!parsed.value || !projectStore.project) return null;
  return projectStore.project.grid.lines.find((l) => l.id === parsed.value!.lineId) ?? null;
});
const segmentOverride = computed(() => {
  if (!parsed.value || !line.value) return null;
  return line.value.segmentOverrides.find((o) => neighborRefEqual(o.start, parsed.value!.start) && neighborRefEqual(o.end, parsed.value!.end)) ?? null;
});
const segmentNotches = computed(() => segmentOverride.value?.notches ?? []);

const colorMode = reactive({ mode: 'existing' as 'existing' | 'new', existingId: colorEntry.value?.id ?? '', newHex: '#4ade80' });

function applyColor(): void {
  if (!wall.value) return;
  const colorId = colorMode.mode === 'existing' ? colorMode.existingId : projectStore.findOrCreateColor(colorMode.newHex);
  // Outer walls share one project-wide color; a divider's own line carries
  // its default color (individual segments can override it separately --
  // not yet exposed in this dialog, see the note below).
  if (wall.value.isOuter) {
    projectStore.updateConfig({ outerColorId: colorId });
  } else if (line.value) {
    projectStore.updateLineColor(line.value.id, colorId);
  }
}

const positionError = reactive({ message: '' });

function applyPosition(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (!line.value || !projectStore.innerRect) return;
  const positionMm = Number(input.value);
  positionError.message = '';
  if (!canMoveLineTo(projectStore.project!.grid.lines, line.value.id, positionMm, projectStore.innerRect)) {
    input.value = String(line.value.positionMm);
    positionError.message = 'Position refusée : trop proche du bord ou d\'une autre ligne du même sens.';
    return;
  }
  projectStore.moveLine(line.value.id, positionMm);
}

const newNotch = reactive({ width: 20, depth: 10, shape: 'rect' as NotchShape, edgeSide: 'top' as NotchEdgeSide });

function addNotch(): void {
  if (!line.value || !parsed.value) return;
  projectStore.addNotch(line.value.id, parsed.value.start, parsed.value.end, { id: createId('notch'), ...newNotch });
}

function removeNotch(notchId: string): void {
  if (!line.value || !parsed.value) return;
  projectStore.removeNotch(line.value.id, parsed.value.start, parsed.value.end, notchId);
}

function close(): void {
  uiStore.closeDialog();
}

function removeLine(): void {
  if (!line.value) return;
  projectStore.removeLine(line.value.id);
  close();
}
</script>

<template>
  <div v-if="wall" class="dialog-overlay" @click.self="close">
    <div class="dialog-box">
      <h2>Arête {{ wall.isOuter ? 'extérieure' : 'de cloison' }}</h2>

      <div class="field-row">
        <label>Couleur</label>
        <select v-model="colorMode.mode" @change="applyColor">
          <option value="existing">Existante</option>
          <option value="new">Nouvelle</option>
        </select>
      </div>
      <div v-if="colorMode.mode === 'existing'" class="field-row">
        <label></label>
        <select v-model="colorMode.existingId" @change="applyColor">
          <option v-for="c in projectStore.project?.colors" :key="c.id" :value="c.id">
            {{ c.label ?? c.color }} ({{ c.heightMm }} mm)
          </option>
        </select>
      </div>
      <div v-else class="field-row">
        <label></label>
        <input v-model="colorMode.newHex" type="color" @change="applyColor" />
      </div>

      <div class="field-row">
        <label>Hauteur</label>
        <span>{{ colorEntry?.heightMm ?? '?' }} mm (via la légende)</span>
      </div>
      <div class="field-row">
        <label>Longueur</label>
        <span>{{ wallLength.toFixed(1) }} mm</span>
      </div>
      <div class="field-row">
        <label>Épaisseur</label>
        <span>{{ wall.thickness }} mm</span>
      </div>

      <template v-if="!wall.isOuter && line">
        <div class="field-row">
          <label for="ee-position">Position de la ligne</label>
          <input id="ee-position" :value="line.positionMm" type="number" step="1" @change="applyPosition" />
        </div>
        <p v-if="positionError.message" class="error-text">{{ positionError.message }}</p>

        <h3>Encoches de préhension (ce segment)</h3>
        <ul>
          <li v-for="n in segmentNotches" :key="n.id">
            {{ n.edgeSide }} · {{ n.shape }} · {{ n.width }}x{{ n.depth }} mm
            <button @click="removeNotch(n.id)">Supprimer</button>
          </li>
        </ul>
        <div class="field-row">
          <label>Largeur</label>
          <input v-model.number="newNotch.width" type="number" min="1" />
        </div>
        <div class="field-row">
          <label>Profondeur</label>
          <input v-model.number="newNotch.depth" type="number" min="1" />
        </div>
        <div class="field-row">
          <label>Forme</label>
          <select v-model="newNotch.shape">
            <option value="rect">Rectangulaire</option>
            <option value="round">Arrondie</option>
          </select>
        </div>
        <div class="field-row">
          <label>Bord</label>
          <select v-model="newNotch.edgeSide">
            <option value="top">Haut</option>
            <option value="bottom">Bas</option>
          </select>
        </div>
        <button @click="addNotch">Ajouter une encoche</button>

        <div class="dialog-actions" style="justify-content: flex-start; margin-top: 20px">
          <button style="color: var(--color-danger)" @click="removeLine">Supprimer cette ligne</button>
        </div>
      </template>

      <div class="dialog-actions">
        <button class="primary" @click="close">Fermer</button>
      </div>
    </div>
  </div>
</template>
