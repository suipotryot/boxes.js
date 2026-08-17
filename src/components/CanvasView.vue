<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { CanvasManager } from '@/canvas/CanvasManager';
import { renderDimensions } from '@/canvas/renderers/DimensionRenderer';
import { clearLinePlacementGhost, renderLinePlacementGhost } from '@/canvas/renderers/LinePlacementRenderer';
import { renderWalls } from '@/canvas/renderers/WallRenderer';
import { toContentPoint, toStagePoint } from '@/canvas/Viewport';
import { canAddLine, computeLineMoveBounds, parseDividerWallId } from '@/domain/services/GridDivider';
import { isWallVertical } from '@/domain/services/JunctionClassifier';
import { useProjectStore } from '@/stores/projectStore';
import { useUiStore } from '@/stores/uiStore';

const projectStore = useProjectStore();
const uiStore = useUiStore();

const containerRef = ref<HTMLDivElement | null>(null);
let manager: CanvasManager | null = null;
let resizeObserver: ResizeObserver | null = null;
const placementPositionMm = ref<number | null>(null);

function redraw(): void {
  if (!manager || !projectStore.project || !projectStore.innerRect) return;

  const endExtensionMm = Math.max(projectStore.project.config.outerThickness, projectStore.project.config.innerThickness) / 2;
  renderWalls(manager.wallLayer, projectStore.generatedWalls, projectStore.project.colors, uiStore.selectedEdgeId, endExtensionMm, {
    onClick: (wallId) => uiStore.openDialog({ kind: 'edgeEdit', wallId }),
    onHoverChange: () => {},
    onDragBound: onWallDragBound,
    onDragEnd: onWallDragEnd,
  });

  if (uiStore.showDimensions) {
    renderDimensions(manager.dimensionLayer, projectStore.generatedWalls, uiStore.viewport.scale);
  } else {
    manager.dimensionLayer.destroyChildren();
    manager.dimensionLayer.batchDraw();
  }

  updatePlacementGhost();
}

function updatePlacementGhost(): void {
  if (!manager) return;
  const axis = uiStore.linePlacementAxis;
  if (!axis || !projectStore.project || !projectStore.innerRect || placementPositionMm.value === null) {
    clearLinePlacementGhost(manager.placementLayer);
    return;
  }
  const valid = canAddLine(projectStore.project.grid.lines, axis, placementPositionMm.value, projectStore.innerRect);
  renderLinePlacementGhost(manager.placementLayer, projectStore.innerRect, projectStore.project.config.outerThickness, axis, placementPositionMm.value, valid);
}

function onStageMouseMove(): void {
  if (!manager || !uiStore.linePlacementAxis || !projectStore.innerRect) return;
  const pointer = manager.stage.getPointerPosition();
  if (!pointer) return;
  const content = toContentPoint(uiStore.viewport, pointer);
  placementPositionMm.value = uiStore.linePlacementAxis === 'x' ? content.x - projectStore.innerRect.x : content.y - projectStore.innerRect.y;
  updatePlacementGhost();
}

function onStageClick(): void {
  if (!uiStore.linePlacementAxis || placementPositionMm.value === null) return;
  const axis = uiStore.linePlacementAxis;
  const positionMm = Math.round(placementPositionMm.value);
  uiStore.setLinePlacementAxis(null);
  placementPositionMm.value = null;
  uiStore.openDialog({ kind: 'addLine', axis, positionMm });
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && uiStore.linePlacementAxis) {
    uiStore.setLinePlacementAxis(null);
    placementPositionMm.value = null;
    updatePlacementGhost();
  }
}

/** dragBoundFunc contract: `pos` is Konva's absolute (stage-pixel)
 * position, and the return value must be too (see WallRenderer.ts). Locks
 * movement to the wall's own perpendicular axis and clamps to its carrying
 * line's valid move bounds, both computed in content-mm space. */
function onWallDragBound(wallId: string, pos: { x: number; y: number }): { x: number; y: number } {
  if (!projectStore.project || !projectStore.innerRect) return pos;
  const parsed = parseDividerWallId(wallId);
  const wall = parsed ? projectStore.generatedWalls.find((w) => w.id === wallId) : null;
  if (!parsed || !wall) return pos;

  const bounds = computeLineMoveBounds(projectStore.project.grid.lines, parsed.lineId, projectStore.innerRect);
  const content = toContentPoint(uiStore.viewport, pos);
  const vertical = isWallVertical(wall);
  if (vertical) {
    const offset = Math.min(bounds.max, Math.max(bounds.min, content.x - projectStore.innerRect.x));
    return toStagePoint(uiStore.viewport, { x: projectStore.innerRect.x + offset, y: wall.a.y });
  }
  const offset = Math.min(bounds.max, Math.max(bounds.min, content.y - projectStore.innerRect.y));
  return toStagePoint(uiStore.viewport, { x: wall.a.x, y: projectStore.innerRect.y + offset });
}

function onWallDragEnd(wallId: string, pos: { x: number; y: number }): void {
  if (!projectStore.project || !projectStore.innerRect) return;
  const parsed = parseDividerWallId(wallId);
  const wall = parsed ? projectStore.generatedWalls.find((w) => w.id === wallId) : null;
  if (!parsed || !wall) return;

  const content = toContentPoint(uiStore.viewport, pos);
  const vertical = isWallVertical(wall);
  const positionMm = vertical ? content.x - projectStore.innerRect.x : content.y - projectStore.innerRect.y;
  projectStore.moveLine(parsed.lineId, positionMm);
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

  manager.stage.on('mousemove', onStageMouseMove);
  manager.stage.on('click tap', onStageClick);
  window.addEventListener('keydown', onKeydown);

  resizeObserver = new ResizeObserver(() => {
    if (!containerRef.value || !manager) return;
    manager.resize(containerRef.value.clientWidth, containerRef.value.clientHeight);
  });
  resizeObserver.observe(containerRef.value);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  resizeObserver?.disconnect();
  manager?.destroy();
});

watch(
  () => [projectStore.project?.grid, projectStore.project?.colors, projectStore.project?.config, uiStore.selectedEdgeId, uiStore.showDimensions],
  redraw,
  { deep: true },
);

watch(() => uiStore.linePlacementAxis, updatePlacementGhost);
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
