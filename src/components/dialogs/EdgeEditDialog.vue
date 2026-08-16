<script setup lang="ts">
import { computed, reactive } from 'vue';

import { createId } from '@/domain/services/GeometryUtils';
import type { NotchShape, NotchEdgeSide } from '@/domain/models/Notch';
import { useProjectStore } from '@/stores/projectStore';
import { useUiStore } from '@/stores/uiStore';

const props = defineProps<{ wallId: string }>();

const projectStore = useProjectStore();
const uiStore = useUiStore();

const DIVIDER_PREFIX = 'divider-';

const wall = computed(() => projectStore.generatedWalls.find((w) => w.id === props.wallId) ?? null);
const wallLength = computed(() => {
  if (!wall.value) return 0;
  return Math.hypot(wall.value.b.x - wall.value.a.x, wall.value.b.y - wall.value.a.y);
});
const colorEntry = computed(() => projectStore.project?.colors.find((c) => c.id === wall.value?.colorId) ?? null);

// Wall ids for dividers are `divider-${split.id}` (deterministic, see
// WallExtractor) -- so the owning split id is recovered directly, no tree
// walk needed.
const splitId = computed(() => {
  if (!wall.value || wall.value.isOuter || !wall.value.id.startsWith(DIVIDER_PREFIX)) return null;
  return wall.value.id.slice(DIVIDER_PREFIX.length);
});
const split = computed(() => {
  if (!splitId.value || !projectStore.project) return null;
  return findSplit(projectStore.project.zoneTree, splitId.value);
});

function findSplit(node: import('@/domain/models/Zone').ZoneNode, id: string): import('@/domain/models/Zone').ZoneSplit | null {
  if (node.kind === 'leaf') return null;
  if (node.id === id) return node;
  return findSplit(node.first, id) ?? findSplit(node.second, id);
}

const colorMode = reactive({ mode: 'existing' as 'existing' | 'new', existingId: colorEntry.value?.id ?? '', newHex: '#4ade80' });

function applyColor(): void {
  if (!wall.value) return;
  const colorId = colorMode.mode === 'existing' ? colorMode.existingId : projectStore.findOrCreateColor(colorMode.newHex);
  // Outer walls share one project-wide color; divider walls carry their own
  // colorId on the owning split.
  if (wall.value.isOuter) {
    projectStore.updateConfig({ outerColorId: colorId });
  } else if (splitId.value) {
    projectStore.updateDividerColor(splitId.value, colorId);
  }
}

const newNotch = reactive({ width: 20, depth: 10, shape: 'rect' as NotchShape, edgeSide: 'top' as NotchEdgeSide });

function addNotch(): void {
  if (!splitId.value) return;
  projectStore.addNotch(splitId.value, { id: createId('notch'), ...newNotch });
}

function removeNotch(notchId: string): void {
  if (!splitId.value) return;
  projectStore.removeNotch(splitId.value, notchId);
}

function close(): void {
  uiStore.closeDialog();
}

function mergeDivider(): void {
  if (!splitId.value) return;
  projectStore.mergeZone(splitId.value);
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

      <template v-if="!wall.isOuter && split">
        <h3>Encoches de préhension</h3>
        <ul>
          <li v-for="n in split.notches" :key="n.id">
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
          <button style="color: var(--color-danger)" @click="mergeDivider">Supprimer cette cloison</button>
        </div>
      </template>

      <div class="dialog-actions">
        <button class="primary" @click="close">Fermer</button>
      </div>
    </div>
  </div>
</template>
