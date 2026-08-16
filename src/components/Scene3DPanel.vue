<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import FloatingPanel from '@/components/FloatingPanel.vue';
import type { Panel } from '@/domain/models/Panel';
import { useProjectStore } from '@/stores/projectStore';
import { useUiStore } from '@/stores/uiStore';
import type { Scene3D } from '@/scene3d/Scene3D';

const emit = defineEmits<{ close: [] }>();

const projectStore = useProjectStore();
const uiStore = useUiStore();

const containerRef = ref<HTMLDivElement | null>(null);
let scene: Scene3D | null = null;
let resizeObserver: ResizeObserver | null = null;

const FALLBACK_COLOR = '#c9b48f';
// Deliberately neutral and distinct from any wood-tone project color, so the
// base plate always reads as "the floor", not as a piece that forgot to be
// colored -- easy to tell apart from the walls at a glance, which matters
// now that a genuine geometry bug that used to make the plate flicker
// through the open top (see PanelBuilder's outline-closing fix) is gone.
const BASE_PLATE_COLOR = '#8f97a3';

function colorForPanel(panel: Panel): string {
  if (panel.kind === 'basePlate') {
    return BASE_PLATE_COLOR;
  }
  const wallId = panel.kind === 'outerWall' || panel.kind === 'dividerWall' ? panel.sourceIds[0] : undefined;
  const wall = wallId ? projectStore.generatedWalls.find((w) => w.id === wallId) : undefined;
  const colorId = wall?.colorId ?? projectStore.project?.config.outerColorId;
  const color = projectStore.project?.colors.find((c) => c.id === colorId);
  return color?.color ?? FALLBACK_COLOR;
}

function rebuild(): void {
  scene?.rebuild(projectStore.generatedPanels, colorForPanel, uiStore.shelfVisible);
}

onMounted(async () => {
  await nextTick();
  if (!containerRef.value) return;
  const { Scene3D: Scene3DClass } = await import('@/scene3d/Scene3D');
  scene = new Scene3DClass(containerRef.value);
  rebuild();

  resizeObserver = new ResizeObserver(() => {
    if (containerRef.value && scene) {
      scene.resize(containerRef.value.clientWidth, containerRef.value.clientHeight);
    }
  });
  resizeObserver.observe(containerRef.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  scene?.destroy();
});

watch(() => [projectStore.generatedPanels, uiStore.shelfVisible], rebuild, { deep: true });
</script>

<template>
  <FloatingPanel title="Vue 3D" :initial-width="480" :initial-height="380" @close="emit('close')">
    <template #default>
      <div class="scene3d-wrap">
        <div ref="containerRef" class="scene3d-canvas"></div>
        <button
          class="shelf-toggle"
          :title="uiStore.shelfVisible ? 'Masquer le plateau intermédiaire' : 'Afficher le plateau intermédiaire'"
          @click="uiStore.toggleShelfVisible()"
        >
          {{ uiStore.shelfVisible ? '👁' : '🚫' }}
        </button>
      </div>
    </template>
  </FloatingPanel>
</template>

<style scoped>
.scene3d-wrap {
  position: relative;
  width: 100%;
  height: 100%;
}
.scene3d-canvas {
  width: 100%;
  height: 100%;
}
.shelf-toggle {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
}
</style>
