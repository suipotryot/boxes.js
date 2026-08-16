<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { deleteStoredProject, listRecentProjects, loadStoredProject, type StoredProject } from '@/storage/IndexedDbStore';
import { useProjectStore } from '@/stores/projectStore';
import { useUiStore } from '@/stores/uiStore';

const projectStore = useProjectStore();
const uiStore = useUiStore();

const recent = ref<StoredProject[]>([]);

onMounted(async () => {
  recent.value = await listRecentProjects();
});

async function openProject(id: string): Promise<void> {
  const project = await loadStoredProject(id);
  if (project) {
    projectStore.loadProject(project);
    uiStore.closeDialog();
  }
}

async function removeProject(id: string): Promise<void> {
  await deleteStoredProject(id);
  recent.value = recent.value.filter((r) => r.id !== id);
}

function startNew(): void {
  uiStore.openDialog({ kind: 'newProject' });
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('fr-FR');
}
</script>

<template>
  <div class="dialog-overlay">
    <div class="dialog-box">
      <h2>Projets récents</h2>

      <ul v-if="recent.length" class="recent-list">
        <li v-for="r in recent" :key="r.id" class="recent-row">
          <button class="recent-open" @click="openProject(r.id)">
            <strong>{{ r.name }}</strong>
            <span class="recent-date">{{ formatDate(r.updatedAt) }}</span>
          </button>
          <button @click="removeProject(r.id)">Supprimer</button>
        </li>
      </ul>
      <p v-else style="color: var(--color-fg-muted)">Aucun projet enregistré.</p>

      <div class="dialog-actions">
        <button class="primary" @click="startNew">Nouveau projet</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.recent-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 40vh;
  overflow-y: auto;
}
.recent-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.recent-open {
  flex: 1;
  display: flex;
  justify-content: space-between;
  text-align: left;
}
.recent-date {
  color: var(--color-fg-muted);
  font-size: 12px;
}
</style>
