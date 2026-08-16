<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';

import AdvancedOptionsPanel from '@/components/AdvancedOptionsPanel.vue';
import CanvasView from '@/components/CanvasView.vue';
import Sidebar from '@/components/Sidebar.vue';
import EdgeEditDialog from '@/components/dialogs/EdgeEditDialog.vue';
import NewProjectDialog from '@/components/dialogs/NewProjectDialog.vue';
import SplitZoneDialog from '@/components/dialogs/SplitZoneDialog.vue';
import type { NewProjectInput } from '@/domain/services/ProjectFactory';
import { useProjectStore } from '@/stores/projectStore';
import { useUiStore } from '@/stores/uiStore';

const projectStore = useProjectStore();
const uiStore = useUiStore();

function onCreateProject(input: NewProjectInput): void {
  projectStore.createProject(input);
  uiStore.closeDialog();
}

function onKeydown(event: KeyboardEvent): void {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
  event.preventDefault();
  if (event.shiftKey) {
    projectStore.redo();
  } else {
    projectStore.undo();
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <span>boxes.js</span>
      <div v-if="projectStore.project" style="display: flex; gap: 8px">
        <button :disabled="!projectStore.canUndo" title="Ctrl+Z" @click="projectStore.undo()">Annuler</button>
        <button :disabled="!projectStore.canRedo" title="Ctrl+Maj+Z" @click="projectStore.redo()">Rétablir</button>
        <button @click="uiStore.openDialog({ kind: 'advancedOptions' })">Options avancées</button>
        <button @click="uiStore.openDialog({ kind: 'newProject' })">Nouveau projet</button>
      </div>
    </header>

    <div class="app-body">
      <Sidebar v-if="projectStore.project" />
      <main class="app-canvas">
        <CanvasView v-if="projectStore.project" />
        <p v-else class="empty-state">Créez un nouveau projet pour commencer.</p>
      </main>
    </div>

    <NewProjectDialog v-if="!projectStore.project || uiStore.activeDialog?.kind === 'newProject'" @create="onCreateProject" />
    <SplitZoneDialog v-if="uiStore.activeDialog?.kind === 'splitZone'" :zone-id="uiStore.activeDialog.zoneId" />
    <EdgeEditDialog v-if="uiStore.activeDialog?.kind === 'edgeEdit'" :wall-id="uiStore.activeDialog.wallId" />
    <AdvancedOptionsPanel v-if="uiStore.activeDialog?.kind === 'advancedOptions'" />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--color-border);
  font-weight: 600;
}
.app-body {
  flex: 1;
  display: flex;
  min-height: 0;
}
.app-canvas {
  flex: 1;
  position: relative;
}
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-fg-muted);
}
</style>
