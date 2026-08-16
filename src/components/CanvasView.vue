<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { CanvasManager } from '@/canvas/CanvasManager';
import { renderDimensions } from '@/canvas/renderers/DimensionRenderer';
import { renderWalls } from '@/canvas/renderers/WallRenderer';
import { renderZones } from '@/canvas/renderers/ZoneRenderer';
import { useProjectStore } from '@/stores/projectStore';
import { useUiStore } from '@/stores/uiStore';

const projectStore = useProjectStore();
const uiStore = useUiStore();

const containerRef = ref<HTMLDivElement | null>(null);
let manager: CanvasManager | null = null;
let resizeObserver: ResizeObserver | null = null;

function redraw(): void {
  if (!manager || !projectStore.project || !projectStore.innerRect) return;

  renderZones(manager.zoneLayer, projectStore.project.zoneTree, projectStore.innerRect, projectStore.project.config.innerThickness, {
    onClick: (zoneId) => uiStore.openDialog({ kind: 'splitZone', zoneId }),
    onHoverChange: () => {},
  });

  renderWalls(manager.wallLayer, projectStore.generatedWalls, projectStore.project.colors, uiStore.selectedEdgeId, {
    onClick: (wallId) => uiStore.openDialog({ kind: 'edgeEdit', wallId }),
    onHoverChange: () => {},
  });

  if (uiStore.showDimensions) {
    renderDimensions(manager.dimensionLayer, projectStore.generatedWalls, uiStore.viewport.scale);
  } else {
    manager.dimensionLayer.destroyChildren();
    manager.dimensionLayer.batchDraw();
  }
}

onMounted(() => {
  if (!containerRef.value) return;
  manager = new CanvasManager({
    container: containerRef.value,
    onViewportChange: (viewport) => uiStore.setViewport(viewport),
  });

  if (projectStore.innerRect && projectStore.project) {
    const outer = projectStore.project.config.outerThickness;
    const viewport = manager.fitToView(projectStore.innerRect.width + 2 * outer, projectStore.innerRect.height + 2 * outer);
    uiStore.setViewport(viewport);
  }
  redraw();

  resizeObserver = new ResizeObserver(() => {
    if (!containerRef.value || !manager) return;
    manager.resize(containerRef.value.clientWidth, containerRef.value.clientHeight);
  });
  resizeObserver.observe(containerRef.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  manager?.destroy();
});

watch(
  () => [projectStore.project?.zoneTree, projectStore.project?.colors, projectStore.project?.config, uiStore.selectedEdgeId, uiStore.showDimensions],
  redraw,
  { deep: true },
);
</script>

<template>
  <div ref="containerRef" class="canvas-view"></div>
</template>

<style scoped>
.canvas-view {
  width: 100%;
  height: 100%;
}
</style>
