<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import AdvancedOptionsPanel from '@/components/AdvancedOptionsPanel.vue';
import CanvasView from '@/components/CanvasView.vue';
import Sidebar from '@/components/Sidebar.vue';
import EdgeEditDialog from '@/components/dialogs/EdgeEditDialog.vue';
import NewProjectDialog from '@/components/dialogs/NewProjectDialog.vue';
import RecentProjectsDialog from '@/components/dialogs/RecentProjectsDialog.vue';
import Scene3DPanel from '@/components/Scene3DPanel.vue';
import SplitZoneDialog from '@/components/dialogs/SplitZoneDialog.vue';
import type { NewProjectInput } from '@/domain/services/ProjectFactory';
import { exportProjectAsJson, importProjectFromFile } from '@/storage/JsonExporter';
import { listRecentProjects, saveProject } from '@/storage/IndexedDbStore';
import { useProjectStore } from '@/stores/projectStore';
import { useUiStore } from '@/stores/uiStore';

const projectStore = useProjectStore();
const uiStore = useUiStore();

const startupChecked = ref(false);
const hasRecentProjects = ref(false);
const importInput = ref<HTMLInputElement | null>(null);
const show3d = ref(false);

onMounted(async () => {
  hasRecentProjects.value = (await listRecentProjects(1)).length > 0;
  startupChecked.value = true;
});

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

// Debounced (~1s) autosave to IndexedDB on every project change.
let saveTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => projectStore.project,
  (project) => {
    if (!project) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveProject(project), 1000);
  },
  { deep: true },
);

function onExport(): void {
  if (projectStore.project) exportProjectAsJson(projectStore.project);
}

function onImportClick(): void {
  importInput.value?.click();
}

async function onImportChange(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const project = await importProjectFromFile(file);
  if (project) {
    projectStore.loadProject(project);
  } else {
    window.alert("Fichier invalide : ce n'est pas un projet boxes.js reconnu.");
  }
  (event.target as HTMLInputElement).value = '';
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <span>boxes.js</span>
      <div v-if="projectStore.project" style="display: flex; gap: 8px">
        <button :disabled="!projectStore.canUndo" title="Ctrl+Z" @click="projectStore.undo()">Annuler</button>
        <button :disabled="!projectStore.canRedo" title="Ctrl+Maj+Z" @click="projectStore.redo()">Rétablir</button>
        <button @click="onExport">Exporter JSON</button>
        <button @click="onImportClick">Importer JSON</button>
        <input ref="importInput" type="file" accept=".json,application/json" style="display: none" @change="onImportChange" />
        <button @click="uiStore.openDialog({ kind: 'recentProjects' })">Projets récents</button>
        <button @click="uiStore.openDialog({ kind: 'advancedOptions' })">Options avancées</button>
        <button @click="show3d = !show3d">Vue 3D</button>
        <button @click="uiStore.openDialog({ kind: 'newProject' })">Nouveau projet</button>
      </div>
    </header>

    <div class="app-body">
      <Sidebar v-if="projectStore.project" />
      <main class="app-canvas">
        <CanvasView v-if="projectStore.project" />
        <p v-else class="empty-state">Créez un nouveau projet pour commencer.</p>
        <Scene3DPanel v-if="projectStore.project && show3d" @close="show3d = false" />
      </main>
    </div>

    <template v-if="startupChecked && !projectStore.project">
      <RecentProjectsDialog v-if="hasRecentProjects && uiStore.activeDialog?.kind !== 'newProject'" />
      <NewProjectDialog v-else @create="onCreateProject" />
    </template>
    <NewProjectDialog v-else-if="uiStore.activeDialog?.kind === 'newProject'" @create="onCreateProject" />
    <RecentProjectsDialog v-if="projectStore.project && uiStore.activeDialog?.kind === 'recentProjects'" />
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
